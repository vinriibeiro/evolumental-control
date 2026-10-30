// Prática diária de inglês sobre as tabelas existentes (sem migração): a matéria
// "Inglês" e um tópico por habilidade; cada prática é uma sessão manual.
import type { Subject, Topic } from '@/types/db'
import { eq, gte, type DataBackend, type SessionWithPauses } from '@/lib/data/types'
import {
  ENGLISH_SKILLS,
  ENGLISH_SKILL_ACTIVITY,
  ENGLISH_SKILL_LABELS,
  ENGLISH_SUBJECT_NAME,
  practicesFromSessions,
  type EnglishPractice,
  type EnglishSkill,
} from '@/lib/english'
import { addManualSession } from './sessions'

export interface EnglishSetup {
  subject: Subject
  topics: Record<EnglishSkill, Topic>
}

async function findSubject(backend: DataBackend): Promise<Subject | null> {
  const { rows } = await backend.list('subjects', { filters: [eq('name', ENGLISH_SUBJECT_NAME)], order: [{ column: 'created_at' }], limit: 1 })
  return rows[0] ?? null
}

function skillOf(topic: Pick<Topic, 'name' | 'parent_id'>): EnglishSkill | null {
  if (topic.parent_id) return null
  const name = topic.name.trim().toLocaleLowerCase('pt-BR')
  return ENGLISH_SKILLS.find((s) => ENGLISH_SKILL_LABELS[s].toLocaleLowerCase('pt-BR') === name) ?? null
}

function topicsBySkill(topics: Topic[]): Partial<Record<EnglishSkill, Topic>> {
  const out: Partial<Record<EnglishSkill, Topic>> = {}
  for (const t of topics) {
    const s = skillOf(t)
    if (s && !out[s]) out[s] = t
  }
  return out
}

async function createSetup(backend: DataBackend): Promise<EnglishSetup> {
  const subject =
    (await findSubject(backend)) ??
    (await backend.insert('subjects', [{ name: ENGLISH_SUBJECT_NAME, description: 'Prática diária, sem material.' }]))[0]
  const { rows } = await backend.list('topics', { filters: [eq('subject_id', subject.id)] })
  const found = topicsBySkill(rows)
  const missing = ENGLISH_SKILLS.filter((s) => !found[s])
  if (missing.length) {
    const created = await backend.insert(
      'topics',
      missing.map((s) => ({ subject_id: subject.id, name: ENGLISH_SKILL_LABELS[s], sort_order: ENGLISH_SKILLS.indexOf(s) })),
    )
    Object.assign(found, topicsBySkill(created))
  }
  return { subject, topics: found as Record<EnglishSkill, Topic> }
}

// Chamadas simultâneas (cliques repetidos) compartilham a mesma criação.
const pending = new WeakMap<DataBackend, Promise<EnglishSetup>>()

/** Garante a matéria "Inglês" e os tópicos das habilidades, criando-os uma única vez. */
export function ensureEnglishSetup(backend: DataBackend): Promise<EnglishSetup> {
  const running = pending.get(backend)
  if (running) return running
  const p = createSetup(backend).finally(() => pending.delete(backend))
  pending.set(backend, p)
  return p
}

export interface PracticeInput {
  skill: EnglishSkill
  minutes: number
  /** Fim da prática (ms); por padrão, agora. */
  ended_at?: number
  notes?: string | null
}

/** Registra uma prática rápida como sessão manual (bloqueia sobreposição). */
export async function recordPractice(backend: DataBackend, input: PracticeInput, id: string = crypto.randomUUID()) {
  const setup = await ensureEnglishSetup(backend)
  const end = input.ended_at ?? Date.now()
  return addManualSession(
    backend,
    {
      subject_id: setup.subject.id,
      topic_id: setup.topics[input.skill].id,
      activity_type: ENGLISH_SKILL_ACTIVITY[input.skill],
      started_at: end - input.minutes * 60000,
      duration_minutes: input.minutes,
      notes: input.notes ?? null,
    },
    id,
  )
}

/** Práticas registradas na matéria de inglês (sem criar nada se ela ainda não existe). */
export async function loadPractices(backend: DataBackend, sinceMs?: number): Promise<EnglishPractice[]> {
  const subject = await findSubject(backend)
  if (!subject) return []
  const { rows: topics } = await backend.list('topics', { filters: [eq('subject_id', subject.id)] })
  const skills = new Map<string, EnglishSkill>()
  for (const t of topics) {
    const s = skillOf(t)
    if (s) skills.set(t.id, s)
  }
  const filters = [eq('subject_id', subject.id), eq('status', 'completed'), ...(sinceMs != null ? [gte('started_at', new Date(sinceMs).toISOString())] : [])]
  const sessions: SessionWithPauses[] = []
  const page = 1000
  for (let offset = 0; ; offset += page) {
    const rows = await backend.listSessions({ filters, order: [{ column: 'started_at' }], limit: page, offset })
    sessions.push(...rows)
    if (rows.length < page) break
  }
  return practicesFromSessions(sessions, skills)
}
