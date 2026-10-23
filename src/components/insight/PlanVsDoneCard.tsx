import { useMemo, useState } from 'react'
import { Gauge } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAll, useSessions, useTransaction } from '@/hooks/data'
import { useNow } from '@/hooks/useNow'
import { useSettings } from '@/hooks/useSettings'
import { minuteOfDay } from '@/hooks/useToday'
import { eq, gte, inList } from '@/lib/data/types'
import { planVsDone, proposeCapacity } from '@/lib/insight/capacity'
import { addDays, formatDayKey, formatDuration, startOfWeek, todayKey, zonedDayStart } from '@/lib/time'

const WEEKS = 6
const hm = (minutes: number) => formatDuration(Math.round(minutes) * 60)

/**
 * Planejado × realizado das últimas semanas e, quando o plano está acima do
 * ritmo, uma proposta de ajuste dos blocos futuros — sempre com prévia.
 */
export function PlanVsDoneCard() {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const now = useNow(60_000)
  const from = addDays(startOfWeek(today), -7 * WEEKS)
  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const items = useAll('study_plan_items', { filters: [gte('date', from)] })
  const sessions = useSessions({ filters: [eq('status', 'completed'), gte('started_at', new Date(zonedDayStart(from, tz)).toISOString())] })
  const [preview, setPreview] = useState(false)
  const toast = useToast()

  const data = useMemo(() => (items.data && sessions.data ? planVsDone({ items: items.data, sessions: sessions.data, today, tz, weeks: WEEKS }) : null), [items.data, sessions.data, today, tz])
  const activeIds = useMemo(() => new Set((plans.data ?? []).map((p) => p.id)), [plans.data])
  const proposal = useMemo(() => {
    if (!data?.execution || !items.data) return null
    return proposeCapacity(items.data.filter((p) => activeIds.has(p.plan_id)), data.execution, today, minuteOfDay(now, tz))
  }, [data, items.data, activeIds, today, now, tz])

  const apply = useTransaction(['study_plan_items'], async (b, changes: NonNullable<typeof proposal>['changes']) => {
    let n = 0
    // Atualização condicional: só blocos que continuam pendentes mudam.
    for (const c of changes) n += (await b.update('study_plan_items', [eq('id', c.id), inList('status', ['pending'])], { duration_minutes: c.after })).length
    return n
  })

  if (!data) return null
  const canAdjust = data.gapPercent != null && data.gapPercent >= 10 && (proposal?.changes.length ?? 0) > 0
  const before = proposal?.weeks.reduce((a, w) => a + w.before, 0) ?? 0
  const after = proposal?.weeks.reduce((a, w) => a + w.after, 0) ?? 0

  return (
    <Card className="mb-4 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Gauge className="size-4 text-accent-strong" /> Planejado × realizado (últimas {WEEKS} semanas)
      </h2>
      {data.execution == null ? (
        <p className="mt-1 text-sm text-muted">{data.message}</p>
      ) : (
        <>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Planejado</dt>
              <dd className="tabular font-semibold text-ink">{hm(data.avgPlanned)}/semana</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Realizado</dt>
              <dd className="tabular font-semibold text-ink">{hm(data.avgDone)}/semana</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Execução</dt>
              <dd className="tabular font-semibold text-ink">{Math.round(data.execution * 100)}%</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-ink">{data.message}</p>
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">Semana a semana</summary>
            <table className="mt-1 w-full max-w-md text-left">
              <thead>
                <tr>
                  <th className="py-0.5 font-medium">Semana</th>
                  <th className="py-0.5 font-medium">Planejado</th>
                  <th className="py-0.5 font-medium">Realizado</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {data.weeks.map((w) => (
                  <tr key={w.week}>
                    <td className="py-0.5">{formatDayKey(w.week)}</td>
                    <td className="py-0.5">{hm(w.plannedMinutes)}</td>
                    <td className="py-0.5">{hm(w.doneMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {canAdjust && (
            <Button size="sm" className="mt-3" onClick={() => setPreview(true)}>
              Ajustar próximos planos ao meu ritmo
            </Button>
          )}
        </>
      )}

      {proposal && (
        <Modal
          open={preview}
          onClose={() => setPreview(false)}
          title="Ajustar ao seu ritmo"
          description="Prévia: nada muda até você confirmar. Só blocos futuros e pendentes são encurtados; o histórico fica como está."
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreview(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={apply.isPending}
                onClick={() =>
                  apply
                    .mutateAsync(proposal.changes)
                    .then((n) => {
                      toast.success(`${n} bloco(s) ajustado(s) ao seu ritmo.`)
                      setPreview(false)
                    })
                    .catch((e) => toast.error(e))
                }
              >
                Aplicar ajuste
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            Blocos futuros: <strong>{hm(before)}</strong> → <strong>{hm(after)}</strong> ({Math.round(proposal.factor * 100)}% da duração, mínimo de 15 min por bloco).
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">Semana de</th>
                <th className="py-1 font-medium">Antes</th>
                <th className="py-1 font-medium">Depois</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {proposal.weeks.map((w) => (
                <tr key={w.week}>
                  <td className="py-1">{formatDayKey(w.week)}</td>
                  <td className="py-1">{hm(w.before)}</td>
                  <td className="py-1">{hm(w.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">{proposal.changes.length} bloco(s) serão encurtados.</p>
        </Modal>
      )}
    </Card>
  )
}
