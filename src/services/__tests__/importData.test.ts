import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { planImport, runImport } from '@/services/importData'
import { breakdown, streak } from '@/lib/stats'

let n = 0
const fresh = () => new LocalBackend(`import-${++n}`)

describe('importação de JSON', () => {
  it('refaz IDs e vínculos (matéria → tópicos aninhados → baralho → cartões → mapa)', async () => {
    const pkg = {
      subjects: [{ id: 's1', name: 'SQL', color: '#2a78d6' }],
      topics: [
        { id: 't2', subject_id: 's1', parent_id: 't1', name: 'INNER JOIN' }, // filho antes do pai no arquivo
        { id: 't1', subject_id: 's1', parent_id: null, name: 'Joins' },
        { id: 'tx', subject_id: 'nao-existe', name: 'Órfão' },
      ],
      flashcard_decks: [{ id: 'd1', name: 'Joins', subject_id: 's1', topic_id: 't1' }],
      flashcards: [
        { deck_id: 'd1', topic_id: 't2', front: 'O que faz INNER JOIN?', back: 'Retorna apenas linhas com correspondência.', tags: ['sql'] },
        { deck_id: 'd1', front: '', back: 'sem frente' },
      ],
      mind_maps: [{ title: 'Mapa', subject_id: 's1', data: { nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [{ id: 'e', source: 'a', target: 'zz' }] } }],
      study_sessions: [{ subject_id: 's1', status: 'completed', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', pauses: [{ started_at: '2026-01-01T10:10:00Z', ended_at: '2026-01-01T10:20:00Z' }] }],
    }
    const plan = planImport(pkg)
    expect(plan.counts).toMatchObject({ subjects: 1, topics: 2, flashcard_decks: 1, flashcards: 1, mind_maps: 1, study_sessions: 1, study_session_pauses: 1 })
    expect(plan.warnings.length).toBeGreaterThan(0)

    const backend = fresh()
    await runImport(backend, plan)
    const [subject] = (await backend.list('subjects')).rows
    expect(subject.id).not.toBe('s1')
    expect(subject.color).toBe('#2A78D6')
    const topics = (await backend.list('topics')).rows
    const parent = topics.find((t) => t.name === 'Joins')!
    const child = topics.find((t) => t.name === 'INNER JOIN')!
    expect(child.parent_id).toBe(parent.id)
    expect(parent.subject_id).toBe(subject.id)
    const [card] = (await backend.list('flashcards')).rows
    expect(card.topic_id).toBe(child.id)
    const [map] = (await backend.list('mind_maps')).rows
    expect(map.data.edges).toHaveLength(0) // aresta para nó inexistente descartada
    const [session] = await backend.listSessions({ filters: [eq('subject_id', subject.id)] })
    expect(session.pauses).toHaveLength(1)
  })

  it('importar duas vezes cria cópias independentes (nunca sobrescreve)', async () => {
    const backend = fresh()
    const pkg = { subjects: [{ id: 'x', name: 'Python' }] }
    await runImport(backend, planImport(pkg))
    await runImport(backend, planImport(pkg))
    expect((await backend.list('subjects')).rows).toHaveLength(2)
  })

  it('rejeita arquivos que não são objeto e ignora sessões inválidas', () => {
    expect(() => planImport([1, 2])).toThrow()
    const plan = planImport({
      study_sessions: [
        { status: 'active', started_at: '2026-01-01T10:00:00Z' },
        { status: 'completed', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-03T10:00:00Z' },
        { status: 'completed', started_at: '2999-01-01T10:00:00Z', ended_at: '2999-01-01T11:00:00Z' },
      ],
    })
    expect(plan.counts.study_sessions).toBe(0)
  })
})

describe('conteudo/pacote-estudos.json', () => {
  const file = JSON.parse(readFileSync(join(process.cwd(), 'conteudo', 'pacote-estudos.json'), 'utf8'))

  it('é válido e importa tudo sem descartar nada', async () => {
    const plan = planImport(file)
    expect(plan.warnings).toEqual([])
    expect(plan.counts.subjects).toBe(5)
    expect(plan.counts.flashcards).toBeGreaterThanOrEqual(300)
    expect(plan.counts.mind_maps).toBe(5)
    const backend = fresh()
    await runImport(backend, plan)
    const names = (await backend.list('subjects')).rows.map((s) => s.name).sort()
    expect(names).toEqual(['Inglês', 'Power BI', 'Python', 'SEVEN', 'SQL'])
  })

  it('SEVEN: 400 h, 2 h por dia, 200 dias seguidos até 21/10/2026', async () => {
    const backend = fresh()
    await runImport(backend, planImport(file))
    const seven = (await backend.list('subjects', { filters: [eq('name', 'SEVEN')] })).rows[0]
    const sessions = await backend.listSessions({ filters: [eq('subject_id', seven.id)] })
    const tz = 'America/Sao_Paulo'
    const b = breakdown(sessions, tz, { from: '2000-01-01', to: '2100-01-01' })
    expect(b.total).toBe(400 * 3600)
    expect([...b.byDay.values()].every((s) => s === 2 * 3600)).toBe(true)
    expect(b.byDay.size).toBe(200)
    expect(streak(b.byDay, '2026-10-21')).toBe(200)
    expect([...b.byDay.keys()].sort()[0]).toBe('2026-04-05')
  })
})
