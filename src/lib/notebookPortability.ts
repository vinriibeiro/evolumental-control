import JSZip from 'jszip'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { DataBackend } from '@/lib/data/types'
import { markdownToDoc, sanitizeSafeImageSrc, sanitizeSafeUrl } from '@/lib/notebookMarkdown'
import { ensureBlockIds, extractDocSummary } from '@/lib/notebooks'
import { createNode, createNotebook } from '@/services/notebooks'
import type {
  Notebook,
  NotebookContentDoc,
  NotebookContentNode,
  NotebookNode,
  NotebookPageContent,
  NotebookPageLink,
  NotebookTag,
  NotebookTagLink,
} from '@/types/db'

// ---------------------------------------------------------------------
// Helpers seguros de formatação e download
// ---------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function slugifyFilename(name: string, fallback = 'caderno'): string {
  const clean = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return clean || fallback
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------
// 1. Exportação para Markdown
// ---------------------------------------------------------------------

function renderInlineMarkdown(nodes: NotebookContentNode[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n'
      let text = typeof n.text === 'string' ? n.text : renderInlineMarkdown(n.content)
      if (!Array.isArray(n.marks) || n.marks.length === 0) return text
      for (const m of n.marks) {
        if (m.type === 'code') text = `\`${text}\``
        else if (m.type === 'bold') text = `**${text}**`
        else if (m.type === 'italic') text = `*${text}*`
        else if (m.type === 'strike') text = `~~${text}~~`
        else if (m.type === 'underline') text = `<u>${text}</u>`
        else if (m.type === 'superscript') text = `^${text}^`
        else if (m.type === 'subscript') text = `~${text}~`
        else if (m.type === 'link') {
          const href = sanitizeSafeUrl(typeof m.attrs?.href === 'string' ? m.attrs.href : null)
          if (href) text = `[${text}](${href})`
        }
      }
      return text
    })
    .join('')
}

function renderBlockMarkdown(node: NotebookContentNode, indent = ''): string {
  switch (node.type) {
    case 'paragraph':
      return `${indent}${renderInlineMarkdown(node.content)}`
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1))
      return `${'#'.repeat(level)} ${renderInlineMarkdown(node.content)}`
    }
    case 'horizontalRule':
      return '---'
    case 'blockquote': {
      const inner = (node.content ?? []).map((c) => renderBlockMarkdown(c)).join('\n')
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => {
          const lines = (item.content ?? []).map((c) => renderBlockMarkdown(c, `${indent}  `)).join('\n')
          return `${indent}- ${lines.trimStart()}`
        })
        .join('\n')
    case 'orderedList':
      return (node.content ?? [])
        .map((item, idx) => {
          const lines = (item.content ?? []).map((c) => renderBlockMarkdown(c, `${indent}   `)).join('\n')
          return `${indent}${idx + 1}. ${lines.trimStart()}`
        })
        .join('\n')
    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked === true ? 'x' : ' '
          const lines = (item.content ?? []).map((c) => renderBlockMarkdown(c, `${indent}  `)).join('\n')
          return `${indent}- [${checked}] ${lines.trimStart()}`
        })
        .join('\n')
    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? `<!-- ${node.attrs.title.trim()} -->\n` : ''
      const code = (node.content ?? []).map((c) => c.text ?? '').join('')
      return `${title}\`\`\`${lang}\n${code}\n\`\`\``
    }
    case 'table': {
      const rows = node.content ?? []
      if (rows.length === 0) return ''
      const mdRows = rows.map((row) =>
        `| ${(row.content ?? []).map((cell) => renderInlineMarkdown(cell.content?.[0]?.content ?? cell.content).replace(/\|/g, '\\|')).join(' | ')} |`,
      )
      const colCount = Math.max(1, rows[0].content?.length ?? 1)
      const sep = `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`
      return [mdRows[0], sep, ...mdRows.slice(1)].join('\n')
    }
    case 'callout': {
      const variant = String(node.attrs?.variant ?? 'info').toUpperCase()
      const title = typeof node.attrs?.title === 'string' ? node.attrs.title : variant
      const inner = (node.content ?? []).map((c) => renderBlockMarkdown(c)).join('\n')
      return `> [!${variant}] ${title}\n${inner
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}`
    }
    case 'qaBlock': {
      const q = typeof node.attrs?.question === 'string' ? node.attrs.question : 'Pergunta'
      const a = (node.content ?? []).map((c) => renderBlockMarkdown(c)).join('\n')
      return `**Pergunta:** ${q}\n\n<details>\n<summary>Resposta</summary>\n\n${a}\n\n</details>`
    }
    case 'toggleBlock': {
      const s = typeof node.attrs?.summary === 'string' ? node.attrs.summary : 'Detalhes'
      const inner = (node.content ?? []).map((c) => renderBlockMarkdown(c)).join('\n')
      return `<details>\n<summary>${s}</summary>\n\n${inner}\n\n</details>`
    }
    case 'glossaryBlock': {
      const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? `### ${node.attrs.title.trim()}\n\n` : ''
      const entries = Array.isArray(node.attrs?.entries) ? (node.attrs.entries as Array<{ term?: string; definition?: string }>) : []
      return `${title}${entries.map((e) => `- **${e.term ?? ''}**: ${e.definition ?? ''}`).join('\n')}`
    }
    case 'mathBlock': {
      const formula = typeof node.attrs?.formula === 'string' ? node.attrs.formula : ''
      const caption = typeof node.attrs?.caption === 'string' && node.attrs.caption.trim() ? `*${node.attrs.caption.trim()}*\n\n` : ''
      return `${caption}$$\n${formula}\n$$`
    }
    case 'mermaidBlock': {
      const code = typeof node.attrs?.code === 'string' ? node.attrs.code : ''
      const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? `### ${node.attrs.title.trim()}\n\n` : ''
      return `${title}\`\`\`mermaid\n${code}\n\`\`\``
    }
    case 'image': {
      const src = sanitizeSafeImageSrc(typeof node.attrs?.src === 'string' ? node.attrs.src : null)
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : 'Imagem'
      return src ? `![${alt}](${src})` : ''
    }
    default:
      return (node.content ?? []).map((c) => renderBlockMarkdown(c, indent)).join('\n')
  }
}

