// "Reorganizar minha semana": mostra a PRÉVIA do replanejamento. Nada muda na agenda até o usuário aceitar
// todas as alterações ou só as que escolher.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarX, Clock, Lightbulb } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables } from '@/hooks/data'
import { replanWeek, type DurationInsight, type PlanActivity, type ReplanOptions } from '@/lib/replan'
import { addDays, formatDayKey, minutesToHhmm, startOfWeek } from '@/lib/time'
import { applyReplan } from '@/services/tasks'

const when = (date: string, start: number | null) => `${formatDayKey(date, 'weekday')}${start != null ? ` · ${minutesToHhmm(start)}` : ''}`

export function ReplanDialog({ open, onClose, activities, options, insights }: { open: boolean; onClose: () => void; activities: PlanActivity[]; options: Omit<ReplanOptions, 'horizonEnd'>; insights: DurationInsight[] }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [nextWeek, setNextWeek] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const horizonEnd = addDays(startOfWeek(options.today), nextWeek ? 13 : 6)
  const result = useMemo(() => replanWeek(activities, { ...options, horizonEnd }), [activities, options, horizonEnd])

  // a cada nova prévia, tudo começa selecionado
  useEffect(() => {
    if (open) setPicked(new Set(result.moves.map((m) => m.activity.id)))
  }, [open, result])

  const apply = async (all: boolean) => {
    const moves = result.moves.filter((m) => all || picked.has(m.activity.id))
    if (!moves.length) return
    setBusy(true)
    try {
      const n = await applyReplan(backend, moves)
      toast.success(`${n} atividade(s) reagendada(s).${n < moves.length ? ` ${moves.length - n} já tinha(m) sido alterada(s) e ficou(aram) como estava(m).` : ''}`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['calendar_tasks', 'study_plan_items'])
    }
  }

  const nothing = result.overdue.length === 0
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Reorganizar minha semana"
      description="Prévia das sugestões. Nada é alterado até você confirmar."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          {result.moves.length > 0 && (
            <>
              <Button onClick={() => apply(false)} loading={busy} disabled={picked.size === 0 || picked.size === result.moves.length}>
                Aplicar selecionadas ({picked.size})
              </Button>
              <Button variant="primary" onClick={() => apply(true)} loading={busy}>
                Aceitar todas
              </Button>
            </>
          )}
        </>
      }
    >
      {nothing ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">Nenhuma atividade atrasada.</p>
          <p className="mt-1 text-sm text-muted">Sua semana está em dia: não há nada para reorganizar.</p>
          {result.conflicts.length > 0 && <p className="mt-3 text-sm text-ink">Há {result.conflicts.length} conflito(s) de horário na agenda (veja abaixo).</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: result.overdue.length, label: 'atrasada(s)' },
              { n: result.moves.length, label: 'com novo horário' },
              { n: result.unplaced.length, label: 'sem encaixe' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-line px-2 py-2.5">
                <p className="tabular text-xl font-semibold text-ink">{s.n}</p>
                <p className="text-[11px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {result.moves.length > 0 && (
            <section aria-labelledby="replan-moves">
              <h3 id="replan-moves" className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                <Clock className="size-3.5" aria-hidden /> Novos horários sugeridos
              </h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {result.moves.map((m) => {
                  const on = picked.has(m.activity.id)
                  return (
                    <li key={m.activity.id} className="flex items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--ink)]"
                        checked={on}
                        aria-label={`Mover ${m.activity.title}`}
                        onChange={() => {
                          const next = new Set(picked)
                          if (on) next.delete(m.activity.id)
                          else next.add(m.activity.id)
                          setPicked(next)
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{m.activity.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span className="line-through">{when(m.activity.date, m.activity.start)}</span>
                          <ArrowRight className="size-3" aria-hidden />
                          <span className="font-medium text-ink">{when(m.toDate, m.toStart)}</span>
                          {m.activity.duration ? <span>· {m.activity.duration} min</span> : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{m.reason}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {result.unplaced.length > 0 && (
            <section aria-labelledby="replan-unplaced">
              <h3 id="replan-unplaced" className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                <CalendarX className="size-3.5" aria-hidden /> Não foram encaixadas
              </h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {result.unplaced.map((u) => (
                  <li key={u.activity.id} className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-ink">{u.activity.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {when(u.activity.date, u.activity.start)} · {u.reason}
                    </p>
                  </li>
                ))}
              </ul>
              {!nextWeek && result.unplaced.some((u) => /Não há horário livre até o fim da semana|limite diário/.test(u.reason)) && <p className="mt-2 text-xs text-muted">Não coube tudo nesta semana. Você pode ampliar a busca para a semana seguinte.</p>}
            </section>
          )}
        </div>
      )}

      {result.conflicts.length > 0 && (
        <section aria-labelledby="replan-conflicts" className="mt-5">
          <h3 id="replan-conflicts" className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-accent uppercase">
            <AlertTriangle className="size-3.5" aria-hidden /> Conflitos de horário na agenda
          </h3>
          <ul className="space-y-1 text-xs text-ink">
            {result.conflicts.slice(0, 6).map(([a, b]) => (
              <li key={a.id + b.id}>
                {formatDayKey(a.date, 'weekday')}: <strong className="font-medium">{a.title}</strong> ({minutesToHhmm(a.start ?? 0)}) e <strong className="font-medium">{b.title}</strong> ({minutesToHhmm(b.start ?? 0)}) se sobrepõem.
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">Conflitos não são resolvidos automaticamente: ajuste arrastando no calendário.</p>
        </section>
      )}

      {insights.length > 0 && (
        <section aria-labelledby="replan-insights" className="mt-5 rounded-lg bg-surface-2 px-3 py-3">
          <h3 id="replan-insights" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink">
            <Lightbulb className="size-3.5" aria-hidden /> Duração: o que o seu histórico mostra
          </h3>
          <ul className="space-y-1 text-xs text-muted">
            {insights.slice(0, 3).map((i) => (
              <li key={i.key}>
                <strong className="font-medium text-ink">{i.label}:</strong> sessões planejadas para {i.plannedMinutes} min costumam durar {i.typicalMinutes} min ({i.samples} sessões). Considere planejar {i.suggestedMinutes} min.
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted">É só uma sugestão com base nas sessões registradas. Suas preferências não são alteradas.</p>
        </section>
      )}

      <div className="mt-5 border-t border-line pt-3">
        <Checkbox label="Considerar também a semana seguinte, se não couber nesta" checked={nextWeek} onChange={(e) => setNextWeek(e.target.checked)} />
      </div>
    </Modal>
  )
}
