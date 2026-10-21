import { describe, expect, it } from 'vitest'
import { applyStudy, skip, summarize } from '@/lib/cycle'
import { DEFAULT_SRS, masteryLevel, reviewPriority, schedule, type CardSchedule } from '@/lib/srs'
import { defaultPlanConfig, diffPlan, findConflicts, generatePlan, replanLate, subtractIntervals } from '@/lib/planner'
import { addDays, dayKey, periodRange, startOfWeek, weekday, zonedDayStart } from '@/lib/time'
import type { StudyCycleItem } from '@/types/db'

function item(id: string, order: number, minutes: number): StudyCycleItem {
  return {
    id,
    user_id: 'u',
    cycle_id: 'c',
    subject_id: 's' + id,
    topic_id: null,
    duration_minutes: minutes,
    sort_order: order,
    weight: 1,
    break_minutes: 0,
    activity_type: 'theory',
    created_at: '',
    updated_at: '',
  }
}

describe('ciclo de estudos', () => {
  const items = [item('a', 0, 60), item('b', 1, 30), item('c', 2, 45)]
  const base = { current_index: 0, current_progress_seconds: 0, completed_rounds: 0, auto_advance: true }

  it('avança quando o bloco é concluído', () => {
    const r = applyStudy(base, items, 'a', 60 * 60)
    expect(r.completedBlock).toBe(true)
    expect(r.progress).toEqual({ current_index: 1, current_progress_seconds: 0, completed_rounds: 0 })
  })

  it('execução parcial mantém a posição e acumula o tempo (retomar)', () => {
    const r1 = applyStudy(base, items, 'a', 20 * 60)
    expect(r1.progress.current_index).toBe(0)
    expect(r1.progress.current_progress_seconds).toBe(20 * 60)
    expect(r1.remainingSeconds).toBe(40 * 60)
    const r2 = applyStudy({ ...base, ...r1.progress }, items, 'a', 40 * 60)
    expect(r2.progress.current_index).toBe(1)
  })

  it('execução parcial pode avançar se o usuário decidir', () => {
    const r = applyStudy(base, items, 'a', 10 * 60, 'advance')
    expect(r.advanced).toBe(true)
    expect(r.progress.current_index).toBe(1)
  })

  it('dias sem estudo não mudam a posição; sessão de outro bloco não move o ciclo', () => {
    const r = applyStudy(base, items, 'c', 3600)
    expect(r.progress).toEqual({ current_index: 0, current_progress_seconds: 0, completed_rounds: 0 })
  })

  it('completa uma volta ao passar do último bloco', () => {
    const r = applyStudy({ ...base, current_index: 2 }, items, 'c', 45 * 60)
    expect(r.progress).toEqual({ current_index: 0, current_progress_seconds: 0, completed_rounds: 1 })
  })

  it('sem avanço automático, permanece no bloco concluído', () => {
    const r = applyStudy({ ...base, auto_advance: false }, items, 'a', 70 * 60)
    expect(r.completedBlock).toBe(true)
    expect(r.progress.current_index).toBe(0)
  })

  it('pular e voltar manualmente', () => {
    expect(skip(base, 3, 1).current_index).toBe(1)
    expect(skip(base, 3, -1)).toEqual({ current_index: 2, current_progress_seconds: 0, completed_rounds: 0 })
  })

  it('resumo informa posição, próxima matéria e percentuais', () => {
    const s = summarize({ current_index: 1, current_progress_seconds: 15 * 60, completed_rounds: 0 }, items)
    expect(s.position).toBe(2)
    expect(s.next?.id).toBe('c')
    expect(s.blockPercent).toBe(50)
    expect(Math.round(s.roundPercent)).toBe(Math.round(((60 + 15) / 135) * 100))
    expect(s.pending.map((i) => i.id)).toEqual(['b', 'c'])
  })
})

