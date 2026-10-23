// Backend do MODO LOCAL (desenvolvimento / uso em um único navegador).
// Os dados ficam no IndexedDB deste navegador: não há login real nem
// sincronização com a nuvem. A interface informa isso ao usuário.
// Reproduz as regras relevantes do PostgreSQL: padrões, restrições únicas
// parciais, exclusão em cascata/SET NULL e a RPC de revisão de flashcards.
import Dexie, { type Table } from 'dexie'
import type { GameAnswer, GameSession, Insert, Patch, Profile, Row, TableName } from '@/types/db'
import { computeXp } from '@/game/engine/rules'
import { CLAIMS_PER_PERIOD, claimSource, computeMetric, ruleByKey, shopItem } from '@/game/engine/rewards'
import { addDays, browserTimeZone, dayKey, zonedDayStart } from '@/lib/time'
import { DEFAULTS, RELATIONS, TABLES, UNIQUE_RULES } from './schema'
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

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001'

type AnyRow = Record<string, unknown> & { id: string }

const INDEXES: Record<TableName, string> = {
  profiles: 'id',
  study_folders: 'id, parent_id',
  subjects: 'id, status, folder_id',
  topics: 'id, subject_id, parent_id',
  study_materials: 'id, topic_id, subject_id',
  study_sessions: 'id, status, started_at, subject_id, topic_id',
  study_session_pauses: 'id, session_id',
  study_plans: 'id',
  study_plan_items: 'id, plan_id, date',
  study_cycles: 'id',
  study_cycle_items: 'id, cycle_id',
  calendar_tasks: 'id, date',
  reviews: 'id, scheduled_for, topic_id',
  flashcard_decks: 'id',
  flashcards: 'id, deck_id, due_at, topic_id',
  flashcard_reviews: 'id, card_id, reviewed_at',
  mind_maps: 'id',
  study_goals: 'id',
  question_records: 'id, date, subject_id',
  game_sessions: 'id, status, subject_id, started_at',
  game_answers: 'id, session_id, challenge_id, answered_at',
  game_rewards: 'id, &source',
  game_purchases: 'id, &item_id',
  game_quest_progress: 'id, &step_key',
  game_saves: 'id, &slot',
}

const V1_INDEXES = Object.fromEntries(Object.entries(INDEXES).filter(([t]) => !t.startsWith('game_') && t !== 'study_folders').map(([t, i]) => [t, t === 'subjects' ? 'id, status' : i]))
const RPG_TABLES = ['game_quest_progress', 'game_saves']
const V2_INDEXES = { ...V1_INDEXES, ...Object.fromEntries(Object.entries(INDEXES).filter(([t]) => t.startsWith('game_') && !RPG_TABLES.includes(t))) }
const V3_INDEXES = Object.fromEntries(Object.entries(INDEXES).filter(([t]) => !RPG_TABLES.includes(t)))

class LocalDb extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(1).stores(V1_INDEXES)
    // v2: tabelas do EvoQuest (as demais não mudam).
    this.version(2).stores(V2_INDEXES)
    // v3: Explorador — pastas; matérias e tópicos ganham colunas com padrão.
    this.version(3)
      .stores(V3_INDEXES)
      .upgrade(async (tx) => {
        await tx.table('subjects').toCollection().modify((r: AnyRow) => {
          r.folder_id ??= null
          r.favorite ??= false
        })
        await tx.table('topics').toCollection().modify((r: AnyRow) => {
          r.kind ??= 'topic'
          r.favorite ??= false
        })
      })
    // v4: EvoQuest RPG — progresso de missões e salvamento do mundo.
    this.version(4).stores(INDEXES)
  }
  t(table: TableName): Table<AnyRow, string> {
    return this.table(table)
  }
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

