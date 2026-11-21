import { useState } from 'react'
import { Archive, CalendarClock, CheckCircle2, ExternalLink, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Badge, Card, Progress } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/feedback'
import { useSafeDelete } from '@/components/useSafeDelete'
import { useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { checklistPatch, checklistProgress, dueState, formatGoalValue, goalTitle, history, parseChecklist, periodFor, progress, type GoalData } from '@/lib/goals'
import { GOAL_PERIOD_LABELS } from '@/lib/labels'
import { dayKey, formatDayKey } from '@/lib/time'
import type { CheckItem, StudyGoal } from '@/types/db'

const STATUS_LABELS: Partial<Record<StudyGoal['status'], string>> = { paused: 'Pausada', superseded: 'Substituída', archived: 'Arquivada' }
const isLive = (goal: StudyGoal) => goal.status === 'active' || goal.status === 'paused'

function GoalMenu({ goal, title, today, onEdit }: { goal: StudyGoal; title: string; today: string; onEdit: () => void }) {
  const update = useUpdate('study_goals')
  const safeDelete = useSafeDelete('study_goals')
  const toast = useToast()
  const live = isLive(goal)
  const setStatus = (status: StudyGoal['status']) =>
    update.mutateAsync({ id: goal.id, patch: { status, ...(status === 'archived' ? { end_date: today } : {}) } }).catch((e) => toast.error(e))
  return (
    <ActionMenu label={`Ações da meta ${title}`}>
      {(close) => (
        <>
          {live && (
            <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), onEdit())}>
              Editar
            </MenuItem>
          )}
          {goal.status === 'active' && (
            <MenuItem icon={<Pause className="size-4" />} onClick={() => (close(), void setStatus('paused'))}>
              Pausar
            </MenuItem>
          )}
          {goal.status === 'paused' && (
            <MenuItem icon={<Play className="size-4" />} onClick={() => (close(), void setStatus('active'))}>
              Retomar
            </MenuItem>
          )}
          {live && (
            <MenuItem icon={<Archive className="size-4" />} onClick={() => (close(), void setStatus('archived'))}>
              Encerrar (arquivar)
            </MenuItem>
          )}
          <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void safeDelete(goal.id, title))}>
            Excluir
          </MenuItem>
        </>
      )}
    </ActionMenu>
  )
}

function Met({ children }: { children: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
      <CheckCircle2 className="size-4" aria-hidden /> {children}
    </span>
  )
}

// ---------------------------------------------------------------------
// Meta por número
// ---------------------------------------------------------------------

