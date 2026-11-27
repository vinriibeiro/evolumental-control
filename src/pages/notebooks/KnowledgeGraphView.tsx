import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ExternalLink, GitFork, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Badge, Card, Segmented } from '@/components/ui/layout'
import { EmptyState } from '@/components/ui/feedback'
import { useLookups } from '@/hooks/domain'
import {
  useAllActiveNotebookNodes,
  useAllNotebookPageLinks,
  useNotebookTagLinks,
  useNotebookTags,
  useNotebooks,
} from '@/hooks/useNotebooks'
import { buildKnowledgeGraph, type GraphNode } from '@/lib/notebookGraph'

/**
 * Visualização interativa do Grafo de Conhecimento (carregada sob demanda via React.lazy).
 * Relações estritamente explícitas/registradas — sem inferência por IA.
 */
export default function KnowledgeGraphView() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const lookups = useLookups()

  const notebooksQuery = useNotebooks()
  const nodesQuery = useAllActiveNotebookNodes()
  const linksQuery = useAllNotebookPageLinks()
  const tagsQuery = useNotebookTags()
  const tagLinksQuery = useNotebookTagLinks()

  const [mode, setMode] = useState<'pages' | 'notebooks'>('pages')
  const [filterNotebook, setFilterNotebook] = useState(() => params.get('caderno') ?? '')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const focusNodeId = params.get('foco')

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(focusNodeId)
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  })

  const notebooks = useMemo(() => (notebooksQuery.data ?? []).filter((n) => !n.deleted_at), [notebooksQuery.data])
  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data])
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data])
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const tagLinks = useMemo(() => tagLinksQuery.data ?? [], [tagLinksQuery.data])

  const graph = useMemo(
    () =>
      buildKnowledgeGraph({
        mode,
        notebooks,
        nodes,
        links,
        tagLinks,
        filterNotebookId: filterNotebook || null,
        filterSubjectId: filterSubject || null,
        filterTagId: filterTag || null,
        focusNodeId: mode === 'pages' ? focusNodeId : null,
      }),
    [mode, notebooks, nodes, links, tagLinks, filterNotebook, filterSubject, filterTag, focusNodeId],
  )

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes])
  const activeHighlightId = hoveredId ?? selectedId

  const connectedIds = useMemo(() => {
    if (!activeHighlightId) return null
    const set = new Set<string>([activeHighlightId])
    for (const e of graph.edges) {
      if (e.source === activeHighlightId) set.add(e.target)
      if (e.target === activeHighlightId) set.add(e.source)
    }
    return set
  }, [activeHighlightId, graph.edges])

  const selectedNode: GraphNode | null = selectedId ? (nodeById.get(selectedId) ?? null) : null
  const selectedOutgoing = useMemo(
    () => (selectedNode ? graph.edges.filter((e) => e.source === selectedNode.id).map((e) => nodeById.get(e.target)).filter(Boolean) as GraphNode[] : []),
    [selectedNode, graph.edges, nodeById],
  )
  const selectedIncoming = useMemo(
    () => (selectedNode ? graph.edges.filter((e) => e.target === selectedNode.id).map((e) => nodeById.get(e.source)).filter(Boolean) as GraphNode[] : []),
    [selectedNode, graph.edges, nodeById],
  )

  const openNode = (n: GraphNode) => {
    if (n.kind === 'notebook') navigate(`/cadernos/${n.notebookId}`)
    else navigate(`/cadernos/${n.notebookId}/pagina/${n.id}`)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="space-y-4">
      {/* Controles e filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Granularidade do grafo"
          size="sm"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setSelectedId(null)
          }}
          options={[
            { value: 'pages', label: 'Páginas' },
            { value: 'notebooks', label: 'Cadernos' },
          ]}
        />

        <Select aria-label="Filtrar por caderno" value={filterNotebook} onChange={(e) => setFilterNotebook(e.target.value)} className="h-9 w-auto min-w-[150px] text-xs">
          <option value="">Todos os cadernos</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title}
            </option>
          ))}
        </Select>

        <Select aria-label="Filtrar por matéria" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="h-9 w-auto min-w-[150px] text-xs">
          <option value="">Todas as matérias</option>
          {lookups.subjects
            .filter((s) => s.status !== 'archived')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>

        <Select aria-label="Filtrar por tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="h-9 w-auto min-w-[130px] text-xs">
          <option value="">Todas as tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.name}
            </option>
          ))}
        </Select>

        {focusNodeId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = new URLSearchParams(params)
              next.delete('foco')
              setParams(next, { replace: true })
            }}
          >
            Sair do foco da página
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Diminuir zoom" size="sm" onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}>
            <ZoomOut className="size-4" />
          </IconButton>
          <span className="tabular w-11 text-center text-xs text-muted">{Math.round(zoom * 100)}%</span>
          <IconButton label="Aumentar zoom" size="sm" onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))))}>
            <ZoomIn className="size-4" />
          </IconButton>
          <IconButton label="Centralizar grafo" size="sm" onClick={resetView}>
            <RotateCcw className="size-4" />
          </IconButton>
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={<GitFork className="size-9" />}
          title="Nenhum nó para exibir no grafo"
          description="Crie páginas nos seus cadernos e conecte conceitos usando [[ no editor ou o painel de conexões."
          action={
            <Link to="/cadernos">
              <Button variant="primary">Ir para Meus Cadernos</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="relative h-[520px] overflow-hidden bg-surface-2/40 select-none">
            <svg
              role="img"
              aria-label={`Grafo de conhecimento com ${graph.nodes.length} nós e ${graph.edges.length} conexões`}
              className="size-full cursor-grab active:cursor-grabbing"
              viewBox="-420 -280 840 560"
              onWheel={(e) => {
                e.preventDefault()
                const delta = e.deltaY > 0 ? -0.1 : 0.1
                setZoom((z) => Math.min(2.4, Math.max(0.4, Number((z + delta).toFixed(2)))))
              }}
              onPointerDown={(e) => {
                if ((e.target as Element).closest('[data-graph-node="true"]')) return
                dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y }
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return
                setPan({
                  x: dragRef.current.origX + (e.clientX - dragRef.current.startX) / zoom,
                  y: dragRef.current.origY + (e.clientY - dragRef.current.startY) / zoom,
                })
              }}
              onPointerUp={() => {
                dragRef.current.active = false
              }}
              onPointerLeave={() => {
                dragRef.current.active = false
              }}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {/* Arestas */}
                {graph.edges.map((edge) => {
                  const s = nodeById.get(edge.source)
                  const t = nodeById.get(edge.target)
                  if (!s || !t) return null
                  const isHighlighted =
                    !activeHighlightId || edge.source === activeHighlightId || edge.target === activeHighlightId
                  return (
                    <line
                      key={edge.id}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={activeHighlightId && isHighlighted ? 'var(--accent)' : 'var(--border)'}
                      strokeWidth={activeHighlightId && isHighlighted ? 2.2 : Math.min(3, 1 + edge.weight * 0.4)}
                      opacity={isHighlighted ? 0.95 : 0.2}
                    />
                  )
                })}

                {/* Nós */}
                {graph.nodes.map((n) => {
                  const isSelected = selectedId === n.id
                  const isConnected = !connectedIds || connectedIds.has(n.id)
                  const radius = Math.min(18, 7 + n.degree * 1.6)
                  return (
                    <g
                      key={n.id}
                      data-graph-node="true"
                      transform={`translate(${n.x} ${n.y})`}
                      className="cursor-pointer"
                      opacity={isConnected ? 1 : 0.22}
                      onMouseEnter={() => setHoveredId(n.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSelectedId(n.id)}
                      onDoubleClick={() => openNode(n)}
                    >
                      <circle
                        r={radius}
                        fill={isSelected ? 'var(--accent)' : n.color}
                        stroke="var(--bg)"
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <text
                        y={radius + 14}
                        textAnchor="middle"
                        className="fill-[var(--ink)] text-[11px] font-medium"
                        style={{ pointerEvents: 'none' }}
                      >
                        {n.label.length > 26 ? `${n.label.slice(0, 24)}…` : n.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2 text-[11px] text-muted">
              <Badge>{graph.nodes.length} nó(s)</Badge>
              <Badge>{graph.edges.length} conexão(ões)</Badge>
            </div>
          </Card>

          {/* Inspetor lateral do nó selecionado */}
          <Card className="flex flex-col gap-4 p-4 text-xs">
            {!selectedNode ? (
              <div className="space-y-2 text-muted">
                <p className="font-semibold text-ink">Como explorar o grafo</p>
                <p>Arraste o fundo para mover (pan), use a roda do mouse ou os botões para zoom e clique em qualquer nó para inspecionar conexões.</p>
                <p>Clique duas vezes em um nó (ou use o botão abrir) para navegar diretamente para a página ou caderno.</p>
              </div>
            ) : (
              <>
                <div>
                  <Badge className="mb-1.5">{selectedNode.kind === 'notebook' ? 'Caderno' : selectedNode.notebookTitle}</Badge>
                  <h3 className="text-sm font-semibold text-ink">{selectedNode.label}</h3>
                  <p className="mt-1 text-muted">
                    {selectedNode.inDegree} backlink(s) · {selectedNode.outDegree} link(s) enviado(s)
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="primary" className="flex-1 text-xs" icon={<ExternalLink className="size-3.5" />} onClick={() => openNode(selectedNode)}>
                    Abrir {selectedNode.kind === 'notebook' ? 'caderno' : 'página'}
                  </Button>
                  {selectedNode.kind === 'page' && focusNodeId !== selectedNode.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs"
                      icon={<Maximize2 className="size-3.5" />}
                      onClick={() => {
                        const next = new URLSearchParams(params)
                        next.set('foco', selectedNode.id)
                        setParams(next, { replace: true })
                      }}
                    >
                      Focar
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5 border-t border-line pt-3">
                  <p className="font-semibold text-ink">Backlinks ({selectedIncoming.length})</p>
                  {selectedIncoming.length === 0 ? (
                    <p className="text-muted">Nenhuma página aponta para este nó.</p>
                  ) : (
                    <ul className="space-y-1">
                      {selectedIncoming.map((n) => (
                        <li key={n.id}>
                          <button type="button" onClick={() => setSelectedId(n.id)} className="w-full truncate text-left text-ink hover:text-accent hover:underline">
                            ← {n.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5 border-t border-line pt-3">
                  <p className="font-semibold text-ink">Links enviados ({selectedOutgoing.length})</p>
                  {selectedOutgoing.length === 0 ? (
                    <p className="text-muted">Nenhum link partindo deste nó.</p>
                  ) : (
                    <ul className="space-y-1">
                      {selectedOutgoing.map((n) => (
                        <li key={n.id}>
                          <button type="button" onClick={() => setSelectedId(n.id)} className="w-full truncate text-left text-ink hover:text-accent hover:underline">
                            → {n.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
