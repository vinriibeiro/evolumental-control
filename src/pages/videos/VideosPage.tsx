import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, PanelRightClose, PanelRightOpen, PlayCircle, Search, Settings2 } from 'lucide-react'
import { StudiedButton } from '@/components/StudiedButton'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { EmptyState, QueryState } from '@/components/ui/feedback'
import { PageHeader, Progress } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { useAll } from '@/hooks/data'
import { nextInQueue, parseYoutube } from '@/lib/video'
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

/** Tela própria para assistir às aulas em vídeo: player à esquerda e o conteúdo (disciplinas, aulas, vídeos) à direita. */
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

  // Lições com vídeo, na ordem das matérias e dos tópicos; a fila segue essa ordem.
  const lessons = useMemo<Lesson[]>(() => {
    const byTopic = new Map<string, Video[]>()
    for (const m of materials.data ?? []) {
      if (!m.topic_id || !m.url || !parseYoutube(m.url)) continue
      byTopic.set(m.topic_id, [...(byTopic.get(m.topic_id) ?? []), { id: m.id, title: m.title, url: m.url }])
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
  const nextLesson = next && next.topicId !== current?.topicId ? lessons.find((l) => l.id === next.topicId) : null

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

  const content = (
    <aside aria-label="Conteúdo" className="min-w-0 rounded-xl border border-line bg-surface">
      <div className="space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar conteúdo" placeholder="Buscar conteúdo" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
        {groups.length === 0 && <li className="p-4 text-sm text-muted">Nada encontrado para essa busca.</li>}
        {groups.map((g, i) => {
          const open = isOpen(g.id)
          const pct = g.total ? Math.round((g.done / g.total) * 100) : 0
          return (
            <li key={g.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded((e) => ({ ...e, [g.id]: !open }))}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-bg"
              >
                <span className="tabular grid size-9 shrink-0 place-items-center rounded-full bg-bg text-sm text-ink" aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{g.name}</span>
                  {pct === 100 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Completo
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span className="tabular">{pct}%</span>
                      <Progress value={pct} className="h-1.5 max-w-32" label={`Progresso de ${g.name}`} />
                    </span>
                  )}
                </span>
                <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
              </button>
              {open && (
                <div className="space-y-2 bg-bg/60 px-2 pb-3">
                  {g.lessons.map((l) => {
                    const lessonDone = l.videos.every((v) => watched.has(v.id))
                    return (
                      <div key={l.id}>
                        <p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-semibold text-muted">
                          {lessonDone && <CheckCircle2 className="size-3.5 text-success" aria-hidden />}
                          <span className="truncate">{l.name}</span>
                        </p>
                        <ol aria-label={`Vídeos de ${l.name}`} className="space-y-0.5">
                          {l.videos.map((v, k) => (
                            <li key={v.id}>
                              <button
                                type="button"
                                aria-current={v.id === current?.id ? 'true' : undefined}
                                onClick={() => go(v.id, true)}
                                className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface', v.id === current?.id ? 'bg-surface font-medium text-ink' : 'text-muted')}
                              >
                                {watched.has(v.id) ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <PlayCircle className="size-4 shrink-0 text-accent-strong" aria-hidden />}
                                <span className="tabular w-5 shrink-0 text-xs">{k + 1}.</span>
                                <span className="truncate">{v.title}</span>
                              </button>
                            </li>
                          ))}
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
    <div className="space-y-5">
      <PageHeader title="Vídeos" description="Assista às aulas em vídeo dos seus tópicos, uma depois da outra, sem abrir o tópico." />
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
          <div className={cn('grid items-start gap-4', panelOpen && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-xs text-muted">
                    {lesson.subject} › {lesson.name}
                  </p>
                  <h2 className="text-lg font-semibold text-ink">{current.title}</h2>
                </div>
                <Button size="sm" icon={panelOpen ? <PanelRightClose className="size-4" aria-hidden /> : <PanelRightOpen className="size-4" aria-hidden />} aria-pressed={panelOpen} onClick={togglePanel}>
                  {panelOpen ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}
                </Button>
              </div>

              <VideoPlayer key={current.id} url={current.url} title={current.title} autoPlay={autoPlay} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  {nextLesson && <span>Próxima aula: {nextLesson.name}</span>}
                  <Link to={`/materias/${lesson.subjectId}?topico=${lesson.id}`} className="inline-flex items-center gap-1 text-ink hover:underline">
                    <Settings2 className="size-3.5" aria-hidden /> Gerenciar no tópico
                  </Link>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Button
                    className="max-sm:flex-1"
                    aria-pressed={watched.has(current.id)}
                    icon={<CheckCircle2 className={cn('size-4', watched.has(current.id) && 'text-success')} aria-hidden />}
                    onClick={() => toggleWatched(current.id)}
                  >
                    {watched.has(current.id) ? 'Concluído' : 'Concluir'}
                  </Button>
                  <Button className="max-sm:flex-1" variant="primary" disabled={!next} icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => next && go(next.id, true)}>
                    {next ? 'Prosseguir' : 'Fim da lista'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end border-t border-line pt-3 max-sm:[&>button]:w-full">
                <StudiedButton topic={lesson} />
              </div>
            </section>
            {panelOpen && content}
          </div>
        )}
      </QueryState>
    </div>
  )
}
