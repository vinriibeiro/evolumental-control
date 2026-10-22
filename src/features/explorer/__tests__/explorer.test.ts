import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { fetchAll } from '@/hooks/data'
import { parseOutline } from '@/pages/subjects/topicOps'
import { weightedProgress } from '@/lib/tree'
import { buildExplorer, canDrop, filterKeys, keyOf, pathTo, planMove, type ExplorerIndex } from '../model'
import { createFolder, createOutline, duplicateNode, moveNode, setFavorite } from '../service'
import { countNodes, fromOutline, indent, mergeWithPrevious, moveTo, outdent, remove, rename, toggleFolder, toTopicRows } from '../outline'

let backend: LocalBackend
let dbn = 0

beforeEach(() => {
  backend = new LocalBackend(`explorer-${++dbn}`)
})

async function index(): Promise<ExplorerIndex> {
  const [f, s, t] = await Promise.all([fetchAll(backend, 'study_folders'), fetchAll(backend, 'subjects'), fetchAll(backend, 'topics')])
  return buildExplorer(f, s, t)
}

async function seed() {
  const area = await createFolder(backend, { name: 'Concurso SEFAZ', kind: 'area' })
  const direito = await createFolder(backend, { name: 'Direito', kind: 'folder', parent_id: area.id })
  const tec = await createFolder(backend, { name: 'Tecnologia', kind: 'folder', parent_id: area.id, sort_order: 1 })
  const [consti] = await backend.insert('subjects', [{ name: 'Direito Constitucional', folder_id: direito.id }])
  const [bd] = await backend.insert('subjects', [{ name: 'Banco de Dados', folder_id: tec.id }])
  const [sqlFolder] = await backend.insert('topics', [{ subject_id: bd.id, name: 'SQL', kind: 'folder' }])
  const [joins] = await backend.insert('topics', [{ subject_id: bd.id, parent_id: sqlFolder.id, name: 'JOINs' }])
  const [select] = await backend.insert('topics', [{ subject_id: bd.id, parent_id: sqlFolder.id, name: 'SELECT', sort_order: 1 }])
  return { area, direito, tec, consti, bd, sqlFolder, joins, select }
}

describe('árvore do Explorador', () => {
  it('monta área › pasta › matéria › pasta › tópico e o caminho (breadcrumbs)', async () => {
    const s = await seed()
    const ix = await index()
    expect(ix.roots.map((n) => n.name)).toEqual(['Concurso SEFAZ'])
    const path = pathTo(ix, keyOf('topic', s.joins.id)).map((n) => n.name)
    expect(path).toEqual(['Concurso SEFAZ', 'Tecnologia', 'Banco de Dados', 'SQL', 'JOINs'])
    expect(ix.byKey.get(keyOf('topic', s.joins.id))!.depth).toBe(4)
  })

  it('dados antigos (sem pasta) continuam visíveis na raiz', async () => {
    await backend.insert('subjects', [{ name: 'Matéria antiga' }])
    const ix = await index()
    expect(ix.roots.map((n) => n.name)).toEqual(['Matéria antiga'])
  })

  it('pastas dentro da matéria não contam no progresso', async () => {
    const s = await seed()
    await backend.update('topics', [eq('id', s.joins.id)], { status: 'completed' })
    const topics = await fetchAll(backend, 'topics', { filters: [eq('subject_id', s.bd.id)] })
    expect(weightedProgress(topics)).toMatchObject({ done: 1, total: 2, percent: 50 })
  })

  it('pesquisa sem acento mostra a correspondência com seus ancestrais', async () => {
    const s = await seed()
    await backend.insert('topics', [{ subject_id: s.consti.id, name: 'Organização do Estado' }])
    const keys = filterKeys(await index(), { term: 'organizacao' })!
    const names = [...keys].map((k) => k.split(':')[0])
    expect(keys.has(keyOf('subject', s.consti.id))).toBe(true)
    expect(keys.has(keyOf('folder', s.area.id))).toBe(true)
    expect(keys.has(keyOf('subject', s.bd.id))).toBe(false)
    expect(names).toContain('topic')
  })

  it('favoritos filtram a árvore e mostram o conteúdo da pasta favorita', async () => {
    const s = await seed()
    await setFavorite(backend, [(await index()).byKey.get(keyOf('folder', s.tec.id))!], true)
    const keys = filterKeys(await index(), { favoritesOnly: true })!
    expect(keys.has(keyOf('topic', s.joins.id))).toBe(true)
    expect(keys.has(keyOf('folder', s.direito.id))).toBe(false)
  })

  it('arquivados ficam ocultos por padrão, com tudo o que contêm', async () => {
    const s = await seed()
    await backend.update('subjects', [eq('id', s.bd.id)], { status: 'archived' })
    const ix = await index()
    expect(filterKeys(ix, {})!.has(keyOf('topic', s.joins.id))).toBe(false)
    expect(filterKeys(ix, { showArchived: true })).toBeNull()
  })
})

