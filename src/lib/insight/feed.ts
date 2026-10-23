// Feed de evolução: conquistas reais, calculadas dos dados (nada social,
// nada inventado). Compara o estado de hoje com o de 3 semanas atrás usando a
// mesma fórmula de domínio, e registra marcos de constância e volume.
import { breakdown } from '@/lib/stats'
import { addDays, dayKey, formatDuration, startOfWeek, type DayKey } from '@/lib/time'
import { masteryIndex, type InsightInput } from './evidence'
import { DAY_MS } from './mastery'

export interface FeedEvent {
  id: string
  kind: 'mastery' | 'recovered' | 'subject_done' | 'weekly_goal' | 'accuracy' | 'streak' | 'reviews' | 'hours' | 'consistency' | 'weakest'
  text: string
}

const HOUR_MILESTONES = [10, 25, 50, 100, 250, 500, 1000]
const LOOKBACK_DAYS = 21

/** O que se sabia num instante passado: só linhas anteriores a `at`. */
function asOf(input: InsightInput, at: number): InsightInput {
  const day = dayKey(at, input.tz)
  return {
    ...input,
    sessions: input.sessions.filter((s) => Date.parse(s.ended_at ?? s.started_at) <= at),
    questions: input.questions.filter((q) => q.date <= day),
    errors: (input.errors ?? []).filter((e) => Date.parse(e.created_at || '1970-01-01') <= at),
    reviews: input.reviews.map((r) => (r.status === 'done' && r.done_at && Date.parse(r.done_at) > at ? { ...r, status: 'planned' as const, done_at: null } : r)),
    cards: input.cards.filter((c) => !c.last_reviewed_at || Date.parse(c.last_reviewed_at) <= at),
    game: undefined,
  }
}

