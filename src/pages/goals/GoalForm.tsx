import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables } from '@/hooks/data'
import { useSubjects } from '@/hooks/domain'
import { eq } from '@/lib/data/types'
import { checklistPatch, isDeliverable, parseChecklist } from '@/lib/goals'
import { GOAL_METRIC_LABELS, GOAL_PERIOD_LABELS } from '@/lib/labels'
import { addDays, formatDayKey, startOfWeek } from '@/lib/time'
import type { GoalKind, GoalMetric, GoalPeriod, StudyGoal } from '@/types/db'

/** Alvos sugeridos: a meta já nasce com um número razoável e basta salvar. */
const DEFAULT_TARGETS: Record<GoalMetric, Record<GoalPeriod, number>> = {
  study_hours: { daily: 2, weekly: 10, monthly: 40 },
  sessions: { daily: 1, weekly: 5, monthly: 20 },
  questions: { daily: 10, weekly: 50, monthly: 200 },
  accuracy: { daily: 80, weekly: 80, monthly: 80 },
  topics_completed: { daily: 1, weekly: 3, monthly: 10 },
  flashcards_reviewed: { daily: 20, weekly: 100, monthly: 400 },
  study_days: { daily: 1, weekly: 5, monthly: 20 },
  projects_completed: { daily: 1, weekly: 1, monthly: 1 },
}

const METRIC_HINTS: Partial<Record<GoalMetric, string>> = {
  study_days: 'Frequência: em quantos dias do período houve estudo.',
  questions: 'Exercícios e questões registrados em "Questões".',
  accuracy: 'Acertos ÷ total das questões registradas no período.',
  projects_completed: 'Projetos práticos marcados como concluídos.',
  flashcards_reviewed: 'Conta as respostas de todos os baralhos.',
}

/** Indicadores que não se dividem por matéria. */
const NO_SUBJECT_METRICS: GoalMetric[] = ['flashcards_reviewed', 'projects_completed']

