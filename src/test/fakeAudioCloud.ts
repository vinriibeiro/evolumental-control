import type { AudioCloud, CloudTrack } from '@/services/audio'

/** Nuvem de áudios em memória, para testar a sincronização entre "aparelhos". */
export class FakeAudioCloud implements AudioCloud {
  tracks = new Map<string, CloudTrack>()
  files = new Map<string, ArrayBuffer>()
  offline = false
  failUploads = false
  calls: string[] = []

  private guard(op: string) {
    this.calls.push(op)
    if (this.offline) throw new Error('Failed to fetch')
  }

  async listForTopic(topicId: string) {
    this.guard('list')
    return [...this.tracks.values()].filter((t) => t.topicId === topicId).map((t) => structuredClone(t))
  }

  async listAll() {
    this.guard('listAll')
    return [...this.tracks.values()].map((t) => structuredClone(t))
  }

  async upsert(track: CloudTrack) {
    this.guard('upsert')
    this.tracks.set(track.id, structuredClone(track))
  }

  async uploadFile(id: string, data: ArrayBuffer) {
    this.guard('uploadFile')
    if (this.failUploads) throw new Error('upload recusado')
    this.files.set(id, data.slice(0))
  }

  async downloadFile(id: string) {
    this.guard('downloadFile')
    const f = this.files.get(id)
    if (!f) throw new Error('Áudio não encontrado na nuvem.')
    return f.slice(0)
  }

  async remove(id: string) {
    this.guard('remove')
    this.tracks.delete(id)
    this.files.delete(id)
  }
}
