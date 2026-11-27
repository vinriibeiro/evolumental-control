import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Flag,
  Folder,
  FolderInput,
  FolderPlus,
  History,
  Layers,
  LayoutTemplate,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  Play,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Badge, Card } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, useToast } from '@/components/ui/feedback'
import { SortableItem, SortableList } from '@/components/Sortable'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { useAll } from '@/hooks/data'
import { useLookups, useTopics } from '@/hooks/domain'
import {
  useAllActiveNotebookNodes,
  useAllNotebookPageLinks,
  useNotebook,
  useNotebookFlashcardLinks,
  useNotebookKnowledgeMutations,
  useNotebookNodeMutations,
  useNotebookNodes,
  useNotebooks,
  useNotebookTagLinks,
  usePageContent,
} from '@/hooks/useNotebooks'
import { inList } from '@/lib/data/types'
import { CARD_STATUS_LABELS } from '@/lib/labels'
import { clearLocalDraft, loadLocalDraft, saveLocalDraft, type LocalPageDraft } from '@/lib/notebookDrafts'
import { buildInternalPageHref, findRelatedPages } from '@/lib/notebookGraph'
import { extractHeadings, type DocHeading } from '@/lib/notebookMarkdown'
import { BUILTIN_TEMPLATES } from '@/lib/notebookTemplates'
import {
  buildNotebookTree,
  EMPTY_DOC,
  extractActiveReviewMetrics,
  extractDocImages,
  extractDocSummary,
  nodeBreadcrumb,
  PAGE_STATUS_LABELS,
  PAGE_STATUS_OPTIONS,
  type NotebookTreeNode,
} from '@/lib/notebooks'
import { RevisionConflictError } from '@/services/notebooks'
import { cn } from '@/lib/cn'
import type { ActivityType, Flashcard, NotebookContentDoc, NotebookNode, NotebookNodeType, NotebookPageContent, NotebookPageLink, NotebookPageStatus } from '@/types/db'
import { CreateFlashcardFromNoteModal } from './CreateFlashcardFromNoteModal'
import { NotebookExportModal } from './ExportImportModal'
import { MoveNodeModal } from './MoveNodeModal'
import { NotebookFormModal } from './NotebookFormModal'
import { NotebookIcon } from './NotebookIcon'
import { PageTagsBar } from './PageTagsBar'
import { ScheduleNotebookReviewModal } from './ScheduleNotebookReviewModal'
import { TemplatePickerModal } from './TemplatePickerModal'
import { VersionHistoryModal } from './VersionHistoryModal'
import type { LinkablePageOption } from './editor/WikiLinkPopover'

const NotebookRichEditor = lazy(() => import('./editor/NotebookRichEditor'))

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writeBoolPref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* preferência local */
  }
}

