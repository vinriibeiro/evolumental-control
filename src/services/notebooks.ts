import type { DataBackend, MoveNotebookNodeInput } from '@/lib/data/types'
import { eq, inList, isNull } from '@/lib/data/types'
import { MAX_PAGE_VERSIONS, shouldCreateAutoSnapshot } from '@/lib/notebookDrafts'
import { EMPTY_DOC, ensureBlockIds, extractDocSummary, notebookDescendantIds } from '@/lib/notebooks'
import type {
  Notebook,
  NotebookContentDoc,
  NotebookNode,
  NotebookNodeType,
  NotebookPageContent,
  NotebookPageVersion,
  NotebookTemplate,
  NotebookVersionReason,
  Patch,
} from '@/types/db'

export class RevisionConflictError extends Error {
  readonly serverContent: NotebookPageContent | null
  constructor(serverContent: NotebookPageContent | null) {
    super('Esta página foi alterada em outra aba ou dispositivo. Revise o conflito antes de salvar.')
    this.name = 'RevisionConflictError'
    this.serverContent = serverContent
  }
}

export interface CreateNotebookInput {
  title: string
  description?: string | null
  icon?: string | null
  color?: string
  cover?: string | null
  subject_id?: string | null
}

export async function createNotebook(backend: DataBackend, input: CreateNotebookInput): Promise<Notebook> {
  const existing = await backend.list('notebooks', { filters: [isNull('deleted_at')] })
  const nextOrder = existing.rows.reduce((max, n) => Math.max(max, n.sort_order), -1) + 1
  const [created] = await backend.insert('notebooks', [
    {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      icon: input.icon ?? 'book-open',
      color: input.color ?? '#171717',
      cover: input.cover ?? null,
      subject_id: input.subject_id ?? null,
      sort_order: nextOrder,
    },
  ])
  return created
}

export async function updateNotebook(backend: DataBackend, id: string, patch: Patch<'notebooks'>): Promise<Notebook | null> {
  const rows = await backend.update('notebooks', [eq('id', id)], patch)
  return rows[0] ?? null
}

export async function toggleNotebookFavorite(backend: DataBackend, notebook: Pick<Notebook, 'id' | 'is_favorite'>) {
  return updateNotebook(backend, notebook.id, { is_favorite: !notebook.is_favorite })
}

export async function archiveNotebook(backend: DataBackend, id: string) {
  return updateNotebook(backend, id, { archived_at: new Date().toISOString() })
}

export async function unarchiveNotebook(backend: DataBackend, id: string) {
  return updateNotebook(backend, id, { archived_at: null })
}

/** Exclusão lógica do caderno: preserva o estado `deleted_at` individual das páginas internas. */
export async function trashNotebook(backend: DataBackend, id: string) {
  return updateNotebook(backend, id, { deleted_at: new Date().toISOString() })
}

export async function restoreNotebook(backend: DataBackend, id: string) {
  return updateNotebook(backend, id, { deleted_at: null })
}

export async function purgeNotebook(backend: DataBackend, id: string): Promise<number> {
  return backend.remove('notebooks', [eq('id', id)])
}

export interface CreateNodeInput {
  notebook_id: string
  parent_id?: string | null
  node_type: NotebookNodeType
  title: string
  icon?: string | null
  color?: string | null
  subject_id?: string | null
  topic_id?: string | null
  initialDoc?: NotebookContentDoc
}

export async function createNode(backend: DataBackend, input: CreateNodeInput): Promise<NotebookNode> {
  const parentId = input.parent_id ?? null
  const siblingFilters = [
    eq('notebook_id', input.notebook_id),
    parentId ? eq('parent_id', parentId) : isNull('parent_id'),
    isNull('deleted_at'),
  ]
  const siblings = await backend.list('notebook_nodes', { filters: siblingFilters })
  const nextPos = siblings.rows.reduce((max, n) => Math.max(max, n.position), -1) + 1

  const [node] = await backend.insert('notebook_nodes', [
    {
      notebook_id: input.notebook_id,
      parent_id: parentId,
      node_type: input.node_type,
      title: input.title.trim(),
      icon: input.icon ?? null,
      color: input.color ?? null,
      subject_id: input.subject_id ?? null,
      topic_id: input.topic_id ?? null,
      position: nextPos,
    },
  ])

  if (input.node_type === 'page') {
    const doc = ensureBlockIds(input.initialDoc ?? EMPTY_DOC)
    const { text, wordCount } = extractDocSummary(doc)
    await backend.insert('notebook_page_contents', [
      {
        node_id: node.id,
        content_json: doc,
        content_schema_version: 1,
        content_text: text,
        word_count: wordCount,
        revision: 1,
      },
    ])
  }

  return node
}