export function docToMarkdown(doc: NotebookContentDoc | null | undefined, title?: string): string {
  const parts: string[] = []
  if (title?.trim()) parts.push(`# ${title.trim()}`)
  for (const block of doc?.content ?? []) {
    const rendered = renderBlockMarkdown(block)
    if (rendered !== '') parts.push(rendered)
  }
  return parts.join('\n\n')
}

// ---------------------------------------------------------------------
// 2. Exportação para HTML Sanitizado (zero scripts / handlers)
// ---------------------------------------------------------------------

function renderInlineHtml(nodes: NotebookContentNode[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<br />'
      let html = typeof n.text === 'string' ? escapeHtml(n.text) : renderInlineHtml(n.content)
      if (!Array.isArray(n.marks)) return html
      for (const m of n.marks) {
        if (m.type === 'code') html = `<code>${html}</code>`
        else if (m.type === 'bold') html = `<strong>${html}</strong>`
        else if (m.type === 'italic') html = `<em>${html}</em>`
        else if (m.type === 'underline') html = `<u>${html}</u>`
        else if (m.type === 'strike') html = `<s>${html}</s>`
        else if (m.type === 'superscript') html = `<sup>${html}</sup>`
        else if (m.type === 'subscript') html = `<sub>${html}</sub>`
        else if (m.type === 'link') {
          const href = sanitizeSafeUrl(typeof m.attrs?.href === 'string' ? m.attrs.href : null)
          if (href) html = `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${html}</a>`
        }
      }
      return html
    })
    .join('')
}

