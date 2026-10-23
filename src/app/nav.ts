import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarRange,
  Gamepad2,
  ClipboardCheck,
  Dumbbell,
  Home,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  NotebookPen,
  NotebookTabs,
  Route,
  RefreshCcw,
  Settings,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  /** Caminho, com parâmetros opcionais (ex.: "/evoquest?painel=mapa"). */
  to: string
  label: string
  icon: LucideIcon
  group: NavGroup
}

/**
 * "hoje" fica sempre visível no topo; "conta" vai para a área inferior.
 * As demais são categorias recolhíveis (accordion) na barra lateral.
 */
export type NavGroup = 'hoje' | 'estudar' | 'planejar' | 'fixar' | 'analisar' | 'evoquest' | 'conta'

export const NAV_GROUPS: Array<{ id: NavGroup; label: string; icon: LucideIcon }> = [
  { id: 'hoje', label: 'Hoje', icon: Sun },
  { id: 'estudar', label: 'Estudar', icon: BookOpen },
  { id: 'planejar', label: 'Planejar', icon: CalendarRange },
  { id: 'fixar', label: 'Fixar', icon: Brain },
  { id: 'analisar', label: 'Analisar', icon: BarChart3 },
  { id: 'evoquest', label: 'EvoQuest', icon: Gamepad2 },
  { id: 'conta', label: 'Conta', icon: Settings },
]

/** Categorias recolhíveis, na ordem da barra lateral. */
export const COLLAPSIBLE_GROUPS = NAV_GROUPS.filter((g) => g.id !== 'hoje' && g.id !== 'conta')

export const NAV: NavItem[] = [
  { to: '/espaco', label: 'Hoje', icon: Sun, group: 'hoje' },
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, group: 'estudar' },
  { to: '/materias', label: 'Explorador de estudos', icon: BookOpen, group: 'estudar' },
  { to: '/trilhas', label: 'Trilhas', icon: Route, group: 'estudar' },
  { to: '/cronometro', label: 'Cronômetro', icon: Timer, group: 'estudar' },
  { to: '/questoes', label: 'Questões', icon: ClipboardCheck, group: 'estudar' },
  { to: '/cronograma', label: 'Cronograma', icon: CalendarRange, group: 'planejar' },
  { to: '/ciclos', label: 'Ciclo de estudos', icon: RefreshCcw, group: 'planejar' },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, group: 'planejar' },
  { to: '/metas', label: 'Metas', icon: Target, group: 'planejar' },
  { to: '/revisoes', label: 'Revisões', icon: Brain, group: 'fixar' },
  { to: '/flashcards', label: 'Flashcards', icon: Layers, group: 'fixar' },
  { to: '/mapas', label: 'Mapas mentais', icon: Network, group: 'fixar' },
  { to: '/questoes/caderno', label: 'Caderno de erros', icon: NotebookPen, group: 'fixar' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, group: 'analisar' },
  // EvoQuest: o mundo abre em tela cheia; os parâmetros escolhem onde ele começa.
  { to: '/evoquest', label: 'Continuar aventura', icon: Gamepad2, group: 'evoquest' },
  { to: '/evoquest?painel=mapa', label: 'Mundo', icon: MapIcon, group: 'evoquest' },
  { to: '/evoquest?ir=minha-cidade', label: 'Minha Cidade', icon: Home, group: 'evoquest' },
  { to: '/evoquest?painel=diario', label: 'Diário', icon: NotebookTabs, group: 'evoquest' },
  { to: '/evoquest/treino', label: 'Treino', icon: Dumbbell, group: 'evoquest' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, group: 'conta' },
]

const split = (to: string) => {
  const i = to.indexOf('?')
  return i < 0 ? { path: to, query: new URLSearchParams() } : { path: to.slice(0, i), query: new URLSearchParams(to.slice(i + 1)) }
}

/** Há outro item do menu dentro deste caminho (ex.: /questoes e /questoes/caderno)? */
const hasChildPath = (path: string) => path === '/' || NAV.some((o) => split(o.to).path.startsWith(`${path}/`))

/**
 * O item corresponde à rota atual? Itens com parâmetros exigem os mesmos
 * parâmetros; o item sem parâmetros de um caminho compartilhado só vale quando
 * nenhum item irmão com parâmetros casa. Caminhos com subpáginas no menu exigem
 * correspondência exata; os demais incluem as subpáginas (/materias/…).
 */
export function isNavActive(item: NavItem, pathname: string, search = ''): boolean {
  const { path, query } = split(item.to)
  const params = new URLSearchParams(search)
  if ([...query.keys()].length) return pathname === path && [...query].every(([k, v]) => params.get(k) === v)
  const siblings = NAV.filter((o) => o !== item && split(o.to).path === path && [...split(o.to).query.keys()].length)
  if (siblings.some((o) => isNavActive(o, pathname, search))) return false
  if (pathname === path) return true
  return !hasChildPath(path) && pathname.startsWith(`${path}/`)
}

/**
 * Categoria da rota atual: a do item ativo; sem item ativo (ex.:
 * /evoquest/jogar), a do item com o caminho mais longo que é prefixo da rota.
 */
export function groupForPath(pathname: string, search = ''): NavGroup | null {
  const active = NAV.find((n) => isNavActive(n, pathname, search))
  if (active) return active.group
  const prefix = NAV.map((n) => ({ n, path: split(n.to).path }))
    .filter(({ path }) => path !== '/' && (pathname === path || pathname.startsWith(`${path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return prefix?.n.group ?? null
}

export function titleFor(pathname: string, search = ''): string {
  if (pathname === '/') return 'Visão geral'
  const active = NAV.find((n) => isNavActive(n, pathname, search))
  if (active) return active.label
  const match = NAV.filter((n) => split(n.to).path !== '/' && pathname.startsWith(split(n.to).path)).sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'EVoLuMentaL Control'
}
