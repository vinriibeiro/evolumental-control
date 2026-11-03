import { describe, expect, it } from 'vitest'
import { nextAction, type FocusActionInput } from './nextAction'

const base: FocusActionInput = { reviewsDue: 0, cardsDue: 0, hasSubjects: true }

describe('próximo passo do dashboard', () => {
  it('prioriza uma sessão ativa ou pendente em vez de preparar outro bloco', () => {
    const input = { ...base, reviewsDue: 4, cardsDue: 5, todayBlock: { id: 'abc', subject: 'SQL', minutes: 30 } }
    expect(nextAction({ ...input, sessionStatus: 'active' })).toMatchObject({ kind: 'session', to: '/cronometro' })
    expect(nextAction({ ...input, sessionStatus: 'pending_review' })).toMatchObject({ kind: 'session', label: 'Confirmar sessão' })
    expect(nextAction({ ...input, sessionStatus: 'active', paused: true }).label).toBe('Voltar à sessão')
  })

  it('prioriza revisão vencida, bloco de hoje e flashcards nessa ordem', () => {
    const input = { ...base, cardsDue: 3, todayBlock: { id: 'a/b', subject: 'SQL', minutes: 25 } }
    expect(nextAction({ ...input, reviewsDue: 2 }).kind).toBe('review')
    expect(nextAction(input)).toMatchObject({ kind: 'block', to: '/cronometro?bloco=a%2Fb', title: 'SQL' })
    expect(nextAction({ ...base, cardsDue: 3 }).kind).toBe('cards')
  })

  it('oferece configuração inicial só quando ainda não há matérias', () => {
    expect(nextAction({ ...base, hasSubjects: false })).toMatchObject({ kind: 'setup', to: '/trilhas' })
    expect(nextAction(base)).toMatchObject({ kind: 'study', to: '/cronometro' })
  })
})
