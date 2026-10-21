import Papa from 'papaparse'
import type { Flashcard, SrsParams } from '@/types/db'
import type { DataBackend } from '@/lib/data/types'
import { schedule, type Rating } from '@/lib/srs'

/** Registra a resposta e reagenda o cartão de forma atômica e idempotente. */
export async function reviewCard(
  backend: DataBackend,
  card: Flashcard,
  rating: Rating,
  params?: SrsParams,
  reviewId: string = crypto.randomUUID(),
): Promise<boolean> {
  const now = Date.now()
  const next = schedule(card, rating, now, params)
  return backend.recordFlashcardReview({
    reviewId,
    cardId: card.id,
    rating,
    reviewedAt: new Date(now).toISOString(),
    status: card.status === 'suspended' ? 'suspended' : next.status,
    ease: next.ease,
    intervalDays: next.interval_days,
    repetitions: next.repetitions,
    lapses: next.lapses,
    dueAt: next.due_at,
  })
}

export interface CsvCardRow {
  line: number
  front: string
  back: string
  note: string | null
  tags: string[]
  error: string | null
}

const FRONT = ['frente', 'front', 'pergunta', 'question']
const BACK = ['verso', 'back', 'resposta', 'answer']
const NOTE = ['observacao', 'observação', 'nota', 'note', 'explicacao', 'explicação']
const TAGS = ['tags', 'etiquetas']

/**
 * Lê CSV com cabeçalho (frente, verso, observação, tags) ou, sem cabeçalho,
 * as colunas nessa ordem. Aceita vírgula ou ponto e vírgula; tags separadas
 * por "|" ou ",".
 */
export function parseCardsCsv(text: string): CsvCardRow[] {
  const parsed = Papa.parse<string[]>(text.replace(new RegExp('^' + String.fromCharCode(0xfeff)), ''), { skipEmptyLines: 'greedy', delimiter: '' })
  const rows = parsed.data.filter((r) => r.some((c) => c && c.trim()))
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const find = (names: string[]) => header.findIndex((h) => names.includes(h))
  const hasHeader = find(FRONT) >= 0 && find(BACK) >= 0
  const idx = hasHeader ? { f: find(FRONT), b: find(BACK), n: find(NOTE), t: find(TAGS) } : { f: 0, b: 1, n: 2, t: 3 }
  const body = hasHeader ? rows.slice(1) : rows
  return body.map((r, i) => {
    const front = (r[idx.f] ?? '').trim()
    const back = (r[idx.b] ?? '').trim()
    const note = idx.n >= 0 ? (r[idx.n] ?? '').trim() || null : null
    const tags =
      idx.t >= 0
        ? [...new Set((r[idx.t] ?? '').split(/[|,]/).map((t) => t.trim()).filter(Boolean))].slice(0, 50)
        : []
    let error: string | null = null
    if (!front) error = 'Frente vazia'
    else if (!back) error = 'Verso vazio'
    else if (front.length > 10000 || back.length > 10000) error = 'Texto muito longo (máx. 10.000 caracteres)'
    return { line: i + (hasHeader ? 2 : 1), front, back, note, tags, error }
  })
}

export function cardsToCsv(cards: Array<Pick<Flashcard, 'front' | 'back' | 'note' | 'tags'>>): string {
  return Papa.unparse({
    fields: ['frente', 'verso', 'observacao', 'tags'],
    data: cards.map((c) => [c.front, c.back, c.note ?? '', c.tags.join('|')]),
  })
}
