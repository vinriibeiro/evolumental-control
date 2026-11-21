// Agregações puras da tela "Evolução" e do relatório semanal. Tudo sai dos registros:
// nada aqui estima domínio, probabilidade ou qualquer número sem base nos dados.
import type { CalendarTask, QuestionRecord, StudyPlanItem } from '@/types/db'
import { NO_SUBJECT } from '@/lib/stats'
import { isStudyTask } from '@/lib/tasks'
import { addDays, addMonths, diffDays, endOfMonth, formatDayKey, startOfMonth, startOfWeek, type DayKey, type DayRange, type PeriodKind } from '@/lib/time'

/** Amostra mínima (questões) para apontar acerto de uma matéria ou tópico. Abaixo disso: "Dados insuficientes". */
export const MIN_SAMPLE = 10

export type PlanItemLike = Pick<StudyPlanItem, 'date' | 'duration_minutes' | 'subject_id' | 'status'>
export type TaskLike = Pick<CalendarTask, 'date' | 'duration_minutes' | 'subject_id' | 'topic_id' | 'category' | 'done'>
export type QuestionLike = Pick<QuestionRecord, 'date' | 'subject_id' | 'topic_id' | 'total' | 'correct'>

const inRange = (day: DayKey, range: DayRange) => day >= range.from && day <= range.to
const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)

// ---------------------------------------------------------------------
// Planejado
// ---------------------------------------------------------------------

export interface PlannedStudy {
  /** Segundos planejados no intervalo. */
  total: number
  byDay: Map<DayKey, number>
  /** Chave: id da matéria ou NO_SUBJECT. */
  bySubject: Map<string, number>
  fromPlan: number
  fromTasks: number
  planBlocks: number
  studyTasks: number
}

/**
 * Horas planejadas = blocos do cronograma (menos os remarcados, que reaparecem em outra data)
 * + atividades da categoria "estudos" que têm duração.
 */
export function plannedStudy(planItems: PlanItemLike[], tasks: TaskLike[], range: DayRange): PlannedStudy {
  const out: PlannedStudy = { total: 0, byDay: new Map(), bySubject: new Map(), fromPlan: 0, fromTasks: 0, planBlocks: 0, studyTasks: 0 }
  const push = (day: DayKey, subjectId: string | null, seconds: number) => {
    out.total += seconds
    add(out.byDay, day, seconds)
    add(out.bySubject, subjectId ?? NO_SUBJECT, seconds)
  }
  for (const p of planItems) {
    if (p.status === 'rescheduled' || !inRange(p.date, range) || !(p.duration_minutes > 0)) continue
    out.fromPlan += p.duration_minutes * 60
    out.planBlocks++
    push(p.date, p.subject_id, p.duration_minutes * 60)
  }
  for (const t of tasks) {
    if (!inRange(t.date, range) || !isStudyTask(t) || !t.duration_minutes || t.duration_minutes <= 0) continue
    out.fromTasks += t.duration_minutes * 60
    out.studyTasks++
    push(t.date, t.subject_id, t.duration_minutes * 60)
  }
  return out
}

// ---------------------------------------------------------------------
// Faixas de tempo (dia, semana, mês)
// ---------------------------------------------------------------------

export type Granularity = 'day' | 'week' | 'month'

export interface Bucket {
  key: string
  from: DayKey
  to: DayKey
  label: string
}

/** Até 31 dias mostra por dia; até ~6 meses, por semana; acima disso, por mês. */
export function granularityFor(range: DayRange): Granularity {
  const days = diffDays(range.from, range.to) + 1
  return days <= 31 ? 'day' : days <= 183 ? 'week' : 'month'
}

/** Divide o intervalo em faixas; a primeira e a última são recortadas nos limites do intervalo. */
export function buckets(range: DayRange, granularity: Granularity): Bucket[] {
  const out: Bucket[] = []
  let cursor = range.from
  while (cursor <= range.to) {
    const end = granularity === 'day' ? cursor : granularity === 'week' ? addDays(startOfWeek(cursor), 6) : endOfMonth(cursor)
    const to = end > range.to ? range.to : end
    const label = granularity === 'month' ? `${cursor.slice(5, 7)}/${cursor.slice(0, 4)}` : formatDayKey(cursor)
    out.push({ key: cursor, from: cursor, to, label })
    cursor = addDays(to, 1)
  }
  return out
}

/** Soma um mapa por dia dentro de cada faixa. */
export function sumByBucket(byDay: Map<DayKey, number>, list: Bucket[]): number[] {
  return list.map((b) => {
    let total = 0
    for (const [day, v] of byDay) if (day >= b.from && day <= b.to) total += v
    return total
  })
}

/** Últimas `count` semanas (segunda a domingo) terminando na semana de `anchor`. */
export function lastWeeks(anchor: DayKey, count: number): DayRange {
  const from = addDays(startOfWeek(anchor), -7 * (count - 1))
  return { from, to: addDays(startOfWeek(anchor), 6) }
}

