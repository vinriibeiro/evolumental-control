import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, CloudOff, LogOut, Menu, Pause, Play, Search, Settings, X } from 'lucide-react'
import { NAV, NAV_GROUPS, titleFor } from './nav'
import { useAuth } from './auth'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { IconButton } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { useProfile, useApplyTheme, useSettings } from '@/hooks/useSettings'
import { useLiveSession } from '@/features/timer/useLiveSession'
import { TimerAlerts } from '@/features/timer/TimerAlerts'
import { useNow } from '@/hooks/useNow'
import { netSeconds, openPause, phaseStatus } from '@/lib/timer/engine'
import { formatClock } from '@/lib/time'
import { GlobalSearch } from './GlobalSearch'
import { InstallAppButton } from '@/components/InstallApp'
import { Notifications } from './Notifications'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('evl:sidebar-collapsed') === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const settings = useSettings()
  const profileQuery = useProfile()
  const auth = useAuth()
  useApplyTheme(profileQuery.isSuccess ? settings.theme : null)

  useEffect(() => setMobileOpen(false), [location.pathname])
  // Altura do topo fixo (cabeçalho + aviso), usada por telas de altura total como o editor de mapas.
  useEffect(() => {
    const el = topRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--app-top', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('evl:sidebar-collapsed', collapsed ? '1' : '0')
    } catch {
      /* preferência apenas deste dispositivo */
    }
  }, [collapsed])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-full bg-bg">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-bg focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>

      {/* Barra lateral (desktop) */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
        aria-label="Navegação principal"
      >
        <SidebarContent collapsed={collapsed} />
        <div className="border-t border-line p-3">
          <IconButton label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed((c) => !c)} className="w-full">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </IconButton>
        </div>
      </aside>

      {/* Menu móvel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-surface shadow-xl" aria-label="Navegação principal">
            <div className="absolute top-3 right-3">
              <IconButton label="Fechar menu" onClick={() => setMobileOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <SidebarContent collapsed={false} large />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={topRef} className="sticky top-0 z-30">
        <header className="flex h-16 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur sm:px-6">
          <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
          <Link to="/" className="lg:hidden" aria-label="Início">
            <LogoMark className="size-8" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{titleFor(location.pathname)}</h1>
          <LiveTimerChip />
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:text-ink md:flex"
          >
            <Search className="size-4" />
            Pesquisar
            <kbd className="rounded border border-line bg-bg px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <IconButton label="Pesquisar" className="md:hidden" onClick={() => setSearchOpen(true)}>
            <Search className="size-5" />
          </IconButton>
          <Notifications />
          <ProfileMenu />
        </header>

        {auth.mode === 'local' && (
          <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-ink sm:px-6">
            <CloudOff className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <strong>Modo local:</strong> os dados ficam apenas neste navegador (IndexedDB), sem login real e sem sincronização com a nuvem. Configure o Supabase
              para usar contas e sincronizar (veja o README).
            </span>
          </div>
        )}
        </div>

        <main id="conteudo" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <TimerAlerts />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function SidebarContent({ collapsed, large }: { collapsed: boolean; large?: boolean }) {
  return (
    <>
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link to="/" aria-label="EVoLuMentaL Control — início">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className={cn(g.id !== 'estudar' && 'mt-3')}>
            {g.label && !collapsed && <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.label}</p>}
            {g.label && collapsed && <div className="mx-auto mb-1 h-px w-6 bg-line" aria-hidden />}
            <ul className="flex flex-col gap-0.5" aria-label={g.label ?? undefined}>
              {NAV.filter((n) => n.group === g.id).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/' || item.to === '/evoquest'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg font-medium transition-colors',
                        large ? 'px-3 py-3 text-[15px]' : 'px-3 py-2 text-sm',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-accent/35 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn('size-[18px] shrink-0', isActive && 'text-ink')} aria-hidden />
                        {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}

function LiveTimerChip() {
  const live = useLiveSession()
  const s = live.data
  const now = useNow(1000, Boolean(s))
  const location = useLocation()
  if (!s || location.pathname.startsWith('/cronometro')) return null
  const paused = Boolean(openPause(s.pauses))
  const st = s.status === 'active' ? phaseStatus(s, s.pauses, now) : null
  const label = s.status === 'pending_review' ? 'Confirmar sessão' : formatClock(netSeconds(s, s.pauses, now))
  return (
    <Link
      to="/cronometro"
      className={cn(
        'tabular flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold',
        st?.due ? 'animate-pulse-ring border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink',
      )}
      aria-label={`Sessão em andamento: ${label}`}
    >
      {paused || s.status !== 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5 text-success" />}
      {label}
    </Link>
  )
}

function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const profile = useProfile()
  const navigate = useNavigate()
  const name = profile.data?.display_name || auth.user?.email || 'Estudante'
  const initials =
    name
      .split(/\s+/)
      .filter((p) => /^\p{L}/u.test(p))
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'E'
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Perfil"
        className="flex size-9 items-center justify-center rounded-full bg-brown text-xs font-semibold text-wheat"
      >
        {initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="animate-fade-in absolute right-0 z-50 mt-2 w-64 rounded-xl border border-line bg-bg p-2 shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{auth.mode === 'local' ? 'Modo local (sem conta)' : auth.user?.email}</p>
            </div>
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface"
              onClick={() => {
                setOpen(false)
                navigate('/configuracoes')
              }}
            >
              <Settings className="size-4" /> Configurações
            </button>
            <div className="px-1 py-1">
              <InstallAppButton variant="ghost" size="sm" className="w-full justify-start" />
            </div>
            {auth.mode === 'supabase' && (
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-surface"
                onClick={async () => {
                  setOpen(false)
                  await auth.signOut()
                  navigate('/login')
                }}
              >
                <LogOut className="size-4" /> Sair
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
