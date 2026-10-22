// Operações compostas do Explorador sobre o DataBackend (modo local e Supabase).
import type { DataBackend } from '@/lib/data/types'
import { eq } from '@/lib/data/types'
import { fetchAll } from '@/hooks/data'
import type { StudyFolder, Subject, TableName, Topic } from '@/types/db'
import { buildExplorer, descendants, planMove, type DropPosition, type ExplorerIndex, type ExplorerNode, type PlannedUpdate } from './model'
import { toTopicRows, type DraftNode } from './outline'

/** Tabelas que qualquer mudança do Explorador pode afetar (para invalidar o cache). */
export const EXPLORER_TABLES: TableName[] = ['study_folders', 'subjects', 'topics']

export async function loadIndex(backend: DataBackend): Promise<ExplorerIndex> {
  const [f, s, t] = await Promise.all([fetchAll(backend, 'study_folders'), fetchAll(backend, 'subjects'), fetchAll(backend, 'topics')])
  return buildExplorer(f, s, t)
}

export async function applyUpdates(backend: DataBackend, updates: PlannedUpdate[]) {
  // O nó movido primeiro (o banco confere ciclos nele); depois os demais.
  for (const u of updates) await backend.update(u.table, [eq('id', u.id)], u.patch as never)
}

export async function moveNode(backend: DataBackend, index: ExplorerIndex, source: ExplorerNode, target: ExplorerNode | null, position: DropPosition) {
  const updates = planMove(index, source, target, position)
  // Tópicos que trocam de matéria: o nó principal antes dos descendentes.
  updates.sort((a, b) => Number(b.id === source.id) - Number(a.id === source.id))
  await applyUpdates(backend, updates)
}

export async function setFavorite(backend: DataBackend, nodes: ExplorerNode[], favorite: boolean) {
  for (const n of nodes) {
    const table = n.type === 'folder' ? 'study_folders' : n.type === 'subject' ? 'subjects' : 'topics'
    await backend.update(table, [eq('id', n.id)], { favorite } as never)
  }
}

/** Arquiva/reativa pastas e matérias (tópicos não são arquiváveis). */
export async function setArchived(backend: DataBackend, nodes: ExplorerNode[], archived: boolean) {
  const at = archived ? new Date().toISOString() : null
  for (const n of nodes) {
    if (n.type === 'folder') await backend.update('study_folders', [eq('id', n.id)], { archived_at: at })
    if (n.type === 'subject') await backend.update('subjects', [eq('id', n.id)], { status: archived ? 'archived' : 'active', archived_at: at })
  }
}

export async function renameNode(backend: DataBackend, node: ExplorerNode, name: string) {
  const clean = name.trim().slice(0, node.type === 'topic' ? 300 : 160)
  if (!clean) throw new Error('O nome não pode ficar vazio.')
  const table = node.type === 'folder' ? 'study_folders' : node.type === 'subject' ? 'subjects' : 'topics'
  await backend.update(table, [eq('id', node.id)], { name: clean } as never)
}

export async function createFolder(backend: DataBackend, input: Pick<StudyFolder, 'name' | 'kind'> & Partial<Pick<StudyFolder, 'parent_id' | 'color' | 'icon' | 'sort_order'>>) {
  const [row] = await backend.insert('study_folders', [{ ...input, parent_id: input.kind === 'area' ? null : (input.parent_id ?? null) }])
  return row
}

/**
 * Duplica um nó com toda a estrutura abaixo dele (pastas, matérias e
 * tópicos). Históricos (sessões, cartões, questões) não são copiados.
 */
export async function duplicateNode(backend: DataBackend, node: ExplorerNode): Promise<number> {
  const folderMap = new Map<string, string>()
  const subjectMap = new Map<string, string>()
  const topicMap = new Map<string, string>()
  const folders: Array<Partial<StudyFolder> & { id: string }> = []
  const subjects: Array<Partial<Subject> & { id: string }> = []
  const topics: Array<Partial<Topic> & { id: string }> = []
  const copyName = (n: ExplorerNode) => (n.key === node.key ? `${n.name} (cópia)` : n.name)
  const order = (n: ExplorerNode) => (n.key === node.key ? n.sortOrder + 1 : n.sortOrder)

  // Pré-ordem: pais sempre antes dos filhos.
  const walk = (n: ExplorerNode) => {
    if (n.type === 'folder') {
      const f = n.folder!
      const id = crypto.randomUUID()
      folderMap.set(f.id, id)
      folders.push({ id, kind: f.kind, parent_id: f.parent_id ? (folderMap.get(f.parent_id) ?? f.parent_id) : null, name: copyName(n), color: f.color, icon: f.icon, sort_order: order(n) })
    } else if (n.type === 'subject') {
      const s: Partial<Subject> = { ...n.subject! }
      delete s.user_id
      delete s.created_at
      delete s.updated_at
      const id = crypto.randomUUID()
      subjectMap.set(n.subject!.id, id)
      subjects.push({ ...s, id, name: copyName(n), sort_order: order(n), folder_id: s.folder_id ? (folderMap.get(s.folder_id) ?? s.folder_id) : null, favorite: false })
    } else {
      const t = n.topic!
      const id = crypto.randomUUID()
      topicMap.set(t.id, id)
      topics.push({
        id,
        subject_id: subjectMap.get(t.subject_id) ?? t.subject_id,
        parent_id: t.parent_id ? (topicMap.get(t.parent_id) ?? t.parent_id) : null,
        kind: t.kind,
        name: copyName(n),
        description: t.description,
        sort_order: order(n),
        priority: t.priority,
        weight: t.weight,
        estimated_minutes: t.estimated_minutes,
        notes: t.notes,
      })
    }
    for (const c of n.children) walk(c)
  }
  walk(node)
  if (folders.length) await backend.insert('study_folders', folders)
  for (let i = 0; i < subjects.length; i += 200) await backend.insert('subjects', subjects.slice(i, i + 200))
  for (let i = 0; i < topics.length; i += 200) await backend.insert('topics', topics.slice(i, i + 200))
  return folders.length + subjects.length + topics.length
}

/** Grava a estrutura revisada na prévia do edital. */
export async function createOutline(backend: DataBackend, tree: DraftNode[], subjectId: string, parentId: string | null, startOrder: number) {
  const rows = toTopicRows(tree, subjectId, parentId, startOrder)
  for (let i = 0; i < rows.length; i += 200) await backend.insert('topics', rows.slice(i, i + 200))
  return rows.length
}

/** Quantos itens um conjunto de nós contém (para avisos de exclusão em lote). */
export function countWithin(nodes: ExplorerNode[]): number {
  return nodes.reduce((a, n) => a + 1 + descendants(n).length, 0)
}
