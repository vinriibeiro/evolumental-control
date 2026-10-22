import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, Layers, Zap } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { invalidateTables } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { inList, lte } from '@/lib/data/types'
import { DataError } from '@/lib/data/types'
import { RATING_LABELS, reviewPriority, type Rating } from '@/lib/srs'
import { formatClock } from '@/lib/time'
import { reviewCard } from '@/services/flashcards'
import { addManualSession } from '@/services/sessions'
import { nextCombo } from '@/game/engine/rules'
import { playSfx } from '@/game/speech'
import { gameSettings } from '@/game/useGame'
import { useQueryClient } from '@tanstack/react-query'
import { BackLink } from './parts'

/**
 * Flashcards em modo jogo: usa os MESMOS cartões, o mesmo agendamento (SM-2)
 * e o mesmo registro de revisão do módulo de Flashcards — nada é duplicado.
 * Não rende XP (o XP vem dos desafios validados), mas mantém combo e tempo.
 */
export default function CardsPage() {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const settings = useSettings()
  const game = gameSettings(settings)
  const queue = useQuery({
    queryKey: ['evoquest-cards', backend.kind],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { rows } = await backend.list('flashcards', { filters: [inList('status', ['new', 'learning', 'review']), lte('due_at', new Date().toISOString())], order: [{ column: 'due_at' }], limit: 30 })
      return reviewPriority(rows).slice(0, 20)
    },
  })
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(0)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [busy, setBusy] = useState(false)
  const [timeNote, setTimeNote] = useState<string | null>(null)
  const startedAt = useRef(Date.now())

  if (queue.isPending) return <Spinner label="Separando cartões vencidos…" />
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
  const cards = queue.data
  if (cards.length === 0)
    return (
      <div>
        <BackLink to="/evoquest">EvoQuest</BackLink>
        <EmptyState icon={<Layers className="size-8" />} title="Nenhum flashcard vencido" description="Crie baralhos ou importe cartões no módulo Flashcards. Quando vencerem, eles aparecem aqui em modo jogo." action={<Link to="/flashcards" className="underline">Abrir Flashcards</Link>} />
      </div>
    )

  const done = index >= cards.length
  const card = cards[index]

  const rate = async (r: Rating) => {
    setBusy(true)
    try {
      await reviewCard(backend, card, r, settings.srs)
      const ok = r >= 3
      if (game.sound) playSfx(ok ? 'right' : 'wrong')
      const c = nextCombo(combo, ok)
      setCombo(c)
      setBest((b) => Math.max(b, c))
      setRatings((xs) => [...xs, r])
      setRevealed(false)
      setIndex((i) => i + 1)
      if (index + 1 >= cards.length) await finish()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    invalidateTables(qc, ['flashcards', 'flashcard_reviews'])
    const minutes = Math.floor((Date.now() - startedAt.current) / 60_000)
    if (!game.registerTime) return
    if (minutes < 1) return setTimeNote('Menos de 1 minuto: tempo não registrado.')
    try {
      await addManualSession(backend, { subject_id: null, topic_id: null, activity_type: 'flashcards', started_at: Date.now() - minutes * 60_000, duration_minutes: minutes, notes: 'EvoQuest — Flashcards' })
      invalidateTables(qc, ['study_sessions'])
      setTimeNote(`${minutes} min registrados nas suas sessões de estudo.`)
    } catch (e) {
      if (e instanceof DataError && e.code === 'validation') setTimeNote('Tempo não registrado de novo: já havia uma sessão nesse intervalo.')
      else toast.error(e)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackLink to="/evoquest">EvoQuest</BackLink>
      <PageHeader title="Flashcards em modo jogo" description="Seus cartões vencidos, com combo. A revisão usa o mesmo agendamento do módulo Flashcards." />
      <div className="mb-3 flex items-center gap-3">
        <Progress value={(Math.min(index, cards.length) / cards.length) * 100} className="h-3 flex-1" label="Progresso" />
        <span className="tabular text-xs text-muted">
          {Math.min(index, cards.length)}/{cards.length}
        </span>
        {combo >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-xs font-semibold text-ink">
            <Zap className="size-3.5" aria-hidden /> {combo}
          </span>
        )}
      </div>

      {done ? (
        <Card className="p-6 text-center">
          <p className="text-4xl" aria-hidden>
            🃏
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Revisão concluída</h2>
          <p className="mt-1 text-sm text-muted">
            {ratings.filter((r) => r >= 3).length} de {ratings.length} lembrados · maior combo {best} · {formatClock(Math.round((Date.now() - startedAt.current) / 1000))}
          </p>
          {timeNote && <p className="mt-2 text-xs text-muted">⏱️ {timeNote}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="primary" onClick={() => queue.refetch().then(() => { setIndex(0); setRatings([]); setCombo(0); startedAt.current = Date.now(); setTimeNote(null) })}>
              Mais cartões
            </Button>
            <Link to="/evoquest" className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
              Voltar
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex min-h-64 flex-col p-5">
          <p className="text-xs text-muted">Frente</p>
          <p className="mt-1 text-lg font-medium whitespace-pre-wrap text-ink">{card.front}</p>
          {revealed ? (
            <>
              <hr className="my-4 border-line" />
              <p className="text-xs text-muted">Verso</p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{card.back}</p>
              {card.note && <p className="mt-2 text-sm text-muted">{card.note}</p>}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5 sm:grid-cols-4">
                {([1, 2, 3, 4] as Rating[]).map((r) => (
                  <Button key={r} size="lg" variant={r >= 3 ? 'primary' : 'secondary'} disabled={busy} onClick={() => rate(r)}>
                    {RATING_LABELS[r]}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button size="lg" variant="primary" className="mt-auto w-full" icon={<Eye className="size-4" />} onClick={() => setRevealed(true)} autoFocus>
              Mostrar resposta
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
