// Relatório semanal "inteligente" por REGRAS: nada de IA nem de estimativas. Cada frase é
//   • um DADO  — calculado direto dos registros e mostrado com os números; ou
//   • uma SUGESTÃO POR REGRA — disparada por uma regra fixa (WEEKLY_RULES) sobre esses dados.
// Módulo puro: recebe listas simples e devolve o relatório estruturado (sem banco, sem React).
import type { CalendarTask, FlashcardReview, Project, StudyGoal, StudyPlanItem, Subject, Topic } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'
import { MIN_SAMPLE, difficulties, plannedStudy, questionTotals, type QuestionLike } from '@/lib/evolution'
import { snapshotGoals, type GoalData, type GoalSnapshot } from '@/lib/goals'
import { WEEKDAY_LABELS } from '@/lib/labels'
import type { PdfBlock, PdfReport } from '@/lib/reportPdf'
import { NO_SUBJECT, breakdown } from '@/lib/stats'
import { isStudyTask } from '@/lib/tasks'
import { addDays, dayKey, eachDay, formatDayKey, formatDuration, weekday, type DayKey, type DayRange } from '@/lib/time'

// ---------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------

export type WeeklyTask = Pick<CalendarTask, 'title' | 'date' | 'duration_minutes' | 'subject_id' | 'topic_id' | 'category' | 'done' | 'done_at' | 'priority'>
export type WeeklyPlanItem = Pick<StudyPlanItem, 'date' | 'duration_minutes' | 'subject_id' | 'status'>
export type WeeklyTopic = Pick<Topic, 'id' | 'name' | 'subject_id' | 'completed_at'>
export type WeeklyProject = Pick<Project, 'name' | 'status' | 'started_at' | 'completed_at'>

export interface WeeklyReportInput {
  /** Semana do relatório (segunda a domingo). */
  week: DayRange
  timezone: string
  /** Hoje. Dentro da semana, o relatório considera só o que já venceu; sem valor, a semana conta como encerrada. */
  today?: DayKey
  /** Sessões concluídas (com pausas) cobrindo a semana e a anterior. */
  sessions: SessionWithPauses[]
  /** Atividades da semana e as de datas anteriores ainda em aberto (ou concluídas só depois). */
  tasks: WeeklyTask[]
  planItems: WeeklyPlanItem[]
  /** Exercícios e questões da semana e da anterior. */
  questions: QuestionLike[]
  topics: WeeklyTopic[]
  goals: StudyGoal[]
  projects: WeeklyProject[]
  /** Nomes das matérias (sem isso as frases usam "Matéria excluída"). */
  subjects?: Array<Pick<Subject, 'id' | 'name'>>
  /** Só para metas de flashcards; sem a lista, essas metas ficam fora do relatório. */
  flashcardReviews?: Array<Pick<FlashcardReview, 'reviewed_at'>>
}

// ---------------------------------------------------------------------
// Regras (limiares fixos e o texto mostrado ao lado de cada sugestão)
// ---------------------------------------------------------------------

export const WEEKLY_THRESHOLDS = {
  /** Matéria abaixo desta fração do planejado vira prioridade. */
  belowPlanRatio: 0.5,
  /** Planos menores que isto (por matéria) não entram na comparação. */
  minPlannedSeconds: 30 * 60,
  /** Questões mínimas para falar da taxa de acerto de um tópico ou da semana. */
  minSample: MIN_SAMPLE,
  lowAccuracy: 70,
  nearGoalPercent: 70,
  idleDays: 2,
  goalDueDays: 7,
  minStudyForExercises: 3600,
  maxRecommendations: 5,
} as const

export const WEEKLY_RULES = {
  overdue: 'atividade com data vencida e não concluída (prioridade alta primeiro, depois a mais antiga)',
  belowPlan: 'matéria com menos de 50% do planejado (mínimo de 30 min planejados)',
  lowAccuracy: 'tópico com a menor taxa de acerto da semana, com pelo menos 10 questões e acerto abaixo de 70%',
  goalDeadline: 'meta por entregas com itens pendentes e prazo vencido ou nos próximos 7 dias',
  goalNear: 'meta numérica ainda não cumprida com 70% ou mais do alvo',
  noPlan: 'semana sem horas de estudo nem atividades planejadas',
  idleDays: '2 ou mais dias sem estudo na semana',
  noExercises: '1 hora ou mais de estudo na semana e nenhum exercício registrado',
} as const
export type WeeklyRuleId = keyof typeof WEEKLY_RULES

// ---------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------

interface StatementBase {
  id: string
  text: string
  /** Números que sustentam a frase (vão para o CSV e permitem conferir). */
  data: Record<string, number | string>
}

/** Dado: calculado diretamente dos registros. */
export interface Fact extends StatementBase {
  kind: 'fact'
  /** attention = ponto de atenção (algo ficou para trás). */
  tone: 'neutral' | 'attention'
}

/** Sugestão: gerada por uma regra fixa sobre os dados. */
export interface Recommendation extends StatementBase {
  kind: 'recommendation'
  ruleId: WeeklyRuleId
  /** Texto da regra que disparou a sugestão. */
  rule: string
  /** Ids dos dados em que a sugestão se apoia. */
  basedOn: string[]
  /** Forma curta, usada na frase-resumo. */
  short: string
}

export type Statement = Fact | Recommendation
export type SectionKey = 'planned' | 'executed' | 'advanced' | 'behind' | 'next'

