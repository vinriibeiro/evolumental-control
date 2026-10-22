import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, Brain, Crown, FlaskConical, Headphones, Lock, Map as MapIcon, Swords, Timer } from 'lucide-react'
import { Card, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { Select } from '@/components/ui/Field'
import { useSubjects } from '@/hooks/domain'
import { cn } from '@/lib/cn'
import { subjectMeta } from '@/game/catalog'
import { LAB_TYPES } from '@/game/engine/grade'
import { challengeStates, isDue, subjectMastery, topicMastery, unitMastery, unlockedUnits } from '@/game/engine/progress'
import { useGameData, useGameSettings, useSubjectContent } from '@/game/useGame'
import { BackLink, QuickStart } from './parts'

/** O chefe da unidade é liberado com domínio mínimo — sem bloqueio permanente. */
export const BOSS_MIN_MASTERY = 25

export default function SubjectPage() {
  const { subject = '' } = useParams()
  const meta = subjectMeta(subject)
  const content = useSubjectContent(subject)
  const data = useGameData()
  const { game, save } = useGameSettings()
  const subjects = useSubjects()

  const view = useMemo(() => {
    if (!content.data) return null
    const ids = new Set(content.data.units.flatMap((u) => u.challenges.map((c) => c.id)))
    const answers = data.answers.filter((a) => ids.has(a.challenge_id))
    const states = challengeStates(answers)
    const unlocked = unlockedUnits(content.data, answers, states)
    const now = Date.now()
    return {
      mastery: subjectMastery(content.data, answers, states),
      unlocked,
      due: [...ids].filter((id) => isDue(states.get(id), now)).length,
      units: content.data.units.map((u) => ({
        unit: u,
        mastery: unitMastery(u, answers, states),
        topics: topicMastery(u, answers, states),
        bossWon: u.challenges.some((c) => c.boss && (states.get(c.id)?.correct ?? 0) > 0),
      })),
      labs: content.data.units.flatMap((u) => u.challenges).filter((c) => LAB_TYPES.includes(c.type)).length,
    }
  }, [content.data, data.answers])

  if (!meta) return <EmptyState title="Disciplina não encontrada" action={<Link to="/evoquest" className="underline">Voltar</Link>} />
  if (content.isError) return <ErrorState error={content.error} onRetry={() => content.refetch()} />
  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (!view || data.isPending) return <Spinner label="Carregando o mapa…" />

  const linked = game.links[subject] ?? ''

  return (
    <div>
      <BackLink to="/evoquest">EvoQuest</BackLink>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `color-mix(in srgb, ${meta.color} 18%, transparent)` }} aria-hidden>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{meta.name}</h1>
          <p className="text-sm text-muted">
            {meta.level} · Domínio {view.mastery.value}% ({view.mastery.label})
          </p>
          <Progress value={view.mastery.value} color={meta.color} className="mt-2 max-w-sm" label={`Domínio em ${meta.name}`} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <QuickStart subjectId={subject} className="col-span-2 sm:col-span-1" />
        <Link to={`/evoquest/jogar?s=${subject}&m=review&min=10`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
          <Brain className="size-4" aria-hidden /> Revisar{view.due > 0 && <span className="tabular rounded-full bg-accent/40 px-1.5 text-xs">{view.due}</span>}
        </Link>
        <Link to={`/evoquest/jogar?s=${subject}&m=time_attack`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
          <Timer className="size-4" aria-hidden /> Contra o relógio
        </Link>
        {meta.capabilities.includes('speech') && (
          <Link to={`/evoquest/jogar?s=${subject}&m=quick&min=10&foco=escuta`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
            <Headphones className="size-4" aria-hidden /> Treino de escuta
          </Link>
        )}
        <Link to={`/evoquest/laboratorio?s=${subject}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
          <FlaskConical className="size-4" aria-hidden /> {view.labs > 0 ? 'Laboratório' : 'Casos práticos'}
        </Link>
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <MapIcon className="size-4 text-accent-strong" aria-hidden /> Trilha
      </h2>
      <ol className="relative flex flex-col gap-4 border-l-2 border-dashed border-line pl-5">
        {view.units.map(({ unit, mastery, topics, bossWon }, i) => {
          const open = view.unlocked.has(unit.id)
          const bossOpen = open && mastery.value >= BOSS_MIN_MASTERY
          return (
            <li key={unit.id} className="relative">
              <span
                className={cn('absolute top-4 -left-[33px] flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold', open ? 'border-accent-strong bg-accent text-accent-ink' : 'border-line bg-surface text-muted')}
                aria-hidden
              >
                {open ? i + 1 : <Lock className="size-3" />}
              </span>
              <Card className={cn('p-4', !open && 'opacity-70')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink">
                      Unidade {i + 1}: {unit.title}
                    </h3>
                    <p className="text-sm text-muted">{unit.summary}</p>
                  </div>
                  <span className="tabular text-sm font-semibold text-ink">{mastery.value}%</span>
                </div>
                <Progress value={mastery.value} color={meta.color} className="mt-2" label={`Domínio da unidade ${i + 1}`} />
                {!open && <p className="mt-2 text-xs text-muted">Libere com 40% de domínio na unidade anterior — ou vencendo o chefe dela.</p>}
                {open && (
                  <>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <li key={t.id} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink" title={`${t.mastery.label}: ${t.mastery.value}%`}>
                          {t.name} <span className="tabular text-muted">{t.mastery.value}%</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Link to={`/evoquest/${subject}/licao/${unit.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-surface">
                        <BookOpen className="size-4" aria-hidden /> Lição
                      </Link>
                      <Link to={`/evoquest/jogar?s=${subject}&m=trail&u=${unit.id}&min=8`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:bg-accent-strong">
                        <Swords className="size-4" aria-hidden /> Missão
                      </Link>
                      {bossOpen ? (
                        <Link to={`/evoquest/jogar?s=${subject}&m=boss&u=${unit.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brown text-sm font-semibold text-wheat dark:bg-wheat dark:text-brown">
                          <Crown className="size-4" aria-hidden /> {bossWon ? 'Chefe vencido ✓' : 'Chefe'}
                        </Link>
                      ) : (
                        <span className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-xs text-muted" title={`Chegue a ${BOSS_MIN_MASTERY}% de domínio na unidade`}>
                          <Lock className="size-4" aria-hidden /> Chefe ({BOSS_MIN_MASTERY}%)
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </li>
          )
        })}
      </ol>

      <Card className="mt-6 p-4">
        <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3" htmlFor="eq-link">
          <span className="text-sm text-ink">Matéria do seu planejamento</span>
          <Select
            id="eq-link"
            value={linked}
            onChange={(e) => save({ links: { ...game.links, [subject]: e.target.value || null } })}
            className="h-10 sm:max-w-xs"
          >
            <option value="">Nenhuma (tempo sem matéria)</option>
            {(subjects.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <p className="mt-1.5 text-xs text-muted">
          O tempo ativo das partidas entra nessa matéria (atividade “Questões”), sem duplicar o tempo do cronômetro.
          {!linked && suggest(subjects.data ?? [], meta.matchNames) && ` Sugestão: “${suggest(subjects.data ?? [], meta.matchNames)!.name}”.`}
        </p>
      </Card>
    </div>
  )
}

function suggest<T extends { name: string }>(subjects: T[], names: string[]): T | undefined {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return subjects.find((s) => names.some((n) => norm(s.name).includes(norm(n))))
}
