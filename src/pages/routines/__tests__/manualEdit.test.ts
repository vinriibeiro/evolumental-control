import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { cloneRoutineTemplate, routineTemplateById } from '@/content/routines'
import { applyRoutine, appliedRoutineFrom, diffRoutine, loadAppliedRoutine, previewRoutine, type RoutineDraft } from '@/services/routines'
import type { TableName } from '@/types/db'

let n = 0
const fresh = () => new LocalBackend(`routines-manual-${++n}`)

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

const TABLES: TableName[] = ['subjects', 'topics', 'study_cycles', 'study_cycle_items', 'study_plans', 'study_plan_items', 'calendar_tasks', 'study_goals', 'study_sessions']
async function fullSnapshot(b: LocalBackend) {
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES) out[t] = (await b.list(t)).rows.sort((x, y) => x.id.localeCompare(y.id))
  return out
}

const blockKey = (r: { date: string; start_time: string; subject_id: string | null; duration_minutes: number; activity_type: string }) =>
  `${r.date}|${r.start_time}|${r.subject_id}|${r.duration_minutes}|${r.activity_type}`

describe('modo manual: editar a rotina aplicada e regerar', () => {
  it('carrega a rotina aplicada com pilares, pesos, frequências e janelas de horário', async () => {
    const b = fresh()
    expect(await loadAppliedRoutine(b)).toBeNull()
    const d = draft()
    const r = await applyRoutine(b, d)
    const loaded = await loadAppliedRoutine(b)
    expect(loaded?.planId).toBe(r.planId)
    expect(loaded!.draft).toEqual(d)
    expect(loaded!.draft.pillars.map((p) => [p.id, p.weight, p.frequency, p.daysPerWeek])).toEqual(d.pillars.map((p) => [p.id, p.weight, p.frequency, p.daysPerWeek]))
    expect(loaded!.draft.availability.days[1]).toEqual(evening)
    expect(loaded!.draft.availability.days[6]).toEqual(morning)
  })

  it('appliedRoutineFrom ignora cronogramas sem rotina e devolve uma cópia editável', async () => {
    const b = fresh()
    await b.insert('study_plans', [{ name: 'Cronograma comum', status: 'active', start_date: '2026-11-02', end_date: '2026-11-08' }])
    expect(await loadAppliedRoutine(b)).toBeNull()
    await applyRoutine(b, draft())
    const plans = (await b.list('study_plans')).rows
    const a = appliedRoutineFrom(plans)!
    a.draft.pillars[0].weight = 9
    expect(appliedRoutineFrom(plans)!.draft.pillars[0].weight).toBe(draft().pillars[0].weight)
  })

  it('logo após aplicar, a prévia não tem diferenças', async () => {
    const b = fresh()
    await applyRoutine(b, draft())
    const diff = await diffRoutine(b, (await loadAppliedRoutine(b))!.draft)
    expect(diff.unchanged).toBe(true)
    expect(diff.plan).toMatchObject({ added: 0, removed: 0 })
    expect(diff.cycle).toMatchObject({ added: 0, updated: 0, removed: 0 })
    expect(diff.tasks).toMatchObject({ added: 0, updated: 0, removed: 0 })
  })

  it('a prévia (diffPlan) mostra o que entra, sai e muda, e cancelar não altera nenhum dado', async () => {
    const b = fresh()
    await applyRoutine(b, draft())
    const before = await fullSnapshot(b)
    const edited = (await loadAppliedRoutine(b))!.draft
    edited.pillars = edited.pillars.filter((p) => p.id !== 'linkedin').map((p) => (p.id === 'certificacoes' ? { ...p, weight: 4 } : p))
    edited.availability.days[2] = []
    const diff = await diffRoutine(b, edited)
    expect(diff.unchanged).toBe(false)
    expect(diff.plan.added).toBeGreaterThan(0)
    expect(diff.plan.removed).toBeGreaterThan(0)
    expect(diff.entering.length).toBeGreaterThan(0)
    expect(diff.leaving.some((l) => l.includes('LinkedIn e carreira'))).toBe(true)
    expect(diff.changing.some((l) => l.startsWith('Ciclo:') && l.includes('peso 2 → 4'))).toBe(true)
    // Cancelar = descartar a prévia: nada foi gravado.
    expect(await fullSnapshot(b)).toEqual(before)
    expect((await loadAppliedRoutine(b))!.draft).toEqual(draft())
  })

  it('mudar o peso de um pilar e reaplicar altera só os itens afetados e mantém as sessões', async () => {
    const b = fresh()
    const r = await applyRoutine(b, draft())
    const blocksBefore = (await b.list('study_plan_items', { filters: [eq('plan_id', r.planId)] })).rows
    const itemsBefore = (await b.list('study_cycle_items', { filters: [eq('cycle_id', r.cycleId!)] })).rows
    const tasksBefore = (await b.list('calendar_tasks')).rows
    const block = blocksBefore.find((x) => x.date === '2026-11-02')!
    await b.insert('study_sessions', [
      { subject_id: block.subject_id, status: 'completed', started_at: '2026-11-02T22:00:00Z', ended_at: '2026-11-02T22:50:00Z', mode: 'stopwatch', plan_item_id: block.id },
      { subject_id: itemsBefore[0].subject_id, status: 'completed', started_at: '2026-11-03T22:00:00Z', ended_at: '2026-11-03T22:50:00Z', mode: 'stopwatch', cycle_id: r.cycleId, cycle_item_id: itemsBefore[0].id },
    ])
    const sessions = (await b.list('study_sessions')).rows.sort((x, y) => x.id.localeCompare(y.id))

    const edited = (await loadAppliedRoutine(b))!.draft
    edited.pillars = edited.pillars.map((p) => (p.id === 'certificacoes' ? { ...p, weight: 4 } : p))
    const diff = await diffRoutine(b, edited)
    const r2 = await applyRoutine(b, edited)

    // O que foi aplicado é exatamente o que a prévia mostrou.
    expect(r2.planItems).toEqual({ added: diff.plan.added, removed: diff.plan.removed, kept: diff.plan.kept })
    expect(r2.cycleItems).toEqual(diff.cycle)
    expect(r2.tasks).toEqual(diff.tasks)
    expect(r2.cycleItems.updated).toBeGreaterThan(0)
    expect(r2).toMatchObject({ subjectsCreated: 0, cycleCreated: false, planCreated: false, cycleItems: { added: 0, removed: 0 }, tasks: { added: 0, updated: 0, removed: 0 } })

    // Itens do ciclo atualizados no lugar; tarefas intocadas.
    const itemsAfter = (await b.list('study_cycle_items', { filters: [eq('cycle_id', r.cycleId!)] })).rows
    expect(itemsAfter.map((x) => x.id).sort()).toEqual(itemsBefore.map((x) => x.id).sort())
    expect(itemsAfter.find((x) => x.weight === 4)).toBeTruthy()
    expect((await b.list('calendar_tasks')).rows.sort((x, y) => x.id.localeCompare(y.id))).toEqual(tasksBefore.sort((x, y) => x.id.localeCompare(y.id)))

    // Blocos: só os afetados saem/entram; os que continuam iguais mantêm o id.
    const blocksAfter = (await b.list('study_plan_items', { filters: [eq('plan_id', r.planId)] })).rows
    const afterIds = new Set(blocksAfter.map((x) => x.id))
    const beforeIds = new Set(blocksBefore.map((x) => x.id))
    const afterKeys = new Set(blocksAfter.map(blockKey))
    expect(blocksBefore.filter((x) => afterKeys.has(blockKey(x))).every((x) => afterIds.has(x.id))).toBe(true)
    expect(blocksBefore.filter((x) => !afterIds.has(x.id))).toHaveLength(r2.planItems.removed)
    expect(blocksAfter.filter((x) => !beforeIds.has(x.id))).toHaveLength(r2.planItems.added)
    expect(r2.planItems.removed).toBeLessThan(blocksBefore.length)
    // Inglês (pilar diário, sem relação com o peso alterado) não muda.
    const ingles = previewRoutine(draft()).planBlocks.filter((x) => x.pillarId === 'ingles').length
    expect(blocksBefore.filter((x) => afterIds.has(x.id)).length).toBeGreaterThanOrEqual(ingles)

    // Histórico de sessões intacto, e os registros que elas usam continuam.
    expect((await b.list('study_sessions')).rows.sort((x, y) => x.id.localeCompare(y.id))).toEqual(sessions)
    expect(await b.get('study_plan_items', block.id)).not.toBeNull()

    // A edição fica salva e reaplicar não muda mais nada.
    expect((await loadAppliedRoutine(b))!.draft.pillars.find((p) => p.id === 'certificacoes')!.weight).toBe(4)
    expect((await diffRoutine(b, edited)).unchanged).toBe(true)
  })
})
