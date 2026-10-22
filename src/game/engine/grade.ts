// Correção de desafios. Cada tipo registra seu corretor aqui; adicionar um tipo
// novo não exige mudar os demais nem o restante do jogo.
import type { Challenge, ChallengeType, GradeResult, Response } from '../types'

/** Normaliza texto livre sem mudar o sentido: espaços, aspas e (opcional) caixa/acentos. */
export function normalizeText(s: string, opts: { caseSensitive?: boolean; accentSensitive?: boolean } = {}): string {
  let t = s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;]+$/, '')
  if (!opts.caseSensitive) t = t.toLowerCase()
  if (opts.accentSensitive === false) t = t.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return t
}

/** Código: normaliza espaços ao redor de símbolos para não punir formatação. */
export function normalizeCode(s: string, caseSensitive = true): string {
  const t = s
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),=+\-*/<>[\]{}:;])\s*/g, '$1')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
  return caseSensitive ? t : t.toLowerCase()
}

const ok = (correct: boolean): GradeResult => ({ correct, score: correct ? 1 : 0 })

type Grader<T extends ChallengeType> = (c: Extract<Challenge, { type: T }>, r: Response) => GradeResult

const GRADERS: { [T in ChallengeType]: Grader<T> } = {
  mcq: (c, r) => ok(r.type === 'mcq' && r.choice === c.answer),
  listen: (c, r) => ok((r.type === 'listen' || r.type === 'mcq') && r.choice === c.answer),
  tf: (c, r) => ok(r.type === 'tf' && r.value === c.answer),
  fill: (c, r) => {
    if (r.type !== 'fill') return ok(false)
    const hits = c.blanks.map((b, i) => b.accept.some((a) => normalizeText(a, { caseSensitive: c.caseSensitive }) === normalizeText(r.values[i] ?? '', { caseSensitive: c.caseSensitive })))
    const n = hits.filter(Boolean).length
    return { correct: n === c.blanks.length, score: n / c.blanks.length }
  },
  code_complete: (c, r) => {
    if (r.type !== 'code_complete' && r.type !== 'fill') return ok(false)
    const hits = c.blanks.map((b, i) => b.accept.some((a) => normalizeCode(a, c.caseSensitive ?? true) === normalizeCode(r.values[i] ?? '', c.caseSensitive ?? true)))
    const n = hits.filter(Boolean).length
    return { correct: n === c.blanks.length, score: n / c.blanks.length }
  },
  match: (c, r) => {
    if (r.type !== 'match') return ok(false)
    const n = c.pairs.filter(([l, rr]) => r.pairs[l] === rr).length
    return { correct: n === c.pairs.length, score: n / c.pairs.length }
  },
  order: (c, r) => {
    if (r.type !== 'order') return ok(false)
    const n = c.items.filter((it, i) => r.items[i] === it).length
    return { correct: n === c.items.length, score: n / c.items.length }
  },
  categorize: (c, r) => {
    if (r.type !== 'categorize') return ok(false)
    const n = c.items.filter((it) => r.assignment[it.text] === it.cat).length
    return { correct: n === c.items.length, score: n / c.items.length }
  },
  find_error: (c, r) => ok(r.type === 'find_error' && r.index === c.answer),
  numeric: (c, r) => {
    if (r.type !== 'numeric' || !Number.isFinite(r.value)) return ok(false)
    return ok(Math.abs(r.value - c.answer) <= (c.tolerance ?? 1e-9))
  },
  short: (c, r) => {
    if (r.type !== 'short') return ok(false)
    const o = { caseSensitive: c.caseSensitive, accentSensitive: c.accentSensitive }
    return ok(c.accept.some((a) => normalizeText(a, o) === normalizeText(r.text, o)))
  },
  code_output: (c, r) => {
    if (r.type !== 'code_output' && r.type !== 'short') return ok(false)
    const norm = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim()
    return ok(c.accept.some((a) => norm(a) === norm(r.text)))
  },
  multistep: (c, r) => {
    if (r.type !== 'multistep') return ok(false)
    const results = c.steps.map((s, i) => grade(s, r.steps[i] ?? ({ type: 'short', text: '' } as Response)))
    const n = results.filter((x) => x.correct).length
    return { correct: n === c.steps.length, score: n / c.steps.length, detail: `${n} de ${c.steps.length} etapas corretas` }
  },
  // Laboratórios: o resultado da execução real (SQLite/Pyodide) chega na resposta.
  sql: (_c, r) => {
    if (r.type !== 'sql' || r.error || !r.result) return ok(false)
    return ok(Boolean(r.matches))
  },
  python: (_c, r) => {
    if (r.type !== 'python' || r.error || !r.total) return ok(false)
    return { correct: r.passed === r.total, score: (r.passed ?? 0) / r.total, detail: `${r.passed}/${r.total} testes` }
  },
}

