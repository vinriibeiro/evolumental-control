/** Estante unificada: EPUBs e PDFs vistos como um só tipo de item. Sem acesso a banco nem a tela. */
import { navigationProgress, normalizeShelfState, seedVisitedPages, type DedupeCandidate, type ShelfState } from '@/lib/library'
import type { BookRecord, CloudState } from '@/services/library'
import type { PdfBook } from '@/services/pdfLibrary'

export type ShelfKind = 'book' | 'pdf'

export interface ShelfEntry extends DedupeCandidate {
  /** Único na estante inteira (EPUB e PDF têm espaços de id separados). */
  key: string
  id: string
  kind: ShelfKind
  title: string
  /** Vazio quando o arquivo não informa autor. */
  author: string
  subject: string
  favorite: boolean
  shelf: ShelfState
  /** 0 a 100. No EPUB é a posição no livro; no PDF é o progresso de navegação (páginas já abertas). */
  progress: number
  addedAt: string
  lastReadAt?: string
  size: number
  fileName: string
  href: string
  cover?: ArrayBuffer
  coverType?: string
  pageCount?: number
  currentPage?: number
  /** Situação na nuvem da conta. */
  cloud?: CloudState
  fileLocal?: boolean
}

export const KIND_LABEL: Record<ShelfKind, string> = { book: 'EPUB', pdf: 'PDF' }

export function bookHref(kind: ShelfKind, id: string): string {
  return kind === 'pdf' ? `/livros/pdf/${id}` : `/livros/${id}`
}

/** Páginas visitadas de um PDF, inclusive os abertos antes de esse registro existir. */
export function pdfVisitedPages(book: Pick<PdfBook, 'visitedPages' | 'currentPage' | 'pageCount' | 'lastReadAt'>): number[] {
  if (book.visitedPages) return book.visitedPages
  return book.lastReadAt ? seedVisitedPages(book.currentPage, book.pageCount) : []
}

/** Progresso de navegação do PDF (0 a 100): estimativa pelas páginas abertas, não prova de leitura. */
export function pdfProgress(book: Pick<PdfBook, 'visitedPages' | 'currentPage' | 'pageCount' | 'lastReadAt'>): number {
  return navigationProgress(pdfVisitedPages(book), book.pageCount)
}

export function epubEntry(b: BookRecord): ShelfEntry {
  return {
    key: `book:${b.id}`,
    id: b.id,
    kind: 'book',
    title: b.title,
    author: b.author === 'Autor desconhecido' ? '' : b.author,
    subject: b.subject ?? '',
    favorite: Boolean(b.favorite),
    shelf: normalizeShelfState(b.shelf),
    progress: b.progress,
    addedAt: b.addedAt,
    lastReadAt: b.lastReadAt,
    size: b.size,
    fileName: b.fileName,
    href: bookHref('book', b.id),
    cover: b.cover,
    coverType: b.coverType,
    cloud: b.cloud,
    fileLocal: b.fileLocal,
    hash: b.id,
    isbn: b.isbn,
    identifier: b.identifier,
  }
}

export function pdfEntry(p: PdfBook): ShelfEntry {
  return {
    key: `pdf:${p.id}`,
    id: p.id,
    kind: 'pdf',
    title: p.title,
    author: p.author ?? '',
    subject: p.subject ?? '',
    favorite: Boolean(p.favorite),
    shelf: normalizeShelfState(p.shelf),
    progress: pdfProgress(p),
    addedAt: p.addedAt,
    lastReadAt: p.lastReadAt,
    size: p.size,
    fileName: p.fileName,
    href: bookHref('pdf', p.id),
    cover: p.cover,
    coverType: p.coverType,
    cloud: p.cloud,
    fileLocal: p.fileLocal,
    // antes da primeira abertura a contagem de páginas pode ainda ser o valor inicial (1)
    pageCount: p.lastReadAt || p.pageCount > 1 ? p.pageCount : undefined,
    currentPage: p.currentPage,
    hash: p.id,
  }
}

/** Texto do progresso, sempre dizendo o que ele mede: leitura (EPUB) ou navegação (PDF). */
export function progressLabel(entry: Pick<ShelfEntry, 'kind' | 'progress'>): string {
  return entry.kind === 'pdf' ? `Progresso de navegação: ${entry.progress}%` : `${entry.progress}% lido`
}

export type ShelfFilter = 'all' | 'reading' | 'favorites' | 'archived' | 'hidden'

/** Filtro de situação: os três primeiros olham só para o que está na estante. */
export function matchesFilter(entry: ShelfEntry, filter: ShelfFilter): boolean {
  if (filter === 'archived') return entry.shelf === 'archived'
  if (filter === 'hidden') return entry.shelf === 'hidden'
  if (entry.shelf !== 'active') return false
  if (filter === 'reading') return Boolean(entry.lastReadAt) && entry.progress < 100
  if (filter === 'favorites') return entry.favorite
  return true
}
