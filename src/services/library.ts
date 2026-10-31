/**
 * Biblioteca: livros EPUB do próprio usuário.
 *
 * - Sempre existe uma cópia local (IndexedDB do navegador), que permite ler sem internet.
 * - Quando o app está ligado ao Supabase, cada livro também é guardado em um espaço PRIVADO da
 *   conta (bucket "livros" + tabela library_books, protegidos por RLS) e sincronizado entre
 *   aparelhos. Em modo local (sem Supabase) nada sai do navegador.
 */
import Dexie, { type Table } from 'dexie'
import { isEpubFile, titleFromFileName } from '@/lib/library'

export interface Bookmark {
  cfi: string
  label: string
  createdAt: string
}

/** Situação do livro na nuvem: synced (guardado), pending (falta enviar), too-large (acima do limite), off (modo local). */
export type CloudState = 'synced' | 'pending' | 'too-large' | 'off'

export interface BookRecord {
  id: string
  title: string
  author: string
  fileName: string
  size: number
  addedAt: string
  lastReadAt?: string
  /** Posição (EPUB CFI) onde a leitura parou. */
  location?: string
  /** 0 a 100. */
  progress: number
  cover?: ArrayBuffer
  coverType?: string
  /** Tamanho de cada seção do livro, na ordem de leitura (para o progresso). */
  weights?: number[]
  bookmarks: Bookmark[]
  /** Hora (deste aparelho) da última mudança de posição ou marcadores: a mais recente vence na sincronização. */
  updatedAt: string
  /** O arquivo do livro está guardado neste aparelho? (false = só na nuvem, baixa ao abrir) */
  fileLocal: boolean
  cloud: CloudState
}

interface BookFile {
  id: string
  data: ArrayBuffer
}

class LibraryDb extends Dexie {
  books!: Table<BookRecord, string>
  files!: Table<BookFile, string>
  constructor(name: string) {
    super(name)
    const stores = { books: 'id, addedAt, lastReadAt', files: 'id' }
    this.version(1).stores(stores)
    // v2: campos de sincronização. Livros adicionados antes da nuvem existir são locais e completos.
    this.version(2)
      .stores(stores)
      .upgrade((tx) =>
        tx
          .table('books')
          .toCollection()
          .modify((b: Partial<BookRecord> & Pick<BookRecord, 'addedAt'>) => {
            b.updatedAt ??= b.lastReadAt ?? b.addedAt
            b.fileLocal ??= true
            b.cloud ??= 'off'
          }),
      )
  }
}

// ---------------------------------------------------------------------
// Nuvem
// ---------------------------------------------------------------------

/** Plano gratuito do Supabase: no máximo 50 MiB por arquivo. */
export const CLOUD_MAX_FILE_BYTES = 50 * 1024 * 1024

/** Metadados de um livro como guardados na nuvem (o arquivo e a capa vão à parte). */
export interface CloudBook {
  id: string
  title: string
  author: string
  fileName: string
  size: number
  addedAt: string
  lastReadAt?: string
  location?: string
  progress: number
  bookmarks: Bookmark[]
  weights?: number[]
  coverType?: string
  hasCover: boolean
  updatedAt: string
}

export interface LibraryCloud {
  list(): Promise<CloudBook[]>
  upsert(book: CloudBook): Promise<void>
  uploadFile(id: string, data: ArrayBuffer): Promise<void>
  uploadCover(id: string, data: ArrayBuffer, type: string): Promise<void>
  downloadFile(id: string): Promise<ArrayBuffer>
  downloadCover(id: string): Promise<ArrayBuffer | undefined>
  /** Apaga o arquivo, a capa e os metadados. */
  remove(id: string): Promise<void>
}

// ---------------------------------------------------------------------
// Leitura de metadados do EPUB
// ---------------------------------------------------------------------

export interface EpubMetadata {
  title: string
  author: string
  cover?: ArrayBuffer
  coverType?: string
  weights?: number[]
}

interface ZipLike {
  file(path: string): { async(type: 'arraybuffer'): Promise<ArrayBuffer> } | null
  files?: Record<string, { _data?: { uncompressedSize?: number } } | undefined>
}

function coverMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'image/jpeg'
}

/** O epubjs fica esperando para sempre diante de arquivo inválido: confirma antes que é um zip com container.xml. */
async function assertEpubStructure(data: ArrayBuffer): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data).catch(() => {
    throw new Error('O arquivo não é um EPUB válido (não é um pacote zip).')
  })
  if (!zip.file('META-INF/container.xml')) throw new Error('O arquivo não é um EPUB válido (falta META-INF/container.xml).')
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Tempo esgotado ao abrir o EPUB.')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

interface SpineBook {
  spine: { each(fn: (item: { href: string }) => void): void }
  resolve(path: string, absolute?: boolean): string
  archive: { zip?: ZipLike }
}

