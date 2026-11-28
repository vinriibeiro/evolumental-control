import { Link, useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { EmptyState, QueryState } from '@/components/ui/feedback'
import { useAll, useCount } from '@/hooks/data'
import { eq } from '@/lib/data/types'

export function SubjectCardsTab({ subjectId }: { subjectId: string }) {
  const decks = useAll('flashcard_decks', { filters: [eq('subject_id', subjectId)], order: [{ column: 'name' }] })
  const cards = useCount('flashcards', [eq('subject_id', subjectId)])
  const navigate = useNavigate()
  return (
    <QueryState query={decks}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{cards.data ?? 0} cartão(ões) vinculados a esta matéria.</p>
        <Button size="sm" disabled={!cards.data} onClick={() => navigate(`/flashcards/revisar?materia=${subjectId}&modo=vencidos`)}>
          Revisar cartões vencidos
        </Button>
      </div>
      {(decks.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Layers className="size-8" />}
          title="Nenhum baralho vinculado"
          description="Crie cartões a partir de um tópico ou vincule um baralho a esta matéria."
          action={
            <Button size="sm" onClick={() => navigate('/flashcards')}>
              Ir para flashcards
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data!.map((d) => (
            <Link key={d.id} to={`/flashcards/${d.id}`}>
              <Card className="p-4 hover:bg-surface-2">
                <p className="truncate font-medium text-ink">{d.name}</p>
                {d.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{d.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </QueryState>
  )
}
