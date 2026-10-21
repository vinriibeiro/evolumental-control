import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { netSeconds } from '@/lib/timer/engine'
import {
  addManualSession,
  confirmSession,
  discardSession,
  finishSession,
  getLiveSession,
  nextPhase,
  pauseSession,
  resumeSession,
  startSession,
  type ConfirmParams,
} from '@/services/sessions'
import { reviewCard } from '@/services/flashcards'

let backend: LocalBackend
let dbn = 0
const T0 = Date.parse('2026-10-20T10:00:00Z')

const confirmDefaults: ConfirmParams = {
  subject_id: null,
  topic_id: null,
  activity_type: 'theory',
  notes: null,
  adjustment_seconds: 0,
  scheduleReviews: [],
  completeReviewIds: [],
  cycleDecision: 'resume',
  timezone: 'America/Sao_Paulo',
}

beforeEach(() => {
  backend = new LocalBackend(`test-${++dbn}`)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})
afterEach(() => vi.useRealTimers())

const at = (min: number) => vi.setSystemTime(T0 + min * 60000)

describe('sessões de estudo', () => {
  it('iniciar → pausar → continuar → finalizar salva o tempo líquido correto', async () => {
    await startSession(backend, { subject_id: null, topic_id: null, activity_type: 'theory', mode: 'stopwatch' })
    at(10)
    await pauseSession(backend, (await getLiveSession(backend))!)
    at(25)
    await resumeSession(backend, (await getLiveSession(backend))!)
    at(40)
    await finishSession(backend, (await getLiveSession(backend))!)
    const pending = (await getLiveSession(backend))!
    expect(pending.status).toBe('pending_review')
    const res = await confirmSession(backend, pending, confirmDefaults)
    expect(res.saved).toBe(true)
    expect(res.netSeconds).toBe(25 * 60) // 40 min − 15 min pausados
    const [saved] = await backend.listSessions({ filters: [eq('id', pending.id)] })
    expect(saved.status).toBe('completed')
    expect(netSeconds(saved, saved.pauses)).toBe(25 * 60)
    expect(await getLiveSession(backend)).toBeNull()
  })

  it('cliques repetidos não duplicam a sessão nem a pausa', async () => {
    const id = crypto.randomUUID()
    const p = { subject_id: null, topic_id: null, activity_type: 'theory' as const, mode: 'stopwatch' as const }
    const [a, b] = await Promise.all([startSession(backend, p, id), startSession(backend, p, id)])
    expect(a.id).toBe(b.id)
    await expect(startSession(backend, p)).rejects.toThrow(/em andamento/)
    const live = (await getLiveSession(backend))!
    await Promise.allSettled([pauseSession(backend, live), pauseSession(backend, live)])
    const { rows } = await backend.list('study_session_pauses', { filters: [eq('session_id', live.id)] })
    expect(rows).toHaveLength(1)
    const { rows: sessions } = await backend.list('study_sessions')
    expect(sessions).toHaveLength(1)
  })

  it('confirmar duas vezes salva apenas uma vez', async () => {
    await startSession(backend, { subject_id: null, topic_id: null, activity_type: 'theory', mode: 'stopwatch' })
    at(30)
    await finishSession(backend, (await getLiveSession(backend))!)
    const pending = (await getLiveSession(backend))!
    const [r1, r2] = await Promise.all([confirmSession(backend, pending, confirmDefaults), confirmSession(backend, pending, confirmDefaults)])
    expect([r1.saved, r2.saved].filter(Boolean)).toHaveLength(1)
  })

  it('sessão cancelada não é contabilizada', async () => {
    await startSession(backend, { subject_id: null, topic_id: null, activity_type: 'theory', mode: 'stopwatch' })
    at(30)
    await discardSession(backend, (await getLiveSession(backend))!)
    const { rows } = await backend.list('study_sessions', { filters: [eq('status', 'completed')] })
    expect(rows).toHaveLength(0)
  })

  it('pomodoro: fim do foco inicia pausa programada que não conta como estudo', async () => {
    await startSession(backend, {
      subject_id: null,
      topic_id: null,
      activity_type: 'theory',
      mode: 'pomodoro',
      pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, rounds: 4 },
    })
    at(25)
    await nextPhase(backend, (await getLiveSession(backend))!)
    at(30)
    await nextPhase(backend, (await getLiveSession(backend))!)
    at(40)
    const live = (await getLiveSession(backend))!
    expect(live.timer_state?.phaseIndex).toBe(2)
    expect(netSeconds(live, live.pauses)).toBe(35 * 60)
  })

  it('confirmar avança o ciclo e marca o tópico como em andamento', async () => {
    const [subject] = await backend.insert('subjects', [{ name: 'Português' }])
    const [topic] = await backend.insert('topics', [{ subject_id: subject.id, name: 'Crase' }])
    const [cycle] = await backend.insert('study_cycles', [{ name: 'Ciclo', status: 'active' }])
    const [i1, i2] = await backend.insert('study_cycle_items', [
      { cycle_id: cycle.id, subject_id: subject.id, duration_minutes: 30, sort_order: 0 },
      { cycle_id: cycle.id, subject_id: subject.id, duration_minutes: 30, sort_order: 1 },
    ])
    await startSession(backend, { subject_id: subject.id, topic_id: topic.id, activity_type: 'theory', mode: 'stopwatch', cycle_id: cycle.id, cycle_item_id: i1.id })
    at(31)
    await finishSession(backend, (await getLiveSession(backend))!)
    const r = await confirmSession(backend, (await getLiveSession(backend))!, { ...confirmDefaults, subject_id: subject.id, topic_id: topic.id, scheduleReviews: [1, 7] })
    expect(r.cycleAdvanced).toBe(true)
    const c = await backend.get('study_cycles', cycle.id)
    expect(c?.current_index).toBe(1)
    expect((await backend.get('topics', topic.id))?.status).toBe('in_progress')
    const { rows: reviews } = await backend.list('reviews', { filters: [eq('topic_id', topic.id)] })
    expect(reviews.map((x) => x.scheduled_for).sort()).toEqual(['2026-10-21', '2026-10-27'])
    expect(i2.sort_order).toBe(1)
  })

  it('lançamento manual bloqueia sobreposição (evita duplicidade)', async () => {
    await addManualSession(backend, { subject_id: null, topic_id: null, activity_type: 'reading', started_at: T0 - 3 * 3600000, duration_minutes: 60, notes: null })
    await expect(
      addManualSession(backend, { subject_id: null, topic_id: null, activity_type: 'reading', started_at: T0 - 2.5 * 3600000, duration_minutes: 60, notes: null }),
    ).rejects.toThrow(/intervalo/)
  })
})

