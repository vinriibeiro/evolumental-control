// "Reorganizar minha semana": sugere novos horários para o que ficou para trás.
//
// É uma função pura: recebe as atividades (tarefas e blocos de estudo, já unificados) e devolve uma PRÉVIA.
// Nada é gravado aqui — a tela mostra a prévia e só aplica o que o usuário aceitar.
//
// Regras (na ordem em que pesam):
//   1. compromissos existentes ocupam o horário e nunca são sobrepostos;
//   2. só horários livres dentro das janelas de disponibilidade (ou da janela preferida) são usados;
//   3. prioridade maior é encaixada primeiro; depois prazo mais próximo; depois a matéria mais longe da meta semanal;
//   4. o prazo da atividade limita até que dia ela pode ir;
//   5. a duração prevista é preservada;
//   6. dependências: dentro da mesma matéria, um tópico anterior da trilha nunca fica depois de um posterior;
//   7. o limite diário de estudo é respeitado;
//   8. atividades recorrentes e compromissos fixos não são movidos (são listados para o usuário decidir);
//   9. o mesmo horário do dia original é tentado primeiro (preserva o hábito), depois a janela preferida.
// Quando não há espaço, a atividade aparece em "não encaixadas" com o motivo. Nenhum horário é inventado.
import { addDays, hhmmToMinutes, weekday, windowRange, type DayKey } from '@/lib/time'
import type { TimeWindow } from '@/types/db'

export interface PlanActivity {
  /** 'task:<id>' ou 'plan:<id>'. */
  id: string
  source: 'task' | 'plan'
  refId: string
  title: string
  date: DayKey
  /** Início em minutos desde 00:00; null = sem horário. */
  start: number | null
  /** Duração em minutos; null = não informada. */
  duration: number | null
  done: boolean
  /** Compromisso fixo: nunca é movido automaticamente. */
  fixed: boolean
  /** Conta como estudo (entra no limite diário e nas metas). */
  study: boolean
  /** 1 = baixa, 2 = normal, 3 = alta. */
  priority: number
  due: DayKey | null
  subjectId: string | null
  topicId: string | null
  /** Ocorrência de uma série recorrente. */
  recurring: boolean
}

export interface ReplanOptions {
  today: DayKey
  nowMinutes: number
  /** Último dia em que a atividade pode ser encaixada (normalmente o domingo da semana). */
  horizonEnd: DayKey
  /** Janelas livres por dia da semana (0 = domingo); dia sem janela = sem estudo nesse dia. */
  availability?: Record<number, TimeWindow[]>
  /** Janela preferida para estudar. */
  preferredWindow?: TimeWindow
  /** Limite de minutos de estudo por dia (0/undefined = sem limite). */
  dailyStudyLimitMinutes?: number
  /** Passo da grade, em minutos. */
  step?: number
  /** Ordem do tópico na trilha (menor = vem antes), para respeitar dependências. */
  topicOrder?: Map<string, number>
  /** Minutos que faltam para a meta semanal de cada matéria (maior = mais atrasada). */
  subjectDeficit?: Map<string, number>
}

export interface ReplanMove {
  activity: PlanActivity
  toDate: DayKey
  /** null = continua sem horário. */
  toStart: number | null
  reason: string
}

export interface ReplanResult {
  overdue: PlanActivity[]
  moves: ReplanMove[]
  /** Sobreposições que já existem na agenda (não são resolvidas em silêncio). */
  conflicts: Array<[PlanActivity, PlanActivity]>
  unplaced: Array<{ activity: PlanActivity; reason: string }>
}

const DAY_START = 6 * 60
const DAY_END = 23 * 60
const DEFAULT_DURATION = 30

const endOf = (a: Pick<PlanActivity, 'start' | 'duration'>) => (a.start ?? 0) + (a.duration ?? DEFAULT_DURATION)

/** Uma atividade pendente está atrasada quando o dia passou, ou quando é de hoje e o horário dela já terminou. */
export function isOverdue(a: PlanActivity, today: DayKey, nowMinutes: number): boolean {
  if (a.done) return false
  if (a.date < today) return true
  return a.date === today && a.start != null && endOf(a) <= nowMinutes
}

