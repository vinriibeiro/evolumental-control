// Integração total entre Cursos do Google Drive, Matérias, Ciclo de Estudos e Cronograma (área de Dados).
import { eq, type DataBackend } from '@/lib/data/types'
import { courseStatus, displayTitle, type CourseView } from '@/lib/courseCatalog'
import { FOLDER_MIME, parseDriveFolder } from '@/lib/drive'
import { addSource } from '@/services/courses'
import { createTask } from '@/services/tasks'
import type { ActivityType, CalendarTask, CourseNode, ISODate, StudyCycle, StudyCycleItem, Subject, TableName } from '@/types/db'

export const MANUAL_DRIVE_SOURCE_ID = 'manual:drive'

export const INTEGRATION_TABLES: TableName[] = [
  'course_sources',
  'course_nodes',
  'course_progress',
  'subjects',
  'study_cycles',
  'study_cycle_items',
  'calendar_tasks',
]

export type DataAreaId = 'sql' | 'python' | 'ml' | 'engenharia' | 'bi' | 'estatistica' | 'ferramentas' | 'dados'

export interface DataArea {
  id: DataAreaId
  label: string
  color: string
  keywords: RegExp
}

export const DATA_AREAS: DataArea[] = [
  { id: 'sql', label: 'SQL & Bancos', color: '#2A78D6', keywords: /\b(sql|postgres|postgresql|mysql|sqlite|oracle|tsql|plsql|bigquery|banco de dados|modelagem relacional|duckdb)\b/i },
  { id: 'python', label: 'Python & Pandas', color: '#3776AB', keywords: /\b(python|pandas|numpy|polars|jupyter|colab|fastapi|streamlit|pydantic|automacao)\b/i },
  { id: 'estatistica', label: 'Estatística & Mat.', color: '#7C3AED', keywords: /\b(estatistica|probabilidade|matematica|algebra|calculo|inferencia|hipotese|regressao|series temporais|experimento|teste a\/b)\b/i },
  { id: 'ml', label: 'Machine Learning & IA', color: '#B91C1C', keywords: /\b(machine learning|mlops|mlflow|deep learning|scikit|sklearn|xgboost|lightgbm|nlp|llm|ia|inteligencia artificial|redes neurais|pytorch|tensorflow|ciencia de dados|data science)\b/i },
  { id: 'engenharia', label: 'Engenharia de Dados', color: '#0F766E', keywords: /\b(engenharia de dados|data engineering|spark|pyspark|airflow|dbt|kafka|databricks|snowflake|aws|gcp|azure|cloud|etl|elt|lakehouse|delta lake|pipeline|warehousing|warehouse)\b/i },
  { id: 'bi', label: 'BI & Visualização', color: '#D97706', keywords: /\b(power bi|powerbi|dax|power query|tableau|looker|metabase|qlik|excel|storytelling|dashboard|visualizacao|analise de dados|analytics)\b/i },
  { id: 'ferramentas', label: 'Git, Linux & Dev', color: '#525252', keywords: /\b(git|github|linux|docker|kubernetes|bash|shell|vscode|terraform|ci\/cd|devops)\b/i },
  { id: 'dados', label: 'Dados (Geral)', color: '#171717', keywords: /.*/ },
]

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

/** Classifica automaticamente um curso ou matéria em uma área de Dados pelo nome. */
export function detectDataArea(title: string, extra?: string | null): DataArea {
  const hay = norm(`${title} ${extra ?? ''}`)
  for (const area of DATA_AREAS) {
    if (area.id !== 'dados' && area.keywords.test(hay)) return area
  }
  return DATA_AREAS[DATA_AREAS.length - 1]
}

export function dataAreaById(id: DataAreaId | string | null | undefined): DataArea {
  return DATA_AREAS.find((a) => a.id === id) ?? DATA_AREAS[DATA_AREAS.length - 1]
}

/** Extrai ID e tipo de qualquer link do Google Drive (pasta, vídeo, PDF, Docs, Slides, Planilhas). */
export function parseDriveLink(raw: string): { id: string; kind: 'folder' | 'file'; mimeType: string } | null {
  const s = raw.trim()
  if (!s) return null
  const folder = parseDriveFolder(s)
  if (folder && (/\/folders\//i.test(s) || /^[A-Za-z0-9_-]{15,120}$/.test(s))) {
    return { id: folder, kind: 'folder', mimeType: FOLDER_MIME }
  }
  const fileMatch = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,120})/i.exec(s)
  if (fileMatch) return { id: fileMatch[1], kind: 'file', mimeType: 'video/mp4' }
  const openMatch = /drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([A-Za-z0-9_-]{10,120})/i.exec(s)
  if (openMatch) return { id: openMatch[1], kind: 'file', mimeType: 'video/mp4' }
  const docMatch = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{10,120})/i.exec(s)
  if (docMatch) {
    const mime =
      docMatch[1] === 'document'
        ? 'application/vnd.google-apps.document'
        : docMatch[1] === 'spreadsheets'
          ? 'application/vnd.google-apps.spreadsheet'
          : 'application/vnd.google-apps.presentation'
    return { id: docMatch[2], kind: 'file', mimeType: mime }
  }
  return null
}

