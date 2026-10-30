// Aplica uma rotina (src/lib/routine.ts + src/content/routines.ts) nas
// entidades que já existem: matérias e tópicos (via installTrail), ciclo ativo,
// cronograma com blocos e tarefas de calendário, além de uma meta semanal.
//
// Idempotente: os registros da rotina são reconhecidos pelo nome/marcador e
// reconciliados — aplicar de novo com a mesma entrada não cria nada. Sessões de
// estudo nunca são lidas para alteração, e blocos/itens já usados por alguma
// sessão não são apagados (o SET NULL do banco mudaria a sessão).
import type { DataBackend } from '@/lib/data/types'
import { eq, gte, inList } from '@/lib/data/types'
import { ROUTINE_RULES, generateRoutine, type RoutineAvailability, type RoutineOutput } from '@/lib/routine'
import { diffPlan, generatePlan, type PlanDiff, type PlannedBlock } from '@/lib/planner'
import { ACTIVITY_LABELS, WEEKDAY_LABELS } from '@/lib/labels'
import { diffDays, eachDay, hhmmToMinutes, weekday, type DayKey } from '@/lib/time'
import { ROUTINE_TEMPLATES, cloneRoutineTemplate, type RoutineTemplatePillar } from '@/content/routines'
import { subjectByKey, type SubjectDef } from '@/content/trails'
import type { ActivityType, CalendarTask, Insert, PlanConfig, StudyCycleItem, StudyPlan, StudyPlanItem, TimeWindow } from '@/types/db'
import { installTrail } from './trails'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const BATCH = 500

export interface RoutineDraftMilestone {
  title: string
  pillarId: string | null
  /** Sem data, o marco só aparece na prévia como lembrete. */
  date: DayKey | null
}

export interface RoutineDraft {
  templateId: string
  name: string
  pillars: RoutineTemplatePillar[]
  availability: RoutineAvailability
  startDate: DayKey
  weeks: number
  milestones: RoutineDraftMilestone[]
}

/** Bloco do cronograma da rotina (do planner ou bloco fixo diário). */
export interface RoutinePlanBlock {
  date: DayKey
  start_time: string
  duration_minutes: number
  subject_id: string | null
  activity_type: ActivityType
  pillarId: string | null
  reason: string
}

export interface RoutineTaskRow {
  title: string
  date: DayKey
  start_time: string | null
  duration_minutes: number | null
  subject_id: string | null
  kind: 'task' | 'exam'
  description: string
}

export interface RoutinePreview {
  rules: string[]
  output: RoutineOutput
  planBlocks: RoutinePlanBlock[]
  tasks: RoutineTaskRow[]
  /** Minutos semanais planejados (blocos fixos + tarefas semanais + volta do ciclo). */
  weeklyMinutes: number
}

export interface ApplyRoutineResult {
  subjectsCreated: number
  subjectsReused: number
  topicsCreated: number
  cycleId: string | null
  cycleCreated: boolean
  cycleItems: { added: number; updated: number; removed: number; kept: number }
  planId: string
  planCreated: boolean
  planItems: { added: number; removed: number; kept: number }
  tasks: { added: number; updated: number; removed: number; kept: number }
  goalCreated: boolean
}

/** A rotina aplicada fica guardada no config (jsonb) do cronograma, para ser editada depois. */
export type RoutinePlanConfig = PlanConfig & { routine?: RoutineDraft }

export interface AppliedRoutine {
  planId: string
  draft: RoutineDraft
  /**
   * Rotina aplicada por uma versão anterior, que não guardava a configuração:
   * o rascunho foi reconstruído e `missing` diz o que não pôde ser recuperado.
   */
  legacy?: { missing: string[] }
}

/** O que regerar a rotina mudaria, sem gravar nada. */
export interface RoutineDiff {
  /** Blocos do cronograma, calculado por diffPlan. */
  plan: PlanDiff
  cycle: { added: number; updated: number; removed: number; kept: number }
  tasks: { added: number; updated: number; removed: number; kept: number }
  /** Frases para a prévia: o que entra, o que sai e o que muda. */
  entering: string[]
  leaving: string[]
  changing: string[]
  /** A configuração salva (pilares, pesos, horários…) difere do rascunho. */
  configChanged: boolean
  unchanged: boolean
}

export const routineMark = (name: string) => `Rotina: ${name}`
export const routineCycleName = (name: string) => `Rotina — ${name}`.slice(0, 160)
export const routinePlanName = routineCycleName

/**
 * Matérias de cada pilar: as do catálogo (subjectKeys) ou, para pilares que
 * entram no ciclo sem matéria sugerida, uma matéria com o nome do pilar.
 */
