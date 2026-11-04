/** Tipos compartilhados pelos avaliadores (Python, SQL e Git) e pela interface de feedback. */

export interface ResultTable {
  columns: string[]
  rows: string[][]
  /** Total de linhas da consulta; `rows` guarda só uma amostra. */
  total: number
}

export interface RepoSnapshot {
  /** Branch atual. Vazio quando a pasta ainda não é um repositório. */
  branch: string
  branches: string[]
  /** Histórico da branch atual, do mais recente para o mais antigo. */
  commits: string[]
  staged: string[]
  modified: string[]
  untracked: string[]
  /** Outros estados relevantes: stash, remotos, merge em andamento, worktrees. */
  extras: string[]
}

export interface GitDetail {
  step: number
  total: number
  /** Comando digitado nesta etapa, quando existe. */
  command?: string
  /** Estado do repositório simulado antes do comando. */
  before?: RepoSnapshot
  /** Estado esperado depois do comando correto. */
  after?: RepoSnapshot
  /** Como arquivos, commits e branches mudam nesta etapa. */
  changes: string[]
}

export interface CaseDetail {
  /** Rótulo curto do tipo de problema: sintaxe, coluna ausente, ordem… */
  kind?: string
  line?: number
  code?: string
  /** Explicação em português do erro ou da divergência. */
  explanation?: string
  /** Mensagem original da ferramenta, para consulta. */
  original?: string
  input?: string
  got?: string
  expected?: string
  gotTable?: ResultTable
  expectedTable?: ResultTable
  repo?: GitDetail
}

export interface PracticeCase {
  label: string
  passed: boolean
  feedback: string
  detail?: CaseDetail
}

export interface PracticeResult {
  passed: boolean
  summary: string
  cases: PracticeCase[]
  output?: string
}

const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : undefined
const list = (value: unknown, count: number, max: number) =>
  Array.isArray(value) ? value.slice(0, count).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, max)) : []

function table(value: unknown): ResultTable | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Partial<ResultTable>
  const columns = list(source.columns, 12, 80)
  if (!columns.length || !Array.isArray(source.rows)) return undefined
  const rows = source.rows.slice(0, 8).map((row) => list(row, 12, 80))
  return { columns, rows, total: typeof source.total === 'number' && Number.isFinite(source.total) ? Math.max(0, Math.floor(source.total)) : rows.length }
}

/** Mantém apenas campos conhecidos e com tamanho limitado; o Python do sandbox não é confiável. */
export function sanitizeDetail(value: unknown): CaseDetail | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const detail: CaseDetail = {}
  for (const key of ['kind', 'code', 'explanation', 'original', 'input', 'got', 'expected'] as const) {
    const cleaned = text(source[key], key === 'kind' ? 80 : 1500)
    if (cleaned) detail[key] = cleaned
  }
  if (typeof source.line === 'number' && Number.isInteger(source.line) && source.line > 0) detail.line = source.line
  const gotTable = table(source.gotTable)
  const expectedTable = table(source.expectedTable)
  if (gotTable) detail.gotTable = gotTable
  if (expectedTable) detail.expectedTable = expectedTable
  return Object.keys(detail).length ? detail : undefined
}
