// Modelo do Explorador de Estudos: uma árvore única com áreas/pastas,
// matérias e tópicos (inclusive pastas dentro da matéria). Tudo aqui é puro
// (sem React nem backend) para ser testado isoladamente.
import type { StudyFolder, Subject, Topic } from '@/types/db'

export type NodeType = 'folder' | 'subject' | 'topic'
export type NodeKey = `${NodeType}:${string}`

export interface ExplorerNode {
  key: NodeKey
  type: NodeType
  id: string
  name: string
  parentKey: NodeKey | null
  children: ExplorerNode[]
  depth: number
  /** true para áreas, pastas e pastas de matéria. */
  container: boolean
  favorite: boolean
  archived: boolean
  color: string | null
  icon: string | null
  sortOrder: number
  folder?: StudyFolder
  subject?: Subject
  topic?: Topic
}

export interface ExplorerIndex {
  roots: ExplorerNode[]
  byKey: Map<NodeKey, ExplorerNode>
}

export const keyOf = (type: NodeType, id: string): NodeKey => `${type}:${id}`

export function parseKey(key: string): { type: NodeType; id: string } | null {
  const i = key.indexOf(':')
  const type = key.slice(0, i) as NodeType
  if (i < 0 || !['folder', 'subject', 'topic'].includes(type)) return null
  return { type, id: key.slice(i + 1) }
}

const byOrder = (a: ExplorerNode, b: ExplorerNode) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR')

/**
 * Monta a árvore. Dentro de uma pasta, subpastas vêm antes das matérias;
 * dentro de matérias e tópicos, a ordem é a definida pelo usuário.
 * Referências quebradas (pai inexistente) caem no nível acima, nunca somem.
 */
export function buildExplorer(folders: StudyFolder[], subjects: Subject[], topics: Topic[]): ExplorerIndex {
  const byKey = new Map<NodeKey, ExplorerNode>()
  const folderIds = new Set(folders.map((f) => f.id))
  const subjectIds = new Set(subjects.map((s) => s.id))
  const topicsById = new Map(topics.map((t) => [t.id, t]))

  for (const f of folders) {
    byKey.set(keyOf('folder', f.id), {
      key: keyOf('folder', f.id),
      type: 'folder',
      id: f.id,
      name: f.name,
      parentKey: f.parent_id && folderIds.has(f.parent_id) ? keyOf('folder', f.parent_id) : null,
      children: [],
      depth: 0,
      container: true,
      favorite: f.favorite,
      archived: Boolean(f.archived_at),
      color: f.color,
      icon: f.icon,
      sortOrder: f.sort_order,
      folder: f,
    })
  }
  for (const s of subjects) {
    byKey.set(keyOf('subject', s.id), {
      key: keyOf('subject', s.id),
      type: 'subject',
      id: s.id,
      name: s.name,
      parentKey: s.folder_id && folderIds.has(s.folder_id) ? keyOf('folder', s.folder_id) : null,
      children: [],
      depth: 0,
      container: true,
      favorite: Boolean(s.favorite),
      archived: s.status === 'archived',
      color: s.color,
      icon: s.icon,
      sortOrder: s.sort_order,
      subject: s,
    })
  }
  for (const t of topics) {
    if (!subjectIds.has(t.subject_id)) continue
    const parent = t.parent_id ? topicsById.get(t.parent_id) : undefined
    byKey.set(keyOf('topic', t.id), {
      key: keyOf('topic', t.id),
      type: 'topic',
      id: t.id,
      name: t.name,
      parentKey: parent && parent.subject_id === t.subject_id ? keyOf('topic', parent.id) : keyOf('subject', t.subject_id),
      children: [],
      depth: 0,
      container: t.kind === 'folder',
      favorite: Boolean(t.favorite),
      archived: false,
      color: null,
      icon: null,
      sortOrder: t.sort_order,
      topic: t,
    })
  }

  const roots: ExplorerNode[] = []
  for (const n of byKey.values()) {
    const parent = n.parentKey ? byKey.get(n.parentKey) : undefined
    if (parent) parent.children.push(n)
    else {
      n.parentKey = null
      roots.push(n)
    }
  }
  const rank = (n: ExplorerNode) => (n.type === 'folder' ? 0 : 1)
  const sort = (list: ExplorerNode[], depth: number, guard: Set<NodeKey>) => {
    list.sort((a, b) => rank(a) - rank(b) || byOrder(a, b))
    for (const n of list) {
      if (guard.has(n.key)) continue
      guard.add(n.key)
      n.depth = depth
      sort(n.children, depth + 1, guard)
    }
  }
  sort(roots, 0, new Set())
  return { roots, byKey }
}

