import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { runQuery } from '@/game/lab/sqlCore'
import type { GameEvidenceInput } from '@/lib/data/types'
import type { SqlChallenge } from '../challenges'
import { WORLD } from '../content'
import { Terminal } from '../ui/Terminal'
import { SQL_SOLUTIONS } from './solutions'

let SQL: SqlJsStatic
const recorded: GameEvidenceInput[] = []

// O worker do SQLite não existe no jsdom: roda o mesmo núcleo direto.
vi.mock('@/game/lab/runSql', () => ({
  runSql: async (dataset: string, query: string) => {
    try {
      return { result: runQuery(SQL, dataset, query) }
    } catch (e) {
      return { error: (e as Error).message }
    }
  },
}))
vi.mock('@/app/data', () => ({
  useBackend: () => ({
    gameRecordEvidence: async (i: GameEvidenceInput) => {
      recorded.push(i)
      return { applied: true }
    },
  }),
}))
vi.mock('../ui/audio', () => ({ play: () => {} }))
vi.mock('../ui/Portrait', () => ({ Portrait: () => null }))

beforeAll(async () => {
  SQL = await initSqlJs()
})

function renderTerminal(ch: SqlChallenge) {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Terminal challenge={ch} sound={false} onSolved={() => true} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, editor: screen.getByLabelText('Comando SQL') }
}

describe('terminal pedagógico', () => {
  it('ficha de campo aberta na prática guiada, com exemplo executável', async () => {
    const user = userEvent.setup()
    renderTerminal(WORLD.challenges.sup_guided as SqlChallenge)
    expect(screen.getByText(/Objetivo:/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Executar o exemplo/ }))
    expect(await screen.findByText('3 linha(s)')).toBeInTheDocument()
  })

  it('pista só depois de tentar; cada degrau exige nova tentativa; evidência registra a ajuda usada', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { editor } = renderTerminal(WORLD.challenges.sup_guided as SqlChallenge)
    const hint = () => screen.getByRole('button', { name: /Pedir pista|explicação completa/ })
    expect(hint()).toBeDisabled()
    expect(screen.getByText(/Tente primeiro/)).toBeInTheDocument()

    // Tentativa errada (deixou os sublinhados) → feedback contextual e pista liberada.
    await user.click(screen.getByRole('button', { name: /^Executar Ctrl/ }))
    expect(await screen.findByText(/não entende "____"/)).toBeInTheDocument()
    expect(hint()).toBeEnabled()
    await user.click(hint())
    expect(screen.getByText('Pista 1:')).toBeInTheDocument()
    expect(hint()).toBeDisabled()

    await user.clear(editor)
    await user.type(editor, SQL_SOLUTIONS.sup_guided.replace(/[{[]/g, '$&$&'))
    await user.click(screen.getByRole('button', { name: /^Executar Ctrl/ }))
    expect(await screen.findByText(/O painel acende/)).toBeInTheDocument()
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'sup_guided', help: 1, attempts: 2, solved: true })
    expect(recorded[0].answer).toMatch(/^2\|/)
    expect(await screen.findByText(/prática guiada resolvida com 1 pista/)).toBeInTheDocument()
  })

  it('sair depois de tentar sem resolver registra a dificuldade (uma vez)', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { onClose } = renderTerminal(WORLD.challenges.sup_independent as SqlChallenge)
    await user.click(screen.getByRole('button', { name: 'Fechar terminal' }))
    expect(recorded).toHaveLength(0) // sem tentativa: nada registrado
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
