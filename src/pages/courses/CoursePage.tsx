import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Columns2, ExternalLink, Focus, Highlighter, Keyboard, ListVideo, Maximize, Minimize, Paperclip, Pencil, RotateCw, Timer, Trophy, Undo2, X,
} from 'lucide-react'
import { VideoStudyTimer } from '@/pages/videos/VideoStudyTimer'
import { DRIVE_VIEWER_HELP, DriveOpenLink, DriveViewer } from '@/components/DriveViewer'
import { StudiedButton } from '@/components/StudiedButton'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Switch } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { Badge, Card, Progress } from '@/components/ui/layout'
import { useRow } from '@/hooks/data'
import { useClassroomView } from '@/hooks/useClassroomView'
import { useCourseActions, useCourses } from '@/hooks/useCourses'
import { displayTitle, isLessonDone, lessonOf, modulePath, neighbors, remainingMs, resumeItem, type Lesson } from '@/lib/courseCatalog'
import { formatBytes, formatDuration, materialType } from '@/lib/drive'
import { cn } from '@/lib/cn'
import type { CourseNode } from '@/types/db'
import { CourseOutline } from './CourseOutline'
import { KindIcon } from './KindIcon'

const PREFS = 'evolumental.course.player'
type Prefs = { outline: boolean; timer: boolean }
function loadPrefs(): Prefs {
  try {
    return { outline: true, timer: true, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) }
  } catch {
    return { outline: true, timer: true }
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p))
  } catch {
    // armazenamento bloqueado: vale só nesta sessão
  }
}

export const SHORTCUTS: Array<[string, string]> = [
  ['N', 'Próxima aula'],
  ['P', 'Aula anterior'],
  ['C', 'Concluir / desmarcar a aula'],
  ['M', 'Modo foco'],
  ['F', 'Tela cheia'],
  ['S', 'Mostrar/ocultar o conteúdo do curso'],
  ['Esc', 'Sair do modo foco'],
]

