// Modelo da tela "Evolução": junta as agregações de src/lib/evolution.ts em um só objeto,
// que alimenta a tela, o CSV e o PDF (os três mostram exatamente os mesmos números).
import type { SessionWithPauses } from '@/lib/data/types'
import {
  buckets,
  consistency,
  delta,
  granularityFor,
  plannedStudy,
  previousRange,
  sumByBucket,
  taskCompletion,
  type Consistency,
  type Delta,
  type Granularity,
  type PlanItemLike,
  type TaskCompletion,
  type TaskLike,
} from '@/lib/evolution'
import { isStudyGoalAvailable, snapshotGoals, type GoalSnapshot } from '@/lib/goals'
import type { PdfBlock, PdfReport } from '@/lib/reportPdf'
import { NO_SUBJECT, breakdown, longestStreak, streak } from '@/lib/stats'
import { addDays, dayKey, eachDay, formatDayKey, formatDuration, type DayKey, type DayRange, type PeriodKind } from '@/lib/time'
import type { FlashcardReview, StudyGoal, Subject, Topic } from '@/types/db'

export interface EvolutionInput {
  kind: PeriodKind
  range: DayRange
  today: DayKey
  timezone: string
  /** Sessões concluídas (todas: a sequência atual olha para trás sem limite). */
  sessions: SessionWithPauses[]
  planItems: PlanItemLike[]
  tasks: TaskLike[]
  topics: Array<Pick<Topic, 'id' | 'name' | 'subject_id' | 'completed_at'>>
  subjects: Array<Pick<Subject, 'id' | 'name'>>
  goals: StudyGoal[]
  flashcardReviews: Array<Pick<FlashcardReview, 'reviewed_at'>>
}

export interface ComparisonRow {
  key: string
  label: string
  current: string
  previous: string
  change: string
  direction: 'up' | 'down' | 'same' | 'none'
}

export interface SeriesPoint {
  key: string
  label: string
  from: DayKey
  to: DayKey
  plannedHours: number
  actualHours: number
  tasks: number
  tasksDone: number
}

export interface EvolutionModel {
  range: DayRange
  previous: DayRange
  /** O período ainda não terminou: a comparação com o anterior é parcial. */
  inProgress: boolean
  hasData: boolean
  hours: { actual: number; planned: number; percent: number | null; delta: Delta; sessions: number }
  tasks: TaskCompletion & { previous: TaskCompletion }
  consistency: Consistency & { longest: number; currentStreak: number }
  topicsCompleted: Delta
  comparison: ComparisonRow[]
  granularity: Granularity
  series: SeriesPoint[]
  subjects: Array<{ id: string | null; name: string; actualSeconds: number; plannedSeconds: number; previousSeconds: number }>
  goals: { met: GoalSnapshot[]; pending: GoalSnapshot[] }
}

const hours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100
const pct = (v: number) => `${Math.round(v)}%`
const signed = (n: number, text: string) => `${n > 0 ? '+' : '-'}${text}`

/** "+1h 10min (+20%)"; sem período anterior, diz que não há base em vez de mostrar um percentual. */
function describeChange(d: Delta, fmt: (n: number) => string): Pick<ComparisonRow, 'change' | 'direction'> {
  if (d.current === 0 && d.previous === 0) return { change: '—', direction: 'none' }
  if (d.diff === 0) return { change: 'igual', direction: 'same' }
  const base = signed(d.diff, fmt(Math.abs(d.diff)))
  return { change: d.pct == null ? `${base} (sem base anterior)` : `${base} (${signed(d.diff, pct(Math.abs(d.pct)))})`, direction: d.diff > 0 ? 'up' : 'down' }
}

/** Diferença entre dois percentuais, em pontos percentuais. */
function describePoints(current: number | null, previous: number | null): Pick<ComparisonRow, 'change' | 'direction'> {
  if (current == null || previous == null) return { change: '—', direction: 'none' }
  const diff = Math.round(current) - Math.round(previous)
  if (diff === 0) return { change: 'igual', direction: 'same' }
  return { change: `${signed(diff, String(Math.abs(diff)))} p.p.`, direction: diff > 0 ? 'up' : 'down' }
}

const rateLabel = (t: TaskCompletion) => (t.rate == null ? 'Nenhuma atividade' : `${t.done} de ${t.total} (${pct(t.rate)})`)

/** Horas e atividades por dia, semana ou mês. */
export function seriesFor(input: Pick<EvolutionInput, 'sessions' | 'planItems' | 'tasks' | 'timezone'>, range: DayRange, granularity: Granularity): SeriesPoint[] {
  const list = buckets(range, granularity)
  const actual = sumByBucket(breakdown(input.sessions, input.timezone, range).byDay, list)
  const planned = sumByBucket(plannedStudy(input.planItems, input.tasks, range).byDay, list)
  return list.map((b, i) => {
    const t = taskCompletion(input.tasks, b)
    return { ...b, plannedHours: hours(planned[i]), actualHours: hours(actual[i]), tasks: t.total, tasksDone: t.done }
  })
}

