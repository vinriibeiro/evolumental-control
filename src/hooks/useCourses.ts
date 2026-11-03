import { useMemo } from 'react'
import { useAll, useTransaction } from '@/hooks/data'
import { buildCatalog, progressIndex } from '@/lib/courseCatalog'
import { COURSE_TABLES, markOpened, setCompleted } from '@/services/courses'
import type { CourseNode, Patch } from '@/types/db'
import { eq } from '@/lib/data/types'

/** Fontes, catálogo e progresso do usuário (modo local ou Supabase), já montados em cursos. */
export function useCourses(opts: { includeHidden?: boolean } = {}) {
  const sources = useAll('course_sources', { order: [{ column: 'created_at' }] })
  const nodes = useAll('course_nodes')
  const progress = useAll('course_progress')
  const views = useMemo(() => buildCatalog(nodes.data ?? [], progress.data ?? [], opts), [nodes.data, progress.data, opts.includeHidden]) // eslint-disable-line react-hooks/exhaustive-deps
  const index = useMemo(() => progressIndex(progress.data ?? []), [progress.data])
  const error = sources.error ?? nodes.error ?? progress.error
  return {
    sources,
    nodes,
    progress,
    views,
    index,
    isPending: sources.isPending || nodes.isPending || progress.isPending,
    isError: Boolean(error),
    error,
    refetch: () => Promise.all([sources.refetch(), nodes.refetch(), progress.refetch()]),
  }
}

export function useCourseActions() {
  const complete = useTransaction(['course_progress'], (b, a: { node: CourseNode; done: boolean }) => setCompleted(b, a.node, a.done))
  const opened = useTransaction(['course_progress'], (b, node: CourseNode) => markOpened(b, node))
  const edit = useTransaction(['course_nodes'], (b, a: { id: string; patch: Patch<'course_nodes'> }) => b.update('course_nodes', [eq('id', a.id)], a.patch))
  /** Troca a posição de dois irmãos e fixa a ordem manual (a importação não desfaz). */
  const swap = useTransaction(['course_nodes'], async (b, a: { first: CourseNode; second: CourseNode }) => {
    await b.update('course_nodes', [eq('id', a.first.id)], { sort_order: a.second.sort_order === a.first.sort_order ? a.first.sort_order + 1 : a.second.sort_order, sort_manual: true })
    await b.update('course_nodes', [eq('id', a.second.id)], { sort_order: a.first.sort_order, sort_manual: true })
  })
  return { complete, opened, edit, swap, tables: COURSE_TABLES }
}
