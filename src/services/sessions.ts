// Operações de sessão de estudo. Cada ação grava somente a mudança de estado
// (início, pausa, retomada, troca de fase, fim) — nunca a cada segundo.
// Todas são seguras contra cliques repetidos: atualizações são condicionais
// ao status atual e inserções usam IDs gerados no cliente.
import type { ActivityType, StudySession, TimerConfig, TimerMode, UserSettings } from '@/types/db'
import { DataError, eq, inList, isNull, type DataBackend, type SessionWithPauses } from '@/lib/data/types'
import { acknowledgePhase, advancePhase, initialTimerState, netSeconds, openPause, phaseAt, pomodoroPhases } from '@/lib/timer/engine'
import { applyStudy, type PartialDecision } from '@/lib/cycle'
import { addDays, dayKey } from '@/lib/time'

export const LIVE_STATUSES = ['active', 'pending_review'] as const

export async function getLiveSession(backend: DataBackend): Promise<SessionWithPauses | null> {
  const rows = await backend.listSessions({
    filters: [inList('status', [...LIVE_STATUSES])],
    order: [{ column: 'started_at', ascending: false }],
    limit: 1,
  })
  return rows[0] ?? null
}

export interface StartParams {
  subject_id: string | null
  topic_id: string | null
  activity_type: ActivityType
  mode: Exclude<TimerMode, 'manual'>
  planned_minutes?: number | null
  pomodoro?: UserSettings['pomodoro']
  intervals?: TimerConfig['phases']
  repeatIntervals?: boolean
  notes?: string | null
  plan_item_id?: string | null
  cycle_id?: string | null
  cycle_item_id?: string | null
}

export function buildTimerConfig(p: StartParams): { config: TimerConfig | null; planned: number | null } {
  switch (p.mode) {
    case 'stopwatch':
      return { config: null, planned: p.planned_minutes ? p.planned_minutes * 60 : null }
    case 'countdown': {
      const secs = Math.max(60, Math.round((p.planned_minutes ?? 25) * 60))
      return { config: { phases: [{ kind: 'focus', seconds: secs, label: 'Tempo planejado' }], repeat: false }, planned: secs }
    }
    case 'pomodoro': {
      const pomo = p.pomodoro ?? { focus: 25, shortBreak: 5, longBreak: 15, rounds: 4 }
      return { config: { phases: pomodoroPhases(pomo), repeat: true, pomodoro: pomo }, planned: null }
    }
    case 'intervals': {
      const phases = (p.intervals ?? []).filter((x) => x.seconds > 0)
      if (phases.length === 0) throw new DataError('validation', 'Adicione pelo menos um intervalo.')
      const focus = phases.filter((x) => x.kind === 'focus').reduce((a, x) => a + x.seconds, 0)
      return { config: { phases, repeat: Boolean(p.repeatIntervals) }, planned: p.repeatIntervals ? null : focus || null }
    }
  }
}

export async function startSession(backend: DataBackend, p: StartParams, id: string = crypto.randomUUID()): Promise<StudySession> {
  const now = Date.now()
  const { config, planned } = buildTimerConfig(p)
  try {
    const [row] = await backend.insert('study_sessions', [
      {
        id,
        subject_id: p.subject_id,
        topic_id: p.topic_id,
        activity_type: p.activity_type,
        mode: p.mode,
        status: 'active',
        started_at: new Date(now).toISOString(),
        planned_seconds: planned,
        timer_config: config,
        timer_state: config ? initialTimerState(now) : null,
        notes: p.notes ?? null,
        plan_item_id: p.plan_item_id ?? null,
        cycle_id: p.cycle_id ?? null,
        cycle_item_id: p.cycle_item_id ?? null,
      },
    ])
    return row
  } catch (e) {
    if (e instanceof DataError && e.code === 'duplicate') {
      // Clique repetido com o mesmo ID, ou já existe sessão em andamento.
      const live = await getLiveSession(backend)
      if (live?.id === id) return live
      throw new DataError('duplicate', 'Já existe uma sessão em andamento. Finalize-a antes de iniciar outra.')
    }
    throw e
  }
}

export async function pauseSession(backend: DataBackend, s: SessionWithPauses, kind: 'pause' | 'break' = 'pause', at = Date.now()) {
  if (s.status !== 'active' || openPause(s.pauses)) return
  try {
    await backend.insert('study_session_pauses', [{ session_id: s.id, kind, started_at: new Date(at).toISOString() }])
  } catch (e) {
    if (!(e instanceof DataError && e.code === 'duplicate')) throw e // já pausada em outra aba
  }
}

