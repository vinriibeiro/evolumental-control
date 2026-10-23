import { describe, expect, it } from 'vitest'
import { cityRecoveries } from '@/features/evoquest/engine/opportunities'
import { WORLD } from '@/features/evoquest/content'
import { CLASSIC_CONTENT, cityQuestId } from '@/features/evoquest/content/generatedCity'
import { CITIES } from '@/features/evoquest/content/cities'
import { classicAnswers } from '@/lib/insight/game'
import { GUIDED_TYPES, INDEPENDENT_TYPES, helpOf, nextUnitStep, stageOf, unitReport, type AnswerRow } from '../engine/stages'
import type { Challenge, Unit } from '../types'

const NOW = Date.parse('2026-10-23T12:00:00Z')
const at = (daysAgo: number, minutes = 0) => new Date(NOW - daysAgo * 86_400_000 + minutes * 60_000).toISOString()

describe('estágio pelo tipo do desafio', () => {
  it('reconhecer = guiada; produzir = independente; chefe/multietapas = desafio integrado', () => {
    expect(stageOf({ type: 'mcq' })).toBe('guided')
    expect(stageOf({ type: 'match' })).toBe('guided')
    expect(stageOf({ type: 'numeric' })).toBe('independent')
    expect(stageOf({ type: 'code_complete' })).toBe('independent')
    expect(stageOf({ type: 'multistep' })).toBe('boss')
    expect(stageOf({ type: 'mcq', boss: true })).toBe('boss')
    expect(GUIDED_TYPES.some((t) => INDEPENDENT_TYPES.includes(t))).toBe(false)
  })

  it('nova tentativa pesa mais que a dica', () => {
    expect(helpOf({ used_hint: false, attempt: 1 })).toBe(0)
    expect(helpOf({ used_hint: true, attempt: 1 })).toBe(1)
    expect(helpOf({ used_hint: true, attempt: 2 })).toBe(2)
  })

  it('todas as unidades das cidades geradas têm prática guiada e chefe; quase todas têm produção', () => {
    let withoutIndependent = 0
    for (const content of Object.values(CLASSIC_CONTENT))
      for (const u of content.units) {
        const stages = new Set(u.challenges.map((c) => stageOf(c)))
        expect(stages.has('guided') || stages.has('independent'), u.id).toBe(true)
        expect(stages.has('boss'), `${u.id} sem chefe`).toBe(true)
        if (!stages.has('independent')) withoutIndependent++
      }
    // A fila da etapa "sozinho" volta à unidade inteira quando não há produção.
    expect(withoutIndependent).toBeLessThanOrEqual(3)
  })
})

describe('domínio: respostas clássicas ponderadas', () => {
  const challenges = new Map<string, Pick<Challenge, 'type' | 'boss'>>([
    ['g', { type: 'mcq' }],
    ['i', { type: 'numeric' }],
    ['b', { type: 'multistep', boss: true }],
  ])
  const a = (challenge_id: string, correct: boolean, used_hint = false, attempt = 1) => ({ challenge_id, correct, used_hint, attempt, subject_id: 'logica', topic: 't', answered_at: at(1) })

  it('guiada 1, independente 2, chefe 4; dica e nova tentativa reduzem o crédito', () => {
    const [g, i, b, hinted, retry, unknown] = classicAnswers([a('g', true), a('i', true), a('b', true), a('i', true, true), a('i', true, false, 2), a('x', true)], challenges)
    expect([g.weight, i.weight, b.weight]).toEqual([1, 2, 4])
    expect([g.correct, i.correct, b.correct]).toEqual([1, 2, 4])
    expect(hinted.correct).toBeCloseTo(1.6)
    expect(retry.correct).toBeCloseTo(1.2)
    expect(unknown).toMatchObject({ correct: true })
    expect(unknown.weight).toBeUndefined()
  })
})

const unit: Unit = {
  id: 'u',
  title: 'Proposições',
  summary: '',
  topics: [
    { id: 'p', name: 'Proposição' },
    { id: 'c', name: 'Conectivos' },
  ],
  lesson: [],
  challenges: [
    { id: 'g1', type: 'mcq', topic: 'p', difficulty: 1, prompt: '', explanation: '', options: ['a', 'b'], answer: 0 },
    { id: 'g2', type: 'tf', topic: 'c', difficulty: 1, prompt: '', explanation: '', answer: true },
    { id: 'i1', type: 'short', topic: 'c', difficulty: 2, prompt: '', explanation: '', accept: ['x'] },
    { id: 'b1', type: 'mcq', topic: 'p', difficulty: 3, prompt: '', explanation: '', options: ['a'], answer: 0, boss: true },
  ],
}
const ans = (challenge_id: string, correct: boolean, topic = 'p', extra: Partial<AnswerRow> = {}): AnswerRow => ({ challenge_id, topic, correct, used_hint: false, attempt: 1, answered_at: at(1), ...extra })

