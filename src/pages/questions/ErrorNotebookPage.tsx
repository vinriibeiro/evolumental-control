import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, NotebookPen, Trash2 } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Select } from '@/components/ui/Field'
import { Card, CardHeader, ColorDot, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { fetchAll, useInsert, useRemove, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { gte, inList, lte } from '@/lib/data/types'
import { analyzeErrors, ERROR_REASONS, ERROR_REASON_LABELS, filterErrors, joinErrors, unclassified, type ErrorFilters } from '@/lib/insight/errors'
import { addDays, formatDayKey, todayKey } from '@/lib/time'
import type { ErrorReason, QuestionError } from '@/types/db'

const PAGE = 30

/** Registros do período e a classificação dos erros deles (em lotes de ids). */
function useNotebook(from: string, to: string) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', ['question_records', 'question_errors'], 'notebook', backend.kind, from, to],
    queryFn: async () => {
      const records = await fetchAll(backend, 'question_records', { filters: [gte('date', from), lte('date', to)] })
      const ids = records.filter((r) => r.wrong > 0).map((r) => r.id)
      const errors: QuestionError[] = []
      for (let i = 0; i < ids.length; i += 100) errors.push(...(await fetchAll(backend, 'question_errors', { filters: [inList('record_id', ids.slice(i, i + 100))] })))
      return { records, errors }
    },
  })
}

