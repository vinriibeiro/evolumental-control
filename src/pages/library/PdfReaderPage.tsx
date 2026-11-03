import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bookmark, Check, ChevronLeft, ChevronRight, Download, Expand, FileText, Highlighter, List, MessageSquare, MousePointer2, PenLine, Search, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { usePdfLibrary } from '@/hooks/usePdfLibrary'
import { downloadBlob } from '@/lib/download'
import { cn } from '@/lib/cn'
import type { PdfAnnotation, PdfBook, PdfPoint } from '@/services/pdfLibrary'
import { PdfPageCanvas, type PdfCanvasHandle, type PdfTool } from './PdfPageCanvas'
import './pdf-reader.css'

GlobalWorkerOptions.workerSrc = workerUrl
const COLORS = [{ value: '#f2cc4d', label: 'Amarelo' }, { value: '#89c999', label: 'Verde' }, { value: '#80baf0', label: 'Azul' }, { value: '#ee9db5', label: 'Rosa' }]
type SaveStatus = 'saved' | 'saving' | 'error'
type SearchHit = { page: number; excerpt: string }
type ReadingPatch = Partial<Pick<PdfBook, 'currentPage' | 'pageCount' | 'annotations' | 'bookmarks' | 'lastReadAt'>>

export interface PdfReaderStore {
  get(id: string): Promise<PdfBook | undefined>
  file(id: string): Promise<ArrayBuffer | undefined>
  update(id: string, patch: ReadingPatch): Promise<void>
  cancel?(): void
}

interface PdfReaderProps {
  store: PdfReaderStore
  documentId: string
  backTo?: string
  backLabel?: string
  sourceLabel?: string
  storageNotice?: string
}

export default function PdfReaderPage() {
  const { id = '' } = useParams()
  const library = usePdfLibrary()
  return <PdfReader key={`${library.dbName}:${id}`} store={library} documentId={id} />
}

