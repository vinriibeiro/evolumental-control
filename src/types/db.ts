// Modelo de dados compartilhado pelo backend Supabase e pelo modo local.
// Os nomes de colunas espelham supabase/migrations/*.sql.

export type UUID = string
export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // ISO 8601 em UTC

export type SubjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type TopicStatus = 'not_started' | 'in_progress' | 'completed' | 'reviewing'
export type ActivityType =
  | 'theory'
  | 'questions'
  | 'review'
  | 'video'
  | 'reading'
  | 'flashcards'
  | 'mock_exam'
  | 'other'
export type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro' | 'intervals' | 'manual'
export type SessionStatus = 'active' | 'pending_review' | 'completed' | 'cancelled'
export type PauseKind = 'pause' | 'break'
export type PlanItemStatus = 'pending' | 'done' | 'partial' | 'missed' | 'rescheduled'
export type CycleStatus = 'active' | 'paused' | 'archived'
export type ReviewStatus = 'planned' | 'done' | 'postponed' | 'cancelled'
export type CardStatus = 'new' | 'learning' | 'review' | 'suspended'
export type GoalMetric =
  | 'study_hours'
  | 'sessions'
  | 'questions'
  | 'accuracy'
  | 'topics_completed'
  | 'flashcards_reviewed'
  | 'study_days'
export type GoalPeriod = 'daily' | 'weekly' | 'monthly'
export type GoalStatus = 'active' | 'paused' | 'superseded' | 'archived'
export type TaskKind = 'task' | 'deadline' | 'exam' | 'other'

