import { useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ListTree, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useSettings } from '@/hooks/useSettings'
import { periodRange, todayKey } from '@/lib/time'
import { weightedProgress } from '@/lib/tree'
import type { Topic } from '@/types/db'
import { descendants, pathTo, subjectsUnder, type ExplorerNode } from './model'
import { hrefFor, keyFromRoute, useExplorerData } from './useExplorer'
import { Breadcrumbs } from './components/Breadcrumbs'
import type { NodeMetrics } from './components/ChildrenView'
import { ExplorerActionsProvider } from './components/ExplorerActions'
import { ExplorerTree } from './components/ExplorerTree'
import { FolderContent, SubjectContent } from './components/NodeContent'
import { TopicPage } from './components/TopicPage'

/**
 * Explorador de Estudos: árvore à esquerda (desktop) e o conteúdo do item
 * aberto à direita. Rotas: /materias, /materias/pasta/:folderId,
 * /materias/:subjectId e /materias/:subjectId/topico/:topicId.
 */
export default function ExplorerPage() {
  const params = useParams<{ folderId?: string; subjectId?: string; topicId?: string }>()
  const [search] = useSearchParams()
  const data = useExplorerData()
  const settings = useSettings()
  const week = useMemo(() => periodRange('week', todayKey(settings.timezone)), [settings.timezone])
  const weekStats = useStudyStats(week)
  const [treeOpen, setTreeOpen] = useState(false)

  const activeKey = keyFromRoute(params)
  const node = activeKey ? (data.index.byKey.get(activeKey) ?? null) : null

  const topicsBySubject = useMemo(() => {
    const m = new Map<string, Topic[]>()
    for (const t of data.topics) m.set(t.subject_id, [...(m.get(t.subject_id) ?? []), t])
    return m
  }, [data.topics])
  const subjectProgress = useMemo(() => new Map([...topicsBySubject].map(([k, v]) => [k, weightedProgress(v).percent])), [topicsBySubject])

  const progress = useCallback(
    (n: ExplorerNode): number | null => {
      if (n.type === 'subject') return topicsBySubject.has(n.id) ? (subjectProgress.get(n.id) ?? 0) : null
      if (n.type === 'folder') {
        const topics = subjectsUnder(n).flatMap((s) => topicsBySubject.get(s.id) ?? [])
        return topics.length ? weightedProgress(topics).percent : null
      }
      if (!n.children.length) return null
      return weightedProgress([n.topic!, ...descendants(n).map((d) => d.topic!)].map((t) => (t.id === n.id ? { ...t, parent_id: null } : t))).percent
    },
    [topicsBySubject, subjectProgress],
  )
  const metrics = useMemo<NodeMetrics>(
    () => ({
      progress,
      week: (n) => (n.type === 'topic' ? 0 : subjectsUnder(n).reduce((a, s) => a + (weekStats.stats.bySubject.get(s.id) ?? 0), 0)),
    }),
    [progress, weekStats.stats],
  )

  // Links antigos: /materias/:id?topico=… → página do tópico.
  const legacyTopic = search.get('topico')
  if (params.subjectId && !params.topicId && legacyTopic) return <Navigate to={hrefFor('topic', legacyTopic, params.subjectId)} replace />

  if (data.isPending) return <Spinner />
  if (data.error) return <ErrorState error={data.error} onRetry={data.refetch} />

  const missing = activeKey && !node
  const path = node ? pathTo(data.index, node.key) : []

  let content
  if (missing)
    content = (
      <EmptyState
        title="Item não encontrado"
        description="Ele pode ter sido excluído ou movido."
        action={
          <Link to="/materias" className="text-sm underline">
            Voltar ao Explorador
          </Link>
        }
      />
    )
  else if (!node || node.type === 'folder') content = <FolderContent node={node} index={data.index} metrics={metrics} />
  else if (node.type === 'subject') content = <SubjectContent node={node} metrics={metrics} />
  else {
    const subjectNode = path.find((p) => p.type === 'subject')!
    content = <TopicPage key={node.id} node={node} subject={subjectNode.subject!} metrics={metrics} />
  }

  return (
    <ExplorerActionsProvider index={data.index}>
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
        <Card className="sticky top-[5.5rem] hidden h-[calc(100vh-7.5rem)] overflow-hidden lg:flex lg:flex-col">
          <ExplorerTree activeKey={activeKey} progress={subjectProgress} className="h-full" />
        </Card>

        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 lg:hidden">
            <Button size="sm" icon={<ListTree className="size-4" />} onClick={() => setTreeOpen(true)}>
              Explorador
            </Button>
          </div>
          <Breadcrumbs path={path} />
          {content}
        </div>
      </div>

      {/* Celular: a árvore abre como painel, sem espremer a interface do desktop. */}
      {treeOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Explorador">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setTreeOpen(false)} aria-hidden />
          <div className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(24rem,92vw)] flex-col bg-bg shadow-xl" onClickCapture={(e) => {
            // Fecha ao abrir um item (toque em uma linha), mas não ao usar os controles.
            if ((e.target as HTMLElement).closest('[role="treeitem"]') && !(e.target as HTMLElement).closest('button')) setTimeout(() => setTreeOpen(false), 0)
          }}>
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="font-semibold text-ink">Explorador</span>
              <IconButton label="Fechar" onClick={() => setTreeOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <ExplorerTree activeKey={activeKey} progress={subjectProgress} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </ExplorerActionsProvider>
  )
}
