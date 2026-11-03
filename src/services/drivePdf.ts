/** O PDF permanece no Drive: somente referências, posição e marcas entram no IndexedDB. */
import Dexie, { type Table } from 'dexie'
import { isDriveId, isResourceKey } from '@/lib/drive'
import { PDF_CONFLICT_MESSAGE, PDF_MAX_FILE_BYTES, type PdfBook } from '@/services/pdfLibrary'
import type { CourseNode } from '@/types/db'

type ReadingPatch = Partial<Pick<PdfBook, 'currentPage' | 'pageCount' | 'annotations' | 'bookmarks' | 'lastReadAt'>>
interface RecordRow { key: string; driveId: string; book: PdfBook; revision?: string }
class DrivePdfDb extends Dexie {
  records!: Table<RecordRow, string>
  constructor(name: string) { super(name); this.version(1).stores({ records: 'key, driveId' }) }
}
interface LoadedPdf { key: string; book: PdfBook; bytes: ArrayBuffer; revision: string | null }
const positive = (value: number) => Number.isSafeInteger(value) && value > 0

export class DrivePdfStore {
  readonly dbName: string
  private readonly db: DrivePdfDb
  private loaded: LoadedPdf | null = null
  private loading: { controller: AbortController; promise: Promise<LoadedPdf> } | null = null

  constructor(private readonly scope: string, private readonly node: CourseNode, private readonly token: string, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    if (!scope.trim() || !isDriveId(node.drive_id) || node.mime_type !== 'application/pdf' || node.kind !== 'item') throw new Error('Este item não é uma referência PDF válida do Drive.')
    if (node.resource_key != null && !isResourceKey(node.resource_key)) throw new Error('A chave de recurso do PDF é inválida.')
    if (!token.trim()) throw new Error('Autorize a leitura de PDFs com sua conta Google.')
    this.dbName = `${this.scope}-drive-pdf`
    this.db = new DrivePdfDb(this.dbName)
  }

  /** Interrompe a transferência e descarta bytes em memória; uma nova carga pode começar. */
  cancel(): void {
    this.loading?.controller.abort()
    this.loading = null
    this.loaded = null
  }

  private async response(url: string, signal: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` }
    if (this.node.resource_key) headers['X-Goog-Drive-Resource-Keys'] = `${this.node.drive_id}/${this.node.resource_key}`
    let response: Response
    try { response = await this.fetchImpl(url, { signal, headers, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }) }
    catch (error) {
      if (signal.aborted) {
        const aborted = new Error('A abertura do PDF foi cancelada.', { cause: error })
        aborted.name = 'AbortError'
        throw aborted
      }
      throw new Error(error instanceof Error && error.name === 'AbortError' ? 'A abertura do PDF foi cancelada.' : 'Falha de conexão ao ler o PDF do Drive.', { cause: error })
    }
    signal.throwIfAborted()
    if (!response.ok) {
      if (response.status === 401) throw new Error('A autorização do Google expirou. Conecte novamente para ler o PDF.')
      if (response.status === 403) throw new Error('A conta Google não tem permissão para ler este PDF, ou o proprietário bloqueou o acesso ao conteúdo.')
      if (response.status === 404) throw new Error('PDF não encontrado no Drive ou indisponível para esta conta Google.')
      throw new Error(`O Google Drive não conseguiu entregar o PDF (${response.status}). Tente novamente.`)
    }
    return response
  }

  private load(): Promise<LoadedPdf> {
    if (this.loaded) return Promise.resolve(this.loaded)
    if (this.loading) return this.loading.promise
    const controller = new AbortController()
    const promise = this.fetchPdf(controller.signal).then((loaded) => {
      controller.signal.throwIfAborted()
      if (this.loading?.controller === controller) this.loaded = loaded
      return loaded
    }).finally(() => { if (this.loading?.controller === controller) this.loading = null })
    this.loading = { controller, promise }
    return promise
  }

  private async fetchPdf(signal: AbortSignal): Promise<LoadedPdf> {
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.node.drive_id)}`
    const metadataResponse = await this.response(`${base}?${new URLSearchParams({ fields: 'id,name,mimeType,size,trashed,capabilities(canDownload)', supportsAllDrives: 'true' })}`, signal)
    const metadata = await metadataResponse.json() as { id?: string; name?: string; mimeType?: string; size?: string; trashed?: boolean; capabilities?: { canDownload?: boolean } }
    if (metadata.id !== this.node.drive_id || metadata.mimeType !== 'application/pdf' || metadata.trashed) throw new Error('O arquivo foi removido ou não é mais um PDF no Google Drive.')
    if (metadata.capabilities?.canDownload === false) throw new Error('O proprietário bloqueou o acesso ao conteúdo deste PDF. Use a visualização permitida no Google Drive.')
    if (metadata.size && Number(metadata.size) > PDF_MAX_FILE_BYTES) throw new Error('O PDF ultrapassa o limite de 100 MiB para leitura.')
    signal.throwIfAborted()
    const response = await this.response(`${base}?alt=media&supportsAllDrives=true`, signal)
    if (Number(response.headers.get('Content-Length')) > PDF_MAX_FILE_BYTES) { await response.body?.cancel(); throw new Error('O PDF ultrapassa o limite de 100 MiB para leitura.') }
    if (!response.body) throw new Error('O Drive entregou um PDF vazio.')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > PDF_MAX_FILE_BYTES) { await reader.cancel(); throw new Error('O PDF ultrapassa o limite de 100 MiB para leitura.') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    signal.throwIfAborted()
    const merged = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
    if (size < 5 || [37, 80, 68, 70, 45].some((byte, index) => merged[index] !== byte)) throw new Error('O conteúdo recebido do Drive não é um PDF válido.')
    if (!globalThis.crypto?.subtle) throw new Error('Abra a plataforma em HTTPS ou localhost para ler PDFs do Drive.')
    const bytes = merged.buffer
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const key = `${this.node.drive_id}:${hash}`
    signal.throwIfAborted()
    const stamp = new Date().toISOString()
    const initial: PdfBook = { id: this.node.drive_id, title: this.node.custom_title || metadata.name?.replace(/\.pdf$/i, '') || this.node.title, fileName: metadata.name || this.node.title, size, pageCount: 1, currentPage: 1, annotations: [], bookmarks: [], addedAt: stamp, updatedAt: stamp }
    const record = await this.db.transaction('rw', this.db.records, async () => {
      const existing = await this.db.records.get(key)
      if (existing) return existing
      const row: RecordRow = { key, driveId: this.node.drive_id, book: initial, revision: crypto.randomUUID() }
      await this.db.records.add(row)
      return row
    })
    return { key, book: record.book, bytes, revision: record.revision ?? null }
  }

