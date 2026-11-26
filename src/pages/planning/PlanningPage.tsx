// Meu Planejamento — tela inicial do VLM Control 2.0.
// Uma central do dia: prioridade, resumo, entrada rápida de tarefas e o calendário (dia, semana, mês) com
// compromissos e estudos juntos. Tarefas vivem em calendar_tasks; blocos de estudo gerados pelo cronograma
// continuam em study_plan_items — aqui os dois aparecem lado a lado, sem copiar um para o outro.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, Check, ChevronLeft, ChevronRight, Copy, CopyPlus, Eraser, Play, Plus, RotateCcw, Settings2, Sparkles } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Card, Progress, Segmented } from '@/components/ui/layout'
import { ErrorState, Skeleton, useConfirm, useToast } from '@/components/ui/feedback'
import { invalidateTables, useAll, useCount, useSessions } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { useNow } from '@/hooks/useNow'
import { useProfile, useSettings } from '@/hooks/useSettings'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useStartStudy, ROOM_PATH } from '@/features/timer/useStartStudy'
import { eq, gte, inList, lte, notNull } from '@/lib/data/types'
import { defaultPlanConfig } from '@/lib/planner'
import { parseQuickTask } from '@/lib/quickAdd'
import { activityConflicts, durationInsights, isOverdue, type DurationSample, type PlanActivity } from '@/lib/replan'
import { allCategories, categoryOf } from '@/lib/tasks'
import { netSeconds } from '@/lib/timer/engine'
import {
  addDays,
  addMonths,
  dayKey,
  eachDay,
  endOfMonth,
  formatDayKey,
  formatDuration,
  minutesToHhmm,
  periodRange,
  startOfMonth,
  startOfWeek,
  windowsTotalMinutes,
  zonedDayStart,
  type DayKey,
} from '@/lib/time'
import { cn } from '@/lib/cn'
import { createTask, extendSeries, setTaskDone } from '@/services/tasks'
import type { CalendarTask, InboxItem, StudyPlan, StudyPlanItem } from '@/types/db'
import { PlanItemForm } from '@/pages/schedule/PlanItemForm'
import { PlanEditor } from '@/pages/schedule/PlanEditor'
import { ProposalModal } from '@/pages/schedule/ProposalModal'
import { CopyBlocksModal } from '@/pages/calendar/CopyBlocksModal'
import { BlockDetails } from './BlockDetails'
import { MonthView } from './MonthView'
import { ReplanDialog } from './ReplanDialog'
import { ActiveCycleCard, ContinueCard, ContinueCourseCard, InboxCard, WeekSummary } from './SidePanels'
import { TaskDialog, type TaskDraft } from './TaskDialog'
import { TimeGrid } from './TimeGrid'
import { WeekTools } from './WeekTools'
import { LastReadLine } from './LastReadLine'
import { TodayRoutine } from '@/components/TodayRoutine'
import { CguToday } from '@/components/CguToday'
import { firstName, greeting, itemActivity, readPref, taskActivity, writePref, type DayChip, type PlanEvent, type PlanView } from './model'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

