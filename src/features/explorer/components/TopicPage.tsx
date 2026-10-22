import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, CalendarPlus, ClipboardCheck, ExternalLink, Gamepad2, Layers, Network, NotebookPen, Pencil, Play, Plus, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Badge, Card, Progress, Tabs } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/feedback'
import { useDebounced } from '@/hooks/useDebounced'
import { useAll, useCount, useInsert, useSessions, useTransaction, useUpdate } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq, inList, lte } from '@/lib/data/types'
import { DIFFICULTY_LABELS, GOAL_METRIC_LABELS, GOAL_PERIOD_LABELS, MASTERY_TOPIC_LABELS, PRIORITY_LABELS, REVIEW_STATUS_LABELS, TOPIC_STATUS_LABELS } from '@/lib/labels'
import { searchLinks } from '@/lib/search'
import { netSeconds } from '@/lib/timer/engine'
import { addDays, formatDateTime, formatDayKey, formatDuration, minuteIso, todayKey } from '@/lib/time'
import { createMindMap } from '@/services/mindmaps'
import { SessionList } from '@/features/timer/SessionList'
import { CardForm } from '@/pages/flashcards/CardForm'
import { QuestionForm } from '@/pages/questions/QuestionsPage'
import type { Subject, Topic } from '@/types/db'
import { descendants, type ExplorerNode } from '../model'
import { estimateMastery, relatedGameSubject } from '../insights'
import { useExplorerView } from '../useExplorer'
import { ChildrenView, ViewSwitch, type NodeMetrics } from './ChildrenView'
import { useExplorerActions } from './ExplorerActions'
import { Materials } from './Materials'
import { NodeIcon } from './NodeIcon'

type Tab = 'overview' | 'notes' | 'history' | 'materials'

