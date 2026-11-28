import { BookOpen, BookText, CalendarCheck, GraduationCap, Settings, Timer, type LucideIcon } from 'lucide-react'

export interface MenuTab {
  to: string
  label: string
}

export interface MenuGroup {
  label: string
  /** Rótulo curto para a barra inferior do celular. */
  short: string
  icon: LucideIcon
  /** Rota aberta ao clicar no item do menu. */
  to: string
  /** Páginas que ficam dentro desta área (viram abas no topo da página). */
  tabs: MenuTab[]
  /** Outras rotas que pertencem à área, sem aba própria (telas de detalhe e ferramentas abertas a partir de um conteúdo). */
  also?: string[]
}

export const MENU: MenuGroup[] = [
  {
    label: 'Meu Planejamento',
    short: 'Planejar',
    icon: CalendarCheck,
    to: '/',
    tabs: [
      { to: '/', label: 'Planejamento' },
      { to: '/materias', label: 'Matérias' },
      { to: '/ciclos', label: 'Ciclo de estudos' },
      { to: '/revisoes', label: 'Revisões' },
    ],
    also: ['/flashcards'],
  },
  {
    label: 'Meus Cursos',
    short: 'Cursos',
    icon: GraduationCap,
    to: '/cursos',
    tabs: [
      { to: '/cursos', label: 'Meus Cursos' },
      { to: '/videos', label: 'Vídeos' },
      { to: '/audios', label: 'Áudios' },
    ],
  },
  {
    label: 'Meus Livros',
    short: 'Livros',
    icon: BookOpen,
    to: '/biblioteca',
    tabs: [{ to: '/biblioteca', label: 'Estante' }],
    also: ['/livros'],
  },
  {
    label: 'Meus Cadernos',
    short: 'Cadernos',
    icon: BookText,
    to: '/cadernos',
    tabs: [
      { to: '/cadernos', label: 'Cadernos' },
      { to: '/cadernos/favoritos', label: 'Favoritos' },
      { to: '/cadernos/recentes', label: 'Recentes' },
      { to: '/cadernos/conexoes', label: 'Conexões' },
      { to: '/cadernos/lixeira', label: 'Lixeira' },
    ],
  },
  {
    label: 'Sala de Estudos',
    short: 'Estudar',
    icon: Timer,
    to: '/sala',
    tabs: [
      { to: '/sala', label: 'Sessão' },
      { to: '/sala/historico', label: 'Histórico' },
      { to: '/metas', label: 'Metas' },
      { to: '/evolucao', label: 'Evolução' },
      { to: '/relatorio-semanal', label: 'Relatório semanal' },
    ],
    also: ['/cronometro', '/relatorios'],
  },
  { label: 'Configurações', short: 'Ajustes', icon: Settings, to: '/configuracoes', tabs: [{ to: '/configuracoes', label: 'Configurações' }] },
]

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Páginas alcançáveis pela busca (Ctrl K). */
export const NAV: NavItem[] = [
  ...MENU.flatMap((g) => g.tabs.map((t) => ({ to: t.to, label: t.to === g.to ? g.label : t.label, icon: g.icon }))),
  { to: '/flashcards', label: 'Baralhos de revisão', icon: CalendarCheck },
]

const inTab = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'))

/** Área do menu a que a rota pertence (ou undefined, se não houver). A aba mais específica vence ('/sala/historico' antes de '/sala'). */
export function groupFor(pathname: string): MenuGroup | undefined {
  let best: { group: MenuGroup; len: number } | undefined
  for (const g of MENU) {
    for (const to of [...g.tabs.map((t) => t.to), ...(g.also ?? [])]) {
      if (inTab(pathname, to) && (!best || to.length > best.len)) best = { group: g, len: to.length }
    }
  }
  return best?.group
}

export function titleFor(pathname: string): string {
  return groupFor(pathname)?.label ?? 'VLM Control'
}

/** Abas a mostrar no topo: só nas páginas principais da área (não em telas de detalhe, como a leitura de um livro). */
export function tabsFor(pathname: string): MenuTab[] {
  const g = groupFor(pathname)
  if (!g || g.tabs.length < 2) return []
  return g.tabs.some((t) => t.to === pathname) ? g.tabs : []
}
