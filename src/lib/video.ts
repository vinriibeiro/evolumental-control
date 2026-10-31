// Leitura de links do YouTube para tocar dentro do aplicativo. Só reconhece endereços do próprio YouTube:
// qualquer outro link continua abrindo em outra aba, como antes.

export interface YoutubeRef {
  /** Vídeo (11 caracteres) — ausente quando o link é só de uma lista de reprodução. */
  videoId: string | null
  playlistId: string | null
  /** Segundo em que começa (0 = do início). */
  start: number
}

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'])
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/

/** "90", "90s", "1m30s", "1h2m3s" → segundos. */
export function parseStart(raw: string | null): number {
  if (!raw) return 0
  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 86_400)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(raw)
  if (!m || !(m[1] || m[2] || m[3])) return 0
  return Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86_400)
}

export function parseYoutube(raw: string | null | undefined): YoutubeRef | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if (!HOSTS.has(host)) return null

  const parts = url.pathname.split('/').filter(Boolean)
  let videoId: string | null = null
  if (host === 'youtu.be') videoId = parts[0] ?? null
  else if (parts[0] === 'watch') videoId = url.searchParams.get('v')
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) videoId = parts[1] ?? null

  const list = url.searchParams.get('list')
  const playlistId = list && LIST_ID.test(list) ? list : null
  if (videoId && !VIDEO_ID.test(videoId)) videoId = null
  if (!videoId && !(playlistId && (parts[0] === 'playlist' || parts[0] === 'embed' || parts[0] === 'watch'))) return null
  return { videoId, playlistId, start: parseStart(url.searchParams.get('t') ?? url.searchParams.get('start')) }
}

/** Endereço do player embutido (domínio sem cookies de rastreamento do YouTube). */
export function youtubeEmbedUrl(ref: YoutubeRef): string {
  const q = new URLSearchParams({ rel: '0' })
  if (ref.start > 0 && ref.videoId) q.set('start', String(ref.start))
  if (ref.playlistId) q.set('list', ref.playlistId)
  return `https://www.youtube-nocookie.com/embed/${ref.videoId ?? 'videoseries'}?${q}`
}
