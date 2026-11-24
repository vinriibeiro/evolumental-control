/** Biblioteca de PDFs com cache local por conta e sincronização opcional. */
import Dexie, { type Table } from 'dexie'
import { CLOUD_MAX_FILE_BYTES, type CloudState } from './library'
import type { CloudPdf, PdfCloud } from './pdfLibrarySupabase'
import { normalizeShelfState, type ShelfState } from '@/lib/library'

/** Coordenadas no espaço nativo do PDF, em pontos, sem aplicar zoom ou rotação da tela. */
export interface PdfPoint {
  x: number
  y: number
}

export interface PdfRect extends PdfPoint {
  width: number
  height: number
}

export interface PdfAnnotation {
  id: string
  /** Página 1-indexada. */
  page: number
  type: 'highlight' | 'ink' | 'note'
  color: string
  rects?: PdfRect[]
  points?: PdfPoint[]
  text?: string
  quote?: string
  createdAt: string
  strokeWidth?: number
  /**
   * Só em notas: "document" = anotação do documento como um todo (não aparece presa a uma página).
   * A página continua gravada (a que estava aberta), para a exportação ter onde colocar o comentário.
   */
  scope?: 'document'
  updatedAt?: string
}

export interface PdfBook {
  id: string
  title: string
  fileName: string
  size: number
  pageCount: number
  currentPage: number
  annotations: PdfAnnotation[]
  bookmarks: number[]
  addedAt: string
  updatedAt: string
  lastReadAt?: string
  author?: string
  /** Assunto livre definido pelo usuário (filtro da estante). */
  subject?: string
  favorite?: boolean
  /** Ausente = na estante. "archived"/"hidden" tiram o PDF da estante sem apagar nada. */
  shelf?: ShelfState
  /** Páginas já abertas no leitor (sem repetição): base do "progresso de navegação". */
  visitedPages?: number[]
  /** Miniatura da primeira página, gerada uma vez e guardada aqui. */
  cover?: ArrayBuffer
  coverType?: string
  cloud?: CloudState
  fileLocal?: boolean
}

/** Arquivo já lido, validado e identificado (SHA-256 do conteúdo), antes de entrar na estante. */
export interface PdfProbe {
  id: string
  data: ArrayBuffer
  title: string
  fileName: string
}

/** Dados da estante: não fazem parte da leitura e, por isso, não disputam com o leitor aberto em outra aba. */
export type PdfShelfPatch = Partial<Pick<PdfBook, 'title' | 'author' | 'subject' | 'favorite' | 'shelf' | 'cover' | 'coverType' | 'pageCount'>>

interface PdfFile {
  id: string
  data: ArrayBuffer
}

interface PdfSyncState {
  id: string
  revision: string
  fileKey: string
  syncedAt?: string
}

class PdfDb extends Dexie {
  books!: Table<PdfBook, string>
  files!: Table<PdfFile, string>
  revisions!: Table<{ id: string; revision: string }, string>

  syncState!: Table<PdfSyncState, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ books: 'id, addedAt, lastReadAt', files: 'id' })
    this.version(2).stores({ books: 'id, addedAt, lastReadAt', files: 'id', revisions: 'id' })
    this.version(3).stores({ syncState: 'id' })
  }
}

export const PDF_MAX_FILE_BYTES = 100 * 1024 * 1024
export const PDF_CONFLICT_MESSAGE = 'Este PDF foi alterado em outra aba ou aparelho. Reabra o leitor antes de continuar; exporte suas marcações atuais para preservá-las.'
export type PdfReadingPatch = Partial<Pick<PdfBook, 'currentPage' | 'pageCount' | 'annotations' | 'bookmarks' | 'lastReadAt' | 'visitedPages'>>
type ReadingPatch = PdfReadingPatch

function positivePage(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1
}

function validPoint(point: PdfPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function assertAnnotations(annotations: PdfAnnotation[], pageCount: number): void {
  const ids = new Set<string>()
  for (const annotation of annotations) {
    if (!annotation.id || ids.has(annotation.id)) throw new Error('Cada marcação precisa ter um identificador único.')
    ids.add(annotation.id)
    if (!positivePage(annotation.page) || annotation.page > pageCount) throw new Error('A página da marcação não existe neste PDF.')
    if (!['highlight', 'ink', 'note'].includes(annotation.type)) throw new Error('Tipo de marcação inválido.')
    if (annotation.points?.some((point) => !validPoint(point)) || annotation.rects?.some((rect) => !validPoint(rect) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height))) {
      throw new Error('A marcação contém coordenadas inválidas.')
    }
    if (annotation.strokeWidth != null && (!Number.isFinite(annotation.strokeWidth) || annotation.strokeWidth <= 0)) throw new Error('A espessura da marcação deve ser positiva.')
  }
}

