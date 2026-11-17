import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookMarked,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  List,
  Maximize,
  Minimize,
  Minus,
  Plus,
  SunDim,
  SunMedium,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import type { NavItem } from 'epubjs'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner, useToast } from '@/components/ui/feedback'
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  READER_COLORS,
  READER_FLOWS,
  READER_FLOW_LABELS,
  READER_FONTS,
  READER_FONT_LABELS,
  READER_FONT_STACK,
  READER_LINE_HEIGHT,
  READER_MARGINS,
  READER_MARGIN_LABELS,
  READER_MARGIN_PX,
  READER_SPACINGS,
  READER_SPACING_LABELS,
  READER_THEMES,
  READER_THEME_LABELS,
  WARMTH_MAX,
  clampFont,
  lightFilter,
  normalizePrefs,
  readingProgress,
  tapZone,
  type ReaderPrefs,
} from '@/lib/library'
import { cn } from '@/lib/cn'
import { useLibrary } from '@/hooks/useLibrary'
import { cloudErrorMessage, type Bookmark as BookmarkRecord, type BookRecord, type Library } from '@/services/library'

const PREFS_KEY = 'evolumental.leitor'
const HINT_KEY = 'evolumental.leitor.dica'
const STYLE_ID = 'evl-leitor'

function loadPrefs(): ReaderPrefs {
  const dark = document.documentElement.classList.contains('dark')
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null'), dark)
  } catch {
    return normalizePrefs(null, dark)
  }
}

type Panel = null | 'indice' | 'marcadores' | 'ajustes'

// Tipos mínimos do epubjs usados aqui (a biblioteca carrega sob demanda).
interface ContentsLike {
  document: Document
}
interface RenditionLike {
  display(target?: string): Promise<unknown>
  next(): Promise<unknown>
  prev(): Promise<unknown>
  flow(flow: string): void
  resize(width?: string | number, height?: string | number, cfi?: string): void
  getContents(): unknown
  destroy(): void
  on(type: string, fn: (...args: never[]) => void): unknown
  hooks: { content: { register(fn: (contents: ContentsLike) => void): void } }
  themes: { register(name: string, rules: Record<string, Record<string, string>>): void; select(name: string): void; fontSize(size: string): void }
}
interface RelocatedLocation {
  start: { cfi: string; index: number; href: string; displayed: { page: number; total: number } }
  end: { cfi: string }
  atEnd?: boolean
}
interface BookLike {
  destroy(): void
  spine: { get(target: string): { index: number } | null; length?: number; items?: unknown[] }
  loaded: { navigation: Promise<{ toc: NavItem[] }> }
}

function flattenToc(items: NavItem[], depth = 0): Array<NavItem & { depth: number }> {
  return items.flatMap((i) => [{ ...i, depth }, ...flattenToc(i.subitems ?? [], depth + 1)])
}

function themeRules(theme: ReaderPrefs['theme']) {
  const c = READER_COLORS[theme]
  const imp = (v: string) => `${v} !important`
  return {
    'html, body': { background: imp(c.bg), color: imp(c.fg) },
    'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption, em, strong, i, b, span, div': { color: imp(c.fg) },
    'a, a:link, a:visited': { color: imp(c.link) },
    'pre, code': { background: imp(c.code), color: imp(c.fg) },
  }
}