export function MetricGoalCard({ goal, data, today, onEdit }: { goal: StudyGoal; data: GoalData; today: string; onEdit: () => void }) {
  const lookups = useLookups()
  const current = progress(goal, periodFor(goal.period, today), data)
  const past = history(goal, today, data)
  const title = goalTitle(goal)
  const live = isLive(goal)
  const fmt = (v: number) => formatGoalValue(goal.metric, v)
  return (
    <Card className="p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
          <p className="text-xs text-muted">
            {GOAL_PERIOD_LABELS[goal.period]} · {goal.subject_id ? lookups.subjectName(goal.subject_id) : 'Todas as matérias'} · desde {formatDayKey(goal.start_date)}
            {goal.end_date ? ` até ${formatDayKey(goal.end_date)}` : ''}
          </p>
        </div>
        {goal.status !== 'active' && <Badge>{STATUS_LABELS[goal.status]}</Badge>}
        <GoalMenu goal={goal} title={title} today={today} onEdit={onEdit} />
      </div>
      {live && (
        <>
          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="tabular text-2xl font-semibold tracking-tight text-ink">
              {fmt(current.value)} <span className="text-sm font-normal text-muted">/ {fmt(current.target)}</span>
            </p>
            {current.met ? <Met>Cumprida</Met> : <span className="text-xs text-muted">Faltam {goal.metric === 'accuracy' ? `${Math.ceil(current.remaining)} p.p.` : fmt(current.remaining)}</span>}
          </div>
          <Progress value={current.percent} className="mt-2" label={`Progresso de ${title}`} />
          <p className="mt-1 text-xs text-muted">
            {Math.round(current.percent)}% · {formatDayKey(current.range.from)}
            {current.range.to !== current.range.from ? ` – ${formatDayKey(current.range.to)}` : ''}
          </p>
        </>
      )}
      {past.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">
            Períodos anteriores: {past.filter((p) => p.met).length} de {past.length} cumpridos
          </p>
          <ol className="flex items-end gap-1" aria-label="Histórico de períodos">
            {[...past].reverse().map((p) => (
              <li key={p.range.from} className="flex flex-1 flex-col items-center gap-1" title={`${formatDayKey(p.range.from)}: ${fmt(p.value)} de ${fmt(p.target)}`}>
                <div className="flex h-10 w-full items-end overflow-hidden rounded bg-surface-2">
                  {/* Preto = cumprida; cinza = não cumprida (a altura mostra quanto faltou). */}
                  <div className="w-full rounded" style={{ height: `${Math.max(4, p.percent)}%`, background: p.met ? 'var(--ink)' : 'var(--series-4)' }} />
                </div>
                <span className="text-[9px] text-muted">{formatDayKey(p.range.from)}</span>
                <span className="sr-only">{p.met ? 'cumprida' : `não cumprida: ${fmt(p.value)} de ${fmt(p.target)}`}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------
// Meta por entregas
// ---------------------------------------------------------------------

function dueText(goal: StudyGoal, today: string, tz: string): { text: string; attention: boolean } {
  const due = dueState(goal, today)
  const days = Math.abs(due.days)
  const n = `${days} ${days === 1 ? 'dia' : 'dias'}`
  switch (due.state) {
    case 'done':
      return { text: `Cumprida em ${formatDayKey(dayKey(new Date(goal.done_at!).getTime(), tz))}`, attention: false }
    case 'overdue':
      return { text: `Prazo vencido há ${n} (${formatDayKey(goal.due_date!)})`, attention: true }
    case 'today':
      return { text: 'Vence hoje', attention: true }
    case 'soon':
      return { text: `Vence em ${n} (${formatDayKey(goal.due_date!, 'weekday')})`, attention: false }
    case 'later':
      return { text: `Prazo: ${formatDayKey(goal.due_date!, 'weekday')}`, attention: false }
    default:
      return { text: 'Sem prazo', attention: false }
  }
}

export function DeliverableGoalCard({ goal, today, onEdit }: { goal: StudyGoal; today: string; onEdit: () => void }) {
  const settings = useSettings()
  const update = useUpdate('study_goals')
  const toast = useToast()
  // Rascunho local: a marcação aparece na hora, sem esperar a gravação.
  const [draft, setDraft] = useState<CheckItem[] | null>(null)
  const [newItem, setNewItem] = useState('')
  const items = draft ?? goal.checklist ?? []
  const p = checklistProgress({ checklist: items })
  const title = goalTitle(goal)
  const live = isLive(goal)
  const due = dueText({ ...goal, done_at: p.met ? (goal.done_at ?? new Date().toISOString()) : null }, today, settings.timezone)

  const persist = async (next: CheckItem[]) => {
    setDraft(next)
    try {
      await update.mutateAsync({ id: goal.id, patch: checklistPatch(next, goal.done_at) })
    } catch (e) {
      toast.error(e)
    } finally {
      setDraft(null)
    }
  }
  const toggle = (id: string) => persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  const addItem = () => {
    const text = newItem.trim()
    if (!text) return
    setNewItem('')
    void persist(parseChecklist([...items.map((i) => i.text), text].join('\n'), items))
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{title}</h3>
          <p className={cn('mt-0.5 flex items-center gap-1 text-xs', due.attention ? 'font-medium text-accent' : 'text-muted')}>
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            Por entregas · {due.text}
          </p>
        </div>
        {goal.status !== 'active' && <Badge>{STATUS_LABELS[goal.status]}</Badge>}
        <GoalMenu goal={goal} title={title} today={today} onEdit={onEdit} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="tabular text-2xl font-semibold tracking-tight text-ink">
          {p.done} <span className="text-sm font-normal text-muted">/ {p.total} {p.total === 1 ? 'entrega' : 'entregas'}</span>
        </p>
        {p.met ? <Met>Cumprida</Met> : p.total > 0 && <span className="text-xs text-muted">{p.total - p.done === 1 ? 'Falta 1' : `Faltam ${p.total - p.done}`}</span>}
      </div>
      <Progress value={p.percent} className="mt-2" label={`Progresso de ${title}`} />

      <ul className="mt-3 flex flex-col" aria-label={`Entregas de ${title}`}>
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 py-1">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-line accent-[var(--ink)]" checked={item.done} disabled={!live} onChange={() => void toggle(item.id)} />
              <span className={cn('min-w-0 [overflow-wrap:anywhere]', item.done ? 'text-muted line-through' : 'text-ink')}>{item.text}</span>
            </label>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-muted hover:text-ink" aria-label={`Abrir o link de ${item.text}`}>
                <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="py-1 text-sm text-muted">Nenhuma entrega na lista ainda.</li>}
      </ul>

      {live && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addItem()
          }}
        >
          <Input className="h-8" aria-label={`Nova entrega em ${title}`} placeholder="Adicionar entrega…" value={newItem} maxLength={200} onChange={(e) => setNewItem(e.target.value)} />
          <Button type="submit" size="sm" icon={<Plus className="size-4" />} disabled={!newItem.trim()}>
            Adicionar
          </Button>
        </form>
      )}
    </Card>
  )
}
