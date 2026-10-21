import { describe, expect, it } from 'vitest'
import { activeSegments, advancePhase, netSeconds, netSecondsByDay, phaseStatus, pomodoroPhases, pausedSeconds } from '@/lib/timer/engine'
import type { TimerConfig } from '@/types/db'

const T0 = Date.parse('2026-10-20T10:00:00Z')
const iso = (offsetMin: number) => new Date(T0 + offsetMin * 60000).toISOString()

describe('tempo líquido', () => {
  it('desconta pausas fechadas e abertas', () => {
    const s = { started_at: iso(0), ended_at: null, adjustment_seconds: 0 }
    const pauses = [
      { started_at: iso(10), ended_at: iso(15), kind: 'pause' as const },
      { started_at: iso(50), ended_at: null, kind: 'pause' as const },
    ]
    const now = T0 + 60 * 60000
    // 60 min − 5 min − 10 min (pausa aberta até agora)
    expect(netSeconds(s, pauses, now)).toBe(45 * 60)
    expect(pausedSeconds(s, pauses, now)).toBe(15 * 60)
  })

  it('não avança durante a pausa (tempo congelado)', () => {
    const s = { started_at: iso(0), ended_at: null, adjustment_seconds: 0 }
    const pauses = [{ started_at: iso(20), ended_at: null, kind: 'pause' as const }]
    expect(netSeconds(s, pauses, T0 + 25 * 60000)).toBe(20 * 60)
    expect(netSeconds(s, pauses, T0 + 90 * 60000)).toBe(20 * 60)
  })

  it('não oscila durante a pausa por causa das frações de segundo (regressão)', () => {
    const s = { started_at: new Date(T0).toISOString(), ended_at: null, adjustment_seconds: 0 }
    const pauses = [{ started_at: new Date(T0 + 3950).toISOString(), ended_at: null, kind: 'pause' as const }]
    const seen = new Set([4000, 4600, 5050, 7020, 9990, 60000].map((dt) => netSeconds(s, pauses, T0 + dt)))
    expect([...seen]).toEqual([3])
  })

  it('é reconstruído só a partir de timestamps (retomada após recarregar)', () => {
    // Simula "recarregar a página": nenhuma variável em memória, apenas o que foi salvo.
    const saved = JSON.parse(
      JSON.stringify({
        session: { started_at: iso(0), ended_at: null, adjustment_seconds: 0 },
        pauses: [{ started_at: iso(5), ended_at: iso(7), kind: 'pause' }],
      }),
    )
    expect(netSeconds(saved.session, saved.pauses, T0 + 30 * 60000)).toBe(28 * 60)
  })

  it('aplica ajuste explícito e nunca fica negativo', () => {
    const s = { started_at: iso(0), ended_at: iso(10), adjustment_seconds: -3600 }
    expect(netSeconds(s, [], Date.now())).toBe(0)
    expect(netSeconds({ ...s, adjustment_seconds: 120 }, [], Date.now())).toBe(12 * 60)
  })

  it('pausas sobrepostas não são descontadas duas vezes', () => {
    const s = { started_at: iso(0), ended_at: iso(60), adjustment_seconds: 0 }
    const pauses = [
      { started_at: iso(10), ended_at: iso(30), kind: 'pause' as const },
      { started_at: iso(20), ended_at: iso(40), kind: 'break' as const },
    ]
    expect(netSeconds(s, pauses, 0)).toBe(30 * 60)
  })

  it('pausa aberta é limitada ao fim da sessão finalizada', () => {
    const s = { started_at: iso(0), ended_at: iso(60), adjustment_seconds: 0 }
    const pauses = [{ started_at: iso(50), ended_at: null, kind: 'pause' as const }]
    expect(netSeconds(s, pauses, T0 + 500 * 60000)).toBe(50 * 60)
  })

  it('segmentos ativos excluem pausas', () => {
    const s = { started_at: iso(0), ended_at: iso(30), adjustment_seconds: 0 }
    const segs = activeSegments(s, [{ started_at: iso(10), ended_at: iso(20), kind: 'pause' }])
    expect(segs).toEqual([
      [T0, T0 + 10 * 60000],
      [T0 + 20 * 60000, T0 + 30 * 60000],
    ])
  })
})

