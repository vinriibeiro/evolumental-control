import { useMemo, useState } from 'react'
import { CalendarDays, CalendarRange, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { useAll, useCount } from '@/hooks/data'
import { useMastery } from '@/hooks/useInsight'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { eq, gte, inList, lte } from '@/lib/data/types'
import { calendarWeeks, dailyActivity, intensity } from '@/lib/insight/activity'
import { evolutionFeed } from '@/lib/insight/feed'
import { WEEK_BUCKET_LABELS, weekSummary } from '@/lib/insight/week'
import { addDays, formatDayKey, formatDuration, startOfWeek, todayKey, zonedDayStart } from '@/lib/time'

const dur = (min: number) => formatDuration(Math.round(min) * 60)

/** Esta semana: disponibilidade, planejado, realizado, distribuição e "Por que este plano?". */
export function WeekCard() {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const from = startOfWeek(today)
  const mastery = useMastery()
  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const items = useAll('study_plan_items', { filters: [gte('date', from), lte('date', addDays(from, 6))] })
  const reviews = useCount('reviews', [inList('status', ['planned', 'postponed']), lte('scheduled_for', addDays(from, 6))])
  const w = useMemo(() => {
    if (!mastery.input || !plans.data || !items.data) return null
    const active = new Set(plans.data.map((p) => p.id))
    return weekSummary({ plans: plans.data, items: items.data.filter((i) => active.has(i.plan_id)), sessions: mastery.input.sessions, subjects: mastery.input.subjects, mastery: mastery.index, reviewsDue: reviews.data ?? 0, today, tz: settings.timezone })
  }, [mastery.input, mastery.index, plans.data, items.data, reviews.data, today, settings.timezone])
  if (!w) return null
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarRange className="size-4 text-accent-strong" /> Esta semana ({formatDayKey(w.from)} – {formatDayKey(w.to)})
      </h2>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Disponibilidade</dt>
          <dd className="tabular font-semibold text-ink">{w.availability == null ? '—' : dur(w.availability)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Planejado</dt>
          <dd className="tabular font-semibold text-ink">{dur(w.planned)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Realizado até agora</dt>
          <dd className="tabular font-semibold text-ink">{dur(w.done)}</dd>
        </div>
      </dl>
      {(w.distribution.length > 0 || w.reserve) && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {w.distribution.map((d) => (
            <li key={d.bucket}>
              {WEEK_BUCKET_LABELS[d.bucket]}: <span className="tabular text-ink">{dur(d.minutes)}</span>
            </li>
          ))}
          {w.reserve != null && w.reserve > 0 && (
            <li>
              Reserva: <span className="tabular text-ink">{dur(w.reserve)}</span>
            </li>
          )}
        </ul>
      )}
      {w.availability == null && <p className="mt-2 text-xs text-muted">Configure sua disponibilidade no Cronograma para ver a reserva da semana.</p>}
      {(w.why.length > 0 || w.suggestions.length > 0) && (
        <details className="mt-3 text-sm" open>
          <summary className="cursor-pointer font-medium text-ink">Por que este plano?</summary>
          {w.why.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink">
              {w.why.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {w.suggestions.length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium text-muted">Ajustes sugeridos (nada muda sozinho)</p>
              <ul className="list-disc space-y-0.5 pl-4 text-ink">
                {w.suggestions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}
    </Card>
  )
}

/** Conquistas reais, calculadas dos seus dados. */
export function FeedCard() {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const mastery = useMastery()
  const reviewsDone = useCount('reviews', [eq('status', 'done'), gte('done_at', new Date(zonedDayStart(addDays(today, -6), settings.timezone)).toISOString())])
  const feed = useMemo(
    () => (mastery.input ? evolutionFeed(mastery.input, Date.now(), { weeklyGoalMinutes: settings.weeklyGoalMinutes, reviewsDoneLast7: reviewsDone.data ?? 0 }) : null),
    [mastery.input, settings.weeklyGoalMinutes, reviewsDone.data],
  )
  if (!feed) return null
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="size-4 text-accent-strong" /> Sua evolução
      </h2>
      {feed.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Ainda não há conquistas para mostrar. Elas aparecem aqui conforme seu domínio, acerto e constância melhoram.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm text-ink">
          {feed.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span aria-hidden className="text-accent-strong">
                ★
              </span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const LEVEL_CLASS = ['bg-line', 'bg-accent/40', 'bg-accent/70', 'bg-accent-strong', 'bg-brown dark:bg-wheat']

/** Calendário anual de constância (estilo "contribution graph"), com alternativa em tabela. */
export function ActivityCalendar() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const mastery = useMastery()
  const weeks = useMemo(() => calendarWeeks(today), [today])
  const reviews = useAll('flashcard_reviews', { filters: [gte('reviewed_at', new Date(zonedDayStart(weeks[0][0], tz)).toISOString())] })
  const data = useMemo(
    () => (mastery.input && reviews.data ? dailyActivity({ sessions: mastery.input.sessions, questions: mastery.input.questions, flashcardReviews: reviews.data, tz }) : null),
    [mastery.input, reviews.data, tz],
  )
  const [sel, setSel] = useState<string | null>(null)
  if (!data) return null
  const describe = (d: string) => {
    const a = data.get(d)
    if (!a || (!a.seconds && !a.questions && !a.flashcards)) return `${formatDayKey(d, 'long')}: sem estudo registrado`
    const parts = [`${formatDuration(a.seconds)} estudadas`]
    if (a.questions) parts.push(`${a.questions} questões`)
    if (a.flashcards) parts.push(`${a.flashcards} flashcards`)
    if (a.subjects) parts.push(`${a.subjects} matéria${a.subjects === 1 ? '' : 's'}`)
    return `${formatDayKey(d, 'long')}: ${parts.join(' · ')}`
  }
  const active = [...data.entries()].filter(([d, a]) => d >= weeks[0][0] && d <= today && (a.seconds || a.questions || a.flashcards)).sort(([a], [b]) => b.localeCompare(a))
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarDays className="size-4 text-accent-strong" /> Constância no último ano
      </h2>
      <p className="mt-0.5 text-xs text-muted">{active.length} dia(s) com estudo nas últimas 53 semanas.</p>
      <div className="mt-3 overflow-x-auto pb-1" role="group" aria-label="Calendário de estudo do último ano">
        <div className="flex gap-[3px]" style={{ width: 'max-content' }}>
          {weeks.map((week) => (
            <div key={week[0]} className="flex flex-col gap-[3px]">
              {week.map((d) => {
                const future = d > today
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future}
                    aria-label={future ? undefined : describe(d)}
                    title={future ? undefined : describe(d)}
                    onMouseEnter={() => setSel(d)}
                    onFocus={() => setSel(d)}
                    onClick={() => setSel(d)}
                    className={cn('size-[11px] rounded-[2px]', future ? 'opacity-0' : LEVEL_CLASS[intensity(data.get(d))], sel === d && 'ring-2 ring-ink')}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 min-h-[1.25rem] text-xs text-ink" aria-live="polite">
        {sel ? describe(sel) : 'Passe o mouse, use o teclado ou toque em um dia para ver o detalhe.'}
      </p>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted" aria-hidden>
        menos {LEVEL_CLASS.map((c) => <span key={c} className={cn('size-[10px] rounded-[2px]', c)} />)} mais (por tempo estudado)
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Ver como tabela</summary>
        <table className="mt-1 w-full text-left">
          <thead className="text-muted">
            <tr>
              <th className="py-0.5 font-medium">Dia</th>
              <th className="py-0.5 font-medium">Tempo</th>
              <th className="py-0.5 font-medium">Questões</th>
              <th className="py-0.5 font-medium">Flashcards</th>
              <th className="py-0.5 font-medium">Matérias</th>
            </tr>
          </thead>
          <tbody className="tabular text-ink">
            {active.slice(0, 60).map(([d, a]) => (
              <tr key={d}>
                <td className="py-0.5">{formatDayKey(d)}</td>
                <td className="py-0.5">{formatDuration(a.seconds)}</td>
                <td className="py-0.5">{a.questions}</td>
                <td className="py-0.5">{a.flashcards}</td>
                <td className="py-0.5">{a.subjects}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {active.length > 60 && <p className="mt-1 text-muted">Mostrando os 60 dias mais recentes com estudo.</p>}
      </details>
    </Card>
  )
}
