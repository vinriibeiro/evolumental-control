import { useMemo, useState } from 'react'
import { Flag } from 'lucide-react'
import { Field, Input } from '@/components/ui/Field'
import { Card } from '@/components/ui/layout'
import { useAll } from '@/hooks/data'
import { useMastery } from '@/hooks/useInsight'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { forecast, weeklyAvailability } from '@/lib/insight/forecast'
import { formatDayKey, formatDuration, todayKey } from '@/lib/time'

const perWeek = (min: number) => `${formatDuration(Math.round(min) * 60)}/semana`

/**
 * Previsão de conclusão do conteúdo das matérias informadas (todas as
 * ativas, se nenhuma). É uma projeção do ritmo recente; não muda o cronograma.
 */
export function ForecastCard({ subjectIds, targetDate, title = 'Previsão de conclusão' }: { subjectIds?: string[]; targetDate?: string | null; title?: string }) {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const mastery = useMastery()
  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const [custom, setCustom] = useState('')
  const [until, setUntil] = useState(targetDate ?? '')

  const f = useMemo(() => {
    const input = mastery.input
    if (!input) return null
    const scope = new Set(subjectIds ?? input.subjects.filter((s) => s.status === 'active').map((s) => s.id))
    return forecast({
      topics: input.topics.filter((t) => scope.has(t.subject_id)),
      sessions: input.sessions.filter((s) => s.subject_id && scope.has(s.subject_id)),
      today,
      tz: settings.timezone,
      availability: weeklyAvailability(plans.data ?? [], today),
      targetDate: until || null,
      customPace: custom ? Math.round(Number(custom.replace(',', '.')) * 60) : null,
    })
  }, [mastery.input, subjectIds, today, settings.timezone, plans.data, until, custom])

  if (!f) return null
  const current = f.scenarios[0]
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Flag className="size-4 text-accent-strong" /> {title}
      </h2>
      {f.totalTopics === 0 ? (
        <p className="mt-1 text-sm text-muted">Cadastre os tópicos do conteúdo para estimar quando você termina.</p>
      ) : f.remainingTopics === 0 ? (
        <p className="mt-1 text-sm text-ink">Todo o conteúdo está concluído. Agora é revisar e praticar.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            Faltam {f.remainingTopics} de {f.totalTopics} tópicos · cerca de {formatDuration(f.remainingMinutes * 60)} de estudo
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Mantendo o ritmo atual, conclusão estimada</dt>
              <dd className="font-semibold text-ink">{current.date ? formatDayKey(current.date, 'long') : 'sem ritmo recente'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Ritmo atual (últimas 4 semanas)</dt>
              <dd className="tabular font-semibold text-ink">{perWeek(f.pace)}</dd>
            </div>
            {f.target && f.target.neededPace != null && (
              <>
                <div>
                  <dt className="text-xs text-muted">Necessário para concluir até {formatDayKey(f.target.date, 'long')}</dt>
                  <dd className="tabular font-semibold text-ink">{perWeek(f.target.neededPace)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Diferença</dt>
                  <dd className="tabular font-semibold text-ink">
                    {f.target.diff! > 0 ? `+${perWeek(f.target.diff!)}` : f.target.diff! < 0 ? `folga de ${perWeek(-f.target.diff!)}` : 'no ritmo'}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Cenários de ritmo e data estimada</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">Cenário</th>
                <th className="py-1 font-medium">Ritmo</th>
                <th className="py-1 font-medium">Conclusão</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {f.scenarios.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-1.5 text-ink">{s.label}</td>
                  <td className="py-1.5 text-ink">
                    {perWeek(s.pace)}
                    {s.overAvailability && <span className="block text-[11px] text-warning">acima da sua disponibilidade ({perWeek(f.availability!)})</span>}
                  </td>
                  <td className="py-1.5 text-ink">{s.date ? formatDayKey(s.date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Meta personalizada (horas/semana)">{(id) => <Input id={id} inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} placeholder="Ex.: 12" />}</Field>
            <Field label="Concluir até">{(id) => <Input id={id} type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} />}</Field>
          </div>
          <ul className="mt-3 space-y-0.5 text-xs text-muted">
            {f.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
