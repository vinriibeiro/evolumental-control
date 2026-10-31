import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardCheck,
  Headphones,
  Home,
  Languages,
  Library,
  Layers,
  LayoutDashboard,
  ListChecks,
  Route,
  Settings,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/espaco', label: 'Meu espaço de estudos', icon: Home },
  { to: '/materias', label: 'Matérias e tópicos', icon: BookOpen },
  { to: '/trilhas', label: 'Trilhas', icon: Route },
  { to: '/rotinas', label: 'Rotinas', icon: ListChecks },
  { to: '/cronometro', label: 'Cronômetro', icon: Timer },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/ingles', label: 'Inglês', icon: Languages },
  { to: '/audios', label: 'Áudios', icon: Headphones },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/revisoes', label: 'Revisões', icon: Brain },
  { to: '/banco-de-questoes', label: 'Banco de questões', icon: ClipboardCheck },
  { to: '/questoes', label: 'Questões e desempenho', icon: ClipboardCheck },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function titleFor(pathname: string): string {
  if (pathname === '/') return 'Visão geral'
  const match = NAV.filter((n) => n.to !== '/' && pathname.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'VLM Control'
}

export interface MenuTab {
  to: string
  label: string
}

export interface MenuGroup {
  label: string
  icon: LucideIcon
  /** Rota aberta ao clicar no item do menu. */
  to: string
  /** Páginas que ficam dentro deste item (viram abas no topo da página). */
  tabs: MenuTab[]
}

/** Menu lateral enxuto: cada item agrupa páginas parecidas, que aparecem como abas. */
export const MENU: MenuGroup[] = [
  { label: 'Visão geral', icon: LayoutDashboard, to: '/', tabs: [{ to: '/', label: 'Visão geral' }, { to: '/espaco', label: 'Meu espaço' }] },
  {
    label: 'Calendário',
    icon: CalendarDays,
    to: '/calendario',
    tabs: [{ to: '/calendario', label: 'Calendário' }, { to: '/rotinas', label: 'Rotinas' }],
  },
  { label: 'Cronômetro', icon: Timer, to: '/cronometro', tabs: [{ to: '/cronometro', label: 'Cronômetro' }] },
  {
    label: 'Biblioteca',
    icon: Library,
    to: '/materias',
    tabs: [
      { to: '/materias', label: 'Matérias' },
      { to: '/trilhas', label: 'Trilhas' },
      { to: '/ingles', label: 'Inglês' },
      { to: '/biblioteca', label: 'Livros' },
      { to: '/audios', label: 'Áudios' },
      { to: '/flashcards', label: 'Flashcards' },
      { to: '/revisoes', label: 'Revisões' },
      { to: '/banco-de-questoes', label: 'Banco de questões' },
      { to: '/questoes', label: 'Desempenho' },
    ],
  },
  { label: 'Metas e relatórios', icon: Target, to: '/metas', tabs: [{ to: '/metas', label: 'Metas' }, { to: '/relatorios', label: 'Relatórios' }] },
  { label: 'Configurações', icon: Settings, to: '/configuracoes', tabs: [{ to: '/configuracoes', label: 'Configurações' }] },
]

const inTab = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'))

/** Item do menu a que a rota pertence (ou undefined, se não houver). */
export function groupFor(pathname: string): MenuGroup | undefined {
  return MENU.find((g) => g.tabs.some((t) => inTab(pathname, t.to)))
}

/** Abas a mostrar no topo: só nas páginas principais do grupo (não em telas de detalhe como a leitura de um livro). */
export function tabsFor(pathname: string): MenuTab[] {
  const g = groupFor(pathname)
  if (!g || g.tabs.length < 2) return []
  return g.tabs.some((t) => t.to === pathname) ? g.tabs : []
}