export function buildEvolution(input: EvolutionInput): EvolutionModel {
  const { range, timezone: tz, today } = input
  const previous = previousRange(input.kind, range)
  const isoDay = (iso: string) => dayKey(new Date(iso).getTime(), tz)
  const within = (r: DayRange) => (iso: string | null) => Boolean(iso) && isoDay(iso!) >= r.from && isoDay(iso!) <= r.to
  const names = new Map(input.subjects.map((s) => [s.id, s.name]))
  const subjectName = (id: string | null) => (id == null || id === NO_SUBJECT ? 'Sem matéria' : (names.get(id) ?? 'Matéria excluída'))

  const cur = breakdown(input.sessions, tz, range)
  const before = breakdown(input.sessions, tz, previous)
  const allTime = breakdown(input.sessions, tz, { from: '1970-01-01', to: '9999-12-31' })
  const planned = plannedStudy(input.planItems, input.tasks, range)
  const plannedBefore = plannedStudy(input.planItems, input.tasks, previous)
  const tasks = taskCompletion(input.tasks, range)
  const tasksBefore = taskCompletion(input.tasks, previous)
  const cons = consistency(cur.byDay, range, today)
  const consBefore = consistency(before.byDay, previous, today)
  const topicsCompleted = delta(input.topics.filter((t) => within(range)(t.completed_at)).length, input.topics.filter((t) => within(previous)(t.completed_at)).length)

  const percent = planned.total > 0 ? (cur.total / planned.total) * 100 : null
  const percentBefore = plannedBefore.total > 0 ? (before.total / plannedBefore.total) * 100 : null
  const count = (n: number) => n.toLocaleString('pt-BR')
  const comparison: ComparisonRow[] = [
    { key: 'hours', label: 'Horas estudadas (líquidas)', current: formatDuration(cur.total), previous: formatDuration(before.total), ...describeChange(delta(cur.total, before.total), formatDuration) },
    { key: 'planned', label: 'Horas planejadas', current: formatDuration(planned.total), previous: formatDuration(plannedBefore.total), ...describeChange(delta(planned.total, plannedBefore.total), formatDuration) },
    { key: 'percent', label: 'Realizado ÷ planejado', current: percent == null ? 'Sem plano' : pct(percent), previous: percentBefore == null ? 'Sem plano' : pct(percentBefore), ...describePoints(percent, percentBefore) },
    { key: 'sessions', label: 'Sessões', current: count(cur.sessions), previous: count(before.sessions), ...describeChange(delta(cur.sessions, before.sessions), count) },
    { key: 'days', label: 'Dias com estudo', current: `${cons.studied} de ${cons.elapsed}`, previous: `${consBefore.studied} de ${consBefore.elapsed}`, ...describeChange(delta(cons.studied, consBefore.studied), count) },
    { key: 'tasks', label: 'Atividades concluídas', current: rateLabel(tasks), previous: rateLabel(tasksBefore), ...describePoints(tasks.rate, tasksBefore.rate) },
    { key: 'topics', label: 'Tópicos concluídos', current: count(topicsCompleted.current), previous: count(topicsCompleted.previous), ...describeChange(topicsCompleted, count) },
  ]

  // Um único dia não faz gráfico: mostra os 7 dias que terminam nele.
  const chartRange = range.from === range.to ? { from: addDays(range.from, -6), to: range.to } : range
  const granularity = granularityFor(chartRange)

  const subjectKeys = new Set([...cur.bySubject.keys(), ...planned.bySubject.keys()])
  const subjects = [...subjectKeys]
    .map((k) => ({ id: k === NO_SUBJECT ? null : k, name: subjectName(k), actualSeconds: cur.bySubject.get(k) ?? 0, plannedSeconds: planned.bySubject.get(k) ?? 0, previousSeconds: before.bySubject.get(k) ?? 0 }))
    .sort((a, b) => b.actualSeconds - a.actualSeconds || b.plannedSeconds - a.plannedSeconds || a.name.localeCompare(b.name))

  const asOf = range.to < today ? range.to : today
  const snapshots = asOf >= range.from ? snapshotGoals(input.goals.filter(isStudyGoalAvailable), asOf, { sessions: input.sessions, questions: [], topics: input.topics, reviews: input.flashcardReviews, timezone: tz }, range) : []

  return {
    range,
    previous,
    inProgress: range.to >= today && range.from <= today,
    hasData: cur.total > 0 || planned.total > 0 || tasks.total > 0,
    hours: { actual: cur.total, planned: planned.total, percent, delta: delta(cur.total, before.total), sessions: cur.sessions },
    tasks: { ...tasks, previous: tasksBefore },
    consistency: { ...cons, longest: longestStreak(cur.byDay, range), currentStreak: streak(allTime.byDay, today) },
    topicsCompleted,
    comparison,
    granularity,
    series: seriesFor(input, chartRange, granularity),
    subjects,
    goals: { met: snapshots.filter((s) => s.met), pending: snapshots.filter((s) => !s.met) },
  }
}

// ---------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------

