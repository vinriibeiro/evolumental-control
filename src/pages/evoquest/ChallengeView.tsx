// Interface de resposta para cada tipo de desafio. Cada visualização mantém o
// próprio rascunho e informa ao pai a resposta atual (ou null se incompleta).
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Turtle, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Input, Select, Textarea } from '@/components/ui/Field'
import type { Challenge, DataTable, Response, StepChallenge } from '@/game/types'
import { speak, speechAvailable } from '@/game/speech'
import { diffWords } from '@/game/engine/dictation'

/** Embaralhamento determinístico (mesma ordem ao recarregar a mesma tentativa). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function TableView({ table }: { table: DataTable }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs sm:text-sm">
        {table.caption && <caption className="bg-surface px-3 py-1.5 text-left text-xs font-medium text-muted">{table.caption}</caption>}
        <thead className="bg-surface">
          <tr>
            {table.columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-1.5 font-semibold whitespace-nowrap text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((v, j) => (
                <td key={j} className="tabular px-3 py-1.5 whitespace-pre text-ink">
                  {v == null ? <span className="text-muted italic">null</span> : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CodeBlock({ source, lang }: { source: string; lang?: string }) {
  return (
    <pre className="scroll-thin overflow-x-auto rounded-lg bg-brown p-3 font-mono text-xs leading-relaxed text-wheat sm:text-sm" aria-label={lang ? `Código ${lang.toUpperCase()}` : 'Código'}>
      <code>{source}</code>
    </pre>
  )
}

function OptionButton({ selected, onClick, children, index, state }: { selected: boolean; onClick: () => void; children: ReactNode; index?: number; state?: 'right' | 'wrong' | null }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors',
        state === 'right' ? 'border-success bg-success/10 text-ink' : state === 'wrong' ? 'border-danger bg-danger/10 text-ink' : selected ? 'border-accent-strong bg-accent/25 text-ink' : 'border-line bg-bg text-ink hover:border-accent hover:bg-surface',
      )}
    >
      {index != null && <kbd className="hidden size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-xs text-muted sm:inline-flex">{index + 1}</kbd>}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

function Choices({ options, value, onChange, seed, locked, answer }: { options: string[]; value: number | null; onChange: (i: number) => void; seed: string; locked?: boolean; answer?: number }) {
  const order = useMemo(() => seededShuffle(options.map((_, i) => i), seed), [options, seed])
  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      const n = Number(e.key)
      if (n >= 1 && n <= order.length) onChange(order[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order, onChange, locked])
  return (
    <div role="radiogroup" aria-label="Alternativas" className="flex flex-col gap-2">
      {order.map((i, pos) => (
        <OptionButton
          key={i}
          index={pos}
          selected={value === i}
          onClick={() => !locked && onChange(i)}
          state={locked && answer != null ? (i === answer ? 'right' : value === i ? 'wrong' : null) : null}
        >
          {options[i]}
        </OptionButton>
      ))}
    </div>
  )
}

/** Campo embutido no texto (lacunas): não usa os controles de largura total. */
const INLINE = 'mx-1 my-0.5 inline-block h-9 max-w-[calc(100%-0.5rem)] rounded-lg border border-line bg-bg px-2 align-middle text-sm text-ink focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/40'

function Blanks({ template, blanks, values, onChange, mono, seed }: { template: string; blanks: Array<{ accept: string[]; options?: string[] }>; values: string[]; onChange: (v: string[]) => void; mono?: boolean; seed: string }) {
  const parts = template.split('___')
  const set = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)))
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-3 text-sm leading-loose text-ink sm:text-base', mono && 'font-mono text-xs whitespace-pre-wrap sm:text-sm')}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < blanks.length &&
            (blanks[i].options ? (
              <select aria-label={`Lacuna ${i + 1}`} value={values[i] ?? ''} onChange={(e) => set(i, e.target.value)} className={cn(INLINE, 'min-w-24 pr-2')}>
                <option value="">—</option>
                {seededShuffle(blanks[i].options!, `${seed}:${i}`).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={`Lacuna ${i + 1}`}
                value={values[i] ?? ''}
                onChange={(e) => set(i, e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={cn(INLINE, 'w-32 sm:w-40', mono && 'font-mono')}
              />
            ))}
        </span>
      ))}
    </div>
  )
}

function parseNumber(s: string): number {
  const t = s.trim().replace(/\s/g, '').replace('%', '')
  // Aceita vírgula decimal e separador de milhar com ponto (1.234,5).
  const n = /,\d+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  return n === '' ? NaN : Number(n)
}

