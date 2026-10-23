import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, X } from 'lucide-react'
import { useBackend } from '@/app/data'
import { invalidateTables } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq, inList, lte } from '@/lib/data/types'
import { RATING_LABELS, reviewPriority, type Rating } from '@/lib/srs'
import { reviewCard } from '@/services/flashcards'
import { play } from './audio'

const BATCH = 15

/**
 * Morador da Minha Cidade: revisa com o jogador os flashcards vencidos da
 * matéria do prédio. Usa os MESMOS cartões, o mesmo SM-2 e o mesmo registro
 * de revisão do módulo de Flashcards — nada é duplicado e não rende XP.
 */
export function CardsEncounter({ subjectId, subjectName, sound, onNavigate, onClose }: { subjectId: string; subjectName: string; sound: boolean; onNavigate: (to: string) => void; onClose: () => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const settings = useSettings()
  const [openedAt] = useState(() => new Date().toISOString())
  const queue = useQuery({
    queryKey: ['evoquest-world-cards', backend.kind, subjectId, openedAt],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { rows } = await backend.list('flashcards', { filters: [eq('subject_id', subjectId), inList('status', ['new', 'learning', 'review']), lte('due_at', openedAt)], order: [{ column: 'due_at' }], limit: 40 })
      return reviewPriority(rows).slice(0, BATCH)
    },
  })
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [remembered, setRemembered] = useState(0)
  const [busy, setBusy] = useState(false)
  const cards = queue.data ?? []
  const card = cards[index]
  const done = queue.data != null && index >= cards.length

  const rate = async (r: Rating) => {
    if (!card || busy) return
    setBusy(true)
    try {
      await reviewCard(backend, card, r, settings.srs)
      play(r >= 3 ? 'success' : 'error', sound)
      if (r >= 3) setRemembered((n) => n + 1)
      setRevealed(false)
      setIndex((i) => i + 1)
      if (index + 1 >= cards.length) await invalidateTables(qc, ['flashcards', 'flashcard_reviews'])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return
      if (!revealed && ['Space', 'Enter', 'KeyE'].includes(e.code)) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault()
        void rate(Number(e.code.slice(5)) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={`Flashcards de ${subjectName}`}>
      <header className="flex items-center gap-2 border-b-2 border-[var(--eq-edge-dark)] p-3">
        <Layers className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">Morador · {subjectName}</h2>
          <p className="text-xs text-[var(--eq-muted)]">Os seus flashcards vencidos desta matéria. Mesmo agendamento do módulo Flashcards.</p>
        </div>
        {cards.length > 0 && !done && (
          <span className="tabular text-xs text-[var(--eq-muted)]">
            {index + 1}/{cards.length}
          </span>
        )}
        <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {queue.isPending ? (
          <p className="text-[var(--eq-muted)]">Separando os cartões…</p>
        ) : queue.isError ? (
          <p className="text-[var(--eq-bad)]">Não foi possível carregar os cartões.</p>
        ) : cards.length === 0 ? (
          <div className="space-y-3">
            <p>"Nada vencido por aqui! Quando tiver cartões de {subjectName} para revisar, pode me procurar."</p>
            <button className="eq-btn" onClick={() => onNavigate(`/flashcards`)}>
              Criar flashcards no Control
            </button>
          </div>
        ) : done ? (
          <div className="space-y-3">
            <p className="font-semibold text-[var(--eq-gold)]">Revisão concluída</p>
            <p>
              {remembered} de {cards.length} lembrados. "Obrigado pela visita — os cartões já foram reagendados."
            </p>
            <button className="eq-btn eq-btn-primary" onClick={onClose}>
              Voltar à cidade <span className="eq-kbd">Esc</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[var(--eq-muted)]">Frente</p>
              <p className="mt-1 text-lg leading-relaxed whitespace-pre-wrap">{card.front}</p>
            </div>
            {revealed ? (
              <>
                <div className="border-t-2 border-[var(--eq-edge-dark)] pt-3">
                  <p className="text-xs text-[var(--eq-muted)]">Verso</p>
                  <p className="mt-1 leading-relaxed whitespace-pre-wrap">{card.back}</p>
                  {card.note && <p className="mt-2 text-sm text-[var(--eq-muted)]">{card.note}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Como foi lembrar?">
                  {([1, 2, 3, 4] as Rating[]).map((r) => (
                    <button key={r} className={`eq-btn ${r >= 3 ? 'eq-btn-primary' : ''}`} disabled={busy} onClick={() => void rate(r)}>
                      <span className="eq-kbd">{r}</span> {RATING_LABELS[r]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button className="eq-btn eq-btn-primary" autoFocus onClick={() => setRevealed(true)}>
                Mostrar resposta <span className="eq-kbd">E</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
