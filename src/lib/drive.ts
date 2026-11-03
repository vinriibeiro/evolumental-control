// Referências a arquivos do Google Drive: validação de IDs e links, tipo de material e endereços de visualização.
// Os arquivos continuam no Drive; o app só guarda IDs e metadados e monta links para os domínios oficiais do Google.

/** IDs do Drive: letras, números, "-" e "_" (pastas, arquivos e drives compartilhados). */
const DRIVE_ID = /^[A-Za-z0-9_-]{10,128}$/
/** Chave de recurso de links antigos ("resourcekey"). */
const RESOURCE_KEY = /^[A-Za-z0-9_-]{1,128}$/
const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com'])

export const isDriveId = (v: unknown): v is string => typeof v === 'string' && DRIVE_ID.test(v)
export const isResourceKey = (v: unknown): v is string => typeof v === 'string' && RESOURCE_KEY.test(v)

export const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut'

/**
 * Extrai o ID de uma pasta do Drive a partir do link de compartilhamento (ou do próprio ID).
 * Só aceita endereços https de drive.google.com; qualquer outra coisa devolve null.
 */
export function parseDriveFolder(raw: string | null | undefined): string | null {
  const text = raw?.trim()
  if (!text) return null
  if (isDriveId(text)) return text
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'drive.google.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('folders')
  const id = i >= 0 ? parts[i + 1] : url.pathname === '/open' ? url.searchParams.get('id') : null
  return isDriveId(id) ? id : null
}

export type MaterialKind = 'video' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'image' | 'audio' | 'text' | 'other'

export interface MaterialType {
  kind: MaterialKind
  label: string
  /** Há visualizador incorporado do Google para este tipo? Sem ele, o item fica no catálogo com "Abrir no Drive". */
  embeddable: boolean
}

const GOOGLE_APPS: Record<string, MaterialType> = {
  'application/vnd.google-apps.document': { kind: 'document', label: 'Documento Google', embeddable: true },
  'application/vnd.google-apps.spreadsheet': { kind: 'spreadsheet', label: 'Planilha Google', embeddable: true },
  'application/vnd.google-apps.presentation': { kind: 'presentation', label: 'Apresentação Google', embeddable: true },
}

const OFFICE: Record<string, MaterialType> = {
  'application/msword': { kind: 'document', label: 'Documento Word', embeddable: true },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'document', label: 'Documento Word', embeddable: true },
  'application/vnd.ms-excel': { kind: 'spreadsheet', label: 'Planilha Excel', embeddable: true },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'spreadsheet', label: 'Planilha Excel', embeddable: true },
  'application/vnd.ms-powerpoint': { kind: 'presentation', label: 'Apresentação PowerPoint', embeddable: true },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'presentation', label: 'Apresentação PowerPoint', embeddable: true },
  'application/rtf': { kind: 'document', label: 'Documento RTF', embeddable: true },
  'text/plain': { kind: 'text', label: 'Texto', embeddable: true },
  'text/csv': { kind: 'spreadsheet', label: 'CSV', embeddable: true },
}

/** Tipo do material a partir do MIME real informado pelo Drive (nunca pela extensão do nome). */
export function materialType(mime: string | null | undefined): MaterialType {
  const m = (mime ?? '').toLowerCase()
  if (m === 'application/pdf') return { kind: 'pdf', label: 'PDF', embeddable: true }
  if (GOOGLE_APPS[m]) return GOOGLE_APPS[m]
  if (OFFICE[m]) return OFFICE[m]
  if (m.startsWith('video/')) return { kind: 'video', label: 'Vídeo', embeddable: true }
  if (m.startsWith('audio/')) return { kind: 'audio', label: 'Áudio', embeddable: true }
  if (m.startsWith('image/')) return { kind: 'image', label: 'Imagem', embeddable: true }
  if (m.startsWith('application/vnd.google-apps.')) return { kind: 'other', label: 'Arquivo Google', embeddable: false }
  return { kind: 'other', label: 'Arquivo', embeddable: false }
}

export const KIND_LABELS: Record<MaterialKind, string> = {
  video: 'Vídeos',
  pdf: 'PDFs',
  document: 'Documentos',
  spreadsheet: 'Planilhas',
  presentation: 'Apresentações',
  image: 'Imagens',
  audio: 'Áudios',
  text: 'Textos',
  other: 'Outros formatos',
}

const withKey = (base: string, resourceKey?: string | null) => (isResourceKey(resourceKey) ? `${base}?resourcekey=${encodeURIComponent(resourceKey)}` : base)

/**
 * Endereço do visualizador incorporado do Google para o arquivo, ou null quando o tipo não tem visualizador
 * ou o ID é inválido. Só gera endereços de drive.google.com e docs.google.com.
 */
export function driveEmbedUrl(id: string, mime: string | null | undefined, resourceKey?: string | null): string | null {
  if (!isDriveId(id)) return null
  const type = materialType(mime)
  if (!type.embeddable) return null
  const m = (mime ?? '').toLowerCase()
  if (m === 'application/vnd.google-apps.document') return withKey(`https://docs.google.com/document/d/${id}/preview`, resourceKey)
  if (m === 'application/vnd.google-apps.spreadsheet') return withKey(`https://docs.google.com/spreadsheets/d/${id}/preview`, resourceKey)
  if (m === 'application/vnd.google-apps.presentation') return withKey(`https://docs.google.com/presentation/d/${id}/preview`, resourceKey)
  return withKey(`https://drive.google.com/file/d/${id}/preview`, resourceKey)
}

/** Link para abrir o arquivo (ou a pasta) no próprio Google Drive, em outra aba. */
export function driveOpenUrl(id: string, mime?: string | null, resourceKey?: string | null): string | null {
  if (!isDriveId(id)) return null
  if (mime === FOLDER_MIME) return withKey(`https://drive.google.com/drive/folders/${id}`, resourceKey)
  return withKey(`https://drive.google.com/file/d/${id}/view`, resourceKey)
}

/** Confere se um endereço é de um domínio oficial do Drive (usado antes de pôr qualquer src em iframe). */
export function isTrustedDriveUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && DRIVE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
/** Ordem natural: "Aula 2" antes de "Aula 10". */
export const naturalCompare = (a: string, b: string) => collator.compare(a, b)

/** "1,2 GB", "350 KB"… */
export function formatBytes(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`
}

/** Duração informada pelo Drive para vídeos (videoMediaMetadata.durationMillis) → "1h 05min", "12 min". */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  const h = Math.floor(min / 60)
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}
