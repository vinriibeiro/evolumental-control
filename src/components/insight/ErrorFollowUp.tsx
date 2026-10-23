import { useState } from 'react'
import { CalendarPlus, Layers, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAll, useInsert } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { addDays, formatDayKey, todayKey } from '@/lib/time'
import { CardForm } from '@/pages/flashcards/CardForm'

export interface FollowUpTarget {
  subjectId: string | null
  topicId: string | null
  wrong: number
}

/**
 * Depois de registrar questões com erros: oferece (nunca cria sozinho) uma
 * revisão, um bloco no ciclo ou um flashcard sobre o assunto.
 */
export function ErrorFollowUp({ target, onClose }: { target: FollowUpTarget | null; onClose: () => void }) {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const lookups = useLookups()
  const toast = useToast()
  const insertReview = useInsert('reviews')
  const insertItem = useInsert('study_cycle_items')
  const cycles = useAll('study_cycles', { filters: [eq('status', 'active')] }, { enabled: Boolean(target) })
  const cycle = cycles.data?.[0]
  const items = useAll('study_cycle_items', { filters: [eq('cycle_id', cycle?.id ?? '')] }, { enabled: Boolean(cycle) })
  const [card, setCard] = useState<FollowUpTarget | null>(null)
  const label = target ? (target.topicId ? lookups.topicName(target.topicId) : lookups.subjectName(target.subjectId)) : ''

  const review = async (days: number) => {
    if (!target) return
    try {
      await insertReview.mutateAsync({ subject_id: target.subjectId, topic_id: target.topicId, title: `Revisar erros: ${label}`, scheduled_for: addDays(today, days), origin: 'manual' })
      toast.success(`Revisão agendada para ${formatDayKey(addDays(today, days), 'long')}.`)
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  const addToCycle = async () => {
    if (!target?.subjectId || !cycle) return
    try {
      const order = (items.data ?? []).reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
      await insertItem.mutateAsync({ cycle_id: cycle.id, subject_id: target.subjectId, topic_id: target.topicId, duration_minutes: 30, sort_order: order, weight: 1, break_minutes: 0, activity_type: 'review' })
      toast.success(`Bloco de revisão de 30 min adicionado ao ciclo "${cycle.name}".`)
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <>
      <Modal
        open={Boolean(target)}
        onClose={onClose}
        title="Quer revisar este assunto?"
        description={target ? `${target.wrong} erro(s) em ${label}. Nada é criado sem a sua escolha.` : undefined}
        size="sm"
        footer={
          <Button variant="ghost" onClick={onClose}>
            Não agora
          </Button>
        }
      >
        <div className="grid gap-2">
          <Button icon={<CalendarPlus className="size-4" />} onClick={() => void review(1)} loading={insertReview.isPending}>
            Revisar amanhã
          </Button>
          <Button icon={<CalendarPlus className="size-4" />} onClick={() => void review(3)} loading={insertReview.isPending}>
            Revisar em 3 dias
          </Button>
          <Button icon={<RefreshCcw className="size-4" />} onClick={() => void addToCycle()} disabled={!cycle || !target?.subjectId} loading={insertItem.isPending}>
            Adicionar ao ciclo
          </Button>
          {!cycle && <p className="-mt-1 text-xs text-muted">Nenhum ciclo ativo para receber o bloco.</p>}
          <Button
            icon={<Layers className="size-4" />}
            onClick={() => {
              setCard(target)
              onClose()
            }}
          >
            Criar flashcard
          </Button>
        </div>
      </Modal>
      <CardForm open={Boolean(card)} onClose={() => setCard(null)} defaults={{ subjectId: card?.subjectId ?? null, topicId: card?.topicId ?? null }} />
    </>
  )
}
