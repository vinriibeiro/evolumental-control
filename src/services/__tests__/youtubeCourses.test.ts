import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { fetchAll } from '@/hooks/data'
import { buildCatalog } from '@/lib/courseCatalog'
import { YOUTUBE_MIME } from '@/lib/drive'
import { TEO_SOURCE, isYoutubeSource } from '@/lib/youtubeCourses'
import { setCompleted } from '@/services/courses'
import { installYoutubeCourses } from '@/services/youtubeCourses'

let backend: LocalBackend
let dbn = 0

beforeEach(() => {
  backend = new LocalBackend(`youtube-courses-test-${++dbn}`)
})

describe('cursos do Téo Me Why (YouTube) em Cursos', () => {
  it('instala 9 cursos e 135 aulas; a segunda instalação não duplica e mantém o progresso', async () => {
    const first = await installYoutubeCourses(backend)
    expect(first).toMatchObject({ courses: 9, lessons: 135, inserted: 144, linked: 0, skipped: [] })
    const nodes = await fetchAll(backend, 'course_nodes')
    expect(nodes).toHaveLength(144)
    const [source] = await fetchAll(backend, 'course_sources')
    expect(source).toMatchObject({ drive_folder_id: TEO_SOURCE.folderId, title: TEO_SOURCE.title, last_sync_status: 'ok' })
    expect(isYoutubeSource(source)).toBe(true)

    const views = buildCatalog(nodes, [])
    expect(views).toHaveLength(9)
    expect(views[0].title).toBe('Téo 1 · Git e GitHub')
    expect(views[0].lessons).toHaveLength(9)
    expect(views[0].lessons.map((l) => l.title).slice(0, 2)).toEqual(['Ep 01 - Instalação E Primeiros Conceitos', 'Ep 02 - Primeiros Comandos Git'])
    expect(views[0].lessons[0].primary.mime_type).toBe(YOUTUBE_MIME)
    expect(views[0].durationMs).toBe(285 * 60_000)
    expect(views[0].kinds.video).toBe(9)

    const lesson = views[0].lessons[0].primary
    await setCompleted(backend, lesson, true)
    const again = await installYoutubeCourses(backend)
    expect(again.inserted).toBe(0)
    expect(await fetchAll(backend, 'course_nodes')).toHaveLength(144)
    expect(await fetchAll(backend, 'course_sources')).toHaveLength(1)
    const progress = await fetchAll(backend, 'course_progress')
    expect(progress.find((p) => p.drive_id === lesson.drive_id)?.completed_at).toBeTruthy()
    expect(buildCatalog(await fetchAll(backend, 'course_nodes'), progress)[0].done).toBe(1)
  })

  it('vincula curso e aulas à matéria e aos tópicos da trilha quando já existem com o mesmo nome', async () => {
    const [subject] = await backend.insert('subjects', [{ name: 'Téo 1 · Git e GitHub', description: null, color: '#F05033', icon: '🌿', difficulty: 3, priority: 3, status: 'active', sort_order: 0 }])
    const [topic] = await backend.insert('topics', [{ subject_id: subject.id, parent_id: null, name: 'Ep 01 - Instalação E Primeiros Conceitos', sort_order: 0 }])
    const r = await installYoutubeCourses(backend)
    expect(r.linked).toBe(1)
    const nodes = await fetchAll(backend, 'course_nodes')
    const course = nodes.find((n) => n.kind === 'course' && n.title === 'Téo 1 · Git e GitHub')
    expect(course?.subject_id).toBe(subject.id)
    const linked = nodes.find((n) => n.topic_id === topic.id)
    expect(linked).toMatchObject({ title: 'Ep 01 - Instalação E Primeiros Conceitos', subject_id: subject.id, parent_id: course?.id })
    expect(nodes.filter((n) => n.kind === 'item' && n.subject_id === subject.id)).toHaveLength(9)
  })
})
