// Prévia editável da estrutura colada (edital, ementa, sumário). O texto é
// convertido numa árvore de rascunho; o usuário ajusta (renomear, remover,
// juntar, transformar em pasta, mudar de nível, arrastar) e só então a
// estrutura é gravada. Funções puras: cada operação devolve uma árvore nova.
import type { OutlineNode } from '@/pages/subjects/topicOps'
import type { Topic } from '@/types/db'

export interface DraftNode {
  id: string
  name: string
  folder: boolean
  children: DraftNode[]
}

let seq = 0
const newId = () => `d${++seq}`

export function fromOutline(nodes: OutlineNode[]): DraftNode[] {
  const roots: DraftNode[] = []
  const stack: Array<{ node: DraftNode; depth: number }> = []
  for (const n of nodes) {
    const node: DraftNode = { id: newId(), name: n.name, folder: false, children: [] }
    while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop()
    if (stack.length) stack[stack.length - 1].node.children.push(node)
    else roots.push(node)
    stack.push({ node, depth: n.depth })
  }
  return roots
}

interface Loc {
  list: DraftNode[]
  index: number
  parent: DraftNode | null
}

function locate(tree: DraftNode[], id: string, parent: DraftNode | null = null): Loc | null {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) return { list: tree, index: i, parent }
    const inner = locate(tree[i].children, id, tree[i])
    if (inner) return inner
  }
  return null
}

const clone = (tree: DraftNode[]): DraftNode[] => tree.map((n) => ({ ...n, children: clone(n.children) }))

function edit(tree: DraftNode[], id: string, fn: (loc: Loc, tree: DraftNode[]) => void): DraftNode[] {
  const next = clone(tree)
  const loc = locate(next, id)
  if (loc) fn(loc, next)
  return next
}

export const rename = (tree: DraftNode[], id: string, name: string) => edit(tree, id, (l) => (l.list[l.index].name = name.slice(0, 300)))

export const toggleFolder = (tree: DraftNode[], id: string) => edit(tree, id, (l) => (l.list[l.index].folder = !l.list[l.index].folder))

/** Remove o item; os filhos sobem para o lugar dele (nada some sem querer). */
export const remove = (tree: DraftNode[], id: string, withChildren = false) =>
  edit(tree, id, (l) => {
    const [gone] = l.list.splice(l.index, 1)
    if (!withChildren) l.list.splice(l.index, 0, ...gone.children)
  })

/** Junta o item ao anterior do mesmo nível: nomes unidos, filhos somados. */
export const mergeWithPrevious = (tree: DraftNode[], id: string) =>
  edit(tree, id, (l) => {
    if (l.index === 0) return
    const prev = l.list[l.index - 1]
    const [cur] = l.list.splice(l.index, 1)
    prev.name = `${prev.name}; ${cur.name}`.slice(0, 300)
    prev.children.push(...cur.children)
  })

/** Desce um nível: vira o último filho do irmão anterior. */
export const indent = (tree: DraftNode[], id: string) =>
  edit(tree, id, (l) => {
    if (l.index === 0) return
    const [cur] = l.list.splice(l.index, 1)
    l.list[l.index - 1].children.push(cur)
  })

/** Sobe um nível: passa a ser o irmão seguinte do pai. */
export const outdent = (tree: DraftNode[], id: string) =>
  edit(tree, id, (l, root) => {
    if (!l.parent) return
    const p = locate(root, l.parent.id)!
    const [cur] = l.list.splice(l.index, 1)
    p.list.splice(p.index + 1, 0, cur)
  })

export const moveBy = (tree: DraftNode[], id: string, delta: -1 | 1) =>
  edit(tree, id, (l) => {
    const to = l.index + delta
    if (to < 0 || to >= l.list.length) return
    const [cur] = l.list.splice(l.index, 1)
    l.list.splice(to, 0, cur)
  })

const contains = (node: DraftNode, id: string): boolean => node.children.some((c) => c.id === id || contains(c, id))

/** Arrastar e soltar: antes, depois ou dentro do alvo. */
export function moveTo(tree: DraftNode[], id: string, targetId: string, position: 'before' | 'after' | 'inside'): DraftNode[] {
  if (id === targetId) return tree
  const next = clone(tree)
  const src = locate(next, id)
  if (!src || contains(src.list[src.index], targetId)) return tree
  const [cur] = src.list.splice(src.index, 1)
  const dst = locate(next, targetId)!
  if (position === 'inside') dst.list[dst.index].children.push(cur)
  else dst.list.splice(position === 'before' ? dst.index : dst.index + 1, 0, cur)
  return next
}

export function countNodes(tree: DraftNode[]): { total: number; folders: number } {
  let total = 0
  let folders = 0
  const walk = (list: DraftNode[]) => {
    for (const n of list) {
      total++
      if (n.folder) folders++
      walk(n.children)
    }
  }
  walk(tree)
  return { total, folders }
}

/** Linhas de `topics` prontas para inserir (pais antes dos filhos). */
export function toTopicRows(tree: DraftNode[], subjectId: string, parentId: string | null, startOrder: number): Array<Partial<Topic> & { id: string }> {
  const rows: Array<Partial<Topic> & { id: string }> = []
  const walk = (list: DraftNode[], parent: string | null, first: number) => {
    list.forEach((n, i) => {
      const id = crypto.randomUUID()
      rows.push({ id, subject_id: subjectId, parent_id: parent, name: n.name.trim() || 'Sem nome', kind: n.folder ? 'folder' : 'topic', sort_order: first + i })
      walk(n.children, id, 0)
    })
  }
  walk(tree, parentId, startOrder)
  return rows
}
