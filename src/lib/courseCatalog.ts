// Visão do catálogo para a interface: árvore curso → módulos → aulas, sequência das aulas (anterior/próximo),
// progresso por curso e retomada do último material aberto.
//
// Aula: a unidade que se conclui. Uma pasta "folha" (só arquivos, no máximo um vídeo) vira UMA aula: o vídeo — ou,
// sem vídeo, o primeiro documento — é o conteúdo principal e os demais arquivos são os "materiais da aula" (como nas
// plataformas de cursos). Arquivos soltos em pastas com subpastas, ou pastas com vários vídeos, viram uma aula cada.
// A conclusão da aula é a do conteúdo principal (progresso por arquivo do Drive, sem mudança no banco).
import { materialType, naturalCompare, type MaterialKind } from './drive'
import type { CourseNode, CourseProgress } from '@/types/db'

export interface TreeNode {
  node: CourseNode
  title: string
  children: TreeNode[]
}

export interface Lesson {
  /** Nó do conteúdo principal (ID usado na URL e no progresso). */
  id: string
  title: string
  primary: CourseNode
  attachments: CourseNode[]
  /** Pasta da aula, quando a aula é uma pasta agrupada. */
  folder: CourseNode | null
  /** Número da aula no curso (1, 2, 3…). */
  number: number
}

/** Entrada do sumário: um módulo (com o conteúdo dele) ou uma aula. */
export type OutlineEntry = { type: 'module'; node: CourseNode; title: string; entries: OutlineEntry[]; lessons: Lesson[] } | { type: 'lesson'; lesson: Lesson }

export interface CourseView {
  course: CourseNode
  title: string
  tree: TreeNode[]
  outline: OutlineEntry[]
  /** Aulas visíveis, na ordem de estudo. */
  lessons: Lesson[]
  /** Todos os arquivos visíveis (aulas e materiais), na ordem. */
  items: CourseNode[]
  done: number
  total: number
  kinds: Partial<Record<MaterialKind, number>>
  missing: number
  /** Soma das durações (informadas pelo Drive) dos vídeos principais. */
  durationMs: number
  lastOpened: { node: CourseNode; at: string } | null
}

export const displayTitle = (n: Pick<CourseNode, 'title' | 'custom_title'>) => n.custom_title?.trim() || n.title

const visible = (n: CourseNode) => n.status !== 'excluded' && !n.hidden

const order = (a: CourseNode, b: CourseNode) => a.sort_order - b.sort_order || naturalCompare(displayTitle(a), displayTitle(b)) || a.id.localeCompare(b.id)

const isVideo = (n: CourseNode) => materialType(n.mime_type).kind === 'video'

export function progressIndex(progress: CourseProgress[]) {
  return new Map(progress.map((p) => [p.drive_id, p]))
}

/** Pasta que vira uma aula: só arquivos, pelo menos um, e no máximo um vídeo. */
function lessonFolder(t: TreeNode): boolean {
  if (t.node.kind !== 'module' || t.children.length === 0) return false
  if (t.children.some((c) => c.node.kind !== 'item')) return false
  return t.children.filter((c) => isVideo(c.node)).length <= 1
}

function primaryOf(files: CourseNode[]): CourseNode {
  return files.find(isVideo) ?? files.find((f) => materialType(f.mime_type).embeddable) ?? files[0]
}

/** Sumário (módulos e aulas) a partir da árvore. */
export function buildOutline(tree: TreeNode[]): { outline: OutlineEntry[]; lessons: Lesson[] } {
  const lessons: Lesson[] = []
  const add = (l: Omit<Lesson, 'number'>) => {
    const lesson = { ...l, number: lessons.length + 1 }
    lessons.push(lesson)
    return lesson
  }
  const walk = (list: TreeNode[]): OutlineEntry[] =>
    list.map((t): OutlineEntry => {
      if (t.node.kind === 'item') return { type: 'lesson', lesson: add({ id: t.node.id, title: t.title, primary: t.node, attachments: [], folder: null }) }
      if (lessonFolder(t)) {
        const files = t.children.map((c) => c.node)
        const primary = primaryOf(files)
        return { type: 'lesson', lesson: add({ id: primary.id, title: t.title, primary, attachments: files.filter((f) => f.id !== primary.id), folder: t.node }) }
      }
      const first = lessons.length
      const entries = walk(t.children)
      return { type: 'module', node: t.node, title: t.title, entries, lessons: lessons.slice(first) }
    })
  return { outline: walk(tree), lessons }
}