export function pillarSubjectDefs(p: RoutineTemplatePillar): SubjectDef[] {
  if (p.subjectKeys.length) return p.subjectKeys.map(subjectByKey)
  if (p.frequency !== 'days_per_week') return []
  return [{ key: `rotina_${p.id}`, name: p.name, area: 'Tecnologia', color: '#DEB887', icon: '📌', difficulty: 3, description: p.description, topics: [] }]
}

/** Id provisório usado na prévia, antes de as matérias existirem. */
export const previewSubjectId = (def: SubjectDef) => `key:${def.key}`

function build(draft: RoutineDraft, subjectIdsOf: (p: RoutineTemplatePillar) => string[]): RoutinePreview {
  const pillars = draft.pillars.map((p) => ({ ...p, subjectIds: subjectIdsOf(p) }))
  const milestones = draft.milestones.filter((m): m is RoutineDraftMilestone & { date: DayKey } => Boolean(m.date))
  const output = generateRoutine({ pillars, availability: draft.availability, startDate: draft.startDate, weeks: draft.weeks, milestones })
  const pillarOf = new Map(pillars.map((p) => [p.id, p]))

  const fromPlanner = generatePlan(output.planConfig, output.planSubjects, output.range, draft.startDate)
  const pillarBySubject = new Map<string, string>()
  for (const p of pillars) if (p.frequency === 'days_per_week') for (const s of p.subjectIds) if (!pillarBySubject.has(s)) pillarBySubject.set(s, p.id)
  const planBlocks: RoutinePlanBlock[] = fromPlanner.map((b: PlannedBlock) => {
    const pid = pillarBySubject.get(b.subject_id) ?? null
    const name = pid ? pillarOf.get(pid)!.name : ''
    return { ...b, pillarId: pid, reason: `Cronograma automático: bloco de "${name}" distribuído pelo peso das matérias no tempo livre.` }
  })
  for (const date of eachDay(output.range.from, output.range.to)) {
    for (const d of output.dailyBlocks) {
      if (d.weekday !== weekday(date)) continue
      planBlocks.push({ date, start_time: d.start_time, duration_minutes: d.duration_minutes, subject_id: d.subjectId, activity_type: d.activity_type, pillarId: d.pillarId, reason: d.reason })
    }
  }
  planBlocks.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))

  const mark = routineMark(draft.name)
  const tasks: RoutineTaskRow[] = []
  for (const r of output.recurringTasks) {
    const checklist = pillarOf.get(r.pillarId)?.tasks ?? []
    const description = [mark, r.reason, ...checklist.map((t) => `- [ ] ${t}`)].join('\n')
    for (const date of r.dates) tasks.push({ title: r.title, date, start_time: r.start_time, duration_minutes: r.duration_minutes, subject_id: r.subjectId, kind: 'task', description })
  }
  for (const m of output.milestones) tasks.push({ title: m.title.slice(0, 200), date: m.date, start_time: null, duration_minutes: null, subject_id: null, kind: 'exam', description: [mark, m.reason].join('\n') })

  const weeklyMinutes =
    output.dailyBlocks.reduce((a, b) => a + b.duration_minutes, 0) +
    output.recurringTasks.reduce((a, t) => a + t.duration_minutes, 0) +
    output.cycleItems.reduce((a, c) => a + c.duration_minutes, 0)
  return { rules: ROUTINE_RULES, output, planBlocks, tasks, weeklyMinutes }
}

/** Prévia sem gravar nada: as matérias usam ids provisórios (`key:…`). */
export function previewRoutine(draft: RoutineDraft): RoutinePreview {
  return build(draft, (p) => pillarSubjectDefs(p).map(previewSubjectId))
}

async function insertBatched<T extends 'study_plan_items' | 'calendar_tasks' | 'study_cycle_items'>(backend: DataBackend, table: T, rows: Insert<T>[]) {
  for (let i = 0; i < rows.length; i += BATCH) await backend.insert(table, rows.slice(i, i + BATCH))
}

/** Ids que alguma sessão referencia na coluna indicada (não podem ser apagados). */
async function usedBySessions(backend: DataBackend, column: 'plan_item_id' | 'cycle_item_id', ids: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { rows } = await backend.list('study_sessions', { filters: [inList(column, ids.slice(i, i + 100))] })
    for (const s of rows) if (s[column]) out.add(s[column]!)
  }
  return out
}

type CyclePatch = Pick<StudyCycleItem, 'duration_minutes' | 'weight' | 'sort_order' | 'break_minutes' | 'activity_type'>
type TaskPatch = Pick<CalendarTask, 'duration_minutes' | 'subject_id' | 'kind' | 'description'>
const sameFields = <P extends object>(row: P, patch: P) => (Object.keys(patch) as Array<keyof P>).every((k) => (row[k] ?? null) === (patch[k] ?? null))

