import type { NotebookContentDoc, NotebookContentMark, NotebookContentNode } from '@/types/db'
import { ensureBlockIds } from './notebooks'

export interface DocHeading {
  blockId: string
  level: number
  text: string
}

/** Valida URLs permitidas em links e imagens (bloqueia javascript:, data:text/html, vbscript:, etc.). */
export function sanitizeSafeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed
  if (/^\/cadernos\/[a-zA-Z0-9/_-]+$/.test(trimmed)) return trimmed
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return trimmed
  return null
}

/** Valida URL de imagem segura (http(s) ou data:image/{png,jpeg,webp,gif};base64). */
export function sanitizeSafeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed
  if (/^blob:/i.test(trimmed)) return trimmed
  return null
}

/** Extrai o sumário clicável a partir de todos os títulos H1–H6 do documento. */
export function extractHeadings(doc: NotebookContentDoc | null | undefined): DocHeading[] {
  if (!doc || !Array.isArray(doc.content)) return []
  const out: DocHeading[] = []
  const extractText = (node: NotebookContentNode): string => {
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.content)) return node.content.map(extractText).join('')
    return ''
  }
  const walk = (nodes: NotebookContentNode[]) => {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const text = extractText(node).trim()
        const level = Number(node.attrs?.level ?? 1)
        const blockId = typeof node.attrs?.blockId === 'string' ? node.attrs.blockId : ''
        if (text && blockId) out.push({ blockId, level: Math.min(6, Math.max(1, level)), text })
      } else if (Array.isArray(node.content)) {
        walk(node.content)
      }
    }
  }
  walk(doc.content)
  return out
}

function parseInlineMarkdown(line: string): NotebookContentNode[] {
  const nodes: NotebookContentNode[] = []
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: line.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] })
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'strike' }] })
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] })
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] })
    } else if (token.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (m) {
        const safe = sanitizeSafeUrl(m[2])
        const marks: NotebookContentMark[] = safe ? [{ type: 'link', attrs: { href: safe, target: '_blank', rel: 'noopener noreferrer nofollow' } }] : []
        nodes.push({ type: 'text', text: m[1], ...(marks.length ? { marks } : {}) })
      } else {
        nodes.push({ type: 'text', text: token })
      }
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIndex) })
  }
  return nodes.length ? nodes : [{ type: 'text', text: line }]
}

/**
 * Converte Markdown (incluindo títulos, listas, checklists, citações, divisores, blocos de código e tabelas)
 * para JSON estruturado ProseMirror/Tiptap, sem importar HTML bruto nem scripts executáveis.
 */
export function markdownToDoc(markdown: string): NotebookContentDoc {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const content: NotebookContentNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Bloco de código cercado ```lang
    const fence = /^```([a-zA-Z0-9_+-]*)\s*$/.exec(trimmed)
    if (fence) {
      const lang = fence[1].toLowerCase() || 'plaintext'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      const codeText = codeLines.join('\n')
      content.push({
        type: 'codeBlock',
        attrs: { language: lang, title: '', description: '', showLineNumbers: true, wrapLines: false, blockId: crypto.randomUUID() },
        content: codeText ? [{ type: 'text', text: codeText }] : [],
      })
      continue
    }

    // Divisor horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      content.push({ type: 'horizontalRule', attrs: { blockId: crypto.randomUUID() } })
      i++
      continue
    }

    // Títulos H1–H6
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length, blockId: crypto.randomUUID() },
        content: parseInlineMarkdown(heading[2].trim()),
      })
      i++
      continue
    }

    // Checklist: - [ ] ou - [x]
    if (/^[-*+]\s+\[([ xX])\]\s+/.test(trimmed)) {
      const items: NotebookContentNode[] = []
      while (i < lines.length && /^[-*+]\s+\[([ xX])\]\s+/.test(lines[i].trim())) {
        const m = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i].trim())!
        items.push({
          type: 'taskItem',
          attrs: { checked: m[1].toLowerCase() === 'x' },
          content: [{ type: 'paragraph', content: parseInlineMarkdown(m[2]) }],
        })
        i++
      }
      content.push({ type: 'taskList', attrs: { blockId: crypto.randomUUID() }, content: items })
      continue
    }

    // Lista com marcadores
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: NotebookContentNode[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim()) && !/^[-*+]\s+\[([ xX])\]\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^[-*+]\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInlineMarkdown(text) }] })
        i++
      }
      content.push({ type: 'bulletList', attrs: { blockId: crypto.randomUUID() }, content: items })
      continue
    }

    // Lista numerada
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: NotebookContentNode[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\.\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInlineMarkdown(text) }] })
        i++
      }
      content.push({ type: 'orderedList', attrs: { blockId: crypto.randomUUID() }, content: items })
      continue
    }

    // Citação (blockquote)
    if (trimmed.startsWith('>')) {
      const quoteLines: NotebookContentNode[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const text = lines[i].trim().replace(/^>\s?/, '')
        quoteLines.push({ type: 'paragraph', content: text ? parseInlineMarkdown(text) : [] })
        i++
      }
      content.push({ type: 'blockquote', attrs: { blockId: crypto.randomUUID() }, content: quoteLines })
      continue
    }

    // Tabela GFM simples
    if (trimmed.includes('|') && i + 1 < lines.length && /^\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1].trim())) {
      const splitRow = (line: string) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim())
      const headerCells = splitRow(trimmed)
      i += 2
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].trim().includes('|')) {
        bodyRows.push(splitRow(lines[i]))
        i++
      }
      const makeRow = (cells: string[], isHeader: boolean): NotebookContentNode => ({
        type: 'tableRow',
        content: cells.map((cell) => ({
          type: isHeader ? 'tableHeader' : 'tableCell',
          content: [{ type: 'paragraph', content: cell ? parseInlineMarkdown(cell) : [] }],
        })),
      })
      content.push({
        type: 'table',
        attrs: { blockId: crypto.randomUUID() },
        content: [makeRow(headerCells, true), ...bodyRows.map((r) => makeRow(r, false))],
      })
      continue
    }

    // Parágrafo padrão
    content.push({
      type: 'paragraph',
      attrs: { blockId: crypto.randomUUID() },
      content: parseInlineMarkdown(raw),
    })
    i++
  }

  return ensureBlockIds({ type: 'doc', content: content.length ? content : [{ type: 'paragraph', attrs: { blockId: crypto.randomUUID() } }] })
}
