import { useMemo } from 'react'
import { useAuth } from '@/app/auth'
import { supabase } from '@/lib/supabaseClient'
import { libraryFor, type Library } from '@/services/library'
import { supabaseCloud } from '@/services/librarySupabase'

/** Estante da conta atual: com nuvem privada no modo Supabase; só local no modo local. */
export function useLibrary(): Library {
  const auth = useAuth()
  const userId = auth.mode === 'supabase' ? (auth.user?.id ?? null) : null
  return useMemo(() => (supabase && userId ? libraryFor({ userId, cloud: supabaseCloud(supabase, userId) }) : libraryFor(null)), [userId])
}
