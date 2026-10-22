// Missões, conquistas e loja. Toda regra é baseada em uma MÉTRICA verificável
// a partir das respostas e partidas registradas — o servidor recalcula a métrica
// antes de conceder qualquer recompensa (game_claim) e as definições abaixo são
// copiadas para o banco por `npm run game:catalog`.
import type { GameAnswer, GameSession } from '@/types/db'
import { addDays, dayKey, diffDays, startOfWeek, type DayKey } from '@/lib/time'

export type Metric =
  | 'answers' // respostas enviadas
  | 'correct' // acertos
  | 'subject' // acertos em uma disciplina (param)
  | 'minutes' // minutos ativos em partidas encerradas
  | 'combo' // maior combo
  | 'review' // acertos no modo revisão
  | 'boss' // acertos em desafios de chefe
  | 'lab' // acertos em laboratórios (SQL/Python)
  | 'days' // dias distintos com atividade
  | 'streak' // maior sequência de dias seguidos
  | 'perfect' // partidas encerradas com ≥ 5 respostas e 100% de acerto
  | 'subjects' // disciplinas distintas com acerto
  | 'xp' // XP ganho em respostas

export interface RewardRule {
  key: string
  kind: 'daily' | 'weekly' | 'achievement'
  metric: Metric
  target: number
  title: string
  description: string
  icon: string
  xp: number
  coins: number
  /** Missões por disciplina recebem o id da disciplina como parâmetro. */
  param?: boolean
}

const daily = (metric: Metric, target: number, title: string, icon: string, param = false): RewardRule => ({
  key: `daily:${metric}:${target}`, kind: 'daily', metric, target, title, description: title, icon, xp: 30, coins: 5, param,
})
const weekly = (metric: Metric, target: number, title: string, icon: string): RewardRule => ({
  key: `weekly:${metric}:${target}`, kind: 'weekly', metric, target, title, description: title, icon, xp: 120, coins: 25,
})
const ach = (metric: Metric, target: number, title: string, description: string, icon: string, xp = 50, coins = 10): RewardRule => ({
  key: `ach:${metric}:${target}`, kind: 'achievement', metric, target, title, description, icon, xp, coins,
})

export const DAILY_POOL: RewardRule[] = [
  daily('answers', 10, 'Responda 10 desafios', '🎯'),
  daily('correct', 8, 'Acerte 8 desafios', '✅'),
  daily('minutes', 10, 'Jogue 10 minutos', '⏱️'),
  daily('combo', 5, 'Faça um combo de 5', '🔥'),
  daily('review', 5, 'Acerte 5 revisões', '🔁'),
  daily('subject', 5, 'Acerte 5 desafios de uma disciplina', '📚', true),
]

export const WEEKLY_POOL: RewardRule[] = [
  weekly('correct', 60, 'Acerte 60 desafios na semana', '🏅'),
  weekly('minutes', 60, 'Jogue 60 minutos na semana', '⌛'),
  weekly('days', 4, 'Jogue em 4 dias diferentes', '📅'),
  weekly('boss', 1, 'Derrote um chefe', '👑'),
  weekly('lab', 2, 'Resolva 2 laboratórios', '🧪'),
  weekly('perfect', 2, 'Termine 2 partidas perfeitas', '💎'),
]

export const ACHIEVEMENTS: RewardRule[] = [
  ach('correct', 1, 'Primeiro acerto', 'Acerte seu primeiro desafio.', '🌱', 20, 5),
  ach('correct', 100, 'Centena', 'Acerte 100 desafios.', '💯'),
  ach('correct', 500, 'Incansável', 'Acerte 500 desafios.', '🚀', 150, 40),
  ach('streak', 3, 'Constância', 'Jogue 3 dias seguidos.', '📆'),
  ach('streak', 7, 'Uma semana inteira', 'Jogue 7 dias seguidos.', '🗓️', 100, 20),
  ach('streak', 30, 'Hábito formado', 'Jogue 30 dias seguidos.', '🏆', 300, 80),
  ach('combo', 10, 'Combo 10', 'Acerte 10 seguidos em uma partida.', '🔥'),
  ach('combo', 25, 'Imparável', 'Acerte 25 seguidos em uma partida.', '⚡', 120, 30),
  ach('boss', 1, 'Caçador de chefes', 'Vença um desafio de chefe.', '👑'),
  ach('boss', 10, 'Lenda das unidades', 'Vença 10 desafios de chefe.', '🐉', 150, 40),
  ach('lab', 1, 'Mão no código', 'Resolva um laboratório de SQL ou Python.', '🧪'),
  ach('lab', 10, 'Engenheiro de dados', 'Resolva 10 laboratórios.', '🛠️', 150, 40),
  ach('subjects', 4, 'Explorador', 'Acerte desafios em 4 disciplinas.', '🧭'),
  ach('subjects', 8, 'Enciclopédia', 'Acerte desafios em todas as 8 disciplinas.', '📖', 150, 40),
  ach('perfect', 1, 'Partida perfeita', 'Termine uma partida (5+ respostas) sem errar.', '💎'),
  ach('perfect', 10, 'Precisão cirúrgica', 'Termine 10 partidas perfeitas.', '🎯', 150, 40),
  ach('review', 50, 'Memória de elefante', 'Acerte 50 revisões.', '🐘', 100, 20),
  ach('minutes', 300, 'Cinco horas de jogo', 'Acumule 300 minutos ativos.', '⏳', 100, 20),
  ach('xp', 1000, 'Mil XP', 'Ganhe 1000 XP respondendo desafios.', '✨', 50, 15),
]

export const ALL_RULES = [...DAILY_POOL, ...WEEKLY_POOL, ...ACHIEVEMENTS]
export const ruleByKey = (key: string) => ALL_RULES.find((r) => r.key === key)

