// Caderno de erros: junção dos erros classificados com os registros de
// questões, filtros e indicadores. Só dados observáveis — nada de
// diagnóstico ("você é distraído"), apenas contagens e proporções.
import { addDays, type DayKey } from '@/lib/time'
import type { ErrorReason, QuestionError, QuestionRecord } from '@/types/db'

export const ERROR_REASONS: ErrorReason[] = ['nao_sabia', 'esqueci', 'interpretacao', 'distracao', 'calculo', 'confundiu', 'chute', 'outro']

export const ERROR_REASON_LABELS: Record<ErrorReason, string> = {
  nao_sabia: 'Não sabia',
  esqueci: 'Esqueci',
  interpretacao: 'Interpretação',
  distracao: 'Distração',
  calculo: 'Cálculo',
  confundiu: 'Confundiu conceitos',
  chute: 'Chute',
  outro: 'Outro',
}

export interface ErrorEntry {
  id: string
  recordId: string
  reason: ErrorReason
  count: number
  note: string | null
  resolved: boolean
  date: DayKey
  subjectId: string | null
  topicId: string | null
  board: string | null
  exam: string | null
}

export function joinErrors(errors: QuestionError[], records: QuestionRecord[]): ErrorEntry[] {
  const byId = new Map(records.map((r) => [r.id, r]))
  const out: ErrorEntry[] = []
  for (const e of errors) {
    const r = byId.get(e.record_id)
    if (!r) continue
    out.push({ id: e.id, recordId: r.id, reason: e.reason, count: e.count, note: e.note, resolved: e.resolved, date: r.date, subjectId: r.subject_id, topicId: r.topic_id, board: r.board, exam: r.exam })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export interface ErrorFilters {
  subjectId?: string | null
  topicId?: string | null
  from?: DayKey | null
  to?: DayKey | null
  reason?: ErrorReason | null
  board?: string | null
  exam?: string | null
  status?: 'all' | 'open' | 'resolved'
}

export function filterErrors(entries: ErrorEntry[], f: ErrorFilters): ErrorEntry[] {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  return entries.filter(
    (e) =>
      (!f.subjectId || e.subjectId === f.subjectId) &&
      (!f.topicId || e.topicId === f.topicId) &&
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!f.reason || e.reason === f.reason) &&
      (!f.board || norm(e.board) === norm(f.board)) &&
      (!f.exam || norm(e.exam) === norm(f.exam)) &&
      (!f.status || f.status === 'all' || (f.status === 'resolved' ? e.resolved : !e.resolved)),
  )
}

export interface ErrorAnalysis {
  total: number
  open: number
  bySubject: Array<{ id: string | null; count: number }>
  byTopic: Array<{ id: string; count: number; days: number }>
  byReason: Array<{ reason: ErrorReason; count: number; share: number }>
  /** Tópicos com erros em pelo menos dois dias diferentes. */
  recurring: Array<{ id: string; count: number; days: number }>
  recent: number
  /** Fração dos tópicos com erro que voltaram a ter erro em outro dia. */
  recurrenceRate: number | null
  observations: string[]
}

const sortDesc = <T extends { count: number }>(a: T[]) => a.sort((x, y) => y.count - x.count)

export function analyzeErrors(entries: ErrorEntry[], ctx: { today: DayKey; subjectName: (id: string | null) => string }): ErrorAnalysis {
  const total = entries.reduce((a, e) => a + e.count, 0)
  const subj = new Map<string | null, number>()
  const topic = new Map<string, { count: number; days: Set<string> }>()
  const reason = new Map<ErrorReason, number>()
  for (const e of entries) {
    subj.set(e.subjectId, (subj.get(e.subjectId) ?? 0) + e.count)
    reason.set(e.reason, (reason.get(e.reason) ?? 0) + e.count)
    if (e.topicId) {
      const t = topic.get(e.topicId) ?? { count: 0, days: new Set() }
      t.count += e.count
      t.days.add(e.date)
      topic.set(e.topicId, t)
    }
  }
  const byTopic = sortDesc([...topic].map(([id, t]) => ({ id, count: t.count, days: t.days.size })))
  const recurring = byTopic.filter((t) => t.days >= 2)
  const since = addDays(ctx.today, -14)

  const observations: string[] = []
  const byReason = sortDesc([...reason].map(([r, count]) => ({ reason: r, count, share: total ? count / total : 0 })))
  if (byReason[0] && total >= 3 && byReason[0].share >= 0.4)
    observations.push(`${Math.round(byReason[0].share * 100)}% dos erros classificados no período são de "${ERROR_REASON_LABELS[byReason[0].reason]}" (${byReason[0].count} de ${total}).`)
  for (const [sid, count] of subj) {
    if (count < 3 || subj.size < 2) continue
    const rs = new Map<ErrorReason, number>()
    for (const e of entries) if (e.subjectId === sid) rs.set(e.reason, (rs.get(e.reason) ?? 0) + e.count)
    const [topReason, n] = [...rs].sort((a, b) => b[1] - a[1])[0]
    if (n / count >= 0.4) observations.push(`${Math.round((n / count) * 100)}% dos seus erros classificados de ${ctx.subjectName(sid)} estão relacionados a "${ERROR_REASON_LABELS[topReason]}" (${n} de ${count}).`)
  }
  if (recurring.length) observations.push(`${recurring.length} tópico(s) tiveram erros em dias diferentes — vale revisar antes de avançar.`)

  return {
    total,
    open: entries.filter((e) => !e.resolved).reduce((a, e) => a + e.count, 0),
    bySubject: sortDesc([...subj].map(([id, count]) => ({ id, count }))),
    byTopic,
    byReason,
    recurring,
    recent: entries.filter((e) => e.date >= since).reduce((a, e) => a + e.count, 0),
    recurrenceRate: byTopic.length ? recurring.length / byTopic.length : null,
    observations,
  }
}

/** Erros de registros que ainda não têm motivo (wrong − soma classificada). */
export function unclassified(records: QuestionRecord[], errors: QuestionError[]): number {
  const sum = new Map<string, number>()
  for (const e of errors) sum.set(e.record_id, (sum.get(e.record_id) ?? 0) + e.count)
  return records.reduce((a, r) => a + Math.max(0, r.wrong - (sum.get(r.id) ?? 0)), 0)
}
