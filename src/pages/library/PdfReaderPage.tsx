import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  File as FileIcon,
  Highlighter,
  Maximize,
  MessageSquare,
  Minimize,
  MousePointer2,
  MoveHorizontal,
  NotebookPen,
  PenLine,
  RectangleVertical,
  ScrollText,
  Search,
  Scan,
  Settings2,
  Undo2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { usePdfLibrary } from '@/hooks/usePdfLibrary'
import { downloadBlob } from '@/lib/download'
import { markVisited, navigationProgress, READER_COLORS, seedVisitedPages, tapZone } from '@/lib/library'
import { cn } from '@/lib/cn'
import type { PdfAnnotation, PdfBook, PdfLibrary, PdfPoint, PdfReadingPatch, PdfShelfPatch } from '@/services/pdfLibrary'
import type { SessionSource } from '@/types/db'
import { PdfDocumentView, type PdfDocumentHandle, type PdfViewMode } from './PdfDocumentView'
import { searchKey, type PdfTool } from './PdfPageCanvas'
import { PdfNotesPanel } from './PdfNotesPanel'
import { PdfReadingText } from './PdfReadingText'
import { renderPdfCover } from './pdfCover'
import { StudyShortcut } from './StudyShortcut'
import './pdf-reader.css'

GlobalWorkerOptions.workerSrc = workerUrl

// Cores de marca-texto. Ficam fora da paleta da interface de propósito: são conteúdo do usuário.
const COLORS = [
  { value: '#f2cc4d', label: 'Amarelo' },
  { value: '#f0a3a3', label: 'Vermelho' },
  { value: '#80baf0', label: 'Azul' },
  { value: '#c4c4c4', label: 'Cinza' },
]
const TOOLS = [
  { id: 'read', label: 'Ler e selecionar', icon: MousePointer2 },
  { id: 'highlight', label: 'Destacar texto', icon: Highlighter },
  { id: 'ink', label: 'Desenho livre', icon: PenLine },
  { id: 'note', label: 'Nota presa a um ponto da página', icon: MessageSquare },
] as const
const GUIDANCE: Record<PdfTool, string> = {
  read: '',
  highlight: 'Arraste sobre o trecho para destacar. Toque de novo no marca-texto para voltar a rolar.',
  ink: 'Desenhe sobre a página com mouse, caneta ou toque.',
  note: 'Toque em um ponto da página para prender uma nota ali.',
}

const MODE_KEY = 'vlm.leitor-pdf.modo'
const APPEARANCE_KEY = 'vlm.leitor-pdf.aparencia'
const FONT_SIZE_KEY = 'vlm.leitor-pdf.fonte'
const APPEARANCES = { claro: 'Claro', sepia: 'Sépia', noite: 'Noite' } as const
type Appearance = keyof typeof APPEARANCES
const MAX_HITS = 500
/** Tempo que uma página precisa ficar aberta para contar como visitada e virar a posição salva. */
const DWELL_MS = 700
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const FONT_MIN = 16
const FONT_MAX = 38

type SaveStatus = 'saved' | 'saving' | 'error'
type Fit = 'width' | 'page' | null
interface SearchHit {
  page: number
  /** Ordem do trecho dentro da página. */
  index: number
  excerpt: string
}

export interface PdfReaderStore {
  get(id: string): Promise<PdfBook | undefined>
  file(id: string): Promise<ArrayBuffer | undefined>
  openSource?(id: string): ReturnType<PdfLibrary['openSource']>
  update(id: string, patch: PdfReadingPatch): Promise<void>
  cancel?(): void
  /** Só a estante local guarda capa: o leitor aproveita o PDF aberto para gerá-la quando falta. */
  setShelfData?(id: string, patch: PdfShelfPatch): Promise<void>
}

interface PdfReaderProps {
  store: PdfReaderStore
  documentId: string
  backTo?: string
  backLabel?: string
  sourceLabel?: string
  storageNotice?: string
  startInFocus?: boolean
  documentActions?: ReactNode
  recovery?: ReactNode
  /** Liga o atalho "Iniciar/Continuar estudo" ao cronômetro do app, com este PDF como origem da sessão. */
  studySource?: (book: PdfBook) => SessionSource
}

function loadMode(fallback: PdfViewMode): PdfViewMode {
  try {
    const value = localStorage.getItem(MODE_KEY)
    if (value === 'single' || value === 'continuous') return value
  } catch { /* usa o modo padrão */ }
  return fallback
}

function loadAppearance(key: string, fallback: Appearance): Appearance {
  try {
    const value = localStorage.getItem(key)
    if (value === 'claro' || value === 'sepia' || value === 'noite') return value
  } catch { /* leitura continua com o tema padrão */ }
  return fallback
}

function loadFontSize(): number {
  try {
    const value = Number(localStorage.getItem(FONT_SIZE_KEY))
    if (Number.isInteger(value) && value >= FONT_MIN && value <= FONT_MAX) return value
  } catch { /* usa o tamanho padrão */ }
  return 22
}

const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10))

export default function PdfReaderPage() {
  const { id = '' } = useParams()
  const library = usePdfLibrary()
  return (
    <PdfReader
      key={`${library.dbName}:${id}`}
      store={library}
      documentId={id}
      storageNotice={library.cloud ? 'Alterações salvas neste aparelho são enviadas à sua conta quando há conexão e o PDF cabe na nuvem.' : undefined}
      studySource={(book) => ({ kind: 'pdf', id: book.id, label: book.title, href: `/livros/pdf/${book.id}` })}
    />
  )
}

