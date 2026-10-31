import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Checkbox, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { fetchAll, invalidateTables } from '@/hooks/data'
import { MAX_COPY_WEEKS, WEEKDAY_GROUPS, planCopy, type CopyableBlock } from '@/lib/copyBlocks'
import { gte, lte } from '@/lib/data/types'
import { WEEKDAY_LABELS } from '@/lib/labels'
import { addDays, formatDayKey, startOfWeek, weekday, type DayKey } from '@/lib/time'
import type { StudyPlan, StudyPlanItem } from '@/types/db'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // semana de segunda a domingo

/** Replica o horário fixo: de um dia para outros dias, ou da semana inteira para as próximas, sem preencher tudo de novo. */
export function CopyBlocksModal({ open, onClose, plan, anchor }: { open: boolean; onClose: () => void; plan: StudyPlan; anchor: DayKey }) {
  const [scope, setScope] = useState<'day' | 'week'>('day')
  const [date, setDate] = useState<DayKey>(anchor)
  const [targets, setTargets] = useState<number[]>([])
  const [weeks, setWeeks] = useState(1)
  const [rows, setRows] = useState<StudyPlanItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setDate(anchor)
    setScope('day')
    setTargets(WEEKDAY_GROUPS.weekdays.filter((d) => d !== weekday(anchor)))
    setWeeks(1)
  }, [open, anchor])

  const monday = startOfWeek(date)
  const days = useMemo(() => ORDER.map((wd) => ({ wd, date: addDays(monday, (wd + 6) % 7) })), [monday])

  // Blocos da semana de origem e das semanas de destino (para mostrar quantos serão criados e não duplicar).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchAll(backend, 'study_plan_items', { filters: [gte('date', monday), lte('date', addDays(monday, 7 * (Math.max(1, weeks) + 1)))] })
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && toast.error(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, backend, monday, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = rows as unknown as CopyableBlock[]
  const sourceCount = useMemo(() => {
    const end = addDays(monday, 6)
    return rows.filter((r) => r.status !== 'rescheduled' && (scope === 'week' ? r.date >= monday && r.date <= end : r.date === date)).length
  }, [rows, scope, date, monday])
  const result = useMemo(
    () => planCopy(blocks, blocks, scope === 'day' ? { kind: 'day', date, targetWeekdays: targets, weeks } : { kind: 'week', date, weeks }),
    [blocks, scope, date, targets, weeks],
  )

  const toggle = (wd: number) => setTargets((t) => (t.includes(wd) ? t.filter((x) => x !== wd) : [...t, wd]))
  const setGroup = (group: readonly number[]) => setTargets(group.filter((d) => d !== weekday(date)))

  const copy = async () => {
    if (!result.create.length) return
    setSaving(true)
    try {
      const rowsToInsert = result.create.map((b) => ({ plan_id: plan.id, date: b.date, start_time: b.start_time, duration_minutes: b.duration_minutes, subject_id: b.subject_id, topic_id: b.topic_id, activity_type: b.activity_type, notes: b.notes }))
      for (let i = 0; i < rowsToInsert.length; i += 500) await backend.insert('study_plan_items', rowsToInsert.slice(i, i + 500))
      toast.success(`${result.create.length} bloco(s) copiado(s).`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setSaving(false)
      await invalidateTables(qc, ['study_plan_items'])
    }
  }

  const noTargets = scope === 'day' && targets.length === 0 && weeks <= 1

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Copiar horários"
      description="Monte um dia (ou uma semana) e repita nos outros, sem preencher tudo de novo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Copy className="size-4" />} loading={saving} disabled={loading || !result.create.length} onClick={() => void copy()}>
            Copiar {result.create.length ? `${result.create.length} bloco(s)` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          label="O que copiar"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'day', label: 'Um dia' },
            { value: 'week', label: 'A semana inteira' },
          ]}
        />

        {scope === 'day' ? (
          <>
            <label className="block text-sm text-ink">
              Copiar os blocos de
              <Select aria-label="Dia de origem" className="mt-1 w-full" value={date} onChange={(e) => (setDate(e.target.value), setTargets((t) => t.filter((d) => d !== weekday(e.target.value))))}>
                {days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {WEEKDAY_LABELS[d.wd]}, {formatDayKey(d.date)}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset>
              <legend className="mb-1 text-sm text-ink">Para os dias</legend>
              <div className="mb-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setGroup(WEEKDAY_GROUPS.weekdays)}>
                  Segunda a sexta
                </Button>
                <Button size="sm" onClick={() => setGroup(WEEKDAY_GROUPS.weekend)}>
                  Sábado e domingo
                </Button>
                <Button size="sm" onClick={() => setGroup(WEEKDAY_GROUPS.all)}>
                  Todos os dias
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTargets([])}>
                  Limpar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                {ORDER.map((wd) => (
                  <Checkbox key={wd} label={WEEKDAY_LABELS[wd]} checked={targets.includes(wd)} disabled={wd === weekday(date)} onChange={() => toggle(wd)} />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <p className="text-sm text-muted">
            Vai repetir a semana de {formatDayKey(monday)} a {formatDayKey(addDays(monday, 6))}, com os mesmos dias e horários.
          </p>
        )}

        <label className="block text-sm text-ink">
          {scope === 'day' ? 'Repetir por quantas semanas (contando esta)' : 'Copiar para as próximas quantas semanas'}
          <input
            type="number"
            aria-label="Número de semanas"
            className="mt-1 block h-10 w-24 rounded-lg border border-line bg-bg px-3 text-sm text-ink"
            min={1}
            max={MAX_COPY_WEEKS}
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, Math.min(MAX_COPY_WEEKS, Math.floor(Number(e.target.value)) || 1)))}
          />
        </label>

        <p role="status" className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
          {loading
            ? 'Calculando…'
            : sourceCount === 0
              ? scope === 'day'
                ? 'Este dia não tem blocos para copiar.'
                : 'Esta semana não tem blocos para copiar.'
              : noTargets
                ? 'Escolha pelo menos um dia de destino (ou repita por mais de uma semana).'
                : `Vai criar ${result.create.length} bloco(s) a partir de ${sourceCount}.${result.skipped ? ` ${result.skipped} já existe(m) e será(ão) ignorado(s).` : ''}`}
        </p>
      </div>
    </Modal>
  )
}
