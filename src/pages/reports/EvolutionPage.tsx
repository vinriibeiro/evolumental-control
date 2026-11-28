import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Download, FileText, Minus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, PageHeader, Progress, Segmented, StatCard } from '@/components/ui/layout'
import { ErrorState, Skeleton, useToast } from '@/components/ui/feedback'
import { ChartCard, ColumnChart, ConsistencyGrid, RankBars } from '@/components/charts/Charts'
import { PeriodPicker, describeRange, usePeriod } from '@/components/PeriodPicker'
import { useAll, useSessions } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, lte } from '@/lib/data/types'
import { downloadCsv, downloadPdf } from '@/lib/download'
import { lastMonths, lastWeeks, previousRange } from '@/lib/evolution'
import type { GoalSnapshot } from '@/lib/goals'
import { breakdown, series } from '@/lib/stats'
import { formatDateTime, formatDayKey, formatDuration, formatHours, todayKey, zonedDayStart } from '@/lib/time'
import { buildEvolution, evolutionDailyRows, evolutionDocument, evolutionSummaryRows, seriesFor, type ComparisonRow, type EvolutionInput } from './evolutionModel'

const PLANNED = { key: 'plannedHours', label: 'Planejado', color: 'var(--series-4)' }
const ACTUAL = { key: 'actualHours', label: 'Realizado', color: 'var(--series-1)' }
const fmtH = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`
const pct = (v: number) => `${Math.round(v)}%`

export default function EvolutionPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const { state, setState, range } = usePeriod(today, 'month')
  const [trend, setTrend] = useState<'week' | 'month'>('week')
  const [exporting, setExporting] = useState(false)
  const lookups = useLookups()
  const toast = useToast()

  // As tendências (12 semanas / 6 meses) terminam no período escolhido, ou hoje se ele ainda não acabou.
  const anchor = range.to > today ? today : range.to
  const weeksRange = lastWeeks(anchor, 12)
  const monthsRange = lastMonths(anchor, 6)
  // Janela das consultas: cobre o período, o período anterior equivalente e as duas tendências.
  const windowFrom = [previousRange(state.kind, range).from, weeksRange.from, monthsRange.from].sort()[0]
  const windowTo = [range.to, weeksRange.to, monthsRange.to].sort()[2]
  const windowIso = new Date(zonedDayStart(windowFrom, tz) - 86400000).toISOString()

  // Uma consulta (em cache) com todas as sessões concluídas: horas, constância e sequência saem dela.
  const sessions = useSessions({ filters: [eq('status', 'completed')], order: [{ column: 'started_at' }] })
  const planItems = useAll('study_plan_items', { filters: [gte('date', windowFrom), lte('date', windowTo)] }, { keepPrevious: true })
  const tasks = useAll('calendar_tasks', { filters: [gte('date', windowFrom), lte('date', windowTo)] }, { keepPrevious: true })
  const reviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', windowIso)] }, { keepPrevious: true })
  const goals = useAll('study_goals')
  const queries = [sessions, planItems, tasks, reviews, goals]
  const failed = queries.find((x) => x.isError)
  const loading = queries.some((x) => x.isPending) || lookups.loading

  const input: EvolutionInput = useMemo(
    () => ({
      kind: state.kind,
      range,
      today,
      timezone: tz,
      sessions: sessions.data ?? [],
      planItems: planItems.data ?? [],
      tasks: tasks.data ?? [],
      topics: lookups.topics,
      subjects: lookups.subjects,
      goals: goals.data ?? [],
      flashcardReviews: reviews.data ?? [],
    }),
    [state.kind, range, today, tz, sessions.data, planItems.data, tasks.data, lookups.topics, lookups.subjects, goals.data, reviews.data],
  )
  const model = useMemo(() => buildEvolution(input), [input])
  const trendData = useMemo(() => seriesFor(input, trend === 'week' ? weeksRange : monthsRange, trend), [input, trend, weeksRange.from, weeksRange.to, monthsRange.from, monthsRange.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => {
    const byDay = breakdown(input.sessions, tz, { from: '1970-01-01', to: '9999-12-31' }).byDay
    return series(byDay, lastWeeks(today, 16)).map((d) => ({ ...d, label: formatDayKey(d.day, 'weekday') }))
  }, [input.sessions, tz, today])

  const periodLabel = describeRange(state.kind, range)
  const slug = `${range.from}-a-${range.to}`
  const exportPdf = async () => {
    setExporting(true)
    try {
      // pdf-lib só é carregado quando alguém pede o PDF.
      const { buildReportPdf } = await import('@/lib/reportPdf')
      downloadPdf(await buildReportPdf(evolutionDocument(model, periodLabel, formatDateTime(Date.now(), tz, settings.hourFormat))), `evolucao-${slug}.pdf`)
    } catch (e) {
      toast.error(e)
    } finally {
      setExporting(false)
    }
  }

  if (failed) return <ErrorState error={failed.error} onRetry={() => failed.refetch()} />

  const m = model
  const hoursData = m.series.map((p) => ({ key: p.key, plannedHours: p.plannedHours, actualHours: p.actualHours }))
  const trendHours = trendData.map((p) => ({ key: p.key, plannedHours: p.plannedHours, actualHours: p.actualHours }))
  const xLabel = (key: string) => m.series.find((p) => p.key === key)?.label ?? key
  const trendLabel = (key: string) => trendData.find((p) => p.key === key)?.label ?? key

  return (
    <div>
      <PageHeader
        title="Evolução"
        description="Acompanhe o tempo de estudo, as atividades concluídas e a regularidade das suas sessões."
        actions={
          <>
            <Button size="sm" icon={<Download className="size-4" />} onClick={() => downloadCsv(evolutionSummaryRows(m), `evolucao-resumo-${slug}.csv`)} disabled={loading}>
              Resumo (CSV)
            </Button>
            <Button size="sm" icon={<Download className="size-4" />} onClick={() => downloadCsv(evolutionDailyRows(input, range), `evolucao-por-dia-${slug}.csv`)} disabled={loading}>
              Por dia (CSV)
            </Button>
            <Button size="sm" icon={<FileText className="size-4" />} onClick={exportPdf} loading={exporting} disabled={loading}>
              PDF
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <PeriodPicker state={state} setState={setState} range={range} today={today} />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Carregando a evolução">
          <Skeleton className="h-28 lg:col-span-2" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Horas estudadas" value={formatDuration(m.hours.actual)} hint={m.hours.percent == null ? 'Sem horas planejadas no período' : `${pct(m.hours.percent)} do planejado · ${formatHours(m.hours.planned)}`}>
              {m.hours.percent != null && <Progress value={m.hours.percent} label="Realizado em relação ao planejado" />}
            </StatCard>
            <StatCard label="Atividades concluídas" value={m.tasks.rate == null ? '—' : `${m.tasks.done}/${m.tasks.total}`} hint={m.tasks.rate == null ? 'Nenhuma atividade no período' : `${pct(m.tasks.rate)} de conclusão`}>
              {m.tasks.rate != null && <Progress value={m.tasks.rate} label="Taxa de conclusão das atividades" />}
            </StatCard>
            <StatCard
              label="Dias com estudo"
              value={`${m.consistency.studied}/${m.consistency.elapsed}`}
              hint={`Sequência atual: ${m.consistency.currentStreak} ${m.consistency.currentStreak === 1 ? 'dia' : 'dias'}`}
            />
          </section>

          <Comparison rows={m.comparison} previous={`${formatDayKey(m.previous.from)} – ${formatDayKey(m.previous.to)}`} inProgress={m.inProgress} />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Planejado × realizado"
              description={`Horas por ${m.granularity === 'day' ? 'dia' : m.granularity === 'week' ? 'semana' : 'mês'}. Planejado = blocos do cronograma + atividades de estudo com duração.`}
              legend={[PLANNED, ACTUAL]}
              summary={`No período: ${formatDuration(m.hours.actual)} realizados de ${formatDuration(m.hours.planned)} planejados.`}
              empty={m.hours.actual === 0 && m.hours.planned === 0 ? 'Nenhuma hora planejada ou estudada no período.' : null}
              table={{ columns: [m.granularity === 'day' ? 'Dia' : m.granularity === 'week' ? 'Semana de' : 'Mês', 'Planejado (h)', 'Realizado (h)'], rows: m.series.map((p) => [p.label, p.plannedHours, p.actualHours]) }}
            >
              <ColumnChart data={hoursData} series={[PLANNED, ACTUAL]} xKey="key" format={fmtH} xFormat={xLabel} />
            </ChartCard>

            <ChartCard
              title={trend === 'week' ? 'Evolução semanal' : 'Evolução mensal'}
              description={trend === 'week' ? 'Últimas 12 semanas' : 'Últimos 6 meses'}
              legend={[PLANNED, ACTUAL]}
              action={<Segmented label="Agrupar a evolução por" size="sm" value={trend} onChange={setTrend} options={[{ value: 'week', label: 'Semanas' }, { value: 'month', label: 'Meses' }]} />}
              summary={`Horas planejadas e realizadas por ${trend === 'week' ? 'semana' : 'mês'}; use "Ver tabela" para os valores.`}
              empty={trendData.every((p) => p.actualHours === 0 && p.plannedHours === 0) ? 'Nenhuma hora planejada ou estudada neste intervalo.' : null}
              table={{ columns: [trend === 'week' ? 'Semana de' : 'Mês', 'Planejado (h)', 'Realizado (h)'], rows: trendData.map((p) => [p.label, p.plannedHours, p.actualHours]) }}
            >
              <ColumnChart data={trendHours} series={[PLANNED, ACTUAL]} xKey="key" format={fmtH} xFormat={trendLabel} />
            </ChartCard>

            <ChartCard
              title="Tempo por matéria"
              description="Horas líquidas no período, com o planejado ao lado"
              table={{ columns: ['Matéria', 'Realizado', 'Planejado', 'Período anterior'], rows: m.subjects.map((s) => [s.name, formatDuration(s.actualSeconds), formatDuration(s.plannedSeconds), formatDuration(s.previousSeconds)]) }}
            >
              <RankBars items={m.subjects.map((s) => ({ label: s.name, value: s.actualSeconds, note: s.plannedSeconds ? `planejado ${formatHours(s.plannedSeconds)}` : undefined }))} format={(v) => formatHours(v)} emptyText="Nenhum estudo ou plano por matéria no período." />
            </ChartCard>

            <GoalsCard met={m.goals.met} pending={m.goals.pending} />

            <ChartCard title="Constância" description="Últimas 16 semanas: um quadrado por dia, mais escuro com mais tempo" className="lg:col-span-2">
              <ConsistencyGrid days={grid} format={(s) => formatDuration(s)} />
              <p className="mt-3 text-sm text-muted">
                No período: <span className="font-medium text-ink">{m.consistency.studied}</span> de {m.consistency.elapsed} {m.consistency.elapsed === 1 ? 'dia' : 'dias'} com estudo · maior sequência: <span className="font-medium text-ink">{m.consistency.longest}</span> · sequência atual:{' '}
                <span className="font-medium text-ink">{m.consistency.currentStreak}</span> {m.consistency.currentStreak === 1 ? 'dia' : 'dias'}
              </p>
            </ChartCard>
          </div>

        </div>
      )}
    </div>
  )
}

const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, same: Minus, none: null } as const

function Comparison({ rows, previous, inProgress }: { rows: ComparisonRow[]; previous: string; inProgress: boolean }) {
  return (
    <Card>
      <CardHeader title="Comparação com o período anterior" description={`Período anterior equivalente: ${previous}.${inProgress ? ' O período atual ainda está em andamento, então a comparação é parcial.' : ''}`} />
      {/* No celular a tabela de quatro colunas não cabe: cada indicador vira uma linha com o anterior logo abaixo. */}
      <ul className="divide-y divide-line px-5 pt-2 pb-3 sm:hidden" aria-label="Indicadores do período atual e do período anterior">
        {rows.map((r) => (
          <li key={r.key} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-ink">{r.label}</span>
              <span className="tabular shrink-0 text-right font-medium text-ink">{r.current}</span>
            </div>
            <p className="tabular mt-0.5 text-xs text-muted">
              Anterior: {r.previous} · variação: {r.change}
            </p>
          </li>
        ))}
      </ul>
      <div className="scroll-thin hidden overflow-x-auto px-5 pt-3 pb-4 sm:block">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Indicadores do período atual e do período anterior</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Indicador</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Período atual</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Anterior</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const Icon = DIRECTION_ICON[r.direction]
              return (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{r.label}</th>
                  <td className="tabular px-3 py-2 text-right font-medium text-ink">{r.current}</td>
                  <td className="tabular px-3 py-2 text-right text-muted">{r.previous}</td>
                  <td className="tabular py-2 pl-3 text-right text-muted">
                    <span className="inline-flex items-center justify-end gap-1">
                      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
                      {r.change}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function GoalsCard({ met, pending }: { met: GoalSnapshot[]; pending: GoalSnapshot[] }) {
  const total = met.length + pending.length
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Metas</h3>
          <p className="text-xs text-muted">{total === 0 ? 'Nenhuma meta vigente no período' : `${met.length} ${met.length === 1 ? 'cumprida' : 'cumpridas'} · ${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'}`}</p>
        </div>
        <Link to="/metas" className="shrink-0 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">
          Abrir metas
        </Link>
      </div>
      {total === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted">Crie uma meta para acompanhar aqui o que foi cumprido.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...pending, ...met].slice(0, 8).map((g) => (
            <li key={g.goal.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-ink">
                  {g.met && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
                  <span className="truncate">{g.title}</span>
                </span>
                <span className={`tabular shrink-0 ${g.overdue ? 'font-medium text-accent' : 'text-muted'}`}>
                  {g.met ? 'Cumprida' : g.overdue ? 'Prazo vencido' : 'Pendente'} · {g.detail}
                </span>
              </div>
              <Progress value={g.percent} label={`Progresso de ${g.title}`} />
            </li>
          ))}
          {total > 8 && <li className="text-xs text-muted">e mais {total - 8} em Metas.</li>}
        </ul>
      )}
    </Card>
  )
}
