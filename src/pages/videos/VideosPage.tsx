import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, Maximize, Minimize, MonitorPlay, PanelRightClose, PanelRightOpen, PlayCircle, Search, Settings2 } from 'lucide-react'
import { VideoStudyTimer } from './VideoStudyTimer'
import { StudiedButton } from '@/components/StudiedButton'
import { UNAVAILABLE_HINT, VideoFrame } from '@/components/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { Card, PageHeader, Progress } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { useAll } from '@/hooks/data'
import { nextInQueue, parseYoutube, type YoutubeRef } from '@/lib/video'
import type { TopicStatus } from '@/types/db'
import { loadPanelOpen, loadWatched, normalizeText, savePanelOpen, saveWatched } from '@/lib/videoProgress'

const LAST_KEY = 'evolumental.video.last'

const lastVideo = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

interface Video {
  id: string
  title: string
  url: string
  ref: YoutubeRef
}
interface Lesson {
  id: string
  name: string
  status: TopicStatus
  subjectId: string
  subject: string
  order: number
  videos: Video[]
}

/** Tela própria para assistir às aulas em vídeo: player à esquerda e o conteúdo (disciplinas → aulas → vídeos) à direita. */
export default function VideosPage() {
  const materials = useAll('study_materials', { order: [{ column: 'created_at' }] })
  const subjects = useAll('subjects')
  const topics = useAll('topics')
  const [params, setParams] = useSearchParams()
  const [autoPlay, setAutoPlay] = useState(false)
  const [watched, setWatched] = useState(loadWatched)
  const [panelOpen, setPanelOpen] = useState(loadPanelOpen)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const classroom = useRef<HTMLDivElement>(null)
  const [theater, setTheater] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === classroom.current)
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) setTheater(false) }
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === classroom.current) await document.exitFullscreen()
      else if (classroom.current?.requestFullscreen) await classroom.current.requestFullscreen()
      else { setTheater(true); toast.info('Tela cheia indisponível neste navegador. Modo cinema ativado.') }
    } catch {
      setTheater(true)
      toast.info('O navegador não permitiu a tela cheia. Modo cinema ativado.')
    }
  }

  // Lições com vídeo, na ordem das matérias e dos tópicos; a fila segue essa ordem.
  const lessons = useMemo<Lesson[]>(() => {
    const byTopic = new Map<string, Video[]>()
    for (const m of materials.data ?? []) {
      const ref = m.topic_id && m.url ? parseYoutube(m.url) : null
      if (!ref || !m.topic_id || !m.url) continue
      byTopic.set(m.topic_id, [...(byTopic.get(m.topic_id) ?? []), { id: m.id, title: m.title, url: m.url, ref }])
    }
    const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]))
    return (topics.data ?? [])
      .filter((t) => byTopic.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, status: t.status, subjectId: t.subject_id, subject: subjectName.get(t.subject_id) ?? 'Sem matéria', order: t.sort_order, videos: byTopic.get(t.id) ?? [] }))
      .sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR') || a.order - b.order || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
  }, [materials.data, subjects.data, topics.data])

  const queue = useMemo(() => lessons.flatMap((l) => l.videos.map((v) => ({ ...v, topicId: l.id }))), [lessons])

  const wantedTopic = params.get('topico')
  const current =
    queue.find((v) => v.id === params.get('video')) ??
    (wantedTopic ? queue.find((v) => v.topicId === wantedTopic) : undefined) ??
    queue.find((v) => v.id === lastVideo()) ??
    queue[0] ??
    null
  const lesson = lessons.find((l) => l.id === current?.topicId) ?? null
  const next = nextInQueue(queue, current?.id)
  const previous = current ? queue[queue.findIndex((v) => v.id === current.id) - 1] : null
  const nextLesson = next ? lessons.find((l) => l.id === next.topicId) : null
  const position = current && lesson ? lesson.videos.findIndex((v) => v.id === current.id) + 1 : 0

  useEffect(() => {
    if (!current) return
    try {
      localStorage.setItem(LAST_KEY, current.id)
    } catch {
      // armazenamento bloqueado: vale só nesta sessão
    }
  }, [current])

  const go = (videoId: string, play: boolean) => {
    setAutoPlay(play)
    setParams({ video: videoId }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const toggleWatched = (id: string) =>
    setWatched((prev) => {
      const out = new Set(prev)
      if (!out.delete(id)) out.add(id)
      saveWatched(out)
      return out
    })
  const togglePanel = () =>
    setPanelOpen((open) => {
      savePanelOpen(!open)
      return !open
    })

  // Painel: disciplina → aulas → vídeos, filtrado pela busca.
  const groups = useMemo(() => {
    const q = normalizeText(query.trim())
    const out = new Map<string, { id: string; name: string; lessons: Lesson[]; total: number; done: number }>()
    for (const l of lessons) {
      const lessonHit = !q || normalizeText(l.subject).includes(q) || normalizeText(l.name).includes(q)
      const videos = lessonHit ? l.videos : l.videos.filter((v) => normalizeText(v.title).includes(q))
      if (!videos.length) continue
      const g = out.get(l.subjectId) ?? { id: l.subjectId, name: l.subject, lessons: [], total: 0, done: 0 }
      g.lessons.push({ ...l, videos })
      g.total += videos.length
      g.done += videos.filter((v) => watched.has(v.id)).length
      out.set(l.subjectId, g)
    }
    return [...out.values()]
  }, [lessons, query, watched])

  const isOpen = (subjectId: string) => Boolean(query.trim()) || (expanded[subjectId] ?? subjectId === lesson?.subjectId)
  const totalDone = queue.filter((v) => watched.has(v.id)).length

  const panel = (
    <aside aria-label="Conteúdo" className="video-content min-w-0 overflow-hidden rounded-xl border border-line bg-bg lg:sticky lg:top-[calc(var(--app-top,4rem)+1rem)] lg:flex lg:max-h-[calc(100dvh-var(--app-top,4rem)-2rem)] lg:flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Conteúdo</h2>
          <span className="tabular text-xs text-muted">
            {totalDone} de {queue.length} assistidos
          </span>
        </div>
        <Progress value={queue.length ? totalDone / queue.length * 100 : 0} className="h-1.5" label="Progresso total dos vídeos" />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar conteúdo" placeholder="Buscar disciplina, aula ou vídeo" className="h-9 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <ul className="scroll-thin divide-y divide-line lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {groups.length === 0 && <li className="p-4 text-sm text-muted">Nada encontrado para essa busca.</li>}
        {groups.map((g, i) => {
          const open = isOpen(g.id)
          const pct = g.total ? Math.round((g.done / g.total) * 100) : 0
          return (
            <li key={g.id}>
              <button type="button" aria-expanded={open} onClick={() => setExpanded((e) => ({ ...e, [g.id]: !open }))} className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface">
                <span className={cn('tabular grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold', pct === 100 ? 'bg-success/15 text-success' : 'bg-surface-2 text-ink')} aria-hidden>
                  {pct === 100 ? <CheckCircle2 className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{g.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <Progress value={pct} className="h-1 flex-1" label={`Progresso de ${g.name}`} />
                    <span className="tabular w-16 shrink-0 text-right">{pct === 100 ? 'Completo' : `${g.done}/${g.total} · ${pct}%`}</span>
                  </span>
                </span>
                <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
              </button>
              {open && (
                <div className="border-t border-line bg-surface/60 px-2 py-2">
                  {g.lessons.map((l) => {
                    const lessonDone = l.videos.every((v) => watched.has(v.id))
                    return (
                      <div key={l.id} className="py-1">
                        <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                          {lessonDone && <CheckCircle2 className="size-3.5 text-success" aria-hidden />}
                          <span className="truncate normal-case tracking-normal">{l.name}</span>
                        </p>
                        <ol aria-label={`Vídeos de ${l.name}`} className="space-y-0.5">
                          {l.videos.map((v, k) => {
                            const active = v.id === current?.id
                            return (
                              <li key={v.id}>
                                <button
                                  type="button"
                                  aria-current={active ? 'true' : undefined}
                                  onClick={() => go(v.id, true)}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-lg border-l-2 py-1.5 pr-2 pl-2.5 text-left text-sm transition-colors',
                                    active ? 'border-accent-strong bg-bg font-medium text-ink shadow-sm' : 'border-transparent text-muted hover:bg-bg hover:text-ink',
                                  )}
                                >
                                  {watched.has(v.id) ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <PlayCircle className={cn('size-4 shrink-0', active ? 'text-accent-strong' : 'text-muted')} aria-hidden />}
                                  <span className="tabular w-4 shrink-0 text-xs">{k + 1}</span>
                                  <span className="truncate">{v.title}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ol>
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )

  return (
    <div className="video-page space-y-5">
      <PageHeader
        title="Sua sala de estudos"
        description="Uma aula de cada vez. Aprenda com foco e acompanhe sua evolução."
      />
      <QueryState query={materials}>
        {!current || !lesson ? (
          <EmptyState
            icon={<PlayCircle className="size-8" aria-hidden />}
            title="Nenhum vídeo ainda"
            description={
              <>
                Abra um tópico em <Link to="/materias" className="underline">Matérias e tópicos</Link> e, em <strong>Materiais e links</strong>, adicione o link de um vídeo do YouTube. Depois ele aparece aqui para assistir.
              </>
            }
          />
        ) : (
          <div ref={classroom} data-theater={theater} className="video-classroom rounded-xl bg-bg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink"><MonitorPlay className="size-5 shrink-0 text-accent-strong" aria-hidden /><span>Aula {queue.findIndex((v) => v.id === current.id) + 1} de {queue.length}</span><span className="hidden text-xs font-normal text-muted sm:inline">· {totalDone} concluídas</span></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" aria-pressed={panelOpen} onClick={togglePanel} icon={panelOpen ? <PanelRightClose className="size-4" aria-hidden /> : <PanelRightOpen className="size-4" aria-hidden />}>{panelOpen ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}</Button>
                <Button size="sm" aria-pressed={theater} onClick={() => setTheater((v) => !v)}>{theater ? 'Sair do cinema' : 'Modo cinema'}</Button>
                <Button size="sm" icon={fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />} onClick={() => void toggleFullscreen()}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</Button>
              </div>
            </div>
            <div className={cn('grid items-start gap-5', panelOpen && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
              <section className="min-w-0 space-y-4">
                <Card className="overflow-hidden">
                  <VideoStudyTimer subjectId={lesson.subjectId} topicId={lesson.id} />
                  <VideoFrame key={current.id} video={current.ref} url={current.url} title={current.title} autoPlay={autoPlay} className="video-study-frame" />
                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted">
                        {lesson.subject} › {lesson.name}
                        {lesson.videos.length > 1 && ` · vídeo ${position} de ${lesson.videos.length}`}
                      </p>
                      <h2 className="mt-1 text-lg leading-snug font-semibold text-ink sm:text-xl">{current.title}</h2>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <a href={current.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:underline">
                          Abrir no YouTube <ExternalLink className="size-3" aria-hidden />
                        </a>
                        <Link to={`/materias/${lesson.subjectId}?topico=${lesson.id}`} className="inline-flex items-center gap-1 text-ink hover:underline">
                          <Settings2 className="size-3.5" aria-hidden /> Gerenciar no tópico
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={!previous} icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => previous && go(previous.id, true)}>Anterior</Button>
                        <Button
                          aria-pressed={watched.has(current.id)}
                          icon={<CheckCircle2 className={cn('size-4', watched.has(current.id) && 'text-success')} aria-hidden />}
                          onClick={() => toggleWatched(current.id)}
                        >
                          {watched.has(current.id) ? 'Concluído' : 'Concluir'}
                        </Button>
                        <Button variant="primary" disabled={!next} icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => next && go(next.id, true)}>
                          {next ? 'Prosseguir' : 'Fim da lista'}
                        </Button>
                      </div>
                    </div>
                    {next && nextLesson && (
                      <p className="text-xs text-muted">
                        A seguir: <span className="text-ink">{next.title}</span>
                        {nextLesson.id !== lesson.id && <> · {nextLesson.name}</>}
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Terminou a aula {lesson.name}?</p>
                    <p className="text-xs text-muted">Marcar como estudada conclui o tópico, avança o ciclo e fecha o bloco do cronograma.</p>
                  </div>
                  <div className="max-sm:[&>button]:w-full">
                    <StudiedButton topic={lesson} />
                  </div>
                </Card>
                <p className="text-xs text-muted">{UNAVAILABLE_HINT}</p>
              </section>
              {panelOpen && panel}
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}
