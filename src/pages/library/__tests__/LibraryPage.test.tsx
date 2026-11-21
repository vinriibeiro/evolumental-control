import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { AuthProvider } from '@/app/auth'
import { libraryFor, resetLibrariesForTests } from '@/services/library'
import { PdfLibrary } from '@/services/pdfLibrary'
import { epubFile, makeEpub } from '@/test/epubFixture'

// A capa do PDF depende do pdf.js desenhando em canvas, que o jsdom não tem: aqui só os metadados.
const describePdf = vi.hoisted(() => vi.fn(async (): Promise<{ pageCount?: number; author?: string }> => ({ pageCount: 12, author: 'Autora do PDF' })))
vi.mock('../pdfCover', () => ({ describePdf, renderPdfCover: vi.fn() }))

import LibraryPage from '../LibraryPage'
import ReaderPage from '../ReaderPage'

const PDF_DB = 'evolumental-library-pdf'

beforeEach(async () => {
  await resetLibrariesForTests()
  await Dexie.delete(PDF_DB)
  localStorage.clear()
  describePdf.mockClear()
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
/** Lê os PDFs por uma conexão própria e a fecha, para o banco poder ser apagado entre os testes. */
async function pdfs<T>(fn: (library: PdfLibrary) => Promise<T>): Promise<T> {
  const library = new PdfLibrary('evolumental-library')
  try {
    return await fn(library)
  } finally {
    library.close()
  }
}
const pdfFile = (name: string, content = 'conteúdo') => new File([`%PDF-1.7\n${content}`], name, { type: 'application/pdf' })
const seed = async () => {
  const a = await lib().add(await epubFile('a.epub', { title: 'Pense em Estatística', author: 'Allen Downey', cover: true, chapter: 'a' }))
  const b = await lib().add(await epubFile('b.epub', { title: 'Python e R para Dados', author: 'Rick Scavetta', chapter: 'b' }))
  return { a: a.book, b: b.book }
}
const input = () => screen.getByLabelText('Arquivos EPUB ou PDF para adicionar') as HTMLInputElement
const openMenu = (title: string) => fireEvent.click(screen.getByRole('button', { name: `Ações de ${title}` }))
const choose = (label: string) => fireEvent.click(screen.getByRole('menuitem', { name: label }))

describe('Biblioteca — estante unificada', () => {
  it('mostra o estado vazio com o botão de adicionar e o aviso de privacidade', async () => {
    renderAt('/biblioteca')
    expect(await screen.findByText('Sua estante está vazia')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Adicionar livros' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/ficam guardados só neste navegador/)).toBeInTheDocument()
  })

  it('lista EPUBs e PDFs juntos, com capa, autor e progresso, e abre cada um no seu leitor', async () => {
    await seed()
    await pdfs((p) => p.add(pdfFile('Apostila_de_SQL.pdf')))
    renderAt('/biblioteca')
    expect(await screen.findByText('Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByText('Allen Downey')).toBeInTheDocument()
    expect(screen.getByText('Estante · 3 livros')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Python e R para Dados' })).toHaveAttribute('href', expect.stringMatching(/^\/livros\/[0-9a-f]+$/))
    expect(screen.getByRole('link', { name: 'Abrir Apostila de SQL' })).toHaveAttribute('href', expect.stringMatching(/^\/livros\/pdf\/[0-9a-f]{64}$/))
    // livro com capa usa a imagem; sem capa, a capa tipográfica
    expect(screen.getByAltText('Capa de Pense em Estatística')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Capa de Python e R para Dados' })).toBeInTheDocument()
    // o progresso do PDF é sempre apresentado como progresso de navegação
    expect(screen.getByRole('progressbar', { name: 'Progresso de navegação de Apostila de SQL' })).toBeInTheDocument()
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

describe('Biblioteca — adicionar e antiduplicidade', () => {
  it('importa EPUB e PDF, recusa outros formatos e não duplica o mesmo arquivo com outro nome', async () => {
    renderAt('/biblioteca')
    await screen.findByText('Sua estante está vazia')
    const novo = await makeEpub({ title: 'Livro Novo', author: 'Fulana', chapter: 'n' })
    fireEvent.change(input(), { target: { files: [new File([novo], 'novo.epub'), pdfFile('Manual.pdf'), new File(['oi'], 'notas.txt', { type: 'text/plain' })] } })
    expect(await screen.findByRole('link', { name: 'Abrir Livro Novo' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Abrir Manual' })).toBeInTheDocument()
    expect(await screen.findByText(/não é um EPUB nem um PDF/)).toBeInTheDocument()
    expect(await screen.findByText('2 livros adicionados à estante.')).toBeInTheDocument()
    // autor e páginas do PDF vêm do próprio arquivo
    expect(await pdfs((p) => p.list())).toMatchObject([{ title: 'Manual', author: 'Autora do PDF', pageCount: 12 }])

    // os mesmos arquivos, com outros nomes: reconhecidos pelo conteúdo, sem pergunta e sem cópia
    fireEvent.change(input(), { target: { files: [new File([novo], 'copia-renomeada.epub'), pdfFile('Manual (1).pdf')] } })
    expect(await screen.findByText('2 livros já estavam na estante.')).toBeInTheDocument()
    expect(await lib().list()).toHaveLength(1)
    expect(await pdfs((p) => p.list())).toHaveLength(1)
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

  it('PDF com o mesmo título de um EPUB da estante também é tratado como suspeito, não como igual', async () => {
    describePdf.mockResolvedValueOnce({ pageCount: 3 })
    await lib().add(await epubFile('a.epub', { title: 'Estruturas de Dados', author: 'Ana Souza', chapter: 'x' }))
    renderAt('/biblioteca')
    await screen.findByRole('link', { name: 'Abrir Estruturas de Dados' })
    fireEvent.change(input(), { target: { files: [pdfFile('Estruturas_de_Dados.pdf')] } })
    const dialog = await screen.findByRole('dialog', { name: 'Livro possivelmente duplicado' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar mesmo assim' }))
    expect(await screen.findByText('Estante · 2 livros')).toBeInTheDocument()
  })
})

describe('Biblioteca — remover, arquivar e excluir', () => {
  it('remover da estante esconde o livro, mantém arquivo e leitura, e dá para restaurar', async () => {
    const { a } = await seed()
    await lib().saveProgress(a.id, 'epubcfi(/6/2)', 42)
    renderAt('/biblioteca')
    await screen.findByText('Estante · 2 livros')
    openMenu('Pense em Estatística')
    choose('Remover da estante')
    expect(await screen.findByText('Estante · 1 livro')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir Pense em Estatística' })).not.toBeInTheDocument()
    // nada foi apagado: o arquivo abre e a posição continua lá
    expect((await lib().open(a.id)).byteLength).toBeGreaterThan(100)
    expect(await lib().get(a.id)).toMatchObject({ shelf: 'hidden', progress: 42, location: 'epubcfi(/6/2)' })

    fireEvent.click(screen.getByRole('radio', { name: 'Removidos (1)' }))
    expect(screen.getByRole('link', { name: 'Abrir Pense em Estatística' })).toBeInTheDocument()
    openMenu('Pense em Estatística')
    choose('Voltar para a estante')
    expect(await screen.findByText('Estante · 2 livros')).toBeInTheDocument()
    expect((await lib().get(a.id))?.shelf).toBe('active')
  })

  it('arquivar tira da estante e guarda em Arquivados (vale também para PDF)', async () => {
    await seed()
    const pdf = await pdfs((p) => p.add(pdfFile('Apostila.pdf')))
    renderAt('/biblioteca')
    await screen.findByText('Estante · 3 livros')
    openMenu('Apostila')
    choose('Arquivar')
    expect(await screen.findByText('Estante · 2 livros')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Arquivados (1)' }))
    expect(screen.getByRole('link', { name: 'Abrir Apostila' })).toBeInTheDocument()
    expect(await pdfs(async (p) => [(await p.get(pdf.id))?.shelf, (await p.file(pdf.id))?.byteLength])).toEqual(['archived', pdf.size])
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

describe('Biblioteca — leitor de EPUB', () => {
  it('avisa quando o livro não existe e oferece voltar à estante', async () => {
    renderAt('/livros/nao-existe')
    expect(await screen.findByText('Livro não encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à estante' })).toBeInTheDocument()
  })
})
