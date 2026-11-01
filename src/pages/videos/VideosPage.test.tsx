import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/feedback'

const SUBJECTS = [{ id: 's1', name: 'Téo 1' }, { id: 's2', name: 'Téo 2' }]
const TOPICS = [
  { id: 't1', subject_id: 's1', name: 'Ep 01', sort_order: 0, status: 'not_started' },
  { id: 't2', subject_id: 's1', name: 'Ep 02', sort_order: 1, status: 'not_started' },
  { id: 't3', subject_id: 's2', name: 'Aula de Python', sort_order: 0, status: 'not_started' },
]
const MATERIALS = [
  { id: 'm1', topic_id: 't1', title: 'Aula 1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { id: 'm2', topic_id: 't1', title: 'Aula 2', url: 'https://youtu.be/aaaaaaaaaaa' },
  { id: 'm3', topic_id: 't1', title: 'Site', url: 'https://example.com' },
  { id: 'm4', topic_id: 't2', title: 'Aula 3', url: 'https://youtu.be/bbbbbbbbbbb' },
  { id: 'm5', topic_id: 't3', title: 'Python 1', url: 'https://youtu.be/ccccccccccc' },
]

vi.mock('@/hooks/data', () => ({
  useAll: (table: string) => ({ data: table === 'study_materials' ? MATERIALS : table === 'subjects' ? SUBJECTS : TOPICS, isLoading: false, isError: false }),
  useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  invalidateTables: vi.fn(),
}))
vi.mock('@/app/data', () => ({ useBackend: () => ({ list: vi.fn(), update: vi.fn() }) }))
vi.mock('./VideoStudyTimer', () => ({ VideoStudyTimer: () => <div>Temporizador de estudo</div> }))
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
const panel = () => within(screen.getByRole('complementary', { name: 'Conteúdo' }))

describe('tela de Vídeos', () => {
  it('modo cinema e retorno preservam o iframe e Escape restaura a visualização', () => {
    renderPage()
    const iframe = document.querySelector('iframe')
    fireEvent.click(screen.getByRole('button', { name: 'Modo cinema' }))
    expect(document.querySelector('[data-theater="true"]')).toBeTruthy()
    expect(document.querySelector('iframe')).toBe(iframe)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-theater="true"]')).toBeNull()
    expect(document.querySelector('iframe')).toBe(iframe)
  })

  it('Anterior retorna ao vídeo precedente e não ultrapassa o início da fila', () => {
    renderPage('/videos?video=m2')
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(src()).toContain('dQw4w9WgXcQ')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  it('usa modo cinema quando o navegador não oferece tela cheia', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }))
    expect(document.querySelector('[data-theater="true"]')).toBeTruthy()
  })

  it('abre o primeiro vídeo e "Prosseguir" avança, inclusive para a próxima aula e disciplina', () => {
    renderPage()
    expect(src()).toContain('dQw4w9WgXcQ')
    expect(screen.getByText('Aula 1', { selector: 'h2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prosseguir' }))
    expect(src()).toContain('aaaaaaaaaaa')
    expect(src()).toContain('autoplay=1')
    expect(screen.getByText(/A seguir:/).textContent).toContain('Aula 3 · Ep 02')
    fireEvent.click(screen.getByRole('button', { name: 'Prosseguir' }))
    expect(src()).toContain('bbbbbbbbbbb')
    fireEvent.click(screen.getByRole('button', { name: 'Prosseguir' }))
    expect(src()).toContain('ccccccccccc')
    expect((screen.getByRole('button', { name: 'Fim da lista' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('abre direto no vídeo pedido pelo endereço e ignora links que não são do YouTube', () => {
    renderPage('/videos?video=m4')
    expect(src()).toContain('bbbbbbbbbbb')
    expect(screen.queryByText('Site')).toBeNull()
  })
})

describe('painel de conteúdo (disciplina → aula → vídeo)', () => {
  it('lista as disciplinas, abre só a do vídeo atual e troca de vídeo ao clicar', () => {
    renderPage()
    const subjectButtons = panel().getAllByRole('button', { expanded: undefined }).filter((b) => b.hasAttribute('aria-expanded'))
    expect(subjectButtons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false'])
    expect(panel().queryByText('Python 1')).toBeNull()
    fireEvent.click(subjectButtons[1])
    fireEvent.click(panel().getByRole('button', { name: /Python 1/ }))
    expect(src()).toContain('ccccccccccc')
    expect(panel().getByRole('button', { name: /Python 1/ }).getAttribute('aria-current')).toBe('true')
  })

  it('a busca filtra por disciplina, aula ou título do vídeo, sem considerar acento', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Buscar conteúdo'), { target: { value: 'PYTHON' } })
    expect(panel().getByRole('button', { name: /Python 1/ })).toBeTruthy()
    expect(panel().queryByText('Aula 1')).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar conteúdo'), { target: { value: 'ep 02' } })
    expect(panel().getByRole('button', { name: /Aula 3/ })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar conteúdo'), { target: { value: 'nada disso' } })
    expect(screen.getByText('Nada encontrado para essa busca.')).toBeTruthy()
  })

  it('Concluir marca o vídeo como assistido, mostra o progresso e lembra neste aparelho', () => {
    renderPage()
    expect(panel().getAllByText(/· 0%$/)).toHaveLength(2)
    expect(panel().getByText('0 de 4 assistidos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.getByRole('button', { name: 'Concluído' }).getAttribute('aria-pressed')).toBe('true')
    expect(panel().getByText('1/3 · 33%')).toBeTruthy()
    expect(panel().getByText('1 de 4 assistidos')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('evolumental.video.done') ?? '[]')).toEqual(['m1'])
    fireEvent.click(screen.getByRole('button', { name: 'Concluído' }))
    expect(panel().getAllByText(/· 0%$/)).toHaveLength(2)
  })

  it('o painel pode ser ocultado e a escolha fica guardada', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar conteúdo' }))
    expect(screen.queryByRole('complementary', { name: 'Conteúdo' })).toBeNull()
    expect(localStorage.getItem('evolumental.video.panel')).toBe('closed')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar conteúdo' }))
    expect(screen.getByRole('complementary', { name: 'Conteúdo' })).toBeTruthy()
  })
})
