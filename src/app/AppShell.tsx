import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, CloudOff, LogOut, Menu, Moon, Pause, Play, Search, Settings, Sun, X } from 'lucide-react'
import { MENU, groupFor, tabsFor, titleFor } from './nav'
import { useAuth } from './auth'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { IconButton } from '@/components/ui/Button'
import { Spinner, useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { useProfile, useApplyTheme, useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useLiveSession, useSessionActions } from '@/features/timer/useLiveSession'
import { ROOM_PATH } from '@/features/timer/useStartStudy'
import { TimerAlerts } from '@/features/timer/TimerAlerts'
import { useNow } from '@/hooks/useNow'
import { useLookups } from '@/hooks/domain'
import { netSeconds, openPause, phaseStatus } from '@/lib/timer/engine'
import { formatClock } from '@/lib/time'
import { GlobalSearch } from './GlobalSearch'
import { InstallAppButton } from '@/components/InstallApp'
import { Notifications } from './Notifications'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* preferência apenas deste dispositivo */
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => readFlag('evl:sidebar-collapsed'))
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
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false)
    }
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
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [mobileOpen])
  // Altura do topo fixo (cabeçalho + aviso), usada por telas de altura total como o calendário e os leitores.
  useEffect(() => {
    const el = topRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--app-top', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => writeFlag('evl:sidebar-collapsed', collapsed), [collapsed])
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

      {/* Barra lateral (desktop): compacta e recolhível */}
      <aside className={cn('app-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col transition-[width] duration-200 lg:flex', collapsed ? 'w-[64px]' : 'w-[224px]')} aria-label="Navegação principal">
        <SidebarContent collapsed={collapsed} />
        <div className="border-t border-line p-2">
          <IconButton label={collapsed ? 'Expandir menu' : 'Recolher menu'} size="sm" onClick={() => setCollapsed((c) => !c)} className="w-full text-muted">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </IconButton>
        </div>
      </aside>

      {/* Menu móvel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside ref={mobileRef} className="app-sidebar animate-fade-in absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col" aria-label="Navegação principal">
            <div className="absolute top-3 right-3">
              <IconButton label="Fechar menu" size="sm" onClick={() => setMobileOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <SidebarContent collapsed={false} large />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={topRef} className="app-top sticky top-0 z-30">
          <header className="flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
            <IconButton label="Abrir menu" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
            <Link to="/" className="lg:hidden" aria-label="Início">
              <LogoMark className="size-7" />
            </Link>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink max-sm:sr-only">{titleFor(location.pathname)}</p>
            <span className="flex-1 sm:hidden" />
            <LiveTimerChip />
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-xs text-muted transition-colors hover:border-ink/30 hover:text-ink md:flex xl:w-60"
            >
              <Search className="size-4" />
              Buscar
              <kbd className="ml-auto rounded border border-line bg-bg px-1.5 py-0.5 text-[9px]">Ctrl K</kbd>
            </button>
            <IconButton label="Pesquisar" size="sm" className="md:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="size-5" />
            </IconButton>
            <Notifications />
            <IconButton
              label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              size="sm"
              disabled={!profileQuery.isSuccess || updateSettings.isPending}
              onClick={() => updateSettings.mutate({ theme: dark ? 'light' : 'dark' }, { onError: (error) => toast.error(error) })}
              className="max-sm:hidden"
            >
              {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </IconButton>
            <ProfileMenu />
          </header>

          {auth.mode === 'local' && (
            <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-[11px] text-muted sm:px-6">
              <CloudOff className="size-3.5 shrink-0" />
              <span>
                <strong className="font-medium text-ink">Modo local:</strong> seus dados ficam neste navegador, sem sincronização.
              </span>
              <Link to="/configuracoes" className="ml-auto shrink-0 font-medium text-ink underline underline-offset-2">
                Gerenciar dados
              </Link>
            </div>
          )}
        </div>

        <main id="conteudo" className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <SectionTabs pathname={location.pathname} />
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav aria-label="Navegação rápida" className="evl-mobile-nav fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-bg/95 px-1 pt-1.5 backdrop-blur lg:hidden">
        {MENU.slice(0, 5).map((item) => {
          const active = groupFor(location.pathname) === item
          return (
            <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px]', active ? 'font-semibold text-ink' : 'text-muted')}>
              <item.icon className={cn('size-5', active && 'text-accent')} aria-hidden />
              <span className="truncate">{item.short}</span>
            </Link>
          )
        })}
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
    <nav ref={nav} aria-label="Seções" className="app-tabs scroll-thin relative -mt-1 mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn('-mb-px shrink-0 border-b-2 px-3 pt-1.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors', isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')
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
      <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Link to="/" aria-label="VLM Control — início">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav aria-label="Menu principal" className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-1">
          {MENU.map((item) => {
            const isActive = current === item
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn('evl-sidebar-link flex items-center gap-3 rounded-lg font-medium transition-colors', large ? 'px-3 py-3 text-sm' : 'px-3 py-2.5 text-[13px]', collapsed && 'justify-center px-0')}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

/**
 * Cronômetro compacto e persistente: aparece em todas as telas enquanto houver sessão, mostra o conteúdo estudado,
 * permite pausar/continuar sem sair de onde se está e leva à Sala de Estudos. Lê a mesma sessão única do banco,
 * então trocar de página ou recarregar o navegador não cria outra sessão.
 */
function LiveTimerChip() {
  const live = useLiveSession()
  const actions = useSessionActions()
  const lookups = useLookups()
  const toast = useToast()
  const s = live.data
  const now = useNow(1000, Boolean(s))
  const location = useLocation()
  if (!s || location.pathname === ROOM_PATH) return null
  const paused = Boolean(openPause(s.pauses))
  const st = s.status === 'active' ? phaseStatus(s, s.pauses, now) : null
  const pending = s.status === 'pending_review'
  const clock = pending ? 'Confirmar' : formatClock(netSeconds(s, s.pauses, now))
  const what = s.source?.label ?? (s.topic_id ? lookups.topicName(s.topic_id) : s.subject_id ? lookups.subjectName(s.subject_id) : 'Estudo livre')
  const toggle = () => (paused ? actions.resume(s) : actions.pause(s)).catch((e) => toast.error(e))
  return (
    <div className={cn('flex h-9 shrink-0 items-center overflow-hidden rounded-lg border text-sm', st?.due ? 'animate-pulse-ring border-accent' : 'border-line')}>
      {!pending && (
        <button onClick={toggle} disabled={actions.pending} aria-label={paused ? 'Continuar sessão' : 'Pausar sessão'} title={paused ? 'Continuar' : 'Pausar'} className="flex h-full w-9 items-center justify-center border-r border-line text-ink hover:bg-surface-2 disabled:opacity-50">
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      )}
      <Link to={ROOM_PATH} className="flex h-full min-w-0 items-center gap-2 px-3 hover:bg-surface-2" aria-label={`Sessão em andamento: ${what}, ${clock}. Abrir a Sala de Estudos`}>
        <span className={cn('size-1.5 shrink-0 rounded-full', paused || pending ? 'bg-muted' : 'bg-accent')} aria-hidden />
        <span className="tabular font-semibold text-ink">{clock}</span>
        <span className="hidden max-w-40 truncate text-xs text-muted md:inline">{what}</span>
      </Link>
    </div>
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
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Perfil" className="flex size-8 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-bg">
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2"
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
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-surface-2"
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
