// Visão semanal operacional: disponibilidade, planejado, realizado, a
// distribuição por tipo de atividade e "Por que este plano?". As explicações
// usam as regras REAIS do planejador (prioridade, dificuldade, prova próxima,
// frequência, meta semanal) — e os ajustes sugeridos vêm separados, marcados
// como sugestão, a partir do desempenho e das revisões vencidas.
import type { SessionWithPauses } from '@/lib/data/types'
import { breakdown } from '@/lib/stats'
import { addDays, diffDays, formatDuration, startOfWeek, type DayKey } from '@/lib/time'
import type { ActivityType, StudyPlan, StudyPlanItem, Subject } from '@/types/db'
import type { MasteryIndex } from './evidence'
import { weeklyAvailability } from './forecast'

export type WeekBucket = 'new' | 'review' | 'questions' | 'flashcards' | 'other'

export const WEEK_BUCKET_LABELS: Record<WeekBucket, string> = {
  new: 'Conteúdo novo',
  review: 'Revisões',
  questions: 'Questões',
  flashcards: 'Flashcards',
  other: 'Outros',
}

const BUCKET: Record<ActivityType, WeekBucket> = {
  theory: 'new',
  reading: 'new',
  video: 'new',
  review: 'review',
  questions: 'questions',
  mock_exam: 'questions',
  flashcards: 'flashcards',
  other: 'other',
}

export interface WeekSummary {
  from: DayKey
  to: DayKey
  /** Minutos; null = disponibilidade não configurada. */
  availability: number | null
  planned: number
  done: number
  distribution: Array<{ bucket: WeekBucket; minutes: number }>
  /** Disponibilidade − planejado (≥ 0), quando a disponibilidade é conhecida. */
  reserve: number | null
  why: string[]
  suggestions: string[]
}

export function weekSummary(input: {
  plans: StudyPlan[]
  /** Blocos da semana (de todos os cronogramas ativos). */
  items: Array<Pick<StudyPlanItem, 'date' | 'duration_minutes' | 'status' | 'subject_id' | 'activity_type'>>
  sessions: SessionWithPauses[]
  subjects: Subject[]
  mastery: MasteryIndex | null
  /** Revisões vencidas ou que vencem nesta semana. */
  reviewsDue: number
  today: DayKey
  tz: string
}): WeekSummary {
  const from = startOfWeek(input.today)
  const to = addDays(from, 6)
  const items = input.items.filter((p) => p.date >= from && p.date <= to && p.status !== 'rescheduled')
  const planned = items.reduce((a, p) => a + p.duration_minutes, 0)
  const done = Math.round(breakdown(input.sessions, input.tz, { from, to }).total / 60)
  const availability = weeklyAvailability(input.plans, input.today)

  const dist = new Map<WeekBucket, number>()
  for (const p of items) dist.set(BUCKET[p.activity_type], (dist.get(BUCKET[p.activity_type]) ?? 0) + p.duration_minutes)
  const distribution = (['new', 'review', 'questions', 'flashcards', 'other'] as WeekBucket[]).map((bucket) => ({ bucket, minutes: dist.get(bucket) ?? 0 })).filter((d) => d.minutes > 0)

  // Por que este plano: o quanto cada matéria recebeu e o que pesou nisso.
  const subjects = new Map(input.subjects.map((s) => [s.id, s]))
  const perSubject = new Map<string, number>()
  for (const p of items) if (p.subject_id) perSubject.set(p.subject_id, (perSubject.get(p.subject_id) ?? 0) + p.duration_minutes)
  const why: string[] = []
  const frequent = new Set(input.plans.flatMap((p) => p.config.frequentSubjectIds ?? []))
  const ranked = [...perSubject].sort((a, b) => b[1] - a[1])
  const avg = ranked.length ? planned / ranked.length : 0
  for (const [id, minutes] of ranked) {
    const s = subjects.get(id)
    if (!s) continue
    const factors: string[] = []
    if (s.priority >= 4) factors.push('prioridade alta')
    if (s.difficulty >= 4) factors.push('matéria difícil')
    if (frequent.has(id)) factors.push('marcada para maior frequência')
    if (s.target_date) {
      const d = diffDays(input.today, s.target_date)
      if (d >= 0 && d < 30) factors.push(`prova em ${d} dia${d === 1 ? '' : 's'}`)
    }
    if (minutes > avg * 1.2 && factors.length) why.push(`${s.name} recebeu mais tempo (${formatDuration(minutes * 60)}): ${factors.join(', ')}.`)
    // Regra do planejador: matéria com a meta semanal coberta só recebe blocos depois das outras.
    const goal = s.weekly_goal_hours ? s.weekly_goal_hours * 60 : 0
    if (goal && minutes >= goal) why.push(`${s.name}: a meta semanal (${s.weekly_goal_hours}h) já está coberta pelos blocos planejados, por isso não recebe blocos extras antes das outras.`)
  }
  if (!why.length && ranked.length) why.push('As matérias foram distribuídas em proporção à prioridade × dificuldade de cada uma (regras do Cronograma).')

  // Ajustes sugeridos (não alteram nada): desempenho e revisões.
  const suggestions: string[] = []
  if (input.mastery) {
    const weak = input.subjects
      .filter((s) => s.status === 'active')
      .map((s) => ({ s, m: input.mastery!.bySubject.get(s.id) }))
      .filter((x) => x.m && x.m.level !== 'none' && x.m.own?.recentAccuracy != null && x.m.own.recentAccuracy < 0.6)
    for (const { s, m } of weak.slice(0, 2)) suggestions.push(`${s.name} teve ${Math.round(m!.own!.recentAccuracy! * 100)}% de acerto recente: vale incluir blocos de questões.`)
  }
  if (input.reviewsDue > 0) suggestions.push(`${input.reviewsDue} revisão(ões) vencendo: reserve cerca de ${input.reviewsDue * 20} min para elas.`)
  if (availability != null && planned > availability) suggestions.push(`O planejado passa da sua disponibilidade em ${formatDuration((planned - availability) * 60)}.`)

  return { from, to, availability, planned, done, distribution, reserve: availability == null ? null : Math.max(0, availability - planned), why, suggestions }
}
