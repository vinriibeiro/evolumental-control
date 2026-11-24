import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudPdf, PdfCloud } from '../pdfLibrarySupabase'
import { PDF_MAX_FILE_BYTES, PdfLibrary, type PdfAnnotation, type PdfBook } from '../pdfLibrary'

const libraries: PdfLibrary[] = []
let nextScope = 0
const pdfFile = (name = 'Meu_Material.pdf', content = '%PDF-1.7\nmaterial de teste') => new File([content], name, { type: 'application/pdf' })
function shelf(scope = `pdf-test-${++nextScope}`, cloud?: PdfCloud) {
  const library = new PdfLibrary(scope, cloud)
  libraries.push(library)
  return library
}
const mark: PdfAnnotation = { id: 'highlight-1', page: 2, type: 'highlight', color: '#f2c94c', rects: [{ x: 70, y: 410, width: 120, height: 16 }], createdAt: '2026-11-03T12:00:00.000Z', quote: 'Informação importante' }

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  const names = [...new Set(libraries.map((library) => library.dbName))]
  libraries.splice(0).forEach((library) => library.close())
  await Promise.all(names.map((name) => Dexie.delete(name)))
})

describe('biblioteca local de PDFs', () => {
  it('zera a posição e as páginas visitadas sem perder marcas nem bytes', async () => {
    const library = shelf()
    const file = pdfFile()
    const book = await library.add(file)
    await library.update(book.id, { pageCount: 5, currentPage: 3, visitedPages: [1, 3], annotations: [mark], bookmarks: [2], lastReadAt: '2026-11-22T12:00:00Z' })
    await library.resetReadingProgress()
    const reset = await library.get(book.id)
    expect(reset).toMatchObject({ currentPage: 1, visitedPages: [], annotations: [mark], bookmarks: [2] })
    expect(reset?.lastReadAt).toBeUndefined()
    expect(new Uint8Array((await library.file(book.id))!)).toEqual(new Uint8Array(await file.arrayBuffer()))
  })

  it('guarda o arquivo original com ID SHA256 e metadados iniciais', async () => {
    const library = shelf()
    const file = pdfFile()
    const book = await library.add(file)
    expect(book).toMatchObject({ title: 'Meu Material', fileName: 'Meu_Material.pdf', pageCount: 1, currentPage: 1, annotations: [], bookmarks: [] })
    expect(book.id).toMatch(/^[a-f0-9]{64}$/)
    expect(book.size).toBe(file.size)
    expect(new Uint8Array((await library.file(book.id))!)).toEqual(new Uint8Array(await file.arrayBuffer()))
    expect(await library.list()).toEqual([book])
  })

  it('retoma página, marcadores e anotações após fechar e reabrir o banco', async () => {
    const scope = `pdf-test-${++nextScope}`
    const original = shelf(scope)
    const book = await original.add(pdfFile())
    await original.update(book.id, { pageCount: 6, currentPage: 3, annotations: [mark], bookmarks: [4, 2, 4], lastReadAt: '2026-11-03T15:00:00.000Z' })
    original.close()
    const reopened = shelf(scope)
    expect(await reopened.get(book.id)).toMatchObject({ pageCount: 6, currentPage: 3, annotations: [mark], bookmarks: [2, 4], lastReadAt: '2026-11-03T15:00:00.000Z' })
    expect(await reopened.file(book.id)).toBeDefined()
  })

  it('deduplica pelo conteúdo, inclusive simultaneamente, sem apagar progresso', async () => {
    const library = shelf()
    const [first, duplicate] = await Promise.all([library.add(pdfFile('um.pdf')), library.add(pdfFile('dois.pdf'))])
    expect(first.id).toBe(duplicate.id)
    await library.update(first.id, { pageCount: 3, currentPage: 2, annotations: [mark], bookmarks: [2] })
    const again = await library.add(pdfFile('outro-nome.pdf'))
    expect(again).toMatchObject({ currentPage: 2, annotations: [mark], bookmarks: [2] })
    expect(await library.list()).toHaveLength(1)
  })

  it('isola arquivos e marcações entre os espaços de contas', async () => {
    const first = shelf()
    const other = shelf()
    const book = await first.add(pdfFile())
    expect(await other.get(book.id)).toBeUndefined()
    expect(await other.file(book.id)).toBeUndefined()
    expect(await other.list()).toEqual([])
    await other.add(pdfFile())
    await first.update(book.id, { pageCount: 3, annotations: [mark] })
    expect((await other.get(book.id))?.annotations).toEqual([])
    await first.remove(book.id)
    expect(await other.file(book.id)).toBeDefined()
  })

  it('recusa arquivo disfarçado e acima de 100 MiB sem guardar dados', async () => {
    const library = shelf()
    await expect(library.add(pdfFile('disfarcado.pdf', 'nao sou um PDF'))).rejects.toThrow(/assinatura/)
    const huge = pdfFile()
    Object.defineProperty(huge, 'size', { value: PDF_MAX_FILE_BYTES + 1 })
    const read = vi.spyOn(huge, 'arrayBuffer')
    await expect(library.add(huge)).rejects.toThrow(/100 MiB/)
    expect(read).not.toHaveBeenCalled()
    expect(await library.list()).toEqual([])
  })

  it('desfaz a gravação do arquivo se a gravação dos metadados falhar', async () => {
    const library = shelf()
    const file = pdfFile()
    const bytes = await file.arrayBuffer()
    const hash = await webcrypto.subtle.digest('SHA-256', bytes)
    const id = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const database = (library as unknown as { db: { books: Table<PdfBook, string> } }).db
    vi.spyOn(database.books, 'add').mockRejectedValueOnce(new DOMException('Sem espaço', 'QuotaExceededError'))
    await expect(library.add(file)).rejects.toThrow(/Sem espaço/)
    expect(await library.file(id)).toBeUndefined()
    expect(await library.get(id)).toBeUndefined()
  })

  it('remove o arquivo e os metadados juntos', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    await library.remove(book.id)
    expect(await library.get(book.id)).toBeUndefined()
    expect(await library.file(book.id)).toBeUndefined()
    expect(await library.list()).toEqual([])
  })

  it('recusa marcações e marcadores inválidos sem alterar a leitura anterior', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    await library.update(book.id, { pageCount: 4, currentPage: 2 })
    await expect(library.update(book.id, { currentPage: 3, annotations: [{ ...mark, page: 5 }] })).rejects.toThrow(/página/)
    await expect(library.update(book.id, { annotations: [{ ...mark, rects: [{ x: Number.NaN, y: 20, width: 30, height: 10 }] }] })).rejects.toThrow(/coordenadas/)
    await expect(library.update(book.id, { bookmarks: [0] })).rejects.toThrow(/marcador/)
    expect((await library.get(book.id))?.currentPage).toBe(2)
    await library.update(book.id, { currentPage: 100 })
    expect((await library.get(book.id))?.currentPage).toBe(4)
  })

  it('não deixa um patch alterar identidade, título ou tamanho do original', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    await library.update(book.id, { currentPage: 1, id: 'outro', size: 0, title: 'alterado' } as Partial<PdfBook>)
    expect(await library.get(book.id)).toMatchObject({ id: book.id, size: book.size, title: book.title })
    await expect(library.update('inexistente', { currentPage: 2 })).rejects.toThrow(/não está mais/)
  })

  it('identifica o arquivo pelo conteúdo antes de guardar: nomes diferentes, mesmo id', async () => {
    const library = shelf()
    const probe = await library.inspect(pdfFile('Original.pdf'))
    expect(probe).toMatchObject({ title: 'Original', fileName: 'Original.pdf' })
    expect(probe.id).toMatch(/^[a-f0-9]{64}$/)
    expect(await library.list()).toEqual([])
    expect((await library.inspect(pdfFile('copia com outro nome.pdf'))).id).toBe(probe.id)
    expect((await library.inspect(pdfFile('Original.pdf', '%PDF-1.7\noutro conteúdo'))).id).not.toBe(probe.id)
    const book = await library.add(pdfFile('Original.pdf'), probe)
    expect(book.id).toBe(probe.id)
    await expect(library.inspect(pdfFile('falso.pdf', 'nao sou um PDF'))).rejects.toThrow(/assinatura/)
  })

  it('remover da estante ou arquivar mantém arquivo, posição e marcações; só a exclusão apaga', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    const other = await library.add(pdfFile('outro.pdf', '%PDF-1.7\noutro'))
    await library.update(book.id, { pageCount: 6, currentPage: 3, annotations: [mark], bookmarks: [2] })
    for (const state of ['hidden', 'archived'] as const) {
      await library.setShelfData(book.id, { shelf: state })
      expect(await library.get(book.id)).toMatchObject({ shelf: state, currentPage: 3, annotations: [mark], bookmarks: [2] })
      expect(await library.file(book.id)).toBeDefined()
    }
    await library.setShelfData(book.id, { shelf: 'active' })
    expect((await library.get(book.id))?.shelf).toBe('active')
    await library.remove(book.id)
    expect(await library.file(book.id)).toBeUndefined()
    // a exclusão permanente de um PDF não toca nos outros
    expect(await library.get(other.id)).toBeDefined()
    expect(await library.file(other.id)).toBeDefined()
  })

  it('dados da estante (título, autor, assunto, favorito, capa) não disputam com o leitor aberto', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    await library.setShelfData(book.id, { title: ' Título Novo ', author: ' Fulana ', subject: 'Direito', favorite: true, cover: new Uint8Array([1, 2, 3]).buffer, pageCount: 40 })
    expect(await library.get(book.id)).toMatchObject({ title: 'Título Novo', author: 'Fulana', subject: 'Direito', favorite: true, coverType: 'image/jpeg', pageCount: 40 })
    // o leitor que já tinha o PDF aberto continua podendo salvar: a revisão não mudou
    await library.update(book.id, { currentPage: 2, lastReadAt: '2026-11-21T12:00:00.000Z' })
    await library.setShelfData(book.id, { subject: '', pageCount: 3 })
    const saved = await library.get(book.id)
    expect(saved).toMatchObject({ currentPage: 2, favorite: true, pageCount: 40 })
    expect(saved?.subject).toBeUndefined()
    await expect(library.setShelfData(book.id, { title: '  ' })).rejects.toThrow(/título/)
    await expect(library.setShelfData('inexistente', { favorite: true })).rejects.toThrow(/não está mais/)
  })

  it('guarda as páginas visitadas sem repetição e só as que existem (base do progresso de navegação)', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    await library.update(book.id, { pageCount: 5, currentPage: 4, visitedPages: [4, 1, 4, 9, 0, 2] })
    expect((await library.get(book.id))?.visitedPages).toEqual([1, 2, 4])
    // gravações que não falam de visitas não as apagam
    await library.update(book.id, { bookmarks: [2] })
    expect((await library.get(book.id))?.visitedPages).toEqual([1, 2, 4])
  })

  it('aceita anotação do documento todo e anotação de página sem alfinete', async () => {
    const library = shelf()
    const book = await library.add(pdfFile())
    const notes: PdfAnnotation[] = [
      { id: 'n1', page: 1, type: 'note', color: '#f2cc4d', text: 'do documento', scope: 'document', createdAt: '2026-11-21T10:00:00.000Z' },
      { id: 'n2', page: 2, type: 'note', color: '#f2cc4d', text: 'da página 2', createdAt: '2026-11-21T10:01:00.000Z' },
    ]
    await library.update(book.id, { pageCount: 3, annotations: notes })
    expect((await library.get(book.id))?.annotations).toEqual(notes)
  })

  it('rejeita snapshot de outra aba sem apagar as marcas já salvas', async () => {
    const scope = `pdf-test-${++nextScope}`
    const first = shelf(scope)
    const second = shelf(scope)
    const book = await first.add(pdfFile())
    await second.get(book.id)
    await first.update(book.id, { pageCount: 3, annotations: [mark] })
    await expect(second.update(book.id, { pageCount: 3, annotations: [] })).rejects.toThrow(/alterado em outra aba/)
    expect((await first.get(book.id))?.annotations).toEqual([mark])
    await second.get(book.id)
    await second.update(book.id, { bookmarks: [2] })
    expect((await first.get(book.id))?.annotations).toEqual([mark])
  })
})

