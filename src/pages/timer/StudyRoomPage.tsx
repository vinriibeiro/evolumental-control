// Sala de Estudos: onde a sessão acontece. Um único cronômetro para todo o app.
// Sem sessão: preparar e iniciar. Com sessão: cronômetro completo ou o modo foco. Ao finalizar: conferir e salvar.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, History } from 'lucide-react'
import { Card, Progress } from '@/components/ui/layout'
import { QueryState } from '@/components/ui/feedback'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useSettings } from '@/hooks/useSettings'
import { formatDuration, periodRange, todayKey } from '@/lib/time'
import { ActiveTimer } from './ActiveTimer'
import { FinishReview } from './FinishReview'
import { FocusMode } from './FocusMode'
import { Scratchpad } from './Scratchpad'
import { TimerSetup } from './TimerSetup'

const FOCUS_KEY = 'evl:focus-mode'

function readFocus(): boolean {
  try {
    return localStorage.getItem(FOCUS_KEY) === '1'
  } catch {
    return false
  }
}

export default function StudyRoomPage() {
  const live = useLiveSession()
  const settings = useSettings()
  const [focus, setFocus] = useState(readFocus)
  const today = useMemo(() => periodRange('day', todayKey(settings.timezone)), [settings.timezone])
  const stats = useStudyStats(today)
  const goal = settings.dailyGoalMinutes * 60
  const progress = goal > 0 ? Math.min(100, Math.round((stats.stats.total / goal) * 100)) : 0
  const remaining = Math.max(0, goal - stats.stats.total)

  // a escolha do modo foco vale para a sessão inteira, mesmo recarregando a página
  useEffect(() => {
    try {
      localStorage.setItem(FOCUS_KEY, focus ? '1' : '0')
    } catch {
      /* preferência apenas deste dispositivo */
    }
  }, [focus])

  const session = live.data
  if (session?.status === 'active' && focus) return <FocusMode session={session} onExit={() => setFocus(false)} />

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <QueryState query={live}>{session?.status === 'active' ? <ActiveTimer session={session} onFocus={() => setFocus(true)} /> : session?.status === 'pending_review' ? <FinishReview session={session} /> : <TimerSetup />}</QueryState>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">Seu estudo hoje</p>
          <p className="tabular mt-3 text-3xl font-semibold tracking-tight text-ink">{stats.isPending ? '…' : formatDuration(stats.stats.total)}</p>
          <p className="mt-1 text-xs text-muted">Tempo líquido · {stats.stats.sessions} sessão(ões) concluída(s)</p>
          {goal > 0 && (
            <>
              <div className="mt-5 flex justify-between gap-2 text-xs text-muted">
                <span>Meta diária {formatDuration(goal)}</span>
                <span className="tabular font-semibold text-ink">{progress}%</span>
              </div>
              <Progress value={progress} className="mt-2" label="Meta diária de estudo" />
              {!stats.isPending && (
                <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                  {remaining === 0 && <Check className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />}
                  {remaining === 0 ? 'Meta de hoje alcançada.' : `Faltam ${formatDuration(remaining)} para a meta de hoje.`}
                </p>
              )}
            </>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-[13px] font-semibold text-ink">Bloco de notas</p>
          <Scratchpad initial={settings.scratchpad ?? ''} />
        </Card>
        <Link to="/sala/historico" className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2">
          <History className="size-4 text-muted" aria-hidden /> Histórico de sessões e lançamento manual
        </Link>
      </aside>
    </div>
  )
}