describe('repetição espaçada', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const fresh = { status: 'new' as const, ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: new Date(now).toISOString() }

  it('progressão com "Bom": 1 → 6 → 15 dias', () => {
    const a = schedule(fresh, 3, now)
    expect(a.interval_days).toBe(1)
    const b = schedule(a, 3, now)
    expect(b.interval_days).toBe(6)
    const c = schedule(b, 3, now)
    expect(c.interval_days).toBe(15)
  })

  it('"Errei" volta ao aprendizado, reduz facilidade e conta lapso', () => {
    const rev = { ...fresh, status: 'review' as const, interval_days: 10, repetitions: 3 }
    const r = schedule(rev, 1, now)
    expect(r.status).toBe('learning')
    expect(r.repetitions).toBe(0)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBeCloseTo(2.3)
    expect(new Date(r.due_at).getTime() - now).toBe(DEFAULT_SRS.relearnMinutes * 60000)
  })

  it('intervalos crescem em ordem Difícil ≤ Bom < Fácil', () => {
    const rev = { ...fresh, status: 'review' as const, interval_days: 10, repetitions: 3 }
    const h = schedule(rev, 2, now).interval_days
    const g = schedule(rev, 3, now).interval_days
    const e = schedule(rev, 4, now).interval_days
    expect(h).toBeLessThanOrEqual(g)
    expect(g).toBeLessThan(e)
  })

  it('facilidade respeita o mínimo configurado', () => {
    let c: CardSchedule = { ...fresh }
    for (let i = 0; i < 20; i++) c = { ...c, ...schedule(c, 1, now) }
    expect(c.ease).toBe(DEFAULT_SRS.minEase)
  })

  it('prioriza vencidos mais antigos e mais difíceis', () => {
    const cards = [
      { id: 1, due_at: '2026-10-19T00:00:00Z', ease: 2.5, lapses: 0 },
      { id: 2, due_at: '2026-10-10T00:00:00Z', ease: 2.5, lapses: 0 },
      { id: 3, due_at: '2026-10-19T00:00:00Z', ease: 1.5, lapses: 3 },
    ]
    expect(reviewPriority(cards).map((c) => c.id)).toEqual([2, 3, 1])
  })

  it('nível de domínio derivado do intervalo', () => {
    expect(masteryLevel({ status: 'new', interval_days: 0, repetitions: 0 })).toBe(0)
    expect(masteryLevel({ status: 'review', interval_days: 90, repetitions: 6 })).toBe(5)
  })
})

