import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DS_TRACKS } from '@/content/dsTrail'
import { questionsFor } from '@/content/dsDiagnostics'
import { LocalBackend } from '@/lib/data/local'
import { eq, notNull } from '@/lib/data/types'
import { nextTopic, satisfiedKeys, scoreDiagnostic, topicState } from '@/lib/trail'
import { applyAssessment, missingTrailKeys, recordLabExercise, saveAssessment, scheduleTopicReviews, syncDsTrail } from '../dsTrail'
import { applyReplan, createTask, deleteTask, extendSeries, planTemplate, planWeekCopy, templateFromWeek } from '../tasks'
import type { PlanActivity } from '@/lib/replan'

let backend: LocalBackend
let n = 0
beforeEach(() => {
  backend = new LocalBackend(`test-ds-${++n}-${Date.now()}`)
})

const TOTAL_TOPICS = DS_TRACKS.reduce((a, t) => a + t.topics.length, 0)

describe('trilha de Ciência de Dados: instalação sem duplicar', () => {
  it('cria os quatro pilares de dados e todos os tópicos; rodar de novo não cria nada', async () => {
    const first = await syncDsTrail(backend, { weeklyMinutes: 1200 })
    expect(first).toEqual({ subjectsCreated: 4, subjectsAdopted: 0, topicsCreated: TOTAL_TOPICS, topicsAdopted: 0 })
    const second = await syncDsTrail(backend, { weeklyMinutes: 1200 })
    expect(second).toEqual({ subjectsCreated: 0, subjectsAdopted: 0, topicsCreated: 0, topicsAdopted: 0 })
    const subjects = (await backend.list('subjects')).rows
    const topics = (await backend.list('topics')).rows
    expect(subjects).toHaveLength(4)
    expect(topics).toHaveLength(TOTAL_TOPICS)
    expect(missingTrailKeys(subjects, topics)).toEqual({ subjects: 0, topics: 0 })
    const hours = Object.fromEntries(subjects.map((s) => [s.trail_key, s.weekly_goal_hours]))
    expect(hours['ds.sql']).toBe(6)
    expect(hours['ds.python']).toBe(6)
    expect(hours['ds.ml']).toBe(5)
    expect(hours['ds.powerbi']).toBe(3)
  })

  it('adota matéria e tópico já existentes com o mesmo nome, preservando o progresso', async () => {
    const [sql] = await backend.insert('subjects', [{ name: 'sql', color: '#000000' }])
    const [join] = await backend.insert('topics', [{ subject_id: sql.id, name: 'JOIN', status: 'completed', mastery: 4 }])
    await backend.insert('topics', [{ subject_id: sql.id, name: 'Meu tópico antigo' }])
    const r = await syncDsTrail(backend, { weeklyMinutes: 600 })
    expect(r.subjectsAdopted).toBe(1)
    expect(r.subjectsCreated).toBe(3)
    expect(r.topicsAdopted).toBe(1)
    const after = await backend.get('topics', join.id)
    expect(after).toMatchObject({ trail_key: 'ds.sql.join', status: 'completed', mastery: 4 })
    expect((await backend.list('subjects')).rows).toHaveLength(4)
    // o tópico antigo do usuário continua lá, sem chave
    expect((await backend.list('topics', { filters: [eq('subject_id', sql.id)] })).rows.some((t) => t.name === 'Meu tópico antigo' && !t.trail_key)).toBe(true)
    expect((await backend.list('topics', { filters: [eq('trail_key', 'ds.sql.join')] })).rows).toHaveLength(1)
  })

  it('completa só o que falta quando o conteúdo ganha tópicos novos', async () => {
    const partial = DS_TRACKS.map((t) => ({ ...t, topics: t.topics.slice(0, 2) }))
    await syncDsTrail(backend, { weeklyMinutes: 600, tracks: partial })
    const r = await syncDsTrail(backend, { weeklyMinutes: 600 })
    expect(r.subjectsCreated).toBe(0)
    expect(r.topicsCreated).toBe(TOTAL_TOPICS - 8)
    expect((await backend.list('topics', { filters: [notNull('trail_key')] })).rows).toHaveLength(TOTAL_TOPICS)
  })
})

