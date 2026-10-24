import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Lightbulb, Radio, Send, Turtle, Volume2, X } from 'lucide-react'
import { speakAll, speechAvailable } from '@/game/speech'
import { canonEnAnswer, canonEnField, enFeedback, sha256, type EnChallenge, type EnInput } from '../challenges'
import { WORLD } from '../content'
import { canReveal, FULL_EXPLANATION, recordAttempt, reveal, startLadder, STAGE_LABELS, type HelpLevel } from '../engine/pedagogy'
import { useRecordEvidence, type EvidenceOutcome } from './evidence'
import { LessonCard } from './LessonCard'
import { Portrait } from './Portrait'
import { play } from './audio'

interface Props {
  challenge: EnChallenge
  sound: boolean
  /** Chamado com a resposta canônica quando a resposta confere. */
  onSolved: (answer: string) => Promise<boolean> | boolean
  onClose: () => void
}

/**
 * Rádio do mundo (inglês). O jogador ouve a transmissão pela voz do próprio
 * navegador (normal ou devagar, quantas vezes quiser) e responde: escreve o
 * que ouviu (ditado) ou preenche o registro (números, nomes soletrados,
 * horas). A resposta canônica é comparada por hash e o servidor confere o
 * mesmo hash.
 *
 * Mesmo modelo pedagógico dos terminais: ficha de campo, escada de pistas
 * (cada degrau só abre depois de uma nova tentativa) e evidência de domínio
 * com o nível de ajuda usado. Mostrar a transcrição vale como a explicação
 * completa: a atividade passa a ser leitura, não escuta, e conta só como
 * contato com o conceito.
 */
