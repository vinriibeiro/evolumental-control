import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'

let n = 0

describe('zerar todos os dados (modo local)', () => {
  it('apaga progresso, agenda e metas, e mantém matérias, tópicos, vídeos, flashcards, mapas e questões', async () => {
    const backend = new LocalBackend(`reset-${++n}`)
    const [subject] = await backend.insert('subjects', [{ name: 'Téo 1' }])
    const [topic] = await backend.insert('topics', [{ subject_id: subject.id, name: 'Ep 01', status: 'completed', mastery: 3 }])
    await backend.insert('study_materials', [{ subject_id: subject.id, topic_id: topic.id, title: 'Aula', url: 'https://youtu.be/dQw4w9WgXcQ' }])
    const [deck] = await backend.insert('flashcard_decks', [{ name: 'Baralho', subject_id: subject.id }])
    await backend.insert('flashcards', [{ deck_id: deck.id, front: 'a', back: 'b' }])
    await backend.insert('question_records', [{ subject_id: subject.id, topic_id: topic.id, total: 10, correct: 7, source: 'Banco de questões' }])
    await backend.insert('study_goals', [{ title: 'Meta', metric: 'hours', period: 'week', target_value: 10 } as never])

    await backend.resetAllData()

    const count = async (table: Parameters<typeof backend.list>[0]) => (await backend.list(table)).rows.length
    expect(await count('subjects')).toBe(1)
    expect(await count('topics')).toBe(1)
    expect(await count('study_materials')).toBe(1)
    expect(await count('flashcard_decks')).toBe(1)
    expect(await count('flashcards')).toBe(1)
    expect(await count('question_records')).toBe(1)
    expect(await count('study_goals')).toBe(0)
    const [after] = (await backend.list('topics', { filters: [eq('id', topic.id)] })).rows
    expect(after).toMatchObject({ status: 'not_started', mastery: 0, completed_at: null })
  })
})
