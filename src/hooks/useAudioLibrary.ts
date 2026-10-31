import { useMemo } from 'react'
import { useAuth } from '@/app/auth'
import { supabase } from '@/lib/supabaseClient'
import { audioLibraryFor, type AudioLibrary } from '@/services/audio'
import { supabaseAudioCloud } from '@/services/audioSupabase'

/** Áudios da conta atual: com nuvem privada no modo Supabase; só locais no modo local. */
export function useAudioLibrary(): AudioLibrary {
  const auth = useAuth()
  const userId = auth.mode === 'supabase' ? (auth.user?.id ?? null) : null
  return useMemo(() => (supabase && userId ? audioLibraryFor({ userId, cloud: supabaseAudioCloud(supabase, userId) }) : audioLibraryFor(null)), [userId])
}