function StepView({ step, value, onChange, seed }: { step: StepChallenge; value: Response | null; onChange: (r: Response | null) => void; seed: string }) {
  const [text, setText] = useState('')
  switch (step.type) {
    case 'mcq':
      return <Choices options={step.options} value={value?.type === 'mcq' ? value.choice : null} onChange={(choice) => onChange({ type: 'mcq', choice })} seed={seed} />
    case 'tf':
      return <TrueFalse value={value?.type === 'tf' ? value.value : null} onChange={(v) => onChange({ type: 'tf', value: v })} />
    case 'numeric':
    case 'short':
      return (
        <Input
          aria-label="Resposta"
          inputMode={step.type === 'numeric' ? 'decimal' : 'text'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (step.type === 'numeric') {
              const v = parseNumber(e.target.value)
              onChange(Number.isFinite(v) ? { type: 'numeric', value: v } : null)
            } else onChange(e.target.value.trim() ? { type: 'short', text: e.target.value } : null)
          }}
          className="h-11 max-w-xs text-base"
        />
      )
  }
}

function TrueFalse({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div role="radiogroup" aria-label="Verdadeiro ou falso" className="grid grid-cols-2 gap-2">
      <OptionButton selected={value === true} onClick={() => onChange(true)}>
        <span className="block text-center">Verdadeiro</span>
      </OptionButton>
      <OptionButton selected={value === false} onClick={() => onChange(false)}>
        <span className="block text-center">Falso</span>
      </OptionButton>
    </div>
  )
}

function ListenPlayer({ text, lang, onFallback, autoPlay }: { text: string; lang: string; onFallback: () => void; autoPlay?: boolean }) {
  const supported = speechAvailable()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!autoPlay || !supported) return
    const t = setTimeout(() => speak(text, lang, 1), 250)
    return () => clearTimeout(t)
  }, [autoPlay, supported, text, lang])
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
      {supported ? (
        <>
          <button type="button" onClick={() => speak(text, lang, 1)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
            <Volume2 className="size-5" aria-hidden /> Ouvir
          </button>
          <button type="button" onClick={() => speak(text, lang, 0.6)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-bg px-4 text-sm font-medium text-ink hover:bg-surface-2">
            <Turtle className="size-5" aria-hidden /> Devagar
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">Seu navegador não oferece leitura em voz alta.</p>
      )}
      {shown ? (
        <p className="w-full rounded-lg bg-bg px-3 py-2 text-sm text-ink" lang={lang}>
          “{text}”
        </p>
      ) : (
        <button
          type="button"
          className="ml-auto text-xs text-muted underline underline-offset-2 hover:text-ink"
          onClick={() => {
            setShown(true)
            onFallback()
          }}
        >
          Não consigo ouvir — mostrar o texto
        </button>
      )}
    </div>
  )
}

/** Texto lido no botão de áudio do enunciado (inclui as alternativas, quando houver). */
function promptSpeech(c: Challenge): string {
  const opts = c.type === 'mcq' ? c.options : c.type === 'tf' ? ['Verdadeiro', 'Falso'] : []
  return [c.context, c.prompt, ...opts.map((o, i) => `Opção ${i + 1}: ${o}.`)].filter(Boolean).join(' ')
}

export interface ChallengeViewProps {
  challenge: Challenge
  seed: string
  onChange: (r: Response | null) => void
  /** O áudio foi substituído pelo texto (conta como dica). */
  onTranscript?: () => void
}

