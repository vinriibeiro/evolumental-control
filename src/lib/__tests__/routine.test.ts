import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateRoutine, ROUTINE_RULES, type RoutineInput } from '@/lib/routine'
import { distributeByWeight } from '@/lib/cycle'
import { generatePlan, PLANNER_RULES } from '@/lib/planner'
import { hhmmToMinutes, startOfWeek, weekday } from '@/lib/time'
import routineSource from '@/lib/routine.ts?raw'

const evening = [{ start: '19:00', end: '22:00' }]

function input(over: Partial<RoutineInput> = {}): RoutineInput {
  return {
    startDate: '2026-11-02', // segunda-feira
    weeks: 3,
    availability: {
      days: { 1: evening, 2: evening, 3: evening, 4: evening, 5: evening, 6: [{ start: '09:00', end: '12:00' }] },
      dailyLimitMinutes: 150,
      weeklyLimitMinutes: 600,
      breakMinutes: 10,
    },
    pillars: [
      { id: 'en', name: 'Inglês diário', weight: 2, frequency: 'daily', blockMinutes: 30, activityType: 'other', subjectIds: ['s-en'] },
      { id: 'li', name: 'LinkedIn', weight: 1, frequency: 'weekly', blockMinutes: 30, activityType: 'other', subjectIds: [] },
      { id: 'ds', name: 'Ciência de dados', weight: 3, frequency: 'days_per_week', daysPerWeek: 4, blockMinutes: 50, activityType: 'theory', subjectIds: ['s-ds'] },
      { id: 'an', name: 'Análise de dados', weight: 2, frequency: 'days_per_week', daysPerWeek: 2, blockMinutes: 50, activityType: 'questions', subjectIds: ['s-an'] },
      { id: 'pb', name: 'Problemas de DS', weight: 1, frequency: 'days_per_week', daysPerWeek: 2, blockMinutes: 50, activityType: 'questions', subjectIds: ['s-pb'] },
      { id: 'ce', name: 'Certificações', weight: 2, frequency: 'days_per_week', daysPerWeek: 1, blockMinutes: 50, activityType: 'review', subjectIds: ['s-ce'] },
    ],
    milestones: [
      { title: 'Prova de certificação', date: '2026-11-20', pillarId: 'ce' },
      { title: 'Antigo', date: '2026-10-01' },
    ],
    ...over,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('generateRoutine', () => {
  it('é determinístico: mesmas entradas, mesma saída', () => {
    const a = generateRoutine(input())
    const b = generateRoutine(input())
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('não depende da data atual do sistema', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2020-01-01T12:00:00Z'))
    const a = generateRoutine(input())
    vi.setSystemTime(new Date('2031-07-15T03:00:00Z'))
    const b = generateRoutine(input())
    expect(a).toEqual(b)
  })

  it('não usa rede nem data implícita no código', () => {
    expect(routineSource).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|Date\.now|new Date\(|todayKey|supabase/)
  })

  it('pilar diário gera bloco fixo em todos os dias disponíveis', () => {
    const r = generateRoutine(input())
    const en = r.dailyBlocks.filter((b) => b.pillarId === 'en')
    expect(en.map((b) => b.weekday).sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(en.every((b) => b.duration_minutes === 30)).toBe(true)
    expect(en.find((b) => b.weekday === 1)!.start_time).toBe('19:00')
    expect(en.find((b) => b.weekday === 6)!.start_time).toBe('09:00')
    // domingo não tem disponibilidade
    expect(en.some((b) => b.weekday === 0)).toBe(false)
  })

  it('pilar semanal gera uma tarefa recorrente por semana', () => {
    const r = generateRoutine(input())
    expect(r.recurringTasks).toHaveLength(1)
    const li = r.recurringTasks[0]
    expect(li.pillarId).toBe('li')
    expect(li.dates).toHaveLength(3)
    const weeks = li.dates.map((d) => startOfWeek(d))
    expect(new Set(weeks).size).toBe(3)
    expect(li.dates.every((d) => weekday(d) === li.weekday && d >= r.range.from && d <= r.range.to)).toBe(true)
    // não colide com o bloco fixo de inglês no mesmo dia
    const en = r.dailyBlocks.find((b) => b.weekday === li.weekday)!
    expect(hhmmToMinutes(li.start_time)).toBeGreaterThanOrEqual(hhmmToMinutes(en.start_time) + en.duration_minutes)
    // pilares semanais/diários não entram no ciclo
    expect(r.cycleItems.some((c) => c.pillarId === 'li' || c.pillarId === 'en')).toBe(false)
  })

  it('ciclo usa distributeByWeight e respeita os limites diário e semanal', () => {
    const r = generateRoutine(input())
    expect(r.cycleItems.map((c) => c.pillarId)).toEqual(['ds', 'an', 'ce', 'pb'])
    const total = r.cycleItems.reduce((a, c) => a + c.duration_minutes, 0)
    const fixed = r.dailyBlocks.reduce((a, b) => a + b.duration_minutes, 0) + r.recurringTasks.reduce((a, t) => a + t.duration_minutes, 0)
    expect(fixed).toBe(210)
    expect(total + fixed).toBeLessThanOrEqual(600)
    // nenhum item passa do maior espaço livre restante num dia (150 − 30 de inglês)
    expect(r.cycleItems.every((c) => c.duration_minutes <= 120 && c.duration_minutes % 5 === 0)).toBe(true)
    const [ds, an, ce, pb] = r.cycleItems.map((c) => c.duration_minutes)
    expect(ds).toBeGreaterThanOrEqual(an)
    expect(an).toBe(ce)
    expect(an).toBeGreaterThan(pb)
  })

  it('sem limites apertados, as durações são exatamente as de distributeByWeight', () => {
    const base = input()
    const r = generateRoutine(
      input({
        pillars: base.pillars.filter((p) => p.id === 'ds' || p.id === 'an'),
        availability: { ...base.availability, dailyLimitMinutes: null, weeklyLimitMinutes: null },
      }),
    )
    // volta = 4 × 50 + 2 × 50 = 300 min
    expect(r.cycleItems.map((c) => c.duration_minutes)).toEqual(distributeByWeight([3, 2], 300))
    expect(r.cycleItems.map((c) => c.weight)).toEqual([3, 2])
  })

  it('limites apertados reduzem o ciclo sem passar do total', () => {
    const base = input()
    const r = generateRoutine(input({ availability: { ...base.availability, dailyLimitMinutes: 60, weeklyLimitMinutes: 300 } }))
    const fixed = r.dailyBlocks.reduce((a, b) => a + b.duration_minutes, 0) + r.recurringTasks.reduce((a, t) => a + t.duration_minutes, 0)
    const total = r.cycleItems.reduce((a, c) => a + c.duration_minutes, 0)
    expect(total + fixed).toBeLessThanOrEqual(300)
    expect(r.cycleItems.every((c) => c.duration_minutes <= 30)).toBe(true)
    for (let wd = 0; wd < 7; wd++) {
      const day = [...r.dailyBlocks, ...r.recurringTasks].filter((b) => b.weekday === wd).reduce((a, b) => a + b.duration_minutes, 0)
      expect(day).toBeLessThanOrEqual(60)
    }
  })

  it('todo bloco proposto tem motivo, e ROUTINE_RULES segue o estilo de PLANNER_RULES', () => {
    const r = generateRoutine(input())
    const all = [...r.dailyBlocks, ...r.recurringTasks, ...r.cycleItems, ...r.milestones]
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((b) => typeof b.reason === 'string' && b.reason.trim().length > 0)).toBe(true)
    expect(Array.isArray(ROUTINE_RULES)).toBe(true)
    expect(Array.isArray(PLANNER_RULES)).toBe(true)
    expect(ROUTINE_RULES.length).toBeGreaterThan(0)
    expect(ROUTINE_RULES.every((t) => typeof t === 'string' && t.trim().length > 0)).toBe(true)
  })

  it('marcos: ignora os passados, ordena e liga ao pilar', () => {
    const r = generateRoutine(input())
    expect(r.milestones).toHaveLength(1)
    expect(r.milestones[0]).toMatchObject({ title: 'Prova de certificação', daysUntil: 18, pillarId: 'ce' })
    expect(r.planSubjects.find((s) => s.id === 's-ce')!.target_date).toBe('2026-11-20')
  })

  it('a configuração é aceita por generatePlan e não sobrepõe os blocos fixos', () => {
    const r = generateRoutine(input())
    expect(r.planConfig.subjectIds).toEqual(['s-ds', 's-an', 's-ce', 's-pb'])
    const plan = generatePlan(r.planConfig, r.planSubjects, r.range)
    expect(plan.length).toBeGreaterThan(0)
    const fixedByDay = new Map<number, Array<[number, number]>>()
    for (const b of [...r.dailyBlocks, ...r.recurringTasks]) {
      const s = hhmmToMinutes(b.start_time)
      fixedByDay.set(b.weekday, [...(fixedByDay.get(b.weekday) ?? []), [s, s + b.duration_minutes]])
    }
    const perDay = new Map<string, number>()
    const perWeek = new Map<string, number>()
    for (const p of plan) {
      expect(r.planConfig.subjectIds).toContain(p.subject_id)
      const s = hhmmToMinutes(p.start_time)
      const e = s + p.duration_minutes
      for (const [fs, fe] of fixedByDay.get(weekday(p.date)) ?? []) expect(e <= fs || s >= fe).toBe(true)
      perDay.set(p.date, (perDay.get(p.date) ?? 0) + p.duration_minutes)
      perWeek.set(startOfWeek(p.date), (perWeek.get(startOfWeek(p.date)) ?? 0) + p.duration_minutes)
    }
    for (const [date, min] of perDay) {
      const fixed = (fixedByDay.get(weekday(date)) ?? []).reduce((a, [s, e]) => a + e - s, 0)
      expect(min + fixed).toBeLessThanOrEqual(150)
    }
    for (const min of perWeek.values()) expect(min).toBeLessThanOrEqual(600 - 210)
  })

  it('limites apertados: dia cheio não elimina os outros dias do cronograma', () => {
    const base = input()
    const r = generateRoutine(input({ availability: { ...base.availability, dailyLimitMinutes: 60, weeklyLimitMinutes: 300 } }))
    // segunda fica cheia (inglês + LinkedIn = 60), os outros dias têm 30 min livres
    const li = r.recurringTasks[0]
    expect(li.weekday).toBe(1)
    expect(r.planConfig.availability[1]).toEqual([])
    expect(r.planConfig.subjectIds.length).toBeGreaterThan(0)
    const plan = generatePlan(r.planConfig, r.planSubjects, r.range)
    expect(plan.length).toBeGreaterThan(0)
    const fixedByDay = new Map<number, Array<[number, number]>>()
    for (const b of [...r.dailyBlocks, ...r.recurringTasks]) {
      const s = hhmmToMinutes(b.start_time)
      fixedByDay.set(b.weekday, [...(fixedByDay.get(b.weekday) ?? []), [s, s + b.duration_minutes]])
    }
    const fixedWeek = r.dailyBlocks.reduce((a, b) => a + b.duration_minutes, 0) + r.recurringTasks.reduce((a, t) => a + t.duration_minutes, 0)
    const perDay = new Map<string, number>()
    const perWeek = new Map<string, number>()
    for (const p of plan) {
      expect(weekday(p.date)).not.toBe(1)
      const s = hhmmToMinutes(p.start_time)
      const e = s + p.duration_minutes
      for (const [fs, fe] of fixedByDay.get(weekday(p.date)) ?? []) expect(e <= fs || s >= fe).toBe(true)
      perDay.set(p.date, (perDay.get(p.date) ?? 0) + p.duration_minutes)
      perWeek.set(startOfWeek(p.date), (perWeek.get(startOfWeek(p.date)) ?? 0) + p.duration_minutes)
    }
    for (const [date, min] of perDay) {
      const fixed = (fixedByDay.get(weekday(date)) ?? []).reduce((a, [s, e]) => a + e - s, 0)
      expect(min + fixed).toBeLessThanOrEqual(60)
    }
    for (const min of perWeek.values()) {
      expect(min).toBeGreaterThan(0)
      expect(min + fixedWeek).toBeLessThanOrEqual(300)
    }
  })

  it('sem folga semanal, o cronograma não recebe matérias', () => {
    const base = input()
    const r = generateRoutine(input({ availability: { ...base.availability, weeklyLimitMinutes: 210 } }))
    expect(r.cycleItems).toEqual([])
    expect(r.planConfig.subjectIds).toEqual([])
    expect(generatePlan(r.planConfig, r.planSubjects, r.range)).toEqual([])
  })
})
