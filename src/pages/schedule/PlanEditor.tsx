import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useInsert, useUpdate } from '@/hooks/data'
import { useSubjects } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, WEEKDAY_LABELS } from '@/lib/labels'
import { defaultPlanConfig } from '@/lib/planner'
import { addDays, diffDays, hhmmToMinutes, todayKey } from '@/lib/time'
import type { ActivityType, PlanConfig, StudyPlan, TimeWindow } from '@/types/db'

const ORDER = [1, 2, 3, 4, 5, 6, 0]

export function PlanEditor({ open, onClose, plan, onSaved }: { open: boolean; onClose: () => void; plan?: StudyPlan | null; onSaved?: (p: StudyPlan) => void }) {
  const settings = useSettings()
  const subjects = useSubjects()
  const insert = useInsert('study_plans')
  const update = useUpdate('study_plans')
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [config, setConfig] = useState<PlanConfig>(defaultPlanConfig())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const today = todayKey(settings.timezone)
    setName(plan?.name ?? 'Meu cronograma')
    setDescription(plan?.description ?? '')
    setStart(plan?.start_date ?? today)
    setEnd(plan?.end_date ?? addDays(today, 27))
    const base = defaultPlanConfig()
    setConfig(plan ? { ...base, ...plan.config } : { ...base, subjectIds: (subjects.data ?? []).filter((s) => s.status === 'active').map((s) => s.id) })
    setError(null)
  }, [open, plan]) // eslint-disable-line react-hooks/exhaustive-deps

  const setWindows = (kind: 'availability' | 'commitments', day: number, list: TimeWindow[]) => setConfig((c) => ({ ...c, [kind]: { ...c[kind], [day]: list } }))

  const validateAll = (): string | null => {
    if (!name.trim()) return 'Informe o nome do cronograma.'
    if (!start || !end || end < start) return 'O período é inválido.'
    if (diffDays(start, end) > 400) return 'O cronograma pode ter no máximo 400 dias.'
    if (config.blockMinutes < 10 || config.blockMinutes > 600) return 'Blocos devem ter entre 10 e 600 minutos.'
    if (config.breakMinutes < 0 || config.breakMinutes > 240) return 'Intervalos devem ter entre 0 e 240 minutos.'
    for (const kind of ['availability', 'commitments'] as const) {
      for (const d of ORDER) {
        for (const w of config[kind][d] ?? []) {
          if (!/^\d{2}:\d{2}$/.test(w.start) || !/^\d{2}:\d{2}$/.test(w.end) || hhmmToMinutes(w.end) <= hhmmToMinutes(w.start))
            return `Horário inválido em ${WEEKDAY_LABELS[d]}: o fim deve ser depois do início.`
        }
      }
    }
    if (config.subjectIds.length === 0) return 'Selecione ao menos uma matéria.'
    return null
  }

  const save = async () => {
    const err = validateAll()
    if (err) return setError(err)
    const data = { name: name.trim().slice(0, 160), description: description.trim() || null, start_date: start, end_date: end, config }
    try {
      const saved = plan ? (await update.mutateAsync({ id: plan.id, patch: data }))[0] : (await insert.mutateAsync(data))[0]
      toast.success('Cronograma salvo.')
      onSaved?.(saved)
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      persistent
      title={plan ? 'Editar cronograma' : 'Novo cronograma'}
      description="Defina sua disponibilidade. Depois, gere uma proposta automática ou monte os blocos manualmente."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-6">
        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Nome" className="sm:col-span-2">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Início">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Fim">{(id) => <Input id={id} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}</Field>
          <Field label="Descrição" className="sm:col-span-4">
            {(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          <Field label="Bloco (min)">{(id) => <Input id={id} type="number" min={10} max={600} value={config.blockMinutes} onChange={(e) => setConfig({ ...config, blockMinutes: Number(e.target.value) })} />}</Field>
          <Field label="Intervalo (min)">{(id) => <Input id={id} type="number" min={0} max={240} value={config.breakMinutes} onChange={(e) => setConfig({ ...config, breakMinutes: Number(e.target.value) })} />}</Field>
          <Field label="Meta h/dia">
            {(id) => <Input id={id} type="number" min={0} step={0.5} value={config.dailyHoursGoal ?? ''} placeholder="—" onChange={(e) => setConfig({ ...config, dailyHoursGoal: e.target.value ? Number(e.target.value) : null })} />}
          </Field>
          <Field label="Meta h/semana">
            {(id) => <Input id={id} type="number" min={0} step={0.5} value={config.weeklyHoursGoal ?? ''} placeholder="—" onChange={(e) => setConfig({ ...config, weeklyHoursGoal: e.target.value ? Number(e.target.value) : null })} />}
          </Field>
          <Field label="Atividade padrão">
            {(id) => (
              <Select id={id} value={config.activityType} onChange={(e) => setConfig({ ...config, activityType: e.target.value as ActivityType })}>
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <WindowsEditor title="Dias e horários disponíveis" value={config.availability} onChange={(d, l) => setWindows('availability', d, l)} />
          <WindowsEditor title="Compromissos e intervalos (bloqueados)" value={config.commitments} onChange={(d, l) => setWindows('commitments', d, l)} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Matérias do cronograma</p>
          {(subjects.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">Cadastre matérias primeiro.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {subjects.data!.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                  <Checkbox label={s.name} checked={config.subjectIds.includes(s.id)} onChange={() => setConfig({ ...config, subjectIds: toggle(config.subjectIds, s.id) })} />
                  <Checkbox
                    label={<span className="text-xs text-muted">maior frequência</span>}
                    checked={config.frequentSubjectIds.includes(s.id)}
                    disabled={!config.subjectIds.includes(s.id)}
                    onChange={() => setConfig({ ...config, frequentSubjectIds: toggle(config.frequentSubjectIds, s.id) })}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">Prioridade, dificuldade, meta semanal e data de conclusão vêm do cadastro de cada matéria.</p>
        </div>
      </div>
    </Modal>
  )
}

function WindowsEditor({ title, value, onChange }: { title: string; value: Record<number, TimeWindow[]>; onChange: (day: number, list: TimeWindow[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{title}</p>
      <div className="space-y-2">
        {ORDER.map((d) => {
          const list = value[d] ?? []
          return (
            <div key={d} className="flex flex-wrap items-start gap-2 rounded-lg border border-line px-3 py-2">
              <span className="w-16 shrink-0 pt-1.5 text-sm text-ink">{WEEKDAY_LABELS[d].slice(0, 3)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {list.length === 0 && <span className="pt-1.5 text-xs text-muted">—</span>}
                {list.map((w, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input type="time" aria-label="Início" className="h-8 w-28" value={w.start} onChange={(e) => onChange(d, list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                    <span className="text-xs text-muted">às</span>
                    <Input type="time" aria-label="Fim" className="h-8 w-28" value={w.end} onChange={(e) => onChange(d, list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                    <IconButton size="sm" label="Remover horário" onClick={() => onChange(d, list.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                ))}
              </div>
              <IconButton size="sm" label={`Adicionar horário em ${WEEKDAY_LABELS[d]}`} onClick={() => onChange(d, [...list, { start: '19:00', end: '21:00' }])}>
                <Plus className="size-4" />
              </IconButton>
            </div>
          )
        })}
      </div>
    </div>
  )
}
