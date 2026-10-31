/** Regras puras da Biblioteca (leitor de livros EPUB). Sem acesso a banco nem a tela. */

export const READER_THEMES = ['claro', 'sepia', 'escuro'] as const
export type ReaderTheme = (typeof READER_THEMES)[number]

export const READER_FLOWS = ['paginado', 'rolagem'] as const
export type ReaderFlow = (typeof READER_FLOWS)[number]

export const READER_THEME_LABELS: Record<ReaderTheme, string> = { claro: 'Claro', sepia: 'Sépia', escuro: 'Escuro' }
export const READER_FLOW_LABELS: Record<ReaderFlow, string> = { paginado: 'Páginas', rolagem: 'Rolagem' }

/** Cores do papel e do texto em cada tema do leitor. */
export const READER_COLORS: Record<ReaderTheme, { bg: string; fg: string; muted: string; code: string; link: string }> = {
  claro: { bg: '#ffffff', fg: '#26211c', muted: '#6b6259', code: '#f2eee7', link: '#2a5db0' },
  sepia: { bg: '#f4ecd8', fg: '#4a3a2a', muted: '#7a6650', code: '#e8dcc0', link: '#8a4b1f' },
  escuro: { bg: '#17120e', fg: '#e8dfd0', muted: '#b5a899', code: '#2a221b', link: '#8fb0cf' },
}

export const FONT_MIN = 80
export const FONT_MAX = 220
export const FONT_STEP = 10

export interface ReaderPrefs {
  /** Tamanho do texto em % do padrão do livro. */
  fontSize: number
  theme: ReaderTheme
  flow: ReaderFlow
}

export function clampFont(n: number): number {
  if (!Number.isFinite(n)) return 100
  const stepped = Math.round(n / FONT_STEP) * FONT_STEP
  return Math.min(FONT_MAX, Math.max(FONT_MIN, stepped))
}

export function defaultPrefs(darkApp: boolean): ReaderPrefs {
  return { fontSize: 110, theme: darkApp ? 'escuro' : 'sepia', flow: 'paginado' }
}

/** Aceita qualquer coisa vinda do armazenamento e devolve preferências válidas. */
export function normalizePrefs(raw: unknown, darkApp: boolean): ReaderPrefs {
  const base = defaultPrefs(darkApp)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  return {
    fontSize: typeof r.fontSize === 'number' ? clampFont(r.fontSize) : base.fontSize,
    theme: READER_THEMES.includes(r.theme as ReaderTheme) ? (r.theme as ReaderTheme) : base.theme,
    flow: READER_FLOWS.includes(r.flow as ReaderFlow) ? (r.flow as ReaderFlow) : base.flow,
  }
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