export function TopicPage({ node, subject, metrics }: { node: ExplorerNode; subject: Subject; metrics: NodeMetrics }) {
  const topic = node.topic!
  const [tab, setTab] = useState<Tab>('overview')
  const [cardOpen, setCardOpen] = useState(false)
  const [questionOpen, setQuestionOpen] = useState(false)
  const [view, setView] = useExplorerView()
  const actions = useExplorerActions()
  const navigate = useNavigate()
  const settings = useSettings()
  const toast = useToast()
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const today = todayKey(settings.timezone)

  // Tudo que pertence ao tópico inclui os subtópicos.
  const ids = useMemo(() => [topic.id, ...descendants(node).map((d) => d.id)], [topic.id, node])
  const sessions = useSessions({ filters: [inList('topic_id', ids), eq('status', 'completed')], order: [{ column: 'started_at', ascending: false }] })
  const questions = useAll('question_records', { filters: [inList('topic_id', ids)] })
  const reviews = useAll('reviews', { filters: [eq('topic_id', topic.id)], order: [{ column: 'scheduled_for', ascending: false }] })
  const goals = useAll('study_goals', { filters: [eq('status', 'active')] })
  const maps = useAll('mind_maps', { filters: [eq('topic_id', topic.id)], order: [{ column: 'updated_at', ascending: false }] })
  const cardCount = useCount('flashcards', [inList('topic_id', ids)])
  const dueCount = useCount('flashcards', [inList('topic_id', ids), inList('status', ['new', 'learning', 'review']), lte('due_at', minuteIso())])
  const insertReview = useInsert('reviews')
  const newMap = useTransaction(['mind_maps'], (b, title: string) => createMindMap(b, { title, subject_id: subject.id, topic_id: topic.id }))

  const seconds = (sessions.data ?? []).reduce((a, s) => a + netSeconds(s, s.pauses), 0)
  const last = sessions.data?.[0]?.started_at ?? null
  const q = (questions.data ?? []).reduce((a, r) => ({ total: a.total + r.total, correct: a.correct + r.correct }), { total: 0, correct: 0 })
  const nextReview = (reviews.data ?? []).filter((r) => r.status === 'planned' || r.status === 'postponed').map((r) => r.scheduled_for).sort()[0]
  const mastery = estimateMastery(topic.mastery, q)
  const game = relatedGameSubject(topic.name, subject.name, subject.exam)
  const relatedGoals = (goals.data ?? []).filter((g) => g.subject_id === subject.id || g.subject_id == null)
  const study = `/cronometro?materia=${subject.id}&topico=${topic.id}`
  const childMetrics: NodeMetrics = metrics

  const scheduleReview = async (days: number) => {
    try {
      await insertReview.mutateAsync({ subject_id: subject.id, topic_id: topic.id, title: `Revisar: ${topic.name}`, scheduled_for: addDays(today, days), origin: 'manual' })
      toast.success(`Revisão agendada para ${formatDayKey(addDays(today, days), 'long')}.`)
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <NodeIcon node={node} className="mt-1 size-6" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">{topic.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge>{node.container ? 'Pasta' : TOPIC_STATUS_LABELS[topic.status]}</Badge>
            <Badge>Prioridade: {PRIORITY_LABELS[topic.priority]}</Badge>
            <Badge>Dificuldade da matéria: {DIFFICULTY_LABELS[subject.difficulty]}</Badge>
            {topic.weight !== 1 && <Badge>Peso {topic.weight}</Badge>}
          </div>
        </div>
        <Button icon={<Pencil className="size-4" />} onClick={() => actions.edit(node)}>
          Editar
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" role="toolbar" aria-label="Ações do tópico">
        <Button variant="primary" icon={<Play className="size-4" />} onClick={() => navigate(study)}>
          Estudar agora
        </Button>
        <Button
          icon={<NotebookPen className="size-4" />}
          onClick={() => {
            setTab('notes')
            requestAnimationFrame(() => notesRef.current?.focus())
          }}
        >
          Adicionar anotação
        </Button>
        <Button icon={<Layers className="size-4" />} onClick={() => setCardOpen(true)}>
          Criar flashcard
        </Button>
        <Button icon={<ClipboardCheck className="size-4" />} onClick={() => setQuestionOpen(true)}>
          Registrar questão
        </Button>
        <ActionMenu label="Agendar revisão" align="left">
          {(close) => (
            <>
              {[1, 3, 7, 15, 30].map((d) => (
                <MenuItem key={d} icon={<CalendarPlus className="size-4" />} onClick={() => (close(), void scheduleReview(d))}>
                  Revisar em {d} dia{d > 1 ? 's' : ''}
                </MenuItem>
              ))}
            </>
          )}
        </ActionMenu>
        {game && (
          <Button icon={<Gamepad2 className="size-4" />} onClick={() => navigate(`/evoquest/${game}`)}>
            Abrir no EvoQuest
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Domínio estimado" value={`${mastery}%`} hint={`autoavaliação: ${MASTERY_TOPIC_LABELS[topic.mastery]}`}>
          <Progress value={mastery} className="mt-2" label="Domínio estimado" />
        </Stat>
        <Stat label="Tempo estudado" value={sessions.isPending ? '…' : formatDuration(seconds)} hint={topic.estimated_minutes ? `estimativa ${formatDuration(topic.estimated_minutes * 60)}` : undefined} />
        <Stat label="Última sessão" value={last ? formatDateTime(new Date(last).getTime(), settings.timezone, settings.hourFormat) : '—'} />
        <Stat label="Próxima revisão" value={nextReview ? formatDayKey(nextReview, 'long') : '—'} />
        <Stat label="Questões respondidas" value={String(q.total)} />
        <Stat label="Acerto" value={q.total ? `${Math.round((q.correct / q.total) * 100)}%` : '—'} hint={q.total ? `${q.correct} de ${q.total}` : undefined} />
        <Stat label="Flashcards" value={String(cardCount.data ?? 0)} hint={dueCount.data ? `${dueCount.data} para revisar agora` : undefined} />
        <Stat label="Concluído em" value={topic.completed_at ? formatDateTime(new Date(topic.completed_at).getTime(), settings.timezone) : '—'} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: node.children.length ? `Conteúdo (${node.children.length})` : 'Visão geral' },
          { value: 'notes', label: 'Anotações' },
          { value: 'history', label: 'Histórico' },
          { value: 'materials', label: 'Materiais e links' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {node.children.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">Subtópicos</h2>
                  <ViewSwitch value={view} onChange={setView} />
                </div>
                <ChildrenView nodes={node.children} view={view} metrics={childMetrics} empty={null} />
              </section>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => actions.create('topic', node)}>
                Novo subtópico
              </Button>
              <Button size="sm" onClick={() => actions.importOutline(node)}>
                Colar subtópicos
              </Button>
            </div>
            {topic.description && <p className="text-sm whitespace-pre-wrap text-ink">{topic.description}</p>}
            <Section icon={<Brain className="size-4" />} title="Revisões">
              <ul className="space-y-1 text-sm">
                {(reviews.data ?? []).slice(0, 8).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">{formatDayKey(r.scheduled_for, 'long')}</span>
                    <span className="shrink-0 text-muted">{REVIEW_STATUS_LABELS[r.status]}</span>
                  </li>
                ))}
                {reviews.data?.length === 0 && <li className="text-muted">Nenhuma revisão registrada.</li>}
              </ul>
            </Section>
          </div>
          <div className="space-y-6">
            <Section icon={<Layers className="size-4" />} title="Flashcards">
              <p className="mb-2 text-sm text-muted">
                {cardCount.data ?? 0} cartão(ões) · {dueCount.data ?? 0} para revisar agora
              </p>
              <Button size="sm" disabled={!cardCount.data} onClick={() => navigate(`/flashcards/revisar?topico=${topic.id}&modo=${dueCount.data ? 'vencidos' : 'todos'}`)}>
                Revisar cartões deste tópico
              </Button>
            </Section>
            <Section icon={<Network className="size-4" />} title="Mapas mentais">
              <ul className="mb-2 space-y-1 text-sm">
                {(maps.data ?? []).map((m) => (
                  <li key={m.id}>
                    <Link to={`/mapas/${m.id}`} className="text-ink underline-offset-2 hover:underline">
                      {m.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                icon={<Plus className="size-4" />}
                loading={newMap.isPending}
                onClick={async () => {
                  try {
                    const m = await newMap.mutateAsync(topic.name)
                    navigate(`/mapas/${m.id}`)
                  } catch (e) {
                    toast.error(e)
                  }
                }}
              >
                Novo mapa deste tópico
              </Button>
            </Section>
            <Section icon={<Target className="size-4" />} title="Metas relacionadas">
              <ul className="space-y-1 text-sm">
                {relatedGoals.slice(0, 6).map((g) => (
                  <li key={g.id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">{g.title ?? GOAL_METRIC_LABELS[g.metric]}</span>
                    <span className="shrink-0 text-muted">
                      {g.target} · {GOAL_PERIOD_LABELS[g.period].toLowerCase()}
                    </span>
                  </li>
                ))}
                {relatedGoals.length === 0 && (
                  <li className="text-muted">
                    Nenhuma meta ativa. <Link to="/metas" className="underline">Criar meta</Link>
                  </li>
                )}
              </ul>
            </Section>
            <Section icon={<Search className="size-4" />} title="Pesquisar na internet">
              <div className="flex flex-wrap gap-2">
                {searchLinks(topic.name, subject.name).map((l) => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface">
                    {l.label} <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}

      {tab === 'notes' && <NotesEditor topic={topic} textareaRef={notesRef} />}
      {tab === 'history' && <SessionList filters={[inList('topic_id', ids)]} emptyText="Nenhuma sessão registrada para este tópico." />}
      {tab === 'materials' && (
        <Card className="p-4">
          <Materials subjectId={subject.id} topicId={topic.id} />
        </Card>
      )}

      <CardForm open={cardOpen} onClose={() => setCardOpen(false)} defaults={{ subjectId: subject.id, topicId: topic.id }} />
      <QuestionForm open={questionOpen} record={null} onClose={() => setQuestionOpen(false)} defaultSubject={subject.id} defaultTopic={topic.id} today={today} />
    </div>
  )
}

function Stat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 truncate text-lg font-semibold text-ink">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted">{hint}</p>}
      {children}
    </Card>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-accent-strong">{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

/** Anotações do tópico com salvamento automático. */
function NotesEditor({ topic, textareaRef }: { topic: Topic; textareaRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const [text, setText] = useState(topic.notes ?? '')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const update = useUpdate('topics')
  const debounced = useDebounced(text, 800)
  const toast = useToast()
  const lastSaved = useRef(topic.notes ?? '')

  useEffect(() => {
    if (debounced === lastSaved.current) return
    setSaved('saving')
    update
      .mutateAsync({ id: topic.id, patch: { notes: debounced.slice(0, 10000) || null } })
      .then(() => {
        lastSaved.current = debounced
        setSaved('saved')
      })
      .catch((e) => {
        setSaved('idle')
        toast.error(e)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, topic.id])

  return (
    <div>
      <Textarea
        ref={textareaRef}
        rows={16}
        value={text}
        maxLength={10000}
        onChange={(e) => setText(e.target.value)}
        placeholder="Resumo, macetes, dúvidas, artigos de lei… Salvo automaticamente."
        aria-label="Anotações do tópico"
        className="font-[inherit] leading-relaxed"
      />
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        {saved === 'saving' ? 'Salvando…' : saved === 'saved' ? 'Salvo.' : `${text.length}/10000`}
      </p>
    </div>
  )
}
