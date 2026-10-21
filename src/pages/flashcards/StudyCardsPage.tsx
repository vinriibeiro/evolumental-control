import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Eye, Headphones, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Select } from '@/components/ui/Field'
import { Badge, Card, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { invalidateTables, useTransaction } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useSpeech } from '@/hooks/useSpeech'
import { eq, inList, lte, type Filter } from '@/lib/data/types'
import { RATING_LABELS, previewIntervals, reviewPriority, type Rating } from '@/lib/srs'
import { formatDuration } from '@/lib/time'
import { reviewCard } from '@/services/flashcards'
import { addManualSession } from '@/services/sessions'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import type { Flashcard } from '@/types/db'

type Mode = 'vencidos' | 'todos' | 'aleatorio' | 'selecionados' | 'continuo'
const MODE_TITLES: Record<Mode, string> = {
  vencidos: 'Cartões vencidos',
  todos: 'Todos os cartões',
  aleatorio: 'Revisão aleatória',
  selecionados: 'Cartões selecionados',
  continuo: 'Modo contínuo (escuta)',
}
const RATING_STYLES: Record<Rating, string> = {
  1: 'border-danger/50 hover:bg-danger/10',
  2: 'border-warning/50 hover:bg-warning/10',
  3: 'border-success/50 hover:bg-success/10',
  4: 'border-info/50 hover:bg-info/10',
}
const ACTIVE = ['new', 'learning', 'review']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function StudyCardsPage() {
  const [params] = useSearchParams()
  const mode = (params.get('modo') as Mode) || 'vencidos'
  const backend = useBackend()
  const scope: Filter[] = [
    ...(params.get('baralho') ? [eq('deck_id', params.get('baralho'))] : []),
    ...(params.get('topico') ? [eq('topic_id', params.get('topico'))] : []),
    ...(params.get('materia') ? [eq('subject_id', params.get('materia'))] : []),
  ]
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 1000)

  // A fila é montada uma única vez por sessão de estudo (não recarrega ao responder).
  const deck = useQuery({
    queryKey: ['study-queue', backend.kind, params.toString()],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Flashcard[]> => {
      if (mode === 'selecionados') {
        const { rows } = await backend.list('flashcards', { filters: [inList('id', ids)] })
        const order = new Map(ids.map((id, i) => [id, i]))
        return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      }
      if (mode === 'vencidos') {
        const { rows } = await backend.list('flashcards', { filters: [...scope, inList('status', ACTIVE), lte('due_at', new Date().toISOString())], order: [{ column: 'due_at' }], limit: 500 })
        return reviewPriority(rows)
      }
      const { rows } = await backend.list('flashcards', { filters: [...scope, inList('status', ACTIVE)], order: [{ column: 'due_at' }], limit: 2000 })
      return mode === 'aleatorio' ? shuffle(rows).slice(0, 200) : rows
    },
  })

  if (deck.isPending) return <Spinner label="Montando a revisão…" />
  if (deck.isError) return <ErrorState error={deck.error} onRetry={() => deck.refetch()} />
  if (deck.data.length === 0)
    return (
      <EmptyState
        icon={<CheckCircle2 className="size-8" />}
        title={mode === 'vencidos' ? 'Nenhum cartão vencido agora' : 'Nenhum cartão para estudar'}
        description={mode === 'vencidos' ? 'Tudo em dia! Você pode praticar todos os cartões mesmo assim.' : undefined}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/flashcards" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm">
              Voltar
            </Link>
            {mode === 'vencidos' && (
              <Link to={`/flashcards/revisar?${new URLSearchParams({ ...Object.fromEntries(params), modo: 'todos' })}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
                Praticar todos
              </Link>
            )}
          </div>
        }
      />
    )
  return <StudySession initial={deck.data} mode={mode} />
}

function StudySession({ initial, mode }: { initial: Flashcard[]; mode: Mode }) {
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const speech = useSpeech({ voiceURI: settings.voiceURI, rate: settings.speechRate })
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [queue, setQueue] = useState<Flashcard[]>(initial)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [record, setRecord] = useState(mode !== 'continuo')
  const [results, setResults] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [continuous, setContinuous] = useState(mode === 'continuo')
  const [thinkSeconds, setThinkSeconds] = useState(4)
  const [startedAt] = useState(() => Date.now())
  const [savedSession, setSavedSession] = useState(false)
  const relapses = useRef(new Map<string, number>())
  const answering = useRef(false)
  const runId = useRef(0)

  const review = useTransaction(['flashcards', 'flashcard_reviews'], (b, a: { card: Flashcard; rating: Rating; reviewId: string }) => reviewCard(b, a.card, a.rating, settings.srs, a.reviewId))
  const saveSession = useTransaction(['study_sessions'], (b, minutes: number) =>
    addManualSession(b, { subject_id: null, topic_id: null, activity_type: 'flashcards', started_at: startedAt, duration_minutes: minutes, notes: `Revisão de flashcards (${MODE_TITLES[mode]})` }),
  )

  const card = queue[idx]
  const done = idx >= queue.length
  const preview = useMemo(() => (card ? previewIntervals(card, Date.now(), settings.srs) : null), [card, settings.srs])

  // Leitura automática da pergunta ao trocar de cartão (não no modo contínuo, que tem seu próprio fluxo).
  useEffect(() => {
    if (!card || continuous || !settings.autoRead || !speech.supported) return
    void speech.speak([card.front])
  }, [card?.id, continuous, settings.autoRead]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao sair da tela, interrompe qualquer fala.
  useEffect(() => () => speech.stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = useCallback(() => {
    if (revealed || !card) return
    setRevealed(true)
    if (settings.autoRead && !continuous && speech.supported) void speech.speak([card.back])
  }, [revealed, card, settings.autoRead, continuous, speech])

  const next = useCallback(() => {
    setRevealed(false)
    setIdx((i) => i + 1)
  }, [])

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || !revealed || answering.current) return
      answering.current = true
      speech.stop()
      try {
        if (record) await review.mutateAsync({ card, rating, reviewId: crypto.randomUUID() })
        setResults((r) => ({ ...r, [rating]: r[rating] + 1 }))
        // "Errei" volta para o fim da fila desta sessão (até 2 vezes).
        if (rating === 1 && (relapses.current.get(card.id) ?? 0) < 2) {
          relapses.current.set(card.id, (relapses.current.get(card.id) ?? 0) + 1)
          setQueue((q) => [...q, card])
        }
        next()
      } catch (e) {
        toast.error(e)
      } finally {
        answering.current = false
      }
    },
    [card, revealed, record, review, next, speech, toast],
  )

  // Modo contínuo: lê pergunta → pausa para pensar → revela e lê resposta → próximo.
  useEffect(() => {
    if (!continuous || !card || !speech.supported) return
    const my = ++runId.current
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      const ok1 = await speech.speak([card.front])
      if (!ok1 || my !== runId.current) return
      await wait(thinkSeconds * 1000)
      if (my !== runId.current) return
      setRevealed(true)
      const ok2 = await speech.speak([card.back])
      if (!ok2 || my !== runId.current) return
      await wait(1200)
      if (my !== runId.current) return
      next()
    })()
    const ref = runId
    return () => {
      ref.current++
    }
  }, [continuous, card?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopContinuous = () => {
    runId.current++
    setContinuous(false)
    speech.stop()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || continuous) return
      if ((e.code === 'Space' || e.key === 'Enter') && !revealed) {
        e.preventDefault()
        reveal()
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        void rate(Number(e.key) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, reveal, rate, continuous])

  if (done) {
    const total = Object.values(results).reduce((a, b) => a + b, 0)
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h1 className="mt-3 text-lg font-semibold text-ink">Revisão concluída</h1>
          <p className="mt-1 text-sm text-muted">
            {total > 0 ? `${total} resposta(s) ${record ? 'registradas' : '(prática, sem alterar o agendamento)'}` : `${queue.length} cartão(ões) ouvidos`} em cerca de {formatDuration(minutes * 60)}.
          </p>
          {total > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as Rating[]).map((r) => (
                <div key={r} className="rounded-lg bg-surface p-2">
                  <p className="tabular text-lg font-semibold text-ink">{results[r]}</p>
                  <p className="text-xs text-muted">{RATING_LABELS[r]}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {minutes >= 1 && !savedSession && (
              <Button
                loading={saveSession.isPending}
                onClick={async () => {
                  try {
                    await saveSession.mutateAsync(minutes)
                    setSavedSession(true)
                    toast.success('Tempo registrado como sessão de estudo (Flashcards).')
                  } catch (e) {
                    toast.error(e)
                  }
                }}
              >
                Registrar {minutes} min como sessão de estudo
              </Button>
            )}
            <Button variant="primary" onClick={() => (invalidateTables(qc, ['flashcards']), navigate(-1))}>
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => (speech.stop(), navigate(-1))} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Sair
        </button>
        <span className="text-sm font-medium text-ink">{MODE_TITLES[mode]}</span>
        <span className="tabular text-sm text-muted">
          {idx + 1}/{queue.length}
        </span>
      </div>
      <Progress value={(idx / queue.length) * 100} className="mb-4" label="Progresso da revisão" />

      <Card className="overflow-hidden">
        <div className="min-h-48 p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {card.tags.slice(0, 5).map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
          </div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Pergunta</p>
          <p className="mt-2 text-lg leading-relaxed break-words whitespace-pre-wrap text-ink sm:text-xl">{card.front}</p>
          {revealed ? (
            <div className="animate-fade-in mt-6 border-t border-line pt-6">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Resposta</p>
              <p className="mt-2 text-lg leading-relaxed break-words whitespace-pre-wrap text-ink">{card.back}</p>
              {card.note && <p className="mt-4 rounded-lg bg-surface p-3 text-sm break-words whitespace-pre-wrap text-muted">{card.note}</p>}
            </div>
          ) : null}
        </div>
        <div className="border-t border-line bg-surface p-4">
          {continuous ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-2 text-sm text-ink">
                <Headphones className="size-4" /> Reprodução contínua {speech.state === 'paused' ? '(pausada)' : ''}
              </span>
              {speech.state === 'paused' ? (
                <Button size="sm" icon={<Play className="size-4" />} onClick={speech.resume}>
                  Retomar
                </Button>
              ) : (
                <Button size="sm" icon={<Pause className="size-4" />} onClick={speech.pause}>
                  Pausar
                </Button>
              )}
              <Button size="sm" icon={<Square className="size-4" />} onClick={stopContinuous}>
                Parar
              </Button>
            </div>
          ) : !revealed ? (
            <Button variant="dark" size="lg" className="w-full" icon={<Eye className="size-5" />} onClick={reveal}>
              Mostrar resposta <kbd className="ml-2 rounded border border-white/30 px-1.5 text-[10px]">Espaço</kbd>
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([1, 2, 3, 4] as Rating[]).map((r) => (
                <button
                  key={r}
                  onClick={() => void rate(r)}
                  disabled={review.isPending}
                  className={cn('flex flex-col items-center rounded-lg border bg-bg px-3 py-2.5 transition-colors disabled:opacity-50', RATING_STYLES[r])}
                >
                  <span className="text-sm font-semibold text-ink">
                    {RATING_LABELS[r]} <kbd className="ml-1 text-[10px] text-muted">{r}</kbd>
                  </span>
                  {record && preview && <span className="text-xs text-muted">{preview[r]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <SpeechPanel
        speech={speech}
        card={card}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        continuous={continuous}
        onStartContinuous={() => setContinuous(true)}
        thinkSeconds={thinkSeconds}
        setThinkSeconds={setThinkSeconds}
        settings={settings}
        updateSettings={(p) => updateSettings.mutate(p)}
      />

      {mode !== 'continuo' && (
        <div className="mt-3 text-center">
          <Checkbox label="Registrar respostas no agendamento (desmarque para apenas praticar)" checked={record} onChange={(e) => setRecord(e.target.checked)} />
        </div>
      )}
    </div>
  )
}

function SpeechPanel(props: {
  speech: ReturnType<typeof useSpeech>
  card: Flashcard
  revealed: boolean
  onReveal: () => void
  continuous: boolean
  onStartContinuous: () => void
  thinkSeconds: number
  setThinkSeconds: (n: number) => void
  settings: ReturnType<typeof useSettings>
  updateSettings: (p: { voiceURI?: string | null; speechRate?: number; autoRead?: boolean }) => void
}) {
  const { speech, card, settings } = props
  if (!speech.supported)
    return (
      <p role="status" className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
        <VolumeX className="mr-1 inline size-4" /> Este navegador não oferece síntese de voz (Web Speech API). A revisão funciona normalmente sem áudio; para ouvir os cartões, use Chrome, Edge ou Safari atualizados.
      </p>
    )
  const ptVoices = speech.voices.filter((v) => v.lang?.toLowerCase().startsWith('pt'))
  const otherVoices = speech.voices.filter((v) => !v.lang?.toLowerCase().startsWith('pt'))
  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Volume2 className="size-4 text-accent-strong" />
        <Button size="sm" onClick={() => void speech.speak([card.front])} disabled={props.continuous}>
          Ler pergunta
        </Button>
        <Button size="sm" onClick={() => void speech.speak([card.back])} disabled={!props.revealed || props.continuous}>
          Ler resposta
        </Button>
        <Button
          size="sm"
          disabled={props.continuous}
          onClick={() => {
            props.onReveal()
            void speech.speak([card.front, card.back])
          }}
        >
          Ler pergunta e resposta
        </Button>
        {!props.continuous && (
          <Button size="sm" icon={<Headphones className="size-4" />} onClick={props.onStartContinuous}>
            Reprodução contínua
          </Button>
        )}
        {speech.state === 'speaking' && !props.continuous && (
          <Button size="sm" variant="ghost" icon={<Pause className="size-4" />} onClick={speech.pause}>
            Pausar
          </Button>
        )}
        {speech.state === 'paused' && !props.continuous && (
          <Button size="sm" variant="ghost" icon={<Play className="size-4" />} onClick={speech.resume}>
            Retomar
          </Button>
        )}
        {speech.state !== 'idle' && !props.continuous && (
          <Button size="sm" variant="ghost" icon={<Square className="size-4" />} onClick={speech.stop}>
            Parar
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label={`Velocidade: ${settings.speechRate.toFixed(1)}×`}>
          {(id) => <input id={id} type="range" min={0.5} max={2} step={0.1} value={settings.speechRate} onChange={(e) => props.updateSettings({ speechRate: Number(e.target.value) })} className="w-full accent-[var(--accent-strong)]" />}
        </Field>
        <Field label="Voz" hint={!speech.hasPortuguese ? 'Nenhuma voz em português encontrada neste dispositivo; será usada a voz padrão.' : undefined}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={speech.voice?.voiceURI ?? ''} onChange={(e) => props.updateSettings({ voiceURI: e.target.value || null })} disabled={speech.voices.length === 0}>
              {speech.voices.length === 0 && <option value="">Carregando vozes…</option>}
              {ptVoices.length > 0 && (
                <optgroup label="Português">
                  {ptVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherVoices.length > 0 && (
                <optgroup label="Outros idiomas">
                  {otherVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          )}
        </Field>
        <div className="flex flex-col justify-end gap-2">
          <Checkbox label="Leitura automática" checked={settings.autoRead} onChange={(e) => props.updateSettings({ autoRead: e.target.checked })} />
          <label className="flex items-center gap-2 text-xs text-muted">
            Pausa para pensar (contínuo)
            <input type="number" min={0} max={30} value={props.thinkSeconds} onChange={(e) => props.setThinkSeconds(Math.max(0, Math.min(30, Number(e.target.value))))} className="h-7 w-14 rounded border border-line bg-bg px-1 text-ink" aria-label="Segundos para pensar" />s
          </label>
        </div>
      </div>
    </Card>
  )
}
