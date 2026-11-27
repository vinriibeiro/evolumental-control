import type {
  Notebook,
  NotebookContentDoc,
  NotebookContentNode,
  NotebookNode,
  NotebookPageLink,
  NotebookTagLink,
} from '@/types/db'

export interface ExtractedInternalLink {
  targetNotebookId: string
  targetNodeId: string
  targetBlockId: string | null
  sourceBlockId: string | null
  linkText: string | null
}

const INTERNAL_HREF_RE = /^\/cadernos\/([0-9a-f-]{36})\/pagina\/([0-9a-f-]{36})(?:\?bloco=([a-zA-Z0-9_-]{1,80}))?$/i

export function buildInternalPageHref(notebookId: string, nodeId: string, blockId?: string | null): string {
  return `/cadernos/${notebookId}/pagina/${nodeId}${blockId ? `?bloco=${encodeURIComponent(blockId)}` : ''}`
}

export function parseInternalPageHref(href: string | null | undefined): { notebookId: string; nodeId: string; blockId: string | null } | null {
  if (!href) return null
  const m = INTERNAL_HREF_RE.exec(href.trim())
  if (!m) return null
  return { notebookId: m[1], nodeId: m[2], blockId: m[3] ?? null }
}

/**
 * Extrai deterministicamente todos os links internos `/cadernos/:nb/pagina/:id(?bloco=...)`
 * presentes no JSON estruturado de uma página, associando cada link ao seu `sourceBlockId`.
 */
export function extractInternalLinksFromDoc(doc: NotebookContentDoc | null | undefined, sourceNodeId: string): ExtractedInternalLink[] {
  if (!doc || !Array.isArray(doc.content)) return []
  const out: ExtractedInternalLink[] = []
  const dedup = new Set<string>()

  const walk = (node: NotebookContentNode, topBlockId: string | null) => {
    const currentTop = topBlockId ?? (typeof node.attrs?.blockId === 'string' ? node.attrs.blockId : null)
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type !== 'link') continue
        const parsed = parseInternalPageHref(typeof mark.attrs?.href === 'string' ? mark.attrs.href : null)
        if (!parsed) continue
        // Respeita constraint SQL: source_node_id <> target_node_id OR target_block_id IS NOT NULL
        if (parsed.nodeId === sourceNodeId && !parsed.blockId) continue
        const key = `${parsed.nodeId}::${parsed.blockId ?? ''}::${currentTop ?? ''}`
        if (dedup.has(key)) continue
        dedup.add(key)
        out.push({
          targetNotebookId: parsed.notebookId,
          targetNodeId: parsed.nodeId,
          targetBlockId: parsed.blockId,
          sourceBlockId: currentTop,
          linkText: typeof node.text === 'string' && node.text.trim() ? node.text.trim().slice(0, 300) : null,
        })
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child, currentTop)
    }
  }

  for (const block of doc.content) walk(block, null)
  return out
}

