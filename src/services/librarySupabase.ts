import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeShelfState } from '@/lib/library'
import type { BookNote, Bookmark, CloudBook, LibraryCloud } from './library'

const BUCKET = 'livros'
const TABLE = 'library_books'

/** Colunas criadas pela migração 20261121010000_v2_library.sql (estante v2). */
interface RowV2 {
  subject: string | null
  favorite: boolean
  shelf_state: string
  notes: BookNote[]
  isbn: string | null
  identifier: string | null
}

interface Row extends Partial<RowV2> {
  user_id: string
  id: string
  title: string
  author: string
  file_name: string
  size: number
  cover_type: string | null
  has_cover: boolean
  weights: number[] | null
  bookmarks: Bookmark[]
  location: string | null
  progress: number
  added_at: string
  last_read_at: string | null
  updated_at: string
}

const V2_COLUMNS = ['subject', 'favorite', 'shelf_state', 'notes', 'isbn', 'identifier'] as const

function fromRow(r: Row): CloudBook {
  // sem shelf_state a linha veio de um projeto que ainda não aplicou a migração v2
  const v2 = r.shelf_state != null
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    fileName: r.file_name,
    size: Number(r.size),
    addedAt: r.added_at,
    lastReadAt: r.last_read_at ?? undefined,
    location: r.location ?? undefined,
    progress: r.progress,
    bookmarks: r.bookmarks ?? [],
    weights: r.weights ?? undefined,
    coverType: r.cover_type ?? undefined,
    hasCover: r.has_cover,
    updatedAt: r.updated_at,
    subject: r.subject ?? undefined,
    favorite: v2 ? Boolean(r.favorite) : undefined,
    shelf: v2 ? normalizeShelfState(r.shelf_state) : undefined,
    notes: v2 ? (r.notes ?? []) : undefined,
    isbn: r.isbn ?? undefined,
    identifier: r.identifier ?? undefined,
  }
}

function toRow(userId: string, b: CloudBook): Row & RowV2 {
  return {
    user_id: userId,
    id: b.id,
    title: b.title,
    author: b.author,
    file_name: b.fileName,
    size: b.size,
    cover_type: b.coverType ?? null,
    has_cover: b.hasCover,
    weights: b.weights ?? null,
    bookmarks: b.bookmarks,
    location: b.location ?? null,
    progress: b.progress,
    added_at: b.addedAt,
    last_read_at: b.lastReadAt ?? null,
    updated_at: b.updatedAt,
    subject: b.subject ?? null,
    favorite: b.favorite ?? false,
    shelf_state: b.shelf ?? 'active',
    notes: b.notes ?? [],
    isbn: b.isbn ?? null,
    identifier: b.identifier ?? null,
  }
}

function withoutV2(row: Row): Row {
  const legacy: Record<string, unknown> = { ...row }
  for (const column of V2_COLUMNS) delete legacy[column]
  return legacy as unknown as Row
}

/** O Supabase recusou a gravação por não conhecer uma das colunas novas? (migração v2 ainda não aplicada) */
function missingV2Column(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST204' || error.code === '42703') return true
  return new RegExp(`(${V2_COLUMNS.join('|')}).*(column|schema cache)|(column|schema cache).*(${V2_COLUMNS.join('|')})`, 'i').test(error.message ?? '')
}

/**
 * Nuvem da Biblioteca sobre o Supabase. Os arquivos ficam no bucket privado "livros", sempre em
 * `<user_id>/<id>.epub` e `<user_id>/<id>.cover`; as políticas RLS só deixam o próprio dono acessar.
 */
export function supabaseCloud(client: SupabaseClient, userId: string): LibraryCloud {
  const files = () => client.storage.from(BUCKET)
  const epubPath = (id: string) => `${userId}/${id}.epub`
  const coverPath = (id: string) => `${userId}/${id}.cover`
  // Projeto sem a migração v2: grava só as colunas antigas, para a estante e a posição de leitura
  // continuarem sincronizando. Assunto, favorito, estante e anotações ficam no aparelho até lá.
  let legacy = false

  return {
    async list() {
      const { data, error } = await client.from(TABLE).select('*').order('added_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Row[]
      if (rows.length > 0) legacy = rows[0].shelf_state == null
      return rows.map(fromRow)
    },

    async upsert(book) {
      const row = toRow(userId, book)
      if (!legacy) {
        const { error } = await client.from(TABLE).upsert(row, { onConflict: 'user_id,id' })
        if (!error) return
        if (!missingV2Column(error)) throw error
        legacy = true
      }
      const { error } = await client.from(TABLE).upsert(withoutV2(row), { onConflict: 'user_id,id' })
      if (error) throw error
    },

    schemaOutdated: () => legacy,

    async resetReadingProgress(updatedAt) {
      const { error } = await client.from(TABLE)
        .update({ location: null, last_read_at: null, progress: 0, updated_at: updatedAt })
        .eq('user_id', userId)
      if (error) throw error
    },

    async uploadFile(id, data) {
      const { error } = await files().upload(epubPath(id), data, { upsert: true, contentType: 'application/epub+zip' })
      if (error) throw error
    },

    async uploadCover(id, data, type) {
      const { error } = await files().upload(coverPath(id), data, { upsert: true, contentType: type })
      if (error) throw error
    },

    async downloadFile(id) {
      const { data, error } = await files().download(epubPath(id))
      if (error || !data) throw error ?? new Error('Livro não encontrado na nuvem.')
      return data.arrayBuffer()
    },

    async downloadCover(id) {
      const { data, error } = await files().download(coverPath(id))
      if (error || !data) return undefined
      return data.arrayBuffer()
    },

    async remove(id) {
      const { error: storageError } = await files().remove([epubPath(id), coverPath(id)])
      if (storageError) throw storageError
      const { error } = await client.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
  }
}
