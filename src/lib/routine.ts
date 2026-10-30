// Motor de rotinas — regras determinísticas e transparentes (sem IA).
// Recebe pilares, disponibilidade, data de início e marcos e devolve itens de
// ciclo, configuração do cronograma (compatível com generatePlan), blocos
// fixos diários, tarefas recorrentes e marcos. Veja ROUTINE_RULES.
import type { ActivityType, PlanConfig, Subject, TimeWindow } from '@/types/db'
import { distributeByWeight } from '@/lib/cycle'
import { subtractIntervals } from '@/lib/planner'
import { addDays, diffDays, minutesToHhmm, weekday, windowRange, type DayKey } from '@/lib/time'

export const ROUTINE_RULES = [
  'Pilares diários ganham um bloco fixo em todos os dias disponíveis, no primeiro horário livre do dia.',
  'Pilares semanais viram uma tarefa recorrente por semana, no dia com mais tempo livre depois dos blocos fixos.',
  'Pilares de alguns dias por semana entram no ciclo de estudos e no cronograma automático.',
  'A duração de cada item do ciclo é proporcional ao peso do pilar (múltiplos de 5 minutos).',
  'O total da volta do ciclo não passa do limite semanal restante, e nenhum item passa do limite diário restante.',
  'Blocos fixos e tarefas recorrentes são reservados como compromissos, para o cronograma não sobrepor horários.',
  'No cronograma, cada dia só oferece o tempo que ainda cabe no seu limite diário; um dia cheio não bloqueia os outros.',
  'Marcos a menos de 30 dias aumentam a prioridade das matérias do pilar ligado a eles.',
  'Empates são resolvidos pelo maior peso e, depois, pela ordem alfabética do pilar.',
]

export type PillarFrequency = 'daily' | 'days_per_week' | 'weekly'

export interface RoutinePillar {
  id: string
  name: string
  weight: number
  frequency: PillarFrequency
  /** Usado quando frequency = 'days_per_week'. */
  daysPerWeek?: number
  blockMinutes: number
  activityType: ActivityType
  subjectIds: string[]
  trailId?: string | null
}

export interface RoutineAvailability {
  /** 0 = domingo … 6 = sábado */
  days: Record<number, TimeWindow[]>
  dailyLimitMinutes?: number | null
  weeklyLimitMinutes?: number | null
  breakMinutes?: number
}

export interface RoutineMilestone {
  title: string
  date: DayKey
  pillarId?: string | null
}

export interface RoutineInput {
  pillars: RoutinePillar[]
  availability: RoutineAvailability
  startDate: DayKey
  milestones?: RoutineMilestone[]
  /** Semanas cobertas pelas tarefas recorrentes e pelo intervalo do cronograma. */
  weeks?: number
}

export interface RoutineCycleItem {
  pillarId: string
  subjectId: string | null
  duration_minutes: number
  weight: number
  sort_order: number
  break_minutes: number
  activity_type: ActivityType
  reason: string
}

export interface RoutineDailyBlock {
  pillarId: string
  weekday: number
  start_time: string
  duration_minutes: number
  subjectId: string | null
  activity_type: ActivityType
  reason: string
}

export interface RoutineRecurringTask {
  pillarId: string
  title: string
  weekday: number
  start_time: string
  duration_minutes: number
  subjectId: string | null
  /** Uma ocorrência por semana dentro do intervalo. */
  dates: DayKey[]
  reason: string
}

export interface RoutineMilestoneOut extends RoutineMilestone {
  daysUntil: number
  reason: string
}

export type RoutinePlanSubject = Pick<Subject, 'id' | 'priority' | 'difficulty' | 'target_date' | 'weekly_goal_hours'>

export interface RoutineOutput {
  cycleItems: RoutineCycleItem[]
  planConfig: PlanConfig
  planSubjects: RoutinePlanSubject[]
  range: { from: DayKey; to: DayKey }
  dailyBlocks: RoutineDailyBlock[]
  recurringTasks: RoutineRecurringTask[]
  milestones: RoutineMilestoneOut[]
}

