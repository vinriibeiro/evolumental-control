import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { MIN_SAMPLE, buckets, consistency, delta, difficulties, granularityFor, lastMonths, lastWeeks, plannedStudy, previousRange, questionSeries, questionTotals, sumByBucket, taskCompletion } from '@/lib/evolution'
import { checklistPatch, checklistProgress, dueState, goalActiveOn, history, parseChecklist, snapshotGoals, type GoalData } from '@/lib/goals'
import { buildReportPdf, sanitizePdfText, wrapText } from '@/lib/reportPdf'
import { NO_SUBJECT, longestStreak } from '@/lib/stats'
import type { StudyGoal } from '@/types/db'

const WEEK = { from: '2026-11-16', to: '2026-11-22' }

describe('evolução: planejado', () => {
  it('soma blocos do cronograma (menos remarcados) e atividades de estudo com duração', () => {
    const p = plannedStudy(
      [
        { date: '2026-11-16', duration_minutes: 60, subject_id: 'sql', status: 'done' },
        { date: '2026-11-17', duration_minutes: 30, subject_id: null, status: 'missed' },
        { date: '2026-11-18', duration_minutes: 90, subject_id: 'sql', status: 'rescheduled' },
        { date: '2026-11-30', duration_minutes: 90, subject_id: 'sql', status: 'pending' }, // fora do intervalo
      ],
      [
        { date: '2026-11-16', duration_minutes: 45, subject_id: 'sql', topic_id: null, category: 'estudos', done: false },
        { date: '2026-11-16', duration_minutes: 120, subject_id: null, topic_id: null, category: 'trabalho', done: false }, // não é estudo
        { date: '2026-11-17', duration_minutes: null, subject_id: 'sql', topic_id: null, category: 'estudos', done: true }, // sem duração
        { date: '2026-11-18', duration_minutes: 15, subject_id: 'py', topic_id: null, category: null, done: false }, // antiga com matéria = estudo
      ],
      WEEK,
    )
    expect(p.total).toBe((60 + 30 + 45 + 15) * 60)
    expect(p).toMatchObject({ fromPlan: 90 * 60, fromTasks: 60 * 60, planBlocks: 2, studyTasks: 2 })
    expect(p.byDay.get('2026-11-16')).toBe(105 * 60)
    expect(p.bySubject.get('sql')).toBe(105 * 60)
    expect(p.bySubject.get(NO_SUBJECT)).toBe(30 * 60)
  })
})

describe('evolução: faixas de tempo', () => {
  it('escolhe a granularidade pelo tamanho do período', () => {
    expect(granularityFor(WEEK)).toBe('day')
    expect(granularityFor({ from: '2026-09-01', to: '2026-11-30' })).toBe('week')
    expect(granularityFor({ from: '2026-01-01', to: '2026-12-31' })).toBe('month')
  })
  it('recorta as faixas nos limites do período e soma por faixa', () => {
    const range = { from: '2026-11-18', to: '2026-12-02' }
    const weeks = buckets(range, 'week')
    expect(weeks.map((b) => [b.from, b.to])).toEqual([
      ['2026-11-18', '2026-11-22'],
      ['2026-11-23', '2026-11-29'],
      ['2026-11-30', '2026-12-02'],
    ])
    expect(buckets(range, 'month').map((b) => b.label)).toEqual(['11/2026', '12/2026'])
    expect(buckets(WEEK, 'day')).toHaveLength(7)
    const byDay = new Map([
      ['2026-11-18', 10],
      ['2026-11-22', 5],
      ['2026-11-23', 7],
      ['2026-12-03', 99],
    ])
    expect(sumByBucket(byDay, weeks)).toEqual([15, 7, 0])
  })
  it('últimas semanas e meses terminam no período da âncora', () => {
    expect(lastWeeks('2026-11-21', 12)).toEqual({ from: '2026-08-31', to: '2026-11-22' })
    expect(lastMonths('2026-11-21', 6)).toEqual({ from: '2026-06-01', to: '2026-11-30' })
  })
})