export async function resumeSession(backend: DataBackend, s: SessionWithPauses, at = Date.now()) {
  await backend.update('study_session_pauses', [eq('session_id', s.id), isNull('ended_at')], { ended_at: new Date(at).toISOString() })
}

/** Fim de uma fase de foco: inicia a pausa programada (ou o próximo bloco). */
export async function nextPhase(backend: DataBackend, s: SessionWithPauses, at = Date.now()) {
  if (s.status !== 'active' || !s.timer_config) return
  const state = s.timer_state ?? initialTimerState(new Date(s.started_at).getTime())
  const current = phaseAt(s.timer_config, state.phaseIndex)
  const next = phaseAt(s.timer_config, state.phaseIndex + 1)
  const open = openPause(s.pauses)
  if (current?.kind === 'break' || (open && open.kind === 'break')) {
    await resumeSession(backend, s, at)
  } else if (open) {
    // Pausa manual aberta: encerra antes de trocar de fase.
    await resumeSession(backend, s, at)
  }
  // Pausas abertas contam até `at`, então o líquido é o mesmo antes e depois de fechá-las.
  const net = netSeconds(s, s.pauses, at)
  if (next?.kind === 'break') {
    try {
      await backend.insert('study_session_pauses', [{ session_id: s.id, kind: 'break', started_at: new Date(at).toISOString() }])
    } catch (e) {
      if (!(e instanceof DataError && e.code === 'duplicate')) throw e
    }
  }
  await backend.update('study_sessions', [eq('id', s.id), eq('status', 'active')], { timer_state: advancePhase(state, net, at) })
}

export async function acknowledgeAlert(backend: DataBackend, s: SessionWithPauses) {
  if (!s.timer_state) return
  await backend.update('study_sessions', [eq('id', s.id), eq('status', 'active')], { timer_state: acknowledgePhase(s.timer_state) })
}

/** Finalizar: congela o horário de término e aguarda a confirmação do resumo. */
export async function finishSession(backend: DataBackend, s: SessionWithPauses, at = Date.now()) {
  if (s.status !== 'active') return
  const iso = new Date(at).toISOString()
  await backend.update('study_session_pauses', [eq('session_id', s.id), isNull('ended_at')], { ended_at: iso })
  await backend.update('study_sessions', [eq('id', s.id), eq('status', 'active')], { status: 'pending_review', ended_at: iso })
}

/** Cancelar sem salvar: a sessão não conta como estudo. */
export async function discardSession(backend: DataBackend, s: SessionWithPauses, at = Date.now()) {
  const iso = new Date(at).toISOString()
  await backend.update('study_session_pauses', [eq('session_id', s.id), isNull('ended_at')], { ended_at: iso })
  await backend.update('study_sessions', [eq('id', s.id), inList('status', [...LIVE_STATUSES])], {
    status: 'cancelled',
    ended_at: s.ended_at ?? iso,
  })
}

export interface ConfirmParams {
  subject_id: string | null
  topic_id: string | null
  activity_type: ActivityType
  notes: string | null
  adjustment_seconds: number
  /** Revisões automáticas (dias após hoje) a criar para o tópico. */
  scheduleReviews: number[]
  /** Revisões planejadas que o usuário marcou explicitamente como realizadas. */
  completeReviewIds: string[]
  cycleDecision: PartialDecision
  timezone: string
}

export interface ConfirmResult {
  saved: boolean
  netSeconds: number
  cycleAdvanced?: boolean
}

