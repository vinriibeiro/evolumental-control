import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, CalendarClock, ChevronLeft, ChevronRight, Flag, Pencil, Play, Plus, Timer, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Card, ColorDot, PageHeader, Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useAll, useInsert, useRemove, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { useStudyStats } from '@/hooks/useStudyStats'
import { gte, lte } from '@/lib/data/types'
import { ACTIVITY_LABELS, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS, REVIEW_STATUS_LABELS, TASK_KIND_LABELS, WEEKDAY_SHORT } from '@/lib/labels'
import { netSeconds } from '@/lib/timer/engine'
import { addDays, addMonths, dayKey, eachDay, endOfMonth, formatDayKey, formatDuration, formatTime, startOfMonth, startOfWeek, todayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { CalendarTask, Review, StudyPlanItem, TaskKind } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'

type View = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [taskForm, setTaskForm] = useState<{ task: CalendarTask | null; date: string } | null>(null)
  const lookups = useLookups()

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
    return { from: startOfWeek(startOfMonth(anchor)), to: addDays(startOfWeek(endOfMonth(anchor)), 6) }
  }, [view, anchor])

  const sessions = useStudyStats(range)
  const plan = useAll('study_plan_items', { filters: [gte('date', range.from), lte('date', range.to)], order: [{ column: 'start_time' }] }, { keepPrevious: true })
  const tasks = useAll('calendar_tasks', { filters: [gte('date', range.from), lte('date', range.to)], order: [{ column: 'start_time' }] }, { keepPrevious: true })
  const reviews = useAll('reviews', { filters: [gte('scheduled_for', range.from), lte('scheduled_for', range.to)] }, { keepPrevious: true })
  const goals = useAll('study_goals', { filters: [gte('end_date', range.from), lte('end_date', range.to)] }, { keepPrevious: true })

  const deadlines = useMemo(() => lookups.subjects.filter((s) => s.target_date && s.target_date >= range.from && s.target_date <= range.to), [lookups.subjects, range])

  const byDay = (d: string): DayData => ({
    studied: sessions.stats.byDay.get(d) ?? 0,
    sessions: (sessions.data ?? []).filter((s) => dayKey(new Date(s.started_at).getTime(), tz) === d),
    plan: (plan.data ?? []).filter((p) => p.date === d),
    tasks: (tasks.data ?? []).filter((t) => t.date === d),
    reviews: (reviews.data ?? []).filter((r) => r.scheduled_for === d),
    deadlines: [
      ...deadlines.filter((s) => s.target_date === d).map((s) => `Conclusão prevista: ${s.name}`),
      ...(goals.data ?? []).filter((g) => g.end_date === d).map((g) => `Fim da meta: ${g.title ?? 'meta'}`),
    ],
  })

  const shift = (dir: 1 | -1) => {
    const next = view === 'day' ? addDays(anchor, dir) : view === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir)
    setAnchor(next)
    if (view !== 'month') setSelected(next)
  }
  const loading = sessions.isPending || plan.isPending || tasks.isPending

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Sessões realizadas, blocos planejados, revisões, tarefas e prazos."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setTaskForm({ task: null, date: selected })}>
            Nova tarefa
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Visualização"
          value={view}
          onChange={(v) => {
            setView(v)
            setAnchor(selected)
          }}
          options={[
            { value: 'month', label: 'Mês' },
            { value: 'week', label: 'Semana' },
            { value: 'day', label: 'Dia' },
          ]}
        />
        <div className="flex items-center gap-1">
          <IconButton size="sm" label="Anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <button
            className="px-2 text-sm font-medium text-ink capitalize"
            onClick={() => {
              setAnchor(today)
              setSelected(today)
            }}
            title="Ir para hoje"
          >
            {view === 'month' ? formatDayKey(startOfMonth(anchor), 'month') : view === 'week' ? `${formatDayKey(range.from)} – ${formatDayKey(range.to)}` : formatDayKey(anchor, 'long')}
          </button>
          <IconButton size="sm" label="Próximo" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {loading ? (
            <Spinner />
          ) : view === 'day' ? (
            <DayDetails day={anchor} data={byDay(anchor)} today={today} onEditTask={(t) => setTaskForm({ task: t, date: t.date })} />
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <span key={d}>{WEEKDAY_SHORT[d]}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {eachDay(range.from, range.to).map((d) => {
                  const data = byDay(d)
                  const out = view === 'month' && d.slice(0, 7) !== anchor.slice(0, 7)
                  return (
                    <button
                      key={d}
                      onClick={() => setSelected(d)}
                      aria-pressed={selected === d}
                      aria-label={`${formatDayKey(d, 'long')}${data.studied ? `, ${formatDuration(data.studied)} estudados` : ''}`}
                      className={cn(
                        'flex min-w-0 flex-col items-stretch gap-0.5 rounded-lg border p-1.5 text-left transition-colors',
                        view === 'week' ? 'min-h-40' : 'min-h-20 sm:min-h-24',
                        selected === d ? 'border-accent-strong bg-accent/15' : d === today ? 'border-accent' : 'border-line hover:bg-surface',
                        out && 'opacity-40',
                      )}
                    >
                      <span className={cn('text-xs font-semibold', d === today ? 'text-accent-strong' : 'text-ink')}>{Number(d.slice(8))}</span>
                      {data.studied > 0 && <span className="tabular truncate rounded bg-success/15 px-1 text-[10px] font-medium text-success">{formatDuration(data.studied)}</span>}
                      <span className="flex flex-wrap gap-0.5">
                        {data.plan.slice(0, view === 'week' ? 12 : 4).map((p) => (
                          <ColorDot key={p.id} color={lookups.subjectColor(p.subject_id)} className="size-1.5 sm:size-2" />
                        ))}
                      </span>
                      {view === 'week' &&
                        data.plan.slice(0, 5).map((p) => (
                          <span key={p.id} className="truncate text-[10px] text-muted">
                            {p.start_time} {lookups.subjectName(p.subject_id)}
                          </span>
                        ))}
                      {data.reviews.length > 0 && <span className="truncate text-[10px] text-info">{data.reviews.length} revisão(ões)</span>}
                      {data.tasks.length > 0 && <span className="truncate text-[10px] text-ink">{data.tasks.length} tarefa(s)</span>}
                      {data.deadlines.length > 0 && <Flag className="size-3 text-danger" aria-label="Prazo" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {view !== 'day' && (
          <aside className="min-w-0">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{formatDayKey(selected, 'long')}</h2>
                <IconButton size="sm" label="Adicionar tarefa neste dia" onClick={() => setTaskForm({ task: null, date: selected })}>
                  <Plus className="size-4" />
                </IconButton>
              </div>
              <DayDetails day={selected} data={byDay(selected)} today={today} onEditTask={(t) => setTaskForm({ task: t, date: t.date })} compact />
            </Card>
          </aside>
        )}
      </div>
      <TaskForm open={Boolean(taskForm)} task={taskForm?.task ?? null} date={taskForm?.date ?? today} onClose={() => setTaskForm(null)} />
    </div>
  )
}

interface DayData {
  studied: number
  sessions: SessionWithPauses[]
  plan: StudyPlanItem[]
  tasks: CalendarTask[]
  reviews: Review[]
  deadlines: string[]
}

function DayDetails({ day, data, onEditTask, compact, today }: { day: string; data: DayData; onEditTask: (t: CalendarTask) => void; compact?: boolean; today: string }) {
  const lookups = useLookups()
  const settings = useSettings()
  const tz = settings.timezone
  const navigate = useNavigate()
  const updateTask = useUpdate('calendar_tasks')
  const removeTask = useRemove('calendar_tasks')
  const confirm = useConfirm()
  const empty = !data.sessions.length && !data.plan.length && !data.tasks.length && !data.reviews.length && !data.deadlines.length
  if (empty) return <p className="py-6 text-center text-sm text-muted">Nada registrado neste dia.</p>
  return (
    <div className={cn('space-y-5', !compact && 'max-w-3xl')}>
      {data.deadlines.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted uppercase">
            <Flag className="size-3.5" /> Prazos
          </h3>
          <ul className="space-y-1 text-sm text-ink">
            {data.deadlines.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      {data.sessions.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted uppercase">
            <Timer className="size-3.5" /> Sessões realizadas · {formatDuration(data.studied)}
          </h3>
          <ul className="space-y-1.5">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <ColorDot color={lookups.subjectColor(s.subject_id)} />
                <span className="tabular w-12 shrink-0 text-xs text-muted">{formatTime(new Date(s.started_at).getTime(), tz, settings.hourFormat)}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {lookups.subjectName(s.subject_id)} <span className="text-muted">· {ACTIVITY_LABELS[s.activity_type]}</span>
                </span>
                <span className="tabular text-xs font-medium text-ink">{formatDuration(netSeconds(s, s.pauses))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.plan.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted uppercase">
            <CalendarClock className="size-3.5" /> Blocos do cronograma
          </h3>
          <ul className="space-y-1.5">
            {data.plan.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <ColorDot color={lookups.subjectColor(p.subject_id)} />
                <span className="tabular w-12 shrink-0 text-xs text-muted">{p.start_time}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {lookups.subjectName(p.subject_id)} <span className="text-muted">· {p.duration_minutes} min</span>
                </span>
                {p.status === 'pending' && day >= today ? (
                  <IconButton size="sm" label="Iniciar estudo deste bloco" onClick={() => navigate(`/cronometro?bloco=${p.id}`)}>
                    <Play className="size-3.5" />
                  </IconButton>
                ) : (
                  <span className="text-[11px]" style={{ color: PLAN_STATUS_COLORS[p.status] }}>
                    {PLAN_STATUS_LABELS[p.status]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.reviews.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted uppercase">
            <Brain className="size-3.5" /> Revisões
          </h3>
          <ul className="space-y-1 text-sm">
            {data.reviews.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="truncate text-ink">{r.title}</span>
                <span className="shrink-0 text-xs text-muted">{REVIEW_STATUS_LABELS[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.tasks.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted uppercase">Tarefas</h3>
          <ul className="space-y-1.5">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <Checkbox
                  className="min-w-0 flex-1"
                  label={
                    <span className={cn('truncate', t.done && 'text-muted line-through')}>
                      {t.start_time ? `${t.start_time} · ` : ''}
                      {t.title} <span className="text-xs text-muted">({TASK_KIND_LABELS[t.kind]})</span>
                    </span>
                  }
                  checked={t.done}
                  onChange={(e) => updateTask.mutate({ id: t.id, patch: { done: e.target.checked } })}
                />
                <IconButton size="sm" label="Editar tarefa" onClick={() => onEditTask(t)}>
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  size="sm"
                  label="Excluir tarefa"
                  onClick={async () => {
                    if (await confirm({ title: 'Excluir tarefa?', message: t.title, danger: true, confirmLabel: 'Excluir' })) removeTask.mutate(t.id)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TaskForm({ open, task, date, onClose }: { open: boolean; task: CalendarTask | null; date: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [d, setD] = useState(date)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [kind, setKind] = useState<TaskKind>('task')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [error, setError] = useState<string | null>(null)
  const insert = useInsert('calendar_tasks')
  const update = useUpdate('calendar_tasks')
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setD(task?.date ?? date)
    setTime(task?.start_time ?? '')
    setDuration(task?.duration_minutes ? String(task.duration_minutes) : '')
    setKind(task?.kind ?? 'task')
    setLink({ subjectId: task?.subject_id ?? null, topicId: task?.topic_id ?? null })
    setError(null)
  }, [open, task, date])
  const save = async () => {
    if (!title.trim()) return setError('Informe o título.')
    const dur = duration ? Number(duration) : null
    if (dur != null && (!Number.isInteger(dur) || dur < 1 || dur > 1440)) return setError('Duração entre 1 e 1440 minutos.')
    const data = { title: title.trim().slice(0, 300), description: description.trim() || null, date: d, start_time: time || null, duration_minutes: dur, kind, subject_id: link.subjectId, topic_id: link.topicId }
    try {
      if (task) await update.mutateAsync({ id: task.id, patch: data })
      else await insert.mutateAsync(data)
      toast.success('Tarefa salva.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Título" required error={error}>
          {(id, dsc) => <Input id={id} aria-describedby={dsc} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Prova do TRF, entregar redação…" />}
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Data">{(id) => <Input id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}</Field>
          <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Duração (min)">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
                {Object.entries(TASK_KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
        <Field label="Descrição">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
