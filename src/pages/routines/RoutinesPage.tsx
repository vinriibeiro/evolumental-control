import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Info, ListChecks, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select } from '@/components/ui/Field'
import { Badge, Card, PageHeader } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { Spinner, useToast } from '@/components/ui/feedback'
import { useAll, useTransaction } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { ROUTINE_TEMPLATES, cloneRoutineTemplate, routineTemplateById, type RoutineTemplatePillar } from '@/content/routines'
import { eq } from '@/lib/data/types'
import type { PillarFrequency } from '@/lib/routine'
import { ACTIVITY_LABELS, WEEKDAY_LABELS, WEEKDAY_SHORT } from '@/lib/labels'
import { addDays, formatDayKey, todayKey, weekday } from '@/lib/time'
import { cn } from '@/lib/cn'
import {
  applyRoutine,
  appliedRoutineFrom,
  diffRoutine,
  loadAppliedRoutine,
  pillarSubjectDefs,
  previewRoutine,
  previewSubjectId,
  type ApplyRoutineResult,
  type RoutineDiff,
  type RoutineDraft,
  type RoutineDraftMilestone,
} from '@/services/routines'
import type { ActivityType } from '@/types/db'

const STEPS = ['Modelo', 'Pilares', 'Disponibilidade', 'Prévia'] as const
const FREQ_LABELS: Record<PillarFrequency, string> = { daily: 'Todos os dias', days_per_week: 'Alguns dias por semana (ciclo)', weekly: 'Uma vez por semana (tarefa)' }
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

type DayForm = { on: boolean; start: string; end: string }

const num = (v: string, min: number, max: number, fallback: number) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const optNum = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v.replace(',', '.')) || 0)))

function defaultDays(): Record<number, DayForm> {
  const out: Record<number, DayForm> = {}
  for (let d = 0; d < 7; d++) out[d] = d === 0 || d === 6 ? { on: true, start: '09:00', end: '12:00' } : { on: true, start: '19:00', end: '22:00' }
  return out
}

/** O formulário tem uma janela por dia: usa a primeira de cada dia da rotina aplicada. */
function daysFromAvailability(av: RoutineDraft['availability']): Record<number, DayForm> {
  const base = defaultDays()
  const out: Record<number, DayForm> = {}
  for (let d = 0; d < 7; d++) {
    const w = av.days[d]?.[0]
    out[d] = w ? { on: true, start: w.start, end: w.end } : { ...base[d], on: false }
  }
  return out
}

