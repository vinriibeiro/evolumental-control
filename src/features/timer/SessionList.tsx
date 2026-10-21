import { useEffect, useState } from 'react'
import { Clock, Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, Card, ColorDot, LoadMore } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useConfirm, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useRemove, useSessions, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, type Filter, type SessionWithPauses } from '@/lib/data/types'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, MODE_LABELS } from '@/lib/labels'
import { netSeconds, pausedSeconds } from '@/lib/timer/engine'
import { formatDateTime, formatDuration, formatTime } from '@/lib/time'
import type { ActivityType } from '@/types/db'

const PAGE = 20

export function SessionList({ filters = [], emptyText = 'Nenhuma sessão registrada ainda.' }: { filters?: Filter[]; emptyText?: string }) {
  const [limit, setLimit] = useState(PAGE)
  const sessions = useSessions({ filters: [eq('status', 'completed'), ...filters], order: [{ column: 'started_at', ascending: false }], limit: limit + 1 }, { keepPrevious: true })
  const lookups = useLookups()
  const settings = useSettings()
  const [editing, setEditing] = useState<SessionWithPauses | null>(null)
  const remove = useRemove('study_sessions')
  const confirm = useConfirm()
  const toast = useToast()
  const rows = (sessions.data ?? []).slice(0, limit)

  return (
    <QueryState query={sessions}>
      {rows.length === 0 ? (
        <EmptyState icon={<Clock className="size-8" />} title={emptyText} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((s) => {
              const net = netSeconds(s, s.pauses)
              const paused = pausedSeconds(s, s.pauses)
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 grow basis-56">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <ColorDot color={lookups.subjectColor(s.subject_id)} />
                      <span className="truncate">{lookups.subjectName(s.subject_id)}</span>
                      {s.topic_id && <span className="truncate font-normal text-muted">› {lookups.topicName(s.topic_id)}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(new Date(s.started_at).getTime(), settings.timezone, settings.hourFormat)}
                      {s.ended_at && ` – ${formatTime(new Date(s.ended_at).getTime(), settings.timezone, settings.hourFormat)}`}
                      {paused > 0 && ` · ${formatDuration(paused)} pausado`}
                      {s.adjustment_seconds !== 0 && ` · ajuste ${formatDuration(s.adjustment_seconds)}`}
                    </p>
                    {s.notes && <p className="mt-1 line-clamp-2 text-xs text-ink">{s.notes}</p>}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge>{ACTIVITY_LABELS[s.activity_type]}</Badge>
                    <Badge className="hidden sm:inline-flex">{MODE_LABELS[s.mode]}</Badge>
                    <span className="tabular w-20 text-right text-sm font-semibold text-ink">{formatDuration(net)}</span>
                    <IconButton label="Editar sessão" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Excluir sessão"
                      size="sm"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Excluir esta sessão?',
                          message: `${formatDuration(net)} de estudo deixarão de contar nos indicadores e relatórios.`,
                          danger: true,
                          confirmLabel: 'Excluir',
                        })
                        if (!ok) return
                        try {
                          await remove.mutateAsync(s.id)
                          toast.success('Sessão excluída.')
                        } catch (e) {
                          toast.error(e)
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
          <LoadMore hasMore={(sessions.data?.length ?? 0) > limit} loading={sessions.isFetching} onClick={() => setLimit((l) => l + PAGE)} />
        </Card>
      )}
      <SessionEditModal session={editing} onClose={() => setEditing(null)} />
    </QueryState>
  )
}

function SessionEditModal({ session, onClose }: { session: SessionWithPauses | null; onClose: () => void }) {
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [activity, setActivity] = useState<ActivityType>('theory')
  const [notes, setNotes] = useState('')
  const [adjust, setAdjust] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const update = useUpdate('study_sessions')
  const toast = useToast()

  useEffect(() => {
    if (!session) return
    setLink({ subjectId: session.subject_id, topicId: session.topic_id })
    setActivity(session.activity_type)
    setNotes(session.notes ?? '')
    setAdjust(String(Math.round(session.adjustment_seconds / 60)))
    setError(null)
  }, [session])

  if (!session) return null
  const base = netSeconds({ ...session, adjustment_seconds: 0 }, session.pauses)
  const adjMin = Number(adjust)
  const valid = Number.isInteger(adjMin) && base + adjMin * 60 >= 0 && Math.abs(adjMin) <= 1440

  const save = async () => {
    if (!valid) return setError('O ajuste deve ser um número inteiro de minutos e não pode deixar o tempo negativo.')
    try {
      await update.mutateAsync({
        id: session.id,
        patch: { subject_id: link.subjectId, topic_id: link.topicId, activity_type: activity, notes: notes.trim() || null, adjustment_seconds: adjMin * 60 },
      })
      toast.success('Sessão atualizada.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar sessão"
      description={`Tempo registrado: ${formatDuration(base)} (pausas já descontadas).`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Atividade">
            {(id) => (
              <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value as ActivityType)}>
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Ajuste (minutos)" hint={valid ? `Tempo líquido final: ${formatDuration(base + adjMin * 60)}` : undefined} error={error}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={adjust} onChange={(e) => setAdjust(e.target.value)} />}
          </Field>
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
