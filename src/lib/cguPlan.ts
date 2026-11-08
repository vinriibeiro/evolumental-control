// Estado da trilha CGU (por conta), escolha da próxima tarefa, adiamento e abertura dos materiais nos players do app.
import { CGU_DAILY_LIMIT_MINUTES, CGU_PLAN, CGU_SCORING, CGU_START_DATE, QC_REVISAO, type CguBlock, type CguLink, type CguTask, type QcLink } from '@/content/cguPlan'
import type { CourseView } from '@/lib/courseCatalog'
import type { CourseNode } from '@/types/db'

export interface BlockScore {
  certas: number
  erradas: number
}
export type ScoredBlock = 'P1' | 'P2' | 'P3'

export interface CguState {
  /** Quando a primeira tarefa foi iniciada (YYYY-MM-DD), só para registro: o dia do plano é contado a partir de CGU_START_DATE. */
  startDate: string | null
  /** Tarefa → quando foi concluída (ISO). */
  done: Record<string, string>
  /** Tarefa → dia para onde foi adiada. */
  postponed: Record<string, number>
  /** Tarefa em andamento ("Continuar"). */
  current: string | null
  /** Último resultado lançado por bloco (diagnóstico ou simulado). */
  scores: Partial<Record<ScoredBlock, BlockScore>>
}

export const EMPTY_STATE: CguState = { startDate: null, done: {}, postponed: {}, current: null, scores: {} }
export const TOTAL_DAYS = CGU_PLAN.length

const key = (scope: string) => `vlm.cgu.${scope}`

export function loadState(scope: string): CguState {
  try {
    const raw = JSON.parse(localStorage.getItem(key(scope)) ?? 'null') as Partial<CguState> | null
    return raw && typeof raw === 'object' ? { ...EMPTY_STATE, ...raw, done: raw.done ?? {}, postponed: raw.postponed ?? {}, scores: raw.scores ?? {} } : EMPTY_STATE
  } catch {
    return EMPTY_STATE
  }
}

export function saveState(scope: string, state: CguState): void {
  try {
    localStorage.setItem(key(scope), JSON.stringify(state))
  } catch {
    // armazenamento cheio ou bloqueado: o progresso vale só nesta sessão
  }
}

const dayMs = 86_400_000
const toUtc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** Dia do plano (1..28) para a data de hoje, contado a partir de CGU_START_DATE (07/11/2026): antes disso é o dia 1; depois do 28º, fica no 28. */
export function dayIndexFor(today: string): number {
  const diff = Math.floor((toUtc(today) - toUtc(CGU_START_DATE)) / dayMs)
  return Math.min(TOTAL_DAYS, Math.max(1, diff + 1))
}

export const allTasks = (): CguTask[] => CGU_PLAN.flatMap((d) => d.tasks)
export const taskById = (id: string): CguTask | undefined => allTasks().find((t) => t.id === id)

/** Tarefas do dia: as planejadas (menos as adiadas para outro dia) mais as que foram adiadas para este dia. */
export function tasksForDay(state: Pick<CguState, 'postponed'>, day: number): CguTask[] {
  const own = (CGU_PLAN[day - 1]?.tasks ?? []).filter((t) => (state.postponed[t.id] ?? day) === day)
  const moved = allTasks().filter((t) => t.day !== day && state.postponed[t.id] === day)
  return [...moved, ...own]
}

export const isDone = (state: Pick<CguState, 'done'>, taskId: string) => Boolean(state.done[taskId])

export function pendingTasks(state: CguState, day: number): CguTask[] {
  return tasksForDay(state, day).filter((t) => !isDone(state, t.id))
}

/** Próxima tarefa: a que está em andamento (se ainda pendente neste dia) ou a primeira pendente. */
export function nextTask(state: CguState, day: number): CguTask | null {
  const pending = pendingTasks(state, day)
  return pending.find((t) => t.id === state.current) ?? pending[0] ?? null
}

export function startTask(state: CguState, taskId: string, today: string): CguState {
  return { ...state, startDate: state.startDate ?? today, current: taskId }
}

export function markDone(state: CguState, taskId: string, now = new Date().toISOString()): CguState {
  return { ...state, done: { ...state.done, [taskId]: now }, current: state.current === taskId ? null : state.current }
}

export function undoDone(state: CguState, taskId: string): CguState {
  const done = { ...state.done }
  delete done[taskId]
  return { ...state, done }
}

/** Adia sem perder nada: a tarefa passa a aparecer no dia de destino (até o último dia do plano). */
export function postpone(state: CguState, taskId: string, toDay: number): CguState {
  const target = Math.min(TOTAL_DAYS, Math.max(1, toDay))
  return { ...state, postponed: { ...state.postponed, [taskId]: target }, current: state.current === taskId ? null : state.current }
}

export const minutesOf = (tasks: readonly CguTask[]) => tasks.reduce((s, t) => s + t.minutes, 0)
export const overLimit = (tasks: readonly CguTask[]) => Math.max(0, minutesOf(tasks) - CGU_DAILY_LIMIT_MINUTES)

