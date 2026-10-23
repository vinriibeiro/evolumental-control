// Previsão de conclusão do conteúdo: uma PROJEÇÃO, nunca uma certeza.
// Conteúdo restante = tópicos-folha não concluídos × tempo por tópico
// (estimativa do tópico; senão a média histórica dos concluídos; senão 90 min)
// × peso, descontando o que já foi estudado em cada um. Ritmo = média semanal
// de tempo líquido nas últimas 4 semanas completas. Nada aqui altera o
// cronograma.
import type { SessionWithPauses } from '@/lib/data/types'
import { breakdown } from '@/lib/stats'
import { netSeconds } from '@/lib/timer/engine'
import { addDays, diffDays, hhmmToMinutes, startOfWeek, type DayKey } from '@/lib/time'
import type { StudyPlan, Topic } from '@/types/db'
import { mergeIntervals } from './today'
import { subtractIntervals } from '@/lib/planner'

export const DEFAULT_TOPIC_MINUTES = 90
const PACE_WEEKS = 4

export interface Scenario {
  id: 'current' | 'plus30' | 'plus60' | 'custom'
  label: string
  /** Minutos por semana. */
  pace: number
  /** Data estimada de conclusão; null = ritmo zero (não dá para projetar). */
  date: DayKey | null
  /** Ritmo acima da disponibilidade configurada. */
  overAvailability: boolean
}

export interface Forecast {
  remainingTopics: number
  totalTopics: number
  remainingMinutes: number
  /** De onde veio o tempo por tópico (explicação). */
  minutesSource: 'estimates' | 'history' | 'default' | 'mixed'
  historyMinutesPerTopic: number | null
  pace: number
  availability: number | null
  scenarios: Scenario[]
  target: { date: DayKey; neededPace: number | null; diff: number | null; weeksLeft: number } | null
  caveats: string[]
}

/** Minutos disponíveis por semana nos cronogramas ativos que cobrem `today` (null = não configurado). */
export function weeklyAvailability(plans: StudyPlan[], today: DayKey): number | null {
  const covering = plans.filter((p) => p.status === 'active' && p.start_date <= today && p.end_date >= today)
  let total = 0
  let any = false
  for (let d = 0; d < 7; d++) {
    const windows: Array<[number, number]> = []
    const busy: Array<[number, number]> = []
    for (const p of covering) {
      for (const w of p.config.availability?.[d] ?? []) windows.push([hhmmToMinutes(w.start), hhmmToMinutes(w.end)])
      for (const w of p.config.commitments?.[d] ?? []) busy.push([hhmmToMinutes(w.start), hhmmToMinutes(w.end)])
    }
    if (windows.length) any = true
    total += subtractIntervals(mergeIntervals(windows), busy).reduce((a, [x, y]) => a + (y - x), 0)
  }
  return any ? total : null
}

const projectDate = (today: DayKey, remaining: number, pace: number): DayKey | null => (pace <= 0 ? null : addDays(today, Math.ceil((remaining / pace) * 7)))

export function forecast(input: {
  topics: Topic[]
  /** Sessões concluídas (janela recente) das matérias em questão. */
  sessions: SessionWithPauses[]
  today: DayKey
  tz: string
  availability: number | null
  targetDate?: DayKey | null
  /** Meta personalizada (minutos por semana). */
  customPace?: number | null
}): Forecast {
  const ids = new Set(input.topics.map((t) => t.id))
  const parents = new Set(input.topics.filter((t) => t.parent_id && ids.has(t.parent_id)).map((t) => t.parent_id))
  const leaves = input.topics.filter((t) => t.kind !== 'folder' && !parents.has(t.id))
  const studied = new Map<string, number>()
  for (const s of input.sessions) if (s.status === 'completed' && s.topic_id) studied.set(s.topic_id, (studied.get(s.topic_id) ?? 0) + netSeconds(s, s.pauses) / 60)

  const done = leaves.filter((t) => t.status === 'completed')
  const doneWithTime = done.filter((t) => (studied.get(t.id) ?? 0) > 0)
  const historyMinutesPerTopic = doneWithTime.length >= 2 ? doneWithTime.reduce((a, t) => a + studied.get(t.id)! / (Number(t.weight) || 1), 0) / doneWithTime.length : null

  const remaining = leaves.filter((t) => t.status !== 'completed')
  const sources = new Set<'estimates' | 'history' | 'default'>()
  let remainingMinutes = 0
  for (const t of remaining) {
    const base = t.estimated_minutes ?? historyMinutesPerTopic ?? DEFAULT_TOPIC_MINUTES
    sources.add(t.estimated_minutes != null ? 'estimates' : historyMinutesPerTopic != null ? 'history' : 'default')
    remainingMinutes += Math.max(0, base * (Number(t.weight) || 1) - (studied.get(t.id) ?? 0))
  }
  remainingMinutes = Math.round(remainingMinutes)

  const thisWeek = startOfWeek(input.today)
  const from = addDays(thisWeek, -7 * PACE_WEEKS)
  const pace = Math.round(breakdown(input.sessions, input.tz, { from, to: addDays(thisWeek, -1) }).total / 60 / PACE_WEEKS)

  const caveats: string[] = ['Projeção com base no seu ritmo recente — não é uma certeza.']
  if (sources.has('default')) caveats.push(`Tópicos sem estimativa nem histórico contam ${DEFAULT_TOPIC_MINUTES} min cada (ajuste a estimativa no tópico para melhorar a previsão).`)
  if (pace === 0 && remaining.length) caveats.push(`Sem estudo nas últimas ${PACE_WEEKS} semanas: não dá para projetar no ritmo atual.`)

  const over = (p: number) => input.availability != null && p > input.availability
  const scenarios: Scenario[] = [
    { id: 'current', label: 'Ritmo atual', pace, date: projectDate(input.today, remainingMinutes, pace), overAvailability: over(pace) },
    { id: 'plus30', label: '+30 min/dia', pace: pace + 210, date: projectDate(input.today, remainingMinutes, pace + 210), overAvailability: over(pace + 210) },
    { id: 'plus60', label: '+1 h/dia', pace: pace + 420, date: projectDate(input.today, remainingMinutes, pace + 420), overAvailability: over(pace + 420) },
  ]
  if (input.customPace && input.customPace > 0) scenarios.push({ id: 'custom', label: 'Meta personalizada', pace: input.customPace, date: projectDate(input.today, remainingMinutes, input.customPace), overAvailability: over(input.customPace) })

  let target: Forecast['target'] = null
  if (input.targetDate && input.targetDate > input.today) {
    const weeksLeft = diffDays(input.today, input.targetDate) / 7
    const neededPace = weeksLeft > 0 ? Math.ceil(remainingMinutes / weeksLeft) : null
    target = { date: input.targetDate, neededPace, diff: neededPace == null ? null : neededPace - pace, weeksLeft }
  }

  return {
    remainingTopics: remaining.length,
    totalTopics: leaves.length,
    remainingMinutes,
    minutesSource: sources.size > 1 ? 'mixed' : ([...sources][0] ?? 'default'),
    historyMinutesPerTopic: historyMinutesPerTopic == null ? null : Math.round(historyMinutesPerTopic),
    pace,
    availability: input.availability,
    scenarios,
    target,
    caveats,
  }
}
