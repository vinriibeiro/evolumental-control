import { BlendMode, LineCapStyle, PDFDocument, PDFHexString, PDFName, rgb } from 'pdf-lib'
import type { PdfAnnotation, PdfPoint, PdfRect } from '@/services/pdfLibrary'

function annotationColor(value: string) {
  const raw = value.replace(/^#/, '')
  const hex = /^[\da-f]{3}$/i.test(raw) ? raw.split('').map((character) => character + character).join('') : /^[\da-f]{6}$/i.test(raw) ? raw : 'f2c94c'
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255)
}

function validPoint(point: PdfPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function normalizedRect(rect: PdfRect): PdfRect {
  if (!validPoint(rect) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) throw new Error('Uma marcação contém coordenadas inválidas.')
  return { x: Math.min(rect.x, rect.x + rect.width), y: Math.min(rect.y, rect.y + rect.height), width: Math.abs(rect.width), height: Math.abs(rect.height) }
}

/**
 * Gera uma cópia anotada. Todas as coordenadas já estão no espaço nativo do PDF:
 * a rotação /Rotate e a CropBox originais são preservadas sem transformar o traço
 * uma segunda vez. O ArrayBuffer recebido nunca é alterado.
 */
export async function exportAnnotatedPdf(data: ArrayBuffer, annotations: PdfAnnotation[]): Promise<Uint8Array> {
  const document = await PDFDocument.load(data.slice(0))
  const pages = document.getPages()
  for (const annotation of annotations) {
    if (!Number.isSafeInteger(annotation.page) || annotation.page < 1 || annotation.page > pages.length) throw new Error(`A página ${annotation.page} de uma marcação não existe neste PDF.`)
    const page = pages[annotation.page - 1]
    const color = annotationColor(annotation.color)

    if (annotation.type === 'highlight') {
      for (const rectangle of annotation.rects ?? []) {
        const rect = normalizedRect(rectangle)
        if (rect.width === 0 || rect.height === 0) continue
        page.drawRectangle({ ...rect, color, opacity: 0.3, blendMode: BlendMode.Multiply, borderWidth: 0 })
      }
    } else if (annotation.type === 'ink') {
      const points = annotation.points ?? []
      if (points.some((point) => !validPoint(point))) throw new Error('Um traço contém coordenadas inválidas.')
      const width = annotation.strokeWidth ?? 2
      if (!Number.isFinite(width) || width <= 0) throw new Error('A espessura de um traço é inválida.')
      if (points.length === 1) page.drawCircle({ x: points[0].x, y: points[0].y, size: width / 2, color })
      for (let index = 1; index < points.length; index++) {
        page.drawLine({ start: points[index - 1], end: points[index], thickness: width, color, lineCap: LineCapStyle.Round })
      }
    } else if (annotation.type === 'note') {
      const crop = page.getCropBox()
      const point = annotation.points?.[0] ?? annotation.rects?.[0] ?? { x: crop.x + 24, y: crop.y + crop.height - 48 }
      if (!validPoint(point)) throw new Error('Uma nota contém coordenadas inválidas.')
      const text = [annotation.quote ? `Trecho: ${annotation.quote}` : '', annotation.text ?? ''].filter(Boolean).join('\n\n')
      // Text nativo: o leitor de PDFs exibe um ícone clicável com o comentário.
      // UTF-16BE em PDFHexString mantém acentos, português e outros alfabetos.
      const note = document.context.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('Text'),
        Rect: [point.x, point.y, point.x + 22, point.y + 22],
        Contents: PDFHexString.fromText(text),
        T: PDFHexString.fromText('VLM Control'),
        NM: PDFHexString.fromText(annotation.id),
        Name: PDFName.of('Comment'),
        C: [color.red, color.green, color.blue],
        Open: false,
        F: 4,
        P: page.ref,
      })
      page.node.addAnnot(document.context.register(note))
    } else {
      throw new Error('Tipo de marcação desconhecido.')
    }
  }
  return document.save()
}
