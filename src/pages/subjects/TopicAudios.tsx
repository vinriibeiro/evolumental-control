import { useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Headphones, Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AudioPlayer } from '@/components/AudioPlayer'
import { errorMessage, useToast } from '@/components/ui/feedback'
import { useAudioLibrary } from '@/hooks/useAudioLibrary'
import { audioErrorMessage } from '@/services/audio'

/** Áudios de um tópico (ex.: as faixas de uma lição): adicionar, listar, remover e tocar com repetição. */
export function TopicAudios({ topicId }: { topicId: string }) {
  const library = useAudioLibrary()
  const cloudOn = library.cloud !== null
  const qc = useQueryClient()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const queryKey = useMemo(() => ['audios', library.dbName, topicId], [library.dbName, topicId])

  const list = useQuery({
    queryKey,
    staleTime: 0,
    queryFn: async () => {
      let syncError: string | null = null
      if (library.cloud) {
        try {
          await library.sync(topicId)
        } catch (e) {
          syncError = audioErrorMessage(e)
        }
      }
      return { tracks: await library.list(topicId), syncError }
    },
  })
  const tracks = useMemo(() => list.data?.tracks ?? [], [list.data])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey })
    void qc.invalidateQueries({ queryKey: ['audios-all', library.dbName] })
  }

  const add = useMutation({
    mutationFn: async (files: File[]) => {
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
      let added = 0
      let duplicated = 0
      const notes: Array<{ kind: 'info' | 'error'; text: string }> = []
      for (const file of sorted) {
        try {
          const r = await library.add(topicId, file)
          if (r.status === 'added') added++
          else duplicated++
          if (r.upload === 'too-large') notes.push({ kind: 'info', text: `"${r.track.name}" tem mais de 50 MB e ficou só neste aparelho.` })
          if (r.upload === 'failed') notes.push({ kind: 'error', text: `Não consegui enviar "${r.track.name}" à sua conta. Ele está neste aparelho e será reenviado na próxima sincronização.` })
        } catch (e) {
          notes.push({ kind: 'error', text: errorMessage(e) })
        }
      }
      return { added, duplicated, notes }
    },
    onSuccess: ({ added, duplicated, notes }) => {
      invalidate()
      if (added) toast.success(added === 1 ? '1 faixa adicionada.' : `${added} faixas adicionadas.`)
      if (duplicated) toast.info(duplicated === 1 ? '1 faixa já estava aqui.' : `${duplicated} faixas já estavam aqui.`)
      notes.forEach((n) => (n.kind === 'info' ? toast.info(n.text) : toast.error(n.text)))
    },
    onError: (e) => toast.error(e),
  })

  const remove = useMutation({
    mutationFn: (id: string) => library.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success('Faixa removida.')
    },
    onError: (e) => toast.error(audioErrorMessage(e)),
  })

  const onPick = (picked: FileList | null) => {
    const files = Array.from(picked ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (files.length) add.mutate(files)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Headphones className="size-4 text-accent-strong" aria-hidden /> Áudios
          {tracks.length > 0 && <span className="text-xs font-normal text-muted">· {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}</span>}
        </h3>
        <Button size="sm" icon={<Plus className="size-4" aria-hidden />} loading={add.isPending} onClick={() => fileInput.current?.click()}>
          Adicionar áudios
        </Button>
      </div>
      <input ref={fileInput} type="file" multiple accept="audio/*,.mp3,.m4a,.wav,.ogg" className="hidden" aria-label="Arquivos de áudio para adicionar" onChange={(e) => onPick(e.target.files)} />

      {list.data?.syncError && (
        <p role="alert" className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-surface px-3 py-2 text-xs text-ink">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          <span>Não consegui sincronizar os áudios com a sua conta: {list.data.syncError} Mostrando só o que está neste aparelho.</span>
        </p>
      )}

      {tracks.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum áudio neste tópico. Use <strong>Adicionar áudios</strong> e escolha os mp3 da lição (dá para escolher vários). Eles ficam guardados {cloudOn ? 'no seu espaço privado e neste aparelho' : 'só neste aparelho'}.
        </p>
      ) : (
        <AudioPlayer library={library} tracks={tracks} onPlayed={invalidate} onRemove={(t) => remove.mutate(t.id)} />
      )}
    </div>
  )
}
