// Tudo que a tela "Hoje" precisa, montado a partir dos dados existentes.
import { useCallback, useMemo, useState } from 'react'
import { useAll } from '@/hooks/data'
import { useMastery } from '@/hooks/useInsight'
import { useNow } from '@/hooks/useNow'
import { useSettings } from '@/hooks/useSettings'
import { currentItem } from '@/lib/cycle'
import { eq, inList, lte } from '@/lib/data/types'
import { diversify, recommend, type Recommendation } from '@/lib/insight/recommend'
import { dayTimeline, freeWindowsToday, pendencies, remainingFree, yesterdayOf } from '@/lib/insight/today'
import { breakdown } from '@/lib/stats'
import { netSeconds } from '@/lib/timer/engine'
import { dayKey, hhmmToMinutes, minuteIso, periodRange, todayKey, tzOffsetMs } from '@/lib/time'

const IGNORE_KEY = 'evl:hoje:ignorar'

function readIgnored(today: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(IGNORE_KEY) ?? 'null') as { day: string; ids: string[] } | null
    return new Set(raw?.day === today ? raw.ids : [])
  } catch {
    return new Set()
  }
}

/** Minuto do dia (0–1439) no fuso do usuário. */
export function minuteOfDay(ms: number, tz: string): number {
  const local = new Date(ms + tzOffsetMs(ms, tz))
  return local.getUTCHours() * 60 + local.getUTCMinutes()
}

export function useToday() {
  const settings = useSettings()
  const tz = settings.timezone
  const now = useNow(60_000)
  const today = todayKey(tz)
  const yesterday = yesterdayOf(today)
  const nowMinute = minuteOfDay(now, tz)
  const mastery = useMastery()

  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const planToday = useAll('study_plan_items', { filters: [eq('date', today)], order: [{ column: 'start_time' }] })
  const missed = useAll('study_plan_items', { filters: [eq('date', yesterday), inList('status', ['pending', 'missed'])] })
  const tasks = useAll('calendar_tasks', { filters: [eq('date', today)], order: [{ column: 'start_time' }] })
  const dueCards = useAll('flashcards', { filters: [inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())] })
  const cycles = useAll('study_cycles', { filters: [eq('status', 'active')] })
  const cycle = cycles.data?.[0]
  const cycleItems = useAll('study_cycle_items', { filters: [eq('cycle_id', cycle?.id ?? '')] }, { enabled: Boolean(cycle) })

  const [ignored, setIgnored] = useState(() => readIgnored(today))
  const ignore = useCallback(
    (id: string) => {
      setIgnored((cur) => {
        const next = new Set([...readIgnored(today), ...cur, id])
        try {
          localStorage.setItem(IGNORE_KEY, JSON.stringify({ day: today, ids: [...next] }))
        } catch {
          /* preferência só nesta sessão */
        }
        return next
      })
    },
    [today],
  )

  const input = mastery.input
  const derived = useMemo(() => {
    if (!input || !mastery.index) return null
    const todaySessions = input.sessions.filter((s) => dayKey(Date.parse(s.started_at), tz) === today)
    const byTopic = new Map<string, number>()
    const bySubject = new Map<string, number>()
    let studiedToday = 0
    for (const s of todaySessions) {
      const sec = netSeconds(s, s.pauses)
      studiedToday += sec
      if (s.topic_id) byTopic.set(s.topic_id, (byTopic.get(s.topic_id) ?? 0) + sec)
      if (s.subject_id) bySubject.set(s.subject_id, (bySubject.get(s.subject_id) ?? 0) + sec)
    }
    const week = breakdown(input.sessions, tz, periodRange('week', today))
    const due = new Map<string, number>()
    for (const c of dueCards.data ?? []) {
      const k = c.topic_id ?? (c.subject_id ? `subject:${c.subject_id}` : null)
      if (k) due.set(k, (due.get(k) ?? 0) + 1)
    }
    const windows = freeWindowsToday(plans.data ?? [], today)
    const busy: Array<[number, number]> = [
      ...(planToday.data ?? []).filter((p) => p.status === 'pending').map((p): [number, number] => [hhmmToMinutes(p.start_time), hhmmToMinutes(p.start_time) + p.duration_minutes]),
      ...(tasks.data ?? []).filter((t) => t.start_time && t.duration_minutes && !t.done).map((t): [number, number] => [hhmmToMinutes(t.start_time!), hhmmToMinutes(t.start_time!) + t.duration_minutes!]),
    ]
    const free = remainingFree(windows, busy, nowMinute)
    const cur = cycle && cycleItems.data ? currentItem(cycle, cycleItems.data) : null
    const recs: Recommendation[] = diversify(
      recommend({
        subjects: input.subjects,
        topics: input.topics,
        mastery: mastery.index,
        reviews: input.reviews,
        planToday: planToday.data ?? [],
        dueCards: due,
        studiedToday: { byTopic, bySubject },
        studiedWeek: week.bySubject,
        cycleSubjectId: cur?.subject_id ?? null,
        availableMinutes: free ? free.minutes : null,
        ignored,
        today,
        nowMinute,
        now,
      }),
    )
    const reviewsDue = input.reviews.filter((r) => (r.status === 'planned' || r.status === 'postponed') && r.scheduled_for <= today)
    const subjectsById = new Map(input.subjects.map((s) => [s.id, s]))
    const topicsById = new Map(input.topics.map((t) => [t.id, t]))
    const name = (subjectId: string | null, topicId: string | null) => {
      const t = topicId ? topicsById.get(topicId)?.name : null
      const s = subjectId ? subjectsById.get(subjectId)?.name : null
      return [s, t].filter(Boolean).join(' · ') || 'Estudo livre'
    }
    const timeline = dayTimeline({ planToday: planToday.data ?? [], reviewsDue, tasksToday: tasks.data ?? [], recommendations: recs, windows, nowMinute, name })
    const pend = pendencies({
      today,
      overdueReviews: reviewsDue.filter((r) => r.scheduled_for < today).length,
      cardsDue: dueCards.data?.length ?? 0,
      missedYesterday: missed.data ?? [],
      subjects: input.subjects,
      topics: input.topics,
      studiedWeek: week.bySubject,
      mastery: mastery.index,
      now,
    })
    return {
      studiedToday,
      sessionsToday: todaySessions.length,
      questionsToday: input.questions.filter((q) => q.date === today).reduce((a, q) => a + q.total, 0),
      reviewsDue,
      tasksPending: (tasks.data ?? []).filter((t) => !t.done).length,
      freeMinutes: free ? free.minutes : null,
      recommendations: recs,
      timeline,
      pendencies: pend,
      name,
      subjectsById,
      topicsById,
    }
  }, [input, mastery.index, tz, today, nowMinute, now, dueCards.data, plans.data, planToday.data, tasks.data, missed.data, cycle, cycleItems.data, ignored])

  const pending = mastery.isPending || plans.isPending || planToday.isPending || tasks.isPending
  return { today, now, derived, pending, error: mastery.error ?? plans.error ?? planToday.error ?? null, ignore, refetch: mastery.refetch, mastery: mastery.index, cycle, cycleItems: cycleItems.data ?? [] }
}
