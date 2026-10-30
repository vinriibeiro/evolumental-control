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
import { generatePlan, type PlannedBlock } from '@/lib/planner'
import { eachDay, weekday, type DayKey } from '@/lib/time'
import type { RoutineTemplatePillar } from '@/content/routines'
import { subjectByKey, type SubjectDef } from '@/content/trails'
import type { ActivityType, CalendarTask, Insert, StudyPlanItem } from '@/types/db'
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
  if (!ids.length) return new Set()
  const { rows } = await backend.list('study_sessions', { filters: [inList(column, ids)] })
  return new Set(rows.map((s) => s[column]).filter((x): x is string => Boolean(x)))
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
    cycleId = cycle.id
    const { rows: existing } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] })
    const unused = [...existing]
    const inserts: Insert<'study_cycle_items'>[] = []
    for (const w of wanted) {
      const patch = { duration_minutes: Math.max(5, w.duration_minutes), weight: Math.max(0.1, Math.min(100, w.weight)), sort_order: w.sort_order, break_minutes: w.break_minutes, activity_type: w.activity_type }
      const idx = unused.findIndex((e) => e.subject_id === w.subjectId)
      if (idx < 0) {
        inserts.push({ cycle_id: cycle.id, subject_id: w.subjectId!, ...patch })
        continue
      }
      const [e] = unused.splice(idx, 1)
      const same = (Object.keys(patch) as Array<keyof typeof patch>).every((k) => e[k] === patch[k])
      if (same) cycleItems.kept++
      else {
        await backend.update('study_cycle_items', [eq('id', e.id)], patch)
        cycleItems.updated++
      }
    }
    if (inserts.length) await insertBatched(backend, 'study_cycle_items', inserts)
    cycleItems.added = inserts.length
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
  const planFields = { start_date: output.range.from, end_date: output.range.to, config: output.planConfig }
  if (!plan) [plan] = await backend.insert('study_plans', [{ name: planName, description: `${routineMark(name)}. Gerado pelas regras da rotina.`, status: 'active', ...planFields }])
  else if (plan.start_date !== planFields.start_date || plan.end_date !== planFields.end_date || JSON.stringify(plan.config) !== JSON.stringify(planFields.config))
    [plan] = await backend.update('study_plans', [eq('id', plan.id)], planFields)

  const blockKey = (b: Pick<StudyPlanItem, 'date' | 'start_time' | 'subject_id' | 'duration_minutes' | 'activity_type'>) =>
    `${b.date}|${b.start_time}|${b.subject_id ?? ''}|${b.duration_minutes}|${b.activity_type}`
  const { rows: planRows } = await backend.list('study_plan_items', { filters: [eq('plan_id', plan.id), gte('date', output.range.from)] })
  const pool = new Map<string, StudyPlanItem[]>()
  for (const r of planRows) pool.set(blockKey(r), [...(pool.get(blockKey(r)) ?? []), r])
  const newBlocks: Insert<'study_plan_items'>[] = []
  let keptBlocks = 0
  for (const b of preview.planBlocks) {
    const match = pool.get(blockKey(b))
    if (match?.length) {
      match.shift() // qualquer status conta: blocos feitos ou remarcados não voltam
      keptBlocks++
    } else newBlocks.push({ plan_id: plan.id, date: b.date, start_time: b.start_time, duration_minutes: b.duration_minutes, subject_id: b.subject_id, activity_type: b.activity_type })
  }
  const stale = [...pool.values()].flat().filter((r) => r.status === 'pending')
  const usedBlocks = await usedBySessions(backend, 'plan_item_id', stale.map((r) => r.id))
  const dropBlocks = stale.filter((r) => !usedBlocks.has(r.id)).map((r) => r.id)
  let removedBlocks = 0
  for (let i = 0; i < dropBlocks.length; i += BATCH) removedBlocks += await backend.remove('study_plan_items', [inList('id', dropBlocks.slice(i, i + BATCH))])
  if (newBlocks.length) await insertBatched(backend, 'study_plan_items', newBlocks)

  // 4) Tarefas de calendário (semanais e marcos), marcadas na descrição.
  progress('Criando tarefas no calendário…')
  const mark = routineMark(name)
  const isMine = (d: string | null) => d === mark || Boolean(d?.startsWith(`${mark}\n`))
  const taskKey = (t: { date: string; start_time: string | null; title: string }) => `${t.date}|${t.start_time ?? ''}|${t.title}`
  const { rows: taskRows } = await backend.list('calendar_tasks', { filters: [gte('date', output.range.from)] })
  const taskPool = new Map<string, CalendarTask[]>()
  const doneOrOther = new Set<string>()
  for (const t of taskRows) {
    if (!isMine(t.description)) continue
    if (t.done) doneOrOther.add(taskKey(t))
    else taskPool.set(taskKey(t), [...(taskPool.get(taskKey(t)) ?? []), t])
  }
  const newTasks: Insert<'calendar_tasks'>[] = []
  let keptTasks = 0
  let updatedTasks = 0
  for (const t of preview.tasks) {
    const k = taskKey(t)
    const match = taskPool.get(k)
    if (match?.length) {
      // Tarefa pendente: mantém o id e atualiza os campos gerados que mudaram.
      const e = match.shift()!
      const patch = { duration_minutes: t.duration_minutes, subject_id: t.subject_id, kind: t.kind, description: t.description }
      const same = (Object.keys(patch) as Array<keyof typeof patch>).every((f) => (e[f] ?? null) === patch[f])
      if (same) keptTasks++
      else {
        await backend.update('calendar_tasks', [eq('id', e.id)], patch)
        updatedTasks++
      }
    } else if (doneOrOther.has(k)) {
      doneOrOther.delete(k)
      keptTasks++
    } else newTasks.push({ ...t })
  }
  const dropTasks = [...taskPool.values()].flat().map((t) => t.id)
  const removedTasks = dropTasks.length ? await backend.remove('calendar_tasks', [inList('id', dropTasks)]) : 0
  if (newTasks.length) await insertBatched(backend, 'calendar_tasks', newTasks)

  // 5) Meta semanal de horas da rotina.
  let goalCreated = false
  const target = Math.round((preview.weeklyMinutes / 60) * 2) / 2
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
