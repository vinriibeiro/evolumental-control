/**
 * Áudios dos tópicos (ex.: faixas de uma lição de inglês).
 *
 * - Sempre existe uma cópia local (IndexedDB do navegador), que permite ouvir sem internet.
 * - No modo Supabase, cada faixa também vai para um espaço PRIVADO da conta (bucket "audios" +
 *   tabela topic_audios, protegidos por RLS) e aparece em qualquer aparelho. Em modo local nada sai
 *   do navegador. O áudio nunca vai para o Git nem para a Vercel.
 */
import Dexie, { type Table } from 'dexie'
import { CLOUD_MAX_FILE_BYTES, type CloudState } from '@/services/library'
import { isAudioFile, trackNameFromFile } from '@/lib/audioPlayer'

export interface AudioTrack {
  id: string
  topicId: string
  name: string
  fileName: string
  size: number
  duration?: number
  order: number
  addedAt: string
  fileLocal: boolean
  cloud: CloudState
}

export type CloudTrack = Pick<AudioTrack, 'id' | 'topicId' | 'name' | 'fileName' | 'size' | 'duration' | 'order' | 'addedAt'>

export interface AudioCloud {
  listForTopic(topicId: string): Promise<CloudTrack[]>
  /** Todas as faixas da conta (para a tela de áudios). */
  listAll(): Promise<CloudTrack[]>
  upsert(track: CloudTrack): Promise<void>
  uploadFile(id: string, data: ArrayBuffer): Promise<void>
  downloadFile(id: string): Promise<ArrayBuffer>
  remove(id: string): Promise<void>
}

interface AudioFile {
  id: string
  data: ArrayBuffer
  type: string
}

class AudioDb extends Dexie {
  tracks!: Table<AudioTrack, string>
  files!: Table<AudioFile, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ tracks: 'id, topicId, order', files: 'id' })
  }
}

export type DurationProbe = (data: ArrayBuffer, type: string) => Promise<number | undefined>

/** Lê a duração com um elemento <audio>; devolve undefined se o navegador não conseguir. */
export const probeDuration: DurationProbe = (data, type) =>
  new Promise((resolve) => {
    if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') return resolve(undefined)
    const url = URL.createObjectURL(new Blob([data], { type: type || 'audio/mpeg' }))
    const el = new Audio()
    const done = (v: number | undefined) => {
      clearTimeout(timer)
      el.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(v)
    }
    const timer = setTimeout(() => done(undefined), 6000)
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : undefined)
    el.onerror = () => done(undefined)
    el.src = url
  })

async function contentId(data: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  const view = new Uint8Array(data)
  let h = 5381
  for (let i = 0; i < view.length; i += Math.max(1, Math.floor(view.length / 4096))) h = ((h << 5) + h + view[i]) | 0
  return `${data.byteLength.toString(16)}-${(h >>> 0).toString(16)}`
}

export type AudioUpload = 'synced' | 'too-large' | 'failed' | 'off'
export type AudioAddResult = { status: 'added' | 'duplicate'; track: AudioTrack; upload: AudioUpload }
export interface AudioSyncSummary {
  fromCloud: number
  removed: number
  uploaded: number
  failed: number
}

const byOrder = (a: AudioTrack, b: AudioTrack) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
const toCloud = (t: AudioTrack): CloudTrack => ({ id: t.id, topicId: t.topicId, name: t.name, fileName: t.fileName, size: t.size, duration: t.duration, order: t.order, addedAt: t.addedAt })

export class AudioLibrary {
  private readonly db: AudioDb

  constructor(
    readonly dbName: string,
    readonly cloud: AudioCloud | null = null,
    private readonly probe: DurationProbe = probeDuration,
    private readonly maxCloudBytes = CLOUD_MAX_FILE_BYTES,
  ) {
    this.db = new AudioDb(dbName)
  }

  async destroy(): Promise<void> {
    this.db.close()
    await Dexie.delete(this.dbName)
  }

