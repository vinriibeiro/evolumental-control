// Progresso de metas, sempre calculado a partir dos registros (nada armazenado).
import type { CheckItem, FlashcardReview, GoalMetric, GoalPeriod, Project, QuestionRecord, StudyGoal, Topic } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'
import { GOAL_METRIC_LABELS, GOAL_PERIOD_LABELS } from '@/lib/labels'
import { breakdown } from '@/lib/stats'
import { addDays, addMonths, dayKey, diffDays, eachDay, endOfMonth, formatDuration, periodRange, startOfMonth, startOfWeek, type DayKey, type DayRange } from '@/lib/time'

export interface GoalData {
  sessions: SessionWithPauses[]
  questions: Pick<QuestionRecord, 'date' | 'subject_id' | 'total' | 'correct'>[]
  topics: Pick<Topic, 'subject_id' | 'completed_at'>[]
  reviews: Pick<FlashcardReview, 'reviewed_at'>[]
  /** Projetos práticos (para a meta de projetos concluídos). */
  projects?: Pick<Project, 'completed_at' | 'status'>[]
  timezone: string
}

export const STUDY_GOAL_METRICS = ['study_hours', 'sessions', 'topics_completed', 'flashcards_reviewed', 'study_days'] as const satisfies readonly GoalMetric[]

export function isStudyGoalAvailable(goal: StudyGoal): boolean {
  return isDeliverable(goal) || STUDY_GOAL_METRICS.some((metric) => metric === goal.metric)
}

