// PDF simples dos relatórios (A4, preto/branco com detalhes em vermelho), montado com pdf-lib.
// O conteúdo chega como uma lista de blocos; este módulo só cuida de quebra de linha, tabelas e páginas.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type PdfBlock =
  | { type: 'heading'; text: string }
  /** Parágrafo com rótulo opcional (ex.: "Dado", "Sugestão por regra") e uma nota menor abaixo. */
  | { type: 'paragraph'; text: string; label?: string; accent?: boolean; note?: string }
  /** Números-chave em grade (rótulo pequeno + valor em destaque). */
  | { type: 'stats'; items: Array<{ label: string; value: string }> }
  | { type: 'table'; columns: string[]; rows: Array<Array<string | number>>; empty?: string }

export interface PdfReport {
  title: string
  /** Período do relatório. */
  subtitle?: string
  /** Linha discreta abaixo do título (ex.: data de geração). */
  meta?: string
  blocks: PdfBlock[]
}

const PAGE = { width: 595.28, height: 841.89, margin: 48 }
const INK = rgb(0.09, 0.09, 0.09)
const MUTED = rgb(0.42, 0.42, 0.42)
const LINE = rgb(0.85, 0.85, 0.85)
const RED = rgb(185 / 255, 28 / 255, 28 / 255)

// As fontes padrão do PDF usam WinAnsi: acentos do português entram, alguns símbolos não.
const REPLACEMENTS: Record<string, string> = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '−': '-', '✓': 'x', ' ': ' ', ' ': ' ', '\t': ' ' }

/** Troca o que a fonte não consegue desenhar (pdf-lib lança erro em vez de ignorar). */
export function sanitizePdfText(text: string, supported: Set<number>): string {
  let out = ''
  for (const ch of String(text)) {
    const mapped = REPLACEMENTS[ch] ?? ch
    for (const c of mapped) out += supported.has(c.codePointAt(0)!) ? c : '?'
  }
  return out
}

/** Quebra o texto em linhas que cabem na largura (palavras longas demais são partidas). */
export function wrapText(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/ +/).filter(Boolean)) {
      let piece = word
      // Palavra maior que a linha inteira (ex.: um link): parte por caracteres.
      while (measure(piece) > width && piece.length > 1) {
        let cut = piece.length - 1
        while (cut > 1 && measure(piece.slice(0, cut)) > width) cut--
        if (line) lines.push(line)
        lines.push(piece.slice(0, cut))
        line = ''
        piece = piece.slice(cut)
      }
      const next = line ? `${line} ${piece}` : piece
      if (line && measure(next) > width) {
        lines.push(line)
        line = piece
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

export async function buildReportPdf(report: PdfReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(report.title)
  doc.setCreator('VLM Control')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(regular.getCharacterSet())
  const clean = (s: string | number) => sanitizePdfText(String(s), supported)
  const contentWidth = PAGE.width - PAGE.margin * 2

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - PAGE.margin
  const ensure = (height: number) => {
    if (y - height >= PAGE.margin + 16) return
    page = doc.addPage([PAGE.width, PAGE.height])
    y = PAGE.height - PAGE.margin
  }
  const lines = (text: string, font: PDFFont, size: number, width: number) => wrapText(clean(text), width, (s) => font.widthOfTextAtSize(s, size))
  /** Escreve linhas já quebradas a partir de `y` e devolve a altura usada. */
  const write = (list: string[], font: PDFFont, size: number, x: number, color = INK, lineHeight = size * 1.4, align: 'left' | 'right' = 'left', width = 0) => {
    for (const text of list) {
      ensure(lineHeight)
      const dx = align === 'right' ? width - font.widthOfTextAtSize(text, size) : 0
      page.drawText(text, { x: x + dx, y: y - size, size, font, color })
      y -= lineHeight
    }
  }

  // Cabeçalho
  write(lines(report.title, bold, 18, contentWidth), bold, 18, PAGE.margin)
  if (report.subtitle) write(lines(report.subtitle, regular, 11, contentWidth), regular, 11, PAGE.margin)
  if (report.meta) write(lines(report.meta, regular, 8.5, contentWidth), regular, 8.5, PAGE.margin, MUTED)
  y -= 6
  page.drawRectangle({ x: PAGE.margin, y: y - 2, width: 36, height: 2, color: RED })
  y -= 18

  for (const block of report.blocks) {
    if (block.type === 'heading') {
      y -= 8
      // Mantém o título junto de pelo menos uma linha do conteúdo que vem depois.
      ensure(44)
      write(lines(block.text, bold, 12, contentWidth), bold, 12, PAGE.margin)
      page.drawLine({ start: { x: PAGE.margin, y: y - 1 }, end: { x: PAGE.width - PAGE.margin, y: y - 1 }, thickness: 0.6, color: LINE })
      y -= 10
    } else if (block.type === 'paragraph') {
      const body = lines(block.text, regular, 10, contentWidth)
      ensure((block.label ? 11 : 0) + Math.min(body.length, 2) * 14)
      if (block.label) write([clean(block.label).toUpperCase()], bold, 7, PAGE.margin, block.accent ? RED : MUTED, 11)
      write(body, regular, 10, PAGE.margin)
      if (block.note) write(lines(block.note, regular, 8.5, contentWidth), regular, 8.5, PAGE.margin, MUTED)
      y -= 6
    } else if (block.type === 'stats') {
      const columns = 3
      const cell = contentWidth / columns
      for (let i = 0; i < block.items.length; i += columns) {
        ensure(40)
        const top = y
        let used = 0
        block.items.slice(i, i + columns).forEach((item, col) => {
          y = top
          const x = PAGE.margin + col * cell
          write(lines(item.label, regular, 8, cell - 10), regular, 8, x, MUTED)
          write(lines(item.value, bold, 13, cell - 10), bold, 13, x)
          used = Math.max(used, top - y)
        })
        y = top - used - 8
      }
      y -= 4
    } else {
      drawTable(block)
    }
  }

  function drawTable(block: Extract<PdfBlock, { type: 'table' }>) {
    const n = block.columns.length
    // A primeira coluna (nomes) fica com o dobro da largura das demais (números).
    const unit = contentWidth / (n + 1)
    const widths = block.columns.map((_, i) => (i === 0 ? unit * 2 : unit))
    const xs = widths.map((_, i) => PAGE.margin + widths.slice(0, i).reduce((a, b) => a + b, 0))
    const row = (cells: Array<string | number>, font: PDFFont, size: number, color = INK) => {
      const wrapped = cells.map((c, i) => lines(String(c ?? ''), font, size, widths[i] - 8))
      const height = Math.max(...wrapped.map((w) => w.length)) * size * 1.4 + 6
      ensure(height)
      const top = y
      wrapped.forEach((w, i) => {
        y = top - 3
        write(w, font, size, xs[i] + (i === 0 ? 0 : 4), color, size * 1.4, i === 0 ? 'left' : 'right', widths[i] - 8)
      })
      y = top - height
      page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.4, color: LINE })
    }
    row(block.columns, bold, 8.5, MUTED)
    if (block.rows.length === 0) {
      y -= 4
      write(lines(block.empty ?? 'Sem dados no período.', regular, 9, contentWidth), regular, 9, PAGE.margin, MUTED)
    }
    for (const r of block.rows) row(r, regular, 9)
    y -= 12
  }

  // Rodapé com numeração, depois que todas as páginas existem.
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const text = clean(`VLM Control · página ${i + 1} de ${pages.length}`)
    p.drawText(text, { x: PAGE.margin, y: PAGE.margin - 22, size: 8, font: regular, color: MUTED })
  })
  return doc.save()
}
