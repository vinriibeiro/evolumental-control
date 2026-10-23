// Domínio por tópico (0–100). Puro e determinístico: combina as evidências que
// o app já registra — prática (questões e EvoQuest), retenção (flashcards e
// revisões), exposição (tempo líquido) e autoavaliação — de forma
// conservadora. "Concluído" não é "dominado": sem prática verificada, o
// domínio tem teto; com poucos dados, a confiança é baixa e isso é dito.
//
// Fórmula (documentada no README):
//   prática   A = (Σ w·acertos + 2) / (Σ w·total + 4), w = 0,5^(idade/45 dias)
//               (EvoQuest conta como meia questão; suavização puxa para 50%)
//   retenção  R = média de: flashcards min(1, intervalo/21 d)·0,85^lapsos e
//               revisões feitas/(feitas + atrasadas)
//   exposição X = 1 − e^(−minutos/estimado), estimado padrão 90 min
//   autoaval. S = nota/5
//   bruto = média ponderada das presentes (A 0,5 · R 0,2 · X 0,2 · S 0,1)
//   tetos: sem prática verificada ≤ 55; menos de 10 questões ≤ 79
//   esquecimento: após 14 dias sem contato, −1% a cada 2,4 dias (mín. ×0,7)
//   reincidência: ≥ 3 erros nos últimos 14 dias com acerto < 60% → −10;
//                 erros em ≥ 2 dias diferentes nos últimos 30 com acerto < 70% → −5

export const DAY_MS = 86_400_000

export interface QuestionEvidence {
  /** Instante (ms) do registro. */
  at: number
  total: number
  correct: number
}

export interface CardEvidence {
  repetitions: number
  intervalDays: number
  lapses: number
  lastReviewedAt: number | null
}

export interface TopicEvidence {
  studySeconds: number
  sessions: number
  lastStudyAt: number | null
  questions: QuestionEvidence[]
  reviewsDone: number
  reviewsOverdue: number
  lastReviewAt: number | null
  cards: CardEvidence[]
  game: { total: number; correct: number; lastAt: number | null }
  /** Autoavaliação 0–5 do tópico. */
  selfRating: number
  /** Erros classificados no caderno e ainda não resolvidos. */
  openErrors: number
  estimatedMinutes: number | null
}

export const emptyEvidence = (): TopicEvidence => ({
  studySeconds: 0,
  sessions: 0,
  lastStudyAt: null,
  questions: [],
  reviewsDone: 0,
  reviewsOverdue: 0,
  lastReviewAt: null,
  cards: [],
  game: { total: 0, correct: 0, lastAt: null },
  selfRating: 0,
  openErrors: 0,
  estimatedMinutes: null,
})

export type MasteryLevel = 'none' | 'unconsolidated' | 'fragile' | 'developing' | 'consolidating' | 'mastered'
export type Confidence = 'none' | 'low' | 'medium' | 'high'

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  none: 'Sem dados',
  unconsolidated: 'Ainda não consolidado',
  fragile: 'Frágil',
  developing: 'Em desenvolvimento',
  consolidating: 'Em consolidação',
  mastered: 'Dominado',
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = { none: 'sem dados', low: 'baixa', medium: 'média', high: 'alta' }

export function levelOf(value: number, hasData = true): MasteryLevel {
  if (!hasData) return 'none'
  if (value >= 80) return 'mastered'
  if (value >= 60) return 'consolidating'
  if (value >= 40) return 'developing'
  if (value >= 20) return 'fragile'
  return 'unconsolidated'
}

export interface MasteryResult {
  value: number
  level: MasteryLevel
  confidence: Confidence
  /** Quantidade de evidências (questões, sessões, cartões, revisões…). */
  evidence: number
  lastContactAt: number | null
  /** Componentes 0–1 usados (para explicar o número). */
  parts: { practice: number | null; retention: number | null; exposure: number | null; self: number | null }
  /** Observações em linguagem simples (tetos, esquecimento, reincidência). */
  notes: string[]
  /** Erros nos últimos 14 dias (usado pela recomendação). */
  recentWrong: number
  /** Acerto recente (últimos 30 dias), se houver questões. */
  recentAccuracy: number | null
  /** Dias diferentes com erro nos últimos 30 dias (reincidência). */
  errorDays: number
  openErrors: number
}

