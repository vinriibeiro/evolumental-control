import { useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './Button'
import { cn } from '@/lib/cn'

/** Menu de ações "…" acessível. Cada item fecha o menu ao ser acionado. */
export function ActionMenu({ label = 'Mais ações', children, align = 'right' }: { label?: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <IconButton label={label} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <MoreHorizontal className="size-4" />
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} aria-hidden />
          <div role="menu" className={cn('animate-fade-in absolute z-30 mt-1 w-52 rounded-lg border border-line bg-bg p-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger, disabled }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface disabled:opacity-50', danger ? 'text-danger' : 'text-ink')}
    >
      {icon}
      {children}
    </button>
  )
}
