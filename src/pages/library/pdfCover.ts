/**
 * Capa e dados básicos de um PDF, lidos com o mesmo pdf.js do leitor (carregado sob demanda, para a
 * estante não pagar o custo do leitor). Tudo aqui é "melhor esforço": PDF com senha, corrompido ou
 * navegador sem canvas simplesmente ficam sem capa, e a estante mostra a capa tipográfica.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PdfDescription {
  pageCount?: number
  author?: string
  cover?: ArrayBuffer
  coverType?: string
}

/** Largura da miniatura guardada: o bastante para a grade da estante em telas de alta densidade. */
const COVER_WIDTH = 360

/** Renderiza a primeira página como JPEG pequeno. Devolve undefined se o navegador não conseguir. */
export async function renderPdfCover(document: PDFDocumentProxy): Promise<ArrayBuffer | undefined> {
  try {
    const page = await document.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: COVER_WIDTH / base.width })
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return undefined
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    canvas.width = 0
    canvas.height = 0
    return blob ? await blob.arrayBuffer() : undefined
  } catch {
    return undefined
  }
}

/** Abre o PDF só para ler a contagem de páginas, o autor e a capa. Nunca lança. */
export async function describePdf(data: ArrayBuffer): Promise<PdfDescription> {
  try {
    const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    GlobalWorkerOptions.workerSrc = worker.default
    // cópia dos bytes: o pdf.js transfere o buffer para o worker e o original precisa seguir para a estante
    const task = getDocument({ data: new Uint8Array(data.slice(0)), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' })
    try {
      const document = await task.promise
      const out: PdfDescription = { pageCount: document.numPages }
      try {
        const info = (await document.getMetadata()).info as { Author?: unknown } | undefined
        const author = typeof info?.Author === 'string' ? info.Author.trim() : ''
        if (author) out.author = author.slice(0, 500)
      } catch {
        // metadados são opcionais
      }
      const cover = await renderPdfCover(document)
      if (cover) {
        out.cover = cover
        out.coverType = 'image/jpeg'
      }
      return out
    } finally {
      void task.destroy()
    }
  } catch {
    return {}
  }
}