export default function ErrorNotebookPage() {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const { state, setState, range } = usePeriod(today, 'month')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [reason, setReason] = useState<ErrorReason | ''>('')
  const [board, setBoard] = useState('')
  const [exam, setExam] = useState('')
  const [status, setStatus] = useState<NonNullable<ErrorFilters['status']>>('all')
  const [limit, setLimit] = useState(PAGE)
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const data = useNotebook(range.from, range.to)
  const lookups = useLookups()
  const update = useUpdate('question_errors')
  const remove = useRemove('question_errors')
  const addReview = useInsert('reviews')
  const confirm = useConfirm()
  const toast = useToast()

  const all = useMemo(() => (data.data ? joinErrors(data.data.errors, data.data.records) : []), [data.data])
  const boards = useMemo(() => [...new Set(all.map((e) => e.board).filter((b): b is string => Boolean(b)))].sort(), [all])
  const exams = useMemo(() => [...new Set(all.map((e) => e.exam).filter((b): b is string => Boolean(b)))].sort(), [all])
  const entries = useMemo(
    () => filterErrors(all, { subjectId: link.subjectId, topicId: link.topicId, reason: reason || null, board: board || null, exam: exam || null, status }),
    [all, link, reason, board, exam, status],
  )
  const analysis = useMemo(() => analyzeErrors(entries, { today, subjectName: (id) => lookups.subjectName(id) }), [entries, today, lookups])
  const pending = data.data ? unclassified(data.data.records.filter((r) => (!link.subjectId || r.subject_id === link.subjectId) && (!link.topicId || r.topic_id === link.topicId)), data.data.errors) : 0
  const name = (s: string | null, t: string | null) => [lookups.subjectName(s), t ? lookups.topicName(t) : null].filter(Boolean).join(' · ')

  const scheduleReview = async (subjectId: string | null, topicId: string) => {
    try {
      await addReview.mutateAsync({ subject_id: subjectId, topic_id: topicId, title: `Revisar erros: ${lookups.topicName(topicId)}`, scheduled_for: addDays(today, 1), origin: 'manual' })
      toast.success('Revisão agendada para amanhã.')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div>
      <PageHeader
        title="Caderno de erros"
        description="Os erros que você classificou ao registrar questões: por matéria, tópico e motivo. Só dados observados, sem diagnóstico."
        actions={
          <Link to="/questoes" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
            Registrar questões
          </Link>
        }
      />

      <Card className="mb-4 grid gap-3 p-4">
        <PeriodPicker state={state} setState={setState} range={range} today={today} />
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria" topicLabel="Tópico" emptyLabel="Todas" className="grid gap-3 sm:grid-cols-2" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Motivo">
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as ErrorReason | '')}>
                <option value="">Todos</option>
                {ERROR_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {ERROR_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Banca">
            {(id) => (
              <Select id={id} value={board} onChange={(e) => setBoard(e.target.value)}>
                <option value="">Todas</option>
                {boards.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Concurso">
            {(id) => (
              <Select id={id} value={exam} onChange={(e) => setExam(e.target.value)}>
                <option value="">Todos</option>
                {exams.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Segmented
          label="Situação"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'open', label: 'Não resolvidos' },
            { value: 'resolved', label: 'Resolvidos' },
          ]}
        />
      </Card>

      {data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : data.isPending ? (
        <Spinner />
      ) : !all.length ? (
        <EmptyState
          icon={<NotebookPen className="size-8" />}
          title="Nenhum erro classificado no período"
          description={pending ? `Há ${pending} erro(s) registrados sem motivo. Ao registrar ou editar questões, diga por que errou — leva segundos.` : 'Ao registrar questões com erros, informe o motivo para montar o seu caderno.'}
          action={
            <Link to="/questoes" className="underline">
              Ir para Questões
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Erros classificados" value={analysis.total} />
                <Fact label="Não resolvidos" value={analysis.open} />
                <Fact label="Últimos 14 dias" value={analysis.recent} />
                <Fact label="Taxa de reincidência" value={analysis.recurrenceRate == null ? '—' : `${Math.round(analysis.recurrenceRate * 100)}%`} hint="tópicos com erro em mais de um dia" />
              </dl>
              {pending > 0 && <p className="mt-3 text-xs text-muted">{pending} erro(s) do período ainda sem motivo.</p>}
            </Card>

            {analysis.observations.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-1 text-sm font-semibold text-ink">O que os dados mostram</h2>
                <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
                  {analysis.observations.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <CardHeader title="Motivos mais frequentes" />
              <ul className="space-y-2 px-4 py-3">
                {analysis.byReason.map((r) => (
                  <li key={r.reason}>
                    <div className="flex justify-between text-sm text-ink">
                      <span>{ERROR_REASON_LABELS[r.reason]}</span>
                      <span className="tabular text-muted">
                        {r.count} · {Math.round(r.share * 100)}%
                      </span>
                    </div>
                    <Progress value={r.share * 100} label={`${ERROR_REASON_LABELS[r.reason]}: ${Math.round(r.share * 100)}%`} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Por matéria" />
              <ul className="divide-y divide-line px-4">
                {analysis.bySubject.map((s) => (
                  <li key={s.id ?? 'none'} className="flex items-center gap-2 py-2 text-sm">
                    <ColorDot color={lookups.subjectColor(s.id)} />
                    <span className="min-w-0 flex-1 truncate text-ink">{lookups.subjectName(s.id)}</span>
                    <span className="tabular text-muted">{s.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {analysis.byTopic.length > 0 && (
              <Card>
                <CardHeader title="Por tópico" description="Reincidente = erros em mais de um dia." />
                <ul className="divide-y divide-line px-4">
                  {analysis.byTopic.slice(0, 10).map((t) => {
                    const subjectId = lookups.topicById.get(t.id)?.subject_id ?? null
                    return (
                      <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {lookups.topicName(t.id)}
                          {t.days >= 2 && <span className="ml-2 rounded bg-warning/15 px-1.5 text-[11px] text-ink">reincidente · {t.days} dias</span>}
                        </span>
                        <span className="tabular text-muted">{t.count}</span>
                        <IconButton size="sm" label={`Agendar revisão de ${lookups.topicName(t.id)} para amanhã`} onClick={() => void scheduleReview(subjectId, t.id)}>
                          <CalendarPlus className="size-4" />
                        </IconButton>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader title={`Erros (${entries.length})`} />
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Nenhum erro com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-line">
                {entries.slice(0, limit).map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <Checkbox
                      label={<span className="sr-only">Marcar como resolvido</span>}
                      checked={optimistic[e.id] ?? e.resolved}
                      onChange={(ev) => {
                        const resolved = ev.target.checked
                        // Otimista: muda na hora; se a gravação falhar, volta.
                        setOptimistic((o) => ({ ...o, [e.id]: resolved }))
                        update.mutate(
                          { id: e.id, patch: { resolved } },
                          {
                            onError: (err) => toast.error(err),
                            onSettled: () => setOptimistic(({ [e.id]: _, ...rest }) => rest),
                          },
                        )
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={(optimistic[e.id] ?? e.resolved) ? 'text-sm text-muted line-through' : 'text-sm text-ink'}>
                        <strong>{ERROR_REASON_LABELS[e.reason]}</strong> · {e.count} erro{e.count === 1 ? '' : 's'}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {formatDayKey(e.date)} · {name(e.subjectId, e.topicId)}
                        {e.board ? ` · ${e.board}` : ''}
                        {e.exam ? ` · ${e.exam}` : ''}
                      </p>
                      {e.note && <p className="mt-0.5 text-xs text-ink">{e.note}</p>}
                    </div>
                    <IconButton
                      size="sm"
                      label="Excluir classificação"
                      onClick={async () => {
                        if (!(await confirm({ title: 'Excluir esta classificação?', message: 'O registro de questões continua; só o motivo é removido.', confirmLabel: 'Excluir', danger: true }))) return
                        remove.mutate(e.id)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            {entries.length > limit && (
              <div className="p-3 text-center">
                <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Carregar mais
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-lg font-semibold text-ink">{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </div>
  )
}
