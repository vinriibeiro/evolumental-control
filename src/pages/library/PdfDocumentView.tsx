import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfAnnotation, PdfPoint } from '@/services/pdfLibrary'
import { PdfPageCanvas, type PdfCanvasHandle, type PdfTool } from './PdfPageCanvas'

export type PdfViewMode = 'continuous' | 'single'

export interface PdfDocumentHandle {
  highlightSelection(): void
  /** Leva a página ao topo da área de leitura. */
  scrollToPage(page: number): void
}

interface Props {
  document: PDFDocumentProxy
  pageCount: number
  /** Página atual (a única desenhada no modo "single"). */
  page: number
  mode: PdfViewMode
  /** Elemento que rola: é nele que a rolagem contínua mede o que está visível. */
  area: RefObject<HTMLDivElement | null>
  zoom: number
  availableWidth: number
  /** Proporção (altura / largura) usada para reservar o espaço das páginas ainda não desenhadas. */
  ratio: number
  tool: PdfTool
  color: string
  annotations: PdfAnnotation[]
  search: string
  /** Trecho da busca selecionado: página e ordem dentro dela. */
  match: { page: number; index: number } | null
  revealMatch: boolean
  onMatchRevealed: () => void
  /** Rolagem contínua: a página que passou a ocupar a área de leitura. */
  onVisiblePage: (page: number) => void
  onAnnotate: (annotation: PdfAnnotation) => void
  onNote: (page: number, point: PdfPoint) => void
  onError: (message: string) => void
}

/**
 * Páginas do PDF em um dos dois modos:
 *  - "single": só a página atual;
 *  - "continuous": todas as páginas empilhadas, mas só as próximas da área visível são desenhadas
 *    (as demais são espaços reservados do mesmo tamanho), para o uso de memória não crescer com o
 *    tamanho do documento.
 */
export const PdfDocumentView = forwardRef<PdfDocumentHandle, Props>(function PdfDocumentView(
  { document: pdf, pageCount, page, mode, area, zoom, availableWidth, ratio, tool, color, annotations, search, match, revealMatch, onMatchRevealed, onVisiblePage, onAnnotate, onNote, onError },
  ref,
) {
  const slots = useRef(new Map<number, HTMLDivElement>())
  const handles = useRef(new Map<number, PdfCanvasHandle>())
  const ratios = useRef(new Map<number, number>())
  const [near, setNear] = useState<Set<number>>(() => new Set([page]))
  const pageRef = useRef(page)
  pageRef.current = page
  const visibleRef = useRef(onVisiblePage)
  visibleRef.current = onVisiblePage
  /** Depois de um salto pedido pelo usuário, ignora por instantes a página "medida" pela rolagem. */
  const jumpUntil = useRef(0)
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount])

  const scrollToPage = useCallback(
    (target: number) => {
      const root = area.current
      if (!root) return
      if (mode === 'single') {
        root.scrollTo({ top: 0, left: 0 })
        return
      }
      const slot = slots.current.get(target)
      if (!slot) return
      jumpUntil.current = Date.now() + 300
      root.scrollTop += slot.getBoundingClientRect().top - root.getBoundingClientRect().top - 8
    },
    [area, mode],
  )

  useImperativeHandle(
    ref,
    () => ({
      // cada página confere se a seleção de texto é dela; as outras ignoram o pedido
      highlightSelection: () => handles.current.forEach((handle) => handle.highlightSelection()),
      scrollToPage,
    }),
    [scrollToPage],
  )

  // Quais páginas estão perto da área visível (uma tela para cima e uma para baixo).
  useEffect(() => {
    const root = area.current
    if (mode !== 'continuous' || !root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (records) => {
        setNear((previous) => {
          const next = new Set(previous)
          for (const record of records) {
            const number = Number((record.target as HTMLElement).dataset.slot)
            if (record.isIntersecting) next.add(number)
            else next.delete(number)
          }
          return next
        })
      },
      { root, rootMargin: '100% 0px' },
    )
    slots.current.forEach((slot) => observer.observe(slot))
    return () => observer.disconnect()
  }, [area, mode, pageCount])

  // A página "atual" na rolagem contínua é a que cruza uma linha um pouco abaixo do topo da área.
  useEffect(() => {
    const root = area.current
    if (mode !== 'continuous' || !root) return
    let frame = 0
    const measure = () => {
      frame = 0
      if (Date.now() < jumpUntil.current) return
      const probe = root.getBoundingClientRect().top + Math.min(root.clientHeight * 0.35, 240)
      // As páginas estão empilhadas em ordem: busca binária pela primeira que termina abaixo da linha.
      let low = 1
      let high = slots.current.size
      while (low < high) {
        const middle = (low + high) >> 1
        const rect = slots.current.get(middle)?.getBoundingClientRect()
        if (rect && rect.bottom <= probe) low = middle + 1
        else high = middle
      }
      if (slots.current.has(low) && low !== pageRef.current) visibleRef.current(low)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [area, mode])

  // Ao abrir, trocar de modo, de zoom ou de largura, a página atual volta ao topo da área:
  // o tamanho de todas as páginas mudou e a posição antiga da rolagem não aponta mais para ela.
  useLayoutEffect(() => {
    if (mode === 'continuous') scrollToPage(pageRef.current)
  }, [mode, zoom, availableWidth, ratio, scrollToPage])

  const shared = { document: pdf, zoom, availableWidth, tool, color, annotations, search, onAnnotate, onError }
  const matchProps = (number: number) => (match?.page === number ? { activeMatch: match.index, revealMatch, onMatchRevealed } : {})

  if (mode === 'single') {
    return (
      <div className="flex min-w-fit justify-center">
        <PdfPageCanvas
          ref={(handle) => {
            handles.current.clear()
            if (handle) handles.current.set(page, handle)
          }}
          page={page}
          {...shared}
          {...matchProps(page)}
          onNote={(point) => onNote(page, point)}
        />
      </div>
    )
  }

  const width = availableWidth * zoom
  return (
    <div className="flex min-w-fit flex-col items-center gap-3">
      {pages.map((number) => {
        const estimate = { width, height: width * (ratios.current.get(number) ?? ratio) }
        return (
          <div
            key={number}
            data-slot={number}
            ref={(element) => {
              if (element) slots.current.set(number, element)
              else slots.current.delete(number)
            }}
          >
            {near.has(number) || number === page ? (
              <PdfPageCanvas
                ref={(handle) => {
                  if (handle) handles.current.set(number, handle)
                  else handles.current.delete(number)
                }}
                page={number}
                estimate={estimate}
                onRatio={(p, value) => ratios.current.set(p, value)}
                {...shared}
                {...matchProps(number)}
                onNote={(point) => onNote(number, point)}
              />
            ) : (
              <div className="border border-line bg-white" style={estimate} aria-label={`Página ${number} (ainda não exibida)`} />
            )}
          </div>
        )
      })}
    </div>
  )
})
