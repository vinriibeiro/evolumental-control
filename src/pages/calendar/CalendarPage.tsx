// Calendário / Planejamento com grade de horários de 30 em 30 minutos.
// Blocos do cronograma podem ser criados clicando num horário, arrastados
// para outro dia/horário e redimensionados pela borda inferior (sempre em
// passos de 30 min). Camadas: planejamento, histórico (sessões realizadas),
// revisões e tarefas.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Brain, CalendarClock, Check, ChevronLeft, ChevronRight, CircleDashed, Flag, Pencil, Play, Plus, RotateCcw, Settings2, Sparkles, Trash2, X } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Select } from '@/components/ui/Field'
import { Badge, Card, Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import { invalidateTables, useAll, useUpdate } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { useNow } from '@/hooks/useNow'
import { useSettings } from '@/hooks/useSettings'
import { useStudyStats } from '@/hooks/useStudyStats'
import { eq, gte, inList, lt, lte } from '@/lib/data/types'
import { ACTIVITY_LABELS, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS, WEEKDAY_SHORT } from '@/lib/labels'
import { conflictsWith, defaultPlanConfig, replanLate } from '@/lib/planner'
import { layoutDay, snap } from '@/lib/calendarLayout'
import { netSeconds } from '@/lib/timer/engine'
import {
  addDays,
  addMonths,
  dayKey,
  eachDay,
  endOfMonth,
  formatDayKey,
  formatDuration,
  hhmmToMinutes,
  minutesToHhmm,
  startOfMonth,
  startOfWeek,
  todayKey,
  zonedDayStart,
  type DayKey,
} from '@/lib/time'
import { cn } from '@/lib/cn'
import type { CalendarTask, PlanItemStatus, StudyPlan, StudyPlanItem } from '@/types/db'
import { PlanItemForm } from '@/pages/schedule/PlanItemForm'
import { PlanEditor } from '@/pages/schedule/PlanEditor'
import { ProposalModal } from '@/pages/schedule/SchedulePage'
import { TaskForm } from './TaskForm'

type View = 'week' | 'day' | 'month'
interface Layers {
  plan: boolean
  history: boolean
  reviews: boolean
  tasks: boolean
}
const SLOT = 22 // px por 30 minutos
const DEFAULT_LAYERS: Layers = { plan: true, history: true, reviews: true, tasks: true }

function readPref<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...def, ...JSON.parse(v) } : def
  } catch {
    return def
  }
}
function writePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* preferência apenas deste dispositivo */
  }
}

interface CalEvent {
  key: string
  kind: 'plan' | 'session' | 'task'
  date: DayKey
  start: number
  end: number
  title: string
  subtitle?: string
  color: string
  item?: StudyPlanItem
  task?: CalendarTask
  status?: PlanItemStatus
}

