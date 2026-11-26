/** Estante de livros EPUB. Sem acesso a banco nem a tela. */
import { normalizeShelfState, type DedupeCandidate, type ShelfState } from '@/lib/library'
import type { BookRecord, CloudState } from '@/services/library'

export type ShelfKind = 'book'

export interface ShelfEntry extends DedupeCandidate {
  key: string
  id: string
  kind: ShelfKind
  title: string
  /** Vazio quando o arquivo não informa autor. */
  author: string
  subject: string
  favorite: boolean
  shelf: ShelfState
  /** 0 a 100: posição de leitura no EPUB. */
  progress: number
  addedAt: string
  lastReadAt?: string
  size: number
  fileName: string
  href: string
  cover?: ArrayBuffer
  coverType?: string
  cloud?: CloudState
  fileLocal?: boolean
}

export const KIND_LABEL: Record<ShelfKind, string> = { book: 'EPUB' }

export function bookHref(id: string): string {
  return `/livros/${id}`
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
    href: bookHref(b.id),
    cover: b.cover,
    coverType: b.coverType,
    cloud: b.cloud,
    fileLocal: b.fileLocal,
    hash: b.id,
    isbn: b.isbn,
    identifier: b.identifier,
  }
}

export function progressLabel(entry: Pick<ShelfEntry, 'progress'>): string {
  return `${entry.progress}% lido`
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
