import { describe, expect, it } from 'vitest'
import {
  buildInternalPageHref,
  buildKnowledgeGraph,
  extractInternalLinksFromDoc,
  findRelatedPages,
  parseInternalPageHref,
} from '@/lib/notebookGraph'
import { filterLinkablePages } from '@/pages/notebooks/editor/WikiLinkPopover'
import type { Notebook, NotebookContentDoc, NotebookNode, NotebookPageLink, NotebookTagLink } from '@/types/db'

const NB_1 = '11111111-1111-4111-8111-111111111111'
const NB_2 = '22222222-2222-4222-8222-222222222222'
const P_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SUBJ_1 = '99999999-9999-4999-8999-999999999999'
const TAG_1 = '77777777-7777-4777-8777-777777777777'

function makeNotebook(overrides: Partial<Notebook> & { id: string; title: string }): Notebook {
  const now = '2026-11-27T12:00:00.000Z'
  return {
    user_id: 'u1',
    description: null,
    icon: 'book',
    color: '#171717',
    cover: null,
    subject_id: null,
    is_favorite: false,
    sort_order: 0,
    archived_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeNode(overrides: Partial<NotebookNode> & { id: string; notebook_id: string; title: string }): NotebookNode {
  const now = '2026-11-27T12:00:00.000Z'
  return {
    user_id: 'u1',
    parent_id: null,
    node_type: 'page',
    icon: null,
    cover: null,
    color: null,
    status: 'ready',
    subject_id: null,
    topic_id: null,
    is_favorite: false,
    is_pinned: false,
    needs_review: false,
    difficulty: null,
    position: 0,
    last_studied_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeLink(overrides: Partial<NotebookPageLink> & { id: string; source_node_id: string; target_node_id: string }): NotebookPageLink {
  const now = '2026-11-27T12:00:00.000Z'
  return {
    user_id: 'u1',
    source_block_id: 'blk-1',
    target_block_id: null,
    link_text: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('notebookGraph — links internos, grafo e páginas relacionadas', () => {
  it('constrói e interpreta URLs internas de página e bloco com segurança', () => {
    const href = buildInternalPageHref(NB_1, P_2, 'blk-42')
    expect(href).toBe(`/cadernos/${NB_1}/pagina/${P_2}?bloco=blk-42`)
    expect(parseInternalPageHref(href)).toEqual({
      notebookId: NB_1,
      nodeId: P_2,
      blockId: 'blk-42',
    })
    expect(parseInternalPageHref(`/cadernos/${NB_1}/pagina/${P_2}`)).toEqual({
      notebookId: NB_1,
      nodeId: P_2,
      blockId: null,
    })
    expect(parseInternalPageHref('https://example.com')).toBeNull()
    expect(parseInternalPageHref('javascript:alert(1)')).toBeNull()
  })

  it('extrai links internos do JSON estruturado preservando sourceBlockId e bloqueando auto-link sem bloco alvo', () => {
    const doc: NotebookContentDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'blk-a' },
          content: [
            { type: 'text', text: 'Ver ' },
            {
              type: 'text',
              text: 'Window Functions',
              marks: [{ type: 'link', attrs: { href: buildInternalPageHref(NB_1, P_2) } }],
            },
            { type: 'text', text: ' e ' },
            {
              type: 'text',
              text: 'Auto sem bloco (ignorado)',
              marks: [{ type: 'link', attrs: { href: buildInternalPageHref(NB_1, P_1) } }],
            },
            {
              type: 'text',
              text: 'Auto com bloco (válido)',
              marks: [{ type: 'link', attrs: { href: buildInternalPageHref(NB_1, P_1, 'blk-alvo') } }],
            },
            {
              type: 'text',
              text: 'Externo',
              marks: [{ type: 'link', attrs: { href: 'https://postgresql.org' } }],
            },
          ],
        },
      ],
    }

    const extracted = extractInternalLinksFromDoc(doc, P_1)
    expect(extracted).toHaveLength(2)
    expect(extracted[0]).toEqual({
      targetNotebookId: NB_1,
      targetNodeId: P_2,
      targetBlockId: null,
      sourceBlockId: 'blk-a',
      linkText: 'Window Functions',
    })
    expect(extracted[1]).toEqual({
      targetNotebookId: NB_1,
      targetNodeId: P_1,
      targetBlockId: 'blk-alvo',
      sourceBlockId: 'blk-a',
      linkText: 'Auto com bloco (válido)',
    })
  })

  it('gera grafo determinístico nos modos páginas e cadernos, respeitando filtros e foco', () => {
    const notebooks = [
      makeNotebook({ id: NB_1, title: 'SQL Avançado', subject_id: SUBJ_1 }),
      makeNotebook({ id: NB_2, title: 'Python Dados' }),
    ]
    const nodes = [
      makeNode({ id: P_1, notebook_id: NB_1, title: 'CTEs', subject_id: SUBJ_1 }),
      makeNode({ id: P_2, notebook_id: NB_1, title: 'Window Functions', subject_id: SUBJ_1 }),
      makeNode({ id: P_3, notebook_id: NB_2, title: 'Pandas Merge' }),
    ]
    const links = [
      makeLink({ id: 'l1', source_node_id: P_1, target_node_id: P_2 }),
      makeLink({ id: 'l2', source_node_id: P_2, target_node_id: P_3 }),
    ]
    const tagLinks: NotebookTagLink[] = [
      { id: 'tl1', user_id: 'u1', tag_id: TAG_1, notebook_id: null, node_id: P_2, created_at: '2026-11-27T12:00:00.000Z', updated_at: '2026-11-27T12:00:00.000Z' },
    ]

    const full = buildKnowledgeGraph({ mode: 'pages', notebooks, nodes, links })
    expect(full.nodes).toHaveLength(3)
    expect(full.edges).toHaveLength(2)
    const p2Node = full.nodes.find((n) => n.id === P_2)!
    expect(p2Node.inDegree).toBe(1)
    expect(p2Node.outDegree).toBe(1)
    expect(p2Node.degree).toBe(2)

    // Filtro por tag
    const byTag = buildKnowledgeGraph({ mode: 'pages', notebooks, nodes, links, tagLinks, filterTagId: TAG_1 })
    expect(byTag.nodes.map((n) => n.id)).toEqual([P_2])

    // Modo foco em P_1 inclui apenas P_1 e vizinho direto P_2
    const focused = buildKnowledgeGraph({ mode: 'pages', notebooks, nodes, links, focusNodeId: P_1 })
    expect(focused.nodes.map((n) => n.id).sort()).toEqual([P_1, P_2])

    // Modo cadernos agrega conexões entre cadernos diferentes
    const nbGraph = buildKnowledgeGraph({ mode: 'notebooks', notebooks, nodes, links })
    expect(nbGraph.nodes).toHaveLength(2)
    expect(nbGraph.edges).toEqual([{ id: `${NB_1}->${NB_2}`, source: NB_1, target: NB_2, weight: 1 }])
  })

  it('identifica páginas relacionadas deterministicamente por links, tags e matéria entre cadernos', () => {
    const nodes = [
      makeNode({ id: P_1, notebook_id: NB_1, title: 'CTEs', subject_id: SUBJ_1 }),
      makeNode({ id: P_2, notebook_id: NB_2, title: 'Window Functions', subject_id: SUBJ_1 }),
      makeNode({ id: P_3, notebook_id: NB_2, title: 'Pandas Merge' }),
    ]
    const links = [makeLink({ id: 'l1', source_node_id: P_2, target_node_id: P_1 })]
    const tagLinks: NotebookTagLink[] = [
      { id: 'tl1', user_id: 'u1', tag_id: TAG_1, notebook_id: null, node_id: P_1, created_at: '2026-11-27T12:00:00.000Z', updated_at: '2026-11-27T12:00:00.000Z' },
      { id: 'tl2', user_id: 'u1', tag_id: TAG_1, notebook_id: null, node_id: P_3, created_at: '2026-11-27T12:00:00.000Z', updated_at: '2026-11-27T12:00:00.000Z' },
    ]

    const related = findRelatedPages({ page: nodes[0], allNodes: nodes, links, tagLinks })
    expect(related).toHaveLength(2)
    expect(related[0].node.id).toBe(P_2)
    expect(related[0].reasons).toContain('Backlink')
    expect(related[0].reasons).toContain('Mesma matéria')
    expect(related[1].node.id).toBe(P_3)
    expect(related[1].reasons).toContain('Tag em comum')
  })

  it('filtra opções de autocomplete [[ ignorando acentos e excluindo a própria página', () => {
    const pages = [
      { id: P_1, notebookId: NB_1, notebookTitle: 'Estatística', title: 'Distribuição Normal' },
      { id: P_2, notebookId: NB_1, notebookTitle: 'SQL', title: 'Função RANK' },
    ]
    const filtered = filterLinkablePages(pages, 'funcao', P_1)
    expect(filtered.map((p) => p.id)).toEqual([P_2])
  })
})
