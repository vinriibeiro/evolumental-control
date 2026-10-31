import { describe, expect, it } from 'vitest'
import { studiedEffects } from '../studied'
import type { StudyCycle, StudyCycleItem } from '@/types/db'

const item = (id: string, order: number, topic: string | null): StudyCycleItem => ({ id, sort_order: order, topic_id: topic, subject_id: 's', cycle_id: 'c', duration_minutes: 60, weight: 1, break_minutes: 0, activity_type: 'theory' }) as unknown as StudyCycleItem
const cycle = (index: number, status: StudyCycle['status'] = 'active'): StudyCycle => ({ id: 'c', status, current_index: index, current_progress_seconds: 1200, completed_rounds: 0, auto_advance: true }) as unknown as StudyCycle
const plan = (id: string, topic: string, status: string, date: string) => ({ id, topic_id: topic, status, date }) as never

describe('estudei → ciclo e cronograma', () => {
  const items = [item('a', 0, 't1'), item('b', 1, 't2'), item('c', 2, 't3')]

  it('avança o ciclo quando o tópico é o bloco atual', () => {
    const r = studiedEffects({ topicId: 't2', cycle: cycle(1), cycleItems: items, planItems: [], today: '2026-11-02' })
    expect(r.cyclePatch).toEqual({ current_index: 2, current_progress_seconds: 0, completed_rounds: 0 })
  })

  it('completa a volta ao passar do último bloco', () => {
    const r = studiedEffects({ topicId: 't3', cycle: cycle(2), cycleItems: items, planItems: [], today: '2026-11-02' })
    expect(r.cyclePatch).toMatchObject({ current_index: 0, completed_rounds: 1 })
  })

  it('não mexe no ciclo se o tópico não é o bloco atual, ou se o ciclo está pausado', () => {
    expect(studiedEffects({ topicId: 't3', cycle: cycle(0), cycleItems: items, planItems: [], today: '2026-11-02' }).cyclePatch).toBeNull()
    expect(studiedEffects({ topicId: 't1', cycle: cycle(0, 'paused'), cycleItems: items, planItems: [], today: '2026-11-02' }).cyclePatch).toBeNull()
    expect(studiedEffects({ topicId: 't1', cycle: null, cycleItems: [], planItems: [], today: '2026-11-02' }).cyclePatch).toBeNull()
  })

  it('marca como feitos só os blocos pendentes do tópico, de hoje ou de antes', () => {
    const planItems = [plan('p1', 't1', 'pending', '2026-11-02'), plan('p2', 't1', 'pending', '2026-10-30'), plan('p3', 't1', 'pending', '2026-11-05'), plan('p4', 't1', 'done', '2026-11-01'), plan('p5', 'outro', 'pending', '2026-11-02')]
    expect(studiedEffects({ topicId: 't1', cycle: null, cycleItems: [], planItems, today: '2026-11-02' }).planItemIds).toEqual(['p1', 'p2'])
  })
})
