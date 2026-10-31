import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudBook } from '../library'
import { supabaseCloud } from '../librarySupabase'

const USER = '11111111-1111-4111-8111-111111111111'

const book: CloudBook = {
  id: 'abc123',
  title: 'Pense em Estatística',
  author: 'Allen B. Downey',
  fileName: 'pense.epub',
  size: 8162622,
  addedAt: '2026-10-30T10:00:00.000Z',
  lastReadAt: '2026-10-30T11:00:00.000Z',
  location: 'epubcfi(/6/4)',
  progress: 21,
  bookmarks: [{ cfi: 'epubcfi(/6/2)', label: 'Prefácio · 3%', createdAt: '2026-10-30T10:30:00.000Z' }],
  weights: [10, 90],
  coverType: 'image/jpeg',
  hasCover: true,
  updatedAt: '2026-10-30T11:00:00.000Z',
}

function fakeClient(opts: { rows?: unknown[]; tableError?: unknown; storageError?: unknown; blob?: Blob } = {}) {
  const calls = {
    upsert: [] as Array<{ row: unknown; options: unknown }>,
    upload: [] as Array<{ path: string; options: unknown }>,
    removeFiles: [] as string[][],
    deleteEq: [] as Array<[string, string]>,
    download: [] as string[],
  }
  const client = {
    from: vi.fn(() => ({
      select: () => ({ order: async () => ({ data: opts.rows ?? [], error: opts.tableError ?? null }) }),
      upsert: async (row: unknown, options: unknown) => {
        calls.upsert.push({ row, options })
        return { error: opts.tableError ?? null }
      },
      delete: () => ({
        eq: async (col: string, val: string) => {
          calls.deleteEq.push([col, val])
          return { error: opts.tableError ?? null }
        },
      }),
    })),
    storage: {
      from: vi.fn((bucket: string) => {
        expect(bucket).toBe('livros')
        return {
          upload: async (path: string, _data: unknown, options: unknown) => {
            calls.upload.push({ path, options })
            return { error: opts.storageError ?? null }
          },
          download: async (path: string) => {
            calls.download.push(path)
            return opts.storageError ? { data: null, error: opts.storageError } : { data: opts.blob ?? new Blob(['conteúdo']), error: null }
          },
          remove: async (paths: string[]) => {
            calls.removeFiles.push(paths)
            return { error: opts.storageError ?? null }
          },
        }
      }),
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('nuvem da Biblioteca sobre o Supabase', () => {
  it('grava o livro e a capa na pasta do usuário, no bucket privado', async () => {
    const { client, calls } = fakeClient()
    const cloud = supabaseCloud(client, USER)
    await cloud.uploadFile('abc123', new ArrayBuffer(8))
    await cloud.uploadCover('abc123', new ArrayBuffer(4), 'image/png')
    expect(calls.upload.map((u) => u.path)).toEqual([`${USER}/abc123.epub`, `${USER}/abc123.cover`])
    expect(calls.upload[0].options).toMatchObject({ upsert: true, contentType: 'application/epub+zip' })
    expect(calls.upload[1].options).toMatchObject({ upsert: true, contentType: 'image/png' })
  })

  it('converte os metadados para o formato da tabela e de volta', async () => {
    const { client, calls } = fakeClient()
    const cloud = supabaseCloud(client, USER)
    await cloud.upsert(book)
    expect(calls.upsert[0].options).toEqual({ onConflict: 'user_id,id' })
    expect(calls.upsert[0].row).toMatchObject({
      user_id: USER,
      id: 'abc123',
      file_name: 'pense.epub',
      has_cover: true,
      cover_type: 'image/jpeg',
      last_read_at: '2026-10-30T11:00:00.000Z',
      updated_at: '2026-10-30T11:00:00.000Z',
      weights: [10, 90],
    })

    const row = calls.upsert[0].row as Record<string, unknown>
    const read = supabaseCloud(fakeClient({ rows: [{ ...row, size: '8162622' }] }).client, USER)
    expect(await read.list()).toEqual([book])
  })

  it('campos vazios da tabela viram opcionais', async () => {
    const { client } = fakeClient({
      rows: [{ user_id: USER, id: 'x1', title: 'T', author: '', file_name: 'f.epub', size: 5, cover_type: null, has_cover: false, weights: null, bookmarks: [], location: null, progress: 0, added_at: 'a', last_read_at: null, updated_at: 'b' }],
    })
    const [b] = await supabaseCloud(client, USER).list()
    expect(b).toMatchObject({ id: 'x1', hasCover: false, bookmarks: [] })
    expect(b.location).toBeUndefined()
    expect(b.weights).toBeUndefined()
    expect(b.lastReadAt).toBeUndefined()
    expect(b.coverType).toBeUndefined()
  })

  it('baixa o arquivo do caminho do usuário; capa ausente vira undefined', async () => {
    const ok = fakeClient({ blob: new Blob(['abc']) })
    const data = await supabaseCloud(ok.client, USER).downloadFile('abc123')
    expect(new TextDecoder().decode(data)).toBe('abc')
    expect(ok.calls.download).toEqual([`${USER}/abc123.epub`])

    const missing = fakeClient({ storageError: { message: 'Object not found' } })
    expect(await supabaseCloud(missing.client, USER).downloadCover('abc123')).toBeUndefined()
    await expect(supabaseCloud(missing.client, USER).downloadFile('abc123')).rejects.toBeDefined()
  })

  it('remove arquivo, capa e linha; propaga erros', async () => {
    const { client, calls } = fakeClient()
    await supabaseCloud(client, USER).remove('abc123')
    expect(calls.removeFiles).toEqual([[`${USER}/abc123.epub`, `${USER}/abc123.cover`]])
    expect(calls.deleteEq).toEqual([['id', 'abc123']])

    await expect(supabaseCloud(fakeClient({ storageError: { message: 'boom' } }).client, USER).remove('abc123')).rejects.toBeDefined()
    await expect(supabaseCloud(fakeClient({ tableError: { code: 'PGRST205', message: 'x' } }).client, USER).list()).rejects.toBeDefined()
  })
})
