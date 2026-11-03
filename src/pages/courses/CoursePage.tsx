import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronDown, Eye, EyeOff, File, FileText, Image, Maximize, Minimize,
  MonitorPlay, Music, PanelRightClose, PanelRightOpen, Pencil, PlayCircle, Presentation, Search, Sheet, Undo2,
} from 'lucide-react'
import { VideoStudyTimer } from '@/pages/videos/VideoStudyTimer'
import { DRIVE_VIEWER_HELP, DriveOpenLink, DriveViewer } from '@/components/DriveViewer'
import { StudiedButton } from '@/components/StudiedButton'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Switch } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { Badge, Card, PageHeader, Progress } from '@/components/ui/layout'
import { useRow } from '@/hooks/data'
import { useClassroomView } from '@/hooks/useClassroomView'
import { useCourseActions, useCourses } from '@/hooks/useCourses'
import { breadcrumb, displayTitle, neighbors, resumeItem, type TreeNode } from '@/lib/courseCatalog'
import { formatBytes, formatDuration, materialType, type MaterialKind } from '@/lib/drive'
import { loadPanelOpen, normalizeText, savePanelOpen } from '@/lib/videoProgress'
import { cn } from '@/lib/cn'
import type { CourseNode } from '@/types/db'

const ICONS: Record<MaterialKind, typeof File> = {
  video: PlayCircle, pdf: FileText, document: FileText, spreadsheet: Sheet, presentation: Presentation, image: Image, audio: Music, text: FileText, other: File,
}

function KindIcon({ node, className }: { node: CourseNode; className?: string }) {
  const Icon = ICONS[materialType(node.mime_type).kind]
  return <Icon className={className} aria-hidden />
}

