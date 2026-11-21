/** PDFs locais. O arquivo original e as marcações ficam neste navegador, separados por conta. */
import Dexie, { type Table } from 'dexie'
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

class PdfDb extends Dexie {
  books!: Table<PdfBook, string>
  files!: Table<PdfFile, string>
  revisions!: Table<{ id: string; revision: string }, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ books: 'id, addedAt, lastReadAt', files: 'id' })
    this.version(2).stores({ books: 'id, addedAt, lastReadAt', files: 'id', revisions: 'id' })
  }
}

export const PDF_MAX_FILE_BYTES = 100 * 1024 * 1024
export const PDF_CONFLICT_MESSAGE = 'Este PDF foi alterado em outra aba. Reabra o leitor antes de continuar; exporte suas marcações atuais para preservá-las.'
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

export class PdfLibrary {
  readonly dbName: string
  private readonly db: PdfDb
  private readonly knownRevisions = new Map<string, string | null>()

  constructor(scope: string) {
    if (!scope.trim()) throw new Error('Informe o espaço da biblioteca de PDFs.')
    this.dbName = `${scope}-pdf`
    this.db = new PdfDb(this.dbName)
  }

  /** Fecha apenas a conexão. Os PDFs continuam guardados. */
  close(): void {
    this.db.close()
  }

  /** Utilitário de testes e limpeza explícita: apaga apenas este espaço de PDFs. */
  async destroy(): Promise<void> {
    this.close()
    await Dexie.delete(this.dbName)
  }

  async list(): Promise<PdfBook[]> {
    return (await this.db.books.toArray()).sort((a, b) => (b.lastReadAt ?? b.addedAt).localeCompare(a.lastReadAt ?? a.addedAt) || a.title.localeCompare(b.title, 'pt-BR'))
  }

  async get(id: string): Promise<PdfBook | undefined> {
    return this.db.transaction('r', this.db.books, this.db.revisions, async () => {
      const book = await this.db.books.get(id)
      if (book) this.knownRevisions.set(id, (await this.db.revisions.get(id))?.revision ?? null)
      return book
    })
  }

  async file(id: string): Promise<ArrayBuffer | undefined> {
    return (await this.db.files.get(id))?.data
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
    return this.db.transaction('rw', this.db.books, this.db.files, this.db.revisions, async () => {
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

      const changes: ReadingPatch & { updatedAt: string } = { updatedAt: new Date().toISOString(), currentPage: Math.min(requestedPage, pageCount) }
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
      if (Object.keys(changes).length) await this.db.books.update(id, changes)
    })
  }

  /** Exclusão permanente: apaga o arquivo, a posição, as marcações e as anotações deste PDF. */
  async remove(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.books, this.db.files, this.db.revisions, async () => {
      await this.db.books.delete(id)
      await this.db.files.delete(id)
      await this.db.revisions.delete(id)
      this.knownRevisions.delete(id)
    })
  }
}
