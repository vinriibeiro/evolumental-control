import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Headphones, Settings2, TriangleAlert } from 'lucide-react'
import { AudioPlayer } from '@/components/AudioPlayer'
import { StudiedButton } from '@/components/StudiedButton'
import { Select } from '@/components/ui/Field'
import { EmptyState, QueryState } from '@/components/ui/feedback'
import { Card, PageHeader } from '@/components/ui/layout'
import { useAll } from '@/hooks/data'
import { useAudioLibrary } from '@/hooks/useAudioLibrary'
import { formatClock } from '@/lib/audioPlayer'
import { audioErrorMessage } from '@/services/audio'

const LAST_KEY = 'evolumental.audio.topic'

const lastTopic = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

/** Tela própria para ouvir os áudios das lições, sem abrir o tópico. */
export default function AudiosPage() {
  const library = useAudioLibrary()
  const queryKey = useMemo(() => ['audios-all', library.dbName], [library.dbName])
  const subjects = useAll('subjects')
  const topics = useAll('topics')
  const [picked, setPicked] = useState<string | null>(lastTopic)

  const audios = useQuery({
    queryKey,
    staleTime: 0,
    queryFn: async () => {
      let syncError: string | null = null
      if (library.cloud) {
        try {
          await library.sync()
        } catch (e) {
          syncError = audioErrorMessage(e)
        }
      }
      return { tracks: await library.listAll(), syncError }
    },
  })

  const lessons = useMemo(() => {
    const byTopic = new Map<string, number>()
    for (const t of audios.data?.tracks ?? []) byTopic.set(t.topicId, (byTopic.get(t.topicId) ?? 0) + 1)
    const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]))
    return (topics.data ?? [])
      .filter((t) => byTopic.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, status: t.status, subjectId: t.subject_id, subject: subjectName.get(t.subject_id) ?? 'Sem matéria', order: t.sort_order, count: byTopic.get(t.id) ?? 0 }))
      .sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR') || a.order - b.order || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
  }, [audios.data, subjects.data, topics.data])

  const groups = useMemo(() => {
    const out = new Map<string, typeof lessons>()
    for (const l of lessons) out.set(l.subject, [...(out.get(l.subject) ?? []), l])
    return [...out.entries()]
  }, [lessons])

  const lesson = lessons.find((l) => l.id === picked) ?? lessons[0] ?? null
  const tracks = useMemo(() => (audios.data?.tracks ?? []).filter((t) => t.topicId === lesson?.id), [audios.data, lesson?.id])
  const total = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0)

  const choose = (id: string) => {
    setPicked(id)
    try {
      localStorage.setItem(LAST_KEY, id)
    } catch {
      // armazenamento bloqueado: vale só nesta sessão
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Áudios" description="Escolha uma lição e toque os áudios, com repetição e velocidade, sem abrir o tópico." />
      <QueryState query={audios}>
        {audios.data?.syncError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-surface px-3 py-2 text-xs text-ink">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            <span>Não consegui sincronizar os áudios com a sua conta: {audios.data.syncError} Mostrando só o que está neste aparelho.</span>
          </p>
        )}
        {!lesson ? (
          <EmptyState
            icon={<Headphones className="size-8" aria-hidden />}
            title="Nenhum áudio ainda"
            description={
              <>
                Abra um tópico em <Link to="/materias" className="underline">Matérias e tópicos</Link> e use <strong>Adicionar áudios</strong>. Depois eles aparecem aqui para tocar direto.
              </>
            }
          />
        ) : (
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="min-w-0 flex-1 text-xs text-muted sm:max-w-md">
                Lição
                <Select aria-label="Lição" className="mt-1 w-full" value={lesson.id} onChange={(e) => choose(e.target.value)}>
                  {groups.map(([subject, items]) => (
                    <optgroup key={subject} label={subject}>
                      {items.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.count} {l.count === 1 ? 'faixa' : 'faixas'})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </label>
              <div className="flex items-center gap-3 text-xs text-muted">
                {total > 0 && <span>{tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'} · {formatClock(total)}</span>}
                <Link to={`/materias/${lesson.subjectId}?topico=${lesson.id}`} className="inline-flex items-center gap-1 text-ink hover:underline">
                  <Settings2 className="size-3.5" aria-hidden /> Gerenciar no tópico
                </Link>
              </div>
            </div>
            <AudioPlayer key={lesson.id} library={library} tracks={tracks} onPlayed={() => void audios.refetch()} />
            <div className="flex justify-end border-t border-line pt-3">
              <StudiedButton topic={lesson} />
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  )
}
