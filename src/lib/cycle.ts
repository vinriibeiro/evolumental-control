// Regras do ciclo de estudos. O ciclo avança pela execução registrada
// (sessões vinculadas ao bloco atual), nunca pela passagem dos dias.
import type { StudyCycle, StudyCycleItem } from '@/types/db'

export type CycleProgress = Pick<StudyCycle, 'current_index' | 'current_progress_seconds' | 'completed_rounds'>

/**
 * O que fazer quando a sessão não completa o bloco:
 *  - 'resume': mantém a posição e acumula o tempo (o restante será retomado);
 *  - 'advance': avança para o próximo bloco mesmo assim.
 * Quando o bloco é completado, 'auto' avança se `auto_advance` estiver ligado.
 */
export type PartialDecision = 'resume' | 'advance'

export function sortItems<T extends Pick<StudyCycleItem, 'sort_order'>>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

export function normalizeIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

export function currentItem<T extends Pick<StudyCycleItem, 'sort_order'>>(cycle: CycleProgress, items: T[]): T | null {
  const sorted = sortItems(items)
  if (sorted.length === 0) return null
  return sorted[normalizeIndex(cycle.current_index, sorted.length)]
}

function advance(cycle: CycleProgress, length: number, steps = 1): CycleProgress {
  let index = normalizeIndex(cycle.current_index, length) + steps
  let rounds = cycle.completed_rounds
  while (index >= length) {
    index -= length
    rounds += 1
  }
  while (index < 0) {
    index += length
    rounds = Math.max(0, rounds - 1)
  }
  return { current_index: index, current_progress_seconds: 0, completed_rounds: rounds }
}

export interface ApplyResult {
  progress: CycleProgress
  completedBlock: boolean
  advanced: boolean
  /** Tempo que faltava no bloco quando a sessão terminou (0 se completou). */
  remainingSeconds: number
}

/**
 * Aplica `seconds` de estudo ao bloco `itemId` do ciclo. Se o bloco não for o
 * atual, o tempo é estudo válido, mas não move a posição do ciclo.
 */
export function applyStudy(
  cycle: CycleProgress & Pick<StudyCycle, 'auto_advance'>,
  items: StudyCycleItem[],
  itemId: string,
  seconds: number,
  partialDecision: PartialDecision = 'resume',
): ApplyResult {
  const sorted = sortItems(items)
  const base: CycleProgress = {
    current_index: cycle.current_index,
    current_progress_seconds: cycle.current_progress_seconds,
    completed_rounds: cycle.completed_rounds,
  }
  const item = currentItem(cycle, sorted)
  if (!item || item.id !== itemId || seconds <= 0) {
    return { progress: base, completedBlock: false, advanced: false, remainingSeconds: item ? item.duration_minutes * 60 - base.current_progress_seconds : 0 }
  }
  const total = base.current_progress_seconds + Math.floor(seconds)
  const target = item.duration_minutes * 60
  if (total >= target) {
    if (cycle.auto_advance) return { progress: advance(base, sorted.length), completedBlock: true, advanced: true, remainingSeconds: 0 }
    return { progress: { ...base, current_progress_seconds: total }, completedBlock: true, advanced: false, remainingSeconds: 0 }
  }
  if (partialDecision === 'advance') {
    return { progress: advance(base, sorted.length), completedBlock: false, advanced: true, remainingSeconds: target - total }
  }
  return { progress: { ...base, current_progress_seconds: total }, completedBlock: false, advanced: false, remainingSeconds: target - total }
}

/** Avanço/recuo manual ("pular" ou "voltar"). */
export function skip(cycle: CycleProgress, length: number, steps: 1 | -1): CycleProgress {
  if (length === 0) return cycle
  return advance(cycle, length, steps)
}

export interface CycleSummary {
  position: number // 1-based
  length: number
  current: StudyCycleItem | null
  next: StudyCycleItem | null
  blockPercent: number
  roundPercent: number
  pending: StudyCycleItem[]
  totalMinutes: number
}

export function summarize(cycle: CycleProgress, items: StudyCycleItem[]): CycleSummary {
  const sorted = sortItems(items)
  const length = sorted.length
  if (length === 0) {
    return { position: 0, length: 0, current: null, next: null, blockPercent: 0, roundPercent: 0, pending: [], totalMinutes: 0 }
  }
  const idx = normalizeIndex(cycle.current_index, length)
  const current = sorted[idx]
  const next = sorted[(idx + 1) % length]
  const target = current.duration_minutes * 60
  const blockPercent = Math.min(100, (cycle.current_progress_seconds / target) * 100)
  const totalSeconds = sorted.reduce((a, it) => a + it.duration_minutes * 60, 0)
  const doneSeconds = sorted.slice(0, idx).reduce((a, it) => a + it.duration_minutes * 60, 0) + Math.min(target, cycle.current_progress_seconds)
  return {
    position: idx + 1,
    length,
    current,
    next: length > 1 ? next : null,
    blockPercent,
    roundPercent: totalSeconds > 0 ? (doneSeconds / totalSeconds) * 100 : 0,
    pending: sorted.slice(idx),
    totalMinutes: totalSeconds / 60,
  }
}

/**
 * Sugere a duração de cada bloco proporcional ao peso, para um total de
 * minutos por volta. Arredonda para múltiplos de 5 minutos.
 */
export function distributeByWeight(weights: number[], totalMinutes: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return weights.map(() => 0)
  return weights.map((w) => Math.max(5, Math.round(((w / sum) * totalMinutes) / 5) * 5))
}
