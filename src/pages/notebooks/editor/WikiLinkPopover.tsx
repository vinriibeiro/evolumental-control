import { FileText } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface LinkablePageOption {
  id: string
  notebookId: string
  notebookTitle: string
  title: string
}

export function filterLinkablePages(pages: LinkablePageOption[], query: string, excludeNodeId?: string): LinkablePageOption[] {
  const q = query
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return pages
    .filter((p) => {
      if (excludeNodeId && p.id === excludeNodeId) return false
      if (!q) return true
      const hay = `${p.title} ${p.notebookTitle}`
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
      return hay.includes(q)
    })
    .slice(0, 12)
}

export function WikiLinkPopover({
  items,
  activeIndex,
  position,
  onSelect,
  onHover,
}: {
  items: LinkablePageOption[]
  activeIndex: number
  position: { top: number; left: number }
  onSelect: (item: LinkablePageOption) => void
  onHover: (idx: number) => void
}) {
  return (
    <div
      role="listbox"
      aria-label="Vincular página interna"
      style={{ top: position.top, left: position.left }}
      className="animate-fade-in fixed z-50 w-72 overflow-hidden rounded-xl border border-line bg-bg shadow-xl"
    >
      <div className="border-b border-line bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
        Link interno [[ (↑↓ Enter)
      </div>
      <div className="scroll-thin max-h-64 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted">Nenhuma página encontrada para vincular.</p>
        ) : (
          items.map((item, idx) => {
            const active = idx === activeIndex
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => onHover(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(item)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-surface-2 text-ink' : 'text-ink/85 hover:bg-surface-2/60',
                )}
              >
                <FileText className="size-3.5 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{item.title}</span>
                  <span className="block truncate text-[10px] text-muted">{item.notebookTitle}</span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
