import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ColorInput, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useInsert, useUpdate } from '@/hooks/data'
import { DIFFICULTY_LABELS, PRIORITY_LABELS, SUBJECT_COLORS, SUBJECT_STATUS_LABELS } from '@/lib/labels'
import { subjectSchema, validate } from '@/lib/validation'
import type { Subject } from '@/types/db'

type FormState = {
  name: string
  description: string
  color: string
  icon: string
  priority: number
  difficulty: number
  weekly_goal_hours: string
  start_date: string
  target_date: string
  notes: string
  status: Subject['status']
  exam: string
}

function initial(s?: Subject | null, slot = 0): FormState {
  return {
    name: s?.name ?? '',
    description: s?.description ?? '',
    color: s?.color ?? SUBJECT_COLORS[slot % SUBJECT_COLORS.length],
    icon: s?.icon ?? '',
    priority: s?.priority ?? 3,
    difficulty: s?.difficulty ?? 3,
    weekly_goal_hours: s?.weekly_goal_hours != null ? String(s.weekly_goal_hours) : '',
    start_date: s?.start_date ?? '',
    target_date: s?.target_date ?? '',
    notes: s?.notes ?? '',
    status: s?.status ?? 'active',
    exam: s?.exam ?? '',
  }
}

export function SubjectForm({ open, onClose, subject, nextOrder = 0 }: { open: boolean; onClose: () => void; subject?: Subject | null; nextOrder?: number }) {
  const [form, setForm] = useState<FormState>(() => initial(subject))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const insert = useInsert('subjects')
  const update = useUpdate('subjects')
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setForm(initial(subject, nextOrder))
      setErrors({})
    }
  }, [open, subject, nextOrder])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    const r = validate(subjectSchema, form)
    if (!r.data) return setErrors(r.errors)
    const data = { ...r.data, archived_at: r.data.status === 'archived' ? (subject?.archived_at ?? new Date().toISOString()) : null }
    try {
      if (subject) await update.mutateAsync({ id: subject.id, patch: data })
      else await insert.mutateAsync({ ...data, sort_order: nextOrder })
      toast.success(subject ? 'Matéria atualizada.' : 'Matéria criada.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Editar matéria' : 'Nova matéria'}
      size="lg"
      persistent
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.name} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Direito Administrativo" />}
        </Field>
        <Field label="Cor" className="sm:col-span-2">
          {() => <ColorInput value={form.color} onChange={(c) => set('color', c)} colors={SUBJECT_COLORS} />}
        </Field>
        <Field label="Prioridade">
          {(id) => (
            <Select id={id} value={form.priority} onChange={(e) => set('priority', Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {PRIORITY_LABELS[n]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Dificuldade">
          {(id) => (
            <Select id={id} value={form.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {DIFFICULTY_LABELS[n]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Meta semanal (horas)" error={errors.weekly_goal_hours}>
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={form.weekly_goal_hours} onChange={(e) => set('weekly_goal_hours', e.target.value)} placeholder="Ex.: 6" />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => set('status', e.target.value as Subject['status'])}>
              {Object.entries(SUBJECT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Data de início" error={errors.start_date}>
          {(id) => <Input id={id} type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />}
        </Field>
        <Field label="Conclusão prevista" error={errors.target_date}>
          {(id, d) => <Input id={id} aria-describedby={d} type="date" value={form.target_date} invalid={Boolean(errors.target_date)} onChange={(e) => set('target_date', e.target.value)} />}
        </Field>
        <Field label="Objetivo relacionado (concurso, curso, certificação…)" className="sm:col-span-2" error={errors.exam}>
          {(id) => <Input id={id} value={form.exam} onChange={(e) => set('exam', e.target.value)} placeholder="Ex.: TRF 3ª Região, Faculdade de Direito, AWS Solutions Architect" />}
        </Field>
        <Field label="Ícone (opcional)" hint="Um emoji ou sigla curta." error={errors.icon}>
          {(id, d) => <Input id={id} aria-describedby={d} maxLength={40} value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="⚖️" />}
        </Field>
        <Field label="Descrição" className="sm:col-span-2" error={errors.description}>
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />}
        </Field>
        <Field label="Observações" className="sm:col-span-2" error={errors.notes}>
          {(id) => <Textarea id={id} value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
