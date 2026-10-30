// Planejamento automático do cronograma — regras determinísticas e
// transparentes (sem IA). Veja PLANNER_RULES para o texto exibido na tela.
import type { ActivityType, PlanConfig, StudyPlanItem, Subject, TimeWindow } from '@/types/db'
import { addDays, diffDays, eachDay, hhmmToMinutes, minutesToHhmm, startOfWeek, weekday, windowRange, type DayKey } from '@/lib/time'

export const PLANNER_RULES = [
  'Usa apenas os dias e horários disponíveis, descontando compromissos e intervalos.',
  'Cada janela livre é dividida em blocos da duração escolhida, com a pausa configurada entre eles. Sobras menores que metade de um bloco são descartadas.',
  'Respeita o limite de horas por dia e por semana, quando informados.',
  'Peso de cada matéria = prioridade (1–5) × fator de dificuldade (0,875 a 1,375) × 1,5 se exigir maior frequência × 1,25 se a data prevista de conclusão estiver a menos de 30 dias.',
  'A cada bloco, escolhe a matéria com menor tempo já distribuído em relação ao seu peso (distribuição equilibrada e proporcional).',
  'Matérias que já atingiram a meta semanal de horas só recebem blocos quando todas as outras também atingiram.',
  'Evita mais de dois blocos seguidos da mesma matéria no mesmo dia quando há outra opção.',
]

export interface PlannedBlock {
  date: DayKey
  start_time: string
  duration_minutes: number
  subject_id: string
  activity_type: ActivityType
}

type Interval = [number, number]

function windowsToIntervals(ws: TimeWindow[] = []): Interval[] {
  return ws
    .map((w): Interval => windowRange(w))
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
}

