import type { Topic } from '@/types/db'

export interface TopicNode extends Topic {
  children: TopicNode[]
  depth: number
}

/** Monta a árvore de tópicos (qualquer profundidade), ordenada por sort_order. */
export function buildTree(topics: Topic[]): TopicNode[] {
  const byId = new Map<string, TopicNode>()
  for (const t of topics) byId.set(t.id, { ...t, children: [], depth: 0 })
  const roots: TopicNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: TopicNode[], depth: number) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
    for (const n of list) {
      n.depth = depth
      sort(n.children, depth + 1)
    }
  }
  sort(roots, 0)
  return roots
}

export function flattenTree(nodes: TopicNode[], collapsed?: Set<string>): TopicNode[] {
  const out: TopicNode[] = []
  const walk = (list: TopicNode[]) => {
    for (const n of list) {
      out.push(n)
      if (!collapsed?.has(n.id)) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export function descendantIds(topics: Pick<Topic, 'id' | 'parent_id'>[], id: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const t of topics) {
    if (!t.parent_id) continue
    const list = children.get(t.parent_id) ?? []
    list.push(t.id)
    children.set(t.parent_id, list)
  }
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const c of children.get(cur) ?? []) {
      if (!out.has(c)) {
        out.add(c)
        stack.push(c)
      }
    }
  }
  return out
}

/** "Atos administrativos › Requisitos" */
export function topicPath(topicsById: Map<string, Pick<Topic, 'name' | 'parent_id'>>, id: string | null | undefined): string {
  if (!id) return ''
  const parts: string[] = []
  let cur = topicsById.get(id)
  let guard = 0
  while (cur && guard++ < 50) {
    parts.unshift(cur.name)
    cur = cur.parent_id ? topicsById.get(cur.parent_id) : undefined
  }
  return parts.join(' › ')
}

/**
 * Progresso ponderado: soma dos pesos dos tópicos-folha concluídos ÷ soma dos
 * pesos de todas as folhas. Tópicos com subtópicos e pastas são agregadores.
 */
export function weightedProgress(topics: Array<Pick<Topic, 'id' | 'parent_id' | 'status' | 'weight'> & { kind?: Topic['kind'] }>): { percent: number; done: number; total: number } {
  const parents = new Set(topics.map((t) => t.parent_id).filter(Boolean) as string[])
  // Pastas dentro da matéria só organizam: nunca contam como conteúdo.
  const leaves = topics.filter((t) => !parents.has(t.id) && t.kind !== 'folder')
  const total = leaves.reduce((a, t) => a + Number(t.weight || 1), 0)
  const doneW = leaves.filter((t) => t.status === 'completed').reduce((a, t) => a + Number(t.weight || 1), 0)
  return { percent: total > 0 ? (doneW / total) * 100 : 0, done: leaves.filter((t) => t.status === 'completed').length, total: leaves.length }
}
