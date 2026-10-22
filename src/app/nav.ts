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
  Network,
  Route,
  RefreshCcw,
  Settings,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  group: NavGroup
}

export type NavGroup = 'estudar' | 'planejar' | 'fixar' | 'medir' | 'jogar' | 'conta'

export const NAV_GROUPS: Array<{ id: NavGroup; label: string | null }> = [
  { id: 'estudar', label: 'Estudar' },
  { id: 'planejar', label: 'Planejar' },
  { id: 'fixar', label: 'Fixar' },
  { id: 'medir', label: 'Medir' },
  { id: 'jogar', label: 'Jogar' },
  { id: 'conta', label: null },
]

export const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, group: 'estudar' },
  { to: '/espaco', label: 'Meu espaço de estudos', icon: Home, group: 'estudar' },
  { to: '/materias', label: 'Explorador de estudos', icon: BookOpen, group: 'estudar' },
  { to: '/trilhas', label: 'Trilhas', icon: Route, group: 'estudar' },
  { to: '/cronometro', label: 'Cronômetro', icon: Timer, group: 'planejar' },
  { to: '/cronograma', label: 'Cronograma', icon: CalendarRange, group: 'planejar' },
  { to: '/ciclos', label: 'Ciclo de estudos', icon: RefreshCcw, group: 'planejar' },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, group: 'planejar' },
  { to: '/revisoes', label: 'Revisões', icon: Brain, group: 'fixar' },
  { to: '/flashcards', label: 'Flashcards', icon: Layers, group: 'fixar' },
  { to: '/mapas', label: 'Mapas mentais', icon: Network, group: 'fixar' },
  { to: '/questoes', label: 'Questões e desempenho', icon: ClipboardCheck, group: 'fixar' },
  { to: '/metas', label: 'Metas', icon: Target, group: 'medir' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, group: 'medir' },
  { to: '/evoquest', label: 'EvoQuest — Mundo', icon: Gamepad2, group: 'jogar' },
  { to: '/evoquest/treino', label: 'Treino do EvoQuest', icon: Dumbbell, group: 'jogar' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, group: 'conta' },
]

export function titleFor(pathname: string): string {
  if (pathname === '/') return 'Visão geral'
  const match = NAV.filter((n) => n.to !== '/' && pathname.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'EVoLuMentaL Control'
}
