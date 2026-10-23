// Fábricas de linhas para os testes dos indicadores (sem backend).
import type { SessionWithPauses } from '@/lib/data/types'
import type { QuestionRecord, Review, StudyPlanItem, Subject, Topic } from '@/types/db'
import type { CardRow } from '../evidence'

export const TZ = 'America/Sao_Paulo'
/** 22/10/2026 12:00 em São Paulo. */
export const NOW = Date.parse('2026-10-22T15:00:00Z')
export const TODAY = '2026-10-22'
export const DAY = 86_400_000

const base = { user_id: 'u', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }

export function subject(id: string, over: Partial<Subject> = {}): Subject {
  return {
    ...base,
    id,
    folder_id: null,
    favorite: false,
    name: `Matéria ${id}`,
    description: null,
    color: '#2A78D6',
    icon: null,
    priority: 3,
    difficulty: 3,
    weekly_goal_hours: null,
    start_date: null,
    target_date: null,
    notes: null,
    status: 'active',
    exam: null,
    sort_order: 0,
    archived_at: null,
    ...over,
  }
}

export function topic(id: string, subjectId: string, over: Partial<Topic> = {}): Topic {
  return {
    ...base,
    id,
    subject_id: subjectId,
    parent_id: null,
    kind: 'topic',
    favorite: false,
    name: `Tópico ${id}`,
    description: null,
    sort_order: 0,
    status: 'not_started',
    mastery: 0,
    priority: 3,
    weight: 1,
    estimated_minutes: null,
    notes: null,
    completed_at: null,
    ...over,
  }
}

/** Sessão concluída de `minutes` minutos que começa em `start` (ISO). */
export function session(start: string, minutes: number, over: Partial<SessionWithPauses> = {}): SessionWithPauses {
  return {
    ...base,
    id: `s-${start}-${Math.random()}`,
    subject_id: null,
    topic_id: null,
    activity_type: 'theory',
    mode: 'stopwatch',
    status: 'completed',
    started_at: start,
    ended_at: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    planned_seconds: null,
    adjustment_seconds: 0,
    timer_config: null,
    timer_state: null,
    notes: null,
    plan_item_id: null,
    cycle_id: null,
    cycle_item_id: null,
    pauses: [],
    ...over,
  }
}

export function questions(date: string, total: number, correct: number, over: Partial<QuestionRecord> = {}): QuestionRecord {
  return { ...base, id: `q-${date}-${Math.random()}`, subject_id: null, topic_id: null, date, total, correct, wrong: total - correct, board: null, exam: null, source: null, notes: null, ...over }
}

export function review(scheduled: string, status: Review['status'], over: Partial<Review> = {}): Review {
  return { ...base, id: `r-${Math.random()}`, subject_id: null, topic_id: null, title: 'Revisão', scheduled_for: scheduled, status, done_at: status === 'done' ? `${scheduled}T15:00:00Z` : null, session_id: null, notes: null, origin: 'manual', ...over }
}

export function card(over: Partial<CardRow> = {}): CardRow {
  return { topic_id: null, subject_id: null, repetitions: 0, interval_days: 0, lapses: 0, last_reviewed_at: null, status: 'new', ...over }
}

export function planItem(date: string, start: string, minutes: number, over: Partial<StudyPlanItem> = {}): StudyPlanItem {
  return { ...base, id: `p-${date}-${start}-${Math.random()}`, plan_id: 'plan', date, start_time: start, duration_minutes: minutes, subject_id: null, topic_id: null, activity_type: 'theory', status: 'pending', notes: null, ...over }
}

export const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10)
