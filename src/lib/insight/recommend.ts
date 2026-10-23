// Motor de próxima ação. Determinístico e explicável: cada candidato recebe
// pontos por sinais que o app já tem, e cada ponto vira um motivo legível.
// Nada é persistido — a lista é recalculada a partir dos dados.
//
// Pontos (README → "Motor de recomendação"):
//   prioridade      3 × (prioridade da matéria + do tópico − 2)       0–24
//   peso no edital  3 × (peso − 1), até 9
//   dificuldade     2 × (dificuldade − 3)                              −4–4
//   domínio baixo   (100 − domínio) / 5 para tópicos já iniciados       0–20
//   conteúdo novo   8 para tópico ainda não estudado
//   revisão         atrasada 25 + 2/dia (até 40); vence hoje 15
//   erros recentes  2 por erro nos últimos 14 dias, até 15
//   reincidência    8 se houve erros em ≥ 2 dias diferentes nos últimos 30
//   caderno         1 por erro não resolvido no caderno, até 10
//   tempo parado    1 a cada 2 dias sem contato (a partir de 3), até 15
//   meta semanal    15 × fração que falta da meta da matéria
//   prova próxima   10 se a data-alvo da matéria está a ≤ 30 dias
//   cronograma      bloco agora/próximas 2 h 30; mais tarde hoje 10
//   ciclo           12 para a matéria do bloco atual do ciclo
//   repetição       −20 se o tópico já teve ≥ 45 min hoje; −10 se a matéria ≥ 90 min
// Excluídos: matérias arquivadas/pausadas/concluídas, pastas, itens
// ignorados hoje, tópicos dominados sem revisão pendente e sugestões que não
// cabem no tempo disponível (quando ele é conhecido).
import type { Review, StudyPlanItem, Subject, Topic } from '@/types/db'
import type { MasteryIndex } from './evidence'
import { DAY_MS } from './mastery'

export type RecommendationType = 'review' | 'study' | 'questions' | 'flashcards'

export interface Reason {
  label: string
  points: number
  /** Informação que explica a escolha sem somar pontos (ex.: acerto recente). */
  info?: boolean
}

export interface Recommendation {
  /** Estável: `${type}:${topicId ?? subjectId}`. */
  id: string
  type: RecommendationType
  subjectId: string
  topicId: string | null
  suggestedMinutes: number
  score: number
  reasons: Reason[]
  reviewId?: string
  planItemId?: string
}

export interface RecommendInput {
  subjects: Subject[]
  topics: Topic[]
  mastery: MasteryIndex
  /** Revisões planejadas/adiadas (qualquer data). */
  reviews: Review[]
  /** Blocos de hoje (pendentes ou não). */
  planToday: StudyPlanItem[]
  /** Flashcards vencidos agrupados (chave: tópico ou `subject:<id>`). */
  dueCards: Map<string, number>
  /** Segundos líquidos estudados hoje por tópico e por matéria. */
  studiedToday: { byTopic: Map<string, number>; bySubject: Map<string, number> }
  /** Segundos líquidos na semana por matéria (para a meta semanal). */
  studiedWeek: Map<string, number>
  /** Matéria do bloco atual do ciclo ativo. */
  cycleSubjectId: string | null
  /** Minutos livres restantes hoje; null = disponibilidade não configurada. */
  availableMinutes: number | null
  /** Ids de recomendações ignoradas hoje. */
  ignored: Set<string>
  today: string
  /** Minuto atual do dia (0–1439), no fuso do usuário. */
  nowMinute: number
  now: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hhmm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS)

