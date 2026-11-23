import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react'
import { TextLayer, type PDFDocumentProxy, type PageViewport, type RenderTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/Button'
import type { PdfAnnotation, PdfPoint, PdfRect } from '@/services/pdfLibrary'
import { blankMargins, NO_MARGINS, type PdfMargins } from './pdfMargins'

export type PdfTool = 'read' | 'highlight' | 'ink' | 'note'
export interface PdfCanvasHandle { highlightSelection(): void }
const measuredMargins = new WeakMap<PDFDocumentProxy, Map<number, PdfMargins>>()

/** Texto comparável na busca: sem acentos nem caixa ("estatistica" encontra "Estatística"). */
export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

interface Props {
  document: PDFDocumentProxy
  page: number
  zoom: number
  availableWidth: number
  cropMargins: boolean
  tool: PdfTool
  color: string
  annotations: PdfAnnotation[]
  search: string
  /** Qual trecho encontrado nesta página está selecionado (ordem dentro da página); o leitor rola até ele. */
  activeMatch?: number
  /** Pedido para rolar até o trecho ativo; o leitor avisa em onMatchRevealed para o pedido valer uma vez só. */
  revealMatch?: boolean
  onMatchRevealed?: () => void
  /** Tamanho provável da página antes de ela ser desenhada (rolagem contínua: evita saltos). */
  estimate?: { width: number; height: number }
  /** Proporção real (altura / largura) da página, assim que conhecida. */
  onRatio?: (page: number, ratio: number) => void
  onAnnotate: (annotation: PdfAnnotation) => void
  onNote: (point: PdfPoint) => void
  onError: (message: string) => void
}

/** The canvas and selectable text share one PDF.js viewport, including native page rotation. */
export const PdfPageCanvas = forwardRef<PdfCanvasHandle, Props>(function PdfPageCanvas(
  { document: pdf, page, zoom, availableWidth, cropMargins, tool, color, annotations, search, activeMatch, revealMatch, onMatchRevealed, estimate, onRatio, onAnnotate, onNote, onError }, ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<{ viewport: PageViewport; margins: PdfMargins } | null>(null)
  const viewport = geometry?.viewport ?? null
  const margins = geometry?.margins ?? NO_MARGINS
  const [ready, setReady] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderAttempt, setRenderAttempt] = useState(0)
  const [hasText, setHasText] = useState(true)
  const [draft, setDraft] = useState<PdfPoint[]>([])
  const points = useRef<PdfPoint[]>([])
  const drawing = useRef<number | null>(null)
  const marking = useRef<{ id: number; x: number; y: number; start: Range | null } | null>(null)
  const errorRef = useRef(onError)
  errorRef.current = onError
  const ratioRef = useRef(onRatio)
  ratioRef.current = onRatio
  const revealedRef = useRef(onMatchRevealed)
  revealedRef.current = onMatchRevealed
  const annotationRef = useRef(annotations)
  annotationRef.current = annotations
  const textDivs = useRef<HTMLElement[]>([])

  useEffect(() => {
    let cancelled = false
    let rendering: RenderTask | undefined
    let layer: TextLayer | undefined
    setReady(false)
    setRenderError(null)
    setDraft([])
    points.current = []
    drawing.current = null
    textDivs.current = []
    const render = async () => {
      const pdfPage = await pdf.getPage(page)
      if (cancelled || !canvas.current || !text.current) return
      const base = pdfPage.getViewport({ scale: 1 })
      let margins = NO_MARGINS
      if (cropMargins) {
        const cached = measuredMargins.get(pdf) ?? new Map<number, PdfMargins>()
        measuredMargins.set(pdf, cached)
        const previous = cached.get(page)
        if (previous) margins = previous
        else {
          const preview = document.createElement('canvas')
          const view = pdfPage.getViewport({ scale: 520 / Math.max(base.width, base.height) })
          preview.width = Math.ceil(view.width)
          preview.height = Math.ceil(view.height)
          const ctx = preview.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            try {
              rendering = pdfPage.render({ canvas: preview, canvasContext: ctx, viewport: view })
              await rendering.promise
              if (cancelled) return
              margins = blankMargins(ctx.getImageData(0, 0, preview.width, preview.height))
            } catch {
              if (cancelled) return
              // O PDF continua disponível mesmo quando não dá para analisar as margens.
            } finally {
              preview.width = 0
              preview.height = 0
            }
          }
          cached.set(page, margins)
        }
        margins = { ...margins }
        const keep = (x: number, y: number) => {
          const [position] = base.convertToViewportPoint(x, y)
          const padding = 0.025
          margins.left = Math.min(margins.left, Math.max(0, position / base.width - padding))
          margins.right = Math.min(margins.right, Math.max(0, 1 - position / base.width - padding))
        }
        for (const mark of annotationRef.current) {
          if (mark.page !== page) continue
          mark.points?.forEach(({ x, y }) => keep(x, y))
          mark.rects?.forEach(({ x, y, width, height }) => {
            keep(x, y)
            keep(x + width, y + height)
          })
        }
      }
      const contentWidth = base.width * (1 - margins.left - margins.right)
      ratioRef.current?.(page, base.height / contentWidth)
      const scale = Math.min((availableWidth / contentWidth) * zoom, 4)
      const view = pdfPage.getViewport({ scale })
      const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (view.width * view.height)))
      const target = canvas.current
      const ctx = target.getContext('2d')
      if (!ctx) throw new Error('Seu navegador não conseguiu abrir a página do PDF.')
      target.width = Math.ceil(view.width * outputScale)
      target.height = Math.ceil(view.height * outputScale)
      target.style.width = `${view.width}px`
      target.style.height = `${view.height}px`
      text.current.replaceChildren()
      text.current.style.setProperty('--total-scale-factor', String(view.scale * view.userUnit))
      text.current.style.setProperty('--scale-round-x', '1px')
      text.current.style.setProperty('--scale-round-y', '1px')
      setGeometry({ viewport: view, margins })
      rendering = pdfPage.render({ canvas: target, canvasContext: ctx, viewport: view, transform: [outputScale, 0, 0, outputScale, 0, 0] })
      await rendering.promise
      if (cancelled) return
      const content = await pdfPage.getTextContent()
      if (cancelled || !text.current) return
      setHasText(content.items.some((item) => 'str' in item && item.str.trim()))
      layer = new TextLayer({ textContentSource: content, container: text.current, viewport: view })
      await layer.render()
      if (cancelled) return
      textDivs.current = layer.textDivs
      setReady(true)
    }
    void render().catch((error: unknown) => {
      if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
        const message = error instanceof Error ? error.message : 'Não foi possível renderizar esta página.'
        setRenderError(message)
        errorRef.current(message)
      }
    })
    return () => { cancelled = true; rendering?.cancel(); layer?.cancel() }
  }, [pdf, page, zoom, availableWidth, cropMargins, renderAttempt])

  // A busca só pinta o texto já desenhado: trocar o termo ou o trecho ativo não redesenha a página.
  useEffect(() => {
    if (!ready) return
    const term = searchKey(search.trim())
    let order = 0
    for (const span of textDivs.current) {
      const hit = Boolean(term) && searchKey(span.textContent ?? '').includes(term)
      const active = hit && order === activeMatch
      span.classList.toggle('pdf-search-hit', hit)
      span.classList.toggle('pdf-search-active', active)
      if (active && revealMatch) {
        span.scrollIntoView?.({ block: 'center', inline: 'nearest' })
        revealedRef.current?.()
      }
      if (hit) order++
    }
  }, [ready, search, activeMatch, revealMatch])

  const saveHighlight = (clientRects: Iterable<Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>>, quote?: string) => {
    const host = surface.current
    if (!ready || !viewport || !host) return
    const origin = host.getBoundingClientRect()
    const rects: PdfRect[] = []
    for (const rect of clientRects) {
      const left = Math.max(0, rect.left - origin.left)
      const top = Math.max(0, rect.top - origin.top)
      const right = Math.min(viewport.width, rect.right - origin.left)
      const bottom = Math.min(viewport.height, rect.bottom - origin.top)
      if (right - left < 1 || bottom - top < 1) continue
      const [x1, y1] = viewport.convertToPdfPoint(left, top)
      const [x2, y2] = viewport.convertToPdfPoint(right, bottom)
      const native = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
      if (!rects.some((r) => Math.abs(r.x - native.x) < 0.2 && Math.abs(r.y - native.y) < 0.2 && Math.abs(r.width - native.width) < 0.2)) rects.push(native)
    }
    if (!rects.length) return
    onAnnotate({ id: crypto.randomUUID(), page, type: 'highlight', color, rects, quote, createdAt: new Date().toISOString() })
  }

  const highlight = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    if (!text.current?.contains(range.startContainer) || !text.current.contains(range.endContainer)) return
    const quote = selection.toString().trim()
    if (!quote) return
    saveHighlight(Array.from(range.getClientRects()), quote)
    selection.removeAllRanges()
  }
  useImperativeHandle(ref, () => ({ highlightSelection: highlight }))

  const caretAt = (x: number, y: number) => {
    const position = document.caretPositionFromPoint?.(x, y)
    const caret = document.caretRangeFromPoint?.(x, y) ?? document.createRange()
    if (position) {
      caret.setStart(position.offsetNode, position.offset)
      caret.collapse(true)
    }
    return caret.startContainer.nodeType === Node.TEXT_NODE && text.current?.contains(caret.startContainer) ? caret : null
  }

  const updateHighlight = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = marking.current
    if (gesture?.id !== event.pointerId || !gesture.start) return
    const end = caretAt(event.clientX, event.clientY)
    if (!end) return
    const [first, last] = gesture.start.compareBoundaryPoints(Range.START_TO_START, end) <= 0 ? [gesture.start, end] : [end, gesture.start]
    const range = first.cloneRange()
    range.setEnd(last.startContainer, last.startOffset)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const pointAt = (event: PointerEvent<SVGSVGElement>): PdfPoint | null => {
    if (!viewport || !ready) return null
    const origin = event.currentTarget.getBoundingClientRect()
    const [x, y] = viewport.convertToPdfPoint(Math.max(0, Math.min(viewport.width, event.clientX - origin.left)), Math.max(0, Math.min(viewport.height, event.clientY - origin.top)))
    return { x, y }
  }
  const toScreen = (point: PdfPoint) => viewport?.convertToViewportPoint(point.x, point.y) ?? [0, 0]
  const path = (list: PdfPoint[]) => list.map((point, index) => `${index ? 'L' : 'M'}${toScreen(point).join(' ')}`).join(' ')
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    if (drawing.current !== event.pointerId) return
    drawing.current = null
    const end = pointAt(event)
    const line = end ? [...points.current, end] : points.current
    if (line.length >= 2) onAnnotate({ id: crypto.randomUUID(), page, type: 'ink', color, points: line, strokeWidth: 2, createdAt: new Date().toISOString() })
    points.current = []
    setDraft([])
  }

  return <div className="flex flex-col items-center gap-3">
    {renderError && <div role="alert" className="max-w-lg space-y-3 rounded-xl border border-danger/30 bg-bg p-5 text-center"><p className="text-sm font-semibold text-ink">Não foi possível exibir a página {page}</p><p className="break-words text-xs leading-relaxed text-muted">{renderError}</p><Button size="sm" onClick={() => setRenderAttempt((attempt) => attempt + 1)}>Tentar exibir novamente</Button></div>}
    <div className="relative shrink-0 overflow-clip" style={{
      width: viewport ? viewport.width * (1 - margins.left - margins.right) : estimate?.width ?? availableWidth * zoom,
      height: viewport?.height ?? estimate?.height ?? availableWidth * zoom * Math.SQRT2,
      display: renderError ? 'none' : undefined,
    }} data-pdf-frame="">
      <div ref={surface} className="pdf-page relative bg-white" style={{ width: viewport?.width, height: viewport?.height, left: viewport ? -viewport.width * margins.left : 0 }} data-page-number={page} aria-busy={!ready && !renderError}>
        {!ready && !renderError && <p role="status" className="absolute inset-x-0 top-6 text-center text-xs text-[#6b6b6b]">Preparando página {page}…</p>}
        <canvas ref={canvas} aria-label={`Página ${page} do PDF`} className="block" />
        <div ref={text} className="pdf-text-layer" style={{ pointerEvents: tool === 'ink' || tool === 'note' ? 'none' : undefined, touchAction: tool === 'highlight' ? 'none' : undefined }}
          onPointerDown={(event) => {
            if (tool !== 'highlight' || event.pointerType === 'mouse' || !event.isPrimary || !ready) return
            event.preventDefault()
            window.getSelection()?.removeAllRanges()
            marking.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: caretAt(event.clientX, event.clientY) }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={updateHighlight}
          onPointerUp={(event) => {
            if (tool !== 'highlight') return
            if (event.pointerType === 'mouse') { highlight(); return }
            const gesture = marking.current
            if (gesture?.id !== event.pointerId) return
            updateHighlight(event)
            marking.current = null
            if (window.getSelection()?.toString().trim()) {
              highlight()
            } else if (Math.abs(event.clientX - gesture.x) >= 10 && Math.abs(event.clientY - gesture.y) < 20) {
              const center = (gesture.y + event.clientY) / 2
              saveHighlight([{ left: Math.min(gesture.x, event.clientX), right: Math.max(gesture.x, event.clientX), top: center - 6, bottom: center + 6 }])
            }
          }}
          onPointerCancel={() => {
            marking.current = null
            window.getSelection()?.removeAllRanges()
          }} />
        {viewport && <svg viewBox={`0 0 ${viewport.width} ${viewport.height}`} className="absolute inset-0 size-full" aria-label={tool === 'ink' ? 'Área de desenho livre' : tool === 'note' ? 'Clique para adicionar uma nota' : undefined}
          style={{ pointerEvents: tool === 'ink' || tool === 'note' ? 'auto' : 'none', touchAction: tool === 'ink' || tool === 'note' ? 'none' : undefined, cursor: tool === 'ink' ? 'crosshair' : tool === 'note' ? 'copy' : undefined }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const point = pointAt(event)
            if (!point) return
            event.preventDefault()
            if (tool === 'note') { onNote(point); return }
            if (tool !== 'ink') return
            event.currentTarget.setPointerCapture(event.pointerId)
            drawing.current = event.pointerId
            points.current = [point]
            setDraft([point])
          }}
          onPointerMove={(event) => {
            if (drawing.current !== event.pointerId || points.current.length >= 5000) return
            const point = pointAt(event)
            if (point) { points.current = [...points.current, point]; setDraft(points.current) }
          }}
          onPointerUp={finish} onPointerCancel={() => { drawing.current = null; points.current = []; setDraft([]) }}>
          {annotations.filter((a) => a.page === page).map((a) => <g key={a.id}>
            {a.type === 'highlight' && a.rects?.map((r, i) => {
              const [x1, y1] = viewport.convertToViewportPoint(r.x, r.y)
              const [x2, y2] = viewport.convertToViewportPoint(r.x + r.width, r.y + r.height)
              return <rect key={i} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill={a.color} opacity={0.35} />
            })}
            {a.type === 'ink' && a.points && <path d={path(a.points)} fill="none" stroke={a.color} strokeWidth={(a.strokeWidth ?? 2) * viewport.scale * viewport.userUnit} strokeLinecap="round" strokeLinejoin="round" />}
            {a.type === 'note' && a.points?.[0] && <g transform={`translate(${toScreen(a.points[0]).join(' ')})`}><rect x="-8" y="-8" width="20" height="20" rx="3" fill={a.color} stroke="#775c12" /><path d="M-3 -2h10M-3 2h10M-3 6h6" stroke="#293227" strokeWidth="1.5" /><title>{a.text}</title></g>}
          </g>)}
          {draft.length > 0 && <path d={path(draft)} fill="none" stroke={color} strokeWidth={2 * viewport.scale * viewport.userUnit} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>}
      </div>
    </div>
    {ready && !hasText && tool !== 'read' && <p role="status" className="max-w-lg text-center text-xs text-muted">Página digitalizada. Arraste na horizontal para destacar uma faixa.</p>}
  </div>
})