export interface GraphNode {
  id: string
  kind: 'page' | 'notebook'
  label: string
  notebookId: string
  notebookTitle: string
  color: string
  subjectId: string | null
  x: number
  y: number
  degree: number
  inDegree: number
  outDegree: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Constrói um grafo de conhecimento determinístico (sem IA, sem posições aleatórias),
 * agrupando páginas em torno do seu caderno em layout circular estável.
 */
export function buildKnowledgeGraph(input: {
  mode: 'pages' | 'notebooks'
  notebooks: Notebook[]
  nodes: NotebookNode[]
  links: NotebookPageLink[]
  tagLinks?: NotebookTagLink[]
  filterNotebookId?: string | null
  filterSubjectId?: string | null
  filterTagId?: string | null
  focusNodeId?: string | null
}): KnowledgeGraphData {
  const activeNotebooks = input.notebooks.filter((n) => !n.deleted_at)
  const nbById = new Map(activeNotebooks.map((n) => [n.id, n]))
  const activePages = input.nodes.filter((n) => !n.deleted_at && nbById.has(n.notebook_id))
  const pageById = new Map(activePages.map((n) => [n.id, n]))

  // Filtragem por tag (se ativa)
  let allowedNodeIds: Set<string> | null = null
  let allowedNbIds: Set<string> | null = null
  if (input.filterTagId && input.tagLinks) {
    allowedNodeIds = new Set<string>()
    allowedNbIds = new Set<string>()
    for (const tl of input.tagLinks) {
      if (tl.tag_id !== input.filterTagId) continue
      if (tl.node_id) allowedNodeIds.add(tl.node_id)
      if (tl.notebook_id) allowedNbIds.add(tl.notebook_id)
    }
  }

  if (input.mode === 'notebooks') {
    const filteredNbs = activeNotebooks.filter((nb) => {
      if (input.filterNotebookId && nb.id !== input.filterNotebookId) return false
      if (input.filterSubjectId && nb.subject_id !== input.filterSubjectId) return false
      if (allowedNbIds && allowedNodeIds) {
        const hasTaggedPage = activePages.some((p) => p.notebook_id === nb.id && allowedNodeIds!.has(p.id))
        if (!allowedNbIds.has(nb.id) && !hasTaggedPage) return false
      }
      return true
    })

    const keptIds = new Set(filteredNbs.map((n) => n.id))
    const edgeMap = new Map<string, GraphEdge>()
    const inDeg = new Map<string, number>()
    const outDeg = new Map<string, number>()

    for (const l of input.links) {
      const s = pageById.get(l.source_node_id)
      const t = pageById.get(l.target_node_id)
      if (!s || !t || s.notebook_id === t.notebook_id) continue
      if (!keptIds.has(s.notebook_id) || !keptIds.has(t.notebook_id)) continue
      const key = `${s.notebook_id}->${t.notebook_id}`
      const cur = edgeMap.get(key)
      if (cur) cur.weight++
      else edgeMap.set(key, { id: key, source: s.notebook_id, target: t.notebook_id, weight: 1 })
      outDeg.set(s.notebook_id, (outDeg.get(s.notebook_id) ?? 0) + 1)
      inDeg.set(t.notebook_id, (inDeg.get(t.notebook_id) ?? 0) + 1)
    }

    const radius = Math.max(140, filteredNbs.length * 28)
    const graphNodes: GraphNode[] = filteredNbs.map((nb, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, filteredNbs.length) - Math.PI / 2
      const inD = inDeg.get(nb.id) ?? 0
      const outD = outDeg.get(nb.id) ?? 0
      return {
        id: nb.id,
        kind: 'notebook',
        label: nb.title,
        notebookId: nb.id,
        notebookTitle: nb.title,
        color: nb.color,
        subjectId: nb.subject_id,
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        degree: inD + outD,
        inDegree: inD,
        outDegree: outD,
      }
    })
    return { nodes: graphNodes, edges: [...edgeMap.values()] }
  }

  // Modo páginas
  let candidatePages = activePages.filter((p) => {
    if (p.node_type !== 'page') return false
    const nb = nbById.get(p.notebook_id)!
    if (input.filterNotebookId && p.notebook_id !== input.filterNotebookId) return false
    if (input.filterSubjectId && p.subject_id !== input.filterSubjectId && nb.subject_id !== input.filterSubjectId) return false
    if (allowedNodeIds && allowedNbIds && !allowedNodeIds.has(p.id) && !allowedNbIds.has(p.notebook_id)) return false
    return true
  })

  if (input.focusNodeId) {
    const neighborIds = new Set<string>([input.focusNodeId])
    for (const l of input.links) {
      if (l.source_node_id === input.focusNodeId) neighborIds.add(l.target_node_id)
      if (l.target_node_id === input.focusNodeId) neighborIds.add(l.source_node_id)
    }
    candidatePages = activePages.filter((p) => neighborIds.has(p.id))
  }

  const keptIds = new Set(candidatePages.map((p) => p.id))
  const edgeMap = new Map<string, GraphEdge>()
  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()

  for (const l of input.links) {
    if (!keptIds.has(l.source_node_id) || !keptIds.has(l.target_node_id) || l.source_node_id === l.target_node_id) continue
    const key = `${l.source_node_id}->${l.target_node_id}`
    const cur = edgeMap.get(key)
    if (cur) cur.weight++
    else edgeMap.set(key, { id: key, source: l.source_node_id, target: l.target_node_id, weight: 1 })
    outDeg.set(l.source_node_id, (outDeg.get(l.source_node_id) ?? 0) + 1)
    inDeg.set(l.target_node_id, (inDeg.get(l.target_node_id) ?? 0) + 1)
  }

  // Agrupa por caderno em clusters circulares determinísticos
  const byNotebook = new Map<string, NotebookNode[]>()
  for (const p of candidatePages) {
    const list = byNotebook.get(p.notebook_id) ?? []
    list.push(p)
    byNotebook.set(p.notebook_id, list)
  }

