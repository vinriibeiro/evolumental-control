import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutGrid, List, ListTree, MoreHorizontal, Play, Star } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { useLongPress } from '@/components/ui/ContextMenu'
import { Badge, Card, Progress, Segmented } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { DIFFICULTY_LABELS, PRIORITY_LABELS } from '@/lib/labels'
import { formatDayKey, formatDuration } from '@/lib/time'
import { subjectsUnder, type ExplorerNode } from '../model'
import { hrefFor, type ExplorerView } from '../useExplorer'
import { useExplorerActions } from './ExplorerActions'
import { NodeIcon, typeLabel } from './NodeIcon'

export interface NodeMetrics {
  /** % de conteúdo concluído (ponderado). */
  progress: (n: ExplorerNode) => number | null
  /** Tempo líquido estudado na semana (matérias e pastas). */
  week: (n: ExplorerNode) => number
  /** Tempo total e última sessão por tópico (quando a matéria está aberta). */
  topicStats?: Map<string, { seconds: number; last: string | null }>
  nextReview?: Map<string, string>
}

export function ViewSwitch({ value, onChange }: { value: ExplorerView; onChange: (v: ExplorerView) => void }) {
  return (
    <Segmented
      label="Visualização"
      size="sm"
      value={value}
      onChange={onChange}
      options={[
        { value: 'tree', label: <span className="inline-flex items-center gap-1"><ListTree className="size-3.5" /> Árvore</span> },
        { value: 'list', label: <span className="inline-flex items-center gap-1"><List className="size-3.5" /> Lista</span> },
        { value: 'cards', label: <span className="inline-flex items-center gap-1"><LayoutGrid className="size-3.5" /> Cards</span> },
      ]}
    />
  )
}

export function ChildrenView({ nodes, view, metrics, empty }: { nodes: ExplorerNode[]; view: ExplorerView; metrics: NodeMetrics; empty: ReactNode }) {
  if (!nodes.length) return <>{empty}</>
  if (view === 'cards')
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {nodes.map((n) => (
          <NodeCard key={n.key} node={n} metrics={metrics} />
        ))}
      </div>
    )
  if (view === 'tree')
    return (
      <Card className="overflow-hidden py-1">
        <ul role="tree" aria-label="Conteúdo">
          {nodes.map((n) => (
            <TreeItem key={n.key} node={n} depth={0} metrics={metrics} />
          ))}
        </ul>
      </Card>
    )
  return (
    <Card className="overflow-hidden">
      <ul aria-label="Conteúdo" className="divide-y divide-line">
        {nodes.map((n) => (
          <ListRow key={n.key} node={n} metrics={metrics} />
        ))}
      </ul>
    </Card>
  )
}

function useNodeMenu(n: ExplorerNode) {
  const { openMenu, setSelected } = useExplorerActions()
  const show = (x: number, y: number) => {
    setSelected(new Set([n.key]))
    openMenu(n, x, y)
  }
  const longPress = useLongPress(show)
  return {
    show,
    handlers: {
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        show(e.clientX, e.clientY)
      },
      ...longPress,
    },
  }
}

function MenuButton({ node, show }: { node: ExplorerNode; show: (x: number, y: number) => void }) {
  return (
    <IconButton
      size="sm"
      label={`Ações de ${node.name}`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        show(r.right - 224, r.bottom + 4)
      }}
    >
      <MoreHorizontal className="size-4" />
    </IconButton>
  )
}

function Meta({ node: n, metrics }: { node: ExplorerNode; metrics: NodeMetrics }) {
  const parts: string[] = []
  if (n.type === 'folder') {
    const subjects = subjectsUnder(n).length
    const folders = n.children.filter((c) => c.type === 'folder').length
    if (folders) parts.push(`${folders} pasta${folders > 1 ? 's' : ''}`)
    parts.push(`${subjects} matéria${subjects === 1 ? '' : 's'}`)
  } else if (n.type === 'subject') {
    const topics = n.children.length
    parts.push(`${topics} ite${topics === 1 ? 'm' : 'ns'}`)
  } else if (n.container) {
    parts.push(`${n.children.length} ite${n.children.length === 1 ? 'm' : 'ns'}`)
  } else {
    const st = metrics.topicStats?.get(n.id)
    if (st?.seconds) parts.push(`${formatDuration(st.seconds)} estudados`)
    const review = metrics.nextReview?.get(n.id)
    if (review) parts.push(`revisão ${formatDayKey(review)}`)
    if (n.topic!.mastery > 0) parts.push(`domínio ${n.topic!.mastery}/5`)
  }
  const week = n.type === 'topic' ? 0 : metrics.week(n)
  if (week) parts.push(`${formatDuration(week)} na semana`)
  return <span className="block truncate text-xs text-muted">{parts.join(' · ') || typeLabel(n)}</span>
}

