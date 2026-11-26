import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { AuthProvider } from '@/app/auth'
import { libraryFor, resetLibrariesForTests } from '@/services/library'
import { epubFile, makeEpub } from '@/test/epubFixture'
import LibraryPage from '../LibraryPage'
import ReaderPage from '../ReaderPage'

beforeEach(async () => {
  await resetLibrariesForTests()
  localStorage.clear()
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
                <Route path="/livros/:id" element={<ReaderPage />} />
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
const input = () => screen.getByLabelText('Arquivos EPUB para adicionar') as HTMLInputElement
const openMenu = (title: string) => fireEvent.click(screen.getByRole('button', { name: `Ações de ${title}` }))
const choose = (label: string) => fireEvent.click(screen.getByRole('menuitem', { name: label }))

describe('Estante — livros EPUB', () => {
  it('mostra o estado vazio com o botão de adicionar e o aviso de privacidade', async () => {
    renderAt('/biblioteca')
    expect(await screen.findByText('Sua estante está vazia')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Adicionar livros' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/ficam guardados só neste navegador/)).toBeInTheDocument()
  })

  it('lista livros EPUB com capa, autor e progresso e abre no leitor', async () => {
    await seed()
    renderAt('/biblioteca')
    expect(await screen.findByText('Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByText('Allen Downey')).toBeInTheDocument()
    expect(screen.getByText('Estante · 2 livros')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toHaveAttribute('href', expect.stringMatching(/^\/livros\/[0-9a-f]+$/))
    expect(screen.getByAltText('Capa de Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Capa de Python e R para Dados' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresso de Pense em Estatística' })).toBeInTheDocument()
  })

  it('alterna entre grade e lista e lembra a escolha', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    expect(screen.getByRole('button', { name: 'Ver em grade' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Ver em lista' }))
    expect(screen.getByRole('button', { name: 'Ver em lista' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    expect(localStorage.getItem('vlm.estante.visao')).toBe('list')
  })

  it('busca por título ou autor (sem acentos) e avisa quando nada é encontrado', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    fireEvent.change(screen.getByLabelText('Buscar livro'), { target: { value: 'scavetta' } })
    expect(screen.queryByRole('link', { name: 'Abrir Pense em Estatística' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar livro'), { target: { value: 'estatistica' } })
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar livro'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhum livro encontrado/)).toBeInTheDocument()
  })

  it('define o assunto de um livro e filtra a estante por ele', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    expect(screen.queryByLabelText('Filtrar por assunto')).not.toBeInTheDocument()
    openMenu('Pense em Estatística')
    choose('Editar detalhes')
    fireEvent.change(await screen.findByLabelText('Assunto'), { target: { value: 'Estatística' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    const filter = await screen.findByLabelText('Filtrar por assunto')
    fireEvent.change(filter, { target: { value: 'Estatística' } })
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir Python e R para Dados' })).not.toBeInTheDocument()
    expect((await lib().list()).find((b) => b.title === 'Pense em Estatística')?.subject).toBe('Estatística')
  })

  it('destaca o último livro acessado com a ação Continuar e filtra os em andamento', async () => {
    const { a } = await seed()
    await lib().saveProgress(a.id, 'epubcfi(/6/2)', 42)
    renderAt('/biblioteca')
    const section = await screen.findByRole('region', { name: 'Último livro acessado' })
    expect(within(section).getByText('Pense em Estatística')).toBeInTheDocument()
    expect(within(section).getByText('42% lido')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Continuar Pense em Estatística' })).toHaveAttribute('href', `/livros/${a.id}`)

    fireEvent.click(screen.getByRole('radio', { name: 'Em andamento' }))
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir Python e R para Dados' })).not.toBeInTheDocument()
  })

  it('marca favoritos e mostra só eles no filtro', async () => {
    await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar Python e R para Dados' }))
    expect(await screen.findByRole('button', { name: 'Tirar Python e R para Dados dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'Favoritos' }))
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir Pense em Estatística' })).not.toBeInTheDocument()
  })
})

describe('Estante — adicionar e antiduplicidade', () => {
  it('importa EPUB, recusa PDF e outros formatos e não duplica o mesmo arquivo com outro nome', async () => {
    renderAt('/biblioteca')
    await screen.findByText('Sua estante está vazia')
    const novo = await makeEpub({ title: 'Livro Novo', author: 'Fulana', chapter: 'n' })
    const pdf = new File(['%PDF-1.7\nconteúdo'], 'Manual.pdf', { type: 'application/pdf' })
    fireEvent.change(input(), { target: { files: [new File([novo], 'novo.epub'), pdf, new File(['oi'], 'notas.txt', { type: 'text/plain' })] } })
    expect(await screen.findByRole('link', { name: 'Abrir Livro Novo' })).toBeInTheDocument()
    expect(await screen.findByText(/Manual\.pdf.*não é um EPUB/)).toBeInTheDocument()
    expect(await screen.findByText('1 livro adicionado à estante.')).toBeInTheDocument()

    // o mesmo arquivo, com outro nome: reconhecido pelo conteúdo, sem pergunta e sem cópia
    fireEvent.change(input(), { target: { files: [new File([novo], 'copia-renomeada.epub')] } })
    expect(await screen.findByText('1 livro já estava na estante.')).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)
    expect(screen.queryByText('Livro possivelmente duplicado')).not.toBeInTheDocument()
  })

  it('arquivo diferente com o mesmo título e autor: pergunta antes e respeita a resposta', async () => {
    await lib().add(await epubFile('a.epub', { title: 'Dom Casmurro', author: 'Machado de Assis', chapter: 'edição 1' }))
    renderAt('/biblioteca')
    await screen.findByRole('link', { name: 'Abrir Dom Casmurro' })
    const outraEdicao = await epubFile('outra.epub', { title: 'Dom Casmurro', author: 'Machado de Assis', chapter: 'edição 2' })

    fireEvent.change(input(), { target: { files: [outraEdicao] } })
    const dialog = await screen.findByRole('dialog', { name: 'Livro possivelmente duplicado' })
    expect(dialog).toHaveTextContent(/Parece que este livro já está na estante: “Dom Casmurro”, de Machado de Assis/)
    expect(dialog).toHaveTextContent(/Adicionar mesmo assim\?/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Não adicionar' }))
    expect(await screen.findByText('1 arquivo não foi adicionado.')).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)

    fireEvent.change(input(), { target: { files: [outraEdicao] } })
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Livro possivelmente duplicado' })).getByRole('button', { name: 'Adicionar mesmo assim' }))
    await waitFor(async () => expect(await lib().list()).toHaveLength(2))
    expect(await screen.findByText('Estante · 2 livros')).toBeInTheDocument()
  })
})

describe('Estante — remover, arquivar e excluir', () => {
  it('remover da estante esconde o livro, mantém arquivo e leitura, e dá para restaurar', async () => {
    const { a } = await seed()
    await lib().saveProgress(a.id, 'epubcfi(/6/2)', 42)
    renderAt('/biblioteca')
    await screen.findByText('Estante · 2 livros')
    openMenu('Pense em Estatística')
    choose('Remover da estante')
    expect(await screen.findByText('Estante · 1 livro')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir Pense em Estatística' })).not.toBeInTheDocument()
    expect((await lib().open(a.id)).byteLength).toBeGreaterThan(100)
    expect(await lib().get(a.id)).toMatchObject({ shelf: 'hidden', progress: 42, location: 'epubcfi(/6/2)' })

    fireEvent.click(screen.getByRole('radio', { name: 'Removidos (1)' }))
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    openMenu('Pense em Estatística')
    choose('Voltar para a estante')
    expect(await screen.findByText('Estante · 2 livros')).toBeInTheDocument()
    expect((await lib().get(a.id))?.shelf).toBe('active')
  })

  it('arquivar tira da estante e guarda em Arquivados', async () => {
    const { a } = await seed()
    renderAt('/biblioteca')
    await screen.findByText('Estante · 2 livros')
    openMenu('Pense em Estatística')
    choose('Arquivar')
    expect(await screen.findByText('Estante · 1 livro')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Arquivados (1)' }))
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    expect((await lib().get(a.id))?.shelf).toBe('archived')
  })

  it('adicionar de novo um livro removido devolve à estante, sem duplicar', async () => {
    const data = await makeEpub({ title: 'Volta Logo', author: 'Autora', chapter: 'v' })
    const { book } = await lib().add(new File([data], 'volta.epub'))
    await lib().setShelf(book.id, 'hidden')
    renderAt('/biblioteca')
    await screen.findByText('Estante · 0 livros')
    fireEvent.change(input(), { target: { files: [new File([data], 'outro-nome.epub')] } })
    expect(await screen.findByText(/voltou para a estante/)).toBeInTheDocument()
    expect(await screen.findByText('Estante · 1 livro')).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)
  })

  it('excluir permanentemente pede confirmação com o nome do livro e não toca nos outros', async () => {
    const { a, b } = await seed()
    renderAt('/biblioteca')
    await screen.findByText('Pense em Estatística')
    openMenu('Pense em Estatística')
    choose('Excluir permanentemente')
    const dialog = await screen.findByRole('dialog', { name: 'Excluir permanentemente' })
    expect(dialog).toHaveTextContent(/Excluir “Pense em Estatística” de vez\?/)
    expect(dialog).toHaveTextContent(/não pode ser desfeita/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(await lib().list()).toHaveLength(2)

    openMenu('Pense em Estatística')
    choose('Excluir permanentemente')
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Excluir permanentemente' })).getByRole('button', { name: 'Excluir permanentemente' }))
    await waitFor(async () => expect(await lib().get(a.id)).toBeUndefined())
    await waitFor(() => expect(screen.queryByText('Pense em Estatística')).not.toBeInTheDocument())
    expect(await lib().get(b.id)).toBeDefined()
    expect((await lib().open(b.id)).byteLength).toBeGreaterThan(100)
  })
})

describe('Estante — leitor de EPUB', () => {
  it('avisa quando o livro não existe e oferece voltar à estante', async () => {
    renderAt('/livros/nao-existe')
    expect(await screen.findByText('Livro não encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à estante' })).toBeInTheDocument()
  })
})
