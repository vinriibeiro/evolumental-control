import { describe, expect, it } from 'vitest'
import { WEEKLY_THRESHOLDS, buildWeeklyReport, weekHeadline, weeklyReportCsvRows, weeklyReportDocument, type WeeklyReportInput, type WeeklyTask } from '@/lib/weeklyReport'
import type { SessionWithPauses } from '@/lib/data/types'
import type { StudyGoal } from '@/types/db'

const TZ = 'America/Sao_Paulo'
// Segunda 16/11/2026 a domingo 22/11/2026.
const WEEK = { from: '2026-11-16', to: '2026-11-22' }

/** Sessão concluída começando às 9h (horário de Brasília) do dia informado. */
function session(day: string, minutes: number, subject: string | null = 'sql'): SessionWithPauses {
  const start = new Date(`${day}T12:00:00Z`).getTime()
  return { id: `${day}-${subject}-${minutes}`, started_at: new Date(start).toISOString(), ended_at: new Date(start + minutes * 60000).toISOString(), adjustment_seconds: 0, status: 'completed', subject_id: subject, topic_id: null, activity_type: 'theory', pauses: [] } as unknown as SessionWithPauses
}
const block = (date: string, minutes: number, subject: string | null = 'sql', status: 'pending' | 'done' | 'partial' | 'missed' | 'rescheduled' = 'done') => ({ date, duration_minutes: minutes, subject_id: subject, status })
const task = (title: string, date: string, extra: Partial<WeeklyTask> = {}): WeeklyTask => ({ title, date, duration_minutes: null, subject_id: null, topic_id: null, category: 'pessoal', done: false, done_at: null, priority: 2, ...extra })

const base: WeeklyReportInput = {
  week: WEEK,
  timezone: TZ,
  sessions: [],
  tasks: [],
  planItems: [],
  topics: [
    { id: 'join', name: 'JOIN', subject_id: 'sql', completed_at: null },
    { id: 'pandas', name: 'Pandas', subject_id: 'py', completed_at: null },
  ],
  goals: [],
  subjects: [
    { id: 'sql', name: 'SQL' },
    { id: 'py', name: 'Python' },
  ],
}
const report = (over: Partial<WeeklyReportInput>) => buildWeeklyReport({ ...base, ...over })
const section = (r: ReturnType<typeof report>, key: string) => r.sections.find((s) => s.key === key)!
const ids = (r: ReturnType<typeof report>, key: string) => section(r, key).statements.map((s) => s.id)
const rules = (r: ReturnType<typeof report>) => r.recommendations.map((x) => x.ruleId)

