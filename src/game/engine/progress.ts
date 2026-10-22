// Progresso, revisão espaçada e montagem adaptativa de partidas.
// Tudo é derivado do histórico de respostas — nada aqui é gravado.
import type { GameAnswer, GameMode } from '@/types/db'
import type { Challenge, SubjectContent, Unit } from '../types'
import { estimatedSeconds, LAB_TYPES } from './grade'

export type AnswerLike = Pick<GameAnswer, 'challenge_id' | 'correct' | 'answered_at' | 'topic' | 'score'>

// ── Revisão espaçada por desafio (caixas de Leitner) ───────────────────────
/** Intervalo (dias) por caixa: 1 → 1 dia, 2 → 3, 3 → 7, 4 → 16, 5 → 35. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35]
/** Depois de um erro, o desafio volta em 10 minutos (fora da mesma sequência). */
export const RELEARN_MS = 10 * 60_000
const DAY = 86_400_000

export interface ChallengeState {
  box: number
  attempts: number
  correct: number
  lastAt: number
  lastCorrect: boolean
  dueAt: number
}

export function challengeStates(answers: AnswerLike[]): Map<string, ChallengeState> {
  const sorted = [...answers].sort((a, b) => a.answered_at.localeCompare(b.answered_at))
  const map = new Map<string, ChallengeState>()
  for (const a of sorted) {
    const t = new Date(a.answered_at).getTime()
    const s = map.get(a.challenge_id) ?? { box: 0, attempts: 0, correct: 0, lastAt: 0, lastCorrect: false, dueAt: 0 }
    s.attempts++
    if (a.correct) {
      // Só sobe de caixa quando a revisão respeitou o intervalo (evita "decorar" na mesma hora).
      if (s.box === 0 || t >= s.dueAt - DAY / 2) s.box = Math.min(5, s.box + 1)
      s.correct++
      s.dueAt = t + BOX_DAYS[s.box] * DAY
    } else {
      s.box = Math.min(s.box, 1) || 1
      s.dueAt = t + RELEARN_MS
    }
    s.lastAt = t
    s.lastCorrect = a.correct
    map.set(a.challenge_id, s)
  }
  return map
}

export const isDue = (s: ChallengeState | undefined, now: number) => Boolean(s && s.dueAt <= now)

// ── Domínio (conservador: cobertura × (acerto recente + retenção)) ─────────
export interface Mastery {
  value: number // 0..100
  label: string
  coverage: number
  accuracy: number
  answered: number
}

export const MASTERY_LEVELS: Array<[number, string]> = [
  [0, 'Novo'],
  [1, 'Iniciante'],
  [30, 'Aprendiz'],
  [55, 'Praticante'],
  [75, 'Proficiente'],
  [90, 'Mestre'],
]
export const masteryLabel = (v: number) => [...MASTERY_LEVELS].reverse().find(([min]) => v >= min)![1]

export function masteryOf(challenges: Challenge[], answers: AnswerLike[], states: Map<string, ChallengeState>): Mastery {
  const ids = new Set(challenges.map((c) => c.id))
  const mine = answers.filter((a) => ids.has(a.challenge_id)).sort((a, b) => b.answered_at.localeCompare(a.answered_at))
  if (challenges.length === 0 || mine.length === 0) return { value: 0, label: 'Novo', coverage: 0, accuracy: 0, answered: 0 }
  const covered = challenges.filter((c) => (states.get(c.id)?.correct ?? 0) > 0)
  const coverage = covered.length / challenges.length
  const recent = mine.slice(0, 10)
  // Suavização bayesiana: 1 acerto e 1 erro "imaginários" evitam 100% com 1 resposta.
  const accuracy = (recent.filter((a) => a.correct).length + 1) / (recent.length + 2)
  // Retenção: só chega a 1 quando os acertos sobreviveram a revisões espaçadas (caixa ≥ 3).
  const retention = covered.length ? covered.reduce((s, c) => s + Math.min(1, states.get(c.id)!.box / 3), 0) / covered.length : 0
  const value = Math.round(100 * coverage * (0.5 * accuracy + 0.5 * retention))
  const v = Math.max(value, 1)
  return { value: v, label: masteryLabel(v), coverage, accuracy, answered: mine.length }
}

