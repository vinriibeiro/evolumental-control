import { Link } from 'react-router-dom'
import { ChevronRight, Library } from 'lucide-react'
import type { ExplorerNode } from '../model'
import { hrefFor } from '../useExplorer'

/** "Todos › SEFAZ › Tecnologia › Banco de Dados › SQL › JOINs" — cada nível é clicável. */
export function Breadcrumbs({ path }: { path: ExplorerNode[] }) {
  return (
    <nav aria-label="Você está em" className="mb-3 min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted">
        <li>
          <Link to="/materias" className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-surface-2 hover:text-ink">
            <Library className="size-3.5" aria-hidden />
            Todos
          </Link>
        </li>
        {path.map((n, i) => (
          <li key={n.key} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            {i === path.length - 1 ? (
              <span aria-current="page" className="truncate px-1 font-medium text-ink">
                {n.name}
              </span>
            ) : (
              <Link to={hrefFor(n.type, n.id, n.topic?.subject_id)} className="max-w-[16rem] truncate rounded px-1 py-0.5 hover:bg-surface-2 hover:text-ink">
                {n.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