export function recommend(input: RecommendInput): Recommendation[] {
  const subjects = new Map(input.subjects.map((s) => [s.id, s]))
  const active = (s: Subject | undefined): s is Subject => Boolean(s && s.status === 'active' && !s.archived_at)
  const parents = new Set(input.topics.filter((t) => t.parent_id).map((t) => t.parent_id))
  const out: Recommendation[] = []

  // Revisões por tópico (a mais antiga manda).
  const reviewByKey = new Map<string, Review>()
  for (const r of input.reviews) {
    if (r.status !== 'planned' && r.status !== 'postponed') continue
    if (r.scheduled_for > input.today) continue
    const k = r.topic_id ?? `subject:${r.subject_id}`
    const cur = reviewByKey.get(k)
    if (!cur || r.scheduled_for < cur.scheduled_for) reviewByKey.set(k, r)
  }

  // Blocos do cronograma de hoje que ainda não foram feitos.
  const planByKey = new Map<string, { item: StudyPlanItem; points: number; label: string }>()
  for (const p of input.planToday) {
    if (p.status !== 'pending' || !p.subject_id) continue
    const start = hhmm(p.start_time)
    const end = start + p.duration_minutes
    const soon = start <= input.nowMinute + 120 && end >= input.nowMinute
    const later = start > input.nowMinute + 120
    const late = end < input.nowMinute
    const points = soon ? 30 : late ? 20 : later ? 10 : 0
    const label = soon ? `bloco do cronograma às ${p.start_time}` : late ? `bloco das ${p.start_time} ainda não feito` : `bloco planejado às ${p.start_time}`
    const k = p.topic_id ?? `subject:${p.subject_id}`
    const cur = planByKey.get(k)
    if (points && (!cur || points > cur.points)) planByKey.set(k, { item: p, points, label })
  }

  const common = (subject: Subject, topic: Topic | null, reasons: Reason[]) => {
    const add = (label: string, points: number) => points !== 0 && reasons.push({ label, points: Math.round(points) })
    const prio = 3 * (subject.priority + (topic?.priority ?? 3) - 2)
    add(subject.priority >= 4 || (topic?.priority ?? 0) >= 4 ? 'prioridade alta' : 'prioridade', prio)
    if (topic && topic.weight > 1) add(`peso ${topic.weight} no edital`, Math.min(9, 3 * (topic.weight - 1)))
    if (subject.difficulty !== 3) add(subject.difficulty > 3 ? 'matéria difícil' : 'matéria fácil', 2 * (subject.difficulty - 3))
    const goal = subject.weekly_goal_hours ? subject.weekly_goal_hours * 3600 : 0
    if (goal > 0) {
      const done = input.studiedWeek.get(subject.id) ?? 0
      if (done < goal) add(`meta semanal: ${Math.round((done / goal) * 100)}% cumprida`, 15 * (1 - done / goal))
    }
    if (subject.target_date) {
      const d = dayDiff(subject.target_date, input.today)
      if (d >= 0 && d <= 30) add(`prova em ${d} dia${d === 1 ? '' : 's'}`, 10)
    }
    if (input.cycleSubjectId === subject.id) add('matéria do bloco atual do ciclo', 12)
    const plan = planByKey.get(topic?.id ?? `subject:${subject.id}`)
    if (plan) add(plan.label, plan.points)
    const todayTopic = topic ? (input.studiedToday.byTopic.get(topic.id) ?? 0) : 0
    const todaySubject = input.studiedToday.bySubject.get(subject.id) ?? 0
    if (todayTopic >= 45 * 60) add('já estudado hoje', -20)
    else if (todaySubject >= 90 * 60) add('matéria já bastante estudada hoje', -10)
    return plan?.item
  }

  for (const t of input.topics) {
    const s = subjects.get(t.subject_id)
    if (!active(s) || t.kind === 'folder' || parents.has(t.id)) continue
    const m = input.mastery.byTopic.get(t.id)
    const own = m?.own ?? null
    const hasData = Boolean(m && m.level !== 'none')
    const review = reviewByKey.get(t.id)
    const reasons: Reason[] = []
    const add = (label: string, points: number) => points !== 0 && reasons.push({ label, points: Math.round(points) })

    let type: RecommendationType
    if (review) {
      type = 'review'
      const late = dayDiff(input.today, review.scheduled_for)
      add(late > 0 ? `revisão atrasada há ${late} dia${late === 1 ? '' : 's'}` : 'revisão vence hoje', late > 0 ? Math.min(40, 25 + 2 * late) : 15)
    } else if (hasData && m!.value >= 80 && t.status === 'completed') continue
    else if (own && own.parts.practice == null && (own.parts.exposure ?? 0) > 0.3) {
      type = 'questions'
      add('estudado, mas sem questões registradas', 6)
    } else if (own?.recentAccuracy != null && own.recentAccuracy < 0.6) type = 'questions'
    else type = 'study'

    if (hasData) add(`domínio ${m!.value}%`, (100 - m!.value) / 5)
    else if (t.status === 'not_started') add('tópico ainda não iniciado', 8)
    if (own?.recentAccuracy != null && own.recentAccuracy < 0.7) reasons.push({ label: `${Math.round(own.recentAccuracy * 100)}% de acerto recente`, points: 0, info: true })
    if (own && own.recentWrong > 0) add(`${own.recentWrong} erro${own.recentWrong === 1 ? '' : 's'} nos últimos 14 dias`, Math.min(15, 2 * own.recentWrong))
    if (own && own.errorDays >= 2) add(`erros reincidentes (${own.errorDays} dias diferentes)`, 8)
    if (own && own.openErrors > 0) add(`${own.openErrors} erro${own.openErrors === 1 ? '' : 's'} não resolvido${own.openErrors === 1 ? '' : 's'} no caderno`, Math.min(10, own.openErrors))
    if (m?.lastContactAt != null) {
      const days = Math.floor((input.now - m.lastContactAt) / DAY_MS)
      if (days >= 3) add(`${days} dias sem estudar`, Math.min(15, days / 2))
    }
    const planItem = common(s, t, reasons)

    const base = type === 'review' ? 20 : type === 'questions' ? 25 : clamp(t.estimated_minutes ?? 35, 25, 50)
    out.push({
      id: `${type}:${t.id}`,
      type,
      subjectId: s.id,
      topicId: t.id,
      suggestedMinutes: base,
      score: 0,
      reasons,
      reviewId: review?.id,
      planItemId: planItem?.id,
    })
  }

  // Matérias sem tópicos (ou com revisão/bloco sem tópico): recomendação no nível da matéria.
  const withTopics = new Set(input.topics.filter((t) => t.kind !== 'folder').map((t) => t.subject_id))
  for (const s of input.subjects) {
    if (!active(s)) continue
    const review = reviewByKey.get(`subject:${s.id}`)
    const plan = planByKey.get(`subject:${s.id}`)
    if (withTopics.has(s.id) && !review && !plan) continue
    const reasons: Reason[] = []
    if (review) {
      const late = dayDiff(input.today, review.scheduled_for)
      reasons.push({ label: late > 0 ? `revisão atrasada há ${late} dia${late === 1 ? '' : 's'}` : 'revisão vence hoje', points: late > 0 ? Math.min(40, 25 + 2 * late) : 15 })
    }
    const m = input.mastery.bySubject.get(s.id)
    if (m && m.level !== 'none') reasons.push({ label: `domínio ${m.value}%`, points: Math.round((100 - m.value) / 5) })
    const planItem = common(s, null, reasons)
    out.push({ id: `${review ? 'review' : 'study'}:subject:${s.id}`, type: review ? 'review' : 'study', subjectId: s.id, topicId: null, suggestedMinutes: review ? 20 : plan ? plan.item.duration_minutes : 35, score: 0, reasons, reviewId: review?.id, planItemId: planItem?.id })
  }

  // Flashcards vencidos: um candidato por grupo com pelo menos 5 cartões.
  for (const [k, count] of input.dueCards) {
    if (count < 5) continue
    const topic = k.startsWith('subject:') ? null : input.topics.find((t) => t.id === k)
    const s = subjects.get(topic ? topic.subject_id : k.slice('subject:'.length))
    if (!active(s)) continue
    const reasons: Reason[] = [{ label: `${count} flashcards vencidos`, points: Math.min(30, 10 + count / 2) }]
    common(s, topic ?? null, reasons)
    out.push({ id: `flashcards:${k}`, type: 'flashcards', subjectId: s.id, topicId: topic?.id ?? null, suggestedMinutes: clamp(Math.round(count / 2), 10, 30), score: 0, reasons })
  }

  const fitted: Recommendation[] = []
  for (const r of out) {
    if (input.ignored.has(r.id)) continue
    r.score = r.reasons.reduce((a, x) => a + x.points, 0)
    // Motivos informativos (acerto recente) aparecem entre os principais, sem somar pontos.
    const rank = (x: Reason) => (x.info ? 9.5 : x.points)
    r.reasons = r.reasons.filter((x) => x.points !== 0 || x.info).sort((a, b) => rank(b) - rank(a))
    if (input.availableMinutes != null) {
      if (input.availableMinutes < 10) continue
      if (r.suggestedMinutes > input.availableMinutes) r.suggestedMinutes = Math.floor(input.availableMinutes)
    }
    fitted.push(r)
  }
  // Empate: ordem estável por tipo e id (determinístico).
  return fitted.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/**
 * Evita repetir o mesmo assunto: das N primeiras, no máximo `perSubject` da
 * mesma matéria (as demais descem na fila, sem sumir).
 */
export function diversify(list: Recommendation[], perSubject = 2): Recommendation[] {
  const count = new Map<string, number>()
  const head: Recommendation[] = []
  const tail: Recommendation[] = []
  for (const r of list) {
    const n = count.get(r.subjectId) ?? 0
    if (n < perSubject) {
      head.push(r)
      count.set(r.subjectId, n + 1)
    } else tail.push(r)
  }
  return [...head, ...tail]
}
