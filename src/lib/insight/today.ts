// A tela "Hoje" em funções puras: tempo livre restante (só quando o usuário
// configurou disponibilidade), linha do tempo do dia com blocos sugeridos e
// pendências acionáveis.
import { subtractIntervals } from '@/lib/planner'
import { addDays, hhmmToMinutes, minutesToHhmm, weekday, type DayKey } from '@/lib/time'
import type { CalendarTask, Review, StudyPlan, StudyPlanItem, Subject, Topic } from '@/types/db'
import type { MasteryIndex } from './evidence'
import { DAY_MS } from './mastery'
import type { Recommendation } from './recommend'

type Interval = [number, number]

/**
 * Janelas livres de hoje (minutos do dia) dos cronogramas ativos que cobrem a
 * data, já sem compromissos. null = o usuário não configurou disponibilidade
 * para hoje — nesse caso o app não inventa tempo disponível.
 */
export function freeWindowsToday(plans: StudyPlan[], today: DayKey): Interval[] | null {
  const day = weekday(today)
  const covering = plans.filter((p) => p.status === 'active' && p.start_date <= today && p.end_date >= today)
  const windows: Interval[] = []
  const busy: Interval[] = []
  for (const p of covering) {
    for (const w of p.config.availability?.[day] ?? []) windows.push([hhmmToMinutes(w.start), hhmmToMinutes(w.end)])
    for (const w of p.config.commitments?.[day] ?? []) busy.push([hhmmToMinutes(w.start), hhmmToMinutes(w.end)])
  }
  if (!windows.length) return null
  return subtractIntervals(mergeIntervals(windows), busy)
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** Minutos livres a partir de agora, descontando blocos e tarefas com horário. */
export function remainingFree(windows: Interval[] | null, busy: Interval[], nowMinute: number): { minutes: number; gaps: Interval[] } | null {
  if (!windows) return null
  const fromNow = subtractIntervals(windows, [[0, nowMinute]])
  const gaps = subtractIntervals(fromNow, mergeIntervals(busy))
  return { minutes: gaps.reduce((a, [x, y]) => a + (y - x), 0), gaps }
}

export type TimelineKind = 'planned' | 'late' | 'done' | 'suggested' | 'review' | 'task'

export interface TimelineItem {
  kind: TimelineKind
  start: string | null
  minutes: number | null
  subjectId: string | null
  topicId: string | null
  label: string
  /** Bloco, revisão, tarefa ou recomendação de origem. */
  refId: string
}

export interface TimelineInput {
  planToday: StudyPlanItem[]
  reviewsDue: Review[]
  tasksToday: CalendarTask[]
  recommendations: Recommendation[]
  windows: Interval[] | null
  nowMinute: number
  /** Nome legível do tópico/matéria (para o rótulo). */
  name: (subjectId: string | null, topicId: string | null) => string
}

const ACTIVITY: Record<Recommendation['type'], string> = { study: 'Estudo', questions: 'Questões', review: 'Revisão', flashcards: 'Flashcards' }

/**
 * Linha do tempo: blocos planejados (concluídos, pendentes ou atrasados),
 * tarefas, revisões do dia e, nas janelas livres restantes, blocos sugeridos
 * pelo motor de recomendação (com 10 min de intervalo entre eles).
 */
export function dayTimeline(input: TimelineInput): TimelineItem[] {
  const items: TimelineItem[] = []
  const busy: Interval[] = []
  for (const p of input.planToday) {
    const start = hhmmToMinutes(p.start_time)
    const end = start + p.duration_minutes
    const done = p.status === 'done' || p.status === 'partial'
    if (p.status === 'pending' || done) busy.push([start, end])
    const kind: TimelineKind = done ? 'done' : p.status === 'pending' ? (end < input.nowMinute ? 'late' : 'planned') : 'done'
    if (p.status === 'rescheduled') continue
    items.push({ kind, start: p.start_time, minutes: p.duration_minutes, subjectId: p.subject_id, topicId: p.topic_id, label: input.name(p.subject_id, p.topic_id), refId: p.id })
  }
  for (const t of input.tasksToday) {
    if (t.start_time && t.duration_minutes && !t.done) busy.push([hhmmToMinutes(t.start_time), hhmmToMinutes(t.start_time) + t.duration_minutes])
    items.push({ kind: t.done ? 'done' : 'task', start: t.start_time, minutes: t.duration_minutes, subjectId: t.subject_id, topicId: t.topic_id, label: t.title, refId: t.id })
  }
  for (const r of input.reviewsDue) items.push({ kind: 'review', start: null, minutes: 20, subjectId: r.subject_id, topicId: r.topic_id, label: r.title, refId: r.id })

  const free = remainingFree(input.windows, busy, input.nowMinute)
  if (free) {
    const queue = input.recommendations.filter((r) => r.type !== 'review')
    let qi = 0
    for (const [a, b] of free.gaps) {
      let cursor = a
      while (qi < queue.length && b - cursor >= 15) {
        const r = queue[qi++]
        const minutes = Math.min(r.suggestedMinutes, b - cursor)
        items.push({ kind: 'suggested', start: minutesToHhmm(cursor), minutes, subjectId: r.subjectId, topicId: r.topicId, label: `${ACTIVITY[r.type]} · ${input.name(r.subjectId, r.topicId)}`, refId: r.id })
        cursor += minutes + 10
      }
    }
  }
  const order = (i: TimelineItem) => (i.start ? hhmmToMinutes(i.start) : 24 * 60)
  return items.sort((x, y) => order(x) - order(y) || x.label.localeCompare(y.label, 'pt-BR'))
}

export interface Pendency {
  id: string
  label: string
  /** Rota que resolve a pendência. */
  to: string
  tone: 'warning' | 'info'
}

export interface PendencyInput {
  today: DayKey
  overdueReviews: number
  cardsDue: number
  /** Blocos de ontem que ficaram pendentes ou não realizados. */
  missedYesterday: StudyPlanItem[]
  subjects: Subject[]
  topics: Topic[]
  /** Segundos líquidos na semana por matéria. */
  studiedWeek: Map<string, number>
  mastery: MasteryIndex | null
  now: number
}

/** Só o que dá para resolver agora — nada de painel de números. */
export function pendencies(p: PendencyInput): Pendency[] {
  const out: Pendency[] = []
  if (p.overdueReviews > 0) out.push({ id: 'reviews', label: `${p.overdueReviews} revisão(ões) atrasada(s)`, to: '/revisoes', tone: 'warning' })
  if (p.cardsDue > 0) out.push({ id: 'cards', label: `${p.cardsDue} flashcard(s) vencido(s)`, to: '/flashcards/revisar?modo=vencidos', tone: 'info' })
  if (p.missedYesterday.length) out.push({ id: 'yesterday', label: `${p.missedYesterday.length} bloco(s) de ontem não realizado(s)`, to: '/cronograma', tone: 'warning' })

  // Meta semanal da matéria abaixo do ritmo esperado para o dia da semana.
  const elapsed = (weekday(p.today) + 6) % 7 // seg = 0 … dom = 6
  for (const s of p.subjects) {
    if (s.status !== 'active' || !s.weekly_goal_hours) continue
    const goal = s.weekly_goal_hours * 3600
    const expected = goal * ((elapsed + 1) / 7)
    const done = p.studiedWeek.get(s.id) ?? 0
    if (done < expected * 0.8) out.push({ id: `goal:${s.id}`, label: `Meta de ${s.name}: ${Math.round((done / goal) * 100)}% da semana (esperado ${Math.round(((elapsed + 1) / 7) * 100)}%)`, to: `/materias/${s.id}`, tone: 'info' })
  }

  // Tópico de alta prioridade sem estudo recente (≥ 14 dias) ou nunca estudado.
  const subjects = new Map(p.subjects.map((s) => [s.id, s]))
  const stale = p.topics
    .filter((t) => t.kind !== 'folder' && t.priority >= 4 && t.status !== 'completed' && subjects.get(t.subject_id)?.status === 'active')
    .map((t) => ({ t, last: p.mastery?.byTopic.get(t.id)?.lastContactAt ?? null }))
    .filter((x) => x.last == null || p.now - x.last >= 14 * DAY_MS)
    .sort((a, b) => (a.last ?? 0) - (b.last ?? 0))
  if (stale.length) {
    const first = stale[0]
    const days = first.last == null ? null : Math.floor((p.now - first.last) / DAY_MS)
    out.push({
      id: 'stale',
      label: `${first.t.name}: prioridade alta e ${days == null ? 'nunca estudado' : `${days} dias sem estudo`}${stale.length > 1 ? ` (+${stale.length - 1})` : ''}`,
      to: `/materias/${first.t.subject_id}/topico/${first.t.id}`,
      tone: 'info',
    })
  }
  return out
}

export const yesterdayOf = (today: DayKey) => addDays(today, -1)