function ListRow({ node: n, metrics }: { node: ExplorerNode; metrics: NodeMetrics }) {
  const navigate = useNavigate()
  const { studyHref } = useExplorerActions()
  const { show, handlers } = useNodeMenu(n)
  const progress = metrics.progress(n)
  const study = studyHref(n)
  return (
    <li {...handlers} className={cn('flex items-center gap-3 px-3 py-2.5 hover:bg-surface', n.archived && 'opacity-60')}>
      <NodeIcon node={n} className="size-5" />
      <button className="min-w-0 flex-1 text-left" onClick={() => navigate(hrefFor(n.type, n.id, n.topic?.subject_id))}>
        <span className={cn('flex items-center gap-1.5 truncate text-sm text-ink', n.type !== 'topic' && 'font-medium')}>
          <span className="truncate">{n.name}</span>
          {n.favorite && <Star className="size-3 shrink-0 fill-current text-accent-strong" aria-label="Favorito" />}
        </span>
        <Meta node={n} metrics={metrics} />
      </button>
      {progress != null && (
        <div className="hidden w-28 shrink-0 sm:block" title={`${Math.round(progress)}% concluído`}>
          <Progress value={progress} color={n.color ?? undefined} label={`Progresso de ${n.name}`} />
        </div>
      )}
      {n.subject && <Badge className="hidden md:inline-flex">P: {PRIORITY_LABELS[n.subject.priority]}</Badge>}
      {study && !n.archived && (
        <IconButton size="sm" label={`Estudar ${n.name}`} onClick={() => navigate(study)}>
          <Play className="size-3.5" />
        </IconButton>
      )}
      <MenuButton node={n} show={show} />
    </li>
  )
}

function NodeCard({ node: n, metrics }: { node: ExplorerNode; metrics: NodeMetrics }) {
  const navigate = useNavigate()
  const { show, handlers } = useNodeMenu(n)
  const progress = metrics.progress(n)
  const s = n.subject
  return (
    <Card {...handlers} className={cn('flex flex-col overflow-hidden', n.archived && 'opacity-60')}>
      <div className="h-1.5 w-full" style={{ background: n.color ?? 'var(--border)' }} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <NodeIcon node={n} className="mt-0.5 size-5" />
          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(hrefFor(n.type, n.id, n.topic?.subject_id))}>
            <span className="block truncate font-semibold text-ink hover:underline">{n.name}</span>
            <Meta node={n} metrics={metrics} />
          </button>
          {n.favorite && <Star className="size-3.5 shrink-0 fill-current text-accent-strong" aria-label="Favorito" />}
          <MenuButton node={n} show={show} />
        </div>
        {s && (
          <div className="flex flex-wrap gap-1.5">
            <Badge>Prioridade: {PRIORITY_LABELS[s.priority]}</Badge>
            <Badge>{DIFFICULTY_LABELS[s.difficulty]}</Badge>
            {s.weekly_goal_hours ? <Badge>Meta {s.weekly_goal_hours}h/sem</Badge> : null}
          </div>
        )}
        {progress != null && (
          <div className="mt-auto pt-1">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Conteúdo concluído</span>
              <span className="tabular">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} color={n.color ?? undefined} label={`Progresso de ${n.name}`} />
          </div>
        )}
      </div>
    </Card>
  )
}

function TreeItem({ node: n, depth, metrics }: { node: ExplorerNode; depth: number; metrics: NodeMetrics }) {
  const [open, setOpen] = useState(depth === 0)
  const navigate = useNavigate()
  const { show, handlers } = useNodeMenu(n)
  const has = n.children.length > 0
  const progress = metrics.progress(n)
  return (
    <li role="treeitem" aria-level={depth + 1} aria-expanded={has ? open : undefined} aria-label={n.name}>
      <div {...handlers} className={cn('flex items-center gap-1.5 py-1.5 pr-2 hover:bg-surface', n.archived && 'opacity-60')} style={{ paddingLeft: 8 + Math.min(depth, 10) * 18 }}>
        {has ? (
          <button className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:text-ink" aria-label={open ? `Recolher ${n.name}` : `Expandir ${n.name}`} onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <NodeIcon node={n} open={open && has} />
        <button className="min-w-0 flex-1 text-left" onClick={() => navigate(hrefFor(n.type, n.id, n.topic?.subject_id))}>
          <span className={cn('block truncate text-sm text-ink', n.type !== 'topic' && 'font-medium', n.topic?.status === 'completed' && 'text-muted line-through decoration-1')}>{n.name}</span>
          <Meta node={n} metrics={metrics} />
        </button>
        {progress != null && <span className="tabular hidden text-xs text-muted sm:inline">{Math.round(progress)}%</span>}
        <MenuButton node={n} show={show} />
      </div>
      {has && open && (
        <ul role="group">
          {n.children.map((c) => (
            <TreeItem key={c.key} node={c} depth={depth + 1} metrics={metrics} />
          ))}
        </ul>
      )}
    </li>
  )
}