export default function PlanningPage() {
  const settings = useSettings()
  const profile = useProfile()
  const tz = settings.timezone
  const now = useNow(60_000)
  const today = dayKey(now, tz)
  const nowMin = Math.round((now - zonedDayStart(today, tz)) / 60000)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const lookups = useLookups()
  const subjects = useSubjects()
  const study = useStartStudy()
  const categories = allCategories(settings)

  const [view, setView] = useState<PlanView>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'))
  const [anchor, setAnchor] = useState(today)
  const [prefs, setPrefs] = useState(() => readPref('evl:plan-prefs', { history: false, categories: [] as string[] }))
  const [quick, setQuick] = useState('')
  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const [details, setDetails] = useState<StudyPlanItem | null>(null)
  const [itemForm, setItemForm] = useState<StudyPlanItem | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [copyBlocks, setCopyBlocks] = useState(false)
  const [proposalPlan, setProposalPlan] = useState<StudyPlan | null>(null)
  useEffect(() => writePref('evl:plan-prefs', prefs), [prefs])

  // Séries recorrentes sem data final ganham as próximas ocorrências uma vez por dia (idempotente).
  useEffect(() => {
    const key = 'evl:series-extended'
    try {
      if (localStorage.getItem(key) === today) return
      localStorage.setItem(key, today)
    } catch {
      return
    }
    extendSeries(backend, today)
      .then((n) => {
        if (n > 0) void invalidateTables(qc, ['calendar_tasks'])
      })
      .catch(() => {})
  }, [backend, qc, today])

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === 'week') return eachDay(startOfWeek(anchor), addDays(startOfWeek(anchor), 6))
    return eachDay(startOfWeek(startOfMonth(anchor)), addDays(startOfWeek(endOfMonth(anchor)), 6))
  }, [view, anchor])
  const range = { from: days[0], to: days[days.length - 1] }
  const week = periodRange('week', anchor)
  const thisWeek = periodRange('week', today)
  // Uma janela só para tudo: o que está na tela, os atrasos recentes e as duas próximas semanas (replanejamento).
  const fetchFrom = range.from < addDays(today, -45) ? range.from : addDays(today, -45)
  const fetchTo = range.to > addDays(thisWeek.from, 13) ? range.to : addDays(thisWeek.from, 13)

  const tasks = useAll('calendar_tasks', { filters: [gte('date', fetchFrom), lte('date', fetchTo)] }, { keepPrevious: true })
  const items = useAll('study_plan_items', { filters: [gte('date', fetchFrom), lte('date', fetchTo)] }, { keepPrevious: true })
  const reviews = useAll('reviews', { filters: [gte('scheduled_for', range.from), lte('scheduled_for', range.to), inList('status', ['planned', 'postponed', 'done'])] }, { keepPrevious: true })
  const reviewsDue = useCount('reviews', [inList('status', ['planned', 'postponed']), lte('scheduled_for', today)])
  const plans = useAll('study_plans', { order: [{ column: 'created_at' }] })
  const activePlan = (plans.data ?? []).find((p) => p.status === 'active') ?? plans.data?.[0] ?? null
  const rangeStats = useStudyStats(range)
  const todayStats = useStudyStats(periodRange('day', today))
  const weekStats = useStudyStats(week)
  const timed = useSessions({ filters: [eq('status', 'completed'), notNull('planned_seconds'), gte('started_at', new Date(now - 60 * 86400000).toISOString().slice(0, 10))], order: [{ column: 'started_at', ascending: false }], limit: 200 })

  const taskById = useMemo(() => new Map((tasks.data ?? []).map((t) => [t.id, t])), [tasks.data])
  const itemById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data])
  const activities = useMemo<PlanActivity[]>(() => {
    const blockTitle = (it: StudyPlanItem) => (it.topic_id ? `${lookups.subjectName(it.subject_id)} · ${lookups.topicName(it.topic_id)}` : lookups.subjectName(it.subject_id))
    return [...(tasks.data ?? []).map(taskActivity), ...(items.data ?? []).filter((i) => i.status !== 'rescheduled').map((i) => itemActivity(i, blockTitle(i)))]
  }, [tasks.data, items.data, lookups])

  const categoryFor = (a: PlanActivity) => (a.source === 'plan' ? 'estudos' : categoryOf(taskById.get(a.refId) ?? { category: null, subject_id: a.subjectId, topic_id: a.topicId }))
  const visible = useMemo(() => (prefs.categories.length ? activities.filter((a) => prefs.categories.includes(categoryFor(a))) : activities), [activities, prefs.categories, taskById]) // eslint-disable-line react-hooks/exhaustive-deps

  const overdue = useMemo(() => activities.filter((a) => isOverdue(a, today, nowMin)), [activities, today, nowMin])
  const overdueIds = useMemo(() => new Set(overdue.map((a) => a.id)), [overdue])
  const conflictIds = useMemo(() => new Set(activityConflicts(activities.filter((a) => !a.done && a.date >= today)).flatMap(([a, b]) => [a.id, b.id])), [activities, today])

  const todayList = useMemo(() => activities.filter((a) => a.date === today).sort((a, b) => Number(a.done) - Number(b.done) || (a.start ?? 9999) - (b.start ?? 9999) || b.priority - a.priority), [activities, today])
  const pendingToday = todayList.filter((a) => !a.done)
  const doneToday = todayList.length - pendingToday.length
  const priority = [...pendingToday].sort((a, b) => b.priority - a.priority || (a.start ?? 9999) - (b.start ?? 9999))[0]
  const nextUp = pendingToday.filter((a) => a.start != null && a.start + (a.duration ?? 30) > nowMin).sort((a, b) => a.start! - b.start!)[0]
  const nextStudy = pendingToday.find((a) => a.study)
  const weekActivities = useMemo(() => activities.filter((a) => a.date >= week.from && a.date <= week.to), [activities, week.from, week.to])

  const events = useMemo<PlanEvent[]>(() => {
    const out: PlanEvent[] = []
    for (const a of visible) {
      if (a.start == null || a.date < range.from || a.date > range.to) continue
      const task = a.source === 'task' ? taskById.get(a.refId) : undefined
      const item = a.source === 'plan' ? itemById.get(a.refId) : undefined
      out.push({
        key: a.id,
        kind: a.source,
        date: a.date,
        start: a.start,
        end: Math.min(24 * 60, a.start + (a.duration ?? 30)),
        title: a.title,
        subtitle: task ? (task.subject_id ? lookups.subjectName(task.subject_id) : categories.find((c) => c.id === categoryOf(task))?.label) : 'Bloco de estudo',
        done: a.done,
        attention: overdueIds.has(a.id) || conflictIds.has(a.id),
        study: a.study,
        fixed: a.fixed,
        movable: !a.done,
        task,
        item,
      })
    }
    if (prefs.history) {
      const minutesOf = (ms: number) => Math.round((ms - zonedDayStart(dayKey(ms, tz), tz)) / 60000)
      for (const s of rangeStats.data ?? []) {
        const startMs = new Date(s.started_at).getTime()
        const endMs = s.ended_at ? new Date(s.ended_at).getTime() : startMs
        const date = dayKey(startMs, tz)
        const start = minutesOf(startMs)
        const end = date === dayKey(endMs, tz) ? Math.max(start + 15, minutesOf(endMs)) : 24 * 60
        out.push({ key: `s-${s.id}`, kind: 'session', date, start, end, title: s.source?.label ?? lookups.subjectName(s.subject_id), subtitle: `Realizado · ${formatDuration(netSeconds(s, s.pauses))}`, movable: false })
      }
    }
    return out
  }, [visible, range.from, range.to, taskById, itemById, lookups, categories, overdueIds, conflictIds, prefs.history, rangeStats.data, tz])

  const hours = useMemo(() => {
    const shown = events.filter((e) => days.includes(e.date))
    const first = Math.min(6 * 60, ...shown.map((e) => e.start))
    const last = Math.max(23 * 60, ...shown.map((e) => e.end))
    return { start: Math.floor(first / 60), end: Math.min(24, Math.ceil(last / 60)) }
  }, [events, days])

  const chips = (d: DayKey): DayChip[] => [
    ...visible.filter((a) => a.date === d && a.start == null && a.source === 'task').map((a) => ({ key: a.id, label: a.title, kind: 'task' as const, done: a.done, attention: overdueIds.has(a.id), task: taskById.get(a.refId) })),
    ...(reviews.data ?? []).filter((r) => r.scheduled_for === d).map((r) => ({ key: `r-${r.id}`, label: r.title, kind: 'review' as const, done: r.status === 'done' })),
    ...(tasks.data ?? []).filter((t) => t.due_date === d && !t.done && t.date !== d).map((t) => ({ key: `due-${t.id}`, label: `Prazo: ${t.title}`, kind: 'deadline' as const, done: false, task: t })),
    ...lookups.subjects.filter((s) => s.target_date === d).map((s) => ({ key: `dl-${s.id}`, label: `Prazo: ${s.name}`, kind: 'deadline' as const, done: false })),
  ]
  const plannedMinutes = (d: DayKey) => visible.filter((a) => a.date === d && !a.done).reduce((n, a) => n + (a.duration ?? 0), 0)

  // ---------------------------------------------------------------- ações
  const refresh = (tables: Array<'calendar_tasks' | 'study_plan_items' | 'inbox_items'> = ['calendar_tasks']) => invalidateTables(qc, tables)
  const run = async (fn: () => Promise<unknown>, tables?: Parameters<typeof refresh>[0]) => {
    try {
      await fn()
    } catch (e) {
      toast.error(e)
    } finally {
      await refresh(tables)
    }
  }

  const move = async (a: PlanActivity, date: DayKey, start: number | null, duration = a.duration) => {
    if (date === a.date && start === a.start && duration === a.duration) return
    if (start != null) {
      const end = start + (duration ?? 30)
      const clash = activities.filter((o) => o.id !== a.id && !o.done && o.date === date && o.start != null && o.start < end && o.start + (o.duration ?? 30) > start)
      if (clash.length && !(await confirm({ title: 'Horário ocupado', message: `${clash.map((c) => `"${c.title}"`).join(', ')} já ${clash.length > 1 ? 'estão' : 'está'} neste horário. Manter as duas atividades sobrepostas?`, confirmLabel: 'Manter assim' }))) return
    }
    const start_time = start != null ? minutesToHhmm(Math.max(0, Math.min(24 * 60 - 30, start))) : null
    if (a.source === 'plan') await run(() => backend.update('study_plan_items', [eq('id', a.refId)], { date, ...(start_time ? { start_time } : {}), duration_minutes: duration ?? a.duration ?? 30 }), ['study_plan_items'])
    else await run(() => backend.update('calendar_tasks', [eq('id', a.refId)], { date, start_time, duration_minutes: duration }))
  }
  const byId = (id: string) => activities.find((a) => a.id === id)

  const toggle = (a: PlanActivity) =>
    a.source === 'plan' ? run(() => backend.update('study_plan_items', [eq('id', a.refId)], { status: a.done ? 'pending' : 'done' }), ['study_plan_items']) : run(() => setTaskDone(backend, a.refId, !a.done))

  const startActivity = (a: PlanActivity) => {
    const label = a.title
    if (a.source === 'plan') {
      const it = itemById.get(a.refId)
      return void study.start({ subject_id: a.subjectId, topic_id: a.topicId, activity_type: it?.activity_type, plan_item_id: a.refId, minutes: a.duration, source: { kind: 'task', id: a.refId, label, href: '/' } })
    }
    return void study.start({ subject_id: a.subjectId, topic_id: a.topicId, task_id: a.refId, project_id: taskById.get(a.refId)?.project_id ?? null, minutes: a.duration, source: { kind: 'task', id: a.refId, label, href: '/' } })
  }

  const addQuick = async () => {
    const parsed = parseQuickTask(quick)
    if (!parsed.title) return
    const date = view === 'day' ? anchor : today
    // "SQL 1h" já entra como estudo de SQL quando o título começa com o nome de uma matéria
    const t = norm(parsed.title)
    const subject = (subjects.data ?? []).find((s) => t === norm(s.name) || t.startsWith(norm(s.name) + ' '))
    setQuick('')
    await run(async () => {
      await createTask(backend, { ...parsed, date, category: subject ? 'estudos' : 'pessoal', subject_id: subject?.id ?? null })
      toast.success(`Tarefa adicionada para ${date === today ? 'hoje' : formatDayKey(date, 'weekday')}.`)
    })
  }

  const organize = (item: InboxItem) =>
    setDraft({
      task: null,
      date: today,
      title: item.text.slice(0, 300),
      onSaved: async (task: CalendarTask) => {
        await backend.update('inbox_items', [eq('id', item.id)], { processed_at: new Date().toISOString(), task_id: task.id })
      },
    })

  const suggest = async () => {
    if (activePlan) return setProposalPlan(activePlan)
    setEditorOpen(true)
  }
  const ensurePlanThenEdit = async () => {
    if (!activePlan && (subjects.data ?? []).length) {
      try {
        await backend.insert('study_plans', [{ name: 'Meu planejamento', start_date: today, end_date: addDays(today, 364), config: { ...defaultPlanConfig(), subjectIds: (subjects.data ?? []).map((s) => s.id) }, status: 'active' }])
        await invalidateTables(qc, ['study_plans'])
      } catch (e) {
        return toast.error(e)
      }
    }
    setEditorOpen(true)
  }

  /** Remove os blocos de estudo ainda PENDENTES do período em tela; concluídos, parciais e não realizados ficam no histórico. */
  const clearPendingBlocks = async () => {
    const pending = (items.data ?? []).filter((i) => i.status === 'pending' && i.date >= range.from && i.date <= range.to)
    if (pending.length === 0) return toast.info('Não há blocos de estudo pendentes neste período.')
    if (!(await confirm({ title: 'Remover blocos de estudo pendentes?', message: `${pending.length} bloco(s) pendente(s) entre ${formatDayKey(range.from)} e ${formatDayKey(range.to)} serão removidos. Suas tarefas e os blocos já realizados não são alterados.`, danger: true, confirmLabel: 'Remover blocos' }))) return
    await run(() => backend.remove('study_plan_items', [gte('date', range.from), lte('date', range.to), eq('status', 'pending')]), ['study_plan_items'])
  }

  // ---------------------------------------------------------------- replanejamento
  const topicOrder = useMemo(() => new Map(lookups.topics.map((t) => [t.id, t.sort_order])), [lookups.topics])
  const subjectDeficit = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of lookups.subjects) if (s.weekly_goal_hours) m.set(s.id, Math.max(0, s.weekly_goal_hours * 60 - Math.round((weekStats.stats.bySubject.get(s.id) ?? 0) / 60)))
    return m
  }, [lookups.subjects, weekStats.stats.bySubject])
  const insights = useMemo(() => {
    const samples: DurationSample[] = (timed.data ?? [])
      .filter((s) => s.mode !== 'manual' && (s.task_id || s.plan_item_id) && s.planned_seconds)
      .map((s) => ({ key: s.subject_id ?? 'geral', label: s.subject_id ? lookups.subjectName(s.subject_id) : 'Atividades sem matéria', plannedMinutes: s.planned_seconds! / 60, actualMinutes: netSeconds(s, s.pauses) / 60 }))
    return durationInsights(samples)
  }, [timed.data, lookups])
  const availability = activePlan?.config.availability
  const availableMinutes = availability && Object.values(availability).some((w) => (w ?? []).length) ? [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + windowsTotalMinutes(availability[d] ?? []), 0) : null
  const replanOptions = useMemo(
    () => ({ today, nowMinutes: nowMin, availability, preferredWindow: settings.preferredWindow, dailyStudyLimitMinutes: settings.dailyStudyLimitMinutes, topicOrder, subjectDeficit }),
    [today, nowMin, availability, settings.preferredWindow, settings.dailyStudyLimitMinutes, topicOrder, subjectDeficit],
  )

  // ---------------------------------------------------------------- render
  const shift = (dir: 1 | -1) => setAnchor(view === 'day' ? addDays(anchor, dir) : view === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir))
  const title = view === 'day' ? formatDayKey(anchor, 'long') : view === 'week' ? `${formatDayKey(days[0])} – ${formatDayKey(days[6])}` : formatDayKey(startOfMonth(anchor), 'month')
  const loading = tasks.isPending || items.isPending
  const failed = tasks.isError ? tasks : items.isError ? items : null
  const goal = settings.dailyGoalMinutes * 60
  const studied = todayStats.stats.total
  const name = firstName(profile.data?.display_name)
  const hour = Math.floor(nowMin / 60)
  const live = study.live
  const monthActs = view === 'month' ? visible.filter((a) => a.date >= range.from && a.date <= range.to) : []
  const deadlines = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const t of tasks.data ?? []) if (t.due_date && !t.done) m.set(t.due_date, [...(m.get(t.due_date) ?? []), t.title])
    for (const s of lookups.subjects) if (s.target_date) m.set(s.target_date, [...(m.get(s.target_date) ?? []), s.name])
    return m
  }, [tasks.data, lookups.subjects])
  const monthSummary = useMemo(() => {
    if (view !== 'month') return null
    const from = startOfMonth(anchor)
    const to = endOfMonth(anchor)
    const acts = activities.filter((a) => a.date >= from && a.date <= to)
    const secs = [...rangeStats.stats.byDay].filter(([d]) => d >= from && d <= to)
    return { total: acts.length, done: acts.filter((a) => a.done).length, studied: secs.reduce((n, [, v]) => n + v, 0), days: secs.filter(([, v]) => v > 0).length, deadlines: [...deadlines.keys()].filter((d) => d >= from && d <= to).length }
  }, [view, anchor, activities, rangeStats.stats.byDay, deadlines])

  return (
    <div className="space-y-5">
      {/* Cabeçalho: data, saudação, prioridade do dia e as duas ações principais */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted first-letter:uppercase">{formatDayKey(today, 'long')}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {greeting(hour)}
            {name ? `, ${name}` : ''}.
          </h1>
          <p className="mt-1.5 flex max-w-2xl items-center gap-2 text-sm text-muted">
            {priority ? (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="truncate">
                  Prioridade de hoje: <strong className="font-medium text-ink">{priority.title}</strong>
                  {priority.start != null && ` às ${minutesToHhmm(priority.start)}`}
                </span>
              </>
            ) : loading ? (
              'Carregando o seu dia…'
            ) : todayList.length ? (
              'Tudo o que estava planejado para hoje foi concluído.'
            ) : (
              'Nada planejado para hoje ainda. Adicione a primeira tarefa abaixo.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDraft({ task: null, date: view === 'day' ? anchor : today })}>
            Tarefa
          </Button>
          {live ? (
            <Button variant="dark" icon={<Play className="size-4" />} onClick={() => navigate(ROOM_PATH)}>
              Voltar à sessão
            </Button>
          ) : (
            <Button variant="dark" icon={<Play className="size-4" />} loading={study.pending} onClick={() => (nextStudy ? startActivity(nextStudy) : navigate(ROOM_PATH))}>
              Iniciar estudo
            </Button>
          )}
        </div>
      </header>

      {/* Entrada rápida: título e Enter. Horário ("19h") e duração ("1h") no próprio texto são opcionais. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void addQuick()
        }}
        className="flex gap-2"
      >
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Nova tarefa para ${view === 'day' && anchor !== today ? formatDayKey(anchor, 'weekday') : 'hoje'} — ex.: 19h Python 1h`} aria-label="Adicionar tarefa rápida" className="h-11" />
        <Button type="submit" className="h-11 max-sm:hidden" disabled={!quick.trim()}>
          Adicionar
        </Button>
      </form>

      {/* Resumo do dia */}
      <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pendentes hoje" value={loading ? null : String(pendingToday.length)} hint={overdue.length ? `${overdue.length} atrasada(s)` : reviewsDue.data ? `${reviewsDue.data} revisão(ões) para hoje` : undefined} attention={overdue.length > 0} />
        <Stat label="Concluídas hoje" value={loading ? null : String(doneToday)} hint={todayList.length ? `de ${todayList.length} planejada(s)` : undefined} />
        <Stat label="Estudo hoje" value={todayStats.isPending ? null : formatDuration(studied)} hint={goal > 0 ? `Meta diária: ${formatDuration(goal)}` : undefined}>
          {goal > 0 && <Progress value={(studied / goal) * 100} className="mt-2 h-1" label="Meta diária de estudo" />}
        </Stat>
        <Stat label="Próxima atividade" value={loading ? null : nextUp ? minutesToHhmm(nextUp.start!) : '—'} hint={nextUp ? nextUp.title : 'Nada com horário até o fim do dia'} />
      </section>

      {overdue.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-accent" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink">
            <strong className="font-semibold">{overdue.length} atividade(s) ficaram para trás.</strong> <span className="text-muted">Veja uma sugestão de novos horários antes de mudar qualquer coisa.</span>
          </p>
          <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setReplanOpen(true)}>
            Reorganizar minha semana
          </Button>
        </div>
      )}

      {failed ? (
        <ErrorState error={failed.error} onRetry={() => failed.refetch()} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr]">
          {/* Hoje: marcar como feito e começar a estudar com um clique */}
          <div className="xl:col-start-2 xl:row-start-1">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-ink">Hoje</h2>
                {todayList.length > 0 && (
                  <span className="tabular text-xs text-muted">
                    {doneToday}/{todayList.length}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : todayList.length === 0 ? (
                <p className="py-3 text-sm text-muted">Seu dia está livre. Adicione uma tarefa no campo acima ou clique em um horário do calendário.</p>
              ) : (
                <ul className="-mx-1 divide-y divide-line">
                  {todayList.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-1 py-1.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={a.done}
                        aria-label={a.done ? `Reabrir: ${a.title}` : `Concluir: ${a.title}`}
                        onClick={() => void toggle(a)}
                        className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-md border', a.done ? 'border-ink bg-ink text-bg' : 'border-muted/60 hover:border-ink')}
                      >
                        {a.done && <Check className="size-3" strokeWidth={3} />}
                      </button>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (a.source === 'task' ? setDraft({ task: taskById.get(a.refId) ?? null, date: a.date }) : setDetails(itemById.get(a.refId) ?? null))}>
                        <span className={cn('block truncate text-sm text-ink', a.done && 'text-muted line-through')}>{a.title}</span>
                        <span className={cn('tabular block text-[11px]', overdueIds.has(a.id) ? 'text-accent' : 'text-muted')}>
                          {a.start != null ? minutesToHhmm(a.start) : 'Sem horário'}
                          {a.duration ? ` · ${a.duration} min` : ''}
                          {overdueIds.has(a.id) ? ' · atrasada' : a.priority >= 3 && !a.done ? ' · prioridade' : ''}
                        </span>
                      </button>
                      {a.study && !a.done && (
                        <IconButton label={`Iniciar estudo: ${a.title}`} size="sm" onClick={() => startActivity(a)} disabled={study.pending}>
                          <Play className="size-3.5" />
                        </IconButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Calendário */}
          <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Segmented
                label="Visualização"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'day', label: 'Dia' },
                  { value: 'week', label: 'Semana' },
                  { value: 'month', label: 'Mês' },
                ]}
              />
              <div className="flex items-center">
                <IconButton size="sm" label="Anterior" onClick={() => shift(-1)}>
                  <ChevronLeft className="size-4" />
                </IconButton>
                <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
                  Hoje
                </Button>
                <IconButton size="sm" label="Próximo" onClick={() => shift(1)}>
                  <ChevronRight className="size-4" />
                </IconButton>
              </div>
              <span className="inline-block min-w-0 truncate text-sm font-medium text-ink first-letter:uppercase">{title}</span>
              <span className="flex-1" />
              <MultiSelect label="Categorias" allLabel="Todas as categorias" className="max-sm:hidden" options={categories.map((c) => ({ value: c.id, label: c.label }))} value={prefs.categories} onChange={(v) => setPrefs({ ...prefs, categories: v })} />
              <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setReplanOpen(true)}>
                <span className="max-sm:sr-only">Reorganizar minha semana</span>
              </Button>
              <ActionMenu label="Mais ações do planejamento">
                {(close) => (
                  <>
                    <MenuItem icon={<Sparkles className="size-4" />} onClick={() => (close(), void suggest())}>
                      Sugerir agenda de estudos
                    </MenuItem>
                    <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), setToolsOpen(true))}>
                      Copiar semana e modelos
                    </MenuItem>
                    <MenuItem icon={<Settings2 className="size-4" />} onClick={() => (close(), void ensurePlanThenEdit())}>
                      Disponibilidade e matérias
                    </MenuItem>
                    {activePlan && (
                      <>
                        <MenuItem icon={<CopyPlus className="size-4" />} onClick={() => (close(), setCopyBlocks(true))}>
                          Repetir blocos de estudo
                        </MenuItem>
                        <MenuItem icon={<Eraser className="size-4" />} onClick={() => (close(), void clearPendingBlocks())}>
                          Remover blocos pendentes
                        </MenuItem>
                      </>
                    )}
                    <MenuItem icon={<CalendarRange className="size-4" />} onClick={() => (close(), setPrefs({ ...prefs, history: !prefs.history }))}>
                      {prefs.history ? 'Ocultar o que foi estudado' : 'Mostrar o que foi estudado'}
                    </MenuItem>
                  </>
                )}
              </ActionMenu>
            </div>

            {loading ? (
              <Card className="space-y-3 p-4" aria-busy>
                <Skeleton className="h-8" />
                <Skeleton className="h-64" />
              </Card>
            ) : view === 'month' ? (
              <>
                {monthSummary && (
                  <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-line px-4 py-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[11px] text-muted">Tarefas concluídas</dt>
                      <dd className="tabular font-semibold text-ink">
                        {monthSummary.done} de {monthSummary.total}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">Estudo no mês</dt>
                      <dd className="tabular font-semibold text-ink">{formatDuration(monthSummary.studied)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">Dias com estudo</dt>
                      <dd className="tabular font-semibold text-ink">{monthSummary.days}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">Prazos</dt>
                      <dd className="tabular font-semibold text-ink">{monthSummary.deadlines}</dd>
                    </div>
                  </dl>
                )}
                <MonthView days={days} anchor={anchor} today={today} activities={monthActs} studied={rangeStats.stats.byDay} deadlines={deadlines} overdueIds={overdueIds} onPick={(d) => (setAnchor(d), setView('day'))} onMoveDay={(a, d) => void move(a, d, a.start)} />
              </>
            ) : (
              <TimeGrid
                days={days}
                today={today}
                tz={tz}
                hours={hours}
                events={events}
                chips={chips}
                planned={view === 'week' ? plannedMinutes : undefined}
                onSlot={(d, m) => setDraft({ task: null, date: d, time: minutesToHhmm(m), duration: 60 })}
                onOpen={(ev) => (ev.task ? setDraft({ task: ev.task, date: ev.task.date }) : ev.item ? setDetails(ev.item) : navigate('/sala/historico'))}
                onMove={(ev, d, start) => {
                  const a = byId(ev.key)
                  if (a) void move(a, d, start)
                }}
                onResize={(ev, duration) => {
                  const a = byId(ev.key)
                  if (a) void move(a, a.date, a.start, duration)
                }}
                onChip={(c) => (c.kind === 'review' ? navigate('/revisoes') : c.task ? setDraft({ task: c.task, date: c.task.date }) : undefined)}
                onToggleChip={(c) => {
                  const a = byId(c.key)
                  if (a) void toggle(a)
                }}
                onChipMove={(c, d) => {
                  const a = byId(c.key)
                  if (a) void move(a, d, null)
                }}
                onAdd={(d) => setDraft({ task: null, date: d })}
                onPickDay={(d) => (setAnchor(d), setView('day'))}
              />
            )}
            {view !== 'month' && !loading && <p className="mt-2 text-xs text-muted">Clique num horário para criar · arraste para mover (também entre dias) · puxe a borda de baixo para mudar a duração.</p>}
            {conflictIds.size > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                <AlertTriangle className="size-3.5" aria-hidden /> Há atividades com horários sobrepostos (marcadas em vermelho). Arraste uma delas para resolver.
              </p>
            )}
          </div>

          <div className="space-y-5 xl:col-start-2 xl:row-start-2">
            <ActiveCycleCard />
            <ContinueCourseCard />
            <ContinueCard tz={tz} extra={<LastReadLine />} />
            <TodayRoutine hideWhenEmpty />
            <CguToday onlyWhenInUse />
            <InboxCard onOrganize={organize} />
            <WeekSummary activities={weekActivities} overdue={overdue.length} studiedBySubject={weekStats.stats.bySubject} studiedTotal={weekStats.stats.total} availableMinutes={availableMinutes} onAvailability={() => void ensurePlanThenEdit()} />
          </div>
        </div>
      )}

      <TaskDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onStart={(t) => {
          const a = byId(`task:${t.id}`)
          if (a) startActivity(a)
        }}
      />
      <BlockDetails item={details} onClose={() => setDetails(null)} onEdit={(it) => (setDetails(null), setItemForm(it))} />
      {itemForm && (plans.data ?? []).some((p) => p.id === itemForm.plan_id) && <PlanItemForm open plan={(plans.data ?? []).find((p) => p.id === itemForm.plan_id)!} item={itemForm} onClose={() => setItemForm(null)} />}
      <ReplanDialog open={replanOpen} onClose={() => setReplanOpen(false)} activities={activities} options={replanOptions} insights={insights} />
      <WeekTools open={toolsOpen} onClose={() => setToolsOpen(false)} weekStart={startOfWeek(anchor)} />
      {proposalPlan && <ProposalModal open plan={proposalPlan} today={today} onClose={() => setProposalPlan(null)} />}
      {copyBlocks && activePlan && <CopyBlocksModal open plan={activePlan} anchor={anchor} onClose={() => setCopyBlocks(false)} />}
      <PlanEditor open={editorOpen} plan={activePlan} onClose={() => setEditorOpen(false)} onSaved={(p) => (setEditorOpen(false), setProposalPlan(p))} />
    </div>
  )
}

function Stat({ label, value, hint, attention, children }: { label: string; value: string | null; hint?: string; attention?: boolean; children?: ReactNode }) {
  return (
    <Card className="min-w-0 px-4 py-3">
      <p className="truncate text-[11px] font-medium text-muted">{label}</p>
      {value == null ? <Skeleton className="mt-1.5 h-7 w-16" /> : <p className="tabular mt-0.5 truncate text-2xl font-semibold tracking-tight text-ink">{value}</p>}
      {hint && <p className={cn('mt-0.5 truncate text-[11px]', attention ? 'font-medium text-accent' : 'text-muted')}>{hint}</p>}
      {children}
    </Card>
  )
}