function renderBlockHtml(node: NotebookContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInlineHtml(node.content)}</p>`
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1))
      return `<h${level}>${renderInlineHtml(node.content)}</h${level}>`
    }
    case 'horizontalRule':
      return '<hr />'
    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(renderBlockHtml).join('')}</blockquote>`
    case 'bulletList':
      return `<ul>${(node.content ?? []).map((i) => `<li>${(i.content ?? []).map(renderBlockHtml).join('')}</li>`).join('')}</ul>`
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((i) => `<li>${(i.content ?? []).map(renderBlockHtml).join('')}</li>`).join('')}</ol>`
    case 'taskList':
      return `<ul class="checklist">${(node.content ?? [])
        .map((i) => `<li>${i.attrs?.checked ? '☑' : '☐'} ${(i.content ?? []).map(renderBlockHtml).join('')}</li>`)
        .join('')}</ul>`
    case 'codeBlock': {
      const lang = escapeHtml(String(node.attrs?.language ?? 'text'))
      const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? `<div class="code-title">${escapeHtml(node.attrs.title.trim())} (${lang})</div>` : ''
      const code = escapeHtml((node.content ?? []).map((c) => c.text ?? '').join(''))
      return `<div class="code-wrap">${title}<pre><code>${code}</code></pre></div>`
    }
    case 'table':
      return `<table><tbody>${(node.content ?? [])
        .map(
          (row) =>
            `<tr>${(row.content ?? [])
              .map((cell) => {
                const tag = cell.type === 'tableHeader' ? 'th' : 'td'
                return `<${tag}>${(cell.content ?? []).map(renderBlockHtml).join('')}</${tag}>`
              })
              .join('')}</tr>`,
        )
        .join('')}</tbody></table>`
    case 'callout': {
      const title = escapeHtml(String(node.attrs?.title ?? 'Nota'))
      return `<div class="callout"><strong>${title}</strong>${(node.content ?? []).map(renderBlockHtml).join('')}</div>`
    }
    case 'qaBlock': {
      const q = escapeHtml(String(node.attrs?.question ?? 'Pergunta'))
      return `<details class="qa"><summary><strong>P:</strong> ${q}</summary><div class="qa-a">${(node.content ?? []).map(renderBlockHtml).join('')}</div></details>`
    }
    case 'toggleBlock': {
      const s = escapeHtml(String(node.attrs?.summary ?? 'Detalhes'))
      return `<details class="qa"><summary>${s}</summary><div class="qa-a">${(node.content ?? []).map(renderBlockHtml).join('')}</div></details>`
    }
    case 'glossaryBlock': {
      const title = escapeHtml(String(node.attrs?.title ?? 'Glossário'))
      const entries = Array.isArray(node.attrs?.entries) ? (node.attrs.entries as Array<{ term?: string; definition?: string }>) : []
      return `<div class="callout"><strong>${title}</strong><dl>${entries
        .map((e) => `<dt>${escapeHtml(e.term ?? '')}</dt><dd>${escapeHtml(e.definition ?? '')}</dd>`)
        .join('')}</dl></div>`
    }
    case 'mathBlock': {
      const caption = typeof node.attrs?.caption === 'string' && node.attrs.caption.trim() ? `<div class="code-title">${escapeHtml(node.attrs.caption.trim())}</div>` : ''
      const formula = escapeHtml(String(node.attrs?.formula ?? ''))
      return `<div class="code-wrap">${caption}<pre><code>${formula}</code></pre></div>`
    }
    case 'mermaidBlock': {
      const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? `<div class="code-title">${escapeHtml(node.attrs.title.trim())} (Mermaid)</div>` : ''
      const code = escapeHtml(String(node.attrs?.code ?? ''))
      return `<div class="code-wrap">${title}<pre><code>${code}</code></pre></div>`
    }
    case 'image': {
      const src = sanitizeSafeImageSrc(typeof node.attrs?.src === 'string' ? node.attrs.src : null)
      const alt = escapeHtml(String(node.attrs?.alt ?? 'Imagem'))
      return src ? `<figure><img src="${escapeHtml(src)}" alt="${alt}" /></figure>` : ''
    }
    default:
      return (node.content ?? []).map(renderBlockHtml).join('')
  }
}

export function docToSanitizedHtml(doc: NotebookContentDoc | null | undefined, title: string, subtitle?: string): string {
  const body = (doc?.content ?? []).map(renderBlockHtml).join('\n')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #171717; background: #ffffff; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.65; }
  header { border-bottom: 2px solid #171717; padding-bottom: 16px; margin-bottom: 28px; }
  header h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
  header p { margin: 6px 0 0; color: #525252; font-size: 13px; }
  h2 { margin-top: 28px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  a { color: #B91C1C; }
  blockquote { border-left: 3px solid #B91C1C; margin: 16px 0; padding: 6px 16px; color: #404040; background: #f7f7f7; }
  pre { background: #171717; color: #f5f5f5; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
  .code-wrap { margin: 16px 0; }
  .code-title { font-size: 12px; font-weight: 600; color: #525252; margin-bottom: 4px; }
  .callout, .qa { border: 1px solid #e5e5e5; background: #f7f7f7; border-radius: 10px; padding: 12px 16px; margin: 14px 0; }
  .qa-a { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e5e5; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid #e5e5e5; padding: 8px 10px; text-align: left; }
  th { background: #f7f7f7; }
  img { max-width: 100%; border-radius: 8px; border: 1px solid #e5e5e5; }
  .checklist { list-style: none; padding-left: 4px; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
  </header>
  <main>${body}</main>
</body>
</html>`
}