export function setScore(state: CguState, block: ScoredBlock, score: BlockScore): CguState {
  return { ...state, scores: { ...state.scores, [block]: score } }
}

export interface FocusHint {
  block: ScoredBlock
  /** Pontuação líquida projetada para a prova inteira (certas − erradas, escalada para o nº de itens e o peso). */
  projetado: number
  minimo: number
  /** Positivo = acima do mínimo; negativo = quanto falta. */
  folga: number
  status: 'sem_dados' | 'abaixo' | 'no_limite' | 'ok'
}

/** Projeta a nota líquida por bloco a partir de certas/erradas de uma amostra e ordena do mais urgente ao mais folgado. */
export function suggestFocus(scores: Partial<Record<ScoredBlock, BlockScore>>): FocusHint[] {
  const blocks: ScoredBlock[] = ['P1', 'P2', 'P3']
  const hints = blocks.map((block): FocusHint => {
    const cfg = CGU_SCORING[block]
    const s = scores[block]
    const n = (s?.certas ?? 0) + (s?.erradas ?? 0)
    if (!s || n === 0) return { block, projetado: 0, minimo: cfg.minimo, folga: -cfg.minimo, status: 'sem_dados' }
    const projetado = Math.round(((s.certas - s.erradas) / n) * cfg.itens * cfg.peso)
    const folga = projetado - cfg.minimo
    const margem = cfg.itens * cfg.peso * 0.1
    return { block, projetado, minimo: cfg.minimo, folga, status: folga < 0 ? 'abaixo' : folga < margem ? 'no_limite' : 'ok' }
  })
  const rank = { sem_dados: 1, abaixo: 0, no_limite: 2, ok: 3 }
  return hints.sort((a, b) => rank[a.status] - rank[b.status] || a.folga - b.folga)
}

/** Nota de uma questão discursiva pelo espelho do edital: NQ = NC − fator × NE ÷ TL (zero se negativo). */
export function discursiveScore(parte: 1 | 2, nc: number, ne: number, tl: number): number {
  const cfg = parte === 1 ? CGU_SCORING.P4.q1 : CGU_SCORING.P4.q2
  const conteudo = Math.min(Math.max(0, nc), cfg.pontos)
  if (tl <= 0) return 0
  return Math.max(0, Math.round((conteudo - (cfg.fatorErro * Math.max(0, ne)) / tl) * 100) / 100)
}

export interface ResolvedLink {
  to: string
  external: boolean
  /** O material está no catálogo de Cursos desta conta (abre no player com progresso). */
  inCatalog: boolean
  hint: string | null
  /** Filtros do QConcursos da tarefa (o primeiro é o que “Abrir” usa). */
  links?: QcLink[]
}

const driveUrl = (link: Extract<CguLink, { kind: 'drive' }>) => (link.media === 'folder' ? `https://drive.google.com/drive/folders/${link.driveId}` : `https://drive.google.com/file/d/${link.driveId}/view`)

export interface CourseCatalog {
  views: readonly CourseView[]
  nodes: readonly CourseNode[]
}

/** Converte o link da tarefa em rota do app: aula → /cursos/:id?item=:nodeId; PDF → leitor próprio; sem catálogo → Drive; QConcursos → nova aba. */
export function resolveLink(link: CguLink, courses: CourseCatalog): ResolvedLink {
  if (link.kind === 'route') return { to: link.to, external: false, inCatalog: true, hint: null }
  if (link.kind === 'qc') {
    const hint = link.quantidade > 0 ? `${link.quantidade} questões · banca Cebraspe · ${link.links.length} filtro${link.links.length === 1 ? '' : 's'} do QConcursos` : 'No QConcursos (logado), filtre pelas questões que você errou e refaça-as.'
    return { to: link.links[0]?.url ?? QC_REVISAO.url, external: true, inCatalog: true, hint, links: link.links }
  }
  const fallback: ResolvedLink = { to: driveUrl(link), external: true, inCatalog: false, hint: `Pasta ainda não importada em Cursos (“${link.folder}”). Abre no Drive; importe a pasta em Cursos → Pastas do Drive para abrir aqui com progresso.` }
  // O mesmo arquivo pode aparecer em mais de uma posição do catálogo: prefere a que está disponível e visível.
  const matches = courses.nodes.filter((n) => n.drive_id === link.driveId)
  const node = matches.find((n) => n.status === 'available' && !n.hidden) ?? matches[0]
  if (!node) return fallback
  if (node.status !== 'available') {
    return { ...fallback, hint: `Arquivo indisponível na última atualização do catálogo (${node.status === 'missing' ? 'não encontrado no Drive' : 'pasta excluída da importação'}). Tente abrir no Drive e atualize a pasta em Cursos.` }
  }
  const view = courses.views.find((v) => v.course.id === node.id) ?? courses.views.find((v) => v.items.some((i) => i.id === node.id || i.parent_id === node.id))
  if (!view) return fallback
  const course = encodeURIComponent(view.course.id)
  if (link.media === 'folder') {
    const first = view.course.id === node.id ? view.lessons[0]?.primary : view.items.find((i) => i.parent_id === node.id)
    return { to: first ? `/cursos/${course}?item=${encodeURIComponent(first.id)}` : `/cursos/${course}`, external: false, inCatalog: true, hint: null }
  }
  if (link.media === 'pdf') return { to: `/cursos/${course}/pdf/${encodeURIComponent(node.id)}`, external: false, inCatalog: true, hint: null }
  return { to: `/cursos/${course}?item=${encodeURIComponent(node.id)}`, external: false, inCatalog: true, hint: null }
}

