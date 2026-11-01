import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { useProfile, useSettings } from '@/hooks/useSettings'
import { netSeconds, openPause, phaseStatus } from '@/lib/timer/engine'
import { playChime } from '@/lib/timer/sound'
import { isTimerEnding } from '@/lib/timer/warning'
import { formatClock } from '@/lib/time'
import { Button } from '@/components/ui/Button'
import { useLiveSession } from './useLiveSession'

/**
 * Montado no layout: toca o alerta e mostra o aviso visual quando uma fase
 * termina, em qualquer módulo. Também mostra o tempo no título da aba.
 */
export function TimerAlerts() {
  const live = useLiveSession()
  const settings = useSettings()
  const profile = useProfile()
  const s = live.data
  const running = Boolean(s && s.status === 'active')
  const now = useNow(1000, running)
  const location = useLocation()
  const navigate = useNavigate()
  const alerted = useRef<string | null>(null)
  const warned = useRef<string | null>(null)

  const status = s && running ? phaseStatus(s, s.pauses, now) : null
  const due = Boolean(status?.due)
  const key = s && status ? `${s.id}:${status.index}` : null
  const pause = s ? openPause(s.pauses) : null
  const ending = isTimerEnding(status, Boolean(pause && pause.kind !== 'break'))

  useEffect(() => {
    if (!ending || !key || !profile.isSuccess || warned.current === key) return
    warned.current = key
    let already = false
    try {
      already = sessionStorage.getItem('evl:warned') === key
      sessionStorage.setItem('evl:warned', key)
    } catch { /* sem sessionStorage */ }
    if (settings.sound && !already) playChime('warning')
  }, [ending, key, settings.sound, profile.isSuccess])

  useEffect(() => {
    if (!due || !key || !profile.isSuccess || alerted.current === key) return
    alerted.current = key
    let already = false
    try {
      already = sessionStorage.getItem('evl:alerted') === key
      sessionStorage.setItem('evl:alerted', key)
    } catch {
      /* sem sessionStorage */
    }
    if (settings.sound && !already) playChime(status?.phase?.kind === 'break' ? 'break-end' : 'focus-end')
  }, [due, key, settings.sound, status?.phase?.kind, profile.isSuccess])

  useEffect(() => {
    const base = 'VLM Control'
    if (!s || s.status !== 'active') {
      document.title = base
      return
    }
    const paused = Boolean(openPause(s.pauses))
    const shown = status?.phase && status.remaining != null ? formatClock(status.remaining) : formatClock(netSeconds(s, s.pauses, now))
    document.title = `${due ? '⏰ ' : paused ? '⏸ ' : ending ? '⌛ ' : ''}${shown} · ${base}`
  }, [s, now, status, due, ending])

  if ((!due && !ending) || location.pathname.startsWith('/cronometro')) return null
  return (
    <div role={due ? 'alert' : 'status'} className="global-timer-alert animate-fade-in fixed inset-x-4 top-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-accent bg-bg px-4 py-3 shadow-lg">
      <BellRing className="size-5 shrink-0 text-accent-strong" />
      <p className="min-w-0 flex-1 text-sm text-ink">{ending ? 'Seu tempo está acabando.' : status?.phase?.kind === 'break' ? 'A pausa terminou.' : 'Tempo de foco concluído!'}</p>
      <Button size="sm" variant="primary" onClick={() => navigate('/cronometro')}>
        Abrir
      </Button>
    </div>
  )
}
