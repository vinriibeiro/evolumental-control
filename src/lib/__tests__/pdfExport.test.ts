import { describe, expect, it } from 'vitest'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream, degrees } from 'pdf-lib'
import type { PdfAnnotation } from '@/services/pdfLibrary'
import { exportAnnotatedPdf } from '../pdfExport'

async function sourcePdf(rotation = 0) {
  const document = await PDFDocument.create()
  const page = document.addPage([600, 800])
  page.setRotation(degrees(rotation))
  page.setCropBox(30, 40, 540, 720)
  return (await document.save()).buffer as ArrayBuffer
}

const annotation = (patch: Partial<PdfAnnotation>): PdfAnnotation => ({ id: 'mark-1', page: 1, type: 'highlight', color: '#ffcc00', createdAt: '2026-11-03T12:00:00.000Z', ...patch })
function contentOf(document: PDFDocument) {
  const streams = document.getPages()[0].node.Contents()
  if (!streams) return ''
  const items = streams instanceof PDFArray ? streams.asArray() : [streams]
  return items.map((item) => {
    const stream = document.context.lookup(item)
    if (!(stream instanceof PDFRawStream)) throw new Error('O conteúdo exportado não é um stream PDF válido.')
    return new TextDecoder().decode(decodePDFRawStream(stream).decode())
  }).join('\n')
}

describe('exportação de PDF anotado', () => {
  it.each([0, 90, 180, 270])('preserva rotação %i, cropbox e coordenadas nativas dos destaques e traços', async (rotation) => {
    const data = await sourcePdf(rotation)
    const original = new Uint8Array(data.slice(0))
    const marked = await exportAnnotatedPdf(data, [
      annotation({ rects: [{ x: 100, y: 600, width: 120, height: 16 }] }),
      annotation({ id: 'stroke-1', type: 'ink', color: '#18a', points: [{ x: 80, y: 500 }, { x: 120, y: 520 }, { x: 150, y: 510 }], strokeWidth: 3 }),
    ])
    const reopened = await PDFDocument.load(marked)
    expect(reopened.getPageCount()).toBe(1)
    expect(reopened.getPages()[0].getRotation().angle).toBe(rotation)
    expect(reopened.getPages()[0].getCropBox()).toEqual({ x: 30, y: 40, width: 540, height: 720 })
    const content = contentOf(reopened)
    expect(content).toContain('1 0 0 1 100 600 cm')
    expect(content).toContain('80 500 m')
    expect(content).toContain('120 520 l')
    expect(content).toContain('150 510 l')
    expect(content).toContain('3 w')
    expect(new Uint8Array(data)).toEqual(original)
  })

  it('normaliza retângulos com dimensões negativas, inclusive após seleção girada', async () => {
    const result = await PDFDocument.load(await exportAnnotatedPdf(await sourcePdf(90), [annotation({ rects: [{ x: 220, y: 616, width: -120, height: -16 }] })]))
    expect(contentOf(result)).toContain('1 0 0 1 100 600 cm')
  })

  it('exporta nota nativa clicável com português, Unicode e posição exatos', async () => {
    const text = 'Análise, ação e coração. Revisar amanhã — 数学.'
    const quote = 'Distribuição e inferência'
    const result = await PDFDocument.load(await exportAnnotatedPdf(await sourcePdf(90), [annotation({ type: 'note', text, quote, points: [{ x: 75, y: 660 }] })]))
    const page = result.getPages()[0]
    const annots = page.node.Annots()!
    expect(annots.size()).toBe(1)
    const note = result.context.lookup(annots.get(0), PDFDict)
    expect(note.get(PDFName.of('Subtype'))).toEqual(PDFName.of('Text'))
    expect(note.lookup(PDFName.of('Contents'), PDFHexString).decodeText()).toBe(`Trecho: ${quote}\n\n${text}`)
    expect(note.lookup(PDFName.of('Rect'), PDFArray).asArray().map(String)).toEqual(['75', '660', '97', '682'])
    expect(note.get(PDFName.of('P'))).toEqual(page.ref)
  })

  it('mantém anotações já existentes no arquivo e acrescenta as novas', async () => {
    const document = await PDFDocument.create()
    const page = document.addPage()
    page.node.addAnnot(document.context.register(document.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [20, 20, 40, 40], Contents: PDFHexString.fromText('Original') })))
    const data = (await document.save()).buffer as ArrayBuffer
    const result = await PDFDocument.load(await exportAnnotatedPdf(data, [annotation({ type: 'note', text: 'Nova nota' })]))
    const notes = result.getPages()[0].node.Annots()!
    expect(notes.size()).toBe(2)
    expect(result.context.lookup(notes.get(0), PDFDict).lookup(PDFName.of('Contents'), PDFHexString).decodeText()).toBe('Original')
  })

  it('recusa páginas e geometria inválidas com mensagens claras', async () => {
    const data = await sourcePdf()
    await expect(exportAnnotatedPdf(data, [annotation({ page: 2 })])).rejects.toThrow(/página 2/)
    await expect(exportAnnotatedPdf(data, [annotation({ rects: [{ x: 20, y: Number.NaN, width: 30, height: 10 }] })])).rejects.toThrow(/coordenadas/)
    await expect(exportAnnotatedPdf(data, [annotation({ type: 'ink', strokeWidth: -2 })])).rejects.toThrow(/espessura/)
  })
})
