// Copiar blocos do cronograma: de um dia para outros dias, ou de uma semana para as próximas.
// Só decide o que criar; quem grava no banco é a tela. Nunca copia o mesmo bloco duas vezes.
import { addDays, startOfWeek, weekday, type DayKey } from '@/lib/time'
import type { ActivityType, UUID } from '@/types/db'

export interface CopyableBlock {
  date: DayKey
  start_time: string
  duration_minutes: number
  subject_id: UUID | null
  topic_id: UUID | null
  activity_type: ActivityType
  notes: string | null
  status?: string
}

export type CopyScope =
  | { kind: 'day'; date: DayKey; targetWeekdays: readonly number[]; weeks: number }
  | { kind: 'week'; date: DayKey; weeks: number }

export const MAX_COPY_WEEKS = 26

const sameBlock = (a: CopyableBlock, b: CopyableBlock) =>
  a.date === b.date && a.start_time === b.start_time && a.duration_minutes === b.duration_minutes && a.subject_id === b.subject_id && a.topic_id === b.topic_id

/** Dia da semana (0=domingo) → data dentro da semana que começa em `monday`. */
const dateInWeek = (monday: DayKey, wd: number): DayKey => addDays(monday, (wd + 6) % 7)

/**
 * Blocos a criar. `blocks` = tudo o que já existe nos dias de origem (e pode incluir outros dias: é filtrado aqui).
 * `existing` = blocos já presentes nos destinos, para não duplicar.
 */
export function planCopy(blocks: readonly CopyableBlock[], existing: readonly CopyableBlock[], scope: CopyScope): { create: CopyableBlock[]; skipped: number } {
  const weeks = Math.max(1, Math.min(MAX_COPY_WEEKS, Math.floor(scope.weeks) || 1))
  const monday = startOfWeek(scope.date)
  const live = blocks.filter((b) => b.status !== 'rescheduled')
  const wanted: CopyableBlock[] = []

  if (scope.kind === 'day') {
    const source = live.filter((b) => b.date === scope.date)
    const targets = [...new Set(scope.targetWeekdays)].filter((d) => d >= 0 && d <= 6)
    for (let w = 0; w < weeks; w++) {
      for (const wd of targets) {
        const date = dateInWeek(addDays(monday, 7 * w), wd)
        if (date === scope.date) continue
        for (const b of source) wanted.push({ ...b, date })
      }
    }
  } else {
    const end = addDays(monday, 6)
    const source = live.filter((b) => b.date >= monday && b.date <= end)
    for (let w = 1; w <= weeks; w++) for (const b of source) wanted.push({ ...b, date: addDays(b.date, 7 * w) })
  }

  const create: CopyableBlock[] = []
  let skipped = 0
  for (const b of wanted) {
    if (existing.some((e) => e.status !== 'rescheduled' && sameBlock(e, b)) || create.some((c) => sameBlock(c, b))) skipped++
    else create.push({ ...b, status: undefined })
  }
  return { create, skipped }
}

/** Dias da semana (0=domingo) já marcados no pedido, para mostrar "Seg a sex" etc. */
export const WEEKDAY_GROUPS = {
  weekdays: [1, 2, 3, 4, 5],
  weekend: [6, 0],
  all: [1, 2, 3, 4, 5, 6, 0],
} as const

export const weekdayOf = weekday
