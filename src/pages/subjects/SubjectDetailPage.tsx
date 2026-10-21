import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  FolderInput,
  ListPlus,
  ListTree,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, Card, ColorDot, PageHeader, Progress, Tabs } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, QueryState, Spinner, useToast } from '@/components/ui/feedback'
import { SortableItem, SortableList } from '@/components/Sortable'
import { useSafeDelete } from '@/components/useSafeDelete'
import { invalidateTables, useAll, useRow, useSessions, useUpdate } from '@/hooks/data'
import { useSubjects } from '@/hooks/domain'
import { eq, inList } from '@/lib/data/types'
import { DIFFICULTY_LABELS, PRIORITY_LABELS, SUBJECT_STATUS_LABELS, TOPIC_STATUS_COLORS, TOPIC_STATUS_LABELS } from '@/lib/labels'
import { netSeconds } from '@/lib/timer/engine'
import { formatDayKey, formatDuration, formatHours } from '@/lib/time'
import { buildTree, flattenTree, weightedProgress, type TopicNode } from '@/lib/tree'
import { cn } from '@/lib/cn'
import type { Topic } from '@/types/db'
import { SubjectForm } from './SubjectForm'
import { TopicForm } from './TopicForm'
import { TopicPanel } from './TopicPanel'
import { duplicateTopic, importOutline, moveTopic, parseOutline } from './topicOps'
import { SessionList } from '@/features/timer/SessionList'
import { SubjectCardsTab, SubjectMapsTab, SubjectQuestionsTab } from './SubjectTabs'

type Tab = 'topics' | 'sessions' | 'cards' | 'maps' | 'questions'

export default function SubjectDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const subject = useRow('subjects', id)
  const topics = useAll('topics', { filters: [eq('subject_id', id)], order: [{ column: 'sort_order' }] })
  const sessions = useSessions({ filters: [eq('subject_id', id), eq('status', 'completed')] })
  const reviews = useAll('reviews', { filters: [eq('subject_id', id), inList('status', ['planned', 'postponed'])] })
  const [tab, setTab] = useState<Tab>('topics')
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()

  const openTopicId = params.get('topico')
  const openTopic = (topics.data ?? []).find((t) => t.id === openTopicId) ?? null

  const topicStats = useMemo(() => {
    const m = new Map<string, { seconds: number; last: string | null }>()
    for (const s of sessions.data ?? []) {
      if (!s.topic_id) continue
      const cur = m.get(s.topic_id) ?? { seconds: 0, last: null }
      cur.seconds += netSeconds(s, s.pauses)
      if (!cur.last || s.started_at > cur.last) cur.last = s.started_at
      m.set(s.topic_id, cur)
    }
    return m
  }, [sessions.data])

  const nextReview = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of reviews.data ?? []) {
      if (!r.topic_id) continue
      const cur = m.get(r.topic_id)
      if (!cur || r.scheduled_for < cur) m.set(r.topic_id, r.scheduled_for)
    }
    return m
  }, [reviews.data])

  const totalSeconds = useMemo(() => (sessions.data ?? []).reduce((a, s) => a + netSeconds(s, s.pauses), 0), [sessions.data])
  const progress = weightedProgress(topics.data ?? [])

  if (subject.isPending) return <Spinner />
  if (subject.isError) return <ErrorState error={subject.error} onRetry={() => subject.refetch()} />
  if (!subject.data)
    return (
      <EmptyState
        title="Matéria não encontrada"
        description="Ela pode ter sido excluída."
        action={
          <Link to="/materias" className="text-sm underline">
            Voltar às matérias
          </Link>
        }
      />
    )
  const s = subject.data

  return (
    <div>
      <Link to="/materias" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Matérias
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ColorDot color={s.color} className="size-3.5" />
            <span className="truncate">
              {s.icon && <span className="mr-1">{s.icon}</span>}
              {s.name}
            </span>
          </span>
        }
        description={s.description ?? s.exam ?? undefined}
        actions={
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="primary" icon={<Play className="size-4" />} onClick={() => navigate(`/cronometro?materia=${s.id}`)} disabled={s.status === 'archived'}>
              Estudar
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Progresso ponderado</p>
          <p className="tabular mt-1 text-xl font-semibold">{Math.round(progress.percent)}%</p>
          <Progress value={progress.percent} color={s.color} className="mt-2" label="Progresso da matéria" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Tópicos concluídos</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {progress.done}/{progress.total}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Tempo líquido total</p>
          <p className="tabular mt-1 text-xl font-semibold">{sessions.isPending ? '…' : formatHours(totalSeconds)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Status</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge>{SUBJECT_STATUS_LABELS[s.status]}</Badge>
            <Badge>P: {PRIORITY_LABELS[s.priority]}</Badge>
            <Badge>{DIFFICULTY_LABELS[s.difficulty]}</Badge>
          </div>
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'topics', label: 'Tópicos' },
          { value: 'sessions', label: 'Sessões' },
          { value: 'cards', label: 'Flashcards' },
          { value: 'maps', label: 'Mapas mentais' },
          { value: 'questions', label: 'Questões' },
        ]}
      />

      {tab === 'topics' && (
        <QueryState query={topics}>
          <TopicTree
            subjectId={s.id}
            topics={topics.data ?? []}
            stats={topicStats}
            nextReview={nextReview}
            onOpen={(t) => setParams({ topico: t.id })}
          />
        </QueryState>
      )}
      {tab === 'sessions' && <SessionList filters={[eq('subject_id', s.id)]} />}
      {tab === 'cards' && <SubjectCardsTab subjectId={s.id} />}
      {tab === 'maps' && <SubjectMapsTab subjectId={s.id} />}
      {tab === 'questions' && <SubjectQuestionsTab subjectId={s.id} topics={topics.data ?? []} />}

      {s.notes && (
        <Card className="mt-6 p-4">
          <p className="mb-1 text-xs font-semibold text-muted uppercase">Observações</p>
          <p className="text-sm whitespace-pre-wrap text-ink">{s.notes}</p>
        </Card>
      )}

      <SubjectForm open={editing} onClose={() => setEditing(false)} subject={s} />
      <TopicPanel
        topic={openTopic}
        subject={s}
        allTopics={topics.data ?? []}
        stats={openTopic ? topicStats.get(openTopic.id) : undefined}
        nextReview={openTopic ? nextReview.get(openTopic.id) : undefined}
        onClose={() => setParams({})}
      />
    </div>
  )
}

