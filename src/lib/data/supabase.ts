// Backend Supabase/PostgreSQL. O isolamento por usuário é garantido no banco
// (RLS + user_id default auth.uid()); o cliente nunca envia user_id.
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import type { GameSession, Insert, Patch, Profile, Row, TableName } from '@/types/db'
import { DEFAULTS } from './schema'
import {
  DataError,
  type DataBackend,
  type Filter,
  type FlashcardReviewInput,
  type GameAnswerInput,
  type GameAnswerResult,
  type GameClaimInput,
  type GameFinishInput,
  type GameStartInput,
  type ListQuery,
  type ListResult,
  type SessionWithPauses,
} from './types'

function toDataError(e: PostgrestError | Error | null): DataError {
  if (!e) return new DataError('unknown', 'Erro desconhecido.')
  const code = 'code' in e ? (e as PostgrestError).code : ''
  const msg = e.message ?? ''
  if (code === '23505') return new DataError('duplicate', 'Registro duplicado.')
  if (code === '23514' || code === '23502' || code === '22P02') return new DataError('validation', 'Dados inválidos: ' + msg)
  if (code === '22023') return new DataError('validation', msg)
  if (code === 'P0002') return new DataError('not_found', msg)
  if (code === '23503') return new DataError('validation', 'Registro relacionado inexistente.')
  if (code === '42501' || code === 'PGRST301' || /JWT/i.test(msg)) return new DataError('auth', 'Sessão expirada ou sem permissão. Entre novamente.')
  if (/fetch|network|Failed to fetch/i.test(msg)) return new DataError('network', 'Falha de conexão. Verifique a internet e tente novamente.')
  return new DataError('unknown', msg || 'Erro ao acessar o servidor.')
}

