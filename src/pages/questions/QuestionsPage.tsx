import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Card, CardHeader, ColorDot, LoadMore, PageHeader, StatCard } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useConfirm, useToast } from '@/components/ui/feedback'
import { ChartCard, RankBars, TrendLine } from '@/components/charts/Charts'
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useAll, useInsert, useList, useRemove, useUpdate } from '@/hooks/data'
import { useLookups, useSubjects } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { eq, gte, lte, type Filter } from '@/lib/data/types'
import { eachDay, formatDayKey, startOfWeek, todayKey } from '@/lib/time'
import { questionSchema, validate } from '@/lib/validation'
import type { QuestionRecord } from '@/types/db'

const pct = (n: number) => `${Math.round(n)}%`

export interface QuestionAgg {
  total: number
  correct: number
  wrong: number
  rate: number
}

export function aggregate(records: Pick<QuestionRecord, 'total' | 'correct' | 'wrong'>[]): QuestionAgg {
  const total = records.reduce((a, r) => a + r.total, 0)
  const correct = records.reduce((a, r) => a + r.correct, 0)
  const wrong = records.reduce((a, r) => a + r.wrong, 0)
  return { total, correct, wrong, rate: total ? (correct / total) * 100 : 0 }
}

export default function QuestionsPage() {
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const [params] = useSearchParams()
  const { state, setState, range } = usePeriod(today, 'month')
  const [subjectId, setSubjectId] = useState(params.get('materia') ?? '')
  const [form, setForm] = useState<{ record: QuestionRecord | null } | null>(params.get('materia') ? { record: null } : null)
  const [limit, setLimit] = useState(20)
  const subjects = useSubjects()
  const lookups = useLookups()
  const remove = useRemove('question_records')
  const confirm = useConfirm()
  const toast = useToast()

  const filters: Filter[] = [gte('date', range.from), lte('date', range.to), ...(subjectId ? [eq('subject_id', subjectId)] : [])]
  const records = useAll('question_records', { filters, order: [{ column: 'date' }] }, { keepPrevious: true })
  const list = useList('question_records', { filters, order: [{ column: 'date', ascending: false }, { column: 'created_at', ascending: false }], limit, count: true }, { keepPrevious: true })
  useEffect(() => setLimit(20), [range.from, range.to, subjectId])

  const data = useMemo(() => records.data ?? [], [records.data])
  const totals = aggregate(data)

  const evolution = useMemo(() => {
    // Por dia em períodos curtos; por semana em períodos longos.
    const days = eachDay(range.from, range.to)
    const weekly = days.length > 31
    const buckets = new Map<string, QuestionRecord[]>()
    for (const r of data) {
      const k = weekly ? startOfWeek(r.date) : r.date
      buckets.set(k, [...(buckets.get(k) ?? []), r])
    }
    const keys = weekly ? [...new Set(days.map(startOfWeek))] : days
    return keys.map((k) => {
      const a = aggregate(buckets.get(k) ?? [])
      return { label: k, acerto: a.total ? Math.round(a.rate * 10) / 10 : null, total: a.total }
    })
  }, [data, range.from, range.to])

  const bySubject = useMemo(() => {
    const m = new Map<string, QuestionRecord[]>()
    for (const r of data) m.set(r.subject_id ?? '', [...(m.get(r.subject_id ?? '') ?? []), r])
    return [...m].map(([k, rs]) => ({ id: k, ...aggregate(rs) })).sort((a, b) => b.total - a.total)
  }, [data])

  const attention = useMemo(() => {
    const m = new Map<string, QuestionRecord[]>()
    for (const r of data) {
      const k = r.topic_id ? `t:${r.topic_id}` : `s:${r.subject_id ?? ''}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m]
      .map(([k, rs]) => ({ key: k, ...aggregate(rs), subjectId: rs[0].subject_id, topicId: rs[0].topic_id }))
      .filter((x) => x.total >= 10 && x.rate < 70)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8)
  }, [data])

  return (
    <div>
      <PageHeader
        title="Questões e desempenho"
        description="Registre baterias de questões e acompanhe a taxa de acertos. Os números vêm só dos seus registros."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ record: null })}>
            Registrar questões
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PeriodPicker state={state} setState={setState} range={range} today={today} />
        <Select aria-label="Filtrar matéria" className="w-auto" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Todas as matérias</option>
          {(subjects.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Questões" value={records.isPending ? '…' : totals.total.toLocaleString('pt-BR')} />
        <StatCard label="Acertos" value={records.isPending ? '…' : totals.correct.toLocaleString('pt-BR')} />
        <StatCard label="Erros" value={records.isPending ? '…' : totals.wrong.toLocaleString('pt-BR')} hint={totals.total - totals.correct - totals.wrong > 0 ? `${totals.total - totals.correct - totals.wrong} em branco` : undefined} />
        <StatCard label="Taxa de acertos" value={records.isPending ? '…' : totals.total ? pct(totals.rate) : '—'} />
      </div>

      <QueryState query={records}>
        {data.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-8" />}
            title="Nenhum registro no período"
            description="Depois de resolver uma bateria de questões, registre total, acertos e erros."
            action={
              <Button variant="primary" onClick={() => setForm({ record: null })}>
                Registrar questões
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Evolução da taxa de acertos"
              description={evolution.length > 31 ? 'Por semana' : 'Por dia (dias sem registro ficam em branco)'}
              table={{ columns: ['Período', 'Questões', 'Acertos (%)'], rows: evolution.filter((e) => e.total).map((e) => [formatDayKey(e.label), e.total, e.acerto ?? '—']) }}
            >
              <TrendLine data={evolution} series={[{ key: 'acerto', label: 'Acertos', color: 'var(--series-1)' }]} xKey="label" format={(n) => `${n}%`} xFormat={(d) => formatDayKey(d)} domain={[0, 100]} />
            </ChartCard>
            <ChartCard title="Acertos por matéria" description="Taxa de acerto (volume entre parênteses)" table={{ columns: ['Matéria', 'Questões', 'Acertos (%)'], rows: bySubject.map((b) => [lookups.subjectName(b.id || null), b.total, Math.round(b.rate)]) }}>
              <RankBars items={bySubject.map((b) => ({ label: `${lookups.subjectName(b.id || null)} (${b.total})`, value: b.rate, color: lookups.subjectColor(b.id || null) }))} format={pct} />
            </ChartCard>
            <Card className="lg:col-span-2">
              <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Assuntos que exigem mais atenção</span>} description="Com pelo menos 10 questões e menos de 70% de acerto no período." />
              <div className="px-5 py-3">
                {attention.length === 0 ? (
                  <p className="py-3 text-sm text-muted">Nenhum assunto abaixo de 70% com volume suficiente. Continue registrando.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {attention.map((a) => (
                      <li key={a.key} className="flex items-center gap-3 py-2">
                        <ColorDot color={lookups.subjectColor(a.subjectId)} />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {a.topicId ? lookups.topicName(a.topicId) : lookups.subjectName(a.subjectId)}
                          {a.topicId && <span className="text-muted"> · {lookups.subjectName(a.subjectId)}</span>}
                        </span>
                        <span className="tabular text-xs text-muted">{a.total} questões</span>
                        <span className="tabular w-12 text-right text-sm font-semibold text-danger">{pct(a.rate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        )}
      </QueryState>

      <h2 className="mt-8 mb-3 text-base font-semibold text-ink">Histórico de registros</h2>
      <QueryState query={list}>
        {(list.data?.rows ?? []).length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium">Matéria / tópico</th>
                    <th className="px-4 py-2 font-medium">Banca / fonte</th>
                    <th className="px-4 py-2 text-right font-medium">Acertos</th>
                    <th className="px-4 py-2 text-right font-medium">%</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.data!.rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="tabular px-4 py-2 whitespace-nowrap text-ink">{formatDayKey(r.date)}</td>
                      <td className="max-w-56 px-4 py-2">
                        <span className="block truncate text-ink">{lookups.subjectName(r.subject_id)}</span>
                        {r.topic_id && <span className="block truncate text-xs text-muted">{lookups.topicName(r.topic_id)}</span>}
                      </td>
                      <td className="max-w-48 truncate px-4 py-2 text-muted">{[r.board, r.exam, r.source].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="tabular px-4 py-2 text-right text-ink">
                        {r.correct}/{r.total}
                      </td>
                      <td className="tabular px-4 py-2 text-right font-medium text-ink">{pct((r.correct / r.total) * 100)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <IconButton size="sm" label="Editar registro" onClick={() => setForm({ record: r })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton
                          size="sm"
                          label="Excluir registro"
                          onClick={async () => {
                            if (await confirm({ title: 'Excluir registro?', message: `${r.total} questões de ${formatDayKey(r.date)} deixarão de contar.`, danger: true, confirmLabel: 'Excluir' }))
                              remove.mutateAsync(r.id).then(() => toast.success('Registro excluído.'), toast.error)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore hasMore={(list.data?.count ?? 0) > limit} loading={list.isFetching} onClick={() => setLimit((l) => l + 20)} />
          </Card>
        )}
      </QueryState>
      <QuestionForm open={Boolean(form)} record={form?.record ?? null} onClose={() => setForm(null)} defaultSubject={params.get('materia')} today={today} />
    </div>
  )
}

export function QuestionForm({
  open,
  record,
  onClose,
  defaultSubject,
  defaultTopic = null,
  today,
}: {
  open: boolean
  record: QuestionRecord | null
  onClose: () => void
  defaultSubject: string | null
  defaultTopic?: string | null
  today: string
}) {
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [values, setValues] = useState({ date: today, total: '', correct: '', wrong: '', board: '', exam: '', source: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const insert = useInsert('question_records')
  const update = useUpdate('question_records')
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setLink({ subjectId: record?.subject_id ?? defaultSubject ?? null, topicId: record?.topic_id ?? defaultTopic ?? null })
    setValues({
      date: record?.date ?? today,
      total: record ? String(record.total) : '',
      correct: record ? String(record.correct) : '',
      wrong: record ? String(record.wrong) : '',
      board: record?.board ?? '',
      exam: record?.exam ?? '',
      source: record?.source ?? '',
      notes: record?.notes ?? '',
    })
    setErrors({})
  }, [open, record, defaultSubject, defaultTopic, today])
  const set = (k: keyof typeof values, v: string) => setValues((s) => ({ ...s, [k]: v }))
  // Preenche "erros" automaticamente quando ainda vazio.
  const autoWrong = values.wrong === '' && values.total !== '' && values.correct !== '' ? String(Math.max(0, Number(values.total) - Number(values.correct))) : values.wrong
  const save = async () => {
    const r = validate(questionSchema, { ...values, wrong: autoWrong, subject_id: link.subjectId, topic_id: link.topicId })
    if (!r.data) return setErrors(r.errors)
    if (r.data.date > today) return setErrors({ date: 'A data não pode estar no futuro.' })
    try {
      if (record) await update.mutateAsync({ id: record.id, patch: r.data })
      else await insert.mutateAsync(r.data)
      toast.success('Registro salvo.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  const total = Number(values.total) || 0
  const rate = total ? (Number(values.correct) / total) * 100 : null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Editar registro' : 'Registrar questões'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Data" error={errors.date}>
            {(id, d) => <Input id={id} aria-describedby={d} type="date" max={today} value={values.date} onChange={(e) => set('date', e.target.value)} />}
          </Field>
          <Field label="Respondidas" required error={errors.total}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={values.total} invalid={Boolean(errors.total)} onChange={(e) => set('total', e.target.value)} />}
          </Field>
          <Field label="Acertos" required error={errors.correct}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={values.correct} invalid={Boolean(errors.correct)} onChange={(e) => set('correct', e.target.value)} />}
          </Field>
          <Field label="Erros" error={errors.wrong} hint={values.wrong === '' && autoWrong ? 'Calculado: total − acertos' : undefined}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={values.wrong} placeholder={autoWrong} invalid={Boolean(errors.wrong)} onChange={(e) => set('wrong', e.target.value)} />}
          </Field>
        </div>
        {rate != null && Number.isFinite(rate) && rate <= 100 && <p className="text-sm text-muted">Taxa de acerto: <strong className="text-ink">{pct(rate)}</strong></p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Banca">{(id) => <Input id={id} value={values.board} onChange={(e) => set('board', e.target.value)} placeholder="Ex.: Cebraspe" />}</Field>
          <Field label="Concurso">{(id) => <Input id={id} value={values.exam} onChange={(e) => set('exam', e.target.value)} />}</Field>
          <Field label="Fonte / material">{(id) => <Input id={id} value={values.source} onChange={(e) => set('source', e.target.value)} />}</Field>
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
