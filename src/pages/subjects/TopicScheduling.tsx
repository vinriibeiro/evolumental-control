import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, RefreshCcw } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables, useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { useSubjects } from '@/hooks/domain'
import { eq } from '@/lib/data/types'
import { defaultPlanConfig } from '@/lib/planner'
import { addDays, todayKey } from '@/lib/time'
import type { Subject, Topic } from '@/types/db'
import { PlanItemForm } from '@/pages/schedule/PlanItemForm'

/** Liga o tópico ao calendário (agenda um bloco) e ao ciclo (entra como bloco no ciclo ativo). */
export function TopicScheduling({ subject, topic }: { subject: Subject; topic: Topic }) {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const plans = useAll('study_plans', { order: [{ column: 'created_at' }] })
  const cycles = useAll('study_cycles', { filters: [eq('status', 'active')] })
  const subjects = useSubjects()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState<{ plan: NonNullable<typeof plans.data>[number] } | null>(null)
  const [busy, setBusy] = useState(false)

  const minutes = Math.max(10, Math.min(180, topic.estimated_minutes ?? 60))

  const schedule = async () => {
    setBusy(true)
    try {
      let plan = (plans.data ?? []).find((p) => p.status === 'active') ?? plans.data?.[0]
      if (!plan) {
        const config = { ...defaultPlanConfig(), subjectIds: (subjects.data ?? []).map((s) => s.id) }
        ;[plan] = await backend.insert('study_plans', [{ name: 'Meu planejamento', start_date: today, end_date: addDays(today, 364), config, status: 'active' }])
        await invalidateTables(qc, ['study_plans'])
      }
      setForm({ plan })
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const addToCycle = async () => {
    const cycle = cycles.data?.[0]
    if (!cycle) {
      toast.info('Nenhum ciclo ativo. Crie ou ative um em Calendário → modo Ciclo.')
      navigate('/calendario?modo=ciclo')
      return
    }
    setBusy(true)
    try {
      const { rows } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] })
      if (rows.some((r) => r.topic_id === topic.id)) {
        toast.info(`"${topic.name}" já está no ciclo "${cycle.name}".`)
        return
      }
      await backend.insert('study_cycle_items', [{ cycle_id: cycle.id, subject_id: subject.id, topic_id: topic.id, duration_minutes: minutes, sort_order: rows.length, weight: 1, break_minutes: 0, activity_type: 'theory' }])
      await invalidateTables(qc, ['study_cycle_items', 'study_cycles'])
      toast.success(`"${topic.name}" entrou no ciclo "${cycle.name}" (${minutes} min).`)
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarPlus className="size-4 text-accent-strong" aria-hidden /> Calendário e ciclo
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<CalendarPlus className="size-4" aria-hidden />} loading={busy} onClick={() => void schedule()}>
          Agendar no calendário
        </Button>
        <Button size="sm" icon={<RefreshCcw className="size-4" aria-hidden />} loading={busy} onClick={() => void addToCycle()}>
          Colocar no ciclo
        </Button>
      </div>
      {form && <PlanItemForm open plan={form.plan} defaultDate={today} defaultDuration={minutes} defaultLink={{ subjectId: subject.id, topicId: topic.id }} onClose={() => setForm(null)} />}
    </div>
  )
}