/** Remove os compromissos das janelas disponíveis. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  let result = free
  for (const [bs, be] of busy) {
    const next: Interval[] = []
    for (const [fs, fe] of result) {
      if (be <= fs || bs >= fe) {
        next.push([fs, fe])
        continue
      }
      if (bs > fs) next.push([fs, bs])
      if (be < fe) next.push([be, fe])
    }
    result = next
  }
  return result
}

export function subjectWeight(s: Pick<Subject, 'priority' | 'difficulty' | 'target_date'>, frequent: boolean, today: DayKey): number {
  let w = s.priority * (0.75 + 0.125 * s.difficulty)
  if (frequent) w *= 1.5
  if (s.target_date && diffDays(today, s.target_date) >= 0 && diffDays(today, s.target_date) < 30) w *= 1.25
  return w
}

export function generatePlan(
  config: PlanConfig,
  subjects: Array<Pick<Subject, 'id' | 'priority' | 'difficulty' | 'target_date' | 'weekly_goal_hours'>>,
  range: { from: DayKey; to: DayKey },
  today: DayKey = range.from,
): PlannedBlock[] {
  const chosen = subjects.filter((s) => config.subjectIds.includes(s.id))
  if (chosen.length === 0 || config.blockMinutes < 5) return []
  const weights = new Map(chosen.map((s) => [s.id, subjectWeight(s, config.frequentSubjectIds.includes(s.id), today)]))
  const assigned = new Map<string, number>(chosen.map((s) => [s.id, 0]))
  const weekAssigned = new Map<string, number>()
  const out: PlannedBlock[] = []
  let currentWeek = ''
  let weekTotal = 0
  let last: string | null = null
  let streak: number

  for (const date of eachDay(range.from, range.to)) {
    const wk = startOfWeek(date)
    if (wk !== currentWeek) {
      currentWeek = wk
      weekTotal = 0
      weekAssigned.clear()
    }
    const wd = weekday(date)
    const free = subtractIntervals(windowsToIntervals(config.availability[wd]), windowsToIntervals(config.commitments[wd]))
    let dayTotal = 0
    last = null
    streak = 0
    for (const [fs, fe] of free) {
      let t = fs
      while (t < fe) {
        const room = fe - t
        const len = Math.min(config.blockMinutes, room)
        if (len < Math.max(5, config.blockMinutes / 2)) break
        if (config.dailyHoursGoal && dayTotal + len > config.dailyHoursGoal * 60 + 0.001) break
        if (config.weeklyHoursGoal && weekTotal + len > config.weeklyHoursGoal * 60 + 0.001) break

        const underGoal = chosen.filter((s) => !s.weekly_goal_hours || (weekAssigned.get(s.id) ?? 0) < s.weekly_goal_hours * 60)
        const pool = underGoal.length > 0 ? underGoal : chosen
        const ranked = [...pool].sort((a, b) => {
          const ra = (assigned.get(a.id) ?? 0) / weights.get(a.id)!
          const rb = (assigned.get(b.id) ?? 0) / weights.get(b.id)!
          if (ra !== rb) return ra - rb
          return weights.get(b.id)! - weights.get(a.id)!
        })
        const pick = streak >= 2 ? (ranked.find((s) => s.id !== last) ?? ranked[0]) : ranked[0]
        out.push({ date, start_time: minutesToHhmm(t), duration_minutes: len, subject_id: pick.id, activity_type: config.activityType })
        assigned.set(pick.id, (assigned.get(pick.id) ?? 0) + len)
        weekAssigned.set(pick.id, (weekAssigned.get(pick.id) ?? 0) + len)
        dayTotal += len
        weekTotal += len
        streak = pick.id === last ? streak + 1 : 1
        last = pick.id
        t += len + config.breakMinutes
      }
    }
  }
  return out
}

export interface TimedItem {
  id?: string
  date: DayKey
  start_time: string
  duration_minutes: number
}

/** Pares de itens que se sobrepõem no mesmo dia. */
export function findConflicts<T extends TimedItem>(items: T[]): Array<[T, T]> {
  const byDate = new Map<string, T[]>()
  for (const it of items) {
    const list = byDate.get(it.date) ?? []
    list.push(it)
    byDate.set(it.date, list)
  }
  const out: Array<[T, T]> = []
  for (const list of byDate.values()) {
    const sorted = [...list].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
    for (let i = 0; i < sorted.length; i++) {
      const endI = hhmmToMinutes(sorted[i].start_time) + sorted[i].duration_minutes
      for (let j = i + 1; j < sorted.length; j++) {
        if (hhmmToMinutes(sorted[j].start_time) >= endI) break
        out.push([sorted[i], sorted[j]])
      }
    }
  }
  return out
}

export function conflictsWith<T extends TimedItem>(candidate: TimedItem, items: T[]): T[] {
  const s = hhmmToMinutes(candidate.start_time)
  const e = s + candidate.duration_minutes
  return items.filter((it) => {
    if (it.date !== candidate.date || (candidate.id && it.id === candidate.id)) return false
    const is = hhmmToMinutes(it.start_time)
    return is < e && is + it.duration_minutes > s
  })
}

export interface PlanDiff {
  addedMinutesBySubject: Map<string, number>
  removedMinutesBySubject: Map<string, number>
  added: number
  removed: number
  kept: number
}

/** Compara a proposta com os itens pendentes que seriam substituídos. */
export function diffPlan(existing: Array<Pick<StudyPlanItem, 'subject_id' | 'duration_minutes' | 'status' | 'date' | 'start_time'>>, proposal: PlannedBlock[]): PlanDiff {
  const replaceable = existing.filter((e) => e.status === 'pending')
  const key = (x: { date: string; start_time: string; subject_id: string | null; duration_minutes: number }) =>
    `${x.date}|${x.start_time}|${x.subject_id}|${x.duration_minutes}`
  const oldKeys = new Map<string, number>()
  for (const e of replaceable) oldKeys.set(key(e), (oldKeys.get(key(e)) ?? 0) + 1)
  let kept = 0
  const addedM = new Map<string, number>()
  const removedM = new Map<string, number>()
  const remaining = new Map(oldKeys)
  let added = 0
  for (const p of proposal) {
    const k = key(p)
    const n = remaining.get(k) ?? 0
    if (n > 0) {
      remaining.set(k, n - 1)
      kept++
    } else {
      added++
      addedM.set(p.subject_id, (addedM.get(p.subject_id) ?? 0) + p.duration_minutes)
    }
  }
  let removed = 0
  for (const e of replaceable) {
    const k = key(e)
    const n = remaining.get(k) ?? 0
    if (n > 0) {
      remaining.set(k, n - 1)
      removed++
      const sid = e.subject_id ?? ''
      removedM.set(sid, (removedM.get(sid) ?? 0) + e.duration_minutes)
    }
  }
  return { addedMinutesBySubject: addedM, removedMinutesBySubject: removedM, added, removed, kept }
}

