/** Regras puras da Biblioteca (leitor de livros EPUB). Sem acesso a banco nem a tela. */

export const READER_THEMES = ['claro', 'creme', 'sepia', 'cinza', 'escuro', 'noite'] as const
export type ReaderTheme = (typeof READER_THEMES)[number]

export const READER_FLOWS = ['paginado', 'rolagem'] as const
export type ReaderFlow = (typeof READER_FLOWS)[number]

export const READER_SPACINGS = ['original', 'compacto', 'confortavel', 'amplo'] as const
export type ReaderSpacing = (typeof READER_SPACINGS)[number]

export const READER_FONTS = ['original', 'serifa', 'sans'] as const
export type ReaderFont = (typeof READER_FONTS)[number]

export const READER_MARGINS = ['estreita', 'media', 'larga'] as const
export type ReaderMargin = (typeof READER_MARGINS)[number]

export const READER_THEME_LABELS: Record<ReaderTheme, string> = { claro: 'Claro', creme: 'Papel', sepia: 'Sépia', cinza: 'Cinza', escuro: 'Escuro', noite: 'Noite' }
export const READER_FLOW_LABELS: Record<ReaderFlow, string> = { paginado: 'Páginas', rolagem: 'Rolagem' }
export const READER_SPACING_LABELS: Record<ReaderSpacing, string> = { original: 'Do livro', compacto: 'Compacto', confortavel: 'Confortável', amplo: 'Amplo' }
export const READER_FONT_LABELS: Record<ReaderFont, string> = { original: 'Do livro', serifa: 'Serifa', sans: 'Sem serifa' }
export const READER_MARGIN_LABELS: Record<ReaderMargin, string> = { estreita: 'Estreitas', media: 'Médias', larga: 'Largas' }

/** Entrelinha aplicada ao texto em cada espaçamento (nulo: respeita o livro). */
export const READER_LINE_HEIGHT: Record<ReaderSpacing, number | null> = { original: null, compacto: 1.4, confortavel: 1.65, amplo: 1.9 }

/** Família de fonte em cada opção (nulo: respeita o livro). */
export const READER_FONT_STACK: Record<ReaderFont, string | null> = {
  original: null,
  serifa: "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Noto Serif', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}

/** Margem lateral extra, em px, somada à margem que o próprio leitor já reserva. */
export const READER_MARGIN_PX: Record<ReaderMargin, number> = { estreita: 2, media: 12, larga: 26 }

/**
 * Cores do papel e do texto em cada tema do leitor. Nenhum tema usa branco puro nem contraste máximo:
 * o papel levemente quente e o texto um pouco abaixo do preto/branco cansam menos em leituras longas.
 * "Noite" é preto real (telas OLED apagam o pixel) com texto fosco, para ler no escuro.
 */
export const READER_COLORS: Record<ReaderTheme, { bg: string; fg: string; muted: string; code: string; link: string; selection: string; dark: boolean }> = {
  claro: { bg: '#fbfaf7', fg: '#211d18', muted: '#6b6259', code: '#f0ece4', link: '#2a5db0', selection: '#cfe0ff', dark: false },
  creme: { bg: '#f7f1e3', fg: '#33291f', muted: '#75695a', code: '#ebe2cf', link: '#7a4a1c', selection: '#ecd9a8', dark: false },
  sepia: { bg: '#efe0c2', fg: '#46362a', muted: '#7a6650', code: '#e2d1ae', link: '#8a4b1f', selection: '#d9bf86', dark: false },
  cinza: { bg: '#2a2a2c', fg: '#d2cfc8', muted: '#9c9890', code: '#37373a', link: '#9bbbe0', selection: '#4a5a70', dark: true },
  escuro: { bg: '#17120e', fg: '#ddd3c3', muted: '#a79b8c', code: '#2a221b', link: '#8fb0cf', selection: '#4d4030', dark: true },
  noite: { bg: '#000000', fg: '#a39b8e', muted: '#756e63', code: '#141210', link: '#7f9bb5', selection: '#3a3126', dark: true },
}

export const FONT_MIN = 80
export const FONT_MAX = 220
export const FONT_STEP = 10

export const BRIGHTNESS_MIN = 20
export const BRIGHTNESS_MAX = 100
export const WARMTH_MAX = 100

export interface ReaderPrefs {
  /** Tamanho do texto em % do padrão do livro. */
  fontSize: number
  theme: ReaderTheme
  flow: ReaderFlow
  /** Brilho da página, de 20 a 100 (100: sem escurecer). */
  brightness: number
  /** Luz quente (filtro de luz azul), de 0 a 100. */
  warmth: number
  spacing: ReaderSpacing
  font: ReaderFont
  margin: ReaderMargin
  justify: boolean
  /** Entrar em tela cheia ao abrir o livro (onde o navegador permite). */
  fullscreen: boolean
}

export function clampFont(n: number): number {
  if (!Number.isFinite(n)) return 100
  const stepped = Math.round(n / FONT_STEP) * FONT_STEP
  return Math.min(FONT_MAX, Math.max(FONT_MIN, stepped))
}

export function clampBrightness(n: number): number {
  if (!Number.isFinite(n)) return BRIGHTNESS_MAX
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, Math.round(n)))
}