/**
 * Garante que um curso do Drive tenha uma Matéria vinculada no controle de estudos.
 * Se já estiver vinculado, reaproveita; se existir matéria com o mesmo nome, vincula; senão cria.
 */
export async function ensureSubjectForCourse(
  backend: DataBackend,
  course: CourseNode,
  opts?: { areaId?: DataAreaId; weeklyGoalHours?: number | null },
): Promise<Subject> {
  if (course.subject_id) {
    const existing = await backend.get('subjects', course.subject_id)
    if (existing) {
      if (existing.status === 'archived') {
        const [reactivated] = await backend.update('subjects', [eq('id', existing.id)], { status: 'active', archived_at: null })
        return reactivated ?? existing
      }
      return existing
    }
  }
  const title = displayTitle(course).slice(0, 160)
  const { rows: subjects } = await backend.list('subjects')
  const match = subjects.find((s) => norm(s.name) === norm(title))
  let subject: Subject
  if (match) {
    if (match.status === 'archived') {
      const [reactivated] = await backend.update('subjects', [eq('id', match.id)], { status: 'active', archived_at: null })
      subject = reactivated ?? match
    } else {
      subject = match
    }
  } else {
    const area = opts?.areaId ? dataAreaById(opts.areaId) : detectDataArea(title)
    const nextOrder = subjects.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
    const [created] = await backend.insert('subjects', [
      {
        name: title,
        description: `Curso do Google Drive · ${area.label}`,
        color: area.color,
        difficulty: 3,
        priority: 4,
        weekly_goal_hours: opts?.weeklyGoalHours ?? null,
        status: 'active',
        sort_order: nextOrder,
      },
    ])
    subject = created
  }
  await backend.update('course_nodes', [eq('id', course.id)], { subject_id: subject.id })
  return subject
}

/**
 * Adiciona um curso do Google Drive diretamente ao Ciclo de Estudos (cria/vincula a matéria
 * e cria o ciclo ativo "Meu Ciclo de Dados" se ainda não houver nenhum).
 */
export async function addCourseToCycle(
  backend: DataBackend,
  course: CourseNode,
  opts: {
    cycleId?: string | null
    durationMinutes?: number
    weight?: number
    breakMinutes?: number
    activityType?: ActivityType
    areaId?: DataAreaId
  } = {},
): Promise<{ subject: Subject; cycle: StudyCycle; item: StudyCycleItem }> {
  const subject = await ensureSubjectForCourse(backend, course, { areaId: opts.areaId })
  let cycle: StudyCycle | null = opts.cycleId ? await backend.get('study_cycles', opts.cycleId) : null
  if (!cycle) {
    const { rows } = await backend.list('study_cycles', { filters: [{ column: 'status', op: 'neq', value: 'archived' }], order: [{ column: 'created_at' }] })
    cycle = rows.find((c) => c.status === 'active') ?? rows[0] ?? null
  }
  if (!cycle) {
    const [created] = await backend.insert('study_cycles', [
      {
        name: 'Meu Ciclo de Dados',
        description: 'Ciclo integrado aos cursos do Google Drive e estudos na área de dados.',
        status: 'active',
        auto_advance: true,
      },
    ])
    cycle = created
  }
  const { rows: items } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', cycle.id)] })
  const nextOrder = items.reduce((m, it) => Math.max(m, it.sort_order), -1) + 1
  const [item] = await backend.insert('study_cycle_items', [
    {
      cycle_id: cycle.id,
      subject_id: subject.id,
      topic_id: course.topic_id ?? null,
      duration_minutes: Math.max(5, Math.min(1440, Math.round(opts.durationMinutes ?? 60))),
      weight: Math.max(1, Math.min(100, opts.weight ?? 1)),
      break_minutes: Math.max(0, Math.min(240, Math.round(opts.breakMinutes ?? 10))),
      sort_order: nextOrder,
      activity_type: opts.activityType ?? 'video',
    },
  ])
  return { subject, cycle, item }
}

/**
 * Agenda uma sessão de estudo de um curso do Google Drive no Cronograma / Meu Planejamento.
 */
