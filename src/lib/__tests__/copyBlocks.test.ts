import { describe, expect, it } from 'vitest'
import { planCopy, type CopyableBlock } from '../copyBlocks'

// 2026-11-02 é segunda-feira.
const block = (date: string, start: string, subject = 's1', extra: Partial<CopyableBlock> = {}): CopyableBlock => ({
  date,
  start_time: start,
  duration_minutes: 60,
  subject_id: subject,
  topic_id: null,
  activity_type: 'theory' as CopyableBlock['activity_type'],
  notes: null,
  ...extra,
})

describe('copiar um dia para outros dias', () => {
  const monday = [block('2026-11-02', '19:00'), block('2026-11-02', '20:00', 's2')]

  it('copia todos os blocos do dia para os dias escolhidos da mesma semana', () => {
    const r = planCopy(monday, [], { kind: 'day', date: '2026-11-02', targetWeekdays: [2, 3, 4], weeks: 1 })
    expect(r.create.map((b) => `${b.date} ${b.start_time}`)).toEqual(['2026-11-03 19:00', '2026-11-03 20:00', '2026-11-04 19:00', '2026-11-04 20:00', '2026-11-05 19:00', '2026-11-05 20:00'])
    expect(r.skipped).toBe(0)
  })

  it('não copia o dia para ele mesmo na semana de origem, mas repete nas semanas seguintes', () => {
    const r = planCopy(monday, [], { kind: 'day', date: '2026-11-02', targetWeekdays: [1], weeks: 3 })
    expect(r.create.map((b) => b.date)).toEqual(['2026-11-09', '2026-11-09', '2026-11-16', '2026-11-16'])
  })

  it('"segunda a sexta" a partir de um dia de fim de semana respeita a ordem da semana (segunda a domingo)', () => {
    const sunday = [block('2026-11-08', '10:00')]
    const r = planCopy(sunday, [], { kind: 'day', date: '2026-11-08', targetWeekdays: [1, 2, 3, 4, 5], weeks: 1 })
    expect(r.create.map((b) => b.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
  })

  it('pula o que já existe e o que foi remarcado, sem duplicar', () => {
    const existing = [block('2026-11-03', '19:00')]
    const withMoved = [...monday, block('2026-11-02', '21:00', 's3', { status: 'rescheduled' })]
    const r = planCopy(withMoved, existing, { kind: 'day', date: '2026-11-02', targetWeekdays: [2], weeks: 1 })
    expect(r.create.map((b) => `${b.date} ${b.start_time}`)).toEqual(['2026-11-03 20:00'])
    expect(r.skipped).toBe(1)
  })

  it('limita as semanas e ignora dias inválidos', () => {
    const r = planCopy([block('2026-11-02', '19:00')], [], { kind: 'day', date: '2026-11-02', targetWeekdays: [1, 1, 9], weeks: 999 })
    expect(r.create).toHaveLength(25) // 26 semanas, menos a semana de origem (o dia não copia para ele mesmo)
  })
})

describe('copiar a semana para as próximas', () => {
  const week = [block('2026-11-02', '19:00'), block('2026-11-04', '07:00', 's2'), block('2026-11-08', '10:00'), block('2026-11-10', '19:00')]

  it('repete a semana de origem nas semanas seguintes, mantendo o dia e o horário', () => {
    const r = planCopy(week, [], { kind: 'week', date: '2026-11-05', weeks: 2 })
    expect(r.create.map((b) => `${b.date} ${b.start_time}`)).toEqual(['2026-11-09 19:00', '2026-11-11 07:00', '2026-11-15 10:00', '2026-11-16 19:00', '2026-11-18 07:00', '2026-11-22 10:00'])
  })
})
