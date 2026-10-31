import { useEffect, useMemo, useRef, useState } from 'react'
import { Cloud, CloudOff, Pause, Play, SkipBack, SkipForward, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { useConfirm, useToast } from '@/components/ui/feedback'
import {
  RATES,
  REPEAT_MODE_LABELS,
  advance,
  displayTrackName,
  clampRepeats,
  formatClock,
  progressLabel,
  skipNext,
  skipPrevious,
  totalListeningSeconds,
  type RepeatMode,
} from '@/lib/audioPlayer'
import { cn } from '@/lib/cn'
import { audioErrorMessage, type AudioLibrary, type AudioTrack } from '@/services/audio'

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

interface Props {
  library: AudioLibrary
  tracks: AudioTrack[]
  /** Chamado depois de tocar uma faixa (por exemplo, para atualizar o selo "na nuvem" → "neste aparelho"). */
  onPlayed?: () => void
  /** Se informado, cada faixa ganha o botão de remover (a confirmação é feita aqui; a remoção, por quem chama). */
  onRemove?: (track: AudioTrack) => void
}

/** Lista de faixas + player com repetição para o ciclo de estudo de idiomas (lição inteira N voltas ou cada faixa N vezes). */
export function AudioPlayer({ library, tracks, onPlayed, onRemove }: Props) {
  const cloudOn = library.cloud !== null
  const toast = useToast()
  const confirm = useConfirm()
  const audioRef = useRef<HTMLAudioElement>(null)
  const urlRef = useRef<string | null>(null)
  const loadSeq = useRef(0)

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [current, setCurrent] = useState<{ index: number; lap: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })

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
      onPlayed?.()
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
      message: cloudOn && t.cloud === 'synced' ? `Remover "${displayTrackName(t.name, t.fileName)}"? Ela será apagada da sua conta e de todos os aparelhos.` : `Remover "${displayTrackName(t.name, t.fileName)}" deste aparelho?`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    if (current && tracks[current.index]?.id === t.id) {
      audioRef.current?.pause()
      setCurrent(null)
    }
    onRemove?.(t)
  }

  const state = current ? { ...current, mode: prefs.mode, repeats: prefs.repeats, total: tracks.length } : null
  const totalTime = useMemo(() => totalListeningSeconds(tracks.map((t) => t.duration), prefs.repeats), [tracks, prefs.repeats])

  return (
    <div>
      <ol className="mb-3 space-y-1">
        {tracks.map((t, i) => {
          const active = current?.index === i
          return (
            <li key={t.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', active ? 'bg-surface' : 'hover:bg-surface')}>
              <IconButton label={`Tocar ${displayTrackName(t.name, t.fileName)}`} size="sm" onClick={() => void startTrack(i, 1)}>
                {active && playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              </IconButton>
              <span className={cn('min-w-0 flex-1 truncate', active ? 'font-medium text-ink' : 'text-ink')}>{displayTrackName(t.name, t.fileName)}</span>
              <CloudBadge track={t} cloudOn={cloudOn} />
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{t.duration ? formatClock(t.duration) : '–'}</span>
              {onRemove && (
                <IconButton label={`Remover ${displayTrackName(t.name, t.fileName)}`} size="sm" onClick={() => void askRemove(t)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              )}
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