const HALF_LIFE_DAYS = 45
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function computeMastery(ev: TopicEvidence, now: number): MasteryResult {
  const notes: string[] = []
  const age = (at: number) => Math.max(0, (now - at) / DAY_MS)

  // Prática: questões (e EvoQuest pela metade), mais recentes pesam mais.
  let wTotal = 0
  let wCorrect = 0
  let practiceCount = 0
  let recentWrong = 0
  let recentTotal = 0
  let recentCorrect = 0
  let r14Total = 0
  let r14Correct = 0
  let lastQuestionAt: number | null = null
  const errorDaySet = new Set<number>()
  for (const q of ev.questions) {
    if (q.total <= 0) continue
    const w = 0.5 ** (age(q.at) / HALF_LIFE_DAYS)
    wTotal += w * q.total
    wCorrect += w * Math.min(q.correct, q.total)
    practiceCount += q.total
    lastQuestionAt = Math.max(lastQuestionAt ?? 0, q.at)
    if (age(q.at) <= 30) {
      recentTotal += q.total
      recentCorrect += Math.min(q.correct, q.total)
      if (q.total > q.correct) errorDaySet.add(Math.floor(q.at / DAY_MS))
    }
    if (age(q.at) <= 14) {
      r14Total += q.total
      r14Correct += Math.min(q.correct, q.total)
      recentWrong += q.total - Math.min(q.correct, q.total)
    }
  }
  if (ev.game.total > 0) {
    const w = 0.5 * 0.5 ** (age(ev.game.lastAt ?? now) / HALF_LIFE_DAYS)
    wTotal += w * ev.game.total
    wCorrect += w * ev.game.correct
  }
  const practice = wTotal > 0 ? (wCorrect + 2) / (wTotal + 4) : null

  // Retenção: flashcards já revisados e revisões feitas × atrasadas.
  const reviewed = ev.cards.filter((c) => c.repetitions > 0 || c.lapses > 0)
  const cardRet = reviewed.length ? reviewed.reduce((a, c) => a + clamp01(c.intervalDays / 21) * 0.85 ** c.lapses, 0) / reviewed.length : null
  const revTotal = ev.reviewsDone + ev.reviewsOverdue
  const revRet = revTotal ? ev.reviewsDone / revTotal : null
  const retParts = [cardRet, revRet].filter((v): v is number => v != null)
  const retention = retParts.length ? retParts.reduce((a, b) => a + b, 0) / retParts.length : null
  if (ev.reviewsOverdue > 0) notes.push(`${ev.reviewsOverdue} revisão(ões) atrasada(s)`)

  const minutes = ev.studySeconds / 60
  const exposure = minutes > 0 ? 1 - Math.exp(-minutes / Math.max(15, ev.estimatedMinutes ?? 90)) : null
  const self = ev.selfRating > 0 ? clamp01(ev.selfRating / 5) : null

  const parts = { practice, retention, exposure, self }
  const weights: Array<[number | null, number]> = [
    [practice, 0.5],
    [retention, 0.2],
    [exposure, 0.2],
    [self, 0.1],
  ]
  const present = weights.filter(([v]) => v != null) as Array<[number, number]>
  const lastCardAt = reviewed.reduce<number | null>((m, c) => (c.lastReviewedAt != null && (m == null || c.lastReviewedAt > m) ? c.lastReviewedAt : m), null)
  const lastContactAt = [ev.lastStudyAt, lastQuestionAt, ev.lastReviewAt, lastCardAt, ev.game.lastAt].reduce<number | null>((m, v) => (v != null && (m == null || v > m) ? v : m), null)
  const evidence = practiceCount + ev.game.total + 3 * ev.sessions + reviewed.length + 2 * ev.reviewsDone + (self != null ? 1 : 0)

  if (!present.length)
    return { value: 0, level: 'none', confidence: 'none', evidence: 0, lastContactAt, parts, notes: ['Sem estudo, questões ou revisões registradas'], recentWrong: 0, recentAccuracy: null, errorDays: 0, openErrors: ev.openErrors }

  let raw = present.reduce((a, [v, w]) => a + v * w, 0) / present.reduce((a, [, w]) => a + w, 0)
  const verified = practice != null || cardRet != null
  if (!verified && raw > 0.55) {
    raw = 0.55
    notes.push('Sem prática verificada (questões ou flashcards): domínio limitado a 55%')
  } else if (practiceCount < 10 && raw > 0.79) {
    raw = 0.79
    notes.push('Menos de 10 questões: domínio limitado a 79%')
  }

  let factor = 1
  if (lastContactAt != null) {
    const d = age(lastContactAt)
    if (d > 14) {
      factor = Math.max(0.7, 1 - (d - 14) / 240)
      notes.push(`${Math.floor(d)} dias sem contato: estimativa reduzida pelo esquecimento`)
    }
  }
  let value = Math.round(100 * raw * factor)
  if (recentWrong >= 3 && r14Total > 0 && r14Correct / r14Total < 0.6) {
    value -= 10
    notes.push(`${recentWrong} erros nos últimos 14 dias`)
  }
  const recentAccuracy = recentTotal ? recentCorrect / recentTotal : null
  if (errorDaySet.size >= 2 && recentAccuracy != null && recentAccuracy < 0.7) {
    value -= 5
    notes.push(`Erros em ${errorDaySet.size} dias diferentes (últimos 30 dias)`)
  }
  if (ev.openErrors > 0) notes.push(`${ev.openErrors} erro(s) não resolvido(s) no caderno`)
  value = Math.max(0, Math.min(100, value))

  const confidence: Confidence = evidence < 8 ? 'low' : evidence < 30 ? 'medium' : 'high'
  if (confidence === 'low') notes.unshift('Estimativa inicial — poucos dados')
  return {
    value,
    level: levelOf(value),
    confidence,
    evidence,
    lastContactAt,
    parts,
    notes,
    recentWrong,
    recentAccuracy,
    errorDays: errorDaySet.size,
    openErrors: ev.openErrors,
  }
}

