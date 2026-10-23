import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Modal } from './Modal'

// ---------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current
    setItems((list) => [...list.slice(-3), { id, kind, message }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bottom)+1rem)] z-[60] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end" aria-live="polite">
          {items.map((t) => (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="animate-fade-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink shadow-lg"
            >
              {t.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : t.kind === 'error' ? (
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-info" />
              )}
              <span className="min-w-0 flex-1 break-words">{t.message}</span>
              <button className="text-muted hover:text-ink" aria-label="Fechar aviso" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast fora do ToastProvider')
  return {
    success: (m: string) => push('success', m),
    error: (e: unknown) => push('error', errorMessage(e)),
    info: (m: string) => push('info', m),
  }
}

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  return 'Algo deu errado. Tente novamente.'
}

// ---------------------------------------------------------------------
// Confirmação
// ---------------------------------------------------------------------
interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>{state?.cancelLabel ?? 'Cancelar'}</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const c = useContext(ConfirmContext)
  if (!c) throw new Error('useConfirm fora do ConfirmProvider')
  return c
}

// ---------------------------------------------------------------------
// Estados de tela
// ---------------------------------------------------------------------
export function Spinner({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-10 text-sm text-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} aria-hidden />
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-accent-strong">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-danger" />
      <p className="max-w-md text-sm text-ink">{errorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} icon={<RefreshCw className="size-4" />}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

/** Renderiza carregamento/erro de uma consulta e o conteúdo quando pronta. */
export function QueryState({
  query,
  children,
  loading,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  children: ReactNode
  loading?: ReactNode
}) {
  if (query.isPending) return <>{loading ?? <Spinner />}</>
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return <>{children}</>
}
