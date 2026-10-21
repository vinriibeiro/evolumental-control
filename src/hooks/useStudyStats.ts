import { useMemo } from 'react'
import { eq, gte, lt, type Filter } from '@/lib/data/types'
import { breakdown, fetchWindow } from '@/lib/stats'
import { rangeInstants, type DayRange } from '@/lib/time'
import { useSessions } from './data'
import { useSettings } from './useSettings'

/** Sessões concluídas que tocam o período + agregações já recortadas. */
export function useStudyStats(range: DayRange, extra: Filter[] = []) {
  const { timezone } = useSettings()
  const { fromMs, toMs } = rangeInstants(range, timezone)
  const { fromIso, toIso } = fetchWindow(fromMs, toMs)
  const query = useSessions(
    { filters: [eq('status', 'completed'), gte('started_at', fromIso), lt('started_at', toIso), ...extra], order: [{ column: 'started_at' }] },
    { keepPrevious: true },
  )
  const { from, to } = range
  const stats = useMemo(() => breakdown(query.data ?? [], timezone, { from, to }), [query.data, timezone, from, to])
  return { ...query, stats, timezone }
}
