import { describe, expect, it } from 'vitest'
import { CGU_DAILY_LIMIT_MINUTES, CGU_PLAN, CGU_START_DATE, QC_CEBRASPE, QC_LINKS, type CguLink } from '@/content/cguPlan'
import type { CourseView } from '@/lib/courseCatalog'
import { EMPTY_STATE, GROUP_LABELS, dayIndexFor, discursiveScore, groupOf, groupTasks, loadState, markDone, materialCoverage, minutesOf, nextTask, openLabel, pendingTasks, postpone, resolveLink, saveState, startTask, suggestFocus, tasksForDay } from '@/lib/cguPlan'
import type { CourseNode } from '@/types/db'

describe('plano CGU de 28 dias', () => {
  it('tem 28 dias, nenhum acima de 180 min e ids únicos', () => {
    expect(CGU_PLAN).toHaveLength(28)
    const ids = CGU_PLAN.flatMap((d) => d.tasks.map((t) => t.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of CGU_PLAN) expect(minutesOf(d.tasks), `dia ${d.day}`).toBeLessThanOrEqual(CGU_DAILY_LIMIT_MINUTES)
  })

  it('dá mais tempo ao P3 e protege P1, P2 e discursiva', () => {
    const all = CGU_PLAN.flatMap((d) => d.tasks)
    const total = minutesOf(all)
    const by = (b: string) => minutesOf(all.filter((t) => t.block === b)) / total
    expect(by('P3')).toBeGreaterThan(0.5)
    expect(CGU_PLAN.filter((d) => d.tasks.some((t) => t.block === 'P1')).length).toBeGreaterThanOrEqual(12)
    expect(CGU_PLAN.filter((d) => d.tasks.some((t) => t.block === 'P2')).length).toBeGreaterThanOrEqual(12)
    expect(all.filter((t) => t.kind === 'discursiva').length).toBeGreaterThanOrEqual(6)
    expect(all.filter((t) => t.kind === 'simulado').length).toBeGreaterThan(0)
  })

  it('dia 1 começa com diagnóstico, tem aula, leitura, questões e correção, cada um com abrir/até onde/minutos', () => {
    const d1 = CGU_PLAN[0].tasks
    expect(d1[0].kind).toBe('diagnostico')
    for (const k of ['aula', 'leitura', 'questoes', 'revisao']) expect(d1.some((t) => t.kind === k), k).toBe(true)
    for (const t of d1) {
      expect(t.open.length).toBeGreaterThan(5)
      expect(t.until.length).toBeGreaterThan(5)
      expect(t.minutes).toBeGreaterThan(0)
    }
  })

  it('toda questão, diagnóstico, simulado e revisão aponta para filtros do QConcursos com a banca Cebraspe', () => {
    const tasks = CGU_PLAN.flatMap((d) => d.tasks).filter((t) => ['questoes', 'diagnostico', 'simulado', 'revisao'].includes(t.kind))
    expect(tasks.length).toBeGreaterThan(60)
    for (const t of tasks) {
      expect(t.link.kind, t.id).toBe('qc')
      if (t.link.kind !== 'qc') continue
      expect(t.link.links.length, t.id).toBeGreaterThan(0)
      expect(new Set(t.link.links.map((l) => l.url)).size).toBe(t.link.links.length)
      for (const l of t.link.links) {
        expect(l.url.startsWith('https://www.qconcursos.com/questoes-de-concursos/'), l.url).toBe(true)
        expect(l.url, l.label).toContain(QC_CEBRASPE)
        expect(l.label.length).toBeGreaterThan(3)
      }
      expect(t.open).toContain('QConcursos')
      if (t.kind === 'revisao') continue
      // Subtema citado na tarefa precisa ter mapeamento próprio (não cair no filtro geral do tema).
      for (const s of t.link.subtemas) expect(QC_LINKS[t.link.tema]?.sub[s], `${t.link.tema} › ${s}`).toBeTruthy()
      expect(t.open).toContain(`${t.link.quantidade} questões`)
    }
  })

  it('nenhuma tarefa aponta para o banco de questões interno', () => {
    for (const t of CGU_PLAN.flatMap((d) => d.tasks)) {
      expect(t.open).not.toContain('Banco de questões')
      if (t.link.kind === 'route') expect(t.link.to).not.toContain('/banco-de-questoes')
    }
  })
})

describe('estado da trilha', () => {
  it('conta o dia a partir de 07/11/2026 (início fixo) e limita a 28', () => {
    expect(CGU_START_DATE).toBe('2026-11-07')
    expect(dayIndexFor('2026-11-06')).toBe(1)
    expect(dayIndexFor('2026-11-07')).toBe(1)
    expect(dayIndexFor('2026-11-09')).toBe(3)
    expect(dayIndexFor('2026-12-04')).toBe(28)
    expect(dayIndexFor('2027-01-01')).toBe(28)
    // Começar uma tarefa registra a data, mas não muda a contagem.
    const s = startTask(EMPTY_STATE, 'd01-001', '2026-11-20')
    expect(s.startDate).toBe('2026-11-20')
    expect(dayIndexFor('2026-11-20')).toBe(14)
  })

  it('concluir avança para a próxima tarefa e adiar leva a tarefa para o dia seguinte sem perder progresso', () => {
    const first = CGU_PLAN[0].tasks[0]
    const second = CGU_PLAN[0].tasks[1]
    let s = startTask(EMPTY_STATE, first.id, '2026-11-07')
    expect(nextTask(s, 1)?.id).toBe(first.id)
    s = markDone(s, first.id, '2026-11-07T10:00:00Z')
    expect(nextTask(s, 1)?.id).toBe(second.id)
    s = postpone(s, second.id, 2)
    expect(tasksForDay(s, 1).map((t) => t.id)).not.toContain(second.id)
    expect(tasksForDay(s, 2)[0].id).toBe(second.id)
    expect(pendingTasks(s, 1).length).toBe(CGU_PLAN[0].tasks.length - 2)
    expect(s.done[first.id]).toBe('2026-11-07T10:00:00Z')
  })

  it('persiste por conta no localStorage e sobrevive a recarregar', () => {
    const s = markDone(startTask(EMPTY_STATE, 'd01-001', '2026-11-07'), 'd01-001')
    saveState('conta-a', s)
    expect(loadState('conta-a').done['d01-001']).toBeTruthy()
    expect(loadState('conta-b').done['d01-001']).toBeUndefined()
  })

  it('sugere foco pelo bloco abaixo do mínimo', () => {
    const focus = suggestFocus({ P1: { certas: 7, erradas: 3 }, P2: { certas: 5, erradas: 5 }, P3: { certas: 20, erradas: 10 } })
    expect(focus[0].block).toBe('P2')
    expect(focus[0].status).toBe('abaixo')
    expect(focus.find((f) => f.block === 'P3')?.projetado).toBe(60)
    expect(suggestFocus({})[0].status).toBe('sem_dados')
  })

  it('calcula a discursiva pelo espelho do edital', () => {
    expect(discursiveScore(1, 24, 5, 30)).toBe(23)
    expect(discursiveScore(2, 50, 10, 60)).toBeCloseTo(47.67, 2)
    expect(discursiveScore(1, 2, 20, 30)).toBe(0)
    expect(discursiveScore(1, 40, 0, 30)).toBe(30)
  })
})

describe('abertura dos materiais', () => {
  const node = (id: string, drive_id: string, parent_id: string | null, mime_type: string): CourseNode =>
    ({ id, drive_id, parent_id, mime_type, title: id, custom_title: null, kind: parent_id ? 'item' : 'course', status: 'available', hidden: false, source_id: 's', user_id: 'u' }) as unknown as CourseNode
  const course = node('c1', 'folder-1', null, 'application/vnd.google-apps.folder')
  const vid = node('n1', 'vid-1', 'c1', 'video/mp4')
  const doc = node('n2', 'pdf-1', 'c1', 'application/pdf')
  const view = { course, items: [vid, doc], lessons: [{ id: 'n1', primary: vid, attachments: [doc] }] } as unknown as CourseView
  const catalog = { views: [view], nodes: [course, vid, doc] }

  it('vídeo abre a aula no player e PDF abre o leitor próprio', () => {
    const v: CguLink = { kind: 'drive', driveId: 'vid-1', folderId: 'folder-1', folder: 'X', media: 'video' }
    expect(resolveLink(v, catalog)).toMatchObject({ to: '/cursos/c1?item=n1', external: false, inCatalog: true })
    const p: CguLink = { kind: 'drive', driveId: 'pdf-1', folderId: 'folder-1', folder: 'X', media: 'pdf' }
    expect(resolveLink(p, catalog).to).toBe('/cursos/c1/pdf/n2')
    const f: CguLink = { kind: 'drive', driveId: 'folder-1', folderId: 'folder-1', folder: 'X', media: 'folder' }
    expect(resolveLink(f, catalog).to).toBe('/cursos/c1?item=n1')
  })

  it('material fora do catálogo cai para o Drive com aviso para importar a pasta', () => {
    const v: CguLink = { kind: 'drive', driveId: 'nao-importado', folderId: 'folder-9', folder: 'Pasta Y', media: 'video' }
    const r = resolveLink(v, { views: [], nodes: [] })
    expect(r.external).toBe(true)
    expect(r.to).toBe('https://drive.google.com/file/d/nao-importado/view')
    expect(r.hint).toContain('Pasta Y')
  })

  it('arquivo marcado como não encontrado no catálogo avisa e abre no Drive', () => {
    const missing = { ...vid, status: 'missing' } as CourseNode
    const r = resolveLink({ kind: 'drive', driveId: 'vid-1', folderId: 'folder-1', folder: 'X', media: 'video' }, { views: [view], nodes: [course, missing, doc] })
    expect(r.external).toBe(true)
    expect(r.hint).toContain('indisponível')
  })

  it('QConcursos abre o primeiro filtro em nova aba e devolve todos os filtros; rotas internas passam direto', () => {
    const links = [
      { label: 'Banco de Dados › SQL', url: 'https://www.qconcursos.com/questoes-de-concursos/disciplinas/tecnologia-da-informacao-banco-de-dados/sql/questoes?examining_board_ids%5B%5D=2' },
      { label: 'Banco de Dados › Índices', url: 'https://www.qconcursos.com/questoes-de-concursos/disciplinas/tecnologia-da-informacao-banco-de-dados/indices/questoes?examining_board_ids%5B%5D=2' },
    ]
    const r = resolveLink({ kind: 'qc', tema: 'T', subtemas: ['2 SQL'], quantidade: 20, links }, catalog)
    expect(r).toMatchObject({ to: links[0].url, external: true, inCatalog: true, links })
    expect(r.hint).toContain('20 questões')
    expect(r.hint).toContain('2 filtros')
    const rev = resolveLink({ kind: 'qc', tema: 'Revisão', subtemas: [], quantidade: 0, links: [links[0]] }, catalog)
    expect(rev.hint).toContain('errou')
    expect(resolveLink({ kind: 'route', to: '/cgu#discursiva' }, catalog).to).toBe('/cgu#discursiva')
  })

  it('se o mesmo arquivo aparece duas vezes no catálogo, prefere a posição disponível e visível', () => {
    const missing = { ...vid, id: 'n1-velho', status: 'missing' } as CourseNode
    const r = resolveLink({ kind: 'drive', driveId: 'vid-1', folderId: 'folder-1', folder: 'X', media: 'video' }, { views: [view], nodes: [course, missing, vid, doc] })
    expect(r).toMatchObject({ to: '/cursos/c1?item=n1', inCatalog: true })
  })

  it('cobertura dos materiais do plano por pasta: dentro do app, fora do catálogo e indisponíveis', () => {
    const planFiles = new Set(CGU_PLAN.flatMap((d) => d.tasks).flatMap((t) => (t.link.kind === 'drive' ? [t.link.driveId] : [])))
    const empty = materialCoverage({ views: [], nodes: [] })
    expect(empty.total).toBe(planFiles.size)
    expect(empty.ok).toBe(0)
    expect(empty.notImported).toBe(planFiles.size)
    expect(empty.folders.length).toBeGreaterThanOrEqual(15)

    // Só o vídeo 001 de AED importado; a apostila de AED consta como "não encontrada".
    const aedCourse = node('aed', '1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p', null, 'application/vnd.google-apps.folder')
    const aedVideo = node('aed-v1', '1huUdohKztOGq7ng3s3gMzx3hmIynwaPb', 'aed', 'video/mp4')
    const aedPdf = { ...node('aed-p1', '1P-Tsb7Z1m1CQrYVZQaiX93C41OV4_y9B', 'aed', 'application/pdf'), status: 'missing' } as CourseNode
    const aedView = { course: aedCourse, items: [aedVideo, aedPdf], lessons: [{ id: 'aed-v1', primary: aedVideo, attachments: [aedPdf] }] } as unknown as CourseView
    const partial = materialCoverage({ views: [aedView], nodes: [aedCourse, aedVideo, aedPdf] })
    expect(partial.ok).toBe(1)
    expect(partial.missing).toBe(1)
    expect(partial.notImported).toBe(planFiles.size - 2)
    const aed = partial.folders.find((f) => f.folderId === '1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p')
    expect(aed).toMatchObject({ ok: 1, missing: 1, notImported: aed!.total - 2 })
  })
})

describe('teoria e questões separadas no dia', () => {
  const all = CGU_PLAN.flatMap((d) => d.tasks)

  it('aulas e leituras são teoria, filtros do QConcursos são questões e a discursiva fica à parte', () => {
    for (const t of all) {
      const g = groupOf(t)
      if (t.link.kind === 'drive') expect(g, t.id).toBe('teoria')
      else if (t.link.kind === 'qc') expect(g, t.id).toBe('questoes')
      else expect(g, t.id).toBe(t.kind === 'discursiva' ? 'discursiva' : 'teoria') // leitura do edital/checklist: página do próprio plano
    }
    expect(GROUP_LABELS).toEqual({ teoria: 'Teoria', questoes: 'Questões', discursiva: 'Discursiva' })
  })

  it('em todo dia, a teoria vem antes das questões, sem perder nem repetir tarefa', () => {
    for (const d of CGU_PLAN) {
      const groups = groupTasks(d.tasks)
      expect(groups.flatMap((g) => g.tasks).map((t) => t.id).sort(), `dia ${d.day}`).toEqual(d.tasks.map((t) => t.id).sort())
      const order = groups.map((g) => g.group)
      expect(order, `dia ${d.day}`).toEqual(['teoria', 'questoes', 'discursiva'].filter((g) => order.includes(g as never)))
    }
  })

  it('o dia 1 tem teoria com Drive e questões com QConcursos; o botão diz o que abre', () => {
    const groups = groupTasks(CGU_PLAN[0].tasks)
    expect(groups.map((g) => g.group)).toEqual(['teoria', 'questoes'])
    for (const t of groups[0].tasks) expect(t.link.kind).toBe('drive')
    for (const t of groups[1].tasks) expect(t.link.kind).toBe('qc')
    expect(openLabel(groups[1].tasks[0])).toBe('Fazer questões')
    const video = all.find((t) => t.link.kind === 'drive' && t.link.media === 'video')!
    const pdf = all.find((t) => t.link.kind === 'drive' && t.link.media === 'pdf')!
    expect(openLabel(video)).toBe('Assistir aula')
    expect(openLabel(pdf)).toBe('Ler apostila')
    expect(openLabel(all.find((t) => t.kind === 'revisao')!)).toBe('Refazer erradas')
    expect(openLabel(all.find((t) => t.kind === 'discursiva')!)).toBe('Abrir espelho')
    expect(openLabel(all.find((t) => t.kind === 'leitura' && t.link.kind === 'route')!)).toBe('Ler no plano')
  })
})
