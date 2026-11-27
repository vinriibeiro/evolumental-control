// Backend do MODO LOCAL (desenvolvimento / uso em um único navegador).
// Os dados ficam no IndexedDB deste navegador: não há login real nem
// sincronização com a nuvem. A interface informa isso ao usuário.
// Reproduz as regras relevantes do PostgreSQL: padrões, restrições únicas
// parciais, exclusão em cascata/SET NULL e a RPC de revisão de flashcards.
import Dexie, { type Table } from 'dexie'
import type { Insert, Patch, Profile, Row, TableName } from '@/types/db'
import { DEFAULTS, RELATIONS, RESET_TABLES, TABLES, UNIQUE_RULES } from './schema'
import { DataError, type DataBackend, type Filter, type FlashcardReviewInput, type ListQuery, type ListResult, type MoveNotebookNodeInput, type SessionWithPauses } from './types'

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001'

type AnyRow = Record<string, unknown> & { id: string }

const INDEXES: Record<TableName, string> = {
  profiles: 'id',
  subjects: 'id, status',
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
  course_sources: 'id',
  course_nodes: 'id, source_id, parent_id, drive_id',
  course_progress: 'id, drive_id',
  inbox_items: 'id',
  projects: 'id, status',
  assessments: 'id, track, taken_at',
  notebooks: 'id, subject_id, is_favorite, archived_at, deleted_at, updated_at',
  notebook_nodes: 'id, notebook_id, parent_id, node_type, deleted_at, updated_at, last_studied_at',
  notebook_page_contents: 'id, node_id',
  notebook_page_versions: 'id, node_id, created_at',
  notebook_tags: 'id, name',
  notebook_tag_links: 'id, tag_id, notebook_id, node_id',
  notebook_page_links: 'id, source_node_id, target_node_id',
  notebook_flashcard_links: 'id, flashcard_id, notebook_id, node_id',
  notebook_templates: 'id, category',
  notebook_resource_links: 'id, notebook_id, node_id, resource_kind, resource_id',
  notebook_attachments: 'id, notebook_id, node_id',
}

/** Tabelas criadas no VLM Knowledge (Meus Cadernos, v4). */
const V4_TABLES = [
  'notebooks',
  'notebook_nodes',
  'notebook_page_contents',
  'notebook_page_versions',
  'notebook_tags',
  'notebook_tag_links',
  'notebook_page_links',
  'notebook_flashcard_links',
  'notebook_templates',
  'notebook_resource_links',
  'notebook_attachments',
]
/** Tabelas da versão 3 do banco local (antes de Meus Cadernos). */
const INDEXES_V3 = Object.fromEntries(Object.entries(INDEXES).filter(([t]) => !V4_TABLES.includes(t)))
/** Tabelas criadas na 2.0 (caixa de entrada, projetos e diagnósticos). */
const V3_TABLES = ['inbox_items', 'projects', 'assessments']
/** Tabelas da versão 2 do banco local (antes da 2.0). */
const INDEXES_V2 = Object.fromEntries(Object.entries(INDEXES_V3).filter(([t]) => !V3_TABLES.includes(t)))
/** Tabelas da versão 1 do banco local (antes de Cursos). */
const INDEXES_V1 = Object.fromEntries(Object.entries(INDEXES_V2).filter(([t]) => !t.startsWith('course_')))

/** Colunas novas da 2.0 nas tabelas que já existiam: as linhas antigas recebem o valor padrão, sem perder nada. */
const V3_COLUMNS: Partial<Record<TableName, string[]>> = {
  subjects: ['trail_key'],
  topics: ['trail_key', 'knowledge', 'practiced_at'],
  study_sessions: ['task_id', 'project_id', 'source'],
  calendar_tasks: ['category', 'priority', 'fixed', 'due_date', 'series_id', 'recurrence', 'done_at', 'origin_key', 'project_id'],
  study_goals: ['kind', 'checklist', 'due_date', 'done_at'],
}

