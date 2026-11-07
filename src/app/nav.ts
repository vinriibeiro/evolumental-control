import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Headphones,
  Home,
  Languages,
  Library,
  Layers,
  LayoutDashboard,
  ListChecks,
  PlayCircle,
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
  { to: '/cgu', label: 'Plano CGU 2026', icon: Target },
  { to: '/materias', label: 'Matérias e tópicos', icon: BookOpen },
  { to: '/trilhas', label: 'Trilhas', icon: Route },
  { to: '/rotinas', label: 'Rotinas', icon: ListChecks },
  { to: '/cronometro', label: 'Cronômetro', icon: Timer },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/ingles', label: 'Inglês', icon: Languages },
  { to: '/audios', label: 'Áudios', icon: Headphones },
  { to: '/videos', label: 'Vídeos', icon: PlayCircle },
  { to: '/cursos', label: 'Cursos e materiais', icon: GraduationCap },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/livros', label: 'Livros', icon: BookOpen },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/revisoes', label: 'Revisões', icon: Brain },
  { to: '/banco-de-questoes', label: 'Banco de questões', icon: ClipboardCheck },
  { to: '/questoes', label: 'Questões e desempenho', icon: ClipboardCheck },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

/**
 * Páginas que continuam existindo (URL, busca Ctrl K, atalhos), mas sem item no menu — pedido de 07/11/2026:
 * o material de inglês fica em Cursos e os vídeos avulsos também.
 */
export const OUTSIDE_MENU = new Set(['/ingles', '/videos'])

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
  /** Páginas que ficam dentro deste item (viram abas no topo da página; numa pasta, só o botão de voltar). */
  tabs: MenuTab[]
  /** Pasta: sem abas no topo. Cada página de dentro mostra só o botão de voltar à pasta, com este rótulo. */
  back?: string
}

/**
 * Menu lateral enxuto: cada item agrupa páginas parecidas, que aparecem como abas. "Biblioteca" abre a pasta com
 * todos os materiais (um cartão por tipo, na ordem do fluxo) e não tem abas: dentro de cada material só há o botão
 * de voltar à pasta (pedido de 07/11/2026). Revisões fica em Calendário e Desempenho em Metas.
 */
export const MENU: MenuGroup[] = [
  { label: 'Visão geral', icon: LayoutDashboard, to: '/', tabs: [{ to: '/', label: 'Visão geral' }, { to: '/espaco', label: 'Meu espaço' }, { to: '/cgu', label: 'Plano CGU' }] },
  {
    label: 'Calendário',
    icon: CalendarDays,
    to: '/calendario',
    tabs: [{ to: '/calendario', label: 'Calendário' }, { to: '/rotinas', label: 'Rotinas' }, { to: '/revisoes', label: 'Revisões' }],
  },
  { label: 'Cronômetro', icon: Timer, to: '/cronometro', tabs: [{ to: '/cronometro', label: 'Cronômetro' }] },
  {
    label: 'Biblioteca',
    icon: Library,
    to: '/biblioteca',
    back: 'Voltar para a Biblioteca',
    tabs: [
      { to: '/biblioteca', label: 'Biblioteca' },
      { to: '/materias', label: 'Matérias' },
      { to: '/trilhas', label: 'Trilhas' },
      { to: '/cursos', label: 'Cursos' },
      { to: '/livros', label: 'Livros' },
      { to: '/audios', label: 'Áudios' },
      { to: '/flashcards', label: 'Flashcards' },
      { to: '/banco-de-questoes', label: 'Banco de questões' },
    ],
  },
  { label: 'Metas e relatórios', icon: Target, to: '/metas', tabs: [{ to: '/metas', label: 'Metas' }, { to: '/relatorios', label: 'Relatórios' }, { to: '/questoes', label: 'Desempenho' }] },
  { label: 'Configurações', icon: Settings, to: '/configuracoes', tabs: [{ to: '/configuracoes', label: 'Configurações' }] },
]

const inTab = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'))

/** Item do menu a que a rota pertence (ou undefined, se não houver). */
export function groupFor(pathname: string): MenuGroup | undefined {
  return MENU.find((g) => g.tabs.some((t) => inTab(pathname, t.to)))
}

/** Abas a mostrar no topo: só nas páginas principais do grupo (não em telas de detalhe como a leitura de um livro) e nunca numa pasta. */
export function tabsFor(pathname: string): MenuTab[] {
  const g = groupFor(pathname)
  if (!g || g.back || g.tabs.length < 2) return []
  return g.tabs.some((t) => t.to === pathname) ? g.tabs : []
}

/** Botão de voltar à pasta: nas páginas principais de um grupo-pasta, menos na própria pasta (telas de detalhe têm o seu "voltar"). */
export function backFor(pathname: string): MenuTab | null {
  const g = groupFor(pathname)
  if (!g?.back || pathname === g.to || !g.tabs.some((t) => t.to === pathname)) return null
  return { to: g.to, label: g.back }
}