function TopicTree({
  subjectId,
  topics,
  stats,
  nextReview,
  onOpen,
}: {
  subjectId: string
  topics: Topic[]
  stats: Map<string, { seconds: number; last: string | null }>
  nextReview: Map<string, string>
  onOpen: (t: Topic) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [term, setTerm] = useState('')
  const [form, setForm] = useState<{ parent: Topic | null; topic: Topic | null } | null>(null)
  const [moving, setMoving] = useState<Topic | null>(null)
  const [importing, setImporting] = useState<Topic | null | undefined>(undefined)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const update = useUpdate('topics')
  const safeDelete = useSafeDelete('topics')
  const navigate = useNavigate()
  const tree = useMemo(() => buildTree(topics), [topics])

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return flattenTree(tree, collapsed)
    // Pesquisa em todos os níveis: mostra correspondências e seus ancestrais.
    const byId = new Map(topics.map((x) => [x.id, x]))
    const keep = new Set<string>()
    for (const x of topics) {
      if (x.name.toLowerCase().includes(t) || (x.description ?? '').toLowerCase().includes(t)) {
        let cur: Topic | undefined = x
        while (cur) {
          keep.add(cur.id)
          cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
        }
      }
    }
    return flattenTree(tree).filter((n) => keep.has(n.id))
  }, [tree, collapsed, term, topics])

  const childrenOf = (parentId: string | null) => topics.filter((t) => t.parent_id === parentId)
  const nextOrder = (parentId: string | null) => childrenOf(parentId).reduce((m, t) => Math.max(m, t.sort_order), -1) + 1

  const reorder = async (_next: TopicNode[], moved: { id: string; overId: string }) => {
    const a = topics.find((t) => t.id === moved.id)
    const b = topics.find((t) => t.id === moved.overId)
    if (!a || !b) return
    if (a.parent_id !== b.parent_id) {
      toast.info('Arraste dentro do mesmo nível. Para mudar de nível, use "Mover para…".')
      return
    }
    const siblings = flattenTree(tree).filter((n) => n.parent_id === a.parent_id)
    const from = siblings.findIndex((x) => x.id === a.id)
    const to = siblings.findIndex((x) => x.id === b.id)
    const arr = [...siblings]
    arr.splice(to, 0, ...arr.splice(from, 1))
    try {
      await Promise.all(arr.map((t, i) => (t.sort_order !== i ? backend.update('topics', [eq('id', t.id)], { sort_order: i }) : null)))
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['topics'])
    }
  }

  const setStatus = (t: Topic, status: Topic['status']) =>
    update.mutateAsync({ id: t.id, patch: { status } }).catch((e) => toast.error(e))

  const duplicate = async (t: Topic) => {
    try {
      const n = await duplicateTopic(backend, topics, t)
      toast.success(`${n} tópico(s) duplicado(s).`)
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['topics'])
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar em todos os níveis" aria-label="Pesquisar tópicos" className="pl-9" />
        </div>
        <Button size="sm" icon={<ChevronsUpDown className="size-4" />} onClick={() => setCollapsed(new Set())}>
          Expandir
        </Button>
        <Button size="sm" icon={<ChevronsDownUp className="size-4" />} onClick={() => setCollapsed(new Set(topics.filter((t) => topics.some((c) => c.parent_id === t.id)).map((t) => t.id)))}>
          Recolher
        </Button>
        <div className="flex-1" />
        <Button size="sm" icon={<Upload className="size-4" />} onClick={() => setImporting(null)}>
          Colar estrutura
        </Button>
        <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ parent: null, topic: null })}>
          Novo tópico
        </Button>
      </div>

      {topics.length === 0 ? (
        <EmptyState
          icon={<ListTree className="size-8" />}
          title="Nenhum tópico ainda"
          description="Cadastre os tópicos do edital um a um ou cole a estrutura inteira em texto indentado."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={<Upload className="size-4" />} onClick={() => setImporting(null)}>
                Colar estrutura
              </Button>
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ parent: null, topic: null })}>
                Novo tópico
              </Button>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nenhum tópico corresponde à pesquisa" />
      ) : (
        <Card className="overflow-hidden">
          <SortableList items={visible} onReorder={reorder}>
            <ul role="tree" aria-label="Tópicos">
              {visible.map((n) => {
                const hasChildren = n.children.length > 0
                const isCollapsed = collapsed.has(n.id) && !term
                const st = stats.get(n.id)
                const review = nextReview.get(n.id)
                return (
                  <SortableItem key={n.id} id={n.id}>
                    {(handle) => (
                      <li
                        role="treeitem"
                        aria-expanded={hasChildren ? !isCollapsed : undefined}
                        aria-level={n.depth + 1}
                        className="flex items-center gap-1 border-b border-line py-1.5 pr-2 last:border-b-0 hover:bg-surface"
                        style={{ paddingLeft: `${Math.min(n.depth, 8) * 20 + 4}px` }}
                      >
                        {term ? <span className="w-7" /> : handle}
                        {hasChildren ? (
                          <button
                            className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:text-ink"
                            aria-label={isCollapsed ? `Expandir ${n.name}` : `Recolher ${n.name}`}
                            onClick={() =>
                              setCollapsed((c) => {
                                const next = new Set(c)
                                if (next.has(n.id)) next.delete(n.id)
                                else next.add(n.id)
                                return next
                              })
                            }
                          >
                            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          </button>
                        ) : (
                          <span className="w-6 shrink-0" />
                        )}
                        <button onClick={() => onOpen(n)} className="min-w-0 flex-1 py-1 text-left">
                          <span className={cn('block truncate text-sm', n.depth === 0 ? 'font-medium text-ink' : 'text-ink', n.status === 'completed' && 'text-muted line-through decoration-1')}>
                            {n.name}
                          </span>
                          <span className="flex flex-wrap gap-x-3 text-[11px] text-muted">
                            {st && <span>{formatDuration(st.seconds)} estudados</span>}
                            {n.estimated_minutes ? <span>estim. {formatDuration(n.estimated_minutes * 60)}</span> : null}
                            {review && <span>revisão {formatDayKey(review)}</span>}
                            {n.mastery > 0 && <span>domínio {n.mastery}/5</span>}
                          </span>
                        </button>
                        <select
                          value={n.status}
                          onChange={(e) => setStatus(n, e.target.value as Topic['status'])}
                          aria-label={`Status de ${n.name}`}
                          className="hidden h-7 rounded-md border border-line bg-bg px-1.5 text-xs sm:block"
                          style={{ color: TOPIC_STATUS_COLORS[n.status] }}
                        >
                          {Object.entries(TOPIC_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <ActionMenu label={`Ações de ${n.name}`}>
                          {(close) => (
                            <>
                              <MenuItem icon={<Plus className="size-4" />} onClick={() => (close(), setForm({ parent: n, topic: null }))}>
                                Adicionar subtópico
                              </MenuItem>
                              <MenuItem icon={<ListPlus className="size-4" />} onClick={() => (close(), setImporting(n))}>
                                Colar subtópicos
                              </MenuItem>
                              <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setForm({ parent: null, topic: n }))}>
                                Editar
                              </MenuItem>
                              <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), void duplicate(n))}>
                                Duplicar (com subtópicos)
                              </MenuItem>
                              <MenuItem icon={<FolderInput className="size-4" />} onClick={() => (close(), setMoving(n))}>
                                Mover para…
                              </MenuItem>
                              <MenuItem icon={<Play className="size-4" />} onClick={() => (close(), navigate(`/cronometro?materia=${subjectId}&topico=${n.id}`))}>
                                Estudar este tópico
                              </MenuItem>
                              <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void safeDelete(n.id, n.name))}>
                                Excluir
                              </MenuItem>
                            </>
                          )}
                        </ActionMenu>
                      </li>
                    )}
                  </SortableItem>
                )
              })}
            </ul>
          </SortableList>
        </Card>
      )}

      <TopicForm
        open={Boolean(form)}
        onClose={() => setForm(null)}
        subjectId={subjectId}
        parent={form?.parent}
        topic={form?.topic}
        nextOrder={nextOrder(form?.parent?.id ?? null)}
      />
      <MoveTopicModal topic={moving} topics={topics} onClose={() => setMoving(null)} />
      <ImportOutlineModal open={importing !== undefined} parent={importing ?? null} subjectId={subjectId} nextOrder={nextOrder(importing?.id ?? null)} onClose={() => setImporting(undefined)} />
    </div>
  )
}

