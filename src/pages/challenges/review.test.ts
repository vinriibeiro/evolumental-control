import { describe, expect, it } from 'vitest'
import { CHALLENGES } from './catalog'
import { applyChallengePatch, challengeBackup, challengeStorageKey, initialChallengeState, persistChallengePatch, readChallengeState } from './progress'
import { buildReviewQueue, isOpen, parseReviewRecord, withMiss, withResolution } from './review'
import { VARIATIONS, variationFor } from './variations'

const memory = () => {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}
const at = (minute: number) => new Date(Date.UTC(2026, 10, 4, 12, minute))

describe('registro de erros por conceito', () => {
  it('abre a pendência no erro e a encerra na revisão', () => {
    const miss = withMiss(undefined, at(1))
    expect(miss).toEqual({ misses: 1, lastMissAt: at(1).toISOString() })
    expect(isOpen(miss)).toBe(true)
    const resolved = withResolution(miss, at(2))
    expect(isOpen(resolved)).toBe(false)
    const again = withMiss(resolved, at(3))
    expect(again.misses).toBe(2)
    expect(isOpen(again)).toBe(true)
    expect(isOpen(withMiss({ ...again, resolvedAt: at(9).toISOString() }, at(4)))).toBe(false)
  })

  it('ignora registros inválidos', () => {
    expect(parseReviewRecord({ misses: -1, lastMissAt: at(0).toISOString() })).toBeUndefined()
    expect(parseReviewRecord({ misses: 1, lastMissAt: 'ontem' })).toBeUndefined()
    expect(parseReviewRecord('x')).toBeUndefined()
    expect(parseReviewRecord({ misses: 2, lastMissAt: at(0).toISOString(), resolvedAt: 'xx' })).toEqual({ misses: 2, lastMissAt: at(0).toISOString() })
  })
})

describe('fila "Revisar meus erros"', () => {
  const python1 = 'python-first_steps-5'
  const sql1 = 'sql-first_steps-3'

  it('lista erros recentes primeiro e usa a variação quando existe', () => {
    const queue = buildReviewQueue({
      reviews: { [python1]: withMiss(undefined, at(1)), [sql1]: withMiss(withMiss(undefined, at(2)), at(3)), 'git-first_steps-1': withResolution(withMiss(undefined, at(1)), at(2)) },
      drafts: {}, verified: [],
    })
    expect(queue.map((item) => item.id)).toEqual([sql1, python1])
    expect(queue[0]).toMatchObject({ reason: 'misses', misses: 2, concept: 'Filtrar linhas com WHERE' })
    expect(queue[0].variation?.id).toBe('sql-first_steps-3~v1')
    expect(queue.find((item) => item.id === 'git-first_steps-1')).toBeUndefined()
  })

  it('parte do progresso existente: rascunhos reais sem aprovação entram, o resto não', () => {
    const [a, b, c, d] = CHALLENGES
    const queue = buildReviewQueue({
      reviews: {},
      drafts: { [a.id]: 'print("quase")', [b.id]: b.starter, [c.id]: '   ', [d.id]: 'print("ok")' },
      verified: [d.id],
    })
    expect(queue.map((item) => [item.id, item.reason])).toEqual([[a.id, 'draft']])
  })

  it('dispensar um rascunho antigo o remove da fila sem apagar o rascunho', () => {
    const [a] = CHALLENGES
    const state = applyChallengePatch({ ...initialChallengeState(), drafts: { [a.id]: 'print("quase")' } }, { reviews: { [a.id]: withResolution(undefined, at(5)) } })
    expect(buildReviewQueue({ reviews: state.reviews, drafts: state.drafts, verified: state.verified })).toEqual([])
    expect(state.drafts[a.id]).toBe('print("quase")')
  })
})

describe('persistência da revisão', () => {
  it('grava só chaves novas e preserva rascunhos, aprovações e o formato antigo', () => {
    const storage = memory()
    const [first, second] = CHALLENGES
    storage.setItem(challengeStorageKey('conta'), JSON.stringify({ track: 'sql', level: 'basic', completed: [first.id], drafts: { [second.id]: 'rascunho antigo' } }))
    persistChallengePatch(storage, 'conta', { verified: { [first.id]: true }, drafts: { [second.id]: 'rascunho v2' } })
    const before = new Map(storage.data)

    const miss = withMiss(undefined, at(1))
    persistChallengePatch(storage, 'conta', { reviews: { [second.id]: miss }, reviewDrafts: { 'sql-basic-3~v1': 'SELECT 1' } })
    for (const [key, value] of before) expect(storage.data.get(key)).toBe(value)

    const { state, warning } = readChallengeState(storage, 'conta')
    expect(warning).toBe('')
    expect(state.verified).toEqual([first.id])
    expect(state.completed).toEqual([first.id])
    expect(state.drafts[second.id]).toBe('rascunho v2')
    expect(state.reviews).toEqual({ [second.id]: miss })
    expect(state.reviewDrafts).toEqual({ 'sql-basic-3~v1': 'SELECT 1' })
  })

  it('descarta registros corrompidos e ids desconhecidos sem perder o resto', () => {
    const storage = memory()
    const [first] = CHALLENGES
    storage.setItem(`conta:challenges:v2:review:${first.id}`, '{"misses":"x"}')
    storage.setItem('conta:challenges:v2:reviewdraft:sql-basic-3~v1', JSON.stringify('SELECT 2'))
    storage.setItem('conta:challenges:v2:review:inexistente', JSON.stringify({ misses: 1, lastMissAt: at(1).toISOString() }))
    const { state } = readChallengeState(storage, 'conta')
    expect(state.reviews).toEqual({})
    expect(state.reviewDrafts).toEqual({ 'sql-basic-3~v1': 'SELECT 2' })
    const patched = applyChallengePatch(state, { reviews: { inexistente: withMiss(undefined, at(1)) }, reviewDrafts: { inexistente: 'x' } })
    expect(patched.reviews).toEqual({})
    expect(patched.reviewDrafts).toEqual({ 'sql-basic-3~v1': 'SELECT 2' })
  })

  it('inclui a revisão na exportação', () => {
    const state = applyChallengePatch(initialChallengeState(), { reviews: { [CHALLENGES[0].id]: withMiss(undefined, at(1)) } })
    expect(challengeBackup(state).state.reviews[CHALLENGES[0].id].misses).toBe(1)
  })
})

describe('variações de revisão', () => {
  it('há três por trilha, ligadas a exercícios existentes do mesmo nível', () => {
    for (const track of ['python', 'sql', 'git']) expect(VARIATIONS.filter((item) => item.track === track)).toHaveLength(3)
    expect(new Set(VARIATIONS.map((item) => item.id)).size).toBe(VARIATIONS.length)
    for (const variation of VARIATIONS) {
      const base = CHALLENGES.find((item) => item.id === variation.baseId)!
      expect(base, variation.id).toBeDefined()
      expect([variation.track, variation.level]).toEqual([base.track, base.level])
      expect(variation.prompt).not.toBe(base.prompt)
      expect(variation.hints).toHaveLength(2)
      expect(variationFor(base.id)).toBe(variation)
      if (variation.track === 'python') expect(variation.tests?.length).toBeGreaterThan(0)
      if (variation.track === 'sql') {
        expect(variation.prompt).toContain('CREATE TABLE')
        expect(variation.prompt).toContain('\n\nTarefa\n')
        expect(variation.extraData).toBeTruthy()
      }
    }
  })
})
