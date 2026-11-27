import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import {
  buildNotebookJsonBundle,
  docToMarkdown,
  docToSanitizedHtml,
  executeNotebookImport,
  exportNotebookAsZipBlob,
  exportPageAsPdfBytes,
  planNotebookImportFromFile,
} from '@/lib/notebookPortability'
import { extractActiveReviewMetrics } from '@/lib/notebooks'
import { planImport, runImport } from '@/services/importData'
import { createNode, createNotebook } from '@/services/notebooks'
import type { NotebookContentDoc } from '@/types/db'

const SAMPLE_DOC: NotebookContentDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2, blockId: 'b1' }, content: [{ type: 'text', text: 'Window Functions & Estatística' }] },
    {
      type: 'codeBlock',
      attrs: { language: 'postgresql', title: 'Ranking', blockId: 'b2' },
      content: [{ type: 'text', text: 'SELECT id, RANK() OVER (ORDER BY score DESC)\nFROM resultados;' }],
    },
    { type: 'mathBlock', attrs: { formula: '\\bar{x} = \\frac{1}{n} \\sum x_i', caption: 'Média', blockId: 'b3' } },
    { type: 'mermaidBlock', attrs: { title: 'Pipeline', code: 'flowchart LR\n  A --> B', blockId: 'b4' } },
    {
      type: 'qaBlock',
      attrs: { question: 'Diferença entre RANK e DENSE_RANK?', open: false, blockId: 'b5' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'DENSE_RANK não pula posições após empates.' }] }],
    },
    {
      type: 'taskList',
      attrs: { blockId: 'b6' },
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Estudar sintaxe' }] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Praticar exercícios' }] }] },
      ],
    },
    {
      type: 'callout',
      attrs: { variant: 'error', title: 'Erro comum', blockId: 'b7' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> sem escape!' }] }],
    },
  ],
}

