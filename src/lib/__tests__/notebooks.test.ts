import { describe, expect, it } from 'vitest'
import {
  buildNotebookTree,
  countWords,
  docToPlainText,
  ensureBlockIds,
  estimateReadingMinutes,
  extractDocSummary,
  flattenNotebookTree,
  nodeBreadcrumb,
  notebookDescendantIds,
  plainTextToDoc,
  wouldCreateCycle,
} from '@/lib/notebooks'
import { notebookNodeSchema, notebookSchema, notebookTagSchema, validate } from '@/lib/validation'
import {
  AUTO_SNAPSHOT_INTERVAL_MS,
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
  shouldCreateAutoSnapshot,
} from '@/lib/notebookDrafts'
import { extractHeadings, markdownToDoc, sanitizeSafeImageSrc, sanitizeSafeUrl } from '@/lib/notebookMarkdown'
import { BUILTIN_TEMPLATES } from '@/lib/notebookTemplates'
import { CODE_LANGUAGES, getNotebookLowlight } from '@/pages/notebooks/editor/languages'
import { filterSlashItems } from '@/pages/notebooks/editor/SlashCommandMenu'
import type { NotebookNode } from '@/types/db'

function mkNode(partial: Partial<NotebookNode> & { id: string; title: string }): NotebookNode {
  const now = '2026-11-27T12:00:00.000Z'
  return {
    user_id: 'u1',
    notebook_id: 'nb1',
    parent_id: null,
    node_type: 'page',
    icon: null,
    cover: null,
    color: null,
    status: 'draft',
    difficulty: null,
    needs_review: false,
    is_favorite: false,
    is_pinned: false,
    position: 0,
    subject_id: null,
    topic_id: null,
    last_studied_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...partial,
  }
}