describe('planejamento automático', () => {
  const subjects = [
    { id: 'port', priority: 5, difficulty: 3, target_date: null, weekly_goal_hours: null },
    { id: 'info', priority: 2, difficulty: 2, target_date: null, weekly_goal_hours: null },
  ]

  it('respeita disponibilidade, compromissos e não sobrepõe blocos', () => {
    const cfg = { ...defaultPlanConfig(), subjectIds: ['port', 'info'] }
    cfg.availability = { 0: [], 1: [{ start: '19:00', end: '22:00' }], 2: [], 3: [], 4: [], 5: [], 6: [] }
    cfg.commitments = { 0: [], 1: [{ start: '20:00', end: '20:30' }], 2: [], 3: [], 4: [], 5: [], 6: [] }
    const monday = '2026-10-19'
    expect(weekday(monday)).toBe(1)
    const plan = generatePlan(cfg, subjects, { from: monday, to: addDays(monday, 6) })
    expect(plan.every((b) => b.date === monday)).toBe(true)
    // 19:00–20:00 → um bloco de 50; 20:30–22:00 → 50 + (sobra de 30 ≥ 25) 30
    expect(plan.map((b) => `${b.start_time}/${b.duration_minutes}`)).toEqual(['19:00/50', '20:30/50', '21:30/30'])
    expect(findConflicts(plan)).toHaveLength(0)
  })

  it('distribui proporcionalmente ao peso e limita blocos seguidos', () => {
    const cfg = { ...defaultPlanConfig(), subjectIds: ['port', 'info'] }
    const plan = generatePlan(cfg, subjects, { from: '2026-10-19', to: '2026-11-15' })
    const port = plan.filter((b) => b.subject_id === 'port').reduce((a, b) => a + b.duration_minutes, 0)
    const info = plan.filter((b) => b.subject_id === 'info').reduce((a, b) => a + b.duration_minutes, 0)
    expect(port).toBeGreaterThan(info)
    for (let i = 2; i < plan.length; i++) {
      const same = [plan[i], plan[i - 1], plan[i - 2]]
      if (same.every((b) => b.date === plan[i].date && b.subject_id === plan[i].subject_id)) {
        throw new Error('mais de dois blocos seguidos da mesma matéria')
      }
    }
  })

  it('respeita o limite de horas por dia', () => {
    const cfg = { ...defaultPlanConfig(), subjectIds: ['port'], dailyHoursGoal: 1 }
    const plan = generatePlan(cfg, subjects, { from: '2026-10-19', to: '2026-10-19' })
    expect(plan.reduce((a, b) => a + b.duration_minutes, 0)).toBeLessThanOrEqual(60)
  })

  it('subtrai intervalos corretamente', () => {
    expect(subtractIntervals([[0, 100]], [[20, 30], [50, 120]])).toEqual([
      [0, 20],
      [30, 50],
    ])
  })

  it('diff da proposta considera apenas itens pendentes substituíveis', () => {
    const existing = [
      { subject_id: 'port', duration_minutes: 50, status: 'pending' as const, date: '2026-10-19', start_time: '19:00' },
      { subject_id: 'info', duration_minutes: 50, status: 'done' as const, date: '2026-10-19', start_time: '20:00' },
    ]
    const d = diffPlan(existing, [{ subject_id: 'port', duration_minutes: 50, date: '2026-10-19', start_time: '19:00', activity_type: 'theory' }, { subject_id: 'info', duration_minutes: 50, date: '2026-10-20', start_time: '19:00', activity_type: 'theory' }])
    expect(d.kept).toBe(1)
    expect(d.added).toBe(1)
    expect(d.removed).toBe(0)
  })
})

describe('replanejar atrasados', () => {
  const late = [
    { id: 'a', date: '2026-10-19', start_time: '19:00', duration_minutes: 60 },
    { id: 'b', date: '2026-10-20', start_time: '08:00', duration_minutes: 30 },
  ]
  it('move para hoje se o horário ainda não passou, senão para o próximo dia livre', () => {
    // Hoje 21/10, agora 12:00 → 'a' (19:00) cabe hoje; 'b' (08:00) já passou → amanhã.
    const r = replanLate(late, [], '2026-10-21', 12 * 60)
    expect(r).toEqual([
      { id: 'a', date: '2026-10-21' },
      { id: 'b', date: '2026-10-22' },
    ])
  })
  it('não sobrepõe blocos existentes nem os já remanejados', () => {
    const busy = [{ date: '2026-10-21', start_time: '18:30', duration_minutes: 60 }]
    const two = [late[0], { ...late[0], id: 'c' }]
    const r = replanLate(two, busy, '2026-10-21', 12 * 60)
    expect(r).toEqual([
      { id: 'a', date: '2026-10-22' },
      { id: 'c', date: '2026-10-23' },
    ])
  })
  it('respeita a disponibilidade do cronograma', () => {
    const availability = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [{ start: '18:00', end: '22:00' }] }
    const r = replanLate([late[0]], [], '2026-10-21', 0, availability)
    expect(r).toEqual([{ id: 'a', date: '2026-10-24' }]) // sábado
  })
})

describe('datas e fusos', () => {
  it('chave do dia respeita o fuso', () => {
    const ms = Date.parse('2026-10-21T01:00:00Z')
    expect(dayKey(ms, 'America/Sao_Paulo')).toBe('2026-10-20')
    expect(dayKey(ms, 'UTC')).toBe('2026-10-21')
  })

  it('início do dia no fuso', () => {
    expect(new Date(zonedDayStart('2026-10-20', 'America/Sao_Paulo')).toISOString()).toBe('2026-10-20T03:00:00.000Z')
  })

  it('semana começa na segunda e mês completo', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19')
    expect(periodRange('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange('week', '2026-10-21')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })
})
