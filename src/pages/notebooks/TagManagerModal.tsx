import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { ColorInput, Field, Input } from '@/components/ui/Field'
import { Card, ColorDot } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useNotebookKnowledgeMutations, useNotebookTagLinks, useNotebookTags } from '@/hooks/useNotebooks'
import { NOTEBOOK_COLORS } from '@/lib/notebooks'
import { notebookTagSchema, validate } from '@/lib/validation'
import type { NotebookTag } from '@/types/db'

interface TagManagerModalProps {
  open: boolean
  onClose: () => void
}

export function TagManagerModal({ open, onClose }: TagManagerModalProps) {
  const tagsQuery = useNotebookTags()
  const tagLinksQuery = useNotebookTagLinks()
  const mut = useNotebookKnowledgeMutations()
  const toast = useToast()

  const [editing, setEditing] = useState<NotebookTag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#525252')
  const [error, setError] = useState<string | null>(null)

  const tags = tagsQuery.data ?? []
  const countByTag = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of tagLinksQuery.data ?? []) m.set(l.tag_id, (m.get(l.tag_id) ?? 0) + 1)
    return m
  }, [tagLinksQuery.data])

  const resetForm = () => {
    setEditing(null)
    setName('')
    setColor('#525252')
    setError(null)
  }

  const submit = async () => {
    const parsed = validate(notebookTagSchema, { name, color })
    if (parsed.errors) {
      setError(parsed.errors.name ?? parsed.errors.color ?? 'Dados inválidos.')
      return
    }
    setError(null)
    try {
      if (editing) {
        await mut.updateTag.mutateAsync({ id: editing.id, patch: parsed.data })
        toast.success('Tag atualizada.')
      } else {
        await mut.createTag.mutateAsync(parsed.data)
        toast.success('Tag criada.')
      }
      resetForm()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm()
        onClose()
      }}
      size="md"
      title="Tags de conhecimento"
      description="Organize cadernos e páginas por assunto, revisão ou prioridade. Cores seguem a paleta do VLM Control."
    >
      <div className="space-y-5">
        <Card className="space-y-3 bg-surface-2/40 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={editing ? 'Editar tag' : 'Nova tag'} error={error}>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  value={name}
                  maxLength={60}
                  placeholder="Ex.: SQL, PostgreSQL, Revisar, Concurso…"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                />
              )}
            </Field>
            <div className="flex gap-1.5">
              {editing && (
                <Button size="md" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                loading={mut.createTag.isPending || mut.updateTag.isPending}
                disabled={!name.trim()}
                onClick={() => void submit()}
              >
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
          <ColorInput value={color} onChange={setColor} colors={[...NOTEBOOK_COLORS]} />
        </Card>

        {tags.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
            <Tag className="size-6" aria-hidden />
            <p>Nenhuma tag criada ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <ColorDot color={t.color} />
                  <span className="truncate font-medium text-ink">#{t.name}</span>
                  <span className="tabular text-xs text-muted">{countByTag.get(t.id) ?? 0} item(ns)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/flashcards/revisar?tag=${encodeURIComponent(t.name)}&modo=todos`}
                    onClick={onClose}
                    title="Revisar flashcards com esta tag"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Layers className="size-3" aria-hidden />
                    Flashcards
                  </Link>
                  <IconButton
                    label={`Editar ${t.name}`}
                    size="sm"
                    className="size-7"
                    onClick={() => {
                      setEditing(t)
                      setName(t.name)
                      setColor(t.color)
                      setError(null)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Excluir ${t.name}`}
                    size="sm"
                    className="size-7"
                    onClick={() =>
                      mut.deleteTag.mutate(t.id, {
                        onSuccess: () => toast.success('Tag removida.'),
                        onError: toast.error,
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-danger" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
