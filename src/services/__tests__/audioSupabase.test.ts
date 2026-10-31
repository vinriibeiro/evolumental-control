import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudTrack } from '../audio'
import { supabaseAudioCloud } from '../audioSupabase'

const USER = '11111111-1111-4111-8111-111111111111'
const TOPIC = '22222222-2222-4222-8222-222222222222'

const track: CloudTrack = { id: 'abc123', topicId: TOPIC, name: 'Track 1 · pág. 7', fileName: 'L01_T01_pag07.mp3', size: 400000, duration: 78.1, order: 0, addedAt: '2026-10-31T10:00:00.000Z' }

function fakeClient(opts: { rows?: unknown[]; tableError?: unknown; storageError?: unknown; blob?: Blob } = {}) {
  const calls = { upsert: [] as Array<{ row: unknown; options: unknown }>, upload: [] as Array<{ path: string; options: unknown }>, removed: [] as string[][], eq: [] as Array<[string, string]>, download: [] as string[] }
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: (col: string, val: string) => {
          calls.eq.push([col, val])
          return { order: async () => ({ data: opts.rows ?? [], error: opts.tableError ?? null }) }
        },
      }),
      upsert: async (row: unknown, options: unknown) => {
        calls.upsert.push({ row, options })
        return { error: opts.tableError ?? null }
      },
      delete: () => ({
        eq: async (col: string, val: string) => {
          calls.eq.push([col, val])
          return { error: opts.tableError ?? null }
        },
      }),
    })),
    storage: {
      from: vi.fn((bucket: string) => {
        expect(bucket).toBe('audios')
        return {
          upload: async (path: string, _d: unknown, options: unknown) => {
            calls.upload.push({ path, options })
            return { error: opts.storageError ?? null }
          },
          download: async (path: string) => {
            calls.download.push(path)
            return opts.storageError ? { data: null, error: opts.storageError } : { data: opts.blob ?? new Blob(['audio']), error: null }
          },
          remove: async (paths: string[]) => {
            calls.removed.push(paths)
            return { error: opts.storageError ?? null }
          },
        }
      }),
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('nuvem dos áudios sobre o Supabase', () => {
  it('grava o arquivo na pasta do usuário, no bucket privado', async () => {
    const { client, calls } = fakeClient()
    await supabaseAudioCloud(client, USER).uploadFile('abc123', new ArrayBuffer(4))
    expect(calls.upload).toEqual([{ path: `${USER}/abc123.mp3`, options: { upsert: true, contentType: 'audio/mpeg' } }])
  })

  it('converte os metadados para a tabela e de volta', async () => {
    const { client, calls } = fakeClient()
    await supabaseAudioCloud(client, USER).upsert(track)
    expect(calls.upsert[0].options).toEqual({ onConflict: 'user_id,id' })
    expect(calls.upsert[0].row).toMatchObject({ user_id: USER, id: 'abc123', topic_id: TOPIC, file_name: 'L01_T01_pag07.mp3', duration_seconds: 78.1, sort_order: 0 })

    const read = fakeClient({ rows: [{ ...(calls.upsert[0].row as object), size: '400000' }] })
    expect(await supabaseAudioCloud(read.client, USER).listForTopic(TOPIC)).toEqual([track])
    expect(read.calls.eq).toEqual([['topic_id', TOPIC]])
  })

  it('duração ausente vira indefinida', async () => {
    const { client } = fakeClient({ rows: [{ user_id: USER, id: 'x', topic_id: TOPIC, name: 'n', file_name: 'f.mp3', size: 1, duration_seconds: null, sort_order: 2, added_at: 'a' }] })
    const [t] = await supabaseAudioCloud(client, USER).listForTopic(TOPIC)
    expect(t.duration).toBeUndefined()
    expect(t.order).toBe(2)
  })

  it('baixa do caminho do usuário e propaga erros', async () => {
    const ok = fakeClient({ blob: new Blob(['abc']) })
    expect(new TextDecoder().decode(await supabaseAudioCloud(ok.client, USER).downloadFile('abc123'))).toBe('abc')
    expect(ok.calls.download).toEqual([`${USER}/abc123.mp3`])
    await expect(supabaseAudioCloud(fakeClient({ storageError: { message: 'Object not found' } }).client, USER).downloadFile('abc123')).rejects.toBeDefined()
    await expect(supabaseAudioCloud(fakeClient({ tableError: { code: 'PGRST205', message: 'x' } }).client, USER).listForTopic(TOPIC)).rejects.toBeDefined()
  })

  it('remove o arquivo e a linha', async () => {
    const { client, calls } = fakeClient()
    await supabaseAudioCloud(client, USER).remove('abc123')
    expect(calls.removed).toEqual([[`${USER}/abc123.mp3`]])
    expect(calls.eq).toEqual([['id', 'abc123']])
  })
})