function PdfAnnotationLink({ courseId, node }: { courseId: string; node: CourseNode }) {
  if (node.mime_type !== 'application/pdf' || node.status !== 'available') return null
  return (
    <Link to={`/cursos/${encodeURIComponent(courseId)}/pdf/${encodeURIComponent(node.id)}`} aria-label={`Ler e marcar PDF: ${displayTitle(node)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong">
      <Highlighter className="size-3.5" aria-hidden />Ler e marcar PDF
    </Link>
  )
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
  const what = node.kind === 'course' ? 'curso' : node.kind === 'module' ? 'módulo/aula' : 'material'
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
        <p className="-mt-2 text-xs text-muted">Com matéria vinculada, o cronômetro da aula registra o estudo nela (e no ciclo, quando for o bloco atual). Vale para tudo abaixo, salvo vínculo próprio.</p>
        <Switch checked={hidden} onChange={setHidden} label="Ocultar do catálogo" />
      </div>
    </Modal>
  )
}

/** Sala do curso, no formato das plataformas de cursos: palco, ações da aula, materiais e conteúdo do curso ao lado. */
export default function CoursePage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [organize, setOrganize] = useState(false)
  const data = useCourses({ includeHidden: organize })
  const actions = useCourseActions()
  const toast = useToast()
  const { classroom, theater, setTheater, fullscreen, toggleFullscreen } = useClassroomView()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [side, setSide] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<CourseNode | null>(null)
  const [help, setHelp] = useState(false)
  const updatePrefs = (p: Partial<Prefs>) => setPrefs((old) => {
    const next = { ...old, ...p }
    savePrefs(next)
    return next
  })

  const view = data.views.find((v) => v.course.id === id) ?? null
  const byId = useMemo(() => new Map((data.nodes.data ?? []).map((n) => [n.id, n])), [data.nodes.data])
  const wanted = params.get('item')
  const fallback = view ? resumeItem(view, data.index) : null
  const target = (view && lessonOf(view, wanted) ? wanted : fallback?.id) ?? null
  const lesson: Lesson | null = (view && lessonOf(view, target)) ?? null
  const active: CourseNode | null = lesson ? ([lesson.primary, ...lesson.attachments].find((n) => n.id === target) ?? lesson.primary) : null
  const sideNode = lesson && side ? (lesson.attachments.find((a) => a.id === side) ?? null) : null
  const { previous, next, index } = neighbors(view?.lessons ?? [], lesson?.id)
  const done = lesson ? isLessonDone(lesson, data.index) : false
  const immersive = theater || fullscreen

  // Vínculo com matéria/tópico: o do próprio item ou o da pasta/módulo/curso mais próximo.
  const link = useMemo(() => {
    for (let n: CourseNode | undefined = active ?? undefined, guard = 0; n && guard < 50; n = n.parent_id ? byId.get(n.parent_id) : undefined, guard++) {
      if (n.subject_id || n.topic_id) return { subjectId: n.subject_id, topicId: n.topic_id }
    }
    return { subjectId: null, topicId: null }
  }, [active, byId])
  const topic = useRow('topics', link.topicId)

  // Fixa na URL o material aberto pela retomada: concluir não pode fazer a página pular para outra aula.
  useEffect(() => {
    if (active && wanted !== active.id) setParams({ item: active.id }, { replace: true })
  }, [active, wanted, setParams])
  useEffect(() => setSide(null), [lesson?.id])

  // Último material aberto (uma vez por item), para "Continuar estudando" neste e em outros aparelhos.
  const marked = useRef<string | null>(null)
  const markOpened = actions.opened.mutate
  useEffect(() => {
    if (!active || marked.current === active.id) return
    marked.current = active.id
    markOpened(active)
  }, [active, markOpened])

  const open = useCallback((node: CourseNode | null | undefined) => {
    if (!node) return
    setParams({ item: node.id }, { replace: true })
    if (!document.fullscreenElement) classroom.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [setParams, classroom])

  const setDone = useCallback(async (l: Lesson, value: boolean) => {
    if (!view) return
    try {
      await actions.complete.mutateAsync({ node: l.primary, done: value })
      if (!value) return
      const doneNow = (x: Lesson) => x.id === l.id || isLessonDone(x, data.index)
      if (view.lessons.every(doneNow)) toast.success(`Parabéns! Você concluiu “${view.title}”.`)
      else {
        const mod = modulePath(view.outline, l.id).at(-1)
        if (mod && mod.lessons.every(doneNow)) toast.success(`Módulo concluído: ${mod.title}`)
      }
    } catch (e) {
      toast.error(e)
    }
  }, [actions.complete, data.index, toast, view])

  const completeAndNext = async () => {
    if (!lesson) return
    if (!done) await setDone(lesson, true)
    if (next) open(next.primary)
  }

  // Atalhos de teclado (fora de campos de texto; com o foco dentro do player do Google, as teclas vão para ele).
  const handlers = useRef({ next: () => {}, previous: () => {}, toggle: () => {}, focus: () => {}, full: () => {}, outline: () => {} })
  handlers.current = {
    next: () => open(next?.primary),
    previous: () => open(previous?.primary),
    toggle: () => { if (lesson) void setDone(lesson, !done) },
    focus: () => setTheater((v) => !v),
    full: () => void toggleFullscreen(),
    outline: () => updatePrefs({ outline: !prefs.outline }),
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const t = e.target instanceof HTMLElement ? e.target : null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('[role="dialog"]'))) return
      const h = handlers.current
      const map: Record<string, () => void> = { n: h.next, p: h.previous, c: h.toggle, m: h.focus, f: h.full, s: h.outline }
      const fn = map[e.key.toLowerCase()]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (data.isPending) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />
  if (!view) return <EmptyState title="Curso não encontrado" description={<>Ele pode ter sido removido ou ocultado. Volte para <Link to="/cursos" className="underline">Cursos e materiais</Link>.</>} />

  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0
  const left = formatDuration(remainingMs(view, data.index))
  const type = active ? materialType(active.mime_type) : null
  const crumbs = lesson ? modulePath(view.outline, lesson.id).map((m) => m.title) : []
  const frame = immersive ? 'h-[calc(100dvh-10.5rem)] min-h-[300px]' : undefined
  const outline = (
    <CourseOutline
      view={view}
      progress={data.index}
      currentLessonId={lesson?.id ?? null}
      organize={organize}
      onOrganize={setOrganize}
      onOpen={(l) => open(l.primary)}
      onToggleDone={(l) => void setDone(l, !isLessonDone(l, data.index))}
      onEdit={setEditing}
      onMove={(first, second) => actions.swap.mutate({ first, second }, { onError: (e) => toast.error(e) })}
      onClose={() => updatePrefs({ outline: false })}
    />
  )

  return (
    <div className="course-player pb-20 lg:pb-0">
      <div ref={classroom} data-theater={theater} className="video-classroom course-classroom rounded-xl bg-bg">
        {/* Barra do curso */}
        <header className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <Link to="/cursos" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-bg" aria-label="Voltar para Cursos e materiais" title="Voltar para Cursos e materiais">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
            <div className="flex items-center gap-1">
              <h1 className="line-clamp-2 text-sm font-semibold text-ink sm:truncate sm:text-base">{view.title}</h1>
              <IconButton size="sm" label="Organizar curso" onClick={() => setEditing(view.course)}><Pencil className="size-3.5" /></IconButton>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Progress value={pct} className="h-1.5 w-28 sm:w-40" label="Progresso do curso" />
              <span className="tabular">{pct}% · {view.done}/{view.total} aulas{left ? ` · faltam ${left} de vídeo` : ''}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full max-sm:justify-end">
            <Button size="sm" aria-pressed={prefs.outline} icon={<ListVideo className="size-4" aria-hidden />} onClick={() => updatePrefs({ outline: !prefs.outline })}>
              <span className="max-sm:sr-only">{prefs.outline ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}</span>
            </Button>
            <Button size="sm" aria-pressed={theater} icon={<Focus className="size-4" aria-hidden />} onClick={() => setTheater((v) => !v)}>
              <span className="max-sm:sr-only">{theater ? 'Sair do modo foco' : 'Modo foco'}</span>
            </Button>
            <Button size="sm" icon={fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} onClick={() => void toggleFullscreen()}>
              <span className="max-sm:sr-only">{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
            </Button>
            <IconButton size="sm" label="Atalhos de teclado" onClick={() => setHelp(true)}><Keyboard className="size-4" /></IconButton>
          </div>
        </header>

        <div className={cn('grid items-start gap-4', prefs.outline && 'lg:grid-cols-[minmax(0,1fr)_23rem]')}>
          <section className="min-w-0 space-y-3" aria-label="Aula">
            {!lesson || !active || !type ? (
              <EmptyState title="Nenhuma aula visível" description="Use “Organizar” no conteúdo do curso para mostrar itens ocultos ou atualize a pasta do Drive." />
            ) : (
              <>
                {prefs.timer ? (
                  <Card className="overflow-hidden">
                    <div className="flex items-start">
                      <div className="min-w-0 flex-1"><VideoStudyTimer subjectId={link.subjectId} topicId={link.topicId} activity={type.kind === 'video' || type.kind === 'audio' ? 'video' : 'reading'} /></div>
                      <IconButton size="sm" label="Ocultar cronômetro" className="m-2" onClick={() => updatePrefs({ timer: false })}><X className="size-4" /></IconButton>
                    </div>
                  </Card>
                ) : null}

                {/* Palco */}
                <Card className="overflow-hidden">
                  {active.mime_type === 'application/pdf' && active.status === 'available' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
                      <span className="text-xs text-muted">Destaque trechos, escreva notas e salve seus marcadores.</span>
                      <PdfAnnotationLink courseId={view.course.id} node={active} />
                    </div>
                  )}
                  {lesson.attachments.length > 0 && (
                    <div role="tablist" aria-label="Conteúdo da aula" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-1.5">
                      {[lesson.primary, ...lesson.attachments].map((n, i) => (
                        <button
                          key={n.id}
                          type="button"
                          role="tab"
                          aria-selected={n.id === active.id}
                          onClick={() => open(n)}
                          className={cn('inline-flex max-w-[16rem] shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium', n.id === active.id ? 'bg-bg text-ink shadow-sm' : 'text-muted hover:text-ink')}
                        >
                          <KindIcon node={n} className="size-3.5 shrink-0" />
                          <span className="truncate">{i === 0 ? (materialType(n.mime_type).kind === 'video' ? 'Videoaula' : 'Aula') : displayTitle(n)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={cn('grid', sideNode && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
                    <DriveViewer key={`${active.id}-${reloadKey}`} node={active} title={displayTitle(active)} frameClassName={frame} />
                    {sideNode && (
                      <div className="relative border-t border-line lg:border-t-0 lg:border-l">
                        <IconButton size="sm" label="Fechar material ao lado" className="absolute top-2 right-2 z-10 bg-bg/90" onClick={() => setSide(null)}><X className="size-4" /></IconButton>
                        {sideNode.mime_type === 'application/pdf' && sideNode.status === 'available' && <div className="border-b border-line bg-surface px-3 py-2 pr-12"><PdfAnnotationLink courseId={view.course.id} node={sideNode} /></div>}
                        <DriveViewer key={`${sideNode.id}-${reloadKey}`} node={sideNode} title={displayTitle(sideNode)} frameClassName={frame ?? 'h-[75dvh] min-h-[420px]'} />
                      </div>
                    )}
                  </div>
                </Card>

                {/* Aula: título e ações */}
                <Card className="space-y-4 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted">Aula {index + 1} de {view.lessons.length}{crumbs.length ? ` · ${crumbs.join(' › ')}` : ''}</p>
                    <h2 className="mt-1 text-lg leading-snug font-semibold text-ink sm:text-xl">{lesson.title}</h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge><KindIcon node={active} className="mr-1 inline size-3" />{type.label}</Badge>
                      {active.id !== lesson.primary.id && <span className="text-ink">{displayTitle(active)}</span>}
                      {formatDuration(active.duration_ms) && <span>{formatDuration(active.duration_ms)}</span>}
                      {formatBytes(active.size_bytes) && <span>{formatBytes(active.size_bytes)}</span>}
                      {done && <span className="inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden /> Aula concluída</span>}
                    </p>
                  </div>
                  <div className="hidden flex-wrap items-center gap-2 lg:flex">
                    <Button disabled={!previous} icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => open(previous?.primary)}>Anterior</Button>
                    <Button aria-pressed={done} loading={actions.complete.isPending} icon={done ? <Undo2 className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} onClick={() => void setDone(lesson, !done)}>
                      {done ? 'Desmarcar conclusão' : 'Concluir'}
                    </Button>
                    <Button variant="primary" disabled={!next && done} icon={next ? <ArrowRight className="size-4" aria-hidden /> : <Trophy className="size-4" aria-hidden />} onClick={() => void completeAndNext()}>
                      {next ? (done ? 'Próxima aula' : 'Concluir e avançar') : done ? 'Última aula' : 'Concluir última aula'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
                    <DriveOpenLink node={active} />
                    <button type="button" className="inline-flex items-center gap-1 text-ink hover:underline" onClick={() => setReloadKey((k) => k + 1)}><RotateCw className="size-3.5" aria-hidden /> Recarregar</button>
                    <button type="button" className="inline-flex items-center gap-1 text-ink hover:underline" onClick={() => setEditing(lesson.folder ?? lesson.primary)}><Pencil className="size-3.5" aria-hidden /> Organizar</button>
                    {!prefs.timer && <button type="button" className="inline-flex items-center gap-1 text-ink hover:underline" onClick={() => updatePrefs({ timer: true })}><Timer className="size-3.5" aria-hidden /> Mostrar cronômetro</button>}
                    {next && <span className="text-muted">A seguir: <button type="button" className="text-ink hover:underline" onClick={() => open(next.primary)}>{next.title}</button></span>}
                  </div>
                </Card>

                {lesson.attachments.length > 0 && (
                  <Card className="p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink"><Paperclip className="size-4" aria-hidden /> Materiais da aula ({lesson.attachments.length})</h3>
                    <ul className="divide-y divide-line">
                      {lesson.attachments.map((a) => {
                        const t = materialType(a.mime_type)
                        return (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                            <KindIcon node={a} className="size-4 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{displayTitle(a)}</span>
                              <span className="text-xs text-muted">{t.label}{formatBytes(a.size_bytes) ? ` · ${formatBytes(a.size_bytes)}` : ''}{!t.embeddable ? ' · abre no Drive' : ''}</span>
                            </span>
                            {t.embeddable && <Button size="sm" variant={a.id === active.id ? 'primary' : 'secondary'} onClick={() => open(a)}>{a.id === active.id ? 'Aberto' : 'Abrir'}</Button>}
                            <PdfAnnotationLink courseId={view.course.id} node={a} />
                            {t.embeddable && active.id === lesson.primary.id && (
                              <Button size="sm" className="max-lg:hidden" aria-pressed={side === a.id} icon={<Columns2 className="size-3.5" aria-hidden />} onClick={() => setSide(side === a.id ? null : a.id)}>{side === a.id ? 'Fechar ao lado' : 'Ao lado do vídeo'}</Button>
                            )}
                            <DriveOpenLink node={a} className="text-xs" />
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
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
                  <p className="mt-2 text-xs text-muted">O player do Google não informa ao app quando o vídeo termina: a conclusão é sua (Concluir) e a retomada é pela última aula aberta, não pelo minuto exato. Velocidade e tela cheia do vídeo ficam nos controles do próprio player.</p>
                </details>
              </>
            )}
          </section>
          {prefs.outline && <div className="video-content lg:sticky lg:top-[calc(var(--app-top,4rem)+1rem)] lg:flex lg:max-h-[calc(100dvh-var(--app-top,4rem)-2rem)] lg:flex-col">{outline}</div>}
        </div>

        {/* Ações fixas no celular */}
        {lesson && (
          <nav aria-label="Ações da aula" className="course-mobile-bar fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-bg/95 px-3 py-2 backdrop-blur lg:hidden">
            <IconButton label="Aula anterior" disabled={!previous} onClick={() => open(previous?.primary)}><ArrowLeft className="size-5" /></IconButton>
            <Button className="flex-1" aria-pressed={done} icon={done ? <Undo2 className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} onClick={() => void setDone(lesson, !done)}>
              {done ? 'Concluída' : 'Concluir'}
            </Button>
            <Button className="flex-1" variant="primary" disabled={!next} onClick={() => open(next?.primary)} icon={<ArrowRight className="size-4" aria-hidden />}>Próxima</Button>
          </nav>
        )}
      </div>

      <Modal open={help} onClose={() => setHelp(false)} title="Atalhos de teclado" size="sm" description="Funcionam com o foco na página (clique fora do vídeo antes, se o player estiver selecionado).">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="contents">
              <dt><kbd className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs">{k}</kbd></dt>
              <dd className="text-ink">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex items-center gap-1 text-xs text-muted"><ExternalLink className="size-3" aria-hidden /> Velocidade, legenda e tela cheia do vídeo: nos controles do player do Google.</p>
      </Modal>
      <EditNodeModal node={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
