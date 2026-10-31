import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, PlayCircle, Settings2 } from 'lucide-react'
import { StudiedButton } from '@/components/StudiedButton'
import { VideoPlayer } from '@/components/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { EmptyState, QueryState } from '@/components/ui/feedback'
import { Card, PageHeader } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { useAll } from '@/hooks/data'
import { nextInQueue, parseYoutube } from '@/lib/video'

const LAST_KEY = 'evolumental.video.last'

const lastVideo = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

/** Tela própria para assistir às aulas em vídeo (links do YouTube dos tópicos), com "Prosseguir" para o próximo. */
export default function VideosPage() {
  const materials = useAll('study_materials', { order: [{ column: 'created_at' }] })
  const subjects = useAll('subjects')
  const topics = useAll('topics')
  const [params, setParams] = useSearchParams()
  const [autoPlay, setAutoPlay] = useState(false)

  // Lições com vídeo, na ordem das matérias e dos tópicos; a fila segue essa ordem.
  const lessons = useMemo(() => {
    const byTopic = new Map<string, Array<{ id: string; title: string; url: string }>>()
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
  const groups = useMemo(() => {
    const out = new Map<string, typeof lessons>()
    for (const l of lessons) out.set(l.subject, [...(out.get(l.subject) ?? []), l])
    return [...out.entries()]
  }, [lessons])

  const wantedVideo = params.get('video') ?? lastVideo()
  const wantedTopic = params.get('topico')
  const current =
    queue.find((v) => v.id === params.get('video')) ??
    (wantedTopic ? queue.find((v) => v.topicId === wantedTopic) : undefined) ??
    queue.find((v) => v.id === wantedVideo) ??
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
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="min-w-0 flex-1 text-xs text-muted sm:max-w-md">
                Lição
                <Select
                  aria-label="Lição"
                  className="mt-1 w-full"
                  value={lesson.id}
                  onChange={(e) => {
                    const first = lessons.find((l) => l.id === e.target.value)?.videos[0]
                    if (first) go(first.id, false)
                  }}
                >
                  {groups.map(([subject, items]) => (
                    <optgroup key={subject} label={subject}>
                      {items.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.videos.length} {l.videos.length === 1 ? 'vídeo' : 'vídeos'})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </label>
              <Link to={`/materias/${lesson.subjectId}?topico=${lesson.id}`} className="inline-flex items-center gap-1 text-xs text-ink hover:underline">
                <Settings2 className="size-3.5" aria-hidden /> Gerenciar no tópico
              </Link>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">{current.title}</h2>
              <VideoPlayer key={current.id} url={current.url} title={current.title} autoPlay={autoPlay} />
            </div>

            {lesson.videos.length > 1 && (
              <ol className="space-y-1" aria-label="Vídeos desta lição">
                {lesson.videos.map((v, i) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      aria-current={v.id === current.id ? 'true' : undefined}
                      onClick={() => go(v.id, true)}
                      className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg', v.id === current.id ? 'bg-bg font-medium text-ink' : 'text-muted')}
                    >
                      <PlayCircle className="size-4 shrink-0 text-accent-strong" aria-hidden />
                      <span className="tabular w-5 shrink-0 text-xs">{i + 1}.</span>
                      <span className="truncate">{v.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <StudiedButton topic={lesson} />
              <div className="flex items-center gap-3">
                {nextLesson && <span className="text-xs text-muted">Próxima lição: {nextLesson.name}</span>}
                <Button variant="primary" disabled={!next} icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => next && go(next.id, true)}>
                  {next ? 'Prosseguir' : 'Fim da lista'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  )
}