// ---------------------------------------------------------------------
// 3. Exportação para PDF Profissional (via pdf-lib)
// ---------------------------------------------------------------------

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const out: string[] = []
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) {
      out.push('')
      continue
    }
    const words = rawLine.split(/\s+/)
    let line = ''
    for (const w of words) {
      if (!line) {
        line = w
      } else if (line.length + 1 + w.length <= maxChars) {
        line += ` ${w}`
      } else {
        out.push(line)
        line = w
      }
    }
    if (line) out.push(line)
  }
  return out
}

export async function exportPageAsPdfBytes(title: string, doc: NotebookContentDoc | null | undefined, subtitle?: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdf.embedFont(StandardFonts.Courier)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const margin = 48
  const ink = rgb(0.09, 0.09, 0.09)
  const muted = rgb(0.35, 0.35, 0.35)
  const accent = rgb(0.725, 0.11, 0.11) // #B91C1C
  const lineColor = rgb(0.88, 0.88, 0.88)

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 20) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // Cabeçalho editorial
  for (const line of wrapTextLines(toWinAnsiSafe(title), 46)) {
    page.drawText(line, { x: margin, y, size: 18, font: fontBold, color: ink })
    y -= 24
  }
  if (subtitle) {
    page.drawText(toWinAnsiSafe(subtitle).slice(0, 95), { x: margin, y, size: 9.5, font: fontRegular, color: muted })
    y -= 16
  }
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1.5, color: accent })
  y -= 20

  const drawParagraph = (text: string, opts?: { bold?: boolean; mono?: boolean; size?: number; indent?: number; color?: typeof ink }) => {
    const size = opts?.size ?? 10.5
    const font = opts?.mono ? fontMono : opts?.bold ? fontBold : fontRegular
    const indent = opts?.indent ?? 0
    const maxChars = Math.max(30, Math.floor((pageWidth - margin * 2 - indent) / (size * (opts?.mono ? 0.62 : 0.52))))
    for (const line of wrapTextLines(toWinAnsiSafe(text), maxChars)) {
      ensureSpace(size + 6)
      if (line) page.drawText(line, { x: margin + indent, y, size, font, color: opts?.color ?? ink })
      y -= size + 5
    }
  }

  for (const block of doc?.content ?? []) {
    if (block.type === 'heading') {
      const lvl = Math.max(1, Math.min(6, Number(block.attrs?.level) || 2))
      y -= 6
      drawParagraph(extractDocSummary({ type: 'doc', content: [block] }).text, { bold: true, size: lvl === 1 ? 14 : lvl === 2 ? 12.5 : 11 })
      y -= 2
    } else if (block.type === 'codeBlock' || block.type === 'mathBlock' || block.type === 'mermaidBlock') {
      const header =
        block.type === 'codeBlock'
          ? `[${String(block.attrs?.language ?? 'codigo').toUpperCase()}] ${String(block.attrs?.title ?? '')}`.trim()
          : block.type === 'mathBlock'
            ? `[FORMULA] ${String(block.attrs?.caption ?? '')}`.trim()
            : `[DIAGRAMA MERMAID] ${String(block.attrs?.title ?? '')}`.trim()
      const body =
        block.type === 'codeBlock'
          ? (block.content ?? []).map((c) => c.text ?? '').join('')
          : block.type === 'mathBlock'
            ? String(block.attrs?.formula ?? '')
            : String(block.attrs?.code ?? '')
      if (header) drawParagraph(header, { bold: true, size: 9.5, color: accent })
      drawParagraph(body, { mono: true, size: 9, indent: 8 })
      y -= 6
    } else if (block.type === 'qaBlock') {
      drawParagraph(`P: ${String(block.attrs?.question ?? '')}`, { bold: true, size: 10.5, color: accent })
      drawParagraph(`R: ${extractDocSummary({ type: 'doc', content: block.content ?? [] }).text}`, { indent: 8 })
      y -= 6
    } else if (block.type === 'horizontalRule') {
      ensureSpace(16)
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.75, color: lineColor })
      y -= 14
    } else {
      const txt = extractDocSummary({ type: 'doc', content: [block] }).text
      if (txt.trim()) {
        drawParagraph(txt)
        y -= 4
      }
    }
  }

  // Numeração de páginas
  const pages = pdf.getPages()
  pages.forEach((p, idx) => {
    const footer = `VLM Control 2.0 · Meus Cadernos — Pagina ${idx + 1} de ${pages.length}`
    p.drawText(footer, { x: margin, y: 24, size: 8, font: fontRegular, color: muted })
  })

  return pdf.save()
}

