import { useCallback, useEffect, useRef, useState } from 'react'
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
  Undo2,
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
import { markVisited, navigationProgress, seedVisitedPages } from '@/lib/library'
import { cn } from '@/lib/cn'
import type { PdfAnnotation, PdfBook, PdfPoint, PdfReadingPatch, PdfShelfPatch } from '@/services/pdfLibrary'
import type { SessionSource } from '@/types/db'
import { PdfDocumentView, type PdfDocumentHandle, type PdfViewMode } from './PdfDocumentView'
import { searchKey, type PdfTool } from './PdfPageCanvas'
import { PdfNotesPanel } from './PdfNotesPanel'
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
  highlight: 'Selecione um trecho para destacar. No celular, selecione e toque em “Marcar seleção”.',
  ink: 'Desenhe sobre a página com mouse, caneta ou toque.',
  note: 'Toque em um ponto da página para prender uma nota ali.',
}

const MODE_KEY = 'vlm.leitor-pdf.modo'
const MAX_HITS = 500
/** Tempo que uma página precisa ficar aberta para contar como visitada e virar a posição salva. */
const DWELL_MS = 700
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3

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
  /** Liga o atalho "Iniciar/Continuar estudo" ao cronômetro do app, com este PDF como origem da sessão. */
  studySource?: (book: PdfBook) => SessionSource
}

