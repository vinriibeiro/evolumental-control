import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { usePdfLibrary } from '@/hooks/usePdfLibrary'
import { findDuplicate, isEpubFile, sortShelf, type DedupeCandidate, type DuplicateMatch, type ShelfState } from '@/lib/library'
import { cloudErrorMessage, type BookDetails, type Library } from '@/services/library'
import type { PdfLibrary } from '@/services/pdfLibrary'
import { pdfCloudErrorMessage } from '@/services/pdfLibrarySupabase'
import { describePdf } from './pdfCover'
import { epubEntry, pdfEntry, type ShelfEntry } from './shelf'

interface ShelfData {
  entries: ShelfEntry[]
  /** A sincronização com a conta falhou. */
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

export function isPdfFile(name: string, type = ''): boolean {
  return /\.pdf$/i.test(name) || type === 'application/pdf'
}

async function readLocal(library: Library, pdfLibrary: PdfLibrary): Promise<ShelfEntry[]> {
  const [books, pdfs] = await Promise.all([library.list(), pdfLibrary.list()])
  return sortShelf([...books.map(epubEntry), ...pdfs.map(pdfEntry)])
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
 * Importa os arquivos escolhidos, um por vez, passando cada um pela antiduplicidade:
 *  - mesmo conteúdo (hash): não duplica; se o livro estava arquivado ou removido, volta para a estante;
 *  - só metadados iguais (ISBN, identificador, título/autor): pergunta antes de adicionar;
 *  - nada parecido: adiciona.
 */
async function importFiles(files: File[], library: Library, pdfLibrary: PdfLibrary, ask: AskDuplicate): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, duplicated: 0, restored: [], skipped: 0, notes: [] }
  const known = await readLocal(library, pdfLibrary)

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
      if (isEpubFile(file.name, file.type)) {
        const probe = await library.inspect(file)
        const title = probe.meta?.title ?? probe.existing?.title ?? file.name
        const proceed = await check({ hash: probe.id, title, author: probe.meta?.author ?? probe.existing?.author, isbn: probe.meta?.isbn, identifier: probe.meta?.identifier }, file.name, (entry) =>
          entry.kind === 'book' ? library.setShelf(entry.id, 'active') : pdfLibrary.setShelfData(entry.id, { shelf: 'active' }),
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
      } else if (isPdfFile(file.name, file.type)) {
        const probe = await pdfLibrary.inspect(file)
        const restore = (entry: ShelfEntry) => (entry.kind === 'pdf' ? pdfLibrary.setShelfData(entry.id, { shelf: 'active' }) : library.setShelf(entry.id, 'active'))
        // o conteúdo decide primeiro: se é o mesmo arquivo, nem precisa abrir o PDF
        if (findDuplicate({ hash: probe.id, title: '' }, known)) {
          await check({ hash: probe.id, title: probe.title }, file.name, restore)
          if (known.some((entry) => entry.kind === 'pdf' && entry.id === probe.id && !entry.fileLocal)) await pdfLibrary.add(file, probe)
          continue
        }
        const description = await describePdf(probe.data)
        if (!(await check({ hash: probe.id, title: probe.title, author: description.author }, file.name, restore))) continue
        const book = await pdfLibrary.add(file, probe)
        if (description.author || description.cover || description.pageCount) {
          await pdfLibrary.setShelfData(book.id, description).catch(() => undefined) // capa e autor são opcionais
        }
        known.push(pdfEntry({ ...book, ...description }))
        summary.added++
      } else {
        throw new Error(`"${file.name}" não é um EPUB nem um PDF. A biblioteca aceita arquivos .epub e .pdf.`)
      }
    } catch (e) {
      summary.notes.push({ kind: 'error', text: errorMessage(e) })
    }
  }
  return summary
}