export function periodFor(period: GoalPeriod, day: string): DayRange {
  return periodRange(period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month', day)
}

export function previousPeriod(period: GoalPeriod, range: DayRange): DayRange {
  if (period === 'daily') return { from: addDays(range.from, -1), to: addDays(range.from, -1) }
  if (period === 'weekly') return { from: addDays(range.from, -7), to: addDays(range.from, -1) }
  const from = addMonths(range.from, -1)
  return { from: startOfMonth(from), to: endOfMonth(from) }
}

/** Valor da métrica da meta no intervalo informado. */
export function goalValue(goal: Pick<StudyGoal, 'metric' | 'subject_id'>, range: DayRange, data: GoalData): number {
  const inRange = (iso: string) => {
    const k = dayKey(new Date(iso).getTime(), data.timezone)
    return k >= range.from && k <= range.to
  }
  const subjectOk = (id: string | null) => !goal.subject_id || id === goal.subject_id
  switch (goal.metric) {
    case 'study_hours': {
      const b = breakdown(data.sessions.filter((s) => subjectOk(s.subject_id)), data.timezone, range)
      return b.total / 3600
    }
    case 'study_days': {
      const b = breakdown(data.sessions.filter((s) => subjectOk(s.subject_id)), data.timezone, range)
      return [...b.byDay.values()].filter((v) => v > 0).length
    }
    case 'sessions':
      return data.sessions.filter((s) => s.status === 'completed' && subjectOk(s.subject_id) && inRange(s.started_at)).length
    case 'questions':
      return data.questions.filter((q) => subjectOk(q.subject_id) && q.date >= range.from && q.date <= range.to).reduce((a, q) => a + q.total, 0)
    case 'accuracy': {
      const qs = data.questions.filter((q) => subjectOk(q.subject_id) && q.date >= range.from && q.date <= range.to)
      const total = qs.reduce((a, q) => a + q.total, 0)
      return total ? (qs.reduce((a, q) => a + q.correct, 0) / total) * 100 : 0
    }
    case 'topics_completed':
      return data.topics.filter((t) => t.completed_at && subjectOk(t.subject_id) && inRange(t.completed_at)).length
    case 'flashcards_reviewed':
      return data.reviews.filter((r) => inRange(r.reviewed_at)).length
    case 'projects_completed':
      return (data.projects ?? []).filter((p) => p.status === 'done' && p.completed_at && inRange(p.completed_at)).length
  }
}

export interface GoalProgress {
  range: DayRange
  value: number
  target: number
  percent: number
  remaining: number
  met: boolean
}

export function progress(goal: Pick<StudyGoal, 'metric' | 'subject_id' | 'target'>, range: DayRange, data: GoalData): GoalProgress {
  const value = goalValue(goal, range, data)
  const target = Number(goal.target)
  return { range, value, target, percent: target ? Math.min(100, (value / target) * 100) : 0, remaining: Math.max(0, target - value), met: value >= target }
}

/** Períodos anteriores em que a meta estava vigente (mais recentes primeiro). */
export function history(goal: StudyGoal, today: string, data: GoalData, max = 8): GoalProgress[] {
  const out: GoalProgress[] = []
  // Meta por entregas não tem períodos: o progresso é a própria lista.
  if (isDeliverable(goal)) return out
  let r = previousPeriod(goal.period, periodFor(goal.period, today))
  for (let i = 0; i < max; i++) {
    if (r.to < goal.start_date) break
    if (!goal.end_date || r.from <= goal.end_date) out.push(progress(goal, r, data))
    r = previousPeriod(goal.period, r)
  }
  return out
}

/** Início do período mais antigo que o histórico pode pedir. */
export function historyStart(today: string): string {
  return startOfWeek(addMonths(startOfMonth(today), -8))
}

// ---------------------------------------------------------------------
// Metas por entregas (lista de itens a concluir até uma data)
// ---------------------------------------------------------------------

/** Linhas antigas do modo local podem não ter `kind`: contam como meta numérica. */
export function isDeliverable(goal: Pick<StudyGoal, 'kind'>): boolean {
  return goal.kind === 'deliverable'
}

export interface ChecklistProgress {
  done: number
  total: number
  percent: number
  met: boolean
}

export function checklistProgress(goal: Pick<StudyGoal, 'checklist'>): ChecklistProgress {
  const items = goal.checklist ?? []
  const done = items.filter((i) => i.done).length
  return { done, total: items.length, percent: items.length ? (done / items.length) * 100 : 0, met: items.length > 0 && done === items.length }
}

function itemId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Converte o texto do formulário (uma entrega por linha) na lista da meta.
 * Itens que já existiam (mesmo texto) mantêm id, marcação e link.
 */
export function parseChecklist(text: string, previous: CheckItem[] = []): CheckItem[] {
  const pool = [...previous]
  const seen = new Set<string>()
  const out: CheckItem[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\[[ xX]?\]|\d+[.)])\s+/, '').trim().slice(0, 200)
    const key = line.toLowerCase()
    if (!line || seen.has(key)) continue
    seen.add(key)
    const i = pool.findIndex((p) => p.text.trim().toLowerCase() === key)
    out.push(i >= 0 ? { ...pool.splice(i, 1)[0], text: line } : { id: itemId(), text: line, done: false })
  }
  return out
}

/**
 * Campos a gravar quando a lista muda. O banco exige `metric` e `target > 0` em toda meta:
 * nas metas por entregas o alvo é o número de itens (mínimo 1) e `done_at` marca quando tudo foi concluído.
 */
export function checklistPatch(items: CheckItem[], previousDoneAt: string | null, nowIso: string = new Date().toISOString()) {
  const allDone = items.length > 0 && items.every((i) => i.done)
  return { checklist: items, target: Math.max(1, items.length), done_at: allDone ? (previousDoneAt ?? nowIso) : null }
}

export type DueState = 'none' | 'done' | 'overdue' | 'today' | 'soon' | 'later'

/** Situação do prazo de uma meta por entregas (soon = vence em até 3 dias). */
export function dueState(goal: Pick<StudyGoal, 'due_date' | 'done_at'>, today: DayKey): { state: DueState; days: number } {
  if (goal.done_at) return { state: 'done', days: 0 }
  if (!goal.due_date) return { state: 'none', days: 0 }
  const days = diffDays(today, goal.due_date)
  return { state: days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : 'later', days }
}

// ---------------------------------------------------------------------
// Retrato das metas (cumpridas × pendentes), usado em Metas, Evolução e no relatório semanal
// ---------------------------------------------------------------------

