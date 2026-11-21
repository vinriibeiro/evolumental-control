// Regras da trilha de Ciência de Dados: estado de cada tópico, próximo passo e correção dos diagnósticos.
// Funções puras — o que é exibido vem sempre dos registros (tópicos, avaliações), nunca de tempo estudado.
import type { DiagnosticQuestion, TrackDef, TrailTopicDef } from '@/content/dsTypes'
import type { AssessmentAnswer, AssessmentTopicResult, Topic } from '@/types/db'

export type TopicState =
  /** Concluído por mim, depois do exercício prático. */
  | 'done'
  /** Conhecimento demonstrado num diagnóstico (acertou tudo, com pelo menos 2 questões). */
  | 'demonstrated'
  /** Eu disse que já conheço; ainda não foi avaliado. */
  | 'self'
  | 'in_progress'
  /** Pré-requisitos atendidos: pode começar. */
  | 'available'
  /** Falta algum pré-requisito. */
  | 'locked'

export const TOPIC_STATE_LABELS: Record<TopicState, string> = {
  done: 'Concluído',
  demonstrated: 'Demonstrado em avaliação',
  self: 'Autodeclarado',
  in_progress: 'Em andamento',
  available: 'Disponível',
  locked: 'Aguardando pré-requisito',
}

type TopicRow = Pick<Topic, 'trail_key' | 'status' | 'knowledge'>

/** Tópicos que contam como base para os seguintes: concluídos, demonstrados ou autodeclarados. */
export function satisfiedKeys(rows: TopicRow[]): Set<string> {
  return new Set(rows.filter((r) => r.trail_key && (r.status === 'completed' || r.knowledge)).map((r) => r.trail_key!))
}

export function topicState(def: TrailTopicDef, row: TopicRow | undefined, satisfied: Set<string>): TopicState {
  if (row?.status === 'completed') return 'done'
  if (row?.knowledge === 'demonstrated') return 'demonstrated'
  if (row?.knowledge === 'self') return 'self'
  if (row?.status === 'in_progress' || row?.status === 'reviewing') return 'in_progress'
  return def.prerequisites.every((k) => satisfied.has(k)) ? 'available' : 'locked'
}

/** Próximo tópico a estudar no pilar: o primeiro em andamento ou disponível, na ordem da trilha. */
export function nextTopic(track: TrackDef, rowByKey: Map<string, TopicRow>, satisfied: Set<string>): TrailTopicDef | null {
  const states = track.topics.map((t) => ({ t, s: topicState(t, rowByKey.get(t.key), satisfied) }))
  return (states.find((x) => x.s === 'in_progress') ?? states.find((x) => x.s === 'available') ?? states.find((x) => x.s === 'locked'))?.t ?? null
}

export interface TrackProgress {
  total: number
  done: number
  /** Demonstrados ou autodeclarados (não contam como concluídos). */
  known: number
  inProgress: number
}

export function trackProgress(track: TrackDef, rowByKey: Map<string, TopicRow>, satisfied: Set<string>): TrackProgress {
  const out: TrackProgress = { total: track.topics.length, done: 0, known: 0, inProgress: 0 }
  for (const t of track.topics) {
    const s = topicState(t, rowByKey.get(t.key), satisfied)
    if (s === 'done') out.done++
    else if (s === 'demonstrated' || s === 'self') out.known++
    else if (s === 'in_progress') out.inProgress++
  }
  return out
}

// ---------------------------------------------------------------------
// Diagnóstico de conhecimento
// ---------------------------------------------------------------------
export interface SkillResult {
  skill: string
  asked: number
  correct: number
}

export interface DiagnosticScore {
  answers: AssessmentAnswer[]
  topics: AssessmentTopicResult[]
  skills: SkillResult[]
  total: number
  correct: number
  /** Ponto de partida sugerido (chave do tópico) ou null se tudo o que foi avaliado ficou demonstrado e não há mais tópicos. */
  start_key: string | null
}

/**
 * Corrige um diagnóstico. `chosen` traz a alternativa escolhida por questão (null = "não sei");
 * questões ausentes não foram respondidas e não entram na conta.
 *
 * Um tópico só é "demonstrado" com pelo menos 2 questões e nenhuma errada — um acerto isolado é "parcial",
 * e a porcentagem geral nunca é usada sozinha para afirmar domínio.
 */
export function scoreDiagnostic(track: TrackDef, questions: DiagnosticQuestion[], chosen: Record<string, number | null>): DiagnosticScore {
  const answered = questions.filter((q) => q.id in chosen)
  const answers: AssessmentAnswer[] = answered.map((q) => ({ question_id: q.id, topic_key: q.topicKey, level: q.level, chosen: chosen[q.id], correct: chosen[q.id] === q.answer }))
  const byTopic = new Map<string, { asked: number; correct: number }>()
  const bySkill = new Map<string, { asked: number; correct: number }>()
  answered.forEach((q, i) => {
    for (const [map, key] of [
      [byTopic, q.topicKey],
      [bySkill, q.skill],
    ] as const) {
      const cur = map.get(key) ?? { asked: 0, correct: 0 }
      cur.asked++
      if (answers[i].correct) cur.correct++
      map.set(key, cur)
    }
  })
  const order = new Map(track.topics.map((t, i) => [t.key, i]))
  const topics: AssessmentTopicResult[] = [...byTopic]
    .map(([topic_key, r]) => ({ topic_key, asked: r.asked, correct: r.correct, outcome: r.correct < r.asked ? ('gap' as const) : r.asked >= 2 ? ('demonstrated' as const) : ('partial' as const) }))
    .sort((a, b) => (order.get(a.topic_key) ?? 999) - (order.get(b.topic_key) ?? 999))
  const outcome = new Map(topics.map((t) => [t.topic_key, t.outcome]))
  // Ponto de partida: a primeira lacuna (ou acerto isolado) na ordem da trilha; sem lacunas, o primeiro tópico
  // ainda não avaliado depois do último demonstrado.
  const firstGap = track.topics.find((t) => outcome.get(t.key) === 'gap' || outcome.get(t.key) === 'partial')
  let start: TrailTopicDef | undefined = firstGap
  if (!start && topics.length) {
    const lastShown = Math.max(...track.topics.map((t, i) => (outcome.get(t.key) === 'demonstrated' ? i : -1)))
    start = track.topics.slice(lastShown + 1).find((t) => !outcome.has(t.key))
  }
  return {
    answers,
    topics,
    skills: [...bySkill].map(([skill, r]) => ({ skill, ...r })),
    total: answers.length,
    correct: answers.filter((a) => a.correct).length,
    start_key: start?.key ?? null,
  }
}
