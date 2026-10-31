import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookMarked, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, List, Minus, Plus, Trash2, Type, X } from 'lucide-react'
import type { NavItem } from 'epubjs'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner, useToast } from '@/components/ui/feedback'
import {
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  READER_COLORS,
  READER_FLOWS,
  READER_FLOW_LABELS,
  READER_THEMES,
  READER_THEME_LABELS,
  clampFont,
  normalizePrefs,
  readingProgress,
  type ReaderPrefs,
} from '@/lib/library'
import { cn } from '@/lib/cn'
import { useLibrary } from '@/hooks/useLibrary'
import { cloudErrorMessage, type Bookmark as BookmarkRecord, type BookRecord, type Library } from '@/services/library'

const PREFS_KEY = 'evolumental.leitor'

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
interface RenditionLike {
  display(target?: string): Promise<unknown>
  next(): Promise<unknown>
  prev(): Promise<unknown>
  flow(flow: string): void
  destroy(): void
  on(type: string, fn: (...args: never[]) => void): unknown
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
    'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption, em, strong, i, b': { color: imp(c.fg) },
    'a, a:link, a:visited': { color: imp(c.link) },
    'pre, code': { background: imp(c.code), color: imp(c.fg) },
  }
}

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
            <Link to="/biblioteca">
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
  const appliedFlow = useRef<ReaderPrefs['flow'] | null>(null)
  const startLocation = useRef(record.location)

  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs)
  const [panel, setPanel] = useState<Panel>(null)
  const [toc, setToc] = useState<Array<NavItem & { depth: number }>>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>(record.bookmarks)
  const [view, setView] = useState({ progress: record.progress, chapter: '', start: '', end: '' })
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  const colors = READER_COLORS[prefs.theme]

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    const p = pageRef.current
    if (p.start) void library.saveProgress(record.id, p.start, p.progress)
  }, [library, record.id])

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

  // Aplica preferências (tema, tamanho, modo) e guarda para a próxima vez
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // armazenamento cheio ou bloqueado: as preferências valem só nesta sessão
    }
    const r = renditionRef.current
    if (!r || !ready) return
    r.themes.select(prefs.theme)
    r.themes.fontSize(`${prefs.fontSize}%`)
    if (appliedFlow.current !== prefs.flow) {
      appliedFlow.current = prefs.flow
      r.flow(prefs.flow === 'rolagem' ? 'scrolled-doc' : 'paginated')
      void r.display(pageRef.current.start || undefined)
    }
  }, [prefs, ready])

  const goNext = useCallback(() => void renditionRef.current?.next(), [])
  const goPrev = useCallback(() => void renditionRef.current?.prev(), [])
  const leave = useCallback(() => {
    flushSave()
    navigate('/biblioteca')
  }, [flushSave, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') {
        if (panel) setPanel(null)
        else leave()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext()
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

  const setFont = (delta: number) => setPrefs((p) => ({ ...p, fontSize: clampFont(p.fontSize + delta) }))
  const jumpTo = (target: string) => {
    setPanel(null)
    void renditionRef.current?.display(target)
  }

  const barBtn = 'inline-flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: colors.bg, color: colors.fg }} role="region" aria-label={`Leitor: ${record.title}`}>
      <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2" style={{ borderColor: `${colors.fg}22` }}>
        <button type="button" className={barBtn} onClick={leave} aria-label="Voltar à estante" title="Voltar à estante (Esc)">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="mx-1 min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{record.title}</p>
          <p className="truncate text-xs" style={{ color: colors.muted }}>
            {view.chapter || record.author}
          </p>
        </div>
        <button type="button" className={barBtn} onClick={() => setPanel(panel === 'indice' ? null : 'indice')} aria-label="Índice" title="Índice">
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
        <button type="button" className={barBtn} onClick={() => setPanel(panel === 'marcadores' ? null : 'marcadores')} aria-label={`Marcadores (${bookmarks.length})`} title="Lista de marcadores">
          <span className="relative inline-flex">
            <BookMarked className="size-5" aria-hidden />
            {bookmarks.length > 0 && (
              <span className="absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 tabular-nums" style={{ background: colors.fg, color: colors.bg }}>
                {bookmarks.length}
              </span>
            )}
          </span>
        </button>
        <button type="button" className={barBtn} onClick={() => setPanel(panel === 'ajustes' ? null : 'ajustes')} aria-label="Aparência do texto" title="Aparência do texto">
          <Type className="size-5" aria-hidden />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <div className="mx-auto mt-16 max-w-md px-6 text-center">
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
            <div ref={viewerRef} className={cn('mx-auto h-full w-full', prefs.flow === 'paginado' ? 'max-w-3xl px-10' : 'max-w-3xl px-4')} data-testid="leitor-viewer" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: colors.muted }}>
                <Spinner label={record.fileLocal ? 'Abrindo o livro…' : 'Baixando o livro da sua conta…'} />
              </div>
            )}
            {prefs.flow === 'paginado' && ready && (
              <>
                <button type="button" onClick={goPrev} aria-label="Página anterior" className="group absolute inset-y-0 left-0 flex w-10 items-center justify-center sm:w-14">
                  <ChevronLeft className="size-6 opacity-30 transition-opacity group-hover:opacity-90" aria-hidden />
                </button>
                <button type="button" onClick={goNext} aria-label="Próxima página" className="group absolute inset-y-0 right-0 flex w-10 items-center justify-center sm:w-14">
                  <ChevronRight className="size-6 opacity-30 transition-opacity group-hover:opacity-90" aria-hidden />
                </button>
              </>
            )}
          </>
        )}

        {panel && (
          <>
            <button type="button" className="absolute inset-0 cursor-default bg-black/30" aria-label="Fechar painel" onClick={() => setPanel(null)} />
            <aside
              className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] flex-col border-l shadow-xl"
              style={{ background: colors.bg, borderColor: `${colors.fg}22` }}
              role="dialog"
              aria-label={panel === 'indice' ? 'Índice' : panel === 'marcadores' ? 'Marcadores' : 'Aparência do texto'}
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: `${colors.fg}22` }}>
                <h2 className="text-sm font-semibold">{panel === 'indice' ? 'Índice' : panel === 'marcadores' ? 'Marcadores' : 'Aparência do texto'}</h2>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-black/10" onClick={() => setPanel(null)} aria-label="Fechar painel">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {panel === 'indice' &&
                  (toc.length === 0 ? (
                    <p className="p-3 text-sm" style={{ color: colors.muted }}>
                      Este livro não tem índice.
                    </p>
                  ) : (
                    <ul>
                      {toc.map((t, i) => (
                        <li key={`${t.href}-${i}`}>
                          <button
                            type="button"
                            onClick={() => jumpTo(t.href)}
                            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/10"
                            style={{ paddingLeft: `${0.75 + t.depth * 1}rem` }}
                          >
                            {t.label.trim()}
                          </button>
                        </li>
                      ))}
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
                          <button type="button" onClick={() => jumpTo(b.cfi)} className="min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm hover:bg-black/10">
                            <span className="block truncate">{b.label}</span>
                            <span className="block text-xs" style={{ color: colors.muted }}>
                              {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/10"
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
                    <Setting label="Fundo">
                      <Choice
                        options={READER_THEMES.map((t) => ({ value: t, label: READER_THEME_LABELS[t], swatch: READER_COLORS[t].bg }))}
                        value={prefs.theme}
                        onChange={(theme) => setPrefs((p) => ({ ...p, theme }))}
                        colors={colors}
                      />
                    </Setting>
                    <Setting label="Modo de leitura">
                      <Choice options={READER_FLOWS.map((f) => ({ value: f, label: READER_FLOW_LABELS[f] }))} value={prefs.flow} onChange={(flow) => setPrefs((p) => ({ ...p, flow }))} colors={colors} />
                    </Setting>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      <footer className="flex h-12 shrink-0 items-center gap-3 border-t px-3" style={{ borderColor: `${colors.fg}22` }}>
        <button type="button" className={barBtn} onClick={goPrev} aria-label="Página anterior" disabled={!ready}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: `${colors.fg}22` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.progress}
          aria-label="Progresso do livro"
        >
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${view.progress}%`, background: colors.fg }} />
        </div>
        <span className="w-10 text-right text-xs tabular-nums" style={{ color: colors.muted }}>
          {view.progress}%
        </span>
        <button type="button" className={barBtn} onClick={goNext} aria-label="Próxima página" disabled={!ready}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </footer>
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
  options,
  value,
  onChange,
  colors,
}: {
  options: Array<{ value: T; label: string; swatch?: string }>
  value: T
  onChange: (v: T) => void
  colors: { fg: string }
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
            style={{ borderColor: on ? colors.fg : `${colors.fg}33`, fontWeight: on ? 600 : 400 }}
          >
            {o.swatch && <span className="size-4 rounded-full border" style={{ background: o.swatch, borderColor: `${colors.fg}55` }} aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
