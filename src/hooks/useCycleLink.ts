import { useMemo } from 'react'
import { useAll } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { currentItem } from '@/lib/cycle'
import type { StudyCycle, StudyCycleItem } from '@/types/db'

export interface CycleLink {
  cycle: StudyCycle
  item: StudyCycleItem
  /** Minutos que faltam no bloco atual (mínimo 1). */
  remainingMinutes: number
}

/** Bloco atual do ciclo ativo, quando for da matéria informada (o estudo dessa matéria abate o bloco). */
export function useCycleLink(subjectId: string | null | undefined): CycleLink | null {
  const cycles = useAll('study_cycles', { filters: [eq('status', 'active')] })
  const cycle = cycles.data?.[0]
  const items = useAll('study_cycle_items', { filters: [eq('cycle_id', cycle?.id ?? '')] }, { enabled: Boolean(cycle) })
  return useMemo(() => {
    if (!cycle || !items.data) return null
    const item = currentItem(cycle, items.data)
    if (!item || !subjectId || item.subject_id !== subjectId) return null
    return { cycle, item, remainingMinutes: Math.max(1, Math.ceil((item.duration_minutes * 60 - cycle.current_progress_seconds) / 60)) }
  }, [cycle, items.data, subjectId])
}
