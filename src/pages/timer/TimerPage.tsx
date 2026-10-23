import { useMemo, useState } from 'react'
import { History, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { QueryState } from '@/components/ui/feedback'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { SessionList } from '@/features/timer/SessionList'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useSettings } from '@/hooks/useSettings'
import { formatDuration, periodRange, todayKey } from '@/lib/time'
import { ActiveTimer } from './ActiveTimer'
import { FinishReview } from './FinishReview'
import { TimerSetup } from './TimerSetup'
import { ManualEntry } from './ManualEntry'

export default function TimerPage() {
  const live = useLiveSession()
  const settings = useSettings()
  // ?manual=1 (paleta de comandos) abre o lançamento manual.
  const [manual, setManual] = useState(() => new URLSearchParams(window.location.search).get('manual') === '1')
  const today = useMemo(() => periodRange('day', todayKey(settings.timezone)), [settings.timezone])
  const stats = useStudyStats(today)
  const goal = settings.dailyGoalMinutes * 60

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <QueryState query={live}>
          {live.data?.status === 'active' ? (
            <ActiveTimer session={live.data} />
          ) : live.data?.status === 'pending_review' ? (
            <FinishReview session={live.data} />
          ) : (
            <TimerSetup />
          )}
        </QueryState>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Hoje (líquido)</p>
          <p className="tabular mt-1 text-2xl font-semibold text-ink">{formatDuration(stats.stats.total)}</p>
          <p className="mt-1 text-xs text-muted">
            Meta diária {formatDuration(goal)} · {goal > 0 ? Math.min(100, Math.round((stats.stats.total / goal) * 100)) : 0}% · {stats.stats.sessions} sessão(ões)
          </p>
        </Card>
        <Button icon={<PenLine className="size-4" />} onClick={() => setManual(true)}>
          Lançamento manual
        </Button>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <History className="size-4" /> Sessões recentes
          </h2>
          <SessionList emptyText="Nenhuma sessão concluída ainda." />
        </section>
      </aside>
      <ManualEntry open={manual} onClose={() => setManual(false)} />
    </div>
  )
}
