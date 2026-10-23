// Worker isolado para o laboratório de Python (Pyodide = CPython em WebAssembly).
// O código roda na sandbox do navegador, sem acesso à página nem aos dados do
// app. O worker é encerrado se passar do tempo limite (ver runPython.ts).
//
// Modos: 'tests' (laboratório clássico: compara com os casos esperados),
// 'collect' (mundo: devolve os valores de cada caso; o gabarito é um hash) e
// 'exec' (exemplo da ficha de campo: devolve o que foi impresso).
import { HARNESS } from './pyHarness'

export const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'

interface PyodideLike {
  loadPackage(names: string[]): Promise<void>
  runPythonAsync(code: string): Promise<unknown>
  globals: { set(name: string, value: unknown): void }
}

export type PyMessage = { code: string; packages: string[] } & ({ mode?: 'tests'; entry: string; tests: unknown[] } | { mode: 'collect'; entry: string; tests: unknown[][] } | { mode: 'exec' })

let pyodide: Promise<PyodideLike> | null = null

function load(): Promise<PyodideLike> {
  if (!pyodide) {
    pyodide = (async () => {
      const mod = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as { loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike> }
      return mod.loadPyodide({ indexURL: PYODIDE_URL })
    })()
    pyodide.catch(() => (pyodide = null))
  }
  return pyodide
}

self.onmessage = async (e: MessageEvent<PyMessage>) => {
  try {
    self.postMessage({ status: 'loading' })
    const py = await load()
    if (e.data.packages.length) await py.loadPackage(e.data.packages)
    self.postMessage({ status: 'running' })
    await py.runPythonAsync(HARNESS)
    py.globals.set('_src', e.data.code)
    let raw: string
    if (e.data.mode === 'exec') {
      raw = (await py.runPythonAsync('_exec(_src)')) as string
    } else {
      py.globals.set('_entry', e.data.entry)
      py.globals.set('_tests', JSON.stringify(e.data.tests))
      raw = (await py.runPythonAsync(e.data.mode === 'collect' ? '_collect(_src, _entry, _tests)' : '_run(_src, _entry, _tests)')) as string
    }
    self.postMessage({ status: 'done', ...JSON.parse(raw) })
  } catch (err) {
    self.postMessage({ status: 'done', error: (err as Error).message })
  }
}