export function defaultPlanConfig(): PlanConfig {
  const weekdays = [1, 2, 3, 4, 5]
  const availability: PlanConfig['availability'] = {}
  for (let d = 0; d < 7; d++) availability[d] = weekdays.includes(d) ? [{ start: '19:00', end: '22:00' }] : d === 6 ? [{ start: '08:00', end: '12:00' }] : []
  const commitments: PlanConfig['commitments'] = {}
  for (let d = 0; d < 7; d++) commitments[d] = []
  return {
    availability,
    commitments,
    blockMinutes: 50,
    breakMinutes: 10,
    weeklyHoursGoal: null,
    dailyHoursGoal: null,
    subjectIds: [],
    frequentSubjectIds: [],
    activityType: 'theory',
  }
}

export function planRangeDays(from: DayKey, weeks: number): { from: DayKey; to: DayKey } {
  return { from, to: addDays(from, weeks * 7 - 1) }
}

export interface ReplanBlock extends TimedItem {
  id: string
}

/**
 * Replanejar: move blocos pendentes atrasados para o primeiro dia (a partir de
 * hoje) em que o mesmo horário esteja livre, dentro da disponibilidade
 * informada (quando houver) e sem sobrepor outros blocos. Hoje só vale se o
 * horário ainda não passou. Retorna as novas datas; blocos sem vaga em
 * `maxDays` dias ficam de fora.
 */
export function replanLate<T extends ReplanBlock>(
  late: T[],
  scheduled: TimedItem[],
  today: DayKey,
  nowMinutes: number,
  availability?: PlanConfig['availability'],
  maxDays = 60,
): Array<{ id: string; date: DayKey }> {
  const taken = [...scheduled]
  const out: Array<{ id: string; date: DayKey }> = []
  const sorted = [...late].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
  for (const b of sorted) {
    const start = hhmmToMinutes(b.start_time)
    const end = start + b.duration_minutes
    for (let i = 0; i < maxDays; i++) {
      const date = addDays(today, i)
      if (i === 0 && start <= nowMinutes) continue
      const windows = availability ? windowsToIntervals(availability[weekday(date)]) : null
      if (windows && windows.length && !windows.some(([ws, we]) => start >= ws && end <= we)) continue
      if (windows && windows.length === 0 && availability && Object.values(availability).some((w) => (w ?? []).length)) continue
      const candidate = { date, start_time: b.start_time, duration_minutes: b.duration_minutes }
      if (conflictsWith(candidate, taken).length) continue
      taken.push(candidate)
      out.push({ id: b.id, date })
      break
    }
  }
  return out
}

/** Grupos de dias para repetir horários (0 = domingo … 6 = sábado). */
export const DAY_GROUPS = {
  all: [1, 2, 3, 4, 5, 6, 0],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [6, 0],
} as const

/** Copia as janelas de um dia para os dias de destino, substituindo o que eles tinham (cópias independentes). */
export function copyDayWindows(windows: Record<number, TimeWindow[]>, from: number, targets: readonly number[]): Record<number, TimeWindow[]> {
  const source = windows[from] ?? []
  const next: Record<number, TimeWindow[]> = { ...windows }
  for (const day of targets) if (day !== from) next[day] = source.map((w) => ({ ...w }))
  return next
}