function EditNodeModal({ node, onClose }: { node: CourseNode | null; onClose: () => void }) {
  const { edit } = useCourseActions()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [hidden, setHidden] = useState(false)
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  useEffect(() => {
    if (!node) return
    setTitle(node.custom_title ?? '')
    setHidden(node.hidden)
    setLink({ subjectId: node.subject_id, topicId: node.topic_id })
  }, [node])
  if (!node) return null
  const save = async () => {
    const t = title.trim()
    try {
      await edit.mutateAsync({ id: node.id, patch: { custom_title: t && t !== node.title ? t.slice(0, 300) : null, hidden, subject_id: link.subjectId, topic_id: link.topicId } })
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  const what = node.kind === 'course' ? 'curso' : node.kind === 'module' ? 'módulo' : 'material'
  return (
    <Modal
      open
      onClose={onClose}
      title={`Organizar ${what}`}
      description={`No Drive: “${node.title}”. As alterações ficam só na plataforma e são mantidas ao atualizar do Drive.`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={edit.isPending} onClick={() => void save()}>Salvar</Button></>}
    >
      <div className="space-y-4">
        <Field label="Nome na plataforma" hint="Deixe vazio para usar o nome do Drive.">
          {(id, d) => <Input id={id} aria-describedby={d} value={title} maxLength={300} placeholder={node.title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria vinculada (opcional)" />
        <p className="-mt-2 text-xs text-muted">Com matéria vinculada, o cronômetro da aula registra o estudo nela (e no ciclo, quando for o bloco atual). Vale para tudo abaixo deste {what}, salvo vínculo próprio.</p>
        <Switch checked={hidden} onChange={setHidden} label={`Ocultar ${what} do catálogo`} />
      </div>
    </Modal>
  )
}

/** Sala do curso: conteúdo (módulos → aulas) e o material selecionado no visualizador do Drive. */
export default function CoursePage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [organize, setOrganize] = useState(false)
  const data = useCourses({ includeHidden: organize })
  const actions = useCourseActions()
  const toast = useToast()
  const { classroom, theater, setTheater, fullscreen, toggleFullscreen } = useClassroomView()
  const [panelOpen, setPanelOpen] = useState(loadPanelOpen)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<CourseNode | null>(null)

  const view = data.views.find((v) => v.course.id === id) ?? null
  const byId = useMemo(() => new Map((data.nodes.data ?? []).map((n) => [n.id, n])), [data.nodes.data])
  const wanted = params.get('item')
  const current = (view && (view.items.find((i) => i.id === wanted) ?? resumeItem(view, data.index))) ?? null
  const { previous, next, index } = neighbors(view?.items ?? [], current?.id)
  const done = current ? Boolean(data.index.get(current.drive_id)?.completed_at) : false

  // Vínculo com matéria/tópico: o do próprio item ou o do módulo/curso mais próximo.
  const link = useMemo(() => {
    for (let n: CourseNode | undefined = current ?? undefined, guard = 0; n && guard < 50; n = n.parent_id ? byId.get(n.parent_id) : undefined, guard++) {
      if (n.subject_id || n.topic_id) return { subjectId: n.subject_id, topicId: n.topic_id }
    }
    return { subjectId: null, topicId: null }
  }, [current, byId])
  const topic = useRow('topics', link.topicId)

  // Fixa na URL o material aberto pela retomada: concluir não pode fazer a página pular para outra aula.
  useEffect(() => {
    if (current && wanted !== current.id) setParams({ item: current.id }, { replace: true })
  }, [current, wanted, setParams])

  // Último material aberto (uma vez por item), para "Continuar estudando" neste e em outros aparelhos.
  const marked = useRef<string | null>(null)
  const markOpened = actions.opened.mutate
  useEffect(() => {
    if (!current || marked.current === current.id) return
    marked.current = current.id
    markOpened(current)
  }, [current, markOpened])

  const go = (node: CourseNode | null) => {
    if (!node) return
    setParams({ item: node.id }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const toggleDone = async () => {
    if (!current) return
    try {
      await actions.complete.mutateAsync({ node: current, done: !done })
    } catch (e) {
      toast.error(e)
    }
  }
  const move = (siblings: TreeNode[], i: number, dir: -1 | 1) => {
    const other = siblings[i + dir]
    if (other) actions.swap.mutate({ first: siblings[i].node, second: other.node }, { onError: (e) => toast.error(e) })
  }

  if (data.isPending) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />
  if (!view) return <EmptyState title="Curso não encontrado" description={<>Ele pode ter sido removido ou ocultado. Volte para <Link to="/cursos" className="underline">Cursos e materiais</Link>.</>} />

  const q = normalizeText(query.trim())
  const matches = (t: TreeNode): boolean => !q || normalizeText(t.title).includes(q) || t.children.some(matches)
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0
  const type = current ? materialType(current.mime_type) : null
  const crumbs = current ? breadcrumb(view.tree, current.id) : []

  const renderTree = (list: TreeNode[], depth: number): ReactNode => (
    <ul className={cn('space-y-0.5', depth > 0 && 'border-l border-line pl-2')}>
      {list.filter(matches).map((t, i, arr) => {
        const n = t.node
        const controls = organize && (
          <span className="flex shrink-0 items-center">
            <IconButton size="sm" label="Subir" disabled={i === 0} onClick={() => move(arr, i, -1)}><ArrowUp className="size-3.5" /></IconButton>
            <IconButton size="sm" label="Descer" disabled={i === arr.length - 1} onClick={() => move(arr, i, 1)}><ArrowDown className="size-3.5" /></IconButton>
            <IconButton size="sm" label={`Organizar ${t.title}`} onClick={() => setEditing(n)}><Pencil className="size-3.5" /></IconButton>
          </span>
        )
        if (n.kind !== 'item') {
          const open = Boolean(q) || !(collapsed[n.id] ?? false)
          return (
            <li key={n.id} className="py-0.5">
              <div className="flex items-center gap-1">
                <button type="button" aria-expanded={open} onClick={() => setCollapsed((c) => ({ ...c, [n.id]: open }))} className={cn('flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm font-semibold text-ink hover:bg-surface', n.hidden && 'opacity-50')}>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', !open && '-rotate-90')} aria-hidden />
                  <span className="truncate">{t.title}</span>
                  {n.hidden && <EyeOff className="size-3.5 shrink-0" aria-label="Oculto" />}
                </button>
                {controls}
              </div>
              {open && <div className="ml-2">{renderTree(t.children, depth + 1)}</div>}
            </li>
          )
        }
        const active = n.id === current?.id
        const isDone = Boolean(data.index.get(n.drive_id)?.completed_at)
        return (
          <li key={n.id} className="flex items-center gap-1">
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => go(n)}
              className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg border-l-2 py-1.5 pr-2 pl-2.5 text-left text-sm transition-colors', active ? 'border-accent-strong bg-bg font-medium text-ink shadow-sm' : 'border-transparent text-muted hover:bg-bg hover:text-ink', n.hidden && 'opacity-50')}
            >
              {isDone ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Concluído" /> : <KindIcon node={n} className={cn('size-4 shrink-0', active ? 'text-accent-strong' : 'text-muted')} />}
              <span className="truncate">{t.title}</span>
              {n.status === 'missing' && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Não encontrado no Drive" />}
              {n.hidden && <EyeOff className="size-3.5 shrink-0" aria-label="Oculto" />}
            </button>
            {controls}
          </li>
        )
      })}
    </ul>
  )

  const panel = (
    <aside aria-label="Conteúdo do curso" className="video-content min-w-0 overflow-hidden rounded-xl border border-line bg-bg lg:sticky lg:top-[calc(var(--app-top,4rem)+1rem)] lg:flex lg:max-h-[calc(100dvh-var(--app-top,4rem)-2rem)] lg:flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Conteúdo</h2>
          <span className="tabular text-xs text-muted">{view.done} de {view.total} concluídos</span>
        </div>
        <Progress value={pct} className="h-1.5" label="Progresso do curso" />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar no curso" placeholder="Buscar módulo ou aula" className="h-9 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button size="sm" variant={organize ? 'primary' : 'secondary'} aria-pressed={organize} icon={organize ? <Eye className="size-3.5" aria-hidden /> : <Pencil className="size-3.5" aria-hidden />} onClick={() => setOrganize((v) => !v)}>
          {organize ? 'Concluir organização' : 'Organizar'}
        </Button>
      </div>
      <div className="scroll-thin p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{view.items.length === 0 && !organize ? <p className="p-2 text-sm text-muted">Nenhum material visível neste curso.</p> : renderTree(view.tree, 0)}</div>
    </aside>
  )

  return (
    <div className="video-page space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {view.title}
            <IconButton size="sm" label="Organizar curso" onClick={() => setEditing(view.course)}><Pencil className="size-4" /></IconButton>
          </span>
        }
        description={<><Link to="/cursos" className="underline">Cursos e materiais</Link> · {view.total} aula(s)/material(is) · {pct}% concluído</>}
      />
      <div ref={classroom} data-theater={theater} className="video-classroom rounded-xl bg-bg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink"><MonitorPlay className="size-5 shrink-0 text-accent-strong" aria-hidden /><span>{current ? `Material ${index + 1} de ${view.items.length}` : 'Sem materiais'}</span></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" aria-pressed={panelOpen} onClick={() => setPanelOpen((o) => { savePanelOpen(!o); return !o })} icon={panelOpen ? <PanelRightClose className="size-4" aria-hidden /> : <PanelRightOpen className="size-4" aria-hidden />}>{panelOpen ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}</Button>
            <Button size="sm" aria-pressed={theater} onClick={() => setTheater((v) => !v)}>{theater ? 'Sair do cinema' : 'Modo cinema'}</Button>
            <Button size="sm" icon={fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} onClick={() => void toggleFullscreen()}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</Button>
          </div>
        </div>
        <div className={cn('grid items-start gap-5', panelOpen && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
          <section className="min-w-0 space-y-4">
            {current && type ? (
              <Card className="overflow-hidden">
                <VideoStudyTimer subjectId={link.subjectId} topicId={link.topicId} activity={type.kind === 'video' || type.kind === 'audio' ? 'video' : 'reading'} />
                <DriveViewer node={current} title={displayTitle(current)} />
                <div className="space-y-4 p-4 sm:p-5">
                  <div className="min-w-0">
                    {crumbs.length > 0 && <p className="truncate text-xs text-muted">{crumbs.join(' › ')}</p>}
                    <h2 className="mt-1 text-lg leading-snug font-semibold text-ink sm:text-xl">{displayTitle(current)}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge><KindIcon node={current} className="mr-1 inline size-3" />{type.label}</Badge>
                      {formatDuration(current.duration_ms) && <span>{formatDuration(current.duration_ms)}</span>}
                      {formatBytes(current.size_bytes) && <span>{formatBytes(current.size_bytes)}</span>}
                      {current.status === 'missing' && <span className="text-warning">Não encontrado na última atualização</span>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <DriveOpenLink node={current} />
                      <button type="button" className="inline-flex items-center gap-1 text-ink hover:underline" onClick={() => setEditing(current)}><Pencil className="size-3.5" aria-hidden /> Organizar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!previous} icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => go(previous)}>Anterior</Button>
                      <Button aria-pressed={done} loading={actions.complete.isPending} icon={done ? <Undo2 className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} onClick={() => void toggleDone()}>
                        {done ? 'Desmarcar conclusão' : 'Concluir'}
                      </Button>
                      <Button variant="primary" disabled={!next} icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => go(next)}>{next ? 'Próximo' : 'Fim do curso'}</Button>
                    </div>
                  </div>
                  {done && <p className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" aria-hidden /> Concluído (marcação manual).</p>}
                  {next && <p className="text-xs text-muted">A seguir: <span className="text-ink">{displayTitle(next)}</span></p>}
                </div>
              </Card>
            ) : (
              <EmptyState title="Nenhum material visível" description="Use “Organizar” para mostrar itens ocultos ou atualize a pasta do Drive." />
            )}
            {topic.data && (
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Tópico vinculado: {topic.data.name}</p>
                  <p className="text-xs text-muted">Marcar como estudado conclui o tópico, avança o ciclo e fecha o bloco do cronograma.</p>
                </div>
                <div className="max-sm:[&>button]:w-full"><StudiedButton topic={topic.data} /></div>
              </Card>
            )}
            <details className="rounded-xl border border-line bg-surface p-4 text-sm">
              <summary className="cursor-pointer font-medium text-ink">O material não abriu?</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{DRIVE_VIEWER_HELP.map((h) => <li key={h}>{h}</li>)}</ul>
              <p className="mt-2 text-xs text-muted">A plataforma não controla o visualizador do Google: a conclusão é manual e não há retomada no ponto exato do vídeo ou da página.</p>
            </details>
          </section>
          {panelOpen && panel}
        </div>
      </div>
      <EditNodeModal node={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
