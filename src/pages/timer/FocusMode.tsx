// Modo foco: só o conteúdo estudado, o cronômetro, os controles da sessão e anotações rápidas.
// O restante da interface (menu, cabeçalho, abas) some enquanto esta tela está aberta (regra em index.css).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coffee, Minimize2, Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/feedback'
import { useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useNow } from '@/hooks/useNow'
import type { SessionWithPauses } from '@/lib/data/types'
import { netSeconds, openPause, phaseAt, phaseStatus } from '@/lib/timer/engine'
import { formatClock } from '@/lib/time'
import { cn } from '@/lib/cn'
import { useSessionActions } from '@/features/timer/useLiveSession'

export function FocusMode({ session: s, onExit }: { session: SessionWithPauses; onExit: () => void }) {
  const now = useNow(250)
  const actions = useSessionActions()
  const lookups = useLookups()
  const toast = useToast()
  const update = useUpdate('study_sessions')
  const [notes, setNotes] = useState(s.notes ?? '')
  const saved = useRef(s.notes ?? '')

  const pause = openPause(s.pauses)
  const paused = Boolean(pause)
  const inBreak = pause?.kind === 'break'
  const net = netSeconds(s, s.pauses, now)
  const st = phaseStatus(s, s.pauses, now)
  const next = s.timer_config && s.timer_state ? phaseAt(s.timer_config, s.timer_state.phaseIndex + 1) : null
  const hasPhase = Boolean(st.phase)
  const main = hasPhase && !st.due ? (st.remaining ?? 0) : hasPhase && st.due ? st.overtime : net
  const what = s.source?.label ?? (s.topic_id ? lookups.topicName(s.topic_id) : lookups.subjectName(s.subject_id))
  const context = s.subject_id && (s.source?.label || s.topic_id) ? lookups.subjectName(s.subject_id) : null

  const act = (fn: () => Promise<unknown>) => fn().catch((e) => toast.error(e))

  // anotações rápidas: salvas ao sair do campo e depois de 2 s sem digitar
  const saveNotes = (value: string) => {
    const text = value.trim().slice(0, 4000)
    if (text === saved.current.trim()) return
    saved.current = text
    update.mutate({ id: s.id, patch: { notes: text || null } }, { onError: (e) => toast.error(e) })
  }
  useEffect(() => {
    const t = setTimeout(() => saveNotes(notes), 2000)
    return () => clearTimeout(t)
  }, [notes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === 'Escape' && tag !== 'TEXTAREA') return onExit()
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || inBreak) return
      e.preventDefault()
      void act(() => (paused ? actions.resume(s) : actions.pause(s)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="focus-mode flex min-h-dvh flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <span className={cn('size-1.5 rounded-full', paused ? 'bg-muted' : 'bg-accent')} aria-hidden />
          {inBreak ? 'Intervalo' : paused ? 'Pausado' : 'Em foco'}
        </span>
        <Button size="sm" variant="ghost" icon={<Minimize2 className="size-4" />} onClick={onExit}>
          Sair do modo foco
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 pb-10">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">Estudando</p>
        <h1 className="mt-2 text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">{what || 'Estudo livre'}</h1>
        {context && <p className="mt-1 text-sm text-muted">{context}</p>}
        {s.source?.href && s.source.href !== '/' && (
          <Link to={s.source.href} className="mt-2 text-xs font-medium text-ink underline underline-offset-2">
            Abrir o conteúdo
          </Link>
        )}

        <p className={cn('tabular mt-10 font-semibold tracking-tight text-ink', paused && !inBreak && 'opacity-50')} style={{ fontSize: 'clamp(3.2rem, 16vw, 6rem)', lineHeight: 1 }} aria-live="off">
          {formatClock(main)}
        </p>
        <p className="tabular mt-3 text-sm text-muted">
          {st.due ? (st.phase?.kind === 'break' ? 'A pausa terminou' : 'Tempo planejado concluído') : hasPhase ? `${st.phase?.label ?? 'Foco'} · líquido ${formatClock(net)}` : 'Tempo líquido'}
        </p>

        <div className="mt-9 flex w-full max-w-sm flex-wrap items-center justify-center gap-3 [&>button]:flex-1">
          {st.due && next ? (
            <Button variant="primary" size="lg" icon={next.kind === 'break' ? <Coffee className="size-5" /> : <Play className="size-5" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
              {next.kind === 'break' ? `Pausa de ${Math.round(next.seconds / 60)} min` : 'Voltar ao foco'}
            </Button>
          ) : inBreak ? (
            <Button variant="primary" size="lg" icon={<Play className="size-5" />} onClick={() => act(() => actions.nextPhase(s))} loading={actions.pending}>
              Encerrar pausa
            </Button>
          ) : paused ? (
            <Button variant="primary" size="lg" icon={<Play className="size-5" />} onClick={() => act(() => actions.resume(s))} loading={actions.pending}>
              Continuar
            </Button>
          ) : (
            <Button size="lg" icon={<Pause className="size-5" />} onClick={() => act(() => actions.pause(s))} loading={actions.pending}>
              Pausar
            </Button>
          )}
          <Button
            variant="dark"
            size="lg"
            icon={<Square className="size-4" />}
            disabled={actions.pending}
            onClick={() => {
              saveNotes(notes)
              void act(() => actions.finish(s)).then(onExit)
            }}
          >
            Finalizar
          </Button>
        </div>

        <div className="mt-10 w-full">
          <label htmlFor="focus-notes" className="mb-1.5 block text-xs font-medium text-muted">
            Anotações rápidas
          </label>
          <Textarea id="focus-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => saveNotes(notes)} maxLength={4000} placeholder="Dúvidas, ideias e o que revisar depois. Fica salvo com a sessão." />
        </div>
      </div>
    </div>
  )
}
