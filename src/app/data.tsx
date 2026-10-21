import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import type { DataBackend } from '@/lib/data/types'
import { LocalBackend } from '@/lib/data/local'
import { SupabaseBackend } from '@/lib/data/supabase'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './auth'
import { onRemoteChange } from '@/hooks/data'

const BackendContext = createContext<DataBackend | null>(null)

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: (count, err) => count < 2 && (err as { code?: string })?.code === 'network',
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

let localSingleton: LocalBackend | null = null
export function getLocalBackend() {
  if (!localSingleton) localSingleton = new LocalBackend()
  return localSingleton
}

/** Sincroniza o cache entre abas abertas do mesmo navegador. */
function CrossTabSync() {
  const qc = useQueryClient()
  useEffect(() => onRemoteChange(qc), [qc])
  return null
}

export function DataProvider({ children, client }: { children: ReactNode; client: QueryClient }) {
  const auth = useAuth()
  const userId = auth.user?.id ?? null
  const backend = useMemo<DataBackend>(() => {
    if (auth.mode === 'supabase' && supabase) return new SupabaseBackend(supabase, () => userId)
    return getLocalBackend()
  }, [auth.mode, userId])

  // Troca de usuário: nunca reaproveita cache de outra conta. (Não limpa na
  // montagem inicial — isso desligaria observadores já criados.)
  const previousUser = useRef(userId)
  useEffect(() => {
    if (previousUser.current !== userId) {
      previousUser.current = userId
      client.clear()
    }
  }, [client, userId])

  return (
    <QueryClientProvider client={client}>
      <BackendContext.Provider value={backend}>
        <CrossTabSync />
        {children}
      </BackendContext.Provider>
    </QueryClientProvider>
  )
}

export function useBackend(): DataBackend {
  const b = useContext(BackendContext)
  if (!b) throw new Error('useBackend fora do DataProvider')
  return b
}
