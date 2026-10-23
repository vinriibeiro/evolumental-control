import { describe, expect, it } from 'vitest'
import { masteryIndex, type InsightInput } from '../evidence'
import { gameEvidenceByTopic, worldEvidenceAnswers } from '../game'
import { aggregateMastery, computeMastery, emptyEvidence, lastContactLabel, levelOf, type TopicEvidence } from '../mastery'
import { card, DAY, daysAgo, NOW, questions, review, session, subject, topic, TODAY, TZ } from './fixtures'

const ev = (over: Partial<TopicEvidence>): TopicEvidence => ({ ...emptyEvidence(), ...over })
const q = (daysBack: number, total: number, correct: number) => ({ at: NOW - daysBack * DAY, total, correct })

describe('domínio por tópico (computeMastery)', () => {
  it('sem nenhum dado: "Sem dados", confiança nenhuma', () => {
    const r = computeMastery(emptyEvidence(), NOW)
    expect(r).toMatchObject({ value: 0, level: 'none', confidence: 'none', evidence: 0 })
  })

  it('só estudo (sem prática verificada) nunca passa de 55%', () => {
    const r = computeMastery(ev({ studySeconds: 20 * 3600, sessions: 12, lastStudyAt: NOW - DAY, selfRating: 5 }), NOW)
    expect(r.value).toBeLessThanOrEqual(55)
    expect(r.notes.join(' ')).toMatch(/Sem prática verificada/)
  })

  it('concluído/autoavaliação máxima sem evidência não vira domínio', () => {
    const r = computeMastery(ev({ selfRating: 5 }), NOW)
    expect(r.value).toBeLessThanOrEqual(55)
    expect(r.confidence).toBe('low')
    expect(r.notes[0]).toBe('Estimativa inicial — poucos dados')
  })

  it('poucas questões, todas certas: teto de 79% e confiança baixa', () => {
    const r = computeMastery(ev({ questions: [q(1, 5, 5)] }), NOW)
    expect(r.value).toBeLessThanOrEqual(79)
    expect(r.confidence).toBe('low')
  })

  it('muitas questões recentes com acerto alto: dominado, confiança alta', () => {
    const r = computeMastery(ev({ questions: [q(2, 40, 38), q(5, 30, 29)], studySeconds: 3 * 3600, sessions: 4, lastStudyAt: NOW - 2 * DAY }), NOW)
    expect(r.level).toBe('mastered')
    expect(r.confidence).toBe('high')
  })

  it('um erro isolado não destrói o domínio', () => {
    const good = computeMastery(ev({ questions: [q(3, 40, 38)] }), NOW)
    const withError = computeMastery(ev({ questions: [q(3, 40, 38), q(1, 1, 0)] }), NOW)
    expect(good.value - withError.value).toBeLessThanOrEqual(3)
  })

  it('erros repetidos recentes pesam mais (reincidência)', () => {
    const old = computeMastery(ev({ questions: [q(60, 10, 3)] }), NOW)
    const recent = computeMastery(ev({ questions: [q(2, 10, 3)] }), NOW)
    expect(recent.value).toBeLessThan(old.value)
    expect(recent.recentWrong).toBe(7)
    expect(recent.notes.join(' ')).toMatch(/7 erros nos últimos 14 dias/)
  })

  it('reincidência: erros em dias diferentes (30 dias) tiram 5 pontos; um dia só, não', () => {
    const oneDay = computeMastery(ev({ questions: [q(20, 10, 6), q(25, 10, 10)] }), NOW)
    const twoDays = computeMastery(ev({ questions: [q(20, 10, 6), q(25, 10, 6)] }), NOW)
    expect(oneDay.errorDays).toBe(1)
    expect(twoDays.errorDays).toBe(2)
    expect(twoDays.notes.join(' ')).toMatch(/Erros em 2 dias diferentes/)
    // Mesmo acerto total, mas a versão com erros espalhados perde também a reincidência.
    const sameAcc = computeMastery(ev({ questions: [q(20, 20, 12)] }), NOW)
    expect(sameAcc.value - twoDays.value).toBe(5)
  })

  it('erros não resolvidos no caderno aparecem nas observações', () => {
    const r = computeMastery(ev({ questions: [q(2, 10, 7)], openErrors: 3 }), NOW)
    expect(r.openErrors).toBe(3)
    expect(r.notes).toContain('3 erro(s) não resolvido(s) no caderno')
  })

  it('esquecimento: o mesmo desempenho vale menos depois de meses sem contato', () => {
    const fresh = computeMastery(ev({ questions: [q(1, 30, 27)] }), NOW)
    const stale = computeMastery(ev({ questions: [q(200, 30, 27)] }), NOW)
    expect(stale.value).toBeLessThan(fresh.value)
    expect(stale.value).toBeGreaterThan(0)
  })

  it('flashcards com intervalos longos e sem lapsos contam como retenção', () => {
    const r = computeMastery(ev({ cards: [{ repetitions: 5, intervalDays: 30, lapses: 0, lastReviewedAt: NOW - DAY }] }), NOW)
    expect(r.parts.retention).toBe(1)
    const lapsed = computeMastery(ev({ cards: [{ repetitions: 5, intervalDays: 30, lapses: 3, lastReviewedAt: NOW - DAY }] }), NOW)
    expect(lapsed.parts.retention!).toBeLessThan(0.7)
  })

  it('revisão atrasada reduz a retenção e aparece nas observações', () => {
    const r = computeMastery(ev({ reviewsDone: 1, reviewsOverdue: 1, questions: [q(1, 10, 8)] }), NOW)
    expect(r.parts.retention).toBe(0.5)
    expect(r.notes.join(' ')).toMatch(/1 revisão\(ões\) atrasada/)
  })

  it('níveis e rótulos de último contato', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map((v) => levelOf(v))).toEqual([
      'unconsolidated', 'unconsolidated', 'fragile', 'fragile', 'developing', 'developing', 'consolidating', 'consolidating', 'mastered', 'mastered',
    ])
    expect(lastContactLabel(null, NOW)).toBe('nunca')
    expect(lastContactLabel(NOW - 4 * DAY, NOW)).toBe('há 4 dias')
    expect(lastContactLabel(NOW - DAY, NOW)).toBe('ontem')
  })
})

