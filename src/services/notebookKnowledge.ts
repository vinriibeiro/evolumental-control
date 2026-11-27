import type { DataBackend } from '@/lib/data/types'
import { eq, inList, isNull } from '@/lib/data/types'
import { extractInternalLinksFromDoc } from '@/lib/notebookGraph'
import type { NotebookContentDoc, NotebookPageLink, NotebookTag, Patch } from '@/types/db'

// ---------------------------------------------------------------------
// Tags globais de conhecimento
// ---------------------------------------------------------------------

export async function createNotebookTag(backend: DataBackend, input: { name: string; color?: string }): Promise<NotebookTag> {
  const [created] = await backend.insert('notebook_tags', [
    {
      name: input.name.trim(),
      color: input.color ?? '#525252',
    },
  ])
  return created
}

export async function updateNotebookTag(backend: DataBackend, id: string, patch: Patch<'notebook_tags'>): Promise<NotebookTag | null> {
  const rows = await backend.update('notebook_tags', [eq('id', id)], patch)
  return rows[0] ?? null
}

export async function deleteNotebookTag(backend: DataBackend, id: string): Promise<number> {
  return backend.remove('notebook_tags', [eq('id', id)])
}

export async function toggleEntityTag(
  backend: DataBackend,
  input: { tagId: string; notebookId?: string | null; nodeId?: string | null },
): Promise<'added' | 'removed'> {
  if (!input.notebookId && !input.nodeId) throw new Error('Informe um caderno ou uma página.')
  const filters = [
    eq('tag_id', input.tagId),
    input.nodeId ? eq('node_id', input.nodeId) : eq('notebook_id', input.notebookId),
  ]
  const existing = (await backend.list('notebook_tag_links', { filters, limit: 1 })).rows[0]
  if (existing) {
    await backend.remove('notebook_tag_links', [eq('id', existing.id)])
    return 'removed'
  }
  await backend.insert('notebook_tag_links', [
    {
      tag_id: input.tagId,
      notebook_id: input.nodeId ? null : (input.notebookId ?? null),
      node_id: input.nodeId ?? null,
    },
  ])
  return 'added'
}

// ---------------------------------------------------------------------
// Links internos entre páginas/blocos & Backlinks
// ---------------------------------------------------------------------

/**
 * Sincroniza `notebook_page_links` a partir dos links internos detectados no JSON da página.
 * Mantém referências válidas e remove links que foram apagados do texto.
 */
export async function syncPageInternalLinks(
  backend: DataBackend,
  sourceNodeId: string,
  doc: NotebookContentDoc,
): Promise<NotebookPageLink[]> {
  const extracted = extractInternalLinksFromDoc(doc, sourceNodeId)
  const existing = (await backend.list('notebook_page_links', { filters: [eq('source_node_id', sourceNodeId)] })).rows

  // Filtra apenas nós de destino que realmente existem e pertencem ao usuário
  const validTargets = new Set<string>()
  if (extracted.length > 0) {
    const targetIds = [...new Set(extracted.map((e) => e.targetNodeId))]
    const found = (await backend.list('notebook_nodes', { filters: [inList('id', targetIds), isNull('deleted_at')] })).rows
    for (const f of found) validTargets.add(f.id)
  }

  const desired = extracted.filter((e) => validTargets.has(e.targetNodeId))
  const keyOf = (l: { target_node_id: string; target_block_id: string | null; source_block_id: string | null }) =>
    `${l.target_node_id}::${l.target_block_id ?? ''}::${l.source_block_id ?? ''}`

  const existingByKey = new Map(existing.map((l) => [keyOf(l), l]))
  const desiredKeys = new Set<string>()

  const toInsert: Array<{
    source_node_id: string
    target_node_id: string
    source_block_id: string | null
    target_block_id: string | null
    link_text: string | null
  }> = []

  for (const d of desired) {
    const k = `${d.targetNodeId}::${d.targetBlockId ?? ''}::${d.sourceBlockId ?? ''}`
    desiredKeys.add(k)
    if (!existingByKey.has(k)) {
      toInsert.push({
        source_node_id: sourceNodeId,
        target_node_id: d.targetNodeId,
        source_block_id: d.sourceBlockId,
        target_block_id: d.targetBlockId,
        link_text: d.linkText,
      })
    }
  }

  const toDeleteIds = existing.filter((e) => !desiredKeys.has(keyOf(e)) && e.source_block_id !== null).map((e) => e.id)
  // Nota: links manuais criados pelo botão "+ Vincular página" (source_block_id === null) são preservados até remoção explícita.

  if (toDeleteIds.length > 0) {
    await backend.remove('notebook_page_links', [inList('id', toDeleteIds)])
  }
  if (toInsert.length > 0) {
    await backend.insert('notebook_page_links', toInsert)
  }

  return (await backend.list('notebook_page_links', { filters: [eq('source_node_id', sourceNodeId)] })).rows
}

export async function addManualPageLink(
  backend: DataBackend,
  input: { sourceNodeId: string; targetNodeId: string; linkText?: string | null },
): Promise<NotebookPageLink> {
  if (input.sourceNodeId === input.targetNodeId) throw new Error('Não é possível vincular uma página a ela mesma.')
  const existing = (
    await backend.list('notebook_page_links', {
      filters: [eq('source_node_id', input.sourceNodeId), eq('target_node_id', input.targetNodeId)],
      limit: 1,
    })
  ).rows[0]
  if (existing) return existing
  const [created] = await backend.insert('notebook_page_links', [
    {
      source_node_id: input.sourceNodeId,
      target_node_id: input.targetNodeId,
      source_block_id: null,
      target_block_id: null,
      link_text: input.linkText?.trim().slice(0, 300) || null,
    },
  ])
  return created
}

export async function removePageLink(backend: DataBackend, linkId: string): Promise<number> {
  return backend.remove('notebook_page_links', [eq('id', linkId)])
}
