import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useInsert, useUpdate } from '@/hooks/data'
import { TASK_KIND_LABELS } from '@/lib/labels'
import type { CalendarTask, TaskKind } from '@/types/db'

export function TaskForm({ open, task, date, defaultTime, onClose }: { open: boolean; task: CalendarTask | null; date: string; defaultTime?: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [d, setD] = useState(date)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [kind, setKind] = useState<TaskKind>('task')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [error, setError] = useState<string | null>(null)
  const insert = useInsert('calendar_tasks')
  const update = useUpdate('calendar_tasks')
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setD(task?.date ?? date)
    setTime(task?.start_time ?? defaultTime ?? '')
    setDuration(task?.duration_minutes ? String(task.duration_minutes) : '')
    setKind(task?.kind ?? 'task')
    setLink({ subjectId: task?.subject_id ?? null, topicId: task?.topic_id ?? null })
    setError(null)
  }, [open, task, date, defaultTime])
  const save = async () => {
    if (!title.trim()) return setError('Informe o título.')
    const dur = duration ? Number(duration) : null
    if (dur != null && (!Number.isInteger(dur) || dur < 1 || dur > 1440)) return setError('Duração entre 1 e 1440 minutos.')
    const data = { title: title.trim().slice(0, 300), description: description.trim() || null, date: d, start_time: time || null, duration_minutes: dur, kind, subject_id: link.subjectId, topic_id: link.topicId }
    try {
      if (task) await update.mutateAsync({ id: task.id, patch: data })
      else await insert.mutateAsync(data)
      toast.success('Tarefa salva.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
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
        <Field label="Título" required error={error}>
          {(id, dsc) => <Input id={id} aria-describedby={dsc} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Prova do TRF, entregar redação…" />}
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Data">{(id) => <Input id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}</Field>
          <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Duração (min)">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
                {Object.entries(TASK_KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
        <Field label="Descrição">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