function nextUpdate(previous: string): string {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString()
}

export class PdfLibrary {
  readonly dbName: string
  private readonly db: PdfDb
  private readonly knownRevisions = new Map<string, string | null>()

  private syncTask?: Promise<void>
  private syncTimer?: ReturnType<typeof setTimeout>

  constructor(scope: string, readonly cloud: PdfCloud | null = null) {
    if (!scope.trim()) throw new Error('Informe o espaço da biblioteca de PDFs.')
    this.dbName = `${scope}-pdf`
    this.db = new PdfDb(this.dbName)
  }

  /** Fecha apenas a conexão. Os PDFs continuam guardados. */
  close(): void {
    clearTimeout(this.syncTimer)
    this.db.close()
  }

  /** Utilitário de testes e limpeza explícita: apaga apenas este espaço de PDFs. */
  async destroy(): Promise<void> {
    this.close()
    await Dexie.delete(this.dbName)
  }

  async list(): Promise<PdfBook[]> {
    const [books, files, states] = await this.db.transaction('r', this.db.books, this.db.files, this.db.syncState, () =>
      Promise.all([this.db.books.toArray(), this.db.files.toCollection().primaryKeys(), this.db.syncState.toArray()]),
    )
    const localFiles = new Set(files)
    const statesById = new Map(states.map((state) => [state.id, state]))
    const entries = this.cloud ? books.map((book): PdfBook => ({
      ...book,
      fileLocal: localFiles.has(book.id),
      cloud: book.size > CLOUD_MAX_FILE_BYTES ? 'too-large'
        : statesById.get(book.id)?.syncedAt === book.updatedAt ? 'synced' : 'pending',
    })) : books
    return entries.sort((a, b) => (b.lastReadAt ?? b.addedAt).localeCompare(a.lastReadAt ?? a.addedAt) || a.title.localeCompare(b.title, 'pt-BR'))
  }

  async get(id: string): Promise<PdfBook | undefined> {
    if (this.cloud && !(await this.db.books.get(id))) await this.refresh(id)
    return this.db.transaction('r', this.db.books, this.db.revisions, async () => {
      const book = await this.db.books.get(id)
      if (book) this.knownRevisions.set(id, (await this.db.revisions.get(id))?.revision ?? null)
      return book
    })
  }

  /** Traz os metadados disponíveis sem esperar pelo envio de arquivos deste aparelho. */
  async refresh(id?: string): Promise<void> {
    if (!this.cloud) return
    const remote = id && this.cloud.find
      ? [await this.cloud.find(id)]
      : await this.cloud.list()
    for (const entry of remote) {
      if (!entry?.book || (id && entry.id !== id)) continue
      const [local, state] = await this.db.transaction('r', this.db.books, this.db.syncState, () =>
        Promise.all([this.db.books.get(entry.id), this.db.syncState.get(entry.id)]),
      )
      if (this.shouldPull(entry, local, state)) await this.applyRemote(entry, local)
    }
  }

  private shouldPull(remote: CloudPdf, local?: PdfBook, state?: PdfSyncState): boolean {
    return Boolean(remote.book && (!local || (remote.revision !== state?.revision &&
      (local.updatedAt === state?.syncedAt || Date.parse(remote.book.updatedAt) >= Date.parse(local.updatedAt)))))
  }

  async openSource(id: string): Promise<{ data: ArrayBuffer } | { url: string; cache: (bytes: Uint8Array) => Promise<void> } | undefined> {
    const local = await this.db.files.get(id)
    if (local) return { data: local.data }
    const state = await this.db.syncState.get(id)
    if (!state?.syncedAt || !this.cloud?.signedUrl) return undefined
    const fileKey = state.fileKey
    const url = await this.cloud.signedUrl(fileKey)
    return {
      url,
      cache: async (bytes) => {
        const data = new Uint8Array(bytes).buffer
        await this.cacheFile(id, fileKey, data)
      },
    }
  }

