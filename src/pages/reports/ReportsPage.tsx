import { useMemo, useState } from 'react'
import { Download, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { Card, PageHeader, StatCard } from '@/components/ui/layout'
import { ErrorState } from '@/components/ui/feedback'
import { ChartCard, ColumnChart, RankBars, TrendLine } from '@/components/charts/Charts'
import { PeriodPicker, describeRange, usePeriod } from '@/components/PeriodPicker'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { SessionList } from '@/features/timer/SessionList'
import { useAll } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { useStudyStats } from '@/hooks/useStudyStats'
import { eq, gte, inList, lt, lte, notNull, type Filter } from '@/lib/data/types'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/labels'
import { isNoSubject, series } from '@/lib/stats'
import { netSeconds, pausedSeconds } from '@/lib/timer/engine'
import { dayKey, eachDay, formatDayKey, formatDuration, formatHours, rangeInstants, todayKey } from '@/lib/time'
import { weightedProgress } from '@/lib/tree'
import { downloadCsv, downloadJson, slugDate } from '@/lib/download'
import type { ActivityType } from '@/types/db'

export default function ReportsPage() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const { state, setState, range } = usePeriod(today, 'month')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [activity, setActivity] = useState<'' | ActivityType>('')
  const lookups = useLookups()

  const sessionFilters: Filter[] = [
    ...(link.subjectId ? [eq('subject_id', link.subjectId)] : []),
    ...(link.topicId ? [eq('topic_id', link.topicId)] : []),
    ...(activity ? [eq('activity_type', activity)] : []),
  ]
  const stats = useStudyStats(range, sessionFilters)
  const { fromMs, toMs } = rangeInstants(range, tz)
  const fromIso = new Date(fromMs).toISOString()
  const toIso = new Date(toMs).toISOString()

  const subjectFilter = link.subjectId ? [eq('subject_id', link.subjectId)] : []
  const topicFilter = link.topicId ? [eq('topic_id', link.topicId)] : []
  const plan = useAll('study_plan_items', { filters: [gte('date', range.from), lte('date', range.to), ...subjectFilter, ...topicFilter, ...(activity ? [eq('activity_type', activity)] : [])] }, { keepPrevious: true })
  const questions = useAll('question_records', { filters: [gte('date', range.from), lte('date', range.to), ...subjectFilter, ...topicFilter] }, { keepPrevious: true })
  const reviewsDone = useAll('reviews', { filters: [eq('status', 'done'), gte('done_at', fromIso), lt('done_at', toIso), ...subjectFilter, ...topicFilter] }, { keepPrevious: true })
  const reviewsLate = useAll('reviews', { filters: [inList('status', ['planned', 'postponed']), lt('scheduled_for', today), gte('scheduled_for', range.from), lte('scheduled_for', range.to), ...subjectFilter, ...topicFilter] }, { keepPrevious: true })
  const cardReviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', fromIso), lt('reviewed_at', toIso)] }, { keepPrevious: true })
  const topicsDone = useAll('topics', { filters: [notNull('completed_at'), gte('completed_at', fromIso), lt('completed_at', toIso), ...subjectFilter] }, { keepPrevious: true })

  const s = stats.stats
  const days = eachDay(range.from, range.to)
  const dailyGoal = settings.dailyGoalMinutes * 60
  const daysMet = days.filter((d) => (s.byDay.get(d) ?? 0) >= dailyGoal && dailyGoal > 0).length
  const elapsedDays = days.filter((d) => d <= today).length || 1

  const perDay = series(s.byDay, range).map((d) => ({ label: d.day, horas: Math.round((d.seconds / 3600) * 100) / 100 }))
  const sessionsPerDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of stats.data ?? []) {
      const k = dayKey(new Date(x.started_at).getTime(), tz)
      if (k >= range.from && k <= range.to) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return days.map((d) => ({ label: d, sessoes: m.get(d) ?? 0 }))
  }, [stats.data, tz, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const plannedVsDone = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of plan.data ?? []) if (p.status !== 'rescheduled') m.set(p.date, (m.get(p.date) ?? 0) + p.duration_minutes * 60)
    return days.map((d) => ({ label: d, planejado: Math.round(((m.get(d) ?? 0) / 3600) * 100) / 100, realizado: Math.round(((s.byDay.get(d) ?? 0) / 3600) * 100) / 100 }))
  }, [plan.data, s.byDay, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const plannedTotal = (plan.data ?? []).filter((p) => p.status !== 'rescheduled').reduce((a, p) => a + p.duration_minutes * 60, 0)
  const qTotals = (questions.data ?? []).reduce((a, q) => ({ total: a.total + q.total, correct: a.correct + q.correct }), { total: 0, correct: 0 })
  const qEvolution = useMemo(() => {
    const m = new Map<string, { t: number; c: number }>()
    for (const q of questions.data ?? []) {
      const cur = m.get(q.date) ?? { t: 0, c: 0 }
      m.set(q.date, { t: cur.t + q.total, c: cur.c + q.correct })
    }
    return days.map((d) => ({ label: d, acerto: m.get(d)?.t ? Math.round((m.get(d)!.c / m.get(d)!.t) * 1000) / 10 : null }))
  }, [questions.data, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const cardsPerDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of cardReviews.data ?? []) {
      const k = dayKey(new Date(r.reviewed_at).getTime(), tz)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return days.map((d) => ({ label: d, respostas: m.get(d) ?? 0 }))
  }, [cardReviews.data, tz, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps

  const bySubject = [...s.bySubject].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: isNoSubject(k) ? 'Sem matéria' : lookups.subjectName(k), value: v, color: isNoSubject(k) ? 'var(--muted)' : lookups.subjectColor(k) }))
  const byActivity = [...s.byActivity].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: ACTIVITY_LABELS[k as ActivityType], value: v, color: ACTIVITY_COLORS[k as ActivityType] }))
  const topicProgress = useMemo(() => {
    const groups = new Map<string, typeof lookups.topics>()
    for (const t of lookups.topics) groups.set(t.subject_id, [...(groups.get(t.subject_id) ?? []), t])
    return lookups.subjects
      .filter((x) => x.status !== 'archived' && (!link.subjectId || x.id === link.subjectId))
      .map((x) => ({ label: x.name, value: weightedProgress(groups.get(x.id) ?? []).percent, color: x.color }))
      .sort((a, b) => b.value - a.value)
  }, [lookups, link.subjectId])

  const exportSessions = () =>
    downloadCsv(
      (stats.data ?? []).map((x) => ({
        inicio: x.started_at,
        fim: x.ended_at ?? '',
        materia: lookups.subjectName(x.subject_id),
        topico: lookups.topicName(x.topic_id),
        atividade: ACTIVITY_LABELS[x.activity_type],
        modo: x.mode,
        minutos_liquidos: Math.round((netSeconds(x, x.pauses) / 60) * 100) / 100,
        minutos_pausados: Math.round((pausedSeconds(x, x.pauses) / 60) * 100) / 100,
        ajuste_minutos: x.adjustment_seconds / 60,
        observacoes: x.notes ?? '',
      })),
      `sessoes-${range.from}-a-${range.to}.csv`,
    )
  const exportQuestions = () =>
    downloadCsv(
      (questions.data ?? []).map((q) => ({ data: q.date, materia: lookups.subjectName(q.subject_id), topico: lookups.topicName(q.topic_id), total: q.total, acertos: q.correct, erros: q.wrong, banca: q.board ?? '', concurso: q.exam ?? '', fonte: q.source ?? '' })),
      `questoes-${range.from}-a-${range.to}.csv`,
    )
  const exportJson = () =>
    downloadJson(
      {
        gerado_em: new Date().toISOString(),
        periodo: range,
        filtros: { materia: link.subjectId, topico: link.topicId, atividade: activity || null },
        resumo: { segundos_liquidos: s.total, sessoes: s.sessions, segundos_planejados: plannedTotal, questoes: qTotals, revisoes_realizadas: reviewsDone.data?.length ?? 0, revisoes_atrasadas: reviewsLate.data?.length ?? 0, flashcards_respondidos: cardReviews.data?.length ?? 0 },
        por_dia: Object.fromEntries(s.byDay),
        por_materia: Object.fromEntries([...s.bySubject].map(([k, v]) => [isNoSubject(k) ? 'sem_materia' : lookups.subjectName(k), v])),
        por_atividade: Object.fromEntries(s.byActivity),
        sessoes: stats.data ?? [],
        questoes: questions.data ?? [],
      },
      `relatorio-${slugDate()}.json`,
    )

  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
  const fmtH = (v: number) => formatHours(v)

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description={`Período: ${describeRange(state.kind, range)}. Somente sessões concluídas entram nas horas; pausas e sessões canceladas ficam de fora.`}
        actions={
          <>
            <Button size="sm" icon={<Download className="size-4" />} onClick={exportSessions} disabled={!stats.data?.length}>
              Sessões (CSV)
            </Button>
            <Button size="sm" icon={<Download className="size-4" />} onClick={exportQuestions} disabled={!questions.data?.length}>
              Questões (CSV)
            </Button>
            <Button size="sm" icon={<FileJson className="size-4" />} onClick={exportJson}>
              Relatório (JSON)
            </Button>
          </>
        }
      />
      <Card className="mb-6 grid gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)_200px] lg:items-end">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Período</p>
          <PeriodPicker state={state} setState={setState} range={range} today={today} />
        </div>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria" topicLabel="Tópico" />
        <Field label="Atividade">
          {(id) => (
            <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value as typeof activity)}>
              <option value="">Todas</option>
              {ACTIVITY_TYPES.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABELS[a]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tempo líquido" value={stats.isPending ? '…' : formatDuration(s.total)} hint={plannedTotal ? `Planejado: ${formatDuration(plannedTotal)}` : undefined} />
        <StatCard label="Sessões" value={stats.isPending ? '…' : s.sessions} hint={`${(s.sessions / elapsedDays).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia`} />
        <StatCard label="Tempo médio por sessão" value={stats.isPending ? '…' : formatDuration(s.sessions ? s.total / s.sessions : 0)} />
        <StatCard label="Dias com meta diária cumprida" value={stats.isPending ? '…' : `${daysMet}/${days.filter((d) => d <= today).length}`} hint={`Meta: ${formatDuration(dailyGoal)}`} />
        <StatCard label="Questões" value={qTotals.total.toLocaleString('pt-BR')} hint={qTotals.total ? `${Math.round((qTotals.correct / qTotals.total) * 100)}% de acertos` : 'Sem registros'} />
        <StatCard label="Revisões realizadas" value={reviewsDone.data?.length ?? '…'} />
        <StatCard label="Revisões atrasadas" value={reviewsLate.data?.length ?? '…'} />
        <StatCard label="Flashcards respondidos" value={cardReviews.data?.length ?? '…'} hint={`${topicsDone.data?.length ?? 0} tópico(s) concluído(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tempo líquido por dia" table={{ columns: ['Dia', 'Horas'], rows: perDay.map((p) => [formatDayKey(p.label), p.horas]) }}>
          <ColumnChart data={perDay} series={[{ key: 'horas', label: 'Horas', color: 'var(--accent-strong)' }]} xKey="label" format={(n) => `${n}h`} xFormat={(d) => formatDayKey(d)} />
        </ChartCard>
        <ChartCard title="Sessões por dia" table={{ columns: ['Dia', 'Sessões'], rows: sessionsPerDay.map((p) => [formatDayKey(p.label), p.sessoes]) }}>
          <ColumnChart data={sessionsPerDay} series={[{ key: 'sessoes', label: 'Sessões', color: 'var(--series-1)' }]} xKey="label" format={(n) => String(n)} xFormat={(d) => formatDayKey(d)} />
        </ChartCard>
        <ChartCard
          title="Planejado × realizado"
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
        <ChartCard title="Distribuição por matéria" table={{ columns: ['Matéria', 'Tempo'], rows: bySubject.map((b) => [b.label, formatDuration(b.value)]) }}>
          <RankBars items={bySubject} format={fmtH} />
        </ChartCard>
        <ChartCard title="Distribuição por atividade" table={{ columns: ['Atividade', 'Tempo'], rows: byActivity.map((b) => [b.label, formatDuration(b.value)]) }}>
          <RankBars items={byActivity} format={fmtH} />
        </ChartCard>
        <ChartCard title="Progresso dos tópicos por matéria" description="Ponderado pelo peso de cada tópico (situação atual)" table={{ columns: ['Matéria', '%'], rows: topicProgress.map((t) => [t.label, Math.round(t.value)]) }}>
          <RankBars items={topicProgress} format={(v) => `${Math.round(v)}%`} emptyText="Cadastre tópicos para acompanhar o progresso." />
        </ChartCard>
        <ChartCard title="Evolução do desempenho em questões" description="Taxa de acerto por dia" table={{ columns: ['Dia', 'Acertos (%)'], rows: qEvolution.filter((q) => q.acerto != null).map((q) => [formatDayKey(q.label), q.acerto!]) }}>
          <TrendLine data={qEvolution} series={[{ key: 'acerto', label: 'Acertos', color: 'var(--series-1)' }]} xKey="label" format={(n) => `${n}%`} xFormat={(d) => formatDayKey(d)} domain={[0, 100]} />
        </ChartCard>
        <ChartCard title="Evolução dos flashcards" description="Respostas registradas por dia" table={{ columns: ['Dia', 'Respostas'], rows: cardsPerDay.map((c) => [formatDayKey(c.label), c.respostas]) }}>
          <ColumnChart data={cardsPerDay} series={[{ key: 'respostas', label: 'Respostas', color: 'var(--series-6)' }]} xKey="label" format={(n) => String(n)} xFormat={(d) => formatDayKey(d)} />
        </ChartCard>
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold text-ink">Sessões do período</h2>
      <SessionList filters={[...sessionFilters, gte('started_at', fromIso), lt('started_at', toIso)]} emptyText="Nenhuma sessão no período com esses filtros." />
    </div>
  )
}
