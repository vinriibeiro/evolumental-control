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
  | 'projects_completed'
export type GoalPeriod = 'daily' | 'weekly' | 'monthly'
export type GoalStatus = 'active' | 'paused' | 'superseded' | 'archived'
export type TaskKind = 'task' | 'deadline' | 'exam' | 'other'
/** Meta por número (horas, sessões, questões…) ou por entregas (lista de itens a concluir até uma data). */
export type GoalKind = 'metric' | 'deliverable'
/** Como o conhecimento de um tópico foi evidenciado: declarado por mim ou demonstrado numa avaliação. Nunca vem só do tempo estudado. */
export type TopicKnowledge = 'self' | 'demonstrated'
export type ProjectStatus = 'not_started' | 'in_progress' | 'in_review' | 'done'

export interface CheckItem {
  id: string
  text: string
  done: boolean
  /** Link do entregável (repositório, notebook, painel…). */
  url?: string | null
}

/** Regra de repetição de uma tarefa. As ocorrências são gravadas como tarefas comuns com o mesmo `series_id`. */
export interface TaskRecurrence {
  freq: 'daily' | 'weekly'
  /** Dias da semana (0 = domingo … 6 = sábado), para `weekly`. */
  days?: number[]
  until?: ISODate | null
}

/** De onde a sessão foi iniciada: o cronômetro reconhece o conteúdo sem perguntar de novo. */
export interface SessionSource {
  kind: 'topic' | 'book' | 'pdf' | 'course' | 'exercise' | 'project' | 'task' | 'review'
  id: string
  label: string
  /** Caminho dentro do app para voltar ao conteúdo. */
  href?: string
}

export interface WeekTemplate {
  id: string
  name: string
  items: Array<{
    weekday: number
    start_time: string | null
    duration_minutes: number | null
    title: string
    category: string | null
    subject_id: UUID | null
    topic_id: UUID | null
    fixed: boolean
    priority: number
  }>
}

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
  /** Categorias de tarefa criadas por mim (além das cinco iniciais). */
  taskCategories?: Array<{ id: string; label: string }>
  /** Limite de minutos de estudo por dia, usado ao reorganizar a semana. */
  dailyStudyLimitMinutes?: number
  /** Janela preferida para encaixar estudos ('HH:MM'). */
  preferredWindow?: { start: string; end: string }
  /** Modelos de semana salvos (atividades relativas ao dia da semana). */
  weekTemplates?: WeekTemplate[]
}

export interface Subject extends Owned {
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
  /** Identificador estável do pilar da trilha (ex.: 'ds.sql'); evita instalar a mesma trilha duas vezes. */
  trail_key: string | null
}