export async function updateNode(backend: DataBackend, id: string, patch: Patch<'notebook_nodes'>): Promise<NotebookNode | null> {
  const rows = await backend.update('notebook_nodes', [eq('id', id)], patch)
  return rows[0] ?? null
}

/** Reordena irmãos de forma determinística atribuindo posições sequenciais 0..N-1. */
export async function reorderNodes(backend: DataBackend, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await backend.update('notebook_nodes', [eq('id', orderedIds[i])], { position: i })
  }
}

export async function moveNode(backend: DataBackend, input: MoveNotebookNodeInput): Promise<number> {
  return backend.moveNotebookNode(input)
}

/**
 * Duplica um nó (seção ou página) e toda a sua subárvore ativa,
 * copiando também os conteúdos das páginas com novos `blockId`s e `revision = 1`.
 */
export async function duplicateNode(
  backend: DataBackend,
  allNodesInNotebook: NotebookNode[],
  rootNode: NotebookNode,
): Promise<{ rootId: string; count: number }> {
  const activeNodes = allNodesInNotebook.filter((n) => n.deleted_at == null)
  const descIds = notebookDescendantIds(activeNodes, rootNode.id)
  const subtree = [rootNode, ...activeNodes.filter((n) => descIds.has(n.id))]
  const idMap = new Map<string, string>(subtree.map((n) => [n.id, crypto.randomUUID()]))
  const byId = new Map(activeNodes.map((n) => [n.id, n]))

  const depthOf = (n: NotebookNode) => {
    let d = 0
    let cur: NotebookNode | undefined = n
    while (cur && cur.id !== rootNode.id && cur.parent_id && d < 100) {
      d++
      cur = byId.get(cur.parent_id)
    }
    return d
  }

  const ordered = [...subtree].sort((a, b) => depthOf(a) - depthOf(b) || a.position - b.position)
  const siblings = activeNodes.filter((n) => n.parent_id === rootNode.parent_id)
  const nextRootPos = siblings.reduce((m, s) => Math.max(m, s.position), -1) + 1

  for (const node of ordered) {
    const newId = idMap.get(node.id)!
    const newParentId = node.id === rootNode.id ? rootNode.parent_id : (node.parent_id ? (idMap.get(node.parent_id) ?? null) : null)
    await backend.insert('notebook_nodes', [
      {
        id: newId,
        notebook_id: node.notebook_id,
        parent_id: newParentId,
        node_type: node.node_type,
        title: node.id === rootNode.id ? `${node.title} (cópia)` : node.title,
        icon: node.icon,
        cover: node.cover,
        color: node.color,
        status: node.status,
        difficulty: node.difficulty,
        needs_review: node.needs_review,
        is_favorite: false,
        is_pinned: false,
        position: node.id === rootNode.id ? nextRootPos : node.position,
        subject_id: node.subject_id,
        topic_id: node.topic_id,
      },
    ])
  }

  // Copia conteúdos das páginas duplicadas
  const pageIds = ordered.filter((n) => n.node_type === 'page').map((n) => n.id)
  if (pageIds.length > 0) {
    const contents = await backend.list('notebook_page_contents', { filters: [inList('node_id', pageIds)] })
    const contentByNode = new Map(contents.rows.map((c) => [c.node_id, c]))
    const newContents = pageIds.map((oldId) => {
      const existing = contentByNode.get(oldId)
      const clonedDoc = cloneDocWithFreshBlockIds(existing?.content_json ?? EMPTY_DOC)
      const { text, wordCount } = extractDocSummary(clonedDoc)
      return {
        node_id: idMap.get(oldId)!,
        content_json: clonedDoc,
        content_schema_version: existing?.content_schema_version ?? 1,
        content_text: text,
        word_count: wordCount,
        revision: 1,
      }
    })
    await backend.insert('notebook_page_contents', newContents)
  }

  return { rootId: idMap.get(rootNode.id)!, count: ordered.length }
}

function cloneDocWithFreshBlockIds(doc: NotebookContentDoc): NotebookContentDoc {
  const cloned = structuredClone(doc)
  cloned.content = (cloned.content ?? []).map((block) => ({
    ...block,
    attrs: { ...(block.attrs ?? {}), blockId: crypto.randomUUID() },
  }))
  return cloned
}

/**
 * Envia um nó e toda a sua subárvore ativa para a lixeira com o mesmo carimbo `deleted_at`.
 * Filhos já excluídos anteriormente mantêm seu carimbo original.
 */
