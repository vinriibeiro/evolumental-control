import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { ROUTINE_RULES } from '@/lib/routine'
import { cloneRoutineTemplate, routineTemplateById } from '@/content/routines'
import { NAV } from '@/app/nav'
import { applyRoutine, previewRoutine, routineCycleName, routineMark, routinePlanName, type RoutineDraft } from '@/services/routines'
import type { TableName } from '@/types/db'

let n = 0
const fresh = () => new LocalBackend(`routines-${++n}`)

const evening = [{ start: '19:00', end: '22:00' }]
const morning = [{ start: '09:00', end: '12:00' }]

function draft(): RoutineDraft {
  const t = cloneRoutineTemplate(routineTemplateById('transicao_analista_cientista')!)
  return {
    templateId: t.id,
    name: t.name,
    pillars: t.pillars,
    availability: { days: { 0: morning, 1: evening, 2: evening, 3: evening, 4: evening, 5: evening, 6: morning }, dailyLimitMinutes: 150, weeklyLimitMinutes: 720, breakMinutes: 10 },
    startDate: '2026-11-02',
    weeks: 2,
    milestones: [{ title: 'Prova de certificação em ML', pillarId: 'certificacoes', date: '2026-11-20' }, ...t.milestones],
  }
}

const TABLES: TableName[] = ['subjects', 'topics', 'study_cycles', 'study_cycle_items', 'study_plans', 'study_plan_items', 'calendar_tasks', 'study_goals']
async function snapshot(b: LocalBackend) {
  const out: Record<string, string[]> = {}
  for (const t of TABLES) out[t] = (await b.list(t)).rows.map((r) => r.id).sort()
  return out
}

describe('página Rotinas', () => {
  it('está no menu com a rota /rotinas', () => {
    expect(NAV.find((i) => i.to === '/rotinas')?.label).toBe('Rotinas')
  })
})

describe('previewRoutine', () => {
  it('mostra as regras e um motivo para cada bloco, sem gravar nada', () => {
    const p = previewRoutine(draft())
    expect(p.rules).toEqual(ROUTINE_RULES)
    expect(p.output.cycleItems.length).toBeGreaterThan(0)
    expect(p.planBlocks.length).toBeGreaterThan(0)
    for (const b of [...p.output.cycleItems, ...p.output.dailyBlocks, ...p.output.recurringTasks, ...p.planBlocks]) expect(b.reason.length).toBeGreaterThan(10)
    // Inglês diário vira bloco em todos os dias; LinkedIn vira tarefa com checklist.
    expect(p.planBlocks.filter((b) => b.pillarId === 'ingles')).toHaveLength(14)
    const li = p.tasks.filter((t) => t.title === 'LinkedIn e carreira')
    expect(li).toHaveLength(2)
    expect(li[0].description).toContain('- [ ] ')
    // Marco sem data não vira tarefa; o datado vira prova no calendário.
    expect(p.tasks.filter((t) => t.kind === 'exam').map((t) => t.title)).toEqual(['Prova de certificação em ML'])
  })

  it('é determinística', () => {
    expect(previewRoutine(draft())).toEqual(previewRoutine(draft()))
  })
})

