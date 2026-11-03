import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react'
import { TextLayer, type PDFDocumentProxy, type PageViewport, type RenderTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/Button'
import type { PdfAnnotation, PdfPoint, PdfRect } from '@/services/pdfLibrary'

export type PdfTool = 'read' | 'highlight' | 'ink' | 'note'
export interface PdfCanvasHandle { highlightSelection(): void }

interface Props {
  document: PDFDocumentProxy
  page: number
  zoom: number
  availableWidth: number
  tool: PdfTool
  color: string
  annotations: PdfAnnotation[]
  search: string
  onAnnotate: (annotation: PdfAnnotation) => void
  onNote: (point: PdfPoint) => void
  onError: (message: string) => void
}

/** The canvas and selectable text share one PDF.js viewport, including native page rotation. */
export const PdfPageCanvas = forwardRef<PdfCanvasHandle, Props>(function PdfPageCanvas(
  { document: pdf, page, zoom, availableWidth, tool, color, annotations, search, onAnnotate, onNote, onError }, ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
  const [ready, setReady] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderAttempt, setRenderAttempt] = useState(0)
  const [hasText, setHasText] = useState(true)
  const [draft, setDraft] = useState<PdfPoint[]>([])
  const points = useRef<PdfPoint[]>([])
  const drawing = useRef<number | null>(null)
  const errorRef = useRef(onError)
  errorRef.current = onError

  useEffect(() => {
    let cancelled = false
    let rendering: RenderTask | undefined
    let layer: TextLayer | undefined
    setReady(false)
    setRenderError(null)
    setDraft([])
    points.current = []
    drawing.current = null
    const render = async () => {
      const pdfPage = await pdf.getPage(page)
      if (cancelled || !canvas.current || !text.current) return
      const base = pdfPage.getViewport({ scale: 1 })
      const scale = Math.min((Math.max(220, availableWidth) / base.width) * zoom, 4)
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
      setViewport(view)
      rendering = pdfPage.render({ canvas: target, canvasContext: ctx, viewport: view, transform: [outputScale, 0, 0, outputScale, 0, 0] })
      await rendering.promise
      if (cancelled) return
      const content = await pdfPage.getTextContent()
      if (cancelled || !text.current) return
      setHasText(content.items.some((item) => 'str' in item && item.str.trim()))
      layer = new TextLayer({ textContentSource: content, container: text.current, viewport: view })
      await layer.render()
      if (cancelled) return
      if (search.trim()) {
        for (const span of layer.textDivs) {
          if (span.textContent?.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))) span.classList.add('pdf-search-hit')
        }
      }
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
  }, [pdf, page, zoom, availableWidth, search, renderAttempt])

  const highlight = () => {
    const selection = window.getSelection()
    const host = surface.current
    if (!ready || !viewport || !host || !selection?.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    if (!text.current?.contains(range.startContainer) || !text.current.contains(range.endContainer)) return
    const quote = selection.toString().trim()
    if (!quote) return
    const origin = host.getBoundingClientRect()
    const rects: PdfRect[] = []
    for (const rect of Array.from(range.getClientRects())) {
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
    selection.removeAllRanges()
  }
  useImperativeHandle(ref, () => ({ highlightSelection: highlight }))

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
    {!ready && !renderError && <p role="status" className="text-xs text-muted">Preparando página {page}…</p>}
    {renderError && <div role="alert" className="max-w-lg space-y-3 rounded-xl border border-danger/30 bg-bg p-5 text-center"><p className="text-sm font-semibold text-ink">Não foi possível exibir a página {page}</p><p className="break-words text-xs leading-relaxed text-muted">{renderError}</p><Button size="sm" onClick={() => setRenderAttempt((attempt) => attempt + 1)}>Tentar exibir novamente</Button></div>}
    <div ref={surface} className="pdf-page relative shrink-0 bg-white shadow-lg" style={{ width: viewport?.width ?? 400, height: viewport?.height ?? 560, display: renderError ? 'none' : undefined }} data-page-number={page} aria-busy={!ready && !renderError}>
      <canvas ref={canvas} aria-label={`Página ${page} do PDF`} className="block" />
      <div ref={text} className="pdf-text-layer" style={{ pointerEvents: tool === 'ink' || tool === 'note' ? 'none' : undefined }} onPointerUp={() => { if (tool === 'highlight') highlight() }} />
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
            return <rect key={i} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill={a.color} opacity={0.35} style={{ mixBlendMode: 'multiply' }} />
          })}
          {a.type === 'ink' && a.points && <path d={path(a.points)} fill="none" stroke={a.color} strokeWidth={(a.strokeWidth ?? 2) * viewport.scale * viewport.userUnit} strokeLinecap="round" strokeLinejoin="round" />}
          {a.type === 'note' && a.points?.[0] && <g transform={`translate(${toScreen(a.points[0]).join(' ')})`}><rect x="-8" y="-8" width="20" height="20" rx="3" fill={a.color} stroke="#775c12" /><path d="M-3 -2h10M-3 2h10M-3 6h6" stroke="#293227" strokeWidth="1.5" /><title>{a.text}</title></g>}
        </g>)}
        {draft.length > 0 && <path d={path(draft)} fill="none" stroke={color} strokeWidth={2 * viewport.scale * viewport.userUnit} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>}
    </div>
    {ready && !hasText && <p role="status" className="max-w-lg text-center text-xs text-muted">Esta página parece digitalizada. Use desenho livre e notas; a seleção de texto depende de uma camada de texto no PDF.</p>}
  </div>
})
