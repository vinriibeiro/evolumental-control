import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Code2, Lightbulb, Play, X } from 'lucide-react'
import { collectPython, type PyCollect, type PyStatus } from '@/game/lab/runPython'
import { canonCases, canonValue, pyFeedback, sha256, type PyChallenge } from '../challenges'
import { WORLD } from '../content'
import { canReveal, FULL_EXPLANATION, recordAttempt, reveal, startLadder, STAGE_LABELS } from '../engine/pedagogy'
import { useRecordEvidence, type EvidenceOutcome } from './evidence'
import { LessonCard } from './LessonCard'
import { Portrait } from './Portrait'
import { play } from './audio'

interface Props {
  challenge: PyChallenge
  sound: boolean
  /** Chamado com a resposta canônica quando o resultado confere. */
  onSolved: (answer: string) => Promise<boolean> | boolean
  onClose: () => void
}

const pretty = (v: unknown) => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']')

/**
 * Terminal Python do mundo. O código roda de verdade (Pyodide num worker
 * isolado): a função do jogador é chamada em cada caso visível e o conjunto
 * de resultados é comparado por hash — o gabarito não vem para o navegador.
 *
 * Mesmo modelo pedagógico do terminal SQL: ficha de campo, escada de pistas
 * (cada degrau só abre depois de uma nova tentativa) e evidência de domínio
 * com o nível de ajuda usado.
 */
