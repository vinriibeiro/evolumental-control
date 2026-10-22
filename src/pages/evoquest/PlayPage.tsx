import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Flag, Heart, Lightbulb, RotateCcw, Timer, X, XCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/time'
import type { GameMode, GameSession } from '@/types/db'
import { findChallenge, subjectMeta } from '@/game/catalog'
import { describeAnswer, grade } from '@/game/engine/grade'
import { adaptNext, buildQueue, challengeStates, subjectMastery } from '@/game/engine/progress'
import { comboMultiplier, levelFromXp } from '@/game/engine/rules'
import { playSfx } from '@/game/speech'
import type { Challenge, Response, SubjectContent } from '@/game/types'
import { MODE_LABELS, finishGame, gameSettings, startGame, submitAnswer, useGameData, useGameMutation, useSubjectContent } from '@/game/useGame'
import { ChallengeView, DictationDiff } from './ChallengeView'

const TIME_ATTACK_SECONDS = 90
const BOSS_LIVES = 3

export default function PlayPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('sessao')
  return sessionId ? <Runner key={sessionId} sessionId={sessionId} /> : <Starter />
}

// ── Início: monta a fila adaptativa e cria a partida no servidor ─────────
function Starter() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const subject = params.get('s') ?? ''
  const mode = (params.get('m') ?? 'quick') as GameMode
  const unitId = params.get('u')
  const minutes = Math.min(120, Math.max(1, Number(params.get('min')) || 5))
  const listening = params.get('foco') === 'escuta'
  const content = useSubjectContent(subject)
  const data = useGameData()
  const start = useGameMutation(startGame)
  const started = useRef(false)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (started.current || !content.data || data.isPending || data.isError) return
    if (mode === 'cards') return
    started.current = true
    const queue = buildQueue({ content: content.data, answers: data.answers, mode, minutes, unitId, now: Date.now(), types: listening ? ['listen', 'dictation'] : undefined })
    if (queue.length === 0) return setEmpty(true)
    start
      .mutateAsync({ subjectId: subject, unitId, mode, queue: queue.map((c) => c.id), plannedSeconds: mode === 'time_attack' ? TIME_ATTACK_SECONDS : minutes * 60 })
      .then((s) => navigate(`/evoquest/jogar?sessao=${s.id}`, { replace: true }))
      .catch(() => (started.current = false))
  }, [content.data, data.isPending, data.isError]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!subjectMeta(subject)) return <ErrorState error={new Error('Disciplina não encontrada.')} />
  if (content.isError) return <ErrorState error={content.error} onRetry={() => content.refetch()} />
  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (start.isError) return <ErrorState error={start.error} onRetry={() => start.reset()} />
  if (empty)
    return (
      <EmptyState
        icon={<CheckCircle2 className="size-8" />}
        title={mode === 'review' ? 'Nada para revisar agora' : 'Sem desafios disponíveis'}
        description={mode === 'review' ? 'Você está em dia! Os desafios voltam para revisão em intervalos crescentes.' : 'Conclua as unidades anteriores para liberar mais conteúdo.'}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => navigate(`/evoquest/jogar?s=${subject}&m=quick&min=5`, { replace: true })}>
              Partida rápida
            </Button>
            <Link to={`/evoquest/${subject}`} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
              Voltar ao mapa
            </Link>
          </div>
        }
      />
    )
  return <Spinner label="Montando sua partida…" className="min-h-[50vh]" />
}

// ── Tempo ativo: só conta com a aba visível e interação recente ──────────
function useActiveSeconds(sessionId: string, running: boolean) {
  const key = `evoquest:active:${sessionId}`
  const [seconds, setSeconds] = useState(() => {
    try {
      return Number(sessionStorage.getItem(key)) || 0
    } catch {
      return 0
    }
  })
  const last = useRef(Date.now())
  useEffect(() => {
    const mark = () => (last.current = Date.now())
    window.addEventListener('pointerdown', mark)
    window.addEventListener('keydown', mark)
    return () => {
      window.removeEventListener('pointerdown', mark)
      window.removeEventListener('keydown', mark)
    }
  }, [])
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current > 120_000) return
      setSeconds((s) => {
        const n = s + 1
        try {
          sessionStorage.setItem(key, String(n))
        } catch {
          /* armazenamento indisponível: segue só em memória */
        }
        return n
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, key])
  return seconds
}

