import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookPlus, ClipboardPaste, FilePlus2, FolderPlus, Landmark, Pencil, Play, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, Progress, Tabs } from '@/components/ui/layout'
import { EmptyState } from '@/components/ui/feedback'
import { useAll, useSessions } from '@/hooks/data'
import { eq, inList } from '@/lib/data/types'
import { DIFFICULTY_LABELS, PRIORITY_LABELS, SUBJECT_STATUS_LABELS } from '@/lib/labels'
import { netSeconds } from '@/lib/timer/engine'
import { formatDayKey, formatDuration, formatHours } from '@/lib/time'
import { SessionList } from '@/features/timer/SessionList'
import { SubjectCardsTab, SubjectMapsTab, SubjectQuestionsTab } from '@/pages/subjects/SubjectTabs'
import { descendants, keyOf, subjectsUnder, type ExplorerIndex, type ExplorerNode } from '../model'
import { useExplorerView } from '../useExplorer'
import { ChildrenView, ViewSwitch, type NodeMetrics } from './ChildrenView'
import { useExplorerActions } from './ExplorerActions'
import { NodeIcon, typeLabel } from './NodeIcon'

/** Esconde arquivados (a menos que o próprio contêiner esteja arquivado). */
function useVisibleChildren(nodes: ExplorerNode[], parentArchived: boolean) {
  const [showArchived, setShowArchived] = useState(false)
  const hidden = parentArchived || showArchived ? 0 : nodes.filter((n) => n.archived).length
  const list = parentArchived || showArchived ? nodes : nodes.filter((n) => !n.archived)
  const toggle = hidden || showArchived ? (
    <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setShowArchived((v) => !v)}>
      {showArchived ? 'Ocultar arquivados' : `${hidden} arquivado(s) oculto(s) — mostrar`}
    </button>
  ) : null
  return { list, toggle }
}

/** Raiz ("Todos") ou uma área/pasta. */
export function FolderContent({ node, index, metrics }: { node: ExplorerNode | null; index: ExplorerIndex; metrics: NodeMetrics }) {
  const actions = useExplorerActions()
  const [view, setView] = useExplorerView()
  const children = node ? node.children : index.roots
  const { list, toggle } = useVisibleChildren(children, Boolean(node?.archived))
  const subjects = node ? subjectsUnder(node) : [...index.byKey.values()].filter((n) => n.type === 'subject' && !n.archived).map((n) => n.subject!)
  const favorites = useMemo(() => (node ? [] : [...index.byKey.values()].filter((n) => n.favorite && !n.archived)), [node, index])
  const week = node ? metrics.week(node) : subjects.reduce((a, s) => a + metrics.week(index.byKey.get(keyOf('subject', s.id))!), 0)
  const progress = node ? metrics.progress(node) : null

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        {node ? <NodeIcon node={node} className="mt-1 size-6" /> : <Landmark className="mt-1 size-6 text-accent-strong" aria-hidden />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">{node ? node.name : 'Todos os estudos'}</h1>
          <p className="text-sm text-muted">
            {node ? typeLabel(node) : 'Áreas, pastas, matérias e tópicos. Clique com o botão direito (ou toque e segure) em qualquer item para ver as ações.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!node && (
            <Button icon={<Landmark className="size-4" />} onClick={() => actions.create('area', null)}>
              Nova área
            </Button>
          )}
          <Button icon={<FolderPlus className="size-4" />} onClick={() => actions.create('folder', node)}>
            {node ? 'Nova subpasta' : 'Nova pasta'}
          </Button>
          <Button variant="primary" icon={<BookPlus className="size-4" />} onClick={() => actions.create('subject', node)}>
            Nova matéria
          </Button>
          {node && (
            <Button icon={<Pencil className="size-4" />} onClick={() => actions.edit(node)}>
              Editar
            </Button>
          )}
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Matérias" value={String(subjects.length)} />
        <Kpi label="Tópicos" value={String(subjects.reduce((a, s) => a + descendants(index.byKey.get(keyOf('subject', s.id))!).filter((d) => !d.container).length, 0))} />
        <Kpi label="Estudado nesta semana" value={formatDuration(week)} />
        {progress != null ? (
          <Card className="p-3.5">
            <p className="text-xs text-muted">Conteúdo concluído</p>
            <p className="tabular mt-0.5 text-lg font-semibold text-ink">{Math.round(progress)}%</p>
            <Progress value={progress} className="mt-2" label="Conteúdo concluído" />
          </Card>
        ) : (
          <Kpi label="Favoritos" value={String(favorites.length)} />
        )}
      </div>

      {favorites.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Star className="size-4 fill-current text-accent-strong" aria-hidden /> Favoritos
          </h2>
          <ChildrenView nodes={favorites} view="cards" metrics={metrics} empty={null} />
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{node ? 'Conteúdo' : 'Tudo'}</h2>
          <div className="flex items-center gap-3">
            {toggle}
            <ViewSwitch value={view} onChange={setView} />
          </div>
        </div>
        <ChildrenView
          nodes={list}
          view={view}
          metrics={metrics}
          empty={
            <EmptyState
              icon={<FolderPlus className="size-8" />}
              title={node ? 'Pasta vazia' : 'Comece organizando seus estudos'}
              description={
                node
                  ? 'Crie subpastas ou matérias aqui, ou arraste itens da árvore para dentro desta pasta.'
                  : 'Crie uma área de estudo (ex.: um concurso, a faculdade) e organize pastas e matérias dentro dela — ou comece por uma trilha pronta.'
              }
              action={
                <Button variant="primary" icon={<BookPlus className="size-4" />} onClick={() => actions.create('subject', node)}>
                  Nova matéria
                </Button>
              }
            />
          }
        />
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </Card>
  )
}

