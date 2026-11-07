import { ExternalLink } from 'lucide-react'
import type { QcLink } from '@/content/cguPlan'

/** Filtros do QConcursos de uma tarefa do plano CGU (todos já com a banca Cebraspe); o primeiro é o que o botão Abrir usa. */
export function QcLinks({ links }: { links: QcLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Filtros do QConcursos">
      {links.map((l) => (
        <li key={l.url} className="min-w-0 max-w-full">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink hover:border-ink/40"
          >
            <span className="truncate">{l.label}</span>
            <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}
