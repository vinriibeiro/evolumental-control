import { BookOpen, CheckCircle2, Circle, CircleDot, Folder, FolderOpen, Landmark, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TOPIC_STATUS_COLORS, TOPIC_STATUS_LABELS } from '@/lib/labels'
import type { ExplorerNode } from '../model'

/**
 * Ícone do nó: forma indica o tipo (área, pasta, matéria, tópico) e, nos
 * tópicos, o estado — nunca só pela cor (rótulo acessível incluído).
 */
export function NodeIcon({ node, open, className = 'size-4' }: { node: ExplorerNode; open?: boolean; className?: string }) {
  if (node.icon) {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center leading-none', className)} aria-hidden>
        {node.icon}
      </span>
    )
  }
  if (node.type === 'folder') {
    if (node.folder?.kind === 'area') return <Landmark className={cn('shrink-0', className)} style={{ color: node.color ?? 'var(--accent-strong)' }} aria-hidden />
    const F = open ? FolderOpen : Folder
    return <F className={cn('shrink-0', className)} style={{ color: node.color ?? 'var(--accent-strong)' }} aria-hidden />
  }
  if (node.type === 'subject') return <BookOpen className={cn('shrink-0', className)} style={{ color: node.color ?? undefined }} aria-hidden />
  if (node.container) {
    const F = open ? FolderOpen : Folder
    return <F className={cn('shrink-0 text-muted', className)} aria-hidden />
  }
  const status = node.topic!.status
  const S = status === 'completed' ? CheckCircle2 : status === 'in_progress' ? CircleDot : status === 'reviewing' ? RotateCcw : Circle
  return (
    <span title={TOPIC_STATUS_LABELS[status]} className="inline-flex shrink-0">
      <S className={className} style={{ color: TOPIC_STATUS_COLORS[status] }} aria-hidden />
      <span className="sr-only">{TOPIC_STATUS_LABELS[status]}</span>
    </span>
  )
}

export function typeLabel(node: ExplorerNode): string {
  if (node.type === 'folder') return node.folder?.kind === 'area' ? 'Área de estudo' : 'Pasta'
  if (node.type === 'subject') return 'Matéria'
  return node.container ? 'Pasta da matéria' : 'Tópico'
}
