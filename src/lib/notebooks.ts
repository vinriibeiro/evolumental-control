import type { NotebookContentDoc, NotebookContentNode, NotebookNode, NotebookPageStatus } from '@/types/db'

export const NOTEBOOK_COLORS = [
  '#171717',
  '#B91C1C',
  '#404040',
  '#525252',
  '#737373',
  '#7F1D1D',
  '#DC2626',
  '#262626',
] as const

export const NOTEBOOK_ICONS = [
  { id: 'book-open', label: 'Livro aberto' },
  { id: 'notebook', label: 'Caderno' },
  { id: 'database', label: 'Banco de dados' },
  { id: 'code-2', label: 'Código' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'layers', label: 'Camadas' },
  { id: 'brain', label: 'Conhecimento' },
  { id: 'bar-chart-3', label: 'Análise' },
  { id: 'file-text', label: 'Documento' },
  { id: 'compass', label: 'Guia' },
  { id: 'flask-conical', label: 'Laboratório' },
  { id: 'scale', label: 'Direito' },
  { id: 'shield', label: 'Segurança' },
  { id: 'graduation-cap', label: 'Acadêmico' },
] as const

export const NOTEBOOK_COVERS = [
  { value: '', label: 'Sem capa' },
  { value: 'preset:minimal', label: 'Minimalista' },
  { value: 'preset:grid', label: 'Grade técnica' },
  { value: 'preset:dots', label: 'Pontilhado' },
  { value: 'preset:lines', label: 'Pautado' },
  { value: 'preset:crimson', label: 'Linha vermelha' },
  { value: 'preset:obsidian', label: 'Grafite escuro' },
] as const

export const PAGE_STATUS_LABELS: Record<NotebookPageStatus, string> = {
  draft: 'Rascunho',
  in_progress: 'Em elaboração',
  ready: 'Pronto para estudo',
  reviewing: 'Em revisão',
  reviewed: 'Revisado',
  archived: 'Arquivado',
}

export const PAGE_STATUS_OPTIONS = Object.keys(PAGE_STATUS_LABELS) as NotebookPageStatus[]

export const EMPTY_DOC: NotebookContentDoc = { type: 'doc', content: [] }

export interface NotebookTreeNode extends NotebookNode {
  children: NotebookTreeNode[]
  depth: number
}

/**
 * Monta a árvore hierárquica de um caderno em profundidade ilimitada.
 * Ordenação determinística: itens fixados primeiro, depois `position`, depois título (pt-BR).
 * Protege contra eventuais referências órfãs promovendo-as com segurança para a raiz na visualização.
 */
export function buildNotebookTree(nodes: NotebookNode[]): NotebookTreeNode[] {
  const byId = new Map<string, NotebookTreeNode>()
  for (const n of nodes) byId.set(n.id, { ...n, children: [], depth: 0 })

  const roots: NotebookTreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id && node.parent_id !== node.id ? byId.get(node.parent_id) : null
    if (parent && !isAncestorInMap(byId, node.id, parent.id)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortList = (list: NotebookTreeNode[], depth: number) => {
    list.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      if (a.position !== b.position) return a.position - b.position
      return a.title.localeCompare(b.title, 'pt-BR')
    })
    for (const item of list) {
      item.depth = depth
      sortList(item.children, depth + 1)
    }
  }
  sortList(roots, 0)
  return roots
}

function isAncestorInMap(byId: Map<string, Pick<NotebookNode, 'id' | 'parent_id'>>, possibleAncestorId: string, nodeId: string): boolean {
  let cur = byId.get(nodeId)
  let guard = 0
  while (cur && cur.parent_id && guard++ < 256) {
    if (cur.parent_id === possibleAncestorId) return true
    cur = byId.get(cur.parent_id)
  }
  return false
}

export function flattenNotebookTree(roots: NotebookTreeNode[], collapsed?: Set<string>): NotebookTreeNode[] {
  const out: NotebookTreeNode[] = []
  const walk = (list: NotebookTreeNode[]) => {
    for (const n of list) {
      out.push(n)
      if (!collapsed?.has(n.id)) walk(n.children)
    }
  }
  walk(roots)
  return out
}

