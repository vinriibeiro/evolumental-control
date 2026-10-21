import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck, Layers, Network, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { useAll, useCount, useTransaction } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { formatDayKey } from '@/lib/time'
import { createMindMap } from '@/services/mindmaps'
import type { Topic } from '@/types/db'

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
              <Card className="p-4 hover:bg-surface">
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

export function SubjectMapsTab({ subjectId }: { subjectId: string }) {
  const maps = useAll('mind_maps', { filters: [eq('subject_id', subjectId)], order: [{ column: 'updated_at', ascending: false }] })
  const navigate = useNavigate()
  const toast = useToast()
  const create = useTransaction(['mind_maps'], (b, title: string) => createMindMap(b, { title, subject_id: subjectId }))
  const newMap = async () => {
    try {
      const m = await create.mutateAsync('Novo mapa')
      navigate(`/mapas/${m.id}`)
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <QueryState query={maps}>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={<Plus className="size-4" />} onClick={newMap} loading={create.isPending}>
          Novo mapa
        </Button>
      </div>
      {(maps.data ?? []).length === 0 ? (
        <EmptyState icon={<Network className="size-8" />} title="Nenhum mapa mental desta matéria" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.data!.map((m) => (
            <Link key={m.id} to={`/mapas/${m.id}`}>
              <Card className="p-4 hover:bg-surface">
                <p className="truncate font-medium text-ink">{m.title}</p>
                <p className="mt-1 text-xs text-muted">{m.data.nodes.length} nós · atualizado {formatDayKey(m.updated_at.slice(0, 10))}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </QueryState>
  )
}

export function SubjectQuestionsTab({ subjectId, topics }: { subjectId: string; topics: Topic[] }) {
  const records = useAll('question_records', { filters: [eq('subject_id', subjectId)] })
  const navigate = useNavigate()
  const rows = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>()
    for (const r of records.data ?? []) {
      const k = r.topic_id ?? ''
      const cur = m.get(k) ?? { total: 0, correct: 0 }
      cur.total += r.total
      cur.correct += r.correct
      m.set(k, cur)
    }
    const name = new Map(topics.map((t) => [t.id, t.name]))
    return [...m]
      .map(([k, v]) => ({ name: k ? (name.get(k) ?? 'Tópico excluído') : 'Matéria (geral)', ...v, rate: v.total ? v.correct / v.total : 0 }))
      .sort((a, b) => a.rate - b.rate)
  }, [records.data, topics])
  return (
    <QueryState query={records}>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => navigate(`/questoes?materia=${subjectId}`)}>
          Registrar questões
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="size-8" />} title="Nenhum registro de questões" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Tópico</th>
                <th className="px-4 py-2 text-right font-medium">Questões</th>
                <th className="px-4 py-2 text-right font-medium">Acertos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-line last:border-0">
                  <td className="max-w-0 truncate px-4 py-2 text-ink">{r.name}</td>
                  <td className="tabular px-4 py-2 text-right">{r.total}</td>
                  <td className="tabular px-4 py-2 text-right font-medium" style={{ color: r.rate < 0.6 ? 'var(--danger)' : r.rate < 0.8 ? 'var(--warning)' : 'var(--success)' }}>
                    {Math.round(r.rate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </QueryState>
  )
}