/** Tamanho (bytes descomprimidos) de cada seção do livro, na ordem de leitura. */
function sectionWeights(book: SpineBook): number[] | undefined {
  const zip = book.archive.zip
  if (!zip?.files) return undefined
  const out: number[] = []
  book.spine.each((item) => {
    const abs = decodeURIComponent(book.resolve(item.href, true).replace(/^\/+/, ''))
    out.push(zip.files?.[abs]?._data?.uncompressedSize ?? 0)
  })
  return out.some((w) => w > 0) ? out : undefined
}

/** Lê título, autor e capa de dentro do próprio EPUB. Lança erro se o arquivo não for um EPUB válido. */
export async function readEpubMetadata(data: ArrayBuffer, fileName: string): Promise<EpubMetadata> {
  await assertEpubStructure(data)
  const { default: ePub } = await import('epubjs')
  // só metadados: sem trocar URLs de recursos (evita trabalho pendente quando o livro é fechado em seguida)
  const book = ePub(data as unknown as string, { replacements: 'none' })
  try {
    await withTimeout(book.ready, 30_000)
    const meta = (await book.loaded.metadata) as { title?: string; creator?: string }
    const out: EpubMetadata = {
      title: (meta.title ?? '').trim() || titleFromFileName(fileName),
      author: (meta.creator ?? '').trim() || 'Autor desconhecido',
    }
    try {
      const coverPath = (await book.loaded.cover) as string | null
      if (coverPath) {
        const abs = decodeURIComponent(book.resolve(coverPath, true).replace(/^\/+/, ''))
        const zip = (book.archive as unknown as { zip?: ZipLike }).zip
        const entry = zip?.file(abs) ?? zip?.file(decodeURIComponent(coverPath))
        if (entry) {
          out.cover = await entry.async('arraybuffer')
          out.coverType = coverMime(abs)
        }
      }
    } catch {
      // capa é opcional: o livro entra na estante com uma capa gerada
    }
    try {
      out.weights = sectionWeights(book as unknown as SpineBook)
    } catch {
      // sem pesos o progresso usa seções de tamanho igual
    }
    return out
  } finally {
    book.destroy()
  }
}

async function contentId(data: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Sem Web Crypto: tamanho + amostra de bytes (suficiente para evitar duplicata exata)
  const view = new Uint8Array(data)
  let h = 5381
  for (let i = 0; i < view.length; i += Math.max(1, Math.floor(view.length / 4096))) h = ((h << 5) + h + view[i]) | 0
  return `${data.byteLength.toString(16)}-${(h >>> 0).toString(16)}`
}

// ---------------------------------------------------------------------
// Estante
// ---------------------------------------------------------------------

/** Resultado do envio à nuvem ao adicionar: off = sem nuvem (modo local). */
export type UploadOutcome = 'synced' | 'too-large' | 'failed' | 'off'
export type AddResult = { status: 'added' | 'duplicate'; book: BookRecord; upload: UploadOutcome }

export interface SyncSummary {
  /** Livros que vieram da nuvem e ainda não existiam neste aparelho. */
  fromCloud: number
  /** Livros removidos daqui porque foram apagados em outro aparelho. */
  removed: number
  /** Livros enviados à nuvem agora (estavam pendentes). */
  uploaded: number
  /** Envios que falharam (continuam pendentes). */
  failed: number
}

const now = () => new Date().toISOString()

function toCloud(b: BookRecord): CloudBook {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    fileName: b.fileName,
    size: b.size,
    addedAt: b.addedAt,
    lastReadAt: b.lastReadAt,
    location: b.location,
    progress: b.progress,
    bookmarks: b.bookmarks,
    weights: b.weights,
    coverType: b.coverType,
    hasCover: Boolean(b.cover),
    updatedAt: b.updatedAt,
  }
}

export class Library {
  private readonly db: LibraryDb

  constructor(
    readonly dbName: string,
    readonly cloud: LibraryCloud | null = null,
    private readonly maxCloudBytes = CLOUD_MAX_FILE_BYTES,
  ) {
    this.db = new LibraryDb(dbName)
  }

  /** Fecha e apaga o banco local (usado nos testes). */
  async destroy(): Promise<void> {
    this.db.close()
    await Dexie.delete(this.dbName)
  }

  list(): Promise<BookRecord[]> {
    return this.db.books.toArray()
  }

  get(id: string): Promise<BookRecord | undefined> {
    return this.db.books.get(id)
  }

