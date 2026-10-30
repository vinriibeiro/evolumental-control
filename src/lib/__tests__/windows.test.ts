import { describe, expect, it } from 'vitest'
import { copyDayWindows, DAY_GROUPS, defaultPlanConfig, generatePlan } from '@/lib/planner'
import { windowRange, windowsTotalMinutes } from '@/lib/time'
import type { PlanConfig } from '@/types/db'

describe('janelas de horário do cronograma', () => {
  it('fim 00:00 vale como a meia-noite que encerra o dia', () => {
    expect(windowRange({ start: '22:00', end: '00:00' })).toEqual([1320, 1440])
    expect(windowRange({ start: '00:00', end: '00:00' })).toEqual([0, 0])
    expect(windowRange({ start: '10:00', end: '11:00' })).toEqual([600, 660])
  })

  it('soma o total do dia, incluindo janela até a meia-noite, e ignora janelas inválidas', () => {
    expect(windowsTotalMinutes([{ start: '22:00', end: '00:00' }, { start: '10:00', end: '11:00' }])).toBe(180)
    expect(windowsTotalMinutes([{ start: '12:00', end: '11:00' }])).toBe(0)
    expect(windowsTotalMinutes()).toBe(0)
  })

  it('copia os horários de um dia para a semana, sem compartilhar referência', () => {
    const base = {
      1: [{ start: '07:00', end: '08:00' }, { start: '12:00', end: '13:00' }, { start: '21:00', end: '22:00' }],
      6: [{ start: '08:00', end: '12:00' }],
    }
    const all = copyDayWindows(base, 1, DAY_GROUPS.all)
    for (const d of DAY_GROUPS.all) expect(windowsTotalMinutes(all[d])).toBe(180)
    all[2][0].start = '06:00'
    expect(all[1][0].start).toBe('07:00')
    expect(base[1][0].start).toBe('07:00')

    const weekdays = copyDayWindows(base, 1, DAY_GROUPS.weekdays)
    expect(weekdays[5]).toEqual(base[1])
    expect(weekdays[6]).toEqual([{ start: '08:00', end: '12:00' }])
    expect(weekdays[0]).toBeUndefined()
  })

  it('o cronograma automático usa a janela que termina à meia-noite', () => {
    const config: PlanConfig = {
      ...defaultPlanConfig(),
      blockMinutes: 60,
      breakMinutes: 0,
      dailyHoursGoal: null,
      weeklyHoursGoal: null,
      availability: { 1: [{ start: '22:00', end: '00:00' }] },
      commitments: {},
      subjectIds: ['s1'],
      frequentSubjectIds: [],
    }
    const subjects = [{ id: 's1', priority: 3, difficulty: 3, target_date: null, weekly_goal_hours: null }]
    // 2026-11-02 é uma segunda-feira.
    const blocks = generatePlan(config, subjects, { from: '2026-11-02', to: '2026-11-02' })
    expect(blocks.map((b) => b.start_time)).toEqual(['22:00', '23:00'])
  })
})
