import { describe, expect, it } from 'vitest'
import { driveEmbedUrl, driveOpenUrl, isTrustedDriveUrl, materialType, naturalCompare, parseDriveFolder } from '../drive'
import { crawlFolder, DriveApiError } from '../driveCrawl'
import { buildPlan, reconcile } from '../courseImport'
import { buildCatalog, breadcrumb, courseStatus, lastStudied, lessonOf, modulePath, neighbors, remainingMs, resumeItem, progressIndex } from '../courseCatalog'
import { createDriveClient } from '../driveApi'
import { FakeDrive, fid, noSleep } from '@/test/fakeDrive'
import type { CourseNode, CourseProgress, CourseSourceConfig } from '@/types/db'

const FOLDER = '1TestFolderAbcdefghijKLMNOP'

describe('links e tipos do Drive', () => {
  it('extrai o ID da pasta só de links do drive.google.com', () => {
    expect(parseDriveFolder(`https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`)).toBe(FOLDER)
    expect(parseDriveFolder(`https://drive.google.com/drive/u/1/folders/${FOLDER}`)).toBe(FOLDER)
    expect(parseDriveFolder(`https://drive.google.com/open?id=${FOLDER}`)).toBe(FOLDER)
    expect(parseDriveFolder(FOLDER)).toBe(FOLDER)
    expect(parseDriveFolder(`https://evil.example.com/drive/folders/${FOLDER}`)).toBeNull()
    expect(parseDriveFolder(`http://drive.google.com/drive/folders/${FOLDER}`)).toBeNull()
    expect(parseDriveFolder(`https://drive.google.com/drive/folders/abc"><script>`)).toBeNull()
    expect(parseDriveFolder('javascript:alert(1)')).toBeNull()
    expect(parseDriveFolder('')).toBeNull()
  })

  it('escolhe o visualizador pelo MIME real, não pelo nome', () => {
    expect(materialType('application/pdf')).toMatchObject({ kind: 'pdf', embeddable: true })
    expect(materialType('video/mp4')).toMatchObject({ kind: 'video', embeddable: true })
    expect(materialType('application/vnd.google-apps.document').kind).toBe('document')
    expect(materialType('application/zip')).toMatchObject({ kind: 'other', embeddable: false })
    expect(materialType('application/vnd.google-apps.form').embeddable).toBe(false)
    expect(materialType(undefined).embeddable).toBe(false)
  })

  it('gera iframes e links só para domínios oficiais do Google, com IDs validados', () => {
    expect(driveEmbedUrl(FOLDER, 'application/pdf')).toBe(`https://drive.google.com/file/d/${FOLDER}/preview`)
    expect(driveEmbedUrl(FOLDER, 'application/vnd.google-apps.presentation')).toBe(`https://docs.google.com/presentation/d/${FOLDER}/preview`)
    expect(driveEmbedUrl(FOLDER, 'video/mp4', '0-abcDEF')).toBe(`https://drive.google.com/file/d/${FOLDER}/preview?resourcekey=0-abcDEF`)
    expect(driveEmbedUrl(FOLDER, 'video/mp4', 'x" onload="1')).toBe(`https://drive.google.com/file/d/${FOLDER}/preview`)
    expect(driveEmbedUrl(FOLDER, 'application/zip')).toBeNull()
    expect(driveEmbedUrl('../../evil', 'application/pdf')).toBeNull()
    expect(driveOpenUrl('bad id')).toBeNull()
    for (const u of [driveEmbedUrl(FOLDER, 'application/pdf')!, driveOpenUrl(FOLDER)!]) expect(isTrustedDriveUrl(u)).toBe(true)
    expect(isTrustedDriveUrl('https://drive.google.com.evil.com/x')).toBe(false)
  })

  it('ordena de forma natural (aula 2 antes da aula 10)', () => {
    expect(['Aula 10', 'Aula 2', 'aula 1'].sort(naturalCompare)).toEqual(['aula 1', 'Aula 2', 'Aula 10'])
  })
})