describe('estado dos tópicos e diagnóstico', () => {
  const sql = DS_TRACKS.find((t) => t.key === 'sql')!

  it('tempo de estudo não conclui nem demonstra nada; só conclusão ou evidência liberam o seguinte', () => {
    const second = sql.topics[1]
    expect(topicState(second, undefined, new Set())).toBe('locked')
    const studying = [{ trail_key: sql.topics[0].key, status: 'in_progress' as const, knowledge: null }]
    expect(topicState(second, undefined, satisfiedKeys(studying))).toBe('locked')
    const done = [{ trail_key: sql.topics[0].key, status: 'completed' as const, knowledge: null }]
    expect(topicState(second, undefined, satisfiedKeys(done))).toBe('available')
    const self = [{ trail_key: sql.topics[0].key, status: 'not_started' as const, knowledge: 'self' as const }]
    expect(topicState(sql.topics[0], self[0], satisfiedKeys(self))).toBe('self')
    expect(nextTopic(sql, new Map(self.map((r) => [r.trail_key, r])), satisfiedKeys(self))?.key).toBe(second.key)
  })

  it('exemplo do usuário: domina SELECT/WHERE/ORDER BY, erra JOIN → ponto de partida é JOIN', async () => {
    const qs = questionsFor('sql')
    const chosen: Record<string, number | null> = {}
    for (const q of qs) {
      if (['ds.sql.select', 'ds.sql.filtros'].includes(q.topicKey)) chosen[q.id] = q.answer
      else if (q.topicKey === 'ds.sql.join') chosen[q.id] = (q.answer + 1) % 4
    }
    const score = scoreDiagnostic(sql, qs, chosen)
    expect(score.topics.find((t) => t.topic_key === 'ds.sql.select')?.outcome).toBe('demonstrated')
    expect(score.topics.find((t) => t.topic_key === 'ds.sql.join')?.outcome).toBe('gap')
    expect(score.start_key).toBe('ds.sql.join')
    // "não sei" conta como não demonstrado, nunca como acerto
    const unsure = scoreDiagnostic(sql, qs, Object.fromEntries(qs.filter((q) => q.topicKey === 'ds.sql.select').map((q) => [q.id, null])))
    expect(unsure.correct).toBe(0)
    expect(unsure.topics[0].outcome).toBe('gap')

    await syncDsTrail(backend, { weeklyMinutes: 600 })
    const a1 = await saveAssessment(backend, 'sql', score)
    const applied = await applyAssessment(backend, score)
    expect(applied).toBe(score.topics.filter((t) => t.outcome === 'demonstrated').length)
    const topics = (await backend.list('topics', { filters: [notNull('trail_key')] })).rows
    expect(topics.find((t) => t.trail_key === 'ds.sql.select')?.knowledge).toBe('demonstrated')
    expect(topics.find((t) => t.trail_key === 'ds.sql.join')?.knowledge).toBeNull()
    // demonstrado não é o mesmo que concluído
    expect(topics.find((t) => t.trail_key === 'ds.sql.select')?.status).toBe('not_started')
    // refazer não sobrescreve o histórico
    const a2 = await saveAssessment(backend, 'sql', score)
    expect(a2.id).not.toBe(a1.id)
    expect((await backend.list('assessments')).rows).toHaveLength(2)
  })

  it('um acerto isolado é evidência insuficiente, não domínio', () => {
    const qs = questionsFor('sql')
    const one = qs.find((q) => q.topicKey === 'ds.sql.cte')!
    const score = scoreDiagnostic(sql, qs, { [one.id]: one.answer })
    expect(score.topics).toEqual([{ topic_key: 'ds.sql.cte', asked: 1, correct: 1, outcome: 'partial' }])
    expect(score.start_key).toBe('ds.sql.cte')
  })

  it('revisões do tópico e exercícios do laboratório não se repetem', async () => {
    await syncDsTrail(backend, { weeklyMinutes: 600 })
    const [topic] = (await backend.list('topics', { filters: [eq('trail_key', 'ds.sql.join')] })).rows
    expect(await scheduleTopicReviews(backend, topic, [1, 7, 30], '2026-11-23')).toBe(3)
    expect(await scheduleTopicReviews(backend, topic, [1, 7, 30], '2026-11-23')).toBe(0)
    expect(await recordLabExercise(backend, { id: 'sql-basic-1', track: 'sql', title: 'Teste' }, '2026-11-23')).toBe(true)
    expect(await recordLabExercise(backend, { id: 'sql-basic-1', track: 'sql', title: 'Teste' }, '2026-11-24')).toBe(false)
    const records = (await backend.list('question_records')).rows
    expect(records).toHaveLength(1)
    expect(records[0].subject_id).toBe(topic.subject_id)
  })
})

