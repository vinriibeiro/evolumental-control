import { BookOpen, CalendarCheck, Library, Route, Settings, Target, Timer, type LucideIcon } from 'lucide-react'

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

/**
 * VLM Control 2.0: seis áreas. Tudo o que existia continua acessível, agora dentro da área a que pertence:
 * calendário, cronograma, rotinas, revisões e ciclo ficam em Meu Planejamento; matérias, laboratório, flashcards,
 * questões e o plano CGU em Trilhas de Estudo; livros, cursos, áudios e vídeos na Biblioteca.
 */
export const MENU: MenuGroup[] = [
  {
    label: 'Meu Planejamento',
    short: 'Planejar',
    icon: CalendarCheck,
    to: '/',
    tabs: [
      { to: '/', label: 'Planejamento' },
      { to: '/rotinas', label: 'Rotinas' },
      { to: '/revisoes', label: 'Revisões' },
      { to: '/ciclos', label: 'Ciclo de estudos' },
    ],
  },
  {
    label: 'Trilhas de Estudo',
    short: 'Trilhas',
    icon: Route,
    to: '/trilhas',
    tabs: [
      { to: '/trilhas', label: 'Trilhas' },
      { to: '/projetos', label: 'Projetos' },
      { to: '/laboratorio', label: 'Laboratório' },
      { to: '/materias', label: 'Matérias' },
      { to: '/flashcards', label: 'Flashcards' },
      { to: '/banco-de-questoes', label: 'Questões' },
      { to: '/catalogo', label: 'Outras trilhas' },
    ],
    also: ['/cgu', '/diagnostico'],
  },
  {
    label: 'Biblioteca',
    short: 'Biblioteca',
    icon: Library,
    to: '/biblioteca',
    tabs: [
      { to: '/biblioteca', label: 'Estante' },
      { to: '/cursos', label: 'Cursos' },
      { to: '/audios', label: 'Áudios' },
      { to: '/videos', label: 'Vídeos' },
    ],
    also: ['/livros', '/ingles'],
  },
  {
    label: 'Sala de Estudos',
    short: 'Estudar',
    icon: Timer,
    to: '/sala',
    tabs: [
      { to: '/sala', label: 'Sessão' },
      { to: '/sala/historico', label: 'Histórico' },
    ],
    also: ['/cronometro'],
  },
  {
    label: 'Metas e Evolução',
    short: 'Evolução',
    icon: Target,
    to: '/metas',
    tabs: [
      { to: '/metas', label: 'Metas' },
      { to: '/evolucao', label: 'Evolução' },
      { to: '/relatorio-semanal', label: 'Relatório semanal' },
      { to: '/questoes', label: 'Exercícios' },
    ],
    also: ['/relatorios'],
  },
  { label: 'Configurações', short: 'Ajustes', icon: Settings, to: '/configuracoes', tabs: [{ to: '/configuracoes', label: 'Configurações' }] },
]

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Todas as páginas alcançáveis pela busca (Ctrl K): uma entrada por aba das seis áreas, mais o plano CGU. */
export const NAV: NavItem[] = [
  ...MENU.flatMap((g) => g.tabs.map((t) => ({ to: t.to, label: t.to === g.to ? g.label : t.label, icon: g.icon }))),
  { to: '/cgu', label: 'Plano CGU 2026', icon: BookOpen },
  { to: '/ingles', label: 'Inglês', icon: BookOpen },
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