function MoveTopicModal({ topic, topics, onClose }: { topic: Topic | null; topics: Topic[]; onClose: () => void }) {
  const subjects = useSubjects()
  const [subjectId, setSubjectId] = useState('')
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const otherTopics = useAll('topics', { filters: [eq('subject_id', subjectId)] }, { enabled: Boolean(subjectId) && subjectId !== topic?.subject_id })

  useEffect(() => {
    if (topic) {
      setSubjectId(topic.subject_id)
      setParentId(topic.parent_id ?? '')
    }
  }, [topic])

  const sameSubject = subjectId === topic?.subject_id
  const options = useMemo(() => flattenTree(buildTree(sameSubject ? topics : (otherTopics.data ?? []))), [sameSubject, topics, otherTopics.data])

  const submit = async () => {
    if (!topic) return
    setBusy(true)
    try {
      await moveTopic(backend, [...topics, ...(otherTopics.data ?? [])], topic, { subjectId, parentId: parentId || null })
      toast.success('Tópico movido.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['topics'])
    }
  }

  return (
    <Modal
      open={Boolean(topic)}
      onClose={onClose}
      title={`Mover "${topic?.name ?? ''}"`}
      description="Os subtópicos acompanham o tópico."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Mover
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Matéria de destino">
          {(id) => (
            <Select
              id={id}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                setParentId('')
              }}
            >
              {(subjects.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Dentro de">
          {(id) => (
            <Select id={id} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Nível principal da matéria</option>
              {options
                .filter((o) => o.id !== topic?.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {'  '.repeat(o.depth)}
                    {o.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

const OUTLINE_EXAMPLE = `Atos administrativos
  Conceito
  Requisitos
  Atributos
Poderes administrativos
  Poder hierárquico
  Poder de polícia`

function ImportOutlineModal({ open, parent, subjectId, nextOrder, onClose }: { open: boolean; parent: Topic | null; subjectId: string; nextOrder: number; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const nodes = useMemo(() => parseOutline(text), [text])

  useEffect(() => {
    if (open) setText('')
  }, [open])

  const submit = async () => {
    if (nodes.length === 0) return
    setBusy(true)
    try {
      const n = await importOutline(backend, subjectId, parent?.id ?? null, nodes, nextOrder)
      toast.success(`${n} tópico(s) importado(s).`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['topics'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={parent ? `Colar subtópicos em "${parent.name}"` : 'Colar estrutura do edital'}
      description="Uma linha por tópico. Use 2 espaços (ou Tab) de recuo para cada subnível. Marcadores e numeração são removidos."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={nodes.length === 0}>
            Importar {nodes.length > 0 ? `${nodes.length} tópico(s)` : ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={OUTLINE_EXAMPLE}
          aria-label="Estrutura em texto"
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const el = e.currentTarget
              const { selectionStart: a, selectionEnd: b } = el
              const next = text.slice(0, a) + '  ' + text.slice(b)
              setText(next)
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
            }
          }}
        />
        <div className="scroll-thin max-h-80 overflow-y-auto rounded-lg border border-line bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-muted uppercase">Prévia</p>
          {nodes.length === 0 ? (
            <p className="text-sm text-muted">Nada para importar ainda.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {nodes.map((n, i) => (
                <li key={i} style={{ paddingLeft: n.depth * 16 }} className="truncate text-ink">
                  {n.depth > 0 ? '└ ' : '• '}
                  {n.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
