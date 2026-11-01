import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Pause, Play, Square, Timer, Volume2, VolumeX } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/feedback'
import { useLiveSession, useSessionActions } from '@/features/timer/useLiveSession'
import { useNow } from '@/hooks/useNow'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { netSeconds, openPause, phaseStatus } from '@/lib/timer/engine'
import { isTimerEnding } from '@/lib/timer/warning'
import { unlockAudio } from '@/lib/timer/sound'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/cn'

export function VideoStudyTimer({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const live = useLiveSession()
  const actions = useSessionActions()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const toast = useToast()
  const [minutes, setMinutes] = useState('50')
  const [error, setError] = useState<string | null>(null)
  const s = live.data
  const now = useNow(1000, s?.status === 'active')
  const status = s?.status === 'active' ? phaseStatus(s, s.pauses, now) : null
  const paused = Boolean(s && openPause(s.pauses))
  const inBreak = status?.phase?.kind === 'break'
  const ending = isTimerEnding(status, paused && !inBreak)
  const due = status?.due
  const overtime = status?.overtime ?? 0
  const caption = !s
    ? 'Aviso antes do fim e ao concluir. Ao finalizar, revise e salve seu estudo.'
    : s.status === 'pending_review'
      ? 'Revise o tempo antes de salvar no seu histórico.'
      : s.topic_id === topicId
        ? 'O tempo desta sessão continua ao trocar de aula.'
        : 'Esta sessão mantém o vínculo com a aula em que começou.'
  const label = !s ? 'Reserve um tempo para aprender'
    : s.status === 'pending_review' ? 'Sessão finalizada'
      : inBreak ? 'Intervalo'
        : paused ? 'Estudo pausado'
          : overtime > 0 ? 'Tempo extra'
            : 'Sua sessão de foco'

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    unlockAudio()
    try {
      await fn()
    } catch (e) {
      setError('Não foi possível atualizar a sessão. Tente novamente.')
      toast.error(e)
    }
  }
  const start = () => {
    const value = Number(minutes.replace(',', '.'))
    if (!Number.isFinite(value) || value < 1 || value > 1440) {
      setError('Informe entre 1 e 1440 minutos.')
      return
    }
    setError(null)
    void act(async () => {
      try {
        await actions.start({ subject_id: subjectId, topic_id: topicId, activity_type: 'video', mode: 'countdown', planned_minutes: value })
      } catch (e) {
        actions.resetStartId()
        throw e
      }
    })
  }

  return (
    <section aria-label="Temporizador de estudo" className={cn('border-b border-line px-4 py-3', due || ending ? 'bg-warning/10' : 'bg-surface')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Timer className={cn('size-5 shrink-0', due || ending ? 'text-warning' : 'text-accent-strong')} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{label}</p>
            <p className="video-timer-caption text-xs text-muted">{caption}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live.isLoading ? <p className="text-sm text-muted">Carregando sessão…</p> : live.isError ? (
            <Button size="sm" onClick={() => void live.refetch()}>Tentar carregar sessão</Button>
          ) : !s ? (
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); start() }}>
              <label className="sr-only" htmlFor="video-study-minutes">Duração do estudo em minutos</label>
              <Input id="video-study-minutes" className="h-9 w-20 tabular" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'video-timer-error' : undefined} />
              <span className="text-xs text-muted">min</span>
              <Button type="submit" size="sm" variant="primary" loading={actions.pending} icon={<Play className="size-3.5" aria-hidden />}>Iniciar foco</Button>
            </form>
          ) : s.status === 'pending_review' ? (
            <Link to="/cronometro" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">Revisar e salvar sessão</Link>
          ) : (
            <>
              <span className={cn('tabular text-2xl font-semibold tracking-tight', due || ending ? 'text-warning' : 'text-ink')} aria-live="off">{overtime > 0 ? '+' : ''}{formatClock(overtime > 0 ? overtime : status?.remaining ?? netSeconds(s, s.pauses, now))}</span>
              {!inBreak && <IconButton label={paused ? 'Continuar foco' : 'Pausar foco'} size="sm" disabled={actions.pending} onClick={() => void act(() => paused ? actions.resume(s) : actions.pause(s))}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</IconButton>}
              <Button size="sm" icon={<Square className="size-3.5" aria-hidden />} disabled={actions.pending} onClick={() => void act(() => actions.finish(s))}>Finalizar foco</Button>
            </>
          )}
          <IconButton label={settings.sound ? 'Desativar som dos alertas' : 'Ativar som dos alertas'} size="sm" aria-pressed={settings.sound} disabled={updateSettings.isPending} onClick={() => void act(() => updateSettings.mutateAsync({ sound: !settings.sound }))}>
            {settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconButton>
        </div>
      </div>
      {error && <p id="video-timer-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {(ending || due) && <div role={due ? 'alert' : 'status'} className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        <BellRing className="size-4 text-warning" aria-hidden />
        <span>{due ? inBreak ? 'Intervalo concluído. Pronto para voltar?' : 'Tempo de foco concluído. Finalize para revisar e salvar.' : 'Seu tempo está acabando. Prepare-se para uma pausa.'}</span>
        {due && <Button size="sm" disabled={actions.pending} onClick={() => void act(() => inBreak ? actions.nextPhase(s!) : actions.acknowledge(s!))}>{inBreak ? 'Voltar ao foco' : 'Continuar estudando'}</Button>}
      </div>}
    </section>
  )
}
