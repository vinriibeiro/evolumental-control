import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, CalendarClock, Check, Layers, Play, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Badge, Card, ColorDot, LoadMore, PageHeader, StatCard, Tabs } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useConfirm, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useCount, useInsert, useList, useRemove, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gt, inList, lt, lte } from '@/lib/data/types'
import { REVIEW_STATUS_LABELS } from '@/lib/labels'
import { addDays, formatDateTime, formatDayKey, todayKey, minuteIso } from '@/lib/time'
import type { Review } from '@/types/db'

type Tab = 'pending' | 'upcoming' | 'done' | 'cancelled'
const PAGE = 30

export default function ReviewsPage() {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const [tab, setTab] = useState<Tab>('pending')
  const [limit, setLimit] = useState(PAGE)
  const [form, setForm] = useState<{ review: Review | null } | null>(null)
  const [postpone, setPostpone] = useState<Review | null>(null)
  const navigate = useNavigate()
  const lookups = useLookups()
  const update = useUpdate('reviews')
  const remove = useRemove('reviews')
  const toast = useToast()
  const confirm = useConfirm()

  useEffect(() => setLimit(PAGE), [tab])
  const filters =
    tab === 'pending'
      ? [inList('status', ['planned', 'postponed']), lte('scheduled_for', today)]
      : tab === 'upcoming'
        ? [inList('status', ['planned', 'postponed']), gt('scheduled_for', today)]
        : tab === 'done'
          ? [eq('status', 'done')]
          : [eq('status', 'cancelled')]
  const order = tab === 'done' ? [{ column: 'done_at', ascending: false }] : tab === 'cancelled' ? [{ column: 'updated_at', ascending: false }] : [{ column: 'scheduled_for' }]
  const reviews = useList('reviews', { filters, order, limit, count: true }, { keepPrevious: true })
  const overdue = useCount('reviews', [inList('status', ['planned', 'postponed']), lt('scheduled_for', today)])
  const dueToday = useCount('reviews', [inList('status', ['planned', 'postponed']), eq('scheduled_for', today)])
  const doneWeek = useCount('reviews', [eq('status', 'done'), { column: 'done_at', op: 'gte', value: minuteIso(-7 * 86400000) }])
  const cardsDue = useCount('flashcards', [inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())])

  const complete = (r: Review) =>
    update
      .mutateAsync({ id: r.id, patch: { status: 'done', done_at: new Date().toISOString() } })
      .then(() => toast.success('Revisão registrada como realizada.'))
      .catch(toast.error)

  return (
    <div>
      <PageHeader
        title="Revisões"
        description="Revisões planejadas de tópicos e flashcards. Uma revisão só conta como feita quando você a registra."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ review: null })}>
            Agendar revisão
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Atrasadas" value={overdue.data ?? '…'} />
        <StatCard label="Para hoje" value={dueToday.data ?? '…'} />
        <StatCard label="Realizadas (7 dias)" value={doneWeek.data ?? '…'} />
        <Card className="flex flex-col justify-between gap-2 p-4">
          <span className="flex items-center gap-2 text-xs text-muted">
            <Layers className="size-4" /> Flashcards vencidos
          </span>
          <span className="tabular text-2xl font-semibold text-ink">{cardsDue.data ?? '…'}</span>
          <Button size="sm" disabled={!cardsDue.data} onClick={() => navigate('/flashcards/revisar?modo=vencidos')}>
            Revisar cartões
          </Button>
        </Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: 'Pendentes' },
          { value: 'upcoming', label: 'Próximas' },
          { value: 'done', label: 'Realizadas' },
          { value: 'cancelled', label: 'Canceladas' },
        ]}
      />
      <QueryState query={reviews}>
        {(reviews.data?.rows ?? []).length === 0 ? (
          <EmptyState
            icon={<Brain className="size-8" />}
            title={tab === 'pending' ? 'Nenhuma revisão pendente' : tab === 'upcoming' ? 'Nenhuma revisão futura' : tab === 'done' ? 'Nenhuma revisão realizada ainda' : 'Nenhuma revisão cancelada'}
            description={tab === 'pending' ? 'Ao salvar uma sessão com tópico, você pode agendar revisões automáticas (1, 7 e 30 dias).' : undefined}
          />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {reviews.data!.rows.map((r) => {
                const late = r.status !== 'done' && r.status !== 'cancelled' && r.scheduled_for < today
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <ColorDot color={lookups.subjectColor(r.subject_id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                      <p className="truncate text-xs text-muted">
                        {lookups.subjectName(r.subject_id)}
                        {r.topic_id ? ` › ${lookups.topicName(r.topic_id)}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs">
                        <span className={late ? 'font-medium text-danger' : 'text-muted'}>
                          Planejada para {formatDayKey(r.scheduled_for, 'long')}
                          {late ? ' (atrasada)' : ''}
                        </span>
                        {r.done_at && <span className="text-success"> · Realizada em {formatDateTime(new Date(r.done_at).getTime(), settings.timezone, settings.hourFormat)}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.origin === 'auto' && <Badge>automática</Badge>}
                      <Badge>{REVIEW_STATUS_LABELS[r.status]}</Badge>
                      {(r.status === 'planned' || r.status === 'postponed') && (
                        <>
                          {r.topic_id && (
                            <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} onClick={() => navigate(`/cronometro?materia=${r.subject_id ?? ''}&topico=${r.topic_id}&atividade=review`)}>
                              Estudar
                            </Button>
                          )}
                          <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => complete(r)}>
                            Concluir
                          </Button>
                        </>
                      )}
                      <ActionMenu label="Mais ações">
                        {(close) => (
                          <>
                            {(r.status === 'planned' || r.status === 'postponed') && (
                              <>
                                <MenuItem icon={<CalendarClock className="size-4" />} onClick={() => (close(), setPostpone(r))}>
                                  Adiar…
                                </MenuItem>
                                <MenuItem icon={<X className="size-4" />} onClick={() => (close(), void update.mutateAsync({ id: r.id, patch: { status: 'cancelled' } }).catch(toast.error))}>
                                  Cancelar
                                </MenuItem>
                              </>
                            )}
                            {(r.status === 'done' || r.status === 'cancelled') && (
                              <MenuItem onClick={() => (close(), void update.mutateAsync({ id: r.id, patch: { status: 'planned', done_at: null } }).catch(toast.error))}>Reabrir como planejada</MenuItem>
                            )}
                            <MenuItem onClick={() => (close(), setForm({ review: r }))}>Editar</MenuItem>
                            <MenuItem
                              icon={<Trash2 className="size-4" />}
                              danger
                              onClick={async () => {
                                close()
                                if (await confirm({ title: 'Excluir revisão?', message: r.title, danger: true, confirmLabel: 'Excluir' })) remove.mutateAsync(r.id).catch(toast.error)
                              }}
                            >
                              Excluir
                            </MenuItem>
                          </>
                        )}
                      </ActionMenu>
                    </div>
                  </li>
                )
              })}
            </ul>
            <LoadMore hasMore={(reviews.data?.count ?? 0) > limit} loading={reviews.isFetching} onClick={() => setLimit((l) => l + PAGE)} />
          </Card>
        )}
      </QueryState>
      <ReviewForm open={Boolean(form)} review={form?.review ?? null} onClose={() => setForm(null)} today={today} />
      <PostponeModal review={postpone} onClose={() => setPostpone(null)} today={today} />
    </div>
  )
}

function PostponeModal({ review, onClose, today }: { review: Review | null; onClose: () => void; today: string }) {
  const [date, setDate] = useState('')
  const update = useUpdate('reviews')
  const toast = useToast()
  useEffect(() => {
    if (review) setDate(addDays(review.scheduled_for < today ? today : review.scheduled_for, 1))
  }, [review, today])
  return (
    <Modal
      open={Boolean(review)}
      onClose={onClose}
      size="sm"
      title="Adiar revisão"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            disabled={!date || date < today}
            onClick={() =>
              review &&
              update
                .mutateAsync({ id: review.id, patch: { status: 'postponed', scheduled_for: date } })
                .then(() => (toast.success(`Revisão adiada para ${formatDayKey(date)}.`), onClose()))
                .catch(toast.error)
            }
          >
            Adiar
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {[1, 2, 7].map((n) => (
          <Button key={n} size="sm" onClick={() => setDate(addDays(today, n))}>
            +{n} dia{n > 1 ? 's' : ''}
          </Button>
        ))}
      </div>
      <Field label="Nova data">{(id) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
    </Modal>
  )
}

function ReviewForm({ open, review, onClose, today }: { open: boolean; review: Review | null; onClose: () => void; today: string }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [error, setError] = useState<string | null>(null)
  const insert = useInsert('reviews')
  const update = useUpdate('reviews')
  const lookups = useLookups()
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setTitle(review?.title ?? '')
    setDate(review?.scheduled_for ?? addDays(today, 1))
    setNotes(review?.notes ?? '')
    setLink({ subjectId: review?.subject_id ?? null, topicId: review?.topic_id ?? null })
    setError(null)
  }, [open, review, today])
  const save = async () => {
    const t = title.trim() || (link.topicId ? `Revisar: ${lookups.topicName(link.topicId)}` : link.subjectId ? `Revisar: ${lookups.subjectName(link.subjectId)}` : '')
    if (!t) return setError('Informe um título ou escolha a matéria/tópico.')
    if (!date) return setError('Informe a data.')
    const data = { title: t.slice(0, 300), scheduled_for: date, notes: notes.trim() || null, subject_id: link.subjectId, topic_id: link.topicId }
    try {
      if (review) await update.mutateAsync({ id: review.id, patch: data })
      else await insert.mutateAsync({ ...data, origin: 'manual' })
      toast.success('Revisão salva.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={review ? 'Editar revisão' : 'Agendar revisão'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} />
        <Field label="Título" hint="Se vazio, usa o nome do tópico.">
          {(id, d) => <Input id={id} aria-describedby={d} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Data planejada">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
