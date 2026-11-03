import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrivePdfStore } from '../drivePdf'
import { PDF_MAX_FILE_BYTES, type PdfAnnotation } from '../pdfLibrary'
import type { CourseNode } from '@/types/db'
import { PDFDocument, PDFDict, PDFHexString, PDFName } from 'pdf-lib'
import { exportAnnotatedPdf } from '@/lib/pdfExport'

const node = { kind: 'item', drive_id: 'drive_pdf_material_123', mime_type: 'application/pdf', resource_key: 'key123', title: 'Apostila.pdf', custom_title: null } as CourseNode
const stores: DrivePdfStore[] = []
let serial = 0
const bytes = (text = 'Versão A') => new TextEncoder().encode(`%PDF-1.7\n${text}`)
const metadata = (extra = {}) => ({ id: node.drive_id, name: 'Apostila.pdf', mimeType: 'application/pdf', size: String(bytes().byteLength), trashed: false, capabilities: { canDownload: true }, ...extra })
function client(content = bytes(), meta = metadata()) {
  return vi.fn<typeof fetch>(async (input) => String(input).includes('alt=media') ? new Response(new Uint8Array(content), { headers: { 'Content-Type': 'application/pdf' } }) : Response.json(meta))
}
function store(fetcher = client(), scope = `drive-pdf-test-${++serial}`) {
  const value = new DrivePdfStore(scope, node, 'memory-only-token', fetcher)
  stores.push(value)
  return value
}
const mark: PdfAnnotation = { id: 'nota1', type: 'note', page: 2, color: '#ffcc00', points: [{ x: 70, y: 700 }], text: 'Conceito importante', createdAt: '2026-11-03T15:00:00Z' }

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(async () => {
  const names = [...new Set(stores.map((value) => value.dbName))]
  stores.splice(0).forEach((value) => value.close())
  await Promise.all(names.map((name) => Dexie.delete(name)))
  vi.restoreAllMocks(); vi.unstubAllGlobals()
  delete window.google
})

describe('PDF do Drive em memória', () => {
  it('compartilha get/file, usa headers oficiais e persiste apenas metadados', async () => {
    const fetcher = client()
    const value = store(fetcher)
    const [book, data] = await Promise.all([value.get(node.drive_id), value.file(node.drive_id)])
    expect(book).toMatchObject({ id: node.drive_id, title: 'Apostila', annotations: [], currentPage: 1 })
    expect(Array.from(new Uint8Array(data!))).toEqual(Array.from(bytes()))
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({ cache: 'no-store', credentials: 'omit', headers: { Authorization: 'Bearer memory-only-token', 'X-Goog-Drive-Resource-Keys': `${node.drive_id}/key123` } })
    }
    const inspection = new Dexie(value.dbName)
    await inspection.open()
    expect(inspection.tables.map((table) => table.name)).toEqual(['records'])
    const rows = await inspection.table('records').toArray()
    expect(rows).toHaveLength(1)
    const serialized = JSON.stringify(rows)
    expect(serialized).not.toContain('memory-only-token')
    expect(serialized).not.toContain('Versão A')
    expect(Object.keys(rows[0]).sort()).toEqual(['book', 'driveId', 'key', 'revision'])
    inspection.close()
  })

  it('retoma marcas da mesma versão, isola contas e não aplica marcas em conteúdo alterado', async () => {
    const scope = `drive-pdf-test-${++serial}`
    const original = store(client(), scope)
    await original.get(node.drive_id)
    await original.update(node.drive_id, { pageCount: 4, currentPage: 2, annotations: [mark], bookmarks: [2] })
    const reopened = store(client(), scope)
    expect(await reopened.get(node.drive_id)).toMatchObject({ currentPage: 2, annotations: [mark], bookmarks: [2] })
    const changed = store(client(bytes('Versão B')), scope)
    expect(await changed.get(node.drive_id)).toMatchObject({ currentPage: 1, annotations: [], bookmarks: [] })
    const otherAccount = store()
    expect((await otherAccount.get(node.drive_id))?.annotations).toEqual([])
    const oldAgain = store(client(), scope)
    expect((await oldAgain.get(node.drive_id))?.annotations).toEqual([mark])
  })

  it.each([401, 403, 404])('trata HTTP %i sem salvar referências incompletas', async (status) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('', { status }))
    await expect(store(fetcher).get(node.drive_id)).rejects.toThrow(status === 401 ? /expirou/ : status === 403 ? /permissão/ : /não encontrado/)
  })

  it('respeita proibição de download e recusa substituição por tipo diferente', async () => {
    const forbidden = client(bytes(), metadata({ capabilities: { canDownload: false } }))
    await expect(store(forbidden).file(node.drive_id)).rejects.toThrow(/proprietário bloqueou/)
    expect(forbidden).toHaveBeenCalledTimes(1)
    await expect(store(client(bytes(), metadata({ mimeType: 'text/html' }))).file(node.drive_id)).rejects.toThrow(/não é mais um PDF/)
  })

  it('limita tamanho por metadados e Content-Length, e verifica magic bytes', async () => {
    await expect(store(client(bytes(), metadata({ size: String(PDF_MAX_FILE_BYTES + 1) }))).file(node.drive_id)).rejects.toThrow(/100 MiB/)
    const length = vi.fn<typeof fetch>(async (input) => String(input).includes('alt=media') ? new Response(bytes(), { headers: { 'Content-Length': String(PDF_MAX_FILE_BYTES + 1) } }) : Response.json(metadata()))
    await expect(store(length).file(node.drive_id)).rejects.toThrow(/100 MiB/)
    await expect(store(client(new TextEncoder().encode('<html>login</html>'))).file(node.drive_id)).rejects.toThrow(/não é um PDF/)
  })

  it('cancela a abertura sem impedir nova carga na mesma instância', async () => {
    let first = true
    const normal = client()
    const fetcher = vi.fn<typeof fetch>((input, options) => {
      if (!first) return normal(input, options)
      first = false
      return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('cancelado', 'AbortError'))))
    })
    const value = store(fetcher)
    const pending = value.get(node.drive_id)
    value.cancel()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect((await value.get(node.drive_id))?.id).toBe(node.drive_id)
    expect(await value.get('outro')).toBeUndefined()
  })

  it('interrompe streaming acima do limite mesmo sem Content-Length', async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn<typeof fetch>(async (input) => String(input).includes('alt=media')
      ? new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue({ byteLength: PDF_MAX_FILE_BYTES + 1 } as Uint8Array) }, cancel }))
      : Response.json(metadata()))
    await expect(store(fetcher).file(node.drive_id)).rejects.toThrow(/100 MiB/)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('exporta cópia marcada dos bytes em memória sem alterar o original do Drive', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const original = await document.save()
    const fetcher = client(new Uint8Array(original))
    const value = store(fetcher)
    const data = await value.file(node.drive_id)
    const note = { ...mark, page: 1 }
    await value.update(node.drive_id, { annotations: [note] })
    const exported = await PDFDocument.load(await exportAnnotatedPdf(data!, [note]))
    const notes = exported.getPages()[0].node.Annots()!
    expect(exported.context.lookup(notes.get(0), PDFDict).lookup(PDFName.of('Contents'), PDFHexString).decodeText()).toBe(mark.text)
    expect(Array.from(new Uint8Array((await value.file(node.drive_id))!))).toEqual(Array.from(original))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('valida atualizações sem perder os dados anteriores', async () => {
    const value = store()
    await value.get(node.drive_id)
    await value.update(node.drive_id, { pageCount: 3, annotations: [mark], currentPage: 2 })
    await value.update(node.drive_id, { bookmarks: [3, 3, 1] })
    expect(await value.get(node.drive_id)).toMatchObject({ annotations: [mark], currentPage: 2, bookmarks: [1, 3] })
    await expect(value.update(node.drive_id, { annotations: [{ ...mark, page: 99 }] })).rejects.toThrow(/inválida/)
    expect((await value.get(node.drive_id))?.annotations).toEqual([mark])
  })

  it('rejeita snapshot de outra aba sem apagar as marcas já salvas', async () => {
    const scope = `drive-pdf-test-${++serial}`
    const first = store(client(), scope)
    const second = store(client(), scope)
    await first.get(node.drive_id)
    await second.get(node.drive_id)
    await first.update(node.drive_id, { pageCount: 3, annotations: [mark] })
    await expect(second.update(node.drive_id, { pageCount: 3, annotations: [] })).rejects.toThrow(/alterado em outra aba/)
    const reopened = store(client(), scope)
    expect((await reopened.get(node.drive_id))?.annotations).toEqual([mark])
  })
})

