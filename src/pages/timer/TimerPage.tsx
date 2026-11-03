import { useMemo, useState } from 'react'
import { Check, History, PenLine, Target, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Progress } from '@/components/ui/layout'
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
  const [manual, setManual] = useState(false)
  const today = useMemo(() => periodRange('day', todayKey(settings.timezone)), [settings.timezone])
  const stats = useStudyStats(today)
  const goal = settings.dailyGoalMinutes * 60
  const progress = goal > 0 ? Math.min(100, Math.round((stats.stats.total / goal) * 100)) : 0
  const remaining = Math.max(0, goal - stats.stats.total)

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase"><Timer className="size-3.5" aria-hidden /> Seu espaço de foco</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Uma coisa de cada vez.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Escolha o que estudar e dê espaço ao seu próximo avanço.</p>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted">{live.data?.status === 'active' ? 'Sessão em andamento' : live.data?.status === 'pending_review' ? 'Sessão para confirmar' : 'Pronto para começar'}</span>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
      <aside className="flex min-w-0 flex-col gap-5">
        <Card className="overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">Seu progresso hoje</p>
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent-strong"><Target className="size-4" aria-hidden /></span>
          </div>
          <p className="tabular mt-5 text-4xl font-semibold tracking-tight text-ink">{stats.isPending ? '…' : formatDuration(stats.stats.total)}</p>
          <p className="mt-1 text-xs text-muted">Hoje (líquido) · {stats.stats.sessions} sessão(ões) concluída(s)</p>
          <div className="mt-6 flex justify-between gap-2 text-xs text-muted"><span>Meta diária {formatDuration(goal)}</span><span className="tabular font-semibold text-ink">{progress}%</span></div>
          <Progress value={progress} className="mt-2 h-1.5" label="Meta diária de estudo" />
          {!stats.isPending && goal > 0 && <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">{remaining === 0 && <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />}{remaining === 0 ? 'Meta alcançada. Cada novo minuto é um passo a mais.' : `Faltam ${formatDuration(remaining)} para sua meta de hoje.`}</p>}
        </Card>
        <div className="rounded-2xl border border-dashed border-line p-4">
          <p className="mb-3 text-xs leading-relaxed text-muted">Estudou fora da plataforma? Inclua esse tempo no seu histórico.</p>
          <Button className="w-full" icon={<PenLine className="size-4" />} onClick={() => setManual(true)}>Lançamento manual</Button>
        </div>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <History className="size-4" /> Sessões recentes
          </h2>
          <SessionList emptyText="Nenhuma sessão concluída ainda." />
        </section>
      </aside>
      </div>
      <ManualEntry open={manual} onClose={() => setManual(false)} />
    </div>
  )
}