interface Owned {
  id: UUID
  user_id: UUID
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface Profile {
  id: UUID
  display_name: string | null
  settings: Partial<UserSettings>
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface SrsParams {
  initialEase: number
  minEase: number
  hardFactor: number
  easyBonus: number
  /** Intervalos (dias) após a 1ª e 2ª resposta "Bom". */
  firstInterval: number
  secondInterval: number
  /** Minutos até rever um cartão errado/novo em aprendizado. */
  relearnMinutes: number
  maxIntervalDays: number
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  sound: boolean
  voiceURI: string | null
  speechRate: number
  autoRead: boolean
  dailyGoalMinutes: number
  weeklyGoalMinutes: number
  timezone: string
  hourFormat: '24h' | '12h'
  pomodoro: { focus: number; shortBreak: number; longBreak: number; rounds: number }
  autoReviews: boolean
  reviewIntervals: number[]
  srs: SrsParams
  /** Bloco de notas rápido do "Meu espaço de estudos". */
  scratchpad?: string
  evoquest?: EvoQuestSettings
  /** Visualização preferida do Explorador de Estudos. */
  explorerView?: 'tree' | 'list' | 'cards'
}

export interface EvoQuestSettings {
  /** Disciplina do jogo → matéria do planejamento (para registrar o tempo). */
  links: Record<string, UUID | null>
  /** Registrar o tempo jogado como sessão de estudo. */
  registerTime: boolean
  dailyMinutes: number
  sound: boolean
  avatar: string | null
  title: string | null
  reducedMotion: boolean
}

/** Área de estudo (raiz) ou pasta do Explorador. */
export interface StudyFolder extends Owned {
  parent_id: UUID | null
  kind: 'area' | 'folder'
  name: string
  color: string | null
  icon: string | null
  sort_order: number
  favorite: boolean
  archived_at: ISODateTime | null
}

export interface Subject extends Owned {
  /** Pasta/área do Explorador (null = raiz). */
  folder_id: UUID | null
  favorite: boolean
  name: string
  description: string | null
  color: string
  icon: string | null
  priority: number // 1..5
  difficulty: number // 1..5
  weekly_goal_hours: number | null
  start_date: ISODate | null
  target_date: ISODate | null
  notes: string | null
  status: SubjectStatus
  exam: string | null
  sort_order: number
  archived_at: ISODateTime | null
}

export type TopicKind = 'topic' | 'folder'

export interface Topic extends Owned {
  subject_id: UUID
  parent_id: UUID | null
  /** 'folder' organiza tópicos dentro da matéria e não entra no progresso. */
  kind: TopicKind
  favorite: boolean
  name: string
  description: string | null
  sort_order: number
  status: TopicStatus
  mastery: number // 0..5
  priority: number // 1..5
  weight: number // relevância no edital
  estimated_minutes: number | null
  notes: string | null
  completed_at: ISODateTime | null
}

export interface StudyMaterial extends Owned {
  subject_id: UUID | null
  topic_id: UUID | null
  title: string
  url: string | null
  notes: string | null
}

export interface TimerPhase {
  kind: 'focus' | 'break'
  seconds: number
  label?: string
}

export interface TimerConfig {
  phases: TimerPhase[]
  repeat: boolean
  /** Para o modo pomodoro: a cada N focos, pausa longa. */
  pomodoro?: { focus: number; shortBreak: number; longBreak: number; rounds: number }
}

export interface TimerState {
  phaseIndex: number
  /** Instante (ms) em que a fase atual começou, em relógio de parede. */
  phaseStartedAt: number
  /** Tempo líquido acumulado (s) quando a fase atual de foco começou. */
  phaseNetStart: number
  /** Índice da última fase cujo alerta já foi reconhecido. */
  ackPhase: number
}

export interface StudySession extends Owned {
  subject_id: UUID | null
  topic_id: UUID | null
  activity_type: ActivityType
  mode: TimerMode
  status: SessionStatus
  started_at: ISODateTime
  ended_at: ISODateTime | null
  planned_seconds: number | null
  adjustment_seconds: number
  timer_config: TimerConfig | null
  timer_state: TimerState | null
  notes: string | null
  plan_item_id: UUID | null
  cycle_id: UUID | null
  cycle_item_id: UUID | null
}

export interface StudySessionPause {
  id: UUID
  user_id: UUID
  session_id: UUID
  kind: PauseKind
  started_at: ISODateTime
  ended_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface TimeWindow {
  start: string // 'HH:MM'
  end: string
}

export interface PlanConfig {
  /** 0 = domingo … 6 = sábado */
  availability: Record<number, TimeWindow[]>
  commitments: Record<number, TimeWindow[]>
  blockMinutes: number
  breakMinutes: number
  weeklyHoursGoal: number | null
  dailyHoursGoal: number | null
  subjectIds: UUID[]
  /** Matérias cujas atividades pedem maior frequência (peso extra). */
  frequentSubjectIds: UUID[]
  activityType: ActivityType
}

export interface StudyPlan extends Owned {
  name: string
  description: string | null
  start_date: ISODate
  end_date: ISODate
  config: PlanConfig
  status: 'active' | 'archived'
}

export interface StudyPlanItem extends Owned {
  plan_id: UUID
  date: ISODate
  start_time: string // 'HH:MM'
  duration_minutes: number
  subject_id: UUID | null
  topic_id: UUID | null
  activity_type: ActivityType
  status: PlanItemStatus
  notes: string | null
}

export interface StudyCycle extends Owned {
  name: string
  description: string | null
  status: CycleStatus
  current_index: number
  current_progress_seconds: number
  completed_rounds: number
  auto_advance: boolean
}

export interface StudyCycleItem extends Owned {
  cycle_id: UUID
  subject_id: UUID
  topic_id: UUID | null
  duration_minutes: number
  sort_order: number
  weight: number
  break_minutes: number
  activity_type: ActivityType
}

export interface CalendarTask extends Owned {
  title: string
  description: string | null
  date: ISODate
  start_time: string | null
  duration_minutes: number | null
  subject_id: UUID | null
  topic_id: UUID | null
  kind: TaskKind
  done: boolean
}

export interface Review extends Owned {
  subject_id: UUID | null
  topic_id: UUID | null
  title: string
  scheduled_for: ISODate
  status: ReviewStatus
  done_at: ISODateTime | null
  session_id: UUID | null
  notes: string | null
  origin: 'manual' | 'auto'
}

export interface FlashcardDeck extends Owned {
  name: string
  description: string | null
  folder: string | null
  subject_id: UUID | null
  topic_id: UUID | null
  archived: boolean
}

export interface Flashcard extends Owned {
  deck_id: UUID
  subject_id: UUID | null
  topic_id: UUID | null
  front: string
  back: string
  note: string | null
  tags: string[]
  status: CardStatus
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: ISODateTime
  last_reviewed_at: ISODateTime | null
}

export interface FlashcardReview {
  id: UUID
  user_id: UUID
  card_id: UUID
  rating: 1 | 2 | 3 | 4
  reviewed_at: ISODateTime
  interval_before: number
  interval_after: number
  ease_after: number
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface MindMapData {
  nodes: Array<{
    id: string
    position: { x: number; y: number }
    data: { label: string; color?: string; size?: 'sm' | 'md' | 'lg'; shape?: 'rounded' | 'pill' | 'rect' }
    type?: string
  }>
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>
  viewport?: { x: number; y: number; zoom: number }
}

export interface MindMap extends Owned {
  title: string
  description: string | null
  folder: string | null
  subject_id: UUID | null
  topic_id: UUID | null
  data: MindMapData
}

export interface StudyGoal extends Owned {
  title: string | null
  metric: GoalMetric
  period: GoalPeriod
  target: number
  subject_id: UUID | null
  status: GoalStatus
  start_date: ISODate
  end_date: ISODate | null
  previous_goal_id: UUID | null
}

export interface QuestionRecord extends Owned {
  subject_id: UUID | null
  topic_id: UUID | null
  date: ISODate
  total: number
  correct: number
  wrong: number
  board: string | null
  exam: string | null
  source: string | null
  notes: string | null
}

// ── EvoQuest ──────────────────────────────────────────────────────────────
export type GameMode = 'quick' | 'trail' | 'review' | 'time_attack' | 'boss' | 'lab' | 'cards'
export type GameSessionStatus = 'active' | 'finished' | 'abandoned'

export interface GameSession extends Owned {
  subject_id: string
  unit_id: string | null
  mode: GameMode
  status: GameSessionStatus
  /** Fila planejada de desafios (permite retomar a partida). */
  queue: string[]
  planned_seconds: number | null
  started_at: ISODateTime
  finished_at: ISODateTime | null
  answered: number
  correct: number
  xp: number
  coins: number
  combo: number
  best_combo: number
  active_seconds: number
  study_session_id: UUID | null
}

export interface GameAnswer extends Owned {
  session_id: UUID
  challenge_id: string
  challenge_version: number
  subject_id: string
  topic: string
  correct: boolean
  score: number
  used_hint: boolean
  attempt: number
  seconds: number
  xp: number
  coins: number
  combo: number
  answered_at: ISODateTime
}

/** Livro-razão de recompensas: saldo = soma das linhas. Único por (usuário, origem). */
export interface GameReward extends Owned {
  source: string
  kind: 'answer' | 'mission' | 'achievement' | 'purchase'
  xp: number
  coins: number
}

export interface GamePurchase extends Owned {
  item_id: string
  price: number
}

/** Etapa de missão do RPG confirmada pelo servidor (gravada só pela RPC). */
export interface GameQuestProgress extends Owned {
  step_key: string
  completed_at: ISODateTime
}

/** Salvamento do mundo do RPG (posição, inventário, escolhas). */
export interface GameSave extends Owned {
  slot: string
  data: Record<string, unknown>
}

export interface Tables {
  profiles: Profile
  study_folders: StudyFolder
  subjects: Subject
  topics: Topic
  study_materials: StudyMaterial
  study_sessions: StudySession
  study_session_pauses: StudySessionPause
  study_plans: StudyPlan
  study_plan_items: StudyPlanItem
  study_cycles: StudyCycle
  study_cycle_items: StudyCycleItem
  calendar_tasks: CalendarTask
  reviews: Review
  flashcard_decks: FlashcardDeck
  flashcards: Flashcard
  flashcard_reviews: FlashcardReview
  mind_maps: MindMap
  study_goals: StudyGoal
  question_records: QuestionRecord
  game_sessions: GameSession
  game_answers: GameAnswer
  game_rewards: GameReward
  game_purchases: GamePurchase
  game_quest_progress: GameQuestProgress
  game_saves: GameSave
}

export type TableName = keyof Tables
export type Row<T extends TableName> = Tables[T]
/**
 * Linha a inserir: o backend preenche proprietário, carimbos de data e
 * valores padrão (DEFAULTS). Campos obrigatórios são validados pelos
 * esquemas zod e pelas restrições do banco.
 */
export type Insert<T extends TableName> = Partial<Omit<Row<T>, 'user_id' | 'created_at' | 'updated_at'>>
export type Patch<T extends TableName> = Partial<Omit<Row<T>, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
