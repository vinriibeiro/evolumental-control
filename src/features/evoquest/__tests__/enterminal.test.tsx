import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { GameEvidenceInput } from '@/lib/data/types'
import type { EnChallenge } from '../challenges'
import { WORLD } from '../content'
import { EnTerminal } from '../ui/EnTerminal'
import { EN_SOLUTIONS } from './solutions'

const recorded: GameEvidenceInput[] = []
const spoken: Array<{ texts: string[]; rate: number }> = []

// O jsdom não tem Web Speech: a voz vira um registro do que seria lido.
vi.mock('@/game/speech', () => ({
  speechAvailable: () => true,
  speakAll: (texts: string[], _lang: string, rate: number) => spoken.push({ texts, rate }),
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

function renderRadio(ch: EnChallenge) {
  const onClose = vi.fn()
  const onSolved = vi.fn(() => true)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EnTerminal challenge={ch} sound={false} onSolved={onSolved} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, onSolved }
}
const send = () => screen.getByRole('button', { name: /^Transmitir resposta/ })

describe('rádio pedagógico (inglês)', () => {
  it('ditado guiado: ficha com exemplo falado, transmissão só por voz, pista depois de tentar, retorno contextual e evidência', async () => {
    recorded.length = 0
    spoken.length = 0
    const user = userEvent.setup()
    const { onSolved } = renderRadio(WORLD.challenges.radio_guided as EnChallenge)
    expect(screen.getByText(/Objetivo:/)).toBeInTheDocument()
    // O texto da transmissão não aparece antes de resolver (só a voz).
    expect(screen.queryByText(/This is the Blue Star/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ouvir o exemplo/ }))
    expect(spoken.at(-1)).toEqual({ texts: ['Gate number fourteen. I repeat: one, four.'], rate: 1 })
    // Há um "Devagar" na ficha (exemplo) e outro na transmissão: o último é o da transmissão.
    await user.click(screen.getAllByRole('button', { name: 'Devagar' }).at(-1)!)
    expect(spoken.at(-1)).toEqual({ texts: ['Hello, Babel. This is the Blue Star. Gate seven, please.'], rate: 0.6 })

    const hint = () => screen.getByRole('button', { name: /Pedir pista|explicação completa/ })
    expect(hint()).toBeDisabled()
    const box = screen.getByLabelText('Escreva aqui o que o navio disse, em inglês')
    fireEvent.change(box, { target: { value: 'Hello, Babel. This is the Blue Star. Gate eleven, please.' } })
    await user.click(send())
    expect(await screen.findByText(/número do portão não bateu/)).toBeInTheDocument()
    expect(hint()).toBeEnabled()
    await user.click(hint())
    expect(screen.getByText('Pista 1:')).toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'hello babel this is the blue star gate 7 please' } })
    await user.click(send())
    expect(await screen.findByText(/Blue Star, portão sete/)).toBeInTheDocument()
    expect(onSolved).toHaveBeenCalledTimes(1)
    expect(onSolved).toHaveBeenCalledWith('hello babel this is the blue star gate seven please')
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'radio_guided', help: 1, attempts: 2, solved: true, answer: 'hello babel this is the blue star gate seven please' })
    expect(await screen.findByText(/prática guiada resolvida com 1 pista/)).toBeInTheDocument()
    // Resolvido: transcrição e tradução aparecem.
    expect(screen.getByText(/This is the Blue Star/)).toBeInTheDocument()
    expect(screen.getByText(/Tradução:/)).toBeInTheDocument()
  })

  it('registro (formulário): números por extenso valem; campo errado é apontado sem revelar o valor', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { onSolved } = renderRadio(WORLD.challenges.radio_independent as EnChallenge)
    await user.type(screen.getByLabelText('Contêineres'), 'fifteen')
    await user.type(screen.getByLabelText('Portão'), 'eleven')
    await user.type(screen.getByLabelText(/Hora/), '9')
    await user.click(send())
    expect(await screen.findByText(/hora não bateu/)).toBeInTheDocument()
    expect(screen.getAllByText('✓ confere')).toHaveLength(2)
    expect(screen.getAllByText('✗ não confere')).toHaveLength(1)
    await user.clear(screen.getByLabelText(/Hora/))
    await user.type(screen.getByLabelText(/Hora/), 'four')
    await user.click(send())
    expect(await screen.findByText(/portão do cais sobe/)).toBeInTheDocument()
    expect(onSolved).toHaveBeenCalledWith('15|11|4')
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'radio_independent', help: 0, attempts: 2, solved: true, answer: '15|11|4' })
  })

  it('mostrar a transcrição vale como explicação completa: resolve, mas conta só como contato', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    renderRadio(WORLD.challenges.radio_transfer as EnChallenge)
    await user.click(screen.getByRole('button', { name: /mostrar a transcrição/ }))
    expect(screen.getByText(/K, A, L, I, N, A/)).toBeInTheDocument()
    const sol = EN_SOLUTIONS.radio_transfer as Record<string, string>
    await user.type(screen.getByLabelText(/Nome do navio/), sol.name)
    await user.type(screen.getByLabelText('Contêineres'), sol.containers)
    await user.type(screen.getByLabelText('Portão'), sol.gate)
    await user.click(send())
    expect(await screen.findByText(/Registrado: KALINA/)).toBeInTheDocument()
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'radio_transfer', help: 4, solved: true, answer: 'KALINA|18|20' })
    expect(await screen.findByText(/conta como contato com o conceito/)).toBeInTheDocument()
  })

  it('sair sem tentar não registra nada; sair depois de tentar registra a dificuldade', async () => {
    recorded.length = 0
    const user = userEvent.setup()
    const { onClose } = renderRadio(WORLD.challenges.radio_menu as EnChallenge)
    await user.click(screen.getByRole('button', { name: 'Fechar rádio' }))
    expect(recorded).toHaveLength(0)
    expect(onClose).toHaveBeenCalledTimes(1)

    renderRadio(WORLD.challenges.radio_menu as EnChallenge)
    const [gates] = screen.getAllByLabelText(/Lista de portões/)
    await user.type(gates, '3')
    await user.click(screen.getAllByRole('button', { name: /^Transmitir resposta/ })[1])
    expect(await screen.findByText(/Preencha todos os campos/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Fechar rádio' })[1])
    await waitFor(() => expect(recorded).toHaveLength(1))
    expect(recorded[0]).toMatchObject({ activity: 'radio_menu', solved: false, attempts: 1, answer: null })
  })
})
