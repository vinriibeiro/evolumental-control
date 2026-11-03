// Percorre uma pasta do Drive e todas as subpastas, lendo SÓ metadados (nome, tipo, tamanho, datas).
// Nada é baixado. O cliente HTTP é injetado (DriveClient), então a regra é testável sem rede.
//
// - Paginação: segue nextPageToken até o fim.
// - Limites da API: 429/403 de cota e 5xx são repetidos com espera crescente; outros erros não.
// - Falhas parciais: uma pasta que não pôde ser listada entra em `failedFolders`, e só as pastas listadas por
//   completo entram em `listedFolders` — a reconciliação usa isso para nunca marcar como removido o que não foi visto.
// - Atalhos: o atalho vira referência ao alvo; pastas já visitadas (ciclos ou o mesmo conteúdo por dois caminhos) não
//   são percorridas de novo.
import { FOLDER_MIME, SHORTCUT_MIME, isDriveId, isResourceKey } from './drive'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  resourceKey?: string
  size?: string
  modifiedTime?: string
  trashed?: boolean
  videoMediaMetadata?: { durationMillis?: string }
  shortcutDetails?: { targetId?: string; targetMimeType?: string; targetResourceKey?: string }
}

export interface DriveListPage {
  files: DriveFile[]
  nextPageToken?: string
}

export type DriveErrorKind = 'auth' | 'forbidden' | 'not_found' | 'rate' | 'server' | 'network' | 'invalid'

export class DriveApiError extends Error {
  kind: DriveErrorKind
  status: number
  constructor(kind: DriveErrorKind, status: number, message: string) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export interface DriveClient {
  getFile(id: string, resourceKey?: string): Promise<DriveFile>
  listChildren(folderId: string, pageToken?: string, resourceKey?: string): Promise<DriveListPage>
}

/** Um arquivo ou pasta na posição em que foi encontrado (a mesma pasta/arquivo pode aparecer em vários lugares). */
export interface CrawlEntry {
  id: string
  name: string
  mimeType: string
  /** Pasta do Drive onde foi encontrado. */
  parentId: string
  resourceKey: string | null
  size: number | null
  modifiedTime: string | null
  durationMs: number | null
  /** Encontrado por meio deste atalho (ID do atalho). */
  viaShortcut: string | null
}

export interface CrawlIssue {
  id: string
  name: string
  kind: DriveErrorKind | 'cycle' | 'shortcut_broken' | 'limit'
  message: string
}

export interface CrawlResult {
  root: DriveFile | null
  entries: CrawlEntry[]
  /** Pastas listadas por completo (todas as páginas). */
  listedFolders: Set<string>
  failedFolders: CrawlIssue[]
  /** Atalhos e repetições ignorados para não duplicar nem entrar em ciclo. */
  skipped: CrawlIssue[]
  truncated: boolean
  /** Falha antes de começar (sem acesso à pasta raiz, credencial inválida…). */
  fatal: CrawlIssue | null
}

export interface CrawlOptions {
  retries?: number
  sleep?: (ms: number) => Promise<void>
  maxItems?: number
  maxDepth?: number
  concurrency?: number
  onProgress?: (p: { folders: number; items: number }) => void
  signal?: AbortSignal
}

const RETRYABLE: DriveErrorKind[] = ['rate', 'server', 'network']
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries: number, sleep: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const kind = e instanceof DriveApiError ? e.kind : 'network'
      if (!RETRYABLE.includes(kind) || attempt >= retries) throw e
      await sleep(Math.min(16000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250))
    }
  }
}

const toIssue = (id: string, name: string, e: unknown): CrawlIssue => ({
  id,
  name,
  kind: e instanceof DriveApiError ? e.kind : 'network',
  message: e instanceof Error ? e.message : String(e),
})

