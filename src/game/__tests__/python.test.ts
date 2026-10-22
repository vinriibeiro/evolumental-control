// @vitest-environment node
//
// Valida os gabaritos de Python com um interpretador local (CPython + pandas):
// a saída dos desafios "qual o resultado" e as soluções dos laboratórios.
// Se não houver Python com pandas na máquina, o teste é pulado (o CI do
// navegador usa o Pyodide, com as mesmas regras do harness).
//   Variáveis: PYTHON (executável; padrão "python") e PYTHONPATH.
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import content from '../content/python'
import { HARNESS } from '../lab/pyHarness'

const PY = process.env.PYTHON ?? 'python'
const probe = spawnSync(PY, ['-c', 'import pandas, sys; print(sys.version_info[:2])'], { encoding: 'utf8' })
const available = probe.status === 0

function run(code: string) {
  return spawnSync(PY, ['-c', code], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 60_000 })
}

const all = content.units.flatMap((u) => u.challenges)

describe.skipIf(!available)('gabaritos de Python (CPython local)', () => {
  it('a saída de cada desafio "qual o resultado" confere', () => {
    for (const c of all) {
      if (c.type !== 'code_output' || c.code?.lang !== 'python') continue
      const r = run(c.code.source)
      expect(r.status, `${c.id}: ${r.stderr}`).toBe(0)
      expect(r.stdout.replace(/\r/g, '').trim(), c.id).toBe(c.accept[0])
    }
  })

  it('as soluções dos laboratórios passam em todos os testes e o código inicial não', () => {
    for (const c of all) {
      if (c.type !== 'python') continue
      const exec = (src: string) => {
        const r = run(`${HARNESS}\nprint(_run(${JSON.stringify(src)}, ${JSON.stringify(c.entry)}, ${JSON.stringify(JSON.stringify(c.tests))}))`)
        expect(r.status, `${c.id}: ${r.stderr}`).toBe(0)
        return JSON.parse(r.stdout) as { results?: Array<{ ok: boolean; got: string }>; error?: string }
      }
      const good = exec(c.solution)
      expect(good.error, c.id).toBeUndefined()
      expect(good.results!.every((t) => t.ok), `${c.id}: ${JSON.stringify(good.results)}`).toBe(true)
      const starter = exec(c.starter)
      expect(starter.error != null || !starter.results!.every((t) => t.ok), `${c.id}: o código inicial já passa`).toBe(true)
    }
  })
})
