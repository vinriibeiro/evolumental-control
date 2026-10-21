import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useTransaction } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/labels'
import { todayKey, zonedTime } from '@/lib/time'
import { addManualSession, type ManualSessionInput } from '@/services/sessions'
import type { ActivityType } from '@/types/db'

/** Registrar estudo feito fora do cronômetro (sem sobreposição com sessões existentes). */
export function ManualEntry({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings()
  const toast = useToast()
  const [date, setDate] = useState(() => todayKey(settings.timezone))
  const [time, setTime] = useState('08:00')
  const [minutes, setMinutes] = useState('60')
  const [activity, setActivity] = useState<ActivityType>('theory')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = useTransaction(['study_sessions', 'topics'], (b, input: ManualSessionInput) => addManualSession(b, input))

  const submit = async () => {
    setError(null)
    const mins = Number(minutes)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return setError('Informe data e horário.')
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) return setError('A duração deve ser um número inteiro entre 1 e 1440 minutos.')
    try {
      await add.mutateAsync({
        subject_id: link.subjectId,
        topic_id: link.topicId,
        activity_type: activity,
        started_at: zonedTime(date, time, settings.timezone),
        duration_minutes: mins,
        notes: notes.trim().slice(0, 4000) || null,
      })
      toast.success('Sessão registrada.')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançamento manual"
      description="Registre um estudo feito sem o cronômetro. Sobreposições com sessões já registradas são bloqueadas para não duplicar horas."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={add.isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Data" className="col-span-2 sm:col-span-1">
            {(id) => <Input id={id} type="date" value={date} max={todayKey(settings.timezone)} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Início">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Minutos">{(id) => <Input id={id} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}</Field>
          <Field label="Atividade" className="col-span-2 sm:col-span-1">
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
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
