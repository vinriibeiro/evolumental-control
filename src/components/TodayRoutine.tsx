import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/layout'
import { Spinner } from '@/components/ui/feedback'
import { useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { ACTIVITY_LABELS } from '@/lib/labels'
import { routineDayBlocks, type RoutineDayBlock, type RoutineDayPillar } from '@/lib/routine'
import { todayKey } from '@/lib/time'
import { appliedRoutineFrom } from '@/services/routines'

const KIND_LABELS: Record<RoutineDayBlock['kind'], string> = { daily: 'Bloco diário', weekly: 'Tarefa da semana', cycle: 'Cronograma' }

/** Cartão "Rotina de hoje": blocos do dia por pilar. `hideWhenEmpty`: sem rotina aplicada, não mostra nada (tela inicial). */
export function TodayRoutine({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean }) {
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const applied = useMemo(() => appliedRoutineFrom(plans.data ?? []), [plans.data])
  const day = useMemo(() => (applied ? routineDayBlocks(applied.draft, today) : []), [applied, today])
  if (hideWhenEmpty && (plans.isPending || !applied)) return null
  return <TodayRoutineView loading={plans.isPending} routineName={applied?.draft.name ?? null} pillars={day} />
}

export function TodayRoutineView({
  loading = false,
  routineName,
  pillars,
}: {
  loading?: boolean
  routineName: string | null
  pillars: RoutineDayPillar[]
}) {
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ListChecks className="size-4" /> Rotina de hoje</span>}
        description={routineName ?? undefined}
        action={<Link to="/rotinas" className="text-xs text-muted underline">Rotinas</Link>}
      />
      <div className="px-5 py-3">
        {loading ? (
          <Spinner />
        ) : routineName === null ? (
          <p className="py-4 text-sm text-muted">
            Você ainda não tem uma rotina aplicada. Monte uma por regras claras, com ciclo e cronograma dos seus estudos em dados.{' '}
            <Link to="/rotinas" className="underline">
              Criar minha rotina
            </Link>
          </p>
        ) : pillars.length === 0 ? (
          <p className="py-2 text-sm text-muted">Nenhum bloco da rotina para hoje.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pillars.map((p) => {
              const summary = p.blocks.map((b) => `${b.start_time} · ${b.duration_minutes} min · ${KIND_LABELS[b.kind]} (${ACTIVITY_LABELS[b.activity_type]})`).join(' | ')
              return (
                <li key={p.pillarId} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="tabular w-12 shrink-0 text-sm font-medium text-ink">{p.blocks[0].start_time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{p.name}</p>
                      <p className="truncate text-xs text-muted">{summary}</p>
                    </div>
                    <span className="tabular text-xs text-muted">{p.minutes} min</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
