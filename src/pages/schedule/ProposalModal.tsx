import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Badge, ColorDot } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, useToast } from '@/components/ui/feedback'
import { invalidateTables, useAll } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { eq, gte, inList } from '@/lib/data/types'
import { PLANNER_RULES, diffPlan, generatePlan, type PlannedBlock } from '@/lib/planner'
import { formatDayKey, formatDuration } from '@/lib/time'
import type { StudyPlan } from '@/types/db'

export function ProposalModal({ open, onClose, plan, today }: { open: boolean; onClose: () => void; plan: StudyPlan; today: string }) {
  const subjects = useSubjects()
  const lookups = useLookups()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const from = plan.start_date > today ? plan.start_date : today
  const existing = useAll('study_plan_items', { filters: [eq('plan_id', plan.id), gte('date', from)] }, { enabled: open })
  const proposal = useMemo<PlannedBlock[]>(() => (open && subjects.data ? generatePlan(plan.config, subjects.data, { from, to: plan.end_date }, today) : []), [open, subjects.data, plan, from, today])
  const diff = useMemo(() => diffPlan(existing.data ?? [], proposal), [existing.data, proposal])
  const minutesBySubject = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of proposal) m.set(b.subject_id, (m.get(b.subject_id) ?? 0) + b.duration_minutes)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [proposal])

  const apply = async () => {
    setBusy(true)
    try {
      // Substitui apenas blocos PENDENTES a partir de hoje; concluídos/parciais/não realizados ficam como histórico.
      await backend.remove('study_plan_items', [eq('plan_id', plan.id), gte('date', from), inList('status', ['pending'])])
      const rows = proposal.map((b) => ({ ...b, plan_id: plan.id }))
      for (let i = 0; i < rows.length; i += 500) await backend.insert('study_plan_items', rows.slice(i, i + 500))
      toast.success(`${rows.length} blocos aplicados ao cronograma.`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_plan_items', 'study_sessions'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Proposta de distribuição"
      description={`De ${formatDayKey(from)} a ${formatDayKey(plan.end_date)}. Revise antes de aplicar — só blocos pendentes são substituídos.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={apply} loading={busy} disabled={proposal.length === 0}>
            Aplicar proposta
          </Button>
        </>
      }
    >
      {existing.isPending || subjects.isPending ? (
        <Spinner />
      ) : proposal.length === 0 ? (
        <EmptyState title="Nenhum bloco pôde ser gerado" description="Verifique se há horários disponíveis, matérias selecionadas e período futuro no cronograma." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge>{proposal.length} blocos propostos</Badge>
              <Badge>+{diff.added} novos</Badge>
              <Badge>−{diff.removed} removidos</Badge>
              <Badge>{diff.kept} mantidos</Badge>
            </div>
            <p className="mb-2 text-sm font-medium text-ink">Tempo por matéria na proposta</p>
            <ul className="space-y-1.5">
              {minutesBySubject.map(([id, min]) => (
                <li key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <ColorDot color={lookups.subjectColor(id)} />
                    <span className="truncate text-ink">{lookups.subjectName(id)}</span>
                  </span>
                  <span className="tabular text-muted">
                    {formatDuration(min * 60)}
                    {diff.removedMinutesBySubject.get(id) ? ` · substitui ${formatDuration((diff.removedMinutesBySubject.get(id) ?? 0) * 60)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 mb-1 text-sm font-medium text-ink">Primeiros blocos</p>
            <ul className="space-y-1 text-xs text-muted">
              {proposal.slice(0, 8).map((b, i) => (
                <li key={i}>
                  {formatDayKey(b.date, 'weekday')} {b.start_time} · {b.duration_minutes} min · {lookups.subjectName(b.subject_id)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Info className="size-4" /> Regras usadas (determinísticas)
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted">
              {PLANNER_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">Altere disponibilidade, matérias e metas em "Editar configuração", ou prioridade/dificuldade no cadastro de cada matéria.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
