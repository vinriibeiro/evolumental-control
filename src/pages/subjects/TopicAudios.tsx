import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, CloudOff, Headphones, Pause, Play, Plus, SkipBack, SkipForward, Trash2, TriangleAlert } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useAudioLibrary } from '@/hooks/useAudioLibrary'
import {
  RATES,
  REPEAT_MODE_LABELS,
  advance,
  clampRepeats,
  formatClock,
  progressLabel,
  skipNext,
  skipPrevious,
  totalListeningSeconds,
  type RepeatMode,
} from '@/lib/audioPlayer'
import { cn } from '@/lib/cn'
import { audioErrorMessage, type AudioTrack } from '@/services/audio'

const PREFS_KEY = 'evolumental.audio'
interface Prefs {
  rate: number
  mode: RepeatMode
  repeats: number
}

function loadPrefs(): Prefs {
  const base: Prefs = { rate: 1, mode: 'licao', repeats: 5 }
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    if (!raw) return base
    return {
      rate: (RATES as readonly number[]).includes(Number(raw.rate)) ? Number(raw.rate) : base.rate,
      mode: raw.mode === 'faixa' ? 'faixa' : 'licao',
      repeats: clampRepeats(Number(raw.repeats ?? base.repeats)),
    }
  } catch {
    return base
  }
}

function CloudBadge({ track, cloudOn }: { track: AudioTrack; cloudOn: boolean }) {
  if (!cloudOn) return null
  if (track.cloud === 'too-large' || track.cloud === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-warning" title={track.cloud === 'too-large' ? 'Maior que 50 MB: fica só neste aparelho' : 'Será enviado à sua conta na próxima sincronização'}>
        <CloudOff className="size-3" aria-hidden /> {track.cloud === 'too-large' ? 'Só neste aparelho' : 'Falta enviar'}
      </span>
    )
  }
  if (!track.fileLocal) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-info" title="Está na sua conta; baixa para este aparelho ao tocar">
        <Cloud className="size-3" aria-hidden /> Na nuvem
      </span>
    )
  }
  return null
}

