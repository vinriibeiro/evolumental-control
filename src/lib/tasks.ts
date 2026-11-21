// Tarefas do planejamento: categorias, recorrência e pequenas regras compartilhadas.
import type { CalendarTask, TaskRecurrence, UserSettings } from '@/types/db'
import { addDays, weekday, type DayKey } from '@/lib/time'

export interface TaskCategoryDef {
  id: string
  label: string
}

/** Categorias iniciais. O usuário pode criar outras nas preferências, sem configuração extra. */
export const BASE_CATEGORIES: TaskCategoryDef[] = [
  { id: 'estudos', label: 'Estudos' },
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'compromissos', label: 'Compromissos' },
  { id: 'outros', label: 'Outros' },
]

export function allCategories(settings: Pick<UserSettings, 'taskCategories'>): TaskCategoryDef[] {
  const custom = (settings.taskCategories ?? []).filter((c) => c.id && c.label && !BASE_CATEGORIES.some((b) => b.id === c.id))
  return [...BASE_CATEGORIES, ...custom]
}

/** Categoria efetiva: tarefas antigas (sem categoria) contam como estudo quando têm matéria, senão "outros". */
export function categoryOf(task: Pick<CalendarTask, 'category' | 'subject_id' | 'topic_id'>): string {
  return task.category ?? (task.subject_id || task.topic_id ? 'estudos' : 'outros')
}

export function categoryLabel(id: string, categories: TaskCategoryDef[]): string {
  return categories.find((c) => c.id === id)?.label ?? id
}

export function slugCategory(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const isStudyTask = (task: Pick<CalendarTask, 'category' | 'subject_id' | 'topic_id'>) => categoryOf(task) === 'estudos'

export const PRIORITY_TASK_LABELS: Record<number, string> = { 1: 'Baixa', 2: 'Normal', 3: 'Alta' }

/** Semanas gravadas à frente para uma tarefa recorrente sem data final. */
export const RECURRENCE_HORIZON_DAYS = 56

/** Datas das ocorrências de uma regra, de `from` (inclusive) até o fim da regra ou do horizonte. */
export function occurrenceDates(rule: TaskRecurrence, from: DayKey, horizonDays = RECURRENCE_HORIZON_DAYS): DayKey[] {
  const limit = addDays(from, horizonDays - 1)
  const until = rule.until && rule.until < limit ? rule.until : limit
  const days = rule.freq === 'weekly' ? (rule.days?.length ? rule.days : [weekday(from)]) : null
  const out: DayKey[] = []
  for (let d = from; d <= until; d = addDays(d, 1)) if (!days || days.includes(weekday(d))) out.push(d)
  return out
}

export function describeRecurrence(rule: TaskRecurrence | null): string {
  if (!rule) return 'Não repete'
  if (rule.freq === 'daily') return 'Todos os dias'
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const days = [...(rule.days ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return days.length ? `Toda semana: ${days.map((d) => names[d]).join(', ')}` : 'Toda semana'
}
