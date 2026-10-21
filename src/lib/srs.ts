// Repetição espaçada: variante documentada do SM-2 com quatro respostas.
//
//  1 Errei   → volta ao aprendizado, revisa em `relearnMinutes`; facilidade −0,20.
//  2 Difícil → intervalo × `hardFactor` (mín. `firstInterval`); facilidade −0,15.
//  3 Bom     → 1ª vez: `firstInterval`; 2ª: `secondInterval`; depois intervalo × facilidade.
//  4 Fácil   → intervalo de "Bom" × `easyBonus`; facilidade +0,15.
//
// A facilidade fica entre `minEase` e 5; o intervalo nunca passa de `maxIntervalDays`.
// Todos os parâmetros são ajustáveis em Configurações.
import type { CardStatus, Flashcard, SrsParams } from '@/types/db'

export type Rating = 1 | 2 | 3 | 4

export const RATING_LABELS: Record<Rating, string> = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' }

export const DEFAULT_SRS: SrsParams = {
  initialEase: 2.5,
  minEase: 1.3,
  hardFactor: 1.2,
  easyBonus: 1.3,
  firstInterval: 1,
  secondInterval: 6,
  relearnMinutes: 10,
  maxIntervalDays: 3650,
}

export type CardSchedule = Pick<Flashcard, 'status' | 'ease' | 'interval_days' | 'repetitions' | 'lapses' | 'due_at'>

const DAY = 86400000
const round2 = (n: number) => Math.round(n * 1000) / 1000

export function schedule(card: CardSchedule, rating: Rating, now: number, params: SrsParams = DEFAULT_SRS): CardSchedule {
  const p = { ...DEFAULT_SRS, ...params }
  const ease = Number(card.ease) || p.initialEase
  const prev = Number(card.interval_days) || 0
  const clampEase = (e: number) => round2(Math.min(5, Math.max(p.minEase, e)))
  const clampInterval = (d: number) => Math.min(p.maxIntervalDays, Math.max(1, Math.round(d)))

  const goodInterval = () => {
    if (card.repetitions <= 0) return p.firstInterval
    if (card.repetitions === 1) return p.secondInterval
    return prev * ease
  }

  let status: CardStatus = 'review'
  let newEase = ease
  let interval: number
  let repetitions = card.repetitions
  let lapses = card.lapses
  let due: number

  switch (rating) {
    case 1:
      if (card.status === 'review') lapses += 1
      newEase = clampEase(ease - 0.2)
      repetitions = 0
      status = 'learning'
      due = now + p.relearnMinutes * 60000
      return { status, ease: newEase, interval_days: 0, repetitions, lapses, due_at: new Date(due).toISOString() }
    case 2:
      newEase = clampEase(ease - 0.15)
      interval = clampInterval(Math.max(p.firstInterval, prev * p.hardFactor))
      interval = Math.min(interval, clampInterval(goodInterval()))
      break
    case 3:
      interval = clampInterval(goodInterval())
      break
    case 4: {
      newEase = clampEase(ease + 0.15)
      const good = clampInterval(goodInterval())
      interval = clampInterval(Math.max(good + 1, good * p.easyBonus))
      break
    }
  }
  repetitions += 1
  due = now + interval * DAY
  return { status, ease: newEase, interval_days: interval, repetitions, lapses, due_at: new Date(due).toISOString() }
}

/** Nível de domínio 0–5 derivado do agendamento. */
export function masteryLevel(card: Pick<Flashcard, 'status' | 'interval_days' | 'repetitions'>): number {
  if (card.status === 'new' || card.repetitions === 0) return card.status === 'learning' ? 1 : 0
  const d = Number(card.interval_days)
  if (d < 7) return 2
  if (d < 21) return 3
  if (d < 60) return 4
  return 5
}

export const MASTERY_LABELS = ['Novo', 'Aprendendo', 'Iniciante', 'Intermediário', 'Avançado', 'Dominado']

export function isDue(card: Pick<Flashcard, 'status' | 'due_at'>, now: number): boolean {
  return card.status !== 'suspended' && new Date(card.due_at).getTime() <= now
}

/** Ordena para revisão: vencidos primeiro (mais atrasados antes), depois os mais difíceis. */
export function reviewPriority<T extends Pick<Flashcard, 'due_at' | 'ease' | 'lapses'>>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const da = new Date(a.due_at).getTime()
    const db = new Date(b.due_at).getTime()
    if (da !== db) return da - db
    if (a.ease !== b.ease) return a.ease - b.ease
    return b.lapses - a.lapses
  })
}

export function previewIntervals(card: CardSchedule, now: number, params?: SrsParams): Record<Rating, string> {
  const out = {} as Record<Rating, string>
  for (const r of [1, 2, 3, 4] as Rating[]) {
    const s = schedule(card, r, now, params)
    const diff = new Date(s.due_at).getTime() - now
    out[r] = diff < 3600000 ? `${Math.max(1, Math.round(diff / 60000))} min` : diff < DAY ? `${Math.round(diff / 3600000)} h` : `${Math.round(diff / DAY)} d`
  }
  return out
}
