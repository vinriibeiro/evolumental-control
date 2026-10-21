import { useEffect, useState } from 'react'
import { BellRing, Coffee, Flag, NotebookPen, Pause, Play, RotateCcw, SkipForward, Square, Volume2, VolumeX, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Badge, Card } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useNow } from '@/hooks/useNow'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import type { SessionWithPauses } from '@/lib/data/types'
import { ACTIVITY_LABELS, MODE_LABELS } from '@/lib/labels'
import { netSeconds, openPause, pausedSeconds, phaseAt, phaseStatus } from '@/lib/timer/engine'
import { formatClock, formatDuration, formatTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import { useSessionActions } from '@/features/timer/useLiveSession'
import type { StartParams } from '@/services/sessions'

export function ActiveTimer({ session: s }: { session: SessionWithPauses }) {
  const now = useNow(250)
  const actions = useSessionActions()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const lookups = useLookups()
  const confirm = useConfirm()
  const toast = useToast()
  const [notesOpen, setNotesOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const pause = openPause(s.pauses)
  const paused = Boolean(pause)
  const inBreak = pause?.kind === 'break'
  const net = netSeconds(s, s.pauses, now)
  const pausedTotal = pausedSeconds(s, s.pauses, now)
  const st = phaseStatus(s, s.pauses, now)
  const next = s.timer_config && s.timer_state ? phaseAt(s.timer_config, s.timer_state.phaseIndex + 1) : null
  const hasPhase = Boolean(st.phase)
  const mainSeconds = hasPhase && !st.due ? (st.remaining ?? 0) : hasPhase && st.due ? st.overtime : net
  const ringPct = hasPhase && st.phase ? Math.min(1, st.elapsed / st.phase.seconds) : null

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      toast.error(e)
    }
  }

  // Espaço alterna pausa/continuar quando o foco não está em um campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag) || inBreak) return
      e.preventDefault()
      void act(() => (paused ? actions.resume(s) : actions.pause(s)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const restartParams = (): StartParams => ({
    subject_id: s.subject_id,
    topic_id: s.topic_id,
    activity_type: s.activity_type,
    mode: s.mode === 'manual' ? 'stopwatch' : s.mode,
    planned_minutes: s.planned_seconds ? s.planned_seconds / 60 : null,
    pomodoro: s.timer_config?.pomodoro,
    intervals: s.timer_config?.phases,
    repeatIntervals: s.timer_config?.repeat,
    notes: s.notes,
    plan_item_id: s.plan_item_id,
    cycle_id: s.cycle_id,
    cycle_item_id: s.cycle_item_id,
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: lookups.subjectColor(s.subject_id) }} />
        <span className="min-w-0 truncate text-sm font-medium text-ink">
          {lookups.subjectName(s.subject_id)}
          {s.topic_id && <span className="font-normal text-muted"> › {lookups.topicName(s.topic_id)}</span>}
        </span>
        <span className="flex-1" />
        <Badge>{ACTIVITY_LABELS[s.activity_type]}</Badge>
        <Badge>{MODE_LABELS[s.mode]}</Badge>
      </div>

      <div className="flex flex-col items-center px-4 py-8 sm:py-10">
        <div className="relative flex aspect-square w-full max-w-[22rem] items-center justify-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r="92" fill="none" stroke="var(--border)" strokeWidth="6" />
            {ringPct != null && (
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke={st.phase?.kind === 'break' ? 'var(--info)' : 'var(--accent-strong)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 92}
                strokeDashoffset={2 * Math.PI * 92 * (1 - ringPct)}
                style={{ transition: 'stroke-dashoffset 250ms linear' }}
              />
            )}
          </svg>
          <div className="relative flex w-[78%] flex-col items-center text-center">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {st.due ? (st.phase?.kind === 'break' ? 'Pausa encerrada há' : 'Tempo extra') : inBreak ? (st.phase?.label ?? 'Pausa') : paused ? 'Pausado' : (st.phase?.label ?? 'Tempo líquido')}
            </p>
            <p
              className={cn('tabular w-full font-semibold tracking-tight text-ink', paused && !inBreak && 'opacity-60')}
              style={{ fontSize: 'clamp(2.4rem, 11vw, 4.5rem)', lineHeight: 1.05 }}
              aria-live="off"
            >
              {formatClock(mainSeconds)}
            </p>
            {hasPhase && <p className="tabular mt-1 text-sm text-muted">Líquido {formatClock(net)}</p>}
            {pausedTotal > 0 && <p className="tabular mt-0.5 text-xs text-muted">Pausado {formatDuration(pausedTotal, { seconds: true })}</p>}
          </div>
        </div>

        {st.due && (
          <div role="alert" className="animate-fade-in mt-6 flex w-full max-w-lg flex-col items-center gap-3 rounded-xl border border-accent bg-accent/15 p-4 text-center">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BellRing className="size-4" />
              {st.phase?.kind === 'break' ? 'A pausa terminou. Hora de voltar!' : s.mode === 'countdown' ? 'Tempo planejado concluído!' : 'Período de foco concluído!'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {st.phase?.kind === 'break' ? (
                <Button variant="primary" icon={<Play className="size-4" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
                  Voltar ao foco
                </Button>
              ) : next?.kind === 'break' ? (
                <Button variant="primary" icon={<Coffee className="size-4" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
                  Iniciar pausa ({Math.round(next.seconds / 60)} min)
                </Button>
              ) : next ? (
                <Button variant="primary" icon={<SkipForward className="size-4" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
                  Próximo: {next.label || 'foco'}
                </Button>
              ) : null}
              {st.phase?.kind !== 'break' && (
                <Button onClick={() => act(() => actions.acknowledge(s))} disabled={actions.pending}>
                  Continuar estudando
                </Button>
              )}
              <Button icon={<Flag className="size-4" />} onClick={() => act(() => actions.finish(s))} disabled={actions.pending}>
                Encerrar
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {inBreak ? (
            <Button variant="primary" size="lg" icon={<Play className="size-5" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
              Encerrar pausa
            </Button>
          ) : paused ? (
            <Button variant="primary" size="lg" icon={<Play className="size-5" />} onClick={() => act(() => actions.resume(s))} loading={actions.pending}>
              Continuar
            </Button>
          ) : (
            <Button variant="primary" size="lg" icon={<Pause className="size-5" />} onClick={() => act(() => actions.pause(s))} loading={actions.pending}>
              Pausar
            </Button>
          )}
          <Button variant="dark" size="lg" icon={<Square className="size-4" />} onClick={() => act(() => actions.finish(s))} disabled={actions.pending}>
            Finalizar
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
          {hasPhase && !st.due && (s.mode === 'pomodoro' || s.mode === 'intervals') && next && (
            <Button size="sm" variant="ghost" icon={<SkipForward className="size-4" />} onClick={() => act(() => actions.nextPhase(s))} disabled={actions.pending}>
              Pular fase
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<NotebookPen className="size-4" />} onClick={() => setNotesOpen(true)}>
            Observações
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="size-4" />}
            disabled={actions.pending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Reiniciar a sessão?',
                message: 'O tempo atual será descartado (não conta como estudo) e uma nova contagem começará com as mesmas configurações.',
                confirmLabel: 'Reiniciar',
                danger: true,
              })
              if (ok) await act(() => actions.restart(s, restartParams()))
            }}
          >
            Reiniciar
          </Button>
          <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setCancelOpen(true)} disabled={actions.pending}>
            Cancelar
          </Button>
          <IconButton
            size="sm"
            label={settings.sound ? 'Desativar som' : 'Ativar som'}
            aria-pressed={settings.sound}
            onClick={() => updateSettings.mutate({ sound: !settings.sound })}
          >
            {settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconButton>
        </div>
        <p className="mt-4 text-xs text-muted">
          Iniciada às {formatTime(new Date(s.started_at).getTime(), settings.timezone, settings.hourFormat)} · Barra de espaço pausa e continua
        </p>
      </div>

      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} session={s} />
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar a sessão?"
        description={`Tempo líquido até agora: ${formatDuration(net)}.`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              onClick={async () => {
                setCancelOpen(false)
                await act(() => actions.finish(s))
              }}
            >
              Salvar o tempo aproveitado
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setCancelOpen(false)
                await act(() => actions.discard(s))
                toast.info('Sessão cancelada. Nada foi contabilizado.')
              }}
            >
              Descartar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Uma sessão cancelada não conta como estudo. Se quiser aproveitar o período, escolha salvar o tempo aproveitado.</p>
      </Modal>
    </Card>
  )
}

function NotesModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: SessionWithPauses }) {
  const [notes, setNotes] = useState(session.notes ?? '')
  const update = useUpdate('study_sessions')
  const toast = useToast()
  useEffect(() => {
    if (open) setNotes(session.notes ?? '')
  }, [open, session.notes])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Observações da sessão"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            onClick={async () => {
              try {
                await update.mutateAsync({ id: session.id, patch: { notes: notes.trim().slice(0, 4000) || null } })
                onClose()
              } catch (e) {
                toast.error(e)
              }
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Observações" maxLength={4000} autoFocus />
    </Modal>
  )
}
