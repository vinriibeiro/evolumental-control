import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, CalendarRange, Check, ClipboardCheck, Layers, Network, Play, RefreshCcw, StickyNote, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Textarea } from '@/components/ui/Field'
import { Badge, Card, CardHeader, ColorDot, PageHeader, Progress } from '@/components/ui/layout'
import { Spinner, useToast } from '@/components/ui/feedback'
import { TodayRoutine } from '@/components/TodayRoutine'
import { useAll, useCount, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useProfile, useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useDebounced } from '@/hooks/useDebounced'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { eq, inList, lte } from '@/lib/data/types'
import { summarize } from '@/lib/cycle'
import { ACTIVITY_LABELS, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS } from '@/lib/labels'
import { formatDayKey, formatDuration, periodRange, todayKey, minuteIso } from '@/lib/time'

export default function WorkspacePage() {
  const settings = useSettings()
  const profile = useProfile()
  const today = todayKey(settings.timezone)
  const dayRange = useMemo(() => periodRange('day', today), [today])
  const stats = useStudyStats(dayRange)
  const navigate = useNavigate()
  const lookups = useLookups()
  const toast = useToast()
  const live = useLiveSession()

  const blocks = useAll('study_plan_items', { filters: [eq('date', today)], order: [{ column: 'start_time' }] })
  const reviews = useAll('reviews', { filters: [inList('status', ['planned', 'postponed']), lte('scheduled_for', today)], order: [{ column: 'scheduled_for' }] })
  const tasks = useAll('calendar_tasks', { filters: [eq('date', today)], order: [{ column: 'start_time' }] })
  const cardsDue = useCount('flashcards', [inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())])
  const cycles = useAll('study_cycles', { filters: [eq('status', 'active')] })
  const activeCycle = cycles.data?.[0]
  const cycleItems = useAll('study_cycle_items', { filters: [eq('cycle_id', activeCycle?.id ?? '')] }, { enabled: Boolean(activeCycle) })
  const updateReview = useUpdate('reviews')
  const updateTask = useUpdate('calendar_tasks')

  const goal = settings.dailyGoalMinutes * 60
  const summary = activeCycle && cycleItems.data ? summarize(activeCycle, cycleItems.data) : null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = profile.data?.display_name?.split(' ')[0]

  return (
    <div>
      <PageHeader title={`${greeting}${name ? `, ${name}` : ''}!`} description={`${formatDayKey(today, 'long')} — tudo o que importa hoje em um só lugar.`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted">Estudo líquido hoje</p>
              <p className="tabular text-3xl font-semibold text-ink">{formatDuration(stats.stats.total)}</p>
              <p className="text-xs text-muted">de {formatDuration(goal)} da meta diária</p>
            </div>
            {live.data ? (
              <Button variant="dark" size="lg" icon={<Timer className="size-5" />} onClick={() => navigate('/cronometro')}>
                {live.data.status === 'pending_review' ? 'Confirmar sessão' : 'Voltar à sessão em andamento'}
              </Button>
            ) : (
              <Button variant="dark" size="lg" icon={<Play className="size-5" />} onClick={() => navigate('/cronometro')}>
                Iniciar estudo
              </Button>
            )}
          </div>
          <Progress value={goal ? (stats.stats.total / goal) * 100 : 0} className="mt-4 h-2.5" label="Meta diária" />
        </Card>

        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <RefreshCcw className="size-4 text-accent-strong" /> Ciclo de estudos
          </p>
          {!activeCycle ? (
            <p className="text-sm text-muted">
              Nenhum ciclo ativo.{' '}
              <Link to="/ciclos" className="underline">
                Criar ou ativar
              </Link>
            </p>
          ) : !summary?.current ? (
            <p className="text-sm text-muted">O ciclo "{activeCycle.name}" não tem blocos.</p>
          ) : (
            <>
              <p className="text-xs text-muted">
                {activeCycle.name} · bloco {summary.position}/{summary.length}
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-ink">
                <ColorDot color={lookups.subjectColor(summary.current.subject_id)} />
                <span className="truncate">{lookups.subjectName(summary.current.subject_id)}</span>
              </p>
              <p className="text-xs text-muted">
                {formatDuration(activeCycle.current_progress_seconds)} de {summary.current.duration_minutes} min
              </p>
              <Progress value={summary.blockPercent} className="my-3" label="Progresso do bloco" />
              <Button
                size="sm"
                variant="primary"
                icon={<Play className="size-3.5" />}
                disabled={Boolean(live.data)}
                onClick={() => navigate(`/cronometro?item=${summary.current!.id}&minutos=${Math.max(1, Math.ceil((summary.current!.duration_minutes * 60 - activeCycle.current_progress_seconds) / 60))}`)}
              >
                Estudar este bloco
              </Button>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TodayRoutine />

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CalendarRange className="size-4" /> Blocos de hoje</span>} action={<Link to="/cronograma" className="text-xs text-muted underline">Cronograma</Link>} />
          <div className="px-5 py-3">
            {blocks.isPending ? (
              <Spinner />
            ) : (blocks.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-muted">Nenhum bloco planejado para hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {blocks.data!.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <span className="tabular w-12 shrink-0 text-sm font-medium text-ink">{b.start_time}</span>
                    <ColorDot color={lookups.subjectColor(b.subject_id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{lookups.subjectName(b.subject_id)}</p>
                      <p className="truncate text-xs text-muted">
                        {ACTIVITY_LABELS[b.activity_type]} · {b.duration_minutes} min{b.topic_id ? ` · ${lookups.topicName(b.topic_id)}` : ''}
                      </p>
                    </div>
                    {b.status === 'pending' ? (
                      <Button size="sm" icon={<Play className="size-3.5" />} disabled={Boolean(live.data)} onClick={() => navigate(`/cronometro?bloco=${b.id}`)}>
                        Iniciar
                      </Button>
                    ) : (
                      <Badge color={PLAN_STATUS_COLORS[b.status]}>{PLAN_STATUS_LABELS[b.status]}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Brain className="size-4" /> Revisões para hoje</span>} action={<Link to="/revisoes" className="text-xs text-muted underline">Todas</Link>} />
          <div className="px-5 py-3">
            {(reviews.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-muted">Nenhuma revisão pendente. 🎉</p>
            ) : (
              <ul className="divide-y divide-line">
                {reviews.data!.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{r.title}</p>
                      <p className="text-xs text-muted">{r.scheduled_for < today ? `Atrasada desde ${formatDayKey(r.scheduled_for)}` : 'Hoje'}</p>
                    </div>
                    {r.topic_id && (
                      <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} disabled={Boolean(live.data)} onClick={() => navigate(`/cronometro?materia=${r.subject_id ?? ''}&topico=${r.topic_id}&atividade=review`)}>
                        Estudar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      icon={<Check className="size-3.5" />}
                      onClick={() =>
                        updateReview
                          .mutateAsync({ id: r.id, patch: { status: 'done', done_at: new Date().toISOString() } })
                          .then(() => toast.success('Revisão registrada como realizada.'))
                          .catch((e) => toast.error(e))
                      }
                    >
                      Feita
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-ink">
                <Layers className="size-4 text-accent-strong" /> {cardsDue.data ?? 0} flashcard(s) para revisar
              </span>
              <Button size="sm" disabled={!cardsDue.data} onClick={() => navigate('/flashcards/revisar?modo=vencidos')}>
                Revisar
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Tarefas de hoje" action={<Link to="/calendario" className="text-xs text-muted underline">Calendário</Link>} />
          <div className="px-5 py-3">
            {(tasks.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-muted">Nenhuma tarefa para hoje.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.data!.map((t) => (
                  <li key={t.id}>
                    <Checkbox
                      label={
                        <span className={t.done ? 'text-muted line-through' : ''}>
                          {t.start_time ? `${t.start_time} · ` : ''}
                          {t.title}
                        </span>
                      }
                      checked={t.done}
                      onChange={(e) => updateTask.mutate({ id: t.id, patch: { done: e.target.checked } })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><StickyNote className="size-4" /> Bloco de notas</span>} description="Salvo automaticamente no seu perfil." />
          <div className="px-5 py-3">
            <Scratchpad initial={settings.scratchpad ?? ''} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/questoes', icon: ClipboardCheck, label: 'Registrar questões' },
          { to: '/flashcards', icon: Layers, label: 'Flashcards' },
          { to: '/mapas', icon: Network, label: 'Mapas mentais' },
          { to: '/metas', icon: Check, label: 'Minhas metas' },
        ].map((q) => (
          <Link key={q.to} to={q.to}>
            <Card className="flex items-center gap-3 p-4 hover:bg-surface">
              <q.icon className="size-5 shrink-0 text-accent-strong" />
              <span className="truncate text-sm font-medium text-ink">{q.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Scratchpad({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const debounced = useDebounced(text, 800)
  const update = useUpdateSettings()
  useEffect(() => {
    if (!dirty) setText(initial)
  }, [initial, dirty])
  useEffect(() => {
    if (!dirty || debounced !== text) return
    update.mutate({ scratchpad: debounced.slice(0, 20000) }, { onSuccess: () => setDirty(false) })
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <Textarea
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
        }}
        placeholder="Anotações rápidas, dúvidas para pesquisar, lembretes…"
        aria-label="Bloco de notas"
        maxLength={20000}
      />
      <p className="mt-1 text-right text-[11px] text-muted" aria-live="polite">
        {update.isPending ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Salvo'}
      </p>
    </div>
  )
}