describe('agregação (tópico pai e matéria)', () => {
  it('respeita pesos e conta conteúdo sem dados como 0', () => {
    const r = aggregateMastery([
      { value: 80, weight: 3, hasData: true, lastContactAt: 1 },
      { value: 0, weight: 1, hasData: false, lastContactAt: null },
    ])
    expect(r.value).toBe(60)
    expect(r.coverage).toBe(0.75)
    expect(r.lastContactAt).toBe(1)
  })

  it('lista vazia ou só sem dados: "Sem dados"', () => {
    expect(aggregateMastery([]).level).toBe('none')
    expect(aggregateMastery([{ value: 0, weight: 1, hasData: false, lastContactAt: null }]).level).toBe('none')
  })
})

describe('evidências a partir das tabelas (masteryIndex)', () => {
  const s = subject('pt', { name: 'Português' })
  const parent = topic('t1', 'pt', { name: 'Sintaxe' })
  const crase = topic('t2', 'pt', { name: 'Crase', parent_id: 't1', weight: 2 })
  const reg = topic('t3', 'pt', { name: 'Regência', parent_id: 't1' })
  const base: InsightInput = { subjects: [s], topics: [parent, crase, reg], sessions: [], questions: [], reviews: [], cards: [], today: TODAY, tz: TZ }

  it('usuário novo, sem dados: tudo "Sem dados"', () => {
    const idx = masteryIndex(base, NOW)
    expect(idx.byTopic.get('t1')!.level).toBe('none')
    expect(idx.bySubject.get('pt')!.level).toBe('none')
  })

  it('sessões canceladas não contam; concluídas somam tempo líquido', () => {
    const idx = masteryIndex(
      {
        ...base,
        sessions: [
          session('2026-10-20T13:00:00Z', 60, { topic_id: 't2', subject_id: 'pt', status: 'cancelled' }),
          session('2026-10-21T13:00:00Z', 30, { topic_id: 't2', subject_id: 'pt' }),
        ],
      },
      NOW,
    )
    expect(idx.evidence.get('t2')!.studySeconds).toBe(1800)
    expect(idx.evidence.get('t2')!.sessions).toBe(1)
  })

  it('sessão que cruza a meia-noite conta inteira', () => {
    const idx = masteryIndex({ ...base, sessions: [session('2026-10-21T02:30:00Z', 90, { topic_id: 't3', subject_id: 'pt' })] }, NOW)
    expect(idx.evidence.get('t3')!.studySeconds).toBe(90 * 60)
  })

  it('pai agrega filhos pelo peso; matéria agrega tópicos raiz; registro sem tópico vai para a matéria', () => {
    const idx = masteryIndex(
      {
        ...base,
        questions: [questions(daysAgo(1), 40, 38, { topic_id: 't2', subject_id: 'pt' }), questions(daysAgo(1), 20, 4, { subject_id: 'pt' })],
        reviews: [review(daysAgo(3), 'planned', { topic_id: 't3', subject_id: 'pt' })],
      },
      NOW,
    )
    const t2 = idx.byTopic.get('t2')!
    const t3 = idx.byTopic.get('t3')!
    const t1 = idx.byTopic.get('t1')!
    expect(t2.level).not.toBe('none')
    expect(t3.own?.parts.retention).toBe(0) // só uma revisão, atrasada
    // Crase pesa 2, Regência 1.
    expect(t1.value).toBe(Math.round((t2.value * 2 + t3.value) / 3))
    expect(idx.bySubject.get('pt')!.own?.parts.practice).toBeLessThan(0.4)
  })

  it('tópico de matéria arquivada ainda tem domínio calculado (a recomendação é que filtra)', () => {
    const idx = masteryIndex({ ...base, subjects: [{ ...s, status: 'archived' }], questions: [questions(daysAgo(2), 12, 10, { topic_id: 't3', subject_id: 'pt' })] }, NOW)
    expect(idx.byTopic.get('t3')!.level).not.toBe('none')
  })

  it('erros classificados e não resolvidos contam para o tópico do registro', () => {
    const rec = { ...questions(daysAgo(2), 10, 6, { topic_id: 't2', subject_id: 'pt' }), id: 'rq' }
    const mk = (id: string, count: number, resolved: boolean) => ({ id, user_id: 'u', created_at: '', updated_at: '', record_id: 'rq', reason: 'interpretacao' as const, count, note: null, resolved, resolved_at: null })
    const idx = masteryIndex({ ...base, questions: [rec], errors: [mk('a', 3, false), mk('b', 1, true)] }, NOW)
    expect(idx.evidence.get('t2')!.openErrors).toBe(3)
  })

  it('flashcards suspensos são ignorados', () => {
    const idx = masteryIndex({ ...base, cards: [card({ topic_id: 't2', subject_id: 'pt', status: 'suspended', repetitions: 4, interval_days: 30 })] }, NOW)
    expect(idx.evidence.get('t2')?.cards.length ?? 0).toBe(0)
  })

  it('a data da questão é interpretada no fuso do usuário', () => {
    const idx = masteryIndex({ ...base, questions: [questions(TODAY, 10, 9, { topic_id: 't2', subject_id: 'pt' })] }, NOW)
    expect(idx.byTopic.get('t2')!.lastContactAt).toBe(Date.parse('2026-10-22T15:00:00Z'))
  })
})