export function topicMastery(unit: Unit, answers: AnswerLike[], states: Map<string, ChallengeState>) {
  return unit.topics.map((t) => ({ ...t, mastery: masteryOf(unit.challenges.filter((c) => c.topic === t.id && !c.boss), answers, states) }))
}

export const unitMastery = (unit: Unit, answers: AnswerLike[], states: Map<string, ChallengeState>) => masteryOf(unit.challenges, answers, states)

export const subjectMastery = (content: SubjectContent, answers: AnswerLike[], states: Map<string, ChallengeState>) =>
  masteryOf(content.units.flatMap((u) => u.challenges), answers, states)

/** Unidade liberada: a primeira sempre; as demais quando a anterior tem domínio ≥ 40 ou o chefe foi vencido. */
export function unlockedUnits(content: SubjectContent, answers: AnswerLike[], states: Map<string, ChallengeState>): Set<string> {
  const out = new Set<string>()
  content.units.forEach((u, i) => {
    if (i === 0) return out.add(u.id)
    const prev = content.units[i - 1]
    const bossWon = prev.challenges.some((c) => c.boss && (states.get(c.id)?.correct ?? 0) > 0)
    if (out.has(prev.id) && (bossWon || unitMastery(prev, answers, states).value >= 40)) out.add(u.id)
  })
  return out
}

