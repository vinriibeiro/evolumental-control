import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { CLOUD_MAX_FILE_BYTES, Library, cloudErrorMessage, readEpubMetadata, type CloudBook, type LibraryCloud } from '../library'
import { FakeCloud } from '@/test/fakeCloud'
import { PNG, epubFile, makeEpub } from '@/test/epubFixture'

const created: Library[] = []
let n = 0
function shelf(cloud: LibraryCloud | null = null, max?: number): Library {
  const l = new Library(`teste-biblioteca-${++n}`, cloud, max)
  created.push(l)
  return l
}
const wait = (ms = 6) => new Promise((r) => setTimeout(r, ms))

afterEach(async () => {
  await Promise.all(created.splice(0).map((l) => l.destroy()))
})

describe('leitura de metadados do EPUB', () => {
  it('lê título, autor e capa de dentro do arquivo', async () => {
    const meta = await readEpubMetadata(await makeEpub({ title: 'Pense em Estatística', author: 'Allen B. Downey', cover: true }), 'x.epub')
    expect(meta.title).toBe('Pense em Estatística')
    expect(meta.author).toBe('Allen B. Downey')
    expect(meta.coverType).toBe('image/png')
    expect(meta.cover?.byteLength).toBe(PNG.byteLength)
  })

  it('usa o nome do arquivo quando o livro não traz título nem autor', async () => {
    const meta = await readEpubMetadata(await makeEpub({}), 'Meu_Livro_Bom.epub')
    expect(meta.title).toBe('Meu Livro Bom')
    expect(meta.author).toBe('Autor desconhecido')
    expect(meta.cover).toBeUndefined()
  })

  it('rejeita arquivo que não é EPUB', async () => {
    await expect(readEpubMetadata(new TextEncoder().encode('isto não é um zip').buffer as ArrayBuffer, 'ruim.epub')).rejects.toBeDefined()
  })
})

describe('estante local (sem nuvem)', () => {
  it('zera a leitura na nuvem e neste aparelho sem apagar o livro ou as notas', async () => {
    const cloud = new FakeCloud()
    const library = shelf(cloud)
    const other = shelf(cloud)
    const result = await library.add(await epubFile('leitura.epub', { chapter: 'leitura' }))
    const [book] = await library.list()
    expect(result.status).toBe('added')
    await library.saveProgress(book.id, 'epubcfi(/6/2)', 24)
    const notes = await library.saveNotes(book.id, [{ id: 'note', text: 'Uma anotação', createdAt: '2026-11-22T12:00:00Z' }])
    await other.sync()
    expect((await other.list())[0].progress).toBe(24)
    await wait()
    await library.resetReadingProgress()
    await other.sync()
    for (const device of [library, other]) {
      const [reset] = await device.list()
      expect(reset).toMatchObject({ id: book.id, progress: 0, notes })
      expect(reset.location).toBeUndefined()
      expect(reset.lastReadAt).toBeUndefined()
      expect((await device.open(book.id)).byteLength).toBeGreaterThan(100)
    }
  })

  it('adiciona o livro com capa e guarda o arquivo', async () => {
    const lib = shelf()
    const r = await lib.add(await epubFile('a.epub', { title: 'Livro A', author: 'Autora', cover: true, chapter: 'a' }))
    expect(r).toMatchObject({ status: 'added', upload: 'off' })
    const books = await lib.list()
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ title: 'Livro A', author: 'Autora', progress: 0, bookmarks: [], fileLocal: true, cloud: 'off' })
    expect(books[0].cover?.byteLength).toBe(PNG.byteLength)
    expect(books[0].weights).toHaveLength(1)
    expect(books[0].weights?.[0]).toBeGreaterThan(0)
    expect((await lib.open(books[0].id)).byteLength).toBeGreaterThan(100)
  })

  it('não duplica o mesmo conteúdo, mesmo com outro nome de arquivo', async () => {
    const lib = shelf()
    const data = await makeEpub({ title: 'Igual', chapter: 'igual' })
    expect((await lib.add(new File([data], 'um.epub'))).status).toBe('added')
    expect((await lib.add(new File([data], 'dois.epub'))).status).toBe('duplicate')
    expect(await lib.list()).toHaveLength(1)
  })

  it('recusa PDF e arquivo corrompido com mensagem clara, sem entrar na estante', async () => {
    const lib = shelf()
    await expect(lib.add(new File(['%PDF'], 'livro.pdf', { type: 'application/pdf' }))).rejects.toThrow(/só arquivos \.epub/)
    await expect(lib.add(new File(['não é zip'], 'quebrado.epub'))).rejects.toThrow(/corrompido/)
    expect(await lib.list()).toEqual([])
  })

  it('remove o livro e o arquivo guardado', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', chapter: 'r' }))
    await lib.remove(book.id)
    expect(await lib.get(book.id)).toBeUndefined()
    await expect(lib.open(book.id)).rejects.toThrow(/não está guardado neste aparelho/)
  })

  it('salva a posição, limita o progresso a 0-100 e marca a data de leitura', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', chapter: 'p' }))
    await lib.saveProgress(book.id, 'epubcfi(/6/4!/4/2)', 134.6)
    const saved = await lib.get(book.id)
    expect(saved).toMatchObject({ location: 'epubcfi(/6/4!/4/2)', progress: 100 })
    expect(saved?.lastReadAt).toBeTruthy()
  })

  it('liga e desliga marcadores sem duplicar', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', chapter: 'm' }))
    let marks = await lib.toggleBookmark(book.id, { cfi: 'epubcfi(/6/2)', label: 'Capítulo 1 · 3%' })
    expect(marks.map((m) => m.cfi)).toEqual(['epubcfi(/6/2)'])
    marks = await lib.toggleBookmark(book.id, { cfi: 'epubcfi(/6/8)', label: 'Capítulo 2 · 9%' })
    expect(marks).toHaveLength(2)
    marks = await lib.toggleBookmark(book.id, { cfi: 'epubcfi(/6/2)', label: 'Capítulo 1 · 3%' })
    expect(marks.map((m) => m.cfi)).toEqual(['epubcfi(/6/8)'])
    marks = await lib.removeBookmark(book.id, 'epubcfi(/6/8)')
    expect(marks).toEqual([])
  })
})

