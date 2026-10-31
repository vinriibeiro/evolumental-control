import type { SupabaseClient } from '@supabase/supabase-js'
import type { Bookmark, CloudBook, LibraryCloud } from './library'

const BUCKET = 'livros'
const TABLE = 'library_books'

interface Row {
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

function fromRow(r: Row): CloudBook {
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
  }
}

function toRow(userId: string, b: CloudBook): Row {
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
  }
}

/**
 * Nuvem da Biblioteca sobre o Supabase. Os arquivos ficam no bucket privado "livros", sempre em
 * `<user_id>/<id>.epub` e `<user_id>/<id>.cover`; as políticas RLS só deixam o próprio dono acessar.
 */
export function supabaseCloud(client: SupabaseClient, userId: string): LibraryCloud {
  const files = () => client.storage.from(BUCKET)
  const epubPath = (id: string) => `${userId}/${id}.epub`
  const coverPath = (id: string) => `${userId}/${id}.cover`

  return {
    async list() {
      const { data, error } = await client.from(TABLE).select('*').order('added_at', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Row[]).map(fromRow)
    },

    async upsert(book) {
      const { error } = await client.from(TABLE).upsert(toRow(userId, book), { onConflict: 'user_id,id' })
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
