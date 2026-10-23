// Estágios pedagógicos dos desafios clássicos (usados pelas cidades geradas
// e pelo domínio do Control). O estágio sai do TIPO do desafio, não de um
// rótulo manual: reconhecer (escolher, associar, ordenar) é prática guiada;
// produzir a resposta (escrever, calcular, completar código) é prática
// independente; o chefe/multietapas é o desafio integrado. A pista e a nova
// tentativa reduzem o crédito, como na escada de pistas do mundo.
import type { HelpLevel, Stage } from '@/features/evoquest/engine/pedagogy'
import type { Challenge, ChallengeType, Unit } from '../types'

export const GUIDED_TYPES: ChallengeType[] = ['mcq', 'tf', 'match', 'order', 'categorize', 'listen']
export const INDEPENDENT_TYPES: ChallengeType[] = ['fill', 'numeric', 'short', 'find_error', 'dictation', 'code_complete', 'code_output', 'sql', 'python']

export function stageOf(c: Pick<Challenge, 'type' | 'boss'>): Stage {
  if (c.boss || c.type === 'multistep') return 'boss'
  return GUIDED_TYPES.includes(c.type) ? 'guided' : 'independent'
}

/** Ajuda usada numa resposta clássica: nova tentativa pesa mais que a dica. */
export function helpOf(a: { used_hint: boolean; attempt: number }): HelpLevel {
  return a.attempt > 1 ? 2 : a.used_hint ? 1 : 0
}

export interface AnswerRow {
  challenge_id: string
  topic: string
  correct: boolean
  used_hint: boolean
  attempt: number
  answered_at: string
}

export interface StageStats {
  answered: number
  correct: number
  /** Acertos sem dica e na primeira tentativa. */
  clean: number
  /** Desafios diferentes acertados. */
  distinct: number
  available: number
}

export interface UnitReport {
  stages: Record<Stage, StageStats>
  /** Tópicos da unidade com acerto < 60% (com pelo menos 2 respostas). */
  weak: Array<{ id: string; name: string; accuracy: number; answered: number }>
  bossWon: boolean
}

export function unitReport(unit: Unit, answers: AnswerRow[]): UnitReport {
  const byId = new Map(unit.challenges.map((c) => [c.id, c]))
  const empty = (): StageStats => ({ answered: 0, correct: 0, clean: 0, distinct: 0, available: 0 })
  const stages: Record<Stage, StageStats> = { guided: empty(), independent: empty(), transfer: empty(), boss: empty() }
  for (const c of unit.challenges) stages[stageOf(c)].available++
  const solved = new Map<Stage, Set<string>>()
  const topics = new Map<string, { answered: number; correct: number }>()
  let bossWon = false
  for (const a of answers) {
    const c = byId.get(a.challenge_id)
    if (!c) continue
    const st = stages[stageOf(c)]
    st.answered++
    if (a.correct) {
      st.correct++
      if (helpOf(a) === 0) st.clean++
      solved.set(stageOf(c), (solved.get(stageOf(c)) ?? new Set()).add(c.id))
      if (c.boss) bossWon = true
    }
    const t = topics.get(c.topic) ?? { answered: 0, correct: 0 }
    topics.set(c.topic, { answered: t.answered + 1, correct: t.correct + (a.correct ? 1 : 0) })
  }
  for (const [s, ids] of solved) stages[s].distinct = ids.size
  const weak = unit.topics
    .map((t) => ({ ...t, ...(topics.get(t.id) ?? { answered: 0, correct: 0 }) }))
    .filter((t) => t.answered >= 2 && t.correct / t.answered < 0.6)
    .map((t) => ({ id: t.id, name: t.name, answered: t.answered, accuracy: Math.round((100 * t.correct) / t.answered) }))
    .sort((a, b) => a.accuracy - b.accuracy)
  return { stages, weak, bossWon }
}

export type UnitStep = 'lesson' | 'guided' | 'independent' | 'boss' | 'review'

/**
 * Próximo passo da unidade, com o motivo (regras fixas): sem respostas →
 * lição; guiada fraca → guiada; produção pouco praticada ou fraca →
 * independente; chefe ainda não vencido → chefe; depois, revisão do tópico
 * mais fraco (ou manutenção).
 */
export function nextUnitStep(r: UnitReport): { step: UnitStep; reason: string } {
  const g = r.stages.guided
  const i = r.stages.independent
  const acc = (s: StageStats) => (s.answered ? s.correct / s.answered : 0)
  const total = g.answered + i.answered + r.stages.boss.answered
  if (total === 0) return { step: 'lesson', reason: 'Você ainda não praticou esta unidade: comece pela lição (5 min) e depois pela prática guiada.' }
  if (g.available > 0 && (g.answered < 4 || acc(g) < 0.7)) return { step: 'guided', reason: g.answered < 4 ? `Só ${g.answered} resposta(s) na prática guiada: firme o reconhecimento antes de produzir sozinho.` : `Acerto de ${Math.round(100 * acc(g))}% na prática guiada (meta 70%).` }
  if (i.available > 0 && (i.answered < 4 || acc(i) < 0.7))
    return { step: 'independent', reason: i.answered < 4 ? `Reconhecer você já reconhece; agora produza a resposta sozinho (${i.answered} de 4 respostas).` : `Acerto de ${Math.round(100 * acc(i))}% produzindo sozinho (meta 70%).` }
  if (!r.bossWon) return { step: 'boss', reason: 'Guiada e independente acima de 70%: você está pronto(a) para o desafio integrado.' }
  if (r.weak.length) return { step: 'review', reason: `${r.weak[0].name} está com ${r.weak[0].accuracy}% de acerto: revise com a prática independente.` }
  return { step: 'review', reason: 'Unidade vencida. Uma revisão curta de vez em quando mantém o domínio.' }
}
