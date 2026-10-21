import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckCircle2, Pause, Pencil, Play, Plus, Target, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, Spinner, useToast } from '@/components/ui/feedback'
import { useSafeDelete } from '@/components/useSafeDelete'
import { invalidateTables, useAll, useSessions } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, inList, notNull } from '@/lib/data/types'
import { GOAL_METRIC_LABELS, GOAL_PERIOD_LABELS } from '@/lib/labels'
import { history, historyStart, periodFor, progress, type GoalData } from '@/lib/goals'
import { addDays, formatDayKey, formatDuration, todayKey, zonedDayStart } from '@/lib/time'
import type { GoalMetric, GoalPeriod, StudyGoal } from '@/types/db'

function formatValue(metric: GoalMetric, v: number) {
  if (metric === 'study_hours') return formatDuration(v * 3600)
  if (metric === 'accuracy') return `${Math.round(v)}%`
  return Math.round(v).toLocaleString('pt-BR')
}

export default function GoalsPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const [show, setShow] = useState<'current' | 'archived'>('current')
  const [form, setForm] = useState<{ goal: StudyGoal | null } | null>(null)
  const goals = useAll('study_goals', { filters: [inList('status', show === 'current' ? ['active', 'paused'] : ['superseded', 'archived'])], order: [{ column: 'created_at', ascending: false }] })
  const start = historyStart(today)
  const startIso = new Date(zonedDayStart(start, tz) - 86400000).toISOString()
  const sessions = useSessions({ filters: [eq('status', 'completed'), gte('started_at', startIso)] })
  const questions = useAll('question_records', { filters: [gte('date', start)] })
  const topics = useAll('topics', { filters: [notNull('completed_at'), gte('completed_at', startIso)] })
  const reviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', startIso)] })
  const loading = sessions.isPending || questions.isPending || topics.isPending || reviews.isPending
  const data: GoalData = useMemo(
    () => ({ sessions: sessions.data ?? [], questions: questions.data ?? [], topics: topics.data ?? [], reviews: reviews.data ?? [], timezone: tz }),
    [sessions.data, questions.data, topics.data, reviews.data, tz],
  )

  return (
    <div>
      <PageHeader
        title="Metas"
        description="Metas diárias, semanais e mensais calculadas a partir dos seus registros. Ajustar uma meta preserva o histórico anterior."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ goal: null })}>
            Nova meta
          </Button>
        }
      />
      <Segmented label="Mostrar" value={show} onChange={setShow} options={[{ value: 'current', label: 'Vigentes' }, { value: 'archived', label: 'Encerradas' }]} />
      <div className="mt-4">
        <QueryState query={goals}>
          {(goals.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Target className="size-8" />}
              title={show === 'current' ? 'Nenhuma meta definida' : 'Nenhuma meta encerrada'}
              description={show === 'current' ? 'Exemplos: 3 h de estudo por dia, 200 questões por semana, 80% de acertos no mês.' : undefined}
              action={
                show === 'current' ? (
                  <Button variant="primary" onClick={() => setForm({ goal: null })}>
                    Criar meta
                  </Button>
                ) : undefined
              }
            />
          ) : loading ? (
            <Spinner label="Calculando progresso…" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.data!.map((g) => (
                <GoalCard key={g.id} goal={g} data={data} today={today} onEdit={() => setForm({ goal: g })} />
              ))}
            </div>
          )}
        </QueryState>
      </div>
      <GoalForm open={Boolean(form)} goal={form?.goal ?? null} onClose={() => setForm(null)} today={today} />
    </div>
  )
}

