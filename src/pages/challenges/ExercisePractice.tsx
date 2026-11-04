import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Copy, Lightbulb, Play, Square, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { LEVELS, TRACKS, type Challenge } from './catalog'
import { checkGit, gitContext, gitSolution } from './gitPractice'
import { LESSONS, type LessonCheckpoint } from './lessons'
import { CaseDetailView } from './PracticeFeedback'
import type { PracticeResult } from './practiceTypes'
import type { Variation } from './variations'

function Checkpoint({ checkpoint }: { checkpoint: LessonCheckpoint }) {
  const [answer, setAnswer] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState<number | null>(null)
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-2 text-sm font-semibold text-ink">Confira se entendeu</legend>
      <p className="text-sm text-ink">{checkpoint.question}</p>
      <div className="grid gap-2">
        {checkpoint.options.map((option, index) => (
          <label key={option} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2">
            <input type="radio" name="lesson-checkpoint" className="mt-1 accent-accent" checked={answer === index} onChange={() => { setAnswer(index); setSubmitted(null) }} />
            {option}
          </label>
        ))}
      </div>
      <Button size="sm" disabled={answer === null} onClick={() => setSubmitted(answer)}>Conferir resposta</Button>
      {submitted !== null && (
        <p role="status" className={`text-sm leading-relaxed ${submitted === checkpoint.correct ? 'text-success' : 'text-warning'}`}>
          <strong>{submitted === checkpoint.correct ? 'Certo. ' : 'Revise este ponto. '}</strong>{checkpoint.explanation}
        </p>
      )}
    </fieldset>
  )
}

const HINT_LABELS = ['Dica 1 · O conceito', 'Dica 2 · A estratégia']
const HINT_ACTIONS = ['Dica 1: o conceito', 'Dica 2: a estratégia']

function Prompt({ challenge }: { challenge: Challenge }) {
  const taskSeparator = '\n\nTarefa\n'
  if (challenge.track === 'git') {
    const task = challenge.prompt.split(taskSeparator).at(-1)
    return <div className="space-y-3">
      <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted"><strong className="text-ink">Cenário já preparado. </strong>{gitContext(challenge)}</p>
      <p className="text-sm leading-relaxed text-ink">{task}</p>
    </div>
  }
  if (challenge.track === 'sql') {
    const [setup, task] = challenge.prompt.split(taskSeparator)
    const schema = setup.split('\n\n').slice(1).join('\n\n')
    return <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink">{task}</p>
      <p className="text-sm text-muted">O banco SQLite já vem preparado. Escreva apenas a solução no editor.</p>
      <details className="rounded-xl border border-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">Consultar tabelas e dados de exemplo</summary>
        <pre className="overflow-x-auto rounded-b-xl border-t border-line bg-surface-2 p-4 font-mono text-xs leading-6 text-ink"><code>{schema}</code></pre>
      </details>
    </div>
  }
  const task = challenge.prompt.replace('Pratique em Python 3 no seu computador.\n\n', '')
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{task}</p>
}