type Interval = [number, number]

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
/** Ordem da semana começando na segunda-feira. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function toIntervals(ws: TimeWindow[] = []): Interval[] {
  return ws
    .map((w): Interval => windowRange(w))
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
}

const freeMinutes = (iv: Interval[]) => iv.reduce((acc, [a, b]) => acc + (b - a), 0)

function byPriority(a: RoutinePillar, b: RoutinePillar): number {
  if (a.weight !== b.weight) return b.weight - a.weight
  return a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const floor5 = (n: number) => Math.max(0, Math.floor(n / 5) * 5)

export function generateRoutine(input: RoutineInput): RoutineOutput {
  const { availability, startDate } = input
  const weeks = Math.max(1, Math.floor(input.weeks ?? 4))
  const breakMin = Math.max(0, availability.breakMinutes ?? 10)
  const dailyLimit = availability.dailyLimitMinutes ?? null
  const weeklyLimit = availability.weeklyLimitMinutes ?? null
  const pillars = input.pillars.filter((p) => p.weight > 0 && p.blockMinutes >= 5).sort(byPriority)

  const free: Record<number, Interval[]> = {}
  const used: Record<number, number> = {}
  const reserved: Record<number, TimeWindow[]> = {}
  for (let wd = 0; wd < 7; wd++) {
    free[wd] = toIntervals(availability.days[wd])
    used[wd] = 0
    reserved[wd] = []
  }
  const availableDays = WEEK_ORDER.filter((wd) => free[wd].length > 0)
  let weekUsed = 0

  const fits = (wd: number, len: number) =>
    (dailyLimit === null || used[wd] + len <= dailyLimit) && (weeklyLimit === null || weekUsed + len <= weeklyLimit)

  /** Reserva o primeiro horário livre do dia com espaço para `len` minutos. */
  function reserve(wd: number, len: number): number | null {
    if (!fits(wd, len)) return null
    const slot = free[wd].find(([a, b]) => b - a >= len)
    if (!slot) return null
    const start = slot[0]
    free[wd] = subtractIntervals(free[wd], [[start, start + len + breakMin]])
    used[wd] += len
    weekUsed += len
    reserved[wd].push({ start: minutesToHhmm(start), end: minutesToHhmm(start + len) })
    return start
  }

  // 1. Blocos fixos dos pilares diários.
  const dailyBlocks: RoutineDailyBlock[] = []
  for (const p of pillars.filter((x) => x.frequency === 'daily')) {
    for (const wd of availableDays) {
      const start = reserve(wd, p.blockMinutes)
      if (start === null) continue
      dailyBlocks.push({
        pillarId: p.id,
        weekday: wd,
        start_time: minutesToHhmm(start),
        duration_minutes: p.blockMinutes,
        subjectId: p.subjectIds[0] ?? null,
        activity_type: p.activityType,
        reason: `"${p.name}" é diário: ${p.blockMinutes} min reservados no primeiro horário livre de ${WEEKDAY_NAMES[wd]} (${minutesToHhmm(start)}).`,
      })
    }
  }

  // 2. Tarefas recorrentes dos pilares semanais.
  const rangeTo = addDays(startDate, weeks * 7 - 1)
  const recurringTasks: RoutineRecurringTask[] = []
  for (const p of pillars.filter((x) => x.frequency === 'weekly')) {
    const capacity = (wd: number) => {
      const room = freeMinutes(free[wd])
      return dailyLimit === null ? room : Math.min(room, dailyLimit - used[wd])
    }
    const candidates = availableDays.filter((wd) => fits(wd, p.blockMinutes) && free[wd].some(([a, b]) => b - a >= p.blockMinutes))
    if (candidates.length === 0) continue
    // Maior capacidade livre; empate fica com o primeiro dia da semana (segunda primeiro).
    const wd = candidates.reduce((best, d) => (capacity(d) > capacity(best) ? d : best))
    const start = reserve(wd, p.blockMinutes)!
    const offset = (wd - weekday(startDate) + 7) % 7
    const dates: DayKey[] = []
    for (let d = addDays(startDate, offset); d <= rangeTo; d = addDays(d, 7)) dates.push(d)
    recurringTasks.push({
      pillarId: p.id,
      title: p.name,
      weekday: wd,
      start_time: minutesToHhmm(start),
      duration_minutes: p.blockMinutes,
      subjectId: p.subjectIds[0] ?? null,
      dates,
      reason: `"${p.name}" é semanal: toda ${WEEKDAY_NAMES[wd]} às ${minutesToHhmm(start)}, o dia com mais tempo livre depois dos blocos fixos.`,
    })
  }

  // 3. Ciclo com os pilares de alguns dias por semana.
  const flexible = pillars.filter((x) => x.frequency === 'days_per_week')
  const weekFree = availableDays.reduce((acc, wd) => {
    const room = freeMinutes(free[wd])
    return acc + (dailyLimit === null ? room : Math.max(0, Math.min(room, dailyLimit - used[wd])))
  }, 0)
  const weekRemaining = weeklyLimit === null ? weekFree : Math.max(0, Math.min(weekFree, weeklyLimit - weekUsed))
  const dayRemaining = availableDays.reduce((m, wd) => {
    const room = Math.max(0, ...free[wd].map(([a, b]) => b - a))
    return Math.max(m, dailyLimit === null ? room : Math.max(0, Math.min(room, dailyLimit - used[wd])))
  }, 0)
  const desired = flexible.reduce((acc, p) => acc + p.blockMinutes * clampDays(p.daysPerWeek), 0)
  const roundTotal = floor5(Math.min(desired, weekRemaining))
  const itemCap = floor5(dayRemaining)

  const cycleItems: RoutineCycleItem[] = []
  if (flexible.length > 0 && roundTotal >= 5 * flexible.length && itemCap >= 5) {
    const weights = flexible.map((p) => p.weight)
    const durations = distributeByWeight(weights, roundTotal).map((d) => Math.min(d, itemCap))
    // O arredondamento pode estourar o total: corta 5 min do maior item até caber.
    let total = durations.reduce((a, b) => a + b, 0)
    while (total > roundTotal) {
      let idx = -1
      durations.forEach((d, i) => {
        if (d > 5 && (idx < 0 || d > durations[idx])) idx = i
      })
      if (idx < 0) break
      durations[idx] -= 5
      total -= 5
    }
    const weightSum = weights.reduce((a, b) => a + b, 0)
    flexible.forEach((p, i) => {
      cycleItems.push({
        pillarId: p.id,
        subjectId: p.subjectIds[0] ?? null,
        duration_minutes: durations[i],
        weight: p.weight,
        sort_order: i,
        break_minutes: breakMin,
        activity_type: p.activityType,
        reason: `"${p.name}" tem peso ${p.weight} de ${weightSum}: ${durations[i]} min de uma volta de ${roundTotal} min.`,
      })
    })
  }

  // 4. Marcos.
  const milestones: RoutineMilestoneOut[] = (input.milestones ?? [])
    .filter((m) => m.date >= startDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
    .map((m) => {
      const daysUntil = diffDays(startDate, m.date)
      const pillar = pillars.find((p) => p.id === m.pillarId)
      const near = daysUntil < 30
      return {
        ...m,
        daysUntil,
        reason: near && pillar
          ? `Faltam ${daysUntil} dias: as matérias de "${pillar.name}" ganham prioridade extra no cronograma.`
          : `Faltam ${daysUntil} dias para "${m.title}".`,
      }
    })

  // 5. Cronograma compatível com generatePlan.
  const subjectIds: string[] = []
  const frequentSubjectIds: string[] = []
  const planSubjects: RoutinePlanSubject[] = []
  for (const p of flexible) {
    const target = milestones.find((m) => m.pillarId === p.id)?.date ?? null
    for (const sid of p.subjectIds) {
      if (subjectIds.includes(sid)) continue
      subjectIds.push(sid)
      if (clampDays(p.daysPerWeek) >= 4) frequentSubjectIds.push(sid)
      planSubjects.push({
        id: sid,
        priority: Math.min(5, Math.max(1, Math.round(p.weight))),
        difficulty: 3,
        target_date: target,
        weekly_goal_hours: null,
      })
    }
  }
  // A capacidade restante de cada dia vira a própria disponibilidade do cronograma:
  // as janelas livres (já sem blocos fixos e pausas) são cortadas no que sobra do
  // limite diário, então um dia cheio não tira o espaço dos outros.
  const planAvailability: Record<number, TimeWindow[]> = {}
  const commitments: Record<number, TimeWindow[]> = {}
  let maxDailyLeft = 0
  for (const wd of WEEK_ORDER) {
    let left = dailyLimit === null ? Infinity : Math.max(0, dailyLimit - used[wd])
    const windows: TimeWindow[] = []
    for (const [a, b] of free[wd]) {
      if (left <= 0) break
      const end = Math.min(b, a + left)
      windows.push({ start: minutesToHhmm(a), end: minutesToHhmm(end) })
      left -= end - a
    }
    planAvailability[wd] = windows
    commitments[wd] = reserved[wd]
    if (dailyLimit !== null) maxDailyLeft = Math.max(maxDailyLeft, freeMinutes(toIntervals(windows)))
  }
  const weeklyLeft = weeklyLimit === null ? null : Math.max(0, weeklyLimit - weekUsed)
  // generatePlan trata meta 0 como "sem limite": sem folga, não sobra matéria para distribuir.
  if (weeklyLeft === 0 || (dailyLimit !== null && maxDailyLeft === 0)) {
    subjectIds.length = 0
    frequentSubjectIds.length = 0
  }
  const planConfig: PlanConfig = {
    availability: planAvailability,
    commitments,
    blockMinutes: flexible.length > 0 ? Math.min(...flexible.map((p) => p.blockMinutes)) : 50,
    breakMinutes: breakMin,
    weeklyHoursGoal: weeklyLeft === null ? null : weeklyLeft / 60,
    dailyHoursGoal: dailyLimit === null ? null : maxDailyLeft / 60,
    subjectIds,
    frequentSubjectIds,
    activityType: flexible[0]?.activityType ?? 'theory',
  }

  return {
    cycleItems,
    planConfig,
    planSubjects,
    range: { from: startDate, to: rangeTo },
    dailyBlocks,
    recurringTasks,
    milestones,
  }
}

function clampDays(n: number | undefined): number {
  return Math.min(7, Math.max(1, Math.floor(n ?? 1)))
}