describe('plano da unidade (próximo passo com motivo)', () => {
  it('sem respostas → lição; guiada fraca → guiada; produção pouca → sozinho; depois o chefe', () => {
    expect(nextUnitStep(unitReport(unit, [])).step).toBe('lesson')
    const guidedWeak = unitReport(unit, [ans('g1', false), ans('g1', false), ans('g2', true, 'c'), ans('g1', true)])
    expect(nextUnitStep(guidedWeak)).toMatchObject({ step: 'guided', reason: expect.stringMatching(/50%/) })
    const guidedOk = [ans('g1', true), ans('g2', true, 'c'), ans('g1', true), ans('g2', true, 'c')]
    expect(nextUnitStep(unitReport(unit, guidedOk))).toMatchObject({ step: 'independent', reason: expect.stringMatching(/0 de 4/) })
    const indepOk = [...guidedOk, ...Array.from({ length: 4 }, () => ans('i1', true, 'c'))]
    expect(nextUnitStep(unitReport(unit, indepOk)).step).toBe('boss')
    const r = unitReport(unit, [...indepOk, ans('b1', true)])
    expect(r.bossWon).toBe(true)
    expect(nextUnitStep(r).step).toBe('review')
  })

  it('relatório: estatística por estágio, acertos limpos e tópicos fracos', () => {
    const r = unitReport(unit, [ans('i1', false, 'c'), ans('i1', false, 'c'), ans('i1', true, 'c', { used_hint: true }), ans('g1', true), ans('outro', true)])
    expect(r.stages.independent).toMatchObject({ answered: 3, correct: 1, clean: 0, distinct: 1, available: 1 })
    expect(r.stages.guided).toMatchObject({ answered: 1, clean: 1, available: 2 })
    expect(r.weak).toEqual([{ id: 'c', name: 'Conectivos', answered: 3, accuracy: 33 }])
  })
})

describe('cidades geradas: guardião abre o painel da unidade; recuperação com motivo', () => {
  it('cada prédio usa a interação "unit" (sem diálogo antigo de 3 botões)', () => {
    for (const c of CITIES.filter((x) => CLASSIC_CONTENT[x.subject])) {
      const region = WORLD.regions[c.id]
      const units = CLASSIC_CONTENT[c.subject].units
      units.forEach((u, i) => {
        const g = region.entities.find((e) => e.id === `${c.id}_u${i + 1}`)!
        expect(g.on.at(-1)).toEqual({ do: 'unit', subject: c.subject, unit: u.id })
      })
      expect(WORLD.quests[cityQuestId(c.id)]).toBeTruthy()
    }
  })

  it('tópico com erros recorrentes vira recuperação no prédio; acerto limpo depois encerra', () => {
    const units = [{ city: 'silogia', subject: 'logica', cityName: 'Silogia', unitTitle: 'Proposições', topics: unit.topics, challengeIds: new Set(['g1', 'i1']) }]
    const row = (correct: boolean, minutes: number, extra = {}) => ({ challenge_id: 'i1', topic: 'c', correct, used_hint: false, attempt: 1, answered_at: at(1, minutes), ...extra })
    const [o] = cityRecoveries([row(false, 0), row(false, 1), row(true, 2, { used_hint: true })], units, NOW)
    expect(o).toMatchObject({ kind: 'recovery', title: 'Recuperar Conectivos', where: 'Silogia → prédio "Proposições" (prática sozinho)' })
    expect(o.reason).toMatch(/2 erros em 3 respostas/)
    expect(cityRecoveries([row(false, 0), row(false, 1), row(true, 2)], units, NOW)).toEqual([])
    // Antigo (mais de 14 dias) não conta.
    expect(cityRecoveries([{ ...row(false, 0), answered_at: at(20) }, { ...row(false, 1), answered_at: at(20) }], units, NOW)).toEqual([])
  })
})
