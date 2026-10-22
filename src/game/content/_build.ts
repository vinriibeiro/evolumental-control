// Construtores compactos para escrever conteúdo. Todo desafio continua sendo
// um objeto `Challenge` comum (ver ../types.ts).
import type { Challenge, Difficulty, StepChallenge } from '../types'

type Extra = Partial<Pick<Challenge, 'whyWrong' | 'hint' | 'context' | 'table' | 'code' | 'seconds' | 'tags' | 'boss' | 'calc' | 'v'>>
type Common = [id: string, topic: string, difficulty: Difficulty, prompt: string]

export const mcq = (...[id, topic, difficulty, prompt, options, answer, explanation, extra]: [...Common, string[], number, string, Extra?]): Challenge => ({
  type: 'mcq', id, topic, difficulty, prompt, options, answer, explanation, ...extra,
})
export const tf = (...[id, topic, difficulty, prompt, answer, explanation, extra]: [...Common, boolean, string, Extra?]): Challenge => ({
  type: 'tf', id, topic, difficulty, prompt, answer, explanation, ...extra,
})
export const fill = (...[id, topic, difficulty, prompt, template, blanks, explanation, extra]: [...Common, string, Array<string[] | { accept: string[]; options?: string[] }>, string, (Extra & { caseSensitive?: boolean })?]): Challenge => ({
  type: 'fill', id, topic, difficulty, prompt, template, blanks: blanks.map((b) => (Array.isArray(b) ? { accept: b } : b)), explanation, ...extra,
})
export const match = (...[id, topic, difficulty, prompt, pairs, explanation, extra]: [...Common, Array<[string, string]>, string, Extra?]): Challenge => ({
  type: 'match', id, topic, difficulty, prompt, pairs, explanation, ...extra,
})
export const order = (...[id, topic, difficulty, prompt, items, explanation, extra]: [...Common, string[], string, Extra?]): Challenge => ({
  type: 'order', id, topic, difficulty, prompt, items, explanation, ...extra,
})
export const cat = (...[id, topic, difficulty, prompt, categories, items, explanation, extra]: [...Common, string[], Array<[string, number]>, string, Extra?]): Challenge => ({
  type: 'categorize', id, topic, difficulty, prompt, categories, items: items.map(([text, c]) => ({ text, cat: c })), explanation, ...extra,
})
export const err = (...[id, topic, difficulty, prompt, tokens, answer, fix, explanation, extra]: [...Common, string[], number, string, string, Extra?]): Challenge => ({
  type: 'find_error', id, topic, difficulty, prompt, tokens, answer, fix, explanation, ...extra,
})
export const num = (...[id, topic, difficulty, prompt, answer, explanation, extra]: [...Common, number, string, (Extra & { tolerance?: number; unit?: string })?]): Challenge => ({
  type: 'numeric', id, topic, difficulty, prompt, answer, explanation, ...extra,
})
export const short = (...[id, topic, difficulty, prompt, accept, explanation, extra]: [...Common, string[], string, (Extra & { caseSensitive?: boolean; accentSensitive?: boolean })?]): Challenge => ({
  type: 'short', id, topic, difficulty, prompt, accept, explanation, ...extra,
})
export const code = (...[id, topic, difficulty, prompt, template, blanks, explanation, extra]: [...Common, string, string[][], string, (Extra & { caseSensitive?: boolean })?]): Challenge => ({
  type: 'code_complete', id, topic, difficulty, prompt, template, blanks: blanks.map((accept) => ({ accept })), explanation, ...extra,
})
export const out = (...[id, topic, difficulty, prompt, source, lang, accept, explanation, extra]: [...Common, string, 'python' | 'sql' | 'dax' | 'm' | 'text', string[], string, Extra?]): Challenge => ({
  type: 'code_output', id, topic, difficulty, prompt, code: { lang, source }, accept, explanation, ...extra,
})
export const multi = (...[id, topic, difficulty, prompt, steps, explanation, extra]: [...Common, StepChallenge[], string, Extra?]): Challenge => ({
  type: 'multistep', id, topic, difficulty, prompt, steps, explanation, ...extra,
})
export const listen = (...[id, topic, difficulty, prompt, say, options, answer, explanation, extra]: [...Common, string, string[], number, string, (Extra & { translation?: string })?]): Challenge => ({
  type: 'listen', id, topic, difficulty, prompt, say, lang: 'en-US', options, answer, explanation, ...extra,
})
export const sqlLab = (...[id, topic, difficulty, prompt, solution, explanation, extra]: [...Common, string, string, (Extra & { orderMatters?: boolean; starter?: string; dataset?: string })?]): Challenge => ({
  type: 'sql', id, topic, difficulty, prompt, dataset: extra?.dataset ?? 'loja', solution, explanation, seconds: 240, ...extra,
})
export const pyLab = (
  ...[id, topic, difficulty, prompt, starter, solution, entry, tests, explanation, extra]: [...Common, string, string, string, Array<{ args: unknown[]; expected: unknown }>, string, (Extra & { packages?: string[] })?]
): Challenge => ({
  type: 'python', id, topic, difficulty, prompt, starter, solution, entry, tests, explanation, seconds: 300, ...extra,
})

/** Etapa de um desafio multietapas. */
export const step = {
  mcq: (id: string, prompt: string, options: string[], answer: number, explanation: string): StepChallenge => ({ type: 'mcq', id, topic: '', difficulty: 1, prompt, options, answer, explanation }),
  num: (id: string, prompt: string, answer: number, explanation: string, tolerance?: number): StepChallenge => ({ type: 'numeric', id, topic: '', difficulty: 1, prompt, answer, tolerance, explanation }),
}