export interface Topic extends Owned {
  subject_id: UUID
  parent_id: UUID | null
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
  /** Identificador estável do tópico na trilha (ex.: 'ds.sql.join'). */
  trail_key: string | null
  knowledge: TopicKnowledge | null
  /** Quando registrei que fiz o exercício prático do tópico. */
  practiced_at: ISODateTime | null
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
  task_id: UUID | null
  project_id: UUID | null
  source: SessionSource | null
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
  /** Categoria ('estudos', 'trabalho', 'pessoal', 'compromissos', 'outros' ou uma criada por mim); null em tarefas antigas. */
  category: string | null
  /** 1 = baixa, 2 = normal, 3 = alta. */
  priority: number
  /** Compromisso fixo: a reorganização da semana nunca move. */
  fixed: boolean
  due_date: ISODate | null
  series_id: UUID | null
  recurrence: TaskRecurrence | null
  done_at: ISODateTime | null
  /** Chave de origem (ex.: 'trail:ds.sql.join'); impede criar a mesma atividade duas vezes. */
  origin_key: string | null
  project_id: UUID | null
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
  kind: GoalKind
  /** Entregas da meta (para `deliverable`). */
  checklist: CheckItem[] | null
  due_date: ISODate | null
  done_at: ISODateTime | null
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

// ---------------------------------------------------------------------
// Cursos e materiais do Google Drive (só referências e metadados; os arquivos ficam no Drive)
// ---------------------------------------------------------------------

export type CourseSyncStatus = 'never' | 'ok' | 'partial' | 'failed'

export interface CourseSourceConfig {
  /** 0 = a própria pasta é um curso; 1 = cada subpasta do primeiro nível é um curso. */
  courseLevel: 0 | 1
  /** IDs de pastas do Drive deixadas de fora do catálogo. */
  excluded: string[]
}

/** Relatório da última atualização (contagens e problemas), mostrado na tela. */
export interface CourseSyncReport {
  inserted?: number
  updated?: number
  missing?: number
  restored?: number
  excluded?: number
  unverified?: number
  failedFolders?: Array<{ id: string; name: string; message: string }>
  skipped?: number
  truncated?: boolean
  error?: string
}

export interface CourseSource extends Owned {
  drive_folder_id: string
  /** Nome da pasta no Drive (atualizado a cada importação). */
  title: string
  /** Nome escolhido pelo usuário (opcional). */
  label: string | null
  config: CourseSourceConfig
  last_sync_at: ISODateTime | null
  last_sync_status: CourseSyncStatus
  last_sync_report: CourseSyncReport | null
}

export type CourseNodeKind = 'course' | 'module' | 'item'
/** available = visto na última leitura; missing = sumiu de uma pasta lida por completo (removido ou sem acesso); excluded = deixado de fora pelo mapeamento. */
export type CourseNodeStatus = 'available' | 'missing' | 'excluded'

export interface CourseNode extends Owned {
  source_id: UUID
  parent_id: UUID | null
  kind: CourseNodeKind
  drive_id: string
  /** Pasta do Drive onde o item está (para a reconciliação). */
  drive_parent_id: string | null
  /** Posição no Drive (pasta/arquivo): reconhece o item em novas importações, mesmo renomeado. */
  placement_key: string
  /** Nome no Drive. */
  title: string
  /** Nome personalizado (tem prioridade sobre o do Drive e é preservado nas importações). */
  custom_title: string | null
  mime_type: string
  resource_key: string | null
  size_bytes: number | null
  duration_ms: number | null
  drive_modified_at: ISODateTime | null
  via_shortcut: string | null
  sort_order: number
  /** Ordem/pasta definidas à mão: a importação não muda. */
  sort_manual: boolean
  parent_manual: boolean
  hidden: boolean
  status: CourseNodeStatus
  missing_since: ISODateTime | null
  subject_id: UUID | null
  topic_id: UUID | null
}

/** Progresso por arquivo do Drive (o mesmo arquivo em dois lugares compartilha o progresso). */
export interface CourseProgress extends Owned {
  drive_id: string
  completed_at: ISODateTime | null
  last_opened_at: ISODateTime | null
  last_node_id: UUID | null
}

// ---------------------------------------------------------------------
// VLM Control 2.0: caixa de entrada, projetos práticos e diagnósticos
// ---------------------------------------------------------------------

/** Ideia, tarefa ou lembrete anotado às pressas, para organizar depois. */
export interface InboxItem extends Owned {
  text: string
  processed_at: ISODateTime | null
  /** Tarefa criada a partir deste item (quando foi organizado). */
  task_id: UUID | null
}

export interface Project extends Owned {
  name: string
  description: string | null
  objective: string | null
  /** Pilar principal ('sql', 'python', 'ml', 'powerbi') ou null. */
  track: string | null
  skills: string[]
  /** 1 = iniciante, 2 = intermediário, 3 = avançado. */
  difficulty: number
  status: ProjectStatus
  steps: CheckItem[]
  deliverables: CheckItem[]
  due_date: ISODate | null
  repo_url: string | null
  /** Publicado (repositório público, portfólio…). */
  published: boolean
  notes: string | null
  /** Modelo de origem: o mesmo modelo não vira dois projetos. */
  template_key: string | null
  /** Tópicos das trilhas (trail_key) que o projeto pratica; o projeto é um só, mesmo ligado a vários. */
  topic_keys: string[]
  started_at: ISODateTime | null
  completed_at: ISODateTime | null
}

export interface AssessmentAnswer {
  question_id: string
  /** Tópico da trilha avaliado (trail_key). */
  topic_key: string
  level: 1 | 2 | 3
  chosen: number | null
  correct: boolean
}

export interface AssessmentTopicResult {
  topic_key: string
  asked: number
  correct: number
  /** demonstrated = acertou tudo com pelo menos 2 questões; partial = acertou a única questão feita; gap = errou alguma. */
  outcome: 'demonstrated' | 'partial' | 'gap'
}

/** Resultado de um diagnóstico. Cada tentativa é um registro novo: o histórico nunca é sobrescrito. */
export interface Assessment extends Owned {
  track: string
  taken_at: ISODateTime
  answers: AssessmentAnswer[]
  topics: AssessmentTopicResult[]
  total: number
  correct: number
  /** Tópico sugerido como ponto de partida (trail_key) ou null se nada ficou pendente. */
  start_key: string | null
}

export interface Tables {
  profiles: Profile
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
  course_sources: CourseSource
  course_nodes: CourseNode
  course_progress: CourseProgress
  inbox_items: InboxItem
  projects: Project
  assessments: Assessment
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
