import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Brain, CalendarRange, Check, CheckSquare, ChevronRight, ClipboardCheck, Eye, EyeOff, Layers, Play, RefreshCcw, Sparkles, StickyNote, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Textarea } from '@/components/ui/Field'
import { Card, CardHeader, ColorDot, PageHeader, Progress } from '@/components/ui/layout'
import { ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { useUpdate } from '@/hooks/data'
import { useProfile, useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useDebounced } from '@/hooks/useDebounced'
import { useToday } from '@/hooks/useToday'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { summarize } from '@/lib/cycle'
import { cn } from '@/lib/cn'
import type { Recommendation } from '@/lib/insight/recommend'
import type { TimelineItem, TimelineKind } from '@/lib/insight/today'
import { formatDayKey, formatDuration } from '@/lib/time'

const TYPE_TITLE: Record<Recommendation['type'], string> = {
  study: 'Próximo estudo recomendado',
  questions: 'Próxima ação: fazer questões',
  review: 'Próxima ação: revisão',
  flashcards: 'Próxima ação: flashcards',
}

const ACTIVITY: Record<Recommendation['type'], string> = { study: 'theory', questions: 'questions', review: 'review', flashcards: 'flashcards' }

/** Tela "Hoje": responde "o que eu deveria fazer agora?". */
export default function WorkspacePage() {
  const settings = useSettings()
  const profile = useProfile()
  const navigate = useNavigate()
  const live = useLiveSession()
  const day = useToday()
  const d = day.derived
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = profile.data?.display_name?.split(' ')[0]

  if (day.error) return <ErrorState error={day.error} onRetry={() => void day.refetch()} />
  if (day.pending || !d) return <Spinner label="Montando o seu dia…" className="min-h-[40vh]" />

  const goal = settings.dailyGoalMinutes * 60
  const top = d.recommendations[0] ?? null
  const others = d.recommendations.slice(1, 4)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`${greeting}${name ? `, ${name}` : ''}!`} description={`Hoje, ${formatDayKey(day.today, 'long')}.`} />

      {/* 1. Resumo do dia */}
      <section aria-labelledby="hoje-resumo" className="mb-5">
        <h2 id="hoje-resumo" className="sr-only">
          Resumo do dia
        </h2>
        <Card className="p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Estudado hoje</p>
              <p className="tabular text-2xl font-semibold text-ink">
                {formatDuration(d.studiedToday)} <span className="text-sm font-normal text-muted">de {formatDuration(goal)}</span>
              </p>
            </div>
            {live.data && (
              <Button variant="dark" icon={<Timer className="size-4" />} onClick={() => navigate('/cronometro')}>
                {live.data.status === 'pending_review' ? 'Confirmar sessão' : 'Sessão em andamento'}
              </Button>
            )}
          </div>
          <Progress value={goal ? (d.studiedToday / goal) * 100 : 0} className="mt-3 h-2" label="Meta diária" />
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <Fact label="Tempo livre restante">
              {d.freeMinutes == null ? (
                <Link to="/cronograma" className="text-xs font-normal underline">
                  configurar disponibilidade
                </Link>
              ) : (
                formatDuration(d.freeMinutes * 60)
              )}
            </Fact>
            <Fact label="Sessões concluídas">{d.sessionsToday}</Fact>
            <Fact label="Questões respondidas">{d.questionsToday}</Fact>
            <Fact label="Revisões pendentes">{d.reviewsDue.length}</Fact>
            <Fact label="Tarefas pendentes">{d.tasksPending}</Fact>
          </dl>
        </Card>
      </section>

      {/* 2. Próxima ação recomendada */}
      <section aria-labelledby="hoje-proxima" className="mb-5">
        {top ? (
          <NextAction rec={top} others={others} name={d.name} color={(id) => d.subjectsById.get(id)?.color ?? null} busy={Boolean(live.data)} onIgnore={day.ignore} />
        ) : (
          <Card className="p-5">
            <h2 id="hoje-proxima" className="font-semibold text-ink">
              Próxima ação
            </h2>
            {d.subjectsById.size === 0 ? (
              <p className="mt-1 text-sm text-muted">
                Cadastre suas matérias para receber recomendações.{' '}
                <Link to="/materias" className="underline">
                  Abrir o Explorador
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Nada urgente agora. Se tiver tempo, revise flashcards ou avance no cronograma.</p>
            )}
          </Card>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* 3. Plano restante do dia */}
        <section aria-labelledby="hoje-plano">
          <Card>
            <CardHeader title={<span id="hoje-plano" className="flex items-center gap-2"><CalendarRange className="size-4" /> Plano do dia</span>} action={<Link to="/calendario" className="text-xs text-muted underline">Calendário</Link>} />
            <div className="px-4 py-2">
              {d.timeline.length === 0 ? (
                <p className="py-4 text-sm text-muted">
                  Nada planejado para hoje.{d.freeMinutes == null && ' Configure sua disponibilidade no Cronograma para receber blocos sugeridos.'}
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.timeline.map((it) => (
                    <TimelineRow key={`${it.kind}:${it.refId}:${it.start}`} item={it} color={it.subjectId ? (d.subjectsById.get(it.subjectId)?.color ?? null) : null} busy={Boolean(live.data)} />
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        <div className="space-y-5">
          {/* 4. Pendências importantes */}
          <section aria-labelledby="hoje-pendencias">
            <Card>
              <CardHeader title={<span id="hoje-pendencias" className="flex items-center gap-2"><AlertTriangle className="size-4" /> Pendências</span>} />
              <div className="px-4 py-2">
                {d.pendencies.length === 0 ? (
                  <p className="py-3 text-sm text-muted">Nenhuma pendência importante.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.pendencies.map((p) => (
                      <li key={p.id}>
                        <Link to={p.to} className="flex items-center gap-2 py-2.5 text-sm text-ink hover:underline">
                          {p.tone === 'warning' ? <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Atenção" /> : <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
                          <span className="min-w-0 flex-1">{p.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </section>

          <CycleCard cycle={day.cycle} items={day.cycleItems} name={d.name} busy={Boolean(live.data)} />

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><StickyNote className="size-4" /> Bloco de notas</span>} description="Salvo automaticamente no seu perfil." />
            <div className="px-4 py-3">
              <Scratchpad initial={settings.scratchpad ?? ''} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-medium text-ink">{children}</dd>
    </div>
  )
}

function studyHref(r: Recommendation): string {
  const q = new URLSearchParams()
  if (r.planItemId) q.set('bloco', r.planItemId)
  else {
    q.set('materia', r.subjectId)
    if (r.topicId) q.set('topico', r.topicId)
    q.set('atividade', ACTIVITY[r.type])
    q.set('minutos', String(r.suggestedMinutes))
    q.set('modo', 'countdown')
  }
  return `/cronometro?${q}`
}

function NextAction({ rec, others, name, color, busy, onIgnore }: { rec: Recommendation; others: Recommendation[]; name: (s: string | null, t: string | null) => string; color: (id: string) => string | null; busy: boolean; onIgnore: (id: string) => void }) {
  const navigate = useNavigate()
  const subjectName = name(rec.subjectId, null)
  const topicName = rec.topicId ? name(null, rec.topicId) : null
  const topicHref = rec.topicId ? `/materias/${rec.subjectId}/topico/${rec.topicId}` : `/materias/${rec.subjectId}`
  const reviewHref =
    rec.type === 'flashcards' || !rec.reviewId
      ? `/flashcards/revisar?${rec.topicId ? `topico=${rec.topicId}` : `materia=${rec.subjectId}`}`
      : `/cronometro?materia=${rec.subjectId}${rec.topicId ? `&topico=${rec.topicId}` : ''}&atividade=review`
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5" style={{ background: color(rec.subjectId) ?? 'var(--accent)' }} aria-hidden />
      <div className="p-5">
        <h2 id="hoje-proxima" className="text-xs font-semibold tracking-wide text-accent-strong uppercase">
          {TYPE_TITLE[rec.type]}
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <ColorDot color={color(rec.subjectId)} /> {subjectName}
        </p>
        <p className="text-xl font-semibold text-ink">{topicName ?? subjectName}</p>
        <p className="mt-0.5 text-sm text-muted">{rec.suggestedMinutes} min sugeridos</p>
        {rec.reasons.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted">Motivos</p>
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {rec.reasons.slice(0, 4).map((r) => (
                <li key={r.label} className="flex gap-2">
                  <span aria-hidden className="text-accent-strong">
                    •
                  </span>{' '}
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={<Play className="size-4" />} disabled={busy} onClick={() => navigate(studyHref(rec))}>
            Começar agora
          </Button>
          <Button icon={<ClipboardCheck className="size-4" />} onClick={() => navigate(`/questoes?materia=${rec.subjectId}${rec.topicId ? `&topico=${rec.topicId}` : ''}`)}>
            Fazer questões
          </Button>
          <Button icon={<Brain className="size-4" />} onClick={() => navigate(reviewHref)}>
            Revisar
          </Button>
          <Button variant="ghost" icon={<Eye className="size-4" />} onClick={() => navigate(topicHref)}>
            Ver tópico
          </Button>
          <Button variant="ghost" icon={<EyeOff className="size-4" />} onClick={() => onIgnore(rec.id)}>
            Ignorar por hoje
          </Button>
        </div>
        {others.length > 0 && (
          <div className="mt-5 border-t border-line pt-3">
            <p className="text-xs font-medium text-muted">Outras opções</p>
            <ul className="mt-1 divide-y divide-line">
              {others.map((o) => (
                <li key={o.id} className="flex items-center gap-2 py-2">
                  <ColorDot color={color(o.subjectId)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{name(o.subjectId, o.topicId)}</p>
                    <p className="truncate text-xs text-muted">
                      {o.suggestedMinutes} min · {o.reasons.slice(0, 2).map((r) => r.label).join(' · ')}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} disabled={busy} onClick={() => navigate(studyHref(o))} aria-label={`Começar ${name(o.subjectId, o.topicId)}`}>
                    Começar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

const KIND: Record<TimelineKind, { label: string; icon: typeof Check; className: string }> = {
  planned: { label: 'Planejado', icon: CalendarRange, className: 'text-ink' },
  suggested: { label: 'Sugerido', icon: Sparkles, className: 'text-ink' },
  late: { label: 'Atrasado', icon: AlertTriangle, className: 'text-warning' },
  review: { label: 'Revisão', icon: Brain, className: 'text-ink' },
  task: { label: 'Tarefa', icon: CheckSquare, className: 'text-ink' },
  done: { label: 'Concluído', icon: Check, className: 'text-success' },
}

function TimelineRow({ item, color, busy }: { item: TimelineItem; color: string | null; busy: boolean }) {
  const navigate = useNavigate()
  const toast = useToast()
  const updateReview = useUpdate('reviews')
  const updateTask = useUpdate('calendar_tasks')
  const k = KIND[item.kind]
  const params = new URLSearchParams({
    ...(item.subjectId ? { materia: item.subjectId } : {}),
    ...(item.topicId ? { topico: item.topicId } : {}),
    atividade: item.kind === 'review' ? 'review' : 'theory',
    ...(item.minutes ? { minutos: String(item.minutes), modo: 'countdown' } : {}),
  })
  const startHref = item.kind === 'planned' || item.kind === 'late' ? `/cronometro?bloco=${item.refId}` : item.kind === 'suggested' || item.kind === 'review' ? `/cronometro?${params}` : null
  return (
    <li className={cn('flex items-center gap-3 py-2.5', item.kind === 'done' && 'opacity-70', item.kind === 'suggested' && 'my-1 rounded-md border border-dashed border-line px-2')}>
      <span className="tabular w-11 shrink-0 text-sm font-medium text-ink">{item.start ?? '—'}</span>
      {color ? <ColorDot color={color} /> : <span className="w-2.5" />}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm text-ink', item.kind === 'done' && 'line-through decoration-1')}>{item.label}</p>
        <p className={cn('flex items-center gap-1 text-xs', k.className)}>
          <k.icon className="size-3.5" aria-hidden /> {k.label}
          {item.minutes ? <span className="text-muted"> · {item.minutes} min</span> : null}
        </p>
      </div>
      {item.kind === 'task' ? (
        <Checkbox label={<span className="sr-only">Concluir tarefa {item.label}</span>} checked={false} onChange={() => updateTask.mutate({ id: item.refId, patch: { done: true } })} />
      ) : item.kind === 'review' ? (
        <div className="flex gap-1">
          {startHref && (
            <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} disabled={busy} onClick={() => navigate(startHref)} aria-label={`Estudar ${item.label}`}>
              Estudar
            </Button>
          )}
          <Button
            size="sm"
            icon={<Check className="size-3.5" />}
            onClick={() =>
              updateReview
                .mutateAsync({ id: item.refId, patch: { status: 'done', done_at: new Date().toISOString() } })
                .then(() => toast.success('Revisão registrada como realizada.'))
                .catch((e) => toast.error(e))
            }
          >
            Feita
          </Button>
        </div>
      ) : startHref ? (
        <Button size="sm" icon={<Play className="size-3.5" />} disabled={busy} onClick={() => navigate(startHref)} aria-label={`Iniciar ${item.label}`}>
          Iniciar
        </Button>
      ) : null}
    </li>
  )
}

function CycleCard({ cycle, items, name, busy }: { cycle: ReturnType<typeof useToday>['cycle']; items: ReturnType<typeof useToday>['cycleItems']; name: (s: string | null, t: string | null) => string; busy: boolean }) {
  const navigate = useNavigate()
  const summary = cycle && items.length ? summarize(cycle, items) : null
  return (
    <Card className="p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <RefreshCcw className="size-4 text-accent-strong" /> Ciclo de estudos
      </p>
      {!cycle ? (
        <p className="text-sm text-muted">
          Nenhum ciclo ativo.{' '}
          <Link to="/ciclos" className="underline">
            Criar ou ativar
          </Link>
        </p>
      ) : !summary?.current ? (
        <p className="text-sm text-muted">O ciclo "{cycle.name}" não tem blocos.</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {cycle.name} · bloco {summary.position}/{summary.length}
          </p>
          <p className="mt-1 truncate font-medium text-ink">{name(summary.current.subject_id, summary.current.topic_id)}</p>
          <p className="text-xs text-muted">
            {formatDuration(cycle.current_progress_seconds)} de {summary.current.duration_minutes} min
          </p>
          <Progress value={summary.blockPercent} className="my-2" label="Progresso do bloco" />
          <Button
            size="sm"
            icon={<Play className="size-3.5" />}
            disabled={busy}
            onClick={() => navigate(`/cronometro?item=${summary.current!.id}&minutos=${Math.max(1, Math.ceil((summary.current!.duration_minutes * 60 - cycle.current_progress_seconds) / 60))}`)}
          >
            Estudar este bloco
          </Button>
        </>
      )}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-ink">
          <Layers className="size-4 text-accent-strong" /> Flashcards
        </span>
        <Link to="/flashcards/revisar?modo=vencidos" className="text-xs underline">
          Revisar vencidos
        </Link>
      </div>
    </Card>
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
        rows={5}
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
