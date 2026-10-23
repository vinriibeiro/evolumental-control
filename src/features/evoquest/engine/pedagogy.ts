// Modelo pedagógico do mundo, independente de disciplina. Uma missão de
// aprendizagem passa por estágios (guiado → independente → transferência →
// chefe); cada atividade tem uma escada de pistas e, ao ser resolvida, vira
// EVIDÊNCIA de domínio — separada de XP, moedas e progresso narrativo.
// Adaptadores por disciplina (terminal SQL hoje; Python, inglês… depois)
// só precisam informar estágio, nível de ajuda e tentativas.

export type Stage = 'guided' | 'independent' | 'transfer' | 'boss'

export const STAGE_LABELS: Record<Stage, string> = {
  guided: 'Prática guiada',
  independent: 'Prática independente',
  transfer: 'Transferência',
  boss: 'Desafio integrado',
}

/** Lição curta de um conceito: o mínimo para alguém que nunca viu aprender. */
export interface LessonDef {
  id: string
  /** Disciplina do EvoQuest (ex.: "sql"). */
  subject: string
  /** Tópico do EvoQuest (ex.: "groupby"): liga a evidência aos tópicos do Control. */
  concept: string
  /** Nome do conceito para o jogador (ex.: "GROUP BY"). */
  conceptName: string
  title: string
  learningObjective: string
  prerequisites: string[]
  whyItMatters: string
  /** No máximo 3 frases curtas. */
  explanation: string[]
  /**
   * Exemplo resolvido que o jogador executa de verdade: SQL sobre um banco
   * (`dataset` em content/datasets) ou Python (`lang: 'python'`, saída impressa).
   */
  workedExample?: { caption: string; code: string; dataset?: string; lang?: 'sql' | 'python' }
  commonMistakes: string[]
}

/**
 * Escada de pistas: 1) lembra o conceito, 2) aponta a parte do problema,
 * 3) mostra parte da solução; depois disso, a explicação completa.
 * Cada degrau só abre depois de uma nova tentativa (não dá para pular direto
 * para a resposta).
 */
export const HINT_STEPS = 3
export const FULL_EXPLANATION = HINT_STEPS + 1

/** Nível de ajuda usado: 0 = sozinho; 1–3 = pistas; 4 = explicação completa. */
export type HelpLevel = 0 | 1 | 2 | 3 | 4

export interface LadderState {
  level: HelpLevel
  /** Tentativas desde que o último degrau foi aberto. */
  triesSinceReveal: number
  attempts: number
}

export const startLadder = (): LadderState => ({ level: 0, triesSinceReveal: 0, attempts: 0 })

export function recordAttempt(s: LadderState): LadderState {
  return { ...s, attempts: s.attempts + 1, triesSinceReveal: s.triesSinceReveal + 1 }
}

/** Pode abrir o próximo degrau? Exige ao menos uma tentativa depois do anterior. */
export function canReveal(s: LadderState, hasLadder = true): boolean {
  if (s.level >= FULL_EXPLANATION) return false
  if (!hasLadder && s.level < FULL_EXPLANATION) return s.triesSinceReveal > 0 && s.attempts >= 2
  return s.triesSinceReveal > 0
}

export function reveal(s: LadderState, hasLadder = true): LadderState {
  if (!canReveal(s, hasLadder)) return s
  const level = (hasLadder ? s.level + 1 : FULL_EXPLANATION) as HelpLevel
  return { ...s, level, triesSinceReveal: 0 }
}

/**
 * Peso de cada estágio como evidência (em "questões equivalentes") e quanto
 * do acerto conta conforme a ajuda usada. Resolver depois de ver a explicação
 * completa não conta acerto: registra só que houve contato e dificuldade.
 */
export const STAGE_WEIGHT: Record<Stage, number> = { guided: 1, independent: 2, transfer: 3, boss: 4 }
export const HELP_CREDIT: Record<HelpLevel, number> = { 0: 1, 1: 0.8, 2: 0.6, 3: 0.3, 4: 0 }

export function evidenceCredit(stage: Stage, help: HelpLevel, solved: boolean): { weight: number; correct: number } {
  const weight = STAGE_WEIGHT[stage]
  return { weight, correct: solved ? weight * HELP_CREDIT[help] : 0 }
}

export interface ActivityResult {
  activity: string
  title: string
  stage: Stage
  concept: string
  help: HelpLevel
  attempts: number
  solved: boolean
}

export interface Debrief {
  learned: string[]
  /** Atividades resolvidas sem ajuda (ou só com o 1º degrau). */
  applied: string[]
  /** Onde houve dificuldade (2+ pistas, explicação ou muitas tentativas). */
  struggled: Array<{ title: string; why: string }>
  /** Conceitos que merecem revisão. */
  review: string[]
}

export function debrief(results: ActivityResult[], conceptName: (c: string) => string): Debrief {
  const learned = [...new Set(results.map((r) => conceptName(r.concept)))]
  const applied = results.filter((r) => r.solved && r.help <= 1).map((r) => r.title)
  const struggled = results
    .filter((r) => !r.solved || r.help >= 2 || r.attempts >= 4)
    .map((r) => ({
      title: r.title,
      why: !r.solved ? 'não concluída' : r.help >= FULL_EXPLANATION ? 'precisou da explicação completa' : r.help >= 2 ? `${r.help} pistas` : `${r.attempts} tentativas`,
    }))
  const review = [...new Set(results.filter((r) => !r.solved || r.help >= 2).map((r) => conceptName(r.concept)))]
  return { learned, applied, struggled, review }
}
