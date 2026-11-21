// Detalhes de um bloco de estudo do cronograma (study_plan_items): status, edição e "Iniciar estudo".
import { Pencil, Play, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { eq } from '@/lib/data/types'
import { ACTIVITY_LABELS, PLAN_STATUS_LABELS } from '@/lib/labels'
import { formatDayKey, hhmmToMinutes, minutesToHhmm } from '@/lib/time'
import type { PlanItemStatus, StudyPlanItem } from '@/types/db'

export function BlockDetails({ item, onClose, onEdit }: { item: StudyPlanItem | null; onClose: () => void; onEdit: (it: StudyPlanItem) => void }) {
  const lookups = useLookups()
  const update = useUpdate('study_plan_items')
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const study = useStartStudy()
  if (!item) return null
  const title = lookups.subjectName(item.subject_id)
  const setStatus = (status: PlanItemStatus) => update.mutateAsync({ id: item.id, patch: { status } }).then(() => (toast.success(`Marcado como ${PLAN_STATUS_LABELS[status].toLowerCase()}.`), onClose()), toast.error)
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={title}
      description={`${formatDayKey(item.date, 'long')} · ${item.start_time}–${minutesToHhmm(hhmmToMinutes(item.start_time) + item.duration_minutes)} (${item.duration_minutes} min)`}
      footer={
        <>
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            className="mr-auto"
            onClick={async () => {
              try {
                await backend.remove('study_plan_items', [eq('id', item.id)])
                await invalidateTables(qc, ['study_plan_items'])
                onClose()
              } catch (e) {
                toast.error(e)
              }
            }}
          >
            Remover
          </Button>
          <Button icon={<Pencil className="size-4" />} onClick={() => onEdit(item)}>
            Editar
          </Button>
          <Button
            variant="dark"
            icon={<Play className="size-4" />}
            loading={study.pending}
            onClick={() => {
              onClose()
              void study.start({
                subject_id: item.subject_id,
                topic_id: item.topic_id,
                activity_type: item.activity_type,
                plan_item_id: item.id,
                minutes: item.duration_minutes,
                source: { kind: 'task', id: item.id, label: item.topic_id ? `${title} · ${lookups.topicName(item.topic_id)}` : title, href: '/' },
              })
            }}
          >
            Iniciar estudo
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{ACTIVITY_LABELS[item.activity_type]}</Badge>
          {item.topic_id && <Badge>{lookups.topicName(item.topic_id)}</Badge>}
          <Badge>{PLAN_STATUS_LABELS[item.status]}</Badge>
        </div>
        {item.notes && <p className="text-sm whitespace-pre-wrap text-ink">{item.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {(['done', 'partial', 'missed', 'pending'] as PlanItemStatus[])
            .filter((s) => s !== item.status)
            .map((s) => (
              <Button key={s} size="sm" onClick={() => setStatus(s)}>
                {PLAN_STATUS_LABELS[s]}
              </Button>
            ))}
        </div>
      </div>
    </Modal>
  )
}
