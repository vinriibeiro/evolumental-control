import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Check, Languages, ListChecks } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Badge, Card, CardHeader } from '@/components/ui/layout'
import { Spinner } from '@/components/ui/feedback'
import { useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { goalMet, minutesOnDay } from '@/lib/english'
import { ACTIVITY_LABELS } from '@/lib/labels'
import { routineDayBlocks, type RoutineDayBlock, type RoutineDayPillar } from '@/lib/routine'
import { todayKey } from '@/lib/time'
import { appliedRoutineFrom } from '@/services/routines'
import { loadPractices } from '@/services/english'

const KIND_LABELS: Record<RoutineDayBlock['kind'], string> = { daily: 'Bloco diário', weekly: 'Tarefa da semana', cycle: 'Cronograma' }

/** Cartão "Rotina de hoje": blocos do dia por pilar e status do inglês do dia. */
export function TodayRoutine() {
  const backend = useBackend()
  const settings = useSettings()
  const tz = settings.timezone
  const today = todayKey(tz)
  const plans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const applied = useMemo(() => appliedRoutineFrom(plans.data ?? []), [plans.data])
  const day = useMemo(() => (applied ? routineDayBlocks(applied.draft, today) : []), [applied, today])
  // Mesma consulta (e cache) da aba Inglês.
  const practices = useQuery({
    queryKey: ['data', ['study_sessions', 'study_session_pauses', 'subjects', 'topics'], 'english', backend.kind],
    queryFn: () => loadPractices(backend),
  })
  return (
    <TodayRoutineView
      loading={plans.isPending}
      routineName={applied?.draft.name ?? null}
      pillars={day}
      englishMinutes={minutesOnDay(practices.data ?? [], today, tz)}
      englishGoal={settings.englishGoalMinutes}
    />
  )
}

export function TodayRoutineView({
  loading = false,
  routineName,
  pillars,
  englishMinutes,
  englishGoal,
}: {
  loading?: boolean
  routineName: string | null
  pillars: RoutineDayPillar[]
  englishMinutes: number
  englishGoal: number
}) {
  const englishDone = goalMet(englishMinutes, englishGoal)
  const englishStatus = englishDone ? 'Inglês de hoje: feito' : `Inglês de hoje: pendente (${englishMinutes}/${englishGoal} min)`
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
            Você ainda não tem uma rotina aplicada. Monte uma por regras claras, com ciclo, cronograma e inglês diário.{' '}
            <Link to="/rotinas" className="underline">
              Criar minha rotina
            </Link>
          </p>
        ) : (
          <>
            {pillars.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nenhum bloco da rotina para hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pillars.map((p) => {
                  const summary = p.blocks.map((b) => `${b.start_time} · ${b.duration_minutes} min · ${KIND_LABELS[b.kind]} (${ACTIVITY_LABELS[b.activity_type]})`).join(' | ')
                  return (
                    <li key={p.pillarId} className="py-2.5">
                      {p.english ? (
                        <Link to="/ingles" className="flex items-center gap-3 rounded-lg hover:bg-surface" aria-label={`${p.name}: abrir a aba Inglês`}>
                          <Languages className="size-4 shrink-0 text-accent-strong" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">{p.name}</p>
                            <p className="truncate text-xs text-muted">{summary}</p>
                          </div>
                          <Badge color={englishDone ? 'var(--success)' : undefined}>{englishDone ? 'Feito' : 'Pendente'}</Badge>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="tabular w-12 shrink-0 text-sm font-medium text-ink">{p.blocks[0].start_time}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">{p.name}</p>
                            <p className="truncate text-xs text-muted">{summary}</p>
                          </div>
                          <span className="tabular text-xs text-muted">{p.minutes} min</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <Link to="/ingles" className="mt-3 flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-sm text-ink">
              <span className="flex items-center gap-2">
                {englishDone ? <Check className="size-4 text-success" /> : <Languages className="size-4 text-accent-strong" />} {englishStatus}
              </span>
              <span className="text-xs text-muted underline">Abrir Inglês</span>
            </Link>
          </>
        )}
      </div>
    </Card>
  )
}
