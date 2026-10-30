import { describe, expect, it } from 'vitest'
import { cloneRoutineTemplate, ROUTINE_TEMPLATES, routineTemplateById } from '@/content/routines'
import { CAREER_TRAILS, SUBJECT_LIBRARY } from '@/content/trails'
import { generateRoutine } from '@/lib/routine'

const evening = [{ start: '19:00', end: '22:00' }]
const availability = {
  days: { 0: [{ start: '09:00', end: '12:00' }], 1: evening, 2: evening, 3: evening, 4: evening, 5: evening, 6: [{ start: '09:00', end: '12:00' }] },
  dailyLimitMinutes: 150,
  weeklyLimitMinutes: 720,
  breakMinutes: 10,
}

const transition = routineTemplateById('transicao_analista_cientista')!
const pillar = (id: string) => transition.pillars.find((p) => p.id === id)!

describe('catálogo de modelos de rotina', () => {
  it('exporta os modelos de transição e em branco com IDs únicos', () => {
    const ids = ROUTINE_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('transicao_analista_cientista')
    expect(ids).toContain('em_branco')
    expect(new Set(ids).size).toBe(ids.length)
    expect(transition.name).toBe('Transição: Analista → Cientista de Dados')
    expect(routineTemplateById('em_branco')!.mode).toBe('manual')
    expect(routineTemplateById('em_branco')!.pillars).toEqual([])
  })

  it('o modelo de transição tem exatamente os seis pilares do PRD', () => {
    expect(transition.pillars.map((p) => p.id)).toEqual([
      'ciencia_dados', 'analise_dados', 'problemas_ds', 'linkedin', 'certificacoes', 'ingles',
    ])
  })

  it('Ciência de Dados tem o maior peso; Análise tem peso médio semanal; Inglês é diário e curto', () => {
    const ds = pillar('ciencia_dados')
    for (const p of transition.pillars) if (p.id !== ds.id) expect(ds.weight).toBeGreaterThan(p.weight)
    const an = pillar('analise_dados')
    expect(an.weight).toBeGreaterThan(0)
    expect(an.weight).toBeLessThan(ds.weight)
    expect(an.frequency).toBe('weekly')
    expect(pillar('problemas_ds').frequency).toBe('weekly')
    const en = pillar('ingles')
    expect(en.frequency).toBe('daily')
    expect(en.blockMinutes).toBeLessThanOrEqual(30)
  })

  it('pilares de estudo apontam para trilhas e matérias existentes', () => {
    const trailKeys = CAREER_TRAILS.map((t) => t.key)
    expect(pillar('ciencia_dados').trailId).toBe('cientista_dados')
    expect(pillar('analise_dados').trailId).toBe('analista_dados')
    const subjectKeys = SUBJECT_LIBRARY.map((s) => s.key)
    for (const t of ROUTINE_TEMPLATES) {
      for (const p of t.pillars) {
        if (p.trailId) expect(trailKeys).toContain(p.trailId)
        for (const k of p.subjectKeys) expect(subjectKeys).toContain(k)
      }
    }
  })

  it('certificações são marcos de exemplo sem data e LinkedIn é checklist semanal', () => {
    const certs = transition.milestones.filter((m) => m.pillarId === 'certificacoes')
    expect(certs.length).toBeGreaterThan(0)
    for (const m of certs) expect(m.date).toBeNull()
    const li = pillar('linkedin')
    expect(li.frequency).toBe('weekly')
    expect(li.tasks!.length).toBeGreaterThanOrEqual(3)
  })

  it('todo modelo passa por generateRoutine; a transição gera inglês diário e LinkedIn semanal', () => {
    for (const t of ROUTINE_TEMPLATES) {
      expect(() => generateRoutine({ pillars: t.pillars, availability, startDate: '2026-11-02', weeks: 2 })).not.toThrow()
    }
    const out = generateRoutine({ pillars: transition.pillars, availability, startDate: '2026-11-02', weeks: 2 })
    const en = out.dailyBlocks.filter((b) => b.pillarId === 'ingles')
    expect(en.map((b) => b.weekday).sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(out.recurringTasks.map((r) => r.pillarId)).toEqual(expect.arrayContaining(['analise_dados', 'problemas_ds', 'linkedin']))
    expect(out.cycleItems.map((c) => c.pillarId)).toContain('ciencia_dados')
  })

  it('clonar permite editar sem alterar o catálogo', () => {
    const copy = cloneRoutineTemplate(transition)
    copy.pillars[0].weight = 1
    copy.pillars[3].tasks!.push('x')
    copy.milestones[0].title = 'Minha prova'
    expect(pillar('ciencia_dados').weight).toBe(5)
    expect(pillar('linkedin').tasks).not.toContain('x')
    expect(transition.milestones[0].title).not.toBe('Minha prova')
  })
})
