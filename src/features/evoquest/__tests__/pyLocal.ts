// Executa Python de verdade (CPython local) com o mesmo harness do Pyodide,
// no modo "collect" do mundo: devolve os valores de cada caso. Os testes que
// dependem dele são pulados quando não há Python na máquina.
//   Variáveis: PYTHON (executável; padrão "python").
import { spawnSync } from 'node:child_process'
import { HARNESS } from '@/game/lab/pyHarness'
import type { PyCollect } from '@/game/lab/runPython'

const PY = process.env.PYTHON ?? 'python'
const probe = spawnSync(PY, ['-I', '-c', 'import sys; print(sys.version_info[:2])'], { encoding: 'utf8' })
export const PYTHON_AVAILABLE = probe.status === 0

export function collectLocal(code: string, entry: string, cases: unknown[][]): PyCollect {
  const script = `${HARNESS}\nprint(_collect(${JSON.stringify(code)}, ${JSON.stringify(entry)}, ${JSON.stringify(JSON.stringify(cases))}))`
  const r = spawnSync(PY, ['-I', '-c', script], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 60_000 })
  if (r.status !== 0) throw new Error(`python falhou: ${r.stderr}`)
  return JSON.parse(r.stdout) as PyCollect
}