/** Pares de atividades com horário que se sobrepõem no mesmo dia. */
export function activityConflicts(activities: PlanActivity[]): Array<[PlanActivity, PlanActivity]> {
  const byDay = new Map<string, PlanActivity[]>()
  for (const a of activities) {
    if (a.start == null) continue
    byDay.set(a.date, [...(byDay.get(a.date) ?? []), a])
  }
  const out: Array<[PlanActivity, PlanActivity]> = []
  for (const list of byDay.values()) {
    const sorted = [...list].sort((x, y) => x.start! - y.start!)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start! >= endOf(sorted[i])) break
        out.push([sorted[i], sorted[j]])
      }
    }
  }
  return out
}

function overlaps(start: number, end: number, busy: Array<[number, number]>): boolean {
  return busy.some(([s, e]) => s < end && e > start)
}

/** Janelas (em minutos) em que dá para encaixar algo no dia. */
function dayWindows(date: DayKey, study: boolean, opts: ReplanOptions): Array<[number, number]> {
  const fallback: Array<[number, number]> = [[DAY_START, DAY_END]]
  if (!study) return fallback
  const hasAvailability = opts.availability && Object.values(opts.availability).some((w) => (w ?? []).length > 0)
  if (!hasAvailability) return fallback
  return (opts.availability![weekday(date)] ?? []).map((w) => windowRange(w)).filter(([s, e]) => e > s)
}

/** Horários candidatos de um dia, na ordem de preferência: horário original, janela preferida, restante. */
function candidateStarts(a: PlanActivity, date: DayKey, opts: ReplanOptions): number[] {
  const step = opts.step ?? 30
  const duration = a.duration ?? DEFAULT_DURATION
  const windows = dayWindows(date, a.study, opts)
  const all: number[] = []
  for (const [ws, we] of windows) {
    for (let t = Math.ceil(ws / step) * step; t + duration <= we; t += step) all.push(t)
  }
  const pref = opts.preferredWindow ? windowRange(opts.preferredWindow) : null
  const inPref = (t: number) => (pref ? t >= pref[0] && t + duration <= pref[1] : false)
  const rank = (t: number) => (t === a.start ? 0 : inPref(t) ? 1 : 2)
  return [...new Set(all)].sort((x, y) => rank(x) - rank(y) || x - y)
}

