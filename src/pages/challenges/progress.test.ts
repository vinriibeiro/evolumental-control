import { describe, expect, it } from 'vitest'
import { CHALLENGES, LEVELS, TRACKS } from './catalog'
import { challengeBackup, challengeStorageKey, nextUncompleted, parseChallengeState, persistChallengePatch, readChallengeState } from './progress'

describe('catálogo de desafios', () => {
  it('oferece cinco exercícios completos por linguagem e nível, sem IDs repetidos', () => {
    expect(CHALLENGES).toHaveLength(60)
    expect(new Set(CHALLENGES.map((challenge) => challenge.id)).size).toBe(60)
    for (const track of TRACKS) {
      for (const level of LEVELS) {
        expect(CHALLENGES.filter((challenge) => challenge.track === track.value && challenge.level === level.value)).toHaveLength(5)
      }
    }
    for (const challenge of CHALLENGES) {
      expect(challenge.prompt.trim().length).toBeGreaterThan(30)
      expect(challenge.solution.trim().length).toBeGreaterThan(10)
      expect(challenge.hints.length).toBeGreaterThan(0)
      expect(challenge.criteria.length).toBeGreaterThan(0)
    }
  })

  it('apresenta preparação explícita em todo exercício SQL', () => {
    for (const challenge of CHALLENGES.filter((item) => item.track === 'sql')) {
      expect(challenge.prompt).toContain('SQLite')
      expect(challenge.prompt).toContain('CREATE TABLE')
      expect(challenge.prompt).toContain('INSERT INTO')
    }
  })
})

describe('persistência independente de desafios', () => {
  const [first, second] = CHALLENGES
  const makeStorage = () => {
    const entries = new Map<string, string>()
    const instance = () => ({ getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) } })
    return { entries, instance }
  }

  it('duas instâncias com snapshots antigos preservam rascunhos de desafios diferentes', () => {
    const shared = makeStorage()
    const tabA = shared.instance()
    const tabB = shared.instance()
    expect(readChallengeState(tabA, 'conta').state.drafts).toEqual({})
    expect(readChallengeState(tabB, 'conta').state.drafts).toEqual({})
    persistChallengePatch(tabA, 'conta', { drafts: { [first.id]: 'print("A")' } })
    persistChallengePatch(tabB, 'conta', { drafts: { [second.id]: 'print("B")' } })
    expect(readChallengeState(tabA, 'conta').state.drafts).toEqual({ [first.id]: 'print("A")', [second.id]: 'print("B")' })
  })

  it('conclusões de outra instância não são perdidas nem ressuscitam ao desmarcar', () => {
    const shared = makeStorage()
    const tabA = shared.instance()
    const tabB = shared.instance()
    persistChallengePatch(tabA, 'conta', { completed: { [first.id]: true } })
    persistChallengePatch(tabB, 'conta', { completed: { [second.id]: true } })
    persistChallengePatch(tabA, 'conta', { completed: { [first.id]: false } })
    persistChallengePatch(tabB, 'conta', { drafts: { [second.id]: 'Novo rascunho' }, selectedId: second.id })
    expect(readChallengeState(tabA, 'conta').state.completed).toEqual([second.id])
    expect(readChallengeState(tabB, 'outra-conta').state.completed).toEqual([])
    expect(readChallengeState(tabB, 'outra-conta').state.drafts).toEqual({})
  })

  it('combina legado e v2 sem apagar o legado, preservando rascunho vazio e conclusão removida', () => {
    const storage = makeStorage().instance()
    const legacy = JSON.stringify({ drafts: { [first.id]: 'Antigo', [second.id]: 'Preservado' }, completed: [first.id, second.id] })
    storage.setItem(challengeStorageKey('conta'), legacy)
    persistChallengePatch(storage, 'conta', { drafts: { [first.id]: '' }, completed: { [first.id]: false } })
    expect(readChallengeState(storage, 'conta').state).toMatchObject({ drafts: { [first.id]: '', [second.id]: 'Preservado' }, completed: [second.id] })
    expect(storage.getItem(challengeStorageKey('conta'))).toBe(legacy)
  })

  it('preserva autoavaliações anteriores e registra aprovações por teste separadamente', () => {
    const storage = makeStorage().instance()
    storage.setItem(challengeStorageKey('conta'), JSON.stringify({ completed: [first.id], drafts: { [first.id]: 'Tentativa anterior' } }))
    persistChallengePatch(storage, 'conta', { verified: { [second.id]: true } })
    expect(readChallengeState(storage, 'conta').state).toMatchObject({
      completed: [first.id], verified: [second.id], drafts: { [first.id]: 'Tentativa anterior' },
    })
  })

  it('mantém o original inválido após leitura e após uma nova edição', () => {
    const shared = makeStorage()
    const storage = shared.instance()
    const original = '{dados anteriores incompletos'
    storage.setItem(challengeStorageKey('conta'), original)
    const loaded = readChallengeState(storage, 'conta')
    expect(loaded.warning).toContain('preservados')
    expect(shared.entries.size).toBe(1)
    persistChallengePatch(storage, 'conta', { drafts: { [first.id]: 'Nova tentativa' } })
    expect(readChallengeState(storage, 'conta').state.drafts[first.id]).toBe('Nova tentativa')
    expect(storage.getItem(challengeStorageKey('conta'))).toBe(original)
  })

  it('exporta o rascunho em memória e o original preservado, com identificação dos exercícios', () => {
    const state = parseChallengeState(JSON.stringify({ drafts: { [first.id]: 'Ainda não salvo' }, completed: [first.id] }))
    const backup = challengeBackup(state, '{original inválido')
    expect(backup).toMatchObject({ format: 'vlm-challenges', schemaVersion: 2, state: { drafts: { [first.id]: 'Ainda não salvo' } }, preservedLegacy: '{original inválido' })
    expect(backup.exercises).toEqual([{ id: first.id, title: first.title, track: first.track, level: first.level }])
    expect(JSON.parse(JSON.stringify(backup)).state).toEqual(state)
  })
})

