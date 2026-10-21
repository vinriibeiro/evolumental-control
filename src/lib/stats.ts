// Agregações de estudo. Usam apenas sessões CONCLUÍDAS; o tempo de cada
// sessão é repartido entre os dias (fuso do usuário) e somente a parte que
// cai no período pedido é contada.
import type { SessionWithPauses } from '@/lib/data/types'
import { netSecondsByDay } from '@/lib/timer/engine'
import { addDays, dayKey, eachDay, type DayKey, type DayRange } from '@/lib/time'

export interface Breakdown {
  total: number
  byDay: Map<DayKey, number>
  bySubject: Map<string, number>
  byTopic: Map<string, number>
  byActivity: Map<string, number>
  /** Sessões concluídas iniciadas no período. */
  sessions: number
  subjectsStudied: number
}

const NONE = '__none__'

export function breakdown(sessions: SessionWithPauses[], tz: string, range: DayRange): Breakdown {
  const byDay = new Map<DayKey, number>()
  const bySubject = new Map<string, number>()
  const byTopic = new Map<string, number>()
  const byActivity = new Map<string, number>()
  let total = 0
  let count = 0
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const start = dayKey(new Date(s.started_at).getTime(), tz)
    if (start >= range.from && start <= range.to) count++
    const perDay = netSecondsByDay([s], tz)
    let inRange = 0
    for (const [k, v] of perDay) {
      if (k < range.from || k > range.to) continue
      add(byDay, k, v)
      inRange += v
    }
    if (inRange <= 0) continue
    total += inRange
    add(bySubject, s.subject_id ?? NONE, inRange)
    if (s.topic_id) add(byTopic, s.topic_id, inRange)
    add(byActivity, s.activity_type, inRange)
  }
  const subjectsStudied = [...bySubject.keys()].filter((k) => k !== NONE).length
  return { total, byDay, bySubject, byTopic, byActivity, sessions: count, subjectsStudied }
}

export function isNoSubject(key: string) {
  return key === NONE
}

/** Dias consecutivos com estudo até hoje (se hoje ainda não houve, conta até ontem). */
export function streak(byDay: Map<DayKey, number>, today: DayKey): number {
  let d = (byDay.get(today) ?? 0) > 0 ? today : addDays(today, -1)
  let n = 0
  while ((byDay.get(d) ?? 0) > 0) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function series(byDay: Map<DayKey, number>, range: DayRange): Array<{ day: DayKey; seconds: number }> {
  return eachDay(range.from, range.to).map((day) => ({ day, seconds: byDay.get(day) ?? 0 }))
}

/** Margem para buscar sessões que começaram antes do período mas entram nele. */
export function fetchWindow(fromMs: number, toMs: number) {
  return { fromIso: new Date(fromMs - 86400000).toISOString(), toIso: new Date(toMs).toISOString() }
}
