import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { invalidateTables, useAll } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import type { UserSettings } from '@/types/db'
import { buildExplorer, keyOf, type ExplorerIndex, type NodeKey, type NodeType } from './model'
import { EXPLORER_TABLES } from './service'

export type ExplorerView = NonNullable<UserSettings['explorerView']>

/** Pastas, matérias e tópicos do usuário, já como árvore indexada. */
export function useExplorerData() {
  const folders = useAll('study_folders', { order: [{ column: 'sort_order' }] })
  const subjects = useAll('subjects', { order: [{ column: 'sort_order' }] })
  const topics = useAll('topics', { order: [{ column: 'sort_order' }] })
  const index = useMemo<ExplorerIndex>(
    () => buildExplorer(folders.data ?? [], subjects.data ?? [], topics.data ?? []),
    [folders.data, subjects.data, topics.data],
  )
  const queries = [folders, subjects, topics]
  return {
    index,
    topics: topics.data ?? [],
    isPending: queries.some((q) => q.isPending),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => queries.forEach((q) => void q.refetch()),
  }
}

/** Executa uma operação e invalida as tabelas do Explorador ao final. */
export function useExplorerOp() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useCallback(
    async <R,>(fn: (b: typeof backend) => Promise<R>): Promise<R> => {
      try {
        return await fn(backend)
      } finally {
        await invalidateTables(qc, EXPLORER_TABLES)
      }
    },
    [backend, qc],
  )
}

const EXPANDED_KEY = 'evl-explorer-expanded'

function readExpanded(): Set<NodeKey> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    return new Set(raw ? (JSON.parse(raw) as NodeKey[]) : [])
  } catch {
    return new Set()
  }
}

/** Nós expandidos da árvore: preferência deste aparelho (localStorage). */
export function useExpanded() {
  const [expanded, setExpanded] = useState<Set<NodeKey>>(readExpanded)
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded].slice(0, 2000)))
    } catch {
      /* armazenamento indisponível: segue só na memória */
    }
  }, [expanded])
  const toggle = useCallback((key: NodeKey, open?: boolean) => {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (open ?? !next.has(key)) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])
  const expandAll = useCallback((keys: NodeKey[], open: boolean) => {
    setExpanded((cur) => {
      const next = new Set(cur)
      for (const k of keys) {
        if (open) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }, [])
  return { expanded, toggle, expandAll }
}

/** Visualização do painel de conteúdo, salva no perfil do usuário. */
export function useExplorerView(): [ExplorerView, (v: ExplorerView) => void] {
  const settings = useSettings()
  const update = useUpdateSettings()
  const view = settings.explorerView ?? 'list'
  return [view, (v) => update.mutate({ explorerView: v })]
}

/** URL de cada nó do Explorador. */
export function hrefFor(type: NodeType, id: string, subjectId?: string): string {
  if (type === 'folder') return `/materias/pasta/${id}`
  if (type === 'subject') return `/materias/${id}`
  return `/materias/${subjectId}/topico/${id}`
}

export const keyFromRoute = (p: { folderId?: string; subjectId?: string; topicId?: string }): NodeKey | null =>
  p.topicId ? keyOf('topic', p.topicId) : p.subjectId ? keyOf('subject', p.subjectId) : p.folderId ? keyOf('folder', p.folderId) : null
