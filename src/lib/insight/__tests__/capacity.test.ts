import { describe, expect, it } from 'vitest'
import { planVsDone, proposeCapacity } from '../capacity'
import { planItem, session, TODAY, TZ } from './fixtures'

// TODAY = qui 22/10/2026 → semana atual começa em 19/10. Semanas completas: 07/09 … 12/10.
describe('planejado × realizado', () => {
  it('sem blocos planejados: sem execução, com mensagem de orientação', () => {
    const r = planVsDone({ items: [], sessions: [], today: TODAY, tz: TZ })
    expect(r.execution).toBeNull()
    expect(r.weeks).toHaveLength(6)
    expect(r.message).toMatch(/Sem blocos planejados/)
  })

  it('execução 75%: plano 33% acima do ritmo; semana atual e remarcados ficam fora', () => {
    const items = [
      planItem('2026-10-12', '08:00', 240), // semana de 12/10
      planItem('2026-10-14', '08:00', 240, { status: 'missed' }),
      planItem('2026-10-15', '08:00', 120, { status: 'rescheduled' }),
      planItem('2026-10-20', '08:00', 600), // semana atual: ignorada
    ]
    const sessions = [session('2026-10-12T11:00:00Z', 360), session('2026-10-20T11:00:00Z', 60)]
    const r = planVsDone({ items, sessions, today: TODAY, tz: TZ })
    const w = r.weeks.find((x) => x.week === '2026-10-12')!
    expect(w).toEqual({ week: '2026-10-12', plannedMinutes: 480, doneMinutes: 360 })
    expect(r.execution).toBeCloseTo(0.75)
    expect(r.gapPercent).toBe(33)
    expect(r.message).toBe('Seu planejamento recente está aproximadamente 33% acima do seu ritmo realizado.')
  })

  it('nada estudado nas semanas planejadas', () => {
    const r = planVsDone({ items: [planItem('2026-10-13', '08:00', 60)], sessions: [], today: TODAY, tz: TZ })
    expect(r.execution).toBe(0)
    expect(r.gapPercent).toBeNull()
    expect(r.message).toMatch(/Nada foi estudado/)
  })

  it('estudando além do planejado', () => {
    const r = planVsDone({ items: [planItem('2026-10-13', '08:00', 60)], sessions: [session('2026-10-13T11:00:00Z', 120)], today: TODAY, tz: TZ })
    expect(r.message).toMatch(/além do que planeja/)
  })

  it('sessão que cruza a meia-noite conta no dia certo', () => {
    // Domingo 18/10 23:30 → segunda 19/10 00:30 (São Paulo): metade na semana de 12/10.
    const r = planVsDone({ items: [planItem('2026-10-12', '08:00', 60)], sessions: [session('2026-10-19T02:30:00Z', 60)], today: TODAY, tz: TZ })
    expect(r.weeks.find((x) => x.week === '2026-10-12')!.doneMinutes).toBe(30)
  })
})

describe('proposta de ajuste ao ritmo', () => {
  const items = [
    planItem('2026-10-21', '08:00', 60), // passado
    planItem(TODAY, '08:00', 60), // hoje, já passou do horário
    planItem(TODAY, '18:00', 60), // hoje, ainda vai acontecer
    planItem('2026-10-23', '08:00', 50),
    planItem('2026-10-24', '08:00', 20),
    planItem('2026-10-26', '08:00', 90, { status: 'done' }),
    planItem('2026-10-27', '08:00', 40, { status: 'partial' }),
  ]

  it('só encurta blocos futuros pendentes, em múltiplos de 5 e com mínimo de 15 min', () => {
    const p = proposeCapacity(items, 0.73, TODAY, 12 * 60)
    expect(p.changes.map((c) => [c.date, c.before, c.after])).toEqual([
      [TODAY, 60, 45],
      ['2026-10-23', 50, 35],
      ['2026-10-24', 20, 15],
    ])
    expect(p.weeks).toEqual([{ week: '2026-10-19', before: 130, after: 95 }])
  })

  it('fator limitado entre 30% e 100% (nunca aumenta blocos)', () => {
    expect(proposeCapacity(items, 0.05, TODAY, 600).factor).toBe(0.3)
    const up = proposeCapacity(items, 1.4, TODAY, 600)
    expect(up.factor).toBe(1)
    expect(up.changes).toEqual([])
  })
})
