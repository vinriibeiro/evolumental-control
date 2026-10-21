import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Plus, Trash2, Volume2, VolumeX } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Card, Segmented } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useRow } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/labels'
import { unlockAudio } from '@/lib/timer/sound'
import { cn } from '@/lib/cn'
import { useSessionActions } from '@/features/timer/useLiveSession'
import type { ActivityType, TimerPhase } from '@/types/db'

type Mode = 'stopwatch' | 'countdown' | 'pomodoro' | 'intervals'

const DEFAULT_INTERVALS: TimerPhase[] = [
  { kind: 'focus', seconds: 50 * 60, label: 'Teoria' },
  { kind: 'break', seconds: 10 * 60, label: 'Pausa' },
  { kind: 'focus', seconds: 30 * 60, label: 'Questões' },
]

export function TimerSetup() {
  const [params] = useSearchParams()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const actions = useSessionActions()
  const toast = useToast()

  const planItem = useRow('study_plan_items', params.get('bloco'))
  const cycleItem = useRow('study_cycle_items', params.get('item'))
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: params.get('materia'), topicId: params.get('topico') })
  const [activity, setActivity] = useState<ActivityType>((params.get('atividade') as ActivityType) || 'theory')
  const [mode, setMode] = useState<Mode>((params.get('modo') as Mode) || (params.get('minutos') ? 'countdown' : 'stopwatch'))
  const [minutes, setMinutes] = useState(params.get('minutos') ?? '50')
  const [pomo, setPomo] = useState(settings.pomodoro)
  const [intervals, setIntervals] = useState<TimerPhase[]>(DEFAULT_INTERVALS)
  const [repeat, setRepeat] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setPomo(settings.pomodoro), [settings.pomodoro])

  // Pré-preenche a partir do bloco do cronograma ou do ciclo.
  useEffect(() => {
    const p = planItem.data
    if (p) {
      setLink({ subjectId: p.subject_id, topicId: p.topic_id })
      setActivity(p.activity_type)
      setMinutes(String(p.duration_minutes))
      setMode('countdown')
    }
  }, [planItem.data])
  useEffect(() => {
    const c = cycleItem.data
    if (c) {
      setLink({ subjectId: c.subject_id, topicId: c.topic_id })
      setActivity(c.activity_type)
      if (!params.get('minutos')) setMinutes(String(c.duration_minutes))
      setMode('countdown')
    }
  }, [cycleItem.data, params])

  const start = async () => {
    setError(null)
    const mins = Number(minutes.replace(',', '.'))
    if (mode === 'countdown' && (!Number.isFinite(mins) || mins < 1 || mins > 1440)) return setError('Informe uma duração entre 1 e 1440 minutos.')
    if (mode === 'pomodoro' && [pomo.focus, pomo.shortBreak, pomo.longBreak].some((v) => !(v >= 1 && v <= 240))) return setError('Os períodos do pomodoro devem ficar entre 1 e 240 minutos.')
    if (mode === 'intervals' && intervals.every((i) => i.kind !== 'focus' || i.seconds <= 0)) return setError('Adicione pelo menos um intervalo de foco.')
    unlockAudio()
    try {
      await actions.start({
        subject_id: link.subjectId,
        topic_id: link.topicId,
        activity_type: activity,
        mode,
        planned_minutes: mode === 'countdown' ? mins : null,
        pomodoro: pomo,
        intervals,
        repeatIntervals: repeat,
        notes: notes.trim() || null,
        plan_item_id: planItem.data?.id ?? null,
        cycle_id: cycleItem.data?.cycle_id ?? null,
        cycle_item_id: cycleItem.data?.id ?? null,
      })
    } catch (e) {
      actions.resetStartId()
      toast.error(e)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Nova sessão de estudo</h2>
          {(planItem.data || cycleItem.data) && (
            <p className="mt-1 text-sm text-muted">{planItem.data ? 'Vinculada a um bloco do cronograma.' : 'Vinculada ao bloco atual do ciclo de estudos.'}</p>
          )}
        </div>
        <IconButton
          label={settings.sound ? 'Desativar som dos alertas' : 'Ativar som dos alertas'}
          variant="secondary"
          onClick={() => updateSettings.mutate({ sound: !settings.sound })}
          aria-pressed={settings.sound}
        >
          {settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconButton>
      </div>

      <div className="grid grid-cols-1 gap-5 [&>*]:min-w-0">
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} topicLabel="Tópico ou subtópico" />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Tipo de atividade</legend>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={activity === a}
                onClick={() => setActivity(a)}
                className={cn(
                  'h-9 rounded-full border px-3.5 text-sm transition-colors',
                  activity === a ? 'border-accent-strong bg-accent/40 font-medium text-ink' : 'border-line text-muted hover:text-ink',
                )}
              >
                {ACTIVITY_LABELS[a]}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Modo de contagem</p>
          <Segmented
            label="Modo de contagem"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'stopwatch', label: 'Cronômetro' },
              { value: 'countdown', label: 'Temporizador' },
              { value: 'pomodoro', label: 'Pomodoro' },
              { value: 'intervals', label: 'Intervalos' },
            ]}
          />
        </div>

        {mode === 'stopwatch' && <p className="text-sm text-muted">Contagem crescente, sem duração definida. Pause quando precisar: o tempo pausado não conta como estudo.</p>}

        {mode === 'countdown' && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Duração (minutos)" className="w-40">
              {(id) => <Input id={id} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
            </Field>
            <div className="flex flex-wrap gap-2 pb-0.5">
              {[25, 50, 60, 90].map((m) => (
                <Button key={m} size="sm" onClick={() => setMinutes(String(m))}>
                  {m} min
                </Button>
              ))}
            </div>
          </div>
        )}

        {mode === 'pomodoro' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['focus', 'Foco (min)'],
                ['shortBreak', 'Pausa curta'],
                ['longBreak', 'Pausa longa'],
                ['rounds', 'Focos até a longa'],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                {(id) => <Input id={id} type="number" min={1} max={k === 'rounds' ? 12 : 240} value={pomo[k]} onChange={(e) => setPomo({ ...pomo, [k]: Number(e.target.value) })} />}
              </Field>
            ))}
          </div>
        )}

        {mode === 'intervals' && (
          <div className="space-y-2">
            {intervals.map((iv, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Tipo de intervalo"
                  className="w-32"
                  value={iv.kind}
                  onChange={(e) => setIntervals(intervals.map((x, j) => (j === i ? { ...x, kind: e.target.value as TimerPhase['kind'] } : x)))}
                >
                  <option value="focus">Foco</option>
                  <option value="break">Pausa</option>
                </Select>
                <Input
                  aria-label="Rótulo"
                  className="min-w-0 flex-1"
                  value={iv.label ?? ''}
                  placeholder="Rótulo"
                  maxLength={40}
                  onChange={(e) => setIntervals(intervals.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <Input
                  aria-label="Minutos"
                  className="w-24"
                  type="number"
                  min={1}
                  max={600}
                  value={Math.round(iv.seconds / 60)}
                  onChange={(e) => setIntervals(intervals.map((x, j) => (j === i ? { ...x, seconds: Math.max(0, Number(e.target.value)) * 60 } : x)))}
                />
                <IconButton label="Remover intervalo" size="sm" onClick={() => setIntervals(intervals.filter((_, j) => j !== i))} disabled={intervals.length <= 1}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setIntervals([...intervals, { kind: 'focus', seconds: 25 * 60, label: '' }])} disabled={intervals.length >= 20}>
                Adicionar intervalo
              </Button>
              <Checkbox label="Repetir a sequência" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            </div>
          </div>
        )}

        <Field label="Observação (opcional)">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />}</Field>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <Button variant="dark" size="lg" icon={<Play className="size-5" />} onClick={start} loading={actions.pending} className="w-full sm:w-auto sm:self-start">
          Iniciar
        </Button>
      </div>
    </Card>
  )
}
