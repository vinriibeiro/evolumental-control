import { Link } from 'react-router-dom'
import { Gamepad2, Play } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { Skeleton } from '@/components/ui/feedback'
import { resumable, useGameData, useGameSettings, useMemoSummary } from '@/game/useGame'
import { GoalRing, avatarOf, titleOf } from './parts'

/** Cartão do EvoQuest na Visão geral. */
export function EvoQuestCard() {
  const { game, settings } = useGameSettings()
  const data = useGameData()
  const summary = useMemoSummary(data, settings.timezone)
  if (data.isError) return null
  if (data.isPending) return <Skeleton className="mt-4 h-28 rounded-xl" />
  const resume = resumable(data.sessions, data.answers)[0]
  return (
    <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brown text-2xl dark:bg-wheat" aria-hidden>
        {avatarOf(game)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-strong uppercase">
          <Gamepad2 className="size-3.5" aria-hidden /> EvoQuest
        </p>
        <p className="truncate font-semibold text-ink">
          Nível {summary.level.level} · {titleOf(game, summary.level.level)}
        </p>
        <p className="tabular text-xs text-muted">
          {summary.xp} XP · 🔥 {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'} · 🪙 {summary.coins}
        </p>
      </div>
      <GoalRing value={summary.todayMinutes} goal={game.dailyMinutes} size={60} />
      <Link
        to={resume ? `/evoquest/jogar?sessao=${resume.session.id}` : '/evoquest'}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong sm:w-auto"
      >
        <Play className="size-4" aria-hidden /> {resume ? 'Retomar partida' : 'Jogar'}
      </Link>
    </Card>
  )
}