describe('relatório semanal por regras', () => {
  it('responde às cinco perguntas na ordem pedida', () => {
    expect(report({}).sections.map((s) => s.question)).toEqual([
      'O que eu planejei?',
      'O que realmente executei?',
      'Onde avancei?',
      'Onde fiquei para trás?',
      'O que devo priorizar na próxima semana?',
    ])
  })

  it('semana vazia: diz que não há dados e não inventa números', () => {
    const r = report({})
    expect(r.hasData).toBe(false)
    expect(r.totals).toMatchObject({ plannedSeconds: 0, actualSeconds: 0, plannedPercent: null, tasksTotal: 0, tasksLate: 0 })
    expect(section(r, 'planned').statements.map((s) => s.text).join(' ')).toMatch(/Nenhuma hora de estudo foi planejada/)
    expect(section(r, 'executed').statements.map((s) => s.text).join(' ')).toMatch(/Nenhuma sessão de estudo concluída/)
    expect(section(r, 'advanced').statements).toEqual([])
    expect(section(r, 'behind').statements).toEqual([])
    // Sem dados, a única sugestão possível é planejar a semana.
    expect(rules(r)).toEqual(['noPlan'])
    expect(weekHeadline(r)).toBe('Semana de 16/11 a 22/11: nada planejado nem registrado.')
  })

  it('separa dados de sugestões: as quatro primeiras seções só têm dados; a última, só sugestões com a regra', () => {
    const r = report({
      planItems: [block('2026-11-16', 240, 'sql'), block('2026-11-17', 120, 'py')],
      sessions: [session('2026-11-16', 60, 'sql'), session('2026-11-17', 120, 'py')],
      tasks: [task('Enviar relatório', '2026-11-18', { priority: 3 })],
    })
    const facts = r.sections.slice(0, 4).flatMap((s) => s.statements)
    expect(facts.length).toBeGreaterThan(5)
    expect(facts.every((s) => s.kind === 'fact')).toBe(true)
    const next = section(r, 'next').statements
    expect(next.length).toBeGreaterThan(0)
    expect(next).toEqual(r.recommendations)
    const factIds = new Set(facts.map((f) => f.id))
    for (const rec of r.recommendations) {
      expect(rec.kind).toBe('recommendation')
      expect(rec.rule).toMatch(/^Regra: /)
      // Toda sugestão aponta para dados que existem no próprio relatório.
      expect(rec.basedOn.length).toBeGreaterThan(0)
      expect(rec.basedOn.every((id) => factIds.has(id))).toBe(true)
    }
  })

  it('matéria abaixo de 50% do planejado vira prioridade; a que cumpriu o plano aparece como avanço', () => {
    const r = report({
      planItems: [block('2026-11-16', 120, 'sql'), block('2026-11-17', 120, 'sql', 'missed'), block('2026-11-18', 120, 'py'), block('2026-11-20', 60, 'sql', 'rescheduled')],
      sessions: [session('2026-11-16', 60, 'sql'), session('2026-11-18', 130, 'py')],
    })
    expect(r.totals.plannedSeconds).toBe(6 * 3600) // o bloco remarcado não conta
    expect(r.totals.actualSeconds).toBe(190 * 60)
    expect(Math.round(r.totals.plannedPercent!)).toBe(53)
    const behind = section(r, 'behind').statements.find((s) => s.id === 'behind.subjects')!
    expect(behind.text).toContain('SQL — 1h 00min de 4h 00min (25%)')
    expect(behind.text).not.toContain('Python')
    expect(section(r, 'advanced').statements.find((s) => s.id === 'advanced.subjects')!.text).toContain('Python (2h 10min de 2h 00min)')
    const rec = r.recommendations.find((x) => x.ruleId === 'belowPlan')!
    expect(rec.rule).toBe('Regra: matéria com menos de 50% do planejado (mínimo de 30 min planejados).')
    expect(rec.text).toContain('SQL: 1h 00min de 4h 00min planejados (25%)')
    expect(ids(r, 'behind')).toContain('behind.plan')
  })

  it('matéria entre 50% e 100% do planejado é dado de atraso, mas não dispara a regra', () => {
    const r = report({ planItems: [block('2026-11-16', 120, 'sql')], sessions: [session('2026-11-16', 90, 'sql')] })
    expect(ids(r, 'behind')).toContain('behind.subjects')
    expect(rules(r)).not.toContain('belowPlan')
  })

  it('atividades atrasadas: conta as da semana e as arrastadas, por prioridade', () => {
    const r = report({
      tasks: [
        task('Pagar boleto', '2026-11-17', { priority: 1 }),
        task('Entregar projeto', '2026-11-19', { priority: 3 }),
        task('Ligar para o banco', '2026-11-10', { priority: 2 }), // arrastada da semana anterior
        task('Feita na semana', '2026-11-18', { done: true, done_at: '2026-11-18T15:00:00Z' }),
        task('Feita só depois', '2026-11-20', { done: true, done_at: '2026-11-25T15:00:00Z' }), // ainda estava aberta no domingo
        task('Antiga já resolvida', '2026-11-05', { done: true, done_at: '2026-11-06T15:00:00Z' }),
      ],
    })
    expect(r.totals).toMatchObject({ tasksTotal: 4, tasksDone: 1, tasksLate: 4, tasksCarried: 1 })
    const fact = section(r, 'behind').statements.find((s) => s.id === 'behind.tasks')!
    expect(fact.kind).toBe('fact')
    expect(fact.text).toContain('4 atividades ficaram sem concluir (3 desta semana e 1 de semanas anteriores)')
    expect(r.recommendations[0]).toMatchObject({ ruleId: 'overdue', basedOn: ['behind.tasks'] })
    expect(r.recommendations[0].text).toBe('Comece pelas 4 atividades atrasadas, nesta ordem: Entregar projeto, Ligar para o banco, Feita só depois e mais 1.')
    expect(section(r, 'planned').statements.find((s) => s.id === 'planned.tasks')!.text).toContain('além de 1 atividade atrasada de semanas anteriores')
  })

  it('semana em andamento: só o que já venceu conta como atraso', () => {
    const r = report({
      today: '2026-11-18', // quarta
      planItems: [block('2026-11-16', 60, 'sql'), block('2026-11-20', 240, 'py', 'pending')],
      sessions: [session('2026-11-16', 60, 'sql')],
      tasks: [task('De hoje', '2026-11-18'), task('De ontem', '2026-11-17'), task('De sexta', '2026-11-20')],
    })
    expect(r.inProgress).toBe(true)
    expect(r.totals).toMatchObject({ elapsedDays: 3, tasksLate: 1, idleDays: 1 })
    // Python só está planejado para sexta: ainda não é atraso.
    expect(ids(r, 'behind')).not.toContain('behind.subjects')
    expect(rules(r)).toEqual(['overdue'])
    expect(section(r, 'behind').statements.find((s) => s.id === 'behind.days')!.text).toMatch(/^Até ontem, fiquei 1 de 2 dias sem estudar/)
  })

  it('compara com a semana anterior só quando há base', () => {
    const r = report({
      sessions: [session('2026-11-10', 120), session('2026-11-17', 180)],
    })
    expect(section(r, 'executed').statements.find((s) => s.id === 'executed.compare')!.text).toBe('Na semana anterior foram 2h 00min: +1h 00min (+50%).')

    const noBase = report({ sessions: [session('2026-11-17', 60)] })
    expect(section(noBase, 'executed').statements.find((s) => s.id === 'executed.compare')!.text).toBe('Não há estudo registrado na semana anterior para comparar.')
  })

  it('metas: cumpridas viram avanço; por entregas com prazo e quase cumpridas viram sugestões', () => {
    const goal = (over: Partial<StudyGoal>): StudyGoal => ({ id: 'g', title: null, metric: 'questions', period: 'weekly', target: 20, subject_id: null, status: 'active', start_date: '2026-11-01', end_date: null, previous_goal_id: null, kind: 'metric', checklist: null, due_date: null, done_at: null, ...over }) as StudyGoal
    const r = report({
      sessions: [session('2026-11-16', 120), session('2026-11-17', 60)],
      goals: [
        goal({ id: 'q', title: 'Rotina de estudo', metric: 'study_hours', target: 4 }), // 3 de 4 horas = 75%
        goal({ id: 'h', title: 'Horas', metric: 'study_hours', target: 3 }), // cumprida
        goal({ id: 'p', title: 'Pausada', metric: 'sessions', target: 99, status: 'paused' }),
        goal({
          id: 'd',
          title: 'Concluir JOIN',
          kind: 'deliverable',
          metric: 'topics_completed',
          target: 2,
          due_date: '2026-11-25',
          checklist: [
            { id: '1', text: 'Terminar a aula de JOIN', done: true },
            { id: '2', text: 'Resolver 20 exercícios', done: false },
          ],
        }),
      ],
    })
    expect(r.totals).toMatchObject({ goalsMet: 1, goalsPending: 2 })
    expect(section(r, 'planned').statements.find((s) => s.id === 'planned.goals')!.text).toBe('3 metas vigentes: 2 numéricas e 1 por entregas.')
    expect(section(r, 'advanced').statements.find((s) => s.id === 'advanced.goals')!.text).toContain('"Horas" (3h 00min de 3h 00min)')
    expect(section(r, 'behind').statements.find((s) => s.id === 'behind.goals')!.text).toContain('"Concluir JOIN" em 50% (1 de 2 entregas)')
    expect(r.recommendations.find((x) => x.ruleId === 'goalDeadline')!.text).toBe('Conclua as entregas da meta "Concluir JOIN" (prazo 25/11): Resolver 20 exercícios.')
    expect(r.recommendations.find((x) => x.ruleId === 'goalNear')!.text).toContain('"Rotina de estudo" ficou perto do alvo: 3h 00min de 4h 00min (75%)')
  })

  it('nunca passa de cinco sugestões e mantém a ordem de prioridade', () => {
    const r = report({
      planItems: [block('2026-11-16', 240, 'sql'), block('2026-11-17', 240, 'py')],
      sessions: [session('2026-11-16', 70, 'sql')],
      tasks: [task('Atrasada', '2026-11-16')],
      goals: [
        { id: 'd', title: 'Entregas', metric: 'topics_completed', period: 'weekly', target: 1, subject_id: null, status: 'active', start_date: '2026-11-01', end_date: null, previous_goal_id: null, kind: 'deliverable', checklist: [{ id: '1', text: 'Item', done: false }], due_date: '2026-11-20', done_at: null } as StudyGoal,
        { id: 's', title: 'Dias de estudo', metric: 'study_days', period: 'weekly', target: 1.3, subject_id: null, status: 'active', start_date: '2026-11-01', end_date: null, previous_goal_id: null, kind: 'metric', checklist: null, due_date: null, done_at: null } as StudyGoal,
      ],
    })
    expect(r.recommendations).toHaveLength(WEEKLY_THRESHOLDS.maxRecommendations)
    expect(rules(r)).toEqual(['overdue', 'belowPlan', 'goalDeadline', 'goalNear', 'idleDays'])
  })

  it('dias vazios geram uma sugestão de constância', () => {
    const r = report({ planItems: [block('2026-11-16', 60, 'sql')], sessions: [session('2026-11-16', 90, 'sql')] })
    expect(rules(r)).toEqual(['idleDays'])
    expect(r.recommendations[0].text).toBe('Reserve um bloco curto de estudo (25 min) nos dias que ficaram vazios: terça, quarta, quinta, sexta, sábado e domingo.')
  })

  it('frase-resumo, CSV e PDF saem do mesmo relatório', () => {
    const r = report({
      planItems: [block('2026-11-16', 240, 'sql')],
      sessions: [session('2026-11-16', 60, 'sql')],
      tasks: [task('Estudar JOIN', '2026-11-16', { category: 'estudos', done: true, done_at: '2026-11-16T20:00:00Z' }), task('Mercado', '2026-11-17')],
    })
    expect(weekHeadline(r)).toBe('Semana de 16/11 a 22/11: 1h 00min de estudo de 4h 00min planejados (25%), 1 de 2 atividades concluídas; prioridade: colocar em dia 1 atividade atrasada.')
    const rows = weeklyReportCsvRows(r)
    expect(new Set(rows.map((x) => x.tipo))).toEqual(new Set(['Dado', 'Sugestão por regra', '']))
    expect(rows.filter((x) => x.tipo === 'Sugestão por regra').every((x) => x.regra.startsWith('Regra: '))).toBe(true)
    expect(rows.filter((x) => x.tipo === 'Dado').every((x) => x.regra === '')).toBe(true)
    expect(rows.find((x) => x.secao === 'Por matéria')).toMatchObject({ texto: 'SQL', dados: 'planejado_min=240; realizado_min=60; topicos_concluidos=0' })
    expect(rows.filter((x) => x.secao === 'Por dia')).toHaveLength(7)
    const doc = weeklyReportDocument(r)
    expect(doc.subtitle).toBe('Semana de 16 de novembro de 2026 a 22 de novembro de 2026')
    expect(doc.blocks.filter((b) => b.type === 'heading').map((b) => (b.type === 'heading' ? b.text : ''))).toEqual(expect.arrayContaining(r.sections.map((s) => s.question)))
    expect(doc.blocks.some((b) => b.type === 'paragraph' && b.label === 'Sugestão por regra' && b.accent && b.note?.startsWith('Regra: '))).toBe(true)
  })
})
