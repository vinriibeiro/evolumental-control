import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Pause, Pencil, Play, Plus, RefreshCcw, RotateCcw, Scale, SkipBack, SkipForward, Trash2 } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, Card, ColorDot, PageHeader, Progress } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { SortableItem, SortableList } from '@/components/Sortable'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useSafeDelete } from '@/components/useSafeDelete'
import { invalidateTables, useAll, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { eq } from '@/lib/data/types'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@/lib/labels'
import { distributeByWeight, normalizeIndex, skip, sortItems, summarize } from '@/lib/cycle'
import { formatDuration } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { ActivityType, StudyCycle, StudyCycleItem } from '@/types/db'

/** Ciclos de estudo: usado dentro do Calendário (modo Ciclo). `compact` = coluna estreita ao lado do calendário. */
export function CyclesPanel({ compact = false }: { compact?: boolean }) {
  const cycles = useAll('study_cycles', { filters: [{ column: 'status', op: 'neq', value: 'archived' }], order: [{ column: 'created_at' }] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ cycle: StudyCycle | null } | null>(null)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const safeDelete = useSafeDelete('study_cycles')
  const selected = (cycles.data ?? []).find((c) => c.id === selectedId) ?? (cycles.data ?? []).find((c) => c.status === 'active') ?? cycles.data?.[0] ?? null

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn()
      if (msg) toast.success(msg)
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_cycles', 'study_cycle_items'])
    }
  }

  // Ativar um ciclo pausa o anterior (no máximo um ativo, garantido também no banco).
  const activate = (c: StudyCycle) =>
    run(async () => {
      await backend.update('study_cycles', [eq('status', 'active')], { status: 'paused' })
      await backend.update('study_cycles', [eq('id', c.id)], { status: 'active' })
    }, `Ciclo "${c.name}" ativado.`)

  const duplicate = (c: StudyCycle) =>
    run(async () => {
      const [copy] = await backend.insert('study_cycles', [{ name: `${c.name} (cópia)`.slice(0, 160), description: c.description, auto_advance: c.auto_advance, status: 'paused' }])
      const { rows } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', c.id)] })
      if (rows.length)
        await backend.insert(
          'study_cycle_items',
          rows.map((r) => ({ cycle_id: copy.id, subject_id: r.subject_id, topic_id: r.topic_id, duration_minutes: r.duration_minutes, sort_order: r.sort_order, weight: r.weight, break_minutes: r.break_minutes, activity_type: r.activity_type })),
        )
      setSelectedId(copy.id)
    }, 'Ciclo duplicado.')

  return (
    <div>
      {compact ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Ciclo de estudos</h2>
          <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ cycle: null })}>
            Novo ciclo
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Ciclo de estudos"
          description="Rodízio de matérias independente do calendário: o ciclo só avança quando você estuda o bloco. Dias sem estudo não fazem você perder a posição."
          actions={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ cycle: null })}>
              Novo ciclo
            </Button>
          }
        />
      )}
      <QueryState query={cycles}>
        {!selected ? (
          <EmptyState
            icon={<RefreshCcw className="size-8" />}
            title="Nenhum ciclo criado"
            description="Monte uma sequência de matérias com a duração de cada bloco. Ao concluir um bloco, o ciclo passa para o próximo."
            action={
              <Button variant="primary" onClick={() => setForm({ cycle: null })}>
                Criar ciclo
              </Button>
            }
          />
        ) : (
          <div className={compact ? 'space-y-4' : 'grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]'}>
            {compact && cycles.data!.length > 1 && (
              <Select aria-label="Ciclo" value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
                {cycles.data!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'active' ? ' (ativo)' : ''}
                  </option>
                ))}
              </Select>
            )}
            <nav aria-label="Ciclos" className={cn('flex-col gap-2', compact ? 'hidden' : 'flex')}>
              {cycles.data!.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left', c.id === selected.id ? 'border-accent-strong bg-accent/15' : 'border-line hover:bg-surface')}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-muted">{c.completed_rounds} volta(s) completa(s)</span>
                  </span>
                  <Badge color={c.status === 'active' ? 'var(--success)' : undefined}>{c.status === 'active' ? 'Ativo' : 'Pausado'}</Badge>
                </button>
              ))}
            </nav>
            <CycleDetail
              compact={compact}
              cycle={selected}
              onEdit={() => setForm({ cycle: selected })}
              onActivate={() => activate(selected)}
              onPause={() => run(() => backend.update('study_cycles', [eq('id', selected.id)], { status: 'paused' }), 'Ciclo pausado. A posição foi mantida.')}
              onDuplicate={() => duplicate(selected)}
              onArchive={() => run(() => backend.update('study_cycles', [eq('id', selected.id)], { status: 'archived' }), 'Ciclo arquivado.')}
              onDelete={() => safeDelete(selected.id, selected.name, { onDone: () => setSelectedId(null) })}
            />
          </div>
        )}
      </QueryState>
      <CycleForm open={Boolean(form)} cycle={form?.cycle ?? null} onClose={() => setForm(null)} onCreated={(c) => setSelectedId(c.id)} />
    </div>
  )
}