// ── Montagem adaptativa ────────────────────────────────────────────────────
export interface BuildInput {
  content: SubjectContent
  answers: AnswerLike[]
  mode: Exclude<GameMode, 'cards'>
  minutes: number
  unitId?: string | null
  now: number
  seed?: number
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

/** Nível de habilidade estimado (1..5): dificuldade em que a pessoa acerta ~70%. */
export function skillLevel(challenges: Challenge[], answers: AnswerLike[]): number {
  const byId = new Map(challenges.map((c) => [c.id, c]))
  const recent = [...answers].sort((a, b) => b.answered_at.localeCompare(a.answered_at)).slice(0, 30)
  if (recent.length < 5) return 1.5
  let weighted = 0
  let total = 0
  for (const a of recent) {
    const d = byId.get(a.challenge_id)?.difficulty ?? 2
    weighted += a.correct ? d + 0.5 : d - 1
    total++
  }
  return Math.min(5, Math.max(1, weighted / total))
}

const FAST_TYPES = new Set(['mcq', 'tf', 'fill', 'listen', 'find_error', 'numeric'])

export function buildQueue(i: BuildInput): Challenge[] {
  const random = rng(i.seed ?? i.now)
  const states = challengeStates(i.answers)
  const unlocked = unlockedUnits(i.content, i.answers, states)
  const units = i.content.units.filter((u) => (i.unitId ? u.id === i.unitId : unlocked.has(u.id)))
  const all = units.flatMap((u) => u.challenges).filter((c) => !LAB_TYPES.includes(c.type))
  const skill = skillLevel(all, i.answers)
  const budget = i.minutes * 60

  if (i.mode === 'boss') {
    const unit = units[0]
    if (!unit) return []
    const boss = unit.challenges.filter((c) => c.boss)
    const hard = unit.challenges.filter((c) => !c.boss && !LAB_TYPES.includes(c.type)).sort((a, b) => b.difficulty - a.difficulty || (random() < 0.5 ? -1 : 1)).slice(0, 4)
    return [...hard, ...boss]
  }

  if (i.mode === 'lab') {
    // Casos práticos validados (DAX/M e afins): desafios com tabela ou código.
    const cases = all.filter((c) => (c.table || c.code) && !c.boss)
    return spreadTypes(fillBudget(cases.sort(() => random() - 0.5), budget, 20))
  }

  if (i.mode === 'review') {
    // Para revisar, considera todas as unidades já tocadas.
    const pool = i.content.units.flatMap((u) => u.challenges).filter((c) => !LAB_TYPES.includes(c.type))
    const due = pool.filter((c) => isDue(states.get(c.id), i.now)).sort((a, b) => states.get(a.id)!.dueAt - states.get(b.id)!.dueAt)
    return fillBudget(due, budget, 40)
  }

  const recentIds = new Set(i.answers.filter((a) => i.now - new Date(a.answered_at).getTime() < RELEARN_MS).map((a) => a.challenge_id))
  const topicAcc = new Map<string, number>()
  for (const u of units) for (const t of topicMastery(u, i.answers, states)) topicAcc.set(t.id, t.mastery.value)

  const scored = all
    .filter((c) => !c.boss && !recentIds.has(c.id))
    .filter((c) => i.mode !== 'time_attack' || FAST_TYPES.has(c.type))
    .map((c) => {
      const s = states.get(c.id)
      let score = random() * 0.8
      if (!s) score += i.mode === 'trail' ? 3 : 2
      else if (isDue(s, i.now)) score += s.lastCorrect ? 2.5 : 3
      else if (s.box >= 4) score -= 3
      else score -= 1
      score += (100 - (topicAcc.get(c.topic) ?? 0)) / 100 // tópicos fracos primeiro
      score -= Math.abs(c.difficulty - skill) * 0.6
      return { c, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)

  if (i.mode === 'time_attack') return scored.slice(0, 40)
  const queue = fillBudget(scored, budget, 30)
  // Na trilha, segue a ordem da lição (do mais fácil ao mais difícil).
  if (i.mode === 'trail') queue.sort((a, b) => a.difficulty - b.difficulty)
  return spreadTypes(queue)
}

function fillBudget(list: Challenge[], budget: number, max: number): Challenge[] {
  const out: Challenge[] = []
  let used = 0
  for (const c of list) {
    if (out.length >= max) break
    if (used >= budget && out.length >= 3) break
    out.push(c)
    used += estimatedSeconds(c)
  }
  return out
}

/** Evita três desafios do mesmo tipo em sequência. */
export function spreadTypes(q: Challenge[]): Challenge[] {
  const out = [...q]
  for (let i = 2; i < out.length; i++) {
    if (out[i].type === out[i - 1].type && out[i].type === out[i - 2].type) {
      const j = out.findIndex((c, k) => k > i && c.type !== out[i].type)
      if (j > 0) [out[i], out[j]] = [out[j], out[i]]
    }
  }
  return out
}

/**
 * Adaptação durante a partida: depois de dois erros seguidos traz um desafio
 * mais fácil do mesmo tópico; depois de quatro acertos, um mais difícil.
 */
export function adaptNext(remaining: Challenge[], pool: Challenge[], recent: Array<{ challenge: Challenge; correct: boolean }>): Challenge[] {
  if (recent.length < 2 || remaining.length === 0) return remaining
  const last = recent.slice(-4)
  const used = new Set([...remaining.map((c) => c.id), ...recent.map((r) => r.challenge.id)])
  const twoWrong = last.length >= 2 && !last[last.length - 1].correct && !last[last.length - 2].correct
  const fourRight = last.length === 4 && last.every((r) => r.correct)
  const ref = recent[recent.length - 1].challenge
  let pick: Challenge | undefined
  if (twoWrong) pick = pool.find((c) => !used.has(c.id) && c.topic === ref.topic && c.difficulty < ref.difficulty && !c.boss)
  else if (fourRight) pick = pool.find((c) => !used.has(c.id) && c.difficulty > ref.difficulty && !c.boss)
  if (!pick) return remaining
  return [pick, ...remaining.slice(0, -1)]
}
