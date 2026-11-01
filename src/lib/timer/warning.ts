import type { PhaseStatus } from './engine'

/** Um minuto de antecedência; blocos curtos avisam nos últimos 20%. */
export function isTimerEnding(status: PhaseStatus | null, paused = false): boolean {
  if (!status?.phase || status.remaining == null || paused || status.due) return false
  return status.remaining > 0 && status.remaining <= Math.min(60, Math.floor(status.phase.seconds / 5))
}
