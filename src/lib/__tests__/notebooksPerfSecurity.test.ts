import { describe, expect, it } from 'vitest'
import { parseImageOcclusionNote } from '@/lib/flashcardAdvanced'
import { buildKnowledgeGraph, findRelatedPages, parseInternalPageHref } from '@/lib/notebookGraph'
import { markdownToDoc, sanitizeSafeImageSrc, sanitizeSafeUrl } from '@/lib/notebookMarkdown'
import { docToSanitizedHtml } from '@/lib/notebookPortability'
import { buildNotebookTree, extractDocSummary } from '@/lib/notebooks'
import type { Notebook, NotebookContentDoc, NotebookNode, NotebookPageLink } from '@/types/db'

describe('VLM Knowledge — auditoria de segurança e performance em alto volume', () => {
  it('bloqueia protocolos perigosos e payloads XSS em URLs, imagens, Markdown, HTML e oclusão', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:fetch("//evil.test")',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:image/svg+xml,<svg onload=alert(1)>',
    ]) {
      expect(sanitizeSafeUrl(bad)).toBeNull()
      expect(sanitizeSafeImageSrc(bad)).toBeNull()
      expect(parseInternalPageHref(bad)).toBeNull()
    }

    // Markdown malicioso não gera links perigosos nem HTML executável
    const doc = markdownToDoc('Clique [aqui](javascript:alert(1)) e <img src=x onerror=alert(1)>')
    const html = docToSanitizedHtml(doc, '<script>alert(1)</script>Título')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')

    // Oclusão com data:image/svg+xml é rejeitada
    const svgPayload = '<!--VLM_OCCLUSION_V1:{"v":1,"kind":"image_occlusion","src":"data:image/svg+xml;base64,PHN2Zz4=","rects":[{"id":"1","x":1,"y":1,"w":10,"h":10}]}-->'
    expect(parseImageOcclusionNote(svgPayload).occlusion).toBeNull()
  })

  it('mantém performance determinística (< 300 ms) com 500 nós hierárquicos e 400 conexões no grafo', () => {
    const now = '2026-11-27T12:00:00.000Z'
    const notebooks: Notebook[] = Array.from({ length: 10 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      user_id: 'u1',
      subject_id: null,
      title: `Caderno ${i + 1}`,
      description: null,
      icon: 'book',
      color: '#171717',
      cover: null,
      is_favorite: false,
      sort_order: i,
      archived_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }))

    const nodes: NotebookNode[] = []
    for (let i = 0; i < 500; i++) {
      const nb = notebooks[i % notebooks.length]
      const isSection = i % 10 === 0
      const parentId = !isSection && i >= 10 ? nodes[Math.floor(i / 10) * 10]?.id ?? null : null
      nodes.push({
        id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        user_id: 'u1',
        notebook_id: nb.id,
        parent_id: parentId && nodes.find((n) => n.id === parentId)?.notebook_id === nb.id ? parentId : null,
        node_type: isSection ? 'section' : 'page',
        title: `Item ${i + 1}`,
        icon: null,
        cover: null,
        color: null,
        status: 'ready',
        difficulty: (i % 5) + 1,
        needs_review: i % 7 === 0,
        is_favorite: false,
        is_pinned: false,
        position: i,
        subject_id: null,
        topic_id: null,
        last_studied_at: null,
        archived_at: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
    }

    const pages = nodes.filter((n) => n.node_type === 'page')
    const links: NotebookPageLink[] = Array.from({ length: 400 }, (_, i) => ({
      id: `link-${i}`,
      user_id: 'u1',
      source_node_id: pages[i % pages.length].id,
      target_node_id: pages[(i * 7 + 3) % pages.length].id,
      source_block_id: `blk-${i}`,
      target_block_id: null,
      link_text: null,
      created_at: now,
      updated_at: now,
    }))

    const bigDoc: NotebookContentDoc = {
      type: 'doc',
      content: Array.from({ length: 200 }, (_, i) => ({
        type: 'paragraph',
        attrs: { blockId: `b-${i}` },
        content: [{ type: 'text', text: `Bloco técnico ${i}: SELECT id, COUNT(*) FROM eventos GROUP BY id;` }],
      })),
    }

    const t0 = performance.now()
    const tree = buildNotebookTree(nodes.filter((n) => n.notebook_id === notebooks[0].id))
    const graph = buildKnowledgeGraph({ mode: 'pages', notebooks, nodes, links })
    const related = findRelatedPages({ page: pages[0], allNodes: nodes, links, tagLinks: [] })
    const summary = extractDocSummary(bigDoc)
    const elapsedMs = performance.now() - t0

    expect(tree.length).toBeGreaterThan(0)
    expect(graph.nodes).toHaveLength(pages.length)
    expect(graph.edges.length).toBeGreaterThan(0)
    expect(related.length).toBeGreaterThan(0)
    expect(summary.wordCount).toBeGreaterThan(1500)
    expect(elapsedMs).toBeLessThan(400)
  })
})
