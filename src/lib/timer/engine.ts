// Motor do cronômetro: todo tempo é derivado de timestamps (início, pausas,
// retomadas e fim). Nada aqui depende de um contador incrementado por
// setInterval, então o valor é correto após recarregar a página, trocar de
// aba ou suspender o JavaScript.
import type { StudySession, StudySessionPause, TimerConfig, TimerPhase, TimerState } from '@/types/db'
import { addDays, dayKey, zonedDayStart, type DayKey } from '@/lib/time'

export type SessionTimes = Pick<StudySession, 'started_at' | 'ended_at' | 'adjustment_seconds'>
export type PauseTimes = Pick<StudySessionPause, 'started_at' | 'ended_at' | 'kind'>

const ms = (iso: string) => new Date(iso).getTime()

function sessionEnd(session: SessionTimes, now: number): number {
  return session.ended_at ? ms(session.ended_at) : now
}

/** Pausas recortadas ao intervalo da sessão, ordenadas e sem sobreposição. */
export function pauseIntervals(session: SessionTimes, pauses: PauseTimes[], now: number): Array<[number, number]> {
  const start = ms(session.started_at)
  const end = sessionEnd(session, now)
  const raw = pauses
    .map((p): [number, number] => [Math.max(start, ms(p.started_at)), Math.min(end, p.ended_at ? ms(p.ended_at) : end)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
  // Funde sobreposições para nunca descontar o mesmo intervalo duas vezes.
  const merged: Array<[number, number]> = []
  for (const iv of raw) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

export function pausedMs(session: SessionTimes, pauses: PauseTimes[], now: number): number {
  return pauseIntervals(session, pauses, now).reduce((acc, [a, b]) => acc + (b - a), 0)
}

/** Tempo bruto de execução, sem descontar pausas (ms). */
export function grossMs(session: SessionTimes, now: number): number {
  return Math.max(0, sessionEnd(session, now) - ms(session.started_at))
}

/** Tempo líquido em segundos: ⌊(fim − início) − pausas⌋ + ajuste explícito. */
export function netSeconds(session: SessionTimes, pauses: PauseTimes[], now: number = Date.now()): number {
  // Arredonda só no final: floor(bruto) − floor(pausado) oscilaria ±1 s durante uma pausa.
  const activeMs = grossMs(session, now) - pausedMs(session, pauses, now)
  return Math.max(0, Math.floor(activeMs / 1000) + (session.adjustment_seconds ?? 0))
}

export function pausedSeconds(session: SessionTimes, pauses: PauseTimes[], now: number = Date.now()): number {
  return Math.floor(pausedMs(session, pauses, now) / 1000)
}

export function openPause<P extends PauseTimes>(pauses: P[]): P | undefined {
  return pauses.find((p) => !p.ended_at)
}

/** Trechos efetivamente estudados (fora das pausas). */
export function activeSegments(session: SessionTimes, pauses: PauseTimes[], now: number = Date.now()): Array<[number, number]> {
  const start = ms(session.started_at)
  const end = sessionEnd(session, now)
  const out: Array<[number, number]> = []
  let cursor = start
  for (const [a, b] of pauseIntervals(session, pauses, now)) {
    if (a > cursor) out.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (end > cursor) out.push([cursor, end])
  return out
}

/**
 * Distribui o tempo líquido de cada sessão pelos dias (no fuso do usuário),
 * dividindo sessões que atravessam a meia-noite. O ajuste manual é aplicado
 * ao dia de início (ou removido dos trechos mais recentes, se negativo).
 */
export function netSecondsByDay(
  sessions: Array<SessionTimes & { pauses: PauseTimes[] }>,
  tz: string,
  now: number = Date.now(),
): Map<DayKey, number> {
  const out = new Map<DayKey, number>()
  const add = (k: DayKey, s: number) => out.set(k, (out.get(k) ?? 0) + s)
  for (const s of sessions) {
    const perDay = new Map<DayKey, number>()
    for (const [a, b] of activeSegments(s, s.pauses, now)) {
      let cursor = a
      while (cursor < b) {
        const k = dayKey(cursor, tz)
        const nextDay = zonedDayStart(addDays(k, 1), tz)
        const segEnd = Math.min(b, nextDay)
        perDay.set(k, (perDay.get(k) ?? 0) + (segEnd - cursor) / 1000)
        cursor = segEnd
      }
    }
    // Ajusta o arredondamento para bater exatamente com netSeconds().
    const target = netSeconds(s, s.pauses, now)
    const days = [...perDay.keys()].sort()
    const startKey = dayKey(ms(s.started_at), tz)
    if (days.length === 0) {
      if (target > 0) add(startKey, target)
      continue
    }
    const floored = days.map((k) => Math.floor(perDay.get(k)!))
    let diff = target - floored.reduce((a, b) => a + b, 0)
    if (diff > 0) {
      const i = Math.max(0, days.indexOf(startKey))
      floored[i] += diff
      diff = 0
    }
    for (let i = floored.length - 1; i >= 0 && diff < 0; i--) {
      const take = Math.min(floored[i], -diff)
      floored[i] -= take
      diff += take
    }
    days.forEach((k, i) => {
      if (floored[i] > 0) add(k, floored[i])
    })
  }
  return out
}

// ---------------------------------------------------------------------
// Fases (temporizador, pomodoro e intervalos personalizados)
// ---------------------------------------------------------------------

export function pomodoroPhases(p: { focus: number; shortBreak: number; longBreak: number; rounds: number }): TimerPhase[] {
  const phases: TimerPhase[] = []
  const rounds = Math.max(1, Math.floor(p.rounds))
  for (let i = 0; i < rounds; i++) {
    phases.push({ kind: 'focus', seconds: p.focus * 60, label: `Foco ${i + 1}` })
    const last = i === rounds - 1
    phases.push({ kind: 'break', seconds: (last ? p.longBreak : p.shortBreak) * 60, label: last ? 'Pausa longa' : 'Pausa curta' })
  }
  return phases
}

export function phaseAt(config: TimerConfig | null, index: number): TimerPhase | null {
  if (!config || config.phases.length === 0) return null
  if (index < config.phases.length) return config.phases[index]
  if (!config.repeat) return null
  return config.phases[index % config.phases.length]
}

export interface PhaseStatus {
  phase: TimerPhase | null
  index: number
  elapsed: number
  remaining: number | null
  /** A fase terminou e o alerta ainda não foi reconhecido. */
  due: boolean
  overtime: number
}

export function initialTimerState(now: number): TimerState {
  return { phaseIndex: 0, phaseStartedAt: now, phaseNetStart: 0, ackPhase: -1 }
}

export function phaseStatus(
  session: SessionTimes & Pick<StudySession, 'timer_config' | 'timer_state'>,
  pauses: PauseTimes[],
  now: number = Date.now(),
): PhaseStatus {
  const state = session.timer_state ?? initialTimerState(ms(session.started_at))
  const phase = phaseAt(session.timer_config, state.phaseIndex)
  if (!phase) return { phase: null, index: state.phaseIndex, elapsed: 0, remaining: null, due: false, overtime: 0 }
  const net = netSeconds(session, pauses, now)
  const elapsed =
    phase.kind === 'focus'
      ? Math.max(0, net - state.phaseNetStart)
      : Math.max(0, Math.floor((sessionEnd(session, now) - state.phaseStartedAt) / 1000))
  const remaining = phase.seconds - elapsed
  return {
    phase,
    index: state.phaseIndex,
    elapsed,
    remaining: Math.max(0, remaining),
    due: remaining <= 0 && state.ackPhase < state.phaseIndex,
    overtime: Math.max(0, -remaining),
  }
}

/** Estado após avançar para a próxima fase no instante `now`. */
export function advancePhase(state: TimerState, net: number, now: number): TimerState {
  return { phaseIndex: state.phaseIndex + 1, phaseStartedAt: now, phaseNetStart: net, ackPhase: state.phaseIndex }
}

/** Reconhece o alerta da fase atual sem avançar (continuar estudando). */
export function acknowledgePhase(state: TimerState): TimerState {
  return { ...state, ackPhase: state.phaseIndex }
}