describe('mover e reorganizar', () => {
  it('move matéria para outra pasta e para a raiz', async () => {
    const s = await seed()
    let ix = await index()
    await moveNode(backend, ix, ix.byKey.get(keyOf('subject', s.bd.id))!, ix.byKey.get(keyOf('folder', s.direito.id))!, 'inside')
    expect((await backend.get('subjects', s.bd.id))!.folder_id).toBe(s.direito.id)
    ix = await index()
    await moveNode(backend, ix, ix.byKey.get(keyOf('subject', s.bd.id))!, null, 'inside')
    expect((await backend.get('subjects', s.bd.id))!.folder_id).toBeNull()
  })

  it('reordena irmãos ao soltar antes de outro item', async () => {
    const s = await seed()
    const ix = await index()
    await moveNode(backend, ix, ix.byKey.get(keyOf('topic', s.select.id))!, ix.byKey.get(keyOf('topic', s.joins.id))!, 'before')
    const after = await index()
    expect(after.byKey.get(keyOf('topic', s.sqlFolder.id))!.children.map((n) => n.name)).toEqual(['SELECT', 'JOINs'])
  })

  it('move tópico com subtópicos para outra matéria (subárvore acompanha)', async () => {
    const s = await seed()
    const [sub] = await backend.insert('topics', [{ subject_id: s.bd.id, parent_id: s.joins.id, name: 'LEFT JOIN' }])
    const ix = await index()
    await moveNode(backend, ix, ix.byKey.get(keyOf('topic', s.joins.id))!, ix.byKey.get(keyOf('subject', s.consti.id))!, 'inside')
    expect((await backend.get('topics', s.joins.id))!).toMatchObject({ subject_id: s.consti.id, parent_id: null })
    expect((await backend.get('topics', sub.id))!).toMatchObject({ subject_id: s.consti.id, parent_id: s.joins.id })
  })

  it('impede ciclos: pasta dentro de descendente, tópico dentro do próprio subtópico', async () => {
    const s = await seed()
    const ix = await index()
    const area = ix.byKey.get(keyOf('folder', s.direito.id))!
    const [sub] = await backend.insert('study_folders', [{ name: 'Sub', parent_id: s.direito.id }])
    const ix2 = await index()
    expect(canDrop(ix2, ix2.byKey.get(keyOf('folder', s.direito.id))!, ix2.byKey.get(keyOf('folder', sub.id))!, 'inside').ok).toBe(false)
    expect(() => planMove(ix2, ix2.byKey.get(keyOf('topic', s.sqlFolder.id))!, ix2.byKey.get(keyOf('topic', s.joins.id))!, 'inside')).toThrow(/dentro dele mesmo/)
    // O backend também recusa, mesmo sem passar pelo modelo.
    await expect(backend.update('study_folders', [eq('id', area.id)], { parent_id: sub.id })).rejects.toThrow(/dentro dela mesma/)
    await expect(backend.update('topics', [eq('id', s.sqlFolder.id)], { parent_id: s.joins.id })).rejects.toThrow(/dentro dele mesmo/)
  })

  it('recusa combinações inválidas de tipo', async () => {
    const s = await seed()
    const ix = await index()
    const topic = ix.byKey.get(keyOf('topic', s.joins.id))!
    const folder = ix.byKey.get(keyOf('folder', s.direito.id))!
    const subject = ix.byKey.get(keyOf('subject', s.bd.id))!
    const area = ix.byKey.get(keyOf('folder', s.area.id))!
    expect(canDrop(ix, topic, folder, 'inside').ok).toBe(false)
    expect(canDrop(ix, topic, null, 'inside').ok).toBe(false)
    expect(canDrop(ix, subject, topic, 'inside').ok).toBe(false)
    expect(canDrop(ix, folder, subject, 'inside').ok).toBe(false)
    expect(canDrop(ix, area, folder, 'inside').ok).toBe(false)
  })
})

