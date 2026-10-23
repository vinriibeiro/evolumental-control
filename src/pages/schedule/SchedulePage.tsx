import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Copy, Info, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge, Card, ColorDot, LoadMore, PageHeader, Segmented } from '@/components/ui/layout'
import { PlanVsDoneCard } from '@/components/insight/PlanVsDoneCard'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, Spinner, useToast } from '@/components/ui/feedback'
import { SortableItem, SortableList } from '@/components/Sortable'
import { useSafeDelete } from '@/components/useSafeDelete'
import { invalidateTables, useAll, useList, useUpdate } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, inList, lte } from '@/lib/data/types'
import { ACTIVITY_LABELS, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS, WEEKDAY_SHORT } from '@/lib/labels'
import { PLANNER_RULES, diffPlan, findConflicts, generatePlan, type PlannedBlock } from '@/lib/planner'
import { addDays, addMonths, eachDay, endOfMonth, formatDayKey, formatDuration, startOfMonth, startOfWeek, todayKey, weekday } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { PlanItemStatus, StudyPlan, StudyPlanItem } from '@/types/db'
import { PlanEditor } from './PlanEditor'
import { PlanItemForm } from './PlanItemForm'

type View = 'day' | 'week' | 'month' | 'list'

export default function SchedulePage() {
  const plans = useAll('study_plans', { order: [{ column: 'created_at', ascending: false }] })
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const [planId, setPlanId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ plan: StudyPlan | null } | null>(null)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(today)
  const [itemForm, setItemForm] = useState<{ item: StudyPlanItem | null; date?: string } | null>(null)
  const safeDelete = useSafeDelete('study_plans')
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()

  const plan = (plans.data ?? []).find((p) => p.id === planId) ?? (plans.data ?? []).find((p) => p.status === 'active') ?? plans.data?.[0] ?? null
  useEffect(() => {
    if (plan && plan.id !== planId) setPlanId(plan.id)
  }, [plan, planId])

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
    if (view === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    return null
  }, [view, anchor])

  const items = useAll('study_plan_items', { filters: [eq('plan_id', plan?.id ?? ''), ...(range ? [gte('date', range.from), lte('date', range.to)] : [])], order: [{ column: 'date' }, { column: 'start_time' }] }, { enabled: Boolean(plan) && view !== 'list', keepPrevious: true })

  const duplicate = async (p: StudyPlan) => {
    try {
      const [copy] = await backend.insert('study_plans', [{ name: `${p.name} (cópia)`.slice(0, 160), description: p.description, start_date: p.start_date, end_date: p.end_date, config: p.config, status: 'active' }])
      const { rows } = await backend.list('study_plan_items', { filters: [eq('plan_id', p.id)] })
      const copies = rows.map((r) => ({ plan_id: copy.id, date: r.date, start_time: r.start_time, duration_minutes: r.duration_minutes, subject_id: r.subject_id, topic_id: r.topic_id, activity_type: r.activity_type, notes: r.notes }))
      for (let i = 0; i < copies.length; i += 500) await backend.insert('study_plan_items', copies.slice(i, i + 500))
      setPlanId(copy.id)
      toast.success('Cronograma duplicado (blocos voltaram a "pendente").')
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_plans', 'study_plan_items'])
    }
  }

  const shift = (dir: 1 | -1) => setAnchor(view === 'day' ? addDays(anchor, dir) : view === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir))

  return (
    <div>
      <PageHeader
        title="Cronograma de estudos"
        description="Planeje blocos na sua disponibilidade, manualmente ou com a distribuição automática."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditor({ plan: null })}>
            Novo cronograma
          </Button>
        }
      />
      <PlanVsDoneCard />
      <QueryState query={plans}>
        {!plan ? (
          <EmptyState
            icon={<CalendarRange className="size-8" />}
            title="Nenhum cronograma criado"
            description="Informe seus dias e horários disponíveis e as matérias; o sistema propõe a distribuição e você ajusta como quiser."
            action={
              <Button variant="primary" onClick={() => setEditor({ plan: null })}>
                Criar cronograma
              </Button>
            }
          />
        ) : (
          <>
            <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
              <Select aria-label="Cronograma" className="w-auto max-w-full min-w-48" value={plan.id} onChange={(e) => setPlanId(e.target.value)}>
                {plans.data!.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted">
                {formatDayKey(plan.start_date)} – {formatDayKey(plan.end_date)} · blocos de {plan.config.blockMinutes} min
              </span>
              <span className="flex-1" />
              <Button size="sm" icon={<Sparkles className="size-4" />} onClick={() => setProposalOpen(true)}>
                Gerar proposta
              </Button>
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setItemForm({ item: null, date: view === 'day' ? anchor : undefined })}>
                Bloco
              </Button>
              <ActionMenu label="Ações do cronograma">
                {(close) => (
                  <>
                    <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setEditor({ plan }))}>
                      Editar configuração
                    </MenuItem>
                    <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), void duplicate(plan))}>
                      Duplicar
                    </MenuItem>
                    <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void safeDelete(plan.id, plan.name, { onDone: () => setPlanId(null) }))}>
                      Excluir
                    </MenuItem>
                  </>
                )}
              </ActionMenu>
            </Card>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Visualização"
                value={view}
                onChange={setView}
                options={[
                  { value: 'day', label: 'Dia' },
                  { value: 'week', label: 'Semana' },
                  { value: 'month', label: 'Mês' },
                  { value: 'list', label: 'Lista' },
                ]}
              />
              {range && (
                <div className="flex items-center gap-1">
                  <IconButton size="sm" label="Anterior" onClick={() => shift(-1)}>
                    <ChevronLeft className="size-4" />
                  </IconButton>
                  <button className="px-2 text-sm font-medium text-ink" onClick={() => setAnchor(today)} title="Ir para hoje">
                    {view === 'day' ? formatDayKey(anchor, 'long') : view === 'week' ? `${formatDayKey(range.from)} – ${formatDayKey(range.to)}` : formatDayKey(range.from, 'month')}
                  </button>
                  <IconButton size="sm" label="Próximo" onClick={() => shift(1)}>
                    <ChevronRight className="size-4" />
                  </IconButton>
                </div>
              )}
            </div>

            {view === 'list' ? (
              <PlanList plan={plan} onEdit={(item) => setItemForm({ item })} />
            ) : items.isPending ? (
              <Spinner />
            ) : view === 'week' ? (
              <WeekView days={eachDay(range!.from, range!.to)} items={items.data ?? []} today={today} onEdit={(item) => setItemForm({ item })} onAdd={(date) => setItemForm({ item: null, date })} />
            ) : view === 'month' ? (
              <MonthView range={range!} items={items.data ?? []} today={today} onPick={(d) => (setAnchor(d), setView('day'))} />
            ) : (
              <DayView items={items.data ?? []} onEdit={(item) => setItemForm({ item })} />
            )}
          </>
        )}
      </QueryState>

      <PlanEditor open={Boolean(editor)} onClose={() => setEditor(null)} plan={editor?.plan} onSaved={(p) => setPlanId(p.id)} />
      {plan && <PlanItemForm open={Boolean(itemForm)} onClose={() => setItemForm(null)} plan={plan} item={itemForm?.item} defaultDate={itemForm?.date} />}
      {plan && <ProposalModal open={proposalOpen} onClose={() => setProposalOpen(false)} plan={plan} today={today} />}
    </div>
  )
}

