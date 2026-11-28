import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, PageHeader, StatCard } from '@/components/ui/layout'
import { ErrorState, Skeleton, useToast } from '@/components/ui/feedback'
import { ChartCard, ColumnChart } from '@/components/charts/Charts'
import { useAll, useSessions } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { eq, gte, lt, lte } from '@/lib/data/types'
import { downloadCsv, downloadPdf } from '@/lib/download'
import { addDays, formatDateTime, formatDayKey, formatDuration, periodRange, startOfMonth, todayKey, zonedDayStart } from '@/lib/time'
import { STATEMENT_LABELS, buildWeeklyReport, weekHeadline, weeklyReportCsvRows, weeklyReportDocument, type ReportSection, type Statement, type WeeklyReport } from '@/lib/weeklyReport'

const pct = (v: number) => `${Math.round(v)}%`
const hours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100

export default function WeeklyReportPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const [anchor, setAnchor] = useState(today)
  const [exporting, setExporting] = useState(false)
  const lookups = useLookups()
  const toast = useToast()

  const week = useMemo(() => periodRange('week', anchor), [anchor])
  const isCurrent = week.from <= today && today <= week.to
  // Sessões da semana anterior e do começo do mês entram nas comparações e metas.
  const fetchFrom = [addDays(week.from, -7), startOfMonth(week.from)].sort()[0]
  const fromIso = new Date(zonedDayStart(fetchFrom, tz) - 86400000).toISOString()
  const weekEndIso = new Date(zonedDayStart(addDays(week.to, 1), tz)).toISOString()

  const sessions = useSessions({ filters: [eq('status', 'completed'), gte('started_at', fromIso), lt('started_at', weekEndIso)], order: [{ column: 'started_at' }] }, { keepPrevious: true })
  const weekTasks = useAll('calendar_tasks', { filters: [gte('date', week.from), lte('date', week.to)] }, { keepPrevious: true })
  // Atrasadas de semanas anteriores: as que continuam abertas e as que só foram concluídas depois desta semana.
  const openBefore = useAll('calendar_tasks', { filters: [lt('date', week.from), eq('done', false)] }, { keepPrevious: true })
  const doneLater = useAll('calendar_tasks', { filters: [lt('date', week.from), eq('done', true), gte('done_at', weekEndIso)] }, { keepPrevious: true })
  const planItems = useAll('study_plan_items', { filters: [gte('date', week.from), lte('date', week.to)] }, { keepPrevious: true })
  const reviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', fromIso), lt('reviewed_at', weekEndIso)] }, { keepPrevious: true })
  const goals = useAll('study_goals')

  const queries = [sessions, weekTasks, openBefore, doneLater, planItems, reviews, goals]
  const failed = queries.find((x) => x.isError)
  const loading = queries.some((x) => x.isPending) || lookups.loading

  const report = useMemo(
    () =>
      buildWeeklyReport({
        week,
        timezone: tz,
        today,
        sessions: sessions.data ?? [],
        tasks: [...(weekTasks.data ?? []), ...(openBefore.data ?? []), ...(doneLater.data ?? [])],
        planItems: planItems.data ?? [],
        topics: lookups.topics,
        subjects: lookups.subjects,
        goals: goals.data ?? [],
        flashcardReviews: reviews.data ?? [],
      }),
    [week, tz, today, sessions.data, weekTasks.data, openBefore.data, doneLater.data, planItems.data, lookups.topics, lookups.subjects, goals.data, reviews.data],
  )

  const slug = `${week.from}-a-${week.to}`
  const exportPdf = async () => {
    setExporting(true)
    try {
      // pdf-lib só é carregado quando alguém pede o PDF.
      const { buildReportPdf } = await import('@/lib/reportPdf')
      downloadPdf(await buildReportPdf(weeklyReportDocument(report, formatDateTime(Date.now(), tz, settings.hourFormat))), `relatorio-semanal-${slug}.pdf`)
    } catch (e) {
      toast.error(e)
    } finally {
      setExporting(false)
    }
  }

  if (failed) return <ErrorState error={failed.error} onRetry={() => failed.refetch()} />
  const t = report.totals

  return (
    <div>
      <PageHeader
        title="Relatório semanal"
        description="Veja suas horas, atividades e metas da semana."
        actions={
          <>
            <Button size="sm" icon={<Download className="size-4" />} onClick={() => downloadCsv(weeklyReportCsvRows(report), `relatorio-semanal-${slug}.csv`)} disabled={loading}>
              CSV
            </Button>
            <Button size="sm" icon={<FileText className="size-4" />} onClick={exportPdf} loading={exporting} disabled={loading}>
              PDF
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-1" role="group" aria-label="Semana do relatório">
        <IconButton size="sm" label="Semana anterior" onClick={() => setAnchor(addDays(week.from, -7))}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <span className="px-1 text-sm font-medium text-ink" aria-live="polite">
          {formatDayKey(week.from)} – {formatDayKey(week.to)}
          {isCurrent && <span className="font-normal text-muted"> · semana atual</span>}
        </span>
        <IconButton size="sm" label="Próxima semana" onClick={() => setAnchor(addDays(week.from, 7))} disabled={week.to >= today}>
          <ChevronRight className="size-4" />
        </IconButton>
        {!isCurrent && (
          <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
            Semana atual
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4" role="status" aria-label="Montando o relatório">
          <Skeleton className="h-24" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-base leading-relaxed font-medium text-ink sm:text-lg">{weekHeadline(report)}</p>
            {report.inProgress && <p className="mt-1.5 text-sm text-muted">Semana em andamento: os números vão até hoje, e só o que já venceu conta como atraso.</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Tag kind="fact" /> calculado direto dos registros
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Tag kind="recommendation" /> gerada por uma regra fixa, mostrada junto
              </span>
            </p>
          </Card>

          {report.hasData && (
            <section aria-label="Números da semana" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Horas planejadas" value={formatDuration(t.plannedSeconds)} hint={t.plannedSeconds ? 'Cronograma + atividades de estudo' : 'Nada planejado'} />
              <StatCard label="Horas realizadas" value={formatDuration(t.actualSeconds)} hint={t.plannedPercent == null ? `${t.sessions} ${t.sessions === 1 ? 'sessão' : 'sessões'}` : `${pct(t.plannedPercent)} do planejado`} />
              <StatCard label="Atividades concluídas" value={t.tasksTotal ? `${t.tasksDone}/${t.tasksTotal}` : '—'} hint={t.tasksLate ? `${t.tasksLate} ${t.tasksLate === 1 ? 'atrasada' : 'atrasadas'}` : t.tasksTotal ? 'Nenhuma atrasada' : 'Nenhuma atividade na semana'} />
              <StatCard label="Dias com estudo" value={t.studyDays} hint={`de ${t.elapsedDays} dias da semana`} />
            </section>
          )}

          <ol className="space-y-4">
            {report.sections.map((section, index) => (
              <li key={section.key}>
                <SectionCard section={section} index={index + 1} />
              </li>
            ))}
          </ol>

          {report.insufficient.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-ink">Dados insuficientes</h2>
              <p className="mt-0.5 text-xs text-muted">O que o relatório não afirma, por falta de registros na semana.</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                {report.insufficient.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Card>
          )}

          {report.hasData && <WeekTables report={report} />}
        </div>
      )}
    </div>
  )
}

/** Etiqueta que separa o que é dado do que é sugestão (a cor vermelha fica só na sugestão). */
function Tag({ kind }: { kind: Statement['kind'] }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap', kind === 'fact' ? 'border-line bg-surface-2 text-muted' : 'border-accent/40 text-accent')}>
      {STATEMENT_LABELS[kind]}
    </span>
  )
}

