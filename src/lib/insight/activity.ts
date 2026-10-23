// Calendário anual de constância: o que foi feito em cada dia (tempo
// líquido, questões, flashcards, matérias). Puro.
import type { SessionWithPauses } from '@/lib/data/types'
import { netSecondsByDay } from '@/lib/timer/engine'
import { addDays, dayKey, startOfWeek, type DayKey } from '@/lib/time'
import type { QuestionRecord } from '@/types/db'

export interface DayActivity {
  seconds: number
  questions: number
  flashcards: number
  subjects: number
}

export function dailyActivity(input: { sessions: SessionWithPauses[]; questions: Pick<QuestionRecord, 'date' | 'total'>[]; flashcardReviews: Array<{ reviewed_at: string }>; tz: string }): Map<DayKey, DayActivity> {
  const out = new Map<DayKey, DayActivity>()
  const subj = new Map<DayKey, Set<string>>()
  const get = (d: DayKey) => {
    let a = out.get(d)
    if (!a) out.set(d, (a = { seconds: 0, questions: 0, flashcards: 0, subjects: 0 }))
    return a
  }
  for (const s of input.sessions) {
    if (s.status !== 'completed') continue
    for (const [d, sec] of netSecondsByDay([s], input.tz)) {
      if (sec <= 0) continue
      get(d).seconds += sec
      if (s.subject_id) subj.set(d, (subj.get(d) ?? new Set()).add(s.subject_id))
    }
  }
  for (const q of input.questions) get(q.date).questions += q.total
  for (const r of input.flashcardReviews) get(dayKey(Date.parse(r.reviewed_at), input.tz)).flashcards += 1
  for (const [d, set] of subj) get(d).subjects = set.size
  return out
}

/** Nível 0–4 pelo tempo do dia (0 = nada; 4 = 3 h ou mais). */
export function intensity(a: DayActivity | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!a || (a.seconds === 0 && a.questions === 0 && a.flashcards === 0)) return 0
  const h = a.seconds / 3600
  return h >= 3 ? 4 : h >= 1.5 ? 3 : h >= 0.5 ? 2 : 1
}

/** Semanas (segunda a domingo) cobrindo os últimos `weeks` até hoje. */
export function calendarWeeks(today: DayKey, weeks = 53): DayKey[][] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)))
}
