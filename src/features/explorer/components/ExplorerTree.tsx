import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderInput, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useLongPress } from '@/components/ui/ContextMenu'
import { useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { canDrop, filterKeys, flatten, pathTo, type DropPosition, type ExplorerNode, type NodeKey } from '../model'
import { loadIndex, moveNode } from '../service'
import { hrefFor, useExpanded, useExplorerOp } from '../useExplorer'
import { useExplorerActions } from './ExplorerActions'
import { NodeIcon, typeLabel } from './NodeIcon'

interface Props {
  activeKey: NodeKey | null
  /** Texto do indicador escolhido (mapa do edital) para cada nó. */
  display: (n: ExplorerNode) => { text: string; aria: string } | null
  className?: string
}

export function ExplorerTree({ activeKey, display, className }: Props) {
  const { index, selected, setSelected, openMenu, renaming, setRenaming, rename, remove, move, favorite, archive } = useExplorerActions()
  const { expanded, toggle, expandAll } = useExpanded()
  const [term, setTerm] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [focused, setFocused] = useState<NodeKey | null>(activeKey)
  const [drag, setDrag] = useState<NodeKey | null>(null)
  const [drop, setDrop] = useState<{ key: NodeKey | 'root'; pos: DropPosition; ok: boolean } | null>(null)
  const anchor = useRef<NodeKey | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()
  const op = useExplorerOp()
  const toast = useToast()

  // Ao abrir um item (pela URL) ou quando ele ganha filhos, expande o caminho
  // até ele e o próprio item.
  const indexRef = useRef(index)
  indexRef.current = index
  const activeChildren = activeKey ? (index.byKey.get(activeKey)?.children.length ?? 0) : 0
  useEffect(() => {
    if (!activeKey) return
    const path = pathTo(indexRef.current, activeKey)
    expandAll(path.filter((n) => n.children.length).map((n) => n.key), true)
    setFocused(activeKey)
  }, [activeKey, activeChildren, expandAll])

  const include = useMemo(() => filterKeys(index, { term, favoritesOnly, showArchived }), [index, term, favoritesOnly, showArchived])
  const filtering = Boolean(term.trim() || favoritesOnly)
  const visible = useMemo(
    () =>
      filtering
        ? flatten(index.roots, () => true, include ?? undefined)
        : flatten(index.roots, (k) => expanded.has(k)).filter((n) => !include || include.has(n.key)),
    [index, expanded, include, filtering],
  )

  const open = (n: ExplorerNode) => navigate(hrefFor(n.type, n.id, n.topic?.subject_id))

  const onRowClick = (e: MouseEvent, n: ExplorerNode) => {
    setFocused(n.key)
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected)
      if (next.has(n.key)) next.delete(n.key)
      else next.add(n.key)
      setSelected(next)
      anchor.current = n.key
      return
    }
    if (e.shiftKey && anchor.current) {
      const a = visible.findIndex((x) => x.key === anchor.current)
      const b = visible.findIndex((x) => x.key === n.key)
      if (a >= 0 && b >= 0) {
        setSelected(new Set(visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.key)))
        return
      }
    }
    anchor.current = n.key
    setSelected(new Set([n.key]))
    open(n)
  }

  const focusRow = (key: NodeKey) => {
    setFocused(key)
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus())
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (renaming) return
    const i = visible.findIndex((n) => n.key === focused)
    const cur = visible[i]
    if (!cur) return
    const isOpen = expanded.has(cur.key) || filtering
    switch (e.key) {
      case 'ArrowDown':
        if (visible[i + 1]) focusRow(visible[i + 1].key)
        break
      case 'ArrowUp':
        if (i > 0) focusRow(visible[i - 1].key)
        break
      case 'ArrowRight':
        if (cur.children.length && !isOpen) toggle(cur.key, true)
        else if (cur.children.length) focusRow(cur.children[0].key)
        break
      case 'ArrowLeft':
        if (cur.children.length && isOpen && !filtering) toggle(cur.key, false)
        else if (cur.parentKey) focusRow(cur.parentKey)
        break
      case 'Home':
        if (visible[0]) focusRow(visible[0].key)
        break
      case 'End':
        if (visible.length) focusRow(visible[visible.length - 1].key)
        break
      case 'Enter':
        open(cur)
        break
      case ' ': {
        const next = new Set(selected)
        if (next.has(cur.key)) next.delete(cur.key)
        else next.add(cur.key)
        setSelected(next)
        break
      }
      case 'F2':
        setRenaming(cur.key)
        break
      case 'Delete':
        void remove(selected.size > 1 && selected.has(cur.key) ? selectedNodes() : [cur])
        break
      case 'ContextMenu':
      case 'F10': {
        if (e.key === 'F10' && !e.shiftKey) return
        const r = (e.target as HTMLElement).getBoundingClientRect()
        openMenu(cur, r.left + 24, r.bottom)
        break
      }
      case 'Escape':
        setSelected(new Set())
        break
      default:
        return
    }
    e.preventDefault()
  }

  const selectedNodes = () => [...selected].map((k) => index.byKey.get(k)).filter((n): n is ExplorerNode => Boolean(n))

  // ── Arrastar e soltar (mouse). No celular, use "Mover para…".
  const dragged = () => {
    const src = drag ? index.byKey.get(drag) : undefined
    if (!src) return []
    return selected.has(src.key) && selected.size > 1 ? selectedNodes() : [src]
  }
  const positionFor = (e: React.DragEvent, n: ExplorerNode): DropPosition => {
    const r = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    if (n.type === 'topic' && !n.container) return y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside'
    return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside'
  }
  const onDrop = async (target: ExplorerNode | null, pos: DropPosition) => {
    const sources = dragged()
    setDrag(null)
    setDrop(null)
    if (!sources.length) return
    const bad = sources.map((s) => canDrop(index, s, target, pos)).find((r) => !r.ok)
    if (bad && !bad.ok) return toast.info(bad.reason)
    try {
      await op(async (b) => {
        let ix = index
        for (const s of sources) {
          await moveNode(b, ix, ix.byKey.get(s.key)!, target ? ix.byKey.get(target.key)! : null, pos)
          ix = await loadIndex(b)
        }
      })
      if (target && pos === 'inside') toggle(target.key, true)
    } catch (e) {
      toast.error(e)
    }
  }

  const allContainers = useMemo(() => [...index.byKey.values()].filter((n) => n.children.length).map((n) => n.key), [index])
  const bulk = selected.size > 1 ? selectedNodes() : []

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar em tudo" aria-label="Pesquisar no Explorador" className="h-9 pl-8" />
            {term && (
              <button className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-ink" onClick={() => setTerm('')} aria-label="Limpar pesquisa">
                <X className="size-4" />
              </button>
            )}
          </div>
          <IconButton
            label="Criar"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              openMenu(null, r.left, r.bottom + 4)
            }}
          >
            <Plus className="size-4" />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)} icon={<Star className="size-3.5" />}>
            Favoritos
          </FilterChip>
          <FilterChip active={showArchived} onClick={() => setShowArchived((v) => !v)} icon={<Archive className="size-3.5" />}>
            Arquivados
          </FilterChip>
          <div className="flex-1" />
          <IconButton size="sm" label="Expandir tudo" onClick={() => expandAll(allContainers, true)}>
            <ChevronsUpDown className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Recolher tudo" onClick={() => expandAll(allContainers, false)}>
            <ChevronsDownUp className="size-4" />
          </IconButton>
        </div>
      </div>

      {bulk.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-accent/20 px-3 py-2 text-sm" role="toolbar" aria-label="Ações em lote">
          <span className="mr-auto font-medium text-ink">{bulk.length} selecionados</span>
          <IconButton size="sm" label="Mover selecionados" onClick={() => move(bulk)}>
            <FolderInput className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Favoritar selecionados" onClick={() => void favorite(bulk, !bulk.every((n) => n.favorite))}>
            <Star className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Arquivar selecionados" onClick={() => void archive(bulk, true)} disabled={bulk.every((n) => n.type === 'topic')}>
            <Archive className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Excluir selecionados" onClick={() => void remove(bulk)}>
            <Trash2 className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Limpar seleção" onClick={() => setSelected(new Set())}>
            <X className="size-4" />
          </IconButton>
        </div>
      )}

      <div
        className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            openMenu(null, e.clientX, e.clientY)
          }
        }}
      >
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">
            {filtering ? 'Nada encontrado.' : 'Nada por aqui ainda.'}
            {!filtering && (
              <Button size="sm" className="mx-auto mt-3" icon={<Plus className="size-4" />} onClick={(e) => openMenu(null, e.clientX, e.clientY)}>
                Criar
              </Button>
            )}
          </div>
        ) : (
          <ul ref={listRef} role="tree" aria-label="Explorador de estudos" aria-multiselectable onKeyDown={onKeyDown}>
            {visible.map((n) => (
              <TreeRow
                key={n.key}
                node={n}
                active={n.key === activeKey}
                focused={n.key === (focused ?? visible[0]?.key)}
                selected={selected.has(n.key)}
                expanded={filtering || expanded.has(n.key)}
                metric={n.type === 'folder' ? null : display(n)}
                renaming={renaming === n.key}
                drop={drop?.key === n.key ? drop : null}
                dragging={drag === n.key}
                onToggle={() => toggle(n.key)}
                onClick={(e) => onRowClick(e, n)}
                onMenu={(x, y) => {
                  if (!selected.has(n.key)) setSelected(new Set([n.key]))
                  setFocused(n.key)
                  openMenu(n, x, y)
                }}
                onRename={async (name) => {
                  setRenaming(null)
                  if (name.trim() && name.trim() !== n.name) await rename(n, name)
                  focusRow(n.key)
                }}
                onDragStart={() => setDrag(n.key)}
                onDragEnd={() => (setDrag(null), setDrop(null))}
                onDragOver={(e) => {
                  if (!drag) return
                  const pos = positionFor(e, n)
                  const ok = dragged().every((s) => canDrop(index, s, n, pos).ok)
                  e.preventDefault()
                  e.dataTransfer.dropEffect = ok ? 'move' : 'none'
                  setDrop({ key: n.key, pos, ok })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void onDrop(n, positionFor(e, n))
                }}
              />
            ))}
          </ul>
        )}
        {drag && (
          <div
            className={cn('mx-3 my-2 rounded-lg border border-dashed p-3 text-center text-xs', drop?.key === 'root' ? (drop.ok ? 'border-accent-strong bg-accent/20 text-ink' : 'border-danger text-danger') : 'border-line text-muted')}
            onDragOver={(e) => {
              const ok = dragged().every((s) => canDrop(index, s, null, 'inside').ok)
              e.preventDefault()
              setDrop({ key: 'root', pos: 'inside', ok })
            }}
            onDrop={(e) => {
              e.preventDefault()
              void onDrop(null, 'inside')
            }}
          >
            Soltar aqui para mover para a raiz
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium', active ? 'border-accent-strong bg-accent/30 text-ink' : 'border-line text-muted hover:text-ink')}
    >
      {icon}
      {children}
    </button>
  )
}

