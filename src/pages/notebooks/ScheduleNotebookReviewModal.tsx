import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useInsert } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { addDays, todayKey } from '@/lib/time'

interface Props {
  open: boolean
  onClose: () => void
  defaultTitle: string
  notebookTitle: string
  subjectId?: string | null
  topicId?: string | null
  pageHref: string
}

export function ScheduleNotebookReviewModal({ open, onClose, defaultTitle, notebookTitle, subjectId, topicId, pageHref }: Props) {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const insertReview = useInsert('reviews')
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(`Revisar: ${defaultTitle}`)
    setDate(addDays(today, 1))
    setNotes(`Caderno: ${notebookTitle} (${pageHref})`)
  }, [open, defaultTitle, notebookTitle, pageHref, today])

  const submit = async () => {
    if (!title.trim() || !date) return
    try {
      await insertReview.mutateAsync({
        subject_id: subjectId ?? null,
        topic_id: topicId ?? null,
        title: title.trim().slice(0, 300),
        scheduled_for: date,
        notes: notes.trim().slice(0, 4000) || null,
        origin: 'manual',
      })
      toast.success('Revisão agendada no módulo de Revisões.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Agendar revisão"
      description="Integra esta anotação diretamente ao calendário de Revisões existente."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<CalendarClock className="size-4" />} loading={insertReview.isPending} disabled={!title.trim() || !date} onClick={() => void submit()}>
            Agendar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {[1, 3, 7, 15, 30].map((d) => (
            <Button key={d} size="sm" variant="secondary" onClick={() => setDate(addDays(today, d))}>
              +{d} dia{d > 1 ? 's' : ''}
            </Button>
          ))}
        </div>
        <Field label="Título da revisão" required>
          {(id) => <Input id={id} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Data planejada" required>
          {(id) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Observações">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}
