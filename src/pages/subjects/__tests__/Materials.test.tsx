import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/feedback'

const materials = [
  { id: 'm1', title: 'Git e GitHub — aula 1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30' },
  { id: 'm2', title: 'Site do curso', url: 'https://cursos.teomewhy.org/trilhas' },
  { id: 'm3', title: 'Anotação sem link', url: null },
]

vi.mock('@/hooks/data', () => ({
  useAll: () => ({ data: materials }),
  useInsert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemove: () => ({ mutate: vi.fn() }),
}))

import { Materials } from '../TopicPanel'

afterEach(cleanup)

const renderMaterials = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <Materials subjectId="s1" topicId="t1" />
      </MemoryRouter>
    </ToastProvider>,
  )

describe('materiais com vídeo do YouTube', () => {
  it('o título do vídeo leva para a tela de Vídeos, sem player dentro do tópico', () => {
    renderMaterials()
    expect(document.querySelector('iframe')).toBeNull()
    const link = screen.getByRole('link', { name: 'Assistir Git e GitHub — aula 1' })
    expect(link.getAttribute('href')).toBe('/videos?video=m1')
    expect(screen.getByRole('link', { name: /Abrir .* no YouTube/ }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')
  })

  it('links que não são do YouTube continuam abrindo em outra aba', () => {
    renderMaterials()
    const link = screen.getByRole('link', { name: /Site do curso/ })
    expect(link.getAttribute('href')).toBe('https://cursos.teomewhy.org/trilhas')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('button', { name: /Assistir Site do curso/ })).toBeNull()
  })
})