export function clampWarmth(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(WARMTH_MAX, Math.max(0, Math.round(n)))
}

/**
 * Opacidade das duas películas de iluminação sobre a página: uma preta (brilho) e uma âmbar
 * multiplicada (luz quente). No mínimo de brilho a página ainda fica legível.
 */
export function lightFilter(brightness: number, warmth: number): { dim: number; warm: number } {
  const b = clampBrightness(brightness)
  const w = clampWarmth(warmth)
  const dim = ((BRIGHTNESS_MAX - b) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 0.72
  return { dim: Math.round(dim * 1000) / 1000, warm: Math.round((w / WARMTH_MAX) * 0.55 * 1000) / 1000 }
}

export function defaultPrefs(darkApp: boolean): ReaderPrefs {
  return {
    fontSize: 110,
    theme: darkApp ? 'escuro' : 'sepia',
    flow: 'paginado',
    brightness: BRIGHTNESS_MAX,
    warmth: 0,
    spacing: 'original',
    font: 'original',
    margin: 'media',
    justify: false,
    fullscreen: true,
  }
}

/** Aceita qualquer coisa vinda do armazenamento e devolve preferências válidas. */
export function normalizePrefs(raw: unknown, darkApp: boolean): ReaderPrefs {
  const base = defaultPrefs(darkApp)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)
  return {
    fontSize: typeof r.fontSize === 'number' ? clampFont(r.fontSize) : base.fontSize,
    theme: pick(READER_THEMES, r.theme, base.theme),
    flow: pick(READER_FLOWS, r.flow, base.flow),
    brightness: typeof r.brightness === 'number' ? clampBrightness(r.brightness) : base.brightness,
    warmth: typeof r.warmth === 'number' ? clampWarmth(r.warmth) : base.warmth,
    spacing: pick(READER_SPACINGS, r.spacing, base.spacing),
    font: pick(READER_FONTS, r.font, base.font),
    margin: pick(READER_MARGINS, r.margin, base.margin),
    justify: typeof r.justify === 'boolean' ? r.justify : base.justify,
    fullscreen: typeof r.fullscreen === 'boolean' ? r.fullscreen : base.fullscreen,
  }
}

/** Zona tocada na página: as laterais viram a página, o meio mostra ou esconde os controles. */
export function tapZone(x: number, width: number): 'anterior' | 'meio' | 'proxima' {
  if (!(width > 0)) return 'meio'
  const r = x / width
  if (r < 0.3) return 'anterior'
  if (r > 0.7) return 'proxima'
  return 'meio'
}

export function isEpubFile(name: string, type = ''): boolean {
  return /\.epub$/i.test(name) || type === 'application/epub+zip'
}

/** Nome do arquivo sem a extensão, usado quando o livro não traz título nos metadados. */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.epub$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Progresso de leitura (0 a 100) a partir da posição atual: seção do livro (índice no miolo), página
 * dentro da seção e, quando conhecido, o tamanho de cada seção (para o sumário curto não pesar
 * como um capítulo inteiro). Estimativa barata, sem varrer o livro.
 */
export function readingProgress(sectionIndex: number, sectionCount: number, page: number, pageCount: number, atEnd = false, weights?: number[]): number {
  if (atEnd) return 100
  if (sectionCount <= 0 || sectionIndex < 0) return 0
  const within = pageCount > 0 ? Math.min(1, Math.max(0, (page - 1) / pageCount)) : 0
  const total = weights && weights.length === sectionCount ? weights.reduce((s, w) => s + Math.max(0, w), 0) : 0
  let pct: number
  if (weights && total > 0 && sectionIndex < weights.length) {
    const before = weights.slice(0, sectionIndex).reduce((s, w) => s + Math.max(0, w), 0)
    pct = ((before + within * Math.max(0, weights[sectionIndex])) / total) * 100
  } else {
    pct = ((sectionIndex + within) / sectionCount) * 100
  }
  return Math.min(99, Math.max(0, Math.round(pct)))
}

export interface ShelfBook {
  id: string
  title: string
  addedAt: string
  lastReadAt?: string
  progress: number
}

/** Estante: o que foi lido por último vem primeiro; depois os mais recentes adicionados. */
export function sortShelf<T extends ShelfBook>(books: T[]): T[] {
  return [...books].sort((a, b) => {
    const ra = a.lastReadAt ?? ''
    const rb = b.lastReadAt ?? ''
    if (ra !== rb) return ra < rb ? 1 : -1
    if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1
    return a.title.localeCompare(b.title, 'pt-BR')
  })
}

export function filterShelf<T extends { title: string; author: string }>(books: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('pt-BR')
  if (!q) return books
  return books.filter((b) => `${b.title} ${b.author}`.toLocaleLowerCase('pt-BR').includes(q))
}

/** Livro já começado e ainda não terminado (candidato a "Continuar lendo"). */
export function inProgress(b: ShelfBook): boolean {
  return Boolean(b.lastReadAt) && b.progress < 100
}

/** Matiz estável (0 a 359) a partir do título, para a capa gerada quando o livro não tem capa. */
export function coverHue(title: string): number {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360
  return h
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