function SectionCard({ section, index }: { section: ReportSection; index: number }) {
  return (
    <Card className="p-5">
      <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-ink">
        <span className="tabular text-muted" aria-hidden>
          {index}.
        </span>
        {section.question}
      </h2>
      {section.statements.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{section.empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {section.statements.map((s) => (
            <li key={s.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
              <span className="sm:w-36 sm:shrink-0 sm:pt-0.5">
                <Tag kind={s.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm leading-relaxed text-ink', s.kind === 'recommendation' && 'font-medium')}>{s.text}</p>
                {s.kind === 'recommendation' && <p className="mt-1 text-xs text-muted">{s.rule}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function WeekTables({ report }: { report: WeeklyReport }) {
  const days = report.days.map((d) => ({ key: d.day, planejado: hours(d.plannedSeconds), realizado: hours(d.actualSeconds) }))
  const legend = [
    { key: 'planejado', label: 'Planejado', color: 'var(--series-4)' },
    { key: 'realizado', label: 'Realizado', color: 'var(--series-1)' },
  ]
  const t = report.totals
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Planejado × realizado por dia"
        description="Horas de estudo em cada dia da semana"
        legend={legend}
        summary={`Na semana: ${formatDuration(t.actualSeconds)} realizados de ${formatDuration(t.plannedSeconds)} planejados.`}
        empty={t.actualSeconds === 0 && t.plannedSeconds === 0 ? 'Nenhuma hora planejada ou estudada na semana.' : null}
        table={{ columns: ['Dia', 'Planejado', 'Realizado', 'Atividades'], rows: report.days.map((d) => [formatDayKey(d.day, 'weekday'), formatDuration(d.plannedSeconds), formatDuration(d.actualSeconds), d.tasks ? `${d.tasksDone}/${d.tasks}` : '—']) }}
      >
        <ColumnChart data={days} series={legend} xKey="key" format={(n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`} xFormat={(d) => formatDayKey(d, 'weekday').slice(0, 3)} />
      </ChartCard>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Por matéria</h3>
        <p className="text-xs text-muted">Horas planejadas e realizadas na semana</p>
        {report.subjects.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhuma matéria com plano ou estudo na semana.</p>
        ) : (
          <div className="scroll-thin mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Horas planejadas e realizadas por matéria</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Matéria</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Planejado</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Realizado</th>
                </tr>
              </thead>
              <tbody>
                {report.subjects.map((s) => (
                  <tr key={s.subjectId ?? 'sem-materia'} className="border-b border-line last:border-0">
                    <th scope="row" className="max-w-40 truncate py-2 pr-3 text-left font-normal text-ink">{s.name}</th>
                    <td className="tabular px-2 py-2 text-right text-muted">{formatDuration(s.plannedSeconds)}</td>
                    <td className="tabular px-2 py-2 text-right font-medium text-ink">{formatDuration(s.actualSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
