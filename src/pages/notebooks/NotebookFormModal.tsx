import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ColorInput, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useSubjects } from '@/hooks/domain'
import { useNotebookMutations } from '@/hooks/useNotebooks'
import { coverStyle, NOTEBOOK_COLORS, NOTEBOOK_COVERS, NOTEBOOK_ICONS } from '@/lib/notebooks'
import { notebookSchema, validate } from '@/lib/validation'
import { cn } from '@/lib/cn'
import type { Notebook } from '@/types/db'
import { NotebookIcon } from './NotebookIcon'

interface NotebookFormModalProps {
  open: boolean
  onClose: () => void
  notebook?: Notebook | null
  onSaved?: (notebook: Notebook) => void
}

export function NotebookFormModal({ open, onClose, notebook, onSaved }: NotebookFormModalProps) {
  const subjects = useSubjects({ includeArchived: false })
  const mutations = useNotebookMutations()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('book-open')
  const [color, setColor] = useState('#171717')
  const [cover, setCover] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setTitle(notebook?.title ?? '')
    setDescription(notebook?.description ?? '')
    setIcon(notebook?.icon ?? 'book-open')
    setColor(notebook?.color ?? '#171717')
    setCover(notebook?.cover ?? '')
    setSubjectId(notebook?.subject_id ?? '')
    setErrors({})
  }, [open, notebook])

  const busy = mutations.create.isPending || mutations.update.isPending

  const submit = async () => {
    const parsed = validate(notebookSchema, {
      title,
      description,
      icon,
      color,
      cover,
      subject_id: subjectId || null,
    })
    if (parsed.errors) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    try {
      if (notebook) {
        const updated = await mutations.update.mutateAsync({ id: notebook.id, patch: parsed.data })
        toast.success('Caderno atualizado.')
        if (updated) onSaved?.(updated)
      } else {
        const created = await mutations.create.mutateAsync(parsed.data)
        toast.success('Caderno criado.')
        onSaved?.(created)
      }
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={notebook ? 'Editar caderno' : 'Novo caderno'}
      description="Crie cadernos independentes ou vincule opcionalmente a uma matéria existente."
      size="md"
      persistent
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {notebook ? 'Salvar alterações' : 'Criar caderno'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Pré-visualização da capa */}
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="h-16 w-full border-b border-line" style={coverStyle(cover || null, color)} />
          <div className="flex items-center gap-3 bg-surface px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: color }}>
              <NotebookIcon name={icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{title.trim() || 'Nome do caderno'}</p>
              <p className="truncate text-xs text-muted">{description.trim() || 'Sem descrição'}</p>
            </div>
          </div>
        </div>

        <Field label="Nome" required error={errors.title}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={Boolean(errors.title)}
              value={title}
              maxLength={200}
              placeholder="Ex.: SQL & Modelagem de Dados"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          )}
        </Field>

        <Field label="Descrição" error={errors.description}>
          {(id, d) => (
            <Textarea
              id={id}
              aria-describedby={d}
              invalid={Boolean(errors.description)}
              rows={2}
              value={description}
              maxLength={4000}
              placeholder="Objetivo do caderno, escopo ou referências principais…"
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matéria vinculada (opcional)" error={errors.subject_id}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Caderno independente</option>
                {(subjects.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Capa" error={errors.cover}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={cover} onChange={(e) => setCover(e.target.value)}>
                {NOTEBOOK_COVERS.map((c) => (
                  <option key={c.value || 'none'} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Ícone">
          {() => (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone do caderno">
              {NOTEBOOK_ICONS.map((item) => {
                const active = icon === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => setIcon(item.id)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg border transition-colors',
                      active ? 'border-accent bg-surface-2 text-ink' : 'border-line bg-bg text-muted hover:text-ink',
                    )}
                  >
                    <NotebookIcon name={item.id} className="size-4" />
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        <Field label="Cor" error={errors.color}>
          {() => <ColorInput value={color} onChange={setColor} colors={[...NOTEBOOK_COLORS]} />}
        </Field>
      </div>
    </Modal>
  )
}
