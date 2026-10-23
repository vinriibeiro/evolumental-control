// Metadados do esquema compartilhados pelos backends. RELATIONS espelha as
// chaves estrangeiras da migração SQL: o modo local usa estas regras para
// reproduzir as exclusões em cascata/SET NULL do PostgreSQL, e a interface
// usa para avisar o usuário sobre registros afetados antes de excluir.
import type { TableName, Tables } from '@/types/db'
import { DEFAULT_SRS } from '@/lib/srs'

export interface Relation {
  child: TableName
  column: string
  parent: TableName
  onDelete: 'cascade' | 'set null'
}

export const RELATIONS: Relation[] = [
  { child: 'study_folders', column: 'parent_id', parent: 'study_folders', onDelete: 'cascade' },
  { child: 'subjects', column: 'folder_id', parent: 'study_folders', onDelete: 'set null' },
  { child: 'topics', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'topics', column: 'parent_id', parent: 'topics', onDelete: 'cascade' },
  { child: 'study_materials', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'study_materials', column: 'topic_id', parent: 'topics', onDelete: 'cascade' },
  { child: 'study_plan_items', column: 'plan_id', parent: 'study_plans', onDelete: 'cascade' },
  { child: 'study_plan_items', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'study_plan_items', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'study_cycle_items', column: 'cycle_id', parent: 'study_cycles', onDelete: 'cascade' },
  { child: 'study_cycle_items', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'study_cycle_items', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'study_sessions', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'study_sessions', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'study_sessions', column: 'plan_item_id', parent: 'study_plan_items', onDelete: 'set null' },
  { child: 'study_sessions', column: 'cycle_id', parent: 'study_cycles', onDelete: 'set null' },
  { child: 'study_sessions', column: 'cycle_item_id', parent: 'study_cycle_items', onDelete: 'set null' },
  { child: 'study_session_pauses', column: 'session_id', parent: 'study_sessions', onDelete: 'cascade' },
  { child: 'calendar_tasks', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'calendar_tasks', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'reviews', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'reviews', column: 'topic_id', parent: 'topics', onDelete: 'cascade' },
  { child: 'reviews', column: 'session_id', parent: 'study_sessions', onDelete: 'set null' },
  { child: 'study_goals', column: 'subject_id', parent: 'subjects', onDelete: 'cascade' },
  { child: 'study_goals', column: 'previous_goal_id', parent: 'study_goals', onDelete: 'set null' },
  { child: 'question_records', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'question_records', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'question_errors', column: 'record_id', parent: 'question_records', onDelete: 'cascade' },
  { child: 'flashcard_decks', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'flashcard_decks', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'flashcards', column: 'deck_id', parent: 'flashcard_decks', onDelete: 'cascade' },
  { child: 'flashcards', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'flashcards', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'flashcard_reviews', column: 'card_id', parent: 'flashcards', onDelete: 'cascade' },
  { child: 'mind_maps', column: 'subject_id', parent: 'subjects', onDelete: 'set null' },
  { child: 'mind_maps', column: 'topic_id', parent: 'topics', onDelete: 'set null' },
  { child: 'game_answers', column: 'session_id', parent: 'game_sessions', onDelete: 'cascade' },
  { child: 'game_sessions', column: 'study_session_id', parent: 'study_sessions', onDelete: 'set null' },
]

export const TABLES: TableName[] = [
  'profiles',
  'study_folders',
  'subjects',
  'topics',
  'study_materials',
  'study_sessions',
  'study_session_pauses',
  'study_plans',
  'study_plan_items',
  'study_cycles',
  'study_cycle_items',
  'calendar_tasks',
  'reviews',
  'flashcard_decks',
  'flashcards',
  'flashcard_reviews',
  'mind_maps',
  'study_goals',
  'question_records',
  'question_errors',
  'game_sessions',
  'game_answers',
  'game_rewards',
  'game_purchases',
  'game_quest_progress',
  'game_saves',
]

/** Tabelas afetadas (recursivamente) quando uma linha de `table` é excluída. */
export function affectedTables(table: TableName): TableName[] {
  const out = new Set<TableName>([table])
  const queue: TableName[] = [table]
  while (queue.length) {
    const t = queue.shift()!
    for (const r of RELATIONS) {
      if (r.parent === t && !out.has(r.child)) {
        out.add(r.child)
        queue.push(r.child)
      }
    }
  }
  return [...out]
}

/** Restrições únicas parciais do SQL, reproduzidas no modo local. */
export const UNIQUE_RULES: Partial<Record<TableName, Array<{ name: string; columns: string[]; where: (row: Record<string, unknown>) => boolean }>>> = {
  study_sessions: [
    { name: 'study_sessions_one_live', columns: ['user_id'], where: (r) => r.status === 'active' || r.status === 'pending_review' },
  ],
  study_session_pauses: [{ name: 'study_session_pauses_one_open', columns: ['session_id'], where: (r) => r.ended_at == null }],
  study_cycles: [{ name: 'study_cycles_one_active', columns: ['user_id'], where: (r) => r.status === 'active' }],
}

