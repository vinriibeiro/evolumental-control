import type { QueryResult } from './sqlCore'

export interface SqlRun {
  result?: QueryResult
  check?: { matches: boolean; reason?: string } | null
  error?: string
}

/** Executa no worker com limite de tempo; um worker novo (e banco novo) por execução. */
export function runSql(dataset: string, query: string, solution: string | null, orderMatters = false, timeoutMs = 5000): Promise<SqlRun> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module' })
    const done = (r: SqlRun) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(r)
    }
    const timer = setTimeout(() => done({ error: `A consulta passou de ${timeoutMs / 1000} s e foi interrompida.` }), timeoutMs)
    worker.onmessage = (e) => done(e.data.ok ? { result: e.data.result, check: e.data.check } : { error: e.data.error })
    worker.onerror = (e) => done({ error: e.message || 'Não foi possível iniciar o SQLite.' })
    worker.postMessage({ dataset, query, solution, orderMatters })
  })
}