function BlockCard({ item, onEdit, compact, handle }: { item: StudyPlanItem; onEdit: () => void; compact?: boolean; handle?: React.ReactNode }) {
  const lookups = useLookups()
  const update = useUpdate('study_plan_items')
  const remove = useSafeDelete('study_plan_items')
  const navigate = useNavigate()
  const toast = useToast()
  const [moving, setMoving] = useState(false)
  const setStatus = (status: PlanItemStatus) => update.mutateAsync({ id: item.id, patch: { status } }).catch((e) => toast.error(e))
  return (
    <div className={cn('group rounded-lg border border-line bg-bg', compact ? 'p-2' : 'p-2.5', item.status === 'done' && 'opacity-70')} style={{ borderLeft: `3px solid ${lookups.subjectColor(item.subject_id)}` }}>
      <div className="flex items-start gap-1">
        {handle}
        <button onClick={onEdit} className="min-w-0 flex-1 text-left" title={lookups.subjectName(item.subject_id)}>
          <p className="tabular text-[11px] whitespace-nowrap text-muted">
            {item.start_time} · {item.duration_minutes}min
          </p>
          <p className={cn('text-sm font-medium break-words text-ink', compact ? 'line-clamp-2 text-[13px] leading-snug' : 'truncate')}>{lookups.subjectName(item.subject_id)}</p>
          {!compact && (
            <p className="truncate text-xs text-muted">
              {ACTIVITY_LABELS[item.activity_type]}
              {item.topic_id ? ` · ${lookups.topicName(item.topic_id)}` : ''}
            </p>
          )}
        </button>
        <ActionMenu label="Ações do bloco">
          {(close) => (
            <>
              <MenuItem icon={<Play className="size-4" />} onClick={() => (close(), navigate(`/cronometro?bloco=${item.id}`))}>
                Iniciar estudo
              </MenuItem>
              {(['done', 'partial', 'missed', 'pending'] as PlanItemStatus[]).map((s) => (
                <MenuItem key={s} onClick={() => (close(), void setStatus(s))} disabled={item.status === s}>
                  <span className="size-2 rounded-full" style={{ background: PLAN_STATUS_COLORS[s] }} />
                  Marcar: {PLAN_STATUS_LABELS[s]}
                </MenuItem>
              ))}
              <MenuItem icon={<CalendarRange className="size-4" />} onClick={() => (close(), setMoving(true))}>
                Remarcar…
              </MenuItem>
              <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), onEdit())}>
                Editar
              </MenuItem>
              <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void remove(item.id, 'este bloco'))}>
                Excluir
              </MenuItem>
            </>
          )}
        </ActionMenu>
      </div>
      {item.status !== 'pending' && (
        <span className="mt-1 inline-block text-[11px] font-medium" style={{ color: PLAN_STATUS_COLORS[item.status] }}>
          {PLAN_STATUS_LABELS[item.status]}
        </span>
      )}
      <RescheduleModal item={moving ? item : null} onClose={() => setMoving(false)} />
    </div>
  )
}