/** Casa os itens do ciclo pela matéria: o que mudou é atualizado no lugar (mesmo id). */
function reconcileCycle(existing: StudyCycleItem[], wanted: RoutineOutput['cycleItems']) {
  const unused = [...existing]
  const inserts: Array<{ subjectId: string; patch: CyclePatch }> = []
  const updates: Array<{ item: StudyCycleItem; patch: CyclePatch }> = []
  let kept = 0
  for (const w of wanted) {
    if (!w.subjectId) continue
    const patch: CyclePatch = { duration_minutes: Math.max(5, w.duration_minutes), weight: Math.max(0.1, Math.min(100, w.weight)), sort_order: w.sort_order, break_minutes: w.break_minutes, activity_type: w.activity_type }
    const idx = unused.findIndex((e) => e.subject_id === w.subjectId)
    if (idx < 0) {
      inserts.push({ subjectId: w.subjectId, patch })
      continue
    }
    const [e] = unused.splice(idx, 1)
    if (sameFields<CyclePatch>(e, patch)) kept++
    else updates.push({ item: e, patch })
  }
  return { inserts, updates, kept, unused }
}

const blockKey = (b: Pick<StudyPlanItem, 'date' | 'start_time' | 'subject_id' | 'duration_minutes' | 'activity_type'>) =>
  `${b.date}|${b.start_time}|${b.subject_id ?? ''}|${b.duration_minutes}|${b.activity_type}`

/**
 * Separa os blocos existentes: os pendentes sem sessão podem ser substituídos; os
 * demais (feitos, remarcados ou usados por sessão) são histórico — o bloco proposto
 * que casa com eles não volta, e eles nunca saem.
 */
function splitBlocks(rows: StudyPlanItem[], used: Set<string>, wanted: RoutinePlanBlock[]) {
  const history = new Map<string, number>()
  const replaceable: StudyPlanItem[] = []
  for (const r of rows) {
    if (r.status === 'pending' && !used.has(r.id)) replaceable.push(r)
    else history.set(blockKey(r), (history.get(blockKey(r)) ?? 0) + 1)
  }
  const fresh: RoutinePlanBlock[] = []
  let historyKept = 0
  for (const b of wanted) {
    const n = history.get(blockKey(b)) ?? 0
    if (n > 0) {
      history.set(blockKey(b), n - 1)
      historyKept++
    } else fresh.push(b)
  }
  return { replaceable, fresh, historyKept }
}

/** Casa as tarefas da rotina (marcadas na descrição) por data, horário e título. */
function reconcileTasks(rows: CalendarTask[], wanted: RoutineTaskRow[], mark: string) {
  const isMine = (d: string | null) => d === mark || Boolean(d?.startsWith(`${mark}\n`))
  const taskKey = (t: { date: string; start_time: string | null; title: string }) => `${t.date}|${t.start_time ?? ''}|${t.title}`
  const pool = new Map<string, CalendarTask[]>()
  const done = new Map<string, number>()
  for (const t of rows) {
    if (!isMine(t.description)) continue
    if (t.done) done.set(taskKey(t), (done.get(taskKey(t)) ?? 0) + 1)
    else pool.set(taskKey(t), [...(pool.get(taskKey(t)) ?? []), t])
  }
  const inserts: RoutineTaskRow[] = []
  const updates: Array<{ task: CalendarTask; patch: TaskPatch }> = []
  let kept = 0
  for (const t of wanted) {
    const k = taskKey(t)
    const match = pool.get(k)
    if (match?.length) {
      // Tarefa pendente: mantém o id e atualiza os campos gerados que mudaram.
      const e = match.shift()!
      const patch: TaskPatch = { duration_minutes: t.duration_minutes, subject_id: t.subject_id, kind: t.kind, description: t.description }
      if (sameFields<TaskPatch>(e, patch)) kept++
      else updates.push({ task: e, patch })
    } else if (done.get(k)) {
      done.set(k, done.get(k)! - 1)
      kept++
    } else inserts.push(t)
  }
  return { inserts, updates, kept, drop: [...pool.values()].flat() }
}

const weeklyTarget = (preview: RoutinePreview) => Math.round((preview.weeklyMinutes / 60) * 2) / 2

const hasRoutine = (p: StudyPlan) => Array.isArray((p.config as RoutinePlanConfig | null)?.routine?.pillars)

/** Nome da rotina de um cronograma gravado pela versão anterior (sem config.routine). */
function legacyRoutineName(p: StudyPlan): string | null {
  if (!p.config?.availability || !p.config.commitments) return null
  const m = p.description?.match(/^Rotina: (.+)\. Gerado pelas regras da rotina\.$/)
  if (m && routinePlanName(m[1]) === p.name) return m[1]
  return null
}

const minutesOf = (ws: TimeWindow[] = []) => ws.reduce((a, w) => a + Math.max(0, hhmmToMinutes(w.end) - hhmmToMinutes(w.start)), 0)

