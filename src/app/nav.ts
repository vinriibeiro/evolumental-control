import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Home,
  Languages,
  Library,
  Layers,
  LayoutDashboard,
  ListChecks,
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
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/espaco', label: 'Meu espaço de estudos', icon: Home },
  { to: '/materias', label: 'Matérias e tópicos', icon: BookOpen },
  { to: '/trilhas', label: 'Trilhas', icon: Route },
  { to: '/rotinas', label: 'Rotinas', icon: ListChecks },
  { to: '/cronometro', label: 'Cronômetro', icon: Timer },
  { to: '/cronograma', label: 'Cronograma', icon: CalendarRange },
  { to: '/ciclos', label: 'Ciclo de estudos', icon: RefreshCcw },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/ingles', label: 'Inglês', icon: Languages },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/revisoes', label: 'Revisões', icon: Brain },
  { to: '/questoes', label: 'Questões e desempenho', icon: ClipboardCheck },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function titleFor(pathname: string): string {
  if (pathname === '/') return 'Visão geral'
  const match = NAV.filter((n) => n.to !== '/' && pathname.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'EVoLuMentaL Control'
}
