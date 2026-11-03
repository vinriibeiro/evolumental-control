import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDF_MAX_FILE_BYTES, PdfLibrary, type PdfAnnotation, type PdfBook } from '../pdfLibrary'

const libraries: PdfLibrary[] = []
let nextScope = 0
const pdfFile = (name = 'Meu_Material.pdf', content = '%PDF-1.7\nmaterial de teste') => new File([content], name, { type: 'application/pdf' })
function shelf(scope = `pdf-test-${++nextScope}`) {
  const library = new PdfLibrary(scope)
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
