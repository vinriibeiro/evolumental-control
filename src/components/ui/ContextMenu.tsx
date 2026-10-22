import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export interface ContextMenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Atalho exibido à direita (ex.: F2). */
  hint?: string
}

export type ContextMenuEntry = ContextMenuItem | 'separator'

/**
 * Menu de contexto posicionado no ponto do clique (botão direito, toque
 * longo ou teclado). Fecha com Esc, clique fora ou ao escolher um item;
 * setas navegam entre os itens.
 */
export function ContextMenu({ x, y, items, label, onClose }: { x: number; y: number; items: ContextMenuEntry[]; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) })
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  const move = (e: React.KeyboardEvent, delta: number) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons.at((i + delta + buttons.length) % buttons.length)?.focus()
    e.preventDefault()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())} aria-hidden />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="animate-fade-in fixed z-50 min-w-56 rounded-lg border border-line bg-bg p-1 shadow-lg"
        style={pos}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') move(e, 1)
          if (e.key === 'ArrowUp') move(e, -1)
          if (e.key === 'Tab') e.preventDefault()
        }}
      >
        {items.map((it, i) =>
          it === 'separator' ? (
            <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
          ) : (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                onClose()
                it.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none hover:bg-surface focus-visible:bg-surface disabled:opacity-50',
                it.danger ? 'text-danger' : 'text-ink',
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.hint && <kbd className="text-[11px] text-muted">{it.hint}</kbd>}
            </button>
          ),
        )}
      </div>
    </>,
    document.body,
  )
}

/** Toque longo (celular) dispara o menu de contexto no ponto tocado. */
export function useLongPress(onLongPress: (x: number, y: number) => void, ms = 500) {
  const timer = useRef<number | null>(null)
  const cancel = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      cancel()
      timer.current = window.setTimeout(() => {
        timer.current = null
        navigator.vibrate?.(15)
        onLongPress(t.clientX, t.clientY)
      }, ms)
    },
    onTouchMove: cancel,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  }
}
