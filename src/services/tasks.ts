// Operações das tarefas do planejamento. Tudo aqui altera registros existentes ou cria novos de forma
// idempotente (série + dia, ou chave de origem), para nunca duplicar atividades.
import type { CalendarTask, InboxItem, Insert, StudyPlanItem, TaskRecurrence, WeekTemplate } from '@/types/db'
import { eq, gte, inList, lte, notNull, type DataBackend } from '@/lib/data/types'
import { occurrenceDates, RECURRENCE_HORIZON_DAYS } from '@/lib/tasks'
import { addDays, diffDays, minutesToHhmm, weekday, type DayKey } from '@/lib/time'
import type { ReplanMove } from '@/lib/replan'

export type TaskInput = Pick<Insert<'calendar_tasks'>, 'title' | 'date'> &
  Partial<Pick<CalendarTask, 'description' | 'start_time' | 'duration_minutes' | 'subject_id' | 'topic_id' | 'kind' | 'category' | 'priority' | 'fixed' | 'due_date' | 'origin_key' | 'project_id'>>

/** Cria a tarefa. Com `recurrence`, grava uma ocorrência por dia da regra, todas com o mesmo `series_id`. */
export async function createTask(backend: DataBackend, input: TaskInput, recurrence: TaskRecurrence | null = null): Promise<CalendarTask[]> {
  if (!recurrence) return backend.insert('calendar_tasks', [input])
  const series_id = crypto.randomUUID()
  const dates = occurrenceDates(recurrence, input.date as DayKey)
  if (dates.length === 0) return backend.insert('calendar_tasks', [input])
  return backend.insert(
    'calendar_tasks',
    dates.map((date) => ({ ...input, date, series_id, recurrence })),
  )
}

/**
 * Mantém as séries sem data final sempre com ocorrências gravadas até o horizonte (8 semanas).
 * Só cria os dias que faltam depois da última ocorrência existente: dias apagados pelo usuário não voltam.
 */
export async function extendSeries(backend: DataBackend, today: DayKey): Promise<number> {
  const { rows } = await backend.list('calendar_tasks', { filters: [notNull('series_id'), gte('date', addDays(today, -RECURRENCE_HORIZON_DAYS))] })
  const bySeries = new Map<string, CalendarTask[]>()
  for (const t of rows) bySeries.set(t.series_id!, [...(bySeries.get(t.series_id!) ?? []), t])
  const horizon = addDays(today, RECURRENCE_HORIZON_DAYS - 1)
  const fresh: Insert<'calendar_tasks'>[] = []
  for (const list of bySeries.values()) {
    const last = list.reduce((a, b) => (a.date > b.date ? a : b))
    const rule = last.recurrence
    if (!rule || (rule.until && rule.until <= last.date) || last.date >= horizon) continue
    const from = addDays(last.date, 1)
    for (const date of occurrenceDates(rule, from, diffDays(from, horizon) + 1)) {
      fresh.push({
        title: last.title,
        description: last.description,
        date,
        start_time: last.start_time,
        duration_minutes: last.duration_minutes,
        subject_id: last.subject_id,
        topic_id: last.topic_id,
        kind: last.kind,
        category: last.category,
        priority: last.priority,
        fixed: last.fixed,
        series_id: last.series_id,
        recurrence: rule,
        project_id: last.project_id,
      })
    }
  }
  if (fresh.length) await backend.insert('calendar_tasks', fresh)
  return fresh.length
}

export async function setTaskDone(backend: DataBackend, id: string, done: boolean) {
  return backend.update('calendar_tasks', [eq('id', id)], { done, done_at: done ? new Date().toISOString() : null })
}

export type SeriesScope = 'one' | 'following' | 'all'

/** Exclui a tarefa; numa série, só esta ocorrência, esta e as próximas, ou todas. Ocorrências concluídas ficam no histórico. */
export async function deleteTask(backend: DataBackend, task: CalendarTask, scope: SeriesScope = 'one'): Promise<number> {
  if (!task.series_id || scope === 'one') return backend.remove('calendar_tasks', [eq('id', task.id)])
  const filters = [eq('series_id', task.series_id), eq('done', false), ...(scope === 'following' ? [gte('date', task.date)] : [])]
  const removed = await backend.remove('calendar_tasks', filters)
  if (scope === 'following') {
    // encerra a regra nas ocorrências anteriores, para a série não ser estendida de novo
    const until = addDays(task.date, -1)
    const { rows } = await backend.list('calendar_tasks', { filters: [eq('series_id', task.series_id)] })
    for (const r of rows) if (r.recurrence) await backend.update('calendar_tasks', [eq('id', r.id)], { recurrence: { ...r.recurrence, until } })
  }
  return removed
}

