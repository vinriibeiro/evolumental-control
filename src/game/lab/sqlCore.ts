// Execução e comparação de consultas SQL (SQLite via sql.js). Sem dependência
// de navegador: os testes usam as mesmas funções no Node.
import type { SqlJsStatic } from 'sql.js'

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
}

export const MAX_ROWS = 500

/** Executa em um banco NOVO em memória: nada persiste entre execuções. */
export function runQuery(SQL: SqlJsStatic, dataset: string, query: string): QueryResult {
  const db = new SQL.Database()
  try {
    db.exec(dataset)
    // Instrução por instrução: db.exec() omite resultados sem linhas, mas um
    // SELECT que não encontra nada é uma resposta válida (0 linhas).
    let last: QueryResult | null = null
    for (const stmt of db.iterateStatements(query)) {
      try {
        const columns = stmt.getColumnNames()
        const rows: unknown[][] = []
        while (rows.length < MAX_ROWS && stmt.step()) rows.push(stmt.get())
        if (columns.length) last = { columns, rows }
      } finally {
        stmt.free()
      }
    }
    if (!last) throw new Error('A consulta não retornou um resultado. Use SELECT para consultar os dados.')
    return last
  } finally {
    db.close()
  }
}

const norm = (v: unknown) => (typeof v === 'number' ? Number(v.toFixed(6)) : v == null ? null : String(v))
const key = (row: unknown[]) => JSON.stringify(row.map(norm))

/** Compara pelo CONTEÚDO (nomes de colunas e apelidos não importam). */
export function compareResults(expected: QueryResult, actual: QueryResult, orderMatters = false): { matches: boolean; reason?: string } {
  if (expected.columns.length !== actual.columns.length)
    return { matches: false, reason: `O resultado esperado tem ${expected.columns.length} coluna(s); o seu tem ${actual.columns.length}.` }
  if (expected.rows.length !== actual.rows.length)
    return { matches: false, reason: `O resultado esperado tem ${expected.rows.length} linha(s); o seu tem ${actual.rows.length}.` }
  const a = expected.rows.map(key)
  const b = actual.rows.map(key)
  const sa = [...a].sort()
  const sb = [...b].sort()
  const sameSet = sa.every((k, n) => k === sb[n])
  if (!sameSet) return { matches: false, reason: 'Os valores retornados diferem do esperado.' }
  if (orderMatters && a.some((k, n) => k !== b[n])) return { matches: false, reason: 'As linhas estão certas, mas a ordem não. Revise o ORDER BY.' }
  return { matches: true }
}
