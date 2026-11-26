import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { findDuplicate, isEpubFile, sortShelf, type DedupeCandidate, type DuplicateMatch, type ShelfState } from '@/lib/library'
import { cloudErrorMessage, type BookDetails, type Library } from '@/services/library'
import { epubEntry, type ShelfEntry } from './shelf'

interface ShelfData {
  entries: ShelfEntry[]
  /** A sincronização com a conta falhou: a estante mostra só o que está neste aparelho. */
  syncError: string | null
  /** O Supabase da conta ainda não tem as colunas da estante v2. */
  schemaOutdated: boolean
}

interface ImportSummary {
  added: number
  duplicated: number
  restored: string[]
  skipped: number
  notes: Array<{ kind: 'info' | 'error'; text: string }>
}

type AskDuplicate = (match: DuplicateMatch<ShelfEntry>, fileName: string) => Promise<boolean>

async function readLocal(library: Library): Promise<ShelfEntry[]> {
  const books = await library.list()
  return sortShelf(books.map(epubEntry))
}

const SHELF_PLACE: Record<ShelfState, string> = { active: 'na estante', archived: 'em Arquivados', hidden: 'em Removidos' }

/** Pergunta feita quando só os metadados coincidem: os arquivos são diferentes, quem decide é o usuário. */
export function duplicateQuestion(match: DuplicateMatch<ShelfEntry>, fileName: string): string {
  const { book, reason } = match
  const why = reason === 'isbn' ? 'O ISBN é o mesmo' : reason === 'identifier' ? 'O identificador do livro é o mesmo' : book.author ? 'O título e o autor coincidem' : 'O título coincide'
  const where = book.shelf === 'active' ? '' : ` (${SHELF_PLACE[book.shelf]})`
  return `Parece que este livro já está na estante: “${book.title}”${book.author ? `, de ${book.author}` : ''}${where}. ${why}, mas o arquivo “${fileName}” é diferente do que você já tem. Adicionar mesmo assim?`
}

/**
 * Importa os arquivos EPUB escolhidos, um por vez, passando cada um pela antiduplicidade:
 *  - mesmo conteúdo (hash): não duplica; se o livro estava arquivado ou removido, volta para a estante;
 *  - só metadados iguais (ISBN, identificador, título/autor): pergunta antes de adicionar;
 *  - nada parecido: adiciona.
 */
async function importFiles(files: File[], library: Library, ask: AskDuplicate): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, duplicated: 0, restored: [], skipped: 0, notes: [] }
  const known = await readLocal(library)

  /** true = seguir com a inclusão. */
  const check = async (candidate: DedupeCandidate, fileName: string, restore: (entry: ShelfEntry) => Promise<void>): Promise<boolean> => {
    const match = findDuplicate(candidate, known)
    if (!match) return true
    if (match.level === 'suspect') {
      if (await ask(match, fileName)) return true
      summary.skipped++
      return false
    }
    if (match.book.shelf === 'active') summary.duplicated++
    else {
      await restore(match.book)
      match.book.shelf = 'active'
      summary.restored.push(match.book.title)
    }
    return false
  }

  for (const file of files) {
    try {
      if (!isEpubFile(file.name, file.type)) {
        throw new Error(`"${file.name}" não é um EPUB. A estante aceita apenas arquivos .epub.`)
      }
      const probe = await library.inspect(file)
      const title = probe.meta?.title ?? probe.existing?.title ?? file.name
      const proceed = await check(
        { hash: probe.id, title, author: probe.meta?.author ?? probe.existing?.author, isbn: probe.meta?.isbn, identifier: probe.meta?.identifier },
        file.name,
        (entry) => library.setShelf(entry.id, 'active'),
      )
      // mesmo quando é duplicata exata: garante os bytes neste aparelho se o livro só estava na nuvem
      if (!proceed) {
        if (probe.existing && !probe.existing.fileLocal) await library.add(file, probe)
        continue
      }
      const result = await library.add(file, probe)
      known.push(epubEntry(result.book))
      summary.added++
      if (result.upload === 'too-large') summary.notes.push({ kind: 'info', text: `"${result.book.title}" tem mais de 50 MB e ficou só neste aparelho (limite do plano gratuito da nuvem).` })
      if (result.upload === 'failed') summary.notes.push({ kind: 'error', text: `Não consegui enviar "${result.book.title}" à sua conta. Ele está neste aparelho e será reenviado quando você abrir a estante com internet.` })
    } catch (e) {
      summary.notes.push({ kind: 'error', text: errorMessage(e) })
    }
  }
  return summary
}