  async get(id: string): Promise<PdfBook | undefined> { return id === this.node.drive_id ? (await this.load()).book : undefined }
  async file(id: string): Promise<ArrayBuffer | undefined> { return id === this.node.drive_id ? (await this.load()).bytes : undefined }

  async update(id: string, patch: ReadingPatch): Promise<void> {
    if (id !== this.node.drive_id) throw new Error('Referência PDF incorreta.')
    const loaded = await this.load()
    const next = await this.db.transaction('rw', this.db.records, async () => {
      const row = await this.db.records.get(loaded.key)
      if (!row) throw new Error('A referência deste PDF não está mais disponível.')
      if ((row.revision ?? null) !== loaded.revision) throw new Error(PDF_CONFLICT_MESSAGE)
      const count = patch.pageCount ?? row.book.pageCount
      const page = patch.currentPage ?? row.book.currentPage
      if (!positive(count) || !positive(page)) throw new Error('Informe uma página válida.')
      const annotations = patch.annotations ?? row.book.annotations
      const ids = new Set<string>()
      for (const mark of annotations) {
        if (!mark.id || ids.has(mark.id) || !positive(mark.page) || mark.page > count || !['highlight', 'ink', 'note'].includes(mark.type)) throw new Error('Uma marcação do PDF é inválida.')
        ids.add(mark.id)
        if (mark.points?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)) || mark.rects?.some((rect) => ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) || (mark.strokeWidth != null && (!Number.isFinite(mark.strokeWidth) || mark.strokeWidth <= 0))) throw new Error('Uma marcação contém coordenadas inválidas.')
      }
      const bookmarks = patch.bookmarks ?? row.book.bookmarks
      if (bookmarks.some((number) => !positive(number) || number > count)) throw new Error('Um marcador aponta para uma página inexistente.')
      if (patch.lastReadAt != null && !Number.isFinite(Date.parse(patch.lastReadAt))) throw new Error('A data de leitura é inválida.')
      const book: PdfBook = { ...row.book, pageCount: count, currentPage: Math.min(page, count), annotations, bookmarks: [...new Set(bookmarks)].sort((a, b) => a - b), updatedAt: new Date().toISOString() }
      if (patch.lastReadAt != null) book.lastReadAt = patch.lastReadAt
      const revision = crypto.randomUUID()
      await this.db.records.put({ ...row, book, revision })
      return { book, revision }
    })
    loaded.book = next.book
    loaded.revision = next.revision
  }

  close(): void { this.cancel(); this.db.close() }
}
