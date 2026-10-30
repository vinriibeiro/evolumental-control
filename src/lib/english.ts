// Regras da aba Inglês: prática diária sem material. Funções puras sobre as
// sessões da matéria de inglês; os dias são sempre calculados no fuso do usuário.
import type { ActivityType } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'
import { netSeconds } from '@/lib/timer/engine'
import { addDays, dayKey, endOfMonth, startOfMonth, type DayKey } from '@/lib/time'

export const ENGLISH_SKILLS = ['listening', 'speaking', 'reading', 'writing', 'vocabulary'] as const
export type EnglishSkill = (typeof ENGLISH_SKILLS)[number]

export const ENGLISH_SKILL_LABELS: Record<EnglishSkill, string> = {
  listening: 'Ouvir',
  speaking: 'Falar',
  reading: 'Ler',
  writing: 'Escrever',
  vocabulary: 'Vocabulário',
}

/** Tipo de atividade da sessão gerada para cada habilidade. */
export const ENGLISH_SKILL_ACTIVITY: Record<EnglishSkill, ActivityType> = {
  listening: 'other',
  speaking: 'other',
  reading: 'reading',
  writing: 'other',
  vocabulary: 'other',
}

export const ENGLISH_SUBJECT_NAME = 'Inglês'
export const DEFAULT_ENGLISH_GOAL_MINUTES = 20
export const MAX_ENGLISH_GOAL_MINUTES = 600

/** Meta diária válida (inteiro entre 1 e 600); qualquer outro valor volta ao padrão de 20 min. */
export function normalizeEnglishGoal(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_ENGLISH_GOAL_MINUTES
  const r = Math.round(n)
  return r >= 1 && r <= MAX_ENGLISH_GOAL_MINUTES ? r : DEFAULT_ENGLISH_GOAL_MINUTES
}

export interface EnglishPractice {
  /** Início da prática (ms). */
  at: number
  seconds: number
  skill: EnglishSkill | null
}

/** Converte sessões concluídas da matéria de inglês em práticas, pela habilidade do tópico. */
export function practicesFromSessions(sessions: SessionWithPauses[], topicSkill: Map<string, EnglishSkill>, now = Date.now()): EnglishPractice[] {
  return sessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({ at: new Date(s.started_at).getTime(), seconds: netSeconds(s, s.pauses, now), skill: (s.topic_id && topicSkill.get(s.topic_id)) || null }))
    .filter((p) => p.seconds > 0)
}

export function secondsByDay(practices: EnglishPractice[], tz: string): Map<DayKey, number> {
  const out = new Map<DayKey, number>()
  for (const p of practices) {
    const k = dayKey(p.at, tz)
    out.set(k, (out.get(k) ?? 0) + p.seconds)
  }
  return out
}

/** Minutos praticados no dia (arredondados para baixo). */
export function minutesOnDay(practices: EnglishPractice[], day: DayKey, tz: string): number {
  return Math.floor((secondsByDay(practices, tz).get(day) ?? 0) / 60)
}

export function goalMet(minutes: number, goalMinutes: number): boolean {
  return minutes >= normalizeEnglishGoal(goalMinutes)
}

/**
 * Sequência de dias consecutivos com prática, terminando hoje. Se hoje ainda não
 * houve prática, a sequência de ontem continua valendo (o dia não acabou).
 */
export function streak(practices: EnglishPractice[], today: DayKey, tz: string): number {
  const days = secondsByDay(practices, tz)
  const practiced = (k: DayKey) => (days.get(k) ?? 0) > 0
  let k = practiced(today) ? today : addDays(today, -1)
  let n = 0
  while (practiced(k)) {
    n++
    k = addDays(k, -1)
  }
  return n
}

/** Dias do mês (de qualquer dia de referência) com prática, em ordem. */
export function practicedDaysInMonth(practices: EnglishPractice[], anyDayOfMonth: DayKey, tz: string): DayKey[] {
  const from = startOfMonth(anyDayOfMonth)
  const to = endOfMonth(anyDayOfMonth)
  return [...secondsByDay(practices, tz).entries()]
    .filter(([k, s]) => s > 0 && k >= from && k <= to)
    .map(([k]) => k)
    .sort()
}

/** Segundos por habilidade (práticas sem habilidade reconhecida ficam de fora). */
export function totalsBySkill(practices: EnglishPractice[]): Record<EnglishSkill, number> {
  const out = Object.fromEntries(ENGLISH_SKILLS.map((s) => [s, 0])) as Record<EnglishSkill, number>
  for (const p of practices) if (p.skill) out[p.skill] += p.seconds
  return out
}