describe('distribuição por dia', () => {
  it('divide sessões que atravessam a meia-noite no fuso do usuário', () => {
    // 23:30 → 00:45 em São Paulo (UTC−3), sem pausas
    const s = { started_at: '2026-10-21T02:30:00Z', ended_at: '2026-10-21T03:45:00Z', adjustment_seconds: 0, pauses: [] }
    const map = netSecondsByDay([s], 'America/Sao_Paulo')
    expect(map.get('2026-10-20')).toBe(30 * 60)
    expect(map.get('2026-10-21')).toBe(45 * 60)
  })

  it('a soma por dia é igual ao tempo líquido total', () => {
    const s = {
      started_at: '2026-10-21T02:00:00Z',
      ended_at: '2026-10-21T05:00:10Z',
      adjustment_seconds: -600,
      pauses: [{ started_at: '2026-10-21T02:50:00Z', ended_at: '2026-10-21T03:20:00Z', kind: 'pause' as const }],
    }
    const map = netSecondsByDay([s], 'America/Sao_Paulo')
    const sum = [...map.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(netSeconds(s, s.pauses))
  })
})

describe('fases (temporizador e pomodoro)', () => {
  const config: TimerConfig = { phases: pomodoroPhases({ focus: 25, shortBreak: 5, longBreak: 15, rounds: 2 }), repeat: true }

  it('gera focos e pausas alternadas com pausa longa ao final', () => {
    expect(config.phases.map((p) => `${p.kind}:${p.seconds / 60}`)).toEqual(['focus:25', 'break:5', 'focus:25', 'break:15'])
  })

  it('sinaliza fim do foco apenas uma vez (reconhecimento)', () => {
    const state = { phaseIndex: 0, phaseStartedAt: T0, phaseNetStart: 0, ackPhase: -1 }
    const s = { started_at: iso(0), ended_at: null, adjustment_seconds: 0, timer_config: config, timer_state: state }
    expect(phaseStatus(s, [], T0 + 10 * 60000).due).toBe(false)
    const st = phaseStatus(s, [], T0 + 26 * 60000)
    expect(st.due).toBe(true)
    expect(st.overtime).toBe(60)
    const acked = { ...s, timer_state: { ...state, ackPhase: 0 } }
    expect(phaseStatus(acked, [], T0 + 26 * 60000).due).toBe(false)
  })

  it('pausa manual não consome o tempo de foco', () => {
    const state = { phaseIndex: 0, phaseStartedAt: T0, phaseNetStart: 0, ackPhase: -1 }
    const s = { started_at: iso(0), ended_at: null, adjustment_seconds: 0, timer_config: config, timer_state: state }
    const st = phaseStatus(s, [{ started_at: iso(10), ended_at: null, kind: 'pause' }], T0 + 40 * 60000)
    expect(st.elapsed).toBe(10 * 60)
    expect(st.remaining).toBe(15 * 60)
  })

  it('a pausa programada é medida em relógio de parede e não conta como estudo', () => {
    const net = 25 * 60
    const state = advancePhase({ phaseIndex: 0, phaseStartedAt: T0, phaseNetStart: 0, ackPhase: -1 }, net, T0 + 25 * 60000)
    const s = { started_at: iso(0), ended_at: null, adjustment_seconds: 0, timer_config: config, timer_state: state }
    const pauses = [{ started_at: iso(25), ended_at: null, kind: 'break' as const }]
    const st = phaseStatus(s, pauses, T0 + 28 * 60000)
    expect(st.phase?.kind).toBe('break')
    expect(st.elapsed).toBe(3 * 60)
    expect(netSeconds(s, pauses, T0 + 28 * 60000)).toBe(25 * 60)
  })
})
