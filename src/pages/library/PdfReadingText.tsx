import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '@/components/ui/Button'

export function PdfReadingText({ document, page, fontSize, onOriginal }: {
  document: PDFDocumentProxy
  page: number
  fontSize: number
  onOriginal: () => void
}) {
  const [content, setContent] = useState<{ page: number; paragraphs: string[]; failed?: boolean }>()

  useEffect(() => {
    let active = true
    void (async () => {
      const source = await document.getPage(page)
      const text = await source.getTextContent()
      const paragraphs: string[] = []
      let paragraph = ''
      let previousY: number | undefined
      let previousHeight = 0
      let endOfLine = true
      for (const item of text.items) {
        if (!('str' in item)) continue
        const y = item.transform[5]
        if (endOfLine && item.str.trim() && paragraph.trim() && previousY !== undefined &&
            (y > previousY + previousHeight || previousY - y > Math.max(previousHeight, item.height, 1) * 1.65)) {
          paragraphs.push(paragraph.trim())
          paragraph = ''
        }
        paragraph += item.str + (item.hasEOL ? ' ' : '')
        if (item.str.trim()) {
          previousY = y
          previousHeight = item.height
        }
        endOfLine = item.hasEOL
      }
      if (paragraph.trim()) paragraphs.push(paragraph.trim())
      if (active) setContent({ page, paragraphs })
    })().catch(() => { if (active) setContent({ page, paragraphs: [], failed: true }) })
    return () => { active = false }
  }, [document, page])

  if (content?.page !== page) return <p role="status" className="p-5 text-center text-sm text-muted">Preparando texto…</p>
  if (!content.paragraphs.length) {
    return <div className="space-y-3 p-5 text-center">
      <p role="status" className="text-sm text-muted">{content.failed ? 'Não foi possível extrair o texto desta página.' : 'Esta página não tem texto selecionável.'}</p>
      <Button size="sm" onClick={onOriginal}>Ver página original</Button>
    </div>
  }
  return <article className="pdf-reading-text" aria-label={`Texto da página ${page}`} style={{ fontSize }}>
    {content.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </article>
}