/** Drive sintético: Cursos/ (Curso A com módulos e subpastas; Curso B; pasta vazia) */
function sample() {
  const d = new FakeDrive()
  const root = d.folder('Raiz')
  const a = d.folder('Curso A', root)
  const m1 = d.folder('Modulo 1', a)
  d.file('Aula 10.mp4', m1, 'video/mp4', fid('a10'), { durationMillis: '600000' })
  d.file('Aula 2.mp4', m1, 'video/mp4', fid('a2'))
  const sub = d.folder('Extras', m1)
  d.file('Apostila.pdf', sub, 'application/pdf', fid('apost'))
  const m2 = d.folder('Modulo 2', a)
  d.file('Codigo.zip', m2, 'application/zip', fid('zip'))
  const b = d.folder('Curso B', root)
  d.file('Resumo.pdf', b, 'application/pdf', fid('resumo'))
  d.folder('Vazia', root)
  return { d, root, a, m1, m2, sub, b }
}

const CFG: CourseSourceConfig = { courseLevel: 1, excluded: [] }

/** Converte as inserções da reconciliação em linhas salvas (como o banco faria). */
function persist(rows: ReturnType<typeof reconcile>['inserts'], prev: CourseNode[] = [], updates: ReturnType<typeof reconcile>['updates'] = []): CourseNode[] {
  const now = '2026-11-03T00:00:00.000Z'
  const out = prev.map((n) => {
    const u = updates.filter((x) => x.id === n.id)
    return u.reduce((acc, x) => ({ ...acc, ...x.patch }) as CourseNode, n)
  })
  for (const r of rows)
    out.push({
      parent_id: null, drive_parent_id: null, custom_title: null, resource_key: null, size_bytes: null, duration_ms: null, drive_modified_at: null,
      via_shortcut: null, sort_order: 0, sort_manual: false, parent_manual: false, hidden: false, status: 'available', missing_since: null,
      subject_id: null, topic_id: null, user_id: 'u', created_at: now, updated_at: now, ...r,
    } as CourseNode)
  return out
}

describe('leitura das pastas (crawlFolder)', () => {
  it('percorre subpastas em todos os níveis seguindo a paginação', async () => {
    const { d, root, sub } = sample()
    const r = await crawlFolder(d, root, { sleep: noSleep })
    expect(r.fatal).toBeNull()
    expect(r.entries.map((e) => e.name)).toEqual(expect.arrayContaining(['Curso A', 'Modulo 1', 'Extras', 'Apostila.pdf', 'Codigo.zip', 'Resumo.pdf', 'Vazia']))
    expect(r.entries.find((e) => e.name === 'Apostila.pdf')?.parentId).toBe(sub)
    expect(r.listedFolders.size).toBe(7)
    expect(r.entries.find((e) => e.name === 'Aula 10.mp4')?.durationMs).toBe(600000)
  })

  it('repete após limite da API e registra pastas que continuaram falhando, sem parar o resto', async () => {
    const { d, root, m1, b } = sample()
    d.failOnce(m1, 'rate', 2)
    d.failOnce(b, 'forbidden')
    const r = await crawlFolder(d, root, { sleep: noSleep, retries: 3 })
    expect(r.listedFolders.has(m1)).toBe(true)
    expect(r.failedFolders.map((f) => f.id)).toEqual([b])
    expect(r.failedFolders[0].kind).toBe('forbidden')
    expect(r.listedFolders.has(b)).toBe(false)
    expect(r.entries.some((e) => e.name === 'Codigo.zip')).toBe(true)
  })

  it('falha fatal quando a pasta raiz não existe ou não é acessível', async () => {
    const r = await crawlFolder(new FakeDrive(), FOLDER, { sleep: noSleep })
    expect(r.fatal?.kind).toBe('not_found')
    expect(r.entries).toHaveLength(0)
  })

  it('segue atalhos sem entrar em ciclos nem repetir pastas', async () => {
    const { d, root, a, m1 } = sample()
    d.shortcut('volta para raiz', m1, root)
    d.shortcut('Curso A de novo', root, a)
    d.shortcut('atalho da apostila', root, fid('apost'))
    const r = await crawlFolder(d, root, { sleep: noSleep })
    expect(r.skipped.filter((s) => s.kind === 'cycle')).toHaveLength(2)
    expect(r.entries.filter((e) => e.id === a)).toHaveLength(1)
    const sc = r.entries.find((e) => e.viaShortcut)
    expect(sc).toMatchObject({ id: fid('apost'), parentId: root, mimeType: 'application/pdf' })
  })

  it('para no limite de itens e marca a leitura como truncada', async () => {
    const { d, root } = sample()
    const r = await crawlFolder(d, root, { sleep: noSleep, maxItems: 3 })
    expect(r.truncated).toBe(true)
    expect(r.entries).toHaveLength(3)
  })
})