  async file(id: string): Promise<ArrayBuffer | undefined> {
    const local = await this.db.files.get(id)
    if (local || !this.cloud) return local?.data
    let state = await this.db.syncState.get(id)
    if (!state?.syncedAt) {
      await this.refresh(id)
      state = await this.db.syncState.get(id)
    }
    if (!state?.syncedAt) return undefined
    const fileKey = state.fileKey
    const data = await this.cloud.download(fileKey)
    return this.cacheFile(id, fileKey, data)
  }

  private cacheFile(id: string, fileKey: string, data: ArrayBuffer): Promise<ArrayBuffer | undefined> {
    return this.db.transaction('rw', this.db.files, this.db.syncState, async () => {
      const current = await this.db.syncState.get(id)
      if (!current?.syncedAt || current.fileKey !== fileKey) return undefined
      await this.db.files.put({ id, data })
      return data
    })
  }

  private scheduleSync(): void {
    if (!this.cloud) return
    clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => void this.sync(true).catch(() => undefined), 750)
  }

  sync(wait = false): Promise<void> {
    return this.runCloud(async (cloud) => {
      const entries = new Map((await cloud.list()).map((entry) => [entry.id, entry]))
      const [books, states] = await Promise.all([this.db.books.toArray(), this.db.syncState.toArray()])
      const local = new Map(books.map((book) => [book.id, book]))
      const stateById = new Map(states.map((state) => [state.id, state]))
      const errors: unknown[] = []
      for (const id of new Set([...entries.keys(), ...local.keys()])) {
        try {
          await this.syncBook(cloud, id, local.get(id), entries.get(id), stateById.get(id))
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length) throw errors[0]
    }, wait)
  }

  private runCloud(run: (cloud: PdfCloud) => Promise<void>, wait = false): Promise<void> {
    const cloud = this.cloud
    if (!cloud) return Promise.resolve()
    const previous = this.syncTask
    if (previous && !wait) return previous
    const task = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => run(cloud)).finally(() => {
      if (this.syncTask === task) this.syncTask = undefined
    })
    this.syncTask = task
    return task
  }

  private async syncBook(cloud: PdfCloud, id: string, local?: PdfBook, remote?: CloudPdf, state?: PdfSyncState): Promise<void> {
    if (remote && !remote.book) {
      // Uma nova importação após observar a exclusão pode restaurar o arquivo.
      const reimported = local && state?.revision === remote.revision && !state.syncedAt
      if (state?.revision !== remote.revision) await cloud.removeFile(remote.fileKey)
      if (!reimported) {
        if (state?.revision !== remote.revision || local) await this.applyRemote(remote, local)
        return
      }
    }
    if (remote?.book) {
      const localIsClean = local?.updatedAt === state?.syncedAt
      if (remote.revision === state?.revision && localIsClean) return
      if (this.shouldPull(remote, local, state)) {
        await this.applyRemote(remote, local)
        return
      }
    }
    if (!local || local.size > CLOUD_MAX_FILE_BYTES) return

    const revision = crypto.randomUUID()
    const needsUpload = !remote?.book
    const fileKey = needsUpload ? revision : remote.fileKey
    if (needsUpload) {
      const bytes = (await this.db.files.get(id))?.data
      if (!bytes) return
      await cloud.upload(fileKey, bytes)
    }
    const written = await cloud.write({ id, revision, fileKey, book: local }, remote?.revision ?? null)
    if (!written) {
      if (needsUpload) await cloud.removeFile(fileKey)
      throw new Error('O PDF foi atualizado em outro aparelho. Tente sincronizar novamente.')
    }
    await this.db.syncState.put({ id, revision, fileKey, syncedAt: local.updatedAt })
  }

  private async applyRemote(remote: CloudPdf, previous?: PdfBook): Promise<void> {
    const { id, book, revision, fileKey } = remote
    await this.db.transaction('rw', this.db.books, this.db.files, this.db.syncState, this.db.revisions, async () => {
      const current = await this.db.books.get(id)
      if (current?.updatedAt !== previous?.updatedAt) return
      if (book) {
        await this.db.books.put(book)
        await this.db.revisions.put({ id, revision: crypto.randomUUID() })
      } else {
        await this.db.books.delete(id)
        await this.db.files.delete(id)
        await this.db.revisions.delete(id)
      }
      await this.db.syncState.put({ id, revision, fileKey, syncedAt: book?.updatedAt })
    })
  }

  async resetReadingProgress(): Promise<void> {
    await this.sync().catch(() => undefined)
    const resetIds: string[] = []
    await this.db.transaction('rw', this.db.books, this.db.revisions, async () => {
      await this.db.books.toCollection().modify((book) => {
        if (!book.lastReadAt && book.currentPage === 1 && !book.visitedPages?.length) return
        delete book.lastReadAt
        book.currentPage = 1
        book.visitedPages = []
        book.updatedAt = nextUpdate(book.updatedAt)
        resetIds.push(book.id)
      })
      await this.db.revisions.bulkPut(resetIds.map((id) => ({ id, revision: crypto.randomUUID() })))
    })
    for (const id of resetIds) this.knownRevisions.delete(id)
    if (resetIds.length) this.scheduleSync()
  }

  /**
   * Lê e valida o arquivo sem guardar nada. O id é o SHA-256 do conteúdo: dois arquivos idênticos
   * têm o mesmo id, seja qual for o nome do arquivo.
   */
  async inspect(file: File): Promise<PdfProbe> {
    if (file.size > PDF_MAX_FILE_BYTES) throw new Error('O PDF ultrapassa o limite de 100 MiB por arquivo.')
    if (file.size < 5) throw new Error('O arquivo não é um PDF válido.')
    const data = await file.arrayBuffer()
    if (data.byteLength > PDF_MAX_FILE_BYTES) throw new Error('O PDF ultrapassa o limite de 100 MiB por arquivo.')
    const header = new Uint8Array(data, 0, Math.min(5, data.byteLength))
    if (header.length < 5 || header.some((byte, index) => byte !== [37, 80, 68, 70, 45][index])) throw new Error('O arquivo não é um PDF válido (assinatura %PDF- ausente).')
    if (!globalThis.crypto?.subtle) throw new Error('Para importar PDFs com segurança, abra a plataforma em HTTPS ou localhost.')
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    return { id, data, fileName: file.name, title: file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim() || 'PDF sem título' }
  }

  async add(file: File, probe?: PdfProbe): Promise<PdfBook> {
    const { id, data, title } = probe ?? (await this.inspect(file))
    const stamp = new Date().toISOString()
    const book: PdfBook = {
      id,
      title,
      fileName: file.name,
      size: data.byteLength,
      pageCount: 1,
      currentPage: 1,
      annotations: [],
      bookmarks: [],
      addedAt: stamp,
      updatedAt: stamp,
    }

    // A verificação ocorre dentro da transação: duas importações simultâneas não
    // substituem o progresso nem deixam metadados sem os bytes correspondentes.
    const stored = await this.db.transaction('rw', this.db.books, this.db.files, this.db.revisions, async () => {
      const existing = await this.db.books.get(id)
      await this.db.files.put({ id, data })
      if (existing) {
        this.knownRevisions.set(id, (await this.db.revisions.get(id))?.revision ?? null)
        return existing
      }
      await this.db.books.add(book)
      const revision = crypto.randomUUID()
      await this.db.revisions.put({ id, revision })
      this.knownRevisions.set(id, revision)
      return book
    })
    this.scheduleSync()
    return stored
  }

  async update(id: string, patch: ReadingPatch): Promise<void> {
    await this.db.transaction('rw', this.db.books, this.db.revisions, async () => {
      const book = await this.db.books.get(id)
      if (!book) throw new Error('Este PDF não está mais na biblioteca deste navegador.')
      const storedRevision = (await this.db.revisions.get(id))?.revision ?? null
      if (!this.knownRevisions.has(id) || this.knownRevisions.get(id) !== storedRevision) throw new Error(PDF_CONFLICT_MESSAGE)
      const pageCount = patch.pageCount ?? book.pageCount
      if (!positivePage(pageCount)) throw new Error('A quantidade de páginas deve ser um número inteiro positivo.')
      const requestedPage = patch.currentPage ?? book.currentPage
      if (!positivePage(requestedPage)) throw new Error('Informe uma página válida.')
      const annotations = patch.annotations ?? book.annotations
      assertAnnotations(annotations, pageCount)
      const bookmarks = patch.bookmarks ?? book.bookmarks
      if (bookmarks.some((page) => !positivePage(page) || page > pageCount)) throw new Error('Um marcador aponta para uma página que não existe neste PDF.')
      if (patch.lastReadAt != null && !Number.isFinite(Date.parse(patch.lastReadAt))) throw new Error('A data de leitura é inválida.')

      const changes: ReadingPatch & { updatedAt: string } = { updatedAt: nextUpdate(book.updatedAt), currentPage: Math.min(requestedPage, pageCount) }
      // Copia apenas os campos de leitura permitidos. O ID e os bytes originais
      // nunca são substituídos por um objeto recebido da interface.
      if (patch.pageCount != null) changes.pageCount = pageCount
      if (patch.annotations != null) changes.annotations = annotations
      if (patch.bookmarks != null) changes.bookmarks = [...new Set(bookmarks)].sort((a, b) => a - b)
      if (patch.lastReadAt != null) changes.lastReadAt = patch.lastReadAt
      if (patch.visitedPages != null) changes.visitedPages = [...new Set(patch.visitedPages.filter((page) => positivePage(page) && page <= pageCount))].sort((a, b) => a - b)
      await this.db.books.update(id, changes)
      const revision = crypto.randomUUID()
      await this.db.revisions.put({ id, revision })
      this.knownRevisions.set(id, revision)
    })
    this.scheduleSync()
  }

  /**
   * Atualiza os dados da estante (título, autor, assunto, favorito, estante, capa). Não mexe na
   * posição nem nas marcações e não muda a revisão: o leitor aberto em outra aba continua válido.
   */
  async setShelfData(id: string, patch: PdfShelfPatch): Promise<void> {
    await this.db.transaction('rw', this.db.books, async () => {
      const book = await this.db.books.get(id)
      if (!book) throw new Error('Este PDF não está mais na biblioteca deste navegador.')
      const changes: PdfShelfPatch = {}
      if (patch.title !== undefined) {
        const title = patch.title.trim().slice(0, 500)
        if (!title) throw new Error('Informe o título do PDF.')
        changes.title = title
      }
      if (patch.author !== undefined) changes.author = patch.author.trim().slice(0, 500) || undefined
      if (patch.subject !== undefined) changes.subject = patch.subject.trim().slice(0, 120) || undefined
      if (patch.favorite !== undefined) changes.favorite = Boolean(patch.favorite)
      if (patch.shelf !== undefined) changes.shelf = normalizeShelfState(patch.shelf)
      if (patch.cover !== undefined) {
        changes.cover = patch.cover
        changes.coverType = patch.coverType ?? 'image/jpeg'
      }
      // A contagem real de páginas só é aceita antes da primeira leitura; depois, quem manda é o leitor.
      if (patch.pageCount !== undefined && positivePage(patch.pageCount) && !book.lastReadAt && book.annotations.length === 0 && book.bookmarks.length === 0) changes.pageCount = patch.pageCount
      if (Object.keys(changes).length) await this.db.books.update(id, { ...changes, updatedAt: nextUpdate(book.updatedAt) })
    })
    this.scheduleSync()
  }

  /** Exclusão permanente: apaga o arquivo, a posição, as marcações e as anotações deste PDF. */
  async remove(id: string): Promise<void> {
    const removeLocal = () => this.db.transaction('rw', this.db.books, this.db.files, this.db.revisions, async () => {
      await this.db.books.delete(id)
      await this.db.files.delete(id)
      await this.db.revisions.delete(id)
      this.knownRevisions.delete(id)
    })
    const local = await this.db.books.get(id)
    if (!this.cloud || !local || local.size > CLOUD_MAX_FILE_BYTES) return removeLocal()
    await this.runCloud(async (cloud) => {
      const remote = (await cloud.list().catch(async (error: unknown) => {
        const state = await this.db.syncState.get(id)
        const code = (error as { code?: string } | null)?.code
        if (!state && (code === 'PGRST205' || code === '42P01')) return []
        throw error
      })).find((entry) => entry.id === id)
      if (!remote) {
        await removeLocal()
        return
      }
      const deleted = remote.book ? { ...remote, revision: crypto.randomUUID(), book: null } : remote
      if (remote.book && !(await cloud.write(deleted, remote.revision))) {
        throw new Error('O PDF foi atualizado em outro aparelho. Tente excluir novamente.')
      }
      await cloud.removeFile(deleted.fileKey)
      await this.applyRemote(deleted, await this.db.books.get(id))
    }, true)
  }
}
