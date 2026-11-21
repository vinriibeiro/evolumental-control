import { useQuery } from '@tanstack/react-query'
import { useLibrary } from '@/hooks/useLibrary'
import { usePdfLibrary } from '@/hooks/usePdfLibrary'
import { epubEntry, pdfEntry, type ShelfEntry } from './shelf'

export interface LastRead {
  id: string
  kind: 'book' | 'pdf'
  title: string
  author: string
  /** 0 a 100. No PDF é o progresso de navegação (páginas já abertas), não prova de leitura completa. */
  progress: number
  href: string
  lastReadAt: string | null
}

/** O livro (EPUB ou PDF) lido por último entre os que estão na estante; arquivados e removidos ficam de fora. */
export function pickLastRead(entries: ShelfEntry[]): LastRead | null {
  let last: ShelfEntry | null = null
  for (const entry of entries) {
    if (entry.shelf !== 'active' || !entry.lastReadAt) continue
    if (!last || entry.lastReadAt > (last.lastReadAt ?? '')) last = entry
  }
  if (!last) return null
  return { id: last.id, kind: last.kind, title: last.title, author: last.author, progress: last.progress, href: last.href, lastReadAt: last.lastReadAt ?? null }
}

/**
 * "Continuar de onde parei": lê só o que já está neste aparelho (não dispara sincronização com a nuvem),
 * para a tela inicial abrir rápido e funcionar sem internet.
 */
export function useLastRead(): { data: LastRead | null; isPending: boolean } {
  const library = useLibrary()
  const pdfLibrary = usePdfLibrary()
  const query = useQuery({
    queryKey: ['library', 'last-read', library.dbName],
    staleTime: 0,
    queryFn: async () => {
      const [books, pdfs] = await Promise.all([library.list(), pdfLibrary.list()])
      return pickLastRead([...books.map(epubEntry), ...pdfs.map(pdfEntry)])
    },
  })
  return { data: query.data ?? null, isPending: query.isPending }
}
