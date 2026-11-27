import { useState } from 'react'
import { Copy, LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Badge, Card, Tabs } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useNotebookTemplateMutations, useNotebookTemplates } from '@/hooks/useNotebooks'
import { BUILTIN_TEMPLATES } from '@/lib/notebookTemplates'
import type { NotebookContentDoc } from '@/types/db'

interface TemplatePickerModalProps {
  open: boolean
  onClose: () => void
  currentDoc?: NotebookContentDoc | null
  currentTitle?: string
  onApply: (doc: NotebookContentDoc, templateName: string) => void
}

export function TemplatePickerModal({ open, onClose, currentDoc, currentTitle, onApply }: TemplatePickerModalProps) {
  const customQuery = useNotebookTemplates()
  const mut = useNotebookTemplateMutations()
  const toast = useToast()

  const [tab, setTab] = useState<'builtin' | 'custom' | 'save'>('builtin')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Personalizado')
  const [description, setDescription] = useState('')

  const customTemplates = customQuery.data ?? []

  const handleSaveCurrent = async () => {
    if (!currentDoc || !name.trim()) return
    try {
      await mut.create.mutateAsync({
        name: name.trim(),
        category: category.trim() || 'Personalizado',
        description: description.trim() || null,
        contentJson: structuredClone(currentDoc),
      })
      toast.success('Template personalizado salvo.')
      setName('')
      setDescription('')
      setTab('custom')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Templates de página"
      description="Modelos reutilizáveis estruturais — preenchem somente a organização inicial, sem inventar conteúdo."
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'builtin', label: `Modelos padrão (${BUILTIN_TEMPLATES.length})` },
          { value: 'custom', label: `Meus templates (${customTemplates.length})` },
          ...(currentDoc ? [{ value: 'save' as const, label: 'Salvar página atual' }] : []),
        ]}
      />

      {tab === 'builtin' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {BUILTIN_TEMPLATES.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col justify-between p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{tpl.name}</h3>
                  <Badge>{tpl.category}</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{tpl.description}</p>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  icon={<LayoutTemplate className="size-3.5" />}
                  onClick={() => {
                    onApply(tpl.build(), tpl.name)
                    onClose()
                  }}
                >
                  Aplicar modelo
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'custom' && (
        <div className="space-y-3">
          {customTemplates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Você ainda não salvou nenhum template personalizado. Use a aba "Salvar página atual" para criar seu primeiro modelo.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {customTemplates.map((tpl) => (
                <Card key={tpl.id} className="flex flex-col justify-between p-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink">{tpl.name}</h3>
                        {tpl.category && <Badge className="mt-1">{tpl.category}</Badge>}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <IconButton
                          label="Duplicar template"
                          size="sm"
                          onClick={() => mut.duplicate.mutate(tpl, { onSuccess: () => toast.success('Template duplicado.'), onError: toast.error })}
                        >
                          <Copy className="size-3.5" />
                        </IconButton>
                        <IconButton
                          label="Excluir template"
                          size="sm"
                          onClick={() => mut.remove.mutate(tpl.id, { onSuccess: () => toast.success('Template removido.'), onError: toast.error })}
                        >
                          <Trash2 className="size-3.5 text-danger" />
                        </IconButton>
                      </div>
                    </div>
                    {tpl.description && <p className="mt-2 text-xs text-muted">{tpl.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4 w-full"
                    onClick={() => {
                      onApply(structuredClone(tpl.content_json), tpl.name)
                      onClose()
                    }}
                  >
                    Aplicar modelo
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'save' && currentDoc && (
        <div className="space-y-4">
          <Field label="Nome do template" required>
            {(id) => (
              <Input
                id={id}
                value={name}
                maxLength={160}
                placeholder={currentTitle ? `Modelo — ${currentTitle}` : 'Ex.: Revisão de Modelagem Dimensional'}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Categoria">
            {(id) => <Input id={id} value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} />}
          </Field>
          <Field label="Descrição">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                maxLength={1000}
                value={description}
                placeholder="Quando usar este template…"
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" icon={<Plus className="size-4" />} loading={mut.create.isPending} disabled={!name.trim()} onClick={() => void handleSaveCurrent()}>
              Salvar como template
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
