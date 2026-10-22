import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Award, Brain, Map as MapIcon, FlaskConical, History, Layers, Play, ShoppingBag, Swords, Target, Timer } from 'lucide-react'
import { Card, CardHeader, PageHeader, Progress } from '@/components/ui/layout'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { useProfile } from '@/hooks/useSettings'
import { formatDuration } from '@/lib/time'
import { SUBJECTS } from '@/game/catalog'
import { challengeStates, isDue, subjectMastery } from '@/game/engine/progress'
import { MODE_LABELS, missionViews, resumable, useAllContent, useGameData, useGameSettings, useMemoSummary } from '@/game/useGame'
import { GoalRing, PlayerCard } from './parts'

export default function EvoQuestHome() {
  const { game, settings } = useGameSettings()
  const profile = useProfile()
  const data = useGameData()
  const contents = useAllContent()
  const summary = useMemoSummary(data, settings.timezone)

  const perSubject = useMemo(() => {
    if (!contents.data) return null
    const states = challengeStates(data.answers)
    const now = Date.now()
    return contents.data.map((c) => {
      const ids = new Set(c.units.flatMap((u) => u.challenges.map((x) => x.id)))
      const mine = data.answers.filter((a) => ids.has(a.challenge_id))
      return {
        id: c.subjectId,
        mastery: subjectMastery(c, mine, states),
        due: [...ids].filter((id) => isDue(states.get(id), now)).length,
        total: ids.size,
      }
    })
  }, [contents.data, data.answers])

  const missions = useMemo(() => (contents.data ? missionViews(data, contents.data, settings.timezone, summary.claimed) : null), [contents.data, data, settings.timezone, summary.claimed])
  const resume = resumable(data.sessions, data.answers).slice(0, 2)
  const totalActive = data.sessions.reduce((s, x) => s + x.active_seconds, 0)
  const totalDue = perSubject?.reduce((s, x) => s + x.due, 0) ?? 0
  const claimable = missions ? [...missions.daily, ...missions.weekly, ...missions.achievements].filter((m) => m.done && !m.claimed).length : 0

  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (contents.isError) return <ErrorState error={contents.error} onRetry={() => contents.refetch()} />

  return (
    <div>
      <PageHeader
        title="Treino do EvoQuest"
        description="Desafios rápidos, revisão inteligente e laboratórios livres. A aventura de verdade acontece no Mundo Evolumental."
        actions={
          <Link to="/evoquest" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brown px-4 text-sm font-semibold text-wheat hover:opacity-90 dark:bg-wheat dark:text-brown">
            <MapIcon className="size-4" /> Entrar no mundo
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {data.isPending ? <Skeleton className="h-44 rounded-2xl" /> : <PlayerCard summary={summary} game={game} name={profile.data?.display_name ?? 'Estudante'} />}

        <Card className="flex items-center gap-4 p-4">
          <GoalRing value={summary.todayMinutes} goal={game.dailyMinutes} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Meta de hoje</p>
            <p className="text-xs text-muted">
              {summary.todayMinutes >= game.dailyMinutes ? 'Meta cumprida. Ótimo trabalho!' : `Faltam ${game.dailyMinutes - summary.todayMinutes} min de jogo ativo.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/evoquest/revisao" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
                <Brain className="size-4" aria-hidden /> Revisar {totalDue > 0 && <span className="tabular rounded-full bg-bg/60 px-1.5 text-xs">{totalDue}</span>}
              </Link>
              <Link to="/evoquest/missoes" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-surface">
                <Target className="size-4" aria-hidden /> Missões {claimable > 0 && <span className="tabular rounded-full bg-success px-1.5 text-xs text-white">{claimable}</span>}
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {resume.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Continuar de onde parou</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {resume.map(({ session, left, done }) => {
              const meta = SUBJECTS.find((s) => s.id === session.subject_id)
              return (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                  <span className="text-sm text-ink">
                    {meta?.icon} {meta?.name} · {MODE_LABELS[session.mode]} <span className="text-muted">· {done} feitos, {left} restantes</span>
                  </span>
                  <Link to={`/evoquest/jogar?sessao=${session.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brown px-3 text-sm font-medium text-wheat dark:bg-wheat dark:text-brown">
                    <Play className="size-4" aria-hidden /> Retomar
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {missions && (
        <Card className="mt-4">
          <CardHeader title="Missões de hoje" description="Renovam todos os dias; as semanais, às segundas." action={<Link to="/evoquest/missoes" className="text-xs font-medium text-accent-strong underline underline-offset-2">Ver todas</Link>} />
          <ul className="grid gap-2 p-4 sm:grid-cols-3">
            {missions.daily.map((m) => (
              <li key={m.source} className="rounded-lg border border-line p-3">
                <p className="text-sm text-ink">
                  <span aria-hidden>{m.rule.icon}</span> {m.rule.title}
                  {m.param && <span className="text-muted"> · {SUBJECTS.find((s) => s.id === m.param)?.name}</span>}
                </p>
                <Progress value={(Math.min(m.progress, m.rule.target) / m.rule.target) * 100} className="mt-2" label={m.rule.title} color={m.done ? 'var(--success)' : undefined} />
                <p className="tabular mt-1 text-xs text-muted">
                  {Math.min(m.progress, m.rule.target)}/{m.rule.target} {m.claimed ? '· resgatada ✓' : m.done ? '· pronta para resgatar' : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mt-6 mb-3 text-sm font-semibold text-ink">Disciplinas</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SUBJECTS.map((s) => {
          const st = perSubject?.find((x) => x.id === s.id)
          return (
            <Link key={s.id} to={`/evoquest/${s.id}`} className="group flex flex-col gap-2 rounded-xl border border-line bg-bg p-4 transition-colors hover:border-accent-strong hover:bg-surface">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)` }} aria-hidden>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-xs text-muted">{s.level}</p>
                </div>
              </div>
              <p className="line-clamp-2 text-xs text-muted">{s.description}</p>
              {st ? (
                <>
                  <Progress value={st.mastery.value} color={s.color} label={`Domínio em ${s.name}`} />
                  <p className="text-xs text-muted">
                    {st.mastery.label} · {st.mastery.value}%{st.due > 0 && <span className="text-ink"> · {st.due} para revisar</span>}
                  </p>
                </>
              ) : (
                <Skeleton className="h-6" />
              )}
            </Link>
          )
        })}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-semibold text-ink">Mais modos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { to: '/evoquest/relogio', icon: Timer, label: 'Contra o relógio', hint: '90 segundos' },
          { to: '/evoquest/laboratorio', icon: FlaskConical, label: 'Laboratório', hint: 'SQL, Python, DAX, M' },
          { to: '/evoquest/cartoes', icon: Layers, label: 'Flashcards', hint: 'Seus baralhos' },
          { to: '/evoquest/missoes', icon: Award, label: 'Conquistas', hint: 'Missões e medalhas' },
          { to: '/evoquest/perfil', icon: ShoppingBag, label: 'Perfil e loja', hint: 'Avatares e títulos' },
          { to: '/evoquest/historico', icon: History, label: 'Histórico', hint: 'Partidas e estatísticas' },
        ].map((m) => (
          <Link key={m.to} to={m.to} className="flex flex-col gap-1 rounded-xl border border-line bg-bg p-3 hover:border-accent-strong hover:bg-surface">
            <m.icon className="size-5 text-accent-strong" aria-hidden />
            <span className="text-sm font-medium text-ink">{m.label}</span>
            <span className="text-xs text-muted">{m.hint}</span>
          </Link>
        ))}
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-3 p-4 text-xs text-muted">
        <Swords className="size-4 text-accent-strong" aria-hidden />
        <span>
          Sem anúncios, sem compras: moedas só servem para itens cosméticos. Sequências não punem — um dia de folga não apaga nada.
          {summary.bestStreak > 1 && ` Sua maior sequência: ${summary.bestStreak} dias.`}
          {totalActive >= 60 && ` Tempo total ativo: ${formatDuration(totalActive)}.`}
        </span>
      </Card>
    </div>
  )
}