export function formatGoalValue(metric: GoalMetric, v: number): string {
  if (metric === 'study_hours') return formatDuration(v * 3600)
  if (metric === 'accuracy') return `${Math.round(v)}%`
  return Math.round(v).toLocaleString('pt-BR')
}

export function goalTitle(goal: Pick<StudyGoal, 'title' | 'metric' | 'period' | 'kind'>): string {
  if (goal.title) return goal.title
  return isDeliverable(goal) ? 'Meta por entregas' : `${GOAL_METRIC_LABELS[goal.metric]} — ${GOAL_PERIOD_LABELS[goal.period].toLowerCase()}`
}

export interface GoalSnapshot {
  goal: StudyGoal
  kind: 'metric' | 'deliverable'
  title: string
  met: boolean
  /** 0–100. */
  percent: number
  value: number
  target: number
  remaining: number
  /** "6h 00min de 10h 00min", "3 de 5 entregas"… sempre com os números reais. */
  detail: string
  /** Período avaliado (metas numéricas). */
  range: DayRange | null
  /** O período (ou a lista) ainda está aberto no dia de referência. */
  open: boolean
  /** Meta por entregas com prazo vencido e itens pendentes. */
  overdue: boolean
}

/** A meta estava vigente (não pausada) no dia informado? */
export function goalActiveOn(goal: Pick<StudyGoal, 'status' | 'start_date' | 'end_date'>, day: DayKey): boolean {
  if (goal.status === 'paused') return false
  if (goal.start_date > day) return false
  if (goal.end_date) return goal.end_date >= day
  return goal.status === 'active'
}

/**
 * Situação de cada meta vigente no dia `asOf`. Metas numéricas são avaliadas no período (dia, semana ou mês)
 * que contém `asOf`; com um intervalo `within`, metas diárias contam em quantos dias dele foram cumpridas.
 * Metas por entregas não guardam histórico: valem as marcações atuais da lista.
 */
export function snapshotGoals(goals: StudyGoal[], asOf: DayKey, data: GoalData, within?: DayRange): GoalSnapshot[] {
  const out: GoalSnapshot[] = []
  for (const goal of goals) {
    if (!goalActiveOn(goal, asOf)) continue
    const title = goalTitle(goal)
    if (isDeliverable(goal)) {
      const p = checklistProgress(goal)
      out.push({
        goal,
        kind: 'deliverable',
        title,
        met: p.met,
        percent: p.percent,
        value: p.done,
        target: p.total,
        remaining: p.total - p.done,
        detail: p.total ? `${p.done} de ${p.total} ${p.total === 1 ? 'entrega' : 'entregas'}` : 'sem entregas na lista',
        range: null,
        open: !p.met,
        overdue: dueState(goal, asOf).state === 'overdue',
      })
      continue
    }
    if (goal.period === 'daily' && within) {
      const days = eachDay(within.from < goal.start_date ? goal.start_date : within.from, within.to < asOf ? within.to : asOf)
      const metDays = days.filter((d) => progress(goal, { from: d, to: d }, data).met).length
      out.push({
        goal,
        kind: 'metric',
        title,
        met: days.length > 0 && metDays === days.length,
        percent: days.length ? (metDays / days.length) * 100 : 0,
        value: metDays,
        target: days.length,
        remaining: days.length - metDays,
        detail: `${formatGoalValue(goal.metric, Number(goal.target))} por dia: cumprida em ${metDays} de ${days.length} ${days.length === 1 ? 'dia' : 'dias'}`,
        range: days.length ? { from: days[0], to: days[days.length - 1] } : null,
        open: within.to > asOf,
        overdue: false,
      })
      continue
    }
    const range = periodFor(goal.period, asOf)
    const p = progress(goal, range, data)
    out.push({
      goal,
      kind: 'metric',
      title,
      met: p.met,
      percent: p.percent,
      value: p.value,
      target: p.target,
      remaining: p.remaining,
      detail: `${formatGoalValue(goal.metric, p.value)} de ${formatGoalValue(goal.metric, p.target)}`,
      range,
      open: range.to > asOf,
      overdue: false,
    })
  }
  return out
}
