import type { SupabaseClient } from '@supabase/supabase-js'
import type { PdfBook } from './pdfLibrary'

export interface CloudPdf {
  id: string
  revision: string
  fileKey: string
  book: PdfBook | null
}

export interface PdfCloud {
  list(): Promise<CloudPdf[]>
  find?(id: string): Promise<CloudPdf | undefined>
  write(entry: CloudPdf, expectedRevision: string | null): Promise<boolean>
  upload(key: string, data: ArrayBuffer): Promise<void>
  download(key: string): Promise<ArrayBuffer>
  removeFile(key: string): Promise<void>
}

type StoredBook = Omit<PdfBook, 'cover' | 'cloud' | 'fileLocal'> & { cover?: string }
type Row = { id: string; revision: string; file_key: string; book: StoredBook | null }

function encode(book: PdfBook | null): StoredBook | null {
  if (!book) return null
  const { cover, cloud: _cloud, fileLocal: _fileLocal, ...metadata } = book
  return { ...metadata, cover: cover && btoa(Array.from(new Uint8Array(cover), (byte) => String.fromCharCode(byte)).join('')) }
}

function decode(row: Row): CloudPdf {
  const { id, revision, file_key, book } = row
  return {
    id,
    revision,
    fileKey: file_key,
    book: book && { ...book, cover: book.cover ? Uint8Array.from(atob(book.cover), (char) => char.charCodeAt(0)).buffer : undefined },
  }
}

export function supabasePdfCloud(client: SupabaseClient, userId: string): PdfCloud {
  const table = () => client.from('library_pdfs')
  const bucket = () => client.storage.from('livros')
  const path = (key: string) => `${userId}/pdfs/${key}.pdf`

  return {
    async list() {
      const rows: Row[] = []
      const pageSize = 250
      for (;;) {
        const { data, error } = await table().select('id,revision,file_key,book').eq('user_id', userId)
          .order('id').range(rows.length, rows.length + pageSize - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < pageSize) return rows.map(decode)
      }
    },
    async find(id) {
      if (!/^[0-9a-f]{64}$/.test(id)) return undefined
      const { data, error } = await table().select('id,revision,file_key,book')
        .eq('user_id', userId).eq('id', id).maybeSingle<Row>()
      if (error) throw error
      return data ? decode(data) : undefined
    },
    async write(entry, expectedRevision) {
      const row = { user_id: userId, id: entry.id, revision: entry.revision, file_key: entry.fileKey, book: encode(entry.book) }
      if (expectedRevision === null) {
        const { error } = await table().insert(row)
        if (error?.code === '23505') return false
        if (error) throw error
        return true
      }
      const { data, error } = await table().update(row).eq('user_id', userId).eq('id', entry.id).eq('revision', expectedRevision).select('id')
      if (error) throw error
      return data.length === 1
    },
    async upload(key, data) {
      const { error } = await bucket().upload(path(key), data, { contentType: 'application/pdf' })
      if (error) throw error
    },
    async download(key) {
      const { data, error } = await bucket().download(path(key))
      if (error) throw error
      return data.arrayBuffer()
    },
    async removeFile(key) {
      const { error } = await bucket().remove([path(key)])
      if (error) throw error
    },
  }
}

export function pdfCloudErrorMessage(error: unknown): string {
  const details = error as { code?: string; message?: string } | null
  if (details?.code === 'PGRST205' || details?.code === '42P01') {
    return 'Falta aplicar a migração 20261124000000_library_pdfs.sql no Supabase.'
  }
  return details?.message ?? String(error)
}