class LocalDb extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(1).stores(INDEXES_V1)
    // v2: cursos e materiais do Google Drive (tabelas novas; as existentes não mudam)
    this.version(2).stores(INDEXES_V2)
    // v3 (VLM Control 2.0): tabelas novas e colunas novas com valor padrão nas linhas que já existiam
    this.version(3)
      .stores(INDEXES_V3)
      .upgrade(async (tx) => {
        for (const [table, columns] of Object.entries(V3_COLUMNS)) {
          const defaults = DEFAULTS[table as TableName] as Record<string, unknown>
          await tx
            .table(table)
            .toCollection()
            .modify((row: Record<string, unknown>) => {
              for (const c of columns) if (row[c] === undefined) row[c] = defaults[c] ?? null
            })
        }
      })
    // v4 (VLM Knowledge — Meus Cadernos): tabelas novas aditivas, preservando todos os dados existentes
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
      const rowKey = rule.key?.(row)
      const clash = await this.db
        .t(table)
        .filter((r) => {
          if (r.id === row.id || !rule.where(r)) return false
          if (rule.key) return rule.key(r) === rowKey
          return rule.columns.every((c) => r[c] === row[c])
        })
        .first()
      if (clash) throw new DataError('duplicate', `Violação de unicidade (${rule.name}).`)
    }
  }

  private async validateNotebookNode(row: AnyRow, pendingById?: Map<string, AnyRow>) {
    const parentId = row.parent_id as string | null
    if (!parentId) return
    if (parentId === row.id) throw new DataError('validation', 'Um item não pode ser pai de si mesmo.')
    const lookup = async (id: string): Promise<AnyRow | undefined> => pendingById?.get(id) ?? (await this.db.t('notebook_nodes').get(id))
    const parent = await lookup(parentId)
    if (!parent) throw new DataError('validation', 'Nó pai inexistente.')
    if (parent.notebook_id !== row.notebook_id) throw new DataError('validation', 'O nó pai precisa pertencer ao mesmo caderno.')
    let cur: AnyRow | undefined = parent
    let guard = 0
    while (cur && cur.parent_id && guard++ < 256) {
      if (cur.parent_id === row.id) throw new DataError('validation', 'Hierarquia inválida: ciclo detectado em notebook_nodes.')
      cur = await lookup(cur.parent_id as string)
    }
    if (guard >= 256) throw new DataError('validation', 'Hierarquia inválida: profundidade máxima excedida.')
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
      const pending = new Map<string, AnyRow>()
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
        if (pending.has(row.id) || (await this.db.t(table).get(row.id))) throw new DataError('duplicate', 'Registro já existe.')
        await this.checkUnique(table, row)
        if (table === 'notebook_nodes') await this.validateNotebookNode(row, pending)
        pending.set(row.id, row)
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
        await this.checkUnique(table, next)
        if (table === 'notebook_nodes') await this.validateNotebookNode(next)
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

  async moveNotebookNode(input: MoveNotebookNodeInput): Promise<number> {
    let moved = 0
    await this.db.transaction('rw', [this.db.t('notebooks'), this.db.t('notebook_nodes')], async () => {
      const node = await this.db.t('notebook_nodes').get(input.nodeId)
      if (!node) throw new DataError('not_found', 'Nó não encontrado.')
      const targetNb = await this.db.t('notebooks').get(input.targetNotebookId)
      if (!targetNb) throw new DataError('not_found', 'Caderno de destino não encontrado.')

      const allNodes = await this.db.t('notebook_nodes').toArray()
      const childrenByParent = new Map<string, AnyRow[]>()
      for (const n of allNodes) {
        if (n.parent_id) {
          const list = childrenByParent.get(n.parent_id as string) ?? []
          list.push(n)
          childrenByParent.set(n.parent_id as string, list)
        }
      }
      const subtree: AnyRow[] = [node]
      const subtreeIds = new Set<string>([node.id])
      const stack = [node.id]
      while (stack.length) {
        const cur = stack.pop()!
        for (const c of childrenByParent.get(cur) ?? []) {
          if (!subtreeIds.has(c.id)) {
            subtreeIds.add(c.id)
            subtree.push(c)
            stack.push(c.id)
          }
        }
      }

      if (input.targetParentId != null) {
        if (subtreeIds.has(input.targetParentId)) {
          throw new DataError('validation', 'Não é possível mover um item para dentro dele mesmo ou de um descendente.')
        }
        const parent = allNodes.find((n) => n.id === input.targetParentId)
        if (!parent || parent.notebook_id !== input.targetNotebookId) {
          throw new DataError('validation', 'Nó pai de destino inválido para este caderno.')
        }
      }

      const siblings = allNodes.filter(
        (n) =>
          n.notebook_id === input.targetNotebookId &&
          (n.parent_id ?? null) === input.targetParentId &&
          n.deleted_at == null &&
          n.id !== node.id,
      )
      const pos =
        input.position != null
          ? Math.max(0, Math.round(input.position))
          : siblings.reduce((m, s) => Math.max(m, Number(s.position ?? 0)), -1) + 1

      const now = this.now()
      const updatedRows = subtree.map((n) => ({
        ...n,
        notebook_id: input.targetNotebookId,
        parent_id: n.id === node.id ? input.targetParentId : n.parent_id,
        position: n.id === node.id ? pos : n.position,
        updated_at: now,
      }))
      await this.db.t('notebook_nodes').bulkPut(updatedRows)
      moved = updatedRows.length
    })
    return moved
  }

  /** Zera o progresso (sessões, agenda, ciclos, revisões, metas, preferências e status dos tópicos); o conteúdo fica. */
  async resetAllData(): Promise<void> {
    const tables: TableName[] = [...RESET_TABLES, 'topics']
    await this.db.transaction('rw', tables.map((t) => this.db.t(t)), async () => {
      for (const t of RESET_TABLES) await this.db.t(t).clear()
      await this.db
        .t('topics')
        .toCollection()
        .modify((r: AnyRow) => {
          r.status = 'not_started'
          r.mastery = 0
          r.completed_at = null
          r.knowledge = null
          r.practiced_at = null
          r.updated_at = this.now()
        })
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
