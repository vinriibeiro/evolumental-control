import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, BookOpen, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Input } from '@/components/ui/Field'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { SortableItem, SortableList } from '@/components/Sortable'
import { useSafeDelete } from '@/components/useSafeDelete'
import { invalidateTables, useAll, useUpdate } from '@/hooks/data'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useSettings } from '@/hooks/useSettings'
import { useBackend } from '@/app/data'
import { useQueryClient } from '@tanstack/react-query'
import { eq } from '@/lib/data/types'
import { DIFFICULTY_LABELS, PRIORITY_LABELS, SUBJECT_STATUS_LABELS } from '@/lib/labels'
import { periodRange, todayKey, formatDuration, formatDayKey } from '@/lib/time'
import { weightedProgress } from '@/lib/tree'
import type { Subject, Topic } from '@/types/db'
import { SubjectForm } from './SubjectForm'

type Filter = 'current' | 'archived' | 'all'

export default function SubjectsPage() {
  const [filter, setFilter] = useState<Filter>('current')
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<Subject | null>(null)
  const [creating, setCreating] = useState(false)
  const subjects = useAll('subjects', { order: [{ column: 'sort_order' }, { column: 'name' }] })
  const topics = useAll('topics')
  const settings = useSettings()
  const week = useMemo(() => periodRange('week', todayKey(settings.timezone)), [settings.timezone])
  const weekStats = useStudyStats(week)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()

  const list = useMemo(() => {
    const t = term.trim().toLowerCase()
    return (subjects.data ?? []).filter((s) => {
      if (filter === 'current' && s.status === 'archived') return false
      if (filter === 'archived' && s.status !== 'archived') return false
      return !t || s.name.toLowerCase().includes(t) || (s.exam ?? '').toLowerCase().includes(t)
    })
  }, [subjects.data, filter, term])

  const progressBySubject = useMemo(() => {
    const groups = new Map<string, Topic[]>()
    for (const t of topics.data ?? []) {
      const g = groups.get(t.subject_id) ?? []
      g.push(t)
      groups.set(t.subject_id, g)
    }
    return new Map([...groups].map(([k, v]) => [k, weightedProgress(v)]))
  }, [topics.data])

  const reorder = async (next: Subject[]) => {
    try {
      await Promise.all(next.map((s, i) => (s.sort_order !== i ? backend.update('subjects', [eq('id', s.id)], { sort_order: i }) : null)))
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['subjects'])
    }
  }

  return (
    <div>
      <PageHeader
        title="Matérias e tópicos"
        description="Organize o edital em matérias, tópicos e subtópicos. Arraste para reordenar."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nova matéria
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar matérias" aria-label="Pesquisar matérias" className="pl-9" />
        </div>
        <Segmented
          label="Filtrar matérias"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'current', label: 'Em uso' },
            { value: 'archived', label: 'Arquivadas' },
            { value: 'all', label: 'Todas' },
          ]}
        />
      </div>

      <QueryState query={subjects}>
        {list.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title={term ? 'Nenhuma matéria encontrada' : filter === 'archived' ? 'Nenhuma matéria arquivada' : 'Comece cadastrando suas matérias'}
            description={!term && filter !== 'archived' ? 'Cada matéria pode ter tópicos e subtópicos do edital, metas e prioridades.' : undefined}
            action={
              !term && filter !== 'archived' ? (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Nova matéria
                </Button>
              ) : undefined
            }
          />
        ) : (
          <SortableList items={list} onReorder={reorder} grid>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((s) => (
                <SortableItem key={s.id} id={s.id}>
                  {(handle) => (
                    <SubjectCard
                      subject={s}
                      handle={term ? null : handle}
                      progress={progressBySubject.get(s.id)}
                      weekSeconds={weekStats.stats.bySubject.get(s.id) ?? 0}
                      onEdit={() => setEditing(s)}
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>
        )}
      </QueryState>

      <SubjectForm open={creating} onClose={() => setCreating(false)} nextOrder={(subjects.data ?? []).length} />
      <SubjectForm open={Boolean(editing)} onClose={() => setEditing(null)} subject={editing} />
    </div>
  )
}

function SubjectCard({
  subject: s,
  handle,
  progress,
  weekSeconds,
  onEdit,
}: {
  subject: Subject
  handle: React.ReactNode
  progress?: { percent: number; done: number; total: number }
  weekSeconds: number
  onEdit: () => void
}) {
  const update = useUpdate('subjects')
  const safeDelete = useSafeDelete('subjects')
  const toast = useToast()
  const navigate = useNavigate()
  const goal = s.weekly_goal_hours ? s.weekly_goal_hours * 3600 : null
  const archive = async (on: boolean) => {
    try {
      await update.mutateAsync({ id: s.id, patch: { status: on ? 'archived' : 'active', archived_at: on ? new Date().toISOString() : null } })
      toast.success(on ? 'Matéria arquivada (o histórico foi mantido).' : 'Matéria reativada.')
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: s.color }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          {handle}
          <Link to={`/materias/${s.id}`} className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink hover:underline">
              {s.icon && <span className="mr-1.5">{s.icon}</span>}
              {s.name}
            </p>
            {s.exam && <p className="truncate text-xs text-muted">{s.exam}</p>}
          </Link>
          <ActionMenu>
            {(close) => (
              <>
                <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), onEdit())}>
                  Editar
                </MenuItem>
                {s.status === 'archived' ? (
                  <MenuItem icon={<ArchiveRestore className="size-4" />} onClick={() => (close(), archive(false))}>
                    Reativar
                  </MenuItem>
                ) : (
                  <MenuItem icon={<Archive className="size-4" />} onClick={() => (close(), archive(true))}>
                    Arquivar
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Trash2 className="size-4" />}
                  danger
                  onClick={() => {
                    close()
                    void safeDelete(s.id, s.name, { extra: 'Dica: arquivar oculta a matéria e preserva todos os vínculos.' })
                  }}
                >
                  Excluir
                </MenuItem>
              </>
            )}
          </ActionMenu>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.status !== 'active' && <Badge>{SUBJECT_STATUS_LABELS[s.status]}</Badge>}
          <Badge>Prioridade: {PRIORITY_LABELS[s.priority]}</Badge>
          <Badge>{DIFFICULTY_LABELS[s.difficulty]}</Badge>
          {s.target_date && <Badge>Até {formatDayKey(s.target_date)}</Badge>}
        </div>
        <div className="mt-auto space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Conteúdo concluído</span>
              <span className="tabular">
                {progress ? `${progress.done}/${progress.total} · ${Math.round(progress.percent)}%` : 'Sem tópicos'}
              </span>
            </div>
            <Progress value={progress?.percent ?? 0} color={s.color} label={`Progresso de ${s.name}`} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Esta semana</span>
              <span className="tabular">
                {formatDuration(weekSeconds)}
                {goal ? ` / ${s.weekly_goal_hours}h` : ''}
              </span>
            </div>
            {goal && <Progress value={(weekSeconds / goal) * 100} label={`Meta semanal de ${s.name}`} />}
          </div>
          <Button size="sm" className="w-full" icon={<Play className="size-3.5" />} onClick={() => navigate(`/cronometro?materia=${s.id}`)} disabled={s.status === 'archived'}>
            Estudar agora
          </Button>
        </div>
      </div>
    </Card>
  )
}
