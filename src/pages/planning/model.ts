// Modelo da tela "Meu Planejamento": tarefas (calendar_tasks) e blocos de estudo do cronograma
// (study_plan_items) são mostrados juntos, mas cada registro continua vivendo na sua própria tabela.
import type { CalendarTask, StudyPlanItem } from '@/types/db'
import { isOverdue, type PlanActivity } from '@/lib/replan'
import { isStudyTask } from '@/lib/tasks'
import { hhmmToMinutes, type DayKey } from '@/lib/time'

export type PlanView = 'day' | 'week' | 'month'

export interface PlanEvent {
  key: string
  kind: 'task' | 'plan' | 'session'
  date: DayKey
  start: number
  end: number
  title: string
  subtitle?: string
  done?: boolean
  /** Atrasada ou em conflito de horário: único uso de vermelho na grade. */
  attention?: boolean
  study?: boolean
  fixed?: boolean
  /** Pode ser arrastada/redimensionada. */
  movable: boolean
  task?: CalendarTask
  item?: StudyPlanItem
}

export interface DayChip {
  key: string
  label: string
  kind: 'task' | 'review' | 'deadline'
  done: boolean
  attention?: boolean
  task?: CalendarTask
}

export function taskActivity(t: CalendarTask): PlanActivity {
  return {
    id: `task:${t.id}`,
    source: 'task',
    refId: t.id,
    title: t.title,
    date: t.date,
    start: t.start_time ? hhmmToMinutes(t.start_time) : null,
    duration: t.duration_minutes ?? null,
    done: t.done,
    fixed: Boolean(t.fixed),
    study: isStudyTask(t),
    priority: t.priority ?? 2,
    due: t.due_date ?? null,
    subjectId: t.subject_id,
    topicId: t.topic_id,
    recurring: Boolean(t.series_id),
  }
}

export function itemActivity(it: StudyPlanItem, title: string): PlanActivity {
  return {
    id: `plan:${it.id}`,
    source: 'plan',
    refId: it.id,
    title,
    date: it.date,
    start: hhmmToMinutes(it.start_time),
    duration: it.duration_minutes,
    // "não realizado" foi uma decisão do usuário: não volta para a fila de pendências
    done: it.status === 'done' || it.status === 'missed' || it.status === 'rescheduled',
    fixed: false,
    study: true,
    priority: 2,
    due: null,
    subjectId: it.subject_id,
    topicId: it.topic_id,
    recurring: false,
  }
}

/** Sugere um estudo no horário ou, se não houver, a atividade de estudo mais prioritária sem horário. */
export function nextDailyStudy(todayList: PlanActivity[], today: DayKey, nowMinutes: number): PlanActivity | undefined {
  const available = todayList.filter((a) => a.study && !a.done && !isOverdue(a, today, nowMinutes))
  const timed = available.filter((a) => a.start != null).sort((a, b) => a.start! - b.start! || b.priority - a.priority)
  return timed[0] ?? available.sort((a, b) => b.priority - a.priority)[0]
}

export function greeting(hour: number): string {
  return hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

export function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n || n.includes('@') || /modo local/i.test(n)) return ''
  return n.split(/\s+/)[0]
}

export function readPref<T extends object>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...def, ...JSON.parse(v) } : def
  } catch {
    return def
  }
}

export function writePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* preferência apenas deste dispositivo */
  }
}