describe('tarefas do planejamento', () => {
  it('recorrência grava uma ocorrência por dia da regra e não duplica ao estender', async () => {
    const rows = await createTask(backend, { title: 'SQL', date: '2026-11-23', start_time: '19:00', duration_minutes: 60, category: 'estudos' }, { freq: 'weekly', days: [1, 5], until: null })
    expect(rows).toHaveLength(16)
    expect(new Set(rows.map((r) => r.series_id)).size).toBe(1)
    expect(await extendSeries(backend, '2026-11-23')).toBe(0)
    // três semanas depois, a série ganha as ocorrências que faltam até o novo horizonte, sem repetir as antigas
    const added = await extendSeries(backend, '2026-12-14')
    expect(added).toBe(6)
    const all = (await backend.list('calendar_tasks')).rows
    expect(new Set(all.map((r) => r.date)).size).toBe(all.length)
    // a mesma série não aceita dois registros no mesmo dia
    await expect(backend.insert('calendar_tasks', [{ title: 'SQL', date: '2026-11-23', series_id: rows[0].series_id }])).rejects.toMatchObject({ code: 'duplicate' })
  })

  it('excluir "esta e as próximas" preserva as concluídas e encerra a série', async () => {
    const rows = await createTask(backend, { title: 'Inglês', date: '2026-11-23' }, { freq: 'daily', until: '2026-11-27' })
    await backend.update('calendar_tasks', [eq('id', rows[4].id)], { done: true })
    await deleteTask(backend, rows[2], 'following')
    const left = (await backend.list('calendar_tasks', { order: [{ column: 'date' }] })).rows
    expect(left.map((r) => r.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-27'])
    expect(left[0].recurrence?.until).toBe('2026-11-24')
    expect(await extendSeries(backend, '2026-11-25')).toBe(0)
  })

  it('aplicar o replanejamento atualiza o próprio registro (vínculos preservados, nada duplicado)', async () => {
    await syncDsTrail(backend, { weeklyMinutes: 600 })
    const [topic] = (await backend.list('topics', { filters: [eq('trail_key', 'ds.python.pandas')] })).rows
    const [task] = await createTask(backend, { title: 'Python', date: '2026-11-24', start_time: '19:00', duration_minutes: 60, category: 'estudos', subject_id: topic.subject_id, topic_id: topic.id })
    const [done] = await createTask(backend, { title: 'SQL', date: '2026-11-23', start_time: '19:00' })
    await backend.update('calendar_tasks', [eq('id', done.id)], { done: true })
    const activity = (t: typeof task): PlanActivity => ({ id: `task:${t.id}`, source: 'task', refId: t.id, title: t.title, date: t.date, start: 19 * 60, duration: 60, done: false, fixed: false, study: true, priority: 2, due: null, subjectId: t.subject_id, topicId: t.topic_id, recurring: false })
    const applied = await applyReplan(backend, [
      { activity: activity(task), toDate: '2026-11-26', toStart: 20 * 60, reason: '' },
      { activity: activity(done), toDate: '2026-11-26', toStart: 21 * 60, reason: '' },
    ])
    // a tarefa já concluída não é movida
    expect(applied).toBe(1)
    const all = (await backend.list('calendar_tasks')).rows
    expect(all).toHaveLength(2)
    expect(all.find((t) => t.id === task.id)).toMatchObject({ date: '2026-11-26', start_time: '20:00', subject_id: topic.subject_id, topic_id: topic.id })
    expect(all.find((t) => t.id === done.id)).toMatchObject({ date: '2026-11-23', done: true })
  })

  it('copiar a semana e aplicar modelo ignoram o que já existe', async () => {
    const source = await backend.insert('calendar_tasks', [
      { title: 'SQL', date: '2026-11-16', start_time: '19:00', duration_minutes: 60 },
      { title: 'Mercado', date: '2026-11-21' },
    ])
    const plan = planWeekCopy(source, [], '2026-11-16', '2026-11-23')
    expect(plan.create.map((c) => c.date)).toEqual(['2026-11-23', '2026-11-28'])
    const created = await backend.insert('calendar_tasks', plan.create)
    expect(planWeekCopy(source, created, '2026-11-16', '2026-11-23')).toMatchObject({ create: [], skipped: 2 })
    // a origem impede repetir a cópia mesmo se o título for alterado depois
    await expect(backend.insert('calendar_tasks', [{ ...plan.create[0], title: 'Outro nome' }])).rejects.toMatchObject({ code: 'duplicate' })

    const tpl = templateFromWeek('Padrão', source)
    expect(tpl.items).toHaveLength(2)
    const first = planTemplate(tpl, '2026-11-30', [])
    expect(first.create.map((c) => c.date)).toEqual(['2026-11-30', '2026-12-05'])
    const applied = await backend.insert('calendar_tasks', first.create)
    expect(planTemplate(tpl, '2026-11-30', applied).create).toEqual([])
  })
})