  /** Adiciona um EPUB à estante (e à nuvem, se houver). Livros idênticos não são duplicados. */
  async add(file: File): Promise<AddResult> {
    if (!isEpubFile(file.name, file.type)) throw new Error(`"${file.name}" não é um EPUB. A biblioteca aceita só arquivos .epub.`)
    const data = await file.arrayBuffer()
    const id = await contentId(data)
    const existing = await this.db.books.get(id)
    if (existing) {
      // veio da nuvem sem o arquivo: aproveita os bytes que o usuário acabou de escolher
      if (!existing.fileLocal) {
        await this.db.transaction('rw', this.db.books, this.db.files, async () => {
          await this.db.files.put({ id, data })
          await this.db.books.update(id, { fileLocal: true })
        })
      }
      return { status: 'duplicate', book: { ...existing, fileLocal: true }, upload: existing.cloud === 'off' ? 'off' : existing.cloud === 'synced' ? 'synced' : 'failed' }
    }
    let meta: EpubMetadata
    try {
      meta = await readEpubMetadata(data, file.name)
    } catch {
      throw new Error(`Não consegui abrir "${file.name}". O arquivo parece estar corrompido ou não é um EPUB válido.`)
    }
    const stamp = now()
    const book: BookRecord = {
      id,
      title: meta.title,
      author: meta.author,
      fileName: file.name,
      size: file.size,
      addedAt: stamp,
      progress: 0,
      cover: meta.cover,
      coverType: meta.coverType,
      weights: meta.weights,
      bookmarks: [],
      updatedAt: stamp,
      fileLocal: true,
      cloud: this.cloud ? 'pending' : 'off',
    }
    await this.db.transaction('rw', this.db.books, this.db.files, async () => {
      await this.db.files.put({ id, data })
      await this.db.books.put(book)
    })
    if (!this.cloud) return { status: 'added', book, upload: 'off' }
    const upload = await this.push(book)
    return { status: 'added', book: (await this.db.books.get(id)) ?? book, upload }
  }

  /** Envia o livro (arquivo, capa e metadados) à nuvem. Nunca lança: devolve o resultado. */
  private async push(book: BookRecord): Promise<UploadOutcome> {
    const cloud = this.cloud
    if (!cloud) return 'off'
    if (book.size > this.maxCloudBytes) {
      await this.db.books.update(book.id, { cloud: 'too-large' })
      return 'too-large'
    }
    try {
      const file = await this.db.files.get(book.id)
      if (!file) throw new Error('arquivo local ausente')
      await cloud.uploadFile(book.id, file.data)
      if (book.cover) await cloud.uploadCover(book.id, book.cover, book.coverType ?? 'image/jpeg')
      const fresh = (await this.db.books.get(book.id)) ?? book
      await cloud.upsert(toCloud(fresh))
      await this.db.books.update(book.id, { cloud: 'synced' })
      return 'synced'
    } catch {
      await this.db.books.update(book.id, { cloud: 'pending' })
      return 'failed'
    }
  }

  /**
   * Reconcilia a estante deste aparelho com a nuvem: traz livros novos, apaga os que saíram em outro
   * aparelho, leva a posição de leitura mais recente para os dois lados e reenvia o que ficou pendente.
   */
  async sync(): Promise<SyncSummary> {
    const cloud = this.cloud
    const summary: SyncSummary = { fromCloud: 0, removed: 0, uploaded: 0, failed: 0 }
    if (!cloud) return summary
    const remote = await cloud.list()
    const remoteIds = new Set(remote.map((r) => r.id))
    const locals = new Map((await this.db.books.toArray()).map((b) => [b.id, b]))

    for (const r of remote) {
      const local = locals.get(r.id)
      if (!local) {
        const cover = r.hasCover ? await cloud.downloadCover(r.id).catch(() => undefined) : undefined
        await this.db.books.put({
          id: r.id,
          title: r.title,
          author: r.author,
          fileName: r.fileName,
          size: r.size,
          addedAt: r.addedAt,
          lastReadAt: r.lastReadAt,
          location: r.location,
          progress: r.progress,
          bookmarks: r.bookmarks,
          weights: r.weights,
          cover,
          coverType: r.coverType,
          updatedAt: r.updatedAt,
          fileLocal: false,
          cloud: 'synced',
        })
        summary.fromCloud++
        continue
      }
      if (r.updatedAt > local.updatedAt) {
        await this.db.books.update(r.id, {
          location: r.location,
          progress: r.progress,
          lastReadAt: r.lastReadAt,
          bookmarks: r.bookmarks,
          updatedAt: r.updatedAt,
          cloud: 'synced',
        })
      } else {
        if (r.updatedAt < local.updatedAt) await cloud.upsert(toCloud(local)).catch(() => undefined)
        if (local.cloud !== 'synced') await this.db.books.update(r.id, { cloud: 'synced' })
      }
    }

    for (const local of locals.values()) {
      if (remoteIds.has(local.id)) continue
      if (local.cloud === 'synced') {
        // estava na nuvem e sumiu: foi apagado em outro aparelho
        await this.db.transaction('rw', this.db.books, this.db.files, async () => {
          await this.db.books.delete(local.id)
          await this.db.files.delete(local.id)
        })
        summary.removed++
      } else if (local.cloud === 'pending' && local.fileLocal) {
        const out = await this.push(local)
        if (out === 'synced') summary.uploaded++
        else if (out === 'failed') summary.failed++
      }
    }
    return summary
  }

