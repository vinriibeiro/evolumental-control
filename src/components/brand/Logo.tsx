import { cn } from '@/lib/cn'

/**
 * Símbolo VLM Control: livro aberto (conhecimento), relógio (tempo) e
 * seta ascendente (evolução) — o ponteiro do relógio é a própria seta.
 * Cor institucional: Wheat #F5DEB3. A variante "tile" aplica o símbolo sobre
 * fundo marrom profundo para garantir contraste em fundos claros.
 */
export function LogoMark({ variant = 'tile', className, title = 'VLM Control' }: { variant?: 'tile' | 'plain'; className?: string; title?: string }) {
  const strokes = (
    <>
      <circle cx="30" cy="26" r="13" />
      <path d="M30 18v8" />
      <path d="M30 26 L49 9" />
      <path d="M41.5 8.5 H49.5 V16.5" />
      <path d="M8 45c7.5-3.6 16-3.6 24 1.6v11c-8-5.2-16.5-5.2-24-1.6z" />
      <path d="M56 45c-7.5-3.6-16-3.6-24 1.6v11c8-5.2 16.5-5.2 24-1.6z" />
    </>
  )
  return (
    <svg viewBox="0 0 64 64" className={cn('shrink-0', className)} role="img" aria-label={title}>
      <title>{title}</title>
      {variant === 'tile' ? (
        <>
          <rect width="64" height="64" rx="14" fill="#3B2B20" />
          <g transform="translate(6.4 6.4) scale(0.8)" fill="none" stroke="#F5DEB3" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            {strokes}
          </g>
        </>
      ) : (
        <g fill="none" stroke="#F5DEB3" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          {strokes}
        </g>
      )}
    </svg>
  )
}

/** Nome oficial — grafia exata: V, M e L maiúsculos. */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex min-w-0 flex-col leading-none', className)}>
      <span className="truncate text-[15px] font-bold tracking-tight text-ink">VLM</span>
      {!compact && <span className="mt-1 text-[10px] font-medium tracking-[0.28em] text-muted">CONTROL</span>}
    </span>
  )
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <LogoMark className="size-9" />
      {!collapsed && <Wordmark />}
    </span>
  )
}
