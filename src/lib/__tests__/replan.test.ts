import { describe, expect, it } from 'vitest'
import { activityConflicts, durationInsights, isOverdue, replanWeek, type PlanActivity, type ReplanOptions } from '../replan'
import { parseQuickTask } from '../quickAdd'
import { occurrenceDates } from '../tasks'

// Semana de 23/11/2026 (segunda) a 29/11/2026 (domingo).
const MON = '2026-11-23'
const TUE = '2026-11-24'
const WED = '2026-11-25'
const THU = '2026-11-26'
const FRI = '2026-11-27'
const SUN = '2026-11-29'

let seq = 0
function act(p: Partial<PlanActivity> & Pick<PlanActivity, 'title' | 'date'>): PlanActivity {
  const id = `task:${++seq}`
  return { id, source: 'task', refId: String(seq), start: 19 * 60, duration: 60, done: false, fixed: false, study: true, priority: 2, due: null, subjectId: null, topicId: null, recurring: false, ...p }
}
const opts = (o: Partial<ReplanOptions> = {}): ReplanOptions => ({ today: WED, nowMinutes: 8 * 60, horizonEnd: SUN, ...o })

describe('replanWeek', () => {
  it('exemplo do usuário: Python não feito na terça ganha um novo horário livre, sem tocar no resto', () => {
    const sql1 = act({ title: 'SQL', date: MON, done: true })
    const python = act({ title: 'Python', date: TUE })
    const ml = act({ title: 'Machine Learning', date: WED })
    const ingles = act({ title: 'Inglês', date: THU, duration: 30 })
    const sql2 = act({ title: 'SQL', date: FRI })
    const r = replanWeek([sql1, python, ml, ingles, sql2], opts())
    expect(r.overdue.map((a) => a.title)).toEqual(['Python'])
    expect(r.moves).toHaveLength(1)
    const move = r.moves[0]
    expect(move.activity.id).toBe(python.id)
    // quarta 19:00 está ocupada por ML: o mesmo horário (19:00) não serve hoje; encaixa em outro horário livre de quarta
    expect(move.toDate).toBe(WED)
    expect(move.toStart).not.toBe(19 * 60)
    expect(r.unplaced).toEqual([])
    // nada concluído é movido
    expect(r.moves.some((m) => m.activity.done)).toBe(false)
  })

  it('prefere o mesmo horário no próximo dia em que ele está livre quando a janela preferida é só esse horário', () => {
    const python = act({ title: 'Python', date: TUE })
    const ml = act({ title: 'ML', date: WED })
    const r = replanWeek([python, ml], opts({ availability: { 0: [], 1: [{ start: '19:00', end: '20:00' }], 2: [{ start: '19:00', end: '20:00' }], 3: [{ start: '19:00', end: '20:00' }], 4: [{ start: '19:00', end: '20:00' }], 5: [{ start: '19:00', end: '20:00' }], 6: [] } }))
    expect(r.moves[0]).toMatchObject({ toDate: THU, toStart: 19 * 60 })
  })

  it('não sobrepõe compromissos e não move compromissos fixos nem tarefas concluídas', () => {
    const fixedLate = act({ title: 'Dentista', date: TUE, fixed: true, study: false })
    const late = act({ title: 'Python', date: TUE })
    const meeting = act({ title: 'Reunião', date: WED, start: 9 * 60, duration: 600, study: false, fixed: true })
    const done = act({ title: 'SQL', date: MON, done: true })
    const r = replanWeek([fixedLate, late, meeting, done], opts())
    expect(r.unplaced.map((u) => u.activity.title)).toEqual(['Dentista'])
    const move = r.moves.find((m) => m.activity.id === late.id)!
    // a reunião ocupa 09:00–19:00 de quarta: o novo horário não pode cair dentro dela
    const end = move.toStart! + 60
    expect(move.toDate === WED && move.toStart! < 19 * 60 && end > 9 * 60).toBe(false)
    expect(r.moves.some((m) => m.activity.id === done.id || m.activity.id === fixedLate.id)).toBe(false)
  })

  it('informa quando não há espaço, sem inventar horário', () => {
    const late = act({ title: 'Python', date: TUE, duration: 120 })
    const busy = [WED, THU, FRI, '2026-11-28', SUN].map((d) => act({ title: 'Ocupado', date: d, start: 6 * 60, duration: 17 * 60, study: false, fixed: true }))
    const r = replanWeek([late, ...busy], opts())
    expect(r.moves).toEqual([])
    expect(r.unplaced).toHaveLength(1)
    expect(r.unplaced[0].reason).toMatch(/Não há horário livre/)
  })

  it('respeita o limite diário de estudo e o prazo', () => {
    const a = act({ title: 'A', date: MON, duration: 120 })
    const b = act({ title: 'B', date: MON, start: 20 * 60, duration: 120 })
    const r = replanWeek([a, b], opts({ dailyStudyLimitMinutes: 120 }))
    expect(new Set(r.moves.map((m) => m.toDate)).size).toBe(2)
    const due = act({ title: 'Com prazo', date: MON, due: TUE })
    expect(replanWeek([due], opts()).unplaced[0].reason).toMatch(/prazo/)
  })

  it('prioridade alta é encaixada primeiro e a ordem dos tópicos (dependência) é preservada', () => {
    const low = act({ title: 'Baixa', date: MON, priority: 1, start: 19 * 60 })
    const high = act({ title: 'Alta', date: TUE, priority: 3, start: 19 * 60 })
    const r = replanWeek([low, high], opts({ nowMinutes: 18 * 60, availability: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ start: '19:00', end: '20:00' }]])) }))
    expect(r.moves.find((m) => m.activity.title === 'Alta')!.toDate).toBe(WED)
    expect(r.moves.find((m) => m.activity.title === 'Baixa')!.toDate).toBe(THU)

    const cte = act({ title: 'CTE', date: MON, subjectId: 'sql', topicId: 'cte' })
    const join = act({ title: 'JOIN', date: TUE, subjectId: 'sql', topicId: 'join' })
    const order = new Map([
      ['join', 4],
      ['cte', 7],
    ])
    const r2 = replanWeek([cte, join], opts({ topicOrder: order }))
    const at = (title: string) => {
      const m = r2.moves.find((x) => x.activity.title === title)!
      return `${m.toDate} ${String(m.toStart).padStart(4, '0')}`
    }
    expect(at('JOIN') < at('CTE')).toBe(true)
  })

  it('tarefa sem horário só muda de dia; recorrente que não é estudo fica como está', () => {
    const untimed = act({ title: 'Pagar conta', date: MON, start: null, duration: null, study: false })
    const gym = act({ title: 'Academia', date: TUE, recurring: true, study: false })
    const r = replanWeek([untimed, gym], opts())
    expect(r.moves).toEqual([expect.objectContaining({ toDate: WED, toStart: null })])
    expect(r.unplaced[0].reason).toMatch(/recorrente/)
  })

  it('lista conflitos existentes em vez de escondê-los', () => {
    const a = act({ title: 'A', date: THU, start: 600, duration: 60 })
    const b = act({ title: 'B', date: THU, start: 630, duration: 60 })
    expect(activityConflicts([a, b])).toHaveLength(1)
    expect(replanWeek([a, b], opts()).conflicts).toHaveLength(1)
  })

  it('isOverdue: hoje só conta depois que o horário terminou', () => {
    const a = act({ title: 'A', date: WED, start: 600, duration: 60 })
    expect(isOverdue(a, WED, 630)).toBe(false)
    expect(isOverdue(a, WED, 660)).toBe(true)
    expect(isOverdue({ ...a, done: true }, WED, 900)).toBe(false)
  })
})