interface RowProps {
  node: ExplorerNode
  active: boolean
  focused: boolean
  selected: boolean
  expanded: boolean
  metric?: { text: string; aria: string } | null
  renaming: boolean
  drop: { pos: DropPosition; ok: boolean } | null
  dragging: boolean
  onToggle: () => void
  onClick: (e: MouseEvent) => void
  onMenu: (x: number, y: number) => void
  onRename: (name: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function TreeRow({ node: n, active, focused, selected, expanded, metric, renaming, drop, dragging, onToggle, onClick, onMenu, onRename, onDragStart, onDragEnd, onDragOver, onDrop }: RowProps) {
  const longPress = useLongPress(onMenu)
  const hasChildren = n.children.length > 0
  return (
    <li
      role="treeitem"
      data-key={n.key}
      tabIndex={focused ? 0 : -1}
      aria-level={n.depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      aria-current={active ? 'page' : undefined}
      aria-label={`${typeLabel(n)}: ${n.name}`}
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', n.name)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(e.clientX, e.clientY)
      }}
      {...longPress}
      className={cn(
        'group relative mx-1.5 flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1.5 text-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-accent-strong',
        active ? 'bg-accent/35 text-ink' : selected ? 'bg-accent/20 text-ink' : 'text-ink hover:bg-surface-2',
        dragging && 'opacity-50',
        drop?.pos === 'inside' && (drop.ok ? 'bg-accent/30 ring-1 ring-accent-strong' : 'ring-1 ring-danger'),
        drop?.pos === 'before' && (drop.ok ? 'shadow-[inset_0_2px_0_var(--accent-strong)]' : 'shadow-[inset_0_2px_0_var(--danger)]'),
        drop?.pos === 'after' && (drop.ok ? 'shadow-[inset_0_-2px_0_var(--accent-strong)]' : 'shadow-[inset_0_-2px_0_var(--danger)]'),
        n.archived && 'opacity-60',
      )}
      style={{ paddingLeft: 4 + Math.min(n.depth, 12) * 14 }}
      onClick={onClick}
    >
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted hover:text-ink"
          aria-label={expanded ? `Recolher ${n.name}` : `Expandir ${n.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <NodeIcon node={n} open={expanded && hasChildren} />
      {renaming ? (
        <RenameInput initial={n.name} onDone={onRename} />
      ) : (
        <span className={cn('min-w-0 flex-1 truncate py-0.5', n.type !== 'topic' && 'font-medium', n.topic?.status === 'completed' && 'text-muted')}>{n.name}</span>
      )}
      {n.favorite && !renaming && <Star className="size-3 shrink-0 fill-current text-accent-strong" aria-label="Favorito" />}
      {metric && !renaming && (
        <span className="tabular shrink-0 text-[11px] text-muted" aria-label={metric.aria} title={metric.aria}>
          {metric.text}
        </span>
      )}
    </li>
  )
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [v, setV] = useState(initial)
  const done = useRef(false)
  const finish = (name: string) => {
    if (done.current) return
    done.current = true
    onDone(name)
  }
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(v)
        if (e.key === 'Escape') finish(initial)
      }}
      onBlur={() => finish(v)}
      aria-label="Novo nome"
      className="h-7 min-w-0 flex-1 rounded border border-accent-strong bg-bg px-1.5 text-sm text-ink outline-none"
    />
  )
}