type Defaults = { [K in TableName]: Partial<Tables[K]> }

/** Valores padrão das colunas (equivalentes aos DEFAULT do SQL). */
export const DEFAULTS: Defaults = {
  profiles: { display_name: null, settings: {} },
  study_folders: { parent_id: null, kind: 'folder', color: null, icon: null, sort_order: 0, favorite: false, archived_at: null },
  subjects: {
    folder_id: null,
    favorite: false,
    description: null,
    color: '#DEB887',
    icon: null,
    priority: 3,
    difficulty: 3,
    weekly_goal_hours: null,
    start_date: null,
    target_date: null,
    notes: null,
    status: 'active',
    exam: null,
    sort_order: 0,
    archived_at: null,
  },
  topics: {
    parent_id: null,
    kind: 'topic',
    favorite: false,
    description: null,
    sort_order: 0,
    status: 'not_started',
    mastery: 0,
    priority: 3,
    weight: 1,
    estimated_minutes: null,
    notes: null,
    completed_at: null,
  },
  study_materials: { subject_id: null, topic_id: null, url: null, notes: null },
  study_sessions: {
    subject_id: null,
    topic_id: null,
    activity_type: 'theory',
    mode: 'stopwatch',
    status: 'active',
    ended_at: null,
    planned_seconds: null,
    adjustment_seconds: 0,
    timer_config: null,
    timer_state: null,
    notes: null,
    plan_item_id: null,
    cycle_id: null,
    cycle_item_id: null,
  },
  study_session_pauses: { kind: 'pause', ended_at: null },
  study_plans: { description: null, status: 'active' },
  study_plan_items: { subject_id: null, topic_id: null, activity_type: 'theory', status: 'pending', notes: null },
  study_cycles: { description: null, status: 'paused', current_index: 0, current_progress_seconds: 0, completed_rounds: 0, auto_advance: true },
  study_cycle_items: { topic_id: null, sort_order: 0, weight: 1, break_minutes: 0, activity_type: 'theory' },
  calendar_tasks: { description: null, start_time: null, duration_minutes: null, subject_id: null, topic_id: null, kind: 'task', done: false },
  reviews: { subject_id: null, topic_id: null, status: 'planned', done_at: null, session_id: null, notes: null, origin: 'manual' },
  flashcard_decks: { description: null, folder: null, subject_id: null, topic_id: null, archived: false },
  flashcards: {
    subject_id: null,
    topic_id: null,
    note: null,
    tags: [],
    status: 'new',
    ease: DEFAULT_SRS.initialEase,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    last_reviewed_at: null,
  },
  flashcard_reviews: { interval_before: 0, interval_after: 0 },
  mind_maps: { description: null, folder: null, subject_id: null, topic_id: null, data: { nodes: [], edges: [] } },
  study_goals: { title: null, subject_id: null, status: 'active', end_date: null, previous_goal_id: null },
  question_records: { subject_id: null, topic_id: null, board: null, exam: null, source: null, notes: null },
  question_errors: { count: 1, note: null, resolved: false, resolved_at: null },
  game_sessions: {
    unit_id: null,
    status: 'active',
    queue: [],
    planned_seconds: null,
    finished_at: null,
    answered: 0,
    correct: 0,
    xp: 0,
    coins: 0,
    combo: 0,
    best_combo: 0,
    active_seconds: 0,
    study_session_id: null,
  },
  game_answers: { challenge_version: 1, score: 0, used_hint: false, attempt: 1, xp: 0, coins: 0, combo: 0 },
  game_rewards: { xp: 0, coins: 0 },
  game_purchases: {},
  game_quest_progress: {},
  game_saves: { slot: 'main', data: {} },
}

export const TABLE_LABELS: Record<TableName, string> = {
  profiles: 'perfis',
  study_folders: 'pastas',
  subjects: 'matérias',
  topics: 'tópicos',
  study_materials: 'materiais',
  study_sessions: 'sessões de estudo',
  study_session_pauses: 'pausas',
  study_plans: 'cronogramas',
  study_plan_items: 'blocos de cronograma',
  study_cycles: 'ciclos',
  study_cycle_items: 'blocos de ciclo',
  calendar_tasks: 'tarefas',
  reviews: 'revisões',
  flashcard_decks: 'baralhos',
  flashcards: 'flashcards',
  flashcard_reviews: 'respostas de revisão',
  mind_maps: 'mapas mentais',
  study_goals: 'metas',
  question_records: 'registros de questões',
  question_errors: 'erros classificados',
  game_sessions: 'partidas do EvoQuest',
  game_answers: 'respostas do EvoQuest',
  game_rewards: 'recompensas do EvoQuest',
  game_purchases: 'itens do EvoQuest',
  game_quest_progress: 'etapas de missões do EvoQuest',
  game_saves: 'salvamentos do EvoQuest',
}