/** Salva a sessão e aplica efeitos: tópico, bloco do cronograma, ciclo, revisões. */
export async function confirmSession(backend: DataBackend, s: SessionWithPauses, p: ConfirmParams): Promise<ConfirmResult> {
  const updated = await backend.update('study_sessions', [eq('id', s.id), eq('status', 'pending_review')], {
    status: 'completed',
    subject_id: p.subject_id,
    topic_id: p.topic_id,
    activity_type: p.activity_type,
    notes: p.notes,
    adjustment_seconds: Math.round(p.adjustment_seconds),
  })
  if (updated.length === 0) return { saved: false, netSeconds: 0 } // já salva (outra aba / clique repetido)
  const session = { ...updated[0], pauses: s.pauses }
  const net = netSeconds(session, s.pauses)
  const result: ConfirmResult = { saved: true, netSeconds: net }

  if (p.topic_id) {
    await backend.update('topics', [eq('id', p.topic_id), eq('status', 'not_started')], { status: 'in_progress' })
  }

  if (s.plan_item_id) await refreshPlanItemStatus(backend, s.plan_item_id)

  if (s.cycle_id && s.cycle_item_id) {
    const cycle = await backend.get('study_cycles', s.cycle_id)
    if (cycle) {
      const { rows: items } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] })
      const applied = applyStudy(cycle, items, s.cycle_item_id, net, p.cycleDecision)
      await backend.update('study_cycles', [eq('id', cycle.id)], applied.progress)
      result.cycleAdvanced = applied.advanced
    }
  }

  if (p.completeReviewIds.length) {
    await backend.update('reviews', [inList('id', p.completeReviewIds), inList('status', ['planned', 'postponed'])], {
      status: 'done',
      done_at: new Date().toISOString(),
      session_id: s.id,
    })
  }

  if (p.topic_id && p.scheduleReviews.length) {
    const topic = await backend.get('topics', p.topic_id)
    const today = dayKey(Date.now(), p.timezone)
    const { rows: existing } = await backend.list('reviews', { filters: [eq('topic_id', p.topic_id), eq('status', 'planned')] })
    const taken = new Set(existing.map((r) => r.scheduled_for))
    const rows = [...new Set(p.scheduleReviews)]
      .map((d) => addDays(today, d))
      .filter((d) => !taken.has(d))
      .map((d) => ({
        subject_id: p.subject_id,
        topic_id: p.topic_id,
        title: `Revisar: ${topic?.name ?? 'tópico'}`,
        scheduled_for: d,
        origin: 'auto' as const,
      }))
    if (rows.length) await backend.insert('reviews', rows)
  }
  return result
}

/** Status do bloco do cronograma a partir das sessões vinculadas a ele. */
export async function refreshPlanItemStatus(backend: DataBackend, planItemId: string) {
  const item = await backend.get('study_plan_items', planItemId)
  if (!item) return
  const sessions = await backend.listSessions({ filters: [eq('plan_item_id', planItemId), eq('status', 'completed')] })
  const total = sessions.reduce((a, x) => a + netSeconds(x, x.pauses), 0)
  const status = total >= item.duration_minutes * 60 * 0.9 ? 'done' : total > 0 ? 'partial' : item.status
  if (status !== item.status) await backend.update('study_plan_items', [eq('id', planItemId)], { status })
}

export interface ManualSessionInput {
  subject_id: string | null
  topic_id: string | null
  activity_type: ActivityType
  started_at: number
  duration_minutes: number
  notes: string | null
}

/** Lançamento manual, bloqueando sobreposição com sessões já registradas. */
export async function addManualSession(backend: DataBackend, input: ManualSessionInput, id: string = crypto.randomUUID()) {
  const start = input.started_at
  const end = start + input.duration_minutes * 60000
  if (input.duration_minutes <= 0 || input.duration_minutes > 24 * 60) throw new DataError('validation', 'A duração deve ficar entre 1 minuto e 24 horas.')
  if (end > Date.now() + 60000) throw new DataError('validation', 'A sessão não pode terminar no futuro.')
  const near = await backend.listSessions({
    filters: [inList('status', ['completed', 'active', 'pending_review']), { column: 'started_at', op: 'gte', value: new Date(start - 86400000).toISOString() }, { column: 'started_at', op: 'lt', value: new Date(end).toISOString() }],
  })
  const overlap = near.find((x) => {
    const xs = new Date(x.started_at).getTime()
    const xe = x.ended_at ? new Date(x.ended_at).getTime() : Date.now()
    return xs < end && xe > start
  })
  if (overlap) throw new DataError('validation', 'Já existe uma sessão registrada nesse intervalo. Ajuste o horário para não duplicar o tempo.')
  const [row] = await backend.insert('study_sessions', [
    {
      id,
      subject_id: input.subject_id,
      topic_id: input.topic_id,
      activity_type: input.activity_type,
      mode: 'manual',
      status: 'completed',
      started_at: new Date(start).toISOString(),
      ended_at: new Date(end).toISOString(),
      notes: input.notes,
    },
  ])
  if (input.topic_id) await backend.update('topics', [eq('id', input.topic_id), eq('status', 'not_started')], { status: 'in_progress' })
  return row
}
