import type {
  ActivityType,
  CardStatus,
  GoalMetric,
  GoalPeriod,
  PlanItemStatus,
  ReviewStatus,
  SubjectStatus,
  TaskKind,
  TimerMode,
  TopicStatus,
} from '@/types/db'

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  theory: 'Teoria',
  questions: 'Questões',
  review: 'Revisão',
  video: 'Videoaula',
  reading: 'Leitura',
  flashcards: 'Flashcards',
  mock_exam: 'Simulado',
  other: 'Outro',
}
export const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[]

/** Cores categóricas das atividades: ordem fixa da paleta validada (index.css). */
export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  theory: 'var(--series-1)',
  questions: 'var(--series-2)',
  review: 'var(--series-3)',
  video: 'var(--series-4)',
  reading: 'var(--series-5)',
  flashcards: 'var(--series-6)',
  mock_exam: 'var(--series-7)',
  other: 'var(--series-8)',
}

export const MODE_LABELS: Record<TimerMode, string> = {
  stopwatch: 'Cronômetro',
  countdown: 'Temporizador',
  pomodoro: 'Pomodoro',
  intervals: 'Intervalos',
  manual: 'Lançamento manual',
}

export const SUBJECT_STATUS_LABELS: Record<SubjectStatus, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  archived: 'Arquivada',
}

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  reviewing: 'Revisando',
}
export const TOPIC_STATUS_COLORS: Record<TopicStatus, string> = {
  not_started: 'var(--muted)',
  in_progress: 'var(--info)',
  completed: 'var(--success)',
  reviewing: 'var(--warning)',
}

export const PLAN_STATUS_LABELS: Record<PlanItemStatus, string> = {
  pending: 'Pendente',
  done: 'Concluído',
  partial: 'Parcial',
  missed: 'Não realizado',
  rescheduled: 'Remarcado',
}
export const PLAN_STATUS_COLORS: Record<PlanItemStatus, string> = {
  pending: 'var(--muted)',
  done: 'var(--success)',
  partial: 'var(--warning)',
  missed: 'var(--danger)',
  rescheduled: 'var(--info)',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  planned: 'Planejada',
  done: 'Realizada',
  postponed: 'Adiada',
  cancelled: 'Cancelada',
}

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  new: 'Novo',
  learning: 'Aprendendo',
  review: 'Em revisão',
  suspended: 'Suspenso',
}

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  study_hours: 'Horas de estudo',
  sessions: 'Sessões concluídas',
  questions: 'Questões respondidas',
  accuracy: 'Taxa de acertos (%)',
  topics_completed: 'Tópicos concluídos',
  flashcards_reviewed: 'Flashcards revisados',
  study_days: 'Dias de estudo',
}
export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' }

export const TASK_KIND_LABELS: Record<TaskKind, string> = { task: 'Tarefa', deadline: 'Prazo', exam: 'Prova', other: 'Outro' }

export const PRIORITY_LABELS = ['', 'Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta']
export const DIFFICULTY_LABELS = ['', 'Muito fácil', 'Fácil', 'Média', 'Difícil', 'Muito difícil']
export const MASTERY_TOPIC_LABELS = ['Nenhum', 'Inicial', 'Básico', 'Intermediário', 'Bom', 'Domínio']

/** Cores sugeridas para matérias: mesma ordem da paleta categórica validada. */
export const SUBJECT_COLORS = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948', '#DEB887', '#3B2B20']

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