function GoalCard({ goal, data, today, onEdit }: { goal: StudyGoal; data: GoalData; today: string; onEdit: () => void }) {
  const lookups = useLookups()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const safeDelete = useSafeDelete('study_goals')
  const current = progress(goal, periodFor(goal.period, today), data)
  const past = history(goal, today, data)
  const title = goal.title || `${GOAL_METRIC_LABELS[goal.metric]} — ${GOAL_PERIOD_LABELS[goal.period].toLowerCase()}`
  const setStatus = async (status: StudyGoal['status']) => {
    try {
      await backend.update('study_goals', [eq('id', goal.id)], { status, ...(status === 'archived' ? { end_date: today } : {}) })
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_goals'])
    }
  }
  const live = goal.status === 'active' || goal.status === 'paused'
  return (
    <Card className="p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">
            {goal.subject_id ? lookups.subjectName(goal.subject_id) : 'Todas as matérias'} · desde {formatDayKey(goal.start_date)}
            {goal.end_date ? ` até ${formatDayKey(goal.end_date)}` : ''}
          </p>
        </div>
        {goal.status !== 'active' && <Badge>{goal.status === 'paused' ? 'Pausada' : goal.status === 'superseded' ? 'Substituída' : 'Arquivada'}</Badge>}
        <ActionMenu label="Ações da meta">
          {(close) => (
            <>
              {live && (
                <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), onEdit())}>
                  Ajustar
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
      </div>
      {live && (
        <>
          <div className="mt-4 flex items-end justify-between gap-2">
            <p className="tabular text-2xl font-semibold text-ink">
              {formatValue(goal.metric, current.value)} <span className="text-sm font-normal text-muted">/ {formatValue(goal.metric, current.target)}</span>
            </p>
            {current.met ? (
              <span className="flex items-center gap-1 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" /> Cumprida
              </span>
            ) : (
              <span className="text-xs text-muted">Faltam {formatValue(goal.metric, current.remaining)}</span>
            )}
          </div>
          <Progress value={current.percent} className="mt-2" label={`Progresso de ${title}`} color={current.met ? 'var(--success)' : undefined} />
          <p className="mt-1 text-xs text-muted">
            {Math.round(current.percent)}% · {GOAL_PERIOD_LABELS[goal.period]} ({formatDayKey(current.range.from)}
            {current.range.to !== current.range.from ? ` – ${formatDayKey(current.range.to)}` : ''})
          </p>
        </>
      )}
      {past.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Histórico ({past.filter((p) => p.met).length}/{past.length} cumpridas)</p>
          <ol className="flex items-end gap-1" aria-label="Histórico de períodos">
            {[...past].reverse().map((p) => (
              <li key={p.range.from} className="flex flex-1 flex-col items-center gap-1" title={`${formatDayKey(p.range.from)}: ${formatValue(goal.metric, p.value)} de ${formatValue(goal.metric, p.target)}`}>
                <div className="flex h-10 w-full items-end overflow-hidden rounded bg-surface-2">
                  <div className="w-full rounded" style={{ height: `${Math.max(4, p.percent)}%`, background: p.met ? 'var(--success)' : 'var(--accent-strong)' }} />
                </div>
                <span className="text-[9px] text-muted">{formatDayKey(p.range.from)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  )
}

function GoalForm({ open, goal, onClose, today }: { open: boolean; goal: StudyGoal | null; onClose: () => void; today: string }) {
  const [metric, setMetric] = useState<GoalMetric>('study_hours')
  const [period, setPeriod] = useState<GoalPeriod>('daily')
  const [target, setTarget] = useState('3')
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const subjects = useSubjects()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setMetric(goal?.metric ?? 'study_hours')
    setPeriod(goal?.period ?? 'daily')
    setTarget(goal ? String(goal.target) : '3')
    setSubjectId(goal?.subject_id ?? '')
    setTitle(goal?.title ?? '')
    setError(null)
  }, [open, goal])

  const save = async () => {
    const t = Number(target.replace(',', '.'))
    if (!(t > 0) || t > 100000) return setError('Informe um alvo maior que zero.')
    if (metric === 'accuracy' && t > 100) return setError('A taxa de acertos vai até 100%.')
    if (metric === 'study_hours' && period === 'daily' && t > 24) return setError('Uma meta diária não pode passar de 24 horas.')
    const data = { metric, period, target: t, subject_id: metric === 'flashcards_reviewed' ? null : subjectId || null, title: title.trim().slice(0, 160) || null }
    setBusy(true)
    try {
      if (!goal) {
        await backend.insert('study_goals', [{ ...data, start_date: today, status: 'active' }])
      } else if (goal.start_date >= today || (goal.target === t && goal.metric === metric && goal.period === period && (goal.subject_id ?? '') === (data.subject_id ?? ''))) {
        // Meta criada hoje (sem histórico) ou só título mudou: altera no lugar.
        await backend.update('study_goals', [eq('id', goal.id)], data)
      } else {
        // Ajuste preserva o histórico: a versão anterior é encerrada ontem.
        await backend.update('study_goals', [eq('id', goal.id)], { status: 'superseded', end_date: addDays(today, -1) })
        await backend.insert('study_goals', [{ ...data, start_date: today, status: goal.status === 'paused' ? 'paused' : 'active', previous_goal_id: goal.id }])
      }
      toast.success('Meta salva.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_goals'])
    }
  }

  const unit = metric === 'study_hours' ? 'horas' : metric === 'accuracy' ? '%' : metric === 'study_days' ? 'dias' : 'quantidade'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Ajustar meta' : 'Nova meta'}
      description={goal ? 'Se a meta já tem histórico, a versão atual é encerrada e uma nova começa hoje — os períodos anteriores continuam com o alvo antigo.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {error && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <Field label="Indicador">
          {(id) => (
            <Select id={id} value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
              {Object.entries(GOAL_METRIC_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Período">
          {(id) => (
            <Select id={id} value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
              {Object.entries(GOAL_PERIOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={`Alvo (${unit})`}>{(id) => <Input id={id} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
        <Field label="Matéria" hint={metric === 'flashcards_reviewed' ? 'Flashcards contam todos os baralhos.' : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={subjectId} disabled={metric === 'flashcards_reviewed'} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nome (opcional)" className="sm:col-span-2">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ritmo pré-prova" />}
        </Field>
      </div>
    </Modal>
  )
}
