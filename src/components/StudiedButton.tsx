import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables, useUpdate } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { studiedEffects } from '@/lib/studied'
import { todayKey } from '@/lib/time'
import type { Topic } from '@/types/db'

/**
 * Confirma que o tópico foi estudado: conclui o tópico (com a data), avança o ciclo se ele for o bloco atual
 * e marca como feitos os blocos pendentes do cronograma. Desfazer só reabre o tópico.
 */
export function StudiedButton({ topic, size = 'md' }: { topic: Pick<Topic, 'id' | 'name' | 'status'>; size?: 'sm' | 'md' }) {
  const update = useUpdate('topics')
  const backend = useBackend()
  const qc = useQueryClient()
  const settings = useSettings()
  const toast = useToast()
  const done = topic.status === 'completed'

  const toggle = async () => {
    try {
      await update.mutateAsync({ id: topic.id, patch: { status: done ? 'in_progress' : 'completed' } })
      if (done) {
        toast.success(`"${topic.name}" voltou para "Em andamento".`)
        return
      }

      const notes: string[] = []
      try {
        const { rows: cycles } = await backend.list('study_cycles', { filters: [eq('status', 'active')] })
        const cycle = cycles[0] ?? null
        const { rows: cycleItems } = cycle ? await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] }) : { rows: [] }
        const { rows: planItems } = await backend.list('study_plan_items', { filters: [eq('topic_id', topic.id)] })
        const fx = studiedEffects({ topicId: topic.id, cycle, cycleItems, planItems, today: todayKey(settings.timezone) })
        if (cycle && fx.cyclePatch) {
          await backend.update('study_cycles', [eq('id', cycle.id)], fx.cyclePatch)
          notes.push(`o ciclo "${cycle.name}" avançou`)
        }
        for (const id of fx.planItemIds) await backend.update('study_plan_items', [eq('id', id)], { status: 'done' })
        if (fx.planItemIds.length) notes.push(`${fx.planItemIds.length} bloco(s) do cronograma marcado(s) como feito`)
        await invalidateTables(qc, ['study_cycles', 'study_cycle_items', 'study_plan_items'])
      } catch {
        notes.push('não consegui atualizar o ciclo e o cronograma')
      }
      toast.success(`"${topic.name}" marcado como estudado${notes.length ? ': ' + notes.join('; ') : ''}.`)
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Button
      size={size}
      loading={update.isPending}
      aria-pressed={done}
      icon={done ? <RotateCcw className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
      onClick={() => void toggle()}
    >
      {done ? 'Estudado · desfazer' : 'Marcar como estudado'}
    </Button>
  )
}
