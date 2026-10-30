import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { cloneRoutineTemplate, routineTemplateById } from '@/content/routines'
import { applyRoutine, appliedRoutineFrom, diffRoutine, loadAppliedRoutine, routineConfigChanges, type RoutineDraft, type RoutinePlanConfig } from '@/services/routines'
import type { TableName } from '@/types/db'

let n = 0
const fresh = () => new LocalBackend(`routines-compat-${++n}`)

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
const ids = async (b: LocalBackend, t: TableName) => (await b.list(t)).rows.map((r) => r.id).sort((x, y) => x.localeCompare(y))

/** Simula um cronograma gravado pela versão anterior: só o config do planner, sem config.routine. */
async function toLegacy(b: LocalBackend, planId: string) {
  const plan = (await b.get('study_plans', planId))!
  const planConfig: RoutinePlanConfig = { ...(plan.config as RoutinePlanConfig) }
  delete planConfig.routine
  await b.update('study_plans', [eq('id', planId)], { config: planConfig })
}

describe('compatibilidade: rotina aplicada pela versão anterior', () => {
  it('carrega a rotina sem config.routine, recuperando o possível e avisando o resto', async () => {
    const b = fresh()
    const d = draft()
    d.pillars = d.pillars.map((p) => (p.id === 'certificacoes' ? { ...p, weight: 4 } : p))
    const r = await applyRoutine(b, d)
    await toLegacy(b, r.planId)
    expect(((await b.get('study_plans', r.planId))!.config as RoutinePlanConfig).routine).toBeUndefined()

    const sync = appliedRoutineFrom((await b.list('study_plans')).rows)
    expect(sync?.planId).toBe(r.planId)
    expect(sync?.legacy?.missing.length).toBeGreaterThan(0)

    const loaded = (await loadAppliedRoutine(b))!
    expect(loaded.planId).toBe(r.planId)
    expect(loaded.legacy?.missing.length).toBeGreaterThan(0)
    const { draft: ld } = loaded
    expect(ld).toMatchObject({ templateId: d.templateId, name: d.name, startDate: '2026-11-02', weeks: 2 })
    expect(ld.availability).toMatchObject({ weeklyLimitMinutes: 720, dailyLimitMinutes: 150, breakMinutes: 10 })
    expect(ld.availability.days[1][0].start).toBe('19:00')
    expect(ld.availability.days[1][0].end <= '22:00').toBe(true)
    expect(ld.availability.days[0][0].start).toBe('09:00')
    // Pilares do modelo, com o peso recuperado dos itens do ciclo.
    expect(ld.pillars.map((p) => p.id)).toEqual(d.pillars.map((p) => p.id))
    expect(ld.pillars.find((p) => p.id === 'certificacoes')!.weight).toBe(4)
    expect(ld.pillars.map((p) => p.frequency)).toEqual(d.pillars.map((p) => p.frequency))
    // Marcos com data vêm das provas do calendário.
    expect(ld.milestones).toContainEqual(expect.objectContaining({ title: 'Prova de certificação em ML', date: '2026-11-20' }))
  })

  it('regerar a rotina antiga mostra a mudança de configuração, cancelar não grava e confirmar salva', async () => {
    const b = fresh()
    const r = await applyRoutine(b, draft())
    await toLegacy(b, r.planId)
    const before = await fullSnapshot(b)
    const loaded = (await loadAppliedRoutine(b))!

    const diff = await diffRoutine(b, loaded.draft)
    expect(diff.configChanged).toBe(true)
    expect(diff.unchanged).toBe(false)
    expect(diff.changing.some((l) => l.includes('versão anterior'))).toBe(true)
    expect(await fullSnapshot(b)).toEqual(before)

    const sessionsBefore = await ids(b, 'study_sessions')
    const r2 = await applyRoutine(b, loaded.draft)
    expect(r2.planId).toBe(r.planId)
    expect(r2.planCreated).toBe(false)
    const after = (await loadAppliedRoutine(b))!
    expect(after.legacy).toBeUndefined()
    expect(after.draft).toEqual(loaded.draft)
    expect(await ids(b, 'study_sessions')).toEqual(sessionsBefore)
    expect((await diffRoutine(b, after.draft)).unchanged).toBe(true)
  })

  it('ignora cronogramas comuns que não são de rotina', async () => {
    const b = fresh()
    await b.insert('study_plans', [{ name: 'Rotina — Outra', description: 'Feito à mão', status: 'active', start_date: '2026-11-02', end_date: '2026-11-08' }])
    expect(await loadAppliedRoutine(b)).toBeNull()
  })
})

describe('mudança só de configuração', () => {
  it('ampliar uma janela sem mudar os blocos aparece na prévia e é salva, mantendo os ids', async () => {
    const b = fresh()
    await applyRoutine(b, draft())
    const edited = (await loadAppliedRoutine(b))!.draft
    edited.availability.days[1] = [{ start: '19:00', end: '23:00' }]
    const before = await fullSnapshot(b)

    const diff = await diffRoutine(b, edited)
    expect(diff.plan).toMatchObject({ added: 0, removed: 0 })
    expect(diff.cycle).toMatchObject({ added: 0, updated: 0, removed: 0 })
    expect(diff.tasks).toMatchObject({ added: 0, updated: 0, removed: 0 })
    expect(diff.configChanged).toBe(true)
    expect(diff.unchanged).toBe(false)
    expect(diff.changing).toContain('Horário de Segunda: 19:00–22:00 → 19:00–23:00')
    // Cancelar: nada gravado.
    expect(await fullSnapshot(b)).toEqual(before)

    const r = await applyRoutine(b, edited)
    expect(r.planItems).toMatchObject({ added: 0, removed: 0 })
    for (const t of ['study_plan_items', 'study_cycle_items', 'calendar_tasks', 'study_plans', 'study_cycles', 'study_goals'] as TableName[]) {
      expect(await ids(b, t)).toEqual((before[t] as Array<{ id: string }>).map((x) => x.id))
    }
    expect((await loadAppliedRoutine(b))!.draft.availability.days[1]).toEqual([{ start: '19:00', end: '23:00' }])
    expect((await diffRoutine(b, edited)).unchanged).toBe(true)
  })

  it('routineConfigChanges descreve pilares, pesos, frequências e horários', () => {
    const a = draft()
    expect(routineConfigChanges(a, draft())).toEqual([])
    const c = draft()
    c.pillars = c.pillars.filter((p) => p.id !== 'linkedin').map((p) => (p.id === 'ingles' ? { ...p, weight: 9, frequency: 'weekly' as const } : p))
    c.availability.days[6] = []
    c.availability.dailyLimitMinutes = null
    const lines = routineConfigChanges(a, c)
    expect(lines.some((l) => l.startsWith('Pilar removido:'))).toBe(true)
    expect(lines.some((l) => /peso \d+ → 9/.test(l) && l.includes('diário → semanal'))).toBe(true)
    expect(lines).toContain('Horário de Sábado: 09:00–12:00 → sem horário')
    expect(lines).toContain('Limite por dia: 150 min → sem limite')
  })
})