export function evolutionFeed(input: InsightInput, now: number, opts: { weeklyGoalMinutes: number; reviewsDoneLast7?: number }): FeedEvent[] {
  const out: FeedEvent[] = []
  const then = now - LOOKBACK_DAYS * DAY_MS
  const nowIdx = masteryIndex(input, now)
  const pastIdx = masteryIndex(asOf(input, then), then)
  const topicName = new Map(input.topics.map((t) => [t.id, t.name]))

  // Domínio por tópico: atingiu 80%, recuperou-se de frágil, subiu bastante.
  for (const t of input.topics) {
    const a = pastIdx.byTopic.get(t.id)
    const b = nowIdx.byTopic.get(t.id)
    if (!b || b.level === 'none' || !b.own) continue
    const before = a && a.level !== 'none' ? a.value : 0
    if (before < 80 && b.value >= 80) out.push({ id: `m80:${t.id}`, kind: 'mastery', text: `${t.name} atingiu ${b.value}% de domínio.` })
    else if (a && a.level !== 'none' && before < 40 && b.value >= 60) out.push({ id: `rec:${t.id}`, kind: 'recovered', text: `${t.name} deixou de ser frágil: ${before}% → ${b.value}%.` })
    else if (a && a.level !== 'none' && b.value - before >= 10) out.push({ id: `up:${t.id}`, kind: 'mastery', text: `Seu domínio de ${topicName.get(t.id)} passou de ${before}% para ${b.value}% nas últimas três semanas.` })
  }

  // Matéria concluída (todos os tópicos-folha concluídos, o último nos últimos 30 dias).
  for (const s of input.subjects) {
    const topics = input.topics.filter((t) => t.subject_id === s.id && t.kind !== 'folder')
    const parents = new Set(topics.map((t) => t.parent_id).filter(Boolean))
    const leaves = topics.filter((t) => !parents.has(t.id))
    if (leaves.length && leaves.every((t) => t.status === 'completed')) {
      const last = Math.max(...leaves.map((t) => (t.completed_at ? Date.parse(t.completed_at) : 0)))
      if (now - last <= 30 * DAY_MS) out.push({ id: `done:${s.id}`, kind: 'subject_done', text: `Você concluiu todo o conteúdo de ${s.name}.` })
    }
  }

  // Matéria com menor domínio mudou.
  const weakest = (idx: ReturnType<typeof masteryIndex>) =>
    input.subjects
      .filter((s) => s.status === 'active')
      .map((s) => ({ s, m: idx.bySubject.get(s.id) }))
      .filter((x) => x.m && x.m.level !== 'none')
      .sort((a, b) => a.m!.value - b.m!.value)[0]?.s
  const w0 = weakest(pastIdx)
  const w1 = weakest(nowIdx)
  if (w0 && w1 && w0.id !== w1.id) out.push({ id: `weak:${w0.id}`, kind: 'weakest', text: `${w0.name} deixou de ser a sua matéria com menor domínio.` })

  // Constância e volume.
  const today = dayKey(now, input.tz)
  const all = breakdown(input.sessions, input.tz, { from: '1970-01-01', to: '9999-12-31' })
  let days7 = 0
  for (let i = 0; i < 7; i++) if ((all.byDay.get(addDays(today, -i)) ?? 0) > 0) days7++
  if (days7 >= 5) out.push({ id: `streak:${today}`, kind: 'streak', text: `Você estudou em ${days7} dos últimos 7 dias.` })

  const lastWeek = addDays(startOfWeek(today), -7)
  const lastWeekTotal = breakdown(input.sessions, input.tz, { from: lastWeek, to: addDays(lastWeek, 6) }).total
  if (opts.weeklyGoalMinutes > 0 && lastWeekTotal >= opts.weeklyGoalMinutes * 60)
    out.push({ id: `goal:${lastWeek}`, kind: 'weekly_goal', text: `Você bateu a meta semanal na semana passada (${formatDuration(lastWeekTotal)} de ${formatDuration(opts.weeklyGoalMinutes * 60)}).` })

  const daysIn = (from: DayKey, to: DayKey) => [...all.byDay].filter(([d, v]) => d >= from && d <= to && v > 0).length
  const recent28 = daysIn(addDays(today, -27), today)
  const prev28 = daysIn(addDays(today, -55), addDays(today, -28))
  if (recent28 >= prev28 + 4 && recent28 >= 8) out.push({ id: `cons:${today}`, kind: 'consistency', text: `Mais constância: ${recent28} dias de estudo nas últimas 4 semanas, contra ${prev28} nas 4 anteriores.` })

  const totalHours = all.total / 3600
  const before = breakdown(input.sessions.filter((s) => Date.parse(s.ended_at ?? s.started_at) <= now - 30 * DAY_MS), input.tz, { from: '1970-01-01', to: '9999-12-31' }).total / 3600
  const crossed = HOUR_MILESTONES.filter((h) => before < h && totalHours >= h).pop()
  if (crossed) out.push({ id: `hours:${crossed}`, kind: 'hours', text: `Você passou de ${crossed} horas líquidas de estudo (nos últimos 12 meses registrados).` })

  // Acerto: últimos 30 dias × 30 anteriores, por matéria (≥ 20 questões em cada).
  for (const s of input.subjects) {
    const range = (a: number, b: number) => input.questions.filter((q) => q.subject_id === s.id && q.date >= addDays(today, -b) && q.date <= addDays(today, -a))
    const acc = (rs: typeof input.questions) => {
      const t = rs.reduce((x, r) => x + r.total, 0)
      return t >= 20 ? rs.reduce((x, r) => x + r.correct, 0) / t : null
    }
    const cur = acc(range(0, 29))
    const prev = acc(range(30, 59))
    if (cur != null && prev != null && cur - prev >= 0.1) out.push({ id: `acc:${s.id}`, kind: 'accuracy', text: `Seu acerto em ${s.name} subiu de ${Math.round(prev * 100)}% para ${Math.round(cur * 100)}% (30 dias × 30 anteriores).` })
  }

  if ((opts.reviewsDoneLast7 ?? 0) >= 5) out.push({ id: `rev:${today}`, kind: 'reviews', text: `${opts.reviewsDoneLast7} revisões concluídas nos últimos 7 dias.` })

  return out.slice(0, 10)
}
