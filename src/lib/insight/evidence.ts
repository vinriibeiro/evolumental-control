// Monta as evidências de domínio a partir das linhas que o app já guarda e
// agrega na árvore (tópico pai e matéria) respeitando os pesos. Puro.
import type { SessionWithPauses } from '@/lib/data/types'
import { netSeconds } from '@/lib/timer/engine'
import { zonedDayStart, type DayKey } from '@/lib/time'
import type { Flashcard, QuestionError, QuestionRecord, Review, Subject, Topic } from '@/types/db'
import { aggregateMastery, computeMastery, emptyEvidence, levelOf, type MasteryLevel, type MasteryResult, type TopicEvidence } from './mastery'

export type CardRow = Pick<Flashcard, 'topic_id' | 'subject_id' | 'repetitions' | 'interval_days' | 'lapses' | 'last_reviewed_at' | 'status'>

export interface InsightInput {
  subjects: Subject[]
  topics: Topic[]
  /** Sessões (só as concluídas contam). */
  sessions: SessionWithPauses[]
  questions: QuestionRecord[]
  /** Erros classificados (caderno) dos registros acima. */
  errors?: QuestionError[]
  reviews: Review[]
  cards: CardRow[]
  /** Respostas do EvoQuest já associadas a tópicos do Control. */
  game?: Map<string, { total: number; correct: number; lastAt: number | null }>
  today: DayKey
  tz: string
}

export interface NodeMastery {
  value: number
  level: MasteryLevel
  /** Fração do peso (dos filhos) com alguma evidência; 1 para folhas com dados. */
  coverage: number
  lastContactAt: number | null
  /** Resultado do próprio tópico (evidências ligadas diretamente a ele). */
  own: MasteryResult | null
}

export interface MasteryIndex {
  byTopic: Map<string, NodeMastery>
  bySubject: Map<string, NodeMastery>
  /** Evidências cruas por tópico (usadas pela recomendação). */
  evidence: Map<string, TopicEvidence>
}

const noon = (day: DayKey, tz: string) => zonedDayStart(day, tz) + 12 * 3_600_000
const later = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b))

/** Evidência por chave: id do tópico ou `subject:<id>` (registros sem tópico). */
export function collectEvidence(input: InsightInput): Map<string, TopicEvidence> {
  const ev = new Map<string, TopicEvidence>()
  const topicById = new Map(input.topics.map((t) => [t.id, t]))
  const keyFor = (subjectId: string | null, topicId: string | null) => (topicId && topicById.has(topicId) ? topicId : subjectId ? `subject:${subjectId}` : null)
  const get = (k: string) => {
    let e = ev.get(k)
    if (!e) {
      e = emptyEvidence()
      const t = topicById.get(k)
      if (t) {
        e.selfRating = t.mastery
        e.estimatedMinutes = t.estimated_minutes
      }
      ev.set(k, e)
    }
    return e
  }
  for (const t of input.topics) if (t.mastery > 0) get(t.id)

  for (const s of input.sessions) {
    if (s.status !== 'completed') continue
    const k = keyFor(s.subject_id, s.topic_id)
    if (!k) continue
    const e = get(k)
    e.studySeconds += netSeconds(s, s.pauses)
    e.sessions += 1
    e.lastStudyAt = later(e.lastStudyAt, Date.parse(s.ended_at ?? s.started_at))
  }
  for (const q of input.questions) {
    const k = keyFor(q.subject_id, q.topic_id)
    if (!k || q.total <= 0) continue
    get(k).questions.push({ at: noon(q.date, input.tz), total: q.total, correct: q.correct })
  }
  const recordById = new Map(input.questions.map((q) => [q.id, q]))
  for (const e of input.errors ?? []) {
    if (e.resolved) continue
    const q = recordById.get(e.record_id)
    const k = q ? keyFor(q.subject_id, q.topic_id) : null
    if (k) get(k).openErrors += e.count
  }
  for (const r of input.reviews) {
    const k = keyFor(r.subject_id, r.topic_id)
    if (!k) continue
    if (r.status === 'done') {
      const e = get(k)
      e.reviewsDone += 1
      e.lastReviewAt = later(e.lastReviewAt, r.done_at ? Date.parse(r.done_at) : null)
    } else if ((r.status === 'planned' || r.status === 'postponed') && r.scheduled_for < input.today) get(k).reviewsOverdue += 1
  }
  for (const c of input.cards) {
    if (c.status === 'suspended') continue
    const k = keyFor(c.subject_id, c.topic_id)
    if (!k) continue
    get(k).cards.push({ repetitions: c.repetitions, intervalDays: c.interval_days, lapses: c.lapses, lastReviewedAt: c.last_reviewed_at ? Date.parse(c.last_reviewed_at) : null })
  }
  for (const [topicId, g] of input.game ?? []) {
    if (!topicById.has(topicId) || g.total <= 0) continue
    const e = get(topicId)
    e.game = { total: e.game.total + g.total, correct: e.game.correct + g.correct, lastAt: later(e.game.lastAt, g.lastAt) }
  }
  return ev
}