/**
 * Reconstrói o rascunho a partir do config do planner gravado antes. Recupera
 * exatamente: nome, modelo, início, semanas, pausa e limite semanal (tempo livre +
 * compromissos). Aproxima: janelas (do primeiro ao último horário usado) e limite
 * diário. Pilares e marcos sem data vêm do modelo.
 */
function legacyDraft(plan: StudyPlan, name: string): AppliedRoutine {
  const cfg = plan.config
  const template = ROUTINE_TEMPLATES.find((t) => norm(t.name) === norm(name)) ?? ROUTINE_TEMPLATES.find((t) => !t.pillars.length)!
  const copy = cloneRoutineTemplate(template)
  const missing: string[] = []
  if (copy.pillars.length) missing.push(`Pilares, frequências e blocos vieram do modelo "${template.name}"; confira os pesos.`)
  else missing.push('Os pilares não foram salvos pela versão anterior: adicione-os de novo.')

  const days: Record<number, TimeWindow[]> = {}
  let used = 0
  let dailyMax = 0
  for (let d = 0; d < 7; d++) {
    const ws = [...(cfg.availability[d] ?? []), ...(cfg.commitments[d] ?? [])]
    used += minutesOf(cfg.commitments[d])
    dailyMax = Math.max(dailyMax, minutesOf(ws))
    days[d] = ws.length ? [{ start: ws.map((w) => w.start).sort()[0], end: ws.map((w) => w.end).sort()[ws.length - 1] }] : []
  }
  const dailyLimitMinutes = cfg.dailyHoursGoal == null ? null : dailyMax
  if (dailyLimitMinutes !== null) missing.push('O fim de cada janela de horário e o limite diário são aproximados (o tempo além do limite não foi salvo).')
  missing.push('Marcos sem data não foram salvos; os do calendário são recuperados.')

  const draft: RoutineDraft = {
    templateId: template.id,
    name,
    pillars: copy.pillars,
    availability: {
      days,
      dailyLimitMinutes,
      weeklyLimitMinutes: cfg.weeklyHoursGoal == null ? null : Math.round(cfg.weeklyHoursGoal * 60 + used),
      breakMinutes: cfg.breakMinutes,
    },
    startDate: plan.start_date,
    weeks: Math.max(1, Math.round((diffDays(plan.start_date, plan.end_date) + 1) / 7)),
    milestones: copy.milestones.map((m) => ({ ...m })),
  }
  return { planId: plan.id, draft, legacy: { missing } }
}

/** Rotina aplicada mais recente entre os cronogramas ativos (a que é carregada para edição). */
export function appliedRoutineFrom(plans: StudyPlan[]): AppliedRoutine | null {
  const found = plans
    .filter((p) => p.status === 'active' && (hasRoutine(p) || legacyRoutineName(p) !== null))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  if (!found) return null
  if (!hasRoutine(found)) return legacyDraft(found, legacyRoutineName(found)!)
  return { planId: found.id, draft: JSON.parse(JSON.stringify((found.config as RoutinePlanConfig).routine)) as RoutineDraft }
}

/**
 * Carrega a rotina aplicada. Para rotinas da versão anterior, completa o rascunho
 * com o que está gravado: pesos dos pilares (itens do ciclo) e marcos (provas no calendário).
 */
export async function loadAppliedRoutine(backend: DataBackend): Promise<AppliedRoutine | null> {
  const { rows } = await backend.list('study_plans', { filters: [eq('status', 'active')] })
  const applied = appliedRoutineFrom(rows)
  if (!applied?.legacy) return applied
  const { draft } = applied
  const { rows: cycles } = await backend.list('study_cycles', { filters: [eq('name', routineCycleName(draft.name)), inList('status', ['active', 'paused'])] })
  const cycle = cycles.find((c) => c.status === 'active') ?? cycles[0]
  if (cycle) {
    const { rows: items } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] })
    const { rows: subjects } = await backend.list('subjects')
    const idByName = new Map(subjects.map((s) => [norm(s.name), s.id] as const))
    for (const p of draft.pillars) {
      if (p.frequency !== 'days_per_week') continue
      const sid = pillarSubjectDefs(p).map((d) => idByName.get(norm(d.name)))[0]
      const item = items.find((i) => i.subject_id === sid)
      if (item) p.weight = item.weight
    }
  }
  const mark = routineMark(draft.name)
  const { rows: exams } = await backend.list('calendar_tasks', { filters: [eq('kind', 'exam')] })
  const dated = exams
    .filter((t) => t.description === mark || Boolean(t.description?.startsWith(`${mark}\n`)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t): RoutineDraftMilestone => ({ title: t.title, date: t.date, pillarId: draft.milestones.find((m) => m.title === t.title)?.pillarId ?? null }))
  draft.milestones = [...dated, ...draft.milestones.filter((m) => !dated.some((x) => x.title === m.title))]
  return applied
}