describe('evolução: atividades, exercícios e comparação', () => {
  it('taxa de conclusão é null sem atividades', () => {
    expect(taskCompletion([], WEEK)).toEqual({ total: 0, done: 0, rate: null })
    expect(taskCompletion([{ date: '2026-11-16', done: true }, { date: '2026-11-17', done: false }, { date: '2026-12-01', done: true }], WEEK)).toEqual({ total: 2, done: 1, rate: 50 })
  })
  const qs = [
    { date: '2026-11-16', subject_id: 'sql', topic_id: 'join', total: 8, correct: 2 },
    { date: '2026-11-17', subject_id: 'sql', topic_id: 'join', total: 4, correct: 1 },
    { date: '2026-11-17', subject_id: 'sql', topic_id: 'cte', total: 20, correct: 16 },
    { date: '2026-11-18', subject_id: 'py', topic_id: 'pandas', total: 5, correct: 0 },
    { date: '2026-11-18', subject_id: 'py', topic_id: null, total: 30, correct: 30 },
  ]
  it('acerto por faixa fica null onde não há questões', () => {
    expect(questionTotals(qs, WEEK)).toMatchObject({ total: 67, correct: 49 })
    expect(questionTotals([], WEEK).accuracy).toBeNull()
    const series = questionSeries(qs, buckets(WEEK, 'day'))
    expect(series.map((s) => s.total)).toEqual([8, 24, 35, 0, 0, 0, 0])
    expect(series[3].accuracy).toBeNull()
    expect(series[0].accuracy).toBe(25)
  })
  it('dificuldades: menor acerto primeiro e só com amostra mínima', () => {
    const d = difficulties(qs, WEEK, (q) => q.topic_id)
    expect(d.rows.map((r) => [r.key, r.total, Math.round(r.accuracy)])).toEqual([
      ['join', 12, 25],
      ['cte', 20, 80],
    ])
    // Pandas (5 questões, 0%) fica de fora: amostra pequena engana.
    expect(d.belowSample).toBe(1)
    expect(MIN_SAMPLE).toBe(10)
    expect(difficulties(qs, WEEK, (q) => q.subject_id).rows.map((r) => r.key)).toEqual(['sql', 'py'])
  })
  it('período anterior equivalente e variação sem base', () => {
    expect(previousRange('week', WEEK)).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(previousRange('month', { from: '2026-03-01', to: '2026-03-31' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(previousRange('custom', { from: '2026-11-10', to: '2026-11-12' })).toEqual({ from: '2026-11-07', to: '2026-11-09' })
    expect(delta(150, 100)).toEqual({ current: 150, previous: 100, diff: 50, pct: 50 })
    expect(delta(10, 0).pct).toBeNull()
  })
  it('constância conta só os dias já decorridos', () => {
    const byDay = new Map([
      ['2026-11-16', 600],
      ['2026-11-17', 600],
      ['2026-11-19', 600],
    ])
    expect(consistency(byDay, WEEK, '2026-11-19')).toEqual({ studied: 3, elapsed: 4, idleDays: ['2026-11-18'] })
    expect(longestStreak(byDay, WEEK)).toBe(2)
  })
})

describe('metas por entregas', () => {
  const goal = (over: Partial<StudyGoal>): StudyGoal => ({ id: 'g', title: null, metric: 'topics_completed', period: 'weekly', target: 1, subject_id: null, status: 'active', start_date: '2026-11-01', end_date: null, previous_goal_id: null, kind: 'deliverable', checklist: null, due_date: null, done_at: null, ...over }) as StudyGoal
  const data: GoalData = { sessions: [], questions: [{ date: '2026-11-17', subject_id: null, total: 30, correct: 20 }], topics: [], reviews: [], timezone: 'America/Sao_Paulo' }

  it('progresso = itens marcados ÷ total', () => {
    expect(checklistProgress(goal({}))).toEqual({ done: 0, total: 0, percent: 0, met: false })
    expect(checklistProgress(goal({ checklist: [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B', done: false }] }))).toEqual({ done: 1, total: 2, percent: 50, met: false })
  })
  it('texto do formulário vira lista, preservando o que já estava marcado', () => {
    const before = [{ id: 'a', text: 'Concluir JOIN', done: true, url: 'https://exemplo.test' }]
    const items = parseChecklist('- concluir join\n2. Resolver 20 exercícios\n\n[ ] Resolver 20 exercícios\n', before)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ id: 'a', done: true, url: 'https://exemplo.test', text: 'concluir join' })
    expect(items[1]).toMatchObject({ text: 'Resolver 20 exercícios', done: false })
  })
  it('marcar tudo define done_at; desmarcar limpa; o alvo acompanha o número de itens (mínimo 1)', () => {
    const now = '2026-11-21T10:00:00.000Z'
    expect(checklistPatch([], null, now)).toMatchObject({ target: 1, done_at: null })
    const all = [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B', done: true }]
    expect(checklistPatch(all, null, now)).toMatchObject({ target: 2, done_at: now })
    // Já estava concluída: mantém a data original.
    expect(checklistPatch(all, '2026-11-20T10:00:00.000Z', now).done_at).toBe('2026-11-20T10:00:00.000Z')
    expect(checklistPatch([{ ...all[0], done: false }, all[1]], now, now).done_at).toBeNull()
  })
  it('prazo: vencido, hoje, próximo e concluído', () => {
    expect(dueState(goal({ due_date: '2026-11-20' }), '2026-11-21')).toEqual({ state: 'overdue', days: -1 })
    expect(dueState(goal({ due_date: '2026-11-21' }), '2026-11-21').state).toBe('today')
    expect(dueState(goal({ due_date: '2026-11-23' }), '2026-11-21')).toEqual({ state: 'soon', days: 2 })
    expect(dueState(goal({ due_date: '2026-11-30' }), '2026-11-21').state).toBe('later')
    expect(dueState(goal({ due_date: '2026-11-20', done_at: '2026-11-19T10:00:00Z' }), '2026-11-21').state).toBe('done')
    expect(dueState(goal({}), '2026-11-21').state).toBe('none')
  })
  it('retrato separa cumpridas e pendentes e ignora pausadas; meta por entregas não usa a métrica', () => {
    const snaps = snapshotGoals(
      [
        goal({ id: 'd', title: 'Entregas', checklist: [{ id: 'a', text: 'A', done: true }], done_at: '2026-11-18T10:00:00Z' }),
        goal({ id: 'late', title: 'Atrasada', due_date: '2026-11-18', checklist: [{ id: 'a', text: 'A', done: false }] }),
        goal({ id: 'q', kind: 'metric', metric: 'questions', target: 40 }),
        goal({ id: 'old', kind: undefined as never, metric: 'accuracy', target: 60, period: 'monthly' }), // linha antiga sem `kind`
        goal({ id: 'p', kind: 'metric', metric: 'questions', status: 'paused' }),
        goal({ id: 'future', kind: 'metric', metric: 'questions', start_date: '2026-12-01' }),
      ],
      '2026-11-21',
      data,
    )
    expect(snaps.map((s) => [s.goal.id, s.kind, s.met, Math.round(s.percent)])).toEqual([
      ['d', 'deliverable', true, 100],
      ['late', 'deliverable', false, 0],
      ['q', 'metric', false, 75],
      ['old', 'metric', true, 100],
    ])
    expect(snaps[1].overdue).toBe(true)
    expect(snaps[0].detail).toBe('1 de 1 entrega')
    expect(snaps[2].detail).toBe('30 de 40')
    expect(history(goal({ start_date: '2026-09-01' }), '2026-11-21', data)).toEqual([])
    expect(goalActiveOn({ status: 'archived', start_date: '2026-11-01', end_date: '2026-11-20' }, '2026-11-18')).toBe(true)
    expect(goalActiveOn({ status: 'archived', start_date: '2026-11-01', end_date: '2026-11-20' }, '2026-11-21')).toBe(false)
  })
  it('meta diária dentro de um intervalo conta os dias cumpridos', () => {
    const [snap] = snapshotGoals([goal({ kind: 'metric', metric: 'questions', period: 'daily', target: 10 })], '2026-11-22', data, WEEK)
    expect(snap).toMatchObject({ value: 1, target: 7, met: false })
    expect(snap.detail).toBe('10 por dia: cumprida em 1 de 7 dias')
  })
})

describe('PDF dos relatórios', () => {
  it('gera um PDF válido, com várias páginas quando o conteúdo é longo', async () => {
    const bytes = await buildReportPdf({
      title: 'Evolução',
      subtitle: 'Período: 01/11 – 30/11',
      meta: 'Gerado em 21/11/2026',
      blocks: [
        { type: 'stats', items: [{ label: 'Horas', value: '12h 30min' }, { label: 'Atividades', value: '9 de 14' }, { label: 'Acerto', value: 'Dados insuficientes' }, { label: 'Dias', value: '5 de 7' }] },
        { type: 'heading', text: 'O que devo priorizar?' },
        { type: 'paragraph', label: 'Sugestão por regra', accent: true, text: 'Revise JOIN → refaça exercícios (acerto ≥ 70%). 🚀 '.repeat(8), note: 'Regra: tópico com menor acerto.' },
        { type: 'table', columns: ['Dia', 'Planejado', 'Realizado'], rows: Array.from({ length: 90 }, (_, i) => [`Dia ${i + 1} com um nome comprido para quebrar a linha da primeira coluna`, '1h 00min', i]) },
        { type: 'table', columns: ['Matéria', 'Tempo'], rows: [], empty: 'Sem dados no período.' },
      ],
    })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(2)
    expect(doc.getTitle()).toBe('Evolução')
  })
  it('troca caracteres que a fonte padrão não desenha e quebra linhas longas', () => {
    const supported = new Set('abc ->=çã'.split('').map((c) => c.codePointAt(0)!))
    expect(sanitizePdfText('a → b ≥ ç🚀', supported)).toBe('a -> b >= ç?')
    const lines = wrapText('uma frase que precisa de mais de uma linha', 12, (s) => s.length)
    expect(lines.every((l) => l.length <= 12)).toBe(true)
    expect(lines.join(' ')).toBe('uma frase que precisa de mais de uma linha')
    expect(wrapText('abcdefghijklmnop', 5, (s) => s.length)).toEqual(['abcde', 'fghij', 'klmno', 'p'])
  })
})