export default function RoutinesPage() {
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [templateId, setTemplateId] = useState(ROUTINE_TEMPLATES[0].id)
  const [name, setName] = useState(ROUTINE_TEMPLATES[0].name)
  const [pillars, setPillars] = useState<RoutineTemplatePillar[]>(() => cloneRoutineTemplate(ROUTINE_TEMPLATES[0]).pillars)
  const [milestones, setMilestones] = useState<RoutineDraftMilestone[]>(() => ROUTINE_TEMPLATES[0].milestones.map((m) => ({ ...m })))
  const [days, setDays] = useState(defaultDays)
  const [dailyLimit, setDailyLimit] = useState('150')
  const [weeklyLimit, setWeeklyLimit] = useState('720')
  const [breakMin, setBreakMin] = useState('10')
  const [startDate, setStartDate] = useState(() => todayKey(settings.timezone))
  const [weeks, setWeeks] = useState('4')
  const [done, setDone] = useState<ApplyRoutineResult | null>(null)
  const [progress, setProgress] = useState('')
  const [editing, setEditing] = useState(false)
  const [diff, setDiff] = useState<RoutineDiff | 'loading' | null>(null)
  const [legacyNotes, setLegacyNotes] = useState<string[]>([])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const backend = useBackend()
  const activePlans = useAll('study_plans', { filters: [eq('status', 'active')] })
  const applied = useMemo(() => appliedRoutineFrom(activePlans.data ?? []), [activePlans.data])

  const apply = useTransaction(
    ['subjects', 'topics', 'study_materials', 'study_cycles', 'study_cycle_items', 'study_plans', 'study_plan_items', 'calendar_tasks', 'study_goals'],
    (b, d: RoutineDraft) => applyRoutine(b, d, { onProgress: setProgress }),
  )

  const loadApplied = async () => {
    if (!applied) return
    let source = applied
    if (applied.legacy) {
      // Versão anterior: completa pesos e marcos com o que está gravado.
      try {
        source = (await loadAppliedRoutine(backend)) ?? applied
      } catch (e) {
        toast.error(e)
      }
    }
    setLegacyNotes(source.legacy?.missing ?? [])
    const d = source.draft
    const av = d.availability
    setTemplateId(d.templateId)
    setName(d.name)
    setPillars(d.pillars.map((p) => ({ ...p })))
    setMilestones(d.milestones.map((m) => ({ ...m })))
    setDays(daysFromAvailability(av))
    setDailyLimit(av.dailyLimitMinutes == null ? '' : String(av.dailyLimitMinutes))
    setWeeklyLimit(av.weeklyLimitMinutes == null ? '' : String(av.weeklyLimitMinutes))
    setBreakMin(String(av.breakMinutes ?? 10))
    setStartDate(d.startDate)
    setWeeks(String(d.weeks))
    setEditing(true)
    setDone(null)
    setStep(1)
  }

  const startOver = () => {
    setEditing(false)
    setLegacyNotes([])
    chooseTemplate(ROUTINE_TEMPLATES[0].id)
    setDays(defaultDays())
    setStartDate(todayKey(settings.timezone))
    setStep(0)
  }

  /** Só lê os dados: cancelar a prévia não grava nada. */
  const openDiff = async () => {
    setDiff('loading')
    try {
      setDiff(await diffRoutine(backend, draft))
    } catch (e) {
      setDiff(null)
      toast.error(e)
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const chooseTemplate = (id: string) => {
    const t = routineTemplateById(id)
    if (!t) return
    const copy = cloneRoutineTemplate(t)
    setTemplateId(id)
    setName(t.name)
    setPillars(copy.pillars)
    setMilestones(copy.milestones.map((m) => ({ ...m })))
    setDone(null)
  }

  const draft = useMemo<RoutineDraft>(() => {
    const availability: RoutineDraft['availability'] = { days: {}, dailyLimitMinutes: optNum(dailyLimit), weeklyLimitMinutes: optNum(weeklyLimit), breakMinutes: num(breakMin, 0, 60, 10) }
    for (let d = 0; d < 7; d++) availability.days[d] = days[d].on && days[d].end > days[d].start ? [{ start: days[d].start, end: days[d].end }] : []
    return { templateId, name: name.trim() || 'Minha rotina', pillars, availability, startDate, weeks: Math.round(num(weeks, 1, 12, 4)), milestones }
  }, [templateId, name, pillars, days, dailyLimit, weeklyLimit, breakMin, startDate, weeks, milestones])

  const problems = useMemo(() => {
    const out: string[] = []
    if (step >= 1 && pillars.length === 0) out.push('Adicione ao menos um pilar.')
    if (step >= 1 && pillars.some((p) => !p.name.trim())) out.push('Todo pilar precisa de um nome.')
    if (step >= 2 && !Object.values(draft.availability.days).some((w) => w.length)) out.push('Marque ao menos um dia com horário de fim depois do início.')
    if (step >= 2 && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) out.push('Informe a data de início.')
    return out
  }, [step, pillars, draft, startDate])

  const canGo = (target: number) => target <= step || problems.length === 0
  const go = (target: number) => {
    if (target < 0 || target >= STEPS.length) return
    if (!canGo(target)) return toast.error(problems[0])
    setStep(target)
  }

  const onStepperKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.key === 'ArrowRight') go(step + 1)
    else if (e.key === 'ArrowLeft') go(step - 1)
    else return
    e.preventDefault()
  }

  const run = async () => {
    try {
      setDone(await apply.mutateAsync(draft))
      setDiff(null)
      setLegacyNotes([])
    } catch (e) {
      toast.error(e)
    }
  }

  const updatePillar = (idx: number, patch: Partial<RoutineTemplatePillar>) => setPillars((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)))

  return (
    <div>
      <PageHeader
        title="Rotinas"
        description="Monte uma rotina por regras claras (sem IA): escolha um modelo, ajuste os pilares e sua disponibilidade, confira a prévia e aplique. Aplicar de novo não duplica nada."
      />

      {editing ? (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4" role="status">
          <p className="text-sm text-ink">
            Editando a rotina aplicada <strong>{name}</strong>. Ajuste pilares, pesos, frequências e horários; ao regerar, você vê o que entra, sai e muda antes de confirmar.
          </p>
          <Button size="sm" variant="ghost" onClick={startOver}>
            Começar do zero
          </Button>
          {legacyNotes.length > 0 && (
            <div className="w-full text-xs text-muted">
              <p className="font-medium text-ink">Esta rotina foi aplicada por uma versão anterior, que não salvava a configuração. Revise antes de regerar:</p>
              <ul className="list-disc pl-5">
                {legacyNotes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        applied && (
          <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink">
              Rotina aplicada: <strong>{applied.draft.name}</strong> ({applied.draft.pillars.length} pilares, desde {formatDayKey(applied.draft.startDate)}).
            </p>
            <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={loadApplied}>
              Editar rotina aplicada
            </Button>
          </Card>
        )
      )}

      <nav aria-label="Passos do assistente" className="mb-5">
        <ol className="flex flex-wrap gap-2" onKeyDown={onStepperKey}>
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={step === i ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-strong',
                  step === i ? 'border-accent-strong bg-surface font-medium text-ink' : 'border-line text-muted hover:text-ink',
                )}
              >
                <span className={cn('grid size-5 place-items-center rounded-full text-xs', i < step ? 'bg-accent text-accent-ink' : 'bg-surface-2')} aria-hidden>
                  {i < step ? <Check className="size-3" /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">Dica: use as setas ← e → nos passos para navegar.</p>
      </nav>

      <section aria-labelledby="routine-step-title">
        <h2 id="routine-step-title" ref={headingRef} tabIndex={-1} className="mb-3 text-lg font-semibold text-ink focus:outline-none">
          {step + 1}. {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="space-y-4">
            {editing && <p className="text-sm text-muted">Na edição, o modelo e o nome ficam fixos para atualizar a mesma rotina. Para trocar de modelo, use "Começar do zero".</p>}
            <fieldset className="grid gap-3 sm:grid-cols-2" disabled={editing} hidden={editing}>
              <legend className="sr-only">Modelo de rotina</legend>
              {ROUTINE_TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={cn('flex cursor-pointer gap-3 rounded-xl border p-4 focus-within:border-accent-strong', templateId === t.id ? 'border-accent-strong bg-surface' : 'border-line bg-bg')}
                >
                  <input type="radio" name="routine-template" className="mt-1 accent-[var(--accent-strong)]" checked={templateId === t.id} onChange={() => chooseTemplate(t.id)} />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{t.name}</span>
                    <span className="mt-1 block text-sm text-muted">{t.description}</span>
                    <span className="mt-2 block text-xs text-muted">{t.pillars.length ? `${t.pillars.length} pilares` : 'Sem pilares: monte os seus'}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Field label="Nome da rotina" hint="O ciclo, o cronograma e a meta criados levam este nome; aplicar de novo com o mesmo nome atualiza a mesma rotina.">
              {(id, d) => <Input id={id} aria-describedby={d} value={name} maxLength={120} readOnly={editing} onChange={(e) => setName(e.target.value)} className="max-w-md" />}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {pillars.map((p, idx) => (
              <Card key={p.id} className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
                  <Field label="Pilar">{(id) => <Input id={id} value={p.name} maxLength={120} onChange={(e) => updatePillar(idx, { name: e.target.value })} />}</Field>
                  <Field label="Peso (1–10)">
                    {(id) => <Input id={id} type="number" min={1} max={10} value={p.weight} onChange={(e) => updatePillar(idx, { weight: num(e.target.value, 0, 10, p.weight) })} />}
                  </Field>
                  <Field label="Frequência">
                    {(id) => (
                      <Select id={id} value={p.frequency} onChange={(e) => updatePillar(idx, { frequency: e.target.value as PillarFrequency })}>
                        {(Object.keys(FREQ_LABELS) as PillarFrequency[]).map((f) => (
                          <option key={f} value={f}>
                            {FREQ_LABELS[f]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Dias por semana">
                    {(id) => (
                      <Input id={id} type="number" min={1} max={7} disabled={p.frequency !== 'days_per_week'} value={p.daysPerWeek ?? 1} onChange={(e) => updatePillar(idx, { daysPerWeek: Math.round(num(e.target.value, 1, 7, 1)) })} />
                    )}
                  </Field>
                  <Field label="Bloco (min)">
                    {(id) => <Input id={id} type="number" min={5} max={240} step={5} value={p.blockMinutes} onChange={(e) => updatePillar(idx, { blockMinutes: Math.round(num(e.target.value, 5, 240, p.blockMinutes)) })} />}
                  </Field>
                  <IconButton label={`Remover o pilar ${p.name}`} onClick={() => setPillars((ps) => ps.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-end">
                  <Field label="Atividade">
                    {(id) => (
                      <Select id={id} value={p.activityType} onChange={(e) => updatePillar(idx, { activityType: e.target.value as ActivityType })}>
                        {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((a) => (
                          <option key={a} value={a}>
                            {ACTIVITY_LABELS[a]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <p className="text-xs text-muted">
                    {p.description ? `${p.description} ` : ''}
                    {pillarSubjectDefs(p).length ? `Matérias: ${pillarSubjectDefs(p).map((s) => s.name).join(', ')}.` : 'Sem matéria vinculada (vira bloco ou tarefa).'}
                  </p>
                </div>
              </Card>
            ))}
            <Button
              icon={<Plus className="size-4" />}
              onClick={() =>
                setPillars((ps) => [
                  ...ps,
                  { id: `pilar_${ps.length + 1}_${Date.now().toString(36)}`, name: `Novo pilar ${ps.length + 1}`, description: '', weight: 3, frequency: 'days_per_week', daysPerWeek: 2, blockMinutes: 50, activityType: 'theory', subjectIds: [], trailId: null, subjectKeys: [] },
                ])
              }
            >
              Adicionar pilar
            </Button>

            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink">Marcos (ex.: provas de certificação)</h3>
              <p className="mb-3 text-xs text-muted">Sem data, o marco não entra no calendário. Marcos a menos de 30 dias dão prioridade ao pilar ligado.</p>
              <div className="space-y-2">
                {milestones.map((m, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
                    <Field label={`Marco ${idx + 1}`}>
                      {(id) => <Input id={id} value={m.title} maxLength={200} onChange={(e) => setMilestones((ms) => ms.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} />}
                    </Field>
                    <Field label="Data">
                      {(id) => <Input id={id} type="date" value={m.date ?? ''} onChange={(e) => setMilestones((ms) => ms.map((x, i) => (i === idx ? { ...x, date: e.target.value || null } : x)))} />}
                    </Field>
                    <IconButton label={`Remover o marco ${m.title}`} onClick={() => setMilestones((ms) => ms.filter((_, i) => i !== idx))}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                icon={<Plus className="size-3.5" />}
                onClick={() => setMilestones((ms) => [...ms, { title: 'Novo marco', pillarId: pillars.find((p) => p.id === 'certificacoes')?.id ?? null, date: null }])}
              >
                Adicionar marco
              </Button>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">Horários livres por dia</h3>
              <div className="space-y-2">
                {WEEK_ORDER.map((d) => (
                  <div key={d} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 sm:grid-cols-[9rem_10rem_10rem]">
                    <Checkbox label={WEEKDAY_LABELS[d]} checked={days[d].on} onChange={(e) => setDays((s) => ({ ...s, [d]: { ...s[d], on: e.target.checked } }))} />
                    <Input type="time" aria-label={`${WEEKDAY_LABELS[d]}: início`} disabled={!days[d].on} value={days[d].start} onChange={(e) => setDays((s) => ({ ...s, [d]: { ...s[d], start: e.target.value } }))} />
                    <Input type="time" aria-label={`${WEEKDAY_LABELS[d]}: fim`} disabled={!days[d].on} value={days[d].end} onChange={(e) => setDays((s) => ({ ...s, [d]: { ...s[d], end: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Limite por dia (min)" hint="Vazio = sem limite.">
                {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />}
              </Field>
              <Field label="Limite por semana (min)" hint="Vazio = sem limite.">
                {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={weeklyLimit} onChange={(e) => setWeeklyLimit(e.target.value)} />}
              </Field>
              <Field label="Pausa entre blocos (min)">{(id) => <Input id={id} inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />}</Field>
              <Field label="Início">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
              <Field label="Semanas planejadas">{(id) => <Input id={id} type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(e.target.value)} />}</Field>
            </div>
          </div>
        )}

        {step === 3 && <PreviewStep draft={draft} />}
      </section>

      {problems.length > 0 && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {problems[0]}
        </p>
      )}

      {done && (
        <Card className="mt-5 p-4" role="status">
          <h3 className="mb-2 text-sm font-semibold text-ink">Rotina aplicada</h3>
          <ul className="space-y-1 text-sm text-ink">
            <li>✓ Matérias: {done.subjectsCreated} criada(s), {done.subjectsReused} reaproveitada(s); {done.topicsCreated} tópico(s) novo(s).</li>
            <li>
              ✓ Ciclo {done.cycleCreated ? 'criado' : 'mantido'}: {done.cycleItems.added} item(ns) novo(s), {done.cycleItems.updated} ajustado(s), {done.cycleItems.removed} removido(s).
            </li>
            <li>
              ✓ Cronograma {done.planCreated ? 'criado' : 'atualizado'}: {done.planItems.added} bloco(s) novo(s), {done.planItems.kept} mantido(s), {done.planItems.removed} pendente(s) removido(s).
            </li>
            <li>
              ✓ Calendário: {done.tasks.added} tarefa(s) nova(s), {done.tasks.kept} mantida(s), {done.tasks.updated} atualizada(s),{done.tasks.removed} removida(s).
            </li>
            {done.goalCreated && <li>✓ Meta semanal de horas criada.</li>}
          </ul>
          <p className="mt-2 text-xs text-muted">Sessões de estudo e blocos já realizados não foram alterados.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate('/ciclos')}>Ver ciclo</Button>
            <Button size="sm" onClick={() => navigate('/cronograma')}>Ver cronograma</Button>
            <Button size="sm" onClick={() => navigate('/calendario')}>Ver calendário</Button>
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button icon={<ArrowLeft className="size-4" />} onClick={() => go(step - 1)} disabled={step === 0}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => go(step + 1)}>
            Próximo: {STEPS[step + 1]} <ArrowRight className="size-4" />
          </Button>
        ) : editing ? (
          <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={openDiff} loading={diff === 'loading'} disabled={problems.length > 0}>
            Regerar rotina
          </Button>
        ) : (
          <Button variant="primary" icon={<ListChecks className="size-4" />} onClick={run} loading={apply.isPending} disabled={problems.length > 0}>
            {apply.isPending ? progress || 'Aplicando…' : 'Aplicar rotina'}
          </Button>
        )}
      </div>

      <Modal
        open={diff !== null}
        onClose={() => !apply.isPending && setDiff(null)}
        size="lg"
        title="Prévia das diferenças"
        description="Nada foi gravado ainda. Confirme para alterar só o que está listado; sessões de estudo e blocos já realizados ficam como estão."
        footer={
          <>
            <Button onClick={() => setDiff(null)} disabled={apply.isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={run} loading={apply.isPending} disabled={diff === null || diff === 'loading' || diff.unchanged}>
              {apply.isPending ? progress || 'Aplicando…' : 'Confirmar e regerar'}
            </Button>
          </>
        }
      >
        {diff === 'loading' || diff === null ? <Spinner /> : <DiffView diff={diff} />}
      </Modal>
    </div>
  )
}

function DiffView({ diff }: { diff: RoutineDiff }) {
  if (diff.unchanged) return <p className="text-sm text-muted">Nenhuma diferença: a rotina aplicada já corresponde a esta configuração.</p>
  const groups: Array<[string, string[], string]> = [
    ['Entra', diff.entering, 'text-success'],
    ['Sai', diff.leaving, 'text-danger'],
    ['Muda', diff.changing, 'text-ink'],
  ]
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Cronograma: {diff.plan.added} bloco(s) novo(s), {diff.plan.removed} pendente(s) removido(s), {diff.plan.kept} mantido(s). Ciclo: {diff.cycle.added} novo(s), {diff.cycle.updated} ajustado(s),{' '}
        {diff.cycle.removed} removido(s). Calendário: {diff.tasks.added} nova(s), {diff.tasks.updated} atualizada(s), {diff.tasks.removed} removida(s).
      </p>
      {diff.configChanged && diff.entering.length === 0 && diff.leaving.length === 0 && diff.changing.every((l) => !/^(Ciclo|Cronograma|Calendário|Meta|Período)/.test(l)) && (
        <p className="text-sm text-muted">Os itens gerados continuam os mesmos; confirmar só salva a configuração editada.</p>
      )}
      {groups.map(([title, lines, color]) => (
        <section key={title} aria-label={title}>
          <h3 className={cn('mb-1 text-sm font-semibold', color)}>
            {title} ({lines.length})
          </h3>
          {lines.length === 0 ? (
            <p className="text-xs text-muted">Nada.</p>
          ) : (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

function PreviewStep({ draft }: { draft: RoutineDraft }) {
  const preview = useMemo(() => previewRoutine(draft), [draft])
  const { output } = preview
  const pillarName = useMemo(() => new Map(draft.pillars.map((p) => [p.id, p.name])), [draft.pillars])
  const subjectName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of draft.pillars) for (const d of pillarSubjectDefs(p)) m.set(previewSubjectId(d), d.name)
    return (id: string | null) => (id ? (m.get(id) ?? '') : '')
  }, [draft.pillars])
  const weekEnd = addDays(draft.startDate, 6)
  const week = preview.planBlocks.filter((b) => b.date <= weekEnd)
  const weekTasks = preview.tasks.filter((t) => t.kind === 'task' && t.date <= weekEnd)
  const exams = preview.tasks.filter((t) => t.kind === 'exam')

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <Info className="size-4 text-accent-strong" /> Regras usadas
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          {preview.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">Ciclo de estudos</h3>
          {output.cycleItems.length === 0 ? (
            <p className="text-sm text-muted">Nenhum pilar de "alguns dias por semana" coube na disponibilidade.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {output.cycleItems.map((c) => (
                <li key={c.pillarId} className="rounded-lg bg-surface p-2">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {pillarName.get(c.pillarId)} <Badge>{c.duration_minutes} min</Badge>
                    {c.subjectId && <span className="text-xs font-normal text-muted">{subjectName(c.subjectId)}</span>}
                  </p>
                  <p className="text-xs text-muted">Motivo: {c.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">Tarefas e marcos</h3>
          {weekTasks.length === 0 && exams.length === 0 && <p className="text-sm text-muted">Nenhuma tarefa semanal ou marco com data.</p>}
          <ul className="space-y-2 text-sm">
            {output.recurringTasks.map((t) => (
              <li key={t.pillarId} className="rounded-lg bg-surface p-2">
                <p className="font-medium text-ink">
                  {t.title} · toda {WEEKDAY_LABELS[t.weekday].toLowerCase()} às {t.start_time} ({t.duration_minutes} min)
                </p>
                <p className="text-xs text-muted">Motivo: {t.reason}</p>
              </li>
            ))}
            {output.milestones.map((m) => (
              <li key={m.title + m.date} className="rounded-lg bg-surface p-2">
                <p className="font-medium text-ink">
                  {m.title} · {formatDayKey(m.date)}
                </p>
                <p className="text-xs text-muted">Motivo: {m.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-ink">Semana-tipo do cronograma</h3>
        <p className="mb-3 text-xs text-muted">
          Primeira semana ({formatDayKey(draft.startDate)} a {formatDayKey(weekEnd)}). Total semanal previsto: {Math.round((preview.weeklyMinutes / 60) * 10) / 10} h.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => addDays(draft.startDate, i)).map((date) => {
            const blocks = week.filter((b) => b.date === date)
            const tasks = weekTasks.filter((t) => t.date === date)
            return (
              <div key={date} className="rounded-lg border border-line p-2">
                <p className="mb-1 text-xs font-semibold text-ink">
                  {WEEKDAY_SHORT[weekday(date)]} · {formatDayKey(date)}
                </p>
                {blocks.length === 0 && tasks.length === 0 && <p className="text-xs text-muted">Livre</p>}
                <ul className="space-y-1.5">
                  {blocks.map((b, i) => (
                    <li key={`b${i}`} className="text-xs">
                      <span className="font-medium text-ink">
                        {b.start_time} · {b.pillarId ? pillarName.get(b.pillarId) : ''} ({b.duration_minutes} min)
                      </span>
                      {b.subject_id && <span className="block text-muted">{subjectName(b.subject_id)}</span>}
                      <span className="block text-muted">Motivo: {b.reason}</span>
                    </li>
                  ))}
                  {tasks.map((t) => (
                    <li key={`t${t.title}`} className="text-xs">
                      <span className="font-medium text-ink">
                        {t.start_time} · {t.title} (tarefa, {t.duration_minutes} min)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </Card>
      <p className="text-xs text-muted">Nada foi gravado ainda. Ao aplicar, matérias e tópicos que você já tem são reaproveitados e sessões de estudo nunca são alteradas.</p>
    </div>
  )
}
