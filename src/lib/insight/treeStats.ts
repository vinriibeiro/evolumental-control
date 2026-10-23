// Totais por nó da árvore (tópico com subtópicos; matéria com tudo, inclusive
// registros sem tópico), a partir das evidências já coletadas. Puro.
import type { Topic } from '@/types/db'
import type { TopicEvidence } from './mastery'

export interface NodeStats {
  seconds: number
  questions: number
  correct: number
}

const zero = (): NodeStats => ({ seconds: 0, questions: 0, correct: 0 })

function own(e: TopicEvidence | undefined): NodeStats {
  if (!e) return zero()
  return {
    seconds: e.studySeconds,
    questions: e.questions.reduce((a, q) => a + q.total, 0),
    correct: e.questions.reduce((a, q) => a + Math.min(q.correct, q.total), 0),
  }
}

const add = (a: NodeStats, b: NodeStats): NodeStats => ({ seconds: a.seconds + b.seconds, questions: a.questions + b.questions, correct: a.correct + b.correct })

export function treeStats(topics: Topic[], evidence: Map<string, TopicEvidence>): { byTopic: Map<string, NodeStats>; bySubject: Map<string, NodeStats> } {
  const ids = new Set(topics.map((t) => t.id))
  const children = new Map<string, Topic[]>()
  for (const t of topics) if (t.parent_id && ids.has(t.parent_id)) children.set(t.parent_id, [...(children.get(t.parent_id) ?? []), t])
  const byTopic = new Map<string, NodeStats>()
  const visit = (t: Topic, guard: Set<string>): NodeStats => {
    const hit = byTopic.get(t.id)
    if (hit) return hit
    if (guard.has(t.id)) return zero()
    guard.add(t.id)
    const total = (children.get(t.id) ?? []).reduce((acc, c) => add(acc, visit(c, guard)), own(evidence.get(t.id)))
    byTopic.set(t.id, total)
    return total
  }
  const bySubject = new Map<string, NodeStats>()
  for (const t of topics) {
    const s = visit(t, new Set())
    if (!t.parent_id || !ids.has(t.parent_id)) bySubject.set(t.subject_id, add(bySubject.get(t.subject_id) ?? zero(), s))
  }
  for (const [k, e] of evidence) {
    if (!k.startsWith('subject:')) continue
    const id = k.slice('subject:'.length)
    bySubject.set(id, add(bySubject.get(id) ?? zero(), own(e)))
  }
  return { byTopic, bySubject }
}

export const accuracy = (s: NodeStats | undefined) => (s && s.questions ? s.correct / s.questions : null)
