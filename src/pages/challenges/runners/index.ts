import type { Challenge } from '../catalog'
import { pythonCases } from './pythonCases'
import { runSandbox } from './sandbox'
import { sqlSetup, sqlVariant } from './sqlCases'

export interface PracticeResult {
  passed: boolean
  summary: string
  cases: Array<{ label: string; passed: boolean; feedback: string }>
  output?: string
}

export async function runPractice(challenge: Challenge, draft: string, signal?: AbortSignal): Promise<PracticeResult> {
  if (signal?.aborted) throw new DOMException('Execução cancelada.', 'AbortError')
  if (!draft.trim()) throw new Error('Escreva uma solução antes de executar.')
  if (draft.length > 40_000) throw new Error('O código excedeu o limite de 40.000 caracteres.')
  const { id, track } = challenge
  if (track === 'python') {
    const tests = pythonCases[id]
    if (!tests?.length) throw new Error('Este exercício ainda não possui verificações executáveis.')
    return runSandbox({ id, track, draft, tests }, signal)
  }
  if (track === 'sql') {
    return runSandbox({
      id,
      track,
      draft,
      setup: sqlSetup(challenge),
      variant: sqlVariant(id),
      reference: challenge.solution,
    }, signal)
  }
  throw new Error('A execução deste exercício é feita no ambiente de Git.')
}
