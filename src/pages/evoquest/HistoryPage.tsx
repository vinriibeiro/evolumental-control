import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, PageHeader, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { useSettings } from '@/hooks/useSettings'
import { formatClock, formatDateTime, formatDuration } from '@/lib/time'
import { SUBJECTS } from '@/game/catalog'
import { challengeStates, subjectMastery } from '@/game/engine/progress'
import { MODE_LABELS, useAllContent, useGameData } from '@/game/useGame'
import { BackLink } from './parts'

export default function HistoryPage() {
  const settings = useSettings()
  const data = useGameData()
  const contents = useAllContent()

  const stats = useMemo(() => {
    if (!contents.data) return []
    const states = challengeStates(data.answers)
    return SUBJECTS.map((s) => {
      const content = contents.data.find((c) => c.subjectId === s.id)!
      const answers = data.answers.filter((a) => a.subject_id === s.id)
      const sessions = data.sessions.filter((x) => x.subject_id === s.id)
      const avgSec = answers.length ? answers.reduce((t, a) => t + a.seconds, 0) / answers.length : 0
      return {
        meta: s,
        answered: answers.length,
        accuracy: answers.length ? Math.round((answers.filter((a) => a.correct).length / answers.length) * 100) : null,
        mastery: subjectMastery(content, answers, states),
        seconds: sessions.reduce((t, x) => t + x.active_seconds, 0),
        avgSec,
        xp: answers.reduce((t, a) => t + a.xp, 0),
      }
    })
  }, [contents.data, data.answers, data.sessions])

  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (data.isPending || contents.isPending) return <Spinner />

  const sessions = [...data.sessions].filter((s) => s.answered > 0).sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 50)

  return (
    <div>
      <BackLink to="/evoquest/treino">Treino do EvoQuest</BackLink>
      <PageHeader title="Histórico e estatísticas" description="Desempenho por disciplina e as últimas partidas." />

      <Card>
        <CardHeader title="Por disciplina" description="Domínio considera cobertura, acerto recente e retenção ao longo das revisões." />
        <div className="scroll-thin overflow-x-auto p-4">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 font-medium">Disciplina</th>
                <th className="py-1.5 font-medium">Domínio</th>
                <th className="py-1.5 text-right font-medium">Respostas</th>
                <th className="py-1.5 text-right font-medium">Acerto</th>
                <th className="py-1.5 text-right font-medium">Tempo médio</th>
                <th className="py-1.5 text-right font-medium">Tempo ativo</th>
                <th className="py-1.5 text-right font-medium">XP</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.meta.id} className="border-t border-line">
                  <td className="py-2 pr-2 text-ink">
                    <Link to={`/evoquest/${s.meta.id}`} className="hover:underline">
                      {s.meta.icon} {s.meta.name}
                    </Link>
                  </td>
                  <td className="w-40 py-2 pr-3">
                    <Progress value={s.mastery.value} color={s.meta.color} label={`Domínio em ${s.meta.name}`} />
                    <span className="text-xs text-muted">
                      {s.mastery.label} · {s.mastery.value}%
                    </span>
                  </td>
                  <td className="tabular py-2 text-right">{s.answered}</td>
                  <td className="tabular py-2 text-right">{s.accuracy == null ? '—' : `${s.accuracy}%`}</td>
                  <td className="tabular py-2 text-right">{s.avgSec ? `${Math.round(s.avgSec)} s` : '—'}</td>
                  <td className="tabular py-2 text-right">{s.seconds ? formatDuration(s.seconds) : '—'}</td>
                  <td className="tabular py-2 text-right">{s.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-ink">Últimas partidas</h2>
      {sessions.length === 0 ? (
        <EmptyState title="Nenhuma partida ainda" description="Suas partidas aparecem aqui com acertos, XP e tempo." action={<Link to="/evoquest/treino" className="underline">Começar a jogar</Link>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const meta = SUBJECTS.find((x) => x.id === s.subject_id)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 text-ink">
                  {meta?.icon} {meta?.name} · {MODE_LABELS[s.mode]}
                  <span className="block text-xs text-muted">{formatDateTime(new Date(s.started_at).getTime(), settings.timezone, settings.hourFormat)}</span>
                </span>
                <span className="tabular text-muted">
                  {s.correct}/{s.answered} acertos
                </span>
                <span className="tabular text-muted">combo {s.best_combo}</span>
                <span className="tabular text-muted">{formatClock(s.active_seconds)}</span>
                <span className="tabular font-semibold text-ink">+{s.xp} XP</span>
                {s.status === 'active' && s.queue.length > 0 && (
                  <Link to={`/evoquest/jogar?sessao=${s.id}`} className="text-xs font-medium text-accent-strong underline">
                    Retomar
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