/** Remarcar: o bloco original fica como "remarcado" (histórico) e um novo é criado. */
function RescheduleModal({ item, onClose }: { item: StudyPlanItem | null; onClose: () => void }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  useEffect(() => {
    if (item) {
      setDate(addDays(item.date, 1))
      setTime(item.start_time)
    }
  }, [item])
  if (!item) return null
  const save = async () => {
    setBusy(true)
    try {
      await backend.insert('study_plan_items', [{ plan_id: item.plan_id, date, start_time: time, duration_minutes: item.duration_minutes, subject_id: item.subject_id, topic_id: item.topic_id, activity_type: item.activity_type, notes: item.notes }])
      await backend.update('study_plan_items', [eq('id', item.id)], { status: 'rescheduled' })
      toast.success(`Remarcado para ${formatDayKey(date)} às ${time}.`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_plan_items'])
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Remarcar bloco"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={!date || !time}>
            Remarcar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nova data">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}

function WeekView({ days, items, today, onEdit, onAdd }: { days: string[]; items: StudyPlanItem[]; today: string; onEdit: (i: StudyPlanItem) => void; onAdd: (d: string) => void }) {
  const conflictIds = new Set(findConflicts(items.filter((i) => i.status !== 'rescheduled')).flatMap(([a, b]) => [a.id, b.id]))
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const list = items.filter((i) => i.date === d)
        const total = list.filter((i) => i.status !== 'rescheduled').reduce((a, i) => a + i.duration_minutes, 0)
        return (
          <div key={d} className={cn('flex min-w-0 flex-col rounded-xl border p-2', d === today ? 'border-accent-strong bg-accent/10' : 'border-line bg-surface')}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-ink">
                {WEEKDAY_SHORT[weekday(d)]} {formatDayKey(d)}
              </span>
              <IconButton size="sm" label={`Adicionar bloco em ${formatDayKey(d)}`} onClick={() => onAdd(d)}>
                <Plus className="size-3.5" />
              </IconButton>
            </div>
            <div className="flex flex-col gap-1.5">
              {list.map((i) => (
                <div key={i.id} className="relative">
                  {conflictIds.has(i.id) && <AlertTriangle className="absolute -top-1 -right-1 z-10 size-3.5 text-warning" aria-label="Conflito de horário" />}
                  <BlockCard item={i} onEdit={() => onEdit(i)} compact />
                </div>
              ))}
            </div>
            {total > 0 && <p className="mt-2 px-1 text-[11px] text-muted">{formatDuration(total * 60)} planejados</p>}
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ range, items, today, onPick }: { range: { from: string; to: string }; items: StudyPlanItem[]; today: string; onPick: (d: string) => void }) {
  const lookups = useLookups()
  const gridStart = startOfWeek(range.from)
  const gridEnd = addDays(startOfWeek(range.to), 6)
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d}>{WEEKDAY_SHORT[d]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {eachDay(gridStart, gridEnd).map((d) => {
          const list = items.filter((i) => i.date === d && i.status !== 'rescheduled')
          const inMonth = d >= range.from && d <= range.to
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              className={cn('flex min-h-20 min-w-0 flex-col rounded-lg border p-1.5 text-left', d === today ? 'border-accent-strong' : 'border-line', !inMonth && 'opacity-40')}
            >
              <span className="text-xs font-medium text-ink">{Number(d.slice(8))}</span>
              <span className="mt-1 flex flex-wrap gap-0.5">
                {list.slice(0, 6).map((i) => (
                  <ColorDot key={i.id} color={lookups.subjectColor(i.subject_id)} className="size-2" />
                ))}
              </span>
              {list.length > 0 && <span className="mt-auto truncate text-[10px] text-muted">{formatDuration(list.reduce((a, i) => a + i.duration_minutes, 0) * 60)}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayView({ items, onEdit }: { items: StudyPlanItem[]; onEdit: (i: StudyPlanItem) => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  if (items.length === 0) return <EmptyState title="Nenhum bloco neste dia" />
  // Reordenar no dia: os blocos trocam de horário entre si, mantendo os horários livres.
  const reorder = async (next: StudyPlanItem[]) => {
    const slots = items.map((i) => i.start_time).sort()
    try {
      await Promise.all(next.map((it, idx) => (it.start_time !== slots[idx] ? backend.update('study_plan_items', [eq('id', it.id)], { start_time: slots[idx] }) : null)))
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_plan_items'])
    }
  }
  return (
    <div className="max-w-2xl">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
        <Info className="size-3.5" /> Arraste para reordenar: os blocos trocam de horário entre si.
      </p>
      <SortableList items={items} onReorder={reorder}>
        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <SortableItem key={i.id} id={i.id}>
              {(handle) => <BlockCard item={i} onEdit={() => onEdit(i)} handle={handle} />}
            </SortableItem>
          ))}
        </div>
      </SortableList>
    </div>
  )
}

function PlanList({ plan, onEdit }: { plan: StudyPlan; onEdit: (i: StudyPlanItem) => void }) {
  const [status, setStatus] = useState<'all' | PlanItemStatus>('all')
  const [limit, setLimit] = useState(50)
  const items = useList('study_plan_items', { filters: [eq('plan_id', plan.id), ...(status === 'all' ? [] : [eq('status', status)])], order: [{ column: 'date' }, { column: 'start_time' }], limit, count: true }, { keepPrevious: true })
  return (
    <div>
      <Select aria-label="Filtrar por status" className="mb-3 w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
        <option value="all">Todos os status</option>
        {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <QueryState query={items}>
        {(items.data?.rows ?? []).length === 0 ? (
          <EmptyState title="Nenhum bloco" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.data!.rows.map((i) => (
              <div key={i.id}>
                <p className="mb-1 text-xs text-muted">{formatDayKey(i.date, 'weekday')}</p>
                <BlockCard item={i} onEdit={() => onEdit(i)} />
              </div>
            ))}
          </div>
        )}
        <LoadMore hasMore={(items.data?.count ?? 0) > limit} loading={items.isFetching} onClick={() => setLimit((l) => l + 50)} />
      </QueryState>
    </div>
  )
}

export function ProposalModal({ open, onClose, plan, today }: { open: boolean; onClose: () => void; plan: StudyPlan; today: string }) {
  const subjects = useSubjects()
  const lookups = useLookups()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const from = plan.start_date > today ? plan.start_date : today
  const existing = useAll('study_plan_items', { filters: [eq('plan_id', plan.id), gte('date', from)] }, { enabled: open })
  const proposal = useMemo<PlannedBlock[]>(() => (open && subjects.data ? generatePlan(plan.config, subjects.data, { from, to: plan.end_date }, today) : []), [open, subjects.data, plan, from, today])
  const diff = useMemo(() => diffPlan(existing.data ?? [], proposal), [existing.data, proposal])
  const minutesBySubject = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of proposal) m.set(b.subject_id, (m.get(b.subject_id) ?? 0) + b.duration_minutes)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [proposal])

  const apply = async () => {
    setBusy(true)
    try {
      // Substitui apenas blocos PENDENTES a partir de hoje; concluídos/parciais/não realizados ficam como histórico.
      await backend.remove('study_plan_items', [eq('plan_id', plan.id), gte('date', from), inList('status', ['pending'])])
      const rows = proposal.map((b) => ({ ...b, plan_id: plan.id }))
      for (let i = 0; i < rows.length; i += 500) await backend.insert('study_plan_items', rows.slice(i, i + 500))
      toast.success(`${rows.length} blocos aplicados ao cronograma.`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_plan_items', 'study_sessions'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Proposta de distribuição"
      description={`De ${formatDayKey(from)} a ${formatDayKey(plan.end_date)}. Revise antes de aplicar — só blocos pendentes são substituídos.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={apply} loading={busy} disabled={proposal.length === 0}>
            Aplicar proposta
          </Button>
        </>
      }
    >
      {existing.isPending || subjects.isPending ? (
        <Spinner />
      ) : proposal.length === 0 ? (
        <EmptyState title="Nenhum bloco pôde ser gerado" description="Verifique se há horários disponíveis, matérias selecionadas e período futuro no cronograma." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge>{proposal.length} blocos propostos</Badge>
              <Badge>+{diff.added} novos</Badge>
              <Badge>−{diff.removed} removidos</Badge>
              <Badge>{diff.kept} mantidos</Badge>
            </div>
            <p className="mb-2 text-sm font-medium text-ink">Tempo por matéria na proposta</p>
            <ul className="space-y-1.5">
              {minutesBySubject.map(([id, min]) => (
                <li key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <ColorDot color={lookups.subjectColor(id)} />
                    <span className="truncate text-ink">{lookups.subjectName(id)}</span>
                  </span>
                  <span className="tabular text-muted">
                    {formatDuration(min * 60)}
                    {diff.removedMinutesBySubject.get(id) ? ` · substitui ${formatDuration((diff.removedMinutesBySubject.get(id) ?? 0) * 60)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 mb-1 text-sm font-medium text-ink">Primeiros blocos</p>
            <ul className="space-y-1 text-xs text-muted">
              {proposal.slice(0, 8).map((b, i) => (
                <li key={i}>
                  {formatDayKey(b.date, 'weekday')} {b.start_time} · {b.duration_minutes} min · {lookups.subjectName(b.subject_id)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Info className="size-4" /> Regras usadas (determinísticas)
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted">
              {PLANNER_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">Altere disponibilidade, matérias e metas em "Editar configuração", ou prioridade/dificuldade no cadastro de cada matéria.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
