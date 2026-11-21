// Último livro ou PDF lido, para retomar a leitura direto da tela inicial.
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useLastRead } from '@/pages/library/lastRead'

export function LastReadLine() {
  const last = useLastRead()
  if (!last.data) return null
  return (
    <Link to={last.data.href} className="group flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{last.data.title}</p>
        <p className="tabular mt-0.5 truncate text-xs text-muted">Leitura · {Math.round(last.data.progress)}% de navegação</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-ink group-hover:underline">
        Continuar <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  )
}