describe('catálogo proposto (buildPlan)', () => {
  it('cada subpasta vira curso, módulos em qualquer nível, ordem natural, e mostra o que não tem visualizador', async () => {
    const { d, root } = sample()
    const plan = buildPlan(await crawlFolder(d, root, { sleep: noSleep }), CFG)
    expect(plan.summary).toMatchObject({ courses: 2, modules: 3, items: 5 })
    expect(plan.summary.byKind).toEqual({ video: 2, pdf: 2, other: 1 })
    expect(plan.summary.incompatible.map((x) => x.title)).toEqual(['Codigo.zip'])
    expect(plan.summary.emptyFolders.map((x) => x.title)).toEqual(['Vazia'])
    const m1Items = plan.nodes.filter((n) => n.driveParentId === fid('Modulo 1'))
    expect(m1Items.map((n) => n.title)).toEqual(['Aula 2.mp4', 'Aula 10.mp4', 'Extras'])
    expect(plan.nodes.find((n) => n.title === 'Apostila.pdf')?.depth).toBe(3)
  })

  it('com nível 0 a própria pasta é um curso, e pastas excluídas ficam de fora', async () => {
    const { d, root, b } = sample()
    const plan = buildPlan(await crawlFolder(d, root, { sleep: noSleep }), { courseLevel: 0, excluded: [b] })
    expect(plan.summary).toMatchObject({ courses: 1, excludedFolders: 1 })
    expect(plan.nodes.filter((n) => n.kind === 'course').map((n) => n.title)).toEqual(['Raiz'])
    expect(plan.nodes.some((n) => n.title === 'Resumo.pdf')).toBe(false)
  })

  it('arquivos soltos na raiz formam um curso com o nome da própria pasta', async () => {
    const { d, root } = sample()
    d.file('Edital.pdf', root, 'application/pdf', fid('edital'))
    const plan = buildPlan(await crawlFolder(d, root, { sleep: noSleep }), CFG)
    const rootCourse = plan.nodes.find((n) => n.kind === 'course' && n.driveId === root)!
    expect(rootCourse.title).toBe('Raiz')
    expect(plan.nodes.filter((n) => n.parentKey === rootCourse.key).map((n) => n.title)).toEqual(['Edital.pdf'])
  })
})