describe('applyRoutine', () => {
  it('cria matérias e tópicos das trilhas, ciclo ativo, cronograma com blocos, tarefas e meta', async () => {
    const b = fresh()
    const r = await applyRoutine(b, draft())
    expect(r.subjectsCreated).toBeGreaterThan(0)
    expect(r.topicsCreated).toBeGreaterThan(0)
    const names = (await b.list('subjects')).rows.map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['SQL e Bancos de Dados', 'Certificações']))
    expect(new Set(names).size).toBe(names.length)

    const cycle = await b.get('study_cycles', r.cycleId!)
    expect(cycle).toMatchObject({ name: routineCycleName(draft().name), status: 'active' })
    expect((await b.list('study_cycle_items', { filters: [eq('cycle_id', cycle!.id)] })).rows.length).toBe(previewRoutine(draft()).output.cycleItems.length)

    const plan = await b.get('study_plans', r.planId)
    expect(plan).toMatchObject({ name: routinePlanName(draft().name), start_date: '2026-11-02', end_date: '2026-11-15' })
    expect(r.planItems.added).toBe(previewRoutine(draft()).planBlocks.length)

    const tasks = (await b.list('calendar_tasks')).rows
    expect(tasks.length).toBe(r.tasks.added)
    expect(tasks.every((t) => t.description?.startsWith(routineMark(draft().name)))).toBe(true)
    expect(tasks.some((t) => t.kind === 'exam' && t.date === '2026-11-20')).toBe(true)

    const goals = (await b.list('study_goals')).rows
    expect(goals).toHaveLength(1)
    expect(goals[0]).toMatchObject({ metric: 'study_hours', period: 'weekly', status: 'active' })
  })

  it('aplicar duas vezes seguidas não duplica matérias, ciclo, blocos nem tarefas', async () => {
    const b = fresh()
    await applyRoutine(b, draft())
    const before = await snapshot(b)
    const again = await applyRoutine(b, draft())
    expect(again).toMatchObject({
      subjectsCreated: 0,
      topicsCreated: 0,
      cycleCreated: false,
      planCreated: false,
      goalCreated: false,
      cycleItems: { added: 0, updated: 0, removed: 0 },
      planItems: { added: 0, removed: 0 },
      tasks: { added: 0, removed: 0 },
    })
    expect(await snapshot(b)).toEqual(before)
    expect((await b.list('study_cycles', { filters: [eq('status', 'active')] })).rows).toHaveLength(1)
  })

  it('atualiza a duração das tarefas pendentes ao regerar, mantendo o id e sem duplicar', async () => {
    const b = fresh()
    const single = draft()
    single.pillars = single.pillars.filter((p) => p.id === 'linkedin').map((p) => ({ ...p, blockMinutes: 30 }))
    single.milestones = []
    await applyRoutine(b, single)
    const before = (await b.list('calendar_tasks')).rows
    expect(before.length).toBeGreaterThan(0)
    expect(before.every((t) => t.duration_minutes === 30)).toBe(true)

    const longer = { ...single, pillars: single.pillars.map((p) => ({ ...p, blockMinutes: 60 })) }
    const preview = previewRoutine(longer)
    const r = await applyRoutine(b, longer)
    const after = (await b.list('calendar_tasks')).rows
    const pick = (t: { title: string; date: string; start_time: string | null; duration_minutes: number | null; subject_id: string | null; kind: string; description: string | null }) =>
      ({ title: t.title, date: t.date, start_time: t.start_time, duration_minutes: t.duration_minutes, subject_id: t.subject_id, kind: t.kind, description: t.description })
    const sortKey = (t: { date: string; start_time: string | null }) => `${t.date}|${t.start_time ?? ''}`
    expect(after.map(pick).sort((x, y) => sortKey(x).localeCompare(sortKey(y)))).toEqual(preview.tasks.map(pick).sort((x, y) => sortKey(x).localeCompare(sortKey(y))))
    expect(after.every((t) => t.duration_minutes === 60)).toBe(true)
    expect(after).toHaveLength(preview.tasks.length)
    // Mesmo horário: o registro é atualizado no lugar (mesmo id).
    const sameSlot = before.filter((o) => after.some((t) => t.id === o.id))
    expect(r.tasks.updated).toBe(sameSlot.length)
    expect(r.tasks.added + r.tasks.updated).toBe(preview.tasks.length)

    // Reaplicar a mesma entrada não altera nem duplica.
    const again = await applyRoutine(b, longer)
    expect(again.tasks).toMatchObject({ added: 0, updated: 0, removed: 0 })
    expect((await b.list('calendar_tasks')).rows.map((t) => t.id).sort()).toEqual(after.map((t) => t.id).sort())
  })

  it('reaproveita matérias que o usuário já tinha e pausa o ciclo ativo anterior', async () => {
    const b = fresh()
    await b.insert('subjects', [{ name: 'sql e bancos de dados' }])
    const [old] = await b.insert('study_cycles', [{ name: 'Meu ciclo', status: 'active' }])
    const r = await applyRoutine(b, draft())
    expect(r.subjectsReused).toBeGreaterThanOrEqual(1)
    expect((await b.list('subjects')).rows.filter((s) => s.name.toLowerCase() === 'sql e bancos de dados')).toHaveLength(1)
    expect((await b.get('study_cycles', old.id))!.status).toBe('paused')
    expect((await b.get('study_cycles', r.cycleId!))!.status).toBe('active')
  })

  it('não apaga nem altera sessões de estudo existentes, mesmo ao regerar com mudanças', async () => {
    const b = fresh()
    const [mine] = await b.insert('subjects', [{ name: 'Minha matéria' }])
    await b.insert('study_sessions', [{ subject_id: mine.id, status: 'completed', started_at: '2026-10-01T10:00:00Z', ended_at: '2026-10-01T11:00:00Z', mode: 'manual' }])
    const r = await applyRoutine(b, draft())
    const [block] = (await b.list('study_plan_items', { filters: [eq('plan_id', r.planId)] })).rows
    const [item] = (await b.list('study_cycle_items', { filters: [eq('cycle_id', r.cycleId!)] })).rows
    await b.insert('study_sessions', [
      { subject_id: block.subject_id, status: 'completed', started_at: '2026-11-02T22:00:00Z', ended_at: '2026-11-02T22:50:00Z', mode: 'stopwatch', plan_item_id: block.id },
      { subject_id: item.subject_id, status: 'completed', started_at: '2026-11-03T22:00:00Z', ended_at: '2026-11-03T22:50:00Z', mode: 'stopwatch', cycle_id: r.cycleId, cycle_item_id: item.id },
    ])
    const sessions = (await b.list('study_sessions')).rows.sort((x, y) => x.id.localeCompare(y.id))

    // Regera com outra disponibilidade e sem o pilar de ciência de dados (blocos e itens mudam).
    const changed = draft()
    changed.pillars = changed.pillars.filter((p) => p.id !== 'ciencia_dados')
    changed.availability.days = { 1: evening, 3: evening, 6: morning }
    const r2 = await applyRoutine(b, changed)
    await applyRoutine(b, draft())
    expect(r2.planItems.removed).toBeGreaterThan(0)

    const after = (await b.list('study_sessions')).rows.sort((x, y) => x.id.localeCompare(y.id))
    expect(after).toEqual(sessions)
    // Itens usados por sessões continuam existindo.
    expect(await b.get('study_plan_items', block.id)).not.toBeNull()
    expect(await b.get('study_cycle_items', item.id)).not.toBeNull()
  })
})
