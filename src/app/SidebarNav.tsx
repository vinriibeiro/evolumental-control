import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COLLAPSIBLE_GROUPS, groupForPath, isNavActive, NAV, type NavGroup, type NavItem } from './nav'

const OPEN_KEY = 'evl:nav-open'

function readOpen(): NavGroup | null {
  try {
    return (sessionStorage.getItem(OPEN_KEY) as NavGroup | null) || null
  } catch {
    return null
  }
}

const isCollapsible = (g: NavGroup | null): g is NavGroup => Boolean(g && COLLAPSIBLE_GROUPS.some((c) => c.id === g))

/**
 * Categoria aberta (accordion): só uma por vez. Abre sozinha quando a rota
 * passa para outra categoria; navegar dentro da mesma categoria não mexe no
 * estado (nada pisca nem fecha). Guardada durante a sessão.
 */
export function useOpenGroup(pathname: string, search: string) {
  const routeGroup = groupForPath(pathname, search)
  const [open, setOpen] = useState<NavGroup | null>(() => (isCollapsible(routeGroup) ? routeGroup : readOpen()))
  const last = useRef(routeGroup)
  useEffect(() => {
    if (routeGroup === last.current) return
    last.current = routeGroup
    if (isCollapsible(routeGroup)) setOpen(routeGroup)
  }, [routeGroup])
  useEffect(() => {
    try {
      if (open) sessionStorage.setItem(OPEN_KEY, open)
      else sessionStorage.removeItem(OPEN_KEY)
    } catch {
      /* preferência só nesta sessão */
    }
  }, [open])
  return { open, toggle: (g: NavGroup) => setOpen((cur) => (cur === g ? null : g)), routeGroup }
}

function ItemLink({ item, active, collapsed, large, nested }: { item: NavItem; active: boolean; collapsed: boolean; large?: boolean; nested?: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg font-medium transition-colors',
        large ? 'px-3 py-3 text-[15px]' : 'px-3 py-2 text-sm',
        nested && !collapsed && 'pl-9',
        collapsed && 'justify-center px-0',
        active ? 'bg-accent/35 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      <item.icon className={cn('size-[18px] shrink-0', active && 'text-ink')} aria-hidden />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  )
}

/**
 * Navegação principal. Expandida: "Hoje" sempre visível e categorias
 * recolhíveis (Estudar, Planejar, Fixar, Analisar, EvoQuest). Recolhida
 * (72 px): só ícones, todos visíveis, separados por categoria.
 */
export function SidebarNav({ collapsed, large }: { collapsed: boolean; large?: boolean }) {
  const { pathname, search } = useLocation()
  const { open, toggle, routeGroup } = useOpenGroup(pathname, search)
  const active = (n: NavItem) => isNavActive(n, pathname, search)
  const hoje = NAV.filter((n) => n.group === 'hoje')

  if (collapsed)
    return (
      <nav aria-label="Navegação principal" className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {hoje.map((n) => (
            <li key={n.to}>
              <ItemLink item={n} active={active(n)} collapsed />
            </li>
          ))}
        </ul>
        {COLLAPSIBLE_GROUPS.map((g) => (
          <div key={g.id} className="mt-3">
            <div className="mx-auto mb-1 h-px w-6 bg-line" aria-hidden />
            <ul className="flex flex-col gap-0.5" aria-label={g.label}>
              {NAV.filter((n) => n.group === g.id).map((n) => (
                <li key={n.to}>
                  <ItemLink item={n} active={active(n)} collapsed />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    )

  return (
    <nav aria-label="Navegação principal" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-2">
      <ul className="mb-2 flex flex-col gap-0.5">
        {hoje.map((n) => (
          <li key={n.to}>
            <ItemLink item={n} active={active(n)} collapsed={false} large={large} />
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-0.5">
        {COLLAPSIBLE_GROUPS.map((g) => {
          const isOpen = open === g.id
          const current = routeGroup === g.id
          const listId = `nav-group-${g.id}`
          return (
            <li key={g.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => toggle(g.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 text-left font-semibold transition-colors hover:bg-surface-2',
                  large ? 'py-3 text-[15px]' : 'py-2 text-sm',
                  current ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {isOpen ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0" aria-hidden />}
                <span className="flex-1 truncate">{g.label}</span>
                {/* A categoria mostra que contém a página atual (forma + texto, não só cor). */}
                {current && !isOpen && (
                  <span className="flex items-center gap-1 text-[11px] font-normal text-muted">
                    <span className="size-1.5 rounded-full bg-accent-strong" aria-hidden />
                    <span className="sr-only">contém a página atual</span>
                  </span>
                )}
              </button>
              <ul id={listId} hidden={!isOpen} aria-label={g.label} className="mt-0.5 mb-1 flex flex-col gap-0.5">
                {NAV.filter((n) => n.group === g.id).map((n) => (
                  <li key={n.to}>
                    <ItemLink item={n} active={active(n)} collapsed={false} large={large} nested />
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Área inferior: busca/comandos e Configurações. */
export function SidebarFooter({ collapsed, large, onSearch }: { collapsed: boolean; large?: boolean; onSearch: () => void }) {
  const { pathname, search } = useLocation()
  const conta = NAV.filter((n) => n.group === 'conta')
  return (
    <div className="border-t border-line px-3 py-2">
      <button
        type="button"
        onClick={onSearch}
        title={collapsed ? 'Pesquisar e comandos (Ctrl K)' : undefined}
        className={cn('flex w-full items-center gap-3 rounded-lg font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink', large ? 'px-3 py-3 text-[15px]' : 'px-3 py-2 text-sm', collapsed && 'justify-center px-0')}
      >
        <Search className="size-[18px] shrink-0" aria-hidden />
        {collapsed ? (
          <span className="sr-only">Pesquisar e comandos</span>
        ) : (
          <>
            <span className="flex-1 truncate text-left">
              Pesquisar<span className="sr-only"> e comandos</span>
            </span>
            <kbd className="hidden rounded border border-line bg-bg px-1.5 text-[10px] lg:inline">Ctrl K</kbd>
          </>
        )}
      </button>
      {conta.map((n) => (
        <ItemLink key={n.to} item={n} active={isNavActive(n, pathname, search)} collapsed={collapsed} large={large} />
      ))}
    </div>
  )
}