/** JSON com as chaves em ordem, para comparar configurações. */
const canonical = (v: unknown) =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

const FREQ_TEXT: Record<RoutineTemplatePillar['frequency'], string> = { daily: 'diário', days_per_week: 'alguns dias por semana', weekly: 'semanal' }

/** Frases com o que muda entre a configuração salva e o rascunho editado. */
export function routineConfigChanges(saved: RoutineDraft, draft: RoutineDraft): string[] {
  const out: string[] = []
  const win = (ws: TimeWindow[] = []) => (ws.length ? ws.map((w) => `${w.start}–${w.end}`).join(', ') : 'sem horário')
  const lim = (n: number | null | undefined) => (n == null ? 'sem limite' : `${n} min`)
  const before = new Map(saved.pillars.map((p) => [p.id, p]))
  for (const p of draft.pillars) {
    const o = before.get(p.id)
    if (!o) {
      out.push(`Pilar novo: ${p.name}`)
      continue
    }
    const parts: string[] = []
    if (o.name !== p.name) parts.push(`nome "${o.name}" → "${p.name}"`)
    if (o.weight !== p.weight) parts.push(`peso ${o.weight} → ${p.weight}`)
    if (o.frequency !== p.frequency) parts.push(`${FREQ_TEXT[o.frequency]} → ${FREQ_TEXT[p.frequency]}`)
    if ((o.daysPerWeek ?? 1) !== (p.daysPerWeek ?? 1)) parts.push(`${o.daysPerWeek ?? 1} → ${p.daysPerWeek ?? 1} dia(s) por semana`)
    if (o.blockMinutes !== p.blockMinutes) parts.push(`bloco ${o.blockMinutes} → ${p.blockMinutes} min`)
    if (o.activityType !== p.activityType) parts.push(`${ACTIVITY_LABELS[o.activityType]} → ${ACTIVITY_LABELS[p.activityType]}`)
    if (parts.length) out.push(`Pilar ${p.name}: ${parts.join(', ')}`)
  }
  for (const o of saved.pillars) if (!draft.pillars.some((p) => p.id === o.id)) out.push(`Pilar removido: ${o.name}`)
  for (let d = 0; d < 7; d++) {
    const a = win(saved.availability.days[d])
    const b = win(draft.availability.days[d])
    if (a !== b) out.push(`Horário de ${WEEKDAY_LABELS[d]}: ${a} → ${b}`)
  }
  const sa = saved.availability
  const da = draft.availability
  if ((sa.dailyLimitMinutes ?? null) !== (da.dailyLimitMinutes ?? null)) out.push(`Limite por dia: ${lim(sa.dailyLimitMinutes)} → ${lim(da.dailyLimitMinutes)}`)
  if ((sa.weeklyLimitMinutes ?? null) !== (da.weeklyLimitMinutes ?? null)) out.push(`Limite por semana: ${lim(sa.weeklyLimitMinutes)} → ${lim(da.weeklyLimitMinutes)}`)
  if ((sa.breakMinutes ?? 10) !== (da.breakMinutes ?? 10)) out.push(`Pausa entre blocos: ${sa.breakMinutes ?? 10} → ${da.breakMinutes ?? 10} min`)
  if (saved.startDate !== draft.startDate) out.push(`Início: ${saved.startDate} → ${draft.startDate}`)
  if (saved.weeks !== draft.weeks) out.push(`Semanas planejadas: ${saved.weeks} → ${draft.weeks}`)
  if (canonical(saved.milestones) !== canonical(draft.milestones)) out.push(`Marcos: ${saved.milestones.length} → ${draft.milestones.length} (títulos ou datas ajustados)`)
  if (!out.length && canonical(saved) !== canonical(draft)) out.push('Configuração da rotina: outros ajustes (ordem ou descrição dos pilares)')
  return out
}

const countBy = (titles: string[]) => {
  const m = new Map<string, number>()
  for (const t of titles) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m]
}

/**
 * Prévia de regerar a rotina: compara o que seria gerado com o que já está gravado
 * (os blocos do cronograma pelo diffPlan) e não grava nada.
 */
