import { useEffect, useRef, useState } from 'react'
import { Database, Lightbulb, Play, X } from 'lucide-react'
import { runSql } from '@/game/lab/runSql'
import type { QueryResult } from '@/game/lab/sqlCore'
import { canonResult, sha256, sqlFeedback, type SqlChallenge } from '../challenges'
import { DATASETS, SCHEMAS } from '../content/datasets'
import { WORLD } from '../content'
import { canReveal, FULL_EXPLANATION, recordAttempt, reveal, startLadder, STAGE_LABELS } from '../engine/pedagogy'
import { useRecordEvidence, type EvidenceOutcome } from './evidence'
import { LessonCard, ResultTable } from './LessonCard'
import { Portrait } from './Portrait'
import { play } from './audio'

interface Props {
  challenge: SqlChallenge
  sound: boolean
  /** Chamado com a resposta canônica quando o resultado confere. */
  onSolved: (answer: string) => Promise<boolean> | boolean
  onClose: () => void
}

/**
 * Terminal SQL do mundo. Qualquer consulta roda de verdade (SQLite em um
 * worker, banco novo a cada execução): dá para explorar as tabelas à vontade.
 * Quando o resultado bate com o objetivo, o mundo reage.
 *
 * Atividades pedagógicas (com estágio) trazem a ficha de campo do conceito e
 * a escada de pistas: cada degrau só abre depois de uma nova tentativa, e o
 * nível de ajuda usado vai junto com a evidência de domínio.
 */
