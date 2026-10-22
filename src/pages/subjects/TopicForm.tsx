import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useInsert, useUpdate } from '@/hooks/data'
import { MASTERY_TOPIC_LABELS, PRIORITY_LABELS, TOPIC_STATUS_LABELS } from '@/lib/labels'
import { topicSchema, validate } from '@/lib/validation'
import type { Topic } from '@/types/db'

interface Props {
  open: boolean
  onClose: () => void
  subjectId: string
  parent?: Topic | null
  topic?: Topic | null
  nextOrder?: number
  /** Ao criar: tópico comum ou pasta organizadora dentro da matéria. */
  kind?: Topic['kind']
}

function initial(t?: Topic | null) {
  return {
    name: t?.name ?? '',
    description: t?.description ?? '',
    status: t?.status ?? ('not_started' as Topic['status']),
    mastery: t?.mastery ?? 0,
    priority: t?.priority ?? 3,
    weight: String(t?.weight ?? 1),
    estimated_minutes: t?.estimated_minutes != null ? String(t.estimated_minutes) : '',
    notes: t?.notes ?? '',
  }
}

export function TopicForm({ open, onClose, subjectId, parent, topic, nextOrder = 0, kind = 'topic' }: Props) {
  const isFolder = (topic?.kind ?? kind) === 'folder'
  const [form, setForm] = useState(() => initial(topic))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [addAnother, setAddAnother] = useState(false)
  const insert = useInsert('topics')
  const update = useUpdate('topics')
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setForm(initial(topic))
      setErrors({})
    }
  }, [open, topic])

  const set = <K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (again = false) => {
    const r = validate(topicSchema, form)
    if (!r.data) return setErrors(r.errors)
    try {
      if (topic) await update.mutateAsync({ id: topic.id, patch: r.data })
      else await insert.mutateAsync({ ...r.data, kind, subject_id: subjectId, parent_id: parent?.id ?? null, sort_order: nextOrder })
      toast.success(isFolder ? (topic ? 'Pasta atualizada.' : 'Pasta criada.') : topic ? 'Tópico atualizado.' : 'Tópico criado.')
      if (again) {
        setForm(initial(null))
        setAddAnother(true)
      } else onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isFolder ? (topic ? 'Editar pasta' : parent ? `Nova pasta em "${parent.name}"` : 'Nova pasta na matéria') : topic ? 'Editar tópico' : parent ? `Novo subtópico de "${parent.name}"` : 'Novo tópico'}
      description={addAnother ? 'Salvo! Continue adicionando.' : undefined}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Fechar</Button>
          {!topic && (
            <Button onClick={() => submit(true)} loading={insert.isPending}>
              Salvar e adicionar outro
            </Button>
          )}
          <Button variant="primary" onClick={() => submit(false)} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
      >
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.name} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} />}
        </Field>
        {!isFolder && (
          <>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => set('status', e.target.value as Topic['status'])}>
              {Object.entries(TOPIC_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nível de domínio">
          {(id) => (
            <Select id={id} value={form.mastery} onChange={(e) => set('mastery', Number(e.target.value))}>
              {MASTERY_TOPIC_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {i} — {l}
                </option>
              ))}
            </Select>
          )}
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
        <Field label="Peso / relevância" hint="Usado no progresso ponderado da matéria." error={errors.weight}>
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} />}
        </Field>
        <Field label="Estimativa de tempo (min)" error={errors.estimated_minutes}>
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={form.estimated_minutes} onChange={(e) => set('estimated_minutes', e.target.value)} />}
        </Field>
          </>
        )}
        <Field label="Descrição" className="sm:col-span-2" error={errors.description}>
          {(id) => <Textarea id={id} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <Field label="Observações" className="sm:col-span-2" error={errors.notes}>
          {(id) => <Textarea id={id} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
