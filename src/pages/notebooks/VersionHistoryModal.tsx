import { useState } from 'react'
import { BookmarkPlus, History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import { useNotebookNodeMutations, usePageVersions } from '@/hooks/useNotebooks'
import { docToPlainText } from '@/lib/notebooks'
import type { NotebookContentDoc, NotebookPageContent, NotebookVersionReason } from '@/types/db'

const REASON_LABELS: Record<NotebookVersionReason, string> = {
  snapshot: 'Snapshot automático',
  manual: 'Marco manual',
  restore: 'Antes de restaurar',
  conflict_backup: 'Backup de conflito',
  import: 'Importação',
}

interface VersionHistoryModalProps {
  open: boolean
  onClose: () => void
  nodeId: string
  currentTitle: string
  currentDoc: NotebookContentDoc
  currentRevision: number
  onRestored: (restored: NotebookPageContent) => void
}

export function VersionHistoryModal({
  open,
  onClose,
  nodeId,
  currentTitle,
  currentDoc,
  currentRevision,
  onRestored,
}: VersionHistoryModalProps) {
  const versionsQuery = usePageVersions(open ? nodeId : null)
  const mut = useNotebookNodeMutations()
  const confirm = useConfirm()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const versions = versionsQuery.data ?? []
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null

  const handleSaveManual = async () => {
    try {
      await mut.createVersion.mutateAsync({
        nodeId,
        title: currentTitle,
        contentJson: currentDoc,
        revision: currentRevision,
        reason: 'manual',
      })
      toast.success('Marco salvo no histórico de versões.')
    } catch (e) {
      toast.error(e)
    }
  }

  const handleRestore = async (versionId: string) => {
    const ok = await confirm({
      title: 'Restaurar esta versão?',
      message: 'A versão atual será salva automaticamente no histórico antes da restauração, então nada é perdido.',
      confirmLabel: 'Restaurar versão',
    })
    if (!ok) return
    try {
      const saved = await mut.restoreVersion.mutateAsync({
        nodeId,
        versionId,
        expectedRevision: currentRevision,
      })
      toast.success('Versão restaurada.')
      onRestored(saved)
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Histórico de versões"
      description="Snapshots automáticos (intervalo mínimo de 5 min, retenção de até 30 versões) e marcos manuais."
      footer={
        <>
          <Button variant="secondary" icon={<BookmarkPlus className="size-4" />} loading={mut.createVersion.isPending} onClick={() => void handleSaveManual()}>
            Salvar marco agora
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </>
      }
    >
      {versionsQuery.isPending ? (
        <Spinner label="Carregando histórico…" />
      ) : versions.length === 0 ? (
        <EmptyState
          icon={<History className="size-8" />}
          title="Nenhuma versão gravada ainda"
          description="Snapshots são criados periodicamente ao editar ou sob demanda clicando em 'Salvar marco agora'."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="scroll-thin max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {versions.map((v) => {
              const active = selected?.id === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? 'border-accent bg-surface-2' : 'border-line bg-surface hover:bg-surface-2/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular text-xs font-semibold text-ink">rev. {v.revision}</span>
                    <Badge>{REASON_LABELS[v.reason]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-ink">{v.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{new Date(v.created_at).toLocaleString('pt-BR')}</p>
                </button>
              )
            })}
          </div>

          {selected && (
            <Card className="flex flex-col p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{selected.title}</p>
                  <p className="text-xs text-muted">
                    Revisão {selected.revision} · {new Date(selected.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<RotateCcw className="size-3.5" />}
                  loading={mut.restoreVersion.isPending}
                  onClick={() => void handleRestore(selected.id)}
                >
                  Restaurar esta versão
                </Button>
              </div>
              <pre className="scroll-thin max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs leading-6 text-ink">
                {docToPlainText(selected.content_json) || '(Página vazia nesta versão)'}
              </pre>
            </Card>
          )}
        </div>
      )}
    </Modal>
  )
}
