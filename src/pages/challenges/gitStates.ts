import type { RepoSnapshot } from './practiceTypes'

/**
 * Linha do tempo do repositório simulado de cada cenário: um estado inicial e uma
 * alteração por comando esperado. Os estados são didáticos, não saída de um Git real.
 */
interface Patch extends Partial<Omit<RepoSnapshot, 'commits'>> {
  commits?: string[]
  /** Novo commit no topo do histórico da branch atual. */
  commit?: string
  /** Linhas acrescentadas às demais informações. */
  more?: string[]
}

interface Timeline {
  start: RepoSnapshot
  steps: Patch[]
}

const repo = (partial: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  branch: 'main', branches: ['main'], commits: [], staged: [], modified: [], untracked: [], extras: [], ...partial,
})
const empty = repo({ branch: '', branches: [] })
const fresh = repo()
const notas = (hash: string) => repo({ commits: [`${hash} Cria notas de treino`] })
const none: Patch = {}
const alternativa = 'alternativa: c100002 Plano Python (mesma linha de notas.txt)'

const TIMELINES: Record<string, Timeline> = {
  'git-first_steps-1': { start: empty, steps: [none, none] },
  'git-first_steps-2': { start: empty, steps: [{ branch: 'main', branches: ['main'] }, none] },
  'git-first_steps-3': {
    start: fresh,
    steps: [{ more: ['user.name = Aluno de Treino (local)'] }, { more: ['user.email = aluno@example.invalid (local)'] }, none, none],
  },
  'git-first_steps-4': { start: notas('b0a0001'), steps: [{ untracked: ['ideias.txt'] }, none] },
  'git-first_steps-5': {
    start: notas('b0a0001'),
    steps: [{ untracked: ['aprendizado.txt'] }, { untracked: [], staged: ['aprendizado.txt'] }, { staged: [], commit: 'e5f0001 Registra aprendizado' }, none],
  },
  'git-basic-1': { start: repo({ commits: ['a100002 Amplia notas', 'a100001 Cria notas de treino'] }), steps: [none, none] },
  'git-basic-2': {
    start: notas('b2a0001'),
    steps: [{ modified: ['notas.txt'] }, none, { modified: [], staged: ['notas.txt'] }, none, none],
  },
  'git-basic-3': {
    start: notas('b3a0001'),
    steps: [
      { untracked: ['resumo.txt'] },
      { untracked: ['resumo.txt', 'rascunho.txt'] },
      { untracked: ['rascunho.txt'], staged: ['resumo.txt'] },
      { staged: [], commit: 'b3a0002 Adiciona resumo' },
      none,
    ],
  },
  'git-basic-4': {
    start: notas('b4a0001'),
    steps: [
      { branch: 'estudo/python', branches: ['main', 'estudo/python'] },
      { modified: ['notas.txt'] },
      { modified: [], staged: ['notas.txt'] },
      { staged: [], commit: 'b4a0002 Planeja estudo de Python', extras: ['main continua em b4a0001'] },
      none,
    ],
  },
  'git-basic-5': {
    start: repo({
      branch: 'melhoria', branches: ['main', 'melhoria'], commits: ['a500002 Melhora notas', 'a500001 Cria notas de treino'],
      extras: ['main está em a500001, um commit atrás de melhoria'],
    }),
    steps: [
      { branch: 'main', commits: ['a500001 Cria notas de treino'] },
      { commits: ['a500002 Melhora notas', 'a500001 Cria notas de treino'], extras: ['main e melhoria apontam para a500002'] },
      none,
    ],
  },
  'git-intermediate-1': {
    start: repo({ branches: ['main', 'alternativa'], commits: ['c100003 Plano SQL', 'c100001 Cria notas de treino'], extras: [alternativa] }),
    steps: [
      { modified: ['notas.txt (com marcadores de conflito)'], extras: [alternativa, 'merge em andamento: CONFLICT (content) em notas.txt'] },
      { modified: ['notas.txt (resolvido: Estudar Python, Estudar SQL)'] },
      { modified: [], staged: ['notas.txt'], extras: [alternativa, 'merge em andamento: conflito resolvido, falta o commit'] },
      { staged: [], commit: 'c100004 Combina planos de estudo (merge com dois pais)', extras: [alternativa] },
      none,
    ],
  },
  'git-intermediate-2': {
    start: notas('d200001'),
    steps: [
      { modified: ['notas.txt'] },
      { modified: [], extras: ['stash@{0}: Pausa do exercício'] },
      none,
      none,
      { modified: ['notas.txt'] },
      none,
    ],
  },
  'git-intermediate-3': {
    start: repo({ commits: ['d300002 Adiciona anotacao incorreta', 'd300001 Cria notas de treino'] }),
    steps: [{ commit: 'd300003 Revert "Adiciona anotacao incorreta"' }, none, none],
  },
  'git-intermediate-4': {
    start: notas('d400001'),
    steps: [
      { more: ['remoto-treino.git (bare) criado na pasta irmã'] },
      { more: ['origin → ../remoto-treino.git'] },
      { more: ['main acompanha origin/main'] },
      none,
      none,
    ],
  },
  'git-intermediate-5': {
    start: notas('d500001'),
    steps: [
      { untracked: ['debug.log'] },
      { untracked: ['debug.log', '.gitignore'] },
      { untracked: ['debug.log'], staged: ['.gitignore'] },
      { staged: [], untracked: [], commit: 'd500002 Ignora logs gerados', extras: ['debug.log ignorado pela regra *.log'] },
      none,
    ],
  },
  'git-advanced-1': {
    start: repo({ branches: ['main', 'experimento'], commits: ['f100001 Cria notas de treino'], extras: ['experimento: f100002 Cria guia (tag guia-pronto)'] }),
    steps: [{ commit: 'f100003 Cria guia (cópia de f100002)' }, none, none, none],
  },
  'git-advanced-2': {
    start: repo({
      branch: 'recurso-local', branches: ['main', 'recurso-local'], commits: ['a200002 Cria recurso', 'a200001 Cria notas de treino'],
      extras: ['main: a200003 Atualiza base (à frente da base comum a200001)'],
    }),
    steps: [
      { commits: ['a200004 Cria recurso (reaplicado)', 'a200003 Atualiza base', 'a200001 Cria notas de treino'] },
      none, none, none,
    ],
  },
  'git-advanced-3': {
    start: repo({
      commits: ['a300005 Amplia guia', 'a300004 Introduz regressao', 'a300003 Inclui guia', 'a300002 Estado saudavel (tag inicio-saudavel)', 'a300001 Cria notas de treino'],
    }),
    steps: [
      { extras: ['bisect em andamento: bom = inicio-saudavel, ruim = HEAD'] },
      { extras: ['bisect: primeiro commit ruim = a300004 Introduz regressao'] },
      { extras: ['bisect encerrado; HEAD voltou para main'] },
    ],
  },
  'git-advanced-4': {
    start: repo({ commits: ['a400001 Cria notas de treino'], extras: ['reflog: c0ffee2 HEAD@{1} commit: Descoberta em detached HEAD'] }),
    steps: [
      none,
      { branches: ['main', 'recuperada'], more: ['recuperada → c0ffee2 Descoberta em detached HEAD'] },
      none,
      none,
    ],
  },
  'git-advanced-5': {
    start: repo({ commits: ['a500001 Cria notas de treino'], extras: ['worktree: pasta inicial [main]'] }),
    steps: [
      { branches: ['main', 'revisar-notas'], more: ['worktree: treino-worktree-notas [revisar-notas]'] },
      { modified: ['treino-worktree-notas/notas.txt'] },
      { modified: [], staged: ['treino-worktree-notas/notas.txt'] },
      { staged: [], more: ['revisar-notas: a500002 Revisa notas (main não mudou)'] },
      none,
      none,
    ],
  },
  'git-first_steps-5~v1': {
    start: repo({ commits: ['d1a0001 Cria agenda de treino'] }),
    steps: [{ untracked: ['diario.txt'] }, { untracked: [], staged: ['diario.txt'] }, { staged: [], commit: 'd1a0002 Registra diario' }, none],
  },
  'git-basic-3~v1': {
    start: repo({ commits: ['d3a0001 Cria agenda de treino'] }),
    steps: [
      { untracked: ['anotacoes.txt'] },
      { untracked: ['anotacoes.txt', 'relatorio.txt'] },
      { untracked: ['anotacoes.txt'], staged: ['relatorio.txt'] },
      { staged: [], commit: 'd3a0002 Adiciona relatorio' },
      none,
    ],
  },
  'git-basic-4~v1': {
    start: repo({ commits: ['d4a0002 Amplia notas', 'd4a0001 Cria notas de treino'] }),
    steps: [
      { branch: 'estudo/sql', branches: ['main', 'estudo/sql'] },
      { modified: ['notas.txt'] },
      { modified: [], staged: ['notas.txt'] },
      { staged: [], commit: 'd4a0003 Planeja estudo de SQL', extras: ['main continua em d4a0002'] },
      none,
    ],
  },
}