describe('autorização separada para conteúdo PDF', () => {
  const clientId = '123456789012-abcdefghijklmnop.apps.googleusercontent.com'
  it('mantém escopo metadata intacto, separa tokens e revoga ambos', async () => {
    const auth = await import('@/lib/googleAuth')
    const revoke = vi.fn()
    const scopes: string[] = []
    window.google = { accounts: { oauth2: {
      initTokenClient(config) { scopes.push(config.scope); return { requestAccessToken() { config.callback({ access_token: config.scope === auth.DRIVE_SCOPE ? 'metadata-token' : 'read-token', expires_in: 3600, scope: config.scope }) } } },
      hasGrantedAllScopes: (response, scope) => response.scope === scope,
      revoke,
    } } }
    await auth.requestDriveToken(clientId)
    expect(auth.currentDriveReadToken()).toBeNull()
    await auth.requestDriveReadToken(clientId)
    expect(scopes).toEqual([auth.DRIVE_SCOPE, auth.DRIVE_READ_SCOPE])
    expect(auth.currentDriveToken()).toBe('metadata-token')
    expect(auth.currentDriveReadToken()).toBe('read-token')
    auth.revokeDriveToken()
    expect(revoke.mock.calls.map(([token]) => token).sort()).toEqual(['metadata-token', 'read-token'])
    expect(auth.currentDriveReadToken()).toBeNull()
  })

  it('rejeita leitura não concedida e evita revogar token repetido', async () => {
    const auth = await import('@/lib/googleAuth')
    const revoke = vi.fn()
    let grant = false
    window.google = { accounts: { oauth2: {
      initTokenClient(config) { return { requestAccessToken() { config.callback({ access_token: 'same-token', expires_in: 3600, scope: config.scope }) } } },
      hasGrantedAllScopes: () => grant,
      revoke,
    } } }
    await expect(auth.requestDriveReadToken(clientId)).rejects.toThrow(/não foi concedida/)
    expect(auth.currentDriveReadToken()).toBeNull()
    grant = true
    await auth.requestDriveToken(clientId)
    await auth.requestDriveReadToken(clientId)
    auth.revokeDriveToken()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('same-token')
  })
})
