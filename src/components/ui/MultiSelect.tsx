import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

export interface MultiSelectOption<T extends string> {
  value: T
  label: string
}

/**
 * Menu suspenso de múltipla escolha (como os filtros de sites de questões): o botão mostra "Todos" ou quantos
 * itens estão marcados; o painel tem uma caixa por opção, "Marcar todos" e "Limpar". Fecha com Esc ou clique fora.
 */
export function MultiSelect<T extends string>({ label, options, value, onChange, allLabel = 'Todos', className }: { label: string; options: ReadonlyArray<MultiSelectOption<T>>; value: T[]; onChange: (v: T[]) => void; allLabel?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const picked = options.filter((o) => value.includes(o.value))
  const summary = picked.length === 0 ? allLabel : picked.length === 1 ? picked[0].label : `${picked.length} selecionados`

  return (
    <div ref={box} className={cn('relative min-w-0', className)}>
      <span id={id} className="block text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <button
        type="button"
        aria-labelledby={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'mt-1.5 flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-bg px-3 text-left text-sm transition-colors hover:bg-surface',
          picked.length ? 'border-accent-strong text-ink' : 'border-line text-ink',
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute left-0 z-20 mt-1 w-full min-w-56 rounded-lg border border-line bg-bg p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-1.5 text-xs">
            <button type="button" className="text-ink hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
              Marcar todos
            </button>
            <button type="button" className="text-muted hover:text-ink hover:underline" onClick={() => onChange([])}>
              Limpar
            </button>
          </div>
          <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto py-1">
            {options.map((o) => (
              <Checkbox key={o.value} label={o.label} className="w-full rounded px-1 py-0.5 hover:bg-surface" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
