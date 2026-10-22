import { useMemo, useState } from 'react'
import { Gift, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Progress, Tabs } from '@/components/ui/layout'
import { ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { SUBJECTS } from '@/game/catalog'
import type { DataBackend } from '@/lib/data/types'
import { missionViews, useAllContent, useGameData, useGameMutation, useGameSettings, useMemoSummary, type MissionView } from '@/game/useGame'
import { BackLink } from './parts'

type Tab = 'daily' | 'weekly' | 'achievements'

const claim = (b: DataBackend, m: MissionView) => b.gameClaim({ rule: m.rule.key, period: m.period, param: m.param })

export default function MissionsPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const { settings } = useGameSettings()
  const data = useGameData()
  const contents = useAllContent()
  const summary = useMemoSummary(data, settings.timezone)
  const toast = useToast()
  const mutation = useGameMutation(claim, ['game_rewards'])
  const views = useMemo(() => (contents.data ? missionViews(data, contents.data, settings.timezone, summary.claimed) : null), [contents.data, data, settings.timezone, summary.claimed])

  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (contents.isError) return <ErrorState error={contents.error} onRetry={() => contents.refetch()} />
  if (!views || data.isPending) return <Spinner />

  const doClaim = async (m: MissionView) => {
    try {
      const r = await mutation.mutateAsync(m)
      if (r.applied) toast.success(`+${r.xp} XP e +${r.coins} moedas!`)
      else toast.info('Esta recompensa já tinha sido resgatada.')
    } catch (e) {
      toast.error(e)
    }
  }

  const list = views[tab]
  const unlocked = views.achievements.filter((a) => a.claimed).length
  return (
    <div>
      <BackLink to="/evoquest/treino">Treino do EvoQuest</BackLink>
      <PageHeader title="Missões e conquistas" description="Toda meta é conferida pelo servidor a partir do que você realmente respondeu. Resgate quando concluir." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'daily', label: 'Diárias' },
          { value: 'weekly', label: 'Semanais' },
          { value: 'achievements', label: `Conquistas (${unlocked}/${views.achievements.length})` },
        ]}
      />
      <ul className={cn('grid gap-3', tab === 'achievements' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-3')}>
        {list.map((m) => (
          <li key={m.source}>
            <Card className={cn('flex h-full flex-col gap-2 p-4', m.claimed && 'border-success/50 bg-success/5')}>
              <div className="flex items-start gap-3">
                <span className={cn('text-2xl', tab === 'achievements' && !m.claimed && !m.done && 'grayscale')} aria-hidden>
                  {m.rule.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{m.rule.title}</p>
                  {tab === 'achievements' && <p className="text-xs text-muted">{m.rule.description}</p>}
                  {m.param && <p className="text-xs text-muted">Disciplina: {SUBJECTS.find((s) => s.id === m.param)?.name}</p>}
                </div>
              </div>
              <Progress value={(Math.min(m.progress, m.rule.target) / m.rule.target) * 100} label={m.rule.title} color={m.done ? 'var(--success)' : undefined} />
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="tabular text-xs text-muted">
                  {Math.min(m.progress, m.rule.target)}/{m.rule.target} · +{m.rule.xp} XP · +{m.rule.coins} 🪙
                </span>
                {m.claimed ? (
                  <span className="text-xs font-semibold text-success">Resgatada ✓</span>
                ) : m.done ? (
                  <Button size="sm" variant="primary" icon={<Gift className="size-4" />} onClick={() => doClaim(m)} loading={mutation.isPending && mutation.variables?.source === m.source}>
                    Resgatar
                  </Button>
                ) : (
                  <Lock className="size-4 text-muted" aria-label="Ainda não concluída" />
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {tab !== 'achievements' && <p className="mt-4 text-xs text-muted">Até 3 missões por dia e 3 por semana. Missões não concluídas simplesmente se renovam — nada é perdido.</p>}
    </div>
  )
}