describe('isolamento e cascata no modo local', () => {
  it('excluir matéria remove tópicos e mantém sessões sem vínculo', async () => {
    const [subject] = await backend.insert('subjects', [{ name: 'Informática' }])
    await backend.insert('topics', [{ subject_id: subject.id, name: 'Redes' }])
    const s = await addManualSession(backend, { subject_id: subject.id, topic_id: null, activity_type: 'theory', started_at: T0 - 7200000, duration_minutes: 30, notes: null })
    await backend.remove('subjects', [eq('id', subject.id)])
    expect((await backend.list('topics')).rows).toHaveLength(0)
    expect((await backend.get('study_sessions', s.id))?.subject_id).toBeNull()
  })
})

describe('flashcards', () => {
  it('revisão é persistida e o cartão reagendado (idempotente)', async () => {
    const [deck] = await backend.insert('flashcard_decks', [{ name: 'Constitucional' }])
    const [card] = await backend.insert('flashcards', [{ deck_id: deck.id, front: 'Art. 5º', back: 'Direitos e garantias', due_at: new Date(T0).toISOString() }])
    const reviewId = crypto.randomUUID()
    const first = await reviewCard(backend, card, 3, undefined, reviewId)
    const again = await reviewCard(backend, card, 3, undefined, reviewId)
    expect(first).toBe(true)
    expect(again).toBe(false)
    const updated = await backend.get('flashcards', card.id)
    expect(updated?.repetitions).toBe(1)
    expect(updated?.interval_days).toBe(1)
    expect(updated?.status).toBe('review')
    const { rows } = await backend.list('flashcard_reviews')
    expect(rows).toHaveLength(1)
    expect(rows[0].rating).toBe(3)
  })
})
