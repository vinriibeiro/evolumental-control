import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileText } from 'lucide-react'
import { Badge, Card } from '@/components/ui/layout'
import { EmptyState } from '@/components/ui/feedback'
import { useAllActiveNotebookNodes, useNotebooks } from '@/hooks/useNotebooks'
import { PAGE_STATUS_LABELS } from '@/lib/notebooks'
import { NotebookIcon } from './NotebookIcon'

interface RelatedNotebooksSectionProps {
  subjectId: string
  topicId?: string | null
  compact?: boolean
}

/**
 * Exibe "Cadernos e anotações relacionadas" em Matérias e Tópicos sem duplicar dados
 * e sem alterar automaticamente o progresso ou domínio do tópico.
 */
export function RelatedNotebooksSection({ subjectId, topicId, compact = false }: RelatedNotebooksSectionProps) {
  const notebooksQuery = useNotebooks()
  const nodesQuery = useAllActiveNotebookNodes()

  const activeNotebooks = useMemo(
    () => (notebooksQuery.data ?? []).filter((n) => !n.deleted_at && !n.archived_at),
    [notebooksQuery.data],
  )
  const nbById = useMemo(() => new Map(activeNotebooks.map((n) => [n.id, n])), [activeNotebooks])

  const relatedNotebooks = useMemo(
    () => (topicId ? [] : activeNotebooks.filter((nb) => nb.subject_id === subjectId)),
    [activeNotebooks, subjectId, topicId],
  )

  const relatedPages = useMemo(() => {
    const all = (nodesQuery.data ?? []).filter((n) => n.node_type === 'page' && nbById.has(n.notebook_id))
    if (topicId) return all.filter((n) => n.topic_id === topicId)
    return all.filter((n) => n.subject_id === subjectId)
  }, [nodesQuery.data, nbById, subjectId, topicId])

  if (compact) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <BookOpen className="size-4 text-accent-strong" aria-hidden /> Cadernos e anotações relacionadas
          </h3>
          <Link to="/cadernos" className="text-xs font-medium text-muted hover:text-ink">
            Meus Cadernos
          </Link>
        </div>
        {relatedPages.length === 0 ? (
          <p className="text-xs text-muted">
            Nenhuma página de caderno vinculada a este tópico ainda. Você pode vincular páginas no módulo{' '}
            <Link to="/cadernos" className="underline hover:text-ink">
              Meus Cadernos
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {relatedPages.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/cadernos/${p.notebook_id}/pagina/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 hover:border-ink/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="truncate font-medium text-ink">{p.title}</span>
                  </span>
                  <Badge className="shrink-0">{nbById.get(p.notebook_id)?.title ?? 'Caderno'}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (relatedNotebooks.length === 0 && relatedPages.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-8" />}
        title="Nenhum caderno ou anotação vinculada"
        description="Crie ou vincule cadernos e páginas a esta matéria em Meus Cadernos para consultá-los aqui sem duplicar dados."
        action={
          <Link
            to="/cadernos"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-strong"
          >
            Abrir Meus Cadernos
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      {relatedNotebooks.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-ink">Cadernos vinculados ({relatedNotebooks.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedNotebooks.map((nb) => (
              <Link
                key={nb.id}
                to={`/cadernos/${nb.id}`}
                className="evl-tool-link flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: nb.color }}>
                  <NotebookIcon name={nb.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{nb.title}</p>
                  {nb.description && <p className="truncate text-xs text-muted">{nb.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {relatedPages.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-ink">Páginas relacionadas ({relatedPages.length})</h3>
          <Card className="divide-y divide-line">
            {relatedPages.map((p) => (
              <Link
                key={p.id}
                to={`/cadernos/${p.notebook_id}/pagina/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate font-medium text-ink">{p.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  <Badge>{nbById.get(p.notebook_id)?.title ?? 'Caderno'}</Badge>
                  <Badge>{PAGE_STATUS_LABELS[p.status]}</Badge>
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
