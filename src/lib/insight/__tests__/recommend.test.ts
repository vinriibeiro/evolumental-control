import { describe, expect, it } from 'vitest'
import { masteryIndex, type InsightInput } from '../evidence'
import { diversify, recommend, type RecommendInput } from '../recommend'
import { daysAgo, NOW, planItem, questions, review, subject, topic, TODAY, TZ } from './fixtures'

function setup(over: Partial<InsightInput> = {}, rec: Partial<RecommendInput> = {}) {
  const input: InsightInput = { subjects: [], topics: [], sessions: [], questions: [], reviews: [], cards: [], today: TODAY, tz: TZ, ...over }
  const mastery = masteryIndex(input, NOW)
  return recommend({
    subjects: input.subjects,
    topics: input.topics,
    mastery,
    reviews: input.reviews,
    planToday: [],
    dueCards: new Map(),
    studiedToday: { byTopic: new Map(), bySubject: new Map() },
    studiedWeek: new Map(),
    cycleSubjectId: null,
    availableMinutes: null,
    ignored: new Set(),
    today: TODAY,
    nowMinute: 12 * 60,
    now: NOW,
    ...rec,
  })
}

const pt = subject('pt', { name: 'Português', priority: 4 })
const es = subject('es', { name: 'Estatística' })