export function replanWeek(activities: PlanActivity[], opts: ReplanOptions): ReplanResult {
  const { today, nowMinutes, horizonEnd } = opts
  const step = opts.step ?? 30
  const limit = opts.dailyStudyLimitMinutes && opts.dailyStudyLimitMinutes > 0 ? opts.dailyStudyLimitMinutes : null
  const overdue = activities.filter((a) => isOverdue(a, today, nowMinutes))
  const overdueIds = new Set(overdue.map((a) => a.id))

  // Tudo o que continua no lugar (de hoje em diante) ocupa horário e conta no limite diário de estudo.
  const busy = new Map<string, Array<[number, number]>>()
  const studyMinutes = new Map<string, number>()
  const occupy = (date: DayKey, start: number | null, duration: number | null, study: boolean) => {
    if (start != null) busy.set(date, [...(busy.get(date) ?? []), [start, start + (duration ?? DEFAULT_DURATION)]])
    if (study) studyMinutes.set(date, (studyMinutes.get(date) ?? 0) + (duration ?? 0))
  }
  const standing = activities.filter((a) => !overdueIds.has(a.id) && a.date >= today && a.date <= horizonEnd)
  for (const a of standing) occupy(a.date, a.start, a.duration, a.study)

  const order = (a: PlanActivity) => (a.topicId ? (opts.topicOrder?.get(a.topicId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER)
  const deficit = (a: PlanActivity) => (a.subjectId ? (opts.subjectDeficit?.get(a.subjectId) ?? 0) : 0)
  const queue = [...overdue].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31') ||
      deficit(b) - deficit(a) ||
      order(a) - order(b) ||
      a.date.localeCompare(b.date) ||
      (a.start ?? 0) - (b.start ?? 0),
  )

  const moves: ReplanMove[] = []
  const unplaced: ReplanResult['unplaced'] = []
  // Dependências: último encaixe por matéria e ordem de tópico (um tópico posterior não pode vir antes).
  const placedBySubject = new Map<string, Array<{ order: number; at: number }>>()
  const stamp = (date: DayKey, start: number | null) => Number(date.replace(/-/g, '')) * 1440 + (start ?? 0)

  for (const a of queue) {
    if (a.fixed) {
      unplaced.push({ activity: a, reason: 'Compromisso fixo: não é movido automaticamente.' })
      continue
    }
    if (a.recurring && !a.study) {
      unplaced.push({ activity: a, reason: 'Atividade recorrente: a próxima ocorrência já está na agenda.' })
      continue
    }
    const last = a.due && a.due < horizonEnd ? a.due : horizonEnd
    if (last < today) {
      unplaced.push({ activity: a, reason: 'O prazo desta atividade já passou.' })
      continue
    }
    // Sem horário: só muda o dia (vai para hoje), sem ocupar a grade.
    if (a.start == null) {
      moves.push({ activity: a, toDate: today, toStart: null, reason: 'Sem horário definido: passa para hoje.' })
      continue
    }
    const duration = a.duration ?? DEFAULT_DURATION
    const myOrder = order(a)
    const earlier = a.subjectId ? (placedBySubject.get(a.subjectId) ?? []).filter((p) => p.order < myOrder) : []
    const notBefore = earlier.length ? Math.max(...earlier.map((p) => p.at)) : 0
    let placed: ReplanMove | null = null
    let hitLimit = false
    for (let date = today; date <= last && !placed; date = addDays(date, 1)) {
      if (limit && a.study && (studyMinutes.get(date) ?? 0) + duration > limit) {
        hitLimit = true
        continue
      }
      const minStart = date === today ? Math.ceil((nowMinutes + 1) / step) * step : 0
      for (const t of candidateStarts(a, date, opts)) {
        if (t < minStart) continue
        if (stamp(date, t) < notBefore) continue
        if (overlaps(t, t + duration, busy.get(date) ?? [])) continue
        placed = { activity: a, toDate: date, toStart: t, reason: t === a.start ? 'Mesmo horário, no próximo dia livre.' : 'Próximo horário livre, respeitando seus compromissos e sua disponibilidade.' }
        break
      }
    }
    if (!placed) {
      unplaced.push({ activity: a, reason: hitLimit ? 'O limite diário de estudo já está preenchido nos dias com horário livre.' : a.due && a.due < horizonEnd ? 'Não há horário livre antes do prazo.' : 'Não há horário livre até o fim da semana.' })
      continue
    }
    moves.push(placed)
    occupy(placed.toDate, placed.toStart, duration, a.study)
    if (a.subjectId && myOrder !== Number.MAX_SAFE_INTEGER) {
      placedBySubject.set(a.subjectId, [...(placedBySubject.get(a.subjectId) ?? []), { order: myOrder, at: stamp(placed.toDate, placed.toStart) }])
    }
  }

  const conflicts = activityConflicts(standing.filter((a) => !a.done))
  return { overdue, moves, conflicts, unplaced }
}

// ---------------------------------------------------------------------
// Planejamento adaptativo: compara a duração prevista com a realizada
// ---------------------------------------------------------------------
export interface DurationSample {
  /** Agrupador (ex.: id da matéria). */
  key: string
  label: string
  plannedMinutes: number
  actualMinutes: number
}

export interface DurationInsight {
  key: string
  label: string
  samples: number
  plannedMinutes: number
  typicalMinutes: number
  suggestedMinutes: number
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Sugere revisar a duração planejada quando o histórico real difere de forma consistente (pelo menos `minSamples`
 * sessões e diferença de 25% ou mais). É só uma sugestão: nada é alterado sozinho.
 */
export function durationInsights(samples: DurationSample[], minSamples = 3): DurationInsight[] {
  const groups = new Map<string, DurationSample[]>()
  for (const s of samples) {
    if (s.plannedMinutes <= 0 || s.actualMinutes <= 0) continue
    groups.set(s.key, [...(groups.get(s.key) ?? []), s])
  }
  const out: DurationInsight[] = []
  for (const [key, list] of groups) {
    if (list.length < minSamples) continue
    const planned = median(list.map((s) => s.plannedMinutes))
    const typical = median(list.map((s) => s.actualMinutes))
    const ratio = typical / planned
    if (ratio < 1.25 && ratio > 0.75) continue
    out.push({ key, label: list[0].label, samples: list.length, plannedMinutes: Math.round(planned), typicalMinutes: Math.round(typical), suggestedMinutes: Math.max(10, Math.round(typical / 5) * 5) })
  }
  return out.sort((a, b) => b.samples - a.samples)
}

export const minutesOfHhmm = (hhmm: string | null): number | null => (hhmm ? hhmmToMinutes(hhmm) : null)
