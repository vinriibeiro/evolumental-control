import type { PyMessage } from './python.worker'

export interface PyRun {
  results?: Array<{ ok: boolean; got: string }>
  error?: string
}

/** Mundo: valor devolvido pela função em cada caso (ou o erro daquele caso). */
export interface PyCollect {
  results?: Array<{ value?: unknown; error?: string }>
  error?: string
}

/** Exemplo da ficha de campo: saída impressa. */
export interface PyExec {
  stdout?: string
  error?: string
}

export type PyStatus = 'loading' | 'running'

let worker: Worker | null = null

const getWorker = () => (worker ??= new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' }))

function reset() {
  worker?.terminate()
  worker = null
}

/**
 * Envia um pedido ao worker. O worker é reaproveitado (o Pyodide leva alguns
 * segundos para carregar na primeira vez). Prazos: 90 s para carregar o
 * ambiente e 10 s para executar; estourou, o worker é recriado.
 */
function call<T extends object>(msg: PyMessage, onStatus?: (s: PyStatus) => void): Promise<T & { error?: string }> {
  return new Promise((resolve) => {
    const w = getWorker()
    let timer: ReturnType<typeof setTimeout>
    const arm = (ms: number, message: string) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        reset()
        resolve({ error: message } as T & { error?: string })
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
      const { status: _status, ...rest } = e.data as { status: string } & T
      resolve(rest as T & { error?: string })
    }
    w.onerror = (e) => {
      clearTimeout(timer)
      reset()
      resolve({ error: e.message || 'Falha no ambiente Python.' } as T & { error?: string })
    }
    w.postMessage(msg)
  })
}

/** Laboratório clássico: executa o código com os casos de teste (com gabarito). */
export async function runPython(
  input: { code: string; entry: string; tests: Array<{ args: unknown[]; expected: unknown }>; packages?: string[] },
  onStatus?: (s: PyStatus) => void,
): Promise<PyRun> {
  const r = await call<PyRun>({ mode: 'tests', code: input.code, entry: input.entry, tests: input.tests, packages: input.packages ?? [] }, onStatus)
  return r.error ? { error: r.error } : { results: r.results }
}

/** Mundo: executa a função em cada caso e devolve só os valores (o gabarito é conferido por hash). */
export async function collectPython(input: { code: string; entry: string; cases: unknown[][]; packages?: string[] }, onStatus?: (s: PyStatus) => void): Promise<PyCollect> {
  const r = await call<PyCollect>({ mode: 'collect', code: input.code, entry: input.entry, tests: input.cases, packages: input.packages ?? [] }, onStatus)
  return r.error ? { error: r.error } : { results: r.results }
}

/** Ficha de campo: roda um exemplo e devolve o que foi impresso. */
export async function execPython(code: string, onStatus?: (s: PyStatus) => void, packages: string[] = []): Promise<PyExec> {
  const r = await call<PyExec>({ mode: 'exec', code, packages }, onStatus)
  return r.error ? { error: r.error, stdout: r.stdout } : { stdout: r.stdout ?? '' }
}
