import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/feedback'
import StudyCardsPage from './StudyCardsPage'

const makeCard = (id: string, front: string, back: string) => ({
  id, front, back, note: 'Nota reservada', tags: [], status: 'new', ease: 2.5,
  interval_days: 0, repetitions: 0, lapses: 0, due_at: '2026-01-01T00:00:00Z',
})
const cards = [
  makeCard('card-1', 'Good morning & welcome!', 'Resposta reservada'),
  makeCard('card-2', 'Where is the station?', 'Segunda resposta reservada'),
]

vi.mock('@/app/data', () => ({
  useBackend: () => ({
    kind: 'local',
    list: async () => ({ rows: cards }),
    getProfile: async () => ({ settings: { autoRead: false } }),
  }),
}))

function renderStudy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/flashcards/revisar?modo=todos']}>
          <StudyCardsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('tradução da pergunta durante a revisão', () => {
  it('Traduzir pelo teclado usa só a pergunta e preserva a resposta oculta', async () => {
    const translate = vi.fn(async () => 'Bom dia e boas-vindas!')
    const destroy = vi.fn()
    const create = vi.fn(async () => ({ translate, destroy }))
    vi.stubGlobal('Translator', { create })
    renderStudy()

    const button = await screen.findByRole('button', { name: 'Traduzir pergunta' })
    expect(create).not.toHaveBeenCalled()
    button.focus()
    await userEvent.setup().keyboard('{Enter}')

    expect(await screen.findByText('Bom dia e boas-vindas!')).toBeVisible()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'pt' }))
    expect(translate).toHaveBeenCalledWith(cards[0].front, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(destroy).toHaveBeenCalledOnce()
    expect(screen.queryByText(cards[0].back)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mostrar resposta/ })).toBeVisible()
  })

  it('cancela ao avançar e ignora uma tradução que termina depois', async () => {
    let finish!: (value: string) => void
    const pending = new Promise<string>((resolve) => { finish = resolve })
    const translate = vi.fn((_text: string, _options: { signal: AbortSignal }) => pending)
    vi.stubGlobal('Translator', { create: vi.fn(async () => ({ translate })) })
    renderStudy()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Traduzir pergunta' }))
    await waitFor(() => expect(translate).toHaveBeenCalledOnce())
    expect(screen.getByText('Traduzindo a pergunta…')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: /Registrar respostas no agendamento/ }))
    await user.click(screen.getByRole('button', { name: /Mostrar resposta/ }))
    await user.click(screen.getByRole('button', { name: /^Bom/ }))

    expect(await screen.findByText(cards[1].front)).toBeVisible()
    expect(translate.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => finish('Tradução do cartão anterior'))
    expect(screen.queryByText('Tradução do cartão anterior')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Traduzir pergunta' })).toBeVisible()
  })

  it('oferece saída externa explícita sem colocar a resposta ou nota na URL', async () => {
    vi.stubGlobal('Translator', undefined)
    renderStudy()
    const user = userEvent.setup()
    expect(screen.queryByRole('link', { name: /Abrir no Google Tradutor/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Traduzir pergunta' }))

    const link = screen.getByRole('link', { name: /Abrir no Google Tradutor/ })
    const url = new URL(link.getAttribute('href') ?? '')
    expect(url.origin).toBe('https://translate.google.com')
    expect(Object.fromEntries(url.searchParams)).toEqual({ sl: 'en', tl: 'pt', op: 'translate', text: cards[0].front })
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText(cards[0].back)).not.toBeInTheDocument()
  })
})