/** Dados e ações da estante de livros EPUB. */
export function useShelf() {
  const library = useLibrary()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const queryKey = useMemo(() => ['library', 'shelf', library.dbName], [library.dbName])

  const shelf = useQuery({
    staleTime: 0,
    queryKey,
    queryFn: async (): Promise<ShelfData> => {
      let syncError: string | null = null
      if (library.cloud) {
        try {
          await library.sync()
        } catch (e) {
          syncError = cloudErrorMessage(e)
        }
      }
      return { entries: await readLocal(library), syncError, schemaOutdated: library.cloudSchemaOutdated }
    },
  })

  /** Depois de uma ação local basta reler o aparelho: a nuvem já recebe a mudança em segundo plano. */
  const reload = useCallback(async () => {
    const entries = await readLocal(library)
    qc.setQueryData<ShelfData>(queryKey, (prev) => ({ entries, syncError: prev?.syncError ?? null, schemaOutdated: library.cloudSchemaOutdated }))
    void qc.invalidateQueries({ queryKey: ['library', 'last-read'] })
  }, [library, qc, queryKey])

  const importing = useMutation({
    mutationFn: (files: File[]) =>
      importFiles(files, library, (match, fileName) =>
        confirm({ title: 'Livro possivelmente duplicado', message: duplicateQuestion(match, fileName), confirmLabel: 'Adicionar mesmo assim', cancelLabel: 'Não adicionar' }),
      ),
    onSuccess: ({ added, duplicated, restored, skipped, notes }) => {
      void reload()
      if (added) toast.success(added === 1 ? '1 livro adicionado à estante.' : `${added} livros adicionados à estante.`)
      if (duplicated) toast.info(duplicated === 1 ? '1 livro já estava na estante.' : `${duplicated} livros já estavam na estante.`)
      restored.forEach((title) => toast.info(`“${title}” já estava guardado e voltou para a estante, com a leitura de onde parou.`))
      if (skipped) toast.info(skipped === 1 ? '1 arquivo não foi adicionado.' : `${skipped} arquivos não foram adicionados.`)
      notes.forEach((n) => (n.kind === 'info' ? toast.info(n.text) : toast.error(n.text)))
    },
    onError: (e) => toast.error(e),
  })

  const action = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<void>; done?: string }) => run(),
    onSuccess: (_result, { done }) => {
      void reload()
      if (done) toast.success(done)
    },
    onError: (e) => toast.error(cloudErrorMessage(e)),
  })

  const setFavorite = (entry: ShelfEntry, favorite: boolean) => action.mutate({ run: () => library.setFavorite(entry.id, favorite) })

  const moveTo = (entry: ShelfEntry, state: ShelfState) =>
    action.mutate({
      run: () => library.setShelf(entry.id, state),
      done:
        state === 'hidden'
          ? 'Removido da estante. O arquivo e a sua leitura continuam guardados em “Removidos”.'
          : state === 'archived'
            ? 'Livro arquivado. Ele continua guardado em “Arquivados”.'
            : 'Livro de volta à estante.',
    })

  const saveDetails = (entry: ShelfEntry, details: Required<BookDetails>) =>
    action.mutateAsync({ run: () => library.setDetails(entry.id, details), done: 'Detalhes salvos.' })

  /** Exclusão permanente: a única ação que apaga o arquivo e os dados de leitura; sempre com confirmação. */
  const deleteForever = async (entry: ShelfEntry) => {
    const everywhere = entry.cloud === 'synced'
    const ok = await confirm({
      title: 'Excluir permanentemente',
      message: `Excluir “${entry.title}” de vez? O arquivo guardado, a posição de leitura, os marcadores e as anotações deste livro serão apagados ${everywhere ? 'da sua conta e de todos os aparelhos' : 'deste navegador'}. Os outros livros não são afetados e o arquivo original no seu computador continua intacto. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir permanentemente',
      danger: true,
    })
    if (ok) action.mutate({ run: () => library.remove(entry.id), done: 'Livro excluído permanentemente.' })
  }

  return { shelf, cloudOn: library.cloud !== null, importing, busy: action.isPending, setFavorite, moveTo, saveDetails, deleteForever }
}