export async function trashNode(backend: DataBackend, allNodesInNotebook: NotebookNode[], nodeId: string): Promise<number> {
  const active = allNodesInNotebook.filter((n) => n.deleted_at == null)
  const desc = notebookDescendantIds(active, nodeId)
  const ids = [nodeId, ...desc]
  const now = new Date().toISOString()
  const updated = await backend.update('notebook_nodes', [inList('id', ids), isNull('deleted_at')], { deleted_at: now })
  return updated.length
}

/**
 * Restaura um nó da lixeira e os descendentes excluídos no mesmo lote.
 * Se o pai atual estiver excluído ou ausente, promove o nó restaurado para a raiz do caderno.
 */
export async function restoreNode(backend: DataBackend, allNodesInNotebook: NotebookNode[], nodeId: string): Promise<number> {
  const byId = new Map(allNodesInNotebook.map((n) => [n.id, n]))
  const target = byId.get(nodeId)
  if (!target || !target.deleted_at) return 0

  const batchDeletedAt = target.deleted_at
  const desc = notebookDescendantIds(allNodesInNotebook, nodeId)
  const batchIds = [nodeId, ...[...desc].filter((id) => byId.get(id)?.deleted_at === batchDeletedAt)]

  const parent = target.parent_id ? byId.get(target.parent_id) : null
  const needsRootPromotion = Boolean(target.parent_id && (!parent || parent.deleted_at != null))

  if (needsRootPromotion) {
    await backend.update('notebook_nodes', [eq('id', nodeId)], { parent_id: null, deleted_at: null })
    const restIds = batchIds.filter((id) => id !== nodeId)
    if (restIds.length) await backend.update('notebook_nodes', [inList('id', restIds)], { deleted_at: null })
    return batchIds.length
  }

  const updated = await backend.update('notebook_nodes', [inList('id', batchIds)], { deleted_at: null })
  return updated.length
}

export async function purgeNode(backend: DataBackend, nodeId: string): Promise<number> {
  return backend.remove('notebook_nodes', [eq('id', nodeId)])
}

export async function getOrCreatePageContent(backend: DataBackend, nodeId: string): Promise<NotebookPageContent> {
  const { rows } = await backend.list('notebook_page_contents', { filters: [eq('node_id', nodeId)], limit: 1 })
  if (rows[0]) return rows[0]
  const [created] = await backend.insert('notebook_page_contents', [
    {
      node_id: nodeId,
      content_json: EMPTY_DOC,
      content_schema_version: 1,
      content_text: '',
      word_count: 0,
      revision: 1,
    },
  ])
  return created
}

/**
 * Salva o conteúdo da página com controle otimista de revisão (`revision`).
 * Nunca sobrescreve silenciosamente uma versão mais recente salva em outra aba/dispositivo.
 */
export async function savePageContent(
  backend: DataBackend,
  input: { nodeId: string; expectedRevision: number; contentJson: NotebookContentDoc; forceOverwrite?: boolean },
): Promise<NotebookPageContent> {
  const normalizedDoc = ensureBlockIds(input.contentJson)
  const { text, wordCount } = extractDocSummary(normalizedDoc)

  const current = await getOrCreatePageContent(backend, input.nodeId)
  const expected = input.forceOverwrite ? current.revision : input.expectedRevision

  const updated = await backend.update(
    'notebook_page_contents',
    [eq('id', current.id), eq('revision', expected)],
    {
      content_json: normalizedDoc,
      content_text: text,
      word_count: wordCount,
      revision: expected + 1,
    },
  )

  if (updated.length === 0) {
    const latest = (await backend.list('notebook_page_contents', { filters: [eq('node_id', input.nodeId)], limit: 1 })).rows[0] ?? null
    throw new RevisionConflictError(latest)
  }

  // Atualiza updated_at do nó para manter listas de "recentemente editadas" precisas.
  await backend.update('notebook_nodes', [eq('id', input.nodeId)], {})
  return updated[0]
}

export async function markPageStudied(backend: DataBackend, nodeId: string) {
  return updateNode(backend, nodeId, { last_studied_at: new Date().toISOString() })
}

// ---------------------------------------------------------------------
// Histórico de versões (snapshots e restauração)
// ---------------------------------------------------------------------

export async function listPageVersions(backend: DataBackend, nodeId: string): Promise<NotebookPageVersion[]> {
  const { rows } = await backend.list('notebook_page_versions', {
    filters: [eq('node_id', nodeId)],
    order: [{ column: 'created_at', ascending: false }],
    limit: 50,
  })
  return rows
}

