import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, ExternalLink, Layers, Link2, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { searchLinks } from '@/lib/search'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Badge, Progress } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAll, useCount, useInsert, useRemove } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq, inList, lte } from '@/lib/data/types'
import { MASTERY_TOPIC_LABELS, PRIORITY_LABELS, REVIEW_STATUS_LABELS, TOPIC_STATUS_LABELS } from '@/lib/labels'
import { addDays, formatDateTime, formatDayKey, formatDuration, todayKey, minuteIso } from '@/lib/time'
import { topicPath } from '@/lib/tree'
import { urlSchema } from '@/lib/validation'
import type { Subject, Topic } from '@/types/db'
import { CardForm } from '@/pages/flashcards/CardForm'
import { TopicForm } from './TopicForm'

interface Props {
  topic: Topic | null
  subject: Subject
  allTopics: Topic[]
  stats?: { seconds: number; last: string | null }
  nextReview?: string
  onClose: () => void
}

export function TopicPanel({ topic, subject, allTopics, stats, nextReview, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const navigate = useNavigate()
  const settings = useSettings()
  const toast = useToast()
  const tid = topic?.id ?? ''
  const enabled = Boolean(topic)
  const cardCount = useCount('flashcards', [eq('topic_id', tid)], { enabled })
  const dueCount = useCount('flashcards', [eq('topic_id', tid), inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())], { enabled })
  const reviews = useAll('reviews', { filters: [eq('topic_id', tid)], order: [{ column: 'scheduled_for', ascending: false }] }, { enabled })
  const questions = useAll('question_records', { filters: [eq('topic_id', tid)] }, { enabled })
  const insertReview = useInsert('reviews')

  if (!topic) return null
  const byId = new Map(allTopics.map((t) => [t.id, t]))
  const path = topicPath(byId, topic.parent_id)
  const qTotals = (questions.data ?? []).reduce((a, q) => ({ total: a.total + q.total, correct: a.correct + q.correct }), { total: 0, correct: 0 })
  const estimate = topic.estimated_minutes ? topic.estimated_minutes * 60 : null

  const scheduleReview = async (days: number) => {
    try {
      await insertReview.mutateAsync({
        subject_id: subject.id,
        topic_id: topic.id,
        title: `Revisar: ${topic.name}`,
        scheduled_for: addDays(todayKey(settings.timezone), days),
        origin: 'manual',
      })
      toast.success('Revisão agendada.')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <>
      <Modal
        open={Boolean(topic) && !editing && !cardOpen}
        onClose={onClose}
        size="xl"
        title={topic.name}
        description={path ? `${subject.name} › ${path}` : subject.name}
        footer={
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="primary" icon={<Play className="size-4" />} onClick={() => navigate(`/cronometro?materia=${subject.id}&topico=${topic.id}`)}>
              Iniciar estudo
            </Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{TOPIC_STATUS_LABELS[topic.status]}</Badge>
              <Badge>Domínio: {MASTERY_TOPIC_LABELS[topic.mastery]}</Badge>
              <Badge>Prioridade: {PRIORITY_LABELS[topic.priority]}</Badge>
              <Badge>Peso {topic.weight}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Tempo estudado" value={formatDuration(stats?.seconds ?? 0)} />
              <Info label="Estimativa" value={estimate ? formatDuration(estimate) : '—'} />
              <Info label="Última sessão" value={stats?.last ? formatDateTime(new Date(stats.last).getTime(), settings.timezone, settings.hourFormat) : '—'} />
              <Info label="Próxima revisão" value={nextReview ? formatDayKey(nextReview, 'long') : '—'} />
              <Info label="Questões" value={qTotals.total ? `${qTotals.correct}/${qTotals.total} (${Math.round((qTotals.correct / qTotals.total) * 100)}%)` : '—'} />
              <Info label="Concluído em" value={topic.completed_at ? formatDateTime(new Date(topic.completed_at).getTime(), settings.timezone) : '—'} />
            </dl>
            {estimate ? <Progress value={((stats?.seconds ?? 0) / estimate) * 100} label="Tempo estudado em relação à estimativa" /> : null}
            {topic.description && <p className="text-sm whitespace-pre-wrap text-ink">{topic.description}</p>}
            {topic.notes && (
              <div className="rounded-lg bg-surface p-3">
                <p className="mb-1 text-xs font-semibold text-muted uppercase">Observações</p>
                <p className="text-sm whitespace-pre-wrap text-ink">{topic.notes}</p>
              </div>
            )}

            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Brain className="size-4 text-accent-strong" /> Revisões
              </h3>
              <div className="mb-2 flex flex-wrap gap-2">
                {[1, 7, 30].map((d) => (
                  <Button key={d} size="sm" onClick={() => scheduleReview(d)} loading={insertReview.isPending}>
                    + em {d} dia{d > 1 ? 's' : ''}
                  </Button>
                ))}
              </div>
              <ul className="space-y-1 text-sm">
                {(reviews.data ?? []).slice(0, 6).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">{formatDayKey(r.scheduled_for, 'long')}</span>
                    <span className="shrink-0 text-muted">{REVIEW_STATUS_LABELS[r.status]}</span>
                  </li>
                ))}
                {reviews.data?.length === 0 && <li className="text-muted">Nenhuma revisão registrada.</li>}
              </ul>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Layers className="size-4 text-accent-strong" /> Flashcards
              </h3>
              <p className="mb-2 text-sm text-muted">
                {cardCount.data ?? 0} cartão(ões) · {dueCount.data ?? 0} para revisar agora
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCardOpen(true)}>
                  Novo cartão
                </Button>
                <Button size="sm" disabled={!cardCount.data} onClick={() => navigate(`/flashcards/revisar?topico=${topic.id}&modo=${dueCount.data ? 'vencidos' : 'todos'}`)}>
                  Revisar cartões deste tópico
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Search className="size-4 text-accent-strong" /> Pesquisar na internet
              </h3>
              <div className="flex flex-wrap gap-2">
                {searchLinks(topic.name, subject.name).map((l) => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface">
                    {l.label} <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Encontrou um bom material? Salve o link em "Materiais e links".</p>
            </div>

            <Materials subjectId={subject.id} topicId={topic.id} />
          </section>
        </div>
      </Modal>
      <TopicForm open={editing} onClose={() => setEditing(false)} subjectId={subject.id} topic={topic} />
      <CardForm open={cardOpen} onClose={() => setCardOpen(false)} defaults={{ subjectId: subject.id, topicId: topic.id }} />
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular truncate text-ink">{value}</dd>
    </div>
  )
}

function Materials({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const materials = useAll('study_materials', { filters: [eq('topic_id', topicId)], order: [{ column: 'created_at' }] })
  const insert = useInsert('study_materials')
  const remove = useRemove('study_materials')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const add = async () => {
    const u = urlSchema.safeParse(url)
    if (!title.trim()) return setError('Informe um título.')
    if (!u.success) return setError(u.error.issues[0].message)
    setError(null)
    try {
      await insert.mutateAsync({ subject_id: subjectId, topic_id: topicId, title: title.trim().slice(0, 300), url: u.data || null })
      setTitle('')
      setUrl('')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Link2 className="size-4 text-accent-strong" /> Materiais e links
      </h3>
      <ul className="mb-2 space-y-1">
        {(materials.data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            {m.url ? (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-ink hover:underline">
                <span className="truncate">{m.title}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-ink">{m.title}</span>
            )}
            <IconButton label={`Remover ${m.title}`} size="sm" onClick={() => remove.mutate(m.id)}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Field error={error}>{() => <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Lei 9.784)" aria-label="Título do material" />}</Field>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (opcional)" aria-label="Link do material" />
        <Button type="submit" size="md" loading={insert.isPending}>
          Adicionar
        </Button>
      </form>
    </div>
  )
}
