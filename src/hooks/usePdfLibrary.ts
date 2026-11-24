import { useMemo } from 'react'
import { useAuth } from '@/app/auth'
import { useLibrary } from '@/hooks/useLibrary'
import { supabase } from '@/lib/supabaseClient'
import { PdfLibrary } from '@/services/pdfLibrary'
import { supabasePdfCloud } from '@/services/pdfLibrarySupabase'

const libraries = new Map<string, PdfLibrary>()

export function usePdfLibrary(): PdfLibrary {
  const { dbName } = useLibrary()
  const auth = useAuth()
  const userId = auth.mode === 'supabase' ? auth.user?.id : undefined
  return useMemo(() => {
    let library = libraries.get(dbName)
    if (!library) {
      library = new PdfLibrary(dbName, supabase && userId ? supabasePdfCloud(supabase, userId) : null)
      libraries.set(dbName, library)
    }
    return library
  }, [dbName, userId])
}
