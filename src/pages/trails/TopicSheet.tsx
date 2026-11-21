// Detalhe de um tópico da trilha: objetivo, pré-requisitos, conteúdo, material, exercício prático, duração,
// estado, próxima revisão e as ações (iniciar estudo, agendar, registrar prática, concluir).
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, ExternalLink, FlaskConical, FolderGit2, Lock, Play, RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { topicByKey } from '@/content/dsTrail'
import { templatesForTopic } from '@/content/dsProjects'
import type { TrackDef, TrailTopicDef } from '@/content/dsTypes'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { invalidateTables } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { formatDayKey, formatDuration, todayKey } from '@/lib/time'
import { TOPIC_STATE_LABELS, type TopicState } from '@/lib/trail'
import { scheduleTopicReviews } from '@/services/dsTrail'
import type { Patch, Review, Topic } from '@/types/db'

export function TopicSheet({
  track,
  topic,
  row,
  state,
  review,
  stateOf,
  onClose,
  onSchedule,
  onOpenTopic,
}: {
  track: TrackDef
  topic: TrailTopicDef | null
  row: Topic | undefined
  state: TopicState
  review: Review | undefined
  stateOf: (def: TrailTopicDef) => TopicState
  onClose: () => void
  onSchedule: (topic: TrailTopicDef, row: Topic) => void
  onOpenTopic: (key: string) => void
}) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const settings = useSettings()
  const study = useStartStudy()
  if (!topic) return null

  const patch = async (p: Patch<'topics'>, message?: string) => {
    if (!row) return
    try {
      await backend.update('topics', [eq('id', row.id)], p)
      if (message) toast.success(message)
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['topics', 'reviews'])
    }
  }

  const complete = async () => {
    if (!row) return
    await patch({ status: 'completed' }, 'Tópico concluído.')
    if (settings.autoReviews) {
      try {
        const n = await scheduleTopicReviews(backend, row, settings.reviewIntervals, todayKey(settings.timezone))
        if (n) toast.info(`${n} revisão(ões) agendada(s).`)
      } catch {
        /* a conclusão já foi salva; as revisões podem ser criadas depois em Revisões */
      }
      await invalidateTables(qc, ['reviews'])
    }
  }

  const prereqs = topic.prerequisites.map((k) => topicByKey(k)).filter(Boolean) as TrailTopicDef[]
  const pending = prereqs.filter((p) => !['done', 'demonstrated', 'self'].includes(stateOf(p)))
  const practiced = Boolean(row?.practiced_at)
  const canComplete = practiced || row?.knowledge === 'demonstrated'
  const templates = templatesForTopic(topic.key)
  const label = `${track.name} · ${topic.title}`
  const start = () => {
    if (!row) return
    onClose()
    void study.start({
      subject_id: row.subject_id,
      topic_id: row.id,
      activity_type: 'theory',
      minutes: track.shortSessions ? Math.min(20, topic.minutes) : null,
      source: { kind: 'topic', id: row.id, label, href: `/trilhas?pilar=${track.key}&topico=${topic.key}` },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={topic.title}
      description={`${track.name} · estimativa de ${formatDuration(topic.minutes * 60)}`}
      footer={
        <>
          {row && state !== 'done' && (
            <Button icon={<CalendarPlus className="size-4" />} onClick={() => onSchedule(topic, row)} className="mr-auto">
              Agendar
            </Button>
          )}
          {state === 'done' ? (
            <Button icon={<RotateCcw className="size-4" />} onClick={() => patch({ status: 'in_progress' }, 'Tópico reaberto.')}>
              Reabrir
            </Button>
          ) : (
            <Button onClick={complete} disabled={!canComplete} title={canComplete ? undefined : 'Registre o exercício prático antes de concluir'} icon={<Check className="size-4" />}>
              Concluir tópico
            </Button>
          )}
          <Button variant="primary" icon={<Play className="size-4" />} onClick={start} loading={study.pending} disabled={!row}>
            Iniciar estudo
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={state === 'locked' ? 'text-muted' : undefined}>
            {state === 'locked' && <Lock className="size-3" aria-hidden />}
            {TOPIC_STATE_LABELS[state]}
          </Badge>
          {practiced && <Badge>Exercício prático feito</Badge>}
          {review && <Badge>Próxima revisão: {formatDayKey(review.scheduled_for)}</Badge>}
          {state === 'done' && !review && <span className="text-xs text-muted">Sem revisão agendada.</span>}
        </div>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Objetivo de aprendizagem</h3>
          <p className="mt-1.5 leading-relaxed text-ink">{topic.objective}</p>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Pré-requisitos</h3>
          {prereqs.length === 0 ? (
            <p className="mt-1.5 text-muted">Nenhum: pode começar por aqui.</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {prereqs.map((p) => {
                const ok = ['done', 'demonstrated', 'self'].includes(stateOf(p))
                return (
                  <li key={p.key}>
                    <button type="button" onClick={() => onOpenTopic(p.key)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:bg-surface-2">
                      {ok ? <Check className="size-3" aria-hidden /> : <Lock className="size-3 text-accent" aria-hidden />}
                      {p.title}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {pending.length > 0 && <p className="mt-2 text-xs text-accent">Falta: {pending.map((p) => p.title).join(', ')}. Você pode estudar mesmo assim, mas a ordem recomendada é concluir os pré-requisitos antes.</p>}
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Conteúdo recomendado</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink marker:text-muted">
            {topic.content.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Material associado</h3>
          <ul className="mt-1.5 space-y-1">
            {topic.materials.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-ink underline underline-offset-2 hover:text-accent">
                  {m.title} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-surface-2 p-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Exercício prático</h3>
          <p className="mt-1.5 leading-relaxed text-ink">{topic.exercise.prompt}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {topic.exercise.lab && (
              <Link to={`/laboratorio?trilha=${topic.exercise.lab.track}&nivel=${topic.exercise.lab.level}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-bg px-3 text-sm font-medium text-ink hover:bg-surface-2">
                <FlaskConical className="size-4" aria-hidden /> Abrir desafios no laboratório
              </Link>
            )}
            {topic.kind === 'project' || templates.length > 0 ? (
              <Link to={`/projetos?topico=${topic.key}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-bg px-3 text-sm font-medium text-ink hover:bg-surface-2">
                <FolderGit2 className="size-4" aria-hidden /> {templates.length ? `${templates.length} projeto(s) sugerido(s)` : 'Ver projetos'}
              </Link>
            ) : null}
            {row && (
              <Button size="sm" variant={practiced ? 'ghost' : 'dark'} icon={<Check className="size-4" />} onClick={() => patch({ practiced_at: practiced ? null : new Date().toISOString() }, practiced ? undefined : 'Exercício registrado.')}>
                {practiced ? 'Desfazer registro do exercício' : 'Fiz o exercício'}
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">Um tópico só pode ser concluído depois do exercício prático (ou de demonstrar o conhecimento numa avaliação). Tempo de estudo sozinho não conclui nada.</p>
        </section>

        {row && state !== 'done' && state !== 'demonstrated' && (
          <section className="border-t border-line pt-4">
            <p className="text-xs text-muted">
              {row.knowledge === 'self' ? (
                <>
                  Você indicou que já conhece este assunto (autodeclarado, ainda não avaliado).{' '}
                  <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => patch({ knowledge: null })}>
                    Desfazer
                  </button>
                </>
              ) : (
                <>
                  Já domina este assunto?{' '}
                  <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => patch({ knowledge: 'self' }, 'Marcado como conhecimento prévio (autodeclarado).')}>
                    Indicar conhecimento prévio
                  </button>{' '}
                  ou{' '}
                  <Link to={`/diagnostico/${track.key}`} className="font-medium text-ink underline underline-offset-2">
                    comprovar numa avaliação
                  </Link>
                  .
                </>
              )}
            </p>
          </section>
        )}
      </div>
    </Modal>
  )
}
