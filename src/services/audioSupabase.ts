import type { SupabaseClient } from '@supabase/supabase-js'
import type { AudioCloud, CloudTrack } from './audio'

const BUCKET = 'audios'
const TABLE = 'topic_audios'

interface Row {
  user_id: string
  id: string
  topic_id: string
  name: string
  file_name: string
  size: number
  duration_seconds: number | null
  sort_order: number
  added_at: string
}

const fromRow = (r: Row): CloudTrack => ({
  id: r.id,
  topicId: r.topic_id,
  name: r.name,
  fileName: r.file_name,
  size: Number(r.size),
  duration: r.duration_seconds === null ? undefined : Number(r.duration_seconds),
  order: r.sort_order,
  addedAt: r.added_at,
})

const toRow = (userId: string, t: CloudTrack): Row => ({
  user_id: userId,
  id: t.id,
  topic_id: t.topicId,
  name: t.name,
  file_name: t.fileName,
  size: t.size,
  duration_seconds: t.duration ?? null,
  sort_order: t.order,
  added_at: t.addedAt,
})

/** Nuvem dos áudios sobre o Supabase: arquivos no bucket privado "audios", em `<user_id>/<id>.mp3`, protegidos por RLS. */
export function supabaseAudioCloud(client: SupabaseClient, userId: string): AudioCloud {
  const files = () => client.storage.from(BUCKET)
  const path = (id: string) => `${userId}/${id}.mp3`
  return {
    async listForTopic(topicId) {
      const { data, error } = await client.from(TABLE).select('*').eq('topic_id', topicId).order('sort_order', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Row[]).map(fromRow)
    },
    async listAll() {
      const { data, error } = await client.from(TABLE).select('*').order('sort_order', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Row[]).map(fromRow)
    },
    async upsert(track) {
      const { error } = await client.from(TABLE).upsert(toRow(userId, track), { onConflict: 'user_id,id' })
      if (error) throw error
    },
    async uploadFile(id, data) {
      const { error } = await files().upload(path(id), data, { upsert: true, contentType: 'audio/mpeg' })
      if (error) throw error
    },
    async downloadFile(id) {
      const { data, error } = await files().download(path(id))
      if (error || !data) throw error ?? new Error('Áudio não encontrado na nuvem.')
      return data.arrayBuffer()
    },
    async remove(id) {
      const { error: storageError } = await files().remove([path(id)])
      if (storageError) throw storageError
      const { error } = await client.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
  }
}