// ---------------------------------------------------------------------
// 4. Exportação de Caderno (JSON estruturado e ZIP Markdown + JSON)
// ---------------------------------------------------------------------

export interface NotebookExportBundle {
  format: 'vlm-knowledge-notebook'
  schema_version: 1
  exported_at: string
  notebook: Notebook
  nodes: NotebookNode[]
  contents: NotebookPageContent[]
  tags: NotebookTag[]
  tag_links: NotebookTagLink[]
  page_links: NotebookPageLink[]
}

export function buildNotebookJsonBundle(input: Omit<NotebookExportBundle, 'format' | 'schema_version' | 'exported_at'>): NotebookExportBundle {
  return {
    format: 'vlm-knowledge-notebook',
    schema_version: 1,
    exported_at: new Date().toISOString(),
    ...input,
  }
}

export async function exportNotebookAsZipBlob(bundle: NotebookExportBundle): Promise<Blob> {
  const zip = new JSZip()
  zip.file('notebook.json', JSON.stringify(bundle, null, 2))

  const nodesById = new Map(bundle.nodes.map((n) => [n.id, n]))
  const contentByNodeId = new Map(bundle.contents.map((c) => [c.node_id, c]))

  const pathForNode = (node: NotebookNode): string[] => {
    const parts: string[] = []
    const seen = new Set<string>()
    let cur: NotebookNode | undefined = node
    while (cur && !seen.has(cur.id) && parts.length < 30) {
      seen.add(cur.id)
      parts.unshift(slugifyFilename(cur.title, cur.node_type))
      cur = cur.parent_id ? nodesById.get(cur.parent_id) : undefined
    }
    return parts
  }

  const indexLines = [`# ${bundle.notebook.title}`, '']
  if (bundle.notebook.description) indexLines.push(bundle.notebook.description, '')
  indexLines.push('## Páginas exportadas', '')

  const usedPaths = new Set<string>()
  for (const node of bundle.nodes) {
    if (node.node_type !== 'page') continue
    const segments = pathForNode(node)
    let relPath = `${segments.join('/')}.md`
    let suffix = 2
    while (usedPaths.has(relPath)) {
      relPath = `${segments.join('/')}-${suffix++}.md`
    }
    usedPaths.add(relPath)
    const content = contentByNodeId.get(node.id)
    zip.file(relPath, docToMarkdown(content?.content_json, node.title))
    indexLines.push(`- [${node.title}](./${relPath})`)
  }

  zip.file('README.md', indexLines.join('\n'))
  return zip.generateAsync({ type: 'blob' })
}

// ---------------------------------------------------------------------
// 5. Importação com Prévia (Markdown, JSON VLM, ZIP Notion/Obsidian)
// ---------------------------------------------------------------------

