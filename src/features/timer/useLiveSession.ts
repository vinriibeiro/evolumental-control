import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { invalidateTables } from '@/hooks/data'
import type { DataBackend, SessionWithPauses } from '@/lib/data/types'
import {
  acknowledgeAlert,
  confirmSession,
  discardSession,
  finishSession,
  getLiveSession,
  nextPhase,
  pauseSession,
  resumeSession,
  startSession,
  type ConfirmParams,
  type StartParams,
} from '@/services/sessions'
import type { TableName } from '@/types/db'

export const LIVE_KEY = ['data', ['study_sessions', 'study_session_pauses'], 'live'] as const

export function useLiveSession() {
  const backend = useBackend()
  return useQuery({
    queryKey: [...LIVE_KEY, backend.kind],
    queryFn: () => getLiveSession(backend),
    staleTime: 15_000,
  })
}

const AFFECTED: TableName[] = ['study_sessions', 'study_session_pauses', 'topics', 'study_cycles', 'study_plan_items', 'reviews']

/**
 * Ações do cronômetro. Um único "trinco" impede ações concorrentes na mesma
 * aba (cliques repetidos); o banco garante o resto entre abas.
 */
export function useSessionActions() {
  const backend = useBackend()
  const qc = useQueryClient()
  const lock = useRef(false)
  const startId = useRef<string | null>(null)

  const run = useMutation({
    mutationFn: async (fn: (b: DataBackend) => Promise<unknown>) => {
      if (lock.current) return undefined
      lock.current = true
      try {
        return await fn(backend)
      } finally {
        lock.current = false
      }
    },
    onSettled: () => invalidateTables(qc, AFFECTED),
  })

  return {
    pending: run.isPending,
    start: (p: StartParams) => {
      // Mesmo ID enquanto a tentativa não for concluída: repetir é idempotente.
      startId.current ??= crypto.randomUUID()
      const id = startId.current
      return run.mutateAsync(async (b) => {
        const s = await startSession(b, p, id)
        startId.current = null
        return s
      })
    },
    pause: (s: SessionWithPauses) => run.mutateAsync((b) => pauseSession(b, s)),
    resume: (s: SessionWithPauses) => run.mutateAsync((b) => resumeSession(b, s)),
    nextPhase: (s: SessionWithPauses) => run.mutateAsync((b) => nextPhase(b, s)),
    acknowledge: (s: SessionWithPauses) => run.mutateAsync((b) => acknowledgeAlert(b, s)),
    finish: (s: SessionWithPauses) => run.mutateAsync((b) => finishSession(b, s)),
    discard: (s: SessionWithPauses) => run.mutateAsync((b) => discardSession(b, s)),
    confirm: (s: SessionWithPauses, p: ConfirmParams) => run.mutateAsync((b) => confirmSession(b, s, p)),
    restart: (s: SessionWithPauses, p: StartParams) =>
      run.mutateAsync(async (b) => {
        await discardSession(b, s)
        return startSession(b, p)
      }),
    resetStartId: () => {
      startId.current = null
    },
  }
}
