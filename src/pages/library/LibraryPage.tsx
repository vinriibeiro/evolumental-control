import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, CloudOff, Library, Plus, Search, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Card, PageHeader, Progress } from '@/components/ui/layout'
import { EmptyState, QueryState, errorMessage, useConfirm, useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { filterShelf, formatSize, inProgress, sortShelf } from '@/lib/library'
import { cloudErrorMessage, type BookRecord } from '@/services/library'
import { BookCover } from './BookCover'

function CloudBadge({ book, cloudOn }: { book: BookRecord; cloudOn: boolean }) {
  if (!cloudOn) return null
  if (book.cloud === 'too-large') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-warning" title="Maior que 50 MB: não cabe na nuvem do plano gratuito e fica só neste aparelho">
        <CloudOff className="size-3" aria-hidden /> Só neste aparelho
      </span>
    )
  }
  if (book.cloud === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-warning" title="Será enviado à sua conta na próxima sincronização">
        <CloudOff className="size-3" aria-hidden /> Falta enviar
      </span>
    )
  }
  if (!book.fileLocal) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-info" title="Está na sua conta; baixa para este aparelho ao abrir">
        <Cloud className="size-3" aria-hidden /> Na nuvem
      </span>
    )
  }
  return null
}

export default function LibraryPage() {
  const library = useLibrary()
  const cloudOn = library.cloud !== null
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const queryKey = ['library', 'books', library.dbName]

  const books = useQuery({
    staleTime: 0,
    queryKey,
    queryFn: async () => {
      let syncError: string | null = null
      if (library.cloud) {
        try {
          await library.sync()
        } catch (e) {
          syncError = cloudErrorMessage(e)
        }
      }
      return { books: await library.list(), syncError }
    },
  })

  const importFiles = useMutation({
    mutationFn: async (files: File[]) => {
      let added = 0
      let duplicated = 0
      const notes: Array<{ kind: 'info' | 'error'; text: string }> = []
      for (const file of files) {
        try {
          const r = await library.add(file)
          if (r.status === 'added') added++
          else duplicated++
          if (r.upload === 'too-large') notes.push({ kind: 'info', text: `"${r.book.title}" tem mais de 50 MB e ficou só neste aparelho (limite do plano gratuito da nuvem).` })
          if (r.upload === 'failed') notes.push({ kind: 'error', text: `Não consegui enviar "${r.book.title}" à sua conta. Ele está neste aparelho e será reenviado quando você abrir a estante com internet.` })
        } catch (e) {
          notes.push({ kind: 'error', text: errorMessage(e) })
        }
      }
      return { added, duplicated, notes }
    },
    onSuccess: ({ added, duplicated, notes }) => {
      void qc.invalidateQueries({ queryKey })
      if (added) toast.success(added === 1 ? '1 livro adicionado à estante.' : `${added} livros adicionados à estante.`)
      if (duplicated) toast.info(duplicated === 1 ? '1 livro já estava na estante.' : `${duplicated} livros já estavam na estante.`)
      notes.forEach((n) => (n.kind === 'info' ? toast.info(n.text) : toast.error(n.text)))
    },
    onError: (e) => toast.error(e),
  })

  const remove = useMutation({
    mutationFn: (id: string) => library.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
      toast.success('Livro removido da estante.')
    },
    onError: (e) => toast.error(cloudErrorMessage(e)),
  })

  const shelf = useMemo(() => sortShelf(books.data?.books ?? []), [books.data])
  const visible = useMemo(() => filterShelf(shelf, query), [shelf, query])
  const reading = useMemo(() => shelf.filter(inProgress).slice(0, 3), [shelf])

  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (files.length) importFiles.mutate(files)
  }

  const askRemove = async (b: BookRecord) => {
    const ok = await confirm({
      title: 'Remover livro',
      message:
        cloudOn && b.cloud === 'synced'
          ? `Remover "${b.title}" da estante? Ele será apagado da sua conta e de todos os aparelhos. O arquivo original no seu computador não é afetado.`
          : `Remover "${b.title}" da estante? O arquivo guardado neste navegador e seus marcadores serão apagados (o arquivo original no computador não é afetado).`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (ok) remove.mutate(b.id)
  }

  const addButton = (
    <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} loading={importFiles.isPending} onClick={() => fileInput.current?.click()}>
      Adicionar livros
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        description="Seus livros em EPUB para ler aqui mesmo, no estilo Kindle: continua de onde parou, com marcadores e temas."
        actions={addButton}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".epub,application/epub+zip"
        className="hidden"
        aria-label="Arquivos EPUB para adicionar"
        onChange={(e) => onPick(e.target.files)}
      />

      {books.data?.syncError && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-surface px-3 py-2 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Não consegui sincronizar com a sua conta: {books.data.syncError} Mostrando só o que está neste aparelho.
          </span>
        </p>
      )}

      <QueryState query={books}>
        {shelf.length === 0 ? (
          <EmptyState
            icon={<Library className="size-8" aria-hidden />}
            title="Sua estante está vazia"
            description="Clique em Adicionar livros e escolha seus arquivos .epub (dá para selecionar vários de uma vez). A capa e o nome são lidos do próprio livro."
            action={addButton}
          />
        ) : (
          <div className="space-y-8">
            {reading.length > 0 && !query && (
              <section aria-labelledby="continuar">
                <h2 id="continuar" className="mb-3 text-sm font-semibold text-ink">
                  Continuar lendo
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {reading.map((b) => (
                    <Link key={b.id} to={`/biblioteca/${b.id}`} aria-label={`Continuar lendo ${b.title}`} className="block">
                      <Card className="flex gap-3 p-3 transition-colors hover:bg-surface">
                        <BookCover book={b} className="w-16 shrink-0" />
                        <div className="min-w-0 flex-1 self-center">
                          <p className="line-clamp-2 text-sm font-medium text-ink">{b.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted">{b.author}</p>
                          <Progress value={b.progress} className="mt-3" label={`Progresso de ${b.title}`} />
                          <p className="mt-1 text-xs text-muted">{b.progress}% lido</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="estante">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 id="estante" className="text-sm font-semibold text-ink">
                  Estante · {shelf.length} {shelf.length === 1 ? 'livro' : 'livros'}
                </h2>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input className="pl-9" placeholder="Buscar por título ou autor" aria-label="Buscar livro" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              {visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Nenhum livro encontrado para "{query}".</p>
              ) : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {visible.map((b) => (
                    <li key={b.id} className="group relative flex flex-col">
                      <Link to={`/biblioteca/${b.id}`} aria-label={`Abrir ${b.title}`} className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong">
                        <BookCover book={b} className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md" />
                        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink">{b.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{b.author}</p>
                      </Link>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={b.progress} className="h-1.5 flex-1" label={`Progresso de ${b.title}`} />
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted">{b.progress}%</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span>{formatSize(b.size)}</span>
                        <CloudBadge book={b} cloudOn={cloudOn} />
                      </p>
                      <IconButton
                        label={`Remover ${b.title}`}
                        size="sm"
                        variant="secondary"
                        className="absolute right-1 top-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => void askRemove(b)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </QueryState>

      <p className="mt-8 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {cloudOn ? (
          <span>
            Seus livros ficam num espaço privado da sua conta (só você acessa, depois do login) e aparecem em qualquer aparelho em que você entrar. Eles também ficam guardados no aparelho, para
            ler sem internet. Livros com mais de 50 MB ficam só no aparelho em que foram adicionados.
          </span>
        ) : (
          <span>
            Os livros ficam guardados só neste navegador, neste computador. Eles não são enviados para a internet nem para a sua conta. Em outro aparelho, é preciso adicionar os arquivos de novo.
            Limpar os dados do navegador apaga a estante.
          </span>
        )}
      </p>
    </div>
  )
}