export function matchFilter(row: Record<string, unknown>, f: Filter): boolean {
  const v = row[f.column]
  switch (f.op) {
    case 'eq':
      return v === f.value || (typeof v === 'number' && Number(f.value) === v)
    case 'neq':
      return v !== f.value
    case 'in':
      return (f.value as unknown[]).includes(v)
    case 'gt':
      return v != null && cmp(v, f.value) > 0
    case 'gte':
      return v != null && cmp(v, f.value) >= 0
    case 'lt':
      return v != null && cmp(v, f.value) < 0
    case 'lte':
      return v != null && cmp(v, f.value) <= 0
    case 'is':
      return v == null
    case 'not_null':
      return v != null
    case 'contains':
      return Array.isArray(v) && (f.value as unknown[]).every((x) => v.includes(x))
  }
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function applyQuery<T extends Record<string, unknown>>(rows: T[], q: ListQuery = {}): ListResult<T> {
  let out = rows.filter((r) => (q.filters ?? []).every((f) => matchFilter(r, f)))
  if (q.search && q.search.term.trim()) {
    const term = normalize(q.search.term.trim())
    out = out.filter((r) => q.search!.columns.some((c) => typeof r[c] === 'string' && normalize(r[c] as string).includes(term)))
  }
  if (q.order?.length) {
    out = [...out].sort((a, b) => {
      for (const o of q.order!) {
        const c = cmp(a[o.column], b[o.column])
        if (c !== 0) return o.ascending === false ? -c : c
      }
      return 0
    })
  }
  const count = q.count ? out.length : null
  const offset = q.offset ?? 0
  if (q.limit != null) out = out.slice(offset, offset + q.limit)
  else if (offset) out = out.slice(offset)
  return { rows: out, count }
}

export class LocalBackend implements DataBackend {
  readonly kind = 'local' as const
  private db: LocalDb

  constructor(name = 'evolumental-local') {
    this.db = new LocalDb(name)
  }

  private now() {
    return new Date().toISOString()
  }

  private async checkUnique(table: TableName, row: AnyRow) {
    const rules = UNIQUE_RULES[table]
    if (!rules) return
    for (const rule of rules) {
      if (!rule.where(row)) continue
      const clash = await this.db
        .t(table)
        .filter((r) => r.id !== row.id && rule.where(r) && rule.columns.every((c) => r[c] === row[c]))
        .first()
      if (clash) throw new DataError('duplicate', `Violação de unicidade (${rule.name}).`)
    }
  }

  private async checkNoCycle(table: 'topics' | 'study_folders', id: string, parentId: string) {
    let cur: string | null = parentId
    for (let guard = 0; cur && guard < 1000; guard++) {
      if (cur === id) throw new DataError('validation', table === 'topics' ? 'Não é possível mover um tópico para dentro dele mesmo.' : 'Não é possível mover uma pasta para dentro dela mesma.')
      const row: AnyRow | undefined = await this.db.t(table).get(cur)
      cur = (row?.parent_id as string | null) ?? null
    }
  }

  async list<T extends TableName>(table: T, query?: ListQuery): Promise<ListResult<Row<T>>> {
    const rows = (await this.db.t(table).toArray()) as unknown as Row<T>[]
    return applyQuery(rows as unknown as Record<string, unknown>[], query) as unknown as ListResult<Row<T>>
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    return ((await this.db.t(table).get(id)) as unknown as Row<T>) ?? null
  }

  async count(table: TableName, filters: Filter[]): Promise<number> {
    return this.db
      .t(table)
      .filter((r) => filters.every((f) => matchFilter(r, f)))
      .count()
  }

  async insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]> {
    const out: AnyRow[] = []
    await this.db.transaction('rw', this.db.t(table), async () => {
      for (const r of rows) {
        const now = this.now()
        const row = {
          ...(DEFAULTS[table] as object),
          ...(r as object),
          id: (r as { id?: string }).id ?? crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          created_at: now,
          updated_at: now,
        } as AnyRow
        if (await this.db.t(table).get(row.id)) throw new DataError('duplicate', 'Registro já existe.')
        await this.checkUnique(table, row)
        out.push(row)
      }
      await this.db.t(table).bulkAdd(out)
    })
    return out as unknown as Row<T>[]
  }

  async update<T extends TableName>(table: T, filters: Filter[], patch: Patch<T>): Promise<Row<T>[]> {
    const updated: AnyRow[] = []
    await this.db.transaction('rw', this.db.t(table), async () => {
      const targets = await this.db
        .t(table)
        .filter((r) => filters.every((f) => matchFilter(r, f)))
        .toArray()
      for (const t of targets) {
        const next = { ...t, ...(patch as object), id: t.id, user_id: t.user_id, created_at: t.created_at, updated_at: this.now() } as AnyRow
        if (table === 'topics') {
          // Mesmo comportamento do gatilho topics_track_completion.
          if (next.status === 'completed' && t.status !== 'completed') next.completed_at = next.completed_at ?? this.now()
          else if (next.status !== 'completed') next.completed_at = null
        }
        if ((table === 'topics' || table === 'study_folders') && next.parent_id && next.parent_id !== t.parent_id) {
          // Mesmo comportamento dos gatilhos *_no_cycle.
          await this.checkNoCycle(table, next.id, next.parent_id as string)
        }
        await this.checkUnique(table, next)
        await this.db.t(table).put(next)
        updated.push(next)
      }
    })
    return updated as unknown as Row<T>[]
  }

  async remove(table: TableName, filters: Filter[]): Promise<number> {
    let removed = 0
    await this.db.transaction('rw', TABLES.map((t) => this.db.t(t)), async () => {
      const targets = await this.db
        .t(table)
        .filter((r) => filters.every((f) => matchFilter(r, f)))
        .toArray()
      for (const t of targets) {
        await this.cascadeDelete(table, t.id)
        removed++
      }
    })
    return removed
  }

  private async cascadeDelete(table: TableName, id: string): Promise<void> {
    for (const rel of RELATIONS.filter((r) => r.parent === table)) {
      const children = await this.db
        .t(rel.child)
        .filter((r) => r[rel.column] === id)
        .toArray()
      for (const c of children) {
        if (rel.onDelete === 'cascade') await this.cascadeDelete(rel.child, c.id)
        else await this.db.t(rel.child).put({ ...c, [rel.column]: null, updated_at: this.now() })
      }
    }
    await this.db.t(table).delete(id)
  }

  async getProfile(): Promise<Profile> {
    const existing = (await this.db.t('profiles').get(LOCAL_USER_ID)) as unknown as Profile | undefined
    if (existing) return existing
    const now = this.now()
    const p: Profile = { id: LOCAL_USER_ID, display_name: 'Estudante (modo local)', settings: {}, created_at: now, updated_at: now }
    await this.db.t('profiles').put(p as unknown as AnyRow)
    return p
  }

  async updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'settings'>>): Promise<Profile> {
    const current = await this.getProfile()
    const next = { ...current, ...patch, updated_at: this.now() }
    await this.db.t('profiles').put(next as unknown as AnyRow)
    return next
  }

  async listSessions(query?: ListQuery): Promise<SessionWithPauses[]> {
    const { rows } = await this.list('study_sessions', query)
    if (rows.length === 0) return []
    const ids = rows.map((r) => r.id)
    const pauses = await this.db.t('study_session_pauses').where('session_id').anyOf(ids).toArray()
    const bySession = new Map<string, AnyRow[]>()
    for (const p of pauses) {
      const list = bySession.get(p.session_id as string) ?? []
      list.push(p)
      bySession.set(p.session_id as string, list)
    }
    return rows.map((s) => ({ ...s, pauses: (bySession.get(s.id) ?? []) as unknown as SessionWithPauses['pauses'] }))
  }

  async recordFlashcardReview(input: FlashcardReviewInput): Promise<boolean> {
    let applied = false
    await this.db.transaction('rw', [this.db.t('flashcards'), this.db.t('flashcard_reviews')], async () => {
      const card = await this.db.t('flashcards').get(input.cardId)
      if (!card) throw new DataError('not_found', 'Cartão não encontrado.')
      if (await this.db.t('flashcard_reviews').get(input.reviewId)) return
      const now = this.now()
      await this.db.t('flashcard_reviews').add({
        id: input.reviewId,
        user_id: LOCAL_USER_ID,
        card_id: input.cardId,
        rating: input.rating,
        reviewed_at: input.reviewedAt,
        interval_before: card.interval_days,
        interval_after: input.intervalDays,
        ease_after: input.ease,
        created_at: now,
        updated_at: now,
      })
      await this.db.t('flashcards').put({
        ...card,
        status: input.status,
        ease: input.ease,
        interval_days: input.intervalDays,
        repetitions: input.repetitions,
        lapses: input.lapses,
        due_at: input.dueAt,
        last_reviewed_at: input.reviewedAt,
        updated_at: now,
      })
      applied = true
    })
    return applied
  }

  // ── EvoQuest: mesmas regras das RPCs game_* do servidor ──────────────────
  private stamp() {
    const now = this.now()
    return { user_id: LOCAL_USER_ID, created_at: now, updated_at: now }
  }

  async gameStart(i: GameStartInput): Promise<GameSession> {
    const existing = (await this.db.t('game_sessions').get(i.id)) as unknown as GameSession | undefined
    if (existing) return existing
    const row = {
      ...(DEFAULTS.game_sessions as object),
      ...this.stamp(),
      id: i.id,
      subject_id: i.subjectId,
      unit_id: i.unitId,
      mode: i.mode,
      queue: i.queue,
      planned_seconds: i.plannedSeconds,
      started_at: this.now(),
    } as unknown as GameSession
    await this.db.t('game_sessions').add(row as unknown as AnyRow)
    return row
  }

  async gameAnswer(i: GameAnswerInput): Promise<GameAnswerResult> {
    let out: GameAnswerResult | null = null
    await this.db.transaction('rw', [this.db.t('game_sessions'), this.db.t('game_answers'), this.db.t('game_rewards')], async () => {
      const prev = (await this.db.t('game_answers').get(i.id)) as unknown as GameAnswer | undefined
      if (prev) {
        out = { xp: prev.xp, coins: prev.coins, combo: prev.combo, correct: prev.correct, novelty: null, duplicate: true }
        return
      }
      const s = (await this.db.t('game_sessions').get(i.sessionId)) as unknown as GameSession | undefined
      if (!s) throw new DataError('not_found', 'Partida não encontrada')
      if (s.status !== 'active') throw new DataError('validation', 'Partida já encerrada')
      const history = (await this.db.t('game_answers').where('challenge_id').equals(i.challengeId).toArray()) as unknown as GameAnswer[]
      const correctOnes = history.filter((a) => a.correct).sort((a, b) => b.answered_at.localeCompare(a.answered_at))
      const now = Date.now()
      const sessionAnswers = (await this.db.t('game_answers').where('session_id').equals(s.id).toArray()) as unknown as GameAnswer[]
      const lastAt = sessionAnswers.reduce((m, a) => Math.max(m, new Date(a.answered_at).getTime()), new Date(s.started_at).getTime())
      const seconds = Math.min(Math.max(0, Math.round(i.seconds)), Math.max(0, Math.round((now - lastAt) / 1000)), 86400)
      const attempt = sessionAnswers.filter((a) => a.challenge_id === i.challengeId).length + 1
      const score = i.correct ? 1 : Math.min(1, Math.max(0, i.score))
      const r = computeXp({
        difficulty: i.local.difficulty,
        correct: i.correct,
        score,
        usedHint: i.usedHint,
        attempt,
        seconds,
        priorCorrect: correctOnes.length,
        hoursSinceLastCorrect: correctOnes[0] ? (now - new Date(correctOnes[0].answered_at).getTime()) / 3_600_000 : null,
        comboBefore: s.combo,
      })
      const answer = {
        ...this.stamp(),
        id: i.id,
        session_id: s.id,
        challenge_id: i.challengeId,
        challenge_version: i.version,
        subject_id: i.local.subjectId,
        topic: i.topic,
        correct: i.correct,
        score,
        used_hint: i.usedHint,
        attempt: Math.min(attempt, 50),
        seconds,
        xp: r.xp,
        coins: r.coins,
        combo: r.combo,
        answered_at: new Date(now).toISOString(),
      }
      await this.db.t('game_answers').add(answer as unknown as AnyRow)
      if (r.xp > 0 || r.coins > 0)
        await this.db.t('game_rewards').add({ ...this.stamp(), id: crypto.randomUUID(), source: `answer:${i.id}`, kind: 'answer', xp: r.xp, coins: r.coins } as AnyRow)
      await this.db.t('game_sessions').put({
        ...s,
        answered: s.answered + 1,
        correct: s.correct + (i.correct ? 1 : 0),
        xp: s.xp + r.xp,
        coins: s.coins + r.coins,
        combo: r.combo,
        best_combo: Math.max(s.best_combo, r.combo),
        updated_at: this.now(),
      } as unknown as AnyRow)
      out = { xp: r.xp, coins: r.coins, combo: r.combo, correct: i.correct, novelty: r.novelty, duplicate: false }
    })
    return out!
  }

  async gameFinish(i: GameFinishInput): Promise<GameSession> {
    const s = (await this.db.t('game_sessions').get(i.sessionId)) as unknown as GameSession | undefined
    if (!s) throw new DataError('not_found', 'Partida não encontrada')
    if (s.status !== 'active') return s
    const elapsed = Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000)
    const study = i.studySessionId ? await this.db.t('study_sessions').get(i.studySessionId) : null
    const next: GameSession = {
      ...s,
      status: i.status,
      finished_at: this.now(),
      active_seconds: Math.min(Math.max(0, Math.round(i.activeSeconds)), Math.max(0, elapsed), 86400),
      study_session_id: study ? study.id : null,
      updated_at: this.now(),
    }
    await this.db.t('game_sessions').put(next as unknown as AnyRow)
    return next
  }

  async gameClaim(i: GameClaimInput) {
    const rule = ruleByKey(i.rule)
    if (!rule) throw new DataError('validation', 'Regra desconhecida')
    const profile = await this.getProfile()
    const tz = profile.settings.timezone || browserTimeZone()
    const today = dayKey(Date.now(), tz)
    const param = rule.param ? i.param : null
    let range: { from: number; to: number } | null = null
    if (rule.kind !== 'achievement') {
      if (!i.period || i.period > today || i.period < addDays(today, -14)) throw new DataError('validation', 'Período inválido')
      range = { from: zonedDayStart(i.period, tz), to: zonedDayStart(addDays(i.period, rule.kind === 'weekly' ? 7 : 1), tz) }
    }
    const source = claimSource(rule, i.period, param)
    const rewards = (await this.db.t('game_rewards').toArray()) as unknown as Array<{ source: string; kind: string }>
    if (rewards.some((r) => r.source === source)) return { applied: false, xp: 0, coins: 0 }
    const samePeriod = rewards.filter((r) => r.kind === 'mission' && r.source.startsWith(`claim:${rule.kind}:`) && r.source.includes(`:${i.period}`))
    if (rule.kind !== 'achievement' && samePeriod.length >= CLAIMS_PER_PERIOD) throw new DataError('validation', 'Limite de missões do período atingido')
    const { loadSubject, SUBJECTS } = await import('@/game/catalog')
    const contents = await Promise.all(SUBJECTS.map((m) => loadSubject(m.id)))
    const challenges = contents.flatMap((c) => c.units.flatMap((u) => u.challenges))
    const value = computeMetric(
      rule.metric,
      param,
      {
        answers: (await this.db.t('game_answers').toArray()) as unknown as GameAnswer[],
        sessions: (await this.db.t('game_sessions').toArray()) as unknown as GameSession[],
        bossIds: new Set(challenges.filter((c) => c.boss).map((c) => c.id)),
        labIds: new Set(challenges.filter((c) => c.type === 'sql' || c.type === 'python').map((c) => c.id)),
      },
      range,
      tz,
    )
    if (value < rule.target) throw new DataError('validation', `Meta ainda não atingida (${value}/${rule.target})`)
    await this.db.t('game_rewards').add({
      ...this.stamp(),
      id: crypto.randomUUID(),
      source,
      kind: rule.kind === 'achievement' ? 'achievement' : 'mission',
      xp: rule.xp,
      coins: rule.coins,
    } as AnyRow)
    return { applied: true, xp: rule.xp, coins: rule.coins }
  }

  async gameBuy(itemId: string): Promise<boolean> {
    const item = shopItem(itemId)
    if (!item) throw new DataError('validation', 'Item desconhecido')
    let bought = false
    await this.db.transaction('rw', [this.db.t('game_purchases'), this.db.t('game_rewards')], async () => {
      if (await this.db.t('game_purchases').where('item_id').equals(itemId).first()) return
      const rewards = (await this.db.t('game_rewards').toArray()) as unknown as Array<{ coins: number }>
      if (rewards.reduce((s, r) => s + r.coins, 0) < item.price) throw new DataError('validation', 'Moedas insuficientes')
      await this.db.t('game_purchases').add({ ...this.stamp(), id: crypto.randomUUID(), item_id: itemId, price: item.price } as AnyRow)
      await this.db.t('game_rewards').add({ ...this.stamp(), id: crypto.randomUUID(), source: `buy:${itemId}`, kind: 'purchase', xp: 0, coins: -item.price } as AnyRow)
      bought = true
    })
    return bought
  }

  async gameBuyTicket(city: string): Promise<{ bought: boolean; price: number }> {
    // Mesmas regras da RPC game_buy_ticket.
    const { cityById, ticketId, cityOfTicket } = await import('@/features/evoquest/content/cities')
    const c = cityById(city)
    if (!c) throw new DataError('validation', 'Cidade desconhecida')
    if (!(await this.db.t('game_quest_progress').where('step_key').equals('tutorial:report').first())) throw new DataError('validation', 'A Rodoviária ainda não está liberada')
    const id = ticketId(city)
    let out = { bought: false, price: 0 }
    await this.db.transaction('rw', [this.db.t('game_purchases'), this.db.t('game_rewards')], async () => {
      const owned = (await this.db.t('game_purchases').toArray()) as unknown as Array<{ item_id: string }>
      if (owned.some((p) => p.item_id === id)) return
      const price = owned.some((p) => cityOfTicket(p.item_id)) ? c.price : 0
      if (price > 0) {
        const rewards = (await this.db.t('game_rewards').toArray()) as unknown as Array<{ coins: number }>
        if (rewards.reduce((s, r) => s + r.coins, 0) < price) throw new DataError('validation', 'Moedas insuficientes')
      }
      await this.db.t('game_purchases').add({ ...this.stamp(), id: crypto.randomUUID(), item_id: id, price } as AnyRow)
      if (price > 0) await this.db.t('game_rewards').add({ ...this.stamp(), id: crypto.randomUUID(), source: `buy:${id}`, kind: 'purchase', xp: 0, coins: -price } as AnyRow)
      out = { bought: true, price }
    })
    return out
  }

  async gameTotals(): Promise<{ xp: number; coins: number }> {
    const rows = (await this.db.t('game_rewards').toArray()) as unknown as Array<{ xp: number; coins: number }>
    return { xp: rows.reduce((s, r) => s + r.xp, 0), coins: rows.reduce((s, r) => s + r.coins, 0) }
  }

  async gameCompleteStep(step: string, answer: string | null): Promise<{ applied: boolean; xp: number; coins: number }> {
    // Mesmas regras da RPC game_complete_step, com o catálogo do conteúdo.
    const { questCatalogRows } = await import('@/features/evoquest/catalogSql')
    const { sha256 } = await import('@/features/evoquest/challenges')
    const c = questCatalogRows().find((r) => r.key === step)
    if (!c) throw new DataError('validation', 'Etapa desconhecida')
    const done = async (k: string) => Boolean(await this.db.t('game_quest_progress').where('step_key').equals(k).first())
    if (await done(step)) return { applied: false, xp: 0, coins: 0 }
    if (c.requires && !(await done(c.requires))) throw new DataError('validation', 'Etapa anterior não concluída')
    if (c.hash && (answer == null || (await sha256(answer)) !== c.hash)) throw new DataError('validation', 'Resposta não confere')
    if (c.answer) {
      const hits = (await this.db.t('game_answers').where('challenge_id').equals(c.answer).toArray()) as unknown as Array<{ correct: boolean }>
      if (!hits.some((a) => a.correct)) throw new DataError('validation', 'Desafio ainda não vencido')
    }
    await this.db.transaction('rw', this.db.t('game_quest_progress'), this.db.t('game_rewards'), async () => {
      await this.db.t('game_quest_progress').add({ ...this.stamp(), id: crypto.randomUUID(), step_key: step, completed_at: this.now() } as AnyRow)
      if (c.xp > 0 || c.coins > 0) await this.db.t('game_rewards').add({ ...this.stamp(), id: crypto.randomUUID(), source: `quest:${step}`, kind: 'mission', xp: c.xp, coins: c.coins } as AnyRow)
    })
    return { applied: true, xp: c.xp, coins: c.coins }
  }

  async resetAllData(): Promise<void> {
    await this.db.transaction('rw', TABLES.map((t) => this.db.t(t)), async () => {
      for (const t of TABLES) await this.db.t(t).clear()
    })
  }

  /** No modo local não há conta: equivale a apagar tudo deste navegador. */
  async deleteAccount(): Promise<void> {
    await this.wipe()
  }

  /** Apaga o banco local inteiro. */
  async wipe(): Promise<void> {
    await this.db.delete()
    this.db = new LocalDb(this.db.name)
  }
}