export async function diffRoutine(backend: DataBackend, draft: RoutineDraft): Promise<RoutineDiff> {
  const name = draft.name.trim() || 'Minha rotina'
  draft = { ...draft, name }
  const { rows: subjects } = await backend.list('subjects')
  const idByName = new Map(subjects.map((s) => [norm(s.name), s.id] as const))
  const nameById = new Map(subjects.map((s) => [s.id, s.name] as const))
  const entering: string[] = []
  const leaving: string[] = []
  const changing: string[] = []
  for (const p of draft.pillars) {
    for (const d of pillarSubjectDefs(p)) {
      if (idByName.has(norm(d.name)) || nameById.has(previewSubjectId(d))) continue
      nameById.set(previewSubjectId(d), d.name)
      entering.push(`Matéria nova: ${d.name}`)
    }
  }
  const preview = build(draft, (p) => pillarSubjectDefs(p).map((d) => idByName.get(norm(d.name)) ?? previewSubjectId(d)))
  const { output } = preview
  const label = (sid: string | null) => (sid ? (nameById.get(sid) ?? 'matéria sem nome') : 'sem matéria')

  // Ciclo.
  const { rows: cycles } = await backend.list('study_cycles', { filters: [eq('name', routineCycleName(name)), inList('status', ['active', 'paused'])] })
  const current = cycles.find((c) => c.status === 'active') ?? cycles[0]
  const items = current ? (await backend.list('study_cycle_items', { filters: [eq('cycle_id', current.id)] })).rows : []
  const rc = reconcileCycle(items, output.cycleItems)
  const usedItems = await usedBySessions(backend, 'cycle_item_id', rc.unused.map((e) => e.id))
  const dropItems = rc.unused.filter((e) => !usedItems.has(e.id))
  for (const i of rc.inserts) entering.push(`Ciclo: ${label(i.subjectId)} (${i.patch.duration_minutes} min por volta)`)
  for (const e of dropItems) leaving.push(`Ciclo: ${label(e.subject_id)} (${e.duration_minutes} min por volta)`)
  for (const { item, patch } of rc.updates) {
    const parts: string[] = []
    if (item.duration_minutes !== patch.duration_minutes) parts.push(`${item.duration_minutes} → ${patch.duration_minutes} min`)
    if (item.weight !== patch.weight) parts.push(`peso ${item.weight} → ${patch.weight}`)
    if (item.activity_type !== patch.activity_type) parts.push(`${ACTIVITY_LABELS[item.activity_type]} → ${ACTIVITY_LABELS[patch.activity_type]}`)
    if (item.sort_order !== patch.sort_order) parts.push('nova posição')
    if (item.break_minutes !== patch.break_minutes) parts.push(`pausa ${item.break_minutes} → ${patch.break_minutes} min`)
    changing.push(`Ciclo: ${label(item.subject_id)} (${parts.join(', ')})`)
  }

  // Cronograma: diffPlan sobre os blocos substituíveis. A atividade entra no
  // subject_id comparado para que trocar a atividade conte como mudança.
  const { rows: plans } = await backend.list('study_plans', { filters: [eq('name', routinePlanName(name)), eq('status', 'active')] })
  const plan = plans[0]
  // Configuração salva × rascunho: horários ou pesos podem mudar sem mudar nenhum item gerado.
  const saved = plan ? (plan.config as RoutinePlanConfig | null)?.routine : undefined
  const configChanges = !plan
    ? []
    : saved
      ? routineConfigChanges(saved, draft)
      : ['Configuração da rotina: passa a ficar salva para edição (rotina aplicada por uma versão anterior).']
  changing.push(...configChanges)
  const rows = plan ? (await backend.list('study_plan_items', { filters: [eq('plan_id', plan.id), gte('date', output.range.from)] })).rows : []
  const usedBlocks = await usedBySessions(backend, 'plan_item_id', rows.filter((r) => r.status === 'pending').map((r) => r.id))
  const { replaceable, fresh, historyKept } = splitBlocks(rows, usedBlocks, preview.planBlocks)
  const tag = (sid: string | null, a: ActivityType) => `${sid ?? ''}#${a}`
  const raw = diffPlan(
    replaceable.map((r) => ({ ...r, subject_id: tag(r.subject_id, r.activity_type) })),
    fresh.map((b) => ({ ...b, subject_id: tag(b.subject_id, b.activity_type) })),
  )
  const bySubject = (m: Map<string, number>) => {
    const out = new Map<string, number>()
    for (const [k, v] of m) {
      const sid = k.slice(0, k.lastIndexOf('#'))
      out.set(sid, (out.get(sid) ?? 0) + v)
    }
    return out
  }
  const planDiff: PlanDiff = { ...raw, kept: raw.kept + historyKept, addedMinutesBySubject: bySubject(raw.addedMinutesBySubject), removedMinutesBySubject: bySubject(raw.removedMinutesBySubject) }
  for (const k of new Set([...raw.addedMinutesBySubject.keys(), ...raw.removedMinutesBySubject.keys()])) {
    const i = k.lastIndexOf('#')
    const what = `${label(k.slice(0, i) || null)} · ${ACTIVITY_LABELS[k.slice(i + 1) as ActivityType] ?? k.slice(i + 1)}`
    const add = raw.addedMinutesBySubject.get(k) ?? 0
    const rem = raw.removedMinutesBySubject.get(k) ?? 0
    if (add && rem) changing.push(`Cronograma: ${what} (${rem} min pendentes saem, ${add} min entram)`)
    else if (add) entering.push(`Cronograma: ${what} (${add} min em blocos novos)`)
    else leaving.push(`Cronograma: ${what} (${rem} min em blocos pendentes)`)
  }
  if (plan && (plan.start_date !== output.range.from || plan.end_date !== output.range.to)) changing.push(`Período do cronograma: ${plan.start_date} a ${plan.end_date} → ${output.range.from} a ${output.range.to}`)

  // Tarefas de calendário.
  const { rows: taskRows } = await backend.list('calendar_tasks', { filters: [gte('date', output.range.from)] })
  const rt = reconcileTasks(taskRows, preview.tasks, routineMark(name))
  for (const [t, n] of countBy(rt.inserts.map((x) => x.title))) entering.push(`Calendário: "${t}" (${n} tarefa(s))`)
  for (const [t, n] of countBy(rt.drop.map((x) => x.title))) leaving.push(`Calendário: "${t}" (${n} tarefa(s) pendente(s))`)
  for (const [t, n] of countBy(rt.updates.map((x) => x.task.title))) changing.push(`Calendário: "${t}" (${n} tarefa(s) atualizada(s))`)

  // Meta semanal.
  const target = weeklyTarget(preview)
  if (target > 0) {
    const { rows: goals } = await backend.list('study_goals', { filters: [eq('title', routineMark(name)), eq('status', 'active')] })
    if (!goals.length) entering.push(`Meta semanal de ${target} h`)
    else if (goals[0].target !== target) changing.push(`Meta semanal: ${goals[0].target} h → ${target} h`)
  }

  return {
    plan: planDiff,
    cycle: { added: rc.inserts.length, updated: rc.updates.length, removed: dropItems.length, kept: rc.kept },
    tasks: { added: rt.inserts.length, updated: rt.updates.length, removed: rt.drop.length, kept: rt.kept },
    entering,
    leaving,
    changing,
    configChanged: configChanges.length > 0,
    unchanged: !entering.length && !leaving.length && !changing.length,
  }
}