export async function createPageVersion(
  backend: DataBackend,
  input: {
    nodeId: string
    title: string
    contentJson: NotebookContentDoc
    revision: number
    reason?: NotebookVersionReason
  },
): Promise<NotebookPageVersion> {
  const [created] = await backend.insert('notebook_page_versions', [
    {
      node_id: input.nodeId,
      title: input.title.trim() || 'Sem título',
      content_json: ensureBlockIds(input.contentJson),
      content_schema_version: 1,
      revision: Math.max(1, input.revision),
      reason: input.reason ?? 'snapshot',
    },
  ])

  // Política de retenção: mantém no máximo MAX_PAGE_VERSIONS versões por página.
  const all = await listPageVersions(backend, input.nodeId)
  if (all.length > MAX_PAGE_VERSIONS) {
    const excessIds = all.slice(MAX_PAGE_VERSIONS).map((v) => v.id)
    if (excessIds.length) await backend.remove('notebook_page_versions', [inList('id', excessIds)])
  }

  return created
}

/** Cria snapshot automático apenas se já passou o intervalo mínimo (evita 1 versão por tecla). */
export async function maybeCreateAutoSnapshot(
  backend: DataBackend,
  input: { nodeId: string; title: string; contentJson: NotebookContentDoc; revision: number },
): Promise<NotebookPageVersion | null> {
  const latest = (
    await backend.list('notebook_page_versions', {
      filters: [eq('node_id', input.nodeId)],
      order: [{ column: 'created_at', ascending: false }],
      limit: 1,
    })
  ).rows[0]

  if (!shouldCreateAutoSnapshot(latest?.created_at)) return null
  return createPageVersion(backend, { ...input, reason: 'snapshot' })
}

export async function restorePageVersion(
  backend: DataBackend,
  input: { nodeId: string; versionId: string; expectedRevision: number },
): Promise<NotebookPageContent> {
  const version = await backend.get('notebook_page_versions', input.versionId)
  if (!version || version.node_id !== input.nodeId) throw new Error('Versão não encontrada para esta página.')

  const node = await backend.get('notebook_nodes', input.nodeId)
  const current = await getOrCreatePageContent(backend, input.nodeId)

  // Guarda um snapshot de segurança antes de restaurar
  await createPageVersion(backend, {
    nodeId: input.nodeId,
    title: node?.title ?? version.title,
    contentJson: current.content_json,
    revision: current.revision,
    reason: 'restore',
  })

  const saved = await savePageContent(backend, {
    nodeId: input.nodeId,
    expectedRevision: input.expectedRevision,
    contentJson: version.content_json,
    forceOverwrite: true,
  })
  if (node && version.title && version.title !== node.title) {
    await updateNode(backend, input.nodeId, { title: version.title })
  }
  return saved
}

// ---------------------------------------------------------------------
// Templates personalizados
// ---------------------------------------------------------------------

export async function createCustomTemplate(
  backend: DataBackend,
  input: { name: string; description?: string | null; category?: string | null; contentJson: NotebookContentDoc },
): Promise<NotebookTemplate> {
  const [created] = await backend.insert('notebook_templates', [
    {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || 'Personalizado',
      content_json: ensureBlockIds(input.contentJson),
      content_schema_version: 1,
    },
  ])
  return created
}

export async function updateCustomTemplate(backend: DataBackend, id: string, patch: Patch<'notebook_templates'>) {
  const rows = await backend.update('notebook_templates', [eq('id', id)], patch)
  return rows[0] ?? null
}

export async function duplicateCustomTemplate(backend: DataBackend, template: NotebookTemplate): Promise<NotebookTemplate> {
  return createCustomTemplate(backend, {
    name: `${template.name} (cópia)`,
    description: template.description,
    category: template.category,
    contentJson: structuredClone(template.content_json),
  })
}

export async function deleteCustomTemplate(backend: DataBackend, id: string): Promise<number> {
  return backend.remove('notebook_templates', [eq('id', id)])
}

// ---------------------------------------------------------------------
// Validação de imagens e anexos (segurança: MIME allowlist e limites)
// ---------------------------------------------------------------------

export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
export const MAX_LOCAL_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MiB para embutir com segurança em data URL local

export function readValidatedImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      reject(new Error('Formato não suportado. Use PNG, JPEG, WebP ou GIF.'))
      return
    }
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      reject(new Error('Imagem muito grande (máximo de 4 MB).'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result)
      } else {
        reject(new Error('Não foi possível ler a imagem.'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'))
    reader.readAsDataURL(file)
  })
}
