import { describe, expect, it } from 'vitest'
import { CGU_DAILY_LIMIT_MINUTES, CGU_PLAN, type CguLink } from '@/content/cguPlan'
import type { CourseView } from '@/lib/courseCatalog'
import { EMPTY_STATE, dayIndexFor, discursiveScore, loadState, markDone, minutesOf, nextTask, pendingTasks, postpone, resolveLink, saveState, startTask, suggestFocus, tasksForDay } from '@/lib/cguPlan'
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
})

describe('estado da trilha', () => {
  it('conta o dia a partir da primeira tarefa iniciada e limita a 28', () => {
    expect(dayIndexFor(EMPTY_STATE, '2026-11-20')).toBe(1)
    const s = startTask(EMPTY_STATE, 'd01-001', '2026-11-07')
    expect(dayIndexFor(s, '2026-11-07')).toBe(1)
    expect(dayIndexFor(s, '2026-11-09')).toBe(3)
    expect(dayIndexFor(s, '2027-01-01')).toBe(28)
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

  it('banco e rotas internas', () => {
    expect(resolveLink({ kind: 'banco', tema: 'T', subtemas: ['1 A'], quantidade: 10 }, catalog)).toMatchObject({ to: '/banco-de-questoes', hint: expect.stringContaining('1 A') })
    expect(resolveLink({ kind: 'route', to: '/cgu#discursiva' }, catalog).to).toBe('/cgu#discursiva')
  })
})
