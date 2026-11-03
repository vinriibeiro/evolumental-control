import { useMemo } from 'react'
import { useLibrary } from '@/hooks/useLibrary'
import { PdfLibrary } from '@/services/pdfLibrary'

const libraries = new Map<string, PdfLibrary>()

/** PDFs e marcações ficam neste navegador, separados por conta. */
export function usePdfLibrary(): PdfLibrary {
  const { dbName } = useLibrary()
  return useMemo(() => {
    let library = libraries.get(dbName)
    if (!library) {
      library = new PdfLibrary(dbName)
      libraries.set(dbName, library)
    }
    return library
  }, [dbName])
}
