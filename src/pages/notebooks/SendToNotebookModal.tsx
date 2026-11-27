import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAllActiveNotebookNodes, useNotebookStudyMutations, useNotebooks } from '@/hooks/useNotebooks'
import type { NotebookResourceKind } from '@/types/db'

interface SendToNotebookModalProps {
  open: boolean
  onClose: () => void
  defaultExcerpt: string
  referenceLabel: string
  resourceKind: NotebookResourceKind
  resourceId?: string | null
  url?: string | null
  location?: Record<string, unknown> | null
}

/**
 * Envia um trecho selecionado (ex.: leitor de PDF) para uma página de um caderno existente do usuário,
 * sem criar cadernos automaticamente nem duplicar arquivos.
 */
export function SendToNotebookModal({
  open,
  onClose,
  defaultExcerpt,
  referenceLabel,
  resourceKind,
  resourceId,
  url,
  location,
}: SendToNotebookModalProps) {
  const notebooksQuery = useNotebooks()
  const nodesQuery = useAllActiveNotebookNodes()
  const mut = useNotebookStudyMutations()
  const toast = useToast()

  const activeNotebooks = useMemo(
    () => (notebooksQuery.data ?? []).filter((n) => !n.deleted_at && !n.archived_at),
    [notebooksQuery.data],
  )
  const [notebookId, setNotebookId] = useState('')
  const [pageId, setPageId] = useState('')
  const [excerpt, setExcerpt] = useState('')

  const pagesInNotebook = useMemo(
    () => (nodesQuery.data ?? []).filter((n) => n.notebook_id === notebookId && n.node_type === 'page' && !n.deleted_at),
    [nodesQuery.data, notebookId],
  )

  useEffect(() => {
    if (!open) return
    setExcerpt(defaultExcerpt)
    if (!notebookId && activeNotebooks.length > 0) setNotebookId(activeNotebooks[0].id)
  }, [open, defaultExcerpt, activeNotebooks, notebookId])

  useEffect(() => {
    if (!open) return
    if (!pagesInNotebook.some((p) => p.id === pageId)) {
      setPageId(pagesInNotebook[0]?.id ?? '')
    }
  }, [open, pagesInNotebook, pageId])

  const submit = async () => {
    if (!pageId || !excerpt.trim()) return
    try {
      await mut.appendExcerpt.mutateAsync({
        nodeId: pageId,
        excerpt: excerpt.trim(),
        referenceLabel,
        resourceKind,
        resourceId: resourceId ?? null,
        url: url ?? null,
        location: location ?? null,
      })
      toast.success('Trecho enviado para a página do caderno com referência registrada.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Enviar trecho para caderno"
      description={`Referência: ${referenceLabel}${typeof location?.page === 'number' ? ` · p. ${location.page}` : ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={<BookText className="size-4" />}
            loading={mut.appendExcerpt.isPending}
            disabled={!pageId || !excerpt.trim()}
            onClick={() => void submit()}
          >
            Enviar ao caderno
          </Button>
        </>
      }
    >
      {activeNotebooks.length === 0 ? (
        <div className="space-y-3 py-4 text-sm text-muted">
          <p>Você ainda não criou nenhum caderno. Crie um caderno manualmente em Meus Cadernos para enviar trechos para lá.</p>
          <Link to="/cadernos" className="inline-flex text-sm font-medium text-accent underline">
            Ir para Meus Cadernos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Caderno">
              {(id) => (
                <Select id={id} value={notebookId} onChange={(e) => setNotebookId(e.target.value)}>
                  {activeNotebooks.map((nb) => (
                    <option key={nb.id} value={nb.id}>
                      {nb.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Página de destino">
              {(id) => (
                <Select id={id} value={pageId} onChange={(e) => setPageId(e.target.value)} disabled={pagesInNotebook.length === 0}>
                  {pagesInNotebook.length === 0 ? (
                    <option value="">Nenhuma página neste caderno</option>
                  ) : (
                    pagesInNotebook.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))
                  )}
                </Select>
              )}
            </Field>
          </div>
          <Field label="Trecho / anotação" required hint="Você pode revisar ou complementar o trecho selecionado antes de salvar.">
            {(id, d) => (
              <Textarea
                id={id}
                aria-describedby={d}
                rows={5}
                value={excerpt}
                placeholder="Cole ou digite o trecho que deseja enviar para sua anotação…"
                onChange={(e) => setExcerpt(e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
    </Modal>
  )
}