/** Máximo de missões resgatáveis por período (o servidor aplica o mesmo limite). */
export const CLAIMS_PER_PERIOD = 3

// ── Escolha determinística das missões do período ──────────────────────────
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function pick<T>(pool: T[], n: number, seed: string): T[] {
  return [...pool].map((x, i) => ({ x, k: hash(`${seed}:${i}`) })).sort((a, b) => a.k - b.k).slice(0, n).map((e) => e.x)
}

export interface ActiveMission {
  rule: RewardRule
  /** Início do período: o dia (diária) ou a segunda-feira (semanal). */
  period: DayKey
  param: string | null
}

export function missionsFor(today: DayKey, subjects: string[]): ActiveMission[] {
  const week = startOfWeek(today)
  const subjectParam = subjects.length ? subjects[hash(today) % subjects.length] : 'ingles'
  return [
    ...pick(DAILY_POOL, CLAIMS_PER_PERIOD, today).map((rule) => ({ rule, period: today, param: rule.param ? subjectParam : null })),
    ...pick(WEEKLY_POOL, CLAIMS_PER_PERIOD, week).map((rule) => ({ rule, period: week, param: null })),
  ]
}

export const claimSource = (rule: RewardRule, period: DayKey | null, param: string | null) =>
  rule.kind === 'achievement' ? `claim:${rule.key}` : `claim:${rule.key}:${period}${param ? `:${param}` : ''}`

// ── Cálculo das métricas (mesma lógica de public.game_metric no SQL) ───────
export interface MetricData {
  answers: Array<Pick<GameAnswer, 'session_id' | 'challenge_id' | 'subject_id' | 'correct' | 'combo' | 'xp' | 'answered_at'>>
  sessions: Array<Pick<GameSession, 'id' | 'mode' | 'status' | 'answered' | 'correct' | 'active_seconds' | 'finished_at' | 'started_at'>>
  /** Ids de desafios de chefe e de laboratório (vêm do catálogo). */
  bossIds: Set<string>
  labIds: Set<string>
}

export function longestStreak(days: DayKey[]): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && diffDays(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

/** Sequência atual: dias seguidos até hoje (ou até ontem, se hoje ainda não jogou). */
export function currentStreak(days: DayKey[], today: DayKey): number {
  const set = new Set(days)
  let d = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function computeMetric(metric: Metric, param: string | null, data: MetricData, range: { from: number; to: number } | null, tz: string): number {
  const inRange = (iso: string | null) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return !range || (t >= range.from && t < range.to)
  }
  const answers = data.answers.filter((a) => inRange(a.answered_at))
  const finished = data.sessions.filter((s) => s.status === 'finished' && inRange(s.finished_at))
  const correct = answers.filter((a) => a.correct)
  switch (metric) {
    case 'answers':
      return answers.length
    case 'correct':
      return correct.length
    case 'subject':
      return correct.filter((a) => a.subject_id === param).length
    case 'minutes':
      return Math.floor(finished.reduce((s, x) => s + x.active_seconds, 0) / 60)
    case 'combo':
      return answers.reduce((m, a) => Math.max(m, a.combo), 0)
    case 'review': {
      const review = new Set(data.sessions.filter((s) => s.mode === 'review').map((s) => s.id))
      return correct.filter((a) => review.has(a.session_id)).length
    }
    case 'boss':
      return correct.filter((a) => data.bossIds.has(a.challenge_id)).length
    case 'lab':
      return correct.filter((a) => data.labIds.has(a.challenge_id)).length
    case 'days':
      return new Set(answers.map((a) => dayKey(new Date(a.answered_at).getTime(), tz))).size
    case 'streak':
      return longestStreak(answers.map((a) => dayKey(new Date(a.answered_at).getTime(), tz)))
    case 'perfect':
      return finished.filter((s) => s.answered >= 5 && s.correct === s.answered).length
    case 'subjects':
      return new Set(correct.map((a) => a.subject_id)).size
    case 'xp':
      return answers.reduce((s, a) => s + a.xp, 0)
  }
}

// ── Loja (somente cosméticos; moedas não têm valor monetário) ──────────────
export interface ShopItem {
  id: string
  kind: 'avatar' | 'title'
  name: string
  value: string
  price: number
}

export const SHOP: ShopItem[] = [
  { id: 'avatar.coruja', kind: 'avatar', name: 'Coruja', value: '🦉', price: 30 },
  { id: 'avatar.raposa', kind: 'avatar', name: 'Raposa', value: '🦊', price: 30 },
  { id: 'avatar.robo', kind: 'avatar', name: 'Robô', value: '🤖', price: 40 },
  { id: 'avatar.astronauta', kind: 'avatar', name: 'Astronauta', value: '🧑‍🚀', price: 60 },
  { id: 'avatar.dragao', kind: 'avatar', name: 'Dragão', value: '🐉', price: 120 },
  { id: 'avatar.trigo', kind: 'avatar', name: 'Trigo dourado', value: '🌾', price: 80 },
  { id: 'title.curioso', kind: 'title', name: 'Título: Curioso', value: 'Curioso', price: 25 },
  { id: 'title.metodico', kind: 'title', name: 'Título: Metódico', value: 'Metódico', price: 50 },
  { id: 'title.analista', kind: 'title', name: 'Título: Analista', value: 'Analista', price: 80 },
  { id: 'title.poliglota', kind: 'title', name: 'Título: Poliglota', value: 'Poliglota', price: 100 },
  { id: 'title.mestre', kind: 'title', name: 'Título: Mestre dos Dados', value: 'Mestre dos Dados', price: 200 },
]

export const shopItem = (id: string) => SHOP.find((i) => i.id === id)
