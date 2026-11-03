// Drive falso para testes: árvore em memória, paginação configurável e falhas injetáveis.
// Os nomes e IDs são sintéticos — não representam o conteúdo real de nenhuma pasta.
import { DriveApiError, type DriveClient, type DriveFile } from '@/lib/driveCrawl'
import { FOLDER_MIME, SHORTCUT_MIME } from '@/lib/drive'

export interface FakeItem {
  id: string
  name: string
  mimeType: string
  parents: string[]
  size?: string
  durationMillis?: string
  shortcutTarget?: { id: string; mimeType: string }
}

export const fid = (n: string) => `id_${n.normalize('NFD').replace(/[^A-Za-z0-9_-]/g, '_')}`.padEnd(12, '0').slice(0, 120)

export class FakeDrive implements DriveClient {
  items = new Map<string, FakeItem>()
  pageSize = 2
  /** Falhas por pasta: lista de erros consumidos a cada chamada (permite "falha uma vez e depois funciona"). */
  failures = new Map<string, DriveApiError[]>()
  calls = 0

  folder(name: string, parent?: string, id = fid(name)) {
    this.items.set(id, { id, name, mimeType: FOLDER_MIME, parents: parent ? [parent] : [] })
    return id
  }
  file(name: string, parent: string, mimeType = 'application/pdf', id = fid(name), extra: Partial<FakeItem> = {}) {
    this.items.set(id, { id, name, mimeType, parents: [parent], ...extra })
    return id
  }
  shortcut(name: string, parent: string, target: string, id = fid('sc_' + name)) {
    const t = this.items.get(target)
    this.items.set(id, { id, name, mimeType: SHORTCUT_MIME, parents: [parent], shortcutTarget: { id: target, mimeType: t?.mimeType ?? 'application/pdf' } })
    return id
  }
  rename(id: string, name: string) {
    this.items.get(id)!.name = name
  }
  move(id: string, parent: string) {
    this.items.get(id)!.parents = [parent]
  }
  remove(id: string) {
    this.items.delete(id)
    for (const it of [...this.items.values()]) if (it.parents.includes(id)) this.remove(it.id)
  }
  failOnce(folderId: string, kind: DriveApiError['kind'], times = 1) {
    this.failures.set(folderId, Array.from({ length: times }, () => new DriveApiError(kind, kind === 'rate' ? 429 : kind === 'forbidden' ? 403 : 500, kind)))
  }

  private toFile(it: FakeItem): DriveFile {
    return {
      id: it.id,
      name: it.name,
      mimeType: it.mimeType,
      size: it.size,
      modifiedTime: '2026-10-01T00:00:00.000Z',
      videoMediaMetadata: it.durationMillis ? { durationMillis: it.durationMillis } : undefined,
      shortcutDetails: it.shortcutTarget ? { targetId: it.shortcutTarget.id, targetMimeType: it.shortcutTarget.mimeType } : undefined,
    }
  }

  async getFile(id: string) {
    this.calls++
    const it = this.items.get(id)
    if (!it) throw new DriveApiError('not_found', 404, 'not found')
    return this.toFile(it)
  }

  async listChildren(folderId: string, pageToken?: string) {
    this.calls++
    const queue = this.failures.get(folderId)
    if (queue?.length) throw queue.shift()!
    const all = [...this.items.values()].filter((x) => x.parents.includes(folderId))
    const start = pageToken ? Number(pageToken) : 0
    const page = all.slice(start, start + this.pageSize)
    const next = start + this.pageSize < all.length ? String(start + this.pageSize) : undefined
    return { files: page.map((x) => this.toFile(x)), nextPageToken: next }
  }
}

export const noSleep = () => Promise.resolve()