export function PdfReader({ store: library, documentId: id, backTo = '/biblioteca', backLabel = 'Voltar à biblioteca', sourceLabel = 'Biblioteca / Leitor PDF', storageNotice = 'Arquivo e marcas ficam neste navegador. Exporte uma cópia para guardar ou compartilhar.' }: PdfReaderProps) {
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
  const [tool, setTool] = useState<PdfTool>('read')
  const [color, setColor] = useState(COLORS[0].value)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(700)
  const area = useRef<HTMLDivElement>(null)
  const canvas = useRef<PdfCanvasHandle>(null)
  const [panel, setPanel] = useState(true)
  const [focus, setFocus] = useState(false)
  const [pageInput, setPageInput] = useState('1')
  const [history, setHistory] = useState<PdfAnnotation[][]>([])
  const [note, setNote] = useState<{ point: PdfPoint; annotation?: PdfAnnotation } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{ submit: (password: string) => void; incorrect: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const cancelPassword = useRef<() => void>(() => {})
  const [exporting, setExporting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searched, setSearched] = useState(false)
  const [searchProgress, setSearchProgress] = useState<number | null>(null)
  const searchVersion = useRef(0)

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    const invalidateSearch = () => { searchVersion.current++ }
    revision.current++
    setError(null)
    setBook(null)
    setPdf(null)
    setHistory([])
    setSaveStatus('saved')
    setHits([])
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
      destroy = () => { void task.destroy() }
      cancelPassword.current = () => { destroy?.(); setPasswordRequest(null); setError('A abertura do PDF foi cancelada. Tente novamente para informar a senha.') }
      task.onPassword = (submit: (password: string) => void, reason: number) => { if (!cancelled) setPasswordRequest({ submit, incorrect: reason === 2 }) }
      const document = await task.promise
      if (cancelled) { void task.destroy(); return }
      const record = { ...stored, pageCount: document.numPages, currentPage: Math.min(stored.currentPage, document.numPages), lastReadAt: new Date().toISOString() }
      await library.update(id, { pageCount: record.pageCount, currentPage: record.currentPage, lastReadAt: record.lastReadAt })
      if (cancelled) return
      latest.current = record
      setBook(record)
      setPageInput(String(record.currentPage))
      setPdf(document)
      void qc.invalidateQueries({ queryKey: ['pdf-library'] })
    }
    void load().catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível abrir o PDF.') })
    return () => { cancelled = true; invalidateSearch(); destroy?.(); library.cancel?.(); bytes.current = null; latest.current = null }
  }, [id, library, qc, retry])

  const save = useCallback((patch: ReadingPatch) => {
    const current = latest.current
    if (!current) return
    const next = { ...current, ...patch }
    latest.current = next
    setBook(next)
    setSaveStatus('saving')
    const version = ++revision.current
    const snapshot = { currentPage: next.currentPage, pageCount: next.pageCount, annotations: next.annotations, bookmarks: next.bookmarks, lastReadAt: next.lastReadAt }
    queue.current = queue.current.catch(() => {}).then(() => library.update(id, snapshot)).then(() => {
      if (version === revision.current) setSaveStatus('saved')
      void qc.invalidateQueries({ queryKey: ['pdf-library'] })
    }).catch((e: unknown) => {
      if (version === revision.current) setSaveStatus('error')
      toastRef.current.error(e)
    })
  }, [id, library, qc])

  useEffect(() => {
    if (saveStatus === 'saved') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveStatus])

  useEffect(() => {
    const host = area.current
    if (!host) return
    const resize = () => setWidth(Math.min(1000, Math.max(220, host.clientWidth - 48)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [pdf, panel, focus])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocus(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])

  const go = (page: number) => {
    if (!book || !Number.isInteger(page)) { setPageInput(String(book?.currentPage ?? 1)); return }
    const next = Math.max(1, Math.min(book.pageCount, page))
    setPageInput(String(next))
    save({ currentPage: next, lastReadAt: new Date().toISOString() })
    area.current?.scrollTo({ top: 0, left: 0 })
  }
  const annotate = useCallback((annotation: PdfAnnotation) => {
    const current = latest.current
    if (!current) return
    setHistory((h) => [...h.slice(-39), current.annotations])
    save({ annotations: [...current.annotations, annotation] })
  }, [save])
  const changeAnnotations = (annotations: PdfAnnotation[]) => {
    if (!book) return
    setHistory((h) => [...h.slice(-39), book.annotations])
    save({ annotations })
  }
  const newNote = async () => {
    if (!pdf || !book) return
    try {
      const page = await pdf.getPage(book.currentPage)
      setNote({ point: { x: page.view[0] + 24, y: page.view[3] - 36 } })
      setNoteText('')
    } catch (e) { toastRef.current.error(e) }
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
    }
    finally { setExporting(false) }
  }
  const find = async () => {
    if (!pdf || !query.trim()) return
    const version = ++searchVersion.current
    const term = query.trim().toLocaleLowerCase('pt-BR')
    setSearchTerm(query.trim())
    setSearched(false)
    setHits([])
    setSearchProgress(0)
    const found: SearchHit[] = []
    try {
      for (let page = 1; page <= pdf.numPages && found.length < 100; page++) {
        if (version !== searchVersion.current) return
        const content = await (await pdf.getPage(page)).getTextContent()
        if (version !== searchVersion.current) return
        const line = content.items.map((item) => 'str' in item ? item.str : '').join(' ')
        const index = line.toLocaleLowerCase('pt-BR').indexOf(term)
        if (index >= 0) found.push({ page, excerpt: `${index > 40 ? '…' : ''}${line.slice(Math.max(0, index - 40), index + term.length + 100)}…` })
        setSearchProgress(page)
      }
      if (version !== searchVersion.current) return
      setHits(found)
      setSearched(true)
    } catch (e) { if (version === searchVersion.current) toastRef.current.error(e) }
    finally { if (version === searchVersion.current) setSearchProgress(null) }
  }

  if (error) return <div className="space-y-4"><Link to={backTo} className="text-sm text-accent-strong underline">{backLabel}</Link><ErrorState error={error} onRetry={() => setRetry((v) => v + 1)} /></div>
  if (!pdf || !book) return <><Spinner label="Abrindo seu PDF…" /><Modal open={Boolean(passwordRequest)} onClose={() => cancelPassword.current()} title="PDF protegido por senha" footer={<Button variant="primary" onClick={() => { passwordRequest?.submit(password); setPasswordRequest(null); setPassword('') }}>Abrir PDF</Button>}><p className="mb-3 text-sm text-muted">{passwordRequest?.incorrect ? 'A senha não foi aceita. Tente novamente.' : 'Informe a senha deste arquivo. Ela não será armazenada.'}</p><Input type="password" autoComplete="off" aria-label="Senha do PDF" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { passwordRequest?.submit(password); setPasswordRequest(null); setPassword('') } }} /></Modal></>

  const guidance: Record<PdfTool, string> = { read: 'Selecione e copie texto livremente. Use as setas para navegar.', highlight: 'Selecione um trecho para destacar. No celular, selecione e toque em “Marcar seleção”.', ink: 'Desenhe sobre a página com mouse, caneta ou toque.', note: 'Toque em um ponto da página para escrever sua nota. Ou use “Nova nota” no painel.' }
  const pageNotes = book.annotations.filter((a) => a.page === book.currentPage)
  return <div className="pdf-reader space-y-4" data-focus={focus}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><Link to={backTo} aria-label={backLabel} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface"><ChevronLeft className="size-4" /></Link><div className="min-w-0"><p className="text-[10px] font-semibold tracking-widest text-muted uppercase">{sourceLabel}</p><h1 className="max-w-[70vw] truncate text-lg font-semibold tracking-tight text-ink sm:max-w-lg" title={book.title}>{book.title}</h1></div></div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className={cn('text-[11px]', saveStatus === 'error' ? 'text-danger' : 'text-muted')}>{saveStatus === 'saved' ? <><Check className="mr-1 inline size-3" />Salvo neste navegador</> : saveStatus === 'saving' ? 'Salvando…' : 'Não foi possível salvar'}</span>
        {saveStatus === 'error' && <Button size="sm" onClick={() => save({})}>Tentar salvar</Button>}
        <Button size="sm" variant="primary" icon={<Download className="size-3.5" />} loading={exporting} onClick={() => void exportPdf()}>Exportar PDF</Button>
      </div>
    </div>

    <div className="pdf-reader-toolbar sticky top-[var(--app-top,0px)] z-20 rounded-2xl border border-line bg-surface p-2 shadow-sm" style={focus ? { top: 0 } : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl bg-bg p-1" aria-label="Ferramentas do PDF">
          {([{ id: 'read', label: 'Ler e selecionar', icon: MousePointer2 }, { id: 'highlight', label: 'Destacar texto', icon: Highlighter }, { id: 'ink', label: 'Desenho livre', icon: PenLine }, { id: 'note', label: 'Adicionar nota', icon: MessageSquare }] as const).map((item) => <IconButton key={item.id} label={item.label} size="sm" aria-pressed={tool === item.id} onClick={() => setTool(item.id)} className={tool === item.id ? 'bg-accent/15 text-accent-strong' : undefined}><item.icon className="size-4" /></IconButton>)}
        </div>
        <div className="flex gap-1.5 border-r border-line pr-3" role="group" aria-label="Cor da marcação">{COLORS.map((option) => <button key={option.value} aria-label={option.label} aria-pressed={color === option.value} title={option.label} onClick={() => setColor(option.value)} className={cn('flex size-7 items-center justify-center rounded-full border-2 transition-transform', color === option.value ? 'scale-110 border-ink' : 'border-transparent')} style={{ background: option.value }}>{color === option.value && <Check className="size-3 text-[#243c2b]" />}</button>)}</div>
        {tool === 'highlight' && <Button size="sm" onPointerDown={(e) => e.preventDefault()} onClick={() => canvas.current?.highlightSelection()}>Marcar seleção</Button>}
        <IconButton label="Desfazer última alteração" size="sm" disabled={!history.length} onClick={() => { const previous = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); if (previous) save({ annotations: previous }) }}><Undo2 className="size-4" /></IconButton>
        <IconButton label={book.bookmarks.includes(book.currentPage) ? 'Remover marcador desta página' : 'Marcar esta página'} size="sm" aria-pressed={book.bookmarks.includes(book.currentPage)} onClick={() => save({ bookmarks: book.bookmarks.includes(book.currentPage) ? book.bookmarks.filter((p) => p !== book.currentPage) : [...book.bookmarks, book.currentPage] })}><Bookmark className={cn('size-4', book.bookmarks.includes(book.currentPage) && 'fill-accent text-accent')} /></IconButton>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Diminuir zoom" size="sm" disabled={zoom <= 0.6} onClick={() => setZoom((v) => Math.max(0.6, +(v - 0.2).toFixed(1)))}><ZoomOut className="size-4" /></IconButton>
          <button className="min-w-14 rounded-lg px-2 py-1 text-[11px] text-muted" onClick={() => setZoom(1)} title="Ajustar à largura">{Math.round(zoom * 100)}%</button>
          <IconButton label="Aumentar zoom" size="sm" disabled={zoom >= 2.4} onClick={() => setZoom((v) => Math.min(2.4, +(v + 0.2).toFixed(1)))}><ZoomIn className="size-4" /></IconButton>
          <IconButton label="Buscar no PDF" size="sm" aria-pressed={searchOpen} onClick={() => setSearchOpen((v) => !v)}><Search className="size-4" /></IconButton>
          <IconButton label={panel ? 'Ocultar painel de marcações' : 'Mostrar painel de marcações'} size="sm" aria-pressed={panel} onClick={() => setPanel((v) => !v)}><List className="size-4" /></IconButton>
          <IconButton label={focus ? 'Sair do modo foco' : 'Modo foco de leitura'} size="sm" aria-pressed={focus} onClick={() => setFocus((v) => !v)}>{focus ? <X className="size-4" /> : <Expand className="size-4" />}</IconButton>
        </div>
      </div>
      <p className="mt-2 border-t border-line px-2 pt-2 pb-1 text-[11px] text-muted">{guidance[tool]}</p>
      {searchOpen && <div className="mt-2 space-y-2 border-t border-line p-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void find() }}><Input aria-label="Texto para buscar no PDF" placeholder="Buscar palavras neste PDF" value={query} onChange={(e) => setQuery(e.target.value)} /><Button size="sm" type="submit" disabled={!query.trim() || searchProgress !== null}>Buscar</Button><IconButton label="Limpar busca" size="sm" onClick={() => { searchVersion.current++; setSearchTerm(''); setQuery(''); setHits([]); setSearched(false); setSearchProgress(null) }}><X className="size-4" /></IconButton></form>
        {searchProgress !== null && <p role="status" className="text-xs text-muted">Buscando na página {searchProgress} de {book.pageCount}…</p>}
        {searched && <p role="status" className="text-xs text-muted">{hits.length ? `${hits.length}${hits.length === 100 ? '+' : ''} página(s) encontrada(s).` : 'Nenhum trecho encontrado. PDFs digitalizados precisam de uma camada de texto.'}</p>}
        {!!hits.length && <ul className="max-h-40 divide-y divide-line overflow-auto">{hits.map((hit) => <li key={hit.page}><button className="w-full p-2 text-left text-xs text-muted hover:bg-bg" onClick={() => go(hit.page)}><strong className="text-ink">Página {hit.page}</strong> · {hit.excerpt}</button></li>)}</ul>}
      </div>}
    </div>

    <div className={cn('grid items-start gap-4', panel && 'lg:grid-cols-[minmax(0,1fr)_264px]')}>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div ref={area} className="max-h-[75dvh] min-h-[360px] overflow-auto p-4 sm:p-6" tabIndex={0} aria-label="Página do documento">
          <div className="flex min-w-fit justify-center"><PdfPageCanvas ref={canvas} document={pdf} page={book.currentPage} zoom={zoom} availableWidth={width} tool={tool} color={color} annotations={book.annotations} search={searchTerm} onAnnotate={annotate} onNote={(point) => { setNote({ point }); setNoteText('') }} onError={(message) => toastRef.current.error(message)} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface p-3">
          <IconButton label="Página anterior" size="sm" disabled={book.currentPage <= 1} onClick={() => go(book.currentPage - 1)}><ChevronLeft className="size-4" /></IconButton>
          <form className="flex items-center gap-2 text-xs text-muted" onSubmit={(e) => { e.preventDefault(); go(Number(pageInput)) }}><label htmlFor="pdf-page-input">Página</label><Input id="pdf-page-input" type="number" min={1} max={book.pageCount} className="!h-8 !w-16 text-center" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={() => go(Number(pageInput))} /><span>de {book.pageCount}</span></form>
          <IconButton label="Próxima página" size="sm" disabled={book.currentPage >= book.pageCount} onClick={() => go(book.currentPage + 1)}><ChevronRight className="size-4" /></IconButton>
        </div>
      </div>

      {panel && <aside className="pdf-reader-notes space-y-4 rounded-2xl border border-line bg-surface p-4" aria-label="Marcações e notas do PDF">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">Seu caderno de leitura</h2><span className="text-xs text-muted">{book.annotations.length}</span></div>
        <Button size="sm" className="w-full" icon={<MessageSquare className="size-3.5" />} onClick={() => void newNote()}>Nova nota</Button>
        {book.bookmarks.length > 0 && <div><h3 className="mb-2 text-[10px] font-semibold tracking-wider text-muted uppercase">Páginas marcadas</h3><div className="flex flex-wrap gap-1.5">{book.bookmarks.map((page) => <button key={page} onClick={() => go(page)} className={cn('rounded-lg border px-2.5 py-1 text-xs', page === book.currentPage ? 'border-accent bg-accent/10 text-accent-strong' : 'border-line text-muted')}>{page}</button>)}</div></div>}
        <p className="text-[11px] text-muted">{pageNotes.length} marcação(ões) nesta página. Todas as marcações aparecem abaixo.</p>
        {book.annotations.length === 0 ? <div className="rounded-xl border border-dashed border-line p-4 text-center"><Highlighter className="mx-auto mb-2 size-5 text-muted" /><p className="text-xs leading-relaxed text-muted">Destaque uma ideia, desenhe ou escreva sua primeira nota.</p></div> : <ul className="max-h-[55dvh] space-y-2 overflow-auto">{[...book.annotations].sort((a, b) => a.page - b.page).map((annotation) => <li key={annotation.id} className={cn('rounded-xl border p-3', annotation.page === book.currentPage ? 'border-accent/30' : 'border-line')}>
          <div className="flex items-center justify-between gap-2"><button onClick={() => go(annotation.page)} className="flex items-center gap-2 text-[10px] font-medium text-accent-strong"><span className="size-2 rounded-full" style={{ background: annotation.color }} />Página {annotation.page} · {annotation.type === 'highlight' ? 'Destaque' : annotation.type === 'ink' ? 'Desenho' : 'Nota'}</button><IconButton label={`Excluir marcação da página ${annotation.page}`} size="sm" onClick={() => changeAnnotations(book.annotations.filter((a) => a.id !== annotation.id))}><Trash2 className="size-3.5 text-muted" /></IconButton></div>
          {annotation.quote && <button onClick={() => go(annotation.page)} className="mt-2 line-clamp-4 text-left text-xs leading-relaxed text-muted">“{annotation.quote}”</button>}
          {annotation.text && <button className="mt-2 w-full whitespace-pre-wrap break-words text-left text-xs leading-relaxed text-ink" onClick={() => { go(annotation.page); setNote({ point: annotation.points?.[0] ?? { x: 36, y: 36 }, annotation }); setNoteText(annotation.text ?? '') }}>{annotation.text}</button>}
        </li>)}</ul>}
        <p className="border-t border-line pt-3 text-[10px] leading-relaxed text-muted"><FileText className="mr-1 inline size-3" />{storageNotice} Destaques e desenhos ficam incorporados na exportação; notas são comentários do PDF.</p>
      </aside>}
    </div>

    <Modal open={Boolean(note)} onClose={() => setNote(null)} title={note?.annotation ? 'Editar nota de leitura' : 'Nova nota de leitura'} description={`Página ${book.currentPage}`} footer={<><Button onClick={() => setNote(null)}>Cancelar</Button><Button variant="primary" disabled={!noteText.trim()} onClick={() => {
      if (!note) return
      if (note.annotation) changeAnnotations(book.annotations.map((a) => a.id === note.annotation?.id ? { ...a, text: noteText.trim() } : a))
      else annotate({ id: crypto.randomUUID(), page: book.currentPage, type: 'note', color, points: [note.point], text: noteText.trim(), createdAt: new Date().toISOString() })
      setNote(null); setNoteText('')
    }}>Salvar nota</Button></>}><Textarea aria-label="Texto da nota" rows={6} maxLength={10000} placeholder="O que você quer guardar desta leitura?" value={noteText} onChange={(e) => setNoteText(e.target.value)} /></Modal>
  </div>
}
