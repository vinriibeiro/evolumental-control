import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Link2, RefreshCcw } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables, useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import type { CourseView } from '@/lib/courseCatalog'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/labels'
import { todayKey } from '@/lib/time'
import {
  DATA_AREAS,
  INTEGRATION_TABLES,
  addCourseToCycle,
  createManualDriveCourse,
  detectDataArea,
  parseDriveLink,
  scheduleCourseInCalendar,
  type DataAreaId,
  type ManualLessonInput,
} from '@/services/courseIntegration'
import type { ActivityType } from '@/types/db'

function parseLessonsText(raw: string): ManualLessonInput[] {
  const out: ManualLessonInput[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const sep = trimmed.includes('|') ? '|' : trimmed.includes(' - http') ? ' - ' : null
    if (sep) {
      const idx = trimmed.indexOf(sep)
      const title = trimmed.slice(0, idx).trim()
      const url = trimmed.slice(idx + sep.length).trim()
      if (parseDriveLink(url)) out.push({ title: title || `Aula ${out.length + 1}`, url })
    } else if (parseDriveLink(trimmed)) {
      out.push({ title: `Aula ${out.length + 1}`, url: trimmed })
    }
  }
  return out
}

/** Cadastro rápido de curso do Google Drive por link (pasta ou aulas), sem depender de OAuth. */
export function QuickDriveCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [areaId, setAreaId] = useState<DataAreaId>('dados')
  const [areaManual, setAreaManual] = useState(false)
  const [lessonsText, setLessonsText] = useState('')
  const [addToCycle, setAddToCycle] = useState(true)
  const [cycleMinutes, setCycleMinutes] = useState('60')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDriveUrl('')
    setAreaId('dados')
    setAreaManual(false)
    setLessonsText('')
    setAddToCycle(true)
    setCycleMinutes('60')
    setError(null)
  }, [open])

  const onTitleChange = (val: string) => {
    setTitle(val)
    if (!areaManual) setAreaId(detectDataArea(val).id)
  }

  const save = async () => {
    if (!title.trim()) return setError('Informe o nome do curso.')
    if (!parseDriveLink(driveUrl)) return setError('Cole um link válido do Google Drive (pasta ou arquivo).')
    setError(null)
    setBusy(true)
    try {
      const lessons = parseLessonsText(lessonsText)
      const res = await createManualDriveCourse(backend, {
        title: title.trim(),
        driveUrl: driveUrl.trim(),
        areaId,
        lessons,
        addToCycle,
        cycleDurationMinutes: Math.max(15, Number(cycleMinutes) || 60),
      })
      await invalidateTables(qc, INTEGRATION_TABLES)
      toast.success(
        `Curso "${res.course.title}" adicionado${addToCycle ? ' e incluído no seu Ciclo de Estudos' : ''}.`,
      )
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Adicionar curso do Google Drive por link"
      description="Cadastre rapidamente um curso colando o link da pasta ou arquivo do Drive. Ele já vira matéria integrada ao seu controle de estudos em Dados."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Link2 className="size-4" />} loading={busy} onClick={() => void save()}>
            Salvar curso
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome do curso" required className="sm:col-span-2">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Ex.: SQL Avançado para Dados, Python com Pandas…"
              />
            )}
          </Field>
          <Field label="Área de Dados">
            {(id) => (
              <Select
                id={id}
                value={areaId}
                onChange={(e) => {
                  setAreaManual(true)
                  setAreaId(e.target.value as DataAreaId)
                }}
              >
                {DATA_AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Link da pasta ou arquivo no Google Drive" required hint="Aceita link de pasta (drive.google.com/drive/folders/…) ou arquivo (drive.google.com/file/d/…).">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
          )}
        </Field>

        <Field
          label="Links das aulas (opcional)"
          hint="Uma aula por linha no formato: Nome da aula | https://drive.google.com/file/d/… (se deixar vazio, o curso abre direto pela pasta/link acima)."
        >
          {(id, d) => (
            <Textarea
              id={id}
              aria-describedby={d}
              rows={4}
              value={lessonsText}
              onChange={(e) => setLessonsText(e.target.value)}
              placeholder={'Aula 01 - Introdução | https://drive.google.com/file/d/...\nAula 02 - SELECT e JOIN | https://drive.google.com/file/d/...'}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
          <Checkbox label="Já incluir este curso no meu Ciclo de Estudos" checked={addToCycle} onChange={(e) => setAddToCycle(e.target.checked)} />
          {addToCycle && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <label htmlFor="quick-cycle-min">Bloco (min):</label>
              <Input
                id="quick-cycle-min"
                type="number"
                min={15}
                max={360}
                className="h-8 w-20"
                value={cycleMinutes}
                onChange={(e) => setCycleMinutes(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Adiciona um curso do Drive ao Ciclo de Estudos com 1 clique. */
export function AddCourseToCycleModal({ course, onClose }: { course: CourseView | null; onClose: () => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const cycles = useAll('study_cycles', { filters: [{ column: 'status', op: 'neq', value: 'archived' }], order: [{ column: 'created_at' }] })
  const [cycleId, setCycleId] = useState('')
  const [duration, setDuration] = useState('60')
  const [weight, setWeight] = useState('1')
  const [activity, setActivity] = useState<ActivityType>('video')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!course) return
    const active = (cycles.data ?? []).find((c) => c.status === 'active') ?? cycles.data?.[0]
    setCycleId(active?.id ?? '')
    setDuration('60')
    setWeight('1')
    setActivity('video')
  }, [course, cycles.data])

  if (!course) return null

  const save = async () => {
    setBusy(true)
    try {
      const res = await addCourseToCycle(backend, course.course, {
        cycleId: cycleId || null,
        durationMinutes: Number(duration) || 60,
        weight: Number(weight.replace(',', '.')) || 1,
        activityType: activity,
      })
      await invalidateTables(qc, INTEGRATION_TABLES)
      toast.success(`"${course.title}" adicionado ao ciclo "${res.cycle.name}" (${res.item.duration_minutes} min).`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar curso ao Ciclo de Estudos"
      description={`Curso: "${course.title}". A matéria é vinculada automaticamente para que o cronômetro do curso avance o seu ciclo.`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<RefreshCcw className="size-4" />} loading={busy} onClick={() => void save()}>
            Adicionar ao ciclo
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {(cycles.data ?? []).length > 0 ? (
          <Field label="Ciclo de destino">
            {(id) => (
              <Select id={id} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                {cycles.data!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'active' ? ' (ativo)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <p className="rounded-lg bg-surface p-3 text-xs text-muted">
            Você ainda não tem um ciclo criado. O ciclo <strong className="text-ink">Meu Ciclo de Dados</strong> será criado e ativado automaticamente.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Duração (min)">
            {(id) => <Input id={id} type="number" min={10} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} />}
          </Field>
          <Field label="Peso">
            {(id) => <Input id={id} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />}
          </Field>
          <Field label="Atividade">
            {(id) => (
              <Select id={id} value={activity} onChange={(e) => setActivity(e.target.value as ActivityType)}>
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/** Agenda uma sessão do curso do Drive no Cronograma / Meu Planejamento. */
export function ScheduleCourseModal({ course, onClose }: { course: CourseView | null; onClose: () => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const settings = useSettings()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [duration, setDuration] = useState('60')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!course) return
    setDate(todayKey(settings.timezone))
    setTime('19:00')
    setDuration('60')
  }, [course, settings.timezone])

  if (!course) return null

  const save = async () => {
    if (!date) return
    setBusy(true)
    try {
      await scheduleCourseInCalendar(backend, course.course, {
        date,
        startTime: time || null,
        durationMinutes: Number(duration) || 60,
      })
      await invalidateTables(qc, INTEGRATION_TABLES)
      toast.success(`"${course.title}" agendado no seu planejamento.`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Agendar curso no Cronograma"
      description={`Cria um bloco de estudo para "${course.title}" em Meu Planejamento e vincula a matéria automaticamente.`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<CalendarPlus className="size-4" />} loading={busy} onClick={() => void save()}>
            Agendar estudo
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data">
          {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Horário (opcional)">
          {(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
        </Field>
        <Field label="Duração (min)">
          {(id) => <Input id={id} type="number" min={15} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}