export function ExercisePractice({ challenge, draft, verified, legacyDone, onDraft, onPassed, onFailed, onNext, nextTitle, nextLabel = 'Próxima etapa', notice }: {
  challenge: Challenge | Variation
  draft: string
  verified: boolean
  legacyDone: boolean
  onDraft: (value: string) => void
  onPassed: () => void
  /** Chamado quando o teste roda e o aluno ainda não acertou (nunca em falha do ambiente). */
  onFailed?: () => void
  onNext: () => void
  nextTitle?: string
  nextLabel?: string
  notice?: ReactNode
}) {
  const toast = useToast()
  const variation = 'baseId' in challenge
  const lesson = LESSONS['baseId' in challenge ? challenge.baseId : challenge.id]
  const execution = useRef<AbortController | null>(null)
  const [hints, setHints] = useState(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState('')
  const solution = challenge.track === 'git' ? gitSolution(challenge) : challenge.solution

  useEffect(() => () => execution.current?.abort(), [])

  const test = async () => {
    if (execution.current) return
    const attempt = new AbortController()
    execution.current = attempt
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const checked = challenge.track === 'git'
        ? checkGit(challenge, draft)
        : await (await import('./runners')).runPractice(challenge, draft, attempt.signal)
      if (attempt.signal.aborted) return
      setResult(checked)
      if (checked.passed) onPassed()
      else onFailed?.()
    } catch (cause) {
      if (!attempt.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível testar. Tente novamente.')
    } finally {
      if (execution.current === attempt) {
        execution.current = null
        setRunning(false)
      }
    }
  }

  const cancel = () => {
    execution.current?.abort()
    execution.current = null
    setRunning(false)
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copiado para a área de transferência.')
    } catch {
      toast.error('Selecione e copie o texto manualmente.')
    }
  }

  return (
    <Card className="overflow-hidden">
      <header className="border-b border-line p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-accent/10 text-accent-strong">{TRACKS.find((track) => track.value === challenge.track)?.label} · {LEVELS.find((level) => level.value === challenge.level)?.label}</Badge>
          {variation && <Badge className="bg-warning/10 text-warning">Revisão · variação</Badge>}
          {verified && <Badge className="bg-success/10 text-success">Prática aprovada</Badge>}
          {legacyDone && !verified && <Badge>Autoavaliação anterior</Badge>}
        </div>
        {notice && <div className="mt-3">{notice}</div>}
        <h2 tabIndex={-1} className="mt-3 text-2xl font-semibold tracking-tight text-ink">{challenge.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span>1. Aprenda o conceito</span><span>2. Resolva o exercício</span><span>3. Teste e avance</span>
          <a href={`#${practiceSection}`} className="font-semibold text-accent-strong underline underline-offset-4">Ir para a prática</a>
        </div>
      </header>

      {lesson && <section className="space-y-4 border-b border-line p-5 sm:p-7" aria-labelledby="lesson-concept">
        <h3 id="lesson-concept" className="flex items-center gap-2 text-base font-semibold text-ink"><BookOpen className="size-4 text-accent-strong" aria-hidden /> Aprenda o conceito</h3>
        <p className="text-sm leading-relaxed text-muted">{lesson.concept}</p>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink">Exemplo explicado</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs leading-6 text-ink"><code>{lesson.workedExample}</code></pre>
        </div>
        <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">Cuidado comum. </strong>{lesson.pitfall}</p>
        <Checkpoint checkpoint={lesson.checkpoint} />
      </section>}

      <section id={practiceSection} className="scroll-mt-32 space-y-5 p-5 sm:p-7" aria-labelledby="practice-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="practice-heading" className="text-lg font-semibold text-ink">Resolva o exercício</h3>
          <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void copy(`${challenge.title}\n\n${challenge.prompt}`)}>Copiar enunciado</Button>
        </div>
        <Prompt challenge={challenge} />
        <div>
          <label htmlFor={`draft-${challenge.id}`} className="mb-2 block text-sm font-semibold text-ink">{challenge.track === 'git' ? 'Seus comandos' : 'Seu código'}</label>
          <textarea id={`draft-${challenge.id}`} value={draft} onChange={(event) => { cancel(); setResult(null); setError(''); onDraft(event.target.value) }} spellCheck={false} autoCapitalize="off" autoComplete="off" className="min-h-52 w-full resize-y rounded-xl border border-line bg-surface-2 p-4 font-mono text-sm leading-6 text-ink focus:border-accent-strong" aria-describedby="practice-help" />
          <p id="practice-help" className="mt-2 text-xs leading-relaxed text-muted">{challenge.track === 'git'
            ? 'Simulador de comandos. Digite um comando por linha, na ordem pedida pelo cenário. As operações acontecem apenas no treino.'
            : `O teste executa seu ${challenge.track === 'sql' ? 'SQL com dados de treino no SQLite' : 'Python com entradas de treino'} neste navegador. A primeira execução carrega o ambiente.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" loading={running} disabled={running || !draft.trim()} icon={<Play className="size-4" aria-hidden />} onClick={() => void test()}>{running ? 'Executando testes…' : 'Testar solução'}</Button>
          {running && <Button icon={<Square className="size-3.5" aria-hidden />} onClick={cancel}>Cancelar teste</Button>}
          <Button icon={<Lightbulb className="size-4" aria-hidden />} disabled={hints >= challenge.hints.length} onClick={() => setHints(hints + 1)}>{hints >= challenge.hints.length ? 'Sem mais dicas' : HINT_ACTIONS[hints] ?? 'Próxima dica'}</Button>
        </div>
        {running && challenge.track !== 'git' && <p role="status" className="text-xs leading-relaxed text-muted">Preparando o ambiente isolado do navegador. Isso pode levar até um minuto; você pode cancelar a qualquer momento.</p>}
        {hints > 0 && <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted" aria-live="polite">
          <ol className="space-y-2">{challenge.hints.slice(0, hints).map((hint, index) => <li key={hint}><strong className="block text-xs text-ink">{HINT_LABELS[index] ?? `Dica ${index + 1}`}</strong>{hint}{index === 0 && lesson ? ' Releia “Aprenda o conceito” acima.' : ''}</li>)}</ol>
          {hints >= challenge.hints.length && <p className="border-t border-line pt-2 text-xs">Ainda travado? A solução comentada continua disponível logo abaixo, quando você quiser consultar.</p>}
        </div>}
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</p>}
        {result && <div className="space-y-3 rounded-xl border border-line p-4" aria-live="polite">
          <p className={`flex items-center gap-2 text-sm font-semibold ${result.passed ? 'text-success' : 'text-danger'}`}>
            {result.passed ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
            {result.passed ? 'Você acertou' : 'A solução precisa de ajustes'}
          </p>
          <p className="text-sm text-muted">{result.summary}</p>
          <ul className="space-y-2">{result.cases.map((item, index) => <li key={`${item.label}-${index}`} className="rounded-lg bg-surface-2 p-3 text-sm"><strong className={item.passed ? 'text-success' : 'text-danger'}>{item.passed ? 'Passou' : 'Falhou'}</strong> <span className="text-ink">· {item.label}</span>
            {(item.passed || !item.detail?.explanation) && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">{item.feedback}</p>}
            {item.detail && <CaseDetailView detail={item.detail} passed={item.passed} />}
          </li>)}</ul>
          {result.output && <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 font-mono text-xs text-ink"><code>{result.output}</code></pre>}
        </div>}
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">Ver solução comentada</summary>
          <div className="space-y-3 border-t border-line p-4">
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 font-mono text-xs leading-6 text-ink"><code>{solution}</code></pre>
            <Button size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void copy(solution)}>Copiar solução</Button>
          </div>
        </details>
        {verified && (nextTitle || variation) && <Button variant="primary" icon={<ArrowRight className="size-4" aria-hidden />} onClick={onNext}>{nextTitle ? `${nextLabel} · ${nextTitle}` : nextLabel}</Button>}
      </section>
    </Card>
  )
}

const practiceSection = 'practice-editor'
