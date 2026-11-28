import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader, Segmented } from '@/components/ui/layout'
import { EmptyState, QueryState, Spinner } from '@/components/ui/feedback'
import { useAll, useSessions } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, inList, notNull } from '@/lib/data/types'
import { checklistProgress, dueState, historyStart, isDeliverable, isStudyGoalAvailable, periodFor, progress, type GoalData } from '@/lib/goals'
import { todayKey, zonedDayStart } from '@/lib/time'
import type { GoalKind, StudyGoal } from '@/types/db'
import { DeliverableGoalCard, MetricGoalCard } from './GoalCards'
import { GoalForm } from './GoalForm'

export default function GoalsPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const [show, setShow] = useState<'current' | 'archived'>('current')
  const [form, setForm] = useState<{ goal: StudyGoal | null; kind: GoalKind } | null>(null)
  const goals = useAll('study_goals', { filters: [inList('status', show === 'current' ? ['active', 'paused'] : ['superseded', 'archived'])], order: [{ column: 'created_at', ascending: false }] })
  const start = historyStart(today)
  const startIso = new Date(zonedDayStart(start, tz) - 86400000).toISOString()
  const sessions = useSessions({ filters: [eq('status', 'completed'), gte('started_at', startIso)] })
  const topics = useAll('topics', { filters: [notNull('completed_at'), gte('completed_at', startIso)] })
  const reviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', startIso)] })
  const data: GoalData = useMemo(
    () => ({ sessions: sessions.data ?? [], questions: [], topics: topics.data ?? [], reviews: reviews.data ?? [], timezone: tz }),
    [sessions.data, topics.data, reviews.data, tz],
  )

  const list = useMemo(() => (goals.data ?? []).filter(isStudyGoalAvailable), [goals.data])
  // Só as metas por número dependem dos registros; as por entregas aparecem de imediato.
  const loadingRecords = sessions.isPending || topics.isPending || reviews.isPending
  const waiting = loadingRecords && list.some((g) => !isDeliverable(g))

  const { pending, achieved, overdue } = useMemo(() => {
    const pending: StudyGoal[] = []
    const achieved: StudyGoal[] = []
    let overdue = 0
    for (const g of list) {
      const met = isDeliverable(g) ? checklistProgress(g).met : !waiting && progress(g, periodFor(g.period, today), data).met
      if (met) achieved.push(g)
      else pending.push(g)
      if (isDeliverable(g) && !met && dueState(g, today).state === 'overdue') overdue++
    }
    // Pendentes: as com prazo mais próximo primeiro; metas sem prazo mantêm a ordem de criação.
    pending.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    return { pending, achieved, overdue }
  }, [list, data, today, waiting])

  const card = (g: StudyGoal) =>
    isDeliverable(g) ? (
      <DeliverableGoalCard key={g.id} goal={g} today={today} onEdit={() => setForm({ goal: g, kind: 'deliverable' })} />
    ) : (
      <MetricGoalCard key={g.id} goal={g} data={data} today={today} onEdit={() => setForm({ goal: g, kind: 'metric' })} />
    )

  return (
    <div>
      <PageHeader
        title="Metas"
        description="Metas por entregas (uma lista do que precisa ficar pronto até uma data) e metas por número, calculadas dos seus registros."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ goal: null, kind: 'deliverable' })}>
            Nova meta
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Mostrar" value={show} onChange={setShow} options={[{ value: 'current', label: 'Vigentes' }, { value: 'archived', label: 'Encerradas' }]} />
        {show === 'current' && list.length > 0 && !waiting && (
          <p className="text-sm text-muted" role="status">
            <span className="font-semibold text-ink">{achieved.length}</span> {achieved.length === 1 ? 'cumprida' : 'cumpridas'} · <span className="font-semibold text-ink">{pending.length}</span> {pending.length === 1 ? 'pendente' : 'pendentes'}
            {overdue > 0 && (
              <>
                {' '}
                · <span className="font-semibold text-accent">{overdue} com prazo vencido</span>
              </>
            )}
          </p>
        )}
      </div>
      <div className="mt-5">
        <QueryState query={goals}>
          {list.length === 0 ? (
            <EmptyState
              icon={<Target className="size-8" />}
              title={show === 'current' ? 'Nenhuma meta definida' : 'Nenhuma meta encerrada'}
              description={show === 'current' ? 'Por exemplo, concluir um curso até domingo ou estudar 10 horas por semana.' : undefined}
              action={
                show === 'current' ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" onClick={() => setForm({ goal: null, kind: 'deliverable' })}>
                      Meta por entregas
                    </Button>
                    <Button onClick={() => setForm({ goal: null, kind: 'metric' })}>Meta por número</Button>
                  </div>
                ) : undefined
              }
            />
          ) : waiting ? (
            <Spinner label="Calculando progresso…" />
          ) : show === 'archived' ? (
            <div className="grid gap-4 md:grid-cols-2">{list.map(card)}</div>
          ) : (
            <div className="space-y-8">
              <GoalSection title="Pendentes" count={pending.length} empty="Nenhuma meta pendente: tudo cumprido.">
                {pending.map(card)}
              </GoalSection>
              <GoalSection title="Cumpridas" count={achieved.length} empty="Nenhuma meta cumprida ainda." note="Metas por número voltam a ficar pendentes quando um novo período começa.">
                {achieved.map(card)}
              </GoalSection>
            </div>
          )}
        </QueryState>
      </div>
      <GoalForm open={Boolean(form)} goal={form?.goal ?? null} initialKind={form?.kind} onClose={() => setForm(null)} today={today} />
    </div>
  )
}

function GoalSection({ title, count, empty, note, children }: { title: string; count: number; empty: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label={`${title} (${count})`}>
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-ink">
        {title}
        <span className="tabular text-sm font-normal text-muted">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="grid items-start gap-4 md:grid-cols-2">{children}</div>
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        </>
      )}
    </section>
  )
}
