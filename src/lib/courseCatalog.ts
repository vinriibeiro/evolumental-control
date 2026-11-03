// Visão do catálogo para a interface: árvore curso → módulos → aulas, sequência das aulas (anterior/próximo),
// progresso por curso e retomada do último material aberto.
import { materialType, naturalCompare, type MaterialKind } from './drive'
import type { CourseNode, CourseProgress } from '@/types/db'

export interface TreeNode {
  node: CourseNode
  title: string
  children: TreeNode[]
}

export interface CourseView {
  course: CourseNode
  title: string
  tree: TreeNode[]
  /** Aulas/materiais visíveis, na ordem de estudo. */
  items: CourseNode[]
  done: number
  total: number
  kinds: Partial<Record<MaterialKind, number>>
  missing: number
  lastOpened: { node: CourseNode; at: string } | null
}

export const displayTitle = (n: Pick<CourseNode, 'title' | 'custom_title'>) => n.custom_title?.trim() || n.title

const visible = (n: CourseNode) => n.status !== 'excluded' && !n.hidden

const order = (a: CourseNode, b: CourseNode) => a.sort_order - b.sort_order || naturalCompare(displayTitle(a), displayTitle(b)) || a.id.localeCompare(b.id)

export function progressIndex(progress: CourseProgress[]) {
  return new Map(progress.map((p) => [p.drive_id, p]))
}

/** Monta os cursos (visíveis) com a árvore e o progresso. Ignora ciclos acidentais de parent_id. */
export function buildCatalog(nodes: CourseNode[], progress: CourseProgress[], opts: { includeHidden?: boolean } = {}): CourseView[] {
  const show = opts.includeHidden ? (n: CourseNode) => n.status !== 'excluded' : visible
  const prog = progressIndex(progress)
  const kids = new Map<string, CourseNode[]>()
  for (const n of nodes) if (n.parent_id && show(n)) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n])
  for (const list of kids.values()) list.sort(order)

  const build = (n: CourseNode, trail: Set<string>): TreeNode => ({
    node: n,
    title: displayTitle(n),
    children: (kids.get(n.id) ?? []).filter((c) => !trail.has(c.id)).map((c) => build(c, new Set([...trail, c.id]))),
  })
  const flatten = (t: TreeNode[], out: CourseNode[] = []) => {
    for (const x of t) {
      if (x.node.kind === 'item') out.push(x.node)
      flatten(x.children, out)
    }
    return out
  }

  return nodes
    .filter((n) => n.kind === 'course' && !n.parent_id && show(n))
    .sort(order)
    .map((course) => {
      const tree = build(course, new Set([course.id])).children
      const items = flatten(tree)
      const kinds: CourseView['kinds'] = {}
      let done = 0
      let missing = 0
      let lastOpened: CourseView['lastOpened'] = null
      for (const it of items) {
        const k = materialType(it.mime_type).kind
        kinds[k] = (kinds[k] ?? 0) + 1
        if (it.status === 'missing') missing++
        const p = prog.get(it.drive_id)
        if (p?.completed_at) done++
        if (p?.last_opened_at && (!lastOpened || p.last_opened_at > lastOpened.at)) {
          // se o mesmo arquivo está em dois lugares, prefere a posição aberta por último
          const node = (p.last_node_id && items.find((x) => x.id === p.last_node_id)) || it
          lastOpened = { node, at: p.last_opened_at }
        }
      }
      return { course, title: displayTitle(course), tree, items, done, total: items.length, kinds, missing, lastOpened }
    })
}

/** Onde continuar o curso: o último aberto; se já foi concluído, o próximo não concluído; senão, a primeira aula não concluída. */
export function resumeItem(view: CourseView, progress: Map<string, CourseProgress>): CourseNode | null {
  const pending = (n: CourseNode) => !progress.get(n.drive_id)?.completed_at
  if (view.lastOpened) {
    const last = view.lastOpened.node
    if (pending(last)) return last
    const i = view.items.findIndex((x) => x.id === last.id)
    return view.items.slice(i + 1).find(pending) ?? view.items.find(pending) ?? last
  }
  return view.items.find(pending) ?? view.items[0] ?? null
}

/** Curso com o material aberto mais recentemente (para "Continuar estudando"). */
export function lastStudied(views: CourseView[]): CourseView | null {
  let best: CourseView | null = null
  for (const v of views) if (v.lastOpened && (!best || v.lastOpened.at > best.lastOpened!.at)) best = v
  return best
}

export function neighbors(items: CourseNode[], id: string | null | undefined) {
  const i = items.findIndex((x) => x.id === id)
  return { previous: i > 0 ? items[i - 1] : null, next: i >= 0 ? (items[i + 1] ?? null) : null, index: i }
}

/** Caminho do item dentro do curso (módulos), para o título da aula. */
export function breadcrumb(tree: TreeNode[], id: string): string[] {
  for (const t of tree) {
    if (t.node.id === id) return []
    const sub = breadcrumb(t.children, id)
    if (sub.length || t.children.some((c) => c.node.id === id)) return [t.title, ...sub]
  }
  return []
}

export type CourseStatusFilter = 'all' | 'in_progress' | 'not_started' | 'completed'

export function courseStatus(v: Pick<CourseView, 'done' | 'total' | 'lastOpened'>): Exclude<CourseStatusFilter, 'all'> {
  if (v.total > 0 && v.done >= v.total) return 'completed'
  if (v.done > 0 || v.lastOpened) return 'in_progress'
  return 'not_started'
}