export interface NotebookImportNodeItem {
  tempId: string
  parentTempId: string | null
  nodeType: 'section' | 'page'
  title: string
  doc?: NotebookContentDoc
}

export interface NotebookImportPlan {
  sourceLabel: string
  suggestedNotebookTitle: string
  description: string | null
  items: NotebookImportNodeItem[]
  sectionsCount: number
  pagesCount: number
  warnings: string[]
}

function stripFrontmatter(md: string): { titleFromFrontmatter?: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md)
  if (!m) return { body: md }
  const titleMatch = /^title:\s*["']?(.+?)["']?\s*$/m.exec(m[1])
  return {
    titleFromFrontmatter: titleMatch?.[1]?.trim(),
    body: md.slice(m[0].length),
  }
}

/** Normaliza wiki-links do Obsidian `[[Nota|Alias]]` para texto/link limpo ao importar Markdown. */
function normalizeObsidianSyntax(md: string): string {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => `**${(alias ?? target).trim()}**`)
}

function cleanImportedTitle(rawFilename: string): string {
  // Remove sufixos hexadecimais de 32 chars que o Notion adiciona nos nomes de arquivos/pastas
  const withoutExt = rawFilename.replace(/\.md$/i, '')
  return withoutExt.replace(/\s+[0-9a-f]{32}$/i, '').trim() || 'Página importada'
}

export async function planNotebookImportFromFile(file: File): Promise<NotebookImportPlan> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Arquivo excede o limite de 25 MB para importação.')
  }
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.json')) {
    const parsed = JSON.parse(await file.text()) as Partial<NotebookExportBundle>
    if (parsed.format !== 'vlm-knowledge-notebook' || !parsed.notebook || !Array.isArray(parsed.nodes)) {
      throw new Error('JSON incompatível. Use um arquivo exportado pelo Meus Cadernos (ou importe backups globais em Configurações).')
    }
    const contentsByNode = new Map((parsed.contents ?? []).map((c) => [c.node_id, c.content_json]))
    const items: NotebookImportNodeItem[] = parsed.nodes
      .filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string')
      .slice(0, 1000)
      .map((n) => ({
        tempId: n.id,
        parentTempId: n.parent_id ?? null,
        nodeType: n.node_type === 'section' ? 'section' : 'page',
        title: n.title.trim().slice(0, 300) || 'Sem título',
        doc: n.node_type === 'page' ? ensureBlockIds(contentsByNode.get(n.id) ?? { type: 'doc', content: [] }) : undefined,
      }))
    return {
      sourceLabel: file.name,
      suggestedNotebookTitle: parsed.notebook.title?.trim().slice(0, 200) || cleanImportedTitle(file.name),
      description: parsed.notebook.description ?? null,
      items,
      sectionsCount: items.filter((i) => i.nodeType === 'section').length,
      pagesCount: items.filter((i) => i.nodeType === 'page').length,
      warnings: [],
    }
  }

  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
    const raw = await file.text()
    const { titleFromFrontmatter, body } = stripFrontmatter(raw)
    const doc = ensureBlockIds(markdownToDoc(normalizeObsidianSyntax(body)))
    const title = titleFromFrontmatter || cleanImportedTitle(file.name)
    return {
      sourceLabel: file.name,
      suggestedNotebookTitle: title,
      description: null,
      items: [{ tempId: 'p-1', parentTempId: null, nodeType: 'page', title, doc }],
      sectionsCount: 0,
      pagesCount: 1,
      warnings: [],
    }
  }

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)
    const warnings: string[] = []
    // Se for um ZIP exportado pelo próprio VLM Knowledge, aproveita o `notebook.json` estruturado!
    const vlmJsonEntry = zip.file('notebook.json')
    if (vlmJsonEntry) {
      const jsonText = await vlmJsonEntry.async('text')
      const fakeFile = new File([jsonText], `${file.name.replace(/\.zip$/i, '')}.json`, { type: 'application/json' })
      return planNotebookImportFromFile(fakeFile)
    }

    const items: NotebookImportNodeItem[] = []
    const folderIds = new Map<string, string>()
    let ignoredCount = 0

    const ensureFolder = (folderParts: string[]): string | null => {
      if (folderParts.length === 0) return null
      let parentId: string | null = null
      let acc = ''
      for (const seg of folderParts) {
        acc = acc ? `${acc}/${seg}` : seg
        let existing = folderIds.get(acc)
        if (!existing) {
          existing = `dir:${acc}`
          folderIds.set(acc, existing)
          items.push({
            tempId: existing,
            parentTempId: parentId,
            nodeType: 'section',
            title: cleanImportedTitle(seg),
          })
        }
        parentId = existing
      }
      return parentId
    }

    const entries = Object.values(zip.files).filter((e) => !e.dir)
    for (const entry of entries.slice(0, 600)) {
      const normPath = entry.name.replace(/\\/g, '/').replace(/^\/+/, '')
      if (normPath.startsWith('__MACOSX/') || normPath.split('/').some((p) => p.startsWith('.'))) continue
      if (!/\.md$/i.test(normPath)) {
        ignoredCount++
        continue
      }
      const parts = normPath.split('/').filter(Boolean)
      const filename = parts.pop()!
      const parentTempId = ensureFolder(parts)
      const raw = await entry.async('text')
      const { titleFromFrontmatter, body } = stripFrontmatter(raw)
      const title = titleFromFrontmatter || cleanImportedTitle(filename)
      items.push({
        tempId: `file:${normPath}`,
        parentTempId,
        nodeType: 'page',
        title,
        doc: ensureBlockIds(markdownToDoc(normalizeObsidianSyntax(body))),
      })
    }
    if (ignoredCount > 0) {
      warnings.push(`${ignoredCount} arquivo(s) não-Markdown (imagens externas, anexos ou scripts) foram ignorados por segurança.`)
    }
    if (entries.length > 600) {
      warnings.push('O arquivo ZIP possui mais de 600 arquivos; apenas os primeiros 600 foram analisados.')
    }
    return {
      sourceLabel: file.name,
      suggestedNotebookTitle: cleanImportedTitle(file.name.replace(/\.zip$/i, '')),
      description: `Importado de ${file.name}`,
      items,
      sectionsCount: items.filter((i) => i.nodeType === 'section').length,
      pagesCount: items.filter((i) => i.nodeType === 'page').length,
      warnings,
    }
  }

  throw new Error('Formato não suportado. Use arquivos .md, .json (Meus Cadernos) ou .zip (Notion / Obsidian / Meus Cadernos).')
}

