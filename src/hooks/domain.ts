import { useMemo } from 'react'
import type { Subject, Topic } from '@/types/db'
import { eq, inList } from '@/lib/data/types'
import { useAll } from './data'

export function useSubjects(opts: { includeArchived?: boolean } = {}) {
  return useAll('subjects', {
    filters: opts.includeArchived ? [] : [inList('status', ['active', 'paused', 'completed'])],
    order: [{ column: 'sort_order' }, { column: 'name' }],
  })
}

export function useTopics(subjectId?: string | null) {
  return useAll('topics', { filters: subjectId ? [eq('subject_id', subjectId)] : [], order: [{ column: 'sort_order' }, { column: 'name' }] }, { enabled: subjectId !== null })
}

/** Mapas id → registro, para exibir nomes em listas e gráficos. */
export function useLookups() {
  const subjects = useSubjects({ includeArchived: true })
  const topics = useTopics(undefined)
  return useMemo(() => {
    const subjectById = new Map<string, Subject>((subjects.data ?? []).map((s) => [s.id, s]))
    const topicById = new Map<string, Topic>((topics.data ?? []).map((t) => [t.id, t]))
    return {
      subjects: subjects.data ?? [],
      topics: topics.data ?? [],
      subjectById,
      topicById,
      subjectName: (id: string | null | undefined) => (id ? (subjectById.get(id)?.name ?? 'Matéria excluída') : 'Sem matéria'),
      subjectColor: (id: string | null | undefined) => (id ? (subjectById.get(id)?.color ?? '#9C8A78') : '#9C8A78'),
      topicName: (id: string | null | undefined) => (id ? (topicById.get(id)?.name ?? '') : ''),
      loading: subjects.isPending || topics.isPending,
    }
  }, [subjects.data, topics.data, subjects.isPending, topics.isPending])
}