type SubjectTab = 'content' | 'sessions' | 'cards' | 'maps' | 'questions'

export function SubjectContent({ node, metrics }: { node: ExplorerNode; metrics: NodeMetrics }) {
  const s = node.subject!
  const [tab, setTab] = useState<SubjectTab>('content')
  const [view, setView] = useExplorerView()
  const actions = useExplorerActions()
  const navigate = useNavigate()
  const sessions = useSessions({ filters: [eq('subject_id', s.id), eq('status', 'completed')] })
  const reviews = useAll('reviews', { filters: [eq('subject_id', s.id), inList('status', ['planned', 'postponed'])] })
  const topics = useMemo(() => descendants(node).map((d) => d.topic!), [node])

  // Estatísticas por tópico para as linhas da árvore/lista.
  const subjectMetrics = useMemo<NodeMetrics>(() => {
    const topicStats = new Map<string, { seconds: number; last: string | null }>()
    for (const x of sessions.data ?? []) {
      if (!x.topic_id) continue
      const cur = topicStats.get(x.topic_id) ?? { seconds: 0, last: null }
      cur.seconds += netSeconds(x, x.pauses)
      if (!cur.last || x.started_at > cur.last) cur.last = x.started_at
      topicStats.set(x.topic_id, cur)
    }
    const nextReview = new Map<string, string>()
    for (const r of reviews.data ?? []) {
      if (!r.topic_id) continue
      const cur = nextReview.get(r.topic_id)
      if (!cur || r.scheduled_for < cur) nextReview.set(r.topic_id, r.scheduled_for)
    }
    return { ...metrics, topicStats, nextReview }
  }, [sessions.data, reviews.data, metrics])

  const total = (sessions.data ?? []).reduce((a, x) => a + netSeconds(x, x.pauses), 0)
  const progress = metrics.progress(node) ?? 0
  const leaves = topics.filter((t) => t.kind !== 'folder' && !topics.some((c) => c.parent_id === t.id))
  const week = metrics.week(node)
  const goal = s.weekly_goal_hours ? s.weekly_goal_hours * 3600 : null

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <NodeIcon node={node} className="mt-1 size-6" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">{s.name}</h1>
          {(s.description || s.exam) && <p className="text-sm text-muted">{s.description ?? s.exam}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {s.status !== 'active' && <Badge>{SUBJECT_STATUS_LABELS[s.status]}</Badge>}
            <Badge>Prioridade: {PRIORITY_LABELS[s.priority]}</Badge>
            <Badge>{DIFFICULTY_LABELS[s.difficulty]}</Badge>
            {s.target_date && <Badge>Até {formatDayKey(s.target_date)}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Pencil className="size-4" />} onClick={() => actions.edit(node)}>
            Editar
          </Button>
          <Button variant="primary" icon={<Play className="size-4" />} onClick={() => navigate(`/cronometro?materia=${s.id}`)} disabled={s.status === 'archived'}>
            Estudar agora
          </Button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-xs text-muted">Conteúdo concluído</p>
          <p className="tabular mt-0.5 text-lg font-semibold text-ink">{Math.round(progress)}%</p>
          <Progress value={progress} color={s.color} className="mt-2" label="Progresso da matéria" />
        </Card>
        <Kpi label="Tópicos concluídos" value={`${leaves.filter((t) => t.status === 'completed').length}/${leaves.length}`} />
        <Kpi label="Tempo líquido total" value={sessions.isPending ? '…' : formatHours(total)} />
        <Card className="p-3.5">
          <p className="text-xs text-muted">Nesta semana</p>
          <p className="tabular mt-0.5 text-lg font-semibold text-ink">
            {formatDuration(week)}
            {goal ? <span className="text-sm font-normal text-muted"> / {s.weekly_goal_hours}h</span> : null}
          </p>
          {goal && <Progress value={(week / goal) * 100} className="mt-2" label="Meta semanal" />}
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'content', label: 'Conteúdo' },
          { value: 'sessions', label: 'Sessões' },
          { value: 'cards', label: 'Flashcards' },
          { value: 'maps', label: 'Mapas mentais' },
          { value: 'questions', label: 'Questões' },
        ]}
      />

      {tab === 'content' && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => actions.create('topic', node)}>
              Novo tópico
            </Button>
            <Button size="sm" icon={<FolderPlus className="size-4" />} onClick={() => actions.create('topic-folder', node)}>
              Nova pasta
            </Button>
            <Button size="sm" icon={<ClipboardPaste className="size-4" />} onClick={() => actions.importOutline(node)}>
              Colar estrutura (edital)
            </Button>
            <div className="flex-1" />
            <ViewSwitch value={view} onChange={setView} />
          </div>
          <ChildrenView
            nodes={node.children}
            view={view}
            metrics={subjectMetrics}
            empty={
              <EmptyState
                icon={<FilePlus2 className="size-8" />}
                title="Nenhum tópico ainda"
                description="Cadastre os tópicos um a um, crie pastas para agrupar, ou cole o edital inteiro e revise a estrutura antes de salvar."
                action={
                  <Button icon={<ClipboardPaste className="size-4" />} onClick={() => actions.importOutline(node)}>
                    Colar estrutura
                  </Button>
                }
              />
            }
          />
        </section>
      )}
      {tab === 'sessions' && <SessionList filters={[eq('subject_id', s.id)]} />}
      {tab === 'cards' && <SubjectCardsTab subjectId={s.id} />}
      {tab === 'maps' && <SubjectMapsTab subjectId={s.id} />}
      {tab === 'questions' && <SubjectQuestionsTab subjectId={s.id} topics={topics} />}

      {s.notes && (
        <Card className="mt-6 p-4">
          <p className="mb-1 text-xs font-semibold text-muted uppercase">Observações</p>
          <p className="text-sm whitespace-pre-wrap text-ink">{s.notes}</p>
        </Card>
      )}
    </div>
  )
}
