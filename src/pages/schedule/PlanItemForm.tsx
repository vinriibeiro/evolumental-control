import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useBackend } from '@/app/data'
import { useInsert, useUpdate } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, PLAN_STATUS_LABELS } from '@/lib/labels'
import { conflictsWith } from '@/lib/planner'
import type { ActivityType, PlanItemStatus, StudyPlan, StudyPlanItem } from '@/types/db'

export function PlanItemForm({ open, onClose, plan, item, defaultDate }: { open: boolean; onClose: () => void; plan: StudyPlan; item?: StudyPlanItem | null; defaultDate?: string }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [duration, setDuration] = useState('50')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [activity, setActivity] = useState<ActivityType>('theory')
  const [status, setStatus] = useState<PlanItemStatus>('pending')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<StudyPlanItem[] | null>(null)
  const backend = useBackend()
  const insert = useInsert('study_plan_items')
  const update = useUpdate('study_plan_items')
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setDate(item?.date ?? defaultDate ?? plan.start_date)
    setTime(item?.start_time ?? '19:00')
    setDuration(String(item?.duration_minutes ?? plan.config.blockMinutes ?? 50))
    setLink({ subjectId: item?.subject_id ?? null, topicId: item?.topic_id ?? null })
    setActivity(item?.activity_type ?? plan.config.activityType ?? 'theory')
    setStatus(item?.status ?? 'pending')
    setNotes(item?.notes ?? '')
    setError(null)
    setConflicts(null)
  }, [open, item, defaultDate, plan])

  const save = async (force = false) => {
    const mins = Number(duration)
    if (!link.subjectId) return setError('Escolha a matéria.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return setError('Informe data e horário.')
    if (!Number.isInteger(mins) || mins < 5 || mins > 1440) return setError('A duração deve ficar entre 5 e 1440 minutos.')
    setError(null)
    if (!force) {
      // Avisa sobre sobreposição com outros blocos do mesmo dia (em qualquer cronograma).
      const { rows } = await backend.list('study_plan_items', { filters: [eq('date', date)] })
      const clash = conflictsWith({ id: item?.id, date, start_time: time, duration_minutes: mins }, rows)
      if (clash.length) return setConflicts(clash)
    }
    const data = { date, start_time: time, duration_minutes: mins, subject_id: link.subjectId, topic_id: link.topicId, activity_type: activity, status, notes: notes.trim() || null }
    try {
      if (item) await update.mutateAsync({ id: item.id, patch: data })
      else await insert.mutateAsync({ ...data, plan_id: plan.id })
      toast.success(item ? 'Bloco atualizado.' : 'Bloco adicionado.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar bloco' : 'Novo bloco de estudo'}
      footer={
        conflicts ? (
          <>
            <Button onClick={() => setConflicts(null)}>Ajustar horário</Button>
            <Button variant="primary" onClick={() => save(true)} loading={insert.isPending || update.isPending}>
              Salvar mesmo assim
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={() => save(false)} loading={insert.isPending || update.isPending}>
              Salvar
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {conflicts && (
          <div role="alert" className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Este horário se sobrepõe a {conflicts.length} bloco(s) já marcado(s) neste dia ({conflicts.map((c) => `${c.start_time}, ${c.duration_minutes} min`).join('; ')}).
            </span>
          </div>
        )}
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectRequired />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Data">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Duração (min)">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
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
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as PlanItemStatus)}>
                {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