/** Ajustes de tipografia e conforto aplicados dentro das páginas do livro. */
function contentCss(prefs: ReaderPrefs): string {
  const c = READER_COLORS[prefs.theme]
  const lineHeight = READER_LINE_HEIGHT[prefs.spacing]
  const font = READER_FONT_STACK[prefs.font]
  const text = 'body, p, li, blockquote, dd, dt, td, th, div, span, a, em, strong, i, b'
  return [
    'html { -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important; }',
    'body { text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; overflow-wrap: break-word; }',
    `::selection { background: ${c.selection}; }`,
    'img, svg, video { max-width: 100% !important; }',
    'img { max-height: 94vh !important; object-fit: contain; }',
    c.dark ? `img { filter: brightness(${prefs.theme === 'noite' ? 0.7 : 0.85}); }` : '',
    lineHeight ? `${text} { line-height: ${lineHeight} !important; }` : '',
    font ? `${text} { font-family: ${font} !important; }` : '',
    lineHeight || font ? "pre, pre *, code, code * { font-family: ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace !important; line-height: 1.45 !important; }" : '',
    prefs.justify ? 'p, li, dd, blockquote { text-align: justify !important; -webkit-hyphens: auto !important; hyphens: auto !important; }' : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function applyContentCss(doc: Document | null | undefined, css: string) {
  if (!doc) return
  let el = doc.getElementById(STYLE_ID)
  if (!el) {
    el = doc.createElement('style')
    el.id = STYLE_ID
    ;(doc.head ?? doc.documentElement).appendChild(el)
  }
  if (el.textContent !== css) el.textContent = css
}

/** Tudo que muda a paginação: ao alterar, o leitor refaz as páginas e volta ao mesmo trecho. */
function layoutKey(p: ReaderPrefs): string {
  return [p.fontSize, p.spacing, p.font, p.margin, p.justify].join('|')
}

function clockNow(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) && typeof document.documentElement.requestFullscreen === 'function'
}

/** Ambientes prontos: papel, brilho e luz quente combinados para cada hora do dia. */
const AMBIENTS: Array<{ label: string; hint: string; set: Pick<ReaderPrefs, 'theme' | 'brightness' | 'warmth'> }> = [
  { label: 'Dia', hint: 'Papel claro, brilho total', set: { theme: 'creme', brightness: 100, warmth: 0 } },
  { label: 'Fim de tarde', hint: 'Sépia com luz quente', set: { theme: 'sepia', brightness: 88, warmth: 35 } },
  { label: 'Noite', hint: 'Fundo preto, brilho baixo e luz quente', set: { theme: 'noite', brightness: 72, warmth: 45 } },
]

export default function ReaderPage() {
  const { id = '' } = useParams()
  const library = useLibrary()
  const book = useQuery({ queryKey: ['library', 'book', library.dbName, id], queryFn: () => library.get(id), staleTime: Infinity, gcTime: 0 })

  if (book.isPending) return <Spinner label="Abrindo o livro…" className="p-10" />
  if (book.isError || !book.data) {
    return (
      <div className="p-6">
        <EmptyState
          title="Livro não encontrado"
          description="Ele pode ter sido removido da estante ou guardado em outro navegador."
          action={
            <Link to="/livros">
              <Button variant="primary">Voltar à estante</Button>
            </Link>
          }
        />
      </div>
    )
  }
  return <Reader key={book.data.id} record={book.data} library={library} />
}

function Reader({ record, library }: { record: BookRecord; library: Library }) {
  const navigate = useNavigate()
  const toast = useToast()
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<RenditionLike | null>(null)
  const cfiToolRef = useRef<{ compare(a: string, b: string): number } | null>(null)
  const tocFlatRef = useRef<Array<NavItem & { depth: number; index: number }>>([])
  const pageRef = useRef<{ start: string; end: string; progress: number; chapter: string }>({ start: '', end: '', progress: record.progress, chapter: '' })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedFlow = useRef<ReaderPrefs['flow'] | null>(null)
  const appliedLayout = useRef('')
  const appliedTheme = useRef<ReaderPrefs['theme'] | null>(null)
  const appliedFont = useRef(0)
  const startLocation = useRef(record.location)
  const fsBlocked = useRef(false)
  const fsLeaving = useRef(false)
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  const swiped = useRef(false)

  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs)
  const [panel, setPanel] = useState<Panel>(null)
  const [chrome, setChrome] = useState(true)
  const [toc, setToc] = useState<Array<NavItem & { depth: number }>>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>(record.bookmarks)
  const [view, setView] = useState({ progress: record.progress, chapter: '', start: '', end: '' })
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  const [clock, setClock] = useState(clockNow)
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY)
    } catch {
      return false
    }
  })
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const panelRef = useRef(panel)
  panelRef.current = panel

  const colors = READER_COLORS[prefs.theme]
  const light = lightFilter(prefs.brightness, prefs.warmth)
  const canFullscreen = useMemo(fullscreenSupported, [])
  const line = `${colors.fg}22`

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    const p = pageRef.current
    if (p.start) void library.saveProgress(record.id, p.start, p.progress)
  }, [library, record.id])

  const goNext = useCallback(() => void renditionRef.current?.next(), [])
  const goPrev = useCallback(() => void renditionRef.current?.prev(), [])

  const enterFullscreen = useCallback(() => {
    if (!fullscreenSupported() || document.fullscreenElement) return
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      // sem gesto do usuário ou bloqueado pelo navegador: a leitura segue na janela normal
    })
  }, [])

  const exitFullscreen = useCallback(() => {
    if (typeof document === 'undefined' || !document.fullscreenElement) return
    fsLeaving.current = true
    document.exitFullscreen().catch(() => {
      fsLeaving.current = false
    })
  }, [])

  /** Toque ou clique na página: laterais viram a página, o meio mostra ou esconde os controles. */
  const handleTap = useCallback(
    (x: number) => {
      if (panelRef.current) return
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setHint((h) => {
        if (h) {
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            // sem armazenamento: a dica volta na próxima abertura
          }
        }
        return false
      })
      const p = prefsRef.current
      if (p.fullscreen && !fsBlocked.current && window.matchMedia?.('(pointer: coarse)').matches) enterFullscreen()
      const zone = p.flow === 'paginado' ? tapZone(x, window.innerWidth) : 'meio'
      if (zone === 'anterior') {
        setChrome(false)
        goPrev()
      } else if (zone === 'proxima') {
        setChrome(false)
        goNext()
      } else {
        setChrome((c) => !c)
      }
    },
    [enterFullscreen, goNext, goPrev],
  )
  const tapRef = useRef(handleTap)
  tapRef.current = handleTap

  // Abre o livro e liga o leitor
  useEffect(() => {
    let cancelled = false
    let book: BookLike | null = null
    let rendition: RenditionLike | null = null
    ;(async () => {
      const data = await library.open(record.id)
      const mod = await import('epubjs')
      if (cancelled || !viewerRef.current) return
      cfiToolRef.current = new mod.EpubCFI() as unknown as { compare(a: string, b: string): number }
      book = mod.default(data.slice(0) as unknown as string) as unknown as BookLike
      const flow = prefsRef.current.flow === 'rolagem' ? 'scrolled-doc' : 'paginated'
      appliedFlow.current = prefsRef.current.flow
      appliedLayout.current = layoutKey(prefsRef.current)
      appliedTheme.current = prefsRef.current.theme
      appliedFont.current = prefsRef.current.fontSize
      rendition = (book as unknown as { renderTo(el: HTMLElement, o: object): RenditionLike }).renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow,
        spread: 'none',
        allowScriptedContent: false,
      })
      renditionRef.current = rendition
      for (const t of READER_THEMES) rendition.themes.register(t, themeRules(t))
      rendition.themes.select(prefsRef.current.theme)
      rendition.themes.fontSize(`${prefsRef.current.fontSize}%`)
      rendition.hooks.content.register((contents) => applyContentCss(contents?.document, contentCss(prefsRef.current)))

      const nav = await book.loaded.navigation
      if (cancelled) return
      const flat = flattenToc(nav.toc)
      tocFlatRef.current = flat.map((t) => ({ ...t, index: book?.spine.get(t.href.split('#')[0])?.index ?? -1 }))
      setToc(flat)

      rendition.on('relocated', ((loc: RelocatedLocation) => {
        const spineLen = book?.spine.length ?? book?.spine.items?.length ?? 0
        const progress = readingProgress(loc.start.index, spineLen, loc.start.displayed.page, loc.start.displayed.total, loc.atEnd, record.weights)
        const before = tocFlatRef.current.filter((t) => t.index >= 0 && t.index <= loc.start.index)
        const here = before.filter((t) => t.depth === 0).pop() ?? before.pop()
        const chapter = here?.label.trim() ?? ''
        pageRef.current = { start: loc.start.cfi, end: loc.end?.cfi ?? loc.start.cfi, progress, chapter }
        setView({ progress, chapter, start: loc.start.cfi, end: pageRef.current.end })
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(flushSave, 600)
      }) as never)
      rendition.on('keyup', ((e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') void rendition?.next()
        if (e.key === 'ArrowLeft') void rendition?.prev()
      }) as never)
      // Toques dentro da página do livro (o livro fica num quadro próprio; os eventos chegam por aqui).
      rendition.on('click', ((e: MouseEvent) => {
        if (swiped.current) return
        const target = e.target as Element | null
        if (target?.closest?.('a[href]')) return
        const selection = e.view?.getSelection?.()
        if (selection && !selection.isCollapsed) return
        const frame = e.view?.frameElement
        tapRef.current((frame ? frame.getBoundingClientRect().left : 0) + e.clientX)
      }) as never)
      rendition.on('touchstart', ((e: TouchEvent) => {
        const t = e.changedTouches[0]
        touch.current = t ? { x: t.screenX, y: t.screenY, t: Date.now() } : null
      }) as never)
      rendition.on('touchend', ((e: TouchEvent) => {
        const from = touch.current
        const t = e.changedTouches[0]
        touch.current = null
        if (!from || !t || prefsRef.current.flow !== 'paginado' || panelRef.current) return
        const dx = t.screenX - from.x
        const dy = t.screenY - from.y
        if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - from.t > 700) return
        const selection = e.view?.getSelection?.()
        if (selection && !selection.isCollapsed) return
        swiped.current = true
        setTimeout(() => (swiped.current = false), 350)
        setChrome(false)
        if (dx < 0) void rendition?.next()
        else void rendition?.prev()
      }) as never)

      await rendition.display(startLocation.current || undefined)
      if (!cancelled) setReady(true)
    })().catch((e) => {
      if (!cancelled) setError(cloudErrorMessage(e))
    })
    return () => {
      cancelled = true
      flushSave()
      renditionRef.current = null
      try {
        rendition?.destroy()
        book?.destroy()
      } catch {
        // o leitor já foi desmontado
      }
    }
  }, [library, record.id, record.weights, flushSave])

  // Aplica preferências (tema, tipografia, modo) e guarda para a próxima vez
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // armazenamento cheio ou bloqueado: as preferências valem só nesta sessão
    }
    const r = renditionRef.current
    if (!r || !ready) return
    if (appliedTheme.current !== prefs.theme) {
      appliedTheme.current = prefs.theme
      r.themes.select(prefs.theme)
    }
    if (appliedFont.current !== prefs.fontSize) {
      appliedFont.current = prefs.fontSize
      r.themes.fontSize(`${prefs.fontSize}%`)
    }
    const css = contentCss(prefs)
    const contents = r.getContents()
    if (Array.isArray(contents)) for (const c of contents as ContentsLike[]) applyContentCss(c?.document, css)

    const key = layoutKey(prefs)
    if (appliedFlow.current !== prefs.flow) {
      appliedFlow.current = prefs.flow
      appliedLayout.current = key
      r.flow(prefs.flow === 'rolagem' ? 'scrolled-doc' : 'paginated')
      void r.display(pageRef.current.start || undefined)
    } else if (appliedLayout.current !== key) {
      appliedLayout.current = key
      const cfi = pageRef.current.start
      if (layoutTimer.current) clearTimeout(layoutTimer.current)
      layoutTimer.current = setTimeout(() => {
        const current = renditionRef.current
        if (!current) return
        current.resize('100%', '100%')
        void current.display(cfi || undefined)
      }, 220)
    }
  }, [prefs, ready])

  useEffect(
    () => () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )

  // Depois de abrir, os controles somem sozinhos e a página ocupa a tela toda.
  useEffect(() => {
    if (!ready) return
    hideTimer.current = setTimeout(() => {
      if (!panelRef.current) setChrome(false)
    }, 3200)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [ready])

  // Tela cheia: tenta ao abrir (o toque que abriu o livro ainda vale como gesto) e acompanha as mudanças.
  useEffect(() => {
    if (!fullscreenSupported()) return
    const onChange = () => {
      const on = Boolean(document.fullscreenElement)
      setFullscreen(on)
      if (!on && !fsLeaving.current) fsBlocked.current = true // saiu pelo sistema: não insistir
      fsLeaving.current = false
    }
    document.addEventListener('fullscreenchange', onChange)
    if (prefsRef.current.fullscreen && window.matchMedia?.('(pointer: coarse)').matches) enterFullscreen()
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      // Só sai da tela cheia se o leitor foi mesmo fechado (o modo de desenvolvimento monta duas vezes).
      setTimeout(() => {
        if (!document.querySelector('[data-leitor]') && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      }, 0)
    }
  }, [enterFullscreen])

  // Enquanto o leitor está aberto: a página chega às bordas do aparelho e o fundo não rola.
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const before = { viewport: viewport?.content, themeColor: themeColor?.content, overflow: document.documentElement.style.overflow }
    if (viewport && !/viewport-fit/.test(viewport.content)) viewport.content = `${viewport.content}, viewport-fit=cover`
    document.documentElement.style.overflow = 'hidden'
    return () => {
      if (viewport && before.viewport !== undefined) viewport.content = before.viewport
      if (themeColor && before.themeColor !== undefined) themeColor.content = before.themeColor
      document.documentElement.style.overflow = before.overflow
    }
  }, [])

  // A barra do sistema acompanha a cor do papel.
  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeColor) themeColor.content = colors.bg
  }, [colors.bg])

  // A tela não apaga no meio da leitura (onde o navegador oferece esse recurso).
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
    if (!wakeLock) return
    let lock: { release(): Promise<void> } | null = null
    let closed = false
    const acquire = () => {
      if (closed || document.visibilityState !== 'visible') return
      wakeLock
        .request('screen')
        .then((l) => {
          if (closed) void l.release().catch(() => {})
          else lock = l
        })
        .catch(() => {
          // economia de bateria ou permissão negada: segue sem manter a tela acesa
        })
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setClock(clockNow()), 20_000)
    return () => clearInterval(timer)
  }, [])

  const leave = useCallback(() => {
    flushSave()
    exitFullscreen()
    navigate('/livros')
  }, [flushSave, exitFullscreen, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') {
        if (panel) setPanel(null)
        else leave()
      } else if (e.key === 'Tab') setChrome(true)
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext()
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPrev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel, leave, goNext, goPrev])

  const marksHere = useMemo(() => {
    const cmp = cfiToolRef.current
    if (!cmp || !view.start) return []
    return bookmarks.filter((b) => {
      try {
        return cmp.compare(b.cfi, view.start) >= 0 && cmp.compare(b.cfi, view.end) <= 0
      } catch {
        return b.cfi === view.start
      }
    })
  }, [bookmarks, view.start, view.end])

  const toggleMark = async () => {
    if (!view.start) return
    try {
      let next: BookmarkRecord[] = bookmarks
      if (marksHere.length) {
        for (const m of marksHere) next = await library.removeBookmark(record.id, m.cfi)
        toast.info('Marcador removido.')
      } else {
        next = await library.toggleBookmark(record.id, { cfi: view.start, label: `${view.chapter || 'Trecho do livro'} · ${view.progress}%` })
        toast.success('Marcador adicionado.')
      }
      setBookmarks(next)
    } catch (e) {
      toast.error(e)
    }
  }

  const setFullscreenPref = (on: boolean) => {
    fsBlocked.current = !on
    setPrefs((p) => ({ ...p, fullscreen: on }))
    if (on) enterFullscreen()
    else exitFullscreen()
  }

  const setFont = (delta: number) => setPrefs((p) => ({ ...p, fontSize: clampFont(p.fontSize + delta) }))
  const jumpTo = (target: string) => {
    setPanel(null)
    setChrome(false)
    void renditionRef.current?.display(target)
  }
  const openPanel = (next: Exclude<Panel, null>) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setPanel(panel === next ? null : next)
  }

  const barBtn =
    'inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current disabled:opacity-40'
  const bar = 'absolute inset-x-0 z-20 transition-transform duration-200 ease-out motion-reduce:transition-none'
  const sidePad = READER_MARGIN_PX[prefs.margin]
  const sheet = panel === 'ajustes'
  const panelTitle = panel === 'indice' ? 'Índice' : panel === 'marcadores' ? 'Marcadores' : 'Aparência e iluminação'

  return (
    <div
      data-leitor
      className="fixed inset-0 z-[55] overflow-hidden overscroll-none"
      style={{ background: colors.bg, color: colors.fg, colorScheme: colors.dark ? 'dark' : 'light' }}
      role="region"
      aria-label={`Leitor: ${record.title}`}
      onPointerDown={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current)
      }}
    >
      {/* Página: ocupa a tela inteira; as barras flutuam por cima e não mexem na paginação. */}
      <div
        className="absolute inset-0"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        onClick={(e) => handleTap(e.clientX)}
      >
        {error ? (
          <div className="mx-auto mt-24 max-w-md px-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Não foi possível abrir o livro</p>
            <p className="mt-2 text-sm" style={{ color: colors.muted }}>
              {error}
            </p>
            <Button className="mt-4" onClick={leave}>
              Voltar à estante
            </Button>
          </div>
        ) : (
          <>
            <div ref={viewerRef} className="mx-auto h-full w-full max-w-3xl" style={{ paddingLeft: sidePad, paddingRight: sidePad }} data-testid="leitor-viewer" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: colors.muted }}>
                <Spinner label={record.fileLocal ? 'Abrindo o livro…' : 'Baixando o livro da sua conta…'} />
              </div>
            )}
            {prefs.flow === 'paginado' && ready && (
              <>
                <ChevronLeft className="pointer-events-none absolute left-3 top-1/2 hidden size-6 -translate-y-1/2 opacity-25 lg:block" aria-hidden />
                <ChevronRight className="pointer-events-none absolute right-3 top-1/2 hidden size-6 -translate-y-1/2 opacity-25 lg:block" aria-hidden />
              </>
            )}
          </>
        )}
      </div>

      {/* Rodapé discreto, sempre visível: hora, capítulo e progresso. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-6 items-center gap-3 px-4 text-[11px] tabular-nums"
        style={{ color: colors.muted, marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden
      >
        <span>{clock}</span>
        <span className="min-w-0 flex-1 truncate text-center">{view.chapter || record.title}</span>
        <span>{view.progress}%</span>
      </div>

      {hint && ready && !panel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-6">
          <p className="rounded-full px-4 py-2 text-center text-xs font-medium shadow-lg" style={{ background: colors.fg, color: colors.bg }}>
            Toque nas laterais para virar a página e no meio para mostrar ou esconder os controles
          </p>
        </div>
      )}

      <header
        className={cn(bar, 'top-0 border-b shadow-sm', !chrome && '-translate-y-full shadow-none')}
        style={{ background: colors.bg, borderColor: line, paddingTop: 'env(safe-area-inset-top)' }}
        inert={!chrome}
      >
        <div className="flex h-14 items-center gap-0.5 px-2">
          <button type="button" className={barBtn} onClick={leave} aria-label="Voltar à estante" title="Voltar à estante (Esc)">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="mx-1 min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{record.title}</p>
            <p className="truncate text-xs" style={{ color: colors.muted }}>
              {view.chapter || record.author}
            </p>
          </div>
          <button type="button" className={barBtn} onClick={() => openPanel('indice')} aria-label="Índice" title="Índice">
            <List className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className={barBtn}
            onClick={() => void toggleMark()}
            aria-label={marksHere.length ? 'Remover marcador desta página' : 'Marcar esta página'}
            aria-pressed={marksHere.length > 0}
            title={marksHere.length ? 'Remover marcador' : 'Marcar página'}
            disabled={!ready}
          >
            {marksHere.length ? <BookmarkCheck className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
          </button>
          <button type="button" className={barBtn} onClick={() => openPanel('marcadores')} aria-label={`Marcadores (${bookmarks.length})`} title="Lista de marcadores">
            <span className="relative inline-flex">
              <BookMarked className="size-5" aria-hidden />
              {bookmarks.length > 0 && (
                <span className="absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 tabular-nums" style={{ background: colors.fg, color: colors.bg }}>
                  {bookmarks.length}
                </span>
              )}
            </span>
          </button>
          {canFullscreen && (
            <button type="button" className={barBtn} onClick={() => setFullscreenPref(!fullscreen)} aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} aria-pressed={fullscreen} title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
              {fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
            </button>
          )}
          <button type="button" className={barBtn} onClick={() => openPanel('ajustes')} aria-label="Aparência e iluminação" title="Aparência e iluminação">
            <Type className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      <footer
        className={cn(bar, 'bottom-0 border-t', !chrome && 'translate-y-full')}
        style={{ background: colors.bg, borderColor: line, paddingBottom: 'env(safe-area-inset-bottom)' }}
        inert={!chrome}
      >
        <div className="flex h-14 items-center gap-3 px-3">
          <button type="button" className={barBtn} onClick={goPrev} aria-label="Página anterior" disabled={!ready}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: line }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.progress} aria-label="Progresso do livro">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${view.progress}%`, background: colors.fg }} />
          </div>
          <span className="w-10 text-right text-xs tabular-nums" style={{ color: colors.muted }}>
            {view.progress}%
          </span>
          <button type="button" className={barBtn} onClick={goNext} aria-label="Próxima página" disabled={!ready}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </footer>

      {panel && (
        <>
          {/* Nos ajustes o fundo fica transparente: dá para ver o efeito na página enquanto mexe. */}
          <button type="button" className={cn('absolute inset-0 z-30 cursor-default', sheet ? 'bg-transparent' : 'bg-black/35')} aria-label="Fechar painel" onClick={() => setPanel(null)} />
          <aside
            className={cn(
              'absolute z-30 flex flex-col shadow-2xl',
              sheet
                ? 'inset-x-0 bottom-0 max-h-[60dvh] rounded-t-2xl border-t sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-96 sm:max-w-[88vw] sm:rounded-none sm:border-t-0 sm:border-l'
                : 'inset-y-0 right-0 w-80 max-w-[88vw] border-l',
            )}
            style={{ background: colors.bg, borderColor: line, paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: sheet ? undefined : 'env(safe-area-inset-top)' }}
            role="dialog"
            aria-label={panelTitle}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: line }}>
              <h2 className="text-sm font-semibold">{panelTitle}</h2>
              <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-current/10" onClick={() => setPanel(null)} aria-label="Fechar painel">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {panel === 'indice' &&
                (toc.length === 0 ? (
                  <p className="p-3 text-sm" style={{ color: colors.muted }}>
                    Este livro não tem índice.
                  </p>
                ) : (
                  <ul>
                    {toc.map((t, i) => {
                      const current = Boolean(view.chapter) && t.label.trim() === view.chapter
                      return (
                        <li key={`${t.href}-${i}`}>
                          <button
                            type="button"
                            onClick={() => jumpTo(t.href)}
                            aria-current={current ? 'location' : undefined}
                            className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-current/10"
                            style={{ paddingLeft: `${0.75 + t.depth * 1}rem`, fontWeight: current ? 700 : 400 }}
                          >
                            {t.label.trim()}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ))}
              {panel === 'marcadores' &&
                (bookmarks.length === 0 ? (
                  <p className="p-3 text-sm" style={{ color: colors.muted }}>
                    Nenhum marcador ainda. Use o ícone de marcador no topo para guardar a página em que você está.
                  </p>
                ) : (
                  <ul>
                    {bookmarks.map((b) => (
                      <li key={b.cfi} className="flex items-center gap-1">
                        <button type="button" onClick={() => jumpTo(b.cfi)} className="min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm hover:bg-current/10">
                          <span className="block truncate">{b.label}</span>
                          <span className="block text-xs" style={{ color: colors.muted }}>
                            {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-current/10"
                          aria-label={`Remover marcador ${b.label}`}
                          onClick={() => void library.removeBookmark(record.id, b.cfi).then(setBookmarks).catch((e) => toast.error(e))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
              {panel === 'ajustes' && (
                <div className="space-y-5 p-3">
                  <Setting label="Ambiente">
                    <div className="grid grid-cols-3 gap-2">
                      {AMBIENTS.map((a) => {
                        const on = prefs.theme === a.set.theme && prefs.brightness === a.set.brightness && prefs.warmth === a.set.warmth
                        return (
                          <button
                            key={a.label}
                            type="button"
                            aria-pressed={on}
                            title={a.hint}
                            onClick={() => setPrefs((p) => ({ ...p, ...a.set }))}
                            className="flex h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm"
                            style={{ borderColor: on ? colors.fg : `${colors.fg}33`, fontWeight: on ? 600 : 400 }}
                          >
                            <span className="size-4 shrink-0 rounded-full border" style={{ background: READER_COLORS[a.set.theme].bg, borderColor: `${colors.fg}55` }} aria-hidden />
                            {a.label}
                          </button>
                        )
                      })}
                    </div>
                  </Setting>
                  <Setting label={`Brilho · ${prefs.brightness}%`}>
                    <div className="flex items-center gap-3">
                      <SunDim className="size-4 shrink-0 opacity-70" aria-hidden />
                      <input
                        type="range"
                        min={BRIGHTNESS_MIN}
                        max={BRIGHTNESS_MAX}
                        step={1}
                        value={prefs.brightness}
                        onChange={(e) => setPrefs((p) => ({ ...p, brightness: Number(e.target.value) }))}
                        aria-label="Brilho da página"
                        className="h-9 min-w-0 flex-1"
                        style={{ accentColor: colors.fg }}
                      />
                      <SunMedium className="size-5 shrink-0 opacity-70" aria-hidden />
                    </div>
                  </Setting>
                  <Setting label={`Luz quente · ${prefs.warmth}%`}>
                    <div className="flex items-center gap-3">
                      <Flame className="size-4 shrink-0 opacity-40" aria-hidden />
                      <input
                        type="range"
                        min={0}
                        max={WARMTH_MAX}
                        step={1}
                        value={prefs.warmth}
                        onChange={(e) => setPrefs((p) => ({ ...p, warmth: Number(e.target.value) }))}
                        aria-label="Luz quente (reduz a luz azul)"
                        className="h-9 min-w-0 flex-1"
                        style={{ accentColor: '#d9822b' }}
                      />
                      <Flame className="size-5 shrink-0" style={{ color: '#d9822b' }} aria-hidden />
                    </div>
                    <p className="mt-1 text-xs" style={{ color: colors.muted }}>
                      Deixa a página amarelada e corta a luz azul, bom para ler à noite.
                    </p>
                  </Setting>
                  <Setting label="Fundo">
                    <div role="radiogroup" aria-label="Fundo" className="grid grid-cols-6 gap-2">
                      {READER_THEMES.map((t) => {
                        const on = t === prefs.theme
                        return (
                          <button key={t} type="button" role="radio" aria-checked={on} aria-label={READER_THEME_LABELS[t]} onClick={() => setPrefs((p) => ({ ...p, theme: t }))} className="flex flex-col items-center gap-1 text-[11px]">
                            <span
                              className="flex size-10 items-center justify-center rounded-full border-2 text-sm font-semibold"
                              style={{ background: READER_COLORS[t].bg, color: READER_COLORS[t].fg, borderColor: on ? colors.link : `${colors.fg}33`, boxShadow: on ? `0 0 0 2px ${colors.bg}, 0 0 0 4px ${colors.link}` : undefined }}
                              aria-hidden
                            >
                              Aa
                            </span>
                            <span style={{ fontWeight: on ? 700 : 400 }}>{READER_THEME_LABELS[t]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Setting>
                  <Setting label="Tamanho do texto">
                    <div className="flex items-center gap-2">
                      <button type="button" className={cn(barBtn, 'border')} style={{ borderColor: `${colors.fg}33` }} onClick={() => setFont(-FONT_STEP)} disabled={prefs.fontSize <= FONT_MIN} aria-label="Diminuir o texto">
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <span className="w-16 text-center text-sm tabular-nums" aria-live="polite">
                        {prefs.fontSize}%
                      </span>
                      <button type="button" className={cn(barBtn, 'border')} style={{ borderColor: `${colors.fg}33` }} onClick={() => setFont(FONT_STEP)} disabled={prefs.fontSize >= FONT_MAX} aria-label="Aumentar o texto">
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  </Setting>
                  <Setting label="Fonte">
                    <Choice name="Fonte" options={READER_FONTS.map((f) => ({ value: f, label: READER_FONT_LABELS[f] }))} value={prefs.font} onChange={(font) => setPrefs((p) => ({ ...p, font }))} colors={colors} />
                  </Setting>
                  <Setting label="Espaço entre linhas">
                    <Choice name="Espaço entre linhas" options={READER_SPACINGS.map((s) => ({ value: s, label: READER_SPACING_LABELS[s] }))} value={prefs.spacing} onChange={(spacing) => setPrefs((p) => ({ ...p, spacing }))} colors={colors} />
                  </Setting>
                  <Setting label="Margens">
                    <Choice name="Margens" options={READER_MARGINS.map((m) => ({ value: m, label: READER_MARGIN_LABELS[m] }))} value={prefs.margin} onChange={(margin) => setPrefs((p) => ({ ...p, margin }))} colors={colors} />
                  </Setting>
                  <Setting label="Modo de leitura">
                    <Choice name="Modo de leitura" options={READER_FLOWS.map((f) => ({ value: f, label: READER_FLOW_LABELS[f] }))} value={prefs.flow} onChange={(flow) => setPrefs((p) => ({ ...p, flow }))} colors={colors} />
                  </Setting>
                  <div className="space-y-1">
                    <Toggle label="Texto justificado" checked={prefs.justify} onChange={(justify) => setPrefs((p) => ({ ...p, justify }))} colors={colors} />
                    {canFullscreen && <Toggle label="Abrir os livros em tela cheia" checked={prefs.fullscreen} onChange={setFullscreenPref} colors={colors} />}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Iluminação: película escura (brilho) e película âmbar (luz quente) sobre tudo, sem bloquear toques. */}
      {light.warm > 0 && <div className="pointer-events-none absolute inset-0 z-50" style={{ background: '#ff8a1f', mixBlendMode: 'multiply', opacity: light.warm }} aria-hidden data-testid="leitor-luz-quente" />}
      {light.dim > 0 && <div className="pointer-events-none absolute inset-0 z-50" style={{ background: '#000', opacity: light.dim }} aria-hidden data-testid="leitor-brilho" />}
    </div>
  )
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      {children}
    </div>
  )
}

function Choice<T extends string>({
  name,
  options,
  value,
  onChange,
  colors,
}: {
  name: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  colors: { fg: string }
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm"
            style={{ borderColor: on ? colors.fg : `${colors.fg}33`, fontWeight: on ? 600 : 400 }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ label, checked, onChange, colors }: { label: string; checked: boolean; onChange: (v: boolean) => void; colors: { fg: string; bg: string } }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left text-sm">
      <span>{label}</span>
      <span className="relative h-6 w-11 shrink-0 rounded-full border transition-colors" style={{ background: checked ? colors.fg : 'transparent', borderColor: checked ? colors.fg : `${colors.fg}55` }} aria-hidden>
        <span className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[left]" style={{ left: checked ? '1.4rem' : '0.2rem', background: checked ? colors.bg : colors.fg }} />
      </span>
    </button>
  )
}
