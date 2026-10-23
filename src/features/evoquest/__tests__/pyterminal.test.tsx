import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { GameEvidenceInput } from '@/lib/data/types'
import type { PyChallenge } from '../challenges'
import { WORLD } from '../content'
import { PyTerminal } from '../ui/PyTerminal'
import { collectLocal, PYTHON_AVAILABLE } from './pyLocal'
import { PY_SOLUTIONS } from './solutions'

const recorded: GameEvidenceInput[] = []

// O worker do Pyodide não existe no jsdom: roda o mesmo harness no CPython local.
vi.mock('@/game/lab/runPython', () => ({
  collectPython: async (i: { code: string; entry: string; cases: unknown[][] }) => collectLocal(i.code, i.entry, i.cases),
  execPython: async () => ({ stdout: "{'TI': 3, 'RH': 2, 'Compras': 1}\n" }),
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

function renderTerminal(ch: PyChallenge) {
  const onClose = vi.fn()
  const onSolved = vi.fn(() => true)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PyTerminal challenge={ch} sound={false} onSolved={onSolved} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, onSolved, editor: screen.getByLabelText('Código Python') as HTMLTextAreaElement }
}

describe.skipIf(!PYTHON_AVAILABLE)('terminal Python pedagógico', () => {
  it('ficha de campo aberta na prática guiada, com exemplo Python executável e casos visíveis', async () => {
    const user = userEvent.setup()
    renderTerminal(WORLD.challenges.line_guided as PyChallenge)
    expect(screen.getByText(/Objetivo:/)).toBeInTheDocument()
    expect(screen.getByText(/Caso 1 · Turno da manhã/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Executar o exemplo/ }))
    expect(await screen.findByLabelText('Saída do exemplo')).toHaveTextContent("{'TI': 3, 'RH': 2, 'Compras': 1}")
  })

  it('pista só depois de tentar; retorno contextual; evidência registra a ajuda e a resposta canônica', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { editor, onSolved } = renderTerminal(WORLD.challenges.line_guided as PyChallenge)
    const hint = () => screen.getByRole('button', { name: /Pedir pista|explicação completa/ })
    expect(hint()).toBeDisabled()

    // Tentativa com os sublinhados → retorno contextual, caso a caso, e pista liberada.
    await user.click(screen.getByRole('button', { name: /^Executar Ctrl/ }))
    expect(await screen.findByText(/não entende "____"/)).toBeInTheDocument()
    expect(screen.getByText(/✗ Caso 1/)).toBeInTheDocument()
    expect(hint()).toBeEnabled()
    await user.click(hint())
    expect(screen.getByText('Pista 1:')).toBeInTheDocument()
    expect(hint()).toBeDisabled()

    fireEvent.change(editor, { target: { value: PY_SOLUTIONS.line_guided } })
    await user.click(screen.getByRole('button', { name: /^Executar Ctrl/ }))
    expect(await screen.findByText(/O controlador acende/)).toBeInTheDocument()
    expect(onSolved).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'line_guided', help: 1, attempts: 2, solved: true })
    expect(recorded[0].answer).toMatch(/^3\|/)
    expect(await screen.findByText(/prática guiada resolvida com 1 pista/)).toBeInTheDocument()
  })

  it('sair sem tentar não registra nada; sair depois de tentar registra a dificuldade', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { onClose } = renderTerminal(WORLD.challenges.line_independent as PyChallenge)
    await user.click(screen.getByRole('button', { name: 'Fechar terminal' }))
    expect(recorded).toHaveLength(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
