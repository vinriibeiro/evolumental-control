// Progresso de metas, sempre calculado a partir dos registros (nada armazenado).
import type { FlashcardReview, GoalPeriod, QuestionRecord, StudyGoal, Topic } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'
import { breakdown } from '@/lib/stats'
import { addDays, addMonths, dayKey, endOfMonth, periodRange, startOfMonth, startOfWeek, type DayRange } from '@/lib/time'

export interface GoalData {
  sessions: SessionWithPauses[]
  questions: QuestionRecord[]
  topics: Pick<Topic, 'subject_id' | 'completed_at'>[]
  reviews: Pick<FlashcardReview, 'reviewed_at'>[]
  timezone: string
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
