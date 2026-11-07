import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, BookCheck, BookOpen, Brain, CalendarClock, CalendarDays, Check, Code2, Flame, GraduationCap, Layers, Play, Timer, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, ColorDot, Progress, StatCard } from '@/components/ui/layout'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { ChartCard, ColumnChart, ConsistencyGrid, RankBars } from '@/components/charts/Charts'
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker'
import { TodayRoutine } from '@/components/TodayRoutine'
import { useAll, useCount, useList, useSessions } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useProfile, useSettings } from '@/hooks/useSettings'
import { useNow } from '@/hooks/useNow'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { eq, gte, inList, lte } from '@/lib/data/types'
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '@/lib/labels'
import { breakdown, isNoSubject, series, streak } from '@/lib/stats'
import { netSeconds, openPause } from '@/lib/timer/engine'
import { addDays, dayKey, eachDay, formatDayKey, formatDuration, formatHours, formatTime, periodRange, startOfWeek, type DayRange, minuteIso } from '@/lib/time'
import type { ActivityType } from '@/types/db'
import { nextAction } from './nextAction'

const fmtH = (s: number) => formatHours(s)

export default function DashboardPage() {
  const settings = useSettings()
  const profile = useProfile()
  const live = useLiveSession()
  const now = useNow(60_000)
  const tz = settings.timezone
  const today = dayKey(now, tz)
  const { state, setState, range } = usePeriod(today, 'week')
  const navigate = useNavigate()
  const lookups = useLookups()

  // Uma consulta (em cache) com as sessões concluídas; todos os números saem dela.
  const sessions = useSessions({ filters: [eq('status', 'completed')], order: [{ column: 'started_at' }] })
  const all = sessions.data
  const allTime = useMemo(() => breakdown(all ?? [], tz, { from: '1970-01-01', to: '9999-12-31' }), [all, tz])
  const day = useMemo(() => breakdown(all ?? [], tz, periodRange('day', today)), [all, tz, today])
  const week = useMemo(() => breakdown(all ?? [], tz, periodRange('week', today)), [all, tz, today])
  const month = useMemo(() => breakdown(all ?? [], tz, periodRange('month', today)), [all, tz, today])
  const period = useMemo(() => breakdown(all ?? [], tz, range), [all, tz, range])

  const chartRange: DayRange = state.kind === 'day' ? { from: addDays(range.from, -6), to: range.to } : range
  const chartData = useMemo(() => breakdown(all ?? [], tz, chartRange), [all, tz, chartRange.from, chartRange.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const last16w = useMemo(() => {
    const from = addDays(startOfWeek(today), -15 * 7)
    return series(allTime.byDay, { from, to: addDays(startOfWeek(today), 6) }).map((d) => ({ ...d, label: formatDayKey(d.day, 'weekday') }))
  }, [allTime.byDay, today])

  const plan = useAll('study_plan_items', { filters: [gte('date', chartRange.from), lte('date', chartRange.to)] })
  const reviewsDue = useCount('reviews', [inList('status', ['planned', 'postponed']), lte('scheduled_for', today)])
  const cardsDue = useCount('flashcards', [inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())])
  const topicsDone = useCount('topics', [eq('status', 'completed')])
  const topicsTotal = useCount('topics', [])
  const upcoming = useAll('study_plan_items', { filters: [gte('date', today), lte('date', addDays(today, 2)), eq('status', 'pending')], order: [{ column: 'date' }, { column: 'start_time' }] })
  const upcomingReviews = useList('reviews', { filters: [inList('status', ['planned', 'postponed']), lte('scheduled_for', addDays(today, 2))], order: [{ column: 'scheduled_for' }], limit: 5 })
  const tasks = useAll('calendar_tasks', { filters: [gte('date', today), lte('date', addDays(today, 7)), eq('done', false)], order: [{ column: 'date' }] })

  const dailyGoal = settings.dailyGoalMinutes * 60
  const weeklyGoal = settings.weeklyGoalMinutes * 60
  const currentStreak = streak(allTime.byDay, today)

  const evolution = series(chartData.byDay, chartRange).map((d) => ({ label: d.day, horas: Math.round((d.seconds / 3600) * 100) / 100 }))
  const plannedVsDone = useMemo(() => {
    const planned = new Map<string, number>()
    for (const p of plan.data ?? []) planned.set(p.date, (planned.get(p.date) ?? 0) + p.duration_minutes * 60)
    return eachDay(chartRange.from, chartRange.to).map((d) => ({
      label: d,
      planejado: Math.round(((planned.get(d) ?? 0) / 3600) * 100) / 100,
      realizado: Math.round(((chartData.byDay.get(d) ?? 0) / 3600) * 100) / 100,
    }))
  }, [plan.data, chartData.byDay, chartRange.from, chartRange.to])

  const bySubject = [...period.bySubject]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: isNoSubject(k) ? 'Sem matéria' : lookups.subjectName(k), value: v, color: isNoSubject(k) ? 'var(--muted)' : lookups.subjectColor(k) }))
  const byActivity = [...period.byActivity].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: ACTIVITY_LABELS[k as ActivityType], value: v, color: ACTIVITY_COLORS[k as ActivityType] }))
  const recent = useMemo(() => [...(all ?? [])].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 6), [all])
  const todayBlock = upcoming.data?.find((p) => p.date === today)
  const focus = nextAction({
    sessionStatus: live.data?.status === 'active' || live.data?.status === 'pending_review' ? live.data.status : null,
    paused: live.data ? Boolean(openPause(live.data.pauses)) : false,
    reviewsDue: reviewsDue.data ?? 0,
    cardsDue: cardsDue.data ?? 0,
    todayBlock: todayBlock ? { id: todayBlock.id, subject: lookups.subjectName(todayBlock.subject_id), minutes: todayBlock.duration_minutes } : null,
    hasSubjects: lookups.subjects.length > 0,
  })
  const focusLoading = live.isPending || reviewsDue.isPending || cardsDue.isPending || upcoming.isPending || lookups.loading
  const firstName = profile.data?.display_name?.trim().split(/\s+/)[0]
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(now))
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now)
  const dailyPercent = dailyGoal > 0 ? Math.min(100, Math.max(0, Math.round(day.total / dailyGoal * 100))) : 0
  const remaining = Math.max(0, dailyGoal - day.total)

  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
  const loading = sessions.isPending
  const v = (n: number) => (loading ? '…' : formatDuration(n))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-accent-strong uppercase">Seu espaço para evoluir</p>
          <h1 className="font-[Georgia,serif] text-3xl leading-tight tracking-tight text-ink sm:text-[42px]">{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
          <p className="mt-2 text-sm text-muted">Cada sessão conta. Vamos dar o próximo passo?</p>
        </div>
        <p className="flex items-center gap-2 rounded-full border border-line bg-bg px-3.5 py-2 text-xs text-muted">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="first-letter:uppercase">{dateLabel}</span>
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <section aria-labelledby="proximo-passo" className="relative isolate flex min-h-[250px] flex-col justify-between overflow-hidden rounded-2xl bg-[#183f35] p-6 text-white sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-32 -z-10 size-[380px] rounded-full border-[40px] border-white/[0.035]" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-40 -z-10 size-[380px] rounded-full border border-white/10" />
          <div className="relative max-w-xl">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.17em] text-[#d2e1c8] uppercase"><span className="size-1.5 rounded-full bg-[#c4d6b0]" />{focusLoading ? 'Preparando seu dia' : focus.eyebrow}</p>
            <h2 id="proximo-passo" className="max-w-md text-2xl font-semibold leading-[1.2] tracking-tight sm:text-[30px]">{focusLoading ? 'Seu próximo passo, bem aqui.' : focus.title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75">{focusLoading ? 'Buscando suas sessões e seu planejamento de estudos.' : focus.description}</p>
          </div>
          <div className="relative mt-6 flex flex-wrap items-center gap-4">
            <Button variant="secondary" className="!border-white !bg-white !text-[#183f35] hover:!bg-[#eff4eb]" disabled={focusLoading} onClick={() => navigate(focus.to)} icon={<Play className="size-3.5" aria-hidden />}>{focusLoading ? 'Carregando…' : focus.label}</Button>
            <Link to="/calendario" className="inline-flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white">Ver meu planejamento <ArrowRight className="size-3.5" aria-hidden /></Link>
          </div>
        </section>

        <Card className="flex flex-col items-center justify-center px-5 py-5 text-center">
          <div className="flex w-full items-center justify-between text-xs"><span className="font-semibold text-ink">Seu foco de hoje</span><Link to="/configuracoes" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">Ajustar meta</Link></div>
          <div className="relative my-2 flex size-36 items-center justify-center">
            <svg viewBox="0 0 144 144" className="absolute inset-0 size-full -rotate-90" aria-hidden>
              <circle cx="72" cy="72" r="59" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
              <circle cx="72" cy="72" r="59" fill="none" stroke="var(--accent-strong)" strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray={`${dailyPercent} 100`} />
            </svg>
            <div role="progressbar" aria-label="Meta diária de estudo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dailyPercent} aria-valuetext={`${formatDuration(day.total)} de ${formatDuration(dailyGoal)}`}>
              <p className="tabular text-[28px] font-semibold tracking-tight text-ink">{v(day.total)}</p>
              <p className="mt-0.5 text-[11px] text-muted">de {formatDuration(dailyGoal)}</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent-strong">{dailyPercent >= 100 ? <Check className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-hidden />}{loading ? 'Carregando seu progresso' : dailyGoal <= 0 ? 'Defina uma meta para acompanhar' : dailyPercent >= 100 ? 'Meta de hoje alcançada' : `Faltam ${formatDuration(remaining)} para sua meta`}</p>
          <p className="mt-1.5 text-[11px] text-muted">Tempo líquido, sem contar as pausas.</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Esta semana" value={v(week.total)} icon={<TrendingUp className="size-4" />} hint={`${week.sessions} sessão(ões)`}>
          <Progress value={weeklyGoal ? (week.total / weeklyGoal) * 100 : 0} className="mt-2" label="Meta semanal" />
          <p className="mt-1 text-[11px] text-muted">Meta semanal {formatDuration(weeklyGoal)}</p>
        </StatCard>
        <StatCard label="Dias consecutivos" value={loading ? '…' : `${currentStreak} dia${currentStreak === 1 ? '' : 's'}`} icon={<Flame className="size-4" />} hint="Consistência constrói conhecimento" />
        <StatCard label="Revisões pendentes" value={reviewsDue.data ?? '…'} icon={<Brain className="size-4" />} hint={<Link to="/revisoes" className="underline decoration-line underline-offset-4">Colocar em dia <ArrowRight className="inline size-3" aria-hidden /></Link>} />
        <StatCard
          label="Conteúdos concluídos"
          value={topicsTotal.data != null ? `${topicsDone.data ?? 0}/${topicsTotal.data}` : '…'}
          icon={<BookCheck className="size-4" />}
          hint={topicsTotal.data ? `${(topicsTotal.data ?? 0) - (topicsDone.data ?? 0)} pendente(s)` : 'Cadastre tópicos'}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TodayRoutine />
        <Card>
          <CardHeader title="Seu aprendizado, à mão" description="Escolha por onde quer continuar." />
          <div className="grid grid-cols-2 gap-2 p-4">
            {[
              { to: '/cursos', label: 'Meus cursos', description: 'Aulas e materiais', icon: GraduationCap },
              { to: '/livros', label: 'Meus livros', description: 'Retome sua leitura', icon: BookOpen },
              { to: '/flashcards/revisar?modo=vencidos', label: 'Flashcards', description: cardsDue.data != null ? `${cardsDue.data} para revisar` : 'Repetição espaçada', icon: Layers },
              { to: '/banco-de-questoes/desafios', label: 'Desafios de código', description: 'Python, SQL e Git', icon: Code2 },
            ].map((item) => <Link key={item.to} to={item.to} className="group flex min-h-24 flex-col items-start rounded-xl border border-line bg-surface/50 p-3.5 transition-colors hover:border-accent-strong/40 hover:bg-surface">
              <span className="mb-2 flex w-full items-center justify-between text-accent-strong"><item.icon className="size-[18px]" aria-hidden /><ArrowRight className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              <span className="text-xs font-semibold text-ink">{item.label}</span>
              <span className="mt-1 text-[11px] text-muted">{item.description}</span>
            </Link>)}
          </div>
        </Card>
      </div>

      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">Pequenos passos. Evolução real.</p><h2 className="text-xl font-semibold tracking-tight text-ink">Análise do período</h2></div>
        <PeriodPicker state={state} setState={setState} range={range} today={today} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tempo líquido" value={v(period.total)} />
        <StatCard label="Sessões realizadas" value={loading ? '…' : period.sessions} />
        <StatCard label="Matérias estudadas" value={loading ? '…' : period.subjectsStudied} />
        <StatCard label="Média por sessão" value={loading ? '…' : formatDuration(period.sessions ? period.total / period.sessions : 0)} />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : allTime.sessions === 0 ? (
        <EmptyState
          icon={<Timer className="size-8" />}
          title="Nenhuma sessão registrada ainda"
          description="Sua evolução vai ganhar forma aqui. Conclua sua primeira sessão para acompanhar o tempo estudado e descobrir seu ritmo."
          action={
            <Button variant="primary" onClick={() => navigate('/cronometro')}>
              Registrar meu primeiro estudo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Evolução do tempo de estudo"
            description={state.kind === 'day' ? 'Últimos 7 dias, em horas' : 'Horas líquidas por dia'}
            table={{ columns: ['Dia', 'Horas'], rows: evolution.map((e) => [formatDayKey(e.label), e.horas]) }}
          >
            <ColumnChart data={evolution} series={[{ key: 'horas', label: 'Horas', color: 'var(--accent-strong)' }]} xKey="label" format={(n) => `${n}h`} xFormat={(d) => formatDayKey(d)} />
          </ChartCard>
          <ChartCard
            title="Planejado × realizado"
            description="Horas do cronograma versus horas líquidas estudadas"
            legend={[
              { key: 'planejado', label: 'Planejado', color: 'var(--series-4)' },
              { key: 'realizado', label: 'Realizado', color: 'var(--series-1)' },
            ]}
            table={{ columns: ['Dia', 'Planejado (h)', 'Realizado (h)'], rows: plannedVsDone.map((p) => [formatDayKey(p.label), p.planejado, p.realizado]) }}
          >
            <ColumnChart
              data={plannedVsDone}
              series={[
                { key: 'planejado', label: 'Planejado', color: 'var(--series-4)' },
                { key: 'realizado', label: 'Realizado', color: 'var(--series-1)' },
              ]}
              xKey="label"
              format={(n) => `${n}h`}
              xFormat={(d) => formatDayKey(d)}
            />
          </ChartCard>
          <ChartCard title="Tempo por matéria" description="No período selecionado" table={{ columns: ['Matéria', 'Tempo'], rows: bySubject.map((b) => [b.label, formatDuration(b.value)]) }}>
            <RankBars items={bySubject} format={fmtH} />
          </ChartCard>
          <ChartCard title="Distribuição por atividade" description="No período selecionado" table={{ columns: ['Atividade', 'Tempo'], rows: byActivity.map((b) => [b.label, formatDuration(b.value)]) }}>
            <RankBars items={byActivity} format={fmtH} />
          </ChartCard>
          <ChartCard title="Constância diária" description="Últimas 16 semanas" className="lg:col-span-2">
            <ConsistencyGrid days={last16w} format={(s) => formatDuration(s)} />
          </ChartCard>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-4 py-3 text-xs text-muted">
        <span><span className="font-semibold text-ink">{v(month.total)}</span> estudados neste mês · {month.subjectsStudied} matéria(s)</span>
        <span><span className="font-semibold text-ink">{loading ? '…' : formatHours(allTime.total)}</span> na sua jornada · {allTime.sessions} sessão(ões)</span>
        <a href="#atividade-recente" className="inline-flex items-center gap-1 font-medium text-accent-strong">Ver atividade <ArrowDown className="size-3" aria-hidden /></a>
      </div>

      <div id="atividade-recente" className="grid scroll-mt-28 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Atividades recentes" action={<Link to="/relatorios" className="text-xs text-muted underline">Relatórios</Link>} />
          <ul className="divide-y divide-line px-5 py-2">
            {recent.length === 0 && <li className="py-6 text-center text-sm text-muted">Nada por aqui ainda.</li>}
            {recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <ColorDot color={lookups.subjectColor(s.subject_id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{lookups.subjectName(s.subject_id)}</p>
                  <p className="truncate text-xs text-muted">
                    {ACTIVITY_LABELS[s.activity_type]} · {formatDayKey(dayKey(new Date(s.started_at).getTime(), tz))} {formatTime(new Date(s.started_at).getTime(), tz, settings.hourFormat)}
                  </p>
                </div>
                <span className="tabular text-sm font-medium text-ink">{formatDuration(netSeconds(s, s.pauses))}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Próximas tarefas" action={<Link to="/calendario" className="text-xs text-muted underline">Calendário</Link>} />
          <ul className="divide-y divide-line px-5 py-2">
            {(upcoming.data ?? []).slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <CalendarClock className="size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{lookups.subjectName(p.subject_id)}</p>
                  <p className="text-xs text-muted">
                    {p.date === today ? 'Hoje' : formatDayKey(p.date, 'weekday')} · {p.start_time} · {p.duration_minutes} min
                  </p>
                </div>
                <Button size="sm" icon={<Play className="size-3.5" />} onClick={() => navigate(`/cronometro?bloco=${p.id}`)}>
                  Iniciar
                </Button>
              </li>
            ))}
            {(upcomingReviews.data?.rows ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <Brain className="size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.title}</p>
                  <p className="text-xs text-muted">{r.scheduled_for < today ? 'Atrasada' : r.scheduled_for === today ? 'Hoje' : formatDayKey(r.scheduled_for, 'weekday')}</p>
                </div>
              </li>
            ))}
            {(tasks.data ?? []).slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <CalendarClock className="size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{t.title}</p>
                  <p className="text-xs text-muted">{formatDayKey(t.date, 'weekday')}</p>
                </div>
              </li>
            ))}
            {!upcoming.data?.length && !upcomingReviews.data?.rows.length && !tasks.data?.length && <li className="py-6 text-center text-sm text-muted">Nenhuma tarefa nos próximos dias.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
