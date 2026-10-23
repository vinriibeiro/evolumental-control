import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, CalendarClock, Flame, Play, Timer, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, ColorDot, PageHeader, Progress, StatCard } from '@/components/ui/layout'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { ChartCard, ColumnChart, ConsistencyGrid, RankBars } from '@/components/charts/Charts'
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker'
import { useAll, useList, useSessions } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, inList, lte } from '@/lib/data/types'
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '@/lib/labels'
import { breakdown, isNoSubject, series, streak } from '@/lib/stats'
import { netSeconds } from '@/lib/timer/engine'
import { addDays, dayKey, eachDay, formatDayKey, formatDuration, formatHours, formatTime, periodRange, startOfWeek, todayKey, type DayRange } from '@/lib/time'
import type { ActivityType } from '@/types/db'
import { EvoQuestCard } from '@/pages/evoquest/DashboardCard'
import { ActivityCalendar, FeedCard, WeekCard } from '@/components/insight/EvolutionCards'
import { ForecastCard } from '@/components/insight/ForecastCard'
import { useToday } from '@/hooks/useToday'

const fmtH = (s: number) => formatHours(s)

export default function DashboardPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const { state, setState, range } = usePeriod(today, 'week')
  const navigate = useNavigate()
  const lookups = useLookups()

  // Uma consulta (em cache) com as sessões concluídas; todos os números saem dela.
  const sessions = useSessions({ filters: [eq('status', 'completed')], order: [{ column: 'started_at' }] })
  const all = sessions.data
  const allTime = useMemo(() => breakdown(all ?? [], tz, { from: '1970-01-01', to: '9999-12-31' }), [all, tz])
  const day = useMemo(() => breakdown(all ?? [], tz, periodRange('day', today)), [all, tz, today])
  const week = useMemo(() => breakdown(all ?? [], tz, periodRange('week', today)), [all, tz, today])
  const period = useMemo(() => breakdown(all ?? [], tz, range), [all, tz, range])

  const chartRange: DayRange = state.kind === 'day' ? { from: addDays(range.from, -6), to: range.to } : range
  const chartData = useMemo(() => breakdown(all ?? [], tz, chartRange), [all, tz, chartRange.from, chartRange.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const last16w = useMemo(() => {
    const from = addDays(startOfWeek(today), -15 * 7)
    return series(allTime.byDay, { from, to: addDays(startOfWeek(today), 6) }).map((d) => ({ ...d, label: formatDayKey(d.day, 'weekday') }))
  }, [allTime.byDay, today])

  const plan = useAll('study_plan_items', { filters: [gte('date', chartRange.from), lte('date', chartRange.to)] })
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

  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
  const loading = sessions.isPending
  const v = (n: number) => (loading ? '…' : formatDuration(n))

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Seu estudo líquido (sem pausas) e o que vem pela frente."
        actions={
          <Button variant="dark" size="lg" icon={<Play className="size-5" />} onClick={() => navigate('/cronometro')}>
            Iniciar estudo
          </Button>
        }
      />

      {/* 1. Como estou hoje? */}
      <section aria-labelledby="vg-hoje">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="vg-hoje" className="text-base font-semibold text-ink">
            Como estou hoje?
          </h2>
          <Link to="/espaco" className="text-xs text-muted underline">
            Abrir a tela Hoje
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Hoje" value={v(day.total)} icon={<Timer className="size-4" />} hint={`${day.sessions} sessão(ões)`}>
            <Progress value={dailyGoal ? (day.total / dailyGoal) * 100 : 0} className="mt-2" label="Meta diária" />
            <p className="mt-1 text-[11px] text-muted">Meta diária {formatDuration(dailyGoal)}</p>
          </StatCard>
          <StatCard label="Esta semana" value={v(week.total)} icon={<TrendingUp className="size-4" />} hint={`${week.sessions} sessão(ões)`}>
            <Progress value={weeklyGoal ? (week.total / weeklyGoal) * 100 : 0} className="mt-2" label="Meta semanal" />
            <p className="mt-1 text-[11px] text-muted">Meta semanal {formatDuration(weeklyGoal)}</p>
          </StatCard>
          <StatCard label="Dias consecutivos" value={loading ? '…' : `${currentStreak} dia${currentStreak === 1 ? '' : 's'}`} icon={<Flame className="size-4" />} hint={loading ? undefined : `${formatHours(allTime.total)} no total`} />
        </div>
      </section>

      {/* 2. O que preciso fazer? */}
      <section aria-labelledby="vg-fazer" className="mt-6">
        <h2 id="vg-fazer" className="mb-2 text-base font-semibold text-ink">
          O que preciso fazer?
        </h2>
        <TodoCard />
      </section>

      {/* 3. Estou evoluindo? */}
      <section aria-labelledby="vg-evolucao" className="mt-6">
        <h2 id="vg-evolucao" className="mb-2 text-base font-semibold text-ink">
          Estou evoluindo?
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <FeedCard />
          <WeekCard />
          <div className="lg:col-span-2">
            <ActivityCalendar />
          </div>
          <ForecastCard title="Previsão de conclusão (matérias ativas)" />
          <EvoQuestCard />
        </div>
      </section>

      <div className="mt-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Gráficos e análise do período</h2>
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
          description="Os gráficos aparecem assim que você concluir a primeira sessão de estudo."
          action={
            <Button variant="primary" onClick={() => navigate('/cronometro')}>
              Iniciar estudo
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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
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

/** O que fazer agora: a próxima ação recomendada e as pendências (resumo da tela Hoje). */
function TodoCard() {
  const navigate = useNavigate()
  const day = useToday()
  const d = day.derived
  if (day.pending || !d) return <Skeleton className="h-28" />
  const top = d.recommendations[0]
  return (
    <Card className="p-4">
      {top ? (
        <div className="flex flex-wrap items-center gap-3">
          <ColorDot color={d.subjectsById.get(top.subjectId)?.color ?? null} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Próxima ação recomendada</p>
            <p className="truncate font-semibold text-ink">{d.name(top.subjectId, top.topicId)}</p>
            <p className="truncate text-xs text-muted">
              {top.suggestedMinutes} min · {top.reasons.slice(0, 3).map((r) => r.label).join(' · ')}
            </p>
          </div>
          <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} onClick={() => navigate('/espaco')}>
            Ver na tela Hoje
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Nada urgente agora.</p>
      )}
      {d.pendencies.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {d.pendencies.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link to={p.to} className="block py-2 text-sm text-ink hover:underline">
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