describe('progressão de desafios', () => {
  const items = CHALLENGES.filter((challenge) => challenge.track === 'python' && challenge.level === 'first_steps')

  it('seleciona o primeiro pendente e percorre os exercícios sem repetir concluídos', () => {
    const completed: string[] = []
    const selected: string[] = []
    let current: string | null = null
    for (let index = 0; index < items.length; index++) {
      const next = nextUncompleted(items, completed, current)
      expect(next).not.toBeNull()
      current = next!.id
      selected.push(current)
      completed.push(current)
    }
    expect(selected).toEqual(items.map((challenge) => challenge.id))
    expect(nextUncompleted(items, completed, current)).toBeNull()
  })

  it('retorna ao início e ignora concluídos sem modificar a lista de progresso', () => {
    const completed = [items[1].id, items[2].id, items[3].id]
    expect(nextUncompleted(items, completed, items[4].id)?.id).toBe(items[0].id)
    expect(completed).toHaveLength(3)
    expect(nextUncompleted([], completed)).toBeNull()
  })

  it('recupera somente IDs e rascunhos válidos e separa as contas no armazenamento', () => {
    const id = items[0].id
    const parsed = parseChallengeState(JSON.stringify({ completed: [id, id, 'inexistente'], drafts: { [id]: 'print("Meu rascunho")', inexistente: 'ignorar' }, track: 'desconhecido', level: 'desconhecido' }))
    expect(parsed.completed).toEqual([id])
    expect(parsed.drafts).toEqual({ [id]: 'print("Meu rascunho")' })
    expect(parsed.track).toBe('python')
    expect(parsed.level).toBe('first_steps')
    expect(challengeStorageKey('conta-a')).not.toBe(challengeStorageKey('conta-b'))
    expect(() => parseChallengeState('{inválido')).toThrow()
  })
})