interface Played {
  challenge: Challenge
  correct: boolean
  xp: number
  coins: number
  combo: number
}

// ── Partida ──────────────────────────────────────────────────────────────
function Runner({ sessionId }: { sessionId: string }) {
  const data = useGameData()
  const session = data.sessions.find((s) => s.id === sessionId)
  const content = useSubjectContent(session?.subject_id)
  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (data.isPending || (session && content.isPending)) return <Spinner label="Carregando partida…" className="min-h-[50vh]" />
  if (!session) return <EmptyState title="Partida não encontrada" description="Ela pode ter sido apagada." action={<Link className="underline" to="/evoquest">Voltar ao EvoQuest</Link>} />
  if (content.isError || !content.data) return <ErrorState error={content.error} onRetry={() => content.refetch()} />
  return <Game session={session} content={content.data} answers={data.answers} />
}

function Game({ session, content, answers }: { session: GameSession; content: SubjectContent; answers: ReturnType<typeof useGameData>['answers'] }) {
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const settings = useSettings()
  const game = gameSettings(settings)
  const meta = subjectMeta(session.subject_id)!
  const finish = useGameMutation(finishGame, ['game_sessions', 'game_answers', 'game_rewards', 'study_sessions'])
  const submit = useGameMutation(submitAnswer)

  // Estado inicial: fila planejada menos o que já foi respondido (retomada).
  const initial = useMemo(() => {
    const mine = answers.filter((a) => a.session_id === session.id).sort((a, b) => a.answered_at.localeCompare(b.answered_at))
    const played: Played[] = mine.flatMap((a) => {
      const f = findChallenge(content, a.challenge_id)
      return f ? [{ challenge: f.challenge, correct: a.correct, xp: a.xp, coins: a.coins, combo: a.combo }] : []
    })
    const done = new Set(mine.map((a) => a.challenge_id))
    const queue = session.queue.filter((id) => !done.has(id)).flatMap((id) => findChallenge(content, id)?.challenge ?? [])
    const before = answers.filter((a) => a.session_id !== session.id)
    return { played, queue, before }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [queue, setQueue] = useState<Challenge[]>(initial.queue)
  const [played, setPlayed] = useState<Played[]>(initial.played)
  const [response, setResponse] = useState<Response | null>(null)
  const [usedHint, setUsedHint] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<Played | null>(null)
  const [answered, setAnswered] = useState<Response | null>(null)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof finishGame>> | null>(session.status !== 'active' ? { session, time: 'disabled' } : null)
  const [shownAt, setShownAt] = useState(Date.now())
  // Semente do embaralhamento: estável durante o desafio (e ao recarregar).
  const [step, setStep] = useState(initial.played.length)
  const active = useActiveSeconds(session.id, !summary)
  const current = queue[0]
  const combo = played.length ? played[played.length - 1].combo : 0
  const lives = session.mode === 'boss' ? BOSS_LIVES - played.filter((p) => !p.correct).length : null
  const attackLeft = session.mode === 'time_attack' ? Math.max(0, TIME_ATTACK_SECONDS - active) : null
  const total = played.length + queue.length

  // Desafios extras para a adaptação (mesmas unidades, ainda não usados).
  const pool = useMemo(
    () => content.units.filter((u) => !session.unit_id || u.id === session.unit_id).flatMap((u) => u.challenges).filter((c) => c.type !== 'sql' && c.type !== 'python' && !c.boss),
    [content, session.unit_id],
  )

  const end = useCallback(
    async (status: 'finished' | 'abandoned' = 'finished') => {
      try {
        const r = await finish.mutateAsync({ session, activeSeconds: active, status, settings: game })
        try {
          sessionStorage.removeItem(`evoquest:active:${session.id}`)
        } catch {
          /* ignora */
        }
        if (status === 'abandoned') return navigate(`/evoquest/${session.subject_id}`)
        setSummary(r)
      } catch (e) {
        toast.error(errorMessage(e))
      }
    },
    [active, finish, game, navigate, session, toast],
  )

  // Fim por tempo (contra o relógio) ou por vidas (chefe).
  useEffect(() => {
    if (summary || feedback || finish.isPending) return
    if ((attackLeft === 0 || lives === 0) && played.length > 0) void end()
  }, [attackLeft, lives]) // eslint-disable-line react-hooks/exhaustive-deps

  const check = async () => {
    if (!current || !response) return
    const local = grade(current, response)
    const key = `evoquest:ans:${session.id}:${current.id}:${played.filter((p) => p.challenge.id === current.id).length}`
    let id: string
    try {
      id = sessionStorage.getItem(key) ?? crypto.randomUUID()
      sessionStorage.setItem(key, id)
    } catch {
      id = crypto.randomUUID()
    }
    try {
      const r = await submit.mutateAsync({
        id,
        sessionId: session.id,
        challengeId: current.id,
        version: current.v ?? 1,
        topic: current.topic,
        correct: local.correct,
        score: local.score,
        usedHint,
        seconds: (Date.now() - shownAt) / 1000,
        response,
        local: { difficulty: current.difficulty, subjectId: session.subject_id },
      })
      const p: Played = { challenge: current, correct: r.correct, xp: r.xp, coins: r.coins, combo: r.combo }
      if (game.sound) playSfx(r.correct ? 'right' : 'wrong')
      setAnswered(response)
      setFeedback(p)
      setPlayed((xs) => [...xs, p])
    } catch (e) {
      toast.error(`${errorMessage(e)} Sua resposta foi mantida: toque em Verificar para tentar de novo.`)
    }
  }

  const next = () => {
    const recent = [...played.map((p) => ({ challenge: p.challenge, correct: p.correct }))]
    const rest = adaptNext(queue.slice(1), pool.filter((c) => !played.some((p) => p.challenge.id === c.id)), recent)
    setQueue(rest)
    setFeedback(null)
    setResponse(null)
    setUsedHint(false)
    setShowHint(false)
    setShownAt(Date.now())
    setStep((n) => n + 1)
    if (rest.length === 0 || (lives != null && lives <= 0) || attackLeft === 0) void end()
  }

  const leave = async () => {
    if (played.length === 0) return end('abandoned')
    const ok = await confirm({ title: 'Encerrar a partida?', message: 'Seu progresso até aqui fica salvo e entra no resumo.', confirmLabel: 'Encerrar' })
    if (ok) void end()
  }

  if (summary) return <Summary session={summary.session} time={summary.time} played={played} content={content} before={initial.before} answersAll={answers} />

  if (!current)
    return (
      <div className="mx-auto max-w-xl">
        <Spinner label="Finalizando…" />
        {!finish.isPending && (
          <Button variant="primary" onClick={() => end()} className="mx-auto mt-2 flex">
            Ver resumo
          </Button>
        )}
      </div>
    )

  return (
    <div className="mx-auto flex max-w-2xl flex-col max-sm:min-h-[calc(100dvh-9rem)]">
      {/* Barra superior: sair, progresso e status */}
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={leave} aria-label="Encerrar partida" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink">
          <X className="size-5" />
        </button>
        <Progress value={(played.length / Math.max(total, 1)) * 100} label="Progresso da partida" className="h-3 flex-1" />
        {lives != null && (
          <span className="flex items-center gap-0.5" aria-label={`${lives} vidas`}>
            {Array.from({ length: BOSS_LIVES }).map((_, i) => (
              <Heart key={i} className={cn('size-5', i < lives ? 'fill-danger text-danger' : 'text-line')} aria-hidden />
            ))}
          </span>
        )}
        {attackLeft != null ? (
          <span className={cn('tabular inline-flex items-center gap-1 text-sm font-semibold', attackLeft <= 10 ? 'text-danger' : 'text-ink')} aria-live="off">
            <Timer className="size-4" aria-hidden />
            {formatClock(attackLeft)}
          </span>
        ) : (
          <span className="tabular hidden text-xs text-muted sm:inline">{formatClock(active)}</span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-medium text-ink">
          {meta.icon} {meta.name}
        </span>
        <span aria-hidden>·</span>
        <span>{MODE_LABELS[session.mode]}</span>
        <span aria-hidden>·</span>
        <span>Nível {'●'.repeat(current.difficulty)}{'○'.repeat(5 - current.difficulty)}</span>
        {combo >= 2 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 font-semibold text-ink motion-safe:animate-pulse">
            <Zap className="size-3.5" aria-hidden /> Combo {combo} · ×{comboMultiplier(combo).toFixed(1)}
          </span>
        )}
      </div>

      <Card className="flex-1 p-4 sm:p-6">
        <fieldset disabled={Boolean(feedback) || submit.isPending} className="min-w-0">
          <ChallengeView
            challenge={current}
            seed={`${session.id}:${current.id}:${step}`}
            onChange={setResponse}
            onTranscript={() => setUsedHint(true)}
          />
        </fieldset>
        {showHint && current.hint && !feedback && (
          <p className="mt-4 rounded-lg border border-accent/60 bg-accent/10 px-3 py-2 text-sm text-ink" role="note">
            <Lightbulb className="mr-1 inline size-4 text-accent-strong" aria-hidden />
            {current.hint}
          </p>
        )}
      </Card>

      {/* Ações fixas no rodapé: alcançáveis com o polegar */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {feedback ? (
          <Feedback played={feedback} onNext={next} lastXpLabel={feedback.xp > 0 ? `+${feedback.xp} XP` : null} />
        ) : (
          <div className="flex items-center gap-2">
            {current.hint && (
              <Button
                variant="ghost"
                icon={<Lightbulb className="size-4" />}
                onClick={() => {
                  setShowHint(true)
                  setUsedHint(true)
                }}
                disabled={showHint}
              >
                Dica
              </Button>
            )}
            <span className="hidden text-xs text-muted sm:inline">{usedHint ? 'Dica usada: o XP deste desafio é reduzido.' : ''}</span>
            <Button variant="primary" size="lg" className="ml-auto min-w-40" onClick={check} disabled={!response} loading={submit.isPending}>
              Verificar
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  function Feedback({ played: p, onNext, lastXpLabel }: { played: Played; onNext: () => void; lastXpLabel: string | null }) {
    const c = p.challenge
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          {p.correct ? <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-7 shrink-0 text-danger" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', p.correct ? 'text-success' : 'text-danger')}>
              {p.correct ? 'Correto!' : p.xp > 0 ? 'Quase lá' : 'Ainda não'}
              {lastXpLabel && <span className="ml-2 rounded-full bg-accent/40 px-2 py-0.5 text-xs text-ink">{lastXpLabel}</span>}
              {p.correct && p.xp === 0 && <span className="ml-2 text-xs font-normal text-muted">(repetição recente: sem XP)</span>}
            </p>
            {!p.correct && (
              <p className="mt-1 text-sm text-ink">
                Resposta: <strong className="break-words">{describeAnswer(c)}</strong>
              </p>
            )}
            <p className="mt-1 text-sm text-muted">{c.explanation}</p>
            {!p.correct && c.whyWrong && <p className="mt-1 text-sm text-muted">{c.whyWrong}</p>}
            {c.type === 'dictation' && answered?.type === 'dictation' && !p.correct && <DictationDiff expected={c.say} typed={answered.text} />}
            {c.type === 'dictation' && c.translation && (
              <p className="mt-1 text-sm text-ink">
                <span className="text-muted">Tradução:</span> {c.translation}
              </p>
            )}
            {c.type === 'listen' && c.translation && (
              <p className="mt-1 text-sm text-ink">
                <span className="text-muted">Áudio:</span> <span lang="en">“{c.say}”</span> — {c.translation}
              </p>
            )}
          </div>
        </div>
        <Button variant="primary" size="lg" onClick={onNext} className="w-full sm:ml-auto sm:w-auto" icon={<ArrowRight className="size-4" />} autoFocus>
          Continuar
        </Button>
      </div>
    )
  }
}

// ── Resumo ───────────────────────────────────────────────────────────────
function Summary({
  session,
  time,
  played,
  content,
  before,
  answersAll,
}: {
  session: GameSession
  time: Awaited<ReturnType<typeof finishGame>>['time']
  played: Played[]
  content: SubjectContent
  before: ReturnType<typeof useGameData>['answers']
  answersAll: ReturnType<typeof useGameData>['answers']
}) {
  const settings = useSettings()
  const game = gameSettings(settings)
  const data = useGameData()
  const meta = subjectMeta(session.subject_id)!
  const xp = played.reduce((s, p) => s + p.xp, 0)
  const coins = played.reduce((s, p) => s + p.coins, 0)
  const correct = played.filter((p) => p.correct).length
  const best = played.reduce((m, p) => Math.max(m, p.combo), 0)
  const masteryBefore = subjectMastery(content, before, challengeStates(before)).value
  const masteryAfter = subjectMastery(content, answersAll, challengeStates(answersAll)).value
  const totalXp = data.rewards.reduce((s, r) => s + r.xp, 0)
  const levelNow = levelFromXp(totalXp).level
  const levelBefore = levelFromXp(totalXp - xp).level
  const leveledUp = levelNow > levelBefore && xp > 0
  const wrongTopics = [...new Set(played.filter((p) => !p.correct).map((p) => p.challenge.topic))]
  const topicName = (id: string) => content.units.flatMap((u) => u.topics).find((t) => t.id === id)?.name ?? id
  const unitOfTopic = (id: string) => content.units.find((u) => u.topics.some((t) => t.id === id))?.id
  const won = session.mode === 'boss' ? played.some((p) => p.challenge.boss && p.correct) : null

  useEffect(() => {
    if (leveledUp && game.sound) playSfx('level')
  }, [leveledUp]) // eslint-disable-line react-hooks/exhaustive-deps

  const again = `/evoquest/jogar?s=${session.subject_id}&m=${session.mode}${session.unit_id ? `&u=${session.unit_id}` : ''}&min=${Math.max(1, Math.round((session.planned_seconds ?? 300) / 60))}`

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="bg-brown px-6 py-6 text-center text-wheat">
          <p className="text-4xl" aria-hidden>
            {won === false ? '🛡️' : leveledUp ? '🎉' : correct === played.length && played.length >= 5 ? '💎' : '🏁'}
          </p>
          <h1 className="mt-2 text-xl font-bold">
            {won === true ? 'Chefe derrotado!' : won === false ? 'O chefe resistiu desta vez' : leveledUp ? `Subiu para o nível ${levelNow}!` : 'Partida concluída'}
          </h1>
          <p className="mt-1 text-sm opacity-80">
            {meta.icon} {meta.name} · {MODE_LABELS[session.mode]}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            ['XP', `+${xp}`],
            ['Acertos', `${correct}/${played.length}`],
            ['Maior combo', String(best)],
            ['Tempo ativo', formatClock(session.active_seconds)],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg px-3 py-3 text-center">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Domínio em {meta.name}</span>
          <span className="tabular font-semibold text-ink">
            {masteryBefore}% → {masteryAfter}%
          </span>
        </div>
        <Progress value={masteryAfter} label={`Domínio em ${meta.name}`} />
        <p className="text-xs text-muted">O domínio só cresce de verdade quando os acertos se mantêm em revisões espaçadas.</p>
        {coins > 0 && <p className="text-sm text-ink">🪙 +{coins} moedas (só para itens cosméticos).</p>}
        <p className="text-xs text-muted">
          {time === 'registered' && '⏱️ Tempo ativo registrado nas suas sessões de estudo.'}
          {time === 'skipped-overlap' && '⏱️ Tempo não registrado de novo: já havia uma sessão nesse intervalo (ex.: cronômetro ligado).'}
          {time === 'skipped-short' && '⏱️ Partida com menos de 1 minuto ativo: tempo não registrado.'}
          {time === 'disabled' && session.status === 'finished' && !game.registerTime && '⏱️ Registro de tempo desativado nas preferências do EvoQuest.'}
        </p>
      </Card>

      {wrongTopics.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-ink">Para revisar</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {wrongTopics.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink">{topicName(t)}</span>
                {unitOfTopic(t) && (
                  <Link to={`/evoquest/${session.subject_id}/licao/${unitOfTopic(t)}`} className="text-xs font-medium text-accent-strong underline underline-offset-2">
                    Rever lição
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Os desafios errados voltam automaticamente na Revisão inteligente.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link to={again} reloadDocument={false} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
          <RotateCcw className="size-4" aria-hidden /> Jogar de novo
        </Link>
        <Link to={`/evoquest/${session.subject_id}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
          <Flag className="size-4" aria-hidden /> Mapa da disciplina
        </Link>
        <Link to="/evoquest/missoes" className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
          Missões
        </Link>
      </div>
    </div>
  )
}