const fromResult = (r: MasteryResult | null): NodeMastery =>
  r && r.level !== 'none'
    ? { value: r.value, level: r.level, coverage: 1, lastContactAt: r.lastContactAt, own: r }
    : { value: 0, level: 'none', coverage: 0, lastContactAt: r?.lastContactAt ?? null, own: r }

/**
 * Domínio de todos os tópicos e matérias. Folha = evidência própria. Tópico
 * pai e pasta = média ponderada dos filhos (+ a evidência própria, se houver,
 * com peso 1). Matéria = tópicos raiz + registros sem tópico.
 */
export function masteryIndex(input: InsightInput, now: number): MasteryIndex {
  const evidence = collectEvidence(input)
  const own = new Map<string, MasteryResult>()
  for (const [k, e] of evidence) own.set(k, computeMastery(e, now))

  const children = new Map<string | null, Topic[]>()
  const subjectRoots = new Map<string, Topic[]>()
  const ids = new Set(input.topics.map((t) => t.id))
  for (const t of input.topics) {
    if (t.parent_id && ids.has(t.parent_id)) children.set(t.parent_id, [...(children.get(t.parent_id) ?? []), t])
    else subjectRoots.set(t.subject_id, [...(subjectRoots.get(t.subject_id) ?? []), t])
  }

  const byTopic = new Map<string, NodeMastery>()
  const visit = (t: Topic, guard: Set<string>): NodeMastery => {
    const hit = byTopic.get(t.id)
    if (hit) return hit
    if (guard.has(t.id)) return fromResult(null)
    guard.add(t.id)
    const kids = children.get(t.id) ?? []
    const mine = own.get(t.id) ?? null
    let node: NodeMastery
    if (!kids.length) node = fromResult(t.kind === 'folder' ? null : mine)
    else {
      const items = kids.map((k) => {
        const m = visit(k, guard)
        return { value: m.value, weight: Number(k.weight) || 1, hasData: m.level !== 'none', lastContactAt: m.lastContactAt }
      })
      if (mine && mine.level !== 'none') items.push({ value: mine.value, weight: 1, hasData: true, lastContactAt: mine.lastContactAt })
      const agg = aggregateMastery(items)
      node = { ...agg, own: mine }
    }
    byTopic.set(t.id, node)
    return node
  }
  for (const t of input.topics) visit(t, new Set())

  const bySubject = new Map<string, NodeMastery>()
  for (const s of input.subjects) {
    const roots = subjectRoots.get(s.id) ?? []
    const items = roots.map((t) => {
      const m = byTopic.get(t.id)!
      return { value: m.value, weight: Number(t.weight) || 1, hasData: m.level !== 'none', lastContactAt: m.lastContactAt }
    })
    const loose = own.get(`subject:${s.id}`)
    if (loose && loose.level !== 'none') items.push({ value: loose.value, weight: 1, hasData: true, lastContactAt: loose.lastContactAt })
    const agg = aggregateMastery(items)
    bySubject.set(s.id, { ...agg, level: items.some((i) => i.hasData) ? levelOf(agg.value) : 'none', own: loose ?? null })
  }
  return { byTopic, bySubject, evidence }
}