/** Áudios de um tópico (ex.: as faixas de uma lição) com player e repetição para o ciclo de estudo de idiomas. */
export function TopicAudios({ topicId }: { topicId: string }) {
  const library = useAudioLibrary()
  const cloudOn = library.cloud !== null
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const urlRef = useRef<string | null>(null)
  const loadSeq = useRef(0)
  const queryKey = useMemo(() => ['audios', library.dbName, topicId], [library.dbName, topicId])

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [current, setCurrent] = useState<{ index: number; lap: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })

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

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // armazenamento bloqueado: vale só nesta sessão
    }
    if (audioRef.current) audioRef.current.playbackRate = prefs.rate
  }, [prefs])

  useEffect(() => {
    const el = audioRef.current
    return () => {
      // contador de carregamentos (não é um nó do DOM): invalida qualquer carregamento em andamento
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadSeq.current++
      el?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

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
      void qc.invalidateQueries({ queryKey })
      if (added) toast.success(added === 1 ? '1 faixa adicionada.' : `${added} faixas adicionadas.`)
      if (duplicated) toast.info(duplicated === 1 ? '1 faixa já estava aqui.' : `${duplicated} faixas já estavam aqui.`)
      notes.forEach((n) => (n.kind === 'info' ? toast.info(n.text) : toast.error(n.text)))
    },
    onError: (e) => toast.error(e),
  })

  const remove = useMutation({
    mutationFn: (id: string) => library.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
      toast.success('Faixa removida.')
    },
    onError: (e) => toast.error(audioErrorMessage(e)),
  })

  const startTrack = async (index: number, lap: number) => {
    const track = tracks[index]
    const el = audioRef.current
    if (!track || !el) return
    const seq = ++loadSeq.current
    setLoading(true)
    try {
      const { data, type } = await library.open(track.id)
      if (seq !== loadSeq.current) return
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(new Blob([data], { type }))
      el.src = urlRef.current
      el.playbackRate = prefs.rate
      setCurrent({ index, lap })
      setTime({ cur: 0, dur: track.duration ?? 0 })
      await el.play()
      void qc.invalidateQueries({ queryKey })
    } catch (e) {
      if (seq === loadSeq.current) {
        setPlaying(false)
        toast.error(audioErrorMessage(e))
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (!current) void startTrack(0, 1)
    else if (playing) el.pause()
    else void el.play()
  }

  const onEnded = () => {
    if (!current) return
    const step = advance({ ...current, mode: prefs.mode, repeats: prefs.repeats, total: tracks.length })
    if (step.done) {
      setPlaying(false)
      toast.success(prefs.mode === 'licao' ? `Pronto: ${prefs.repeats} ${prefs.repeats === 1 ? 'volta' : 'voltas'} da lição.` : `Pronto: cada faixa ouvida ${prefs.repeats} ${prefs.repeats === 1 ? 'vez' : 'vezes'}.`)
      return
    }
    if (step.index === current.index) {
      setCurrent({ index: step.index, lap: step.lap })
      const el = audioRef.current
      if (el) {
        el.currentTime = 0
        void el.play()
      }
    } else void startTrack(step.index, step.lap)
  }

  const skip = (dir: 'next' | 'prev') => {
    const base = { index: current?.index ?? 0, lap: current?.lap ?? 1, mode: prefs.mode, repeats: prefs.repeats, total: tracks.length }
    const step = dir === 'next' ? skipNext(base) : skipPrevious(base)
    void startTrack(step.index, step.lap)
  }

  const askRemove = async (t: AudioTrack) => {
    const ok = await confirm({
      title: 'Remover faixa',
      message: cloudOn && t.cloud === 'synced' ? `Remover "${t.name}"? Ela será apagada da sua conta e de todos os aparelhos.` : `Remover "${t.name}" deste aparelho?`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    if (current && tracks[current.index]?.id === t.id) {
      audioRef.current?.pause()
      setCurrent(null)
    }
    remove.mutate(t.id)
  }

  const onPick = (picked: FileList | null) => {
    const files = Array.from(picked ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (files.length) add.mutate(files)
  }

  const state = current ? { ...current, mode: prefs.mode, repeats: prefs.repeats, total: tracks.length } : null
  const totalTime = totalListeningSeconds(tracks.map((t) => t.duration), prefs.repeats)

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
        <>
          <ol className="mb-3 space-y-1">
            {tracks.map((t, i) => {
              const active = current?.index === i
              return (
                <li key={t.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', active ? 'bg-surface' : 'hover:bg-surface')}>
                  <IconButton label={`Tocar ${t.name}`} size="sm" onClick={() => void startTrack(i, 1)}>
                    {active && playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                  </IconButton>
                  <span className={cn('min-w-0 flex-1 truncate', active ? 'font-medium text-ink' : 'text-ink')}>{t.name}</span>
                  <CloudBadge track={t} cloudOn={cloudOn} />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{t.duration ? formatClock(t.duration) : '–'}</span>
                  <IconButton label={`Remover ${t.name}`} size="sm" onClick={() => void askRemove(t)}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                </li>
              )
            })}
          </ol>

          <div className="space-y-3 rounded-xl border border-line p-3" role="group" aria-label="Player de áudio">
            <div className="flex items-center gap-1">
              <IconButton label="Faixa anterior" size="sm" onClick={() => skip('prev')} disabled={!current || current.index === 0}>
                <SkipBack className="size-4" aria-hidden />
              </IconButton>
              <Button variant="primary" size="sm" loading={loading} icon={playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Tocar'}>
                {playing ? 'Pausar' : current ? 'Continuar' : 'Tocar tudo'}
              </Button>
              <IconButton label="Próxima faixa" size="sm" onClick={() => skip('next')} disabled={!current || current.index >= tracks.length - 1}>
                <SkipForward className="size-4" aria-hidden />
              </IconButton>
              <div className="ml-2 flex min-w-0 flex-1 items-center gap-2">
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{formatClock(time.cur)}</span>
                <input
                  type="range"
                  aria-label="Posição na faixa"
                  className="h-1.5 min-w-0 flex-1 accent-[var(--accent-strong)]"
                  min={0}
                  max={Math.max(1, Math.round(time.dur))}
                  step={1}
                  value={Math.min(Math.round(time.cur), Math.max(1, Math.round(time.dur)))}
                  disabled={!current}
                  onChange={(e) => {
                    if (audioRef.current) audioRef.current.currentTime = Number(e.target.value)
                  }}
                />
                <span className="w-9 shrink-0 text-xs tabular-nums text-muted">{formatClock(time.dur)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted">
                Repetir
                <Select aria-label="Modo de repetição" className="mt-1 h-9 w-36" value={prefs.mode} onChange={(e) => setPrefs((p) => ({ ...p, mode: e.target.value as RepeatMode }))}>
                  {(Object.keys(REPEAT_MODE_LABELS) as RepeatMode[]).map((m) => (
                    <option key={m} value={m}>
                      {REPEAT_MODE_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs text-muted">
                Vezes
                <input
                  type="number"
                  aria-label="Número de repetições"
                  className="mt-1 block h-9 w-20 rounded-lg border border-line bg-bg px-2 text-sm text-ink"
                  min={1}
                  max={20}
                  value={prefs.repeats}
                  onChange={(e) => setPrefs((p) => ({ ...p, repeats: clampRepeats(Number(e.target.value)) }))}
                />
              </label>
              <label className="text-xs text-muted">
                Velocidade
                <Select aria-label="Velocidade" className="mt-1 h-9 w-24" value={String(prefs.rate)} onChange={(e) => setPrefs((p) => ({ ...p, rate: Number(e.target.value) }))}>
                  {RATES.map((r) => (
                    <option key={r} value={String(r)}>
                      {r}x
                    </option>
                  ))}
                </Select>
              </label>
              <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite">
                {state ? progressLabel(state) : 'Parado'}
                {totalTime > 0 && <span> · ouvir {prefs.repeats}× = {formatClock(totalTime)}</span>}
              </p>
            </div>
          </div>
        </>
      )}

      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const cur = e.currentTarget.currentTime // lido agora: o React zera currentTarget depois do evento
          setTime((t) => ({ ...t, cur }))
        }}
        onLoadedMetadata={(e) => setTime({ cur: e.currentTarget.currentTime, dur: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0 })}
      />
    </div>
  )
}