export async function applyRoutine(backend: DataBackend, draft: RoutineDraft, opts: { onProgress?: (m: string) => void } = {}): Promise<ApplyRoutineResult> {
  const progress = opts.onProgress ?? (() => {})
  const name = draft.name.trim() || 'Minha rotina'
  draft = { ...draft, name }

  // 1) Matérias e tópicos pelo serviço de trilhas (reaproveita pelo nome).
  const defs = new Map<string, { subject: SubjectDef; weight: number }>()
  for (const p of draft.pillars) {
    for (const d of pillarSubjectDefs(p)) {
      const cur = defs.get(d.key)
      defs.set(d.key, { subject: d, weight: Math.max(cur?.weight ?? 0, p.weight * 2) })
    }
  }
  const installed = defs.size
    ? await installTrail(backend, [...defs.values()], { cycleMinutes: null, onProgress: progress })
    : { subjectsCreated: 0, subjectsReused: 0, topicsCreated: 0 }
  const { rows: subjects } = await backend.list('subjects')
  const idByName = new Map(subjects.map((s) => [norm(s.name), s.id] as const))
  const preview = build(draft, (p) => pillarSubjectDefs(p).map((d) => idByName.get(norm(d.name))!).filter(Boolean))
  const { output } = preview

  // 2) Ciclo ativo da rotina: atualiza os itens no lugar.
  progress('Montando o ciclo…')
  const cycleName = routineCycleName(name)
  const cycleItems = { added: 0, updated: 0, removed: 0, kept: 0 }
  let cycleId: string | null = null
  let cycleCreated = false
  const wanted = output.cycleItems.filter((c) => c.subjectId)
  const { rows: cycles } = await backend.list('study_cycles', { filters: [eq('name', cycleName), inList('status', ['active', 'paused'])] })
  if (wanted.length || cycles.length) {
    let cycle = cycles.find((c) => c.status === 'active') ?? cycles[0]
    if (!cycle || cycle.status !== 'active') {
      await backend.update('study_cycles', [eq('status', 'active')], { status: 'paused' })
      if (cycle) [cycle] = await backend.update('study_cycles', [eq('id', cycle.id)], { status: 'active' })
      else {
        ;[cycle] = await backend.insert('study_cycles', [{ name: cycleName, description: `${routineMark(name)}. Durações proporcionais ao peso de cada pilar.`, status: 'active', auto_advance: true }])
        cycleCreated = true
      }
    }
    const cid = cycle.id
    cycleId = cid
    const { rows: existing } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cid)] })
    const { inserts, updates, kept, unused } = reconcileCycle(existing, wanted)
    for (const { item, patch } of updates) await backend.update('study_cycle_items', [eq('id', item.id)], patch)
    if (inserts.length) await insertBatched(backend, 'study_cycle_items', inserts.map((i) => ({ cycle_id: cid, subject_id: i.subjectId, ...i.patch })))
    cycleItems.added = inserts.length
    cycleItems.updated = updates.length
    cycleItems.kept = kept
    const used = await usedBySessions(backend, 'cycle_item_id', unused.map((e) => e.id))
    const drop = unused.filter((e) => !used.has(e.id)).map((e) => e.id)
    if (drop.length) cycleItems.removed = await backend.remove('study_cycle_items', [inList('id', drop)])
  }

  // 3) Cronograma da rotina e seus blocos.
  progress('Montando o cronograma…')
  const planName = routinePlanName(name)
  const { rows: plans } = await backend.list('study_plans', { filters: [eq('name', planName), eq('status', 'active')] })
  let plan = plans[0]
  const planCreated = !plan
  const config: RoutinePlanConfig = { ...output.planConfig, routine: draft }
  const planFields = { start_date: output.range.from, end_date: output.range.to, config }
  if (!plan) [plan] = await backend.insert('study_plans', [{ name: planName, description: `${routineMark(name)}. Gerado pelas regras da rotina.`, status: 'active', ...planFields }])
  else if (plan.start_date !== planFields.start_date || plan.end_date !== planFields.end_date || JSON.stringify(plan.config) !== JSON.stringify(planFields.config))
    [plan] = await backend.update('study_plans', [eq('id', plan.id)], planFields)

  const { rows: planRows } = await backend.list('study_plan_items', { filters: [eq('plan_id', plan.id), gte('date', output.range.from)] })
  const usedBlocks = await usedBySessions(backend, 'plan_item_id', planRows.filter((r) => r.status === 'pending').map((r) => r.id))
  const { replaceable, fresh, historyKept } = splitBlocks(planRows, usedBlocks, preview.planBlocks)
  const pool = new Map<string, StudyPlanItem[]>()
  for (const r of replaceable) pool.set(blockKey(r), [...(pool.get(blockKey(r)) ?? []), r])
  const newBlocks: Insert<'study_plan_items'>[] = []
  let keptBlocks = historyKept
  for (const b of fresh) {
    const match = pool.get(blockKey(b))
    if (match?.length) {
      match.shift()
      keptBlocks++
    } else newBlocks.push({ plan_id: plan.id, date: b.date, start_time: b.start_time, duration_minutes: b.duration_minutes, subject_id: b.subject_id, activity_type: b.activity_type })
  }
  const dropBlocks = [...pool.values()].flat().map((r) => r.id)
  let removedBlocks = 0
  for (let i = 0; i < dropBlocks.length; i += BATCH) removedBlocks += await backend.remove('study_plan_items', [inList('id', dropBlocks.slice(i, i + BATCH))])
  if (newBlocks.length) await insertBatched(backend, 'study_plan_items', newBlocks)

  // 4) Tarefas de calendário (semanais e marcos), marcadas na descrição.
  progress('Criando tarefas no calendário…')
  const mark = routineMark(name)
  const { rows: taskRows } = await backend.list('calendar_tasks', { filters: [gte('date', output.range.from)] })
  const rt = reconcileTasks(taskRows, preview.tasks, mark)
  for (const { task, patch } of rt.updates) await backend.update('calendar_tasks', [eq('id', task.id)], patch)
  const newTasks: Insert<'calendar_tasks'>[] = rt.inserts.map((t) => ({ ...t }))
  const keptTasks = rt.kept
  const updatedTasks = rt.updates.length
  const dropTasks = rt.drop.map((t) => t.id)
  let removedTasks = 0
  for (let i = 0; i < dropTasks.length; i += BATCH) removedTasks += await backend.remove('calendar_tasks', [inList('id', dropTasks.slice(i, i + BATCH))])
  if (newTasks.length) await insertBatched(backend, 'calendar_tasks', newTasks)

  // 5) Meta semanal de horas da rotina.
  let goalCreated = false
  const target = weeklyTarget(preview)
  if (target > 0) {
    const { rows: goals } = await backend.list('study_goals', { filters: [eq('title', mark), eq('status', 'active')] })
    if (!goals.length) {
      await backend.insert('study_goals', [{ title: mark, metric: 'study_hours', period: 'weekly', target, start_date: output.range.from }])
      goalCreated = true
    } else if (goals[0].target !== target) await backend.update('study_goals', [eq('id', goals[0].id)], { target })
  }

  progress('Pronto!')
  return {
    subjectsCreated: installed.subjectsCreated,
    subjectsReused: installed.subjectsReused,
    topicsCreated: installed.topicsCreated,
    cycleId,
    cycleCreated,
    cycleItems,
    planId: plan.id,
    planCreated,
    planItems: { added: newBlocks.length, removed: removedBlocks, kept: keptBlocks },
    tasks: { added: newTasks.length, updated: updatedTasks, removed: removedTasks, kept: keptTasks },
    goalCreated,
  }
}
