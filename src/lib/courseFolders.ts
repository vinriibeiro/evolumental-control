import { lastStudied, resumeItem, type CourseView } from '@/lib/courseCatalog'
import { isYoutubeMime, naturalCompare } from '@/lib/drive'
import { normalizeText } from '@/lib/videoProgress'
import type { CourseProgress } from '@/types/db'

const PART = /^(.*?)[\s([–—_-]+(?:parte|part|volume|vol\.?|pt\.?)\s*[-–—.]?\s*(\d+)(?:\s*(?:de|\/)\s*\d+)?\s*[)\]]?(?:\s*[-–—]\s*(?:Data Science Academy|DSA))?$/i
const DSA_SUFFIX = /-+(?:data-science-academy|dsa)$/

export function courseKey(title: string): string {
  return normalizeText(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface CourseFolder {
  key: string
  title: string
  parts: Array<{ number: number; view: CourseView; baseTitle: string }>
  total: number
  done: number
}

/** Uma pasta do catálogo reúne cursos numerados sem alterar os IDs usados pelo Drive e pelo progresso. */
export function courseFolders(views: CourseView[]): CourseFolder[] {
  const groups = new Map<string, CourseFolder>()
  for (const view of views) {
    const match = PART.exec(view.title.trim()) ?? PART.exec(view.course.title.trim())
    if (!match) continue
    const title = match[1].trim()
    const key = courseKey(title).replace(DSA_SUFFIX, '')
    const number = Number(match[2])
    if (!key || !Number.isSafeInteger(number) || number < 1) continue
    const group = groups.get(key) ?? { key, title, parts: [], total: 0, done: 0 }
    group.parts.push({ number, view, baseTitle: title })
    group.total += view.total
    group.done += view.done
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter((group) => new Set(group.parts.map((part) => part.number)).size > 1 || /^formacao-cientista-de-dados-4-0(?:-|$)/.test(group.key))
    .map((group) => {
      const parts = group.parts.sort((a, b) => a.number - b.number || naturalCompare(a.view.title, b.view.title))
      return { ...group, title: parts[0].baseTitle, parts }
    })
}

export function folderResume(folder: CourseFolder, progress: Map<string, CourseProgress>) {
  const views = folder.parts.map((part) => part.view)
  const pending = views.filter((view) => view.done < view.total)
  const view = lastStudied(pending) ?? pending[0] ?? lastStudied(views) ?? views[0]
  return { view, item: resumeItem(view, progress) }
}

export const folderHref = (key: string, hidden = false) => `/cursos/pastas/${key}${hidden ? '?ocultos=1' : ''}`

export const courseHref = (view: CourseView, itemId?: string | null) => `/cursos/${view.course.id}${itemId ? `?item=${encodeURIComponent(itemId)}` : ''}`

// Imagens de compartilhamento das páginas oficiais dos programas da Data Science Academy.
const OFFICIAL_COVERS = [
  ['formacao-cientista-de-dados-4-0', 'dsa-cientista-dados-4'],
  ['formacao-analista-de-dados-4-0', 'dsa-analista-dados-4'],
  ['formacao-arquiteto-de-dados-4-0', 'dsa-arquiteto-dados-4'],
  ['formacao-engenheiro-de-dados-4-0', 'dsa-engenheiro-dados-4'],
  ['formacao-engenheiro-de-inteligencia-artificial-4-0', 'dsa-engenheiro-ia-4'],
  ['formacao-engenheiro-de-machine-learning-4-0', 'dsa-engenheiro-ml-4'],
  ['formacao-machine-learning-4-0', 'dsa-machine-learning-4'],
  ['formacao-analista-de-inteligencia-de-negocios-4-0', 'dsa-analista-bi-4'],
  ['formacao-cloud-engineer-4-0', 'dsa-cloud-engineer-4'],
] as const

export function coverFor(title: string, views: CourseView[]): string | undefined {
  const keys = [courseKey(title), ...views.map((view) => courseKey(view.course.title))]
  const official = OFFICIAL_COVERS.find(([key]) => keys.some((candidate) => candidate === key || candidate.startsWith(key + '-')))
  if (official) return `/course-covers/${official[1]}.jpg`
  const youtube = views.flatMap((view) => view.items).find((item) => isYoutubeMime(item.mime_type) && /^[\w-]{11}$/.test(item.drive_id))
  return youtube ? `https://i.ytimg.com/vi/${youtube.drive_id}/hqdefault.jpg` : undefined
}