/** Monta os cursos (visíveis) com a árvore, as aulas e o progresso. Ignora ciclos acidentais de parent_id. */
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
      const { outline, lessons } = buildOutline(tree)
      const kinds: CourseView['kinds'] = {}
      let missing = 0
      let lastOpened: CourseView['lastOpened'] = null
      for (const it of items) {
        const k = materialType(it.mime_type).kind
        kinds[k] = (kinds[k] ?? 0) + 1
        if (it.status === 'missing') missing++
        const p = prog.get(it.drive_id)
        if (p?.last_opened_at && (!lastOpened || p.last_opened_at > lastOpened.at)) {
          // se o mesmo arquivo está em dois lugares, prefere a posição aberta por último
          const node = (p.last_node_id && items.find((x) => x.id === p.last_node_id)) || it
          lastOpened = { node, at: p.last_opened_at }
        }
      }
      const done = lessons.filter((l) => prog.get(l.primary.drive_id)?.completed_at).length
      const durationMs = lessons.reduce((s, l) => s + (l.primary.duration_ms ?? 0), 0)
      return { course, title: displayTitle(course), tree, outline, lessons, items, done, total: lessons.length, kinds, missing, durationMs, lastOpened }
    })
}

/** Aula que contém o arquivo (principal ou material). */
export function lessonOf(view: Pick<CourseView, 'lessons'>, nodeId: string | null | undefined): Lesson | null {
  if (!nodeId) return null
  return view.lessons.find((l) => l.primary.id === nodeId || l.attachments.some((a) => a.id === nodeId)) ?? null
}

export const isLessonDone = (l: Lesson, progress: Map<string, CourseProgress>) => Boolean(progress.get(l.primary.drive_id)?.completed_at)

/**
 * Onde continuar o curso: o último material aberto, se a aula dele não foi concluída; senão, a próxima aula
 * pendente; sem histórico, a primeira aula pendente. Devolve o nó a abrir.
 */
export function resumeItem(view: CourseView, progress: Map<string, CourseProgress>): CourseNode | null {
  const pending = (l: Lesson) => !isLessonDone(l, progress)
  if (view.lastOpened) {
    const last = view.lastOpened.node
    const lesson = lessonOf(view, last.id)
    if (!lesson) return last
    if (pending(lesson)) return last
    const i = view.lessons.indexOf(lesson)
    return (view.lessons.slice(i + 1).find(pending) ?? view.lessons.find(pending) ?? lesson).primary
  }
  return (view.lessons.find(pending) ?? view.lessons[0])?.primary ?? null
}

/** Curso com o material aberto mais recentemente (para "Continuar estudando"). */
export function lastStudied(views: CourseView[]): CourseView | null {
  let best: CourseView | null = null
  for (const v of views) if (v.lastOpened && (!best || v.lastOpened.at > best.lastOpened!.at)) best = v
  return best
}

/** Aulas vizinhas na sequência do curso. */
export function neighbors<T extends { id: string }>(list: T[], id: string | null | undefined) {
  const i = list.findIndex((x) => x.id === id)
  return { previous: i > 0 ? list[i - 1] : null, next: i >= 0 ? (list[i + 1] ?? null) : null, index: i }
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

/** Módulos (em ordem, do mais externo ao mais interno) que contêm a aula. */
export function modulePath(outline: OutlineEntry[], lessonId: string): Array<Extract<OutlineEntry, { type: 'module' }>> {
  for (const e of outline) {
    if (e.type !== 'module') continue
    if (e.lessons.some((l) => l.id === lessonId)) return [e, ...modulePath(e.entries, lessonId)]
  }
  return []
}

export type CourseStatusFilter = 'all' | 'in_progress' | 'not_started' | 'completed'

export function courseStatus(v: Pick<CourseView, 'done' | 'total' | 'lastOpened'>): Exclude<CourseStatusFilter, 'all'> {
  if (v.total > 0 && v.done >= v.total) return 'completed'
  if (v.done > 0 || v.lastOpened) return 'in_progress'
  return 'not_started'
}

/** Tempo dos vídeos ainda não concluídos (pela duração informada pelo Drive). */
export function remainingMs(view: CourseView, progress: Map<string, CourseProgress>) {
  return view.lessons.reduce((s, l) => s + (isLessonDone(l, progress) ? 0 : (l.primary.duration_ms ?? 0)), 0)
}