/** CSV "Resumo": comparação com o período anterior, horas por matéria e metas. */
export function evolutionSummaryRows(m: EvolutionModel): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = m.comparison.map((r) => ({ grupo: 'Comparação', indicador: r.label, periodo_atual: r.current, periodo_anterior: r.previous, variacao: r.change }))
  for (const s of m.subjects) {
    rows.push({ grupo: 'Horas por matéria', indicador: s.name, periodo_atual: formatDuration(s.actualSeconds), periodo_anterior: formatDuration(s.previousSeconds), variacao: `planejado: ${formatDuration(s.plannedSeconds)}` })
  }
  for (const g of [...m.goals.met, ...m.goals.pending]) rows.push({ grupo: g.met ? 'Metas cumpridas' : 'Metas pendentes', indicador: g.title, periodo_atual: g.detail, periodo_anterior: '', variacao: pct(g.percent) })
  return rows
}

/** CSV "Por dia": uma linha por dia do período, com planejado, realizado e atividades. */
export function evolutionDailyRows(input: Pick<EvolutionInput, 'sessions' | 'planItems' | 'tasks' | 'timezone'>, range: DayRange): Array<Record<string, string | number>> {
  // Limite de segurança: períodos personalizados muito longos não geram milhares de linhas vazias.
  const days = eachDay(range.from, range.to).slice(0, 1100)
  const bounded = { from: range.from, to: days[days.length - 1] ?? range.to }
  return seriesFor(input, bounded, 'day').map((p) => ({
    data: p.from,
    planejado_min: Math.round(p.plannedHours * 60),
    realizado_min: Math.round(p.actualHours * 60),
    atividades: p.tasks,
    atividades_concluidas: p.tasksDone,
  }))
}

const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'Dia', week: 'Semana (início)', month: 'Mês' }

export function evolutionDocument(m: EvolutionModel, periodLabel: string, generatedAt?: string): PdfReport {
  const blocks: PdfBlock[] = [
    {
      type: 'stats',
      items: [
        { label: 'Horas estudadas (líquidas)', value: formatDuration(m.hours.actual) },
        { label: 'Horas planejadas', value: formatDuration(m.hours.planned) },
        { label: 'Realizado ÷ planejado', value: m.hours.percent == null ? 'Sem plano' : pct(m.hours.percent) },
        { label: 'Atividades concluídas', value: rateLabel(m.tasks) },
        { label: 'Dias com estudo', value: `${m.consistency.studied} de ${m.consistency.elapsed}` },
      ],
    },
    { type: 'heading', text: `Comparação com o período anterior (${formatDayKey(m.previous.from)} – ${formatDayKey(m.previous.to)})` },
  ]
  if (m.inProgress) blocks.push({ type: 'paragraph', text: 'O período atual ainda está em andamento: a comparação com o anterior é parcial.' })
  blocks.push({ type: 'table', columns: ['Indicador', 'Período atual', 'Período anterior', 'Variação'], rows: m.comparison.map((r) => [r.label, r.current, r.previous, r.change]) })
  blocks.push({ type: 'heading', text: 'Tempo por matéria' })
  blocks.push({ type: 'table', columns: ['Matéria', 'Realizado', 'Planejado', 'Período anterior'], rows: m.subjects.map((s) => [s.name, formatDuration(s.actualSeconds), formatDuration(s.plannedSeconds), formatDuration(s.previousSeconds)]), empty: 'Nenhum estudo ou plano por matéria no período.' })
  blocks.push({ type: 'heading', text: `Metas: ${m.goals.met.length} cumpridas, ${m.goals.pending.length} pendentes` })
  blocks.push({ type: 'table', columns: ['Meta', 'Situação', 'Progresso'], rows: [...m.goals.pending, ...m.goals.met].map((g) => [g.title, g.met ? 'Cumprida' : g.overdue ? 'Pendente (prazo vencido)' : 'Pendente', `${g.detail} (${pct(g.percent)})`]), empty: 'Nenhuma meta vigente no período.' })
  // Só as faixas com algum registro: um mês parado não vira uma página de zeros.
  const active = m.series.filter((p) => p.plannedHours > 0 || p.actualHours > 0 || p.tasks > 0)
  blocks.push({ type: 'heading', text: 'Planejado × realizado' })
  blocks.push({ type: 'paragraph', text: `Maior sequência de dias com estudo no período: ${m.consistency.longest}.` })
  blocks.push({
    type: 'table',
    empty: 'Nenhum registro no período.',
    columns: [GRANULARITY_LABEL[m.granularity], 'Planejado (h)', 'Realizado (h)', 'Atividades'],
    rows: active.map((p) => [p.label, p.plannedHours.toLocaleString('pt-BR'), p.actualHours.toLocaleString('pt-BR'), p.tasks ? `${p.tasksDone}/${p.tasks}` : '—']),
  })
  return {
    title: 'Evolução',
    subtitle: `Período: ${periodLabel}`,
    meta: `${generatedAt ? `Gerado em ${generatedAt}. ` : ''}Horas líquidas de sessões concluídas, atividades e metas.`,
    blocks,
  }
}
