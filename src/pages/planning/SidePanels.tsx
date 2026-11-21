// Painéis laterais do Meu Planejamento: caixa de entrada rápida, resumo da semana e "continuar de onde parei".
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarPlus, Inbox, Play, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Card, Progress } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { useAll, useInsert, useRemove, useSessions } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { eq, isNull } from '@/lib/data/types'
import type { PlanActivity } from '@/lib/replan'
import { netSeconds } from '@/lib/timer/engine'
import { formatDayKey, formatDuration, dayKey } from '@/lib/time'
import type { InboxItem } from '@/types/db'

function Panel({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

// ---------------------------------------------------------------------
// Caixa de entrada: uma linha para anotar agora e organizar depois
// ---------------------------------------------------------------------
export function InboxCard({ onOrganize }: { onOrganize: (item: InboxItem) => void }) {
  const [text, setText] = useState('')
  const items = useAll('inbox_items', { filters: [isNull('processed_at')], order: [{ column: 'created_at', ascending: false }] })
  const insert = useInsert('inbox_items')
  const remove = useRemove('inbox_items')
  const toast = useToast()
  const add = async () => {
    const value = text.trim()
    if (!value) return
    setText('')
    try {
      await insert.mutateAsync({ text: value.slice(0, 1000) })
    } catch (e) {
      setText(value)
      toast.error(e)
    }
  }
  const rows = items.data ?? []
  return (
    <Panel title="Caixa de entrada" icon={<Inbox className="size-4 text-muted" aria-hidden />} action={rows.length > 0 ? <span className="tabular text-xs text-muted">{rows.length}</span> : undefined}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Anote uma ideia, tarefa ou lembrete…" aria-label="Anotar na caixa de entrada" className="h-9" />
      </form>
      {items.isError ? (
        <p className="mt-3 text-xs text-accent">Não foi possível carregar a caixa de entrada.</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Vazia. O que você anotar aqui fica guardado até virar tarefa.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.slice(0, 8).map((it) => (
            <li key={it.id} className="flex items-center gap-1 py-1.5">
              <p className="min-w-0 flex-1 truncate text-sm text-ink" title={it.text}>
                {it.text}
              </p>
              <IconButton label={`Transformar em tarefa: ${it.text}`} size="sm" onClick={() => onOrganize(it)}>
                <CalendarPlus className="size-4" />
              </IconButton>
              <IconButton label={`Descartar: ${it.text}`} size="sm" onClick={() => remove.mutate(it.id, { onError: (e) => toast.error(e) })}>
                <Trash2 className="size-4 text-muted" />
              </IconButton>
            </li>
          ))}
          {rows.length > 8 && <li className="pt-2 text-xs text-muted">+{rows.length - 8} item(ns)</li>}
        </ul>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------
// Resumo da semana
// ---------------------------------------------------------------------
export function WeekSummary({
  activities,
  overdue,
  studiedBySubject,
  studiedTotal,
  availableMinutes,
  onAvailability,
}: {
  activities: PlanActivity[]
  overdue: number
  /** Segundos estudados por matéria na semana. */
  studiedBySubject: Map<string, number>
  studiedTotal: number
  /** Minutos disponíveis para estudo na semana (null = disponibilidade não definida). */
  availableMinutes: number | null
  onAvailability: () => void
}) {
  const lookups = useLookups()
  const s = useMemo(() => {
    const pending = activities.filter((a) => !a.done)
    const done = activities.length - pending.length
    const study = activities.filter((a) => a.study)
    const plannedStudy = study.reduce((n, a) => n + (a.duration ?? 0), 0)
    const bySubject = new Map<string, number>()
    for (const a of study) if (a.subjectId) bySubject.set(a.subjectId, (bySubject.get(a.subjectId) ?? 0) + (a.duration ?? 0))
    const commitments = activities.filter((a) => a.fixed).length
    const priorities = pending.filter((a) => a.priority >= 3).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 9999) - (b.start ?? 9999))
    const booked = activities.reduce((n, a) => n + (a.start != null ? (a.duration ?? 0) : 0), 0)
    return { pending: pending.length, done, plannedStudy, bySubject, commitments, priorities, booked }
  }, [activities])
  const subjects = [...new Set([...s.bySubject.keys(), ...[...studiedBySubject.keys()].filter((k) => lookups.subjectById.has(k))])]
    .map((id) => ({ id, name: lookups.subjectName(id), planned: s.bySubject.get(id) ?? 0, done: Math.round((studiedBySubject.get(id) ?? 0) / 60) }))
    .sort((a, b) => b.planned + b.done - (a.planned + a.done))
  const total = s.pending + s.done
  const fmt = (min: number) => formatDuration(min * 60)
  return (
    <Panel title="Resumo da semana">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] text-muted">Concluídas</dt>
          <dd className="tabular font-semibold text-ink">
            {s.done} de {total}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Pendências</dt>
          <dd className="tabular font-semibold text-ink">
            {s.pending}
            {overdue > 0 && <span className="ml-1.5 text-xs font-medium text-accent">{overdue} atrasada(s)</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Estudo realizado</dt>
          <dd className="tabular font-semibold text-ink">
            {formatDuration(studiedTotal)}
            {s.plannedStudy > 0 && <span className="ml-1 text-xs font-normal text-muted">de {fmt(s.plannedStudy)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Compromissos fixos</dt>
          <dd className="tabular font-semibold text-ink">{s.commitments}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] text-muted">Horas disponíveis para estudo</dt>
          <dd className="text-sm text-ink">
            {availableMinutes == null ? (
              <button type="button" onClick={onAvailability} className="font-medium underline underline-offset-2">
                Definir minha disponibilidade
              </button>
            ) : (
              <>
                <span className="tabular font-semibold">{fmt(Math.max(0, availableMinutes - s.plannedStudy))}</span>
                <span className="ml-1 text-xs text-muted">livres de {fmt(availableMinutes)}</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {subjects.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[11px] font-medium text-muted">Distribuição dos estudos (realizado / planejado)</p>
          <ul className="space-y-2">
            {subjects.slice(0, 6).map((sub) => (
              <li key={sub.id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{sub.name}</span>
                  <span className="tabular shrink-0 text-muted">
                    {fmt(sub.done)}
                    {sub.planned > 0 && ` / ${fmt(sub.planned)}`}
                  </span>
                </div>
                <Progress value={sub.planned > 0 ? (sub.done / sub.planned) * 100 : sub.done > 0 ? 100 : 0} className="mt-1 h-1" label={`${sub.name}: realizado sobre planejado`} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.priorities.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted">Prioridades da semana</p>
          <ul className="space-y-1">
            {s.priorities.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-xs text-ink">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <span className="shrink-0 text-muted">{formatDayKey(a.date, 'weekday').slice(0, 3)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link to="/relatorio-semanal" className="mt-4 flex items-center gap-1 text-xs font-medium text-ink hover:underline">
        Ver relatório semanal <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Panel>
  )
}

// ---------------------------------------------------------------------
// Continuar de onde parei: o último estudo registrado
// ---------------------------------------------------------------------
export function ContinueCard({ tz, extra }: { tz: string; extra?: ReactNode }) {
  const last = useSessions({ filters: [eq('status', 'completed')], order: [{ column: 'started_at', ascending: false }], limit: 1 })
  const lookups = useLookups()
  const study = useStartStudy()
  const s = last.data?.[0]
  if (!s && !extra) return null
  const label = s ? (s.source?.label ?? (s.topic_id ? lookups.topicName(s.topic_id) : lookups.subjectName(s.subject_id))) : ''
  return (
    <Panel title="Continuar de onde parei" icon={<BookOpen className="size-4 text-muted" aria-hidden />}>
      {s && (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{label || 'Estudo livre'}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {s.subject_id && s.source?.label ? `${lookups.subjectName(s.subject_id)} · ` : ''}
              {formatDayKey(dayKey(new Date(s.started_at).getTime(), tz), 'weekday')} · {formatDuration(netSeconds(s, s.pauses))}
            </p>
          </div>
          <Button
            size="sm"
            variant="dark"
            icon={<Play className="size-3.5" />}
            loading={study.pending}
            onClick={() => void study.start({ subject_id: s.subject_id, topic_id: s.topic_id, activity_type: s.activity_type, source: s.source, project_id: s.project_id })}
          >
            Retomar
          </Button>
        </div>
      )}
      {extra && <div className={s ? 'mt-3 border-t border-line pt-3' : ''}>{extra}</div>}
    </Panel>
  )
}