describe('motor de próxima ação', () => {
  it('usuário novo sem matérias: nenhuma recomendação', () => {
    expect(setup()).toEqual([])
  })

  it('somente uma matéria sem tópicos: recomenda a matéria', () => {
    const r = setup({ subjects: [es] })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ type: 'study', subjectId: 'es', topicId: null })
  })

  it('matérias arquivadas, pausadas ou concluídas e pastas não são recomendadas', () => {
    const r = setup({
      subjects: [subject('a', { status: 'archived', archived_at: '2026-01-01T00:00:00Z' }), subject('b', { status: 'paused' }), subject('c', { status: 'completed' }), pt],
      topics: [topic('ta', 'a'), topic('tb', 'b'), topic('tc', 'c'), topic('f', 'pt', { kind: 'folder' }), topic('x', 'pt', { parent_id: 'f' })],
    })
    expect(r.map((x) => x.topicId)).toEqual(['x'])
  })

  it('revisão atrasada passa à frente e explica há quantos dias', () => {
    const r = setup({
      subjects: [pt],
      topics: [topic('crase', 'pt', { name: 'Crase' }), topic('reg', 'pt', { name: 'Regência' })],
      reviews: [review(daysAgo(3), 'planned', { topic_id: 'reg', subject_id: 'pt' })],
    })
    expect(r[0]).toMatchObject({ type: 'review', topicId: 'reg' })
    expect(r[0].reasons[0].label).toBe('revisão atrasada há 3 dias')
    expect(r[0].reviewId).toBeTruthy()
  })

  it('baixo acerto recente e erros recentes sobem o tópico e viram "fazer questões"', () => {
    const r = setup({
      subjects: [pt],
      topics: [topic('crase', 'pt'), topic('reg', 'pt')],
      questions: [questions(daysAgo(2), 12, 5, { topic_id: 'crase', subject_id: 'pt' }), questions(daysAgo(2), 30, 29, { topic_id: 'reg', subject_id: 'pt' })],
    })
    expect(r[0]).toMatchObject({ topicId: 'crase', type: 'questions' })
    expect(r[0].reasons.map((x) => x.label)).toEqual(expect.arrayContaining(['7 erros nos últimos 14 dias', '42% de acerto recente']))
  })

  it('reincidência e erros abertos no caderno entram como motivos (com pontos)', () => {
    const rq = { ...questions(daysAgo(3), 10, 5, { topic_id: 'crase', subject_id: 'pt' }), id: 'rq' }
    const r = setup({
      subjects: [pt],
      topics: [topic('crase', 'pt'), topic('reg', 'pt')],
      questions: [rq, questions(daysAgo(20), 10, 6, { topic_id: 'crase', subject_id: 'pt' })],
      errors: [{ id: 'e', user_id: 'u', created_at: '', updated_at: '', record_id: 'rq', reason: 'interpretacao', count: 4, note: null, resolved: false, resolved_at: null }],
    })
    expect(r[0].topicId).toBe('crase')
    const byLabel = Object.fromEntries(r[0].reasons.map((x) => [x.label, x.points]))
    expect(byLabel['erros reincidentes (2 dias diferentes)']).toBe(8)
    expect(byLabel['4 erros não resolvidos no caderno']).toBe(4)
  })

  it('tópico dominado e concluído, sem revisão pendente, sai da lista', () => {
    const r = setup({
      subjects: [pt],
      topics: [topic('crase', 'pt', { status: 'completed' })],
      questions: [questions(daysAgo(1), 60, 58, { topic_id: 'crase', subject_id: 'pt' })],
    })
    expect(r).toEqual([])
  })

  it('disponibilidade zero: nada cabe; 15 min: a sugestão encolhe', () => {
    const inp = { subjects: [pt], topics: [topic('crase', 'pt')] }
    expect(setup(inp, { availableMinutes: 0 })).toEqual([])
    expect(setup(inp, { availableMinutes: 15 })[0].suggestedMinutes).toBe(15)
    expect(setup(inp, { availableMinutes: null })[0].suggestedMinutes).toBe(35)
  })

  it('"Ignorar por hoje" remove o item', () => {
    const inp = { subjects: [pt], topics: [topic('crase', 'pt')] }
    expect(setup(inp, { ignored: new Set(['study:crase']) })).toEqual([])
  })

  it('repetição: tópico já estudado hoje perde pontos', () => {
    const inp = { subjects: [pt], topics: [topic('a', 'pt'), topic('b', 'pt')] }
    const r = setup(inp, { studiedToday: { byTopic: new Map([['a', 50 * 60]]), bySubject: new Map([['pt', 50 * 60]]) } })
    expect(r[0].topicId).toBe('b')
    expect(r[1].reasons.some((x) => x.label === 'já estudado hoje')).toBe(true)
  })

  it('empate: ordem determinística pelo id', () => {
    const inp = { subjects: [pt], topics: [topic('b', 'pt'), topic('a', 'pt')] }
    const r = setup(inp)
    expect(r.map((x) => x.topicId)).toEqual(['a', 'b'])
    expect(r[0].score).toBe(r[1].score)
  })

  it('bloco do cronograma agora soma pontos e aponta o bloco', () => {
    const inp = { subjects: [pt, es], topics: [topic('crase', 'pt')] }
    const block = planItem(TODAY, '12:30', 40, { subject_id: 'es' })
    const r = setup(inp, { planToday: [block] })
    expect(r[0]).toMatchObject({ subjectId: 'es', planItemId: block.id })
    expect(r[0].reasons[0].label).toBe('bloco do cronograma às 12:30')
  })

  it('meta semanal com déficit e prova próxima contam', () => {
    const inp = { subjects: [subject('m', { weekly_goal_hours: 4, target_date: '2026-11-10' })], topics: [topic('t', 'm')] }
    const r = setup(inp, { studiedWeek: new Map([['m', 3600]]) })
    const labels = r[0].reasons.map((x) => x.label)
    expect(labels).toEqual(expect.arrayContaining(['meta semanal: 25% cumprida', 'prova em 19 dias']))
  })

  it('flashcards vencidos (5 ou mais) viram um item próprio', () => {
    const r = setup({ subjects: [pt], topics: [topic('crase', 'pt')] }, { dueCards: new Map([['crase', 20], ['subject:pt', 2]]) })
    const fc = r.find((x) => x.type === 'flashcards')!
    expect(fc).toMatchObject({ topicId: 'crase', suggestedMinutes: 10 })
    expect(r.filter((x) => x.type === 'flashcards')).toHaveLength(1)
  })

  it('diversify: no máximo 2 da mesma matéria no topo', () => {
    const r = setup({ subjects: [pt, es], topics: [topic('a', 'pt'), topic('b', 'pt'), topic('c', 'pt'), topic('d', 'es')] })
    const d = diversify(r)
    expect(d.slice(0, 3).map((x) => x.subjectId).filter((s) => s === 'pt')).toHaveLength(2)
    expect(d).toHaveLength(r.length)
  })
})