/** Executa a importação confirmada pelo usuário criando sempre IDs novos (sem sobrescrever nada). */
export async function executeNotebookImport(
  backend: DataBackend,
  plan: NotebookImportPlan,
  options: { targetNotebookId?: string | null; newNotebookTitle?: string },
): Promise<{ notebookId: string; createdCount: number }> {
  let notebookId = options.targetNotebookId ?? null
  if (!notebookId) {
    const nb = await createNotebook(backend, {
      title: options.newNotebookTitle?.trim() || plan.suggestedNotebookTitle || 'Caderno importado',
      description: plan.description,
    })
    notebookId = nb.id
  }

  // Ordena pais antes de filhos
  const byTempId = new Map(plan.items.map((i) => [i.tempId, i]))
  const depthOf = (item: NotebookImportNodeItem) => {
    let d = 0
    let cur: NotebookImportNodeItem | undefined = item
    const seen = new Set<string>()
    while (cur?.parentTempId && byTempId.has(cur.parentTempId) && !seen.has(cur.parentTempId) && d < 60) {
      seen.add(cur.parentTempId)
      cur = byTempId.get(cur.parentTempId)
      d++
    }
    return d
  }
  const ordered = [...plan.items].sort((a, b) => depthOf(a) - depthOf(b))
  const idMap = new Map<string, string>()
  let createdCount = 0

  for (const item of ordered) {
    const parentId = item.parentTempId ? (idMap.get(item.parentTempId) ?? null) : null
    const created = await createNode(backend, {
      notebook_id: notebookId,
      parent_id: parentId,
      node_type: item.nodeType,
      title: item.title,
      initialDoc: item.doc,
    })
    idMap.set(item.tempId, created.id)
    createdCount++
  }

  return { notebookId, createdCount }
}