/**
 * Valor agregado (matéria ou tópico pai): média ponderada pelos pesos dos
 * filhos, contando os sem dados como 0 — conteúdo não visto não é domínio.
 * `coverage` = fração do peso com alguma evidência.
 */
export function aggregateMastery(items: Array<{ value: number; weight: number; hasData: boolean; lastContactAt: number | null }>): { value: number; level: MasteryLevel; coverage: number; lastContactAt: number | null } {
  const total = items.reduce((a, i) => a + Math.max(0, i.weight || 1), 0)
  if (!items.length || total <= 0) return { value: 0, level: 'none', coverage: 0, lastContactAt: null }
  const withData = items.filter((i) => i.hasData)
  const value = Math.round(items.reduce((a, i) => a + (i.hasData ? i.value : 0) * Math.max(0, i.weight || 1), 0) / total)
  const coverage = withData.reduce((a, i) => a + Math.max(0, i.weight || 1), 0) / total
  const lastContactAt = withData.reduce<number | null>((m, i) => (i.lastContactAt != null && (m == null || i.lastContactAt > m) ? i.lastContactAt : m), null)
  return { value, level: levelOf(value, withData.length > 0), coverage, lastContactAt }
}

/** "hoje", "ontem", "há 4 dias". */
export function lastContactLabel(at: number | null, now: number): string {
  if (at == null) return 'nunca'
  const d = Math.floor((now - at) / DAY_MS)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}

