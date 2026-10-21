import type { Insert, Patch, Profile, Row, StudySession, StudySessionPause, TableName } from '@/types/db'

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
