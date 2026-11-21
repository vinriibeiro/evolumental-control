import { Link } from 'react-router-dom'
import { Archive, ArchiveRestore, Cloud, CloudOff, EyeOff, Pencil, Star, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Progress } from '@/components/ui/layout'
import { formatSize } from '@/lib/library'
import type { ShelfState } from '@/lib/library'
import { cn } from '@/lib/cn'
import { BookCover } from './BookCover'
import { KIND_LABEL, progressLabel, type ShelfEntry } from './shelf'

export interface ShelfItemActions {
  cloudOn: boolean
  busy: boolean
  onFavorite: (entry: ShelfEntry, favorite: boolean) => void
  onMove: (entry: ShelfEntry, state: ShelfState) => void
  onEdit: (entry: ShelfEntry) => void
  onDelete: (entry: ShelfEntry) => void
}

interface ItemProps extends ShelfItemActions {
  entry: ShelfEntry
}

const focusRing = 'rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong'

/** Situação do EPUB na nuvem da conta (o PDF fica só no aparelho e é explicado no rodapé da estante). */
function CloudNote({ entry, cloudOn }: { entry: ShelfEntry; cloudOn: boolean }) {
  if (!cloudOn || entry.kind !== 'book') return null
  if (entry.cloud === 'too-large') {
    return (
      <span className="inline-flex items-center gap-1" title="Maior que 50 MB: não cabe na nuvem do plano gratuito e fica só neste aparelho">
        <CloudOff className="size-3" aria-hidden /> Só neste aparelho
      </span>
    )
  }
  if (entry.cloud === 'pending') {
    return (
      <span className="inline-flex items-center gap-1" title="Será enviado à sua conta na próxima sincronização">
        <CloudOff className="size-3" aria-hidden /> Falta enviar
      </span>
    )
  }
  if (!entry.fileLocal) {
    return (
      <span className="inline-flex items-center gap-1" title="Está na sua conta; baixa para este aparelho ao abrir">
        <Cloud className="size-3" aria-hidden /> Na nuvem
      </span>
    )
  }
  return null
}

function metaLine(entry: ShelfEntry): string {
  const pages = entry.pageCount ? `${entry.pageCount} ${entry.pageCount === 1 ? 'página' : 'páginas'}` : null
  return [KIND_LABEL[entry.kind], pages, formatSize(entry.size)].filter(Boolean).join(' · ')
}

function FavoriteButton({ entry, busy, onFavorite }: Pick<ItemProps, 'entry' | 'busy' | 'onFavorite'>) {
  return (
    <IconButton
      label={entry.favorite ? `Tirar ${entry.title} dos favoritos` : `Favoritar ${entry.title}`}
      size="sm"
      aria-pressed={entry.favorite}
      disabled={busy}
      onClick={() => onFavorite(entry, !entry.favorite)}
    >
      <Star className={cn('size-4', entry.favorite ? 'fill-accent text-accent' : 'text-muted')} aria-hidden />
    </IconButton>
  )
}

/**
 * As três saídas da estante, da mais leve para a definitiva. Só a última apaga o arquivo:
 * arquivar e remover da estante são reversíveis e mantêm a leitura.
 */
function ItemMenu({ entry, busy, onMove, onEdit, onDelete }: ItemProps) {
  return (
    <ActionMenu label={`Ações de ${entry.title}`}>
      {(close) => {
        const run = (fn: () => void) => () => {
          close()
          fn()
        }
        return (
          <>
            <MenuItem icon={<Pencil className="size-4" aria-hidden />} onClick={run(() => onEdit(entry))}>
              Editar detalhes
            </MenuItem>
            {entry.shelf !== 'active' && (
              <MenuItem icon={<ArchiveRestore className="size-4" aria-hidden />} disabled={busy} onClick={run(() => onMove(entry, 'active'))}>
                Voltar para a estante
              </MenuItem>
            )}
            {entry.shelf !== 'archived' && (
              <MenuItem icon={<Archive className="size-4" aria-hidden />} disabled={busy} onClick={run(() => onMove(entry, 'archived'))}>
                Arquivar
              </MenuItem>
            )}
            {entry.shelf !== 'hidden' && (
              <MenuItem icon={<EyeOff className="size-4" aria-hidden />} disabled={busy} onClick={run(() => onMove(entry, 'hidden'))}>
                Remover da estante
              </MenuItem>
            )}
            <MenuItem icon={<Trash2 className="size-4" aria-hidden />} danger disabled={busy} onClick={run(() => onDelete(entry))}>
              Excluir permanentemente
            </MenuItem>
          </>
        )
      }}
    </ActionMenu>
  )
}

function ProgressRow({ entry, className, full }: { entry: ShelfEntry; className?: string; /** Há espaço para o rótulo por extenso. */ full?: boolean }) {
  const label = progressLabel(entry)
  return (
    <div className={cn('flex items-center gap-2', className)} title={entry.kind === 'pdf' ? 'Progresso de navegação: páginas já abertas no leitor. É uma estimativa, não uma confirmação de leitura.' : undefined}>
      <Progress value={entry.progress} className="h-1 flex-1" label={entry.kind === 'pdf' ? `Progresso de navegação de ${entry.title}` : `Progresso de ${entry.title}`} />
      <span className="shrink-0 text-right text-[11px] tabular-nums text-muted">{entry.kind === 'pdf' && !full ? `Navegação ${entry.progress}%` : label}</span>
    </div>
  )
}

/** Cartão da visão em grade: capa, título, autor, progresso e ações. */
export function ShelfCard(props: ItemProps) {
  const { entry, cloudOn } = props
  return (
    <li className="group relative flex min-w-0 flex-col">
      <Link to={entry.href} aria-label={`Abrir ${entry.title}`} className={cn('block', focusRing)}>
        <BookCover book={entry} tag={KIND_LABEL[entry.kind]} className="transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        <p className="mt-3 line-clamp-2 text-sm leading-snug font-semibold text-ink">{entry.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{entry.author || 'Autor não informado'}</p>
      </Link>
      <ProgressRow entry={entry} className="mt-2" />
      <div className="mt-1 flex items-center gap-1">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-[11px] text-muted">
          <span className="truncate">{metaLine(entry)}</span>
          <CloudNote entry={entry} cloudOn={cloudOn} />
        </p>
        <FavoriteButton {...props} />
        <ItemMenu {...props} />
      </div>
      {entry.subject && <p className="truncate text-[11px] text-muted">Assunto: {entry.subject}</p>}
    </li>
  )
}

/** Linha da visão em lista: os mesmos dados do cartão, mais densos. */
export function ShelfRow(props: ItemProps) {
  const { entry, cloudOn } = props
  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
      <Link to={entry.href} tabIndex={-1} aria-hidden className="w-10 shrink-0">
        <BookCover book={entry} tag={KIND_LABEL[entry.kind]} compact />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={entry.href} aria-label={`Abrir ${entry.title}`} className={cn('block truncate text-sm font-semibold text-ink hover:underline', focusRing)}>
          {entry.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="truncate">{[entry.author || 'Autor não informado', metaLine(entry), entry.subject].filter(Boolean).join(' · ')}</span>
          <CloudNote entry={entry} cloudOn={cloudOn} />
        </p>
        <ProgressRow entry={entry} full className="mt-1.5 max-w-sm" />
      </div>
      <div className="flex shrink-0 items-center">
        <FavoriteButton {...props} />
        <ItemMenu {...props} />
      </div>
    </li>
  )
}
