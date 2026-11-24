import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LayoutGrid, Library, List, Plus, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { EmptyState, QueryState } from '@/components/ui/feedback'
import { filterShelf, sameSubject, shelfSubjects } from '@/lib/library'
import { BookCover } from './BookCover'
import { BookDetailsModal } from './BookDetailsModal'
import { ShelfCard, ShelfRow, type ShelfItemActions } from './ShelfItems'
import { KIND_LABEL, matchesFilter, progressLabel, type ShelfEntry, type ShelfFilter } from './shelf'
import { useShelf } from './useShelf'

type ShelfView = 'grid' | 'list'
const VIEW_KEY = 'vlm.estante.visao'

function loadView(): ShelfView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

const EMPTY_FILTER: Record<ShelfFilter, { title: string; description: string }> = {
  all: { title: 'Nenhum livro encontrado', description: 'Nenhum título ou autor corresponde à busca com os filtros atuais.' },
  reading: { title: 'Nenhuma leitura em andamento', description: 'Os livros que você abrir aparecem aqui até serem concluídos.' },
  favorites: { title: 'Nenhum favorito ainda', description: 'Use a estrela de um livro para guardá-lo entre os favoritos.' },
  archived: { title: 'Nada arquivado', description: 'Livros arquivados saem da estante, mas continuam guardados com a sua leitura.' },
  hidden: { title: 'Nada removido', description: 'Livros removidos da estante ficam aqui, com o arquivo e a leitura intactos, até você restaurar ou excluir de vez.' },
}