const num = (v: string | undefined) => {
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export async function crawlFolder(client: DriveClient, rootId: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const retries = opts.retries ?? 4
  const sleep = opts.sleep ?? defaultSleep
  const maxItems = opts.maxItems ?? 20000
  const maxDepth = opts.maxDepth ?? 30
  const concurrency = Math.max(1, opts.concurrency ?? 4)
  const result: CrawlResult = { root: null, entries: [], listedFolders: new Set(), failedFolders: [], skipped: [], truncated: false, fatal: null }
  if (!isDriveId(rootId)) {
    result.fatal = { id: rootId, name: '', kind: 'invalid', message: 'ID de pasta inválido.' }
    return result
  }
  try {
    const root = await withRetry(() => client.getFile(rootId), retries, sleep)
    if (root.mimeType !== FOLDER_MIME) throw new DriveApiError('invalid', 400, 'O link não é de uma pasta.')
    if (root.trashed) throw new DriveApiError('not_found', 404, 'A pasta está na lixeira.')
    result.root = root
  } catch (e) {
    result.fatal = toIssue(rootId, '', e)
    return result
  }

  const visited = new Set<string>([rootId])
  const queue: Array<{ id: string; name: string; depth: number; resourceKey?: string }> = [{ id: rootId, name: result.root.name, depth: 0, resourceKey: result.root.resourceKey }]

  const listFolder = async (folder: (typeof queue)[number]) => {
    const files: DriveFile[] = []
    let token: string | undefined
    const seenTokens = new Set<string>()
    do {
      if (opts.signal?.aborted) throw new DriveApiError('network', 0, 'Importação cancelada.')
      const page = await withRetry(() => client.listChildren(folder.id, token, folder.resourceKey), retries, sleep)
      files.push(...(page.files ?? []))
      token = page.nextPageToken || undefined
      if (token && seenTokens.has(token)) throw new DriveApiError('server', 500, 'Paginação repetida pela API.')
      if (token) seenTokens.add(token)
    } while (token)
    return files
  }

  const handle = (folder: (typeof queue)[number], files: DriveFile[]) => {
    const seenHere = new Set<string>()
    for (const f of files) {
      if (!f || !isDriveId(f.id) || f.trashed) continue
      if (seenHere.has(f.id)) continue // a API pode repetir itens entre páginas
      seenHere.add(f.id)
      let id = f.id
      let mimeType = f.mimeType
      let resourceKey = isResourceKey(f.resourceKey) ? f.resourceKey : null
      let viaShortcut: string | null = null
      if (f.mimeType === SHORTCUT_MIME) {
        const target = f.shortcutDetails?.targetId
        if (!isDriveId(target) || !f.shortcutDetails?.targetMimeType) {
          result.skipped.push({ id: f.id, name: f.name, kind: 'shortcut_broken', message: 'Atalho sem destino acessível.' })
          continue
        }
        viaShortcut = f.id
        id = target
        mimeType = f.shortcutDetails.targetMimeType
        resourceKey = isResourceKey(f.shortcutDetails.targetResourceKey) ? f.shortcutDetails.targetResourceKey : null
        if (seenHere.has(id)) {
          result.skipped.push({ id: f.id, name: f.name, kind: 'cycle', message: 'Atalho para um item que já está na mesma pasta; não foi repetido.' })
          continue
        }
        seenHere.add(id)
      }
      if (mimeType === FOLDER_MIME) {
        if (visited.has(id)) {
          result.skipped.push({ id: viaShortcut ?? id, name: f.name, kind: 'cycle', message: 'Pasta já incluída por outro caminho; não foi repetida.' })
          continue
        }
        if (folder.depth + 1 > maxDepth) {
          result.skipped.push({ id, name: f.name, kind: 'limit', message: `Mais de ${maxDepth} níveis de subpastas.` })
          continue
        }
        visited.add(id)
        queue.push({ id, name: f.name, depth: folder.depth + 1, resourceKey: resourceKey ?? undefined })
      }
      if (result.entries.length >= maxItems) {
        result.truncated = true
        return
      }
      result.entries.push({
        id,
        name: (f.name ?? '').trim() || '(sem nome)',
        mimeType,
        parentId: folder.id,
        resourceKey,
        size: viaShortcut ? null : num(f.size),
        modifiedTime: viaShortcut ? null : (f.modifiedTime ?? null),
        durationMs: viaShortcut ? null : num(f.videoMediaMetadata?.durationMillis),
        viaShortcut,
      })
    }
  }

  const processFolder = async (folder: (typeof queue)[number]) => {
    try {
      const files = await listFolder(folder)
      handle(folder, files)
      if (!result.truncated) result.listedFolders.add(folder.id)
    } catch (e) {
      result.failedFolders.push(toIssue(folder.id, folder.name, e))
      // credencial expirada/revogada: o restante falharia igual
      if (e instanceof DriveApiError && e.kind === 'auth' && !result.fatal) result.fatal = toIssue(folder.id, folder.name, e)
    }
    opts.onProgress?.({ folders: result.listedFolders.size, items: result.entries.length })
  }

  // Lista algumas pastas ao mesmo tempo, com limite, para não estourar a cota por usuário.
  while (queue.length && !result.truncated && !result.fatal) {
    await Promise.all(queue.splice(0, concurrency).map(processFolder))
  }
  if (result.truncated) result.skipped.push({ id: rootId, name: result.root.name, kind: 'limit', message: `Mais de ${maxItems} itens: a importação parou no limite.` })
  return result
}
