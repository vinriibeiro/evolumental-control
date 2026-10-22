import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Coins, Flame } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { addDays, formatDayKey, todayKey, weekday } from '@/lib/time'
import { levelTitle } from '@/game/engine/rules'
import { shopItem } from '@/game/engine/rewards'
import type { PlayerSummary } from '@/game/useGame'
import type { EvoQuestSettings } from '@/types/db'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  )
}

export const avatarOf = (g: EvoQuestSettings) => (g.avatar ? (shopItem(g.avatar)?.value ?? '🌱') : '🌱')
export const titleOf = (g: EvoQuestSettings, level: number) => (g.title ? (shopItem(g.title)?.value ?? levelTitle(level)) : levelTitle(level))

/** Cartão do jogador: avatar, nível, XP, moedas e sequência. */
export function PlayerCard({ summary, game, name, compact }: { summary: PlayerSummary; game: EvoQuestSettings; name: string; compact?: boolean }) {
  const { level } = summary
  return (
    <div className="rounded-2xl bg-brown p-4 text-wheat shadow-sm sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-wheat/15 text-3xl ring-2 ring-wheat/40 sm:size-16 sm:text-4xl" aria-hidden>
          {avatarOf(game)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm opacity-80">{name}</p>
          <p className="truncate text-lg font-bold sm:text-xl">
            Nível {level.level} · {titleOf(game, level.level)}
          </p>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-wheat/20" role="progressbar" aria-label="XP para o próximo nível" aria-valuemin={0} aria-valuemax={level.need} aria-valuenow={level.into}>
            <div className="h-full rounded-full bg-wheat transition-[width] duration-700" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
          <p className="tabular mt-1 text-xs opacity-80">
            {level.into} / {level.need} XP para o nível {level.level + 1} · {summary.xp} XP no total
          </p>
        </div>
      </div>
      {!compact && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Flame className="size-4" />} label="Sequência" value={`${summary.streak} ${summary.streak === 1 ? 'dia' : 'dias'}`} />
          <Stat icon={<Coins className="size-4" />} label="Moedas" value={String(summary.coins)} />
          <Stat icon={<span aria-hidden>✅</span>} label="Hoje" value={`${summary.todayAnswers} resp.`} />
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-wheat/10 px-2 py-2">
      <p className="flex items-center justify-center gap-1 text-xs opacity-80">
        {icon}
        {label}
      </p>
      <p className="tabular text-base font-semibold">{value}</p>
    </div>
  )
}

/** Anel de meta diária em minutos. */
export function GoalRing({ value, goal, size = 72 }: { value: number; goal: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(1, value / Math.max(goal, 1))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value} de ${goal} minutos hoje`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-strong)" strokeWidth={7} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="tabular absolute inset-0 flex flex-col items-center justify-center text-xs leading-tight text-ink">
        <strong className="text-sm">{value}</strong>/{goal} min
      </span>
    </div>
  )
}

/**
 * Calendário de sequência (últimas semanas). Não pune: dias sem estudo só
 * ficam em branco, sem mensagens negativas.
 */
export function StreakCalendar({ days, tz, weeks = 12 }: { days: string[]; tz: string; weeks?: number }) {
  const set = new Set(days)
  const today = todayKey(tz)
  const end = addDays(today, 6 - ((weekday(today) + 6) % 7))
  const start = addDays(end, -(weeks * 7) + 1)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  return (
    <div className="scroll-thin overflow-x-auto">
      <div className="inline-flex gap-1" role="img" aria-label={`${days.length} dias com atividade nas últimas ${weeks} semanas`}>
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((d) => (
              <span
                key={d}
                title={formatDayKey(d, 'long')}
                className={cn('size-3.5 rounded-sm sm:size-4', d > today ? 'bg-transparent' : set.has(d) ? 'bg-accent-strong' : 'bg-surface-2', d === today && 'ring-2 ring-ink/40')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const MINUTES = [3, 5, 10, 15]

/** Escolha da duração de uma partida rápida (inclui tempo personalizado). */
export function QuickStart({ subjectId, label = 'Partida rápida', className }: { subjectId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('20')
  const navigate = useNavigate()
  const go = (min: number) => navigate(`/evoquest/jogar?s=${subjectId}&m=quick&min=${min}`)
  return (
    <>
      <Button variant="primary" size="lg" onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Quanto tempo você tem?" size="sm">
        <div className="grid grid-cols-2 gap-2">
          {MINUTES.map((m) => (
            <button key={m} type="button" onClick={() => go(m)} className="h-16 rounded-xl border-2 border-line text-lg font-semibold text-ink hover:border-accent-strong hover:bg-accent/15">
              {m} min
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(custom)
            if (n >= 1 && n <= 120) go(Math.round(n))
          }}
        >
          <label className="text-sm text-muted" htmlFor="eq-custom-min">
            Personalizado
          </label>
          <input id="eq-custom-min" type="number" min={1} max={120} value={custom} onChange={(e) => setCustom(e.target.value)} className="h-10 w-20 rounded-lg border border-line bg-bg px-2 text-sm text-ink" />
          <span className="text-sm text-muted">min</span>
          <Button type="submit" className="ml-auto">
            Jogar
          </Button>
        </form>
      </Modal>
    </>
  )
}
