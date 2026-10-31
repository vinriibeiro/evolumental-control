import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { AuthProvider } from '@/app/auth'
import { libraryFor, resetLibrariesForTests } from '@/services/library'
import { epubFile } from '@/test/epubFixture'
import LibraryPage from '../LibraryPage'
import ReaderPage from '../ReaderPage'

beforeEach(async () => {
  await resetLibrariesForTests()
  URL.createObjectURL = vi.fn(() => 'blob:capa')
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/biblioteca" element={<LibraryPage />} />
              <Route path="/biblioteca/:id" element={<ReaderPage />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

const lib = () => libraryFor(null)
const seed = async () => {
  const a = await lib().add(await epubFile('a.epub', { title: 'Pense em Estatística', author: 'Allen Downey', cover: true, chapter: 'a' }))
  const b = await lib().add(await epubFile('b.epub', { title: 'Python e R para Dados', author: 'Rick Scavetta', chapter: 'b' }))
  return { a: a.book, b: b.book }
}

describe('Biblioteca — estante', () => {
  it('mostra o estado vazio com o botão de adicionar e o aviso de privacidade', async () => {
    renderAt('/biblioteca')
    expect(await screen.findByText('Sua estante está vazia')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Adicionar livros' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/ficam guardados só neste navegador/)).toBeInTheDocument()
  })

  it('lista os livros com título, autor e progresso, e abre o leitor pelo link', async () => {
    await seed()
    renderAt('/biblioteca')
    expect(await screen.findByText('Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByText('Allen Downey')).toBeInTheDocument()
    expect(screen.getByText('Estante · 2 livros')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toHaveAttribute('href', expect.stringMatching(/^\/biblioteca\/[0-9a-f]+$/))
    // livro com capa usa a imagem; sem capa, a capa gerada
    expect(screen.getByAltText('Capa de Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Capa de Python e R para Dados' })).toBeInTheDocument()
  })

  it('busca por título ou autor e avisa quando nada é encontrado', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    fireEvent.change(screen.getByLabelText('Buscar livro'), { target: { value: 'scavetta' } })
    expect(screen.queryByRole('link', { name: 'Abrir Pense em Estatística' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar livro'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhum livro encontrado/)).toBeInTheDocument()
  })

  it('mostra "Continuar lendo" só para livros começados', async () => {
    const { a } = await seed()
    await lib().saveProgress(a.id, 'epubcfi(/6/2)', 42)
    renderAt('/biblioteca')
    const section = await screen.findByRole('region', { name: 'Continuar lendo' })
    expect(within(section).getByText('Pense em Estatística')).toBeInTheDocument()
    expect(within(section).getByText('42% lido')).toBeInTheDocument()
    expect(within(section).queryByText('Python e R para Dados')).not.toBeInTheDocument()
  })

  it('importa EPUBs escolhidos, ignora duplicata e recusa PDF', async () => {
    renderAt('/biblioteca')
    await screen.findByText('Sua estante está vazia')
    const input = screen.getByLabelText('Arquivos EPUB para adicionar') as HTMLInputElement
    const novo = await epubFile('novo.epub', { title: 'Livro Novo', author: 'Fulana', chapter: 'n' })
    fireEvent.change(input, { target: { files: [novo, new File(['%PDF'], 'velho.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByRole('link', { name: 'Abrir Livro Novo' })).toBeInTheDocument()
    expect(await screen.findByText(/não é um EPUB/)).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)

    fireEvent.change(input, { target: { files: [novo] } })
    expect(await screen.findByText('1 livro já estava na estante.')).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)
  })

  it('remove o livro só depois de confirmar', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    fireEvent.click(screen.getByRole('button', { name: 'Remover Pense em Estatística' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await lib().list()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Remover Pense em Estatística' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await waitFor(async () => expect(await lib().list()).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('Pense em Estatística')).not.toBeInTheDocument())
  })
})

describe('Biblioteca — leitor', () => {
  it('avisa quando o livro não existe e oferece voltar à estante', async () => {
    renderAt('/biblioteca/nao-existe')
    expect(await screen.findByText('Livro não encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à estante' })).toBeInTheDocument()
  })
})
