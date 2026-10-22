export interface PyRun {
  results?: Array<{ ok: boolean; got: string }>
  error?: string
}

let worker: Worker | null = null

const getWorker = () => (worker ??= new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' }))

function reset() {
  worker?.terminate()
  worker = null
}

/**
 * Executa o código com os casos de teste. O worker é reaproveitado (o Pyodide
 * leva alguns segundos para carregar na primeira vez). Prazos: 90 s para
 * carregar o ambiente e 10 s para executar; estourou, o worker é recriado.
 */
export function runPython(
  input: { code: string; entry: string; tests: Array<{ args: unknown[]; expected: unknown }>; packages?: string[] },
  onStatus?: (s: 'loading' | 'running') => void,
): Promise<PyRun> {
  return new Promise((resolve) => {
    const w = getWorker()
    let timer: ReturnType<typeof setTimeout>
    const arm = (ms: number, message: string) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        reset()
        resolve({ error: message })
      }, ms)
    }
    arm(90_000, 'Não foi possível carregar o Python. Verifique a conexão e tente de novo.')
    w.onmessage = (e) => {
      if (e.data.status === 'loading') return onStatus?.('loading')
      if (e.data.status === 'running') {
        onStatus?.('running')
        return arm(10_000, 'O código passou de 10 s e foi interrompido (laço infinito?).')
      }
      clearTimeout(timer)
      resolve(e.data.error ? { error: e.data.error } : { results: e.data.results })
    }
    w.onerror = (e) => {
      clearTimeout(timer)
      reset()
      resolve({ error: e.message || 'Falha no ambiente Python.' })
    }
    w.postMessage({ code: input.code, entry: input.entry, tests: input.tests, packages: input.packages ?? [] })
  })
}
