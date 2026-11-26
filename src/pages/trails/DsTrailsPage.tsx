// Trilhas de Estudo — Ciência de Dados em quatro pilares (SQL 30%, Python 30%, ML 25%, Power BI 15%).
// Cada pilar é uma matéria e cada tópico é um tópico dela, então sessões, revisões, metas e relatórios já os
// enxergam. A ordem segue as dependências; o diagnóstico (opcional) sugere por onde começar.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ClipboardCheck, Lock, Play, Route } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui/feedback'
import { topicByKey } from '@/content/dsTrail'
import type { TrackKey, TrailTopicDef } from '@/content/dsTypes'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { useSettings } from '@/hooks/useSettings'
import { formatDayKey, formatDuration, todayKey, dayKey } from '@/lib/time'
import { TOPIC_STATE_LABELS, type TopicState } from '@/lib/trail'
import { cn } from '@/lib/cn'
import { TaskDialog, type TaskDraft } from '@/pages/planning/TaskDialog'
import { TopicSheet } from './TopicSheet'
import { useDsTrail, type TrackView } from './useDsTrail'

const isTrack = (v: string | null): v is TrackKey => v === 'sql' || v === 'python' || v === 'ml' || v === 'powerbi'

export default function DsTrailsPage() {
  const trail = useDsTrail()
  const settings = useSettings()
  const toast = useToast()
  const study = useStartStudy()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const pilar = params.get('pilar')
  const selected = trail.tracks.find((t) => t.def.key === (isTrack(pilar) ? pilar : 'sql'))!
  const openKey = params.get('topico')
  const openTopic = openKey ? topicByKey(openKey) : undefined
  const openTrack = openTopic ? (trail.tracks.find((t) => t.def.topics.some((x) => x.key === openTopic.key)) ?? selected) : selected

  const select = (key: TrackKey) => setParams({ pilar: key }, { replace: true })
  const open = (topicKey: string | null) => {
    const track = topicKey ? trail.tracks.find((t) => t.def.topics.some((x) => x.key === topicKey)) : undefined
    setParams({ pilar: track?.def.key ?? selected.def.key, ...(topicKey ? { topico: topicKey } : {}) }, { replace: true })
  }

  if (trail.error) return <ErrorState error={trail.error} onRetry={trail.refetch} />
  if (trail.loading)
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )

  if (!trail.installed)
    return (
      <div>
        <PageHeader title="Trilhas de Dados" description="Sua formação na área de dados, organizada em quatro pilares com progressão lógica." />
        <EmptyState
          icon={<Route className="size-8 text-ink" />}
          title="Ativar a trilha de Ciência de Dados"
          description={
            <>
              SQL (30%), Python (30%), Machine Learning (25%) e Power BI (15%). São {trail.tracks.reduce((n, t) => n + t.def.topics.length, 0)} tópicos em ordem de dependência, cada um com objetivo, material, exercício prático e estimativa de
              duração. Matérias que você já tem com o mesmo nome são aproveitadas: nada é duplicado.
            </>
          }
          action={
            <Button
              variant="primary"
              loading={trail.install.isPending}
              onClick={() =>
                trail.install.mutateAsync().then(
                  (r) => toast.success(`Trilha ativada: ${r.topicsCreated} tópico(s) criado(s)${r.subjectsAdopted + r.topicsAdopted ? `, ${r.subjectsAdopted + r.topicsAdopted} item(ns) já existente(s) aproveitado(s)` : ''}.`),
                  (e) => toast.error(e),
                )
              }
            >
              Ativar trilha
            </Button>
          }
        />
        <p className="mt-4 text-center text-sm text-muted">
          Procurando concursos ou outras carreiras?{' '}
          <Link to="/catalogo" className="font-medium text-ink underline underline-offset-2">
            Ver outras trilhas
          </Link>
        </p>
      </div>
    )

  const total = trail.tracks.reduce((n, t) => n + t.progress.total, 0)
  const done = trail.tracks.reduce((n, t) => n + t.progress.done, 0)
  const row = openTopic ? trail.rowByKey.get(openTopic.key) : undefined

  const startTopic = (track: TrackView, topic: TrailTopicDef) => {
    const r = trail.rowByKey.get(topic.key)
    if (!r) return
    void study.start({
      subject_id: r.subject_id,
      topic_id: r.id,
      activity_type: 'theory',
      minutes: track.def.shortSessions ? Math.min(20, topic.minutes) : null,
      source: { kind: 'topic', id: r.id, label: `${track.def.name} · ${topic.title}`, href: `/trilhas?pilar=${track.def.key}&topico=${topic.key}` },
    })
  }

  return (
    <div>
      <PageHeader
        title="Trilha de Ciência de Dados"
        description={`${done} de ${total} tópicos concluídos. A participação de cada pilar na semana segue o peso ao lado do nome.`}
        actions={
          <Link to="/projetos" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-2">
            Projetos práticos <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      {/* Os quatro pilares */}
      <div role="tablist" aria-label="Pilares da trilha" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {trail.tracks.map((t) => {
          const active = t === selected
          const pct = t.progress.total ? (t.progress.done / t.progress.total) * 100 : 0
          return (
            <button
              key={t.def.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.def.key)}
              className={cn('flex min-w-0 flex-col rounded-xl border p-4 text-left transition-colors', active ? 'border-ink bg-bg' : 'border-line hover:bg-surface-2')}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{t.def.name}</span>
                <span className={cn('tabular shrink-0 text-xs font-semibold', active ? 'text-accent' : 'text-muted')}>{t.def.share}%</span>
              </span>
              <span className="tabular mt-3 text-xs text-muted">
                {t.progress.done}/{t.progress.total} concluídos{t.progress.known > 0 && ` · ${t.progress.known} conhecido(s)`}
              </span>
              <Progress value={pct} className="mt-1.5 h-1" label={`Progresso em ${t.def.name}`} />
              <span className="mt-3 truncate text-xs text-muted">{t.next ? `Próximo: ${t.next.title}` : 'Pilar concluído'}</span>
            </button>
          )
        })}
      </div>

      {/* Pilar selecionado */}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">{selected.def.name}</h2>
            <p className="mt-1 text-sm text-muted">{selected.def.summary}</p>
            {selected.def.shortSessions && <p className="mt-1 text-xs text-muted">Pilar pensado para sessões curtas, de 10 a 20 minutos.</p>}
          </div>
          <ol className="divide-y divide-line">
            {selected.def.topics.map((topic, i) => {
              const state = trail.stateOf(topic)
              const r = trail.rowByKey.get(topic.key)
              const review = r ? trail.nextReview.get(r.id) : undefined
              const isNext = selected.next?.key === topic.key && state !== 'locked'
              return (
                <li key={topic.key} className="flex items-center gap-3 px-5 py-3">
                  <StateMark state={state} index={i + 1} />
                  <button type="button" onClick={() => open(topic.key)} className="min-w-0 flex-1 text-left">
                    <span className={cn('block truncate text-sm font-medium', state === 'locked' ? 'text-muted' : 'text-ink')}>{topic.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {isNext ? <span className="font-medium text-accent">Próximo passo · </span> : null}
                      {TOPIC_STATE_LABELS[state]} · {formatDuration(topic.minutes * 60)}
                      {review && ` · revisão em ${formatDayKey(review.scheduled_for)}`}
                      {topic.kind === 'project' && ' · projeto prático'}
                    </span>
                  </button>
                  {state !== 'done' && (
                    <Button size="sm" variant={isNext ? 'primary' : 'ghost'} icon={<Play className="size-3.5" />} onClick={() => startTopic(selected, topic)} disabled={study.pending} aria-label={`Iniciar estudo: ${topic.title}`}>
                      <span className="max-sm:sr-only">Iniciar estudo</span>
                    </Button>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <ClipboardCheck className="size-4 text-muted" aria-hidden /> Diagnóstico de {selected.def.name}
            </h2>
            {selected.lastAssessment ? (
              <>
                <p className="tabular mt-3 text-2xl font-semibold text-ink">
                  {selected.lastAssessment.correct}/{selected.lastAssessment.total}
                </p>
                <p className="mt-0.5 text-xs text-muted">Última avaliação em {formatDayKey(dayKey(new Date(selected.lastAssessment.taken_at).getTime(), settings.timezone))}. O histórico fica guardado.</p>
                {selected.lastAssessment.start_key && topicByKey(selected.lastAssessment.start_key) && (
                  <button type="button" onClick={() => open(selected.lastAssessment!.start_key)} className="mt-3 block w-full rounded-lg bg-surface-2 px-3 py-2 text-left text-xs text-ink hover:bg-track">
                    <span className="text-muted">Ponto de partida sugerido</span>
                    <span className="mt-0.5 block font-medium">{topicByKey(selected.lastAssessment.start_key)!.title}</span>
                  </button>
                )}
                <Link to={`/diagnostico/${selected.def.key}`} className="mt-3 inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-surface-2">
                  Refazer avaliação
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">Opcional. Descubra o que você já sabe e por onde vale começar, sem estudar de novo o que já domina.</p>
                <Link to={`/diagnostico/${selected.def.key}`} className="mt-3 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-medium text-bg hover:opacity-85">
                  Avaliar meu conhecimento
                </Link>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Como os estados funcionam</h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              {(
                [
                  ['done', 'Você concluiu, depois de fazer o exercício prático.'],
                  ['demonstrated', 'Acertou todas as questões do assunto numa avaliação (mínimo de duas).'],
                  ['self', 'Você indicou que já conhece. Ainda não foi avaliado.'],
                  ['locked', 'Falta concluir um pré-requisito.'],
                ] as Array<[TopicState, string]>
              ).map(([s, text]) => (
                <div key={s} className="flex gap-2.5">
                  <StateMark state={s} small />
                  <div>
                    <dt className="font-medium text-ink">{TOPIC_STATE_LABELS[s]}</dt>
                    <dd className="text-muted">{text}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-muted">Registrar tempo de estudo nunca marca um assunto como dominado.</p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Outros planos</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <Link to="/cgu" className="flex items-center justify-between gap-2 text-ink hover:underline">
                  Plano CGU 2026 <ArrowRight className="size-3.5 text-muted" aria-hidden />
                </Link>
              </li>
              <li>
                <Link to="/catalogo" className="flex items-center justify-between gap-2 text-ink hover:underline">
                  Catálogo de trilhas (concursos e carreiras) <ArrowRight className="size-3.5 text-muted" aria-hidden />
                </Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      <TopicSheet
        track={openTrack.def}
        topic={openTopic ?? null}
        row={row}
        state={openTopic ? trail.stateOf(openTopic) : 'available'}
        review={row ? trail.nextReview.get(row.id) : undefined}
        stateOf={trail.stateOf}
        onClose={() => open(null)}
        onOpenTopic={(k) => open(k)}
        onSchedule={(topic, r) => {
          open(null)
          setDraft({ task: null, date: todayKey(settings.timezone), title: `${openTrack.def.name}: ${topic.title}`, category: 'estudos', link: { subjectId: r.subject_id, topicId: r.id }, duration: openTrack.def.shortSessions ? 20 : 60 })
        }}
      />
      <TaskDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  )
}

function StateMark({ state, index, small }: { state: TopicState; index?: number; small?: boolean }) {
  const size = small ? 'size-5 text-[10px]' : 'size-7 text-xs'
  if (state === 'done')
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-ink text-bg', size)} aria-hidden>
        <Check className={small ? 'size-3' : 'size-3.5'} strokeWidth={3} />
      </span>
    )
  if (state === 'demonstrated' || state === 'self')
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full border text-ink', state === 'demonstrated' ? 'border-ink' : 'border-dashed border-muted', size)} aria-hidden>
        <Check className={small ? 'size-3' : 'size-3.5'} />
      </span>
    )
  if (state === 'locked')
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted', size)} aria-hidden>
        <Lock className={small ? 'size-2.5' : 'size-3'} />
      </span>
    )
  return (
    <span className={cn('tabular flex shrink-0 items-center justify-center rounded-full border font-semibold', state === 'in_progress' ? 'border-accent text-accent' : 'border-line text-muted', size)} aria-hidden>
      {index ?? ''}
    </span>
  )
}