export default function NotebookWorkspacePage() {
  const { notebookId, pageId } = useParams<{ notebookId: string; pageId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const lookups = useLookups()
  const study = useStartStudy()

  const notebookQuery = useNotebook(notebookId)
  const nodesQuery = useNotebookNodes(notebookId)
  const allNotebooksQuery = useNotebooks()
  const allActiveNodesQuery = useAllActiveNotebookNodes()
  const cardLinksQuery = useNotebookFlashcardLinks(notebookId)
  const allPageLinksQuery = useAllNotebookPageLinks()
  const tagLinksQuery = useNotebookTagLinks()
  const nodeMut = useNotebookNodeMutations()
  const knowledgeMut = useNotebookKnowledgeMutations()

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [treeSearch, setTreeSearch] = useState('')
  const [rightOpen, setRightOpen] = useState(() => readBoolPref('evl:kb-right-open', true))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [liveHeadings, setLiveHeadings] = useState<DocHeading[]>([])
  const [liveWordCount, setLiveWordCount] = useState(0)
  const [liveRevision, setLiveRevision] = useState(1)
  const [liveDoc, setLiveDoc] = useState<NotebookContentDoc>(EMPTY_DOC)
  const [exportOpen, setExportOpen] = useState(false)
  const [historyTrigger, setHistoryTrigger] = useState(0)
  const [flashcardModal, setFlashcardModal] = useState<{
    open: boolean
    selectedText?: string
    blockId?: string | null
    editingCard?: Flashcard | null
  }>({ open: false })
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [studyActivity, setStudyActivity] = useState<ActivityType>('reading')

  const [editNotebookOpen, setEditNotebookOpen] = useState(false)
  const [movingNode, setMovingNode] = useState<NotebookNode | null>(null)
  const [renamingNode, setRenamingNode] = useState<NotebookNode | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState<{ type: NotebookNodeType; parentId: string | null } | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [createTemplateId, setCreateTemplateId] = useState('blank')
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => writeBoolPref('evl:kb-right-open', rightOpen), [rightOpen])
  useEffect(() => setMobileNavOpen(false), [pageId, notebookId])
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (workspaceRef.current?.requestFullscreen) {
        await workspaceRef.current.requestFullscreen()
      } else {
        setFocusMode((f) => !f)
      }
    } catch {
      setFocusMode((f) => !f)
    }
  }

  const notebook = notebookQuery.data ?? null
  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data])
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const selectedNode = pageId ? (nodesById.get(pageId) ?? null) : null
  const tree = useMemo(() => buildNotebookTree(nodes), [nodes])
  const breadcrumb = useMemo(() => nodeBreadcrumb(nodesById, selectedNode?.id), [nodesById, selectedNode?.id])

  const filteredTree = useMemo(() => {
    const q = treeSearch.trim().toLowerCase()
    if (!q) return tree
    const filterNodes = (list: NotebookTreeNode[]): NotebookTreeNode[] =>
      list.flatMap((n) => {
        const kids = filterNodes(n.children)
        if (n.title.toLowerCase().includes(q) || kids.length > 0) return [{ ...n, children: kids }]
        return []
      })
    return filterNodes(tree)
  }, [tree, treeSearch])

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpandableIds = useMemo(
    () => nodes.filter((n) => n.node_type === 'section' || nodes.some((c) => c.parent_id === n.id)).map((n) => n.id),
    [nodes],
  )
  const allCollapsed = allExpandableIds.length > 0 && allExpandableIds.every((id) => collapsed.has(id))

  const handleCreateNode = async () => {
    if (!notebook || !creating) return
    const title = createTitle.trim()
    if (!title) return
    try {
      const tpl = creating.type === 'page' ? BUILTIN_TEMPLATES.find((t) => t.id === createTemplateId) : null
      const created = await nodeMut.create.mutateAsync({
        notebook_id: notebook.id,
        parent_id: creating.parentId,
        node_type: creating.type,
        title,
        subject_id: notebook.subject_id,
        initialDoc: tpl ? tpl.build() : undefined,
      })
      setCreating(null)
      setCreateTitle('')
      setCreateTemplateId('blank')
      if (creating.parentId) {
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(creating.parentId!)
          return next
        })
      }
      toast.success(creating.type === 'section' ? 'Seção criada.' : 'Página criada.')
      navigate(`/cadernos/${notebook.id}/pagina/${created.id}`)
    } catch (e) {
      toast.error(e)
    }
  }

  const handleRenameSubmit = async () => {
    if (!renamingNode) return
    const nextTitle = renameValue.trim()
    if (!nextTitle) return
    try {
      await nodeMut.update.mutateAsync({ id: renamingNode.id, patch: { title: nextTitle } })
      setRenamingNode(null)
      toast.success('Renomeado.')
    } catch (e) {
      toast.error(e)
    }
  }

  const handleDuplicate = async (node: NotebookNode) => {
    if (!notebook) return
    try {
      const res = await nodeMut.duplicate.mutateAsync({ allNodes: nodes, node })
      toast.success(res.count > 1 ? `Estrutura duplicada (${res.count} itens).` : 'Página duplicada.')
      navigate(`/cadernos/${notebook.id}/pagina/${res.rootId}`)
    } catch (e) {
      toast.error(e)
    }
  }

  const handleTrash = async (node: NotebookNode) => {
    if (!notebook) return
    try {
      const count = await nodeMut.trash.mutateAsync({ allNodes: nodes, nodeId: node.id })
      toast.success(count > 1 ? `${count} itens enviados para a lixeira.` : 'Enviado para a lixeira.')
      if (selectedNode?.id === node.id) navigate(`/cadernos/${notebook.id}`, { replace: true })
    } catch (e) {
      toast.error(e)
    }
  }

  const handleReorderSiblings = (siblings: NotebookTreeNode[]) => {
    nodeMut.reorder.mutate(
      siblings.map((s) => s.id),
      { onError: toast.error },
    )
  }

  const scrollToBlock = useCallback((blockId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`)
    if (!el) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('kb-block-flash')
    setTimeout(() => el.classList.remove('kb-block-flash'), 1400)
    return true
  }, [])

  // Navegação direta para um bloco específico (?bloco=<blockId>), ex.: vindo de "Ver anotação de origem" em Flashcards
  const targetBlockParam = searchParams.get('bloco')
  useEffect(() => {
    if (!targetBlockParam || !selectedNode) return
    let attempts = 0
    const timer = setInterval(() => {
      attempts++
      if (scrollToBlock(targetBlockParam) || attempts >= 15) {
        clearInterval(timer)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('bloco')
          return next
        }, { replace: true })
      }
    }, 180)
    return () => clearInterval(timer)
  }, [targetBlockParam, selectedNode, scrollToBlock, setSearchParams])

  const pageCardLinks = useMemo(
    () => (cardLinksQuery.data ?? []).filter((l) => selectedNode && l.node_id === selectedNode.id),
    [cardLinksQuery.data, selectedNode],
  )
  const pageCardIds = useMemo(() => pageCardLinks.map((l) => l.flashcard_id), [pageCardLinks])
  const pageCardsQuery = useAll(
    'flashcards',
    { filters: [inList('id', pageCardIds)] },
    { enabled: pageCardIds.length > 0 },
  )

  const allNotebooks = useMemo(() => allNotebooksQuery.data ?? [], [allNotebooksQuery.data])
  const allNotebookById = useMemo(() => new Map(allNotebooks.map((n) => [n.id, n])), [allNotebooks])
  const allActiveNodes = useMemo(() => allActiveNodesQuery.data ?? [], [allActiveNodesQuery.data])
  const allActiveNodesById = useMemo(() => new Map(allActiveNodes.map((n) => [n.id, n])), [allActiveNodes])
  const allPageLinks = useMemo(() => allPageLinksQuery.data ?? [], [allPageLinksQuery.data])
  const allTagLinks = useMemo(() => tagLinksQuery.data ?? [], [tagLinksQuery.data])

  const linkablePages = useMemo<LinkablePageOption[]>(
    () =>
      allActiveNodes
        .filter((n) => n.node_type === 'page' && allNotebookById.has(n.notebook_id))
        .map((n) => ({
          id: n.id,
          notebookId: n.notebook_id,
          notebookTitle: allNotebookById.get(n.notebook_id)?.title ?? 'Caderno',
          title: n.title,
        })),
    [allActiveNodes, allNotebookById],
  )

  const backlinks = useMemo(
    () => (selectedNode ? allPageLinks.filter((l) => l.target_node_id === selectedNode.id) : []),
    [allPageLinks, selectedNode],
  )
  const outgoingLinks = useMemo(
    () => (selectedNode ? allPageLinks.filter((l) => l.source_node_id === selectedNode.id) : []),
    [allPageLinks, selectedNode],
  )
  const relatedPages = useMemo(
    () =>
      selectedNode && selectedNode.node_type === 'page'
        ? findRelatedPages({
            page: selectedNode,
            allNodes: allActiveNodes,
            links: allPageLinks,
            tagLinks: allTagLinks,
            limit: 5,
          })
        : [],
    [selectedNode, allActiveNodes, allPageLinks, allTagLinks],
  )
  const notebookCardCount = (cardLinksQuery.data ?? []).length

  const startStudyHere = (target: { kind: 'notebook' | 'notebook_page'; id: string; label: string; href: string; subjectId: string | null; topicId: string | null }) => {
    void study.start({
      subject_id: target.subjectId,
      topic_id: target.topicId,
      activity_type: studyActivity,
      source: { kind: target.kind, id: target.id, label: target.label, href: target.href },
      after: 'stay',
    })
  }

  if (notebookQuery.isPending || nodesQuery.isPending) {
    return <Spinner label="Abrindo caderno…" />
  }

  if (!notebook || notebook.deleted_at) {
    return (
      <EmptyState
        icon={<BookOpen className="size-9" />}
        title="Caderno não encontrado"
        description="Este caderno pode ter sido movido para a lixeira ou removido."
        action={
          <Link to="/cadernos">
            <Button variant="primary" icon={<ArrowLeft className="size-4" />}>
              Voltar para Meus Cadernos
            </Button>
          </Link>
        }
      />
    )
  }

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Link to="/cadernos" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Meus Cadernos
          </Link>
          <IconButton label="Editar caderno" size="sm" onClick={() => setEditNotebookOpen(true)}>
            <Pencil className="size-3.5" />
          </IconButton>
        </div>
        <Link to={`/cadernos/${notebook.id}`} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-surface-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: notebook.color }}>
            <NotebookIcon name={notebook.icon} className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{notebook.title}</p>
            {notebook.subject_id && <p className="truncate text-[11px] text-muted">{lookups.subjectName(notebook.subject_id)}</p>}
          </div>
        </Link>
        <div className="mt-2.5 flex gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 text-xs"
            icon={<FolderPlus className="size-3.5" />}
            onClick={() => {
              setCreateTitle('')
              setCreating({ type: 'section', parentId: null })
            }}
          >
            Seção
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="flex-1 text-xs"
            icon={<FilePlus2 className="size-3.5" />}
            onClick={() => {
              setCreateTitle('')
              setCreateTemplateId('blank')
              setCreating({ type: 'page', parentId: selectedNode?.node_type === 'section' ? selectedNode.id : null })
            }}
          >
            Página
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
            placeholder="Filtrar árvore…"
            aria-label="Filtrar seções e páginas"
            className="h-8 text-xs"
          />
          {allExpandableIds.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-[11px] text-muted"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allExpandableIds))}
            >
              {allCollapsed ? 'Expandir' : 'Recolher'}
            </Button>
          )}
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-2" role="tree" aria-label={`Estrutura de ${notebook.title}`}>
        {filteredTree.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted">
            {nodes.length === 0 ? 'Caderno vazio. Crie uma seção ou página para começar.' : 'Nenhum item corresponde ao filtro.'}
          </div>
        ) : (
          <TreeBranch
            nodes={filteredTree}
            notebookId={notebook.id}
            selectedId={selectedNode?.id ?? null}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onReorder={handleReorderSiblings}
            onCreateChild={(parentId, type) => {
              setCreateTitle('')
              setCreateTemplateId('blank')
              setCreating({ type, parentId })
            }}
            onRename={(n) => {
              setRenamingNode(n)
              setRenameValue(n.title)
            }}
            onMove={setMovingNode}
            onDuplicate={handleDuplicate}
            onTogglePin={(n) => nodeMut.update.mutate({ id: n.id, patch: { is_pinned: !n.is_pinned } }, { onError: toast.error })}
            onToggleFavorite={(n) => nodeMut.update.mutate({ id: n.id, patch: { is_favorite: !n.is_favorite } }, { onError: toast.error })}
            onTrash={handleTrash}
          />
        )}
      </div>
    </div>
  )

  return (
    <div
      ref={workspaceRef}
      className={cn(
        'flex flex-col bg-bg',
        focusMode ? 'focus-mode min-h-dvh' : '-mx-4 -my-5 min-h-[calc(100dvh-var(--app-top,56px))] sm:-mx-6 sm:-my-6 lg:-mx-8',
      )}
    >
      {/* Barra superior do workspace */}
      <div className="flex items-center justify-between gap-2 border-b border-line bg-bg px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {!focusMode && (
            <IconButton label="Abrir estrutura do caderno" size="sm" className="lg:hidden" onClick={() => setMobileNavOpen(true)}>
              <PanelLeft className="size-4" />
            </IconButton>
          )}
          <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1 text-xs text-muted">
            <Link to="/cadernos" className="hidden hover:text-ink sm:inline">
              Meus Cadernos
            </Link>
            <ChevronRight className="hidden size-3.5 shrink-0 sm:inline" aria-hidden />
            <Link to={`/cadernos/${notebook.id}`} className="truncate font-medium text-ink hover:text-accent">
              {notebook.title}
            </Link>
            {breadcrumb.map((item) => (
              <span key={item.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                <Link
                  to={`/cadernos/${notebook.id}/pagina/${item.id}`}
                  className={cn('truncate hover:text-ink', item.id === selectedNode?.id && 'font-semibold text-ink')}
                >
                  {item.title}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Exportar página ou caderno" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="size-4" />
          </IconButton>
          {selectedNode && (
            <>
              <Button
                size="sm"
                variant={focusMode ? 'dark' : 'ghost'}
                className="hidden h-8 px-2.5 text-xs sm:inline-flex"
                onClick={() => setFocusMode((f) => !f)}
                title="Modo foco (Escape para sair)"
              >
                {focusMode ? 'Sair do foco (Esc)' : 'Modo foco'}
              </Button>
              <IconButton label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} size="sm" onClick={() => void toggleFullscreen()}>
                {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </IconButton>
              <IconButton
                label={selectedNode.is_pinned ? 'Desafixar' : 'Fixar no topo'}
                size="sm"
                onClick={() => nodeMut.update.mutate({ id: selectedNode.id, patch: { is_pinned: !selectedNode.is_pinned } }, { onError: toast.error })}
              >
                <Pin className={cn('size-4', selectedNode.is_pinned ? 'text-accent' : 'text-muted')} />
              </IconButton>
              <IconButton
                label={selectedNode.is_favorite ? 'Remover dos favoritos' : 'Favoritar'}
                size="sm"
                onClick={() => nodeMut.update.mutate({ id: selectedNode.id, patch: { is_favorite: !selectedNode.is_favorite } }, { onError: toast.error })}
              >
                <Star className={cn('size-4', selectedNode.is_favorite ? 'fill-current text-accent' : 'text-muted')} />
              </IconButton>
            </>
          )}
          {!focusMode && (
            <IconButton
              label={rightOpen ? 'Recolher painel de contexto' : 'Abrir painel de contexto'}
              size="sm"
              className="hidden xl:inline-flex"
              onClick={() => setRightOpen((o) => !o)}
            >
              {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </IconButton>
          )}
        </div>
      </div>

      {/* Três áreas no desktop */}
      <div className="flex min-h-0 flex-1">
        {!focusMode && (
          <aside className="hidden w-72 shrink-0 border-r border-line bg-surface-2/40 lg:block" aria-label="Navegação do caderno">
            {sidebarBody}
          </aside>
        )}

        {/* Drawer mobile */}
        {mobileNavOpen && !focusMode && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Estrutura do caderno">
            <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileNavOpen(false)} aria-hidden />
            <aside className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-line bg-bg shadow-xl">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="text-xs font-semibold text-ink">Estrutura</span>
                <IconButton label="Fechar estrutura" size="sm" onClick={() => setMobileNavOpen(false)}>
                  <X className="size-4" />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1">{sidebarBody}</div>
            </aside>
          </div>
        )}

        {/* Área central */}
        <section className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className={cn('mx-auto', focusMode ? 'max-w-3xl' : 'max-w-4xl')}>
            {!selectedNode ? (
              <NotebookOverview
                notebook={notebook}
                nodes={nodes}
                flashcardsCount={notebookCardCount}
                studyPending={study.pending}
                onStudy={() =>
                  startStudyHere({
                    kind: 'notebook',
                    id: notebook.id,
                    label: notebook.title,
                    href: `/cadernos/${notebook.id}`,
                    subjectId: notebook.subject_id,
                    topicId: null,
                  })
                }
                onNewSection={() => {
                  setCreateTitle('')
                  setCreating({ type: 'section', parentId: null })
                }}
                onNewPage={() => {
                  setCreateTitle('')
                  setCreateTemplateId('blank')
                  setCreating({ type: 'page', parentId: null })
                }}
              />
            ) : selectedNode.node_type === 'section' ? (
              <SectionOverview
                notebookId={notebook.id}
                section={selectedNode}
                childrenNodes={nodes.filter((n) => n.parent_id === selectedNode.id)}
                studyPending={study.pending}
                onStudy={() =>
                  startStudyHere({
                    kind: 'notebook_page',
                    id: selectedNode.id,
                    label: `${notebook.title} › ${selectedNode.title}`,
                    href: `/cadernos/${notebook.id}/pagina/${selectedNode.id}`,
                    subjectId: selectedNode.subject_id ?? notebook.subject_id,
                    topicId: selectedNode.topic_id,
                  })
                }
                onScheduleReview={() => setReviewModalOpen(true)}
                onNewSubsection={() => {
                  setCreateTitle('')
                  setCreating({ type: 'section', parentId: selectedNode.id })
                }}
                onNewPage={() => {
                  setCreateTitle('')
                  setCreateTemplateId('blank')
                  setCreating({ type: 'page', parentId: selectedNode.id })
                }}
                onRename={() => {
                  setRenamingNode(selectedNode)
                  setRenameValue(selectedNode.title)
                }}
              />
            ) : (
              <PageEditorSurface
                key={selectedNode.id}
                notebookId={notebook.id}
                page={selectedNode}
                linkablePages={linkablePages}
                onNavigateInternalLink={(href) => navigate(href)}
                openHistorySignal={historyTrigger}
                studyActivity={studyActivity}
                onStudyActivityChange={setStudyActivity}
                studyPending={study.pending}
                onStudy={() =>
                  startStudyHere({
                    kind: 'notebook_page',
                    id: selectedNode.id,
                    label: `${notebook.title} › ${selectedNode.title}`,
                    href: `/cadernos/${notebook.id}/pagina/${selectedNode.id}`,
                    subjectId: selectedNode.subject_id ?? notebook.subject_id,
                    topicId: selectedNode.topic_id,
                  })
                }
                onScheduleReview={() => setReviewModalOpen(true)}
                onCreateFlashcard={(payload) =>
                  setFlashcardModal({ open: true, selectedText: payload.selectedText, blockId: payload.blockId, editingCard: null })
                }
                onMetaChange={(meta) => {
                  setLiveHeadings(meta.headings)
                  setLiveWordCount(meta.wordCount)
                  setLiveRevision(meta.revision)
                  setLiveDoc(meta.doc)
                }}
                onCreatedCopy={(newPageId) => navigate(`/cadernos/${notebook.id}/pagina/${newPageId}`)}
                onDuplicate={() => handleDuplicate(selectedNode)}
                onMove={() => setMovingNode(selectedNode)}
                onTrash={() => handleTrash(selectedNode)}
              />
            )}
          </div>
        </section>

        {/* Área direita — Painel de contexto recolhível */}
        {rightOpen && !focusMode && (
          <aside className="hidden w-72 shrink-0 border-l border-line bg-surface-2/30 p-4 xl:block" aria-label="Painel de contexto">
            <ContextPanel
              notebookId={notebook.id}
              selectedNode={selectedNode}
              headings={liveHeadings}
              wordCount={liveWordCount}
              revision={liveRevision}
              pageCards={pageCardsQuery.data ?? []}
              notebookCardsCount={notebookCardCount}
              backlinks={backlinks}
              outgoingLinks={outgoingLinks}
              relatedPages={relatedPages}
              allActiveNodesById={allActiveNodesById}
              allNotebookById={allNotebookById}
              linkablePages={linkablePages}
              onAddManualLink={(targetNodeId) => {
                if (!selectedNode) return
                knowledgeMut.addLink.mutate(
                  { sourceNodeId: selectedNode.id, targetNodeId },
                  {
                    onSuccess: () => toast.success('Conexão adicionada.'),
                    onError: toast.error,
                  },
                )
              }}
              onRemoveManualLink={(linkId) => {
                knowledgeMut.removeLink.mutate(linkId, {
                  onSuccess: () => toast.info('Conexão removida.'),
                  onError: toast.error,
                })
              }}
              onJumpToBlock={scrollToBlock}
              onOpenHistory={() => setHistoryTrigger((n) => n + 1)}
              onNewFlashcard={() => setFlashcardModal({ open: true, selectedText: '', blockId: null, editingCard: null })}
              onEditFlashcard={(card) => setFlashcardModal({ open: true, editingCard: card })}
              onScheduleReview={() => setReviewModalOpen(true)}
              onMove={selectedNode ? () => setMovingNode(selectedNode) : undefined}
              onDuplicate={selectedNode ? () => handleDuplicate(selectedNode) : undefined}
              onTrash={selectedNode ? () => handleTrash(selectedNode) : undefined}
            />
          </aside>
        )}
      </div>

      {/* Modal criar seção/página (com seletor de template para páginas) */}
      <Modal
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        size="sm"
        title={creating?.type === 'section' ? (creating.parentId ? 'Nova subseção' : 'Nova seção') : creating?.parentId ? 'Nova subpágina' : 'Nova página'}
        footer={
          <>
            <Button onClick={() => setCreating(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreateNode} loading={nodeMut.create.isPending} disabled={!createTitle.trim()}>
              Criar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Título" required>
            {(id) => (
              <Input
                id={id}
                value={createTitle}
                maxLength={300}
                placeholder={creating?.type === 'section' ? 'Ex.: Window Functions' : 'Ex.: RANK vs DENSE_RANK'}
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNode()}
              />
            )}
          </Field>
          {creating?.type === 'page' && (
            <Field label="Template inicial">
              {(id) => (
                <Select id={id} value={createTemplateId} onChange={(e) => setCreateTemplateId(e.target.value)}>
                  {BUILTIN_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
      </Modal>

      {/* Modal renomear */}
      <Modal
        open={Boolean(renamingNode)}
        onClose={() => setRenamingNode(null)}
        size="sm"
        title={`Renomear ${renamingNode?.node_type === 'section' ? 'seção' : 'página'}`}
        footer={
          <>
            <Button onClick={() => setRenamingNode(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleRenameSubmit} loading={nodeMut.update.isPending} disabled={!renameValue.trim()}>
              Salvar
            </Button>
          </>
        }
      >
        <Field label="Novo título" required>
          {(id) => (
            <Input
              id={id}
              value={renameValue}
              maxLength={300}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          )}
        </Field>
      </Modal>

      <MoveNodeModal
        node={movingNode}
        onClose={() => setMovingNode(null)}
        onMoved={(targetNbId) => {
          if (movingNode && targetNbId !== notebook.id) {
            navigate(`/cadernos/${targetNbId}/pagina/${movingNode.id}`)
          }
        }}
      />

      <NotebookFormModal open={editNotebookOpen} onClose={() => setEditNotebookOpen(false)} notebook={notebook} />

      <NotebookExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        notebook={notebook}
        page={selectedNode?.node_type === 'page' ? selectedNode : null}
        pageDoc={selectedNode?.node_type === 'page' ? liveDoc : null}
      />

      {selectedNode && (
        <>
          <CreateFlashcardFromNoteModal
            open={flashcardModal.open}
            onClose={() => setFlashcardModal({ open: false })}
            notebookId={notebook.id}
            notebookTitle={notebook.title}
            nodeId={selectedNode.id}
            pageTitle={selectedNode.title}
            blockId={flashcardModal.blockId}
            selectedText={flashcardModal.selectedText}
            pageImages={selectedNode.node_type === 'page' ? extractDocImages(liveDoc) : []}
            defaultSubjectId={selectedNode.subject_id ?? notebook.subject_id}
            defaultTopicId={selectedNode.topic_id}
            editingCard={flashcardModal.editingCard}
          />
          <ScheduleNotebookReviewModal
            open={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            defaultTitle={selectedNode.title}
            notebookTitle={notebook.title}
            subjectId={selectedNode.subject_id ?? notebook.subject_id}
            topicId={selectedNode.topic_id}
            pageHref={`/cadernos/${notebook.id}/pagina/${selectedNode.id}`}
          />
        </>
      )}
    </div>
  )
}

interface TreeBranchProps {
  nodes: NotebookTreeNode[]
  notebookId: string
  selectedId: string | null
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onReorder: (siblings: NotebookTreeNode[]) => void
  onCreateChild: (parentId: string, type: NotebookNodeType) => void
  onRename: (node: NotebookNode) => void
  onMove: (node: NotebookNode) => void
  onDuplicate: (node: NotebookNode) => void
  onTogglePin: (node: NotebookNode) => void
  onToggleFavorite: (node: NotebookNode) => void
  onTrash: (node: NotebookNode) => void
}

function TreeBranch(props: TreeBranchProps) {
  const { nodes, notebookId, selectedId, collapsed, onToggleCollapse, onReorder } = props
  return (
    <SortableList items={nodes} onReorder={(next) => onReorder(next)}>
      <ul className="space-y-0.5" role="group">
        {nodes.map((node) => {
          const isCollapsed = collapsed.has(node.id)
          const hasChildren = node.children.length > 0
          const isSelected = selectedId === node.id
          return (
            <li key={node.id} role="treeitem" aria-expanded={hasChildren ? !isCollapsed : undefined} aria-selected={isSelected}>
              <SortableItem id={node.id}>
                {(handle) => (
                  <div
                    className={cn(
                      'group flex items-center gap-0.5 rounded-lg pr-1 text-[13px] transition-colors',
                      isSelected ? 'bg-bg font-medium text-ink shadow-xs ring-1 ring-line' : 'text-ink/85 hover:bg-surface-2',
                    )}
                    style={{ paddingLeft: `${node.depth * 14 + 4}px` }}
                  >
                    <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{handle}</span>
                    <button
                      type="button"
                      aria-label={isCollapsed ? `Expandir ${node.title}` : `Recolher ${node.title}`}
                      onClick={() => onToggleCollapse(node.id)}
                      className={cn('flex size-5 shrink-0 items-center justify-center rounded text-muted hover:text-ink', !hasChildren && node.node_type !== 'section' && 'invisible')}
                    >
                      {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                    <Link to={`/cadernos/${notebookId}/pagina/${node.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5">
                      {node.node_type === 'section' ? (
                        <Folder className={cn('size-3.5 shrink-0', isSelected ? 'text-accent' : 'text-muted')} aria-hidden />
                      ) : (
                        <FileText className={cn('size-3.5 shrink-0', isSelected ? 'text-accent' : 'text-muted')} aria-hidden />
                      )}
                      <span className="truncate">{node.title}</span>
                      {node.is_pinned && <Pin className="size-3 shrink-0 text-accent" aria-label="Fixado" />}
                    </Link>
                    <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <ActionMenu label={`Ações de ${node.title}`}>
                        {(close) => (
                          <>
                            <MenuItem
                              icon={<FilePlus2 className="size-4" />}
                              onClick={() => {
                                close()
                                props.onCreateChild(node.id, 'page')
                              }}
                            >
                              {node.node_type === 'section' ? 'Nova página aqui' : 'Nova subpágina'}
                            </MenuItem>
                            <MenuItem
                              icon={<FolderPlus className="size-4" />}
                              onClick={() => {
                                close()
                                props.onCreateChild(node.id, 'section')
                              }}
                            >
                              Nova subseção
                            </MenuItem>
                            <MenuItem
                              icon={<Pencil className="size-4" />}
                              onClick={() => {
                                close()
                                props.onRename(node)
                              }}
                            >
                              Renomear
                            </MenuItem>
                            <MenuItem
                              icon={<FolderInput className="size-4" />}
                              onClick={() => {
                                close()
                                props.onMove(node)
                              }}
                            >
                              Mover para…
                            </MenuItem>
                            <MenuItem
                              icon={<Copy className="size-4" />}
                              onClick={() => {
                                close()
                                props.onDuplicate(node)
                              }}
                            >
                              Duplicar
                            </MenuItem>
                            <MenuItem
                              icon={<Pin className="size-4" />}
                              onClick={() => {
                                close()
                                props.onTogglePin(node)
                              }}
                            >
                              {node.is_pinned ? 'Desafixar' : 'Fixar'}
                            </MenuItem>
                            <MenuItem
                              icon={<Star className="size-4" />}
                              onClick={() => {
                                close()
                                props.onToggleFavorite(node)
                              }}
                            >
                              {node.is_favorite ? 'Remover favorito' : 'Favoritar'}
                            </MenuItem>
                            <MenuItem
                              danger
                              icon={<Trash2 className="size-4" />}
                              onClick={() => {
                                close()
                                props.onTrash(node)
                              }}
                            >
                              Mover para lixeira
                            </MenuItem>
                          </>
                        )}
                      </ActionMenu>
                    </div>
                  </div>
                )}
              </SortableItem>
              {hasChildren && !isCollapsed && <TreeBranch {...props} nodes={node.children} />}
            </li>
          )
        })}
      </ul>
    </SortableList>
  )
}

