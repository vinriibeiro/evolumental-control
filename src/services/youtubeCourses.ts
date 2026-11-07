// Instala (ou completa) em Cursos os cursos em vídeo do YouTube — hoje, a trilha do Téo Me Why.
// Idempotente: reconhece curso e aula pela posição (placement_key), não duplica e mantém o progresso
// (que é por vídeo). Vincula à matéria/tópicos da trilha quando eles já existem com o mesmo nome.
import { fetchAll } from '@/hooks/data'
import { eq, type DataBackend } from '@/lib/data/types'
import { FOLDER_MIME, YOUTUBE_MIME } from '@/lib/drive'
import { buildYoutubeCourses, TEO_SOURCE, type YoutubeCoursePlan } from '@/lib/youtubeCourses'
import { addSource } from '@/services/courses'
import type { CourseNode, CourseSyncReport, Insert } from '@/types/db'

export interface YoutubeInstallResult {
  courses: number
  lessons: number
  /** Cursos e aulas criados nesta chamada (0 quando já estava tudo lá). */
  inserted: number
  /** Aulas vinculadas a um tópico da matéria de mesmo nome. */
  linked: number
  skipped: string[]
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

export async function installYoutubeCourses(backend: DataBackend, plan: YoutubeCoursePlan[] = buildYoutubeCourses(), source: { folderId: string; title: string } = TEO_SOURCE): Promise<YoutubeInstallResult> {
  const src = await addSource(backend, source.folderId, source.title)
  const existing = await fetchAll(backend, 'course_nodes', { filters: [eq('source_id', src.id)] })
  const byKey = new Map<string, CourseNode>(existing.map((n) => [n.placement_key, n]))
  const { rows: subjects } = await backend.list('subjects')
  const subjectByName = new Map(subjects.map((s) => [norm(s.name), s.id]))

  let inserted = 0
  let linked = 0
  const skipped: string[] = []
  for (const c of plan) {
    skipped.push(...c.skipped.map((t) => `${c.title} › ${t}`))
    const subjectId = subjectByName.get(norm(c.subjectName)) ?? null
    const topics = subjectId ? (await backend.list('topics', { filters: [eq('subject_id', subjectId)] })).rows : []
    const topicByName = new Map(topics.map((t) => [norm(t.name), t.id]))

    let course = byKey.get(c.placementKey)
    if (!course) {
      const row: Insert<'course_nodes'> & { id: string } = {
        id: crypto.randomUUID(),
        source_id: src.id,
        parent_id: null,
        kind: 'course',
        drive_id: c.driveId,
        drive_parent_id: null,
        placement_key: c.placementKey,
        title: c.title,
        mime_type: FOLDER_MIME,
        sort_order: c.sortOrder,
        status: 'available',
        subject_id: subjectId,
      }
      ;[course] = await backend.insert('course_nodes', [row])
      byKey.set(c.placementKey, course)
      inserted++
    }
    const rows: Array<Insert<'course_nodes'> & { id: string }> = []
    for (const l of c.lessons) {
      if (byKey.has(l.placementKey)) continue
      const topicId = topicByName.get(norm(l.title)) ?? null
      if (topicId) linked++
      rows.push({
        id: crypto.randomUUID(),
        source_id: src.id,
        parent_id: course.id,
        kind: 'item',
        drive_id: l.driveId,
        drive_parent_id: c.driveId,
        placement_key: l.placementKey,
        title: l.title,
        mime_type: YOUTUBE_MIME,
        duration_ms: l.durationMs,
        sort_order: l.sortOrder,
        status: 'available',
        subject_id: subjectId,
        topic_id: topicId,
      })
    }
    for (let i = 0; i < rows.length; i += 500) await backend.insert('course_nodes', rows.slice(i, i + 500))
    inserted += rows.length
  }

  const lessons = plan.reduce((s, c) => s + c.lessons.length, 0)
  const report: CourseSyncReport = { inserted, updated: 0, missing: 0, restored: 0, excluded: 0, unverified: 0, failedFolders: [], skipped: skipped.length, truncated: false }
  await backend.update('course_sources', [eq('id', src.id)], { title: source.title, last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_sync_report: report })
  return { courses: plan.length, lessons, inserted, linked, skipped }
}
