import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/feedback'

const SUBJECT = { id: 's1', name: 'Téo 1' }
const TOPICS = [
  { id: 't1', subject_id: 's1', name: 'Ep 01', sort_order: 0, status: 'not_started' },
  { id: 't2', subject_id: 's1', name: 'Ep 02', sort_order: 1, status: 'not_started' },
]
const MATERIALS = [
  { id: 'm1', topic_id: 't1', title: 'Aula 1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { id: 'm2', topic_id: 't1', title: 'Aula 2', url: 'https://youtu.be/aaaaaaaaaaa' },
  { id: 'm3', topic_id: 't1', title: 'Site', url: 'https://example.com' },
  { id: 'm4', topic_id: 't2', title: 'Aula 3', url: 'https://youtu.be/bbbbbbbbbbb' },
]

vi.mock('@/hooks/data', () => ({
  useAll: (table: string) => ({ data: table === 'study_materials' ? MATERIALS : table === 'subjects' ? [SUBJECT] : TOPICS, isLoading: false, isError: false }),
  useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  invalidateTables: vi.fn(),
}))
vi.mock('@/app/data', () => ({ useBackend: () => ({ list: vi.fn(), update: vi.fn() }) }))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo' }) }))
vi.mock('@tanstack/react-query', async (orig) => ({ ...(await orig<object>()), useQueryClient: () => ({}) }))

import VideosPage from './VideosPage'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const renderPage = (path = '/videos') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <VideosPage />
      </MemoryRouter>
    </ToastProvider>,
  )
const src = () => document.querySelector('iframe')?.getAttribute('src') ?? ''

describe('tela de Vídeos', () => {
  it('abre o primeiro vídeo e "Prosseguir" avança, inclusive para a próxima lição', () => {
    renderPage()
    expect(src()).toContain('dQw4w9WgXcQ')
    expect(screen.getByText('Aula 1', { selector: 'h2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prosseguir' }))
    expect(src()).toContain('aaaaaaaaaaa')
    expect(src()).toContain('autoplay=1')
    expect(screen.getByText(/Próxima lição: Ep 02/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prosseguir' }))
    expect(src()).toContain('bbbbbbbbbbb')
    const last = screen.getByRole('button', { name: 'Fim da lista' }) as HTMLButtonElement
    expect(last.disabled).toBe(true)
  })

  it('abre direto no vídeo pedido pelo endereço e ignora links que não são do YouTube', () => {
    renderPage('/videos?video=m4')
    expect(src()).toContain('bbbbbbbbbbb')
    fireEvent.change(screen.getByLabelText('Lição'), { target: { value: 't1' } })
    expect(src()).toContain('dQw4w9WgXcQ')
    expect(screen.queryByText('Site')).toBeNull()
  })
})