/** Aplica as mudanças aceitas na prévia do replanejamento. Atualiza os próprios registros (vínculos preservados, nada duplicado). */
export async function applyReplan(backend: DataBackend, moves: ReplanMove[]): Promise<number> {
  let applied = 0
  for (let i = 0; i < moves.length; i += 10) {
    const results = await Promise.all(
      moves.slice(i, i + 10).map((m) => {
        const start_time = m.toStart != null ? minutesToHhmm(m.toStart) : null
        if (m.activity.source === 'plan') {
          return backend.update('study_plan_items', [eq('id', m.activity.refId), inList('status', ['pending', 'missed', 'partial'])], { date: m.toDate, ...(start_time ? { start_time } : {}), status: 'pending' })
        }
        return backend.update('calendar_tasks', [eq('id', m.activity.refId), eq('done', false)], { date: m.toDate, start_time })
      }),
    )
    applied += results.filter((r) => r.length > 0).length
  }
  return applied
}

type Copyable = Pick<CalendarTask, 'id' | 'title' | 'description' | 'date' | 'start_time' | 'duration_minutes' | 'subject_id' | 'topic_id' | 'kind' | 'category' | 'priority' | 'fixed' | 'series_id'>

/**
 * Plano de cópia de uma semana para outra: só o que ainda não existe na semana de destino.
 * Ocorrências de séries recorrentes ficam de fora (a própria série já as cria).
 */
export function planWeekCopy(source: Copyable[], target: Pick<CalendarTask, 'title' | 'date' | 'start_time' | 'origin_key'>[], fromWeek: DayKey, toWeek: DayKey): { create: Insert<'calendar_tasks'>[]; skipped: number } {
  const shift = diffDays(fromWeek, toWeek)
  const have = new Set(target.map((t) => `${t.date}|${t.start_time ?? ''}|${t.title.trim().toLowerCase()}`))
  const origins = new Set(target.map((t) => t.origin_key).filter(Boolean))
  const create: Insert<'calendar_tasks'>[] = []
  let skipped = 0
  for (const t of source) {
    if (t.series_id) continue
    const date = addDays(t.date, shift)
    const origin_key = `copy:${t.id}:${date}`
    const key = `${date}|${t.start_time ?? ''}|${t.title.trim().toLowerCase()}`
    if (have.has(key) || origins.has(origin_key)) {
      skipped++
      continue
    }
    have.add(key)
    create.push({ title: t.title, description: t.description, date, start_time: t.start_time, duration_minutes: t.duration_minutes, subject_id: t.subject_id, topic_id: t.topic_id, kind: t.kind, category: t.category, priority: t.priority, fixed: t.fixed, origin_key })
  }
  return { create, skipped }
}

/** Modelo de semana a partir das tarefas de uma semana (posições relativas ao dia da semana). */
export function templateFromWeek(name: string, tasks: Copyable[]): WeekTemplate {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || 'Minha semana',
    items: tasks
      .filter((t) => !t.series_id)
      .map((t) => ({ weekday: weekday(t.date), start_time: t.start_time, duration_minutes: t.duration_minutes, title: t.title, category: t.category, subject_id: t.subject_id, topic_id: t.topic_id, fixed: t.fixed, priority: t.priority })),
  }
}

/** Tarefas que o modelo criaria na semana que começa em `weekStart` (segunda), sem repetir o que já foi aplicado. */
export function planTemplate(template: WeekTemplate, weekStart: DayKey, target: Pick<CalendarTask, 'title' | 'date' | 'start_time' | 'origin_key'>[]): { create: Insert<'calendar_tasks'>[]; skipped: number } {
  const have = new Set(target.map((t) => `${t.date}|${t.start_time ?? ''}|${t.title.trim().toLowerCase()}`))
  const origins = new Set(target.map((t) => t.origin_key).filter(Boolean))
  const create: Insert<'calendar_tasks'>[] = []
  let skipped = 0
  template.items.forEach((it, index) => {
    const date = addDays(weekStart, (it.weekday + 6) % 7)
    const origin_key = `tpl:${template.id}:${date}:${index}`
    const key = `${date}|${it.start_time ?? ''}|${it.title.trim().toLowerCase()}`
    if (have.has(key) || origins.has(origin_key)) {
      skipped++
      return
    }
    have.add(key)
    create.push({ title: it.title, date, start_time: it.start_time, duration_minutes: it.duration_minutes, category: it.category, subject_id: it.subject_id, topic_id: it.topic_id, fixed: it.fixed, priority: it.priority, origin_key })
  })
  return { create, skipped }
}

export async function weekTasks(backend: DataBackend, weekStart: DayKey): Promise<CalendarTask[]> {
  return (await backend.list('calendar_tasks', { filters: [gte('date', weekStart), lte('date', addDays(weekStart, 6))], order: [{ column: 'date' }, { column: 'start_time' }] })).rows
}

/** Transforma um item da caixa de entrada em tarefa e o marca como organizado (o item não é apagado). */
export async function organizeInboxItem(backend: DataBackend, item: InboxItem, input: TaskInput): Promise<CalendarTask> {
  const [task] = await backend.insert('calendar_tasks', [input])
  await backend.update('inbox_items', [eq('id', item.id)], { processed_at: new Date().toISOString(), task_id: task.id })
  return task
}

/** Blocos de estudo pendentes que ficaram para trás viram "não realizado" só quando o usuário pede; aqui apenas lemos. */
export const isPendingPlanItem = (it: Pick<StudyPlanItem, 'status'>) => it.status === 'pending' || it.status === 'partial'
