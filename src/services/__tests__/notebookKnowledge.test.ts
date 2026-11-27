import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { buildInternalPageHref } from '@/lib/notebookGraph'
import { createNode, createNotebook } from '@/services/notebooks'
import {
  addManualPageLink,
  createNotebookTag,
  deleteNotebookTag,
  removePageLink,
  syncPageInternalLinks,
  toggleEntityTag,
  updateNotebookTag,
} from '@/services/notebookKnowledge'
import type { NotebookContentDoc } from '@/types/db'

describe('notebookKnowledge — tags e links internos (LocalBackend / Dexie)', () => {
  let backend: LocalBackend

  beforeEach(() => {
    backend = new LocalBackend(`test-kb-knowledge-${crypto.randomUUID()}`)
  })

  it('cria, edita, associa/desassocia e exclui tags respeitando unicidade case-insensitive', async () => {
    const nb = await createNotebook(backend, { title: 'Engenharia de Dados' })
    const page = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Modelagem Dimensional' })

    const tag = await createNotebookTag(backend, { name: 'SQL', color: '#B91C1C' })
    expect(tag.name).toBe('SQL')

    // Duplicata case-insensitive deve ser rejeitada pelas UNIQUE_RULES
    await expect(createNotebookTag(backend, { name: 'sql' })).rejects.toThrow()

    const updated = await updateNotebookTag(backend, tag.id, { name: 'SQL Avançado' })
    expect(updated?.name).toBe('SQL Avançado')

    // Toggle na página e no caderno
    expect(await toggleEntityTag(backend, { tagId: tag.id, nodeId: page.id })).toBe('added')
    expect(await toggleEntityTag(backend, { tagId: tag.id, notebookId: nb.id })).toBe('added')
    expect((await backend.list('notebook_tag_links')).rows).toHaveLength(2)

    expect(await toggleEntityTag(backend, { tagId: tag.id, nodeId: page.id })).toBe('removed')
    expect((await backend.list('notebook_tag_links')).rows).toHaveLength(1)

    await deleteNotebookTag(backend, tag.id)
    expect((await backend.list('notebook_tags')).rows).toHaveLength(0)
  })

  it('sincroniza links internos [[ do documento preservando vínculos manuais', async () => {
    const nb = await createNotebook(backend, { title: 'Analytics' })
    const p1 = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Página A' })
    const p2 = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Página B' })
    const p3 = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Página C' })

    // Vínculo manual (source_block_id === null)
    const manual = await addManualPageLink(backend, { sourceNodeId: p1.id, targetNodeId: p3.id })
    expect(manual.source_block_id).toBeNull()

    // Sincroniza documento com link inline para p2
    const docWithP2: NotebookContentDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'blk-1' },
          content: [
            {
              type: 'text',
              text: 'Página B',
              marks: [{ type: 'link', attrs: { href: buildInternalPageHref(nb.id, p2.id) } }],
            },
          ],
        },
      ],
    }

    const synced1 = await syncPageInternalLinks(backend, p1.id, docWithP2)
    expect(synced1).toHaveLength(2)
    expect(synced1.some((l) => l.target_node_id === p2.id && l.source_block_id === 'blk-1')).toBe(true)
    expect(synced1.some((l) => l.target_node_id === p3.id && l.source_block_id === null)).toBe(true)

    // Ao remover o link inline do documento, o link inline desaparece mas o manual permanece intacto
    const emptyDoc: NotebookContentDoc = { type: 'doc', content: [{ type: 'paragraph', attrs: { blockId: 'blk-1' }, content: [] }] }
    const synced2 = await syncPageInternalLinks(backend, p1.id, emptyDoc)
    expect(synced2).toHaveLength(1)
    expect(synced2[0].id).toBe(manual.id)

    // Remoção explícita do vínculo manual
    await removePageLink(backend, manual.id)
    expect((await backend.list('notebook_page_links')).rows).toHaveLength(0)
  })
})