export default function CalendarPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'))
  const [anchor, setAnchor] = useState(today)
  const [layers, setLayers] = useState<Layers>(() => readPref('evl:cal-layers', DEFAULT_LAYERS))
  const [hours, setHours] = useState(() => readPref('evl:cal-hours', { start: 6, end: 24 }))
  const [itemForm, setItemForm] = useState<{ item: StudyPlanItem | null; date: string; time?: string } | null>(null)
  const [details, setDetails] = useState<StudyPlanItem | null>(null)
  const [taskForm, setTaskForm] = useState<{ task: CalendarTask | null; date: string; time?: string } | null>(null)
  const [proposalPlan, setProposalPlan] = useState<StudyPlan | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const lookups = useLookups()
  const subjects = useSubjects()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  useEffect(() => writePref('evl:cal-layers', layers), [layers])
  useEffect(() => writePref('evl:cal-hours', hours), [hours])

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === 'week') return eachDay(startOfWeek(anchor), addDays(startOfWeek(anchor), 6))
    return eachDay(startOfWeek(startOfMonth(anchor)), addDays(startOfWeek(endOfMonth(anchor)), 6))
  }, [view, anchor])
  const range = { from: days[0], to: days[days.length - 1] }

  const plans = useAll('study_plans', { order: [{ column: 'created_at' }] })
  const items = useAll('study_plan_items', { filters: [gte('date', range.from), lte('date', range.to)], order: [{ column: 'start_time' }] }, { keepPrevious: true })
  const sessions = useStudyStats(range)
  const reviews = useAll('reviews', { filters: [gte('scheduled_for', range.from), lte('scheduled_for', range.to), inList('status', ['planned', 'postponed', 'done'])] }, { keepPrevious: true })
  const tasks = useAll('calendar_tasks', { filters: [gte('date', range.from), lte('date', range.to)] }, { keepPrevious: true })
  const monthItems = useAll('study_plan_items', { filters: [gte('date', startOfWeek(startOfMonth(anchor))), lte('date', addDays(startOfWeek(endOfMonth(anchor)), 6))] }, { keepPrevious: true })
  const activePlan = (plans.data ?? []).find((p) => p.status === 'active') ?? plans.data?.[0] ?? null

  const minutesOf = (ms: number) => Math.round((ms - zonedDayStart(dayKey(ms, tz), tz)) / 60000)

  const events = useMemo(() => {
    const out: CalEvent[] = []
    if (layers.plan)
      for (const it of items.data ?? []) {
        if (it.status === 'rescheduled') continue
        const start = hhmmToMinutes(it.start_time)
        out.push({
          key: `p-${it.id}`,
          kind: 'plan',
          date: it.date,
          start,
          end: Math.min(24 * 60, start + it.duration_minutes),
          title: lookups.subjectName(it.subject_id),
          subtitle: it.topic_id ? lookups.topicName(it.topic_id) : ACTIVITY_LABELS[it.activity_type],
          color: lookups.subjectColor(it.subject_id),
          item: it,
          status: it.status,
        })
      }
    if (layers.history)
      for (const s of sessions.data ?? []) {
        const startMs = new Date(s.started_at).getTime()
        const endMs = s.ended_at ? new Date(s.ended_at).getTime() : startMs
        const date = dayKey(startMs, tz)
        const start = minutesOf(startMs)
        const end = date === dayKey(endMs, tz) ? Math.max(start + 15, minutesOf(endMs)) : 24 * 60
        out.push({ key: `s-${s.id}`, kind: 'session', date, start, end, title: lookups.subjectName(s.subject_id), subtitle: `Realizado · ${formatDuration(netSeconds(s, s.pauses))}`, color: lookups.subjectColor(s.subject_id) })
      }
    if (layers.tasks)
      for (const t of tasks.data ?? []) {
        if (!t.start_time) continue
        const start = hhmmToMinutes(t.start_time)
        out.push({ key: `t-${t.id}`, kind: 'task', date: t.date, start, end: Math.min(24 * 60, start + (t.duration_minutes ?? 30)), title: t.title, subtitle: 'Tarefa', color: 'var(--muted)', task: t })
      }
    return out
  }, [items.data, sessions.data, tasks.data, layers, lookups, tz]) // eslint-disable-line react-hooks/exhaustive-deps

  const allDay = (d: DayKey) => [
    ...(layers.reviews ? (reviews.data ?? []).filter((r) => r.scheduled_for === d).map((r) => ({ key: r.id, label: r.title, kind: 'review' as const, done: r.status === 'done' })) : []),
    ...(layers.tasks ? (tasks.data ?? []).filter((t) => t.date === d && !t.start_time).map((t) => ({ key: t.id, label: t.title, kind: 'task' as const, done: t.done, task: t })) : []),
    ...lookups.subjects.filter((s) => s.target_date === d).map((s) => ({ key: `dl-${s.id}`, label: `Prazo: ${s.name}`, kind: 'deadline' as const, done: false })),
  ]

  // ---------------------------------------------------------------- ações
  const ensurePlan = async (): Promise<StudyPlan> => {
    if (activePlan) return activePlan
    const config = { ...defaultPlanConfig(), subjectIds: (subjects.data ?? []).map((s) => s.id) }
    const [p] = await backend.insert('study_plans', [{ name: 'Meu planejamento', start_date: today, end_date: addDays(today, 364), config, status: 'active' }])
    await invalidateTables(qc, ['study_plans'])
    return p
  }

  const run = async (fn: () => Promise<unknown>, tables = ['study_plan_items']) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, tables)
    }
  }

  const moveItem = async (it: StudyPlanItem, date: DayKey, start: number, duration = it.duration_minutes) => {
    const start_time = minutesToHhmm(Math.max(0, Math.min(24 * 60 - 30, start)))
    if (date === it.date && start_time === it.start_time && duration === it.duration_minutes) return
    const { rows } = await backend.list('study_plan_items', { filters: [eq('date', date)] })
    const clash = conflictsWith({ id: it.id, date, start_time, duration_minutes: duration }, rows.filter((r) => r.status !== 'rescheduled'))
    if (clash.length && !(await confirm({ title: 'Horário ocupado', message: `Já há ${clash.length} bloco(s) neste horário. Manter os dois?`, confirmLabel: 'Manter assim' }))) return
    await run(() => backend.update('study_plan_items', [eq('id', it.id)], { date, start_time, duration_minutes: duration }))
  }

  const openNewBlock = async (date: DayKey, minutes?: number) => {
    try {
      await ensurePlan()
      setItemForm({ item: null, date, time: minutes != null ? minutesToHhmm(minutes) : undefined })
    } catch (e) {
      toast.error(e)
    }
  }

  const planAuto = async () => {
    if (!activePlan) return setEditorOpen(true)
    setProposalPlan(activePlan)
  }

  const replan = async () => {
    const { rows: late } = await backend.list('study_plan_items', { filters: [eq('status', 'pending'), lt('date', today)] })
    if (late.length === 0) return toast.info('Nenhum bloco atrasado para replanejar.')
    const { rows: future } = await backend.list('study_plan_items', { filters: [gte('date', today), lte('date', addDays(today, 70))] })
    const nowMin = minutesOf(Date.now())
    const moves = replanLate(late, future.filter((f) => f.status !== 'rescheduled'), today, nowMin, activePlan?.config.availability)
    if (!(await confirm({ title: 'Replanejar blocos atrasados?', message: `${late.length} bloco(s) pendente(s) ficaram para trás. ${moves.length} será(ão) movido(s) para o próximo horário livre (mesmo horário, a partir de agora).${late.length > moves.length ? ` ${late.length - moves.length} não encontraram vaga nos próximos 60 dias.` : ''}`, confirmLabel: 'Replanejar' })))
      return
    await run(async () => {
      // Em paralelo, em grupos, para não esperar uma ida ao servidor por bloco.
      for (let i = 0; i < moves.length; i += 20) await Promise.all(moves.slice(i, i + 20).map((m) => backend.update('study_plan_items', [eq('id', m.id)], { date: m.date })))
      toast.success(`${moves.length} bloco(s) replanejado(s).`)
    })
  }

  const removeRange = async () => {
    const { rows } = await backend.list('study_plan_items', { filters: [gte('date', range.from), lte('date', range.to), eq('status', 'pending')] })
    if (rows.length === 0) return toast.info('Não há blocos pendentes neste período.')
    if (!(await confirm({ title: 'Remover blocos do período?', message: `${rows.length} bloco(s) pendente(s) entre ${formatDayKey(range.from)} e ${formatDayKey(range.to)} serão removidos. Blocos concluídos, parciais e não realizados ficam no histórico.`, danger: true, confirmLabel: 'Remover' })))
      return
    await run(async () => {
      await backend.remove('study_plan_items', [gte('date', range.from), lte('date', range.to), eq('status', 'pending')])
      toast.success(`${rows.length} bloco(s) removido(s).`)
    })
  }

  const shift = (dir: 1 | -1) => setAnchor(view === 'day' ? addDays(anchor, dir) : view === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir))
  const title = view === 'day' ? formatDayKey(anchor, 'long') : view === 'week' ? `${formatDayKey(days[0])} – ${formatDayKey(days[6])}` : formatDayKey(startOfMonth(anchor), 'month')
  const loading = items.isPending || sessions.isPending

  return (
    <div className="flex gap-5">
      <aside className="hidden w-60 shrink-0 space-y-4 lg:block">
        <MiniCalendar anchor={anchor} today={today} onPick={(d) => setAnchor(d)} marked={new Set((monthItems.data ?? []).map((i) => i.date))} />
        <Card className="p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Minhas agendas</p>
          <div className="flex flex-col gap-2">
            <Checkbox label="Planejamento" checked={layers.plan} onChange={(e) => setLayers({ ...layers, plan: e.target.checked })} />
            <Checkbox label="Histórico (realizado)" checked={layers.history} onChange={(e) => setLayers({ ...layers, history: e.target.checked })} />
            <Checkbox label="Revisões" checked={layers.reviews} onChange={(e) => setLayers({ ...layers, reviews: e.target.checked })} />
            <Checkbox label="Tarefas" checked={layers.tasks} onChange={(e) => setLayers({ ...layers, tasks: e.target.checked })} />
          </div>
        </Card>
        <Card className="p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Horário exibido</p>
          <div className="flex items-center gap-2 text-sm">
            <Select aria-label="Início" className="h-8 min-w-0 flex-1 px-2 pr-7 text-xs" value={hours.start} onChange={(e) => setHours({ ...hours, start: Math.min(Number(e.target.value), hours.end - 2) })}>
              {Array.from({ length: 23 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </Select>
            <span className="text-muted">às</span>
            <Select aria-label="Fim" className="h-8 min-w-0 flex-1 px-2 pr-7 text-xs" value={hours.end} onChange={(e) => setHours({ ...hours, end: Math.max(Number(e.target.value), hours.start + 2) })}>
              {Array.from({ length: 23 }, (_, i) => i + 2).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </Select>
          </div>
          {activePlan && (
            <Button size="sm" variant="ghost" className="mt-3 w-full justify-start" icon={<Settings2 className="size-4" />} onClick={() => setEditorOpen(true)}>
              Disponibilidade e matérias
            </Button>
          )}
        </Card>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-xl font-semibold tracking-tight text-ink">Planejamento</h1>
          <Segmented
            label="Visualização"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Diária' },
              { value: 'week', label: 'Semanal' },
              { value: 'month', label: 'Mensal' },
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
          <span className="inline-block text-sm font-medium text-ink first-letter:uppercase">{title}</span>
          <span className="flex-1" />
          <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => openNewBlock(view === 'day' ? anchor : today < days[0] || today > days[days.length - 1] ? days[0] : today, 19 * 60)}>
            Bloco
          </Button>
          <Button size="sm" icon={<Sparkles className="size-4" />} onClick={planAuto} disabled={busy}>
            Planejar
          </Button>
          <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={replan} disabled={busy}>
            Replanejar
          </Button>
          <Button size="sm" icon={<Trash2 className="size-4" />} onClick={removeRange} disabled={busy}>
            Remover
          </Button>
        </div>

        {loading ? (
          <Spinner />
        ) : view === 'month' ? (
          <MonthGrid days={days} anchor={anchor} today={today} items={layers.plan ? (items.data ?? []) : []} studied={layers.history ? sessions.stats.byDay : new Map()} onPick={(d) => (setAnchor(d), setView('day'))} />
        ) : (
          <TimeGrid
            days={days}
            today={today}
            tz={tz}
            hours={hours}
            events={events}
            allDay={allDay}
            onSlot={(d, m) => openNewBlock(d, m)}
            onOpen={(ev) => {
              if (ev.item) setDetails(ev.item)
              else if (ev.task) setTaskForm({ task: ev.task, date: ev.task.date })
            }}
            onMove={(ev, d, start) => ev.item && moveItem(ev.item, d, start)}
            onResize={(ev, duration) => ev.item && moveItem(ev.item, ev.item.date, hhmmToMinutes(ev.item.start_time), duration)}
            onAllDay={(c) => (c.kind === 'review' ? navigate('/revisoes') : c.kind === 'task' && c.task ? setTaskForm({ task: c.task, date: c.task.date }) : undefined)}
            onAddTask={(d) => setTaskForm({ task: null, date: d })}
          />
        )}
        <p className="mt-2 text-xs text-muted">Clique num horário vazio para criar um bloco · arraste para mover · puxe a borda de baixo para mudar a duração (passos de 30 min).</p>
      </div>

      {itemForm && activePlan && <PlanItemForm open plan={activePlan} item={itemForm.item} defaultDate={itemForm.date} defaultTime={itemForm.time} defaultDuration={60} onClose={() => setItemForm(null)} />}
      <BlockDetails item={details} onClose={() => setDetails(null)} onEdit={(it) => (setDetails(null), activePlan && setItemForm({ item: it, date: it.date }))} />
      <TaskForm open={Boolean(taskForm)} task={taskForm?.task ?? null} date={taskForm?.date ?? today} defaultTime={taskForm?.time} onClose={() => setTaskForm(null)} />
      {proposalPlan && <ProposalModal open plan={proposalPlan} today={today} onClose={() => setProposalPlan(null)} />}
      <PlanEditor open={editorOpen} plan={activePlan} onClose={() => setEditorOpen(false)} onSaved={(p) => (setEditorOpen(false), setProposalPlan(p))} />
    </div>
  )
}

// ---------------------------------------------------------------------
// Grade de horários
// ---------------------------------------------------------------------
type AllDayChip = { key: string; label: string; kind: 'review' | 'task' | 'deadline'; done: boolean; task?: CalendarTask }

function TimeGrid(props: {
  days: DayKey[]
  today: DayKey
  tz: string
  hours: { start: number; end: number }
  events: CalEvent[]
  allDay: (d: DayKey) => AllDayChip[]
  onSlot: (d: DayKey, minutes: number) => void
  onOpen: (ev: CalEvent) => void
  onMove: (ev: CalEvent, d: DayKey, start: number) => void
  onResize: (ev: CalEvent, duration: number) => void
  onAllDay: (c: AllDayChip) => void
  onAddTask: (d: DayKey) => void
}) {
  const { days, today, hours, events } = props
  const now = useNow(60_000)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startMin = hours.start * 60
  const endMin = hours.end * 60
  const rows = (endMin - startMin) / 30
  const [drag, setDrag] = useState<{ ev: CalEvent; mode: 'move' | 'resize'; x0: number; y0: number; dayIdx: number; start: number; duration: number; moved: boolean } | null>(null)

  // Rola até 07:00 (ou agora) ao abrir.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = days.includes(today) ? Math.max(startMin, minutesNow(props.tz) - 120) : Math.max(startMin, 7 * 60)
    el.scrollTop = ((target - startMin) / 30) * SLOT
  }, [days.join(','), startMin]) // eslint-disable-line react-hooks/exhaustive-deps

  const colWidth = () => {
    const g = gridRef.current
    return g ? g.getBoundingClientRect().width / days.length : 100
  }

  type DragState = { ev: CalEvent; mode: 'move' | 'resize'; x0: number; y0: number; dayIdx: number; start: number; duration: number; moved: boolean }
  const dragRef = useRef<DragState | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const onPointerDown = (e: ReactPointerEvent, ev: CalEvent, mode: 'move' | 'resize') => {
    if (ev.kind !== 'plan' || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const d: DragState = { ev, mode, x0: e.clientX, y0: e.clientY, dayIdx: days.indexOf(ev.date), start: ev.start, duration: ev.end - ev.start, moved: false }
    dragRef.current = d
    setDrag(d)
  }

  // Durante o arrasto, ouve a janela inteira: o bloco pode mudar de coluna
  // (e ser recriado), então não dependemos de captura no elemento original.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const dy = e.clientY - cur.y0
      const dx = e.clientX - cur.x0
      const moved = cur.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4
      const deltaMin = snap((dy / SLOT) * 30)
      const days = propsRef.current.days
      let next: DragState
      if (cur.mode === 'move') {
        const dayIdx = Math.max(0, Math.min(days.length - 1, days.indexOf(cur.ev.date) + Math.round(dx / colWidth())))
        const start = Math.max(0, Math.min(24 * 60 - 30, snap(cur.ev.start + deltaMin)))
        next = { ...cur, dayIdx, start, moved }
      } else {
        const duration = Math.max(30, Math.min(24 * 60 - cur.ev.start, snap(cur.ev.end - cur.ev.start + deltaMin)))
        next = { ...cur, duration, moved }
      }
      dragRef.current = next
      setDrag(next)
    }
    const up = () => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      const p = propsRef.current
      if (!d.moved) return p.onOpen(d.ev)
      if (d.mode === 'move') p.onMove(d.ev, p.days[d.dayIdx], d.start)
      else p.onResize(d.ev, d.duration)
    }
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', cancel)
    }
  }, [dragging]) // eslint-disable-line react-hooks/exhaustive-deps

  // `now` (atualizado a cada minuto) mantém a linha do horário atual em dia.
  const nowMin = now ? minutesNow(props.tz) : 0

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho dos dias + itens de dia inteiro */}
      <div className="flex border-b border-line bg-surface">
        <div className="w-14 shrink-0" />
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const chips = props.allDay(d)
            return (
              <div key={d} className="min-w-0 border-l border-line px-1.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-xs font-semibold', d === today ? 'text-accent-strong' : 'text-ink')}>
                    {WEEKDAY_SHORT[new Date(`${d}T12:00:00Z`).getUTCDay()]}, {Number(d.slice(8))}
                  </span>
                  <button className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Nova tarefa em ${formatDayKey(d)}`} onClick={() => props.onAddTask(d)}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {chips.slice(0, 3).map((c) => (
                    <button
                      key={c.key}
                      onClick={() => props.onAllDay(c)}
                      className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px]', c.kind === 'review' ? 'bg-info/15 text-info' : c.kind === 'deadline' ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-ink', c.done && 'line-through opacity-60')}
                      title={c.label}
                    >
                      {c.kind === 'review' ? <Brain className="size-3 shrink-0" /> : c.kind === 'deadline' ? <Flag className="size-3 shrink-0" /> : <CalendarClock className="size-3 shrink-0" />}
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                  {chips.length > 3 && <span className="text-[10px] text-muted">+{chips.length - 3}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grade de 30 em 30 minutos */}
      <div ref={scrollRef} className="scroll-thin max-h-[calc(100dvh-var(--app-top,4rem)-13rem)] min-h-80 overflow-y-auto">
        <div className="relative flex" style={{ height: rows * SLOT }}>
          <div className="w-14 shrink-0">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="relative text-right" style={{ height: SLOT }}>
                {i % 2 === 0 && <span className="tabular absolute -top-1.5 right-2 text-[10px] text-muted">{minutesToHhmm(startMin + i * 30)}</span>}
              </div>
            ))}
          </div>
          <div ref={gridRef} className="relative grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, di) => {
              const dayEvents = events.filter((ev) => ev.date === d && ev.end > startMin && ev.start < endMin)
              const placed = layoutDay(dayEvents)
              return (
                <div key={d} className={cn('relative border-l border-line', d === today && 'bg-accent/5')}>
                  {Array.from({ length: rows }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={cn('block w-full border-line hover:bg-accent/10 focus-visible:bg-accent/10', i % 2 === 1 ? 'border-b' : 'border-b border-dashed border-b-[color-mix(in_srgb,var(--border)_60%,transparent)]')}
                      style={{ height: SLOT }}
                      aria-label={`Criar bloco em ${formatDayKey(d)} às ${minutesToHhmm(startMin + i * 30)}`}
                      onClick={() => props.onSlot(d, startMin + i * 30)}
                    />
                  ))}
                  {d === today && nowMin >= startMin && nowMin <= endMin && (
                    <div className="pointer-events-none absolute right-0 left-0 z-20 h-0.5 bg-danger" style={{ top: ((nowMin - startMin) / 30) * SLOT }}>
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
                    </div>
                  )}
                  {placed.map(({ event: ev, lane, lanes }) => {
                    const dragging = drag?.ev.key === ev.key
                    if (dragging && drag.mode === 'move' && drag.dayIdx !== di) return null
                    const start = dragging && drag.mode === 'move' ? drag.start : ev.start
                    const duration = dragging ? (drag.mode === 'resize' ? drag.duration : ev.end - ev.start) : ev.end - ev.start
                    return (
                      <EventBox
                        key={ev.key}
                        ev={ev}
                        top={((Math.max(start, startMin) - startMin) / 30) * SLOT}
                        height={Math.max(SLOT - 2, ((Math.min(start + duration, endMin) - Math.max(start, startMin)) / 30) * SLOT - 2)}
                        left={`calc(${(lane / lanes) * 100}% + 2px)`}
                        width={`calc(${100 / lanes}% - 4px)`}
                        dragging={dragging}
                        timeLabel={`${minutesToHhmm(start)}–${minutesToHhmm(start + duration)}`}
                        onPointerDown={onPointerDown}
                        onOpen={() => props.onOpen(ev)}
                      />
                    )
                  })}
                  {drag && drag.mode === 'move' && drag.dayIdx === di && drag.ev.date !== d && (
                    <EventBox
                      ev={drag.ev}
                      top={((drag.start - startMin) / 30) * SLOT}
                      height={((drag.ev.end - drag.ev.start) / 30) * SLOT - 2}
                      left="2px"
                      width="calc(100% - 4px)"
                      dragging
                      timeLabel={`${minutesToHhmm(drag.start)}–${minutesToHhmm(drag.start + drag.ev.end - drag.ev.start)}`}
                      onPointerDown={() => {}}
                      onOpen={() => {}}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function minutesNow(tz: string) {
  const ms = Date.now()
  return Math.round((ms - zonedDayStart(dayKey(ms, tz), tz)) / 60000)
}

function EventBox({
  ev,
  top,
  height,
  left,
  width,
  dragging,
  timeLabel,
  onPointerDown,
  onOpen,
}: {
  ev: CalEvent
  top: number
  height: number
  left: string
  width: string
  dragging?: boolean
  timeLabel: string
  onPointerDown: (e: ReactPointerEvent, ev: CalEvent, mode: 'move' | 'resize') => void
  onOpen: () => void
}) {
  const plan = ev.kind === 'plan'
  const session = ev.kind === 'session'
  const compact = height < 40
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ev.title}, ${timeLabel}${ev.status ? `, ${PLAN_STATUS_LABELS[ev.status]}` : ''}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      onPointerDown={(e) => (plan ? onPointerDown(e, ev, 'move') : undefined)}
      onClick={(e) => {
        e.stopPropagation()
        if (!plan) onOpen()
      }}
      className={cn(
        'absolute z-10 flex touch-none flex-col overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm select-none',
        plan ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        session && 'border-dashed',
        ev.status === 'done' && 'opacity-70',
        ev.status === 'missed' && 'border-dashed opacity-60',
        dragging && 'z-30 opacity-90 ring-2 ring-[var(--accent-strong)]',
      )}
      style={{
        top,
        height,
        left,
        width,
        background: session ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${ev.color} 14%, var(--bg)) 0 6px, color-mix(in srgb, ${ev.color} 22%, var(--bg)) 6px 12px)` : `color-mix(in srgb, ${ev.color} 24%, var(--bg))`,
        borderColor: `color-mix(in srgb, ${ev.color} 55%, var(--border))`,
        borderLeft: `3px solid ${ev.color}`,
      }}
    >
      <span className={cn('flex items-center gap-1 font-semibold text-ink', compact ? 'truncate' : 'line-clamp-2')}>
        {ev.status === 'done' && <Check className="size-3 shrink-0 text-success" />}
        {ev.status === 'partial' && <CircleDashed className="size-3 shrink-0 text-warning" />}
        {ev.status === 'missed' && <X className="size-3 shrink-0 text-danger" />}
        <span className="truncate">{ev.title}</span>
      </span>
      {!compact && <span className="truncate text-muted">{timeLabel}</span>}
      {!compact && ev.subtitle && height > 56 && <span className="truncate text-muted">{ev.subtitle}</span>}
      {plan && (
        <span
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation()
            onPointerDown(e, ev, 'resize')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Mês e minicalendário
// ---------------------------------------------------------------------
function MonthGrid({ days, anchor, today, items, studied, onPick }: { days: DayKey[]; anchor: DayKey; today: DayKey; items: StudyPlanItem[]; studied: Map<string, number>; onPick: (d: DayKey) => void }) {
  const lookups = useLookups()
  return (
    <Card className="p-2">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d}>{WEEKDAY_SHORT[d]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const list = items.filter((i) => i.date === d && i.status !== 'rescheduled').sort((a, b) => a.start_time.localeCompare(b.start_time))
          const out = d.slice(0, 7) !== anchor.slice(0, 7)
          return (
            <button key={d} onClick={() => onPick(d)} className={cn('flex min-h-24 min-w-0 flex-col gap-0.5 rounded-lg border p-1 text-left', d === today ? 'border-accent-strong' : 'border-line hover:bg-surface', out && 'opacity-40')}>
              <span className="flex items-center justify-between text-xs font-semibold text-ink">
                {Number(d.slice(8))}
                {(studied.get(d) ?? 0) > 0 && <span className="tabular rounded bg-success/15 px-1 text-[10px] font-medium text-success">{formatDuration(studied.get(d)!)}</span>}
              </span>
              {list.slice(0, 3).map((i) => (
                <span key={i.id} className="truncate rounded px-1 text-[10px] text-ink" style={{ background: `color-mix(in srgb, ${lookups.subjectColor(i.subject_id)} 24%, var(--bg))` }}>
                  {i.start_time} {lookups.subjectName(i.subject_id)}
                </span>
              ))}
              {list.length > 3 && <span className="text-[10px] text-muted">+{list.length - 3}</span>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function MiniCalendar({ anchor, today, onPick, marked }: { anchor: DayKey; today: DayKey; onPick: (d: DayKey) => void; marked: Set<string> }) {
  const [month, setMonth] = useState(startOfMonth(anchor))
  useEffect(() => setMonth(startOfMonth(anchor)), [anchor])
  const grid = eachDay(startOfWeek(month), addDays(startOfWeek(endOfMonth(month)), 6))
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <IconButton size="sm" label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <span className="inline-block text-sm font-semibold text-ink first-letter:uppercase">{formatDayKey(month, 'month')}</span>
        <IconButton size="sm" label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="size-4" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-muted">
            {d}
          </span>
        ))}
        {grid.map((d) => (
          <button
            key={d}
            onClick={() => onPick(d)}
            aria-label={formatDayKey(d, 'long')}
            aria-pressed={d === anchor}
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-md text-xs',
              d.slice(0, 7) !== month.slice(0, 7) ? 'text-muted/50' : 'text-ink',
              d === anchor ? 'bg-brown font-semibold text-wheat dark:bg-wheat dark:text-brown' : d === today ? 'font-semibold text-accent-strong' : 'hover:bg-surface-2',
            )}
          >
            {Number(d.slice(8))}
            {marked.has(d) && d !== anchor && <span className="absolute bottom-0.5 size-1 rounded-full bg-accent-strong" />}
          </button>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Detalhes de um bloco
// ---------------------------------------------------------------------
function BlockDetails({ item, onClose, onEdit }: { item: StudyPlanItem | null; onClose: () => void; onEdit: (it: StudyPlanItem) => void }) {
  const lookups = useLookups()
  const update = useUpdate('study_plan_items')
  const backend = useBackend()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  if (!item) return null
  const setStatus = (status: PlanItemStatus) =>
    update.mutateAsync({ id: item.id, patch: { status } }).then(() => (toast.success(`Marcado como ${PLAN_STATUS_LABELS[status].toLowerCase()}.`), onClose()), toast.error)
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={lookups.subjectName(item.subject_id)}
      description={`${formatDayKey(item.date, 'long')} · ${item.start_time}–${minutesToHhmm(hhmmToMinutes(item.start_time) + item.duration_minutes)} (${item.duration_minutes} min)`}
      footer={
        <>
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            onClick={async () => {
              try {
                await backend.remove('study_plan_items', [eq('id', item.id)])
                await invalidateTables(qc, ['study_plan_items'])
                onClose()
              } catch (e) {
                toast.error(e)
              }
            }}
          >
            Remover
          </Button>
          <Button icon={<Pencil className="size-4" />} onClick={() => onEdit(item)}>
            Editar
          </Button>
          <Button variant="dark" icon={<Play className="size-4" />} onClick={() => navigate(`/cronometro?bloco=${item.id}`)}>
            Iniciar estudo
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{ACTIVITY_LABELS[item.activity_type]}</Badge>
          {item.topic_id && <Badge>{lookups.topicName(item.topic_id)}</Badge>}
          <Badge color={PLAN_STATUS_COLORS[item.status]}>{PLAN_STATUS_LABELS[item.status]}</Badge>
        </div>
        {item.notes && <p className="text-sm whitespace-pre-wrap text-ink">{item.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {(['done', 'partial', 'missed', 'pending'] as PlanItemStatus[])
            .filter((s) => s !== item.status)
            .map((s) => (
              <Button key={s} size="sm" onClick={() => setStatus(s)}>
                {PLAN_STATUS_LABELS[s]}
              </Button>
            ))}
        </div>
      </div>
    </Modal>
  )
}