  const clusters = [...byNotebook.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const clusterOrbit = clusters.length <= 1 ? 0 : Math.max(190, clusters.length * 55)
  const graphNodes: GraphNode[] = []

  clusters.forEach(([nbId, pages], cIdx) => {
    const nb = nbById.get(nbId)!
    const clusterAngle = (2 * Math.PI * cIdx) / Math.max(1, clusters.length) - Math.PI / 2
    const cx = Math.cos(clusterAngle) * clusterOrbit
    const cy = Math.sin(clusterAngle) * clusterOrbit
    const localRadius = pages.length <= 1 ? 0 : Math.max(70, Math.min(180, pages.length * 20))

    pages
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      .forEach((p, pIdx) => {
        const angle = (2 * Math.PI * pIdx) / Math.max(1, pages.length) - Math.PI / 2
        const inD = inDeg.get(p.id) ?? 0
        const outD = outDeg.get(p.id) ?? 0
        graphNodes.push({
          id: p.id,
          kind: 'page',
          label: p.title,
          notebookId: nb.id,
          notebookTitle: nb.title,
          color: nb.color,
          subjectId: p.subject_id ?? nb.subject_id,
          x: Math.round(cx + Math.cos(angle) * localRadius),
          y: Math.round(cy + Math.sin(angle) * localRadius),
          degree: inD + outD,
          inDegree: inD,
          outDegree: outD,
        })
      })
  })

  return { nodes: graphNodes, edges: [...edgeMap.values()] }
}

/**
 * Calcula páginas relacionadas deterministicamente a partir de vínculos diretos,
 * backlinks, tags em comum e mesma matéria/tópico (sem IA).
 */
export function findRelatedPages(input: {
  page: NotebookNode
  allNodes: NotebookNode[]
  links: NotebookPageLink[]
  tagLinks: NotebookTagLink[]
  limit?: number
}): Array<{ node: NotebookNode; reasons: string[] }> {
  const { page, allNodes, links, tagLinks, limit = 6 } = input
  const activePages = new Map(allNodes.filter((n) => !n.deleted_at && n.node_type === 'page' && n.id !== page.id).map((n) => [n.id, n]))
  const scores = new Map<string, { score: number; reasons: Set<string> }>()
  const bump = (id: string, points: number, reason: string) => {
    if (!activePages.has(id)) return
    const cur = scores.get(id) ?? { score: 0, reasons: new Set<string>() }
    cur.score += points
    cur.reasons.add(reason)
    scores.set(id, cur)
  }

  // Conexões diretas e 2º grau
  const directNeighbors = new Set<string>()
  for (const l of links) {
    if (l.source_node_id === page.id) {
      directNeighbors.add(l.target_node_id)
      bump(l.target_node_id, 5, 'Link direto')
    } else if (l.target_node_id === page.id) {
      directNeighbors.add(l.source_node_id)
      bump(l.source_node_id, 5, 'Backlink')
    }
  }
  for (const l of links) {
    if (directNeighbors.has(l.source_node_id) && l.target_node_id !== page.id) bump(l.target_node_id, 2, 'Conexão em comum')
    if (directNeighbors.has(l.target_node_id) && l.source_node_id !== page.id) bump(l.source_node_id, 2, 'Conexão em comum')
  }

  // Tags em comum
  const myTags = new Set(tagLinks.filter((tl) => tl.node_id === page.id).map((tl) => tl.tag_id))
  if (myTags.size > 0) {
    for (const tl of tagLinks) {
      if (tl.node_id && tl.node_id !== page.id && myTags.has(tl.tag_id)) {
        bump(tl.node_id, 3, 'Tag em comum')
      }
    }
  }

  // Mesmo tópico ou matéria
  if (page.topic_id) {
    for (const other of activePages.values()) {
      if (other.topic_id === page.topic_id) bump(other.id, 3, 'Mesmo tópico')
    }
  } else if (page.subject_id) {
    for (const other of activePages.values()) {
      if (other.subject_id === page.subject_id && other.notebook_id !== page.notebook_id) bump(other.id, 1, 'Mesma matéria')
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score || activePages.get(a[0])!.title.localeCompare(activePages.get(b[0])!.title, 'pt-BR'))
    .slice(0, limit)
    .map(([id, info]) => ({ node: activePages.get(id)!, reasons: [...info.reasons] }))
}