  async list(topicId: string): Promise<AudioTrack[]> {
    return (await this.db.tracks.where('topicId').equals(topicId).toArray()).sort(byOrder)
  }

  /** Todas as faixas guardadas neste aparelho (qualquer tópico). */
  async listAll(): Promise<AudioTrack[]> {
    return (await this.db.tracks.toArray()).sort(byOrder)
  }

  async get(id: string): Promise<AudioTrack | undefined> {
    return this.db.tracks.get(id)
  }

  /** Adiciona uma faixa ao tópico (e à nuvem, se houver). O mesmo conteúdo não entra duas vezes. */
  async add(topicId: string, file: File): Promise<AudioAddResult> {
    if (!isAudioFile(file.name, file.type)) throw new Error(`"${file.name}" não parece ser um arquivo de áudio.`)
    const data = await file.arrayBuffer()
    const id = await contentId(data)
    const existing = await this.db.tracks.get(id)
    if (existing) {
      if (!existing.fileLocal) {
        const type = file.type || 'audio/mpeg'
        await this.db.transaction('rw', this.db.tracks, this.db.files, async () => {
          await this.db.files.put({ id, data, type })
          await this.db.tracks.update(id, { fileLocal: true })
        })
      }
      return { status: 'duplicate', track: { ...existing, fileLocal: true }, upload: existing.cloud === 'off' ? 'off' : existing.cloud === 'synced' ? 'synced' : 'failed' }
    }
    const type = file.type || 'audio/mpeg'
    const duration = await this.probe(data, type).catch(() => undefined)
    const last = (await this.list(topicId)).at(-1)
    const track: AudioTrack = {
      id,
      topicId,
      name: trackNameFromFile(file.name),
      fileName: file.name,
      size: file.size,
      duration,
      order: (last?.order ?? -1) + 1,
      addedAt: new Date().toISOString(),
      fileLocal: true,
      cloud: this.cloud ? 'pending' : 'off',
    }
    await this.db.transaction('rw', this.db.tracks, this.db.files, async () => {
      await this.db.files.put({ id, data, type })
      await this.db.tracks.put(track)
    })
    if (!this.cloud) return { status: 'added', track, upload: 'off' }
    const upload = await this.push(track)
    return { status: 'added', track: (await this.db.tracks.get(id)) ?? track, upload }
  }

  private async push(track: AudioTrack): Promise<AudioUpload> {
    const cloud = this.cloud
    if (!cloud) return 'off'
    if (track.size > this.maxCloudBytes) {
      await this.db.tracks.update(track.id, { cloud: 'too-large' })
      return 'too-large'
    }
    try {
      const file = await this.db.files.get(track.id)
      if (!file) throw new Error('arquivo local ausente')
      await cloud.uploadFile(track.id, file.data)
      await cloud.upsert(toCloud((await this.db.tracks.get(track.id)) ?? track))
      await this.db.tracks.update(track.id, { cloud: 'synced' })
      return 'synced'
    } catch {
      await this.db.tracks.update(track.id, { cloud: 'pending' })
      return 'failed'
    }
  }

