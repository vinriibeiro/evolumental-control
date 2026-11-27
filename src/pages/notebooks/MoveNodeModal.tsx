import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAllActiveNotebookNodes, useNotebookNodeMutations, useNotebooks } from '@/hooks/useNotebooks'
import { buildNotebookTree, flattenNotebookTree, notebookDescendantIds } from '@/lib/notebooks'
import type { NotebookNode } from '@/types/db'

interface MoveNodeModalProps {
  node: NotebookNode | null
  onClose: () => void
  onMoved?: (targetNotebookId: string) => void
}

export function MoveNodeModal({ node, onClose, onMoved }: MoveNodeModalProps) {
  const notebooks = useNotebooks()
  const allNodes = useAllActiveNotebookNodes()
  const mutations = useNotebookNodeMutations()
  const toast = useToast()

  const [targetNotebookId, setTargetNotebookId] = useState('')
  const [targetParentId, setTargetParentId] = useState('')

  useEffect(() => {
    if (!node) return
    setTargetNotebookId(node.notebook_id)
    setTargetParentId(node.parent_id ?? '')
  }, [node])

  const activeNotebooks = useMemo(
    () => (notebooks.data ?? []).filter((n) => !n.deleted_at),
    [notebooks.data],
  )

  const forbiddenIds = useMemo(() => {
    if (!node) return new Set<string>()
    const desc = notebookDescendantIds(allNodes.data ?? [], node.id)
    desc.add(node.id)
    return desc
  }, [node, allNodes.data])

  const targetOptions = useMemo(() => {
    if (!targetNotebookId) return []
    const nbNodes = (allNodes.data ?? []).filter((n) => n.notebook_id === targetNotebookId && !n.deleted_at)
    const flat = flattenNotebookTree(buildNotebookTree(nbNodes))
    return flat.filter((n) => !forbiddenIds.has(n.id))
  }, [allNodes.data, targetNotebookId, forbiddenIds])

  const submit = async () => {
    if (!node || !targetNotebookId) return
    try {
      const movedCount = await mutations.move.mutateAsync({
        nodeId: node.id,
        targetNotebookId,
        targetParentId: targetParentId || null,
      })
      toast.success(movedCount > 1 ? `Estrutura movida (${movedCount} itens).` : 'Item movido.')
      onMoved?.(targetNotebookId)
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={Boolean(node)}
      onClose={onClose}
      title={`Mover "${node?.title ?? ''}"`}
      description="Escolha o caderno e o local de destino. Subitens acompanham automaticamente, sem permitir ciclos."
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={mutations.move.isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={mutations.move.isPending} disabled={!targetNotebookId}>
            Mover
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Caderno de destino">
          {(id) => (
            <Select
              id={id}
              value={targetNotebookId}
              onChange={(e) => {
                setTargetNotebookId(e.target.value)
                setTargetParentId('')
              }}
            >
              {activeNotebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.title}
                  {nb.archived_at ? ' (arquivado)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Dentro de (seção ou página)">
          {(id) => (
            <Select id={id} value={targetParentId} onChange={(e) => setTargetParentId(e.target.value)}>
              <option value="">Raiz do caderno</option>
              {targetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {'— '.repeat(opt.depth)}
                  {opt.node_type === 'section' ? '[Seção] ' : ''}
                  {opt.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
