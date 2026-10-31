import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { CAREER_TRAILS, countTopics, subjectByKey, topicName, type TopicLeaf } from '@/content/trails'
import { installTrail } from '@/services/trails'

let n = 0
const fresh = () => new LocalBackend(`trail-teo-${++n}`)
const trail = () => CAREER_TRAILS.find((c) => c.key === 'teo_ciencia_de_dados')!
const items = () => trail().subjects.map((s) => ({ subject: subjectByKey(s.key), weight: s.weight }))

describe('trilha do Téo Me Why', () => {
  it('é a primeira trilha, em sequência, com 9 cursos e 135 aulas', () => {
    expect(CAREER_TRAILS[0].key).toBe('teo_ciencia_de_dados')
    expect(trail().sequential).toBe(true)
    expect(trail().subjects).toHaveLength(9)
    expect(items().reduce((a, i) => a + countTopics(i.subject.topics), 0)).toBe(135)
    expect(trail().subjects.map((s) => subjectByKey(s.key).name)[0]).toBe('Téo 1 · Git e GitHub')
    expect(trail().subjects.map((s) => subjectByKey(s.key).name).at(-1)).toBe('Téo 9 · Streamlit (opcional)')
  })

  it('toda aula tem link do YouTube e duração, sem repetir links', () => {
    const leaves = items().flatMap((i) => i.subject.topics) as TopicLeaf[]
    expect(leaves).toHaveLength(135)
    for (const l of leaves) {
      expect(l.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/)
      expect(l.minutes ?? 0).toBeGreaterThan(0)
    }
    expect(new Set(leaves.map((l) => l.url)).size).toBe(135)
    expect(new Set(leaves.map((l) => topicName(l))).size).toBe(135)
  })

  it('instala matérias, tópicos com duração e um link por aula', async () => {
    const backend = fresh()
    const r = await installTrail(backend, items())
    expect(r).toMatchObject({ subjectsCreated: 9, topicsCreated: 135, cycleId: null })
    expect(r.materialsCreated).toBe(135 + 9) // uma aula por link + o link do curso em cada matéria

    const topics = (await backend.list('topics', {})).rows
    expect(topics.every((t) => (t.estimated_minutes ?? 0) > 0)).toBe(true)
    const mats = (await backend.list('study_materials', {})).rows
    const aulas = mats.filter((m) => m.topic_id)
    expect(aulas).toHaveLength(135)
    expect(aulas.every((m) => m.title.startsWith('Aula no YouTube — ') && m.url?.includes('youtube.com'))).toBe(true)
    // cada link está no tópico certo
    const byTopic = new Map(topics.map((t) => [t.id, t]))
    for (const m of aulas) expect(m.title).toContain(byTopic.get(m.topic_id!)!.name)
  })

  it('instalar de novo não duplica matérias, tópicos nem links', async () => {
    const backend = fresh()
    await installTrail(backend, items())
    const again = await installTrail(backend, items())
    expect(again).toMatchObject({ subjectsCreated: 0, subjectsReused: 9, topicsCreated: 0, materialsCreated: 0 })
    expect((await backend.list('topics', {})).rows).toHaveLength(135)
    expect((await backend.list('study_materials', {})).rows).toHaveLength(144)
  })

  it('cria o ciclo recomendado: Inglês + Aula + Prática, 60 minutos cada', async () => {
    const backend = fresh()
    const r = await installTrail(backend, items(), { cyclePlan: trail().cyclePlan })
    expect(r.cycleId).toBeTruthy()
    const cycle = (await backend.list('study_cycles', {})).rows[0]
    expect(cycle).toMatchObject({ name: 'Do zero a cientista de dados', status: 'active', auto_advance: true })
    const blocks = (await backend.list('study_cycle_items', { order: [{ column: 'sort_order' }] })).rows
    expect(blocks.map((b) => [b.duration_minutes, b.activity_type, b.break_minutes])).toEqual([
      [60, 'other', 10],
      [60, 'video', 10],
      [60, 'questions', 10],
    ])
    const subjects = new Map((await backend.list('subjects', {})).rows.map((s) => [s.id, s.name]))
    expect(subjects.get(blocks[0].subject_id)).toBe('Inglês') // criada, pois ainda não existia
    expect(subjects.get(blocks[1].subject_id)).toBe('Téo 1 · Git e GitHub')
    expect(subjects.get(blocks[2].subject_id)).toBe('Téo 1 · Git e GitHub')
  })

  it('reaproveita a matéria de inglês que já existe (Times Book 1) em vez de criar outra', async () => {
    const backend = fresh()
    const [ingles] = await backend.insert('subjects', [{ name: 'Inglês · Times Book 1', color: '#2A78D6', difficulty: 3, priority: 5, status: 'active', sort_order: 0 }])
    const r = await installTrail(backend, items(), { cyclePlan: trail().cyclePlan })
    expect(r.subjectsCreated).toBe(9) // nenhuma matéria de inglês nova
    const blocks = (await backend.list('study_cycle_items', { order: [{ column: 'sort_order' }] })).rows
    expect(blocks[0].subject_id).toBe(ingles.id)
  })

  it('não desativa o ciclo que o usuário já tem ativo: o novo entra pausado', async () => {
    const backend = fresh()
    await backend.insert('study_cycles', [{ name: 'Meu ciclo', status: 'active', auto_advance: true }])
    await installTrail(backend, items(), { cyclePlan: trail().cyclePlan })
    const cycles = (await backend.list('study_cycles', {})).rows
    expect(cycles.find((c) => c.name === 'Do zero a cientista de dados')?.status).toBe('paused')
    expect(cycles.find((c) => c.name === 'Meu ciclo')?.status).toBe('active')
  })
})