export function EnTerminal({ challenge: ch, sound, onSolved, onClose }: Props) {
  const [text, setText] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [partOk, setPartOk] = useState<boolean[] | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [ladder, setLadder] = useState(startLadder)
  const [transcript, setTranscript] = useState(false)
  const [plays, setPlays] = useState(0)
  const [solved, setSolved] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceOutcome | null>(null)
  const recorded = useRef(false)
  const record = useRecordEvidence()
  const first = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const speaker = WORLD.speakers[ch.speaker]
  const lesson = ch.lesson ? WORLD.lessons[ch.lesson] : undefined
  const lang = ch.lang ?? 'en-US'
  const supported = speechAvailable()
  const attempts = ladder.attempts
  const steps = ch.ladder ? [...ch.ladder, ...(ch.explanation ? [ch.explanation] : [])] : []
  const hintCount = ch.ladder?.length ?? 0
  const isForm = ch.task.type === 'form'
  const fields = ch.task.type === 'form' ? ch.task.fields : []
  /** Nível de ajuda que vai com a evidência: a transcrição equivale à explicação completa. */
  const help: HelpLevel = transcript ? (FULL_EXPLANATION as HelpLevel) : ladder.level

  useEffect(() => {
    first.current?.focus()
    play('open', sound)
  }, [sound])

  useEffect(() => {
    if (message || ladder.level) feedback.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [message, ladder.level])

  const listen = (rate: number) => {
    speakAll(
      ch.lines.map((l) => l.say),
      lang,
      rate,
    )
    setPlays((n) => n + 1)
  }

  // Sair depois de tentar sem resolver também é evidência (de dificuldade).
  const close = () => {
    if (ch.stage && !solved && !recorded.current && ladder.attempts > 0) {
      recorded.current = true
      void record(ch, { help, attempts: ladder.attempts, solved: false, answer: null })
    }
    onClose()
  }

  const input: EnInput = isForm ? values : text
  const filled = isForm ? fields.every((f) => (values[f.id] ?? '').trim()) : text.trim().length > 0

  const submit = async () => {
    if (busy || solved) return
    setBusy(true)
    setMessage(null)
    const answer = canonEnAnswer(ch, input)
    const ok = isForm ? await Promise.all(fields.map(async (f, i) => (await sha256(canonEnField(values[f.id] ?? '', f.normalize))) === ch.expect.parts[i])) : []
    setPartOk(ok)
    if (filled && (await sha256(answer)) === ch.expect.hash) {
      const accepted = await onSolved(answer)
      if (accepted !== false) {
        setSolved(true)
        setBusy(false)
        setMessage({ tone: 'good', text: ch.success })
        play('success', sound)
        if (ch.stage && !recorded.current) {
          recorded.current = true
          void record(ch, { help, attempts: ladder.attempts + 1, solved: true, answer }).then(setEvidence)
        }
        return
      }
    }
    setBusy(false)
    setLadder(recordAttempt)
    setMessage({ tone: 'bad', text: enFeedback(ch, input, ok) })
    play('error', sound)
  }

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    e.stopPropagation()
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
      return
    }
    if (e.key === 'Escape') close()
  }

  const nextIsExplanation = ladder.level + 1 >= FULL_EXPLANATION
  const ladderOpen = Boolean(ch.ladder) && !solved && ladder.level < steps.length
  const showText = transcript || solved

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={ch.title}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <Radio className="size-5 text-[var(--eq-cyan)]" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate font-semibold tracking-wide">{ch.title}</h2>
        {ch.stage && <span className="hidden rounded border border-[var(--eq-edge-dark)] px-2 py-0.5 text-xs text-[var(--eq-muted)] sm:inline">{STAGE_LABELS[ch.stage]}</span>}
        <button className="eq-btn" onClick={close} aria-label="Fechar rádio">
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
                {ch.lines.length === 1 ? 'Uma fala' : `${ch.lines.length} falas`} em inglês. Ouça quantas vezes quiser; pontuação e maiúsculas não importam
                {isForm ? '; números podem ser escritos em algarismos ou por extenso.' : '.'}
              </p>
            </div>
          </div>

          {lesson && <LessonCard lesson={lesson} defaultOpen={ch.stage === 'guided'} showMistakes={attempts > 0} />}

          <section className="rounded-md border-2 border-[#1f3140] bg-[#07121a] p-3" aria-label="Transmissão">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-xs font-semibold tracking-wider text-[var(--eq-cyan)] uppercase">Transmissão</p>
              {supported ? (
                <>
                  <button className="eq-btn eq-btn-primary" onClick={() => listen(1)} disabled={solved && !showText}>
                    <Volume2 className="size-4" /> Ouvir
                  </button>
                  <button className="eq-btn" onClick={() => listen(0.6)}>
                    <Turtle className="size-4" /> Devagar
                  </button>
                </>
              ) : (
                <p className="text-xs text-[var(--eq-muted)]">Seu navegador não oferece leitura em voz alta.</p>
              )}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {ch.lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-xs font-semibold text-[var(--eq-muted)]">{l.who}:</span>
                  {showText ? (
                    <span lang={lang} className="text-[#d7f3ff]">
                      “{l.say}”
                    </span>
                  ) : (
                    <span className="text-[var(--eq-muted)]" aria-label="fala não transcrita">
                      {plays ? '♪ ' : ''}
                      {'▮'.repeat(Math.min(24, Math.max(6, Math.round(l.say.length / 4))))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!showText && (
              <button
                type="button"
                className="mt-2 text-xs text-[var(--eq-muted)] underline underline-offset-2 hover:text-[var(--eq-ink,#fff)]"
                onClick={() => {
                  setTranscript(true)
                  setPlays((n) => n + 1)
                }}
              >
                Não consigo ouvir — mostrar a transcrição (conta como contato, não como escuta)
              </button>
            )}
            {transcript && !solved && <p className="mt-2 text-xs text-[var(--eq-muted)]">Com a transcrição à vista, a atividade vira leitura: ao resolver, ela conta como contato com o conceito, não como domínio de escuta.</p>}
            {solved && <p className="mt-2 text-sm text-[var(--eq-muted)]">Tradução: {ch.translation}</p>}
          </section>

          {isForm ? (
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Registro">
              {fields.map((f, i) => (
                <label key={f.id} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">
                    {f.label}
                    {partOk && !solved && <span className={`ml-2 text-xs ${partOk[i] ? 'text-[var(--eq-good)]' : 'text-[var(--eq-bad)]'}`}>{partOk[i] ? '✓ confere' : '✗ não confere'}</span>}
                  </span>
                  <input
                    ref={i === 0 ? (first as React.RefObject<HTMLInputElement>) : undefined}
                    value={values[f.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    onKeyDown={onKey}
                    placeholder={f.placeholder}
                    inputMode={f.normalize === 'digits' ? 'numeric' : 'text'}
                    autoComplete="off"
                    autoCapitalize={f.normalize === 'letters' ? 'characters' : 'off'}
                    spellCheck={false}
                    readOnly={solved}
                    className="h-11 rounded-md border-2 border-[#1f3140] bg-[#07121a] px-3 font-mono text-[#d7f3ff] caret-[var(--eq-cyan)] outline-none focus:border-[var(--eq-cyan)]"
                  />
                </label>
              ))}
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="eq-en">
                {ch.task.type === 'dictation' ? ch.task.prompt : 'Resposta'}
              </label>
              <textarea
                id="eq-en"
                ref={first as React.RefObject<HTMLTextAreaElement>}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                lang={lang}
                rows={3}
                readOnly={solved}
                placeholder={ch.task.type === 'dictation' ? ch.task.prompt : ''}
                className="w-full resize-y rounded-md border-2 border-[#1f3140] bg-[#07121a] p-3 text-sm leading-relaxed text-[#d7f3ff] caret-[var(--eq-cyan)] outline-none focus:border-[var(--eq-cyan)]"
              />
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button className="eq-btn eq-btn-primary" onClick={() => void submit()} disabled={busy || solved}>
              <Send className="size-4" /> Transmitir resposta <span className="eq-kbd">Ctrl Enter</span>
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
        </div>

        <aside className="border-t-2 border-[var(--eq-edge-dark)] p-4 lg:border-t-0 lg:border-l-2" aria-label="Como ouvir">
          <p className="mb-2 text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">Como ouvir</p>
          <ul className="space-y-2 text-xs leading-relaxed text-[var(--eq-muted)]">
            <li>Ouça inteiro uma vez, sem anotar. Depois, devagar, anotando uma informação de cada vez.</li>
            <li>Números: de 0 a 12 têm nome próprio; de 13 a 19 terminam em -teen; as dezenas terminam em -ty (fifteen ≠ fifty).</li>
            <li>Nomes soletrados: anote letra por letra como foi dito, não como você acha que se escreve.</li>
            {isForm && <li>Nos campos numéricos, "15" e "fifteen" valem o mesmo.</li>}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-[var(--eq-muted)]">A voz é do seu próprio navegador: nada é enviado a serviços externos. Vozes variam por sistema; se nenhuma falar inglês, use a transcrição.</p>
        </aside>
      </div>
    </div>
  )
}
