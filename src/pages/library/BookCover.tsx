import { useEffect, useState } from 'react'
import { coverHue } from '@/lib/library'
import { cn } from '@/lib/cn'
import type { BookRecord } from '@/services/library'

/** Capa do livro: usa a imagem do EPUB; sem ela, gera uma capa com o título. */
export function BookCover({ book, className }: { book: Pick<BookRecord, 'title' | 'author' | 'cover' | 'coverType'>; className?: string }) {
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
    return <img src={url} alt={`Capa de ${book.title}`} className={cn('aspect-[2/3] w-full rounded-md object-cover shadow-sm', className)} loading="lazy" />
  }
  const hue = coverHue(book.title)
  return (
    <div
      role="img"
      aria-label={`Capa de ${book.title}`}
      className={cn('flex aspect-[2/3] w-full flex-col justify-between rounded-md p-3 text-white shadow-sm', className)}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 38%), hsl(${(hue + 40) % 360} 50% 24%))` }}
    >
      <span className="line-clamp-5 text-sm font-semibold leading-snug">{book.title}</span>
      <span className="line-clamp-2 text-xs opacity-80">{book.author}</span>
    </div>
  )
}
