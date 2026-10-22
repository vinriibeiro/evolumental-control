// Regras de pontuação do EvoQuest — FONTE ÚNICA no cliente.
// A mesma fórmula está em supabase/migrations/*_evoquest.sql (game_xp_for);
// supabase/tests/evoquest.test.ts verifica que as duas dão o mesmo resultado.
// O servidor recalcula tudo: o cliente só usa isto para o modo local e para
// mostrar uma prévia.

export const RULES = {
  /** XP base por dificuldade (1..5): 12, 16, 20, 24, 28. */
  baseXp: (difficulty: number) => 8 + 4 * difficulty,
  /** Resposta parcial (multietapas/laboratório) com score ≥ 0,5 vale metade do proporcional. */
  partialMinScore: 0.5,
  partialFactor: 0.5,
  /** Repetir um desafio já acertado há menos de N horas não rende XP (anti-farm). */
  repeatWindowHours: 20,
  /** Acertar de novo depois da janela (revisão) rende metade. */
  reviewFactor: 0.5,
  hintFactor: 0.75,
  /** Nova tentativa do mesmo desafio na mesma partida. */
  retryFactor: 0.5,
  /** Combo: +10% a cada 3 acertos seguidos, até +50%. */
  comboEvery: 3,
  comboStep: 0.1,
  comboMax: 0.5,
  /** Respostas abaixo deste tempo (s) não rendem recompensas (anti-spam). */
  minSeconds: 1,
}

export interface XpInput {
  difficulty: number
  correct: boolean
  score: number
  usedHint: boolean
  attempt: number
  seconds: number
  /** Acertos anteriores deste desafio (fora desta resposta). */
  priorCorrect: number
  /** Horas desde o último acerto deste desafio (null se nunca). */
  hoursSinceLastCorrect: number | null
  /** Combo antes desta resposta. */
  comboBefore: number
}

export interface XpOutcome {
  xp: number
  coins: number
  combo: number
  novelty: number
}

/** Erro não zera o combo: só o reduz pela metade (sem punição dura). */
export const nextCombo = (before: number, correct: boolean) => (correct ? before + 1 : Math.floor(before / 2))

export const comboMultiplier = (combo: number) => 1 + Math.min(RULES.comboMax, RULES.comboStep * Math.floor(combo / RULES.comboEvery))

export function novelty(priorCorrect: number, hoursSinceLastCorrect: number | null): number {
  if (priorCorrect === 0 || hoursSinceLastCorrect == null) return 1
  if (hoursSinceLastCorrect < RULES.repeatWindowHours) return 0
  return RULES.reviewFactor
}

export function computeXp(i: XpInput): XpOutcome {
  const combo = nextCombo(i.comboBefore, i.correct)
  const quality = i.correct ? 1 : i.score >= RULES.partialMinScore ? i.score * RULES.partialFactor : 0
  const nov = novelty(i.priorCorrect, i.hoursSinceLastCorrect)
  if (i.seconds < RULES.minSeconds || quality === 0 || nov === 0) return { xp: 0, coins: 0, combo, novelty: nov }
  const hint = i.usedHint ? RULES.hintFactor : 1
  const retry = i.attempt > 1 ? RULES.retryFactor : 1
  // toFixed evita que erros de ponto flutuante (ex.: 4.4999…) mudem o arredondamento
  // em relação ao NUMERIC exato do PostgreSQL.
  const xp = Math.round(Number((RULES.baseXp(i.difficulty) * quality * nov * hint * retry * comboMultiplier(combo)).toFixed(6)))
  const coins = i.correct ? (nov === 1 && i.attempt === 1 ? 2 : 1) : 0
  return { xp, coins, combo, novelty: nov }
}

/** XP necessário para passar do nível L para L+1. */
export const xpToNext = (level: number) => 100 + 50 * (level - 1)

/** XP acumulado para ATINGIR o nível L. */
export const xpForLevel = (level: number) => 100 * (level - 1) + 25 * (level - 1) * (level - 2)

export function levelFromXp(xp: number): { level: number; into: number; need: number; progress: number } {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const into = xp - xpForLevel(level)
  const need = xpToNext(level)
  return { level, into, need, progress: into / need }
}

export const LEVEL_TITLES: Array<[number, string]> = [
  [1, 'Iniciante'],
  [5, 'Aprendiz'],
  [10, 'Explorador'],
  [15, 'Estrategista'],
  [20, 'Especialista'],
  [30, 'Mestre'],
  [40, 'Lenda'],
]

export const levelTitle = (level: number) => [...LEVEL_TITLES].reverse().find(([l]) => level >= l)![1]