export async function scheduleCourseInCalendar(
  backend: DataBackend,
  course: CourseNode,
  opts: {
    date: ISODate
    startTime?: string | null
    durationMinutes?: number
    areaId?: DataAreaId
  },
): Promise<{ subject: Subject; task: CalendarTask }> {
  const subject = await ensureSubjectForCourse(backend, course, { areaId: opts.areaId })
  const title = `Estudar: ${displayTitle(course)}`.slice(0, 300)
  const [task] = await createTask(backend, {
    title,
    date: opts.date,
    start_time: opts.startTime || null,
    duration_minutes: opts.durationMinutes ?? 60,
    subject_id: subject.id,
    topic_id: course.topic_id ?? null,
    category: 'estudos',
    priority: 2,
  })
  return { subject, task }
}

export interface ManualLessonInput {
  title: string
  url: string
}

/**
 * Cadastra rapidamente um curso do Google Drive por link (sem precisar de OAuth).
 * Aceita um link de pasta ou arquivo principal e, opcionalmente, uma lista de aulas (título + link).
 */
export async function createManualDriveCourse(
  backend: DataBackend,
  input: {
    title: string
    driveUrl: string
    areaId?: DataAreaId
    lessons?: ManualLessonInput[]
    addToCycle?: boolean
    cycleDurationMinutes?: number
  },
): Promise<{ course: CourseNode; subject: Subject; lessonsCreated: number }> {
  const parsedMain = parseDriveLink(input.driveUrl)
  if (!parsedMain) throw new Error('Cole um link válido do Google Drive (pasta ou arquivo).')
  const title = input.title.trim().slice(0, 300)
  if (!title) throw new Error('Informe o nome do curso.')

  const source = await addSource(backend, MANUAL_DRIVE_SOURCE_ID, 'Cursos do Drive (links)')
  const courseId = crypto.randomUUID()
  const now = new Date().toISOString()

  const [course] = await backend.insert('course_nodes', [
    {
      id: courseId,
      source_id: source.id,
      parent_id: null,
      kind: 'course',
      drive_id: parsedMain.id,
      drive_parent_id: MANUAL_DRIVE_SOURCE_ID,
      placement_key: `manual:${courseId}`,
      title,
      custom_title: null,
      mime_type: FOLDER_MIME,
      sort_order: 0,
      sort_manual: true,
      parent_manual: true,
      hidden: false,
      status: 'available',
    },
  ])

  const parsedLessons = (input.lessons ?? [])
    .map((l) => ({ title: l.title.trim(), parsed: parseDriveLink(l.url) }))
    .filter((x): x is { title: string; parsed: NonNullable<ReturnType<typeof parseDriveLink>> } => Boolean(x.parsed))

  const itemsToInsert = parsedLessons.length > 0
    ? parsedLessons.map((l, idx) => ({
        source_id: source.id,
        parent_id: course.id,
        kind: 'item' as const,
        drive_id: l.parsed.id,
        drive_parent_id: parsedMain.id,
        placement_key: `manual:${courseId}:${idx}:${l.parsed.id}`,
        title: (l.title || `Aula ${idx + 1}`).slice(0, 300),
        mime_type: l.parsed.mimeType,
        sort_order: idx,
        sort_manual: true,
        parent_manual: true,
        hidden: false,
        status: 'available' as const,
      }))
    : [
        {
          source_id: source.id,
          parent_id: course.id,
          kind: 'item' as const,
          drive_id: parsedMain.id,
          drive_parent_id: parsedMain.id,
          placement_key: `manual:${courseId}:0:${parsedMain.id}`,
          title: parsedMain.kind === 'folder' ? `Pasta do curso — ${title}`.slice(0, 300) : title,
          mime_type: parsedMain.kind === 'folder' ? 'application/vnd.google-apps.folder' : parsedMain.mimeType,
          sort_order: 0,
          sort_manual: true,
          parent_manual: true,
          hidden: false,
          status: 'available' as const,
        },
      ]

  await backend.insert('course_nodes', itemsToInsert)
  await backend.update('course_sources', [eq('id', source.id)], { last_sync_at: now, last_sync_status: 'ok' })

  const subject = await ensureSubjectForCourse(backend, course, { areaId: input.areaId })
  const updatedCourse: CourseNode = { ...course, subject_id: subject.id }

  if (input.addToCycle) {
    await addCourseToCycle(backend, updatedCourse, {
      durationMinutes: input.cycleDurationMinutes ?? 60,
      activityType: 'video',
      areaId: input.areaId,
    })
  }

  return { course: updatedCourse, subject, lessonsCreated: itemsToInsert.length }
}

/** Encontra o melhor curso do Drive vinculado a uma Matéria (prioriza cursos em andamento, depois não iniciados). */
export function findCourseForSubject(views: CourseView[], subjectId: string | null | undefined): CourseView | null {
  if (!subjectId) return null
  const matching = views.filter((v) => v.course.subject_id === subjectId || v.items.some((i) => i.subject_id === subjectId))
  if (matching.length === 0) return null
  return (
    matching.find((v) => courseStatus(v) === 'in_progress') ??
    matching.find((v) => courseStatus(v) === 'not_started') ??
    matching[0]
  )
}
