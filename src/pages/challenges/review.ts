import { CHALLENGES, type Challenge } from './catalog'
import { variationFor, type Variation } from './variations'

/** Registro por conceito (id do exercício original). Guardado à parte dos rascunhos e aprovações. */
export interface ReviewRecord {
  misses: number
  lastMissAt: string
  resolvedAt?: string
}

export interface ReviewItem {
  id: string
  challenge: Challenge
  variation?: Variation
  concept: string
  reason: 'misses' | 'draft'
  misses: number
  lastMissAt?: string
}

const isoDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined

export function parseReviewRecord(value: unknown): ReviewRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const saved = value as Record<string, unknown>
  const lastMissAt = isoDate(saved.lastMissAt)
  if (!lastMissAt || typeof saved.misses !== 'number' || !Number.isInteger(saved.misses) || saved.misses < 0) return undefined
  const resolvedAt = isoDate(saved.resolvedAt)
  return { misses: Math.min(saved.misses, 9999), lastMissAt, ...(resolvedAt ? { resolvedAt } : {}) }
}

/** O conceito está pendente quando houve erro depois da última revisão concluída. */
export const isOpen = (record: ReviewRecord) => record.misses > 0 && (!record.resolvedAt || record.lastMissAt > record.resolvedAt)

export function withMiss(record: ReviewRecord | undefined, now = new Date()): ReviewRecord {
  return { misses: (record?.misses ?? 0) + 1, lastMissAt: now.toISOString(), ...(record?.resolvedAt ? { resolvedAt: record.resolvedAt } : {}) }
}

/** Encerra a pendência. Sem registro anterior (rascunho antigo dispensado), cria um já resolvido. */
export function withResolution(record: ReviewRecord | undefined, now = new Date()): ReviewRecord {
  const at = now.toISOString()
  return { misses: record?.misses ?? 0, lastMissAt: record?.lastMissAt ?? at, resolvedAt: at }
}

interface QueueSource {
  reviews: Record<string, ReviewRecord>
  drafts: Record<string, string>
  verified: string[]
}

/**
 * Fila de revisão: conceitos com erro ainda não revisado (mais recentes primeiro) e,
 * a partir do progresso já salvo, exercícios com rascunho que nunca foram aprovados.
 */
export function buildReviewQueue(source: QueueSource): ReviewItem[] {
  const verified = new Set(source.verified)
  const missed: ReviewItem[] = []
  const drafted: ReviewItem[] = []
  for (const challenge of CHALLENGES) {
    const record = source.reviews[challenge.id]
    const variation = variationFor(challenge.id)
    const item = { id: challenge.id, challenge, variation, concept: variation?.concept ?? challenge.title }
    if (record) {
      if (isOpen(record)) missed.push({ ...item, reason: 'misses', misses: record.misses, lastMissAt: record.lastMissAt })
      continue
    }
    const draft = source.drafts[challenge.id]?.trim()
    if (draft && draft !== challenge.starter.trim() && !verified.has(challenge.id)) drafted.push({ ...item, reason: 'draft', misses: 0 })
  }
  missed.sort((a, b) => (b.lastMissAt ?? '').localeCompare(a.lastMissAt ?? ''))
  return [...missed, ...drafted]
}
