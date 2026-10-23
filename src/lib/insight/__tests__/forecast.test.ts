import { describe, expect, it } from 'vitest'
import { defaultPlanConfig } from '@/lib/planner'
import type { StudyPlan } from '@/types/db'
import { DEFAULT_TOPIC_MINUTES, forecast, weeklyAvailability } from '../forecast'
import { session, topic, TODAY, TZ } from './fixtures'

// Semana atual começa em 19/10; as 4 semanas completas vão de 21/09 a 18/10.
const weekly = (minutes: number) => ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map((d) => session(`${d}T12:00:00Z`, minutes, { subject_id: 'pt' }))

describe('previsão de conclusão', () => {
  it('sem tópicos: nada a projetar', () => {
    const f = forecast({ topics: [], sessions: [], today: TODAY, tz: TZ, availability: null })
    expect(f).toMatchObject({ totalTopics: 0, remainingTopics: 0, remainingMinutes: 0 })
  })

  it('ritmo atual, data estimada e cenários +30 min/dia e +1 h/dia', () => {
    const topics = [topic('a', 'pt', { estimated_minutes: 300 }), topic('b', 'pt', { estimated_minutes: 300 }), topic('c', 'pt', { status: 'completed' })]
    const f = forecast({ topics, sessions: weekly(300), today: TODAY, tz: TZ, availability: null })
    expect(f.pace).toBe(300)
    expect(f.remainingMinutes).toBe(600)
    expect(f.minutesSource).toBe('estimates')
    expect(f.scenarios.map((s) => [s.id, s.pace, s.date])).toEqual([
      ['current', 300, '2026-11-05'], // 2 semanas
      ['plus30', 510, '2026-10-31'],
      ['plus60', 720, '2026-10-28'],
    ])
    expect(f.caveats[0]).toMatch(/não é uma certeza/)
  })

  it('desconta o já estudado no tópico e aplica o peso', () => {
    const topics = [topic('a', 'pt', { estimated_minutes: 100, weight: 2 })]
    const f = forecast({ topics, sessions: [session('2026-10-20T12:00:00Z', 50, { subject_id: 'pt', topic_id: 'a' })], today: TODAY, tz: TZ, availability: null })
    expect(f.remainingMinutes).toBe(150)
  })

  it('sem estimativa: usa a média histórica dos concluídos; sem histórico, o padrão', () => {
    const hist = [topic('x', 'pt', { status: 'completed' }), topic('y', 'pt', { status: 'completed' }), topic('z', 'pt')]
    const sessions = [session('2026-08-01T12:00:00Z', 40, { subject_id: 'pt', topic_id: 'x' }), session('2026-08-02T12:00:00Z', 60, { subject_id: 'pt', topic_id: 'y' })]
    expect(forecast({ topics: hist, sessions, today: TODAY, tz: TZ, availability: null })).toMatchObject({ minutesSource: 'history', historyMinutesPerTopic: 50, remainingMinutes: 50 })
    const none = forecast({ topics: [topic('z', 'pt')], sessions: [], today: TODAY, tz: TZ, availability: null })
    expect(none).toMatchObject({ minutesSource: 'default', remainingMinutes: DEFAULT_TOPIC_MINUTES })
    expect(none.caveats.join(' ')).toMatch(/90 min/)
  })

  it('ritmo zero: sem data no ritmo atual e aviso explícito', () => {
    const f = forecast({ topics: [topic('a', 'pt', { estimated_minutes: 60 })], sessions: [], today: TODAY, tz: TZ, availability: null })
    expect(f.scenarios[0].date).toBeNull()
    expect(f.caveats.join(' ')).toMatch(/Sem estudo nas últimas 4 semanas/)
  })

  it('meta com data: ritmo necessário e diferença; meta personalizada; acima da disponibilidade', () => {
    const topics = [topic('a', 'pt', { estimated_minutes: 1200 })]
    const f = forecast({ topics, sessions: weekly(300), today: TODAY, tz: TZ, availability: 400, targetDate: '2026-11-19', customPace: 600 })
    expect(f.target).toMatchObject({ date: '2026-11-19', neededPace: 300, diff: 0 })
    const custom = f.scenarios.find((s) => s.id === 'custom')!
    expect(custom).toMatchObject({ pace: 600, date: '2026-11-05', overAvailability: true })
    expect(f.scenarios[0].overAvailability).toBe(false)
  })

  it('tópicos pai e pastas não contam como conteúdo (só as folhas)', () => {
    const topics = [topic('p', 'pt'), topic('c1', 'pt', { parent_id: 'p', estimated_minutes: 30 }), topic('f', 'pt', { kind: 'folder' })]
    expect(forecast({ topics, sessions: [], today: TODAY, tz: TZ, availability: null })).toMatchObject({ totalTopics: 1, remainingMinutes: 30 })
  })
})

describe('disponibilidade semanal', () => {
  it('soma as janelas da semana menos compromissos; sem cronograma = null', () => {
    const plan: StudyPlan = {
      id: 'p', user_id: 'u', created_at: '', updated_at: '', name: 'P', description: null, start_date: '2026-10-01', end_date: '2026-12-31', status: 'active',
      config: { ...defaultPlanConfig(), availability: { 1: [{ start: '19:00', end: '22:00' }], 6: [{ start: '08:00', end: '12:00' }] }, commitments: { 6: [{ start: '10:00', end: '11:00' }] } },
    }
    expect(weeklyAvailability([plan], TODAY)).toBe(180 + 180)
    expect(weeklyAvailability([], TODAY)).toBeNull()
  })
})
