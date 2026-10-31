import 'fake-indexeddb/auto'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/app/auth'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { audioLibraryFor, resetAudioLibrariesForTests } from '@/services/audio'

const SUBJECT = { id: 's1', name: 'Inglês · Times Book 1' }
const TOPICS = [
  { id: 't1', subject_id: 's1', name: 'Lesson 01 · Nice to meet you', sort_order: 0, status: 'not_started' },
  { id: 't2', subject_id: 's1', name: 'Lesson 02', sort_order: 1 },
  { id: 't3', subject_id: 's1', name: 'Lesson 03 · At the Cafe', sort_order: 2 },
]

vi.mock('@/hooks/data', () => ({
  useAll: (table: string) => ({ data: table === 'subjects' ? [SUBJECT] : TOPICS }),
  useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  invalidateTables: vi.fn(),
}))

vi.mock('@/app/data', () => ({ useBackend: () => ({ list: vi.fn(), update: vi.fn() }) }))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo' }) }))

import AudiosPage from '../AudiosPage'

let seed = 0
const mp3 = (name: string) => new File([new Uint8Array(32).fill(++seed)], name, { type: 'audio/mpeg' })

beforeEach(async () => {
  vi.stubGlobal('Audio', undefined)
  await resetAudioLibrariesForTests()
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <MemoryRouter>
              <AudiosPage />
            </MemoryRouter>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('tela de áudios', () => {
  it('sem áudios mostra como começar', async () => {
    renderPage()
    expect(await screen.findByText('Nenhum áudio ainda')).toBeTruthy()
  })

  it('lista só as lições que têm áudio e mostra as faixas da escolhida, sem abrir o tópico', async () => {
    const lib = audioLibraryFor(null)
    await lib.add('t1', mp3('L01_T01_pag07.mp3'))
    await lib.add('t1', mp3('L01_T02_pag09.mp3'))
    await lib.add('t3', mp3('L03_T11.mp3'))
    renderPage()

    const select = (await screen.findByRole('combobox', { name: 'Lição' })) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Lesson 01 · Nice to meet you (2 faixas)', 'Lesson 03 · At the Cafe (1 faixa)'])
    expect(await screen.findByRole('button', { name: 'Tocar Track 1 · pág. 7' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Tocar$/ })).toBeTruthy()
    // o botão de remover fica só no tópico
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull()

    fireEvent.change(select, { target: { value: 't3' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tocar Track 11' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Tocar Track 1 · pág. 7' })).toBeNull()
    expect(localStorage.getItem('evolumental.audio.topic')).toBe('t3')
  })
})