export interface ReportSection {
  key: SectionKey
  question: string
  statements: Statement[]
  /** Mensagem quando não há nada a dizer na seção. */
  empty: string
}

export interface WeeklyTotals {
  plannedSeconds: number
  actualSeconds: number
  /** Realizado ÷ planejado (0–100+); null sem horas planejadas. */
  plannedPercent: number | null
  previousSeconds: number
  sessions: number
  studyDays: number
  /** Dias da semana já iniciados (7 em semanas encerradas). */
  elapsedDays: number
  idleDays: number
  tasksTotal: number
  tasksDone: number
  /** Atividades vencidas e não concluídas (da semana + arrastadas). */
  tasksLate: number
  /** Dentre as atrasadas, as que vieram de semanas anteriores. */
  tasksCarried: number
  questions: number
  correct: number
  accuracy: number | null
  previousQuestions: number
  previousAccuracy: number | null
  topicsCompleted: number
  goalsMet: number
  goalsPending: number
}

export interface WeeklySubjectRow {
  subjectId: string | null
  name: string
  plannedSeconds: number
  /** Planejado que já venceu (igual ao planejado em semanas encerradas). */
  dueSeconds: number
  actualSeconds: number
  questions: number
  correct: number
  accuracy: number | null
  topicsCompleted: number
}

export interface WeeklyDayRow {
  day: DayKey
  plannedSeconds: number
  actualSeconds: number
  tasks: number
  tasksDone: number
  questions: number
}

export interface WeeklyGoalRow {
  title: string
  kind: 'metric' | 'deliverable'
  met: boolean
  percent: number
  detail: string
}

export interface WeeklyReport {
  week: DayRange
  previousWeek: DayRange
  /** A semana ainda não terminou: os números vão até hoje. */
  inProgress: boolean
  /** Há algo planejado ou registrado na semana. */
  hasData: boolean
  totals: WeeklyTotals
  subjects: WeeklySubjectRow[]
  days: WeeklyDayRow[]
  goals: WeeklyGoalRow[]
  /** As cinco perguntas, nesta ordem: planejei, executei, avancei, fiquei para trás, priorizar. */
  sections: ReportSection[]
  /** Mesmas sugestões da última seção (no máximo 5, por ordem de prioridade). */
  recommendations: Recommendation[]
  /** O que NÃO pôde ser calculado por falta de dados (em vez de um número inventado). */
  insufficient: string[]
}

export const STATEMENT_LABELS: Record<Statement['kind'], string> = { fact: 'Dado', recommendation: 'Sugestão por regra' }

export const SECTION_QUESTIONS: Record<SectionKey, string> = {
  planned: 'O que eu planejei?',
  executed: 'O que realmente executei?',
  advanced: 'Onde avancei?',
  behind: 'Onde fiquei para trás?',
  next: 'O que devo priorizar na próxima semana?',
}

// ---------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------

const dur = (seconds: number) => formatDuration(seconds)
const pct = (v: number) => `${Math.round(v)}%`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const minutes = (seconds: number) => Math.round(seconds / 60)