function cloudFixture(): PdfCloud {
  const records = new Map<string, CloudPdf>()
  const files = new Map<string, ArrayBuffer>()
  return {
    list: async () => structuredClone([...records.values()]),
    write: async (entry, expectedRevision) => {
      if ((records.get(entry.id)?.revision ?? null) !== expectedRevision) return false
      records.set(entry.id, structuredClone(entry))
      return true
    },
    upload: async (key, data) => { files.set(key, data.slice(0)) },
    download: async (key) => {
      const file = files.get(key)
      if (!file) throw new Error('Arquivo ausente')
      return file.slice(0)
    },
    removeFile: async (key) => { files.delete(key) },
  }
}

describe('sincronização privada de PDFs', () => {
  it('envia um PDF já importado e baixa o original uma vez ao abrir no outro aparelho', async () => {
    const cloud = cloudFixture()
    const download = vi.spyOn(cloud, 'download')
    const local = shelf()
    const file = pdfFile()
    const { id } = await local.add(file)
    await local.update(id, { pageCount: 4, currentPage: 2, annotations: [mark], bookmarks: [2] })
    local.close()

    const desktop = shelf(local.dbName.slice(0, -4), cloud)
    const phone = shelf(undefined, cloud)
    await desktop.sync()
    await phone.sync()
    expect(await phone.list()).toMatchObject([{ id, currentPage: 2, annotations: [mark], bookmarks: [2], cloud: 'synced', fileLocal: false }])
    expect(download).not.toHaveBeenCalled()
    expect(await phone.file(id)).toEqual(await file.arrayBuffer())
    expect(await phone.file(id)).toEqual(await file.arrayBuffer())
    expect(download).toHaveBeenCalledTimes(1)

    await phone.get(id)
    await phone.update(id, { currentPage: 3 })
    await phone.sync()
    await desktop.sync()
    expect(await desktop.get(id)).toMatchObject({ currentPage: 3, annotations: [mark] })
  })

  it('abre PDFs locais e encontra PDFs na nuvem durante um envio pendente', async () => {
    const cloud = cloudFixture()
    const desktop = shelf(undefined, cloud)
    const phone = shelf(undefined, cloud)
    const { id: remoteId } = await phone.add(pdfFile('Na nuvem.pdf'))
    await phone.sync()
    const { id: localId } = await desktop.add(pdfFile('Local.pdf', '%PDF-1.7 outro livro'))
    const uploadStarted = Promise.withResolvers<void>()
    const releaseUpload = Promise.withResolvers<void>()
    const originalUpload = cloud.upload
    vi.spyOn(cloud, 'upload').mockImplementationOnce(async (key, data) => {
      uploadStarted.resolve()
      await releaseUpload.promise
      await originalUpload(key, data)
    })
    const sync = desktop.sync()
    try {
      await uploadStarted.promise
      expect(await desktop.get(localId)).toMatchObject({ id: localId })
      expect(await desktop.get(remoteId)).toMatchObject({ id: remoteId })
      expect(await desktop.file(remoteId)).toBeDefined()
    } finally {
      releaseUpload.resolve()
      await sync
    }
  })

  it('mantém o PDF local quando o envio falha e tenta de novo na próxima sincronização', async () => {
    const cloud = cloudFixture()
    vi.spyOn(cloud, 'upload').mockRejectedValueOnce(new Error('Sem conexão'))
    const library = shelf(undefined, cloud)
    const { id } = await library.add(pdfFile())
    await expect(library.sync()).rejects.toThrow('Sem conexão')
    expect(await cloud.list()).toEqual([])
    expect(await library.list()).toMatchObject([{ id, cloud: 'pending', fileLocal: true }])
    await library.sync()
    expect(await library.list()).toMatchObject([{ id, cloud: 'synced' }])
  })

  it('propaga uma exclusão sem reenviar a cópia antiga e permite uma nova importação explícita', async () => {
    const cloud = cloudFixture()
    const desktop = shelf(undefined, cloud)
    const phone = shelf(undefined, cloud)
    const file = pdfFile()
    const { id } = await desktop.add(file)
    await desktop.sync()
    await phone.get(id)
    await phone.file(id)
    await desktop.remove(id)
    await phone.update(id, { pageCount: 2, currentPage: 2 })
    await phone.sync()
    expect(await phone.list()).toEqual([])
    expect(await phone.file(id)).toBeUndefined()
    expect(await cloud.list()).toMatchObject([{ id, book: null }])
    await phone.add(file)
    await phone.sync()
    await desktop.refresh()
    expect(await desktop.get(id)).toMatchObject({ id, currentPage: 1 })
  })
})
