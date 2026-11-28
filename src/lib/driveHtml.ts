import { isDriveId, isResourceKey } from '@/lib/drive'
import type { CourseNode } from '@/types/db'

export type DriveHtmlReference = Pick<CourseNode, 'drive_id' | 'resource_key'>
const MAX_BYTES = 24 * 1024 * 1024

export class DriveHtmlAuthorizationError extends Error {}

export async function fetchDriveHtml(node: DriveHtmlReference, token: string, signal: AbortSignal): Promise<string> {
  if (!isDriveId(node.drive_id) || (node.resource_key != null && !isResourceKey(node.resource_key))) {
    throw new Error('A referência do HTML no Drive é inválida.')
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (node.resource_key) headers['X-Goog-Drive-Resource-Keys'] = `${node.drive_id}/${node.resource_key}`
  const url = `https://www.googleapis.com/drive/v3/files/${node.drive_id}?alt=media&supportsAllDrives=true`
  const response = await fetch(url, { headers, signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })
  if (response.status === 401) throw new DriveHtmlAuthorizationError('A autorização do Google expirou. Conecte novamente para abrir o HTML.')
  if (response.status === 403 || response.status === 404) throw new Error('O arquivo está indisponível para esta conta Google. Confira o acesso no Drive.')
  if (!response.ok) throw new Error(`O Drive não conseguiu abrir o HTML (${response.status}).`)
  if (!response.body) throw new Error('O Drive entregou um arquivo vazio.')
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) {
    await response.body.cancel()
    throw new Error('O HTML ultrapassa o limite de 24 MB do leitor.')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel()
        throw new Error('O HTML ultrapassa o limite de 24 MB do leitor.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (!size) throw new Error('O Drive entregou um arquivo vazio.')
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const utf8 = new TextDecoder()
  const sample = utf8.decode(bytes.subarray(0, 4096))
  const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(response.headers.get('Content-Type') ?? '')?.[1]
    ?? /<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i.exec(sample)?.[1]
  try {
    return (charset ? new TextDecoder(charset) : utf8).decode(bytes)
  } catch {
    return utf8.decode(bytes)
  }
}

/** Formata HTML em um fragmento inerte antes de transferir para a origem isolada do iframe. */
export function htmlReadingDocument(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content.querySelectorAll('script, iframe, frame, embed, object, base, meta, link, template, portal').forEach((element) => element.remove())
  for (const element of template.content.querySelectorAll('*')) {
    for (const attr of [...element.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc', 'ping', 'autofocus', 'action', 'formaction', 'target'].includes(attr.name)) element.removeAttribute(attr.name)
    }
    if (element.localName === 'a' || element.localName === 'area') {
      for (const name of ['href', 'xlink:href']) {
        if (!element.getAttribute(name)?.startsWith('#')) element.removeAttribute(name)
      }
    }
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:clamp(1rem,3vw,2.5rem);font:16px/1.55 system-ui,sans-serif;overflow-wrap:anywhere;color:#171717;background:#fff}img,video{max-width:100%;height:auto}pre{max-width:100%;overflow:auto}</style>
</head><body>${template.innerHTML}</body></html>`
}