/** Escapa o termo para uso em filtros or() do PostgREST. */
function escapeLike(term: string) {
  return term.replace(/[%_\\]/g, (m) => '\\' + m).replace(/[,()"]/g, ' ')
}

// O builder do supabase-js é fortemente tipado por tabela; aqui trabalhamos de
// forma genérica sobre ele.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any

function applyFilters(q: AnyBuilder, filters: Filter[] = []): AnyBuilder {
  for (const f of filters) {
    switch (f.op) {
      case 'eq':
        q = q.eq(f.column, f.value)
        break
      case 'neq':
        q = q.neq(f.column, f.value)
        break
      case 'in':
        q = q.in(f.column, f.value as unknown[])
        break
      case 'gt':
        q = q.gt(f.column, f.value)
        break
      case 'gte':
        q = q.gte(f.column, f.value)
        break
      case 'lt':
        q = q.lt(f.column, f.value)
        break
      case 'lte':
        q = q.lte(f.column, f.value)
        break
      case 'is':
        q = q.is(f.column, null)
        break
      case 'not_null':
        q = q.not(f.column, 'is', null)
        break
      case 'contains':
        q = q.contains(f.column, f.value as unknown[])
        break
    }
  }
  return q
}

function applyQuery(q: AnyBuilder, query: ListQuery = {}): AnyBuilder {
  q = applyFilters(q, query.filters)
  if (query.search && query.search.term.trim()) {
    const t = escapeLike(query.search.term.trim())
    q = q.or(query.search.columns.map((c) => `${c}.ilike.%${t}%`).join(','))
  }
  for (const o of query.order ?? []) q = q.order(o.column, { ascending: o.ascending !== false })
  if (query.limit != null) {
    const from = query.offset ?? 0
    q = q.range(from, from + query.limit - 1)
  }
  return q
}

export class SupabaseBackend implements DataBackend {
  readonly kind = 'supabase' as const
  private client: SupabaseClient
  private uid: () => string | null

  constructor(client: SupabaseClient, uid: () => string | null) {
    this.client = client
    this.uid = uid
  }

  async list<T extends TableName>(table: T, query?: ListQuery): Promise<ListResult<Row<T>>> {
    const q = applyQuery(this.client.from(table).select('*', query?.count ? { count: 'exact' } : undefined), query)
    const { data, error, count } = await q
    if (error) throw toDataError(error)
    return { rows: data as Row<T>[], count: count ?? null }
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).maybeSingle()
    if (error) throw toDataError(error)
    return (data as Row<T>) ?? null
  }

  async count(table: TableName, filters: Filter[]): Promise<number> {
    const q = applyFilters(this.client.from(table).select('id', { count: 'exact', head: true }), filters)
    const { error, count } = await q
    if (error) throw toDataError(error)
    return count ?? 0
  }

  async insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]> {
    const payload = rows.map((r) => ({ ...(DEFAULTS[table] as object), ...(r as object) }))
    const out: Row<T>[] = []
    // Lotes moderados para importações grandes (ex.: CSV de flashcards).
    for (let i = 0; i < payload.length; i += 500) {
      const { data, error } = await this.client.from(table).insert(payload.slice(i, i + 500)).select('*')
      if (error) throw toDataError(error)
      out.push(...(data as Row<T>[]))
    }
    return out
  }

  async update<T extends TableName>(table: T, filters: Filter[], patch: Patch<T>): Promise<Row<T>[]> {
    if (filters.length === 0) throw new DataError('validation', 'Atualização sem filtro não é permitida.')
    const q = applyFilters(this.client.from(table).update(patch as never), filters).select('*')
    const { data, error } = await q
    if (error) throw toDataError(error)
    return data as Row<T>[]
  }

  async remove(table: TableName, filters: Filter[]): Promise<number> {
    if (filters.length === 0) throw new DataError('validation', 'Exclusão sem filtro não é permitida.')
    const q = applyFilters(this.client.from(table).delete({ count: 'exact' }), filters)
    const { error, count } = await q
    if (error) throw toDataError(error)
    return count ?? 0
  }

  async getProfile(): Promise<Profile> {
    const id = this.uid()
    if (!id) throw new DataError('auth', 'Não autenticado.')
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).maybeSingle()
    if (error) throw toDataError(error)
    if (data) return data as Profile
    // Caso o gatilho de criação de perfil não tenha rodado (projeto antigo).
    const ins = await this.client.from('profiles').insert({ id }).select('*').single()
    if (ins.error) throw toDataError(ins.error)
    return ins.data as Profile
  }

  async updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'settings'>>): Promise<Profile> {
    const id = this.uid()
    if (!id) throw new DataError('auth', 'Não autenticado.')
    const { data, error } = await this.client.from('profiles').update(patch).eq('id', id).select('*').single()
    if (error) throw toDataError(error)
    return data as Profile
  }

  async listSessions(query?: ListQuery): Promise<SessionWithPauses[]> {
    const q = applyQuery(this.client.from('study_sessions').select('*, pauses:study_session_pauses(*)'), query)
    const { data, error } = await q
    if (error) throw toDataError(error)
    return data as SessionWithPauses[]
  }

  async recordFlashcardReview(input: FlashcardReviewInput): Promise<boolean> {
    const { data, error } = await this.client.rpc('record_flashcard_review', {
      p_review_id: input.reviewId,
      p_card_id: input.cardId,
      p_rating: input.rating,
      p_reviewed_at: input.reviewedAt,
      p_status: input.status,
      p_ease: input.ease,
      p_interval_days: input.intervalDays,
      p_repetitions: input.repetitions,
      p_lapses: input.lapses,
      p_due_at: input.dueAt,
    })
    if (error) throw toDataError(error)
    return Boolean(data)
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args)
    if (error) throw toDataError(error)
    return data as T
  }

  gameStart(i: GameStartInput): Promise<GameSession> {
    return this.rpc('game_start_session', { p_id: i.id, p_subject: i.subjectId, p_unit: i.unitId, p_mode: i.mode, p_queue: i.queue, p_planned_seconds: i.plannedSeconds })
  }

  gameAnswer(i: GameAnswerInput): Promise<GameAnswerResult> {
    return this.rpc('game_submit_answer', {
      p_id: i.id,
      p_session: i.sessionId,
      p_challenge: i.challengeId,
      p_version: i.version,
      p_topic: i.topic,
      p_correct: i.correct,
      p_score: i.score,
      p_used_hint: i.usedHint,
      p_seconds: Math.round(i.seconds),
      p_response: i.response ?? null,
    })
  }

  gameFinish(i: GameFinishInput): Promise<GameSession> {
    return this.rpc('game_finish_session', { p_session: i.sessionId, p_active_seconds: Math.round(i.activeSeconds), p_status: i.status, p_study_session: i.studySessionId })
  }

  gameClaim(i: GameClaimInput) {
    return this.rpc<{ applied: boolean; xp: number; coins: number }>('game_claim', { p_rule: i.rule, p_period: i.period, p_param: i.param })
  }

  gameBuy(itemId: string): Promise<boolean> {
    return this.rpc('game_buy', { p_item: itemId })
  }

  gameBuyTicket(city: string): Promise<{ bought: boolean; price: number }> {
    return this.rpc('game_buy_ticket', { p_city: city })
  }

  async gameTotals(): Promise<{ xp: number; coins: number }> {
    const rows = await this.rpc<Array<{ xp: number | string; coins: number | string }> | { xp: number | string; coins: number | string }>('game_totals', {})
    const r = Array.isArray(rows) ? rows[0] : rows
    return { xp: Number(r?.xp ?? 0), coins: Number(r?.coins ?? 0) }
  }

  gameCompleteStep(step: string, answer: string | null) {
    return this.rpc<{ applied: boolean; xp: number; coins: number }>('game_complete_step', { p_step: step, p_answer: answer })
  }

  async resetAllData(): Promise<void> {
    const { error } = await this.client.rpc('reset_my_data')
    if (error) throw toDataError(error)
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.rpc('delete_my_account')
    if (error) throw toDataError(error)
  }
}