/** Prompt, contexto, tabela/código e área de resposta. */
export function ChallengeView({ challenge: c, seed, onChange, onTranscript }: ChallengeViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {c.context && <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">{c.context}</p>}
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-base leading-snug font-semibold text-ink sm:text-lg">{c.prompt}</h2>
        {speechAvailable() && (
          <button
            type="button"
            onClick={() => speak(promptSpeech(c), 'pt-BR', 1)}
            aria-label="Ouvir o enunciado"
            title="Ouvir o enunciado"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink"
          >
            <Volume2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {c.table && <TableView table={c.table} />}
      {c.code && c.type !== 'code_complete' && <CodeBlock source={c.code.source} lang={c.code.lang} />}
      <Answer key={c.id + seed} c={c} seed={seed} onChange={onChange} onTranscript={onTranscript} />
    </div>
  )
}

function Answer({ c, seed, onChange, onTranscript }: { c: Challenge; seed: string; onChange: (r: Response | null) => void; onTranscript?: () => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [bool, setBool] = useState<boolean | null>(null)
  const [values, setValues] = useState<string[]>(() => ('blanks' in c ? c.blanks.map(() => '') : []))
  const [text, setText] = useState('')
  const rights = useMemo(() => (c.type === 'match' ? seededShuffle(c.pairs.map((p) => p[1]), seed) : []), [c, seed])
  const [pairs, setPairs] = useState<Record<string, string>>({})
  const [items, setItems] = useState<string[]>(() => (c.type === 'order' ? seededShuffle(c.items, seed) : []))
  const [assign, setAssign] = useState<Record<string, number>>({})
  const [steps, setSteps] = useState<Array<Response | null>>(() => (c.type === 'multistep' ? c.steps.map(() => null) : []))
  const [dragging, setDragging] = useState<string | null>(null)

  // Garante que a ordem inicial embaralhada não seja, por acaso, a correta.
  useEffect(() => {
    if (c.type === 'order' && items.every((x, i) => x === c.items[i])) setItems([...items.slice(1), items[0]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Comunica a resposta atual ao pai.
  useEffect(() => {
    switch (c.type) {
      case 'mcq':
      case 'listen':
        return onChange(choice == null ? null : { type: c.type, choice })
      case 'tf':
        return onChange(bool == null ? null : { type: 'tf', value: bool })
      case 'find_error':
        return onChange(choice == null ? null : { type: 'find_error', index: choice })
      case 'fill':
      case 'code_complete':
        return onChange(values.every((v) => v.trim()) ? { type: c.type, values } : null)
      case 'match':
        return onChange(Object.keys(pairs).length === c.pairs.length ? { type: 'match', pairs } : null)
      case 'order':
        return onChange({ type: 'order', items })
      case 'categorize':
        return onChange(Object.keys(assign).length === c.items.length ? { type: 'categorize', assignment: assign } : null)
      case 'numeric': {
        const v = parseNumber(text)
        return onChange(Number.isFinite(v) ? { type: 'numeric', value: v } : null)
      }
      case 'short':
      case 'code_output':
      case 'dictation':
        return onChange(text.trim() ? { type: c.type, text } : null)
      case 'multistep':
        return onChange(steps.every(Boolean) ? { type: 'multistep', steps: steps as Response[] } : null)
      default:
        return onChange(null)
    }
  }, [choice, bool, values, pairs, items, assign, text, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  switch (c.type) {
    case 'mcq':
      return <Choices options={c.options} value={choice} onChange={setChoice} seed={seed} />
    case 'listen':
      return (
        <div className="flex flex-col gap-3">
          <ListenPlayer text={c.say} lang={c.lang ?? 'en-US'} onFallback={() => onTranscript?.()} />
          <Choices options={c.options} value={choice} onChange={setChoice} seed={seed} />
        </div>
      )
    case 'dictation':
      return (
        <div className="flex flex-col gap-3">
          <ListenPlayer text={c.say} lang={c.lang ?? 'en-US'} onFallback={() => onTranscript?.()} autoPlay />
          <Textarea
            aria-label="Escreva o que você ouviu"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            lang={c.lang ?? 'en-US'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Escreva o que você ouviu…"
            className="text-base"
          />
          <p className="text-xs text-muted">Pontuação e maiúsculas não contam. Ouça quantas vezes quiser.</p>
        </div>
      )
    case 'tf':
      return <TrueFalse value={bool} onChange={setBool} />
    case 'fill':
      return <Blanks template={c.template} blanks={c.blanks} values={values} onChange={setValues} seed={seed} />
    case 'code_complete':
      return <Blanks template={c.template} blanks={c.blanks} values={values} onChange={setValues} mono seed={seed} />
    case 'match':
      return (
        <div className="flex flex-col gap-2">
          {c.pairs.map(([left]) => (
            <label key={left} className="grid grid-cols-1 items-center gap-1.5 rounded-xl border border-line bg-bg p-2.5 sm:grid-cols-2 sm:gap-3">
              <span className="text-sm font-medium text-ink">{left}</span>
              <Select value={pairs[left] ?? ''} onChange={(e) => setPairs((p) => ({ ...p, [left]: e.target.value }))} aria-label={`Par de ${left}`} className="h-10">
                <option value="">Escolha…</option>
                {rights.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
      )
    case 'order':
      return (
        <ol className="flex flex-col gap-2" aria-label="Itens para ordenar">
          {items.map((it, i) => (
            <li key={it} className="flex items-center gap-2 rounded-xl border border-line bg-bg p-2 pl-3">
              <span className="tabular w-5 shrink-0 text-xs font-semibold text-muted">{i + 1}.</span>
              <span className="min-w-0 flex-1 text-sm text-ink">{it}</span>
              <button
                type="button"
                aria-label={`Subir "${it}"`}
                disabled={i === 0}
                onClick={() => setItems((xs) => { const n = [...xs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Descer "${it}"`}
                disabled={i === items.length - 1}
                onClick={() => setItems((xs) => { const n = [...xs]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )
    case 'categorize': {
      const pending = c.items.filter((it) => assign[it.text] == null)
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">Arraste cada item para uma categoria — ou toque na categoria ao lado do item.</p>
          <div className="flex flex-col gap-2">
            {c.items.map((it) => (
              <div
                key={it.text}
                draggable
                onDragStart={() => setDragging(it.text)}
                onDragEnd={() => setDragging(null)}
                className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-2.5 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1 cursor-grab text-sm text-ink">{it.text}</span>
                <div role="radiogroup" aria-label={`Categoria de ${it.text}`} className="flex flex-wrap gap-1">
                  {c.categories.map((cat, ci) => (
                    <button
                      key={cat}
                      type="button"
                      role="radio"
                      aria-checked={assign[it.text] === ci}
                      onClick={() => setAssign((a) => ({ ...a, [it.text]: ci }))}
                      className={cn('min-h-9 rounded-lg border px-2.5 text-xs font-medium', assign[it.text] === ci ? 'border-accent-strong bg-accent/30 text-ink' : 'border-line text-muted hover:text-ink')}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-2 gap-2 sm:grid lg:grid-cols-4">
            {c.categories.map((cat, ci) => (
              <div
                key={cat}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragging && setAssign((a) => ({ ...a, [dragging]: ci }))}
                className={cn('min-h-20 rounded-xl border-2 border-dashed p-2 text-xs', dragging ? 'border-accent-strong bg-accent/10' : 'border-line')}
              >
                <p className="mb-1 font-semibold text-ink">{cat}</p>
                {c.items.filter((it) => assign[it.text] === ci).map((it) => (
                  <p key={it.text} className="truncate text-muted">
                    {it.text}
                  </p>
                ))}
              </div>
            ))}
          </div>
          {pending.length > 0 && <p className="text-xs text-muted">Faltam {pending.length} item(ns).</p>}
        </div>
      )
    }
    case 'find_error':
      return (
        <div role="radiogroup" aria-label="Trechos" className="flex flex-col gap-2">
          {c.tokens.map((t, i) => (
            <OptionButton key={i} selected={choice === i} onClick={() => setChoice(i)}>
              <code className="font-mono text-xs whitespace-pre-wrap sm:text-sm">{t}</code>
            </OptionButton>
          ))}
        </div>
      )
    case 'numeric':
      return (
        <div className="flex items-center gap-2">
          <Input aria-label="Resposta numérica" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: 12,5" className="h-12 max-w-xs text-lg" />
          {c.unit && <span className="text-sm text-muted">{c.unit}</span>}
        </div>
      )
    case 'short':
      return <Input aria-label="Sua resposta" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="h-12 text-base" />
    case 'code_output':
      return <Textarea aria-label="Saída do código" value={text} onChange={(e) => setText(e.target.value)} rows={2} spellCheck={false} className="font-mono text-sm" placeholder="Digite exatamente o que aparece" />
    case 'multistep':
      return (
        <ol className="flex flex-col gap-4">
          {c.steps.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-line bg-bg p-3">
              <p className="mb-2 text-sm font-medium text-ink">
                <span className="mr-1 text-muted">Etapa {i + 1}.</span> {s.prompt}
              </p>
              <StepView step={s} seed={`${seed}:${i}`} value={steps[i]} onChange={(r) => setSteps((xs) => xs.map((x, j) => (j === i ? r : x)))} />
            </li>
          ))}
        </ol>
      )
    default:
      return null
  }
}

/** Correção do ditado palavra a palavra. */
export function DictationDiff({ expected, typed }: { expected: string; typed: string }) {
  const { tokens } = diffWords(expected, typed)
  return (
    <p className="mt-1 flex flex-wrap gap-1 text-sm" aria-label="Correção palavra por palavra">
      {tokens.map((t, i) => (
        <span
          key={i}
          className={cn(
            'rounded px-1',
            t.status === 'ok' && 'bg-success/15 text-ink',
            t.status === 'missing' && 'bg-danger/15 font-semibold text-danger',
            t.status === 'extra' && 'text-muted line-through',
          )}
          title={t.status === 'missing' ? 'Faltou' : t.status === 'extra' ? 'A mais / diferente' : 'Certo'}
        >
          {t.word}
        </span>
      ))}
    </p>
  )
}