export function notebookDescendantIds(nodes: Pick<NotebookNode, 'id' | 'parent_id'>[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>()
  for (const n of nodes) {
    if (!n.parent_id) continue
    const list = childrenByParent.get(n.parent_id) ?? []
    list.push(n.id)
    childrenByParent.set(n.parent_id, list)
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const childId of childrenByParent.get(cur) ?? []) {
      if (!out.has(childId) && childId !== rootId) {
        out.add(childId)
        stack.push(childId)
      }
    }
  }
  return out
}

/** Verifica se mover `nodeId` para `targetParentId` geraria ciclo hierárquico. */
export function wouldCreateCycle(nodes: Pick<NotebookNode, 'id' | 'parent_id'>[], nodeId: string, targetParentId: string | null): boolean {
  if (!targetParentId) return false
  if (targetParentId === nodeId) return true
  return notebookDescendantIds(nodes, nodeId).has(targetParentId)
}

/** Retorna o caminho completo da raiz até o nó atual (breadcrumb). */
export function nodeBreadcrumb<T extends Pick<NotebookNode, 'id' | 'title' | 'parent_id' | 'node_type'>>(
  nodesById: Map<string, T>,
  nodeId: string | null | undefined,
): T[] {
  if (!nodeId) return []
  const parts: T[] = []
  const seen = new Set<string>()
  let cur = nodesById.get(nodeId)
  while (cur && !seen.has(cur.id) && parts.length < 100) {
    seen.add(cur.id)
    parts.unshift(cur)
    cur = cur.parent_id ? nodesById.get(cur.parent_id) : undefined
  }
  return parts
}

/** Garante que cada bloco de topo possua um `blockId` estável sem alterar os existentes. */
export function ensureBlockIds(doc: NotebookContentDoc): NotebookContentDoc {
  const content = (doc.content ?? []).map((block) => {
    const existingId = typeof block.attrs?.blockId === 'string' && block.attrs.blockId.trim() ? block.attrs.blockId : null
    if (existingId) return block
    return {
      ...block,
      attrs: { ...(block.attrs ?? {}), blockId: crypto.randomUUID() },
    }
  })
  return { type: 'doc', content }
}

/** Converte texto simples em documento JSON estruturado compatível com ProseMirror/Tiptap. */
export function plainTextToDoc(text: string): NotebookContentDoc {
  const normalized = text.replace(/\r\n?/g, '\n')
  if (!normalized.trim()) return { type: 'doc', content: [] }
  const blocks = normalized.split('\n').map<NotebookContentNode>((line) => {
    const attrs = { blockId: crypto.randomUUID() }
    if (!line) return { type: 'paragraph', attrs }
    return {
      type: 'paragraph',
      attrs,
      content: [{ type: 'text', text: line }],
    }
  })
  return { type: 'doc', content: blocks }
}

/** Extrai texto pesquisável deterministicamente de um documento JSON estruturado. */
export function docToPlainText(doc: NotebookContentDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return ''
  const lines: string[] = []

  const extractInline = (node: NotebookContentNode): string => {
    if (typeof node.text === 'string') return node.text
    if (node.type === 'hardBreak') return '\n'
    if (Array.isArray(node.content)) return node.content.map(extractInline).join('')
    return ''
  }

  const walkBlock = (node: NotebookContentNode) => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
      lines.push(extractInline(node))
      return
    }
    if (node.type === 'callout') {
      if (typeof node.attrs?.title === 'string' && node.attrs.title.trim()) lines.push(node.attrs.title.trim())
    } else if (node.type === 'qaBlock') {
      if (typeof node.attrs?.question === 'string' && node.attrs.question.trim()) lines.push(node.attrs.question.trim())
    } else if (node.type === 'toggleBlock') {
      if (typeof node.attrs?.summary === 'string' && node.attrs.summary.trim()) lines.push(node.attrs.summary.trim())
    } else if (node.type === 'glossaryBlock') {
      if (typeof node.attrs?.title === 'string' && node.attrs.title.trim()) lines.push(node.attrs.title.trim())
      const entries = Array.isArray(node.attrs?.entries) ? (node.attrs.entries as Array<{ term?: string; definition?: string }>) : []
      for (const e of entries) {
        const line = [e.term, e.definition].filter(Boolean).join(': ').trim()
        if (line) lines.push(line)
      }
      return
    } else if (node.type === 'mathBlock') {
      if (typeof node.attrs?.caption === 'string' && node.attrs.caption.trim()) lines.push(node.attrs.caption.trim())
      if (typeof node.attrs?.formula === 'string' && node.attrs.formula.trim()) lines.push(node.attrs.formula.trim())
      return
    } else if (node.type === 'mermaidBlock') {
      if (typeof node.attrs?.title === 'string' && node.attrs.title.trim()) lines.push(node.attrs.title.trim())
      if (typeof node.attrs?.code === 'string' && node.attrs.code.trim()) lines.push(node.attrs.code.trim())
      return
    }
    if (Array.isArray(node.content)) {
      const hasBlockChildren = node.content.some((c) => c.type !== 'text' && c.type !== 'hardBreak')
      if (hasBlockChildren) {
        for (const child of node.content) walkBlock(child)
      } else {
        lines.push(extractInline(node))
      }
      return
    }
    if (typeof node.text === 'string') lines.push(node.text)
  }

  for (const node of doc.content) walkBlock(node)
  return lines.join('\n')
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