export function PdfReader({
  store: library,
  documentId: id,
  backTo = '/biblioteca',
  backLabel = 'Voltar à biblioteca',
  sourceLabel = 'Biblioteca / Leitor de PDF',
  storageNotice = 'Arquivo e marcas ficam neste navegador. Exporte uma cópia para guardar ou compartilhar.',
  startInFocus = false,
  documentActions,
  recovery,
  studySource,
}: PdfReaderProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [retry, setRetry] = useState(0)
  const [book, setBook] = useState<PdfBook | null>(null)
  const latest = useRef<PdfBook | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const bytes = useRef<ArrayBuffer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const queue = useRef<Promise<void>>(Promise.resolve())
  const revision = useRef(0)
  const [resumed, setResumed] = useState(false)

  const [tool, setTool] = useState<PdfTool>('read')
  const [color, setColor] = useState(COLORS[0].value)
  const [mode, setMode] = useState<PdfViewMode>(() => loadMode(startInFocus ? 'single' : 'continuous'))
  const [fit, setFit] = useState<Fit>('width')
  const [cropMargins, setCropMargins] = useState(true)
  const [manualZoom, setManualZoom] = useState(1)
  const [areaSize, setAreaSize] = useState({ width: 700, height: 600 })
  const [baseRatio, setBaseRatio] = useState(Math.SQRT2)
  const [pageRatio, setPageRatio] = useState(Math.SQRT2)
  const area = useRef<HTMLDivElement>(null)
  const view = useRef<PdfDocumentHandle>(null)

  const [page, setPage] = useState(1)
  const pageRef = useRef(1)
  const [pageInput, setPageInput] = useState('1')
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // no celular o painel começa fechado, para a página ocupar a tela
  const [panel, setPanel] = useState(() => !startInFocus && Boolean(window.matchMedia?.('(min-width: 1024px)').matches))
  const [focus, setFocus] = useState(() => startInFocus || Boolean(window.matchMedia?.('(max-width: 767px)').matches))
  const [toolsOpen, setToolsOpen] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const appearanceKey = startInFocus ? `${APPEARANCE_KEY}.cursos` : APPEARANCE_KEY
  const [appearance, setAppearance] = useState(() => loadAppearance(appearanceKey, startInFocus ? 'sepia' : 'claro'))
  const [textMode, setTextMode] = useState(false)
  const [fontSize, setFontSize] = useState(loadFontSize)
  const touch = useRef<{ id: number; x: number; y: number; time: number } | null>(null)
  const [history, setHistory] = useState<PdfAnnotation[][]>([])
  const [note, setNote] = useState<{ page: number; point: PdfPoint } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{ submit: (password: string) => void; incorrect: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const cancelPassword = useRef<() => void>(() => {})
  const [exporting, setExporting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [activeHit, setActiveHit] = useState(-1)
  const [reveal, setReveal] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchProgress, setSearchProgress] = useState<number | null>(null)
  const searchVersion = useRef(0)

  const save = useCallback(
    (patch: PdfReadingPatch) => {
      const current = latest.current
      if (!current) return
      const next = { ...current, ...patch }
      latest.current = next
      setBook(next)
      setSaveStatus('saving')
      const version = ++revision.current
      const snapshot: PdfReadingPatch = { currentPage: next.currentPage, pageCount: next.pageCount, annotations: next.annotations, bookmarks: next.bookmarks, lastReadAt: next.lastReadAt, visitedPages: next.visitedPages }
      queue.current = queue.current
        .catch(() => {})
        .then(() => library.update(id, snapshot))
        .then(() => {
          if (version === revision.current) setSaveStatus('saved')
          void qc.invalidateQueries({ queryKey: ['library', 'last-read'] })
        })
        .catch((e: unknown) => {
          if (version === revision.current) setSaveStatus('error')
          toastRef.current.error(e)
        })
    },
    [id, library, qc],
  )

  /**
   * Salva a posição sozinho e registra a página como visitada. Ninguém precisa marcar página como
   * lida: basta ela ter ficado aberta por um instante (folhear rápido não conta).
   */
  const persistPage = useCallback(() => {
    persistTimer.current = null
    const current = latest.current
    if (!current) return
    const target = Math.min(pageRef.current, current.pageCount)
    const visitedPages = markVisited(current.visitedPages, target, current.pageCount)
    if (current.currentPage === target && visitedPages.length === current.visitedPages?.length) return
    save({ currentPage: target, lastReadAt: new Date().toISOString(), visitedPages })
  }, [save])

  const showPage = useCallback(
    (target: number) => {
      pageRef.current = target
      setPage(target)
      setPageInput(String(target))
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(persistPage, DWELL_MS)
    },
    [persistPage],
  )

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    const invalidateSearch = () => {
      searchVersion.current++
    }
    revision.current++
    setError(null)
    setBook(null)
    setPdf(null)
    setHistory([])
    setSaveStatus('saved')
    setHits([])
    setActiveHit(-1)
    setQuery('')
    setSearchTerm('')
    setSearchProgress(null)
    setSearched(false)
    setTool('read')
    setPasswordRequest(null)
    setPassword('')
    setDownloadProgress(null)
    const open = (source: { data: ArrayBuffer } | { url: string }) => {
      if ('data' in source) bytes.current = source.data
      const input = 'data' in source ? { data: new Uint8Array(source.data.slice(0)) } : { url: source.url }
      const task = getDocument({
        ...input,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/',
      })
      destroy = () => { void task.destroy() }
      cancelPassword.current = () => {
        cancelled = true
        destroy?.()
        setPasswordRequest(null)
        setError('A abertura do PDF foi cancelada. Tente novamente para informar a senha.')
      }
      task.onPassword = (submit: (password: string) => void, reason: number) => {
        if (!cancelled) setPasswordRequest({ submit, incorrect: reason === 2 })
      }
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (!cancelled && total > 0) setDownloadProgress(Math.min(100, Math.floor(loaded * 100 / total)))
      }
      return task
    }
    const load = async () => {
      const stored = await library.get(id)
      if (cancelled) return
      if (!stored) throw new Error('Este PDF não está disponível na sua biblioteca. Confira se terminou de sincronizar no aparelho de origem.')
      let source = await library.openSource?.(id).catch(() => undefined)
      if (cancelled) return
      const prepare = async (task: ReturnType<typeof getDocument>) => {
        const document = await task.promise
        const currentPage = Math.min(stored.currentPage, document.numPages)
        const viewport = (await document.getPage(currentPage)).getViewport({ scale: 1 })
        return { document, currentPage, viewport }
      }
      let opened: Awaited<ReturnType<typeof prepare>> | undefined
      if (source && 'url' in source) {
        const task = open(source)
        try {
          opened = await prepare(task)
        } catch {
          await task.destroy().catch(() => undefined)
          source = undefined
        }
      }
      if (cancelled) return
      if (!opened) {
        const data = source && 'data' in source ? source.data : await library.file(id)
        if (cancelled) return
        if (!data) throw new Error('Arquivo indisponível. Abra a Biblioteca no aparelho em que o PDF foi importado e confira se o envio terminou.')
        opened = await prepare(open({ data }))
      }
      if (cancelled) return
      const { document, currentPage, viewport } = opened
      // PDFs lidos antes do registro de páginas visitadas: parte do trecho já percorrido até a página salva.
      const visitedPages = stored.visitedPages ?? (stored.lastReadAt ? seedVisitedPages(currentPage, document.numPages) : [])
      const record: PdfBook = { ...stored, pageCount: document.numPages, currentPage, lastReadAt: new Date().toISOString(), visitedPages }
      latest.current = record
      setBook(record)
      setResumed(Boolean(stored.lastReadAt))
      setBaseRatio(viewport.height / viewport.width)
      setPageRatio(viewport.height / viewport.width)
      setPdf(document)
      showPage(currentPage)
      save({ pageCount: record.pageCount, currentPage, lastReadAt: record.lastReadAt, visitedPages })
      if (source && 'cache' in source) {
        const { cache } = source
        void document.getData().then((data) => !cancelled ? cache(data) : undefined).catch(() => undefined)
      }
      if (!stored.cover && library.setShelfData) {
        // a estante mostra a primeira página como capa: gera uma vez, aproveitando o PDF já aberto
        void renderPdfCover(document)
          .then((cover) => (cover && !cancelled ? library.setShelfData?.(id, { cover, coverType: 'image/jpeg' }) : undefined))
          .catch(() => undefined)
      }
    }
    void load().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível abrir o PDF.')
    })
    return () => {
      cancelled = true
      invalidateSearch()
      const current = latest.current
      if (persistTimer.current) {
        clearTimeout(persistTimer.current)
        persistTimer.current = null
        if (current) {
          const target = Math.min(pageRef.current, current.pageCount)
          const leaving: PdfReadingPatch = { currentPage: target, lastReadAt: new Date().toISOString(), visitedPages: markVisited(current.visitedPages, target, current.pageCount) }
          queue.current = queue.current
            .catch(() => {})
            .then(() => library.update(id, leaving))
            .catch(() => {})
        }
      }
      destroy?.()
      if (current) void queue.current.finally(() => library.cancel?.())
      else library.cancel?.()
      bytes.current = null
      latest.current = null
    }
  }, [id, library, retry, save, showPage])

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden' || !persistTimer.current) return
      clearTimeout(persistTimer.current)
      persistPage()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [persistPage])

  useEffect(() => {
    if (saveStatus === 'saved') return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveStatus])

  // Espaço disponível para a página: base do "ajustar à largura" e do "ajustar à página".
  useEffect(() => {
    const host = area.current
    if (!host) return
    const resize = () => {
      // Desconta só o espaço fora da página para aproveitar a largura sem criar rolagem lateral.
      const style = getComputedStyle(host)
      const sides = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      const ends = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      const width = Math.max(1, Math.floor(host.clientWidth - sides))
      const next = { width: focus ? width : Math.min(1400, width), height: Math.max(1, Math.floor(host.clientHeight - ends)) }
      setAreaSize((current) => (current.width === next.width && current.height === next.height ? current : next))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [pdf, panel, focus])

  // Proporção da página atual: no modo de uma página por vez, "ajustar à página" segue cada página.
  useEffect(() => {
    if (!pdf || mode !== 'single') return
    let cancelled = false
    void pdf
      .getPage(page)
      .then((current) => {
        const base = current.getViewport({ scale: 1 })
        if (!cancelled) setPageRatio(base.height / base.width)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, page, mode])

  const go = useCallback(
    (target: number) => {
      const current = latest.current
      if (!current || !Number.isInteger(target)) {
        setPageInput(String(pageRef.current))
        return
      }
      const next = Math.max(1, Math.min(current.pageCount, target))
      showPage(next)
      view.current?.scrollToPage(next)
    },
    [showPage],
  )

  const exitFocus = useCallback(() => {
    setFocus(false)
    setControlsHidden(false)
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  const requestScreen = () => {
    // Tela cheia de verdade onde o navegador oferece; no iPhone fica o modo que ocupa a janela toda.
    const root = document.documentElement
    if (!document.fullscreenElement && document.fullscreenEnabled && typeof root.requestFullscreen === 'function') {
      void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
  }

  const enterFocus = () => {
    setFocus(true)
    setToolsOpen(false)
    requestScreen()
  }

  const hideControls = () => {
    setToolsOpen(false)
    setPanel(false)
    setSearchOpen(false)
    setTool('read')
    setControlsHidden(true)
    requestScreen()
  }

  useEffect(() => {
    // Saiu da tela cheia pelo navegador (Esc, gesto): o leitor volta ao tamanho normal junto.
    const onChange = () => {
      if (!document.fullscreenElement) { setFocus(false); setControlsHidden(false) }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      // Só sai da tela cheia se o leitor foi mesmo fechado (o modo de desenvolvimento monta duas vezes).
      setTimeout(() => {
        if (!document.querySelector('.pdf-reader') && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      }, 0)
    }
  }, [])

  useEffect(() => {
    if (textMode) area.current?.scrollTo({ top: 0, left: 0 })
  }, [page, textMode])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitFocus()
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // com zoom, as setas rolam a página para os lados: só viram a página quando ela cabe na largura
      const host = area.current
      if (host && host.scrollWidth > host.clientWidth + 1) return
      if (event.key === 'ArrowRight') go(pageRef.current + 1)
      else if (event.key === 'ArrowLeft') go(pageRef.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitFocus, go])

  const annotate = useCallback(
    (annotation: PdfAnnotation) => {
      const current = latest.current
      if (!current) return
      setHistory((h) => [...h.slice(-39), current.annotations])
      save({ annotations: [...current.annotations, annotation] })
    },
    [save],
  )
  const changeAnnotations = (annotations: PdfAnnotation[]) => {
    if (!book) return
    setHistory((h) => [...h.slice(-39), book.annotations])
    save({ annotations })
  }
  const reportError = useCallback((message: string) => toastRef.current.error(message), [])
  const openNote = useCallback((notePage: number, point: PdfPoint) => {
    setNote({ page: notePage, point })
    setNoteText('')
  }, [])
  const matchRevealed = useCallback(() => setReveal(false), [])

  const changeMode = (next: PdfViewMode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // sem armazenamento: a escolha vale só nesta leitura
    }
  }

  const exportPdf = async () => {
    if (!pdf || !book) return
    setExporting(true)
    try {
      const { exportAnnotatedPdf } = await import('@/lib/pdfExport')
      const original = bytes.current?.slice(0) ?? new Uint8Array(await pdf.getData()).buffer
      const result = await exportAnnotatedPdf(original, book.annotations)
      downloadBlob(new Blob([new Uint8Array(result)], { type: 'application/pdf' }), `${book.title}-com-marcacoes.pdf`)
      toastRef.current.success('PDF com marcações exportado. O arquivo original foi preservado.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      toastRef.current.error(/encrypt/i.test(message) ? 'A leitura aceita senha, mas a exportação de marcações exige um PDF sem criptografia. Suas marcações continuam salvas neste navegador.' : e)
    } finally {
      setExporting(false)
    }
  }

  const selectHit = (index: number, list: SearchHit[] = hits) => {
    const hit = list[index]
    if (!hit) return
    setActiveHit(index)
    setReveal(true)
    go(hit.page)
  }
  const stepHit = (delta: number) => {
    if (hits.length) selectHit((activeHit + delta + hits.length) % hits.length)
  }
  const clearSearch = () => {
    searchVersion.current++
    setSearchTerm('')
    setQuery('')
    setHits([])
    setActiveHit(-1)
    setSearched(false)
    setSearchProgress(null)
  }

  /** Busca no texto do documento (camada de texto do pdf.js), trecho a trecho, na ordem das páginas. */
  const find = async () => {
    if (!pdf || !query.trim()) return
    const version = ++searchVersion.current
    const term = searchKey(query.trim())
    setSearchTerm(query.trim())
    setSearched(false)
    setHits([])
    setActiveHit(-1)
    setSearchProgress(0)
    const found: SearchHit[] = []
    try {
      for (let number = 1; number <= pdf.numPages && found.length < MAX_HITS; number++) {
        if (version !== searchVersion.current) return
        const content = await (await pdf.getPage(number)).getTextContent()
        if (version !== searchVersion.current) return
        // mesma unidade que o leitor pinta na página (um item de texto), para a contagem bater com o destaque
        const texts = content.items.map((item) => ('str' in item ? item.str : null)).filter((text): text is string => text !== null)
        let index = 0
        texts.forEach((text, position) => {
          if (!searchKey(text).includes(term)) return
          const excerpt = [texts[position - 1], text, texts[position + 1]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
          found.push({ page: number, index: index++, excerpt: excerpt.slice(0, 160) })
        })
        if (number % 5 === 0 || number === pdf.numPages) setSearchProgress(number)
      }
      if (version !== searchVersion.current) return
      setHits(found)
      setSearched(true)
      if (found.length) {
        const start = found.findIndex((hit) => hit.page >= pageRef.current)
        selectHit(start >= 0 ? start : 0, found)
      }
    } catch (e) {
      if (version === searchVersion.current) toastRef.current.error(e)
    } finally {
      if (version === searchVersion.current) setSearchProgress(null)
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to={backTo} className="text-sm text-ink underline underline-offset-4">
          {backLabel}
        </Link>
        <ErrorState error={error} onRetry={() => setRetry((v) => v + 1)} />
        {recovery}
      </div>
    )
  }
  if (!pdf || !book) {
    const submitPassword = () => {
      passwordRequest?.submit(password)
      setPasswordRequest(null)
      setPassword('')
    }
    return (
      <>
        <Spinner label={downloadProgress !== null && downloadProgress < 100 ? `Baixando PDF… ${downloadProgress}%` : 'Abrindo seu PDF…'} />
        <Link to={backTo} className="block text-center text-sm text-ink underline underline-offset-4">{backLabel}</Link>
        <Modal
          open={Boolean(passwordRequest)}
          onClose={() => cancelPassword.current()}
          title="PDF protegido por senha"
          footer={
            <Button variant="primary" onClick={submitPassword}>
              Abrir PDF
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted">{passwordRequest?.incorrect ? 'A senha não foi aceita. Tente novamente.' : 'Informe a senha deste arquivo. Ela não será armazenada.'}</p>
          <Input
            type="password"
            autoComplete="off"
            aria-label="Senha do PDF"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitPassword()
            }}
          />
        </Modal>
      </>
    )
  }

  // Zoom 1 = página na largura da área. "Ajustar à página" reduz até a página inteira caber na altura.
  const fitRatio = mode === 'single' ? pageRatio : baseRatio
  const pageZoom = Math.min(1, areaSize.height / (areaSize.width * fitRatio))
  const zoom = fit === 'width' ? 1 : fit === 'page' ? pageZoom : manualZoom
  const crop = cropMargins && fit !== 'page'
  const stepZoom = (delta: number) => {
    setFit(null)
    setManualZoom(clampZoom(zoom + delta))
  }
  const changeFontSize = (delta: number) => {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, fontSize + delta))
    setFontSize(next)
    try { localStorage.setItem(FONT_SIZE_KEY, String(next)) } catch { /* vale para a sessão atual */ }
  }
  const fitWholePage = () => {
    if (mode !== 'single') changeMode('single')
    setFit('page')
  }
  const bookmarked = book.bookmarks.includes(page)
  const visitedCount = book.visitedPages?.length ?? 0
  const progress = navigationProgress(book.visitedPages, book.pageCount)
  const activeMatch = hits[activeHit] ?? null
  const colors = READER_COLORS[appearance]
  const changeAppearance = (next: Appearance) => {
    setAppearance(next)
    try { localStorage.setItem(appearanceKey, next) } catch { /* vale para a sessão atual */ }
  }
  const changeTextMode = (active: boolean) => {
    setTextMode(active)
    setTool('read')
    if (active) setSearchOpen(false)
  }
  const startTap = (event: PointerEvent<HTMLDivElement>) => {
    touch.current = event.pointerType === 'touch' && event.isPrimary
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now() }
      : null
  }
  const finishTap = (event: PointerEvent<HTMLDivElement>) => {
    const start = touch.current
    touch.current = null
    if (!start || start.id !== event.pointerId || !focus || tool !== 'read' || panel || searchOpen) return
    if (Date.now() - start.time > 350 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return
    if ((event.target as HTMLElement).closest('button, a') || window.getSelection()?.toString()) return
    const host = event.currentTarget
    const zone = textMode || mode === 'single' ? tapZone(event.clientX - host.getBoundingClientRect().left, host.clientWidth) : 'meio'
    if (zone !== 'meio' && host.scrollWidth > host.clientWidth + 1) return
    if (zone === 'anterior') go(page - 1)
    else if (zone === 'proxima') go(page + 1)
    else {
      setToolsOpen(false)
      setControlsHidden((hidden) => !hidden)
    }
  }

  return (
    <div className="pdf-reader flex flex-col gap-3" data-focus={focus} data-text-mode={textMode} data-appearance={appearance} style={{ '--pdf-paper': colors.bg, '--pdf-ink': colors.fg, '--pdf-muted': colors.muted } as CSSProperties}>
      {controlsHidden && <IconButton label="Mostrar controles de leitura" className="pdf-reader-reveal" onClick={() => setControlsHidden(false)}><Settings2 className="size-5" aria-hidden /></IconButton>}
      <div hidden={controlsHidden} className="pdf-reader-header flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to={backTo} aria-label={backLabel} title={backLabel} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-bg text-ink transition-colors hover:bg-surface-2">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold tracking-widest text-muted uppercase">{sourceLabel}</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg" title={book.title}>
              {book.title}
            </h1>
          </div>
        </div>
        <div className="pdf-reader-header-actions flex flex-wrap items-center gap-1 sm:gap-2">
          <span role="status" className={cn('text-[11px]', saveStatus === 'error' ? 'text-danger' : 'text-muted max-sm:sr-only')}>
            {saveStatus === 'saved' ? (
              <>
                <Check className="mr-1 inline size-3" aria-hidden />
                Posição e marcas salvas
              </>
            ) : saveStatus === 'saving' ? (
              'Salvando…'
            ) : (
              'Não foi possível salvar'
            )}
          </span>
          {saveStatus === 'error' && (
            <Button size="sm" onClick={() => save({})}>
              Tentar salvar
            </Button>
          )}
          {studySource && <StudyShortcut source={studySource(book)} resumed={resumed} />}
          {focus && <IconButton label={tool === 'highlight' ? 'Desativar marca-texto' : 'Ativar marca-texto'} className="size-11" aria-pressed={tool === 'highlight'} variant={tool === 'highlight' ? 'dark' : 'ghost'} onClick={() => {
            if (textMode) setTextMode(false)
            setTool(tool === 'highlight' ? 'read' : 'highlight')
          }}><Highlighter className="size-5" aria-hidden /></IconButton>}
          {focus && <IconButton label="Ferramentas de leitura" className="size-11" aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}><Settings2 className="size-5" aria-hidden /></IconButton>}
          {focus && <IconButton label="Tela inteira sem barras" className="size-11" onClick={hideControls}><Scan className="size-5" aria-hidden /></IconButton>}
          {focus && <IconButton label="Sair da tela cheia" className="size-11" onClick={exitFocus}><Minimize className="size-5" aria-hidden /></IconButton>}
        </div>
      </div>

      {focus && !toolsOpen && tool === 'highlight' && <p role="status" className="pdf-reading-hint px-3 text-xs">{GUIDANCE.highlight}</p>}
      <div hidden={controlsHidden || (focus && !toolsOpen)} className="pdf-reader-toolbar sticky top-[var(--app-top,0px)] z-20 rounded-xl border border-line bg-surface p-1.5" style={focus ? { top: 0 } : undefined}>
        <div className="mb-1 flex flex-wrap items-center gap-1 border-b border-line pb-1">
          <Button size="sm" variant={textMode ? 'secondary' : 'ghost'} aria-pressed={textMode} onClick={() => changeTextMode(!textMode)}>{textMode ? 'Ver página original' : 'Texto ajustável'}</Button>
          {!textMode && fit !== 'page' && <Button size="sm" variant={crop ? 'secondary' : 'ghost'} aria-pressed={crop} onClick={() => setCropMargins((active) => !active)}>Recortar margens vazias</Button>}
          <select aria-label="Tema de leitura" className="h-8 rounded-lg border border-line bg-bg px-2 text-sm text-ink" value={appearance} onChange={(event) => changeAppearance(event.target.value as Appearance)}>
            {Object.entries(APPEARANCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {textMode && <>
            <IconButton size="sm" label="Diminuir fonte" disabled={fontSize <= FONT_MIN} onClick={() => changeFontSize(-2)}>A−</IconButton>
            <IconButton size="sm" label="Aumentar fonte" disabled={fontSize >= FONT_MAX} onClick={() => changeFontSize(2)}>A+</IconButton>
          </>}
          {documentActions}
          <Button size="sm" icon={<Download className="size-4" aria-hidden />} loading={exporting} onClick={() => void exportPdf()}>Exportar marcações</Button>
        </div>
        {textMode && <p className="px-1.5 py-1 text-xs text-muted">Use a página original para ver figuras, tabelas e marcações.</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className={cn('flex items-center gap-0.5', textMode && 'hidden')} role="group" aria-label="Ferramentas de marcação">
            {TOOLS.map((item) => (
              <IconButton key={item.id} label={item.label} size="sm" aria-pressed={tool === item.id} onClick={() => setTool(item.id)} variant={tool === item.id ? 'dark' : 'ghost'}>
                <item.icon className="size-4" aria-hidden />
              </IconButton>
            ))}
            <IconButton
              label="Desfazer última alteração"
              size="sm"
              disabled={!history.length}
              onClick={() => {
                const previous = history[history.length - 1]
                setHistory((h) => h.slice(0, -1))
                if (previous) save({ annotations: previous })
              }}
            >
              <Undo2 className="size-4" aria-hidden />
            </IconButton>
          </div>
          <IconButton
              label={bookmarked ? 'Remover marcador desta página' : 'Marcar esta página'}
              size="sm"
              aria-pressed={bookmarked}
              onClick={() => save({ bookmarks: bookmarked ? book.bookmarks.filter((p) => p !== page) : [...book.bookmarks, page] })}
            >
              <Bookmark className={cn('size-4', bookmarked && 'fill-accent text-accent')} aria-hidden />
            </IconButton>

          {tool !== 'read' && (
            <div className="flex items-center gap-1.5 border-l border-line pl-2" role="group" aria-label="Cor da marcação">
              {COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={color === option.value}
                  title={option.label}
                  onClick={() => setColor(option.value)}
                  className={cn('flex size-6 items-center justify-center rounded-full border-2', color === option.value ? 'border-ink' : 'border-transparent')}
                  style={{ background: option.value }}
                >
                  {color === option.value && <Check className="size-3 text-[#171717]" aria-hidden />}
                </button>
              ))}
              {tool === 'highlight' && (
                <Button size="sm" onPointerDown={(e) => e.preventDefault()} onClick={() => view.current?.highlightSelection()}>
                  Marcar seleção
                </Button>
              )}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-0.5">
            {!textMode && <>
            <IconButton label="Diminuir zoom" size="sm" disabled={zoom <= ZOOM_MIN} onClick={() => stepZoom(-0.2)}>
              <ZoomOut className="size-4" aria-hidden />
            </IconButton>
            <span className="w-11 text-center text-[11px] tabular-nums text-muted" aria-label={`Zoom: ${Math.round(zoom * 100)}% da largura`}>
              {Math.round(zoom * 100)}%
            </span>
            <IconButton label="Aumentar zoom" size="sm" disabled={zoom >= ZOOM_MAX} onClick={() => stepZoom(0.2)}>
              <ZoomIn className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="Ajustar à largura" size="sm" aria-pressed={fit === 'width'} variant={fit === 'width' ? 'secondary' : 'ghost'} onClick={() => setFit('width')}>
              <MoveHorizontal className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="Ajustar à página" size="sm" aria-pressed={fit === 'page' && mode === 'single'} variant={fit === 'page' && mode === 'single' ? 'secondary' : 'ghost'} onClick={fitWholePage}>
              <RectangleVertical className="size-4" aria-hidden />
            </IconButton>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <IconButton
              label={mode === 'continuous' ? 'Rolagem contínua ativa: mudar para uma página por vez' : 'Uma página por vez: mudar para rolagem contínua'}
              size="sm"
              onClick={() => changeMode(mode === 'continuous' ? 'single' : 'continuous')}
            >
              {mode === 'continuous' ? <ScrollText className="size-4" aria-hidden /> : <FileIcon className="size-4" aria-hidden />}
            </IconButton>
            </>}
            <IconButton label="Buscar no documento" size="sm" aria-pressed={searchOpen} variant={searchOpen ? 'secondary' : 'ghost'} onClick={() => { setTextMode(false); setSearchOpen((v) => !v) }}>
              <Search className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={panel ? 'Ocultar anotações' : 'Mostrar anotações'} size="sm" aria-pressed={panel} variant={panel ? 'secondary' : 'ghost'} onClick={() => setPanel((v) => !v)}>
              <NotebookPen className="size-4" aria-hidden />
            </IconButton>
            {!focus && <IconButton label="Tela cheia" size="sm" onClick={enterFocus}><Maximize className="size-4" aria-hidden /></IconButton>}
          </div>
        </div>

        {tool !== 'read' && <p className="mt-1.5 border-t border-line px-1.5 pt-1.5 text-[11px] text-muted">{GUIDANCE[tool]}</p>}

        {searchOpen && (
          <div className="mt-1.5 space-y-2 border-t border-line p-1.5">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                // Enter com a mesma busca já feita: vai para o próximo trecho
                if (hits.length && query.trim() === searchTerm) stepHit(1)
                else void find()
              }}
            >
              <Input className="!h-8 min-w-0 flex-1 basis-40" aria-label="Texto para buscar no documento" placeholder="Buscar no documento" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button size="sm" type="submit" disabled={!query.trim() || searchProgress !== null}>
                Buscar
              </Button>
              <span className="min-w-14 text-center text-[11px] tabular-nums text-muted" aria-live="polite">
                {hits.length ? `${activeHit + 1} de ${hits.length}${hits.length >= MAX_HITS ? '+' : ''}` : ''}
              </span>
              <IconButton label="Trecho anterior" size="sm" disabled={!hits.length} onClick={() => stepHit(-1)}>
                <ChevronUp className="size-4" aria-hidden />
              </IconButton>
              <IconButton label="Próximo trecho" size="sm" disabled={!hits.length} onClick={() => stepHit(1)}>
                <ChevronDown className="size-4" aria-hidden />
              </IconButton>
              <IconButton label="Limpar busca" size="sm" onClick={clearSearch}>
                <X className="size-4" aria-hidden />
              </IconButton>
            </form>
            {searchProgress !== null && (
              <p role="status" className="text-xs text-muted">
                Buscando… página {searchProgress} de {book.pageCount}
              </p>
            )}
            {searched && !hits.length && (
              <p role="status" className="text-xs text-muted">
                Nenhum trecho encontrado. PDFs digitalizados precisam de uma camada de texto.
              </p>
            )}
            {hits.length > 0 && (
              <ul className="max-h-32 divide-y divide-line overflow-auto rounded-lg border border-line">
                {hits.map((hit, index) => (
                  <li key={`${hit.page}:${hit.index}`}>
                    <button type="button" aria-current={index === activeHit || undefined} className={cn('w-full px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-2', index === activeHit && 'bg-surface-2')} onClick={() => selectHit(index)}>
                      <strong className="font-semibold text-ink">Página {hit.page}</strong> · {hit.excerpt}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className={cn('pdf-reader-body relative grid min-h-0 gap-3', panel && 'lg:grid-cols-[minmax(0,1fr)_300px]')}>
        <div className="pdf-reader-stage flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-2">
          <div ref={area} className="pdf-reader-area h-[72dvh] min-h-[360px] overflow-auto p-2 sm:p-6" tabIndex={0} aria-label="Páginas do documento"
            onPointerDown={startTap} onPointerUp={finishTap} onPointerCancel={() => { touch.current = null }}>
            {textMode ? <PdfReadingText key={page} document={pdf} page={page} fontSize={fontSize} onOriginal={() => changeTextMode(false)} /> : <PdfDocumentView
              key={crop ? 'cropped' : 'original'}
              ref={view}
              document={pdf}
              pageCount={book.pageCount}
              page={page}
              mode={mode}
              area={area}
              zoom={zoom}
              availableWidth={areaSize.width}
              cropMargins={crop}
              ratio={baseRatio}
              tool={tool}
              color={color}
              annotations={book.annotations}
              search={searchTerm}
              match={activeMatch}
              revealMatch={reveal}
              onMatchRevealed={matchRevealed}
              onVisiblePage={showPage}
              onAnnotate={annotate}
              onNote={openNote}
              onError={reportError}
            />}
          </div>
          <div hidden={controlsHidden} className="pdf-reader-footer flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line bg-surface px-1 sm:px-3">
            <div className="flex items-center">
              <IconButton label="Página anterior" className="size-11" disabled={page <= 1} onClick={() => go(page - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </IconButton>
              <form
                className="flex items-center gap-2 text-xs text-muted"
                onSubmit={(e) => {
                  e.preventDefault()
                  go(Number(pageInput))
                  e.currentTarget.querySelector('input')?.blur()
                }}
              >
                <label htmlFor="pdf-page-input" className="max-sm:sr-only">Página</label>
                <Input id="pdf-page-input" type="number" inputMode="numeric" min={1} max={book.pageCount} className="!h-8 !w-11 px-1 text-center sm:!w-16" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={() => (Number(pageInput) === page ? setPageInput(String(page)) : go(Number(pageInput)))} />
                <span className="whitespace-nowrap"><span className="max-sm:hidden">de </span><span className="sm:hidden" aria-hidden>/ </span>{book.pageCount}</span>
              </form>
              <IconButton label="Próxima página" className="size-11" disabled={page >= book.pageCount} onClick={() => go(page + 1)}>
                <ChevronRight className="size-4" aria-hidden />
              </IconButton>
            </div>
            {focus && !toolsOpen && (
              <div className="flex items-center" role="group" aria-label="Tamanho da leitura">
                <IconButton label={textMode ? 'Diminuir fonte' : 'Diminuir zoom'} className="size-11" disabled={textMode ? fontSize <= FONT_MIN : zoom <= ZOOM_MIN} onClick={() => textMode ? changeFontSize(-2) : stepZoom(-0.2)}>
                  <ZoomOut className="size-5" aria-hidden />
                </IconButton>
                <IconButton label={textMode ? 'Aumentar fonte' : 'Aumentar zoom'} className="size-11" disabled={textMode ? fontSize >= FONT_MAX : zoom >= ZOOM_MAX} onClick={() => textMode ? changeFontSize(2) : stepZoom(0.2)}>
                  <ZoomIn className="size-5" aria-hidden />
                </IconButton>
                <IconButton label={textMode ? 'Voltar para a página original' : 'Ler com letras maiores'} className="size-11" aria-pressed={textMode} variant={textMode ? 'secondary' : 'ghost'} onClick={() => changeTextMode(!textMode)}>
                  {textMode ? <FileIcon className="size-5" aria-hidden /> : <Type className="size-5" aria-hidden />}
                </IconButton>
              </div>
            )}
            <div
              className="flex basis-full items-center justify-end gap-2 px-2 pb-1.5 text-[11px] text-muted sm:basis-auto sm:flex-1 sm:px-0 sm:pb-0"
              title="Estimativa automática pelas páginas que você já abriu neste leitor. Não é uma confirmação de leitura completa."
            >
              <span className="whitespace-nowrap">
                <span className="max-sm:sr-only">Progresso de navegação: </span><span className="font-semibold text-ink tabular-nums">{progress}%</span>
                <span className="max-sm:hidden">
                  {' '}
                  · {visitedCount} de {book.pageCount} {book.pageCount === 1 ? 'página aberta' : 'páginas abertas'}
                </span>
              </span>
              <div role="progressbar" aria-label="Progresso de navegação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 w-24 max-w-full overflow-hidden rounded-full bg-track max-sm:flex-1">
                <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {panel && (
          <PdfNotesPanel
            book={book}
            page={page}
            storageNotice={storageNotice}
            onGo={go}
            onAdd={annotate}
            onChange={changeAnnotations}
            onClose={() => setPanel(false)}
            className="max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-10 max-lg:w-[min(22rem,92%)] max-lg:shadow-lg lg:max-h-[calc(72dvh+3.25rem)]"
          />
        )}
      </div>

      <Modal
        open={Boolean(note)}
        onClose={() => setNote(null)}
        title="Nova nota na página"
        description={note ? `Página ${note.page}` : undefined}
        footer={
          <>
            <Button onClick={() => setNote(null)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!noteText.trim()}
              onClick={() => {
                if (!note) return
                annotate({ id: crypto.randomUUID(), page: note.page, type: 'note', color, points: [note.point], text: noteText.trim(), createdAt: new Date().toISOString() })
                setNote(null)
                setNoteText('')
              }}
            >
              Salvar nota
            </Button>
          </>
        }
      >
        <Textarea aria-label="Texto da nota" rows={6} maxLength={10000} placeholder="O que você quer guardar deste trecho?" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
      </Modal>
    </div>
  )
}
