import type { GameMode, GameSession, Insert, Patch, Profile, Row, StudySession, StudySessionPause, TableName } from '@/types/db'

export type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'is' | 'not_null' | 'contains'

export interface Filter {
  column: string
  op: FilterOp
  value?: unknown
}

export interface ListQuery {
  filters?: Filter[]
  /** Busca textual (ILIKE) em qualquer uma das colunas. */
  search?: { columns: string[]; term: string }
  order?: Array<{ column: string; ascending?: boolean }>
  limit?: number
  offset?: number
  count?: boolean
}

export interface ListResult<T> {
  rows: T[]
  count: number | null
}

export type SessionWithPauses = StudySession & { pauses: StudySessionPause[] }

export interface FlashcardReviewInput {
  reviewId: string
  cardId: string
  rating: 1 | 2 | 3 | 4
  reviewedAt: string
  status: string
  ease: number
  intervalDays: number
  repetitions: number
  lapses: number
  dueAt: string
}

export interface GameStartInput {
  id: string
  subjectId: string
  unitId: string | null
  mode: GameMode
  queue: string[]
  plannedSeconds: number | null
}

export interface GameAnswerInput {
  /** Gerado no cliente: reenviar a mesma resposta não duplica recompensas. */
  id: string
  sessionId: string
  challengeId: string
  version: number
  topic: string
  correct: boolean
  score: number
  usedHint: boolean
  seconds: number
  /** Resposta bruta: o servidor recorrige os tipos objetivos com o gabarito. */
  response: unknown
  /** Usados apenas no modo local (no servidor vêm do catálogo). */
  local: { difficulty: number; subjectId: string }
}

export interface GameAnswerResult {
  xp: number
  coins: number
  combo: number
  correct: boolean
  novelty: number | null
  duplicate: boolean
}

export interface GameFinishInput {
  sessionId: string
  activeSeconds: number
  status: 'finished' | 'abandoned'
  studySessionId: string | null
}

export interface GameClaimInput {
  rule: string
  period: string | null
  param: string | null
}

export interface DataBackend {
  readonly kind: 'supabase' | 'local'
  list<T extends TableName>(table: T, query?: ListQuery): Promise<ListResult<Row<T>>>
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]>
  /** Atualização condicional: só altera linhas que satisfazem os filtros. */
  update<T extends TableName>(table: T, filters: Filter[], patch: Patch<T>): Promise<Row<T>[]>
  remove(table: TableName, filters: Filter[]): Promise<number>
  count(table: TableName, filters: Filter[]): Promise<number>
  getProfile(): Promise<Profile>
  updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'settings'>>): Promise<Profile>
  listSessions(query?: ListQuery): Promise<SessionWithPauses[]>
  recordFlashcardReview(input: FlashcardReviewInput): Promise<boolean>
  gameStart(input: GameStartInput): Promise<GameSession>
  gameAnswer(input: GameAnswerInput): Promise<GameAnswerResult>
  gameFinish(input: GameFinishInput): Promise<GameSession>
  /** Resgata missão/conquista; o backend confere a meta. false = já resgatada. */
  gameClaim(input: GameClaimInput): Promise<{ applied: boolean; xp: number; coins: number }>
  /** Compra um cosmético com moedas virtuais. false = já possuía. */
  gameBuy(itemId: string): Promise<boolean>
  gameTotals(): Promise<{ xp: number; coins: number }>
  /**
   * Conclui uma etapa de missão do RPG. O backend confere a ordem e o hash da
   * resposta e credita a recompensa do catálogo uma única vez.
   */
  gameCompleteStep(step: string, answer: string | null): Promise<{ applied: boolean; xp: number; coins: number }>
  /** Apaga todos os dados de estudo e restaura as preferências; mantém a conta. */
  resetAllData(): Promise<void>
  /** Exclui a conta e, em cascata, todos os dados. */
  deleteAccount(): Promise<void>
}

export class DataError extends Error {
  code: 'duplicate' | 'not_found' | 'validation' | 'network' | 'auth' | 'unknown'
  constructor(code: DataError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export const eq = (column: string, value: unknown): Filter => ({ column, op: 'eq', value })
export const inList = (column: string, value: unknown[]): Filter => ({ column, op: 'in', value })
export const gt = (column: string, value: unknown): Filter => ({ column, op: 'gt', value })
export const gte = (column: string, value: unknown): Filter => ({ column, op: 'gte', value })
export const lt = (column: string, value: unknown): Filter => ({ column, op: 'lt', value })
export const lte = (column: string, value: unknown): Filter => ({ column, op: 'lte', value })
export const isNull = (column: string): Filter => ({ column, op: 'is', value: null })
export const notNull = (column: string): Filter => ({ column, op: 'not_null' })
