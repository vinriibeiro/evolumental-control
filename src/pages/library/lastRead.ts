import { useQuery } from '@tanstack/react-query'
import { useLibrary } from '@/hooks/useLibrary'
import { epubEntry, type ShelfEntry } from './shelf'

export interface LastRead {
  id: string
  kind: 'book'
  title: string
  author: string
  /** 0 a 100: posição de leitura no EPUB. */
  progress: number
  href: string
  lastReadAt: string | null
}

/** O livro EPUB lido por último entre os que estão na estante; arquivados e removidos ficam de fora. */
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
  const query = useQuery({
    queryKey: ['library', 'last-read', library.dbName],
    staleTime: 0,
    queryFn: async () => {
      const books = await library.list()
      return pickLastRead(books.map(epubEntry))
    },
  })
  return { data: query.data ?? null, isPending: query.isPending }
}