/** Dados e ações da estante unificada (EPUB + PDF). */
export function useShelf() {
  const library = useLibrary()
  const pdfLibrary = usePdfLibrary()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const queryKey = useMemo(() => ['library', 'shelf', library.dbName], [library.dbName])

  const shelf = useQuery({
    staleTime: 0,
    queryKey,
    queryFn: async (): Promise<ShelfData> => {
      const [epubSync, pdfSync] = await Promise.allSettled([library.sync(), pdfLibrary.sync()])
      const errors = []
      if (epubSync.status === 'rejected') errors.push(cloudErrorMessage(epubSync.reason))
      if (pdfSync.status === 'rejected') errors.push(pdfCloudErrorMessage(pdfSync.reason))
      const syncError = errors.join(' ') || null
      return { entries: await readLocal(library, pdfLibrary), syncError, schemaOutdated: library.cloudSchemaOutdated }
    },
  })

  /** Depois de uma ação local basta reler o aparelho: a nuvem já recebe a mudança em segundo plano. */
  const reload = useCallback(async () => {
    const entries = await readLocal(library, pdfLibrary)
    qc.setQueryData<ShelfData>(queryKey, (prev) => ({ entries, syncError: prev?.syncError ?? null, schemaOutdated: library.cloudSchemaOutdated }))
    void qc.invalidateQueries({ queryKey: ['library', 'last-read'] })
  }, [library, pdfLibrary, qc, queryKey])

  const importing = useMutation({
    mutationFn: (files: File[]) =>
      importFiles(files, library, pdfLibrary, (match, fileName) =>
        confirm({ title: 'Livro possivelmente duplicado', message: duplicateQuestion(match, fileName), confirmLabel: 'Adicionar mesmo assim', cancelLabel: 'Não adicionar' }),
      ),
    onSuccess: ({ added, duplicated, restored, skipped, notes }) => {
      void reload().then(() => qc.invalidateQueries({ queryKey }))
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
      void reload().then(() => qc.invalidateQueries({ queryKey }))
      if (done) toast.success(done)
    },
    onError: (e) => toast.error(cloudErrorMessage(e)),
  })

  const setFavorite = (entry: ShelfEntry, favorite: boolean) =>
    action.mutate({ run: () => (entry.kind === 'pdf' ? pdfLibrary.setShelfData(entry.id, { favorite }) : library.setFavorite(entry.id, favorite)) })

  const moveTo = (entry: ShelfEntry, state: ShelfState) =>
    action.mutate({
      run: () => (entry.kind === 'pdf' ? pdfLibrary.setShelfData(entry.id, { shelf: state }) : library.setShelf(entry.id, state)),
      done:
        state === 'hidden'
          ? 'Removido da estante. O arquivo e a sua leitura continuam guardados em “Removidos”.'
          : state === 'archived'
            ? 'Livro arquivado. Ele continua guardado em “Arquivados”.'
            : 'Livro de volta à estante.',
    })

  const saveDetails = (entry: ShelfEntry, details: Required<BookDetails>) =>
    action.mutateAsync({ run: () => (entry.kind === 'pdf' ? pdfLibrary.setShelfData(entry.id, details) : library.setDetails(entry.id, details)), done: 'Detalhes salvos.' })

  /** Exclusão permanente: a única ação que apaga o arquivo e os dados de leitura; sempre com confirmação. */
  const deleteForever = async (entry: ShelfEntry) => {
    const cloudDelete = entry.cloud === 'synced' || (entry.kind === 'pdf' && entry.cloud === 'pending')
    const ok = await confirm({
      title: 'Excluir permanentemente',
      message: `Excluir “${entry.title}” de vez? O arquivo guardado, a posição de leitura, os marcadores e as anotações deste livro serão apagados ${cloudDelete ? 'deste aparelho e de qualquer aparelho em que o livro esteja sincronizado' : 'deste navegador'}. Os outros livros não são afetados e o arquivo original no seu computador continua intacto. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir permanentemente',
      danger: true,
    })
    if (ok) action.mutate({ run: () => (entry.kind === 'pdf' ? pdfLibrary.remove(entry.id) : library.remove(entry.id)), done: 'Livro excluído permanentemente.' })
  }

  return { shelf, cloudOn: library.cloud !== null, importing, busy: action.isPending, setFavorite, moveTo, saveDetails, deleteForever }
}
