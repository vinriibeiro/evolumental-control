import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Circle, Download, FileText, GitBranchPlus, Maximize, Pencil, Plus, Redo2, Settings2, Trash2, Undo2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { useRow, useUpdate } from '@/hooks/data'
import { useDebounced } from '@/hooks/useDebounced'
import { cn } from '@/lib/cn'
import type { MindMap, MindMapData } from '@/types/db'
import { MapForm } from './MindMapsPage'

type NodeData = MindMapData['nodes'][number]['data'] & { editing?: boolean; onCommit?: (id: string, label: string) => void }
type MindNode = Node<NodeData, 'mind'>

const NODE_COLORS = ['#3B2B20', '#DEB887', '#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#6250D6', '#E34948', '#6B6259']
const SIZES = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base font-semibold' }

function textOn(hex: string) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? '#3B2B20' : '#FFFFFF'
}

const MindNodeView = memo(function MindNodeView({ id, data, selected }: NodeProps<MindNode>) {
  const [draft, setDraft] = useState(data.label)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setDraft(data.label), [data.label])
  useEffect(() => {
    if (!data.editing) return
    // O React Flow devolve o foco ao nó selecionado; foca o campo logo depois.
    const t = window.setTimeout(() => {
      ref.current?.focus()
      ref.current?.select()
    }, 30)
    return () => window.clearTimeout(t)
  }, [data.editing])
  const color = data.color ?? '#DEB887'
  const shape = data.shape === 'pill' ? 'rounded-full' : data.shape === 'rect' ? 'rounded-sm' : 'rounded-xl'
  return (
    <div
      className={cn('max-w-72 min-w-16 border-2 text-center shadow-sm', shape, SIZES[data.size ?? 'md'], selected ? 'ring-2 ring-offset-2 ring-[var(--accent-strong)]' : '')}
      style={{ background: color, borderColor: color, color: textOn(color) }}
    >
      {(['top', 'right', 'bottom', 'left'] as const).map((p) => (
        <Handle key={p} id={p} type="source" position={Position[(p[0].toUpperCase() + p.slice(1)) as keyof typeof Position]} className="!size-2 !border-0 !bg-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100" />
      ))}
      {data.editing ? (
        <textarea
          ref={ref}
          value={draft}
          rows={Math.min(6, Math.max(1, draft.split('\n').length))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => data.onCommit?.(id, draft)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              data.onCommit?.(id, draft)
            }
            if (e.key === 'Escape') {
              setDraft(data.label)
              data.onCommit?.(id, data.label)
            }
          }}
          className="nodrag nopan nowheel w-full resize-none bg-transparent text-center outline-none"
          aria-label="Texto do nó"
          maxLength={500}
        />
      ) : (
        <span className="block break-words whitespace-pre-wrap">{data.label || '…'}</span>
      )}
    </div>
  )
})

const nodeTypes = { mind: MindNodeView }

export default function MindMapEditorPage() {
  const { id = '' } = useParams()
  const map = useRow('mind_maps', id)
  if (map.isPending) return <Spinner />
  if (map.isError) return <ErrorState error={map.error} onRetry={() => map.refetch()} />
  if (!map.data) return <EmptyState title="Mapa não encontrado" action={<Link to="/mapas" className="text-sm underline">Voltar</Link>} />
  return (
    <ReactFlowProvider>
      <Editor map={map.data} key={map.data.id} />
    </ReactFlowProvider>
  )
}

interface Snapshot {
  nodes: MindNode[]
  edges: Edge[]
}

function clean(nodes: MindNode[]): MindMapData['nodes'] {
  return nodes.map((n) => ({
    id: n.id,
    type: 'mind',
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: { label: n.data.label, color: n.data.color, size: n.data.size, shape: n.data.shape },
  }))
}

