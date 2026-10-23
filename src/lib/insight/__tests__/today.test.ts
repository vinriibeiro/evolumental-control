import { describe, expect, it } from 'vitest'
import { defaultPlanConfig } from '@/lib/planner'
import type { CalendarTask, StudyPlan } from '@/types/db'
import { masteryIndex } from '../evidence'
import type { Recommendation } from '../recommend'
import { dayTimeline, freeWindowsToday, mergeIntervals, pendencies, remainingFree } from '../today'
import { NOW, planItem, review, subject, topic, TODAY, TZ } from './fixtures'

// 22/10/2026 é uma quinta-feira (weekday 4).
function plan(over: Partial<StudyPlan> = {}): StudyPlan {
  const config = { ...defaultPlanConfig(), availability: { 4: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] }, commitments: { 4: [{ start: '09:00', end: '10:00' }] } }
  return { id: 'plan', user_id: 'u', created_at: '', updated_at: '', name: 'Plano', description: null, start_date: '2026-10-01', end_date: '2026-12-31', config, status: 'active', ...over }
}

const rec = (id: string, minutes: number, over: Partial<Recommendation> = {}): Recommendation => ({ id, type: 'study', subjectId: 's', topicId: null, suggestedMinutes: minutes, score: 10, reasons: [], ...over })
const name = (s: string | null, t: string | null) => [s, t].filter(Boolean).join(' · ')

describe('disponibilidade de hoje', () => {
  it('sem cronograma com disponibilidade: null (não inventa tempo)', () => {
    expect(freeWindowsToday([], TODAY)).toBeNull()
    expect(freeWindowsToday([plan({ status: 'archived' })], TODAY)).toBeNull()
    expect(freeWindowsToday([plan({ end_date: '2026-10-21' })], TODAY)).toBeNull()
    expect(remainingFree(null, [], 600)).toBeNull()
  })

  it('janelas menos compromissos; restante a partir de agora menos blocos', () => {
    const w = freeWindowsToday([plan()], TODAY)!
    expect(w).toEqual([[480, 540], [600, 720], [840, 1080]])
    const free = remainingFree(w, [[840, 900]], 11 * 60)!
    expect(free.gaps).toEqual([[660, 720], [900, 1080]])
    expect(free.minutes).toBe(60 + 180)
  })

  it('disponibilidade zero (fim do dia): nada livre', () => {
    const w = freeWindowsToday([plan()], TODAY)!
    expect(remainingFree(w, [], 23 * 60)!.minutes).toBe(0)
  })

  it('mergeIntervals junta sobreposições', () => {
    expect(mergeIntervals([[600, 700], [650, 800], [900, 950], [10, 5]])).toEqual([[600, 800], [900, 950]])
  })
})

describe('linha do tempo do dia', () => {
  it('distingue planejado, atrasado, concluído, revisão, tarefa e sugerido', () => {
    const items = dayTimeline({
      planToday: [planItem(TODAY, '08:00', 30, { subject_id: 'a' }), planItem(TODAY, '10:00', 30, { subject_id: 'b', status: 'done' }), planItem(TODAY, '15:00', 60, { subject_id: 'c' })],
      reviewsDue: [review(TODAY, 'planned', { title: 'Revisar X' })],
      tasksToday: [{ id: 't', title: 'Entregar trabalho', start_time: '17:00', duration_minutes: 30, done: false, subject_id: null, topic_id: null } as CalendarTask],
      recommendations: [rec('r1', 40), rec('r2', 25, { type: 'review' }), rec('r3', 30)],
      windows: [[840, 1080]],
      nowMinute: 12 * 60,
      name,
    })
    const kinds = items.map((i) => `${i.start ?? '-'} ${i.kind}`)
    expect(kinds).toEqual(['08:00 late', '10:00 done', '14:00 suggested', '15:00 planned', '16:00 suggested', '17:00 task', '- review'])
    // A sugestão das 14:00 cabe antes do bloco das 15:00 (60 min livres, 40 sugeridos).
    expect(items[2]).toMatchObject({ refId: 'r1', minutes: 40 })
    // Revisões não viram blocos sugeridos (já aparecem como revisão).
    expect(items.some((i) => i.refId === 'r2')).toBe(false)
  })

  it('sem disponibilidade configurada: sem blocos sugeridos', () => {
    const items = dayTimeline({ planToday: [], reviewsDue: [], tasksToday: [], recommendations: [rec('r1', 30)], windows: null, nowMinute: 600, name })
    expect(items).toEqual([])
  })
})

describe('pendências', () => {
  it('só itens acionáveis, com rota para resolver', () => {
    const s = subject('pt', { name: 'Português', weekly_goal_hours: 7 })
    const t = topic('crase', 'pt', { name: 'Crase', priority: 5 })
    const mastery = masteryIndex({ subjects: [s], topics: [t], sessions: [], questions: [], reviews: [], cards: [], today: TODAY, tz: TZ }, NOW)
    const list = pendencies({
      today: TODAY,
      overdueReviews: 3,
      cardsDue: 20,
      missedYesterday: [planItem('2026-10-21', '08:00', 30)],
      subjects: [s],
      topics: [t],
      studiedWeek: new Map([['pt', 3600]]),
      mastery,
      now: NOW,
    })
    expect(list.map((p) => p.label)).toEqual([
      '3 revisão(ões) atrasada(s)',
      '20 flashcard(s) vencido(s)',
      '1 bloco(s) de ontem não realizado(s)',
      'Meta de Português: 14% da semana (esperado 57%)',
      'Crase: prioridade alta e nunca estudado',
    ])
    expect(list.every((p) => p.to.startsWith('/'))).toBe(true)
  })

  it('usuário novo: nenhuma pendência', () => {
    expect(pendencies({ today: TODAY, overdueReviews: 0, cardsDue: 0, missedYesterday: [], subjects: [], topics: [], studiedWeek: new Map(), mastery: null, now: NOW })).toEqual([])
  })
})