describe('notebookPortability — exportação, importação e backup global', () => {
  it('calcula métricas de revisão ativa e exporta Markdown, HTML sanitizado e PDF A4 válido', async () => {
    const metrics = extractActiveReviewMetrics(SAMPLE_DOC)
    expect(metrics).toEqual({ qaCount: 1, checklistTotal: 2, checklistDone: 1, errorBlocks: 1 })

    const md = docToMarkdown(SAMPLE_DOC, 'Guia SQL')
    expect(md).toContain('# Guia SQL')
    expect(md).toContain('```postgresql')
    expect(md).toContain('$$\n\\bar{x} = \\frac{1}{n} \\sum x_i\n$$')
    expect(md).toContain('```mermaid\nflowchart LR')
    expect(md).toContain('- [x] Estudar sintaxe')
    expect(md).toContain('- [ ] Praticar exercícios')

    const html = docToSanitizedHtml(SAMPLE_DOC, 'Guia <script>SQL</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('<!DOCTYPE html>')

    const pdfBytes = await exportPageAsPdfBytes('Guia SQL', SAMPLE_DOC, 'Caderno: Engenharia de Dados')
    expect(pdfBytes.byteLength).toBeGreaterThan(800)
    // Assinatura mágica %PDF-
    expect(String.fromCharCode(...pdfBytes.slice(0, 5))).toBe('%PDF-')
  })

  it('exporta caderno em ZIP (MD + JSON) e reimporta ZIP estilo Notion/Obsidian com prévia segura', async () => {
    const backend = new LocalBackend(`kb-port-${crypto.randomUUID()}`)
    const nb = await createNotebook(backend, { title: 'Dados & SQL' })
    const sec = await createNode(backend, { notebook_id: nb.id, node_type: 'section', title: 'PostgreSQL' })
    const page = await createNode(backend, {
      notebook_id: nb.id,
      parent_id: sec.id,
      node_type: 'page',
      title: 'Window Functions',
      initialDoc: SAMPLE_DOC,
    })

    const contents = (await backend.list('notebook_page_contents')).rows
    const bundle = buildNotebookJsonBundle({
      notebook: nb,
      nodes: [sec, page],
      contents,
      tags: [],
      tag_links: [],
      page_links: [],
    })
    const zipBlob = await exportNotebookAsZipBlob(bundle)
    expect(zipBlob.size).toBeGreaterThan(100)

    // Simula exportação ZIP do Notion/Obsidian (com sufixo hex do Notion + arquivo JS que deve ser ignorado)
    const notionZip = new JSZip()
    notionZip.file('Banco de Dados 0123456789abcdef0123456789abcdef/Joins 0123456789abcdef0123456789abcdef.md', '---\ntitle: Guia de Joins\n---\n\nVeja [[Window Functions|WF]]')
    notionZip.file('malicioso.js', 'alert(1)')
    const notionBytes = await notionZip.generateAsync({ type: 'uint8array' })
    const notionFile = new File([new Uint8Array(notionBytes)], 'export-notion.zip', { type: 'application/zip' })

    const plan = await planNotebookImportFromFile(notionFile)
    expect(plan.sectionsCount).toBe(1)
    expect(plan.pagesCount).toBe(1)
    expect(plan.items[0].title).toBe('Banco de Dados')
    expect(plan.items[1].title).toBe('Guia de Joins')
    expect(plan.warnings.length).toBe(1)

    const imported = await executeNotebookImport(backend, plan, { newNotebookTitle: 'Importado do Notion' })
    expect(imported.createdCount).toBe(2)
    expect((await backend.list('notebooks')).rows).toHaveLength(2)
  })

  it('integra Meus Cadernos ao backup/restauração global (importData.ts) remapeando IDs, links internos, tags e flashcards', async () => {
    const backend = new LocalBackend(`kb-global-backup-${crypto.randomUUID()}`)
    const oldNb = '11111111-1111-4111-8111-111111111111'
    const oldSec = '22222222-2222-4222-8222-222222222222'
    const oldP1 = '33333333-3333-4333-8333-333333333333'
    const oldP2 = '44444444-4444-4444-8444-444444444444'
    const oldTag = '55555555-5555-4555-8555-555555555555'
    const oldDeck = '66666666-6666-4666-8666-666666666666'
    const oldCard = '77777777-7777-4777-8777-777777777777'

    const backupPkg = {
      flashcard_decks: [{ id: oldDeck, name: 'Baralho SQL' }],
      flashcards: [{ id: oldCard, deck_id: oldDeck, front: 'O que é CTE?', back: 'Common Table Expression' }],
      notebooks: [{ id: oldNb, title: 'Caderno SQL', color: '#B91C1C' }],
      notebook_nodes: [
        { id: oldP1, notebook_id: oldNb, parent_id: oldSec, node_type: 'page', title: 'CTEs', needs_review: true, difficulty: 4 },
        { id: oldSec, notebook_id: oldNb, parent_id: null, node_type: 'section', title: 'Consultas' },
        { id: oldP2, notebook_id: oldNb, parent_id: oldSec, node_type: 'page', title: 'Subqueries' },
      ],
      notebook_page_contents: [
        {
          node_id: oldP1,
          content_json: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { blockId: 'blk-1' },
                content: [{ type: 'text', text: 'Subqueries', marks: [{ type: 'link', attrs: { href: `/cadernos/${oldNb}/pagina/${oldP2}` } }] }],
              },
            ],
          },
        },
      ],
      notebook_tags: [{ id: oldTag, name: 'SQL', color: '#171717' }],
      notebook_tag_links: [{ tag_id: oldTag, node_id: oldP1, notebook_id: null }],
      notebook_page_links: [{ source_node_id: oldP1, target_node_id: oldP2, source_block_id: 'blk-1' }],
      notebook_flashcard_links: [{ flashcard_id: oldCard, notebook_id: oldNb, node_id: oldP1, block_id: 'blk-1' }],
      notebook_templates: [{ name: 'Meu Modelo', content_json: { type: 'doc', content: [] } }],
    }

    const plan = planImport(backupPkg)
    expect(plan.counts).toMatchObject({
      notebooks: 1,
      notebook_nodes: 3,
      notebook_page_contents: 1,
      notebook_tags: 1,
      notebook_tag_links: 1,
      notebook_page_links: 1,
      notebook_flashcard_links: 1,
      notebook_templates: 1,
    })

    await runImport(backend, plan)

    const [nb] = (await backend.list('notebooks')).rows
    expect(nb.id).not.toBe(oldNb)
    const nodes = (await backend.list('notebook_nodes')).rows
    const p1 = nodes.find((n) => n.title === 'CTEs')!
    const p2 = nodes.find((n) => n.title === 'Subqueries')!
    const sec = nodes.find((n) => n.title === 'Consultas')!
    expect(p1.parent_id).toBe(sec.id)
    expect(p1.needs_review).toBe(true)
    expect(p1.difficulty).toBe(4)

    // Link interno dentro do JSON foi remapeado para os novos UUIDs
    const [content] = (await backend.list('notebook_page_contents')).rows
    const href = content.content_json.content[0].content?.[0].marks?.[0].attrs?.href
    expect(href).toBe(`/cadernos/${nb.id}/pagina/${p2.id}`)

    // Vínculo com flashcard preservado após restauração
    const [cardLink] = (await backend.list('notebook_flashcard_links')).rows
    expect(cardLink.node_id).toBe(p1.id)
    expect(cardLink.notebook_id).toBe(nb.id)

    // Reimportar o mesmo pacote não falha por duplicata na tag 'SQL'
    await runImport(backend, planImport(backupPkg))
    expect((await backend.list('notebook_tags')).rows).toHaveLength(1)
    expect((await backend.list('notebooks')).rows).toHaveLength(2)
  })
})