describe('estante com nuvem privada', () => {
  it('envia arquivo, capa e metadados ao adicionar', async () => {
    const cloud = new FakeCloud()
    const lib = shelf(cloud)
    const r = await lib.add(await epubFile('a.epub', { title: 'Livro A', author: 'Autora', cover: true, chapter: 'n1' }))
    expect(r).toMatchObject({ status: 'added', upload: 'synced' })
    expect(r.book.cloud).toBe('synced')
    expect(cloud.files.has(r.book.id)).toBe(true)
    expect(cloud.covers.has(r.book.id)).toBe(true)
    expect(cloud.books.get(r.book.id)).toMatchObject({ title: 'Livro A', hasCover: true, progress: 0 })
  })

  it('um segundo aparelho vê o livro com capa, baixa ao abrir e passa a ter o arquivo', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', cover: true, chapter: 'n2' }))

    const summary = await b.sync()
    expect(summary).toMatchObject({ fromCloud: 1, removed: 0 })
    const remote = await b.get(book.id)
    expect(remote).toMatchObject({ title: 'Livro A', fileLocal: false, cloud: 'synced' })
    expect(remote?.cover?.byteLength).toBe(PNG.byteLength)

    const data = await b.open(book.id)
    expect(data.byteLength).toBe(cloud.files.get(book.id)?.byteLength)
    expect((await b.get(book.id))?.fileLocal).toBe(true)
    cloud.calls.length = 0
    await b.open(book.id)
    expect(cloud.calls).not.toContain('downloadFile') // segunda abertura usa a cópia local
  })

  it('leva a posição de leitura mais recente de um aparelho para o outro', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n3' }))
    await b.sync()

    await wait()
    await a.saveProgress(book.id, 'epubcfi(/6/10)', 40)
    await wait() // envio em segundo plano
    await b.sync()
    expect(await b.get(book.id)).toMatchObject({ location: 'epubcfi(/6/10)', progress: 40 })

    // o aparelho B lê mais adiante; depois o A sincroniza e recebe a posição mais nova
    await wait()
    await b.saveProgress(book.id, 'epubcfi(/6/20)', 75)
    await wait()
    await a.sync()
    expect(await a.get(book.id)).toMatchObject({ location: 'epubcfi(/6/20)', progress: 75 })
  })

  it('uma posição mais antiga não sobrescreve a mais nova que está na nuvem', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n4' }))
    await b.sync()
    await wait()
    await a.saveProgress(book.id, 'epubcfi(/6/30)', 90)
    await wait()
    await b.sync()
    expect((await b.get(book.id))?.progress).toBe(90)
    expect(cloud.books.get(book.id)?.progress).toBe(90)
  })

  it('sincroniza marcadores nos dois sentidos, inclusive a remoção', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n5' }))
    await b.sync()
    await wait()
    await a.toggleBookmark(book.id, { cfi: 'epubcfi(/6/2)', label: 'Cap 1 · 3%' })
    await wait()
    await b.sync()
    expect((await b.get(book.id))?.bookmarks.map((m) => m.cfi)).toEqual(['epubcfi(/6/2)'])

    await wait()
    await b.removeBookmark(book.id, 'epubcfi(/6/2)')
    await wait()
    await a.sync()
    expect((await a.get(book.id))?.bookmarks).toEqual([])
  })

  it('remover um livro apaga também da nuvem e some dos outros aparelhos', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n6' }))
    await b.sync()
    await b.open(book.id)

    await a.remove(book.id)
    expect(cloud.books.size).toBe(0)
    expect(cloud.files.size).toBe(0)
    const summary = await b.sync()
    expect(summary.removed).toBe(1)
    expect(await b.list()).toEqual([])
  })

  it('se a nuvem falhar ao remover, nada é apagado localmente', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n7' }))
    cloud.offline = true
    await expect(a.remove(book.id)).rejects.toThrow()
    expect(await a.get(book.id)).toBeDefined()
    expect(await a.open(book.id)).toBeDefined()
  })

  it('livro acima do limite de tamanho fica só no aparelho e não é enviado', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud, 100)
    const r = await a.add(await epubFile('grande.epub', { title: 'Grande', chapter: 'n8' }))
    expect(r.upload).toBe('too-large')
    expect(r.book.cloud).toBe('too-large')
    expect(cloud.files.size).toBe(0)
    expect(cloud.books.size).toBe(0)
    // continua legível e sobrevive à sincronização
    await a.sync()
    expect(await a.get(r.book.id)).toBeDefined()
    expect(CLOUD_MAX_FILE_BYTES).toBe(50 * 1024 * 1024)
  })

  it('envio que falha deixa o livro pendente e a próxima sincronização reenvia', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    cloud.failUploads = true
    const r = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n9' }))
    expect(r.upload).toBe('failed')
    expect((await a.get(r.book.id))?.cloud).toBe('pending')
    expect(cloud.books.size).toBe(0)

    cloud.failUploads = false
    const summary = await a.sync()
    expect(summary.uploaded).toBe(1)
    expect((await a.get(r.book.id))?.cloud).toBe('synced')
    expect(cloud.files.has(r.book.id)).toBe(true)
  })

  it('sem internet a sincronização falha, mas a estante local continua funcionando', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'n10' }))
    cloud.offline = true
    await expect(a.sync()).rejects.toThrow()
    expect(await a.list()).toHaveLength(1)
    await a.saveProgress(book.id, 'epubcfi(/6/4)', 10) // não lança, mesmo offline
    expect((await a.get(book.id))?.progress).toBe(10)
  })

  it('adicionar de novo um livro que só estava na nuvem guarda o arquivo no aparelho', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const file = await epubFile('a.epub', { title: 'Livro A', chapter: 'n11' })
    await a.add(file)
    await b.sync()
    const r = await b.add(file)
    expect(r.status).toBe('duplicate')
    expect((await b.get(r.book.id))?.fileLocal).toBe(true)
  })

  it('estantes de contas diferentes não se misturam', async () => {
    const alice = shelf(new FakeCloud())
    const bob = shelf(new FakeCloud())
    await alice.add(await epubFile('a.epub', { title: 'Da Alice', chapter: 'n12' }))
    await bob.sync()
    expect(await bob.list()).toEqual([])
  })
})

