import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, FlaskConical, Loader2, Play, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Segmented } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { SUBJECTS, findChallenge, subjectMeta, subjectOf } from '@/game/catalog'
import { challengeStates } from '@/game/engine/progress'
import { runPython, type PyRun } from '@/game/lab/runPython'
import { runSql, type SqlRun } from '@/game/lab/runSql'
import type { Challenge } from '@/game/types'
import { finishGame, gameSettings, startGame, submitAnswer, useGameData, useGameMutation, useSubjectContent } from '@/game/useGame'
import { useSettings } from '@/hooks/useSettings'
import { BackLink } from './parts'
import { CodeBlock, TableView } from './ChallengeView'

const SQLITE_NOTES = [
  'Executado em SQLite (WebAssembly) no seu navegador, num banco novo a cada execução: nada é salvo e nada sai do aparelho.',
  'Datas são texto ISO (AAAA-MM-DD): use date(), strftime() e comparações de texto.',
  'Concatenação com ||; LIMIT no fim; GROUP BY é permissivo (outros bancos exigem todas as colunas não agregadas).',
  'A correção compara os VALORES do resultado com o gabarito: nomes/apelidos de colunas não importam; a ordem só importa quando o enunciado pede.',
]

// ── Lista ────────────────────────────────────────────────────────────────
export function LabListPage() {
  const [params, setParams] = useSearchParams()
  const subject = params.get('s') && subjectMeta(params.get('s')!) ? params.get('s')! : 'sql'
  const content = useSubjectContent(subject)
  const data = useGameData()
  const solved = useMemo(() => challengeStates(data.answers), [data.answers])
  const labs = content.data?.units.flatMap((u) => u.challenges.filter((c) => c.type === 'sql' || c.type === 'python')) ?? []
  const cases = content.data?.units.flatMap((u) => u.challenges.filter((c) => (c.table || c.code) && c.type !== 'sql' && c.type !== 'python')) ?? []

  return (
    <div>
      <BackLink to="/evoquest">EvoQuest</BackLink>
      <PageHeader
        title="Laboratório prático"
        description="SQL roda de verdade em SQLite no navegador; Python roda em Pyodide (CPython em WebAssembly), isolado em um worker. DAX e M são praticados com casos de resultado conhecido — sem simular o Power BI."
      />
      <div className="mb-4 max-w-full overflow-x-auto">
        <Segmented
          label="Disciplina"
          value={subject}
          onChange={(v) => setParams({ s: v }, { replace: true })}
          options={SUBJECTS.map((s) => ({ value: s.id, label: `${s.icon} ${s.short}` }))}
          size="sm"
        />
      </div>
      {content.isError ? (
        <ErrorState error={content.error} onRetry={() => content.refetch()} />
      ) : !content.data ? (
        <Spinner />
      ) : (
        <>
          {labs.length > 0 && (
            <ul className="mb-6 grid gap-3 sm:grid-cols-2">
              {labs.map((c) => {
                const done = (solved.get(c.id)?.correct ?? 0) > 0
                return (
                  <li key={c.id}>
                    <Link to={`/evoquest/laboratorio/${c.id}`} className="flex h-full items-start gap-3 rounded-xl border border-line bg-bg p-4 hover:border-accent-strong hover:bg-surface">
                      {done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Resolvido" /> : <FlaskConical className="size-5 shrink-0 text-accent-strong" aria-hidden />}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{c.prompt}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {c.type === 'sql' ? 'SQL · SQLite' : 'Python · Pyodide'} · dificuldade {c.difficulty}/5
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-ink">Casos práticos validados ({cases.length})</h2>
            <p className="mt-1 text-sm text-muted">
              Desafios com tabelas e trechos de código cujo resultado foi calculado pelas regras da linguagem.
              {(subject === 'dax' || subject === 'm') && ' Nenhuma fórmula é executada por um motor do Power BI: para praticar a execução, reproduza os casos no Power BI Desktop.'}
            </p>
            <Link
              to={`/evoquest/jogar?s=${subject}&m=lab&min=10`}
              aria-disabled={cases.length === 0}
              className={cn('mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong', cases.length === 0 && 'pointer-events-none opacity-50')}
            >
              <Play className="size-4" aria-hidden /> Praticar casos
            </Link>
          </Card>
        </>
      )}
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────
function Editor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const t = e.currentTarget
    const { selectionStart: a, selectionEnd: b } = t
    onChange(value.slice(0, a) + '    ' + value.slice(b))
    requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4))
  }
  return (
    <textarea
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKey}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      rows={10}
      className="scroll-thin min-h-56 w-full resize-y rounded-xl border border-line bg-brown p-3 font-mono text-sm leading-relaxed text-wheat caret-wheat focus:border-accent-strong focus:outline-none"
    />
  )
}

export default function LabPage() {
  const { id = '' } = useParams()
  const subject = subjectOf(id)
  const content = useSubjectContent(subject)
  if (content.isError) return <ErrorState error={content.error} onRetry={() => content.refetch()} />
  if (!subjectMeta(subject)) return <EmptyState title="Laboratório não encontrado" />
  if (!content.data) return <Spinner />
  const found = findChallenge(content.data, id)
  if (!found || (found.challenge.type !== 'sql' && found.challenge.type !== 'python')) return <EmptyState title="Laboratório não encontrado" action={<Link to="/evoquest/laboratorio" className="underline">Voltar</Link>} />
  return <LabRunner key={id} challenge={found.challenge} dataset={found.challenge.type === 'sql' ? content.data.datasets?.[found.challenge.dataset] ?? '' : ''} />
}

function LabRunner({ challenge: c, dataset }: { challenge: Challenge; dataset: string }) {
  const toast = useToast()
  const settings = useSettings()
  const game = gameSettings(settings)
  const isSql = c.type === 'sql'
  const [code, setCode] = useState(c.type === 'sql' ? (c.starter ?? '') : c.type === 'python' ? c.starter : '')
  const [sqlRun, setSqlRun] = useState<SqlRun | null>(null)
  const [pyRun, setPyRun] = useState<PyRun | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'running'>('idle')
  const [result, setResult] = useState<{ correct: boolean; xp: number; detail: string } | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const openedAt = useRef(Date.now())
  const start = useGameMutation(startGame)
  const answer = useGameMutation(submitAnswer)
  const finish = useGameMutation(finishGame, ['game_sessions', 'game_answers', 'game_rewards', 'study_sessions'])
  const schema = useMemo(() => dataset.split('\n').filter((l) => l.startsWith('CREATE TABLE')).map((l) => l.replace(/^CREATE TABLE /, '').replace(/;$/, '')), [dataset])

  const execute = async (check: boolean): Promise<{ correct: boolean; score: number; detail: string; response: unknown } | null> => {
    setStatus('running')
    try {
      if (c.type === 'sql') {
        const r = await runSql(dataset, code, check ? c.solution : null, c.orderMatters)
        setSqlRun(r)
        if (r.error) return { correct: false, score: 0, detail: r.error, response: { type: 'sql', query: code, error: r.error } }
        const ok = Boolean(r.check?.matches)
        return { correct: ok, score: ok ? 1 : 0, detail: r.check?.reason ?? '', response: { type: 'sql', query: code, matches: ok } }
      }
      if (c.type === 'python') {
        const r = await runPython({ code, entry: c.entry, tests: c.tests, packages: c.packages }, (s) => setStatus(s))
        setPyRun(r)
        const passed = r.results?.filter((t) => t.ok).length ?? 0
        const total = c.tests.length
        return { correct: !r.error && passed === total, score: r.error ? 0 : passed / total, detail: r.error ?? `${passed}/${total} testes`, response: { type: 'python', code, passed, total } }
      }
      return null
    } finally {
      setStatus('idle')
    }
  }

  const submit = async () => {
    const r = await execute(true)
    if (!r) return
    try {
      const session = await start.mutateAsync({ subjectId: subjectOf(c.id), unitId: null, mode: 'lab', queue: [], plannedSeconds: null })
      const out = await answer.mutateAsync({
        id: crypto.randomUUID(),
        sessionId: session.id,
        challengeId: c.id,
        version: c.v ?? 1,
        topic: c.topic,
        correct: r.correct,
        score: r.score,
        usedHint: showSolution,
        seconds: (Date.now() - openedAt.current) / 1000,
        response: r.response,
        local: { difficulty: c.difficulty, subjectId: subjectOf(c.id) },
      })
      await finish.mutateAsync({ session, activeSeconds: Math.min((Date.now() - openedAt.current) / 1000, 3600), status: 'finished', settings: game })
      setResult({ correct: out.correct, xp: out.xp, detail: r.detail })
    } catch (e) {
      toast.error(e)
    }
  }

  const busy = status !== 'idle' || start.isPending || answer.isPending || finish.isPending

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink to={`/evoquest/laboratorio?s=${subjectOf(c.id)}`}>Laboratório</BackLink>
      <h1 className="text-lg font-semibold text-ink sm:text-xl">{c.prompt}</h1>
      <p className="mt-1 text-xs text-muted">
        {isSql ? 'SQL · SQLite no navegador' : 'Python · Pyodide (CPython em WebAssembly)'} · dificuldade {c.difficulty}/5
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Editor value={code} onChange={setCode} label={isSql ? 'Editor SQL' : 'Editor Python'} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => execute(false)} disabled={busy || !code.trim()} icon={<Play className="size-4" />}>
              {isSql ? 'Executar' : 'Rodar testes'}
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy || !code.trim()} loading={answer.isPending || start.isPending} icon={<Send className="size-4" />}>
              Enviar resposta
            </Button>
            <Button variant="ghost" onClick={() => setShowSolution(true)} disabled={showSolution} icon={<Eye className="size-4" />}>
              Ver solução
            </Button>
          </div>
          {status !== 'idle' && (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {status === 'loading' ? 'Carregando o Python (só na primeira vez; pode levar alguns segundos)…' : 'Executando…'}
            </p>
          )}

          {sqlRun?.error && <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 font-mono text-xs text-danger" role="alert">{sqlRun.error}</p>}
          {sqlRun?.result && <TableView table={{ caption: `${sqlRun.result.rows.length} linha(s)`, columns: sqlRun.result.columns, rows: sqlRun.result.rows as Array<Array<string | number | null>> }} />}
          {pyRun?.error && <pre className="overflow-x-auto rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-danger" role="alert">{pyRun.error}</pre>}
          {pyRun?.results && c.type === 'python' && (
            <ul className="flex flex-col gap-1.5">
              {pyRun.results.map((t, i) => (
                <li key={i} className={cn('rounded-lg border px-3 py-2 font-mono text-xs', t.ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5')}>
                  {t.ok ? '✓' : '✗'} {c.entry}({c.tests[i].args.map((a) => JSON.stringify(a)).join(', ')}) → {t.got}
                  {!t.ok && <span className="text-muted"> (esperado: {JSON.stringify(c.tests[i].expected)})</span>}
                </li>
              ))}
            </ul>
          )}

          {result && (
            <Card className={cn('p-4', result.correct ? 'border-success/50' : 'border-danger/50')} role="status">
              <p className={cn('flex items-center gap-2 font-semibold', result.correct ? 'text-success' : 'text-danger')}>
                {result.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                {result.correct ? 'Resolvido!' : 'Ainda não bate com o esperado'}
                {result.xp > 0 && <span className="rounded-full bg-accent/40 px-2 py-0.5 text-xs text-ink">+{result.xp} XP</span>}
              </p>
              {result.detail && <p className="mt-1 text-sm text-muted">{result.detail}</p>}
              <p className="mt-2 text-sm text-ink">{c.explanation}</p>
            </Card>
          )}
          {showSolution && (c.type === 'sql' || c.type === 'python') && (
            <div>
              <p className="mb-1 text-xs text-muted">Solução de referência (ver a solução reduz o XP do envio):</p>
              <CodeBlock source={c.solution} lang={c.type} />
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          {isSql ? (
            <>
              <Card className="p-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Tabelas</h2>
                <ul className="mt-2 flex flex-col gap-1.5 font-mono text-xs text-ink">
                  {schema.map((s) => (
                    <li key={s} className="break-words">
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Dialeto SQLite</h2>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-muted">
                  {SQLITE_NOTES.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Card>
            </>
          ) : (
            <Card className="p-3 text-xs text-muted">
              <h2 className="font-semibold tracking-wide uppercase">Como funciona</h2>
              <p className="mt-2">
                Seu código roda no navegador, num worker isolado (sem acesso à página, aos seus dados ou a arquivos). Execuções acima de 10 s são interrompidas. Na primeira vez, o Python e o pandas são baixados do CDN jsDelivr.
              </p>
              <p className="mt-2">Defina a função pedida e devolva o resultado com return — os testes chamam a função com entradas diferentes.</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
