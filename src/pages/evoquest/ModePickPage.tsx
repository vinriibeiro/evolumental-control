import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/layout'
import { ErrorState, Spinner } from '@/components/ui/feedback'
import { SUBJECTS } from '@/game/catalog'
import { challengeStates, isDue } from '@/game/engine/progress'
import { useAllContent, useGameData } from '@/game/useGame'
import { BackLink } from './parts'

/** Escolha da disciplina para Revisão inteligente ou Contra o relógio. */
export default function ModePickPage({ mode }: { mode: 'review' | 'time_attack' }) {
  const data = useGameData()
  const contents = useAllContent()
  const due = useMemo(() => {
    if (!contents.data) return new Map<string, number>()
    const states = challengeStates(data.answers)
    const now = Date.now()
    return new Map(contents.data.map((c) => [c.subjectId, c.units.flatMap((u) => u.challenges).filter((x) => isDue(states.get(x.id), now)).length]))
  }, [contents.data, data.answers])

  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (contents.isPending || data.isPending) return <Spinner />

  const review = mode === 'review'
  const list = review ? [...SUBJECTS].sort((a, b) => (due.get(b.id) ?? 0) - (due.get(a.id) ?? 0)) : SUBJECTS
  return (
    <div>
      <BackLink to="/evoquest/treino">Treino do EvoQuest</BackLink>
      <PageHeader
        title={review ? 'Revisão inteligente' : 'Contra o relógio'}
        description={
          review
            ? 'Os desafios voltam em intervalos crescentes (1, 3, 7, 16 e 35 dias) — e os errados, logo depois. Revisar no momento certo é o que fixa o conteúdo.'
            : '90 segundos, perguntas rápidas do conteúdo já liberado. Errar não tira pontos: só acaba o tempo.'
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((s) => {
          const n = due.get(s.id) ?? 0
          return (
            <Link
              key={s.id}
              to={`/evoquest/jogar?s=${s.id}&m=${mode}&min=10`}
              className="flex items-center gap-3 rounded-xl border border-line bg-bg p-4 hover:border-accent-strong hover:bg-surface aria-disabled:opacity-60"
              aria-disabled={review && n === 0}
            >
              <span className="text-2xl" aria-hidden>
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{s.name}</span>
                <span className="block text-xs text-muted">{review ? (n > 0 ? `${n} para revisar` : 'Em dia') : s.level}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