/** Do nó até a raiz, na ordem raiz → nó. */
export function pathTo(index: ExplorerIndex, key: NodeKey | null | undefined): ExplorerNode[] {
  const out: ExplorerNode[] = []
  let cur = key ? index.byKey.get(key) : undefined
  for (let guard = 0; cur && guard < 1000; guard++) {
    out.unshift(cur)
    cur = cur.parentKey ? index.byKey.get(cur.parentKey) : undefined
  }
  return out
}

export function isDescendant(index: ExplorerIndex, ancestor: NodeKey, key: NodeKey): boolean {
  return pathTo(index, key).some((n) => n.key === ancestor && n.key !== key)
}

/** Lista plana visível (para renderização e navegação por teclado). */
export function flatten(nodes: ExplorerNode[], expanded: (key: NodeKey) => boolean, include?: Set<NodeKey>): ExplorerNode[] {
  const out: ExplorerNode[] = []
  const walk = (list: ExplorerNode[]) => {
    for (const n of list) {
      if (include && !include.has(n.key)) continue
      out.push(n)
      if (n.children.length && (include ? true : expanded(n.key))) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export interface TreeFilter {
  term?: string
  favoritesOnly?: boolean
  showArchived?: boolean
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Conjunto de chaves visíveis com o filtro: nós que casam + seus ancestrais
 * (para manter o contexto). Sem termo e sem "só favoritos", null = tudo
 * (exceto arquivados, se ocultos).
 */
export function filterKeys(index: ExplorerIndex, f: TreeFilter): Set<NodeKey> | null {
  const term = fold(f.term?.trim() ?? '')
  const hiddenArchived = (n: ExplorerNode) => !f.showArchived && pathTo(index, n.key).some((x) => x.archived)
  if (!term && !f.favoritesOnly) {
    if (f.showArchived) return null
    const keep = new Set<NodeKey>()
    for (const n of index.byKey.values()) if (!hiddenArchived(n)) keep.add(n.key)
    return keep
  }
  const keep = new Set<NodeKey>()
  for (const n of index.byKey.values()) {
    if (hiddenArchived(n)) continue
    if (term && !fold(n.name).includes(term)) continue
    if (f.favoritesOnly && !n.favorite) continue
    for (const p of pathTo(index, n.key)) keep.add(p.key)
    // Ao favoritar/encontrar uma pasta, o conteúdo dela também aparece.
    if (n.container && !term) for (const d of descendants(n)) keep.add(d.key)
  }
  return keep
}

export function descendants(node: ExplorerNode): ExplorerNode[] {
  const out: ExplorerNode[] = []
  const stack = [...node.children]
  while (stack.length) {
    const n = stack.pop()!
    out.push(n)
    stack.push(...n.children)
  }
  return out
}

export type DropPosition = 'before' | 'after' | 'inside'

/** Pode `source` ser solto em `target` (null = raiz)? Devolve o motivo quando não. */
export function canDrop(index: ExplorerIndex, source: ExplorerNode, target: ExplorerNode | null, position: DropPosition): { ok: true } | { ok: false; reason: string } {
  const parent = position === 'inside' ? target : target?.parentKey ? (index.byKey.get(target.parentKey) ?? null) : null
  if (target && target.key === source.key) return { ok: false, reason: 'Mesmo item.' }
  if (parent && (parent.key === source.key || isDescendant(index, source.key, parent.key))) {
    return { ok: false, reason: 'Não é possível mover um item para dentro dele mesmo.' }
  }
  switch (source.type) {
    case 'folder':
      if (source.folder?.kind === 'area' && parent) return { ok: false, reason: 'Áreas de estudo ficam sempre na raiz.' }
      if (parent && parent.type !== 'folder') return { ok: false, reason: 'Pastas só podem ficar na raiz ou dentro de outras pastas.' }
      return { ok: true }
    case 'subject':
      if (parent && parent.type !== 'folder') return { ok: false, reason: 'Matérias ficam na raiz ou dentro de pastas.' }
      return { ok: true }
    case 'topic':
      if (!parent || parent.type === 'folder') return { ok: false, reason: 'Tópicos ficam dentro de uma matéria.' }
      return { ok: true }
  }
}

export interface PlannedUpdate {
  table: 'study_folders' | 'subjects' | 'topics'
  id: string
  patch: Record<string, unknown>
}

const tableOf = (type: NodeType): PlannedUpdate['table'] => (type === 'folder' ? 'study_folders' : type === 'subject' ? 'subjects' : 'topics')

/**
 * Calcula as atualizações para mover `source`: novo pai, renumeração da
 * ordem dos irmãos no destino e, para tópicos que mudam de matéria, o
 * subject_id de toda a subárvore. Não altera nada.
 */
export function planMove(index: ExplorerIndex, source: ExplorerNode, target: ExplorerNode | null, position: DropPosition): PlannedUpdate[] {
  const check = canDrop(index, source, target, position)
  if (!check.ok) throw new Error(check.reason)
  const parent = position === 'inside' ? target : target?.parentKey ? (index.byKey.get(target.parentKey) ?? null) : null
  const siblings = (parent ? parent.children : index.roots).filter((n) => n.key !== source.key && sameGroup(n, source))
  let at = siblings.length
  if (target && position !== 'inside') {
    const i = siblings.findIndex((n) => n.key === target.key)
    if (i >= 0) at = position === 'before' ? i : i + 1
  }
  const ordered = [...siblings.slice(0, at), source, ...siblings.slice(at)]
  const out: PlannedUpdate[] = []

  const parentPatch: Record<string, unknown> = {}
  if (source.type === 'folder') parentPatch.parent_id = parent?.id ?? null
  if (source.type === 'subject') parentPatch.folder_id = parent?.id ?? null
  if (source.type === 'topic') {
    const subjectId = parent!.type === 'subject' ? parent!.id : parent!.topic!.subject_id
    parentPatch.parent_id = parent!.type === 'topic' ? parent!.id : null
    if (subjectId !== source.topic!.subject_id) {
      parentPatch.subject_id = subjectId
      for (const d of descendants(source)) out.push({ table: 'topics', id: d.id, patch: { subject_id: subjectId } })
    }
  }

  ordered.forEach((n, i) => {
    if (n.key === source.key) out.push({ table: tableOf(n.type), id: n.id, patch: { ...parentPatch, sort_order: i } })
    else if (n.sortOrder !== i) out.push({ table: tableOf(n.type), id: n.id, patch: { sort_order: i } })
  })
  return out
}

// Pastas e matérias têm ordens independentes dentro da mesma pasta.
const sameGroup = (a: ExplorerNode, b: ExplorerNode) => a.type === b.type

/** Próxima ordem para um novo filho do tipo dado. */
export function nextOrder(parent: ExplorerNode | null, roots: ExplorerNode[], type: NodeType): number {
  const list = (parent ? parent.children : roots).filter((n) => n.type === type)
  return list.reduce((m, n) => Math.max(m, n.sortOrder), -1) + 1
}

/** Matérias contidas (direta ou indiretamente) num nó. */
export function subjectsUnder(node: ExplorerNode): Subject[] {
  if (node.type === 'subject') return [node.subject!]
  return descendants(node)
    .filter((n) => n.type === 'subject')
    .map((n) => n.subject!)
}