export function grade(c: Challenge, r: Response): GradeResult {
  const g = GRADERS[c.type] as Grader<typeof c.type>
  return g(c as never, r)
}

/** Resposta canônica correta (testes de gabarito e exibição da solução). */
export function correctResponse(c: Challenge): Response {
  switch (c.type) {
    case 'mcq':
      return { type: 'mcq', choice: c.answer }
    case 'listen':
      return { type: 'listen', choice: c.answer }
    case 'tf':
      return { type: 'tf', value: c.answer }
    case 'fill':
      return { type: 'fill', values: c.blanks.map((b) => b.accept[0]) }
    case 'code_complete':
      return { type: 'code_complete', values: c.blanks.map((b) => b.accept[0]) }
    case 'match':
      return { type: 'match', pairs: Object.fromEntries(c.pairs) }
    case 'order':
      return { type: 'order', items: [...c.items] }
    case 'categorize':
      return { type: 'categorize', assignment: Object.fromEntries(c.items.map((i) => [i.text, i.cat])) }
    case 'find_error':
      return { type: 'find_error', index: c.answer }
    case 'numeric':
      return { type: 'numeric', value: c.answer }
    case 'short':
      return { type: 'short', text: c.accept[0] }
    case 'code_output':
      return { type: 'code_output', text: c.accept[0] }
    case 'multistep':
      return { type: 'multistep', steps: c.steps.map(correctResponse) }
    case 'sql':
      return { type: 'sql', query: c.solution, result: { columns: [], rows: [] }, matches: true }
    case 'python':
      return { type: 'python', code: c.solution, passed: c.tests.length, total: c.tests.length }
  }
}

/** Texto curto da resposta correta, para o feedback. */
export function describeAnswer(c: Challenge): string {
  switch (c.type) {
    case 'mcq':
    case 'listen':
      return c.options[c.answer]
    case 'tf':
      return c.answer ? 'Verdadeiro' : 'Falso'
    case 'fill':
    case 'code_complete':
      return c.blanks.map((b) => b.accept[0]).join(' · ')
    case 'match':
      return c.pairs.map(([a, b]) => `${a} → ${b}`).join('; ')
    case 'order':
      return c.items.join(' → ')
    case 'categorize':
      return c.categories.map((cat, i) => `${cat}: ${c.items.filter((it) => it.cat === i).map((it) => it.text).join(', ')}`).join(' | ')
    case 'find_error':
      return `“${c.tokens[c.answer]}” → ${c.fix}`
    case 'numeric':
      return `${c.answer}${c.unit ? ` ${c.unit}` : ''}`
    case 'short':
      return c.accept[0]
    case 'code_output':
      return c.accept[0]
    case 'multistep':
      return c.steps.map((s, i) => `${i + 1}) ${describeAnswer(s)}`).join('  ')
    case 'sql':
      return c.solution
    case 'python':
      return c.solution
  }
}

/** Tempo estimado padrão por tipo (segundos). */
export function estimatedSeconds(c: Challenge): number {
  if (c.seconds) return c.seconds
  const base: Record<ChallengeType, number> = {
    mcq: 35, listen: 40, tf: 20, fill: 40, code_complete: 60, match: 50, order: 50, categorize: 60,
    find_error: 40, numeric: 60, short: 45, code_output: 50, multistep: 120, sql: 240, python: 300,
  }
  return base[c.type]
}

/** Tipos de laboratório (execução real) — ficam fora das partidas rápidas. */
export const LAB_TYPES: ChallengeType[] = ['sql', 'python']