/** Últimos `count` meses terminando no mês de `anchor`. */
export function lastMonths(anchor: DayKey, count: number): DayRange {
  return { from: addMonths(startOfMonth(anchor), -(count - 1)), to: endOfMonth(anchor) }
}

// ---------------------------------------------------------------------
// Atividades (taxa de conclusão)
// ---------------------------------------------------------------------

export interface TaskCompletion {
  total: number
  done: number
  /** 0–100 ou null quando não há atividades no intervalo. */
  rate: number | null
}

export function taskCompletion(tasks: Array<Pick<CalendarTask, 'date' | 'done'>>, range: DayRange): TaskCompletion {
  const list = tasks.filter((t) => inRange(t.date, range))
  const done = list.filter((t) => t.done).length
  return { total: list.length, done, rate: list.length ? (done / list.length) * 100 : null }
}

// ---------------------------------------------------------------------
// Exercícios e questões
// ---------------------------------------------------------------------

export interface QuestionTotals {
  total: number
  correct: number
  /** 0–100 ou null sem questões. */
  accuracy: number | null
}

const accuracy = (correct: number, total: number) => (total > 0 ? (correct / total) * 100 : null)

export function questionTotals(questions: QuestionLike[], range: DayRange): QuestionTotals {
  let total = 0
  let correct = 0
  for (const q of questions) {
    if (!inRange(q.date, range)) continue
    total += q.total
    correct += q.correct
  }
  return { total, correct, accuracy: accuracy(correct, total) }
}

/** Volume e acerto por faixa (acerto null nas faixas sem questões). */
export function questionSeries(questions: QuestionLike[], list: Bucket[]): Array<Bucket & QuestionTotals> {
  return list.map((b) => ({ ...b, ...questionTotals(questions, b) }))
}

export interface DifficultyRow {
  key: string
  total: number
  correct: number
  accuracy: number
}

export interface Difficulties {
  /** Menor acerto primeiro; só entram chaves com amostra suficiente. */
  rows: DifficultyRow[]
  /** Quantas chaves tinham questões, mas abaixo da amostra mínima. */
  belowSample: number
}

/**
 * Ranking de dificuldade por matéria ou tópico: menor taxa de acerto primeiro.
 * Quem tem menos de `minSample` questões fica de fora — com amostra pequena o percentual engana.
 */
export function difficulties(questions: QuestionLike[], range: DayRange, keyOf: (q: QuestionLike) => string | null, minSample = MIN_SAMPLE): Difficulties {
  const acc = new Map<string, { total: number; correct: number }>()
  for (const q of questions) {
    const key = keyOf(q)
    if (!key || !inRange(q.date, range) || q.total <= 0) continue
    const cur = acc.get(key) ?? { total: 0, correct: 0 }
    acc.set(key, { total: cur.total + q.total, correct: cur.correct + q.correct })
  }
  const rows: DifficultyRow[] = []
  let belowSample = 0
  for (const [key, v] of acc) {
    if (v.total < minSample) belowSample++
    else rows.push({ key, total: v.total, correct: v.correct, accuracy: (v.correct / v.total) * 100 })
  }
  rows.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.key.localeCompare(b.key))
  return { rows, belowSample }
}

// ---------------------------------------------------------------------
// Comparação com o período anterior
// ---------------------------------------------------------------------

/** Período equivalente imediatamente anterior: mês anterior para "mês", senão o mesmo número de dias. */
export function previousRange(kind: PeriodKind, range: DayRange): DayRange {
  if (kind === 'month') {
    const from = addMonths(range.from, -1)
    return { from, to: endOfMonth(from) }
  }
  const days = diffDays(range.from, range.to) + 1
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) }
}

export interface Delta {
  current: number
  previous: number
  diff: number
  /** Variação percentual; null quando o período anterior é zero (não há base para comparar). */
  pct: number | null
}

export function delta(current: number, previous: number): Delta {
  return { current, previous, diff: current - previous, pct: previous > 0 ? ((current - previous) / previous) * 100 : null }
}

// ---------------------------------------------------------------------
// Constância
// ---------------------------------------------------------------------

export interface Consistency {
  /** Dias com estudo no intervalo. */
  studied: number
  /** Dias do intervalo que já passaram (até hoje, inclusive). */
  elapsed: number
  idleDays: DayKey[]
}

export function consistency(byDay: Map<DayKey, number>, range: DayRange, today: DayKey): Consistency {
  const idleDays: DayKey[] = []
  let studied = 0
  let elapsed = 0
  for (let d = range.from; d <= range.to && d <= today; d = addDays(d, 1)) {
    elapsed++
    if ((byDay.get(d) ?? 0) > 0) studied++
    else idleDays.push(d)
  }
  return { studied, elapsed, idleDays }
}