  /** Devolve o arquivo do livro; se ele só estiver na nuvem, baixa e guarda neste aparelho. */
  async open(id: string): Promise<ArrayBuffer> {
    const local = await this.db.files.get(id)
    if (local) return local.data
    if (!this.cloud) throw new Error('O arquivo deste livro não está guardado neste aparelho. Remova-o da estante e adicione de novo.')
    const data = await this.cloud.downloadFile(id)
    await this.db.transaction('rw', this.db.books, this.db.files, async () => {
      await this.db.files.put({ id, data })
      await this.db.books.update(id, { fileLocal: true })
    })
    return data
  }

  /** Remove o livro daqui e, se estiver na nuvem, de todos os aparelhos. Se a nuvem falhar, nada é apagado. */
  async remove(id: string): Promise<void> {
    const book = await this.db.books.get(id)
    if (book && this.cloud && book.cloud === 'synced') await this.cloud.remove(id)
    await this.db.transaction('rw', this.db.books, this.db.files, async () => {
      await this.db.books.delete(id)
      await this.db.files.delete(id)
    })
  }

  private async touch(id: string, changes: Partial<BookRecord>): Promise<void> {
    await this.db.books.update(id, { ...changes, updatedAt: now() })
    const book = await this.db.books.get(id)
    // sincronização em segundo plano: se falhar, a próxima abertura da estante reconcilia
    if (book && this.cloud && book.cloud === 'synced') void this.cloud.upsert(toCloud(book)).catch(() => undefined)
  }

  async saveProgress(id: string, location: string, progress: number): Promise<void> {
    await this.touch(id, { location, progress: Math.max(0, Math.min(100, Math.round(progress))), lastReadAt: now() })
  }

  /** Liga/desliga o marcador na posição indicada. Devolve a lista nova de marcadores. */
  async toggleBookmark(id: string, bookmark: Omit<Bookmark, 'createdAt'>): Promise<Bookmark[]> {
    const book = await this.db.books.get(id)
    if (!book) return []
    const has = book.bookmarks.some((b) => b.cfi === bookmark.cfi)
    const next = has ? book.bookmarks.filter((b) => b.cfi !== bookmark.cfi) : [...book.bookmarks, { ...bookmark, createdAt: now() }]
    await this.touch(id, { bookmarks: next })
    return next
  }

  async removeBookmark(id: string, cfi: string): Promise<Bookmark[]> {
    const book = await this.db.books.get(id)
    if (!book) return []
    const next = book.bookmarks.filter((b) => b.cfi !== cfi)
    await this.touch(id, { bookmarks: next })
    return next
  }
}

// ---------------------------------------------------------------------
// Instâncias por conta
// ---------------------------------------------------------------------

const instances = new Map<string, Library>()

/**
 * Uma estante por conta (e uma para o modo local). O banco local é separado por usuário, para que
 * outra conta no mesmo navegador nunca veja os livros guardados aqui.
 */
export function libraryFor(scope: { userId: string; cloud: LibraryCloud } | null): Library {
  const key = scope ? `evolumental-library-${scope.userId}` : 'evolumental-library'
  let lib = instances.get(key)
  if (!lib) {
    lib = new Library(key, scope?.cloud ?? null)
    instances.set(key, lib)
  }
  return lib
}

/** Usado nos testes: fecha e apaga todas as estantes criadas por libraryFor. */
export async function resetLibrariesForTests(): Promise<void> {
  await Promise.all([...instances.values()].map((l) => l.destroy()))
  instances.clear()
}

/** Mensagem amigável para falhas da nuvem. */
export function cloudErrorMessage(e: unknown): string {
  const err = e as { message?: string; code?: string; statusCode?: string | number } | null
  const msg = err?.message ?? String(e)
  if (err?.code === '42P01' || err?.code === 'PGRST205' || /library_books|schema cache/i.test(msg)) {
    return 'A Biblioteca na nuvem ainda não foi ativada no seu Supabase (falta aplicar a migração 20261031000000_library.sql).'
  }
  if (/bucket not found/i.test(msg) || err?.statusCode === '404' || err?.statusCode === 404) {
    return 'O espaço privado de livros ("livros") não existe no seu Supabase. Aplique a migração 20261031000000_library.sql.'
  }
  if (/fetch|network|failed to/i.test(msg)) return 'Sem conexão com o servidor.'
  if (/exceeded|too large|payload/i.test(msg)) return 'O arquivo é maior que o limite do seu plano do Supabase.'
  return msg
}
