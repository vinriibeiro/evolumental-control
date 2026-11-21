import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

interface CoverBook {
  title: string
  author?: string
  cover?: ArrayBuffer
  coverType?: string
}

/**
 * Capa do livro: a imagem do EPUB ou a miniatura da primeira página do PDF. Sem imagem, uma capa
 * tipográfica neutra (título e autor), no mesmo formato, para a grade não ficar desalinhada.
 */
export function BookCover({ book, className, tag, compact }: { book: CoverBook; className?: string; tag?: string; /** Miniatura (lista): sem espaço para título, mostra só o tipo. */ compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const { cover, coverType } = book

  useEffect(() => {
    if (!cover) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(new Blob([cover], { type: coverType || 'image/jpeg' }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [cover, coverType])

  if (url) {
    return <img src={url} alt={`Capa de ${book.title}`} className={cn('aspect-[2/3] w-full rounded-md border border-line bg-surface-2 object-cover', className)} loading="lazy" />
  }
  if (compact) {
    return (
      <div role="img" aria-label={`Capa de ${book.title}`} className={cn('flex aspect-[2/3] w-full items-center justify-center rounded-md border border-line bg-surface-2', className)}>
        <span className="text-[9px] font-semibold tracking-wider text-muted uppercase">{tag}</span>
      </div>
    )
  }
  return (
    <div role="img" aria-label={`Capa de ${book.title}`} className={cn('flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-md border border-line bg-surface-2 p-3', className)}>
      <span className="line-clamp-5 text-sm leading-snug font-semibold tracking-tight break-words text-ink">{book.title}</span>
      <span className="flex items-end justify-between gap-2 text-[11px] text-muted">
        <span className="line-clamp-2 min-w-0">{book.author}</span>
        {tag && <span className="shrink-0 font-semibold tracking-wider uppercase">{tag}</span>}
      </span>
    </div>
  )
}