describe('durationInsights', () => {
  it('sugere revisar a duração só com amostra suficiente e diferença consistente', () => {
    const s = (planned: number, actual: number, key = 'sql') => ({ key, label: 'SQL', plannedMinutes: planned, actualMinutes: actual })
    expect(durationInsights([s(30, 50), s(30, 48)])).toEqual([])
    expect(durationInsights([s(30, 50), s(30, 48), s(30, 55)])).toEqual([expect.objectContaining({ key: 'sql', samples: 3, plannedMinutes: 30, suggestedMinutes: 50 })])
    expect(durationInsights([s(60, 62), s(60, 58), s(60, 61)])).toEqual([])
  })
})

describe('parseQuickTask', () => {
  it('aceita só o título', () => {
    expect(parseQuickTask('  Estudar JOIN  ')).toEqual({ title: 'Estudar JOIN', start_time: null, duration_minutes: null })
  })
  it('aproveita horário no começo e duração no fim', () => {
    expect(parseQuickTask('19h Python 1h')).toEqual({ title: 'Python', start_time: '19:00', duration_minutes: 60 })
    expect(parseQuickTask('7:30 Inglês 20min')).toEqual({ title: 'Inglês', start_time: '07:30', duration_minutes: 20 })
    expect(parseQuickTask('SQL 1h30')).toEqual({ title: 'SQL', start_time: null, duration_minutes: 90 })
  })
  it('não confunde títulos comuns com horário ou duração', () => {
    expect(parseQuickTask('Revisar capítulo 3').title).toBe('Revisar capítulo 3')
    expect(parseQuickTask('1h')).toEqual({ title: '1h', start_time: null, duration_minutes: null })
    expect(parseQuickTask('25h de curso').start_time).toBeNull()
  })
})

describe('occurrenceDates', () => {
  it('gera as ocorrências semanais nos dias escolhidos até o limite', () => {
    expect(occurrenceDates({ freq: 'weekly', days: [1, 3], until: '2026-12-02' }, MON)).toEqual(['2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02'])
    expect(occurrenceDates({ freq: 'daily' }, MON, 3)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25'])
  })
})
