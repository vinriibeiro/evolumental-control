import { describe, expect, it } from 'vitest'
import { defaultPlanConfig } from '@/lib/planner'
import { formatDuration } from '@/lib/time'
import type { StudyPlan } from '@/types/db'
import { calendarWeeks, dailyActivity, intensity } from '../activity'
import { masteryIndex, type InsightInput } from '../evidence'
import { evolutionFeed } from '../feed'
import { weekSummary } from '../week'
import { daysAgo, NOW, planItem, questions, session, subject, topic, TODAY, TZ } from './fixtures'

const plan = (over: Partial<StudyPlan> = {}): StudyPlan => ({
  id: 'p', user_id: 'u', created_at: '', updated_at: '', name: 'P', description: null, start_date: '2026-10-01', end_date: '2026-12-31', status: 'active',
  config: { ...defaultPlanConfig(), availability: { 1: [{ start: '08:00', end: '12:00' }], 3: [{ start: '08:00', end: '12:00' }] }, commitments: {}, frequentSubjectIds: [] },
  ...over,
})

describe('visão semanal', () => {
  const pt = subject('pt', { name: 'Português', priority: 5 })
  const es = subject('es', { name: 'Estatística', weekly_goal_hours: 1 })

  it('disponibilidade, planejado, realizado, distribuição e reserva', () => {
    const items = [
      planItem('2026-10-19', '08:00', 120, { subject_id: 'pt', activity_type: 'theory' }),
      planItem('2026-10-21', '08:00', 60, { subject_id: 'es', activity_type: 'questions' }),
      planItem('2026-10-22', '08:00', 30, { subject_id: 'pt', activity_type: 'review' }),
      planItem('2026-10-23', '08:00', 30, { subject_id: 'pt', status: 'rescheduled' }),
      planItem('2026-10-12', '08:00', 90, { subject_id: 'pt' }), // semana passada
    ]
    const w = weekSummary({ plans: [plan()], items, sessions: [session('2026-10-20T12:00:00Z', 45, { subject_id: 'pt' })], subjects: [pt, es], mastery: null, reviewsDue: 2, today: TODAY, tz: TZ })
    expect(w).toMatchObject({ from: '2026-10-19', to: '2026-10-25', availability: 480, planned: 210, done: 45, reserve: 270 })
    expect(w.distribution).toEqual([
      { bucket: 'new', minutes: 120 },
      { bucket: 'review', minutes: 30 },
      { bucket: 'questions', minutes: 60 },
    ])
    expect(w.why).toContain(`Português recebeu mais tempo (${formatDuration(150 * 60)}): prioridade alta.`)
    expect(w.why.some((x) => x.startsWith('Estatística: a meta semanal (1h) já está coberta'))).toBe(true)
    expect(w.suggestions).toContain('2 revisão(ões) vencendo: reserve cerca de 40 min para elas.')
  })

  it('sem cronograma: disponibilidade e reserva desconhecidas (não inventa)', () => {
    const w = weekSummary({ plans: [], items: [], sessions: [], subjects: [], mastery: null, reviewsDue: 0, today: TODAY, tz: TZ })
    expect(w).toMatchObject({ availability: null, reserve: null, planned: 0, why: [], suggestions: [] })
  })

  it('sugere questões para matéria com acerto recente baixo; avisa plano acima da disponibilidade', () => {
    const input: InsightInput = { subjects: [es], topics: [], sessions: [], questions: [questions(daysAgo(2), 20, 8, { subject_id: 'es' })], reviews: [], cards: [], today: TODAY, tz: TZ }
    const w = weekSummary({ plans: [plan()], items: [planItem('2026-10-20', '08:00', 600, { subject_id: 'es' })], sessions: [], subjects: [es], mastery: masteryIndex(input, NOW), reviewsDue: 0, today: TODAY, tz: TZ })
    expect(w.suggestions).toContain('Estatística teve 40% de acerto recente: vale incluir blocos de questões.')
    expect(w.suggestions.some((x) => x.startsWith('O planejado passa da sua disponibilidade em 2'))).toBe(true)
  })
})

