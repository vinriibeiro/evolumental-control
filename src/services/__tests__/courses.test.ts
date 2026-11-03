import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { fetchAll } from '@/hooks/data'
import { crawlFolder } from '@/lib/driveCrawl'
import { buildCatalog } from '@/lib/courseCatalog'
import { addSource, applySync, markOpened, previewSync, removeSource, setCompleted, sourceConfig } from '@/services/courses'
import { FakeDrive, fid, noSleep } from '@/test/fakeDrive'

let backend: LocalBackend
let dbn = 0

function drive() {
  const d = new FakeDrive()
  const root = d.folder('Cursos')
  const c = d.folder('Curso SQL', root)
  const m = d.folder('Modulo 1', c)
  d.file('Aula 1.mp4', m, 'video/mp4', fid('v1'))
  d.file('Aula 2.mp4', m, 'video/mp4', fid('v2'))
  d.file('Material.pdf', c, 'application/pdf', fid('pdf'))
  return { d, root, m }
}

async function sync(d: FakeDrive, root: string) {
  const source = await addSource(backend, root, 'Cursos')
  const crawl = await crawlFolder(d, root, { sleep: noSleep })
  return applySync(backend, source, crawl, sourceConfig(source))
}

beforeEach(() => {
  backend = new LocalBackend(`courses-test-${++dbn}`)
})

describe('cursos do Drive no modo local', () => {
  it('importa a hierarquia e grava só metadados', async () => {
    const { d, root } = drive()
    const report = await sync(d, root)
    expect(report).toMatchObject({ inserted: 5, missing: 0 })
    const nodes = await fetchAll(backend, 'course_nodes')
    expect(nodes).toHaveLength(5)
    // nada de conteúdo de arquivo: só campos de referência
    for (const n of nodes) expect(Object.keys(n).some((k) => /data|blob|content|base64/i.test(k))).toBe(false)
    const [view] = buildCatalog(nodes, [])
    expect(view.title).toBe('Curso SQL')
    expect(view.items.map((i) => i.title)).toEqual(['Material.pdf', 'Aula 1.mp4', 'Aula 2.mp4'])
    const [source] = await fetchAll(backend, 'course_sources')
    expect(source).toMatchObject({ last_sync_status: 'ok', title: 'Cursos' })
  })

  it('cadastrar a mesma pasta de novo reaproveita a fonte', async () => {
    const { root } = drive()
    const a = await addSource(backend, root, 'Cursos')
    const b = await addSource(backend, root, 'Cursos')
    expect(b.id).toBe(a.id)
    expect(await backend.count('course_sources', [])).toBe(1)
  })

  it('reimportar não duplica e preserva progresso, nome personalizado e última aula', async () => {
    const { d, root } = drive()
    await sync(d, root)
    const v1 = (await backend.list('course_nodes', { filters: [eq('drive_id', fid('v1'))] })).rows[0]
    await setCompleted(backend, v1, true)
    await markOpened(backend, v1)
    await backend.update('course_nodes', [eq('id', v1.id)], { custom_title: 'Introdução' })
    d.rename(fid('v1'), 'Aula 01 - Boas-vindas.mp4')
    const report = await sync(d, root)
    expect(report.inserted).toBe(0)
    const nodes = await fetchAll(backend, 'course_nodes')
    expect(nodes).toHaveLength(5)
    const after = nodes.find((n) => n.id === v1.id)!
    expect(after).toMatchObject({ title: 'Aula 01 - Boas-vindas.mp4', custom_title: 'Introdução' })
    const progress = await fetchAll(backend, 'course_progress')
    const [view] = buildCatalog(nodes, progress)
    expect(view.done).toBe(1)
    expect(view.lastOpened?.node.id).toBe(v1.id)
  })

  it('desmarcar conclusão e reabrir não duplicam o progresso', async () => {
    const { d, root } = drive()
    await sync(d, root)
    const v2 = (await backend.list('course_nodes', { filters: [eq('drive_id', fid('v2'))] })).rows[0]
    await setCompleted(backend, v2, true)
    await setCompleted(backend, v2, false)
    await markOpened(backend, v2)
    await markOpened(backend, v2)
    const rows = await fetchAll(backend, 'course_progress')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ completed_at: null, last_node_id: v2.id })
  })

  it('sincronização com falha fatal não mexe no catálogo', async () => {
    const { d, root } = drive()
    await sync(d, root)
    d.remove(root)
    const report = await sync(d, root)
    expect(report.error).toBeTruthy()
    const nodes = await fetchAll(backend, 'course_nodes')
    expect(nodes.every((n) => n.status === 'available')).toBe(true)
    const [source] = await fetchAll(backend, 'course_sources')
    expect(source.last_sync_status).toBe('failed')
  })

  it('leitura parcial fica como "parcial" e não sinaliza remoções em massa', async () => {
    const { d, root, m } = drive()
    await sync(d, root)
    d.failOnce(m, 'forbidden')
    const report = await sync(d, root)
    expect(report).toMatchObject({ missing: 0 })
    expect(report.failedFolders).toHaveLength(1)
    const [source] = await fetchAll(backend, 'course_sources')
    expect(source.last_sync_status).toBe('partial')
  })

  it('a prévia não grava nada', async () => {
    const { d, root } = drive()
    const source = await addSource(backend, root, 'Cursos')
    const crawl = await crawlFolder(d, root, { sleep: noSleep })
    const preview = await previewSync(backend, source, crawl, sourceConfig(source))
    expect(preview.diff.counts.inserted).toBe(5)
    expect(await backend.count('course_nodes', [])).toBe(0)
  })

  it('remover a fonte apaga o catálogo dela, mas o progresso volta ao cadastrar de novo', async () => {
    const { d, root } = drive()
    await sync(d, root)
    const pdf = (await backend.list('course_nodes', { filters: [eq('drive_id', fid('pdf'))] })).rows[0]
    await setCompleted(backend, pdf, true)
    const [source] = await fetchAll(backend, 'course_sources')
    await removeSource(backend, source.id)
    expect(await backend.count('course_nodes', [])).toBe(0)
    expect(await backend.count('course_progress', [])).toBe(1)
    await sync(d, root)
    const [view] = buildCatalog(await fetchAll(backend, 'course_nodes'), await fetchAll(backend, 'course_progress'))
    expect(view.done).toBe(1)
  })

  it('"Zerar dados" zera o progresso dos cursos e mantém o catálogo', async () => {
    const { d, root } = drive()
    await sync(d, root)
    const v1 = (await backend.list('course_nodes', { filters: [eq('drive_id', fid('v1'))] })).rows[0]
    await setCompleted(backend, v1, true)
    await backend.resetAllData()
    expect(await backend.count('course_progress', [])).toBe(0)
    expect(await backend.count('course_nodes', [])).toBe(5)
  })

  it('excluir a matéria vinculada só remove o vínculo', async () => {
    const { d, root } = drive()
    await sync(d, root)
    const [subject] = await backend.insert('subjects', [{ name: 'SQL' }])
    const course = (await backend.list('course_nodes', { filters: [eq('kind', 'course')] })).rows[0]
    await backend.update('course_nodes', [eq('id', course.id)], { subject_id: subject.id })
    await backend.remove('subjects', [eq('id', subject.id)])
    expect((await backend.get('course_nodes', course.id))?.subject_id).toBeNull()
  })
})
