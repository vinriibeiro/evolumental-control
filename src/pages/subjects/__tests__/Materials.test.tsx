import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
      <Materials subjectId="s1" topicId="t1" />
    </ToastProvider>,
  )

describe('materiais com vídeo do YouTube', () => {
  it('toca o vídeo dentro do app ao clicar no título, no player sem cookies, e fecha', () => {
    renderMaterials()
    expect(document.querySelector('iframe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Assistir Git e GitHub — aula 1' }))
    const frame = document.querySelector('iframe')
    expect(frame?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=30')
    expect(frame?.getAttribute('title')).toBe('Vídeo: Git e GitHub — aula 1')
    expect(screen.getByRole('link', { name: /Abrir no YouTube/ }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar vídeo' }))
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('links que não são do YouTube continuam abrindo em outra aba', () => {
    renderMaterials()
    const link = screen.getByRole('link', { name: /Site do curso/ })
    expect(link.getAttribute('href')).toBe('https://cursos.teomewhy.org/trilhas')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('button', { name: /Assistir Site do curso/ })).toBeNull()
  })
})
