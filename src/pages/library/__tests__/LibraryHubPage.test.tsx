import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/data', () => ({ useCount: (table: string) => ({ data: table === 'subjects' ? 4 : table === 'course_nodes' ? 9 : 1 }) }))

import LibraryHubPage, { LIBRARY_TOPICS } from '../LibraryHubPage'

afterEach(cleanup)

describe('Biblioteca (pasta de pastas)', () => {
  it('mostra cada tópico em um cartão próprio, na ordem do fluxo, com contagens', () => {
    render(
      <MemoryRouter>
        <LibraryHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Pastas da biblioteca' })
    const links = within(list).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/materias', '/trilhas', '/cursos', '/livros', '/audios', '/flashcards', '/banco-de-questoes'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual(LIBRARY_TOPICS.map((t) => t.to))
    expect(links[0]).toHaveTextContent('Matérias e tópicos')
    expect(links[0]).toHaveTextContent('4 matérias')
    expect(links[2]).toHaveTextContent('9 cursos')
    expect(links[5]).toHaveTextContent('1 baralho')
    for (const removed of ['Inglês', 'Vídeos', 'Revisões', 'Desempenho']) expect(within(list).queryByText(removed)).not.toBeInTheDocument()
  })
})
