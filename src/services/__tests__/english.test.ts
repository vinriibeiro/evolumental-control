import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { ENGLISH_SKILLS, ENGLISH_SKILL_LABELS, ENGLISH_SUBJECT_NAME, minutesOnDay, streak, totalsBySkill } from '@/lib/english'
import { ensureEnglishSetup, loadPractices, recordPractice } from '@/services/english'

let backend: LocalBackend
let dbn = 0
const T0 = Date.parse('2026-10-20T15:00:00Z')
const SP = 'America/Sao_Paulo'

beforeEach(() => {
  backend = new LocalBackend(`english-${++dbn}`)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})
afterEach(() => vi.useRealTimers())

describe('matéria e tópicos de inglês', () => {
  it('são criados uma vez só, mesmo com chamadas repetidas e simultâneas', async () => {
    const [a, b] = await Promise.all([ensureEnglishSetup(backend), ensureEnglishSetup(backend)])
    const c = await ensureEnglishSetup(backend)
    expect(a.subject.id).toBe(b.subject.id)
    expect(c.subject.id).toBe(a.subject.id)
    const { rows: subjects } = await backend.list('subjects', { filters: [eq('name', ENGLISH_SUBJECT_NAME)] })
    expect(subjects).toHaveLength(1)
    const { rows: topics } = await backend.list('topics', { filters: [eq('subject_id', a.subject.id)] })
    expect(topics.map((t) => t.name).sort()).toEqual(ENGLISH_SKILLS.map((s) => ENGLISH_SKILL_LABELS[s]).sort())
    for (const s of ENGLISH_SKILLS) expect(c.topics[s].id).toBe(a.topics[s].id)
  })

  it('reaproveita a matéria existente e cria só os tópicos que faltam', async () => {
    const [subject] = await backend.insert('subjects', [{ name: ENGLISH_SUBJECT_NAME }])
    const [falar] = await backend.insert('topics', [{ subject_id: subject.id, name: 'Falar' }])
    const setup = await ensureEnglishSetup(backend)
    expect(setup.subject.id).toBe(subject.id)
    expect(setup.topics.speaking.id).toBe(falar.id)
    const { rows } = await backend.list('topics', { filters: [eq('subject_id', subject.id)] })
    expect(rows).toHaveLength(ENGLISH_SKILLS.length)
    expect((await backend.list('subjects')).rows).toHaveLength(1)
  })
})

describe('registrar prática', () => {
  it('cria sessão manual ligada à matéria e ao tópico da habilidade', async () => {
    const s = await recordPractice(backend, { skill: 'vocabulary', minutes: 15 })
    const setup = await ensureEnglishSetup(backend)
    expect(s.mode).toBe('manual')
    expect(s.status).toBe('completed')
    expect(s.subject_id).toBe(setup.subject.id)
    expect(s.topic_id).toBe(setup.topics.vocabulary.id)
    expect(new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()).toBe(15 * 60000)
    expect(new Date(s.ended_at!).getTime()).toBe(T0)
  })

  it('bloqueia sobreposição com outra sessão', async () => {
    await recordPractice(backend, { skill: 'listening', minutes: 20 })
    await expect(recordPractice(backend, { skill: 'speaking', minutes: 10, ended_at: T0 - 5 * 60000 })).rejects.toThrow(/intervalo/)
    const { rows } = await backend.list('study_sessions')
    expect(rows).toHaveLength(1)
  })

  it('as práticas carregadas alimentam minutos do dia, sequência e totais', async () => {
    expect(await loadPractices(backend)).toEqual([])
    await recordPractice(backend, { skill: 'listening', minutes: 20, ended_at: T0 - 86400000 })
    await recordPractice(backend, { skill: 'speaking', minutes: 10, ended_at: T0 - 3600000 })
    await recordPractice(backend, { skill: 'listening', minutes: 5 })
    const list = await loadPractices(backend)
    expect(minutesOnDay(list, '2026-10-20', SP)).toBe(15)
    expect(streak(list, '2026-10-20', SP)).toBe(2)
    expect(totalsBySkill(list)).toMatchObject({ listening: 25 * 60, speaking: 10 * 60 })
  })
})