describe('excluir e duplicar', () => {
  it('excluir pasta remove subpastas, mas matérias, tópicos e sessões continuam (na raiz)', async () => {
    const s = await seed()
    const [session] = await backend.insert('study_sessions', [
      { subject_id: s.bd.id, topic_id: s.joins.id, status: 'completed', started_at: '2026-10-20T10:00:00Z', ended_at: '2026-10-20T11:00:00Z' },
    ])
    await backend.remove('study_folders', [eq('id', s.area.id)])
    expect(await fetchAll(backend, 'study_folders')).toHaveLength(0)
    expect((await backend.get('subjects', s.bd.id))!.folder_id).toBeNull()
    expect(await backend.get('topics', s.joins.id)).not.toBeNull()
    expect((await backend.get('study_sessions', session.id))!.topic_id).toBe(s.joins.id)
    expect((await index()).roots.map((n) => n.name).sort()).toEqual(['Banco de Dados', 'Direito Constitucional'])
  })

  it('duplica uma pasta com matérias e tópicos, sem copiar histórico', async () => {
    const s = await seed()
    await backend.insert('study_sessions', [{ subject_id: s.bd.id, status: 'completed', started_at: '2026-10-20T10:00:00Z', ended_at: '2026-10-20T11:00:00Z' }])
    const ix = await index()
    const n = await duplicateNode(backend, ix.byKey.get(keyOf('folder', s.tec.id))!)
    expect(n).toBe(5) // pasta + matéria + pasta SQL + 2 tópicos
    const after = await index()
    const copy = after.roots[0].children.find((c) => c.name === 'Tecnologia (cópia)')!
    expect(copy.children[0].name).toBe('Banco de Dados')
    expect(copy.children[0].children[0].children.map((c) => c.name)).toEqual(['JOINs', 'SELECT'])
    expect(await fetchAll(backend, 'study_sessions')).toHaveLength(1)
  })
})

describe('prévia editável do edital', () => {
  const text = `Banco de Dados
  Modelagem
  SQL
    SELECT
    JOIN
    GROUP BY
  Normalização`

  it('converte, edita e grava a hierarquia revisada', async () => {
    let tree = fromOutline(parseOutline(text))
    const bd = tree[0]
    const sql = bd.children[1]
    tree = toggleFolder(tree, sql.id)
    tree = rename(tree, sql.children[1].id, 'JOINs')
    tree = mergeWithPrevious(tree, sql.children[2].id) // GROUP BY junta-se a JOINs
    tree = remove(tree, bd.children[2].id) // Normalização
    tree = outdent(tree, sql.id) // SQL sobe para a raiz
    expect(countNodes(tree)).toEqual({ total: 5, folders: 1 })
    const [subject] = await backend.insert('subjects', [{ name: 'BD' }])
    expect(await createOutline(backend, tree, subject.id, null, 0)).toBe(5)
    const ix = await index()
    const sqlNode = ix.byKey.get(keyOf('subject', subject.id))!.children.find((c) => c.name === 'SQL')!
    expect(sqlNode.container).toBe(true)
    expect(sqlNode.children.map((c) => c.name)).toEqual(['SELECT', 'JOINs; GROUP BY'])
  })

  it('remover um item sem os filhos promove os filhos; arrastar não cria ciclo', () => {
    let tree = fromOutline(parseOutline(text))
    const sql = tree[0].children[1]
    tree = remove(tree, sql.id)
    expect(tree[0].children.map((c) => c.name)).toEqual(['Modelagem', 'SELECT', 'JOIN', 'GROUP BY', 'Normalização'])
    const before = tree
    tree = moveTo(tree, tree[0].id, tree[0].children[0].id, 'inside')
    expect(tree).toBe(before)
    tree = indent(tree, tree[0].children[2].id) // JOIN vira filho de SELECT
    expect(tree[0].children[1].children.map((c) => c.name)).toEqual(['JOIN'])
    const rows = toTopicRows(tree, 's1', null, 0)
    const ids = new Set<string>()
    for (const r of rows) {
      if (r.parent_id) expect(ids.has(r.parent_id)).toBe(true)
      ids.add(r.id)
    }
  })
})
