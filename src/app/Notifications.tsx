import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Brain, CalendarClock, Layers, Timer } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { useCount } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq, inList, lte } from '@/lib/data/types'
import { todayKey, minuteIso } from '@/lib/time'
import { useLiveSession } from '@/features/timer/useLiveSession'

/** Notificações relevantes, calculadas a partir dos dados (nada é inventado). */
export function Notifications() {
  const [open, setOpen] = useState(false)
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const reviews = useCount('reviews', [inList('status', ['planned', 'postponed']), lte('scheduled_for', today)])
  const cards = useCount('flashcards', [inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())])
  const blocks = useCount('study_plan_items', [eq('date', today), eq('status', 'pending')])
  const live = useLiveSession()

  const items = [
    live.data && { icon: Timer, text: live.data.status === 'pending_review' ? 'Uma sessão aguarda confirmação.' : 'Há uma sessão de estudo em andamento.', to: '/cronometro' },
    (reviews.data ?? 0) > 0 && { icon: Brain, text: `${reviews.data} revisão(ões) para hoje ou atrasada(s).`, to: '/revisoes' },
    (cards.data ?? 0) > 0 && { icon: Layers, text: `${cards.data} flashcard(s) para revisar.`, to: '/flashcards/revisar?modo=vencidos' },
    (blocks.data ?? 0) > 0 && { icon: CalendarClock, text: `${blocks.data} bloco(s) do cronograma pendente(s) hoje.`, to: '/cronograma' },
  ].filter(Boolean) as Array<{ icon: typeof Bell; text: string; to: string }>

  return (
    <div className="relative">
      <IconButton label={`Notificações${items.length ? ` (${items.length})` : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <span className="relative">
          <Bell className="size-5" />
          {items.length > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-bg bg-danger" aria-hidden />}
        </span>
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-fade-in fixed inset-x-4 top-16 z-50 rounded-xl border border-line bg-bg p-2 shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80">
            <p className="px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">Notificações</p>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Tudo em dia por aqui.</p>
            ) : (
              <ul>
                {items.map((it) => (
                  <li key={it.to}>
                    <Link to={it.to} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface">
                      <it.icon className="mt-0.5 size-4 shrink-0 text-accent-strong" />
                      <span>{it.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
