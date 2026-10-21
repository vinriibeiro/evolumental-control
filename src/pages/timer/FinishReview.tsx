import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Card } from '@/components/ui/layout'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useAll, useRow } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, inList, lte, type SessionWithPauses } from '@/lib/data/types'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, MODE_LABELS } from '@/lib/labels'
import { grossMs, netSeconds, pausedSeconds } from '@/lib/timer/engine'
import { formatDayKey, formatDuration, formatTime, todayKey } from '@/lib/time'
import { useSessionActions } from '@/features/timer/useLiveSession'
import type { PartialDecision } from '@/lib/cycle'
import type { ActivityType } from '@/types/db'

/** Resumo exibido ao finalizar: o usuário confere, ajusta o permitido e salva. */
export function FinishReview({ session: s }: { session: SessionWithPauses }) {
  const settings = useSettings()
  const lookups = useLookups()
  const actions = useSessionActions()
  const toast = useToast()
  const confirm = useConfirm()
  const [link, setLink] = useState({ subjectId: s.subject_id, topicId: s.topic_id })
  const [activity, setActivity] = useState<ActivityType>(s.activity_type)
  const [notes, setNotes] = useState(s.notes ?? '')
  const [adjust, setAdjust] = useState('0')
  const [scheduleReviews, setScheduleReviews] = useState(settings.autoReviews)
  const [completeIds, setCompleteIds] = useState<string[]>([])
  const [cycleDecision, setCycleDecision] = useState<PartialDecision>('resume')
  const today = todayKey(settings.timezone)

  const dueReviews = useAll(
    'reviews',
    { filters: [eq('topic_id', link.topicId ?? ''), inList('status', ['planned', 'postponed']), lte('scheduled_for', today)] },
    { enabled: Boolean(link.topicId) },
  )
  const cycle = useRow('study_cycles', s.cycle_id)
  const cycleItem = useRow('study_cycle_items', s.cycle_item_id)

  useEffect(() => setCompleteIds([]), [link.topicId])

  const base = netSeconds({ ...s, adjustment_seconds: 0 }, s.pauses)
  const adjMin = Number(adjust)
  const validAdj = Number.isInteger(adjMin) && Math.abs(adjMin) <= 600 && base + adjMin * 60 >= 0
  const finalNet = validAdj ? base + adjMin * 60 : base
  const gross = Math.floor(grossMs(s, Date.now()) / 1000)
  const paused = pausedSeconds(s, s.pauses)

  const cycleRemaining = useMemo(() => {
    if (!cycle.data || !cycleItem.data) return null
    return cycleItem.data.duration_minutes * 60 - cycle.data.current_progress_seconds - finalNet
  }, [cycle.data, cycleItem.data, finalNet])

  const save = async () => {
    if (!validAdj) return toast.error('Ajuste inválido: use minutos inteiros (até ±600) sem deixar o tempo negativo.')
    try {
      const r = (await actions.confirm(s, {
        subject_id: link.subjectId,
        topic_id: link.topicId,
        activity_type: activity,
        notes: notes.trim().slice(0, 4000) || null,
        adjustment_seconds: adjMin * 60,
        scheduleReviews: scheduleReviews && link.topicId ? settings.reviewIntervals : [],
        completeReviewIds: completeIds,
        cycleDecision,
        timezone: settings.timezone,
      })) as { saved: boolean; netSeconds: number; cycleAdvanced?: boolean } | undefined
      if (r?.saved) toast.success(`Sessão salva: ${formatDuration(r.netSeconds)} de estudo líquido.${r.cycleAdvanced ? ' O ciclo avançou para o próximo bloco.' : ''}`)
    } catch (e) {
      toast.error(e)
    }
  }

  const discard = async () => {
    const ok = await confirm({ title: 'Descartar esta sessão?', message: 'O tempo não será contabilizado.', danger: true, confirmLabel: 'Descartar' })
    if (!ok) return
    try {
      await actions.discard(s)
      toast.info('Sessão descartada.')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Resumo da sessão</h2>
          <p className="text-sm text-muted">Confira os dados antes de salvar.</p>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-surface p-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-muted">Tempo líquido</dt>
          <dd className="tabular text-2xl font-semibold text-ink">{formatDuration(finalNet, { seconds: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pausado</dt>
          <dd className="tabular text-sm text-ink">{formatDuration(paused, { seconds: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Duração total</dt>
          <dd className="tabular text-sm text-ink">{formatDuration(gross, { seconds: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Horário</dt>
          <dd className="tabular text-sm text-ink">
            {formatTime(new Date(s.started_at).getTime(), settings.timezone, settings.hourFormat)}–{s.ended_at ? formatTime(new Date(s.ended_at).getTime(), settings.timezone, settings.hourFormat) : ''}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-xs text-muted">Modo</dt>
          <dd className="text-sm text-ink">{MODE_LABELS[s.mode]}</dd>
        </div>
      </dl>

      <div className="grid gap-4">
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={(v) => setLink(v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de atividade">
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
          <Field label="Ajuste manual (minutos)" hint="Ex.: −5 se esqueceu de pausar. Fica registrado na sessão." error={validAdj ? null : 'Ajuste inválido.'}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={adjust} onChange={(e) => setAdjust(e.target.value)} />}
          </Field>
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />}</Field>

        {link.topicId && (
          <div className="space-y-2 rounded-xl border border-line p-4">
            <Checkbox
              label={`Agendar revisões deste tópico em ${settings.reviewIntervals.join(', ')} dia(s)`}
              checked={scheduleReviews}
              onChange={(e) => setScheduleReviews(e.target.checked)}
            />
            {(dueReviews.data ?? []).map((r) => (
              <Checkbox
                key={r.id}
                label={`Marcar como realizada: revisão prevista para ${formatDayKey(r.scheduled_for)}`}
                checked={completeIds.includes(r.id)}
                onChange={(e) => setCompleteIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id)))}
              />
            ))}
          </div>
        )}

        {cycleItem.data && cycleRemaining != null && cycleRemaining > 0 && (
          <fieldset className="space-y-2 rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-medium text-ink">
              Bloco do ciclo ({lookups.subjectName(cycleItem.data.subject_id)}) ainda não foi concluído — faltam {formatDuration(cycleRemaining)}.
            </legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="cycle" checked={cycleDecision === 'resume'} onChange={() => setCycleDecision('resume')} className="accent-[var(--accent-strong)]" />
              Manter neste bloco e retomar o restante depois
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="cycle" checked={cycleDecision === 'advance'} onChange={() => setCycleDecision('advance')} className="accent-[var(--accent-strong)]" />
              Avançar o ciclo para o próximo bloco
            </label>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="dark" size="lg" onClick={save} loading={actions.pending}>
            Salvar sessão
          </Button>
          <Button size="lg" variant="ghost" icon={<Trash2 className="size-4" />} onClick={discard} disabled={actions.pending}>
            Descartar
          </Button>
        </div>
      </div>
    </Card>
  )
}