function CycleDetail(props: {
  compact?: boolean
  cycle: StudyCycle
  onEdit: () => void
  onActivate: () => void
  onPause: () => void
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { cycle } = props
  const items = useAll('study_cycle_items', { filters: [eq('cycle_id', cycle.id)], order: [{ column: 'sort_order' }] })
  const [itemForm, setItemForm] = useState<{ item: StudyCycleItem | null } | null>(null)
  const [distribute, setDistribute] = useState(false)
  const lookups = useLookups()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const live = useLiveSession()
  const updateCycle = useUpdate('study_cycles')
  const sorted = useMemo(() => sortItems(items.data ?? []), [items.data])
  const summary = summarize(cycle, sorted)

  const reorder = async (next: StudyCycleItem[]) => {
    const currentId = summary.current?.id
    try {
      await Promise.all(next.map((it, i) => (it.sort_order !== i ? backend.update('study_cycle_items', [eq('id', it.id)], { sort_order: i }) : null)))
      // Mantém a posição no mesmo bloco após reordenar.
      const idx = next.findIndex((i) => i.id === currentId)
      if (idx >= 0 && idx !== normalizeIndex(cycle.current_index, next.length)) await backend.update('study_cycles', [eq('id', cycle.id)], { current_index: idx })
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_cycle_items', 'study_cycles'])
    }
  }

  const move = (steps: 1 | -1) => updateCycle.mutateAsync({ id: cycle.id, patch: skip(cycle, sorted.length, steps) }).catch((e) => toast.error(e))
  const removeItem = async (it: StudyCycleItem) => {
    try {
      await backend.remove('study_cycle_items', [eq('id', it.id)])
      const remaining = sorted.filter((x) => x.id !== it.id)
      const currentId = summary.current?.id
      const idx = currentId === it.id ? normalizeIndex(cycle.current_index, Math.max(1, remaining.length)) : remaining.findIndex((x) => x.id === currentId)
      await backend.update('study_cycles', [eq('id', cycle.id)], { current_index: Math.max(0, idx), ...(currentId === it.id ? { current_progress_seconds: 0 } : {}) })
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['study_cycle_items', 'study_cycles'])
    }
  }

  const startCurrent = () => {
    if (!summary.current) return
    const remaining = Math.max(1, Math.ceil((summary.current.duration_minutes * 60 - cycle.current_progress_seconds) / 60))
    navigate(`/cronometro?item=${summary.current.id}&minutos=${remaining}`)
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-ink">{cycle.name}</h2>
            {cycle.description && <p className="text-sm text-muted">{cycle.description}</p>}
            <p className="mt-1 text-xs text-muted">
              {cycle.auto_advance ? 'Avança automaticamente ao concluir o bloco' : 'Avanço manual'} · {cycle.completed_rounds} volta(s) · {formatDuration(summary.totalMinutes * 60)} por volta
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cycle.status === 'active' ? (
              <Button size="sm" icon={<Pause className="size-4" />} onClick={props.onPause}>
                Pausar
              </Button>
            ) : (
              <Button size="sm" variant="primary" icon={<Play className="size-4" />} onClick={props.onActivate}>
                Ativar
              </Button>
            )}
            <ActionMenu label="Ações do ciclo">
              {(close) => (
                <>
                  <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), props.onEdit())}>
                    Editar
                  </MenuItem>
                  <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), props.onDuplicate())}>
                    Duplicar
                  </MenuItem>
                  <MenuItem icon={<RotateCcw className="size-4" />} onClick={() => (close(), void updateCycle.mutateAsync({ id: cycle.id, patch: { current_index: 0, current_progress_seconds: 0, completed_rounds: 0 } }))}>
                    Recomeçar do início
                  </MenuItem>
                  <MenuItem onClick={() => (close(), props.onArchive())}>Arquivar</MenuItem>
                  <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), props.onDelete())}>
                    Excluir
                  </MenuItem>
                </>
              )}
            </ActionMenu>
          </div>
        </div>

        {summary.current ? (
          <div className={cn('mt-5 grid gap-4 rounded-xl bg-surface p-4', !props.compact && 'sm:grid-cols-[minmax(0,1fr)_auto]')}>
            <div className="min-w-0">
              <p className="text-xs text-muted">
                Posição atual: bloco {summary.position} de {summary.length}
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink">
                <ColorDot color={lookups.subjectColor(summary.current.subject_id)} className="size-3" />
                <span className="truncate">{lookups.subjectName(summary.current.subject_id)}</span>
              </p>
              <p className="text-sm text-muted">
                {ACTIVITY_LABELS[summary.current.activity_type]}
                {summary.current.topic_id ? ` · ${lookups.topicName(summary.current.topic_id)}` : ''}
              </p>
              <div className={cn('mt-3 grid grid-cols-2 gap-3 text-sm', !props.compact && 'sm:grid-cols-4')}>
                <div>
                  <p className="text-xs text-muted">Planejado</p>
                  <p className="tabular text-ink">{summary.current.duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Executado</p>
                  <p className="tabular text-ink">{formatDuration(cycle.current_progress_seconds)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Bloco</p>
                  <p className="tabular text-ink">{Math.round(summary.blockPercent)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Volta</p>
                  <p className="tabular text-ink">{Math.round(summary.roundPercent)}%</p>
                </div>
              </div>
              <Progress value={summary.blockPercent} className="mt-3" label="Progresso do bloco atual" />
              {summary.next && (
                <p className="mt-3 text-xs text-muted">
                  Próxima matéria: <span className="font-medium text-ink">{lookups.subjectName(summary.next.subject_id)}</span> ({summary.next.duration_minutes} min)
                </p>
              )}
            </div>
            <div className={cn('flex flex-row flex-wrap items-center gap-2', !props.compact && 'sm:flex-col sm:items-stretch')}>
              <Button variant="dark" icon={<Play className="size-4" />} onClick={startCurrent} disabled={Boolean(live.data)} title={live.data ? 'Há uma sessão em andamento' : undefined}>
                Estudar bloco
              </Button>
              <div className="flex gap-2">
                <IconButton label="Voltar um bloco" variant="secondary" onClick={() => move(-1)}>
                  <SkipBack className="size-4" />
                </IconButton>
                <IconButton label="Pular para o próximo bloco" variant="secondary" onClick={() => move(1)}>
                  <SkipForward className="size-4" />
                </IconButton>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Blocos do ciclo</h3>
        <div className="flex gap-2">
          <Button size="sm" icon={<Scale className="size-4" />} onClick={() => setDistribute(true)} disabled={sorted.length === 0}>
            Distribuir por peso
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setItemForm({ item: null })}>
            Bloco
          </Button>
        </div>
      </div>
      <QueryState query={items}>
        {sorted.length === 0 ? (
          <EmptyState title="Adicione as matérias do ciclo" description="Cada bloco tem matéria, duração e, opcionalmente, um tópico e um intervalo após o bloco." />
        ) : (
          <SortableList items={sorted} onReorder={reorder}>
            <ol className="space-y-2">
              {sorted.map((it, i) => {
                const isCurrent = summary.current?.id === it.id
                const done = i < summary.position - 1
                return (
                  <SortableItem key={it.id} id={it.id}>
                    {(handle) => (
                      <li className={cn('flex items-center gap-2 rounded-lg border bg-bg px-2 py-2', isCurrent ? 'border-accent-strong' : 'border-line')}>
                        {handle}
                        <span className={cn('tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs', isCurrent ? 'bg-accent text-accent-ink' : done ? 'bg-surface-2 text-muted' : 'bg-surface text-ink')}>{i + 1}</span>
                        <ColorDot color={lookups.subjectColor(it.subject_id)} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm', done ? 'text-muted' : 'text-ink')}>{lookups.subjectName(it.subject_id)}</p>
                          <p className="truncate text-xs text-muted">
                            {ACTIVITY_LABELS[it.activity_type]}
                            {it.topic_id ? ` · ${lookups.topicName(it.topic_id)}` : ''} · peso {it.weight}
                            {it.break_minutes ? ` · pausa ${it.break_minutes} min` : ''}
                          </p>
                        </div>
                        <span className="tabular shrink-0 text-sm font-medium text-ink">{it.duration_minutes} min</span>
                        <IconButton size="sm" label="Editar bloco" onClick={() => setItemForm({ item: it })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton size="sm" label="Remover bloco" onClick={() => void removeItem(it)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </li>
                    )}
                  </SortableItem>
                )
              })}
            </ol>
          </SortableList>
        )}
      </QueryState>
      <CycleItemForm open={Boolean(itemForm)} onClose={() => setItemForm(null)} cycleId={cycle.id} item={itemForm?.item ?? null} nextOrder={sorted.length} />
      <DistributeModal open={distribute} onClose={() => setDistribute(false)} items={sorted} />
    </div>
  )
}

function CycleForm({ open, cycle, onClose, onCreated }: { open: boolean; cycle: StudyCycle | null; onClose: () => void; onCreated: (c: StudyCycle) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [auto, setAuto] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setName(cycle?.name ?? '')
      setDescription(cycle?.description ?? '')
      setAuto(cycle?.auto_advance ?? true)
      setError(null)
    }
  }, [open, cycle])
  const save = async () => {
    if (!name.trim()) return setError('Informe o nome do ciclo.')
    setBusy(true)
    try {
      const data = { name: name.trim().slice(0, 160), description: description.trim() || null, auto_advance: auto }
      if (cycle) await backend.update('study_cycles', [eq('id', cycle.id)], data)
      else {
        const { count } = await backend.list('study_cycles', { filters: [eq('status', 'active')], count: true, limit: 1 })
        const [c] = await backend.insert('study_cycles', [{ ...data, status: count ? 'paused' : 'active' }])
        onCreated(c)
      }
      toast.success('Ciclo salvo.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_cycles'])
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cycle ? 'Editar ciclo' : 'Novo ciclo'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nome" required error={error}>
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ciclo do semestre" />}
        </Field>
        <Field label="Descrição">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <Checkbox label="Avançar automaticamente quando o bloco for concluído" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
      </div>
    </Modal>
  )
}

function CycleItemForm({ open, onClose, cycleId, item, nextOrder }: { open: boolean; onClose: () => void; cycleId: string; item: StudyCycleItem | null; nextOrder: number }) {
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [duration, setDuration] = useState('60')
  const [weight, setWeight] = useState('1')
  const [breakMin, setBreakMin] = useState('0')
  const [activity, setActivity] = useState<ActivityType>('theory')
  const [error, setError] = useState<string | null>(null)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setLink({ subjectId: item?.subject_id ?? null, topicId: item?.topic_id ?? null })
    setDuration(String(item?.duration_minutes ?? 60))
    setWeight(String(item?.weight ?? 1))
    setBreakMin(String(item?.break_minutes ?? 0))
    setActivity(item?.activity_type ?? 'theory')
    setError(null)
  }, [open, item])
  const save = async () => {
    const d = Number(duration)
    const w = Number(weight.replace(',', '.'))
    const b = Number(breakMin)
    if (!link.subjectId) return setError('Escolha a matéria.')
    if (!Number.isInteger(d) || d < 5 || d > 1440) return setError('Duração entre 5 e 1440 minutos.')
    if (!(w > 0 && w <= 100)) return setError('Peso deve ser maior que 0 e até 100.')
    if (!Number.isInteger(b) || b < 0 || b > 240) return setError('Intervalo entre 0 e 240 minutos.')
    setBusy(true)
    try {
      const data = { subject_id: link.subjectId, topic_id: link.topicId, duration_minutes: d, weight: w, break_minutes: b, activity_type: activity }
      if (item) await backend.update('study_cycle_items', [eq('id', item.id)], data)
      else await backend.insert('study_cycle_items', [{ ...data, cycle_id: cycleId, sort_order: nextOrder }])
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_cycle_items'])
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar bloco do ciclo' : 'Novo bloco do ciclo'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectRequired />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Duração (min)">{(id) => <Input id={id} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <Field label="Peso">{(id) => <Input id={id} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />}</Field>
          <Field label="Intervalo após (min)">{(id) => <Input id={id} inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />}</Field>
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

function DistributeModal({ open, onClose, items }: { open: boolean; onClose: () => void; items: StudyCycleItem[] }) {
  const [total, setTotal] = useState('600')
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const lookups = useLookups()
  const [busy, setBusy] = useState(false)
  const t = Number(total)
  const result = Number.isFinite(t) && t >= 5 ? distributeByWeight(items.map((i) => Number(i.weight)), t) : null
  const apply = async () => {
    if (!result) return
    setBusy(true)
    try {
      await Promise.all(items.map((it, i) => backend.update('study_cycle_items', [eq('id', it.id)], { duration_minutes: result[i] })))
      toast.success('Durações redistribuídas.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['study_cycle_items'])
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Distribuir duração por peso"
      description="Define a duração de cada bloco proporcional ao seu peso, para o total de minutos por volta (múltiplos de 5)."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={apply} loading={busy} disabled={!result}>
            Aplicar
          </Button>
        </>
      }
    >
      <Field label="Minutos por volta do ciclo">{(id) => <Input id={id} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />}</Field>
      {result && (
        <ul className="mt-4 space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="truncate text-ink">
                {lookups.subjectName(it.subject_id)} <span className="text-muted">(peso {it.weight})</span>
              </span>
              <span className="tabular text-muted">
                {it.duration_minutes} → <strong className="text-ink">{result[i]} min</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
