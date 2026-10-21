import { useBackend } from '@/app/data'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { useRemove } from '@/hooks/data'
import { RELATIONS, TABLE_LABELS } from '@/lib/data/schema'
import { eq } from '@/lib/data/types'
import type { TableName } from '@/types/db'

/**
 * Exclusão com aviso de impacto: conta os registros relacionados e explica,
 * antes de confirmar, o que será removido junto e o que apenas perde o vínculo.
 */
export function useSafeDelete(table: TableName) {
  const backend = useBackend()
  const confirm = useConfirm()
  const toast = useToast()
  const remove = useRemove(table)

  return async (id: string, name: string, opts: { extra?: string; onDone?: () => void } = {}) => {
    const relations = RELATIONS.filter((r) => r.parent === table && r.child !== 'study_session_pauses')
    const counts = await Promise.all(relations.map(async (r) => ({ r, n: await backend.count(r.child, [eq(r.column, id)]).catch(() => 0) })))
    const cascade = counts.filter((c) => c.n > 0 && c.r.onDelete === 'cascade')
    const unlink = counts.filter((c) => c.n > 0 && c.r.onDelete === 'set null')
    const ok = await confirm({
      title: `Excluir "${name}"?`,
      danger: true,
      confirmLabel: 'Excluir definitivamente',
      message: (
        <div className="space-y-2">
          <p>Esta ação não pode ser desfeita.</p>
          {cascade.length > 0 && (
            <p>
              <strong className="text-ink">Também serão excluídos:</strong> {cascade.map((c) => `${c.n} ${TABLE_LABELS[c.r.child]}`).join(', ')}.
            </p>
          )}
          {unlink.length > 0 && (
            <p>
              <strong className="text-ink">Serão mantidos sem vínculo</strong> (o histórico continua nos relatórios): {unlink.map((c) => `${c.n} ${TABLE_LABELS[c.r.child]}`).join(', ')}.
            </p>
          )}
          {opts.extra && <p>{opts.extra}</p>}
        </div>
      ),
    })
    if (!ok) return false
    try {
      await remove.mutateAsync(id)
      toast.success('Excluído.')
      opts.onDone?.()
      return true
    } catch (e) {
      toast.error(e)
      return false
    }
  }
}