export interface FolderCoverage {
  folderId: string
  folder: string
  /** Arquivos distintos do plano nesta pasta. */
  total: number
  /** Abrem dentro do app (estão no catálogo, disponíveis e visíveis). */
  ok: number
  /** Estão no catálogo, mas indisponíveis (não encontrados, excluídos ou ocultos). */
  missing: number
  /** Não estão no catálogo: a pasta não foi importada ou a importação não trouxe o arquivo. */
  notImported: number
}

export interface MaterialCoverage extends Pick<FolderCoverage, 'total' | 'ok' | 'missing' | 'notImported'> {
  folders: FolderCoverage[]
}

/** Quantos vídeos/PDFs citados no plano abrem dentro do app, por pasta do Drive: mostra o que a importação em Cursos não trouxe. */
export function materialCoverage(courses: CourseCatalog): MaterialCoverage {
  const byFolder = new Map<string, FolderCoverage>()
  const seen = new Set<string>()
  for (const t of allTasks()) {
    const link = t.link
    if (link.kind !== 'drive' || seen.has(link.driveId)) continue
    seen.add(link.driveId)
    const f = byFolder.get(link.folderId) ?? { folderId: link.folderId, folder: link.folder, total: 0, ok: 0, missing: 0, notImported: 0 }
    f.total++
    if (resolveLink(link, courses).inCatalog) f.ok++
    else if (courses.nodes.some((n) => n.drive_id === link.driveId)) f.missing++
    else f.notImported++
    byFolder.set(link.folderId, f)
  }
  const folders = [...byFolder.values()]
  const sum = (k: 'total' | 'ok' | 'missing' | 'notImported') => folders.reduce((s, f) => s + f[k], 0)
  return { folders, total: sum('total'), ok: sum('ok'), missing: sum('missing'), notImported: sum('notImported') }
}

export const BLOCK_LABELS: Record<CguBlock, string> = { P1: 'P1 · básicos', P2: 'P2 · complementares', P3: 'P3 · específicos', P4: 'Discursiva', Geral: 'Revisão' }
export const BLOCK_COLORS: Record<CguBlock, string> = { P1: '#7c6f64', P2: '#2a78d6', P3: '#1f7a4d', P4: '#b4541f', Geral: '#6b7280' }

/** Para onde a tarefa leva: teoria (aulas e apostilas do Drive), questões (QConcursos) ou a discursiva (espelho, no próprio plano). */
export type TaskGroup = 'teoria' | 'questoes' | 'discursiva'
export const GROUP_ORDER: readonly TaskGroup[] = ['teoria', 'questoes', 'discursiva']
export const GROUP_LABELS: Record<TaskGroup, string> = { teoria: 'Teoria', questoes: 'Questões', discursiva: 'Discursiva' }

export function groupOf(task: Pick<CguTask, 'kind'>): TaskGroup {
  if (task.kind === 'aula' || task.kind === 'leitura') return 'teoria'
  if (task.kind === 'discursiva') return 'discursiva'
  return 'questoes'
}

/** Separa as tarefas por grupo, na ordem Teoria → Questões → Discursiva, mantendo a ordem do plano dentro de cada um; grupos vazios somem. */
export function groupTasks<T extends Pick<CguTask, 'kind'>>(tasks: readonly T[]): Array<{ group: TaskGroup; label: string; tasks: T[] }> {
  return GROUP_ORDER.map((group) => ({ group, label: GROUP_LABELS[group], tasks: tasks.filter((t) => groupOf(t) === group) })).filter((g) => g.tasks.length > 0)
}

/** Texto do botão que abre o material da tarefa (o que vai acontecer ao tocar). */
export function openLabel(task: Pick<CguTask, 'kind' | 'link'>): string {
  const { link } = task
  if (link.kind === 'qc') return link.quantidade > 0 ? 'Fazer questões' : 'Refazer erradas'
  if (link.kind === 'route') return task.kind === 'discursiva' ? 'Abrir espelho' : 'Ler no plano'
  return link.media === 'video' ? 'Assistir aula' : link.media === 'pdf' ? 'Ler apostila' : 'Abrir pasta'
}