export function GoalForm({ open, goal, initialKind = 'deliverable', onClose, today }: { open: boolean; goal: StudyGoal | null; initialKind?: GoalKind; onClose: () => void; today: string }) {
  const [kind, setKind] = useState<GoalKind>(initialKind)
  // Por entregas
  const [title, setTitle] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [dueDate, setDueDate] = useState('')
  // Por número
  const [metric, setMetric] = useState<GoalMetric>('study_hours')
  const [period, setPeriod] = useState<GoalPeriod>('weekly')
  const [target, setTarget] = useState('10')
  const [targetTouched, setTargetTouched] = useState(false)
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const subjects = useSubjects()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const sunday = addDays(startOfWeek(today), 6)

  useEffect(() => {
    if (!open) return
    setKind(goal ? (isDeliverable(goal) ? 'deliverable' : 'metric') : initialKind)
    setTitle(goal?.title ?? '')
    setItemsText((goal?.checklist ?? []).map((i) => i.text).join('\n'))
    // Padrão: até o domingo desta semana (o exemplo clássico "… até domingo").
    setDueDate(goal ? (goal.due_date ?? '') : sunday)
    setMetric(goal && !isDeliverable(goal) ? goal.metric : 'study_hours')
    setPeriod(goal && !isDeliverable(goal) ? goal.period : 'weekly')
    setTarget(goal && !isDeliverable(goal) ? String(goal.target) : '10')
    setTargetTouched(Boolean(goal))
    setSubjectId(goal?.subject_id ?? '')
    setError(null)
  }, [open, goal, initialKind, sunday])

  const pickMetric = (m: GoalMetric, p: GoalPeriod) => {
    setMetric(m)
    setPeriod(p)
    if (!targetTouched) setTarget(String(DEFAULT_TARGETS[m][p]))
  }

  const saveDeliverable = async () => {
    const name = title.trim().slice(0, 160)
    // Sem lista, o próprio título é a entrega: criar uma meta pede só um campo.
    const items = parseChecklist(itemsText.trim() ? itemsText : name, goal?.checklist ?? [])
    const patch = { title: name, due_date: dueDate || null, ...checklistPatch(items, goal?.done_at ?? null) }
    if (goal) await backend.update('study_goals', [eq('id', goal.id)], patch)
    // O banco exige indicador, período e alvo em toda meta; nas metas por entregas eles não são usados.
    else await backend.insert('study_goals', [{ ...patch, kind: 'deliverable', metric: 'topics_completed', period: 'weekly', subject_id: null, start_date: today, status: 'active' }])
  }

  const saveMetric = async () => {
    const t = Number(target.replace(',', '.'))
    const data = { metric, period, target: t, subject_id: NO_SUBJECT_METRICS.includes(metric) ? null : subjectId || null, title: title.trim().slice(0, 160) || null }
    if (!goal) {
      await backend.insert('study_goals', [{ ...data, kind: 'metric', start_date: today, status: 'active' }])
    } else if (goal.start_date >= today || (Number(goal.target) === t && goal.metric === metric && goal.period === period && (goal.subject_id ?? '') === (data.subject_id ?? ''))) {
      // Meta criada hoje (sem histórico) ou só o nome mudou: altera no lugar.
      await backend.update('study_goals', [eq('id', goal.id)], data)
    } else {
      // Ajuste preserva o histórico: a versão anterior é encerrada ontem.
      await backend.update('study_goals', [eq('id', goal.id)], { status: 'superseded', end_date: addDays(today, -1) })
      await backend.insert('study_goals', [{ ...data, kind: 'metric', start_date: today, status: goal.status === 'paused' ? 'paused' : 'active', previous_goal_id: goal.id }])
    }
  }

  const validate = (): string | null => {
    if (kind === 'deliverable') return title.trim() ? null : 'Dê um título para a meta.'
    const t = Number(target.replace(',', '.'))
    if (!(t > 0) || t > 100000) return 'Informe um alvo maior que zero.'
    if (metric === 'accuracy' && t > 100) return 'A taxa de acertos vai até 100%.'
    if (metric === 'study_hours' && period === 'daily' && t > 24) return 'Uma meta diária não pode passar de 24 horas.'
    return null
  }

  const save = async () => {
    const problem = validate()
    setError(problem)
    if (problem) return
    setBusy(true)
    try {
      await (kind === 'deliverable' ? saveDeliverable() : saveMetric())
      toast.success('Meta salva.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_goals'])
    }
  }

  const unit = metric === 'study_hours' ? 'horas' : metric === 'accuracy' ? '%' : metric === 'study_days' ? 'dias' : 'quantidade'
  const noSubject = NO_SUBJECT_METRICS.includes(metric)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nova meta'}
      description={goal && kind === 'metric' ? 'Se a meta já tem histórico, a versão atual é encerrada e uma nova começa hoje — os períodos anteriores continuam com o alvo antigo.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {!goal && (
          <div className="sm:col-span-2">
            <Segmented
              label="Tipo de meta"
              value={kind}
              onChange={(k) => {
                setKind(k)
                setError(null)
              }}
              options={[
                { value: 'deliverable', label: 'Por entregas' },
                { value: 'metric', label: 'Por número' },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">
              {kind === 'deliverable' ? 'Uma lista do que precisa estar pronto até uma data. Não depende do tempo registrado.' : 'Um número por dia, semana ou mês, calculado dos seus registros.'}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
        {kind === 'deliverable' ? (
          <>
            <Field label="Título" required className="sm:col-span-2">
              {(id) => <Input id={id} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Concluir JOIN e resolver 20 exercícios" />}
            </Field>
            <Field label="Entregas" hint="Uma por linha. Em branco, o título vira a única entrega." className="sm:col-span-2">
              {(id, d) => <Textarea id={id} aria-describedby={d} rows={4} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={'Terminar a aula de JOIN\nResolver 20 exercícios\nPublicar o notebook'} />}
            </Field>
            <Field label="Prazo (opcional)" hint={dueDate ? formatDayKey(dueDate, 'weekday') : 'Sem prazo'}>
              {(id, d) => <Input id={id} aria-describedby={d} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
            </Field>
            <div className="flex flex-wrap items-end gap-2 pb-6">
              <Button size="sm" onClick={() => setDueDate(sunday)}>
                Este domingo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDueDate('')}>
                Sem prazo
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Indicador" hint={METRIC_HINTS[metric]}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={metric} onChange={(e) => pickMetric(e.target.value as GoalMetric, period)}>
                  {Object.entries(GOAL_METRIC_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Período">
              {(id) => (
                <Select id={id} value={period} onChange={(e) => pickMetric(metric, e.target.value as GoalPeriod)}>
                  {Object.entries(GOAL_PERIOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={`Alvo (${unit})`}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setTargetTouched(true)
                  }}
                />
              )}
            </Field>
            <Field label="Matéria" hint={noSubject ? 'Este indicador não se divide por matéria.' : undefined}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={noSubject ? '' : subjectId} disabled={noSubject} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Todas</option>
                  {(subjects.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Nome (opcional)" className="sm:col-span-2">
              {(id) => <Input id={id} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ritmo da semana" />}
            </Field>
          </>
        )}
        {/* Enter em um campo de texto salva (o botão do rodapé fica fora do <form>). */}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