describe('reimportação (reconcile)', () => {
  const NOW = '2026-11-03T12:00:00.000Z'
  let seq = 0
  const ids = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

  async function importOnce(d: FakeDrive, root: string, prev: CourseNode[] = [], cfg = CFG) {
    const crawl = await crawlFolder(d, root, { sleep: noSleep })
    const r = reconcile(prev, buildPlan(crawl, cfg), crawl, 'src', NOW, ids)
    return { r, nodes: persist(r.inserts, prev, r.updates) }
  }

  it('reimportar sem mudanças não cria nem altera nada', async () => {
    const { d, root } = sample()
    const first = await importOnce(d, root)
    expect(first.r.counts.inserted).toBe(10)
    const again = await importOnce(d, root, first.nodes)
    expect(again.r.inserts).toHaveLength(0)
    expect(again.r.updates).toHaveLength(0)
    expect(again.r.counts.unchanged).toBe(10)
  })

  it('renomear no Drive atualiza o nome sem criar outra aula e preserva nome personalizado e vínculos', async () => {
    const { d, root } = sample()
    const first = await importOnce(d, root)
    const aula = first.nodes.find((n) => n.drive_id === fid('a2'))!
    aula.custom_title = 'Minha aula'
    aula.subject_id = 'subj'
    d.rename(fid('a2'), 'Aula 02 - Introdução.mp4')
    const again = await importOnce(d, root, first.nodes)
    expect(again.r.inserts).toHaveLength(0)
    const after = again.nodes.find((n) => n.id === aula.id)!
    expect(after).toMatchObject({ title: 'Aula 02 - Introdução.mp4', custom_title: 'Minha aula', subject_id: 'subj' })
  })

  it('arquivo movido de pasta no Drive mantém o mesmo item; ordem manual é preservada', async () => {
    const { d, root, m2 } = sample()
    const first = await importOnce(d, root)
    const apost = first.nodes.find((n) => n.drive_id === fid('apost'))!
    const zip = first.nodes.find((n) => n.drive_id === fid('zip'))!
    zip.sort_order = 99
    zip.sort_manual = true
    d.move(fid('apost'), m2)
    const again = await importOnce(d, root, first.nodes)
    expect(again.r.inserts).toHaveLength(0)
    const moved = again.nodes.find((n) => n.id === apost.id)!
    expect(moved.drive_parent_id).toBe(m2)
    expect(moved.parent_id).toBe(first.nodes.find((n) => n.drive_id === m2)!.id)
    expect(again.nodes.find((n) => n.id === zip.id)!.sort_order).toBe(99)
  })

  it('pasta movida à mão no app não volta para a pasta do Drive', async () => {
    const { d, root } = sample()
    const first = await importOnce(d, root)
    const resumo = first.nodes.find((n) => n.drive_id === fid('resumo'))!
    const cursoA = first.nodes.find((n) => n.drive_id === fid('Curso A'))!
    resumo.parent_id = cursoA.id
    resumo.parent_manual = true
    const again = await importOnce(d, root, first.nodes)
    expect(again.nodes.find((n) => n.id === resumo.id)!.parent_id).toBe(cursoA.id)
  })

  it('arquivo removido é sinalizado (não apagado) e volta a ficar disponível se reaparecer', async () => {
    const { d, root, m1 } = sample()
    const first = await importOnce(d, root)
    d.remove(fid('a10'))
    const second = await importOnce(d, root, first.nodes)
    expect(second.r.counts.missing).toBe(1)
    const gone = second.nodes.find((n) => n.drive_id === fid('a10'))!
    expect(gone).toMatchObject({ status: 'missing', missing_since: NOW })
    d.file('Aula 10.mp4', m1, 'video/mp4', fid('a10'))
    const third = await importOnce(d, root, second.nodes)
    expect(third.r.counts.restored).toBe(1)
    expect(third.nodes.find((n) => n.id === gone.id)).toMatchObject({ status: 'available', missing_since: null })
  })

  it('pasta removida sinaliza a pasta e tudo abaixo dela', async () => {
    const { d, root, m1 } = sample()
    const first = await importOnce(d, root)
    d.remove(m1)
    const again = await importOnce(d, root, first.nodes)
    expect(again.r.counts.missing).toBe(5) // módulo, 2 aulas, Extras e a apostila
  })

  it('leitura parcial não marca como removido o que estava em pastas não lidas', async () => {
    const { d, root, m1, a } = sample()
    const first = await importOnce(d, root)
    d.failOnce(m1, 'forbidden')
    d.failOnce(a, 'server', 10)
    const again = await importOnce(d, root, first.nodes)
    expect(again.r.counts.missing).toBe(0)
    expect(again.r.counts.unverified).toBeGreaterThan(0)
    expect(again.nodes.every((n) => n.status === 'available')).toBe(true)
  })

  it('pasta excluída no mapeamento fica como "excluída" (com personalizações) e volta ao incluir de novo', async () => {
    const { d, root, b } = sample()
    const first = await importOnce(d, root)
    const cursoB = first.nodes.find((n) => n.drive_id === b)!
    cursoB.custom_title = 'B personalizado'
    const excl = await importOnce(d, root, first.nodes, { courseLevel: 1, excluded: [b] })
    expect(excl.r.counts.missing).toBe(0)
    expect(excl.nodes.find((n) => n.id === cursoB.id)!.status).toBe('excluded')
    const back = await importOnce(d, root, excl.nodes)
    expect(back.r.inserts).toHaveLength(0)
    expect(back.nodes.find((n) => n.id === cursoB.id)).toMatchObject({ status: 'available', custom_title: 'B personalizado' })
  })

  it('o mesmo arquivo em dois lugares vira duas referências ao mesmo ID do Drive', async () => {
    const { d, root, b } = sample()
    d.shortcut('apostila no curso B', b, fid('apost'))
    const { nodes, r } = await importOnce(d, root)
    expect(nodes.filter((n) => n.drive_id === fid('apost'))).toHaveLength(2)
    const plan = buildPlan(await crawlFolder(d, root, { sleep: noSleep }), CFG)
    expect(plan.summary.repeatedFiles).toBe(1)
    expect(r.counts.inserted).toBe(11)
  })
})