function apply(state: RepoSnapshot, patch: Patch): RepoSnapshot {
  const { commit, more, commits, ...fields } = patch
  const next: RepoSnapshot = { ...state, ...fields }
  if (commits) next.commits = commits
  if (commit) next.commits = [commit, ...next.commits]
  if (more) next.extras = [...next.extras, ...more]
  return next
}

const cache = new Map<string, RepoSnapshot[]>()

/** Estados do repositório: índice 0 é o inicial e o índice i é o estado depois do comando i. */
export function repoTimeline(id: string): RepoSnapshot[] | undefined {
  const known = cache.get(id)
  if (known) return known
  const timeline = TIMELINES[id]
  if (!timeline) return undefined
  const states = [timeline.start]
  for (const patch of timeline.steps) states.push(apply(states[states.length - 1], patch))
  cache.set(id, states)
  return states
}

export const timelineSteps = (id: string) => TIMELINES[id]?.steps.length

const subtract = (a: string[], b: string[]) => a.filter((item) => !b.includes(item))

/** Descreve em português o que mudou entre dois estados. */
export function describeChanges(before: RepoSnapshot, after: RepoSnapshot): string[] {
  const changes: string[] = []
  if (before.branch !== after.branch) {
    changes.push(!before.branch ? `Repositório criado na branch ${after.branch}.` : `Branch atual: ${before.branch} → ${after.branch}.`)
  }
  for (const name of subtract(after.branches, before.branches)) changes.push(`Nova branch: ${name}.`)
  for (const name of subtract(before.branches, after.branches)) changes.push(`Branch removida: ${name}.`)
  if (before.branch === after.branch) {
    for (const line of subtract(after.commits, before.commits)) changes.push(`Novo commit: ${line}.`)
    for (const line of subtract(before.commits, after.commits)) changes.push(`Commit deixa de aparecer no histórico: ${line}.`)
  } else if (before.branch) {
    changes.push(`O histórico exibido passa a ser o de ${after.branch}.`)
  }
  for (const file of subtract(after.untracked, before.untracked)) changes.push(`Arquivo novo, ainda não rastreado: ${file}.`)
  for (const file of subtract(before.untracked, after.untracked)) changes.push(`Deixa de ser não rastreado: ${file}.`)
  for (const file of subtract(after.modified, before.modified)) changes.push(`Alteração ainda não preparada: ${file}.`)
  for (const file of subtract(before.modified, after.modified)) changes.push(`Deixa de estar só modificado: ${file}.`)
  for (const file of subtract(after.staged, before.staged)) changes.push(`Preparado para o próximo commit: ${file}.`)
  for (const file of subtract(before.staged, after.staged)) changes.push(`Sai da área de preparação: ${file}.`)
  for (const line of subtract(after.extras, before.extras)) changes.push(`Novo: ${line}.`)
  for (const line of subtract(before.extras, after.extras)) changes.push(`Deixa de valer: ${line}.`)
  return changes.length ? changes : ['Nenhuma mudança no repositório: é um comando de consulta.']
}