export function estimateReadingMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / 200))
}

export function extractDocSummary(doc: NotebookContentDoc | null | undefined) {
  const text = docToPlainText(doc)
  const wordCount = countWords(text)
  return {
    text,
    wordCount,
    readingMinutes: estimateReadingMinutes(wordCount),
  }
}

/** Métricas de revisão ativa extraídas deterministicamente dos blocos da página. */
export function extractActiveReviewMetrics(doc: NotebookContentDoc | null | undefined): {
  qaCount: number
  checklistTotal: number
  checklistDone: number
  errorBlocks: number
} {
  let qaCount = 0
  let checklistTotal = 0
  let checklistDone = 0
  let errorBlocks = 0
  const walk = (node: NotebookContentNode) => {
    if (node.type === 'qaBlock') qaCount++
    if (node.type === 'taskItem') {
      checklistTotal++
      if (node.attrs?.checked === true) checklistDone++
    }
    if (node.type === 'callout' && (node.attrs?.variant === 'error' || node.attrs?.variant === 'warning')) {
      errorBlocks++
    }
    if (Array.isArray(node.content)) for (const c of node.content) walk(c)
  }
  for (const b of doc?.content ?? []) walk(b)
  return { qaCount, checklistTotal, checklistDone, errorBlocks }
}

/** Extrai todas as imagens presentes em um documento de página (para reutilização em Oclusão de Imagem sem duplicar binários). */
export function extractDocImages(doc: NotebookContentDoc | null | undefined): Array<{ index: number; src: string; alt: string }> {
  const images: Array<{ index: number; src: string; alt: string }> = []
  const walk = (node: NotebookContentNode) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.trim()) {
      images.push({
        index: images.length,
        src: node.attrs.src.trim(),
        alt: typeof node.attrs.alt === 'string' && node.attrs.alt.trim() ? node.attrs.alt.trim() : `Imagem ${images.length + 1}`,
      })
    }
    if (Array.isArray(node.content)) for (const c of node.content) walk(c)
  }
  for (const b of doc?.content ?? []) walk(b)
  return images
}

/** Estilo CSS seguro para renderização de capas (presets locais ou cor sólida; evita CSS injection). */
export function coverStyle(cover: string | null | undefined, fallbackColor: string): Record<string, string> {
  if (!cover) return { background: fallbackColor }
  if (/^#[0-9A-Fa-f]{6}$/.test(cover)) return { background: cover }
  switch (cover) {
    case 'preset:minimal':
      return { background: 'var(--surface-2)' }
    case 'preset:grid':
      return {
        backgroundColor: 'var(--surface-2)',
        backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }
    case 'preset:dots':
      return {
        backgroundColor: 'var(--surface-2)',
        backgroundImage: 'radial-gradient(var(--border) 1.25px, transparent 1.25px)',
        backgroundSize: '14px 14px',
      }
    case 'preset:lines':
      return {
        backgroundColor: 'var(--surface-2)',
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 15px, var(--border) 15px, var(--border) 16px)',
      }
    case 'preset:crimson':
      return {
        backgroundColor: '#171717',
        backgroundImage: 'linear-gradient(135deg, #171717 0%, #171717 78%, #B91C1C 78%, #B91C1C 100%)',
      }
    case 'preset:obsidian':
      return { background: '#171717' }
    default:
      return { background: fallbackColor }
  }
}