describe('feed de evolução', () => {
  const base: InsightInput = { subjects: [subject('pt', { name: 'Português' })], topics: [topic('crase', 'pt', { name: 'Crase' })], sessions: [], questions: [], reviews: [], cards: [], today: TODAY, tz: TZ }

  it('usuário novo: feed vazio', () => {
    expect(evolutionFeed(base, NOW, { weeklyGoalMinutes: 600 })).toEqual([])
  })

  it('domínio subiu nas últimas 3 semanas e virou "dominado"', () => {
    const input = { ...base, questions: [questions(daysAgo(40), 20, 9, { subject_id: 'pt', topic_id: 'crase' }), questions(daysAgo(2), 60, 58, { subject_id: 'pt', topic_id: 'crase' })] }
    const feed = evolutionFeed(input, NOW, { weeklyGoalMinutes: 0 })
    expect(feed.some((e) => e.kind === 'mastery' && /Crase/.test(e.text))).toBe(true)
  })

  it('constância (5+ dos últimos 7 dias), meta semanal batida e revisões', () => {
    const sessions = [0, 1, 2, 3, 4].map((i) => session(`${daysAgo(i)}T12:00:00Z`, 30, { subject_id: 'pt' }))
    const lastWeek = [12, 13, 14, 15].map((d) => session(`2026-10-${d}T12:00:00Z`, 180, { subject_id: 'pt' }))
    const feed = evolutionFeed({ ...base, sessions: [...sessions, ...lastWeek] }, NOW, { weeklyGoalMinutes: 600, reviewsDoneLast7: 6 })
    const texts = feed.map((e) => e.text)
    expect(texts).toContain('Você estudou em 5 dos últimos 7 dias.')
    expect(texts).toContain(`Você bateu a meta semanal na semana passada (${formatDuration(12.5 * 3600)} de ${formatDuration(600 * 60)}).`)
    expect(texts).toContain('6 revisões concluídas nos últimos 7 dias.')
  })

  it('acerto melhorou 30 dias × 30 anteriores (com volume mínimo)', () => {
    const input = { ...base, questions: [questions(daysAgo(45), 20, 10, { subject_id: 'pt' }), questions(daysAgo(5), 20, 16, { subject_id: 'pt' })] }
    expect(evolutionFeed(input, NOW, { weeklyGoalMinutes: 0 }).map((e) => e.text)).toContain('Seu acerto em Português subiu de 50% para 80% (30 dias × 30 anteriores).')
  })
})

describe('calendário de constância', () => {
  it('soma tempo, questões, flashcards e matérias por dia; sessão que cruza a meia-noite divide', () => {
    const m = dailyActivity({
      sessions: [session('2026-10-21T02:30:00Z', 60, { subject_id: 'pt' }), session('2026-10-21T15:00:00Z', 30, { subject_id: 'es' }), session('2026-10-21T16:00:00Z', 30, { subject_id: 'es', status: 'cancelled' })],
      questions: [questions('2026-10-21', 46, 30)],
      flashcardReviews: [{ reviewed_at: '2026-10-21T12:00:00Z' }, { reviewed_at: '2026-10-21T13:00:00Z' }],
      tz: TZ,
    })
    expect(m.get('2026-10-20')).toMatchObject({ seconds: 1800, subjects: 1 })
    expect(m.get('2026-10-21')).toEqual({ seconds: 3600, questions: 46, flashcards: 2, subjects: 2 })
  })

  it('intensidade por tempo e grade de 53 semanas terminando hoje', () => {
    expect([undefined, { seconds: 0, questions: 3, flashcards: 0, subjects: 0 }, { seconds: 3600, questions: 0, flashcards: 0, subjects: 1 }, { seconds: 4 * 3600, questions: 0, flashcards: 0, subjects: 1 }].map(intensity)).toEqual([0, 1, 2, 4])
    const weeks = calendarWeeks(TODAY)
    expect(weeks).toHaveLength(53)
    expect(weeks[52]).toContain(TODAY)
    expect(weeks[0][0] < weeks[52][0]).toBe(true)
  })
})