function Editor({ map }: { map: MindMap }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNode>(map.data.nodes.map((n) => ({ ...n, type: 'mind', data: { ...n.data } })) as MindNode[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(map.data.edges.map((e) => ({ ...e, type: 'smoothstep' })))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [version, setVersion] = useState(0)
  const flow = useReactFlow<MindNode, Edge>()
  const update = useUpdate('mind_maps')
  const toast = useToast()
  const wrapper = useRef<HTMLDivElement>(null)
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const latest = useRef<Snapshot>({ nodes, edges })
  latest.current = { nodes, edges }

  const selected = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)

  // ---- Histórico (desfazer/refazer) -----------------------------------
  const checkpoint = useCallback(() => {
    past.current.push(structuredClone({ nodes: latest.current.nodes.map((n) => ({ ...n, data: { ...n.data, onCommit: undefined } })), edges: latest.current.edges }))
    if (past.current.length > 100) past.current.shift()
    future.current = []
  }, [])
  const markDirty = useCallback(() => {
    setSaveState('dirty')
    setVersion((v) => v + 1)
  }, [])
  const restore = (s: Snapshot) => {
    setNodes(s.nodes)
    setEdges(s.edges)
    markDirty()
  }
  const undo = () => {
    const s = past.current.pop()
    if (!s) return
    future.current.push(structuredClone({ nodes: latest.current.nodes.map((n) => ({ ...n, data: { ...n.data, onCommit: undefined } })), edges: latest.current.edges }))
    restore(s)
  }
  const redo = () => {
    const s = future.current.pop()
    if (!s) return
    past.current.push(structuredClone({ nodes: latest.current.nodes.map((n) => ({ ...n, data: { ...n.data, onCommit: undefined } })), edges: latest.current.edges }))
    restore(s)
  }

  // ---- Salvamento automático ------------------------------------------
  const debouncedVersion = useDebounced(version, 600)
  const save = useCallback(async () => {
    const vp = flow.getViewport()
    const data: MindMapData = { nodes: clean(latest.current.nodes), edges: latest.current.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })), viewport: vp }
    setSaveState('saving')
    try {
      await update.mutateAsync({ id: map.id, patch: { data } })
      setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      toast.error(e)
    }
  }, [flow, map.id, update, toast])
  const savedVersion = useRef(0)
  const versionRef = useRef(version)
  versionRef.current = version
  const flush = useCallback(() => {
    if (versionRef.current === savedVersion.current) return
    savedVersion.current = versionRef.current
    void save()
  }, [save])
  useEffect(() => {
    if (debouncedVersion > 0) flush()
  }, [debouncedVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  // Salva imediatamente ao trocar de aba, fechar/recarregar a página ou sair do editor.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveState])

  // ---- Edição ---------------------------------------------------------
  const commitLabel = useCallback(
    (nid: string, label: string) => {
      setEditingId(null)
      const next = label.trim() || 'Sem título'
      const cur = latest.current.nodes.find((n) => n.id === nid)
      if (!cur || cur.data.label === next) return
      checkpoint()
      setNodes((ns) => ns.map((n) => (n.id === nid ? { ...n, data: { ...n.data, label: next } } : n)))
      markDirty()
    },
    [setNodes, checkpoint, markDirty],
  )

  const renderNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, editing: n.id === editingId, onCommit: commitLabel } })), [nodes, editingId, commitLabel])

  const addNode = (parent: MindNode | null, sibling = false) => {
    checkpoint()
    const base = sibling && parent ? (edges.find((e) => e.target === parent.id) ? nodes.find((n) => n.id === edges.find((e) => e.target === parent.id)!.source) : null) : parent
    const anchor = base ?? parent
    const children = anchor ? edges.filter((e) => e.source === anchor.id).length : 0
    const pos = anchor
      ? { x: anchor.position.x + 240, y: anchor.position.y + (children - 1) * 70 + (sibling && parent ? 70 : 0) }
      : (() => {
          const rect = wrapper.current?.getBoundingClientRect()
          return flow.screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2 })
        })()
    const nid = crypto.randomUUID()
    const color = anchor?.data.color && anchor.id !== 'root' ? anchor.data.color : NODE_COLORS[(nodes.length % (NODE_COLORS.length - 2)) + 1]
    const node: MindNode = { id: nid, type: 'mind', position: pos, data: { label: 'Nova ideia', color, size: 'md', shape: 'rounded' }, selected: true }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node])
    if (anchor) setEdges((es) => [...es, { id: crypto.randomUUID(), source: anchor.id, target: nid, type: 'smoothstep' }])
    setEditingId(nid)
    markDirty()
  }

  const removeSelected = () => {
    if (!selected.length && !selectedEdges.length) return
    checkpoint()
    const ids = new Set(selected.map((n) => n.id))
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)))
    setEdges((es) => es.filter((e) => !e.selected && !ids.has(e.source) && !ids.has(e.target)))
    markDirty()
  }

  const styleSelected = (patch: Partial<NodeData>) => {
    if (!selected.length) return
    checkpoint()
    const ids = new Set(selected.map((n) => n.id))
    setNodes((ns) => ns.map((n) => (ids.has(n.id) ? { ...n, data: { ...n.data, ...patch } } : n)))
    markDirty()
  }

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) return
      checkpoint()
      setEdges((es) => addEdge({ ...c, id: crypto.randomUUID(), type: 'smoothstep' }, es))
      markDirty()
    },
    [setEdges, checkpoint, markDirty],
  )

  // ---- Atalhos de teclado -------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || editingId) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      } else if (e.key === 'Tab' && selected.length === 1) {
        e.preventDefault()
        addNode(selected[0])
      } else if (e.key === 'Enter' && selected.length === 1) {
        e.preventDefault()
        addNode(selected[0], true)
      } else if ((e.key === 'F2' || e.key === ' ') && selected.length === 1) {
        e.preventDefault()
        setEditingId(selected[0].id)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- Exportação -----------------------------------------------------
  const exportImage = async (kind: 'png' | 'pdf') => {
    try {
      const { toPng } = await import('html-to-image')
      const bounds = getNodesBounds(nodes)
      const pad = 40
      const width = Math.min(8000, Math.max(400, Math.ceil(bounds.width + pad * 2)))
      const height = Math.min(8000, Math.max(300, Math.ceil(bounds.height + pad * 2)))
      const vp = getViewportForBounds(bounds, width, height, 0.1, 2, pad)
      const el = wrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!el) throw new Error('Não foi possível capturar o mapa.')
      const bg = getComputedStyle(document.body).backgroundColor
      const dataUrl = await toPng(el, { backgroundColor: bg, width, height, pixelRatio: 2, style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` } })
      const name = map.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'mapa'
      if (kind === 'png') {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `${name}.png`
        a.click()
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'px', format: [width, height] })
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height)
        pdf.save(`${name}.pdf`)
      }
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-var(--app-top,4rem))] flex-col sm:-mx-6 lg:-mx-8">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-3 py-2">
        <Link to="/mapas" className="flex items-center gap-1 text-sm text-muted hover:text-ink" aria-label="Voltar aos mapas">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="max-w-[40vw] truncate text-sm font-semibold text-ink">{map.title}</h2>
        <IconButton size="sm" label="Renomear e organizar" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" />
        </IconButton>
        <span className="text-xs text-muted" aria-live="polite">
          {saveState === 'saved' ? 'Salvo' : saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Erro ao salvar' : 'Alterações pendentes'}
        </span>
        <span className="flex-1" />
        <div className="flex flex-wrap items-center gap-1">
          <IconButton size="sm" label="Adicionar ramificação (Tab)" onClick={() => addNode(selected[0] ?? nodes.find((n) => n.id === 'root') ?? null)}>
            <GitBranchPlus className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Adicionar nó solto" onClick={() => addNode(null)}>
            <Plus className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Editar texto (F2)" disabled={selected.length !== 1} onClick={() => setEditingId(selected[0]?.id ?? null)}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Excluir seleção (Delete)" disabled={!selected.length && !selectedEdges.length} onClick={removeSelected}>
            <Trash2 className="size-4" />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-line" />
          <IconButton size="sm" label="Desfazer (Ctrl+Z)" onClick={undo} disabled={past.current.length === 0}>
            <Undo2 className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Refazer (Ctrl+Y)" onClick={redo} disabled={future.current.length === 0}>
            <Redo2 className="size-4" />
          </IconButton>
          <IconButton size="sm" label="Ajustar à tela" onClick={() => flow.fitView({ padding: 0.2, duration: 300, maxZoom: 1.5 })}>
            <Maximize className="size-4" />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => exportImage('png')}>
            PNG
          </Button>
          <Button size="sm" variant="ghost" icon={<FileText className="size-4" />} onClick={() => exportImage('pdf')}>
            PDF
          </Button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-3 py-2" role="toolbar" aria-label="Estilo do nó">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Cor">
            {NODE_COLORS.map((c) => (
              <button key={c} role="radio" aria-checked={selected.every((n) => n.data.color === c)} aria-label={`Cor ${c}`} onClick={() => styleSelected({ color: c })} className="size-5 rounded-full border border-line" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <Button key={s} size="sm" variant={selected.every((n) => (n.data.size ?? 'md') === s) ? 'primary' : 'ghost'} onClick={() => styleSelected({ size: s })}>
                {s === 'sm' ? 'P' : s === 'md' ? 'M' : 'G'}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs">
            {(['rounded', 'pill', 'rect'] as const).map((s) => (
              <Button key={s} size="sm" variant={selected.every((n) => (n.data.shape ?? 'rounded') === s) ? 'primary' : 'ghost'} onClick={() => styleSelected({ shape: s })} icon={s === 'pill' ? <Circle className="size-3" /> : undefined}>
                {s === 'rounded' ? 'Arredondado' : s === 'pill' ? 'Pílula' : 'Retângulo'}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div ref={wrapper} className="group relative min-h-0 flex-1">
        <ReactFlow<MindNode, Edge>
          nodes={renderNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onNodesChange(changes)
            if (changes.some((c) => c.type === 'remove')) markDirty()
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes)
            if (changes.some((c) => c.type === 'remove')) markDirty()
          }}
          onNodeDragStart={() => checkpoint()}
          onNodeDragStop={() => markDirty()}
          onConnect={onConnect}
          onNodeDoubleClick={(_, n) => setEditingId(n.id)}
          onMoveEnd={() => setVersion((v) => v + 1)}
          connectionMode={ConnectionMode.Loose}
          defaultViewport={map.data.viewport ?? { x: 0, y: 0, zoom: 1 }}
          fitView={!map.data.viewport}
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={24} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data as NodeData).color ?? '#DEB887'} className="!hidden sm:!block" />
        </ReactFlow>
        <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded-full bg-bg/90 px-3 py-1 text-[11px] text-muted shadow-sm md:block">
          Duplo clique edita · Tab: ramificação · Enter: irmão · Delete: excluir · arraste das bordas para conectar
        </p>
      </div>
      <MapForm open={settingsOpen} map={map} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