/** Nuvem de um projeto que ainda não aplicou a migração v2: não guarda nem devolve os campos novos. */
class LegacyCloud extends FakeCloud {
  migrated = false
  schemaOutdated = () => !this.migrated
  private strip(book: CloudBook): CloudBook {
    if (this.migrated) return book
    const { subject: _s, favorite: _f, shelf: _h, notes: _n, isbn: _i, identifier: _d, ...legacy } = book
    return legacy
  }
  override async upsert(book: CloudBook) {
    await super.upsert(this.strip(book))
  }
  override async list() {
    // depois da migração, as linhas antigas ganham os valores padrão das colunas novas
    return (await super.list()).map((b) => (this.migrated ? { favorite: false, shelf: 'active' as const, notes: [], ...b } : b))
  }
}

describe('estante v2: identificação, assunto, favoritos, arquivo e anotações', () => {
  it('inspeciona o arquivo sem guardar nada e lê o identificador do livro', async () => {
    const lib = shelf()
    const file = await epubFile('a.epub', { title: 'Livro A', author: 'Autora', chapter: 'cap-unico' })
    const probe = await lib.inspect(file)
    expect(probe.id).toMatch(/^[0-9a-f]{32}$/)
    expect(probe.meta).toMatchObject({ title: 'Livro A', author: 'Autora', identifier: 'urn:test:cap-unico' })
    expect(probe.existing).toBeUndefined()
    expect(await lib.list()).toEqual([])

    const added = await lib.add(file, probe)
    expect(added).toMatchObject({ status: 'added', book: { id: probe.id, identifier: 'urn:test:cap-unico' } })
    // o mesmo conteúdo com outro nome é o mesmo livro
    const again = await lib.inspect(new File([await file.arrayBuffer()], 'outro-nome.epub'))
    expect(again.id).toBe(probe.id)
    expect(again.existing?.title).toBe('Livro A')
  })

  it('reconhece o ISBN declarado no pacote do EPUB', async () => {
    const data = await makeEpub({ title: 'Com ISBN', chapter: 'isbn' })
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(data)
    const opf = await zip.file('OEBPS/content.opf')!.async('string')
    zip.file('OEBPS/content.opf', opf.replace('</metadata>', '<dc:identifier id="isbn">urn:isbn:0-306-40615-2</dc:identifier></metadata>'))
    const meta = await readEpubMetadata(await zip.generateAsync({ type: 'arraybuffer' }), 'isbn.epub')
    expect(meta.isbn).toBe('9780306406157')
    expect(meta.identifier).toBe('urn:test:isbn')
  })

  it('remover da estante e arquivar não apagam o arquivo nem a leitura; dá para restaurar', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', chapter: 'v2-a' }))
    await lib.saveProgress(book.id, 'epubcfi(/6/4)', 37)
    await lib.toggleBookmark(book.id, { cfi: 'epubcfi(/6/2)', label: 'Cap 1' })
    for (const state of ['hidden', 'archived'] as const) {
      await lib.setShelf(book.id, state)
      const kept = await lib.get(book.id)
      expect(kept).toMatchObject({ shelf: state, progress: 37, location: 'epubcfi(/6/4)' })
      expect(kept?.bookmarks).toHaveLength(1)
      expect((await lib.open(book.id)).byteLength).toBeGreaterThan(100)
    }
    await lib.setShelf(book.id, 'active')
    expect((await lib.get(book.id))?.shelf).toBe('active')
  })

  it('edita título, autor e assunto; recusa título vazio; favorita', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', author: 'Autora', chapter: 'v2-b' }))
    await lib.setDetails(book.id, { title: '  Novo Título ', author: '', subject: ' Estatística ' })
    expect(await lib.get(book.id)).toMatchObject({ title: 'Novo Título', author: 'Autor desconhecido', subject: 'Estatística' })
    await expect(lib.setDetails(book.id, { title: '   ' })).rejects.toThrow(/título/)
    await lib.setDetails(book.id, { subject: '' })
    expect((await lib.get(book.id))?.subject).toBeUndefined()
    await lib.setFavorite(book.id, true)
    expect((await lib.get(book.id))?.favorite).toBe(true)
  })

  it('guarda anotações do livro e descarta as vazias', async () => {
    const lib = shelf()
    const { book } = await lib.add(await epubFile('a.epub', { title: 'A', chapter: 'v2-c' }))
    const saved = await lib.saveNotes(book.id, [
      { id: 'n1', text: '  reler este trecho ', cfi: 'epubcfi(/6/4)', label: 'Cap 2 · 30%', createdAt: '2026-11-21T10:00:00.000Z' },
      { id: 'n2', text: '   ', createdAt: '2026-11-21T10:01:00.000Z' },
      { id: 'n3', text: 'nota do livro todo', createdAt: '2026-11-21T10:02:00.000Z' },
    ])
    expect(saved.map((n) => [n.id, n.text, n.cfi])).toEqual([
      ['n1', 'reler este trecho', 'epubcfi(/6/4)'],
      ['n3', 'nota do livro todo', undefined],
    ])
    expect((await lib.get(book.id))?.notes).toEqual(saved)
  })

  it('assunto, favorito, situação na estante e anotações sincronizam entre aparelhos', async () => {
    const cloud = new FakeCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'v2-d' }))
    await b.sync()
    await wait()
    await a.setDetails(book.id, { title: 'Livro A (revisado)', subject: 'Direito' })
    await a.setFavorite(book.id, true)
    await a.setShelf(book.id, 'archived')
    await a.saveNotes(book.id, [{ id: 'n1', text: 'nota', createdAt: '2026-11-21T10:00:00.000Z' }])
    await wait()
    await b.sync()
    expect(await b.get(book.id)).toMatchObject({ title: 'Livro A (revisado)', subject: 'Direito', favorite: true, shelf: 'archived', notes: [{ id: 'n1', text: 'nota' }] })
    // arquivar em um aparelho não apaga o arquivo da nuvem
    expect(cloud.files.has(book.id)).toBe(true)
    // um terceiro aparelho já recebe o livro arquivado
    const c = shelf(cloud)
    await c.sync()
    expect(await c.get(book.id)).toMatchObject({ shelf: 'archived', favorite: true, subject: 'Direito' })
  })

  it('nuvem sem a migração v2: nada quebra, os dados novos ficam no aparelho e sobem depois da migração', async () => {
    const cloud = new LegacyCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { book } = await a.add(await epubFile('a.epub', { title: 'Livro A', chapter: 'v2-e' }))
    expect(a.cloudSchemaOutdated).toBe(true)
    await b.sync()
    await wait()
    await a.setFavorite(book.id, true)
    await a.saveNotes(book.id, [{ id: 'n1', text: 'feita antes da migração', createdAt: '2026-11-21T10:00:00.000Z' }])
    await a.saveProgress(book.id, 'epubcfi(/6/8)', 55)
    await wait()
    expect(await a.get(book.id)).toMatchObject({ favorite: true, metaPending: true, progress: 55 })

    // o outro aparelho recebe a posição de leitura, mas não perde nem inventa os campos novos
    await b.sync()
    await wait()
    await b.setShelf(book.id, 'hidden')
    await b.saveNotes(book.id, [{ id: 'n2', text: 'feita no outro aparelho', createdAt: '2026-11-21T11:00:00.000Z' }])
    await wait()
    await b.sync()
    expect(await b.get(book.id)).toMatchObject({ progress: 55, shelf: 'hidden', metaPending: true })
    expect((await b.get(book.id))?.favorite).toBeUndefined()

    // migração aplicada: o que estava só em cada aparelho sobe e se soma, em vez de ser trocado pelos valores padrão
    cloud.migrated = true
    await wait()
    await a.sync()
    expect(await a.get(book.id)).toMatchObject({ favorite: true, metaPending: false, notes: [{ id: 'n1' }] })
    expect(cloud.books.get(book.id)).toMatchObject({ favorite: true, notes: [{ id: 'n1', text: 'feita antes da migração' }] })
    await wait()
    await b.sync()
    expect(cloud.books.get(book.id)).toMatchObject({ favorite: true, shelf: 'hidden' })
    expect(cloud.books.get(book.id)?.notes?.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
    await wait()
    await a.sync()
    expect(await a.get(book.id)).toMatchObject({ favorite: true, shelf: 'hidden', progress: 55 })
    expect((await a.get(book.id))?.notes?.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
  })
})

describe('mensagens de erro da nuvem', () => {
  it('distingue a tabela ausente da coluna ausente (migração v2)', () => {
    expect(cloudErrorMessage({ code: 'PGRST204', message: "Could not find the 'subject' column of 'library_books' in the schema cache" })).toMatch(/20261121010000_v2_library\.sql/)
  })

  it('explica quando a migração ainda não foi aplicada', () => {
    expect(cloudErrorMessage({ code: 'PGRST205', message: "Could not find the table 'public.library_books' in the schema cache" })).toMatch(/migração 20261031000000_library\.sql/)
    expect(cloudErrorMessage({ message: 'Bucket not found', statusCode: '404' })).toMatch(/livros/)
  })

  it('traduz falha de rede e devolve outras mensagens como estão', () => {
    expect(cloudErrorMessage(new Error('Failed to fetch'))).toBe('Sem conexão com o servidor.')
    expect(cloudErrorMessage(new Error('algo estranho'))).toBe('algo estranho')
  })
})
