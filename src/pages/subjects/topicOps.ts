import type { DataBackend } from '@/lib/data/types'
import { eq, inList } from '@/lib/data/types'
import { descendantIds } from '@/lib/tree'
import type { Topic } from '@/types/db'

export interface OutlineNode {
  name: string
  depth: number
}

/**
 * Converte texto indentado em hierarquia. Cada 2 espaços ou 1 tab = 1 nível.
 * Marcadores como "-", "•", "*" e numeração "1.", "1.2)" são removidos.
 */
export function parseOutline(text: string): OutlineNode[] {
  const out: OutlineNode[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const indent = raw.match(/^[\t ]*/)![0].replace(/\t/g, '  ').length
    const name = raw
      .trim()
      .replace(/^([-•*–]|\d+(\.\d+)*[.)]?)\s+/, '')
      .trim()
      .slice(0, 300)
    if (!name) continue
    const prevDepth = out.length ? out[out.length - 1].depth : -1
    out.push({ name, depth: Math.min(Math.floor(indent / 2), prevDepth + 1) })
  }
  return out
}

/** Insere a estrutura sob `parentId` (ou na raiz), preservando a ordem. */
export async function importOutline(backend: DataBackend, subjectId: string, parentId: string | null, nodes: OutlineNode[], startOrder: number) {
  const stack: Array<{ id: string | null; depth: number }> = [{ id: parentId, depth: -1 }]
  const orderByParent = new Map<string | null, number>([[parentId, startOrder]])
  const rows: Array<Partial<Topic> & { id: string }> = []
  for (const n of nodes) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= n.depth) stack.pop()
    const parent = stack[stack.length - 1].id
    const order = orderByParent.get(parent) ?? 0
    orderByParent.set(parent, order + 1)
    const id = crypto.randomUUID()
    rows.push({ id, subject_id: subjectId, parent_id: parent, name: n.name, sort_order: order })
    stack.push({ id, depth: n.depth })
  }
  // Pais antes dos filhos: a ordem de `rows` já garante isso.
  for (let i = 0; i < rows.length; i += 200) await backend.insert('topics', rows.slice(i, i + 200))
  return rows.length
}

/** Duplica o tópico e toda a subárvore (sem sessões/cartões vinculados). */
export async function duplicateTopic(backend: DataBackend, all: Topic[], topic: Topic) {
  const ids = descendantIds(all, topic.id)
  const subtree = [topic, ...all.filter((t) => ids.has(t.id))]
  const map = new Map<string, string>(subtree.map((t) => [t.id, crypto.randomUUID()]))
  const rows = subtree.map((t) => ({
    id: map.get(t.id)!,
    subject_id: t.subject_id,
    parent_id: t.id === topic.id ? t.parent_id : map.get(t.parent_id!)!,
    name: t.id === topic.id ? `${t.name} (cópia)` : t.name,
    description: t.description,
    sort_order: t.id === topic.id ? t.sort_order + 1 : t.sort_order,
    status: 'not_started' as const,
    mastery: 0,
    priority: t.priority,
    weight: t.weight,
    estimated_minutes: t.estimated_minutes,
    notes: t.notes,
  }))
  // Ordena por profundidade para inserir pais antes dos filhos.
  const depth = (t: Topic) => {
    let d = 0
    let cur = t
    while (cur.parent_id && cur.id !== topic.id) {
      d++
      cur = all.find((x) => x.id === cur.parent_id)!
      if (!cur) break
    }
    return d
  }
  const order = subtree.map((t, i) => ({ i, d: depth(t) })).sort((a, b) => a.d - b.d)
  for (const { i } of order) await backend.insert('topics', [rows[i]])
  return rows.length
}

/** Move o tópico (com subtópicos) para outro pai e/ou outra matéria. */
export async function moveTopic(backend: DataBackend, all: Topic[], topic: Topic, target: { subjectId: string; parentId: string | null }) {
  const ids = descendantIds(all, topic.id)
  if (target.parentId && (target.parentId === topic.id || ids.has(target.parentId))) throw new Error('Não é possível mover um tópico para dentro dele mesmo.')
  const siblings = all.filter((t) => t.subject_id === target.subjectId && t.parent_id === target.parentId)
  const order = siblings.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
  if (target.subjectId !== topic.subject_id && ids.size) {
    await backend.update('topics', [inList('id', [...ids])], { subject_id: target.subjectId })
  }
  await backend.update('topics', [eq('id', topic.id)], { subject_id: target.subjectId, parent_id: target.parentId, sort_order: order })
}
