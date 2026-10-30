import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENGLISH_GOAL_MINUTES,
  goalMet,
  minutesOnDay,
  normalizeEnglishGoal,
  practicedDaysInMonth,
  practicesFromSessions,
  streak,
  totalsBySkill,
  type EnglishPractice,
  type EnglishSkill,
} from '@/lib/english'
import type { SessionWithPauses } from '@/lib/data/types'

const SP = 'America/Sao_Paulo'
const p = (iso: string, minutes: number, skill: EnglishSkill | null = 'listening'): EnglishPractice => ({ at: Date.parse(iso), seconds: minutes * 60, skill })

describe('meta diária de inglês', () => {
  it('padrão de 20 min e valores inválidos voltam ao padrão', () => {
    expect(DEFAULT_ENGLISH_GOAL_MINUTES).toBe(20)
    expect(normalizeEnglishGoal(undefined)).toBe(20)
    expect(normalizeEnglishGoal(0)).toBe(20)
    expect(normalizeEnglishGoal(-5)).toBe(20)
    expect(normalizeEnglishGoal('abc')).toBe(20)
    expect(normalizeEnglishGoal(10_000)).toBe(20)
    expect(normalizeEnglishGoal(45)).toBe(45)
    expect(normalizeEnglishGoal('30')).toBe(30)
  })

  it('meta cumprida quando os minutos alcançam a meta', () => {
    expect(goalMet(19, 20)).toBe(false)
    expect(goalMet(20, 20)).toBe(true)
    expect(goalMet(25, 30)).toBe(false)
  })
})

describe('minutos do dia', () => {
  it('soma as práticas do dia no fuso do usuário', () => {
    const list = [p('2026-10-20T12:00:00Z', 10), p('2026-10-20T20:00:00Z', 15, 'speaking'), p('2026-10-21T01:30:00Z', 5)] // 22:30 em SP, ainda dia 20
    expect(minutesOnDay(list, '2026-10-20', SP)).toBe(30)
    expect(minutesOnDay(list, '2026-10-20', 'UTC')).toBe(25)
    expect(minutesOnDay(list, '2026-10-21', 'UTC')).toBe(5)
    expect(minutesOnDay([], '2026-10-20', SP)).toBe(0)
  })
})

describe('sequência de dias', () => {
  const list = [p('2026-10-18T12:00:00Z', 10), p('2026-10-19T12:00:00Z', 5), p('2026-10-20T12:00:00Z', 20)]

  it('conta dias consecutivos até hoje', () => {
    expect(streak(list, '2026-10-20', SP)).toBe(3)
  })

  it('hoje sem prática ainda mantém a sequência de ontem', () => {
    expect(streak(list, '2026-10-21', SP)).toBe(3)
  })

  it('um dia sem prática zera a sequência', () => {
    expect(streak(list, '2026-10-22', SP)).toBe(0)
    expect(streak([], '2026-10-22', SP)).toBe(0)
  })

  it('usa o fuso do usuário para decidir o dia', () => {
    // 02:00 UTC do dia 21 = 23:00 do dia 20 em São Paulo.
    const late = [p('2026-10-19T12:00:00Z', 10), p('2026-10-21T02:00:00Z', 10)]
    expect(streak(late, '2026-10-20', SP)).toBe(2)
    expect(streak(late, '2026-10-21', 'UTC')).toBe(1)
  })
})

describe('dias praticados no mês', () => {
  it('lista os dias do mês com prática, em ordem e sem repetição', () => {
    const list = [p('2026-10-05T12:00:00Z', 10), p('2026-10-01T12:00:00Z', 5), p('2026-10-05T15:00:00Z', 5), p('2026-09-30T12:00:00Z', 5), p('2026-11-01T02:00:00Z', 5)]
    // 2026-11-01T02:00Z ainda é 31/10 em São Paulo.
    expect(practicedDaysInMonth(list, '2026-10-17', SP)).toEqual(['2026-10-01', '2026-10-05', '2026-10-31'])
    expect(practicedDaysInMonth(list, '2026-09-01', SP)).toEqual(['2026-09-30'])
    expect(practicedDaysInMonth(list, '2026-12-01', SP)).toEqual([])
  })
})

describe('totais por habilidade', () => {
  it('soma os segundos de cada habilidade e ignora práticas sem habilidade', () => {
    const t = totalsBySkill([p('2026-10-20T12:00:00Z', 10), p('2026-10-21T12:00:00Z', 5), p('2026-10-21T13:00:00Z', 7, 'vocabulary'), p('2026-10-21T14:00:00Z', 3, null)])
    expect(t).toEqual({ listening: 900, speaking: 0, reading: 0, writing: 0, vocabulary: 420 })
  })

  it('converte sessões concluídas usando a habilidade do tópico', () => {
    const base = { adjustment_seconds: 0, pauses: [] }
    const sessions = [
      { ...base, id: 'a', status: 'completed', topic_id: 't1', started_at: '2026-10-20T12:00:00Z', ended_at: '2026-10-20T12:15:00Z' },
      { ...base, id: 'b', status: 'cancelled', topic_id: 't1', started_at: '2026-10-20T13:00:00Z', ended_at: '2026-10-20T13:15:00Z' },
      { ...base, id: 'c', status: 'completed', topic_id: null, started_at: '2026-10-20T14:00:00Z', ended_at: '2026-10-20T14:05:00Z' },
    ] as unknown as SessionWithPauses[]
    const list = practicesFromSessions(sessions, new Map([['t1', 'speaking' as const]]), Date.parse('2026-10-21T00:00:00Z'))
    expect(list).toEqual([
      { at: Date.parse('2026-10-20T12:00:00Z'), seconds: 900, skill: 'speaking' },
      { at: Date.parse('2026-10-20T14:00:00Z'), seconds: 300, skill: null },
    ])
  })
})
