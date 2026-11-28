import { describe, expect, it } from 'vitest'
import type { SessionWithPauses } from '@/lib/data/types'
import { buildEvolution, evolutionDailyRows, evolutionDocument, evolutionSummaryRows, type EvolutionInput } from '../evolutionModel'

/** Sessão concluída começando às 9h (horário de Brasília). */
function session(day: string, minutes: number, subject: string): SessionWithPauses {
  const start = new Date(`${day}T12:00:00Z`).getTime()
  return { id: `${day}-${subject}`, started_at: new Date(start).toISOString(), ended_at: new Date(start + minutes * 60000).toISOString(), adjustment_seconds: 0, status: 'completed', subject_id: subject, topic_id: null, activity_type: 'theory', pauses: [] } as unknown as SessionWithPauses
}

const WEEK = { from: '2026-11-16', to: '2026-11-22' }
const input: EvolutionInput = {
  kind: 'week',
  range: WEEK,
  today: '2026-11-30',
  timezone: 'America/Sao_Paulo',
  sessions: [session('2026-11-16', 60, 'sql'), session('2026-11-17', 120, 'py'), session('2026-11-10', 90, 'sql')],
  planItems: [
    { date: '2026-11-16', duration_minutes: 240, subject_id: 'sql', status: 'done' },
    { date: '2026-11-10', duration_minutes: 60, subject_id: 'sql', status: 'done' },
  ],
  tasks: [
    { date: '2026-11-16', duration_minutes: null, subject_id: null, topic_id: null, category: 'pessoal', done: true },
    { date: '2026-11-17', duration_minutes: null, subject_id: null, topic_id: null, category: 'pessoal', done: false },
  ],
  topics: [
    { id: 'join', name: 'JOIN', subject_id: 'sql', completed_at: null },
    { id: 'pandas', name: 'Pandas', subject_id: 'py', completed_at: '2026-11-18T15:00:00Z' },
  ],
  subjects: [
    { id: 'sql', name: 'SQL' },
    { id: 'py', name: 'Python' },
  ],
  goals: [],
  flashcardReviews: [],
}

describe('modelo da tela Evolução', () => {
  const m = buildEvolution(input)
  const row = (key: string) => m.comparison.find((r) => r.key === key)!

  it('compara com o período anterior equivalente, sem inventar percentuais', () => {
    expect(m.previous).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(m.inProgress).toBe(false)
    expect(m.hours).toMatchObject({ actual: 3 * 3600, planned: 4 * 3600, percent: 75 })
    expect(row('hours')).toMatchObject({ current: '3h 00min', previous: '1h 30min', change: '+1h 30min (+100%)', direction: 'up' })
    expect(row('percent')).toMatchObject({ current: '75%', previous: '150%', change: '-75 p.p.', direction: 'down' })
    expect(row('tasks')).toMatchObject({ current: '1 de 2 (50%)', previous: 'Nenhuma atividade', change: '—', direction: 'none' })
    expect(row('topics')).toMatchObject({ current: '1', previous: '0', change: '+1 (sem base anterior)' })
  })

  it('distribui tempo, atividades e constância no período', () => {
    expect(m.series).toHaveLength(7)
    expect(m.series[0]).toMatchObject({ plannedHours: 4, actualHours: 1, tasks: 1, tasksDone: 1 })
    expect(m.subjects.map((s) => [s.name, s.actualSeconds, s.plannedSeconds, s.previousSeconds])).toEqual([
      ['Python', 7200, 0, 0],
      ['SQL', 3600, 14400, 5400],
    ])
    expect(m.consistency).toMatchObject({ studied: 2, elapsed: 7, longest: 2 })
  })

  it('um único dia mostra os sete dias que terminam nele', () => {
    const day = buildEvolution({ ...input, kind: 'day', range: { from: '2026-11-17', to: '2026-11-17' } })
    expect(day.series.map((p) => p.from)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'])
    expect(day.previous).toEqual({ from: '2026-11-16', to: '2026-11-16' })
  })

  it('CSV e PDF usam os mesmos números da tela', () => {
    const summary = evolutionSummaryRows(m)
    expect(summary[0]).toEqual({ grupo: 'Comparação', indicador: 'Horas estudadas (líquidas)', periodo_atual: '3h 00min', periodo_anterior: '1h 30min', variacao: '+1h 30min (+100%)' })
    expect(summary.some((r) => /questões|acerto/i.test(String(r.indicador)))).toBe(false)
    const daily = evolutionDailyRows(input, WEEK)
    expect(daily).toHaveLength(7)
    expect(daily[1]).toEqual({ data: '2026-11-17', planejado_min: 0, realizado_min: 120, atividades: 1, atividades_concluidas: 0 })
    const doc = evolutionDocument(m, '16/11 – 22/11')
    expect(doc.subtitle).toBe('Período: 16/11 – 22/11')
    const tables = doc.blocks.filter((b) => b.type === 'table')
    expect(tables[0]).toMatchObject({ columns: ['Indicador', 'Período atual', 'Período anterior', 'Variação'] })
    // A última tabela lista só os dias com registro.
    expect(tables[tables.length - 1].type === 'table' && tables[tables.length - 1].rows).toHaveLength(2)
  })
})