function NotebookOverview({
  notebook,
  nodes,
  flashcardsCount,
  studyPending,
  onStudy,
  onNewSection,
  onNewPage,
}: {
  notebook: { id: string; title: string; description: string | null; color: string; icon: string | null }
  nodes: NotebookNode[]
  flashcardsCount: number
  studyPending: boolean
  onStudy: () => void
  onNewSection: () => void
  onNewPage: () => void
}) {
  const rootItems = nodes.filter((n) => n.parent_id == null).sort((a, b) => a.position - b.position)
  const pagesCount = nodes.filter((n) => n.node_type === 'page').length
  const sectionsCount = nodes.length - pagesCount
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: notebook.color }}>
            <NotebookIcon name={notebook.icon} className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{notebook.title}</h1>
            {notebook.description && <p className="mt-1 text-sm text-muted">{notebook.description}</p>}
            <p className="mt-2 text-xs text-muted">
              {sectionsCount} seção(ões) · {pagesCount} página(s) · {flashcardsCount} flashcard(s)
            </p>
            <div className="mt-2.5">
              <PageTagsBar notebookId={notebook.id} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Play className="size-4" />} loading={studyPending} onClick={onStudy}>
            Estudar este conteúdo
          </Button>
          {flashcardsCount > 0 && (
            <Link to={`/flashcards/revisar?caderno=${notebook.id}&modo=vencidos`}>
              <Button variant="secondary" size="sm" icon={<Layers className="size-4" />}>
                Revisar flashcards
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="sm" icon={<FolderPlus className="size-4" />} onClick={onNewSection}>
            Nova seção
          </Button>
          <Button variant="primary" size="sm" icon={<FilePlus2 className="size-4" />} onClick={onNewPage}>
            Nova página
          </Button>
        </div>
      </div>

      {rootItems.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-9" />}
          title="Este caderno ainda não tem conteúdo"
          description="Organize por seções e subseções ou comece escrevendo sua primeira página."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" icon={<FolderPlus className="size-4" />} onClick={onNewSection}>
                Criar seção
              </Button>
              <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={onNewPage}>
                Criar página
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {rootItems.map((item) => (
            <Link
              key={item.id}
              to={`/cadernos/${notebook.id}/pagina/${item.id}`}
              className="evl-tool-link flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5"
            >
              {item.node_type === 'section' ? <Folder className="size-4 shrink-0 text-muted" /> : <FileText className="size-4 shrink-0 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <p className="text-xs text-muted">{item.node_type === 'section' ? 'Seção' : PAGE_STATUS_LABELS[item.status]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionOverview({
  notebookId,
  section,
  childrenNodes,
  studyPending,
  onStudy,
  onScheduleReview,
  onNewSubsection,
  onNewPage,
  onRename,
}: {
  notebookId: string
  section: NotebookNode
  childrenNodes: NotebookNode[]
  studyPending: boolean
  onStudy: () => void
  onScheduleReview: () => void
  onNewSubsection: () => void
  onNewPage: () => void
  onRename: () => void
}) {
  const sorted = [...childrenNodes].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, 'pt-BR'))
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink">
            <Folder className="size-5" />
          </span>
          <div>
            <p className="evl-kicker text-muted">Seção</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{section.title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Play className="size-4" />} loading={studyPending} onClick={onStudy}>
            Estudar seção
          </Button>
          <Link to={`/flashcards/revisar?caderno=${notebookId}&secao=${section.id}&modo=vencidos`}>
            <Button size="sm" variant="secondary" icon={<Layers className="size-4" />}>
              Revisar flashcards
            </Button>
          </Link>
          <Button size="sm" variant="ghost" icon={<CalendarClock className="size-4" />} onClick={onScheduleReview}>
            Agendar revisão
          </Button>
          <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={onRename}>
            Renomear
          </Button>
          <Button size="sm" variant="secondary" icon={<FolderPlus className="size-4" />} onClick={onNewSubsection}>
            Nova subseção
          </Button>
          <Button size="sm" variant="primary" icon={<FilePlus2 className="size-4" />} onClick={onNewPage}>
            Nova página
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Folder className="size-8" />}
          title="Seção vazia"
          description="Adicione subseções ou páginas dentro desta seção."
          action={
            <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={onNewPage}>
              Nova página nesta seção
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {sorted.map((child) => (
            <Link
              key={child.id}
              to={`/cadernos/${notebookId}/pagina/${child.id}`}
              className="evl-tool-link flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5"
            >
              {child.node_type === 'section' ? <Folder className="size-4 shrink-0 text-muted" /> : <FileText className="size-4 shrink-0 text-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{child.title}</p>
                <p className="text-xs text-muted">{child.node_type === 'section' ? 'Subseção' : PAGE_STATUS_LABELS[child.status]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function PageEditorSurface({
  notebookId,
  page,
  linkablePages,
  onNavigateInternalLink,
  openHistorySignal,
  studyActivity,
  onStudyActivityChange,
  studyPending,
  onStudy,
  onScheduleReview,
  onCreateFlashcard,
  onMetaChange,
  onCreatedCopy,
  onDuplicate,
  onMove,
  onTrash,
}: {
  notebookId: string
  page: NotebookNode
  linkablePages: LinkablePageOption[]
  onNavigateInternalLink: (href: string) => void
  openHistorySignal: number
  studyActivity: ActivityType
  onStudyActivityChange: (a: ActivityType) => void
  studyPending: boolean
  onStudy: () => void
  onScheduleReview: () => void
  onCreateFlashcard: (payload: { selectedText: string; blockId: string | null }) => void
  onMetaChange: (meta: { headings: DocHeading[]; wordCount: number; revision: number; doc: NotebookContentDoc }) => void
  onCreatedCopy: (newPageId: string) => void
  onDuplicate: () => void
  onMove: () => void
  onTrash: () => void
}) {
  const toast = useToast()
  const lookups = useLookups()
  const subjectTopics = useTopics(page.subject_id)
  const contentQuery = usePageContent(page.id)
  const nodeMut = useNotebookNodeMutations()
  const knowledgeMut = useNotebookKnowledgeMutations()

  const [title, setTitle] = useState(page.title)
  const [doc, setDoc] = useState<NotebookContentDoc>(EMPTY_DOC)
  const [editorResetKey, setEditorResetKey] = useState(0)
  const [loadedRevision, setLoadedRevision] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error' | 'conflict'>('saved')
  const [conflictServer, setConflictServer] = useState<NotebookPageContent | null>(null)
  const [recoverableDraft, setRecoverableDraft] = useState<LocalPageDraft | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [findTerm, setFindTerm] = useState('')

  const initializedForNode = useRef<string | null>(null)
  const latestRef = useRef({ dirty: false, doc: EMPTY_DOC, title: page.title, revision: 1, nodeId: page.id })

  useEffect(() => {
    if (openHistorySignal > 0) setHistoryOpen(true)
  }, [openHistorySignal])

  useEffect(() => {
    setTitle(page.title)
  }, [page.title])

  useEffect(() => {
    if (!contentQuery.data) return
    if (initializedForNode.current !== page.id) {
      initializedForNode.current = page.id
      const serverDoc = contentQuery.data.content_json ?? EMPTY_DOC
      setDoc(serverDoc)
      setLoadedRevision(contentQuery.data.revision)
      setEditorResetKey((k) => k + 1)
      setDirty(false)
      setSaveState('saved')
      setConflictServer(null)

      // Verifica rascunho local de recuperação após fechamento inesperado
      const localDraft = loadLocalDraft(page.id)
      if (localDraft && Date.parse(localDraft.savedAt) > Date.parse(contentQuery.data.updated_at)) {
        setRecoverableDraft(localDraft)
      } else {
        setRecoverableDraft(null)
      }
    }
  }, [contentQuery.data, page.id])

  const summary = useMemo(() => extractDocSummary(doc), [doc])
  const headings = useMemo(() => extractHeadings(doc), [doc])
  const activeMetrics = useMemo(() => extractActiveReviewMetrics(doc), [doc])
  const [qaAllOpen, setQaAllOpen] = useState(false)

  useEffect(() => {
    onMetaChange({ headings, wordCount: summary.wordCount, revision: loadedRevision, doc })
  }, [headings, summary.wordCount, loadedRevision, doc, onMetaChange])

  useEffect(() => {
    latestRef.current = { dirty, doc, title, revision: loadedRevision, nodeId: page.id }
  }, [dirty, doc, title, loadedRevision, page.id])

  const persistContent = useCallback(
    async (forceOverwrite = false) => {
      const { doc: currentDoc, title: currentTitle, revision, nodeId } = latestRef.current
      setSaveState('saving')
      try {
        const saved = await nodeMut.saveContent.mutateAsync({
          nodeId,
          expectedRevision: revision,
          contentJson: currentDoc,
          forceOverwrite,
        })
        setLoadedRevision(saved.revision)
        setDirty(false)
        setConflictServer(null)
        setSaveState('saved')
        clearLocalDraft(nodeId)
        // Sincroniza links internos [[...]] e backlinks no grafo de conhecimento
        void knowledgeMut.syncLinks
          .mutateAsync({ sourceNodeId: nodeId, doc: saved.content_json })
          .catch(() => {})
        // Cria snapshot periódico automático (respeitando intervalo mínimo de 5 min)
        void nodeMut.autoSnapshot.mutateAsync({
          nodeId,
          title: currentTitle,
          contentJson: saved.content_json,
          revision: saved.revision,
        }).catch(() => {})
      } catch (e) {
        if (e instanceof RevisionConflictError) {
          setConflictServer(e.serverContent)
          setSaveState('conflict')
        } else {
          setSaveState('error')
          toast.error(e)
        }
      }
    },
    [nodeMut.saveContent, nodeMut.autoSnapshot, knowledgeMut.syncLinks, toast],
  )

  // Autosave com debounce de 1,4s + rascunho local imediato
  useEffect(() => {
    if (!dirty || saveState === 'conflict') return
    saveLocalDraft({
      nodeId: page.id,
      title,
      contentJson: doc,
      baseRevision: loadedRevision,
      savedAt: new Date().toISOString(),
    })
    const t = setTimeout(() => {
      void persistContent(false)
    }, 1400)
    return () => clearTimeout(t)
  }, [dirty, doc, title, loadedRevision, page.id, saveState, persistContent])

  // Ctrl+S solicita salvamento imediato
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (latestRef.current.dirty) void persistContent(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [persistContent])

  // Flush ao sair da página (nunca descarta o último conteúdo digitado)
  useEffect(() => {
    return () => {
      if (latestRef.current.dirty) {
        void nodeMut.saveContent
          .mutateAsync({
            nodeId: latestRef.current.nodeId,
            expectedRevision: latestRef.current.revision,
            contentJson: latestRef.current.doc,
          })
          .then(() => clearLocalDraft(latestRef.current.nodeId))
          .catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveTitle = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(page.title)
      return
    }
    if (trimmed !== page.title) {
      nodeMut.update.mutate({ id: page.id, patch: { title: trimmed } }, { onError: toast.error })
    }
  }

  const handleSaveConflictAsCopy = async () => {
    try {
      const created = await nodeMut.create.mutateAsync({
        notebook_id: notebookId,
        parent_id: page.parent_id,
        node_type: 'page',
        title: `${title.trim() || page.title} (cópia de conflito)`,
        subject_id: page.subject_id,
        topic_id: page.topic_id,
        initialDoc: doc,
      })
      clearLocalDraft(page.id)
      setDirty(false)
      setConflictServer(null)
      setSaveState('saved')
      toast.success('Cópia salva com suas alterações locais.')
      onCreatedCopy(created.id)
    } catch (e) {
      toast.error(e)
    }
  }

  // Busca dentro da página nos blocos de topo
  const inPageMatches = useMemo(() => {
    const q = findTerm.trim().toLowerCase()
    if (q.length < 2) return []
    const hits: Array<{ blockId: string; excerpt: string }> = []
    for (const block of doc.content ?? []) {
      const blockId = typeof block.attrs?.blockId === 'string' ? block.attrs.blockId : ''
      if (!blockId) continue
      const blockText = extractDocSummary({ type: 'doc', content: [block] }).text
      const idx = blockText.toLowerCase().indexOf(q)
      if (idx >= 0) {
        const start = Math.max(0, idx - 30)
        hits.push({ blockId, excerpt: `${start > 0 ? '…' : ''}${blockText.slice(start, start + 100)}` })
      }
    }
    return hits
  }, [doc, findTerm])

  if (contentQuery.isPending) return <Spinner label="Carregando página…" />

  return (
    <article className="space-y-4">
      {/* Título editável */}
      <div>
        <input
          value={title}
          readOnly={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          maxLength={300}
          aria-label="Título da página"
          placeholder="Título da página"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-muted/60 sm:text-3xl"
        />

        {/* Propriedades e ações da página */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-line py-2.5 text-xs">
          <Select
            aria-label="Status da página"
            value={page.status}
            onChange={(e) => nodeMut.update.mutate({ id: page.id, patch: { status: e.target.value as NotebookPageStatus } }, { onError: toast.error })}
            className="h-8 w-auto min-w-[135px] text-xs"
          >
            {PAGE_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {PAGE_STATUS_LABELS[st]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Matéria vinculada à página"
            value={page.subject_id ?? ''}
            onChange={(e) =>
              nodeMut.update.mutate({ id: page.id, patch: { subject_id: e.target.value || null, topic_id: null } }, { onError: toast.error })
            }
            className="h-8 w-auto min-w-[130px] text-xs"
          >
            <option value="">Sem matéria</option>
            {lookups.subjects
              .filter((s) => s.status !== 'archived')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>

          {page.subject_id && (subjectTopics.data ?? []).length > 0 && (
            <Select
              aria-label="Tópico vinculado à página"
              value={page.topic_id ?? ''}
              onChange={(e) =>
                nodeMut.update.mutate({ id: page.id, patch: { topic_id: e.target.value || null } }, { onError: toast.error })
              }
              className="h-8 w-auto min-w-[130px] text-xs"
            >
              <option value="">Sem tópico</option>
              {(subjectTopics.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            aria-label="Dificuldade da página"
            value={page.difficulty ? String(page.difficulty) : ''}
            onChange={(e) =>
              nodeMut.update.mutate({ id: page.id, patch: { difficulty: e.target.value ? Number(e.target.value) : null } }, { onError: toast.error })
            }
            className="h-8 w-auto min-w-[110px] text-xs"
          >
            <option value="">Dificuldade</option>
            <option value="1">Nível 1 (Fácil)</option>
            <option value="2">Nível 2</option>
            <option value="3">Nível 3 (Média)</option>
            <option value="4">Nível 4</option>
            <option value="5">Nível 5 (Alta)</option>
          </Select>

          <Button
            size="sm"
            variant={page.needs_review ? 'primary' : 'ghost'}
            className="h-8 px-2.5 text-xs"
            icon={<Flag className="size-3.5" />}
            onClick={() =>
              nodeMut.update.mutate(
                { id: page.id, patch: { needs_review: !page.needs_review } },
                {
                  onSuccess: () => toast.info(!page.needs_review ? 'Página marcada para revisão.' : 'Marcação de revisão removida.'),
                  onError: toast.error,
                },
              )
            }
          >
            {page.needs_review ? 'Revisar' : 'Marcar revisão'}
          </Button>

          <div className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-bg">
            <select
              aria-label="Tipo de atividade ao estudar"
              value={studyActivity}
              onChange={(e) => onStudyActivityChange(e.target.value as ActivityType)}
              className="h-8 border-r border-line bg-surface-2 px-2 text-xs text-ink outline-none"
            >
              <option value="reading">Leitura</option>
              <option value="theory">Anotações</option>
              <option value="review">Revisão</option>
              <option value="questions">Exercícios</option>
              <option value="flashcards">Flashcards</option>
            </select>
            <button
              type="button"
              disabled={studyPending}
              onClick={onStudy}
              className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
            >
              <Play className="size-3.5 text-accent" aria-hidden />
              Estudar este conteúdo
            </button>
          </div>

          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" icon={<CalendarClock className="size-3.5" />} onClick={onScheduleReview}>
            Agendar revisão
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs"
            icon={<Layers className="size-3.5" />}
            onClick={() => onCreateFlashcard({ selectedText: '', blockId: null })}
          >
            Flashcard
          </Button>

          <Button
            size="sm"
            variant={readOnly ? 'dark' : 'secondary'}
            className="h-8 px-2.5 text-xs"
            icon={readOnly ? <Edit3 className="size-3.5" /> : <Eye className="size-3.5" />}
            onClick={() => setReadOnly((r) => !r)}
          >
            {readOnly ? 'Editar' : 'Leitura'}
          </Button>

          {!readOnly && (
            <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" icon={<LayoutTemplate className="size-3.5" />} onClick={() => setTemplateOpen(true)}>
              Templates
            </Button>
          )}

          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" icon={<History className="size-3.5" />} onClick={() => setHistoryOpen(true)}>
            Versões
          </Button>

          <IconButton label="Buscar nesta página" size="sm" className={cn('size-8', findOpen && 'bg-surface-2 text-ink')} onClick={() => setFindOpen((o) => !o)}>
            <Search className="size-3.5" />
          </IconButton>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            {saveState === 'saving' && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3.5 animate-spin" /> Salvando…
              </span>
            )}
            {saveState === 'saved' && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5" /> Salvo (v{loadedRevision})
              </span>
            )}
            {saveState === 'dirty' && (
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" icon={<Save className="size-3.5" />} onClick={() => void persistContent(false)}>
                Salvar
              </Button>
            )}
            {saveState === 'error' && (
              <Button size="sm" variant="danger" className="h-7 px-2 text-xs" onClick={() => void persistContent(false)}>
                Erro — tentar novamente
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <PageTagsBar nodeId={page.id} readOnly={readOnly} />
          {(activeMetrics.qaCount > 0 || activeMetrics.checklistTotal > 0 || activeMetrics.errorBlocks > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              {activeMetrics.checklistTotal > 0 && (
                <Badge>
                  Checklist {activeMetrics.checklistDone}/{activeMetrics.checklistTotal}
                </Badge>
              )}
              {activeMetrics.errorBlocks > 0 && <Badge>{activeMetrics.errorBlocks} ponto(s) de atenção</Badge>}
              {activeMetrics.qaCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !qaAllOpen
                    setQaAllOpen(next)
                    window.dispatchEvent(new CustomEvent('vlm:qa-toggle-all', { detail: { open: next } }))
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink hover:border-ink/40"
                >
                  {qaAllOpen ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {qaAllOpen ? `Ocultar ${activeMetrics.qaCount} Q&A` : `Revelar ${activeMetrics.qaCount} Q&A`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Busca dentro da página */}
      {findOpen && (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted" aria-hidden />
            <Input
              autoFocus
              value={findTerm}
              onChange={(e) => setFindTerm(e.target.value)}
              placeholder="Buscar termo nesta página…"
              aria-label="Buscar dentro da página"
              className="h-8 flex-1 text-xs"
            />
            <span className="tabular text-xs text-muted">{findTerm.trim().length >= 2 ? `${inPageMatches.length} bloco(s)` : ''}</span>
            <IconButton label="Fechar busca" size="sm" className="size-7" onClick={() => { setFindOpen(false); setFindTerm('') }}>
              <X className="size-3.5" />
            </IconButton>
          </div>
          {inPageMatches.length > 0 && (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {inPageMatches.map((m) => (
                <li key={m.blockId}>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(m.blockId)}"]`)
                      if (!el) return
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('kb-block-flash')
                      setTimeout(() => el.classList.remove('kb-block-flash'), 1200)
                    }}
                    className="w-full truncate rounded-md px-2 py-1 text-left text-xs text-ink hover:bg-bg"
                  >
                    {m.excerpt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Recuperação de rascunho local */}
      {recoverableDraft && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/20 bg-surface-2 px-4 py-3 text-xs">
          <p className="text-ink">
            Encontramos um rascunho local não sincronizado de{' '}
            <strong>{new Date(recoverableDraft.savedAt).toLocaleString('pt-BR')}</strong>. Deseja recuperá-lo?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                clearLocalDraft(page.id)
                setRecoverableDraft(null)
              }}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setDoc(recoverableDraft.contentJson)
                setEditorResetKey((k) => k + 1)
                setDirty(true)
                setSaveState('dirty')
                setRecoverableDraft(null)
                toast.info('Rascunho local restaurado no editor.')
              }}
            >
              Recuperar rascunho
            </Button>
          </div>
        </div>
      )}

      {/* Alerta de conflito de edição */}
      {saveState === 'conflict' && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-ink">Conflito de edição detectado</p>
              <p className="text-xs text-muted">
                Outra aba ou dispositivo salvou a revisão {conflictServer?.revision ?? '?'} enquanto você editava a revisão {loadedRevision}.
                Suas alterações continuam protegidas no rascunho local e nada foi sobrescrito silenciosamente.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (conflictServer) {
                      setDoc(conflictServer.content_json)
                      setLoadedRevision(conflictServer.revision)
                      setEditorResetKey((k) => k + 1)
                      setDirty(false)
                      setConflictServer(null)
                      setSaveState('saved')
                      clearLocalDraft(page.id)
                      toast.info('Versão mais recente carregada.')
                    }
                  }}
                >
                  Carregar versão recente
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleSaveConflictAsCopy()}>
                  Salvar minhas edições como cópia
                </Button>
                <Button size="sm" variant="primary" onClick={() => void persistContent(true)}>
                  Sobrescrever com minha versão
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor rico em blocos (lazy-loaded em chunk dedicado) */}
      <Suspense fallback={<Spinner label="Carregando editor de blocos…" />}>
        <NotebookRichEditor
          initialContent={doc}
          contentKey={`${page.id}-${editorResetKey}`}
          currentNodeId={page.id}
          readOnly={readOnly}
          linkablePages={linkablePages}
          onNavigateInternalLink={onNavigateInternalLink}
          onCreateFlashcardFromSelection={onCreateFlashcard}
          onChange={(nextDoc) => {
            setDoc(nextDoc)
            setDirty(true)
            setSaveState('dirty')
          }}
        />
      </Suspense>

      {/* Rodapé de métricas e ações rápidas mobile */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular">
          {summary.wordCount} palavra{summary.wordCount === 1 ? '' : 's'} ·{' '}
          {summary.readingMinutes > 0 ? `~${summary.readingMinutes} min de leitura` : 'Página vazia'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              nodeMut.markStudied.mutate(page.id, {
                onSuccess: () => toast.success('Estudo registrado na página.'),
                onError: toast.error,
              })
            }
            className="hover:text-ink"
          >
            Marcar como estudada
          </button>
          <span className="xl:hidden">·</span>
          <button type="button" onClick={onMove} className="hover:text-ink xl:hidden">
            Mover
          </button>
          <span className="xl:hidden">·</span>
          <button type="button" onClick={onDuplicate} className="hover:text-ink xl:hidden">
            Duplicar
          </button>
          <span className="xl:hidden">·</span>
          <button type="button" onClick={onTrash} className="text-danger hover:underline xl:hidden">
            Lixeira
          </button>
        </div>
      </div>

      <TemplatePickerModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        currentDoc={doc}
        currentTitle={title}
        onApply={(tplDoc, tplName) => {
          setDoc(tplDoc)
          setEditorResetKey((k) => k + 1)
          setDirty(true)
          setSaveState('dirty')
          toast.success(`Template "${tplName}" aplicado.`)
        }}
      />

      <VersionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        nodeId={page.id}
        currentTitle={title}
        currentDoc={doc}
        currentRevision={loadedRevision}
        onRestored={(saved) => {
          setDoc(saved.content_json)
          setLoadedRevision(saved.revision)
          setEditorResetKey((k) => k + 1)
          setDirty(false)
          setSaveState('saved')
          clearLocalDraft(page.id)
        }}
      />
    </article>
  )
}

function ContextPanel({
  notebookId,
  selectedNode,
  headings,
  wordCount,
  revision,
  pageCards,
  notebookCardsCount,
  backlinks,
  outgoingLinks,
  relatedPages,
  allActiveNodesById,
  allNotebookById,
  linkablePages,
  onAddManualLink,
  onRemoveManualLink,
  onJumpToBlock,
  onOpenHistory,
  onNewFlashcard,
  onEditFlashcard,
  onScheduleReview,
  onMove,
  onDuplicate,
  onTrash,
}: {
  notebookId: string
  selectedNode: NotebookNode | null
  headings: DocHeading[]
  wordCount: number
  revision: number
  pageCards: Flashcard[]
  notebookCardsCount: number
  backlinks: NotebookPageLink[]
  outgoingLinks: NotebookPageLink[]
  relatedPages: Array<{ node: NotebookNode; reasons: string[] }>
  allActiveNodesById: Map<string, NotebookNode>
  allNotebookById: Map<string, { id: string; title: string }>
  linkablePages: LinkablePageOption[]
  onAddManualLink: (targetNodeId: string) => void
  onRemoveManualLink: (linkId: string) => void
  onJumpToBlock: (blockId: string) => void
  onOpenHistory: () => void
  onNewFlashcard: () => void
  onEditFlashcard: (card: Flashcard) => void
  onScheduleReview: () => void
  onMove?: () => void
  onDuplicate?: () => void
  onTrash?: () => void
}) {
  const lookups = useLookups()
  const [addingLink, setAddingLink] = useState(false)
  const [linkTargetId, setLinkTargetId] = useState('')

  if (!selectedNode) {
    return (
      <div className="space-y-3 text-xs text-muted">
        <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Painel de contexto</h2>
        <p>Selecione uma página ou seção na árvore à esquerda para ver o sumário, propriedades, estatísticas, versões, backlinks e flashcards vinculados.</p>
      </div>
    )
  }

  const readingMin = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0

  return (
    <div className="space-y-5 text-xs">
      {/* Sumário automático baseado nos títulos */}
      {selectedNode.node_type === 'page' && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink uppercase">Sumário</h2>
          {headings.length === 0 ? (
            <p className="text-muted">Adicione títulos (H1–H6) para gerar o sumário automático desta página.</p>
          ) : (
            <nav aria-label="Sumário da página" className="scroll-thin max-h-56 space-y-0.5 overflow-y-auto">
              {headings.map((h) => (
                <button
                  key={h.blockId}
                  type="button"
                  onClick={() => onJumpToBlock(h.blockId)}
                  style={{ paddingLeft: `${(h.level - 1) * 10 + 6}px` }}
                  className="block w-full truncate rounded-md py-1 pr-2 text-left text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  {h.text}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink uppercase">Propriedades</h2>
        <dl className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Tipo</dt>
            <dd className="font-medium text-ink">{selectedNode.node_type === 'section' ? 'Seção' : 'Página'}</dd>
          </div>
          {selectedNode.node_type === 'page' && (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Status</dt>
                <dd className="font-medium text-ink">{PAGE_STATUS_LABELS[selectedNode.status]}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Palavras</dt>
                <dd className="tabular font-medium text-ink">{wordCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Tempo de leitura</dt>
                <dd className="tabular font-medium text-ink">{readingMin > 0 ? `~${readingMin} min` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Revisão</dt>
                <dd className="tabular font-medium text-ink">v{revision}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Matéria</dt>
            <dd className="truncate font-medium text-ink">{selectedNode.subject_id ? lookups.subjectName(selectedNode.subject_id) : 'Independente'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Última edição</dt>
            <dd className="font-medium text-ink">{new Date(selectedNode.updated_at).toLocaleDateString('pt-BR')}</dd>
          </div>
        </dl>
      </div>

      {selectedNode.node_type === 'page' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Flashcards da página ({pageCards.length})</h2>
            <button type="button" onClick={onNewFlashcard} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline">
              <Plus className="size-3" /> Novo
            </button>
          </div>
          <Card className="space-y-2.5 p-3">
            {pageCards.length === 0 ? (
              <p className="text-[11px] text-muted">Selecione um trecho no editor (ou Ctrl+Shift+F) para criar um flashcard vinculado.</p>
            ) : (
              <ul className="max-h-44 space-y-2 overflow-y-auto">
                {pageCards.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-surface-2/60 p-2">
                    <p className="line-clamp-2 text-[11px] font-medium text-ink">{c.front}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-muted">
                      <span>
                        {CARD_STATUS_LABELS[c.status]} · próx. {new Date(c.due_at).toLocaleDateString('pt-BR')}
                      </span>
                      <button type="button" onClick={() => onEditFlashcard(c)} className="font-medium text-ink hover:text-accent hover:underline">
                        Atualizar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pageCards.length > 0 && (
                <Link
                  to={`/flashcards/revisar?pagina=${selectedNode.id}&modo=todos`}
                  className="inline-flex h-7 flex-1 items-center justify-center rounded-md bg-ink px-2 text-[11px] font-medium text-bg hover:opacity-85"
                >
                  Revisar página
                </Link>
              )}
              {notebookCardsCount > 0 && (
                <Link
                  to={`/flashcards/revisar?caderno=${notebookId}&modo=vencidos`}
                  className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
                >
                  Caderno ({notebookCardsCount})
                </Link>
              )}
            </div>
          </Card>
        </div>
      )}

      {selectedNode.node_type === 'page' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Conexões & Backlinks</h2>
            <button
              type="button"
              onClick={() => setAddingLink((a) => !a)}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline"
            >
              <Link2 className="size-3" /> Vincular
            </button>
          </div>
          <Card className="space-y-3 p-3">
            {addingLink && (
              <div className="space-y-1.5 rounded-lg border border-line bg-surface-2/60 p-2">
                <Select
                  aria-label="Escolher página para vincular"
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="h-7 text-[11px]"
                >
                  <option value="">Escolher página…</option>
                  {linkablePages
                    .filter((p) => p.id !== selectedNode.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.notebookTitle})
                      </option>
                    ))}
                </Select>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setAddingLink(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-6 px-2 text-[11px]"
                    disabled={!linkTargetId}
                    onClick={() => {
                      onAddManualLink(linkTargetId)
                      setLinkTargetId('')
                      setAddingLink(false)
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted">Backlinks</span>
                <Badge>{backlinks.length}</Badge>
              </div>
              {backlinks.length === 0 ? (
                <p className="text-[11px] text-muted">Nenhuma página aponta para esta ainda. Digite [[ no editor de outra página para conectar.</p>
              ) : (
                <ul className="max-h-32 space-y-1 overflow-y-auto">
                  {backlinks.map((bl) => {
                    const src = allActiveNodesById.get(bl.source_node_id)
                    if (!src) return null
                    const srcNb = allNotebookById.get(src.notebook_id)
                    return (
                      <li key={bl.id}>
                        <Link
                          to={buildInternalPageHref(src.notebook_id, src.id, bl.source_block_id)}
                          className="block rounded-md border border-line bg-surface-2/50 px-2 py-1 hover:border-ink/30"
                        >
                          <p className="truncate text-[11px] font-medium text-ink">{src.title}</p>
                          {srcNb && <p className="truncate text-[10px] text-muted">{srcNb.title}</p>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {outgoingLinks.length > 0 && (
              <div className="border-t border-line pt-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted">Links enviados</span>
                  <Badge>{outgoingLinks.length}</Badge>
                </div>
                <ul className="max-h-28 space-y-1 overflow-y-auto">
                  {outgoingLinks.map((ol) => {
                    const dst = allActiveNodesById.get(ol.target_node_id)
                    if (!dst) return null
                    return (
                      <li key={ol.id} className="flex items-center justify-between gap-1 rounded-md border border-line bg-surface-2/40 px-2 py-1">
                        <Link to={buildInternalPageHref(dst.notebook_id, dst.id, ol.target_block_id)} className="min-w-0 flex-1 truncate text-[11px] text-ink hover:text-accent">
                          {dst.title}
                        </Link>
                        {ol.source_block_id === null && (
                          <button
                            type="button"
                            aria-label={`Remover vínculo com ${dst.title}`}
                            onClick={() => onRemoveManualLink(ol.id)}
                            className="shrink-0 text-muted hover:text-danger"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {relatedPages.length > 0 && (
              <div className="border-t border-line pt-2">
                <p className="mb-1 text-[11px] font-medium text-muted">Páginas relacionadas</p>
                <ul className="space-y-1">
                  {relatedPages.map(({ node, reasons }) => (
                    <li key={node.id}>
                      <Link
                        to={`/cadernos/${node.notebook_id}/pagina/${node.id}`}
                        className="block rounded-md px-1.5 py-1 hover:bg-surface-2"
                      >
                        <p className="truncate text-[11px] font-medium text-ink">{node.title}</p>
                        <p className="truncate text-[10px] text-muted">{reasons.join(' · ')}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to={`/cadernos/conexoes?foco=${selectedNode.id}`}
              className="inline-flex items-center gap-1.5 border-t border-line pt-2 text-[11px] font-medium text-accent hover:underline"
            >
              <Network className="size-3.5" aria-hidden />
              Ver no grafo de conhecimento
            </Link>
          </Card>
        </div>
      )}

      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Ações</h2>
        <Button size="sm" variant="secondary" className="w-full justify-start text-xs" icon={<CalendarClock className="size-3.5" />} onClick={onScheduleReview}>
          Agendar revisão
        </Button>
        {selectedNode.node_type === 'page' && (
          <Button size="sm" variant="secondary" className="w-full justify-start text-xs" icon={<History className="size-3.5" />} onClick={onOpenHistory}>
            Histórico de versões
          </Button>
        )}
        {onMove && (
          <Button size="sm" variant="secondary" className="w-full justify-start text-xs" icon={<FolderInput className="size-3.5" />} onClick={onMove}>
            Mover para…
          </Button>
        )}
        {onDuplicate && (
          <Button size="sm" variant="secondary" className="w-full justify-start text-xs" icon={<Copy className="size-3.5" />} onClick={onDuplicate}>
            Duplicar
          </Button>
        )}
        {onTrash && (
          <Button size="sm" variant="ghost" className="w-full justify-start text-xs text-danger hover:text-danger" icon={<Trash2 className="size-3.5" />} onClick={onTrash}>
            Mover para lixeira
          </Button>
        )}
      </div>
    </div>
  )
}