describe('visão do catálogo', () => {
  it('progresso por curso, anterior/próximo, retomada e caminho da aula', async () => {
    const { d, root } = sample()
    const crawl = await crawlFolder(d, root, { sleep: noSleep })
    let n = 0
    const r = reconcile([], buildPlan(crawl, CFG), crawl, 'src', 'x', () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`)
    const nodes = persist(r.inserts)
    const prog = (driveId: string, p: Partial<CourseProgress>): CourseProgress => ({ id: driveId, user_id: 'u', created_at: '', updated_at: '', drive_id: driveId, completed_at: null, last_opened_at: null, last_node_id: null, ...p })
    const progress = [prog(fid('a2'), { completed_at: '2026-11-01T00:00:00Z', last_opened_at: '2026-11-01T00:00:00Z' })]
    const views = buildCatalog(nodes, progress)
    const a = views.find((v) => v.title === 'Curso A')!
    expect(a.items.map((i) => i.title)).toEqual(['Aula 2.mp4', 'Aula 10.mp4', 'Apostila.pdf', 'Codigo.zip'])
    expect([a.done, a.total]).toEqual([1, 4])
    expect(courseStatus(a)).toBe('in_progress')
    expect(lastStudied(views)?.title).toBe('Curso A')
    // a última aberta já foi concluída: continua na próxima pendente
    expect(resumeItem(a, progressIndex(progress))?.title).toBe('Aula 10.mp4')
    const { previous, next } = neighbors(a.items, a.items[1].id)
    expect([previous?.title, next?.title]).toEqual(['Aula 2.mp4', 'Apostila.pdf'])
    expect(breadcrumb(a.tree, a.items[2].id)).toEqual(['Modulo 1', 'Extras'])
    // itens ocultos saem da sequência e do total
    nodes.find((x) => x.title === 'Codigo.zip')!.hidden = true
    expect(buildCatalog(nodes, progress).find((v) => v.title === 'Curso A')!.total).toBe(3)
  })
})

describe('cliente HTTP do Drive', () => {
  it('pede só metadados, com o token no cabeçalho, e classifica erros', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('/files/')) return new Response(JSON.stringify({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }), { status: 403 })
      return new Response(JSON.stringify({ files: [] }), { status: 200 })
    }) as typeof fetch
    const client = createDriveClient(() => 'tok', fetchImpl)
    await client.listChildren(FOLDER)
    const u = new URL(calls[0].url)
    expect(u.origin).toBe('https://www.googleapis.com')
    expect(u.searchParams.get('alt')).toBeNull()
    expect(u.searchParams.get('q')).toBe(`'${FOLDER}' in parents and trashed = false`)
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    await expect(client.getFile(FOLDER)).rejects.toMatchObject({ kind: 'rate' })
    await expect(client.listChildren("x' or '1'='1")).rejects.toBeInstanceOf(DriveApiError)
    await expect(createDriveClient(() => null, fetchImpl).listChildren(FOLDER)).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('aulas (pasta com vídeo + materiais)', () => {
  it('agrupa pastas-folha com até um vídeo; pastas com vários vídeos viram uma aula por vídeo', async () => {
    const d = new FakeDrive()
    const root = d.folder('Raiz')
    const c = d.folder('Curso', root)
    const mod = d.folder('01 - Módulo', c)
    const a1 = d.folder('001 - Boas-vindas', mod)
    d.file('01 - Boas-vindas.mp4', a1, 'video/mp4', fid('bv'), { durationMillis: '120000' })
    d.file('Slides.pptx', a1, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', fid('sl'))
    const a2 = d.folder('002 - Aula em PDF', mod)
    d.file('Aula_resumo.pdf', a2, 'application/pdf', fid('res'))
    d.file('Aula_completo.pdf', a2, 'application/pdf', fid('comp'))
    const many = d.folder('03 - Dois vídeos', c)
    d.file('Parte 1.mp4', many, 'video/mp4', fid('pt1'), { durationMillis: '60000' })
    d.file('Parte 2.mp4', many, 'video/mp4', fid('pt2'))
    const crawl = await crawlFolder(d, root, { sleep: noSleep })
    let k = 0
    const r = reconcile([], buildPlan(crawl, CFG), crawl, 'src', 'x', () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}`)
    const [v] = buildCatalog(persist(r.inserts), [])
    expect(v.lessons.map((l) => [l.title, l.primary.title, l.attachments.map((a) => a.title)])).toEqual([
      ['001 - Boas-vindas', '01 - Boas-vindas.mp4', ['Slides.pptx']],
      ['002 - Aula em PDF', 'Aula_completo.pdf', ['Aula_resumo.pdf']],
      ['Parte 1.mp4', 'Parte 1.mp4', []],
      ['Parte 2.mp4', 'Parte 2.mp4', []],
    ])
    expect(v.total).toBe(4)
    expect(v.durationMs).toBe(180000)
    expect(v.lessons.map((l) => l.number)).toEqual([1, 2, 3, 4])
    expect(modulePath(v.outline, v.lessons[0].id).map((m) => m.title)).toEqual(['01 - Módulo'])
    expect(lessonOf(v, v.lessons[0].attachments[0].id)?.title).toBe('001 - Boas-vindas')

    // concluir a aula = concluir o conteúdo principal; o material aberto por último é retomado
    const now = '2026-11-03T10:00:00Z'
    const prog = (driveId: string, p: Partial<CourseProgress>): CourseProgress => ({ id: driveId, user_id: 'u', created_at: now, updated_at: now, drive_id: driveId, completed_at: null, last_opened_at: null, last_node_id: null, ...p })
    const slides = v.lessons[0].attachments[0]
    const progress = [prog(fid('sl'), { last_opened_at: now, last_node_id: slides.id })]
    const [v2] = buildCatalog(persist(r.inserts), progress)
    expect(resumeItem(v2, progressIndex(progress))?.id).toBe(slides.id)
    const doneFirst = [...progress, prog(fid('bv'), { completed_at: now })]
    const [v3] = buildCatalog(persist(r.inserts), doneFirst)
    expect(v3.done).toBe(1)
    expect(resumeItem(v3, progressIndex(doneFirst))?.title).toBe('Aula_completo.pdf')
    expect(remainingMs(v3, progressIndex(doneFirst))).toBe(60000)
  })
})
