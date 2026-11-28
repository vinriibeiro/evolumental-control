import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  BookOpen,
  Clock,
  FilePlus2,
  FileText,
  Flag,
  Grid2x2,
  List,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, PageHeader, Segmented } from '@/components/ui/layout'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { useLookups } from '@/hooks/domain'
import { useDebounced } from '@/hooks/useDebounced'
import {
  useAllActiveNotebookNodes,
  useNotebookFlashcardLinks,
  useNotebookMutations,
  useNotebookNodeMutations,
  useNotebookTagLinks,
  useNotebookTags,
  useNotebooks,
} from '@/hooks/useNotebooks'
import { eq, isNull } from '@/lib/data/types'
import { coverStyle, nodeBreadcrumb, PAGE_STATUS_LABELS } from '@/lib/notebooks'
import { cn } from '@/lib/cn'
import type { Notebook } from '@/types/db'
import { NotebookImportModal } from './ExportImportModal'
import { NotebookFormModal } from './NotebookFormModal'
import { NotebookIcon } from './NotebookIcon'
import { TagManagerModal } from './TagManagerModal'

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (q.length < 2) return <>{text}</>
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={idx} className="rounded bg-accent/15 px-0.5 font-medium text-ink">
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        ),
      )}
    </>
  )
}

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffMin = Math.floor((Date.now() - Date.parse(iso)) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `há ${diffD} dia${diffD > 1 ? 's' : ''}`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function NotebooksHomePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const backend = useBackend()
  const toast = useToast()
  const lookups = useLookups()

  const notebooksQuery = useNotebooks()
  const nodesQuery = useAllActiveNotebookNodes()
  const cardLinksQuery = useNotebookFlashcardLinks()
  const tagsQuery = useNotebookTags()
  const tagLinksQuery = useNotebookTagLinks()

  const nbMut = useNotebookMutations()
  const nodeMut = useNotebookNodeMutations()

  const [scope, setScope] = useState<'active' | 'archived'>('active')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [subjectFilter, setSubjectFilter] = useState('')
  const tagFilter = searchParams.get('tag') ?? ''
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 220)
  const [modalOpen, setModalOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Notebook | null>(null)
  const [capture, setCapture] = useState<{ notebookId: string; parentId: string; title: string } | null>(null)

  const allNotebooks = useMemo(() => notebooksQuery.data ?? [], [notebooksQuery.data])
  const activeNotebooks = useMemo(() => allNotebooks.filter((n) => !n.archived_at), [allNotebooks])
  const archivedNotebooks = useMemo(() => allNotebooks.filter((n) => Boolean(n.archived_at)), [allNotebooks])

  const activeNotebookIds = useMemo(() => new Set(activeNotebooks.map((n) => n.id)), [activeNotebooks])
  const allNotebookById = useMemo(() => new Map(allNotebooks.map((n) => [n.id, n])), [allNotebooks])

  const nodesInActiveNotebooks = useMemo(
    () => (nodesQuery.data ?? []).filter((n) => activeNotebookIds.has(n.notebook_id)),
    [nodesQuery.data, activeNotebookIds],
  )
  const activePages = useMemo(() => nodesInActiveNotebooks.filter((n) => n.node_type === 'page'), [nodesInActiveNotebooks])

  const pageCountByNotebook = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of nodesQuery.data ?? []) {
      if (n.node_type === 'page') map.set(n.notebook_id, (map.get(n.notebook_id) ?? 0) + 1)
    }
    return map
  }, [nodesQuery.data])

  const cardCountByNotebook = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of cardLinksQuery.data ?? []) {
      if (link.notebook_id) map.set(link.notebook_id, (map.get(link.notebook_id) ?? 0) + 1)
    }
    return map
  }, [cardLinksQuery.data])

  // Busca sob demanda por texto, código, tags, matérias e tópicos (evita carregar todos os documentos sem busca)
  const contentSearchQuery = useQuery({
    queryKey: ['data', ['notebook_page_contents', 'notebook_nodes', 'notebook_tags'], 'search-content', backend.kind, debouncedSearch, subjectFilter, tagFilter],
    enabled: debouncedSearch.length >= 2,
    queryFn: async () => {
      const [nodesHit, contentsHit] = await Promise.all([
        backend.list('notebook_nodes', { filters: [eq('node_type', 'page'), isNull('deleted_at')], search: { columns: ['title'], term: debouncedSearch }, limit: 25 }),
        backend.list('notebook_page_contents', { search: { columns: ['content_text'], term: debouncedSearch }, limit: 25 }),
      ])
      const lower = debouncedSearch.toLowerCase()
      const matchesFilters = (node: (typeof nodesInActiveNotebooks)[number]) => {
        if (node.node_type !== 'page') return false
        const nb = allNotebookById.get(node.notebook_id)
        if (subjectFilter && node.subject_id !== subjectFilter && nb?.subject_id !== subjectFilter) return false
        if (tagFilter && taggedNodeIds && taggedNotebookIds && !taggedNodeIds.has(node.id) && !taggedNotebookIds.has(node.notebook_id)) return false
        return true
      }
      const activeById = new Map(nodesInActiveNotebooks.filter(matchesFilters).map((n) => [n.id, n]))
      const results = new Map<string, { id: string; notebookId: string; title: string; snippet?: string; matchedBy?: string }>()
      for (const n of nodesHit.rows) {
        if (!activeById.has(n.id)) continue
        results.set(n.id, { id: n.id, notebookId: n.notebook_id, title: n.title, matchedBy: 'Título' })
      }
      for (const c of contentsHit.rows) {
        const node = activeById.get(c.node_id)
        if (!node) continue
        const idx = c.content_text.toLowerCase().indexOf(lower)
        const start = Math.max(0, idx - 45)
        const snippet = idx >= 0 ? `${start > 0 ? '…' : ''}${c.content_text.slice(start, start + 150).trim()}…` : c.content_text.slice(0, 120)
        results.set(node.id, { id: node.id, notebookId: node.notebook_id, title: node.title, snippet, matchedBy: 'Conteúdo / Código' })
      }
      // Também inclui páginas cuja tag ou matéria casa com o termo
      const matchedTagIds = new Set(tags.filter((t) => t.name.toLowerCase().includes(lower)).map((t) => t.id))
      if (matchedTagIds.size > 0) {
        for (const tl of tagLinks) {
          if (!matchedTagIds.has(tl.tag_id) || !tl.node_id) continue
          const node = activeById.get(tl.node_id)
          if (node && !results.has(node.id)) {
            const tagName = tags.find((t) => t.id === tl.tag_id)?.name ?? ''
            results.set(node.id, { id: node.id, notebookId: node.notebook_id, title: node.title, snippet: `Tag #${tagName}`, matchedBy: 'Tag' })
          }
        }
      }
      for (const node of activeById.values()) {
        if (results.has(node.id)) continue
        const subj = node.subject_id ? lookups.subjectName(node.subject_id) : ''
        if (subj.toLowerCase().includes(lower)) {
          results.set(node.id, { id: node.id, notebookId: node.notebook_id, title: node.title, snippet: `Matéria: ${subj}`, matchedBy: 'Matéria' })
        }
      }
      return [...results.values()]
    },
  })

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const tagLinks = useMemo(() => tagLinksQuery.data ?? [], [tagLinksQuery.data])
  const taggedNodeIds = useMemo(
    () => (tagFilter ? new Set(tagLinks.filter((l) => l.tag_id === tagFilter && l.node_id).map((l) => l.node_id!)) : null),
    [tagLinks, tagFilter],
  )
  const taggedNotebookIds = useMemo(
    () => (tagFilter ? new Set(tagLinks.filter((l) => l.tag_id === tagFilter && l.notebook_id).map((l) => l.notebook_id!)) : null),
    [tagLinks, tagFilter],
  )
  const pagesMatchingTag = useMemo(
    () => (taggedNodeIds ? activePages.filter((p) => taggedNodeIds.has(p.id)) : []),
    [activePages, taggedNodeIds],
  )

  const visibleNotebooks = useMemo(() => {
    const base = scope === 'active' ? activeNotebooks : archivedNotebooks
    const term = debouncedSearch.toLowerCase()
    return base.filter((nb) => {
      if (subjectFilter && nb.subject_id !== subjectFilter) return false
      if (tagFilter && taggedNotebookIds && taggedNodeIds) {
        const hasTaggedPage = activePages.some((p) => p.notebook_id === nb.id && taggedNodeIds.has(p.id))
        if (!taggedNotebookIds.has(nb.id) && !hasTaggedPage) return false
      }
      if (!term) return true
      return (
        nb.title.toLowerCase().includes(term) ||
        (nb.description ?? '').toLowerCase().includes(term) ||
        (nb.subject_id ? lookups.subjectName(nb.subject_id).toLowerCase().includes(term) : false)
      )
    })
  }, [scope, activeNotebooks, archivedNotebooks, subjectFilter, tagFilter, taggedNotebookIds, taggedNodeIds, activePages, debouncedSearch, lookups])

  const favoriteNotebooks = useMemo(() => activeNotebooks.filter((n) => n.is_favorite), [activeNotebooks])
  const pagesNeedingReview = useMemo(
    () => activePages.filter((p) => p.needs_review).sort((a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0) || b.updated_at.localeCompare(a.updated_at)),
    [activePages],
  )
  const recentlyEditedPages = useMemo(
    () => [...activePages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6),
    [activePages],
  )
  const recentlyStudiedPages = useMemo(
    () =>
      activePages
        .filter((p) => Boolean(p.last_studied_at))
        .sort((a, b) => (b.last_studied_at ?? '').localeCompare(a.last_studied_at ?? ''))
        .slice(0, 6),
    [activePages],
  )

  const recentPage = recentlyEditedPages[0]
  const beginQuickPage = (notebookId = recentPage?.notebook_id ?? activeNotebooks[0]?.id) => {
    if (notebookId) setCapture({ notebookId, parentId: '', title: '' })
  }
  const captureNodes = capture ? nodesInActiveNotebooks.filter((node) => node.notebook_id === capture.notebookId) : []
  const captureSections = captureNodes.filter((node) => node.node_type === 'section')
  const captureNodesById = new Map(captureNodes.map((node) => [node.id, node]))
  const handleQuickPage = async () => {
    const notebook = activeNotebooks.find((nb) => nb.id === capture?.notebookId)
    const title = capture?.title.trim()
    if (!notebook || !capture || !title || nodeMut.create.isPending) return
    try {
      const page = await nodeMut.create.mutateAsync({
        notebook_id: notebook.id,
        node_type: 'page',
        parent_id: capture.parentId || null,
        title,
        subject_id: notebook.subject_id,
      })
      toast.success('Página criada.')
      navigate(`/cadernos/${notebook.id}/pagina/${page.id}`)
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Cadernos"
        description="Organize suas anotações e volte direto ao que estava estudando."
        actions={
          <>
            <ActionMenu label="Mais ações dos cadernos">
              {(close) => <>
                <MenuItem icon={<Tag className="size-4" />} onClick={() => { close(); setTagsOpen(true) }}>Gerenciar tags</MenuItem>
                <MenuItem icon={<Upload className="size-4" />} onClick={() => { close(); setImportOpen(true) }}>Importar caderno</MenuItem>
              </>}
            </ActionMenu>
            {activeNotebooks.length > 0 && (
              <Button
                variant="secondary"
                icon={<FilePlus2 className="size-4" />}
                onClick={() => beginQuickPage()}
              >
                Nova página
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              Novo caderno
            </Button>
          </>
        }
      />

      {recentPage && scope === 'active' && !search.trim() && !tagFilter && !subjectFilter && (
        <Link to={`/cadernos/${recentPage.notebook_id}/pagina/${recentPage.id}`} className="group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface-2 p-4 hover:border-accent/40 sm:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg text-accent-strong"><Clock className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted">Retomar última página</span>
            <span className="mt-0.5 block truncate text-base font-semibold text-ink">{recentPage.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{allNotebookById.get(recentPage.notebook_id)?.title}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted group-hover:text-accent-strong" aria-hidden />
        </Link>
      )}

      {/* Busca e filtros */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)_minmax(8rem,10rem)]">
        <div className="relative col-span-2 min-w-0 md:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cadernos, títulos e conteúdo das páginas…"
            aria-label="Buscar nos cadernos"
            className="pl-9"
          />
        </div>
        <Select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filtrar por matéria"
        >
          <option value="">Todas as matérias</option>
          {lookups.subjects
            .filter((s) => s.status !== 'archived')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <Select
          value={tagFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('tag', e.target.value)
            else next.delete('tag')
            setSearchParams(next, { replace: true })
          }}
          aria-label="Filtrar por tag"
        >
          <option value="">Todas as tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Estado dos cadernos"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: `Ativos (${activeNotebooks.length})` },
            { value: 'archived', label: `Arquivados (${archivedNotebooks.length})` },
          ]}
        />
        <div className="flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Modo de visualização">
          <IconButton
            label="Visualização em grade"
            size="sm"
            onClick={() => setView('grid')}
            className={cn(view === 'grid' && 'bg-bg text-ink shadow-sm')}
          >
            <Grid2x2 className="size-4" />
          </IconButton>
          <IconButton
            label="Visualização em lista"
            size="sm"
            onClick={() => setView('list')}
            className={cn(view === 'list' && 'bg-bg text-ink shadow-sm')}
          >
            <List className="size-4" />
          </IconButton>
        </div>
      </div>

      {/* Páginas marcadas para revisão ativa */}
      {scope === 'active' && !debouncedSearch && !subjectFilter && !tagFilter && pagesNeedingReview.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent uppercase">
              <Flag className="size-3.5" aria-hidden />
              Páginas marcadas para revisão ({pagesNeedingReview.length})
            </h2>
          </div>
          <ul className="divide-y divide-line">
            {pagesNeedingReview.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link to={`/cadernos/${p.notebook_id}/pagina/${p.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                  <span className="truncate font-medium text-ink">{p.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {p.difficulty && <Badge>Nível {p.difficulty}/5</Badge>}
                    <Badge>{allNotebookById.get(p.notebook_id)?.title ?? 'Caderno'}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Páginas filtradas por tag */}
      {tagFilter && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Páginas com a tag #{tags.find((t) => t.id === tagFilter)?.name ?? ''} ({pagesMatchingTag.length})
            </h2>
            {tags.find((t) => t.id === tagFilter) && (
              <Link
                to={`/flashcards/revisar?tag=${encodeURIComponent(tags.find((t) => t.id === tagFilter)!.name)}&modo=todos`}
                className="text-xs font-medium text-accent hover:underline"
              >
                Revisar flashcards desta tag
              </Link>
            )}
          </div>
          {pagesMatchingTag.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma página marcada com esta tag.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pagesMatchingTag.map((p) => (
                <li key={p.id}>
                  <Link to={`/cadernos/${p.notebook_id}/pagina/${p.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                    <span className="truncate font-medium text-ink">{p.title}</span>
                    <Badge>{allNotebookById.get(p.notebook_id)?.title ?? 'Caderno'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Resultados de busca em páginas */}
      {debouncedSearch.length >= 2 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Páginas encontradas</h2>
            {contentSearchQuery.isFetching && <span className="text-xs text-muted">Buscando…</span>}
          </div>
          {(contentSearchQuery.data ?? []).length === 0 && !contentSearchQuery.isFetching ? (
            <p className="text-sm text-muted">Nenhuma página corresponde a "{debouncedSearch}".</p>
          ) : (
            <ul className="divide-y divide-line">
              {(contentSearchQuery.data ?? []).map((hit) => (
                <li key={hit.id}>
                  <Link
                    to={`/cadernos/${hit.notebookId}/pagina/${hit.id}`}
                    className="flex items-start justify-between gap-3 py-2.5 transition-colors hover:text-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        <HighlightText text={hit.title} query={debouncedSearch} />
                      </p>
                      {hit.snippet && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                          <HighlightText text={hit.snippet} query={debouncedSearch} />
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hit.matchedBy && <Badge>{hit.matchedBy}</Badge>}
                      <Badge>{allNotebookById.get(hit.notebookId)?.title ?? 'Caderno'}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Cadernos favoritos */}
      {scope === 'active' && !debouncedSearch && favoriteNotebooks.length > 0 && (
        <section aria-label="Cadernos favoritos" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Favoritos</h2>
            <Link to="/cadernos/favoritos" className="text-xs font-medium text-muted hover:text-ink">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {favoriteNotebooks.slice(0, 4).map((nb) => (
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
                  <p className="truncate text-xs text-muted">{pageCountByNotebook.get(nb.id) ?? 0} página(s)</p>
                </div>
                <Star className="size-4 shrink-0 fill-current text-accent" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Lista / Grade principal de cadernos */}
      <QueryState query={notebooksQuery}>
        {visibleNotebooks.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-9" />}
            title={
              scope === 'archived'
                ? 'Nenhum caderno arquivado'
                : debouncedSearch || subjectFilter
                  ? 'Nenhum caderno encontrado com esses filtros'
                  : 'Comece sua base de conhecimento'
            }
            description={
              scope === 'archived'
                ? 'Cadernos arquivados continuam preservados e podem ser restaurados a qualquer momento.'
                : debouncedSearch || subjectFilter
                  ? 'Tente limpar a busca ou escolher outra matéria.'
                  : 'Crie seu primeiro caderno para organizar estudos, documentações técnicas, resumos e consultas.'
            }
            action={
              scope === 'active' && !debouncedSearch && !subjectFilter ? (
                <Button
                  variant="primary"
                  icon={<Plus className="size-4" />}
                  onClick={() => {
                    setEditing(null)
                    setModalOpen(true)
                  }}
                >
                  Criar primeiro caderno
                </Button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNotebooks.map((nb) => {
              const pagesCount = pageCountByNotebook.get(nb.id) ?? 0
              const cardsCount = cardCountByNotebook.get(nb.id) ?? 0
              const subjectName = nb.subject_id ? lookups.subjectName(nb.subject_id) : null
              return (
                <Card key={nb.id} className="group flex flex-col overflow-hidden transition-colors hover:border-ink/40">
                  <Link to={`/cadernos/${nb.id}`} className="block h-14 w-full border-b border-line" style={coverStyle(nb.cover, nb.color)} aria-label={`Abrir ${nb.title}`} />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/cadernos/${nb.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: nb.color }}>
                          <NotebookIcon name={nb.icon} className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-ink group-hover:text-accent">{nb.title}</h3>
                          <p className="text-xs text-muted">Atualizado {formatRelativeDate(nb.updated_at)}</p>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconButton
                          label={nb.is_favorite ? 'Remover dos favoritos' : 'Favoritar caderno'}
                          size="sm"
                          onClick={() => nbMut.toggleFavorite.mutate(nb, { onError: toast.error })}
                        >
                          <Star className={cn('size-4', nb.is_favorite ? 'fill-current text-accent' : 'text-muted')} />
                        </IconButton>
                        <ActionMenu label={`Ações de ${nb.title}`}>
                          {(close) => (
                            <>
                              {!nb.archived_at && <MenuItem
                                icon={<FilePlus2 className="size-4" />}
                                onClick={() => {
                                  close()
                                  beginQuickPage(nb.id)
                                }}
                              >
                                Nova página
                              </MenuItem>}
                              <MenuItem
                                icon={<Pencil className="size-4" />}
                                onClick={() => {
                                  close()
                                  setEditing(nb)
                                  setModalOpen(true)
                                }}
                              >
                                Editar caderno
                              </MenuItem>
                              {nb.archived_at ? (
                                <MenuItem
                                  icon={<ArchiveRestore className="size-4" />}
                                  onClick={() => {
                                    close()
                                    nbMut.unarchive.mutate(nb.id, {
                                      onSuccess: () => toast.success('Caderno restaurado do arquivo.'),
                                      onError: toast.error,
                                    })
                                  }}
                                >
                                  Desarquivar
                                </MenuItem>
                              ) : (
                                <MenuItem
                                  icon={<Archive className="size-4" />}
                                  onClick={() => {
                                    close()
                                    nbMut.archive.mutate(nb.id, {
                                      onSuccess: () => toast.success('Caderno arquivado.'),
                                      onError: toast.error,
                                    })
                                  }}
                                >
                                  Arquivar
                                </MenuItem>
                              )}
                              <MenuItem
                                danger
                                icon={<Trash2 className="size-4" />}
                                onClick={() => {
                                  close()
                                  nbMut.trash.mutate(nb.id, {
                                    onSuccess: () => toast.success('Caderno enviado para a lixeira.'),
                                    onError: toast.error,
                                  })
                                }}
                              >
                                Mover para lixeira
                              </MenuItem>
                            </>
                          )}
                        </ActionMenu>
                      </div>
                    </div>

                    {nb.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{nb.description}</p>}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-muted">
                      {subjectName && <Badge>{subjectName}</Badge>}
                      <span className="tabular">{pagesCount} página{pagesCount === 1 ? '' : 's'}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular">{cardsCount} flashcard{cardsCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {visibleNotebooks.map((nb) => {
              const pagesCount = pageCountByNotebook.get(nb.id) ?? 0
              const cardsCount = cardCountByNotebook.get(nb.id) ?? 0
              const subjectName = nb.subject_id ? lookups.subjectName(nb.subject_id) : null
              return (
                <div key={nb.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60">
                  <Link to={`/cadernos/${nb.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: nb.color }}>
                      <NotebookIcon name={nb.icon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{nb.title}</p>
                      {nb.description && <p className="truncate text-xs text-muted">{nb.description}</p>}
                    </div>
                  </Link>
                  {subjectName && <Badge className="hidden sm:inline-flex">{subjectName}</Badge>}
                  <span className="tabular text-xs text-muted">{pagesCount} pág.</span>
                  <span className="hidden tabular text-xs text-muted sm:inline">{cardsCount} cartões</span>
                  <span className="hidden text-xs text-muted md:inline">{formatRelativeDate(nb.updated_at)}</span>
                  <IconButton
                    label={nb.is_favorite ? 'Remover dos favoritos' : 'Favoritar caderno'}
                    size="sm"
                    onClick={() => nbMut.toggleFavorite.mutate(nb, { onError: toast.error })}
                  >
                    <Star className={cn('size-4', nb.is_favorite ? 'fill-current text-accent' : 'text-muted')} />
                  </IconButton>
                  <ActionMenu label={`Ações de ${nb.title}`}>
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Pencil className="size-4" />}
                          onClick={() => {
                            close()
                            setEditing(nb)
                            setModalOpen(true)
                          }}
                        >
                          Editar
                        </MenuItem>
                        <MenuItem
                          icon={nb.archived_at ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                          onClick={() => {
                            close()
                            const op = nb.archived_at ? nbMut.unarchive : nbMut.archive
                            op.mutate(nb.id, { onError: toast.error })
                          }}
                        >
                          {nb.archived_at ? 'Desarquivar' : 'Arquivar'}
                        </MenuItem>
                        <MenuItem
                          danger
                          icon={<Trash2 className="size-4" />}
                          onClick={() => {
                            close()
                            nbMut.trash.mutate(nb.id, {
                              onSuccess: () => toast.success('Caderno enviado para a lixeira.'),
                              onError: toast.error,
                            })
                          }}
                        >
                          Mover para lixeira
                        </MenuItem>
                      </>
                    )}
                  </ActionMenu>
                </div>
              )
            })}
          </Card>
        )}
      </QueryState>

      {/* Recentes (editadas e estudadas) */}
      {scope === 'active' && !debouncedSearch && (recentlyEditedPages.length > 0 || recentlyStudiedPages.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Clock className="size-4 text-muted" aria-hidden />
                Editadas recentemente
              </h2>
              <Link to="/cadernos/recentes" className="text-xs font-medium text-muted hover:text-ink">
                Ver histórico
              </Link>
            </div>
            {recentlyEditedPages.length === 0 ? (
              <p className="text-xs text-muted">Nenhuma página editada ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentlyEditedPages.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/cadernos/${p.notebook_id}/pagina/${p.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="truncate font-medium text-ink">{p.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        <span className="hidden truncate sm:inline">{allNotebookById.get(p.notebook_id)?.title}</span>
                        <span>{formatRelativeDate(p.updated_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <BookOpen className="size-4 text-muted" aria-hidden />
                Estudadas recentemente
              </h2>
              <Link to="/cadernos/recentes" className="text-xs font-medium text-muted hover:text-ink">
                Ver todas
              </Link>
            </div>
            {recentlyStudiedPages.length === 0 ? (
              <p className="text-xs text-muted">Abra uma página e marque como estudada para acompanhar suas revisões aqui.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentlyStudiedPages.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/cadernos/${p.notebook_id}/pagina/${p.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="truncate font-medium text-ink">{p.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        <Badge>{PAGE_STATUS_LABELS[p.status]}</Badge>
                        <span>{formatRelativeDate(p.last_studied_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      <NotebookFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        notebook={editing}
        onSaved={(nb) => {
          if (!editing) navigate(`/cadernos/${nb.id}`)
        }}
      />
      <TagManagerModal open={tagsOpen} onClose={() => setTagsOpen(false)} />
      <NotebookImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={(nbId) => navigate(`/cadernos/${nbId}`)} />
      <Modal
        open={capture !== null}
        onClose={() => setCapture(null)}
        title="Nova página"
        footer={<><Button onClick={() => setCapture(null)}>Cancelar</Button><Button variant="primary" loading={nodeMut.create.isPending} onClick={() => void handleQuickPage()} disabled={!capture?.title.trim()}>Criar página</Button></>}
      >
        {capture && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleQuickPage() }}>
            <Field label="Título da página" required>{(id) => <Input id={id} autoFocus value={capture.title} maxLength={200} onChange={(event) => setCapture({ ...capture, title: event.target.value })} />}</Field>
            <Field label="Caderno">{(id) => (
              <Select id={id} value={capture.notebookId} onChange={(event) => setCapture({ ...capture, notebookId: event.target.value, parentId: '' })}>
                {activeNotebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.title}</option>)}
              </Select>
            )}</Field>
            {captureSections.length > 0 && (
              <Field label="Seção">{(id) => (
                <Select id={id} value={capture.parentId} onChange={(event) => setCapture({ ...capture, parentId: event.target.value })}>
                  <option value="">Início do caderno</option>
                  {captureSections.map((section) => <option key={section.id} value={section.id}>{nodeBreadcrumb(captureNodesById, section.id).map((node) => node.title).join(' › ')}</option>)}
                </Select>
              )}</Field>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}
