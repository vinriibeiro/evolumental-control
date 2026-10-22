// Worker isolado para o laboratório de SQL: uma consulta travada (ex.: CTE
// recursiva infinita) não congela a página — o worker é encerrado por tempo.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { compareResults, runQuery } from './sqlCore'

const ready = initSqlJs({ locateFile: () => wasmUrl })

self.onmessage = async (e: MessageEvent<{ dataset: string; query: string; solution: string | null; orderMatters: boolean }>) => {
  const { dataset, query, solution, orderMatters } = e.data
  try {
    const SQL = await ready
    const result = runQuery(SQL, dataset, query)
    const check = solution ? compareResults(runQuery(SQL, dataset, solution), result, orderMatters) : null
    self.postMessage({ ok: true, result, check })
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message })
  }
}