  /** Traz as faixas que estão na nuvem, tira as apagadas em outro aparelho e reenvia as pendentes. Sem `topicId`, todos os tópicos. */
  async sync(topicId?: string): Promise<AudioSyncSummary> {
    const summary: AudioSyncSummary = { fromCloud: 0, removed: 0, uploaded: 0, failed: 0 }
    const cloud = this.cloud
    if (!cloud) return summary
    const remote = topicId === undefined ? await cloud.listAll() : await cloud.listForTopic(topicId)
    const remoteIds = new Set(remote.map((r) => r.id))
    const locals = new Map((topicId === undefined ? await this.listAll() : await this.list(topicId)).map((t) => [t.id, t]))
    for (const r of remote) {
      const local = locals.get(r.id)
      if (!local) {
        await this.db.tracks.put({ ...r, fileLocal: false, cloud: 'synced' })
        summary.fromCloud++
      } else {
        const changes: Partial<AudioTrack> = {}
        if (local.cloud !== 'synced') changes.cloud = 'synced'
        if (local.name !== r.name) changes.name = r.name
        if (local.order !== r.order) changes.order = r.order
        if (Object.keys(changes).length) await this.db.tracks.update(r.id, changes)
      }
    }
    for (const local of locals.values()) {
      if (remoteIds.has(local.id)) continue
      if (local.cloud === 'synced') {
        await this.db.transaction('rw', this.db.tracks, this.db.files, async () => {
          await this.db.tracks.delete(local.id)
          await this.db.files.delete(local.id)
        })
        summary.removed++
      } else if (local.cloud === 'pending' && local.fileLocal) {
        const out = await this.push(local)
        if (out === 'synced') summary.uploaded++
        else if (out === 'failed') summary.failed++
      }
    }
    return summary
  }

  /** Devolve o áudio; se estiver só na nuvem, baixa e guarda neste aparelho (as próximas vezes são locais). */
  async open(id: string): Promise<{ data: ArrayBuffer; type: string }> {
    const local = await this.db.files.get(id)
    if (local) return { data: local.data, type: local.type }
    if (!this.cloud) throw new Error('O arquivo deste áudio não está guardado neste aparelho. Remova a faixa e adicione de novo.')
    const data = await this.cloud.downloadFile(id)
    const type = 'audio/mpeg'
    await this.db.transaction('rw', this.db.tracks, this.db.files, async () => {
      await this.db.files.put({ id, data, type })
      await this.db.tracks.update(id, { fileLocal: true })
    })
    return { data, type }
  }

  /** Remove a faixa daqui e, se estiver na nuvem, de todos os aparelhos. Se a nuvem falhar, nada é apagado. */
  async remove(id: string): Promise<void> {
    const track = await this.db.tracks.get(id)
    if (track && this.cloud && track.cloud === 'synced') await this.cloud.remove(id)
    await this.db.transaction('rw', this.db.tracks, this.db.files, async () => {
      await this.db.tracks.delete(id)
      await this.db.files.delete(id)
    })
  }
}

const instances = new Map<string, AudioLibrary>()

/** Uma biblioteca de áudios por conta (e uma para o modo local): contas diferentes no mesmo navegador não se misturam. */
export function audioLibraryFor(scope: { userId: string; cloud: AudioCloud } | null): AudioLibrary {
  const key = scope ? `evolumental-audio-${scope.userId}` : 'evolumental-audio'
  let lib = instances.get(key)
  if (!lib) {
    lib = new AudioLibrary(key, scope?.cloud ?? null)
    instances.set(key, lib)
  }
  return lib
}

/** Usado nos testes. */
export async function resetAudioLibrariesForTests(): Promise<void> {
  await Promise.all([...instances.values()].map((l) => l.destroy()))
  instances.clear()
}

export function audioErrorMessage(e: unknown): string {
  const err = e as { message?: string; code?: string; statusCode?: string | number } | null
  const msg = err?.message ?? String(e)
  if (err?.code === '42P01' || err?.code === 'PGRST205' || /topic_audios|schema cache/i.test(msg)) {
    return 'Os áudios na nuvem ainda não foram ativados no seu Supabase (falta aplicar a migração 20261031010000_audios.sql).'
  }
  if (/bucket not found/i.test(msg) || err?.statusCode === '404' || err?.statusCode === 404) {
    return 'O espaço privado de áudios ("audios") não existe no seu Supabase. Aplique a migração 20261031010000_audios.sql.'
  }
  if (/fetch|network|failed to/i.test(msg)) return 'Sem conexão com o servidor.'
  if (/exceeded|too large|payload/i.test(msg)) return 'O arquivo é maior que o limite do seu plano do Supabase.'
  return msg
}
