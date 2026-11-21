// Criar/editar tarefa. Só título e data são necessários; o restante fica recolhido em "Mais opções".
import { useEffect, useState } from 'react'
import { ChevronDown, Play, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { invalidateTables } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { WEEKDAY_SHORT } from '@/lib/labels'
import { PRIORITY_TASK_LABELS, allCategories, categoryOf, describeRecurrence, slugCategory } from '@/lib/tasks'
import { weekday } from '@/lib/time'
import { cn } from '@/lib/cn'
import { createTask, deleteTask, type SeriesScope, type TaskInput } from '@/services/tasks'
import type { CalendarTask, TaskRecurrence } from '@/types/db'

export interface TaskDraft {
  task: CalendarTask | null
  date: string
  time?: string
  title?: string
  category?: string
  /** Preenche matéria/tópico (ex.: ao agendar um tópico da trilha). */
  link?: { subjectId: string | null; topicId: string | null }
  duration?: number
  originKey?: string
  /** Chamado depois de salvar (ex.: marcar item da caixa de entrada como organizado). */
  onSaved?: (task: CalendarTask) => void | Promise<void>
}

const LAST_CATEGORY = 'evl:last-task-category'

function lastCategory(): string {
  try {
    return localStorage.getItem(LAST_CATEGORY) ?? 'pessoal'
  } catch {
    return 'pessoal'
  }
}

export function TaskDialog({ draft, onClose, onStart }: { draft: TaskDraft | null; onClose: () => void; onStart?: (task: CalendarTask) => void }) {
  const open = Boolean(draft)
  const task = draft?.task ?? null
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const categories = allCategories(settings)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [category, setCategory] = useState('pessoal')
  const [priority, setPriority] = useState(2)
  const [fixed, setFixed] = useState(false)
  const [due, setDue] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [until, setUntil] = useState('')
  const [more, setMore] = useState(false)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!draft) return
    const t = draft.task
    setTitle(t?.title ?? draft.title ?? '')
    setDate(t?.date ?? draft.date)
    setTime(t?.start_time ?? draft.time ?? '')
    setDuration(t?.duration_minutes ? String(t.duration_minutes) : draft.duration ? String(draft.duration) : '')
    setCategory(t ? categoryOf(t) : (draft.category ?? (draft.link?.subjectId ? 'estudos' : lastCategory())))
    setPriority(t?.priority ?? 2)
    setFixed(Boolean(t?.fixed))
    setDue(t?.due_date ?? '')
    setDescription(t?.description ?? '')
    setLink({ subjectId: t?.subject_id ?? draft.link?.subjectId ?? null, topicId: t?.topic_id ?? draft.link?.topicId ?? null })
    setRepeat('none')
    setRepeatDays([weekday(t?.date ?? draft.date)])
    setUntil('')
    setMore(Boolean(t && (t.description || t.due_date || t.subject_id || t.fixed || (t.priority ?? 2) !== 2)))
    setNewCategory(null)
    setError(null)
  }, [draft])

  const save = async () => {
    if (!title.trim()) return setError('Informe o título.')
    if (!date) return setError('Informe a data.')
    const dur = duration ? Number(duration) : null
    if (dur != null && (!Number.isInteger(dur) || dur < 1 || dur > 1440)) return setError('Duração entre 1 e 1440 minutos.')
    let cat = category
    setBusy(true)
    try {
      if (newCategory != null && newCategory.trim()) {
        const id = slugCategory(newCategory)
        if (id && !categories.some((c) => c.id === id)) await updateSettings.mutateAsync({ taskCategories: [...(settings.taskCategories ?? []), { id, label: newCategory.trim().slice(0, 30) }] })
        if (id) cat = id
      }
      const data: TaskInput = {
        title: title.trim().slice(0, 300),
        date,
        start_time: time || null,
        duration_minutes: dur,
        category: cat,
        priority,
        fixed,
        due_date: due || null,
        description: description.trim() || null,
        subject_id: link.subjectId,
        topic_id: link.topicId,
      }
      let saved: CalendarTask | undefined
      if (task) {
        ;[saved] = await backend.update('calendar_tasks', [eq('id', task.id)], data)
      } else {
        const rule: TaskRecurrence | null = repeat === 'none' ? null : { freq: repeat, ...(repeat === 'weekly' ? { days: repeatDays.length ? repeatDays : [weekday(date)] } : {}), until: until || null }
        const rows = await createTask(backend, { ...data, ...(draft?.originKey ? { origin_key: draft.originKey } : {}) }, rule)
        saved = rows[0]
        if (rows.length > 1) toast.success(`${rows.length} ocorrências criadas.`)
      }
      try {
        localStorage.setItem(LAST_CATEGORY, cat)
      } catch {
        /* preferência apenas deste dispositivo */
      }
      if (saved && draft?.onSaved) await draft.onSaved(saved)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['calendar_tasks', 'inbox_items'])
    }
  }

  const remove = async () => {
    if (!task) return
    let scope: SeriesScope = 'one'
    if (task.series_id) {
      const all = await confirm({ title: 'Excluir tarefa recorrente', message: 'Excluir só esta ocorrência ou esta e as próximas? Ocorrências já concluídas continuam no histórico.', confirmLabel: 'Esta e as próximas', cancelLabel: 'Só esta', danger: true })
      scope = all ? 'following' : 'one'
    }
    setBusy(true)
    try {
      await deleteTask(backend, task, scope)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['calendar_tasks', 'study_sessions', 'inbox_items'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      footer={
        <>
          {task && (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove} disabled={busy} className="mr-auto">
              Excluir
            </Button>
          )}
          {task && !task.done && onStart && categoryOf(task) === 'estudos' && (
            <Button variant="dark" icon={<Play className="size-4" />} onClick={() => (onClose(), onStart(task))}>
              Iniciar estudo
            </Button>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Título" required error={error}>
          {(id, dsc) => <Input id={id} aria-describedby={dsc} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" />}
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Data" required className="col-span-2 sm:col-span-1">
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Duração (min)">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} placeholder="—" />}</Field>
          <Field label="Categoria" className="col-span-2 sm:col-span-1">
            {(id) =>
              newCategory != null ? (
                <Input id={id} autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nome da categoria" onBlur={() => !newCategory.trim() && setNewCategory(null)} />
              ) : (
                <Select id={id} value={category} onChange={(e) => (e.target.value === '__new' ? setNewCategory('') : setCategory(e.target.value))}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  {!categories.some((c) => c.id === category) && <option value={category}>{category}</option>}
                  <option value="__new">Nova categoria…</option>
                </Select>
              )
            }
          </Field>
        </div>

        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1 self-start text-xs font-medium text-muted hover:text-ink">
          <ChevronDown className={cn('size-3.5 transition-transform', more && 'rotate-180')} aria-hidden />
          Mais opções
        </button>

        {more && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridade">
                {(id) => (
                  <Select id={id} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                    {[3, 2, 1].map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_TASK_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Prazo final">{(id) => <Input id={id} type="date" value={due} min={date} onChange={(e) => setDue(e.target.value)} />}</Field>
            </div>
            <Checkbox label="Compromisso fixo (não mover ao reorganizar a semana)" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
            {!task ? (
              <div className="grid gap-3">
                <Field label="Repetir">
                  {(id) => (
                    <Select id={id} value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
                      <option value="none">Não repete</option>
                      <option value="daily">Todos os dias</option>
                      <option value="weekly">Toda semana</option>
                    </Select>
                  )}
                </Field>
                {repeat === 'weekly' && (
                  <div role="group" aria-label="Dias da semana" className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = repeatDays.includes(d)
                      return (
                        <button key={d} type="button" aria-pressed={on} onClick={() => setRepeatDays(on ? repeatDays.filter((x) => x !== d) : [...repeatDays, d])} className={cn('h-8 rounded-lg border px-2.5 text-xs font-medium', on ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:text-ink')}>
                          {WEEKDAY_SHORT[d]}
                        </button>
                      )
                    })}
                  </div>
                )}
                {repeat !== 'none' && <Field label="Repetir até (opcional)" hint="Sem data final, as ocorrências são criadas para as próximas 8 semanas e renovadas automaticamente.">{(id) => <Input id={id} type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />}</Field>}
              </div>
            ) : (
              task.series_id && <p className="text-xs text-muted">Tarefa recorrente · {describeRecurrence(task.recurrence)}. As alterações valem só para esta ocorrência.</p>
            )}
            <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={(v) => (setLink(v), v.subjectId && setCategory('estudos'))} subjectLabel="Matéria (opcional)" />
            <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
