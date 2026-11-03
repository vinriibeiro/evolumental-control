import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Bookmark, FileText, Highlighter, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Card, Progress } from '@/components/ui/layout'
import { EmptyState, QueryState, errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { usePdfLibrary } from '@/hooks/usePdfLibrary'
import { formatSize } from '@/lib/library'
import { normalizeText } from '@/lib/videoProgress'
import type { PdfBook } from '@/services/pdfLibrary'

function pageProgress(book: PdfBook) {
  if (!book.lastReadAt || !book.pageCount) return 0
  return Math.min(100, Math.round(book.currentPage / book.pageCount * 100))
}

/** Estante local de PDFs, independente da sincronização dos livros EPUB. */
export function PdfShelf() {
  const pdfLibrary = usePdfLibrary()
  const { dbName: scope } = useLibrary()
  const queryKey = ['pdf-library', scope]
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const books = useQuery({ queryKey, queryFn: () => pdfLibrary.list(), staleTime: 0 })
  const shelf = useMemo(() => [...(books.data ?? [])].sort((a, b) => {
    const dateA = a.lastReadAt ?? a.addedAt
    const dateB = b.lastReadAt ?? b.addedAt
    return dateB.localeCompare(dateA) || a.title.localeCompare(b.title, 'pt-BR')
  }), [books.data])
  const visible = useMemo(() => {
    const q = normalizeText(query.trim())
    return q ? shelf.filter((book) => normalizeText(`${book.title} ${book.fileName}`).includes(q)) : shelf
  }, [shelf, query])
  const recent = shelf.find((book) => Boolean(book.lastReadAt))
  const annotationCount = shelf.reduce((total, book) => total + book.annotations.length, 0)

  const importFiles = useMutation({
    mutationFn: async (files: File[]) => {
      const known = new Set((await pdfLibrary.list()).map((book) => book.id))
      let added = 0
      let duplicated = 0
      const errors: string[] = []
      for (const file of files) {
        try {
          const book = await pdfLibrary.add(file)
          if (known.has(book.id)) duplicated++
          else added++
          known.add(book.id)
        } catch (error) {
          errors.push(`${file.name}: ${errorMessage(error)}`)
        }
      }
      return { added, duplicated, errors }
    },
    onSuccess: ({ added, duplicated, errors }) => {
      void qc.invalidateQueries({ queryKey })
      if (added) toast.success(added === 1 ? 'PDF adicionado à biblioteca.' : `${added} PDFs adicionados à biblioteca.`)
      if (duplicated) toast.info(duplicated === 1 ? 'Este PDF já está na biblioteca.' : `${duplicated} PDFs já estavam na biblioteca.`)
      errors.forEach((error) => toast.error(error))
    },
    onError: (error) => toast.error(error),
  })

  const remove = useMutation({
    mutationFn: (id: string) => pdfLibrary.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
      toast.success('PDF removido da biblioteca deste navegador.')
    },
    onError: (error) => toast.error(error),
  })

  const askRemove = async (book: PdfBook) => {
    const ok = await confirm({
      title: 'Remover PDF',
      message: `Remover “${book.title}”? O PDF, as anotações e os marcadores serão apagados deste navegador. Exporte suas marcações no leitor antes de remover. O arquivo original no computador permanece intacto.`,
      confirmLabel: 'Remover PDF',
      danger: true,
    })
    if (ok) remove.mutate(book.id)
  }

  return (
    <section aria-labelledby="pdf-shelf-title" className="mb-9 space-y-5 border-b border-line pb-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent-strong"><FileText className="size-5" aria-hidden /></span>
          <div>
            <h2 id="pdf-shelf-title" className="text-lg font-semibold tracking-tight text-ink">Seus PDFs</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">Leia, destaque trechos e organize suas anotações no próprio material.</p>
          </div>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} loading={importFiles.isPending} onClick={() => input.current?.click()}>Adicionar PDF</Button>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Arquivos PDF para adicionar"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) importFiles.mutate(files)
        }}
      />
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
        <span>PDFs, anotações e marcadores ficam só neste navegador. Não sincronizam com a nuvem ou outros aparelhos. Exporte suas marcações pelo leitor antes de limpar os dados do navegador.</span>
      </p>

      <QueryState query={books}>
        {shelf.length === 0 ? (
          <EmptyState icon={<FileText className="size-8" aria-hidden />} title="Seu próximo estudo pode começar por um PDF" description="Use Adicionar PDF para importar apostilas, artigos ou livros. O original permanece no seu computador." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-muted" aria-live="polite"><span className="font-semibold text-ink">{query.trim() ? `${visible.length} de ${shelf.length}` : shelf.length}</span> {shelf.length === 1 ? 'PDF' : 'PDFs'} <span aria-hidden>·</span> <span className="font-semibold text-ink">{annotationCount}</span> {annotationCount === 1 ? 'anotação' : 'anotações'}</p>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pr-10 pl-9" placeholder="Buscar nos seus PDFs" aria-label="Buscar PDF" />
                {query && <IconButton label="Apagar termo da busca de PDFs" size="sm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setQuery('')}><X className="size-3.5" aria-hidden /></IconButton>}
              </div>
            </div>
            {recent && !query.trim() && (
              <Link to={`/biblioteca/pdf/${recent.id}`} aria-label={`Continuar PDF ${recent.title}`} className="group flex flex-wrap items-center gap-4 rounded-2xl border border-accent/25 bg-accent/5 p-5 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-strong uppercase">Retomar PDF</p>
                  <p className="mt-2 line-clamp-2 font-semibold text-ink">{recent.title}</p>
                  <p className="mt-1 text-xs text-muted">Página {recent.currentPage}{recent.pageCount ? ` de ${recent.pageCount}` : ''}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong">Continuar <ArrowUpRight className="size-4" aria-hidden /></span>
              </Link>
            )}
            {visible.length === 0 ? (
              <EmptyState icon={<Search className="size-7" aria-hidden />} title="Nenhum PDF encontrado" description="Busque pelo título ou nome do arquivo." action={<Button onClick={() => setQuery('')}>Limpar busca de PDFs</Button>} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((book) => (
                  <li key={book.id}>
                    <Card className="group flex h-full flex-col p-5 transition-colors hover:border-accent/35">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-accent-strong"><FileText className="size-6" aria-hidden /></span>
                        <IconButton label={`Remover PDF ${book.title}`} size="sm" disabled={remove.isPending} onClick={() => void askRemove(book)}><Trash2 className="size-4" aria-hidden /></IconButton>
                      </div>
                      <h3 className="mt-4 line-clamp-2 text-base leading-snug font-semibold tracking-tight text-ink"><Link to={`/biblioteca/pdf/${book.id}`} className="hover:underline">{book.title}</Link></h3>
                      <p className="mt-2 text-xs text-muted">PDF · {formatSize(book.size)}{book.lastReadAt && book.pageCount ? ` · ${book.pageCount} ${book.pageCount === 1 ? 'página' : 'páginas'}` : ''}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5"><Highlighter className="size-3.5" aria-hidden />{book.annotations.length} {book.annotations.length === 1 ? 'anotação' : 'anotações'}</span>
                        <span className="inline-flex items-center gap-1.5"><Bookmark className="size-3.5" aria-hidden />{book.bookmarks.length} {book.bookmarks.length === 1 ? 'marcador' : 'marcadores'}</span>
                      </div>
                      <div className="mt-auto pt-5">
                        <Progress value={pageProgress(book)} className="h-1.5" label={`Posição da leitura de ${book.title}`} />
                        <Link to={`/biblioteca/pdf/${book.id}`} aria-label={`Abrir PDF ${book.title}`} className="mt-4 flex min-h-10 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-accent/10">
                          {book.lastReadAt ? 'Continuar leitura' : 'Abrir PDF'}<ArrowUpRight className="size-4 text-accent-strong" aria-hidden />
                        </Link>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </QueryState>
    </section>
  )
}
