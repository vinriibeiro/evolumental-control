import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, ChevronsLeft, ChevronsRight, CloudOff, GraduationCap, Home, Layers, LogOut, Menu, Moon, Pause, Play, Search, Settings, Sun, Timer, X } from 'lucide-react'
import { MENU, groupFor, tabsFor, titleFor } from './nav'
import { useAuth } from './auth'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { IconButton } from '@/components/ui/Button'
import { Spinner, useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { useProfile, useApplyTheme, useSettings, useUpdateSettings } from '@/hooks/useSettings'
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

function readWide(): boolean {
  try {
    return localStorage.getItem('evl:sidebar-hidden') === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  // "Ampliar a tela": esconde de vez a barra lateral no computador e libera a largura do conteúdo
  const [wide, setWide] = useState(readWide)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const topRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const profileQuery = useProfile()
  const auth = useAuth()
  const toast = useToast()
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  useApplyTheme(profileQuery.isSuccess ? settings.theme : null)

  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const changed = () => setSystemDark(media.matches)
    changed()
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 1024px)')
    if (!desktop) return
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false) }
    closeOnDesktop()
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    mobileRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
      if (e.key !== 'Tab') return
      const nodes = mobileRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [mobileOpen])
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
    try {
      localStorage.setItem('evl:sidebar-hidden', wide ? '1' : '0')
    } catch {
      /* preferência apenas deste dispositivo */
    }
  }, [wide])
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
          'app-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col transition-[width] duration-200',
          !wide && 'lg:flex',
          collapsed ? 'w-[80px]' : 'w-[252px]',
        )}
        aria-label="Navegação principal"
      >
        <SidebarContent collapsed={collapsed} />
        <div className="border-t border-white/10 p-3">
          <IconButton label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed((c) => !c)} className="w-full !text-[var(--sidebar-muted)] hover:!bg-white/5">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </IconButton>
        </div>
      </aside>

      {/* Menu móvel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside ref={mobileRef} className="app-sidebar animate-fade-in absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col shadow-xl" aria-label="Navegação principal">
            <div className="absolute top-3 right-3">
              <IconButton label="Fechar menu" className="!text-white hover:!bg-white/10" onClick={() => setMobileOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <SidebarContent collapsed={false} large />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={topRef} className="app-top sticky top-0 z-30">
        <header className="flex h-[72px] items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur sm:gap-3 sm:px-7">
          <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
          <IconButton
            label={wide ? 'Mostrar o menu lateral' : 'Ocultar o menu lateral e ampliar a tela'}
            className="max-lg:hidden"
            aria-pressed={wide}
            onClick={() => setWide((w) => !w)}
          >
            <Menu className="size-5" />
          </IconButton>
          <Link to="/" className="lg:hidden" aria-label="Início">
            <LogoMark className="size-8" />
          </Link>
          <div className="min-w-0 flex-1 max-sm:sr-only">
            <p className="text-[10px] font-medium tracking-[0.13em] text-muted uppercase max-md:hidden">Seu espaço de evolução</p>
            <p className="truncate text-sm font-semibold text-ink">{titleFor(location.pathname)}</p>
          </div>
          <LiveTimerChip />
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-line bg-bg px-3 text-xs text-muted transition-colors hover:border-accent/40 hover:text-ink md:flex xl:w-64"
          >
            <Search className="size-4" />
            Buscar no seu espaço
            <kbd className="ml-auto rounded border border-line bg-surface px-1.5 py-0.5 text-[9px]">Ctrl K</kbd>
          </button>
          <IconButton label="Pesquisar" className="md:hidden" onClick={() => setSearchOpen(true)}>
            <Search className="size-5" />
          </IconButton>
          <Notifications />
          <IconButton
            label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            disabled={!profileQuery.isSuccess || updateSettings.isPending}
            onClick={() => updateSettings.mutate({ theme: dark ? 'light' : 'dark' }, { onError: (error) => toast.error(error) })}
            className="max-sm:hidden"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </IconButton>
          <ProfileMenu />
        </header>

        {auth.mode === 'local' && (
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-[11px] text-muted sm:px-7">
            <CloudOff className="size-3.5 shrink-0" />
            <span>
              <strong className="font-medium text-ink">Modo local:</strong> seus dados ficam neste navegador, sem sincronização.
            </span>
            <Link to="/configuracoes" className="ml-auto shrink-0 font-medium text-accent-strong underline underline-offset-2">Gerenciar dados</Link>
          </div>
        )}
        </div>

        <main id="conteudo" className={cn('mx-auto w-full min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8 lg:px-9', wide ? 'max-w-none' : 'max-w-[1480px]')}>
          <SectionTabs pathname={location.pathname} />
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav aria-label="Navegação rápida" className="evl-mobile-nav fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface/95 px-2 pt-2 backdrop-blur lg:hidden">
        {[
          { to: '/', label: 'Início', icon: Home },
          { to: '/calendario', label: 'Agenda', icon: CalendarDays },
          { to: '/cronometro', label: 'Foco', icon: Timer },
          { to: '/cursos', label: 'Cursos', icon: GraduationCap },
        ].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cn('flex min-h-12 min-w-12 flex-col items-center gap-1 rounded-xl px-3 py-1 text-[10px]', isActive ? 'font-semibold text-accent-strong' : 'text-muted')}>
            <item.icon className="size-5" aria-hidden />{item.label}
          </NavLink>
        ))}
        <button className="flex min-h-12 min-w-12 flex-col items-center gap-1 px-3 py-1 text-[10px] text-muted" onClick={() => setMobileOpen(true)} aria-label="Abrir menu completo"><Menu className="size-5" aria-hidden />Menu</button>
      </nav>

      <TimerAlerts />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function SectionTabs({ pathname }: { pathname: string }) {
  const tabs = tabsFor(pathname)
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    // no celular a aba ativa pode ficar fora da vista: rola só a barra de abas até ela
    const el = nav.current
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && active) el.scrollLeft = Math.max(0, active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2)
  }, [pathname, tabs.length])
  if (!tabs.length) return null
  return (
    <nav ref={nav} aria-label="Seções" className="app-tabs scroll-thin relative -mt-1 mb-7 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              '-mb-px shrink-0 border-b-2 px-3 pb-3 pt-2 text-xs font-medium whitespace-nowrap transition-colors',
              isActive ? 'border-accent-strong text-accent-strong' : 'border-transparent text-muted hover:text-ink',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarContent({ collapsed, large }: { collapsed: boolean; large?: boolean }) {
  const location = useLocation()
  const current = groupFor(location.pathname)
  return (
    <>
      <div className={cn('flex h-[96px] shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-6')}>
        <Link to="/" aria-label="VLM Control — início">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav aria-label="Menu principal" className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {!collapsed && <p className="mb-3 px-3 text-[9px] font-semibold tracking-[0.18em] text-[var(--sidebar-muted)] uppercase">Seu dia, com direção</p>}
        <ul className="flex flex-col gap-1.5">
          {MENU.map((item) => {
            const isActive = current === item
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'evl-sidebar-link flex items-center gap-3 rounded-xl font-medium transition-colors',
                    large ? 'px-3 py-3 text-sm' : 'px-3 py-3 text-[13px]',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
        {!collapsed && <>
          <p className="mt-8 mb-3 px-3 text-[9px] font-semibold tracking-[0.18em] text-[var(--sidebar-muted)] uppercase">Continue explorando</p>
          {[
            { to: '/cursos', label: 'Meus cursos', icon: GraduationCap },
            { to: '/flashcards', label: 'Flashcards', icon: Layers },
          ].map((item) => <Link key={item.to} to={item.to} className="evl-sidebar-link mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px]" aria-current={location.pathname.startsWith(item.to) ? 'page' : undefined}><item.icon className="size-[17px]" aria-hidden />{item.label}<ArrowUpRight className="ml-auto size-3.5 opacity-50" aria-hidden /></Link>)}
        </>}
      </nav>
      {!collapsed && <div className="mx-4 mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex size-8 items-center justify-center rounded-xl bg-white/10 text-wheat"><Timer className="size-4" aria-hidden /></div>
        <p className="text-[13px] font-medium">Um passo de cada vez.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--sidebar-muted)]">Reserve um momento para o que você quer aprender.</p>
        <Link to="/cronometro" className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-medium text-wheat">Entrar em foco<ArrowUpRight className="size-4" aria-hidden /></Link>
      </div>}
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
        'tabular ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold sm:ml-0',
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
