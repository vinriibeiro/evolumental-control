// Planejado × realizado: o usuário está planejando acima ou abaixo da própria
// capacidade? E uma proposta de ajuste (só com prévia e confirmação) que
// encurta blocos FUTUROS pendentes na proporção do ritmo real. Puro.
import type { SessionWithPauses } from '@/lib/data/types'
import { addDays, hhmmToMinutes, startOfWeek, type DayKey } from '@/lib/time'
import { breakdown } from '@/lib/stats'
import type { StudyPlanItem } from '@/types/db'

export interface WeekRow {
  /** Segunda-feira da semana. */
  week: DayKey
  plannedMinutes: number
  doneMinutes: number
}

export interface PlanVsDone {
  weeks: WeekRow[]
  /** Médias semanais (só semanas com algo planejado). */
  avgPlanned: number
  avgDone: number
  /** realizado ÷ planejado (0–∞); null sem planejamento no período. */
  execution: number | null
  /** Quanto o plano está acima (+) ou abaixo (−) do ritmo realizado, em %. */
  gapPercent: number | null
  message: string
}

/** Blocos que contam como "planejados" (remarcados viram outro bloco). */
const countsAsPlanned = (p: Pick<StudyPlanItem, 'status'>) => p.status !== 'rescheduled'

/**
 * Últimas `weeks` semanas COMPLETAS (a atual fica de fora para não penalizar
 * a semana em andamento). Tempo realizado = tempo líquido de sessões
 * concluídas, repartido por dia no fuso do usuário.
 */
export function planVsDone(input: { items: Array<Pick<StudyPlanItem, 'date' | 'duration_minutes' | 'status'>>; sessions: SessionWithPauses[]; today: DayKey; tz: string; weeks?: number }): PlanVsDone {
  const n = input.weeks ?? 6
  const thisWeek = startOfWeek(input.today)
  const weeks: WeekRow[] = []
  for (let i = n; i >= 1; i--) {
    const week = addDays(thisWeek, -7 * i)
    const end = addDays(week, 6)
    const planned = input.items.filter((p) => countsAsPlanned(p) && p.date >= week && p.date <= end).reduce((a, p) => a + p.duration_minutes, 0)
    const done = breakdown(input.sessions, input.tz, { from: week, to: end }).total / 60
    weeks.push({ week, plannedMinutes: planned, doneMinutes: Math.round(done) })
  }
  const withPlan = weeks.filter((w) => w.plannedMinutes > 0)
  if (!withPlan.length) return { weeks, avgPlanned: 0, avgDone: 0, execution: null, gapPercent: null, message: 'Sem blocos planejados nas últimas semanas: crie um cronograma para comparar o planejado com o realizado.' }
  const avgPlanned = withPlan.reduce((a, w) => a + w.plannedMinutes, 0) / withPlan.length
  const avgDone = withPlan.reduce((a, w) => a + w.doneMinutes, 0) / withPlan.length
  const execution = avgDone / avgPlanned
  const gapPercent = avgDone > 0 ? Math.round((avgPlanned / avgDone - 1) * 100) : null
  let message: string
  if (avgDone === 0) message = 'Nada foi estudado nas semanas planejadas. Comece com um plano menor, que caiba na rotina.'
  else if (Math.abs(gapPercent!) < 10) message = 'Seu planejamento está alinhado ao seu ritmo realizado.'
  else if (gapPercent! > 0) message = `Seu planejamento recente está aproximadamente ${gapPercent}% acima do seu ritmo realizado.`
  else message = `Você está estudando aproximadamente ${Math.abs(Math.round((1 - avgPlanned / avgDone) * 100))}% além do que planeja: dá para planejar um pouco mais.`
  return { weeks, avgPlanned, avgDone, execution, gapPercent, message }
}

export interface CapacityChange {
  id: string
  date: DayKey
  before: number
  after: number
}

export interface CapacityProposal {
  factor: number
  changes: CapacityChange[]
  /** Minutos por semana (segunda-feira) antes e depois. */
  weeks: Array<{ week: DayKey; before: number; after: number }>
}

/**
 * Encurta blocos futuros pendentes para o ritmo real (fator = realizado ÷
 * planejado, entre 0,3 e 1). Arredonda para 5 min e nunca deixa um bloco com
 * menos de 15 min. Blocos passados, concluídos, parciais, não realizados ou
 * remarcados não mudam. Não grava nada: devolve a prévia.
 */
export function proposeCapacity(
  items: Array<Pick<StudyPlanItem, 'id' | 'date' | 'start_time' | 'duration_minutes' | 'status'>>,
  execution: number,
  today: DayKey,
  nowMinute: number,
): CapacityProposal {
  const factor = Math.max(0.3, Math.min(1, execution))
  const future = items.filter((p) => p.status === 'pending' && (p.date > today || (p.date === today && hhmmToMinutes(p.start_time) > nowMinute)))
  const changes: CapacityChange[] = []
  const weekMap = new Map<DayKey, { before: number; after: number }>()
  for (const p of future) {
    const after = Math.max(15, Math.round((p.duration_minutes * factor) / 5) * 5)
    const final = Math.min(p.duration_minutes, after)
    if (final !== p.duration_minutes) changes.push({ id: p.id, date: p.date, before: p.duration_minutes, after: final })
    const w = startOfWeek(p.date)
    const cur = weekMap.get(w) ?? { before: 0, after: 0 }
    weekMap.set(w, { before: cur.before + p.duration_minutes, after: cur.after + final })
  }
  return { factor, changes, weeks: [...weekMap].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, ...v })) }
}