export function Terminal({ challenge: ch, sound, onSolved, onClose }: Props) {
  const [query, setQuery] = useState(ch.starter ?? '')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ result?: QueryResult; error?: string } | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null)
  const [ladder, setLadder] = useState(startLadder)
  const [hintsShown, setHintsShown] = useState(0)
  const [solved, setSolved] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceOutcome | null>(null)
  const recorded = useRef(false)
  const record = useRecordEvidence()
  const editor = useRef<HTMLTextAreaElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const speaker = WORLD.speakers[ch.speaker]
  const lesson = ch.lesson ? WORLD.lessons[ch.lesson] : undefined
  const dataset = ch.inline?.dataset ?? DATASETS[ch.database]
  const schema = ch.inline?.schema ?? SCHEMAS[ch.database] ?? []
  const attempts = ladder.attempts
  // Degraus: 3 pistas e, por último, a explicação completa.
  const steps = ch.ladder ? [...ch.ladder, ...(ch.explanation ? [ch.explanation] : [])] : []
  const hintCount = ch.ladder?.length ?? 0

  useEffect(() => {
    editor.current?.focus()
    play('open', sound)
  }, [sound])

  // Com a ficha aberta o retorno pode ficar abaixo da dobra: traz para a vista.
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
    if (!query.trim() || busy || solved) return
    setBusy(true)
    setMessage(null)
    const r = await runSql(dataset, ch.verify ? `${query}\n;${ch.verify}` : query, null)
    setBusy(false)
    setOut(r)
    if (r.result) {
      const answer = canonResult(r.result, ch.orderMatters)
      if ((await sha256(answer)) === ch.expect.hash) {
        const ok = await onSolved(answer)
        if (ok !== false) {
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
    // Explorar (ex.: SELECT * para olhar a tabela) não conta como tentativa.
    const exploring = r.result && /^\s*select\s+\*\s+from\s+\w+\s*(limit\s+\d+\s*)?;?\s*$/i.test(query) && !ch.verify
    if (exploring) {
      setMessage({ tone: 'info', text: 'Você está explorando a tabela. Quando tiver a consulta do objetivo, execute de novo.' })
      return
    }
    setLadder(recordAttempt)
    setMessage({ tone: 'bad', text: sqlFeedback(ch, query, r) })
    play('error', sound)
  }

  const nextIsExplanation = ladder.level + 1 >= FULL_EXPLANATION
  const ladderOpen = Boolean(ch.ladder) && !solved && ladder.level < steps.length

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={ch.title}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <Database className="size-5 text-[var(--eq-good)]" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate font-semibold tracking-wide">{ch.title}</h2>
        {ch.stage && <span className="hidden rounded border border-[var(--eq-edge-dark)] px-2 py-0.5 text-xs text-[var(--eq-muted)] sm:inline">{STAGE_LABELS[ch.stage]}</span>}
        <button className="eq-btn" onClick={close} aria-label="Fechar terminal">
          <X className="size-4" /> <span className="hidden sm:inline">Sair</span> <span className="eq-kbd hidden sm:inline">Esc</span>
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_17rem]">
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex gap-3">
            {speaker && <Portrait look={speaker.look} label={speaker.name} size={56} />}
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-[var(--eq-gold)] uppercase">Objetivo · {speaker?.name}</p>
              <p className="mt-0.5 leading-relaxed">{ch.brief}</p>
            </div>
          </div>

          {lesson && <LessonCard lesson={lesson} defaultOpen={ch.stage === 'guided'} showMistakes={attempts > 0} />}

          <label className="sr-only" htmlFor="eq-sql">
            Comando SQL
          </label>
          <textarea
            id="eq-sql"
            ref={editor}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                void run()
              }
              if (e.key === 'Escape') close()
            }}
            spellCheck={false}
            rows={7}
            readOnly={solved}
            className="w-full resize-y rounded-md border-2 border-[#1f3d30] bg-[#07130e] p-3 font-mono text-sm leading-relaxed text-[#b8ffd9] caret-[var(--eq-good)] outline-none focus:border-[var(--eq-good)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="eq-btn eq-btn-primary" onClick={() => void run()} disabled={busy || solved}>
              <Play className="size-4" /> {busy ? 'Executando…' : 'Executar'} <span className="eq-kbd">Ctrl Enter</span>
            </button>
            {!ch.ladder && ch.hints.length > 0 && attempts > 0 && hintsShown < ch.hints.length && !solved && (
              <button className="eq-btn" onClick={() => setHintsShown((h) => h + 1)}>
                <Lightbulb className="size-4 text-[var(--eq-gold)]" /> Pedir uma pista a {speaker?.name.split(' ')[0]}
              </button>
            )}
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

          <div ref={feedback} />
          {message && (
            <p
              role="status"
              className={`rounded-md border-l-4 px-3 py-2 text-sm leading-relaxed ${
                message.tone === 'good' ? 'border-[var(--eq-good)] bg-[#0d2a1d]' : message.tone === 'bad' ? 'border-[var(--eq-bad)] bg-[#2a1414]' : 'border-[var(--eq-cyan)] bg-[#0c2230]'
              }`}
            >
              <span className="sr-only">{message.tone === 'good' ? 'Sucesso: ' : message.tone === 'bad' ? 'Ainda não: ' : ''}</span>
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
          {ch.hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="rounded-md bg-[#2a2112] px-3 py-2 text-sm">
              <Lightbulb className="mr-1 inline size-4 text-[var(--eq-gold)]" aria-hidden /> {h}
            </p>
          ))}

          {out?.error && !message && <p className="font-mono text-sm text-[var(--eq-bad)]">{out.error}</p>}
          {out?.result && <ResultTable result={out.result} />}
        </div>

        <aside className="border-t-2 border-[var(--eq-edge-dark)] p-4 lg:border-t-0 lg:border-l-2" aria-label="Esquema do banco">
          <p className="mb-2 text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">Banco: {ch.inline ? 'gerado para este exercício' : ch.database}</p>
          <ul className="space-y-3 font-mono text-sm">
            {schema.map((t) => (
              <li key={t.table}>
                <button
                  className="font-semibold text-[var(--eq-cyan)] hover:underline"
                  title="Inserir no editor"
                  onClick={() => setQuery((q) => (q.trim() && q !== ch.starter ? q : `SELECT *\nFROM ${t.table}\nLIMIT 5;`))}
                >
                  {t.table}
                </button>
                <ul className="mt-1 border-l border-[var(--eq-edge-dark)] pl-3 text-[var(--eq-muted)]">
                  {t.columns.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-[var(--eq-muted)]">Pode experimentar à vontade: cada execução usa uma cópia nova do banco.</p>
        </aside>
      </div>
    </div>
  )
}