export function PyTerminal({ challenge: ch, sound, onSolved, onClose }: Props) {
  const [code, setCode] = useState(ch.starter)
  const [busy, setBusy] = useState<PyStatus | 'checking' | null>(null)
  const [out, setOut] = useState<{ run: PyCollect; ok: boolean[] } | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [ladder, setLadder] = useState(startLadder)
  const [solved, setSolved] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceOutcome | null>(null)
  const recorded = useRef(false)
  const record = useRecordEvidence()
  const editor = useRef<HTMLTextAreaElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const speaker = WORLD.speakers[ch.speaker]
  const lesson = ch.lesson ? WORLD.lessons[ch.lesson] : undefined
  const attempts = ladder.attempts
  const steps = ch.ladder ? [...ch.ladder, ...(ch.explanation ? [ch.explanation] : [])] : []
  const hintCount = ch.ladder?.length ?? 0

  useEffect(() => {
    editor.current?.focus()
    play('open', sound)
  }, [sound])

  useEffect(() => {
    if (message || ladder.level) feedback.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [message, ladder.level])

  // Sair depois de tentar sem resolver também é evidência (de dificuldade).
  const close = () => {
    if (ch.stage && !solved && !recorded.current && ladder.attempts > 0) {
      recorded.current = true
      void record(ch, { help: ladder.level, attempts: ladder.attempts, solved: false, answer: null })
    }
    onClose()
  }

  const run = async () => {
    if (!code.trim() || busy || solved) return
    setBusy('running')
    setMessage(null)
    const r = await collectPython({ code, entry: ch.entry, cases: ch.cases, packages: ch.packages }, setBusy)
    setBusy('checking')
    const results = r.results ?? []
    const ok = await Promise.all(ch.cases.map(async (_, i) => (results[i] && !results[i].error ? (await sha256(canonValue(results[i].value))) === ch.expect.cases[i] : false)))
    setBusy(null)
    setOut({ run: r, ok })
    if (!r.error && results.length === ch.cases.length) {
      const answer = canonCases(results)
      if ((await sha256(answer)) === ch.expect.hash) {
        const accepted = await onSolved(answer)
        if (accepted !== false) {
          setSolved(true)
          setMessage({ tone: 'good', text: ch.success })
          play('success', sound)
          if (ch.stage && !recorded.current) {
            recorded.current = true
            void record(ch, { help: ladder.level, attempts: ladder.attempts + 1, solved: true, answer }).then(setEvidence)
          }
          return
        }
      }
    }
    setLadder(recordAttempt)
    setMessage({ tone: 'bad', text: pyFeedback(ch, code, r, ok) })
    play('error', sound)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void run()
      return
    }
    if (e.key === 'Escape') return close()
    if (e.key === 'Tab' && !e.shiftKey) {
      // Tab insere 4 espaços (indentação é parte da sintaxe do Python).
      e.preventDefault()
      const t = e.currentTarget
      const { selectionStart: a, selectionEnd: b } = t
      setCode(code.slice(0, a) + '    ' + code.slice(b))
      requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4))
    }
  }

  const nextIsExplanation = ladder.level + 1 >= FULL_EXPLANATION
  const ladderOpen = Boolean(ch.ladder) && !solved && ladder.level < steps.length
  const busyLabel = busy === 'loading' ? 'Carregando o Python…' : busy ? 'Executando…' : 'Executar'

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={ch.title}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <Code2 className="size-5 text-[var(--eq-good)]" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate font-semibold tracking-wide">{ch.title}</h2>
        {ch.stage && <span className="hidden rounded border border-[var(--eq-edge-dark)] px-2 py-0.5 text-xs text-[var(--eq-muted)] sm:inline">{STAGE_LABELS[ch.stage]}</span>}
        <button className="eq-btn" onClick={close} aria-label="Fechar terminal">
          <X className="size-4" /> <span className="hidden sm:inline">Sair</span> <span className="eq-kbd hidden sm:inline">Esc</span>
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_19rem]">
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex gap-3">
            {speaker && <Portrait look={speaker.look} label={speaker.name} size={56} />}
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-[var(--eq-gold)] uppercase">Objetivo · {speaker?.name}</p>
              <p className="mt-0.5 leading-relaxed">{ch.brief}</p>
              <p className="mt-1 text-xs text-[var(--eq-muted)]">
                O controlador chama <code className="font-mono text-[#b8ffd9]">{ch.entry}(…)</code> em {ch.cases.length} caso(s) e confere o que a função devolve.
              </p>
            </div>
          </div>

          {lesson && <LessonCard lesson={lesson} defaultOpen={ch.stage === 'guided'} showMistakes={attempts > 0} />}

          <label className="sr-only" htmlFor="eq-py">
            Código Python
          </label>
          <textarea
            id="eq-py"
            ref={editor}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={9}
            readOnly={solved}
            className="w-full resize-y rounded-md border-2 border-[#1f3d30] bg-[#07130e] p-3 font-mono text-sm leading-relaxed text-[#b8ffd9] caret-[var(--eq-good)] outline-none focus:border-[var(--eq-good)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="eq-btn eq-btn-primary" onClick={() => void run()} disabled={Boolean(busy) || solved}>
              <Play className="size-4" /> {busyLabel} <span className="eq-kbd">Ctrl Enter</span>
            </button>
            {ladderOpen && (
              <button className="eq-btn" onClick={() => setLadder((l) => reveal(l))} disabled={!canReveal(ladder)}>
                <Lightbulb className="size-4 text-[var(--eq-gold)]" />
                {nextIsExplanation ? 'Ver a explicação completa' : `Pedir pista ${ladder.level + 1} de ${hintCount}`}
              </button>
            )}
            {ladderOpen && !canReveal(ladder) && (
              <span className="text-xs text-[var(--eq-muted)]">{attempts === 0 ? 'Tente primeiro: a pista abre depois de uma tentativa.' : 'Tente de novo com a pista para liberar a próxima.'}</span>
            )}
            {solved && (
              <button className="eq-btn eq-btn-primary" onClick={onClose}>
                Continuar
              </button>
            )}
          </div>
          {busy === 'loading' && (
            <p className="text-xs text-[var(--eq-muted)]" role="status">
              Carregando o Python (só na primeira vez; pode levar alguns segundos)…
            </p>
          )}

          <div ref={feedback} />
          {message && (
            <p role="status" className={`rounded-md border-l-4 px-3 py-2 text-sm leading-relaxed ${message.tone === 'good' ? 'border-[var(--eq-good)] bg-[#0d2a1d]' : 'border-[var(--eq-bad)] bg-[#2a1414]'}`}>
              <span className="sr-only">{message.tone === 'good' ? 'Sucesso: ' : 'Ainda não: '}</span>
              {message.text}
            </p>
          )}
          {evidence && <p className={`text-xs ${evidence.ok ? 'text-[var(--eq-muted)]' : 'text-[var(--eq-bad)]'}`}>{evidence.text}</p>}
          {steps.slice(0, ladder.level).map((h, i) => {
            const isExplanation = i + 1 >= FULL_EXPLANATION
            return (
              <p key={i} className={`rounded-md px-3 py-2 text-sm leading-relaxed ${isExplanation ? 'border-l-4 border-[var(--eq-cyan)] bg-[#0c2230]' : 'bg-[#2a2112]'}`}>
                <Lightbulb className="mr-1 inline size-4 text-[var(--eq-gold)]" aria-hidden />
                <span className="font-semibold">{isExplanation ? 'Explicação: ' : `Pista ${i + 1}: `}</span>
                {h}
              </p>
            )
          })}

          {out && !out.run.error && out.run.results && (
            <ul className="space-y-1 rounded-md border-2 border-[#1f3d30] p-2 font-mono text-xs" aria-label="Resultado por caso">
              {out.run.results.map((r, i) => (
                <li key={i} className={out.ok[i] ? 'text-[var(--eq-good)]' : 'text-[#d7ffe9]'}>
                  <span className="font-semibold">
                    {out.ok[i] ? '✓' : '✗'} Caso {i + 1}
                    {ch.caseNames?.[i] ? ` (${ch.caseNames[i]})` : ''}:
                  </span>{' '}
                  {r.error ? <span className="text-[var(--eq-bad)]">{r.error}</span> : out.ok[i] ? 'confere' : `devolveu ${pretty(r.value ?? null)}`}
                </li>
              ))}
            </ul>
          )}
          {out?.run.error && !message && <pre className="overflow-x-auto font-mono text-sm text-[var(--eq-bad)]">{out.run.error}</pre>}
        </div>

        <aside className="border-t-2 border-[var(--eq-edge-dark)] p-4 lg:border-t-0 lg:border-l-2" aria-label="Casos de teste">
          <p className="mb-2 text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">Entradas de cada caso</p>
          <div className="space-y-2 font-mono text-xs">
            {ch.cases.map((args, i) => (
              <details key={i} open={i === 0}>
                <summary className="cursor-pointer font-semibold text-[var(--eq-cyan)]">
                  Caso {i + 1}
                  {ch.caseNames?.[i] ? ` · ${ch.caseNames[i]}` : ''}
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-[#07130e] p-2 whitespace-pre-wrap text-[var(--eq-muted)]">
                  {`${ch.entry}(\n${args.map((a) => `  ${pretty(a)}`).join(',\n')}\n)`}
                </pre>
              </details>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--eq-muted)]">Seu código roda no navegador, num ambiente Python isolado. Execuções acima de 10 s são interrompidas.</p>
        </aside>
      </div>
    </div>
  )
}