describe('EvoQuest → tópicos do Control', () => {
  it('liga pelo nome do tópico dentro da disciplina correspondente', () => {
    const s = subject('pt', { name: 'Língua Portuguesa' })
    const topics = [topic('c', 'pt', { name: 'Crase' }), topic('r', 'pt', { name: 'Regência verbal' })]
    const answers = [
      { subject_id: 'portugues', topic: 'crase', correct: true, answered_at: '2026-10-20T10:00:00Z' },
      { subject_id: 'portugues', topic: 'crase', correct: false, answered_at: '2026-10-21T10:00:00Z' },
      { subject_id: 'sql', topic: 'crase', correct: true, answered_at: '2026-10-21T10:00:00Z' },
    ]
    const map = gameEvidenceByTopic(answers, { portugues: [{ id: 'crase', name: 'Crase' }, { id: 'reg', name: 'Regência' }] }, topics, [s], {})
    expect(map.get('c')).toEqual({ total: 2, correct: 1, lastAt: Date.parse('2026-10-21T10:00:00Z') })
    expect(map.has('r')).toBe(false)
  })
})

describe('EvoQuest mundo → domínio (evidências ponderadas, sem XP)', () => {
  const s = subject('bd', { name: 'Banco de dados SQL' })
  const topics = [topic('g', 'bd', { name: 'GROUP BY' })]
  const catalog = { sql: [{ id: 'groupby', name: 'GROUP BY' }] }
  const row = (stage: 'guided' | 'independent' | 'transfer' | 'boss', help_level: number, solved: boolean) => ({ subject: 'sql', concept: 'groupby', stage, help_level, solved, created_at: '2026-10-21T10:00:00Z' })

  it('estágio vira peso e ajuda reduz o crédito; explicação completa não conta acerto', () => {
    const answers = worldEvidenceAnswers([row('guided', 0, true), row('independent', 2, true), row('transfer', 4, true)])
    const map = gameEvidenceByTopic(answers, catalog, topics, [s], { sql: 'bd' })
    const g = map.get('g')!
    expect(g.total).toBe(1 + 2 + 3)
    expect(g.correct).toBeCloseTo(1 + 2 * 0.6 + 0)
  })

  it('transferência sem ajuda pesa mais que várias guiadas; não resolvida pesa como erro', () => {
    const transfer = gameEvidenceByTopic(worldEvidenceAnswers([row('transfer', 0, true)]), catalog, topics, [s], { sql: 'bd' }).get('g')!
    const guided = gameEvidenceByTopic(worldEvidenceAnswers([row('guided', 0, true), row('guided', 0, true)]), catalog, topics, [s], { sql: 'bd' }).get('g')!
    expect(transfer.correct).toBeGreaterThan(guided.correct)
    const failed = gameEvidenceByTopic(worldEvidenceAnswers([row('independent', 1, false)]), catalog, topics, [s], { sql: 'bd' }).get('g')!
    expect(failed).toMatchObject({ total: 2, correct: 0 })
  })

  it('o domínio sobe só com evidência: mesma prática com explicação completa fica abaixo', () => {
    const at = (answers: ReturnType<typeof worldEvidenceAnswers>) => {
      const game = gameEvidenceByTopic(answers, catalog, topics, [s], { sql: 'bd' })
      const input: InsightInput = { subjects: [s], topics, sessions: [], questions: [], reviews: [], cards: [], game, today: TODAY, tz: TZ }
      return masteryIndex(input, NOW).byTopic.get('g')!.value
    }
    const solo = at(worldEvidenceAnswers([row('independent', 0, true), row('transfer', 0, true)]))
    const helped = at(worldEvidenceAnswers([row('independent', 4, true), row('transfer', 4, true)]))
    expect(solo).toBeGreaterThan(helped)
  })
})
