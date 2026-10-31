// "Estudei este tópico": o que isso muda no ciclo e no cronograma, além de concluir o tópico.
import { currentItem, skip, sortItems, type CycleProgress } from '@/lib/cycle'
import type { DayKey } from '@/lib/time'
import type { StudyCycle, StudyCycleItem, StudyPlanItem } from '@/types/db'

export interface StudiedEffects {
  /** Novo progresso do ciclo (só quando o tópico é o bloco atual do ciclo ativo). */
  cyclePatch: CycleProgress | null
  /** Blocos pendentes do cronograma, para hoje ou dias anteriores, que viram "feito". */
  planItemIds: string[]
}

export function studiedEffects(args: {
  topicId: string
  cycle: StudyCycle | null
  cycleItems: StudyCycleItem[]
  planItems: Array<Pick<StudyPlanItem, 'id' | 'topic_id' | 'status' | 'date'>>
  today: DayKey
}): StudiedEffects {
  const { topicId, cycle, cycleItems, planItems, today } = args
  let cyclePatch: CycleProgress | null = null
  if (cycle && cycle.status === 'active' && cycleItems.length) {
    const sorted = sortItems(cycleItems)
    const now = currentItem(cycle, sorted)
    if (now?.topic_id === topicId) cyclePatch = skip(cycle, sorted.length, 1)
  }
  const planItemIds = planItems.filter((p) => p.topic_id === topicId && p.status === 'pending' && p.date <= today).map((p) => p.id)
  return { cyclePatch, planItemIds }
}