function loadMode(): PdfViewMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'single' ? 'single' : 'continuous'
  } catch {
    return 'continuous'
  }
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
  const [mode, setMode] = useState<PdfViewMode>(loadMode)
  const [fit, setFit] = useState<Fit>('width')
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
  const [panel, setPanel] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 1024px)').matches))
  const [focus, setFocus] = useState(false)
  const [history, setHistory] = useState<PdfAnnotation[][]>([])
  const [note, setNote] = useState<{ page: number; point: PdfPoint } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{ submit: (password: string) => void; incorrect: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const cancelPassword = useRef<() => void>(() => {})
  const [exporting, setExporting] = useState(false)

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
    const load = async () => {
      const [stored, data] = await Promise.all([library.get(id), library.file(id)])
      if (cancelled) return
      if (!stored || !data) throw new Error('Este PDF não está na biblioteca deste navegador. Volte à biblioteca e adicione o arquivo.')
      bytes.current = data
      const task = getDocument({ data: new Uint8Array(data.slice(0)), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' })
      destroy = () => {
        void task.destroy()
      }
      cancelPassword.current = () => {
        destroy?.()
        setPasswordRequest(null)
        setError('A abertura do PDF foi cancelada. Tente novamente para informar a senha.')
      }
      task.onPassword = (submit: (password: string) => void, reason: number) => {
        if (!cancelled) setPasswordRequest({ submit, incorrect: reason === 2 })
      }
      const document = await task.promise
      if (cancelled) {
        void task.destroy()
        return
      }
      const currentPage = Math.min(stored.currentPage, document.numPages)
      // PDFs lidos antes do registro de páginas visitadas: parte do trecho já percorrido até a página salva.
      const visitedPages = stored.visitedPages ?? (stored.lastReadAt ? seedVisitedPages(currentPage, document.numPages) : [])
      const record: PdfBook = { ...stored, pageCount: document.numPages, currentPage, lastReadAt: new Date().toISOString(), visitedPages }
      await library.update(id, { pageCount: record.pageCount, currentPage, lastReadAt: record.lastReadAt, visitedPages })
      if (cancelled) return
      const first = (await document.getPage(1)).getViewport({ scale: 1 })
      if (cancelled) return
      latest.current = record
      setBook(record)
      setResumed(Boolean(stored.lastReadAt))
      setBaseRatio(first.height / first.width)
      setPageRatio(first.height / first.width)
      setPdf(document)
      showPage(currentPage)
      void qc.invalidateQueries({ queryKey: ['library', 'last-read'] })
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
      if (persistTimer.current) {
        clearTimeout(persistTimer.current)
        persistTimer.current = null
        const current = latest.current
        // Posição ainda não gravada ao sair. Só na estante local: no Drive, gravar depois de cancelar
        // a carga faria o PDF ser baixado de novo.
        if (current && !library.cancel) {
          const target = Math.min(pageRef.current, current.pageCount)
          const leaving: PdfReadingPatch = { currentPage: target, lastReadAt: new Date().toISOString(), visitedPages: markVisited(current.visitedPages, target, current.pageCount) }
          queue.current = queue.current
            .catch(() => {})
            .then(() => library.update(id, leaving))
            .catch(() => {})
        }
      }
      destroy?.()
      library.cancel?.()
      bytes.current = null
      latest.current = null
    }
  }, [id, library, qc, retry, showPage])

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
      const padding = host.clientWidth < 640 ? 16 : 48
      const next = { width: Math.min(1400, Math.max(220, host.clientWidth - padding)), height: Math.max(200, host.clientHeight - padding) }
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
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  const enterFocus = () => {
    setFocus(true)
    // Tela cheia de verdade onde o navegador oferece; no iPhone fica o modo que ocupa a janela toda.
    const root = document.documentElement
    if (document.fullscreenEnabled && typeof root.requestFullscreen === 'function') root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }

  useEffect(() => {
    // Saiu da tela cheia pelo navegador (Esc, gesto): o leitor volta ao tamanho normal junto.
    const onChange = () => {
      if (!document.fullscreenElement) setFocus(false)
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
    if (!bytes.current || !book) return
    setExporting(true)
    try {
      const { exportAnnotatedPdf } = await import('@/lib/pdfExport')
      const result = await exportAnnotatedPdf(bytes.current.slice(0), book.annotations)
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
        <Spinner label="Abrindo seu PDF…" />
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
  const pageZoom = Math.min(1, Math.max(0.2, areaSize.height / (areaSize.width * fitRatio)))
  const zoom = fit === 'width' ? 1 : fit === 'page' ? pageZoom : manualZoom
  const stepZoom = (delta: number) => {
    setFit(null)
    setManualZoom(clampZoom(zoom + delta))
  }
  const bookmarked = book.bookmarks.includes(page)
  const visitedCount = book.visitedPages?.length ?? 0
  const progress = navigationProgress(book.visitedPages, book.pageCount)
  const activeMatch = hits[activeHit] ?? null

  return (
    <div className="pdf-reader flex flex-col gap-3" data-focus={focus}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to={backTo} aria-label={backLabel} title={backLabel} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg text-ink transition-colors hover:bg-surface-2">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold tracking-widest text-muted uppercase">{sourceLabel}</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg" title={book.title}>
              {book.title}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} loading={exporting} onClick={() => void exportPdf()} aria-label="Exportar PDF com marcações" title="Exportar uma cópia do PDF com as marcações">
            <span className="max-sm:hidden">Exportar</span>
          </Button>
          {studySource && <StudyShortcut source={studySource(book)} resumed={resumed} />}
        </div>
      </div>

      <div className="pdf-reader-toolbar sticky top-[var(--app-top,0px)] z-20 rounded-xl border border-line bg-surface p-1.5" style={focus ? { top: 0 } : undefined}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-0.5" role="group" aria-label="Ferramentas de marcação">
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
            <IconButton
              label={bookmarked ? 'Remover marcador desta página' : 'Marcar esta página'}
              size="sm"
              aria-pressed={bookmarked}
              onClick={() => save({ bookmarks: bookmarked ? book.bookmarks.filter((p) => p !== page) : [...book.bookmarks, page] })}
            >
              <Bookmark className={cn('size-4', bookmarked && 'fill-accent text-accent')} aria-hidden />
            </IconButton>
          </div>

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
            <IconButton label="Ajustar à página" size="sm" aria-pressed={fit === 'page'} variant={fit === 'page' ? 'secondary' : 'ghost'} onClick={() => setFit('page')}>
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
            <IconButton label="Buscar no documento" size="sm" aria-pressed={searchOpen} variant={searchOpen ? 'secondary' : 'ghost'} onClick={() => setSearchOpen((v) => !v)}>
              <Search className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={panel ? 'Ocultar anotações' : 'Mostrar anotações'} size="sm" aria-pressed={panel} variant={panel ? 'secondary' : 'ghost'} onClick={() => setPanel((v) => !v)}>
              <NotebookPen className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={focus ? 'Sair da tela cheia' : 'Tela cheia'} size="sm" aria-pressed={focus} onClick={() => (focus ? exitFocus() : enterFocus())}>
              {focus ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
            </IconButton>
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
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-2">
          <div ref={area} className="pdf-reader-area h-[72dvh] min-h-[360px] overflow-auto p-2 [scrollbar-gutter:stable] sm:p-6" tabIndex={0} aria-label="Páginas do documento">
            <PdfDocumentView
              ref={view}
              document={pdf}
              pageCount={book.pageCount}
              page={page}
              mode={mode}
              area={area}
              zoom={zoom}
              availableWidth={areaSize.width}
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
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-surface px-3 py-2">
            <div className="flex items-center gap-1">
              <IconButton label="Página anterior" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </IconButton>
              <form
                className="flex items-center gap-2 text-xs text-muted"
                onSubmit={(e) => {
                  e.preventDefault()
                  go(Number(pageInput))
                }}
              >
                <label htmlFor="pdf-page-input">Página</label>
                <Input id="pdf-page-input" type="number" inputMode="numeric" min={1} max={book.pageCount} className="!h-8 !w-16 text-center" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={() => go(Number(pageInput))} />
                <span className="whitespace-nowrap">de {book.pageCount}</span>
              </form>
              <IconButton label="Próxima página" size="sm" disabled={page >= book.pageCount} onClick={() => go(page + 1)}>
                <ChevronRight className="size-4" aria-hidden />
              </IconButton>
            </div>
            <div
              className="flex min-w-40 flex-1 items-center justify-end gap-2 text-[11px] text-muted"
              title="Estimativa automática pelas páginas que você já abriu neste leitor. Não é uma confirmação de leitura completa."
            >
              <span className="whitespace-nowrap">
                Progresso de navegação: <span className="font-semibold text-ink tabular-nums">{progress}%</span>
                <span className="max-sm:hidden">
                  {' '}
                  · {visitedCount} de {book.pageCount} {book.pageCount === 1 ? 'página aberta' : 'páginas abertas'}
                </span>
              </span>
              <div role="progressbar" aria-label="Progresso de navegação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 w-24 overflow-hidden rounded-full bg-track max-sm:hidden">
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