/** Destaque do último livro acessado, com a ação de continuar de onde parou. */
function ContinueCard({ entry }: { entry: ShelfEntry }) {
  return (
    <section aria-labelledby="ultimo-acessado">
      <Card className="flex flex-wrap items-center gap-4 p-4 sm:gap-5 sm:p-5">
        <Link to={entry.href} tabIndex={-1} aria-hidden className="w-16 shrink-0 sm:w-20">
          <BookCover book={entry} tag={KIND_LABEL[entry.kind]} compact />
        </Link>
        <div className="min-w-0 flex-1 basis-40">
          <h2 id="ultimo-acessado" className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            Último livro acessado
          </h2>
          <p className="mt-1.5 line-clamp-2 text-base leading-snug font-semibold tracking-tight text-ink">{entry.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {[entry.author, entry.kind === 'pdf' && entry.currentPage && entry.pageCount ? `Página ${entry.currentPage} de ${entry.pageCount}` : null].filter(Boolean).join(' · ') || KIND_LABEL[entry.kind]}
          </p>
          <div className="mt-3 flex max-w-md items-center gap-3">
            <Progress value={entry.progress} className="h-1 flex-1" label={entry.kind === 'pdf' ? `Progresso de navegação de ${entry.title}` : `Progresso de ${entry.title}`} />
            <span className="shrink-0 text-xs tabular-nums text-muted">{progressLabel(entry)}</span>
          </div>
        </div>
        <Link
          to={entry.href}
          aria-label={`Continuar ${entry.title}`}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:w-auto"
        >
          Continuar <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Card>
    </section>
  )
}

export default function LibraryPage() {
  const { shelf, cloudOn, importing, busy, setFavorite, moveTo, saveDetails, deleteForever } = useShelf()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [filter, setFilter] = useState<ShelfFilter>('all')
  const [view, setView] = useState<ShelfView>(loadView)
  const [editing, setEditing] = useState<ShelfEntry | null>(null)

  const entries = useMemo(() => shelf.data?.entries ?? [], [shelf.data])
  const onShelf = useMemo(() => entries.filter((e) => e.shelf === 'active'), [entries])
  const subjects = useMemo(() => shelfSubjects(entries), [entries])
  const visible = useMemo(
    () => filterShelf(entries, query).filter((e) => matchesFilter(e, filter) && (!subject || sameSubject(e.subject, subject))),
    [entries, query, filter, subject],
  )
  // a estante já vem ordenada pela leitura mais recente: o primeiro com data de leitura é o último acessado
  const last = useMemo(() => onShelf.find((e) => Boolean(e.lastReadAt)), [onShelf])
  const count = (f: ShelfFilter) => entries.filter((e) => matchesFilter(e, f)).length
  const archived = count('archived')
  const hidden = count('hidden')
  const narrowed = Boolean(query.trim() || subject)
  const hasFilters = narrowed || filter !== 'all'

  const filters: Array<{ value: ShelfFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'reading', label: 'Em andamento' },
    { value: 'favorites', label: 'Favoritos' },
    { value: 'archived', label: archived ? `Arquivados (${archived})` : 'Arquivados' },
    { value: 'hidden', label: hidden ? `Removidos (${hidden})` : 'Removidos' },
  ]

  const clearFilters = () => {
    setQuery('')
    setSubject('')
    setFilter('all')
  }

  const changeView = (next: ShelfView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // sem armazenamento: a escolha vale só nesta visita
    }
  }

  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (files.length) importing.mutate(files)
  }

  const itemActions: ShelfItemActions = { cloudOn, busy, onFavorite: setFavorite, onMove: moveTo, onEdit: setEditing, onDelete: (entry) => void deleteForever(entry) }

  const addButton = (
    <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} loading={importing.isPending} onClick={() => fileInput.current?.click()}>
      Adicionar livros
    </Button>
  )

  return (
    <div>
      <PageHeader title="Biblioteca" description="Seus livros em EPUB e PDF em uma só estante. Leia aqui mesmo e retome de onde parou." actions={addButton} />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        className="hidden"
        aria-label="Arquivos EPUB ou PDF para adicionar"
        onChange={(e) => onPick(e.target.files)}
      />

      {shelf.data?.syncError && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Não consegui sincronizar com a sua conta: {shelf.data.syncError} Os livros já salvos continuam disponíveis.
          </span>
        </p>
      )}
      {shelf.data?.schemaOutdated && !shelf.data.syncError && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Assunto, favoritos, arquivamento e anotações dos EPUBs estão sendo guardados só neste aparelho: falta aplicar a migração 20261121010000_v2_library.sql no seu Supabase. Os livros e a posição
            de leitura continuam sincronizando normalmente.
          </span>
        </p>
      )}

      <QueryState query={shelf}>
        {entries.length === 0 ? (
          <EmptyState
            icon={<Library className="size-8" aria-hidden />}
            title="Sua estante está vazia"
            description="Clique em Adicionar livros e escolha arquivos .epub ou .pdf (dá para selecionar vários de uma vez). A capa e o nome são lidos do próprio arquivo."
            action={addButton}
          />
        ) : (
          <div className="space-y-6">
            {last && !hasFilters && <ContinueCard entry={last} />}

            <section aria-labelledby="estante">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 id="estante" className="text-base font-semibold tracking-tight text-ink">
                  Estante · {onShelf.length} {onShelf.length === 1 ? 'livro' : 'livros'}
                </h2>
                <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5" role="group" aria-label="Visualização da estante">
                  <IconButton label="Ver em grade" size="sm" aria-pressed={view === 'grid'} variant={view === 'grid' ? 'dark' : 'ghost'} onClick={() => changeView('grid')}>
                    <LayoutGrid className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton label="Ver em lista" size="sm" aria-pressed={view === 'list'} variant={view === 'list' ? 'dark' : 'ghost'} onClick={() => changeView('list')}>
                    <List className="size-4" aria-hidden />
                  </IconButton>
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input className="pl-9" placeholder="Buscar por título ou autor" aria-label="Buscar livro" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {subjects.length > 0 && (
                  <Select aria-label="Filtrar por assunto" className="lg:w-56" value={subject} onChange={(e) => setSubject(e.target.value)}>
                    <option value="">Todos os assuntos</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
                <Segmented value={filter} onChange={setFilter} options={filters} label="Situação" size="sm" />
              </div>

              {hasFilters && visible.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted" aria-live="polite">
                    {visible.length} {visible.length === 1 ? 'livro encontrado' : 'livros encontrados'}
                    {filter === 'hidden' && ' · removidos da estante, com arquivo e leitura guardados'}
                    {filter === 'archived' && ' · arquivados, com arquivo e leitura guardados'}
                  </p>
                  <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}

              {visible.length === 0 ? (
                <EmptyState
                  icon={<Search className="size-7" aria-hidden />}
                  title={narrowed ? 'Nenhum livro encontrado' : EMPTY_FILTER[filter].title}
                  description={narrowed ? (query.trim() ? `Nenhum título ou autor corresponde a “${query.trim()}” com os filtros atuais.` : 'Nenhum livro com esse assunto nos filtros atuais.') : EMPTY_FILTER[filter].description}
                  action={hasFilters ? <Button onClick={clearFilters}>Limpar filtros</Button> : undefined}
                />
              ) : view === 'grid' ? (
                <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Livros da estante">
                  {visible.map((entry) => (
                    <ShelfCard key={entry.key} entry={entry} {...itemActions} />
                  ))}
                </ul>
              ) : (
                <Card>
                  <ul className="divide-y divide-line" aria-label="Livros da estante">
                    {visible.map((entry) => (
                      <ShelfRow key={entry.key} entry={entry} {...itemActions} />
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </div>
        )}
      </QueryState>

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {cloudOn ? (
          <span>
            EPUBs e PDFs de até 50 MiB sincronizam no espaço privado da sua conta. Abra a Biblioteca no aparelho em que você importou os arquivos para enviá-los. Arquivos maiores ficam nesse aparelho. Remover um livro da estante nunca apaga o arquivo: só “Excluir permanentemente” faz isso.
          </span>
        ) : (
          <span>
            Os livros ficam guardados só neste navegador, neste computador. Eles não são enviados para a internet nem para a sua conta. Em outro aparelho, é preciso adicionar os arquivos de novo. Limpar
            os dados do navegador apaga a estante. Remover um livro da estante nunca apaga o arquivo: só “Excluir permanentemente” faz isso.
          </span>
        )}
      </p>

      <BookDetailsModal entry={editing} subjects={subjects} onClose={() => setEditing(null)} onSave={saveDetails} />
    </div>
  )
}