describe('notebooks domain (árvore, ciclos, serialização e validação)', () => {
  it('monta hierarquia em profundidade ilimitada com ordenação determinística (fixados -> position -> título)', () => {
    const nodes = [
      mkNode({ id: 'p2', title: 'Beta', position: 1 }),
      mkNode({ id: 'p1', title: 'Alfa', position: 0 }),
      mkNode({ id: 'pinned', title: 'Fixada', position: 99, is_pinned: true }),
      mkNode({ id: 's1', title: 'Seção SQL', node_type: 'section', position: 2 }),
      mkNode({ id: 's1-1', title: 'Window Functions', node_type: 'section', parent_id: 's1', position: 0 }),
      mkNode({ id: 's1-1-p1', title: 'RANK vs DENSE_RANK', parent_id: 's1-1', position: 0 }),
      mkNode({ id: 's1-1-p1-sub', title: 'Exercícios práticos', parent_id: 's1-1-p1', position: 0 }),
    ]
    const tree = buildNotebookTree(nodes)
    expect(tree.map((n) => n.id)).toEqual(['pinned', 'p1', 'p2', 's1'])

    const flat = flattenNotebookTree(tree)
    expect(flat.map((n) => [n.id, n.depth])).toEqual([
      ['pinned', 0],
      ['p1', 0],
      ['p2', 0],
      ['s1', 0],
      ['s1-1', 1],
      ['s1-1-p1', 2],
      ['s1-1-p1-sub', 3],
    ])

    const collapsed = flattenNotebookTree(tree, new Set(['s1-1']))
    expect(collapsed.map((n) => n.id)).toEqual(['pinned', 'p1', 'p2', 's1', 's1-1'])
  })

  it('detecta ciclos hierárquicos e calcula descendentes e breadcrumbs', () => {
    const nodes = [
      mkNode({ id: 'a', title: 'A', node_type: 'section' }),
      mkNode({ id: 'b', title: 'B', node_type: 'section', parent_id: 'a' }),
      mkNode({ id: 'c', title: 'C', node_type: 'page', parent_id: 'b' }),
      mkNode({ id: 'd', title: 'D', node_type: 'page' }),
    ]
    expect([...notebookDescendantIds(nodes, 'a')].sort()).toEqual(['b', 'c'])
    expect(wouldCreateCycle(nodes, 'a', 'a')).toBe(true)
    expect(wouldCreateCycle(nodes, 'a', 'b')).toBe(true)
    expect(wouldCreateCycle(nodes, 'a', 'c')).toBe(true)
    expect(wouldCreateCycle(nodes, 'a', 'd')).toBe(false)
    expect(wouldCreateCycle(nodes, 'a', null)).toBe(false)

    const byId = new Map(nodes.map((n) => [n.id, n]))
    expect(nodeBreadcrumb(byId, 'c').map((n) => n.title)).toEqual(['A', 'B', 'C'])
  })

  it('serializa texto em JSON estruturado com blockId estável e extrai texto pesquisável', () => {
    const doc = plainTextToDoc('Window Functions\nSELECT RANK() OVER (ORDER BY x)\n')
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(3)
    const firstId = doc.content[0].attrs?.blockId
    expect(typeof firstId).toBe('string')

    // ensureBlockIds preserva IDs existentes e gera para blocos sem ID
    const ensured = ensureBlockIds({
      type: 'doc',
      content: [
        doc.content[0],
        { type: 'paragraph', content: [{ type: 'text', text: 'Novo bloco' }] },
      ],
    })
    expect(ensured.content[0].attrs?.blockId).toBe(firstId)
    expect(typeof ensured.content[1].attrs?.blockId).toBe('string')

    const summary = extractDocSummary(doc)
    expect(summary.text).toContain('SELECT RANK() OVER (ORDER BY x)')
    expect(summary.wordCount).toBe(countWords(summary.text))
    expect(summary.readingMinutes).toBe(estimateReadingMinutes(summary.wordCount))
    expect(docToPlainText({ type: 'doc', content: [] })).toBe('')
    expect(estimateReadingMinutes(0)).toBe(0)
    expect(estimateReadingMinutes(450)).toBe(3)
  })

  it('valida cadernos, nós e tags com Zod respeitando restrições de segurança', () => {
    expect(validate(notebookSchema, { title: 'SQL', color: '#B91C1C', cover: 'preset:grid' }).errors).toBeNull()
    expect(validate(notebookSchema, { title: '   ', color: '#171717' }).errors?.title).toBeTruthy()
    expect(validate(notebookSchema, { title: 'XSS', color: '#171717', cover: 'javascript:alert(1)' }).errors?.cover).toBeTruthy()
    expect(validate(notebookNodeSchema, { title: 'Página 1', node_type: 'page' }).errors).toBeNull()
    expect(validate(notebookTagSchema, { name: 'PostgreSQL', color: '#171717' }).errors).toBeNull()
  })

  it('gera todos os 8 templates nativos com blockId estável e extrai sumário + texto de blocos especiais', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(8)
    for (const tpl of BUILTIN_TEMPLATES) {
      const doc = tpl.build()
      expect(doc.type).toBe('doc')
      expect(doc.content.length).toBeGreaterThan(0)
      for (const block of doc.content) {
        expect(typeof block.attrs?.blockId).toBe('string')
      }
    }

    const techDoc = BUILTIN_TEMPLATES.find((t) => t.id === 'tech_doc')!.build()
    const headings = extractHeadings(techDoc)
    expect(headings.map((h) => h.text)).toContain('Sintaxe')
    expect(headings.map((h) => h.text)).toContain('Boas práticas')

    const customText = docToPlainText({
      type: 'doc',
      content: [
        { type: 'callout', attrs: { variant: 'definition', title: 'Window Function' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Opera sobre janelas.' }] }] },
        { type: 'qaBlock', attrs: { question: 'RANK vs DENSE_RANK?' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'RANK pula posições.' }] }] },
        { type: 'glossaryBlock', attrs: { title: 'Glossário', entries: [{ id: '1', term: 'CTE', definition: 'Common Table Expression' }] } },
      ],
    })
    expect(customText).toContain('Window Function')
    expect(customText).toContain('RANK vs DENSE_RANK?')
    expect(customText).toContain('CTE: Common Table Expression')
  })

  it('importa Markdown preservando indentação de código, tabelas, checklists e bloqueando URLs perigosas', () => {
    const md = [
      '# Guia SQL',
      '',
      'Veja [docs](https://postgresql.org) e [xss](javascript:alert(1)).',
      '',
      '- [x] Aprender OVER()',
      '- [ ] Praticar CTE',
      '',
      '```sql',
      'SELECT',
      '    id,',
      '    RANK() OVER (ORDER BY valor DESC)',
      'FROM vendas;',
      '```',
      '',
      '| Função | Pula empate? |',
      '| --- | --- |',
      '| RANK | Sim |',
      '| DENSE_RANK | Não |',
    ].join('\n')

    const doc = markdownToDoc(md)
    expect(extractHeadings(doc)).toHaveLength(1)
    const code = doc.content.find((n) => n.type === 'codeBlock')!
    expect(code.attrs?.language).toBe('sql')
    expect(code.content?.[0]?.text).toContain('    id,\n    RANK()')
    expect(doc.content.some((n) => n.type === 'taskList')).toBe(true)
    expect(doc.content.some((n) => n.type === 'table')).toBe(true)

    // Link perigoso javascript: não recebe mark de link
    const para = doc.content.find((n) => n.type === 'paragraph')!
    const xssNode = para.content?.find((n) => n.text === 'xss')
    expect(xssNode?.marks).toBeUndefined()
    const safeNode = para.content?.find((n) => n.text === 'docs')
    expect(safeNode?.marks?.[0]?.attrs?.href).toBe('https://postgresql.org')

    expect(sanitizeSafeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeSafeUrl('https://example.com')).toBe('https://example.com')
    expect(sanitizeSafeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(sanitizeSafeImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('registra as 16 linguagens técnicas no lowlight, filtra slash menu e gerencia rascunhos locais', () => {
    expect(CODE_LANGUAGES).toHaveLength(16)
    const lowlight = getNotebookLowlight()
    for (const lang of CODE_LANGUAGES) {
      expect(lowlight.registered(lang.id), lang.id).toBe(true)
    }

    expect(filterSlashItems('def').some((i) => i.id === 'callout-definition')).toBe(true)
    expect(filterSlashItems('tabela').some((i) => i.id === 'table')).toBe(true)

    saveLocalDraft({
      nodeId: 'page-1',
      title: 'Rascunho',
      contentJson: plainTextToDoc('Texto não sincronizado'),
      baseRevision: 2,
      savedAt: '2026-11-27T15:00:00.000Z',
    })
    expect(loadLocalDraft('page-1')?.title).toBe('Rascunho')
    clearLocalDraft('page-1')
    expect(loadLocalDraft('page-1')).toBeNull()

    const now = Date.parse('2026-11-27T15:10:00.000Z')
    expect(shouldCreateAutoSnapshot(null, now)).toBe(true)
    expect(shouldCreateAutoSnapshot(new Date(now - 60_000).toISOString(), now)).toBe(false)
    expect(shouldCreateAutoSnapshot(new Date(now - AUTO_SNAPSHOT_INTERVAL_MS - 1000).toISOString(), now)).toBe(true)
  })
})
