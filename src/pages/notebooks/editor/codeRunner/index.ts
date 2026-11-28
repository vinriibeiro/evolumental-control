import { runSandbox } from './sandbox'

export interface PracticeResult {
  passed: boolean
  summary: string
  cases: Array<{ label: string; passed: boolean; feedback: string }>
  output?: string
}

export async function runNotebookSnippet(language: 'python' | 'sql', code: string, signal?: AbortSignal): Promise<PracticeResult> {
  if (signal?.aborted) throw new DOMException('Execução cancelada.', 'AbortError')
  if (!code.trim()) throw new Error('O bloco de código está vazio.')
  if (code.length > 40_000) throw new Error('O código excedeu o limite de 40.000 caracteres.')
  return runSandbox(
    {
      id: `notebook-${language}`,
      track: language === 'python' ? 'notebook-python' : 'notebook-sql',
      draft: code,
    },
    signal,
  )
}
