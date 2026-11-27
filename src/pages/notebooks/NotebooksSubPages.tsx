import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, FileText, Folder, GitFork, RotateCcw, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, PageHeader, Tabs } from '@/components/ui/layout'
import { EmptyState, QueryState, Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import {
  useAllActiveNotebookNodes,
  useAllNotebookPageLinks,
  useNotebookMutations,
  useNotebookNodeMutations,
  useNotebooks,
  useTrashedNodes,
  useTrashedNotebooks,
} from '@/hooks/useNotebooks'
import { PAGE_STATUS_LABELS } from '@/lib/notebooks'
import { NotebookIcon } from './NotebookIcon'

const KnowledgeGraphView = lazy(() => import('./KnowledgeGraphView'))

export function NotebooksFavoritesPage() {
  const notebooks = useNotebooks()
  const nodes = useAllActiveNotebookNodes()
  const nbMut = useNotebookMutations()
  const nodeMut = useNotebookNodeMutations()
  const toast = useToast()

  const activeNbById = useMemo(
    () => new Map((notebooks.data ?? []).filter((n) => !n.archived_at).map((n) => [n.id, n])),
    [notebooks.data],
  )
  const favNotebooks = useMemo(() => [...activeNbById.values()].filter((n) => n.is_favorite), [activeNbById])
  const favNodes = useMemo(
    () => (nodes.data ?? []).filter((n) => n.is_favorite && activeNbById.has(n.notebook_id)),
    [nodes.data, activeNbById],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Favoritos" description="Cadernos e páginas marcados para acesso rápido." />
      <QueryState query={notebooks}>
        {favNotebooks.length === 0 && favNodes.length === 0 ? (
          <EmptyState
            icon={<Star className="size-9" />}
            title="Nenhum item favorito"
            description="Marque cadernos ou páginas com estrela para mantê-los sempre à mão."
            action={
              <Link to="/cadernos">
                <Button variant="primary">Ir para Meus Cadernos</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {favNotebooks.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-ink">Cadernos ({favNotebooks.length})</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {favNotebooks.map((nb) => (
                    <Card key={nb.id} className="flex items-center justify-between gap-3 p-4">
                      <Link to={`/cadernos/${nb.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: nb.color }}>
                          <NotebookIcon name={nb.icon} className="size-4" />
                        </span>
                        <span className="truncate text-sm font-semibold text-ink hover:text-accent">{nb.title}</span>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => nbMut.toggleFavorite.mutate(nb, { onError: toast.error })}>
                        Remover
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {favNodes.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-ink">Páginas e seções ({favNodes.length})</h2>
                <Card className="divide-y divide-line">
                  {favNodes.map((node) => (
                    <div key={node.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <Link to={`/cadernos/${node.notebook_id}/pagina/${node.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                        {node.node_type === 'section' ? <Folder className="size-4 text-muted" /> : <FileText className="size-4 text-muted" />}
                        <span className="truncate text-sm font-medium text-ink hover:text-accent">{node.title}</span>
                        <Badge className="shrink-0">{activeNbById.get(node.notebook_id)?.title}</Badge>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => nodeMut.update.mutate({ id: node.id, patch: { is_favorite: false } }, { onError: toast.error })}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>
        )}
      </QueryState>
    </div>
  )
}

export function NotebooksRecentPage() {
  const notebooks = useNotebooks()
  const nodes = useAllActiveNotebookNodes()

  const nbById = useMemo(() => new Map((notebooks.data ?? []).map((n) => [n.id, n])), [notebooks.data])
  const pages = useMemo(
    () => (nodes.data ?? []).filter((n) => n.node_type === 'page' && nbById.has(n.notebook_id)),
    [nodes.data, nbById],
  )
  const edited = useMemo(() => [...pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30), [pages])
  const studied = useMemo(
    () =>
      pages
        .filter((p) => Boolean(p.last_studied_at))
        .sort((a, b) => (b.last_studied_at ?? '').localeCompare(a.last_studied_at ?? ''))
        .slice(0, 30),
    [pages],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Recentes" description="Histórico de páginas editadas e estudadas nos seus cadernos." />
      <QueryState query={nodes}>
        {edited.length === 0 ? (
          <EmptyState
            icon={<Clock className="size-9" />}
            title="Nenhuma página recente"
            description="Quando você criar e editar páginas nos seus cadernos, elas aparecerão aqui."
            action={
              <Link to="/cadernos">
                <Button variant="primary">Ir para Meus Cadernos</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Editadas recentemente</h2>
              <ul className="divide-y divide-line">
                {edited.map((p) => (
                  <li key={p.id}>
                    <Link to={`/cadernos/${p.notebook_id}/pagina/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted" />
                        <span className="truncate font-medium text-ink">{p.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        <Badge>{nbById.get(p.notebook_id)?.title}</Badge>
                        <span>{new Date(p.updated_at).toLocaleDateString('pt-BR')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Estudadas recentemente</h2>
              {studied.length === 0 ? (
                <p className="text-xs text-muted">Nenhuma página marcada como estudada ainda.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {studied.map((p) => (
                    <li key={p.id}>
                      <Link to={`/cadernos/${p.notebook_id}/pagina/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent">
                        <span className="flex min-w-0 items-center gap-2">
                          <BookOpen className="size-4 shrink-0 text-muted" />
                          <span className="truncate font-medium text-ink">{p.title}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                          <Badge>{PAGE_STATUS_LABELS[p.status]}</Badge>
                          <span>{p.last_studied_at ? new Date(p.last_studied_at).toLocaleDateString('pt-BR') : '—'}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  )
}

export function NotebooksConnectionsPage() {
  const [tab, setTab] = useState<'graph' | 'list'>('graph')
  const linksQuery = useAllNotebookPageLinks()
  const nodesQuery = useAllActiveNotebookNodes()
  const notebooksQuery = useNotebooks()

  const nodeById = useMemo(() => new Map((nodesQuery.data ?? []).map((n) => [n.id, n])), [nodesQuery.data])
  const nbById = useMemo(() => new Map((notebooksQuery.data ?? []).map((n) => [n.id, n])), [notebooksQuery.data])
  const links = linksQuery.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conexões"
        description="Grafo de conhecimento e referências cruzadas criadas explicitamente entre suas páginas e cadernos."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'graph', label: 'Grafo de conhecimento' },
          { value: 'list', label: `Lista de conexões (${links.length})` },
        ]}
      />

      {tab === 'graph' ? (
        <Suspense fallback={<Spinner label="Carregando grafo de conhecimento…" />}>
          <KnowledgeGraphView />
        </Suspense>
      ) : (
        <QueryState query={linksQuery}>
          {links.length === 0 ? (
            <EmptyState
              icon={<GitFork className="size-9" />}
              title="Nenhuma conexão registrada ainda"
              description="Digite [[ dentro de qualquer página para criar links internos entre páginas e cadernos, ou vincule manualmente no painel lateral."
            />
          ) : (
            <Card className="divide-y divide-line">
              {links.map((link) => {
                const source = nodeById.get(link.source_node_id)
                const target = nodeById.get(link.target_node_id)
                if (!source || !target) return null
                return (
                  <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        to={`/cadernos/${source.notebook_id}/pagina/${source.id}${link.source_block_id ? `?bloco=${link.source_block_id}` : ''}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {source.title}
                      </Link>
                      <span className="text-muted">→</span>
                      <Link
                        to={`/cadernos/${target.notebook_id}/pagina/${target.id}${link.target_block_id ? `?bloco=${link.target_block_id}` : ''}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {target.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Badge>{nbById.get(source.notebook_id)?.title ?? 'Caderno'}</Badge>
                      {source.notebook_id !== target.notebook_id && <Badge>{nbById.get(target.notebook_id)?.title ?? 'Caderno'}</Badge>}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </QueryState>
      )}
    </div>
  )
}

export function NotebooksTrashPage() {
  const trashedNotebooks = useTrashedNotebooks()
  const trashedNodes = useTrashedNodes()
  const activeNodes = useAllActiveNotebookNodes()
  const allNotebooks = useNotebooks({ includeDeleted: true })
  const nbMut = useNotebookMutations()
  const nodeMut = useNotebookNodeMutations()
  const confirm = useConfirm()
  const toast = useToast()

  const nbById = useMemo(() => new Map((allNotebooks.data ?? []).map((n) => [n.id, n])), [allNotebooks.data])
  const deletedNotebooks = trashedNotebooks.data ?? []
  const deletedNodes = useMemo(() => trashedNodes.data ?? [], [trashedNodes.data])
  const combinedNodes = useMemo(() => [...(activeNodes.data ?? []), ...deletedNodes], [activeNodes.data, deletedNodes])

  // Exibe apenas raízes de cada exclusão de nós (evita duplicar filhos que serão restaurados junto com o pai)
  const deletedNodeById = useMemo(() => new Map(deletedNodes.map((n) => [n.id, n])), [deletedNodes])
  const topDeletedNodes = useMemo(
    () =>
      deletedNodes.filter((n) => {
        if (!n.parent_id) return true
        const parent = deletedNodeById.get(n.parent_id)
        return !parent || parent.deleted_at !== n.deleted_at
      }),
    [deletedNodes, deletedNodeById],
  )

  const handlePurgeNotebook = async (id: string, title: string) => {
    const ok = await confirm({
      title: `Excluir permanentemente "${title}"?`,
      danger: true,
      confirmLabel: 'Excluir permanentemente',
      message: (
        <div className="space-y-2">
          <p>Todas as seções, páginas, conteúdos e versões deste caderno serão removidos definitivamente.</p>
          <p>
            <strong className="text-ink">Preservados:</strong> flashcards vinculados e todo o histórico de revisões SM-2 e sessões de estudo continuarão intactos.
          </p>
        </div>
      ),
    })
    if (!ok) return
    try {
      await nbMut.purge.mutateAsync(id)
      toast.success('Caderno excluído permanentemente.')
    } catch (e) {
      toast.error(e)
    }
  }

  const handlePurgeNode = async (id: string, title: string) => {
    const ok = await confirm({
      title: `Excluir permanentemente "${title}"?`,
      danger: true,
      confirmLabel: 'Excluir permanentemente',
      message: (
        <div className="space-y-2">
          <p>Esta página/seção e seus subitens serão removidos definitivamente.</p>
          <p>
            <strong className="text-ink">Preservados:</strong> flashcards vinculados e histórico de memorização continuam intactos.
          </p>
        </div>
      ),
    })
    if (!ok) return
    try {
      await nodeMut.purge.mutateAsync(id)
      toast.success('Item excluído permanentemente.')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lixeira"
        description="Itens excluídos podem ser restaurados com segurança. A exclusão permanente preserva flashcards e histórico de revisões."
      />
      <QueryState query={trashedNotebooks}>
        {deletedNotebooks.length === 0 && topDeletedNodes.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="size-9" />}
            title="A lixeira está vazia"
            description="Cadernos, seções e páginas excluídos aparecerão aqui para restauração ou remoção definitiva."
          />
        ) : (
          <div className="space-y-6">
            {deletedNotebooks.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-ink">Cadernos na lixeira ({deletedNotebooks.length})</h2>
                <Card className="divide-y divide-line">
                  {deletedNotebooks.map((nb) => (
                    <div key={nb.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: nb.color }}>
                          <NotebookIcon name={nb.icon} className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{nb.title}</p>
                          <p className="text-xs text-muted">Excluído em {nb.deleted_at ? new Date(nb.deleted_at).toLocaleDateString('pt-BR') : '—'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<RotateCcw className="size-3.5" />}
                          onClick={() =>
                            nbMut.restore.mutate(nb.id, {
                              onSuccess: () => toast.success('Caderno restaurado.'),
                              onError: toast.error,
                            })
                          }
                        >
                          Restaurar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handlePurgeNotebook(nb.id, nb.title)}>
                          Excluir de vez
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {topDeletedNodes.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-ink">Seções e páginas na lixeira ({topDeletedNodes.length})</h2>
                <Card className="divide-y divide-line">
                  {topDeletedNodes.map((node) => {
                    const nb = nbById.get(node.notebook_id)
                    return (
                      <div key={node.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {node.node_type === 'section' ? <Folder className="size-4 text-muted" /> : <FileText className="size-4 text-muted" />}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{node.title}</p>
                            <p className="text-xs text-muted">
                              {nb?.title ?? 'Caderno'} · Excluído em {node.deleted_at ? new Date(node.deleted_at).toLocaleDateString('pt-BR') : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<RotateCcw className="size-3.5" />}
                            disabled={Boolean(nb?.deleted_at)}
                            title={nb?.deleted_at ? 'Restaure o caderno primeiro' : undefined}
                            onClick={() =>
                              nodeMut.restore.mutate(
                                { allNodes: combinedNodes.filter((x) => x.notebook_id === node.notebook_id), nodeId: node.id },
                                {
                                  onSuccess: () => toast.success('Item restaurado.'),
                                  onError: toast.error,
                                },
                              )
                            }
                          >
                            Restaurar
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handlePurgeNode(node.id, node.title)}>
                            Excluir de vez
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </section>
            )}
          </div>
        )}
      </QueryState>
    </div>
  )
}
