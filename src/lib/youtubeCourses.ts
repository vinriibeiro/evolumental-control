// Cursos em vídeo do YouTube dentro de Cursos (mesma sala, progresso e organização dos cursos do Drive).
// Em vez de um ID do Drive, o `drive_id` da aula guarda o ID do vídeo (11 caracteres) e o do curso um identificador
// fixo "youtube-course-<chave>": os dois respeitam o formato exigido pelo banco (letras, números, "-" e "_", 10 a 128).
// Nada é baixado: o player incorporado do YouTube (domínio sem cookies) toca o vídeo, como na sala de vídeos.
import { TEO_SUBJECTS } from '@/content/trailTeo'
import { topicName, type SubjectDef, type TopicTree } from '@/content/trails'
import type { CourseSource } from '@/types/db'
import { placementKey } from './courseImport'
import { isDriveId } from './drive'
import { parseYoutube } from './video'

export const YOUTUBE_SOURCE_PREFIX = 'youtube-'
/** Fonte fixa dos cursos gratuitos do Téo Me Why ("Do zero a Cientista de Dados"). */
export const TEO_SOURCE = { folderId: 'youtube-teomewhy-trilha', title: 'Téo Me Why · Do zero a Cientista de Dados (YouTube)' } as const

export const isYoutubeSource = (s: Pick<CourseSource, 'drive_folder_id'>) => s.drive_folder_id.startsWith(YOUTUBE_SOURCE_PREFIX)

export interface YoutubeLessonPlan {
  /** ID do vídeo no YouTube (vai em `drive_id`). */
  driveId: string
  title: string
  durationMs: number | null
  sortOrder: number
  placementKey: string
}

export interface YoutubeCoursePlan {
  driveId: string
  title: string
  placementKey: string
  sortOrder: number
  /** Nome da matéria da trilha, para vincular o curso à matéria/tópicos já instalados (mesmo nome). */
  subjectName: string
  lessons: YoutubeLessonPlan[]
  /** Aulas sem link do YouTube reconhecível (ou repetidas): ficam de fora. */
  skipped: string[]
}

type Leaf = { name: string; url?: string; minutes?: number }
const isLeaf = (n: TopicTree[number]): n is Leaf => typeof n === 'object' && !Array.isArray(n)

function* leaves(tree: TopicTree): Generator<Leaf> {
  for (const node of tree) {
    if (Array.isArray(node)) yield* leaves(node[1])
    else if (isLeaf(node)) yield node
    else yield { name: topicName(node) }
  }
}

export const youtubeCourseId = (key: string) => `youtube-course-${key}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 128)

/** Um curso por matéria da trilha e uma aula por vídeo do YouTube, na ordem da trilha. */
export function buildYoutubeCourses(subjects: readonly SubjectDef[] = TEO_SUBJECTS): YoutubeCoursePlan[] {
  return subjects.map((s, i) => {
    const driveId = youtubeCourseId(s.key)
    const lessons: YoutubeLessonPlan[] = []
    const skipped: string[] = []
    const seen = new Set<string>()
    for (const leaf of leaves(s.topics)) {
      const videoId = parseYoutube(leaf.url)?.videoId
      if (!videoId || seen.has(videoId) || !isDriveId(videoId)) {
        skipped.push(leaf.name)
        continue
      }
      seen.add(videoId)
      lessons.push({
        driveId: videoId,
        title: leaf.name.slice(0, 500),
        durationMs: leaf.minutes && leaf.minutes > 0 ? Math.round(leaf.minutes * 60_000) : null,
        sortOrder: lessons.length,
        placementKey: placementKey(driveId, videoId),
      })
    }
    return { driveId, title: s.name.slice(0, 500), placementKey: placementKey(null, driveId), sortOrder: i, subjectName: s.name, lessons, skipped }
  })
}