/** "a, b e c" — com limite: "a, b, c e mais 2". */
function joinList(items: string[], max = 3): string {
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  if (rest > 0) return `${shown.join(', ')} e mais ${rest}`
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}` : (shown[0] ?? '')
}

// ---------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------

export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const { week, timezone: tz } = input
  const T = WEEKLY_THRESHOLDS
  const today = input.today ?? addDays(week.to, 1)
  const finished = today > week.to
  const started = today >= week.from
  const asOf = finished ? week.to : today
  const elapsed = started ? eachDay(week.from, asOf) : []
  // Datas anteriores a `cut` já venceram (em semana em andamento, hoje ainda não conta como atraso).
  const cut = finished ? addDays(week.to, 1) : today
  const closedDays = cut > week.from ? eachDay(week.from, addDays(cut, -1)) : []
  const previousWeek = { from: addDays(week.from, -7), to: addDays(week.from, -1) }
  const inWeek = (d: DayKey) => d >= week.from && d <= week.to
  const isoDay = (iso: string) => dayKey(new Date(iso).getTime(), tz)

  const names = new Map((input.subjects ?? []).map((s) => [s.id, s.name]))
  const subjectName = (id: string | null) => (id == null || id === NO_SUBJECT ? 'Sem matéria' : (names.get(id) ?? 'Matéria excluída'))
  const topicById = new Map(input.topics.map((t) => [t.id, t]))
  const topicLabel = (id: string) => {
    const t = topicById.get(id)
    return t ? `${t.name} (${subjectName(t.subject_id)})` : 'Tópico excluído'
  }

  // --- Estudo: planejado × realizado ----------------------------------
  const cur = breakdown(input.sessions, tz, week)
  const before = breakdown(input.sessions, tz, previousWeek)
  const planned = plannedStudy(input.planItems, input.tasks, week)
  const due = closedDays.length ? plannedStudy(input.planItems, input.tasks, { from: week.from, to: closedDays[closedDays.length - 1] }) : null
  const studyDays = eachDay(week.from, week.to).filter((d) => (cur.byDay.get(d) ?? 0) > 0).length
  const idle = closedDays.filter((d) => (cur.byDay.get(d) ?? 0) <= 0)

  // --- Atividades ------------------------------------------------------
  // Concluída "na semana" = marcada como feita até o fim dela (o que foi feito depois ainda estava em aberto).
  const doneBy = (t: WeeklyTask) => t.done && (!t.done_at || isoDay(t.done_at) <= week.to)
  const weekTasks = input.tasks.filter((t) => inWeek(t.date))
  const tasksDone = weekTasks.filter(doneBy).length
  const late = input.tasks.filter((t) => t.date < cut && t.date <= week.to && !doneBy(t)).sort((a, b) => b.priority - a.priority || a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
  const carried = late.filter((t) => t.date < week.from)

  // --- Cronograma ------------------------------------------------------
  const planWeek = input.planItems.filter((p) => inWeek(p.date) && p.status !== 'rescheduled')
  const planCount = (status: WeeklyPlanItem['status']) => planWeek.filter((p) => p.status === status).length
  const planStale = planWeek.filter((p) => p.status === 'pending' && p.date < cut).length
  const planMissed = planCount('missed')

  // --- Exercícios e questões ------------------------------------------
  const q = questionTotals(input.questions, week)
  const qPrev = questionTotals(input.questions, previousWeek)
  const byTopic = difficulties(input.questions, week, (x) => x.topic_id, T.minSample)
  const weakest = byTopic.rows[0] ?? null

  // --- Tópicos, projetos e metas --------------------------------------
  const topicsDone = input.topics.filter((t) => t.completed_at && inWeek(isoDay(t.completed_at)))
  const projectsDone = input.projects.filter((p) => p.status === 'done' && p.completed_at && inWeek(isoDay(p.completed_at)))
  const projectsStarted = input.projects.filter((p) => p.started_at && inWeek(isoDay(p.started_at)) && !projectsDone.includes(p))
  // As metas são avaliadas como estavam no fim da semana: registros posteriores não entram
  // (importa para metas mensais quando se consulta uma semana passada).
  const upTo = (iso: string | null) => !iso || isoDay(iso) <= week.to
  const goalData: GoalData = {
    sessions: input.sessions.filter((s) => upTo(s.started_at)),
    questions: input.questions.filter((x) => x.date <= week.to),
    topics: input.topics.map((t) => (upTo(t.completed_at) ? t : { ...t, completed_at: null })),
    reviews: (input.flashcardReviews ?? []).filter((r) => upTo(r.reviewed_at)),
    projects: input.projects.map((p) => (upTo(p.completed_at) ? p : { ...p, completed_at: null })),
    timezone: tz,
  }
  const usableGoals = input.goals.filter((g) => g.kind === 'deliverable' || g.metric !== 'flashcards_reviewed' || input.flashcardReviews)
  const snapshots: GoalSnapshot[] = started ? snapshotGoals(usableGoals, asOf, goalData, week) : []
  const goalsMet = snapshots.filter((s) => s.met)
  const goalsPending = snapshots.filter((s) => !s.met)

  // --- Por matéria e por dia ------------------------------------------
  const qBySubject = new Map<string, { total: number; correct: number }>()
  for (const x of input.questions) {
    if (!inWeek(x.date)) continue
    const k = x.subject_id ?? NO_SUBJECT
    const c = qBySubject.get(k) ?? { total: 0, correct: 0 }
    qBySubject.set(k, { total: c.total + x.total, correct: c.correct + x.correct })
  }
  const subjectKeys = new Set([...planned.bySubject.keys(), ...cur.bySubject.keys(), ...qBySubject.keys()])
  const subjects: WeeklySubjectRow[] = [...subjectKeys]
    .map((k) => {
      const qs = qBySubject.get(k) ?? { total: 0, correct: 0 }
      return {
        subjectId: k === NO_SUBJECT ? null : k,
        name: subjectName(k),
        plannedSeconds: planned.bySubject.get(k) ?? 0,
        dueSeconds: due?.bySubject.get(k) ?? 0,
        actualSeconds: cur.bySubject.get(k) ?? 0,
        questions: qs.total,
        correct: qs.correct,
        accuracy: qs.total ? (qs.correct / qs.total) * 100 : null,
        topicsCompleted: topicsDone.filter((t) => t.subject_id === k).length,
      }
    })
    .sort((a, b) => b.plannedSeconds - a.plannedSeconds || b.actualSeconds - a.actualSeconds || a.name.localeCompare(b.name))
  const days: WeeklyDayRow[] = eachDay(week.from, week.to).map((day) => {
    const list = weekTasks.filter((t) => t.date === day)
    return {
      day,
      plannedSeconds: planned.byDay.get(day) ?? 0,
      actualSeconds: cur.byDay.get(day) ?? 0,
      tasks: list.length,
      tasksDone: list.filter(doneBy).length,
      questions: input.questions.filter((x) => x.date === day).reduce((a, x) => a + x.total, 0),
    }
  })

  // Matérias comparáveis: só as que tinham plano relevante já vencido.
  const comparable = subjects.filter((s) => s.dueSeconds >= T.minPlannedSeconds)
  const onPlan = comparable.filter((s) => s.actualSeconds >= s.dueSeconds)
  const belowPlan = comparable.filter((s) => s.actualSeconds < s.dueSeconds).sort((a, b) => b.dueSeconds - b.actualSeconds - (a.dueSeconds - a.actualSeconds))
  const subjectGap = (s: WeeklySubjectRow) => `${s.name} — ${dur(s.actualSeconds)} de ${dur(s.dueSeconds)} (${pct((s.actualSeconds / s.dueSeconds) * 100)})`

  const insufficient: string[] = []
  const sections: Record<SectionKey, Statement[]> = { planned: [], executed: [], advanced: [], behind: [], next: [] }
  const fact = (section: SectionKey, id: string, text: string, data: Fact['data'] = {}, tone: Fact['tone'] = section === 'behind' ? 'attention' : 'neutral') => {
    sections[section].push({ kind: 'fact', id, text, data, tone })
  }
  // Em semana em andamento, a comparação com o plano vai só até ontem (hoje ainda pode ser cumprido).
  const untilNow = finished ? '' : ' até ontem'

  // === 1) O que eu planejei? ==========================================
  if (planned.total > 0) {
    const parts: string[] = []
    if (planned.fromPlan > 0) parts.push(`${dur(planned.fromPlan)} em ${plural(planned.planBlocks, 'bloco do cronograma', 'blocos do cronograma')}`)
    if (planned.fromTasks > 0) parts.push(`${dur(planned.fromTasks)} em ${plural(planned.studyTasks, 'atividade de estudo com duração', 'atividades de estudo com duração')}`)
    fact('planned', 'planned.hours', `Planejei ${dur(planned.total)} de estudo: ${parts.join(' e ')}.`, {
      planejado_min: minutes(planned.total),
      cronograma_min: minutes(planned.fromPlan),
      atividades_min: minutes(planned.fromTasks),
    })
    const withPlan = subjects.filter((s) => s.plannedSeconds > 0)
    fact('planned', 'planned.subjects', `Carga planejada por matéria: ${joinList(withPlan.map((s) => `${s.name} (${dur(s.plannedSeconds)})`), 4)}.`, { materias: withPlan.length })
  } else {
    fact('planned', 'planned.hours', 'Nenhuma hora de estudo foi planejada para esta semana (sem blocos no cronograma nem atividades de estudo com duração).', { planejado_min: 0 })
  }
  if (weekTasks.length || carried.length) {
    const study = weekTasks.filter(isStudyTask).length
    let text = weekTasks.length ? `Havia ${plural(weekTasks.length, 'atividade', 'atividades')} no planejamento da semana (${study} de estudo)` : 'Nenhuma atividade nova estava no planejamento da semana'
    if (carried.length) text += `, além de ${plural(carried.length, 'atividade atrasada', 'atividades atrasadas')} de semanas anteriores ainda em aberto`
    fact('planned', 'planned.tasks', `${text}.`, { atividades: weekTasks.length, de_estudo: study, atrasadas_anteriores: carried.length })
  } else {
    fact('planned', 'planned.tasks', 'Nenhuma atividade estava no planejamento da semana.', { atividades: 0 })
  }
  if (snapshots.length) {
    const deliverable = snapshots.filter((s) => s.kind === 'deliverable').length
    const metric = snapshots.length - deliverable
    fact('planned', 'planned.goals', `${plural(snapshots.length, 'meta vigente', 'metas vigentes')}: ${metric} ${metric === 1 ? 'numérica' : 'numéricas'} e ${deliverable} por entregas.`, {
      metas: snapshots.length,
      numericas: metric,
      por_entregas: deliverable,
    })
  }

  // === 2) O que realmente executei? ===================================
  if (cur.total > 0) {
    let text = `Estudei ${dur(cur.total)} líquidos em ${plural(cur.sessions, 'sessão', 'sessões')}, em ${studyDays} de ${plural(Math.max(elapsed.length, studyDays), 'dia', 'dias')}`
    if (planned.total > 0) text += ` — ${pct((cur.total / planned.total) * 100)} das horas planejadas para a semana`
    fact('executed', 'executed.hours', `${text}.`, { realizado_min: minutes(cur.total), planejado_min: minutes(planned.total), sessoes: cur.sessions, dias_estudados: studyDays })
  } else {
    fact('executed', 'executed.hours', 'Nenhuma sessão de estudo concluída nesta semana.', { realizado_min: 0, planejado_min: minutes(planned.total) })
  }
  if (before.total > 0) {
    const diff = cur.total - before.total
    const sign = diff > 0 ? '+' : '-'
    const text = diff === 0 ? `Mesmo tempo de estudo da semana anterior (${dur(before.total)}).` : `Na semana anterior foram ${dur(before.total)}: ${sign}${dur(Math.abs(diff))} (${sign}${pct((Math.abs(diff) / before.total) * 100)}).`
    fact('executed', 'executed.compare', text, { realizado_min: minutes(cur.total), semana_anterior_min: minutes(before.total) })
  } else if (cur.total > 0) {
    fact('executed', 'executed.compare', 'Não há estudo registrado na semana anterior para comparar.', { semana_anterior_min: 0 })
  }
  if (weekTasks.length) {
    fact('executed', 'executed.tasks', `Concluí ${tasksDone} de ${plural(weekTasks.length, 'atividade', 'atividades')} da semana (${pct((tasksDone / weekTasks.length) * 100)}).`, {
      concluidas: tasksDone,
      atividades: weekTasks.length,
    })
  }
  if (planWeek.length) {
    const parts = [
      [planCount('done'), 'concluído', 'concluídos'],
      [planCount('partial'), 'parcial', 'parciais'],
      [planMissed, 'não realizado', 'não realizados'],
      [planCount('pending'), 'pendente', 'pendentes'],
    ] as const
    fact('executed', 'executed.plan', `Blocos do cronograma: ${parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)).join(', ')}.`, {
      blocos: planWeek.length,
      concluidos: planCount('done'),
      parciais: planCount('partial'),
      nao_realizados: planMissed,
      pendentes: planCount('pending'),
    })
  }
  if (q.total > 0) {
    // Com poucas questões o percentual engana: mostra só a contagem.
    const result = q.total >= T.minSample ? `, com ${pct(q.accuracy!)} de acerto (${plural(q.correct, 'certa', 'certas')})` : ` (${plural(q.correct, 'certa', 'certas')}); com menos de ${T.minSample} questões, a taxa de acerto não é calculada`
    fact('executed', 'executed.questions', `Resolvi ${plural(q.total, 'exercício/questão', 'exercícios e questões')}${result}.`, {
      questoes: q.total,
      acertos: q.correct,
    })
  } else {
    fact('executed', 'executed.questions', 'Nenhum exercício ou questão registrado nesta semana.', { questoes: 0 })
  }

  // === 3) Onde avancei? ===============================================
  if (topicsDone.length) {
    fact('advanced', 'advanced.topics', `Concluí ${plural(topicsDone.length, 'tópico', 'tópicos')}: ${joinList(topicsDone.map((t) => topicLabel(t.id)), 4)}.`, { topicos_concluidos: topicsDone.length })
  }
  if (onPlan.length) {
    fact('advanced', 'advanced.subjects', `Cumpri as horas planejadas${untilNow} em: ${joinList(onPlan.map((s) => `${s.name} (${dur(s.actualSeconds)} de ${dur(s.dueSeconds)})`), 4)}.`, { materias: onPlan.length })
  }
  if (before.total > 0 && cur.total > before.total) {
    fact('advanced', 'advanced.hours', `Estudei ${dur(cur.total - before.total)} a mais que na semana anterior.`, { realizado_min: minutes(cur.total), semana_anterior_min: minutes(before.total) })
  }
  // Acerto só é comparado quando as duas semanas têm amostra mínima.
  const accuracyComparable = q.total >= T.minSample && qPrev.total >= T.minSample
  const accuracyDiff = accuracyComparable ? Math.round(q.accuracy!) - Math.round(qPrev.accuracy!) : 0
  if (accuracyDiff > 0) {
    fact('advanced', 'advanced.accuracy', `A taxa de acerto subiu de ${pct(qPrev.accuracy!)} (${qPrev.total} questões) para ${pct(q.accuracy!)} (${q.total} questões).`, {
      acerto_pct: Math.round(q.accuracy!),
      acerto_anterior_pct: Math.round(qPrev.accuracy!),
      questoes: q.total,
      questoes_anterior: qPrev.total,
    })
  }
  if (goalsMet.length) {
    fact('advanced', 'advanced.goals', `${goalsMet.length === 1 ? 'Meta cumprida' : 'Metas cumpridas'}: ${joinList(goalsMet.map((s) => `"${s.title}" (${s.detail})`), 4)}.`, { metas_cumpridas: goalsMet.length })
  }
  if (projectsDone.length) {
    fact('advanced', 'advanced.projects', `${projectsDone.length === 1 ? 'Projeto concluído' : 'Projetos concluídos'}: ${joinList(projectsDone.map((p) => p.name), 4)}.`, { projetos_concluidos: projectsDone.length })
  }
  if (projectsStarted.length) {
    fact('advanced', 'advanced.projectsStarted', `${projectsStarted.length === 1 ? 'Projeto iniciado' : 'Projetos iniciados'}: ${joinList(projectsStarted.map((p) => p.name), 4)}.`, { projetos_iniciados: projectsStarted.length })
  }

  // === 4) Onde fiquei para trás? ======================================
  if (belowPlan.length) {
    fact('behind', 'behind.subjects', `Abaixo do planejado${untilNow}: ${belowPlan.slice(0, 4).map(subjectGap).join('; ')}${belowPlan.length > 4 ? `; e mais ${belowPlan.length - 4}` : ''}.`, { materias: belowPlan.length })
  }
  if (late.length) {
    const own = late.length - carried.length
    const all = late.length === 1 ? '' : 'todas '
    const origin = carried.length === 0 ? `${all}desta semana` : own === 0 ? `${all}de semanas anteriores` : `${own} desta semana e ${carried.length} de semanas anteriores`
    fact('behind', 'behind.tasks', `${plural(late.length, 'atividade ficou', 'atividades ficaram')} sem concluir (${origin}). Por prioridade: ${joinList(late.map((t) => `${t.title} (${formatDayKey(t.date)})`), 3)}.`, {
      atrasadas: late.length,
      desta_semana: own,
      de_semanas_anteriores: carried.length,
    })
  }
  if (planMissed + planStale > 0) {
    const parts: string[] = []
    if (planMissed) parts.push(plural(planMissed, 'marcado como não realizado', 'marcados como não realizados'))
    if (planStale) parts.push(plural(planStale, 'ainda pendente com data vencida', 'ainda pendentes com data vencida'))
    fact('behind', 'behind.plan', `${plural(planMissed + planStale, 'bloco do cronograma ficou', 'blocos do cronograma ficaram')} sem realizar: ${parts.join(' e ')}.`, { nao_realizados: planMissed, pendentes_vencidos: planStale })
  }
  if (idle.length && (cur.total > 0 || planned.total > 0)) {
    fact('behind', 'behind.days', `${finished ? 'Fiquei' : 'Até ontem, fiquei'} ${idle.length} de ${plural(closedDays.length, 'dia', 'dias')} sem estudar: ${joinList(idle.map((d) => formatDayKey(d, 'weekday')), 7)}.`, {
      dias_sem_estudo: idle.length,
      dias_considerados: closedDays.length,
    })
  }
  if (weakest && weakest.accuracy < T.lowAccuracy) {
    fact('behind', 'behind.accuracy', `Menor taxa de acerto da semana: ${topicLabel(weakest.key)}, com ${pct(weakest.accuracy)} em ${weakest.total} questões.`, {
      acerto_pct: Math.round(weakest.accuracy),
      questoes: weakest.total,
      acertos: weakest.correct,
    })
  }
  if (accuracyDiff < 0) {
    fact('behind', 'behind.accuracyDrop', `A taxa de acerto caiu de ${pct(qPrev.accuracy!)} (${qPrev.total} questões) para ${pct(q.accuracy!)} (${q.total} questões).`, {
      acerto_pct: Math.round(q.accuracy!),
      acerto_anterior_pct: Math.round(qPrev.accuracy!),
      questoes: q.total,
      questoes_anterior: qPrev.total,
    })
  }
  if (goalsPending.length) {
    fact('behind', 'behind.goals', `${goalsPending.length === 1 ? 'Meta ainda não cumprida' : 'Metas ainda não cumpridas'}: ${joinList(goalsPending.map((s) => `"${s.title}" em ${pct(s.percent)} (${s.detail})`), 4)}.`, { metas_pendentes: goalsPending.length })
  }
  if (finished && before.total > 0 && cur.total < before.total) {
    fact('behind', 'behind.hours', `Estudei ${dur(before.total - cur.total)} a menos que na semana anterior.`, { realizado_min: minutes(cur.total), semana_anterior_min: minutes(before.total) })
  }

  // O que não dá para afirmar com os dados da semana.
  if (q.total > 0 && !weakest) insufficient.push(`Dados insuficientes para apontar o tópico com mais dificuldade: nenhum tópico chegou a ${T.minSample} questões na semana.`)
  if (q.total > 0 && qPrev.total > 0 && !accuracyComparable) insufficient.push(`Dados insuficientes para comparar a taxa de acerto com a semana anterior: é preciso ter ao menos ${T.minSample} questões em cada semana.`)
  if (q.total === 0) insufficient.push('Sem exercícios registrados na semana: não há taxa de acerto para mostrar.')

  // === 5) O que devo priorizar na próxima semana? =====================
  const ahead = finished ? 'na próxima semana' : 'nos próximos dias'
  const candidates: Recommendation[] = []
  const recommend = (ruleId: WeeklyRuleId, text: string, short: string, basedOn: string[], data: Recommendation['data'] = {}) => {
    candidates.push({ kind: 'recommendation', id: `next.${ruleId}`, ruleId, rule: `Regra: ${WEEKLY_RULES[ruleId]}.`, text, short, basedOn, data })
  }

  if (late.length) {
    const text = late.length === 1 ? `Comece pela atividade atrasada: ${late[0].title} (${formatDayKey(late[0].date)}).` : `Comece pelas ${late.length} atividades atrasadas, nesta ordem: ${joinList(late.map((t) => t.title), 3)}.`
    recommend('overdue', text, `colocar em dia ${plural(late.length, 'atividade atrasada', 'atividades atrasadas')}`, ['behind.tasks'], { atrasadas: late.length })
  }
  const farBelow = belowPlan.filter((s) => s.actualSeconds < s.dueSeconds * T.belowPlanRatio)
  if (farBelow.length) {
    const first = farBelow[0]
    let text = `Dê os primeiros blocos ${finished ? 'da próxima semana' : 'dos próximos dias'} para ${first.name}: ${dur(first.actualSeconds)} de ${dur(first.dueSeconds)} planejados (${pct((first.actualSeconds / first.dueSeconds) * 100)}).`
    if (farBelow.length > 1) text += ` Em seguida: ${joinList(farBelow.slice(1).map((s) => `${s.name} (${pct((s.actualSeconds / s.dueSeconds) * 100)})`), 2)}.`
    recommend('belowPlan', text, `recuperar ${first.name}`, ['behind.subjects'], { materias_abaixo_de_50: farBelow.length, realizado_min: minutes(first.actualSeconds), planejado_min: minutes(first.dueSeconds) })
  }
  if (weakest && weakest.accuracy < T.lowAccuracy) {
    const name = topicById.get(weakest.key)?.name ?? 'o tópico'
    recommend('lowAccuracy', `Revise ${topicLabel(weakest.key)} e refaça exercícios do tópico: ${pct(weakest.accuracy)} de acerto em ${weakest.total} questões.`, `revisar ${name}`, ['behind.accuracy'], {
      acerto_pct: Math.round(weakest.accuracy),
      questoes: weakest.total,
    })
  }
  const dueLimit = addDays(week.to, T.goalDueDays)
  const urgent = goalsPending
    .filter((s) => s.kind === 'deliverable' && s.goal.due_date && s.goal.due_date <= dueLimit && s.remaining > 0)
    .sort((a, b) => a.goal.due_date!.localeCompare(b.goal.due_date!))[0]
  if (urgent) {
    const open = (urgent.goal.checklist ?? []).filter((i) => !i.done).map((i) => i.text)
    recommend('goalDeadline', `Conclua as entregas da meta "${urgent.title}" (prazo ${formatDayKey(urgent.goal.due_date!)}): ${joinList(open, 3)}.`, `concluir as entregas de "${urgent.title}"`, ['behind.goals'], {
      entregas_pendentes: open.length,
      prazo: urgent.goal.due_date!,
    })
  }
  const near = goalsPending.filter((s) => s.kind === 'metric' && s.percent >= T.nearGoalPercent).sort((a, b) => b.percent - a.percent)[0]
  if (near) {
    // O período da meta (semana ou mês) ainda está correndo hoje?
    const stillOpen = Boolean(near.range && near.range.to >= today && near.goal.period !== 'daily')
    const text = stillOpen
      ? `Falta pouco para cumprir a meta "${near.title}": ${near.detail} (${pct(near.percent)}). Feche o que falta antes de ${formatDayKey(near.range!.to)}.`
      : `A meta "${near.title}" ficou perto do alvo: ${near.detail} (${pct(near.percent)}). Mantenha o alvo e comece por ela ${ahead}.`
    recommend('goalNear', text, `fechar a meta "${near.title}"`, ['behind.goals'], { progresso_pct: Math.round(near.percent) })
  }
  const noPlan = planned.total === 0 && weekTasks.length === 0
  if (noPlan) {
    recommend('noPlan', 'Planeje a semana antes de começar (blocos de estudo ou atividades com duração): sem plano não há como comparar planejado e realizado.', 'planejar a semana', ['planned.hours', 'planned.tasks'], { planejado_min: 0, atividades: 0 })
  }
  if (idle.length >= T.idleDays && (cur.total > 0 || planned.total > 0)) {
    const weekdays = joinList(idle.map((d) => WEEKDAY_LABELS[weekday(d)].toLowerCase()), 7)
    recommend('idleDays', `Reserve um bloco curto de estudo (25 min) nos dias que ficaram vazios: ${weekdays}.`, 'estudar nos dias que ficaram vazios', ['behind.days'], { dias_sem_estudo: idle.length })
  }
  if (cur.total >= T.minStudyForExercises && q.total === 0) {
    recommend('noExercises', `Inclua exercícios ${ahead} e registre os resultados: foram ${dur(cur.total)} de estudo sem nenhuma questão registrada, então não há como medir o acerto.`, 'incluir exercícios', ['executed.hours', 'executed.questions'], {
      realizado_min: minutes(cur.total),
      questoes: 0,
    })
  }
  const recommendations = candidates.slice(0, T.maxRecommendations)
  sections.next = recommendations

  const empty: Record<SectionKey, string> = {
    planned: 'Nada foi planejado para esta semana.',
    executed: 'Nada foi registrado nesta semana.',
    advanced: 'Nenhum avanço registrado nesta semana: nenhum tópico ou meta concluído e nenhuma matéria com o planejado cumprido.',
    behind: 'Nada ficou para trás nos registros desta semana.',
    next: 'Nenhuma regra disparou: mantenha o ritmo planejado.',
  }
  const order: SectionKey[] = ['planned', 'executed', 'advanced', 'behind', 'next']

  return {
    week,
    previousWeek,
    inProgress: started && !finished,
    hasData: cur.total > 0 || planned.total > 0 || weekTasks.length > 0 || late.length > 0 || q.total > 0 || topicsDone.length > 0,
    totals: {
      plannedSeconds: planned.total,
      actualSeconds: cur.total,
      plannedPercent: planned.total > 0 ? (cur.total / planned.total) * 100 : null,
      previousSeconds: before.total,
      sessions: cur.sessions,
      studyDays,
      elapsedDays: elapsed.length,
      idleDays: idle.length,
      tasksTotal: weekTasks.length,
      tasksDone,
      tasksLate: late.length,
      tasksCarried: carried.length,
      questions: q.total,
      correct: q.correct,
      accuracy: q.accuracy,
      previousQuestions: qPrev.total,
      previousAccuracy: qPrev.accuracy,
      topicsCompleted: topicsDone.length,
      goalsMet: goalsMet.length,
      goalsPending: goalsPending.length,
    },
    subjects,
    days,
    goals: snapshots.map((s) => ({ title: s.title, kind: s.kind, met: s.met, percent: s.percent, detail: s.detail })),
    sections: order.map((key) => ({ key, question: SECTION_QUESTIONS[key], statements: sections[key], empty: empty[key] })),
    recommendations,
    insufficient,
  }
}

// ---------------------------------------------------------------------
// Resumo em uma frase (tela inicial)
// ---------------------------------------------------------------------

/** Uma frase com o essencial da semana: horas, atividades e a primeira prioridade. */
export function weekHeadline(report: WeeklyReport): string {
  const label = `Semana de ${formatDayKey(report.week.from)} a ${formatDayKey(report.week.to)}`
  const t = report.totals
  if (!report.hasData) return `${label}: nada planejado nem registrado${report.inProgress ? ' até agora' : ''}.`
  let text = `${label}: ${dur(t.actualSeconds)} de estudo`
  if (t.plannedPercent != null) text += ` de ${dur(t.plannedSeconds)} planejados (${pct(t.plannedPercent)})`
  if (t.tasksTotal > 0) text += `, ${t.tasksDone} de ${plural(t.tasksTotal, 'atividade concluída', 'atividades concluídas')}`
  const first = report.recommendations[0]
  if (first) text += `; prioridade: ${first.short}`
  return `${text}.`
}

// ---------------------------------------------------------------------
// Exportação (CSV e PDF)
// ---------------------------------------------------------------------

const dataText = (data: Record<string, number | string>) => Object.entries(data).map(([k, v]) => `${k}=${v}`).join('; ')

/** Linhas do CSV: cada frase com seu tipo (Dado × Sugestão por regra), a regra e os números; depois os quadros por matéria e por dia. */
export function weeklyReportCsvRows(report: WeeklyReport): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  for (const section of report.sections) {
    for (const s of section.statements) {
      rows.push({ secao: section.question, tipo: STATEMENT_LABELS[s.kind], texto: s.text, regra: s.kind === 'recommendation' ? s.rule : '', dados: dataText(s.data) })
    }
    if (section.statements.length === 0) rows.push({ secao: section.question, tipo: '', texto: section.empty, regra: '', dados: '' })
  }
  for (const note of report.insufficient) rows.push({ secao: 'Dados insuficientes', tipo: '', texto: note, regra: '', dados: '' })
  for (const s of report.subjects) {
    rows.push({
      secao: 'Por matéria',
      tipo: STATEMENT_LABELS.fact,
      texto: s.name,
      regra: '',
      dados: dataText({ planejado_min: minutes(s.plannedSeconds), realizado_min: minutes(s.actualSeconds), questoes: s.questions, acertos: s.correct, topicos_concluidos: s.topicsCompleted }),
    })
  }
  for (const d of report.days) {
    rows.push({
      secao: 'Por dia',
      tipo: STATEMENT_LABELS.fact,
      texto: d.day,
      regra: '',
      dados: dataText({ planejado_min: minutes(d.plannedSeconds), realizado_min: minutes(d.actualSeconds), atividades: d.tasks, concluidas: d.tasksDone, questoes: d.questions }),
    })
  }
  return rows
}

/** Conteúdo do PDF: números-chave, as cinco perguntas (com Dado × Sugestão por regra) e os quadros por matéria e por dia. */
export function weeklyReportDocument(report: WeeklyReport, generatedAt?: string): PdfReport {
  const t = report.totals
  const blocks: PdfBlock[] = [
    { type: 'paragraph', text: weekHeadline(report) },
    {
      type: 'stats',
      items: [
        { label: 'Horas planejadas', value: dur(t.plannedSeconds) },
        { label: 'Horas realizadas (líquidas)', value: dur(t.actualSeconds) },
        { label: 'Realizado ÷ planejado', value: t.plannedPercent == null ? 'Sem plano' : pct(t.plannedPercent) },
        { label: 'Atividades concluídas', value: t.tasksTotal ? `${t.tasksDone} de ${t.tasksTotal}` : 'Nenhuma planejada' },
        { label: 'Exercícios e questões', value: !t.questions ? 'Nenhum registro' : t.questions < MIN_SAMPLE ? `${t.questions} (acerto: dados insuficientes)` : `${t.questions} (${pct(t.accuracy!)} de acerto)` },
        { label: 'Dias com estudo', value: `${t.studyDays} de ${Math.max(t.elapsedDays, t.studyDays)}` },
      ],
    },
  ]
  for (const section of report.sections) {
    blocks.push({ type: 'heading', text: section.question })
    if (section.statements.length === 0) blocks.push({ type: 'paragraph', text: section.empty })
    for (const s of section.statements) {
      blocks.push({ type: 'paragraph', label: STATEMENT_LABELS[s.kind], accent: s.kind === 'recommendation', text: s.text, note: s.kind === 'recommendation' ? s.rule : undefined })
    }
  }
  if (report.insufficient.length) {
    blocks.push({ type: 'heading', text: 'Dados insuficientes' })
    for (const note of report.insufficient) blocks.push({ type: 'paragraph', text: note })
  }
  blocks.push({ type: 'heading', text: 'Por matéria' })
  blocks.push({
    type: 'table',
    columns: ['Matéria', 'Planejado', 'Realizado', 'Questões', 'Acerto'],
    rows: report.subjects.map((s) => [s.name, dur(s.plannedSeconds), dur(s.actualSeconds), s.questions, s.accuracy == null ? '—' : s.questions < MIN_SAMPLE ? 'Dados insuficientes' : pct(s.accuracy)]),
    empty: 'Nenhuma matéria com plano, estudo ou questões na semana.',
  })
  blocks.push({ type: 'heading', text: 'Por dia' })
  blocks.push({
    type: 'table',
    columns: ['Dia', 'Planejado', 'Realizado', 'Atividades', 'Questões'],
    rows: report.days.map((d) => [formatDayKey(d.day, 'weekday'), dur(d.plannedSeconds), dur(d.actualSeconds), d.tasks ? `${d.tasksDone}/${d.tasks}` : '—', d.questions]),
  })
  return {
    title: 'Relatório semanal',
    subtitle: `Semana de ${formatDayKey(report.week.from, 'long')} a ${formatDayKey(report.week.to, 'long')}${report.inProgress ? ' (em andamento)' : ''}`,
    meta: `${generatedAt ? `Gerado em ${generatedAt}. ` : ''}Relatório por regras sobre os registros: "Dado" vem direto dos dados; "Sugestão por regra" indica a regra que a gerou.`,
    blocks,
  }
}
