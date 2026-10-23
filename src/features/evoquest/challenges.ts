// Desafios de conhecimento usados pelo mundo: terminal SQL, terminal Python,
// valor digitado e painel lógico. O gabarito NÃO vai para o navegador: cada
// desafio guarda só o hash SHA-256 da resposta canônica (gerado pelos testes a
// partir das soluções, que ficam fora do pacote do app). O servidor confere o
// mesmo hash.
import type { PyCollect } from '@/game/lab/runPython'
import type { QueryResult } from '@/game/lab/sqlCore'
import type { Stage } from './engine/pedagogy'

export interface SqlFeedback {
  when: {
    error?: string
    moreRows?: boolean
    fewerRows?: boolean
    noRows?: boolean
    columns?: 'more' | 'fewer'
    /** Trecho (minúsculo) que falta na consulta. */
    queryLacks?: string
    queryHas?: string
  }
  say: string
}

export interface SqlChallenge extends PedagogyFields {
  kind: 'sql'
  id: string
  title: string
  /** Quem fala no terminal (NPC) e o objetivo na voz da história. */
  speaker: string
  brief: string
  database: string
  starter?: string
  /** Consulta de verificação executada DEPOIS da do jogador (operações de escrita). */
  verify?: string
  orderMatters?: boolean
  expect: { hash: string; columns: number; rows: number }
  feedback: SqlFeedback[]
  hints: string[]
  success: string
  skills: string[]
  /** Banco gerado na hora (revisão de campo parametrizada) em vez de DATASETS[database]. */
  inline?: { dataset: string; schema: Array<{ table: string; columns: string[] }> }
}

/** Campos pedagógicos comuns aos terminais (SQL e Python). */
export interface PedagogyFields {
  /** Estágio da aprendizagem: define o peso da evidência de domínio. */
  stage?: Stage
  /** Tópico do EvoQuest exercitado (ex.: "groupby", "colecoes"). */
  concept?: string
  /** Lição de campo mostrada no terminal (id em WORLD.lessons). */
  lesson?: string
  /** Escada de pistas: conceito → parte do problema → parte da solução. */
  ladder?: [string, string, string]
  /** Explicação completa (último degrau): o raciocínio inteiro. */
  explanation?: string
  /** Semente do exercício parametrizado (vai junto com a evidência). */
  seed?: number
}

export interface PyFeedback {
  when: {
    /** Trecho do erro (compilação, função ausente ou erro no 1º caso que falhou). */
    error?: string
    /** Trecho (minúsculo) que falta no código; uma palavra só casa inteira; aspas duplas valem como simples. */
    codeLacks?: string
    codeHas?: string
    /** Tipo do valor devolvido no primeiro caso. */
    result?: 'none' | 'number' | 'str' | 'list' | 'dict' | 'bool'
    /** Só este caso (índice) falhou — os outros conferem. */
    onlyCase?: number
  }
  say: string
}

/**
 * Terminal Python do mundo: o jogador escreve uma função; o Pyodide a executa
 * em cada caso e o navegador compara o hash do conjunto de resultados. Os
 * casos (entradas) são visíveis — o gabarito, não.
 */
export interface PyChallenge extends PedagogyFields {
  kind: 'python'
  id: string
  title: string
  speaker: string
  brief: string
  /** Nome da função que o controlador chama. */
  entry: string
  /** Entradas de cada caso (visíveis ao jogador). */
  cases: unknown[][]
  /** Nome de cada caso, para o retorno ("Turno da manhã", "Lista vazia"). */
  caseNames?: string[]
  starter: string
  packages?: string[]
  /** Hash do conjunto; hash por caso só para o retorno ("o caso 3 falhou"). */
  expect: { hash: string; cases: string[] }
  feedback: PyFeedback[]
  success: string
  skills: string[]
}

export interface InputChallenge {
  kind: 'input'
  id: string
  title: string
  brief: string
  normalize: 'trim' | 'upper' | 'digits'
  expect: { hash: string }
}

export interface SwitchPuzzle {
  kind: 'switches'
  id: string
  title: string
  brief: string
  switches: Array<{ id: string; label: string }>
  rules: Array<{ text: string; ok: (on: Record<string, boolean>) => boolean; fail: string }>
  success: string
  expect: { hash: string }
}

export type Challenge = SqlChallenge | PyChallenge | InputChallenge | SwitchPuzzle

/** Desafios que geram evidência de domínio (terminais com estágio). */
export type PedagogicChallenge = SqlChallenge | PyChallenge
export const isPedagogic = (c: Challenge | undefined): c is PedagogicChallenge => c?.kind === 'sql' || c?.kind === 'python'

const norm = (v: unknown) => (v == null ? null : typeof v === 'number' ? String(Number(v.toFixed(6))) : String(v))

/**
 * Forma canônica de um valor devolvido por Python (já em JSON): números com
 * 6 decimais, chaves de dicionário ordenadas, listas na ordem (listas são
 * ordenadas em Python; quem quer indiferença à ordem pede um dicionário).
 */
export function canonValue(v: unknown): string {
  if (v == null) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? String(Number(v.toFixed(6))) : 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonValue).join(',')}]`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonValue(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(String(v))
}

/** Forma canônica do conjunto de casos: um caso que deu erro nunca confere. */
export function canonCases(results: Array<{ value?: unknown; error?: string }>): string {
  return `${results.length}|${results.map((r) => (r.error ? `!${r.error}` : canonValue(r.value))).join('\n')}`
}

/** Forma canônica do resultado: valores como texto, linhas ordenadas (salvo quando a ordem importa). */
export function canonResult(r: QueryResult, orderMatters = false): string {
  const rows = r.rows.map((row) => JSON.stringify(row.map(norm)))
  if (!orderMatters) rows.sort()
  return `${r.columns.length}|${rows.join('\n')}`
}

export function canonInput(raw: string, mode: InputChallenge['normalize']): string {
  const t = raw.trim()
  if (mode === 'upper') return t.toUpperCase().replace(/\s+/g, ' ')
  if (mode === 'digits') return t.replace(/\D+/g, '')
  return t
}

export function canonSwitches(p: Pick<SwitchPuzzle, 'switches'>, on: Record<string, boolean>): string {
  return p.switches.map((s) => `${s.id}${on[s.id] ? 1 : 0}`).join('')
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Leitura do resultado errado como consequência no mundo + pista contextual.
 * Nunca revela a resposta.
 */
export function sqlFeedback(ch: SqlChallenge, query: string, out: { result?: QueryResult; error?: string }): string {
  const q = query.toLowerCase().replace(/\s+/g, ' ')
  for (const f of ch.feedback) {
    const w = f.when
    if (w.error !== undefined) {
      if (!out.error || !out.error.toLowerCase().includes(w.error.toLowerCase())) continue
    } else if (out.error) continue
    if (w.queryLacks && q.includes(w.queryLacks)) continue
    if (w.queryHas && !q.includes(w.queryHas)) continue
    const r = out.result
    if (w.noRows && (!r || r.rows.length > 0)) continue
    if (w.moreRows && (!r || r.rows.length <= ch.expect.rows)) continue
    if (w.fewerRows && (!r || r.rows.length >= ch.expect.rows || r.rows.length === 0)) continue
    if (w.columns === 'more' && (!r || r.columns.length <= ch.expect.columns)) continue
    if (w.columns === 'fewer' && (!r || r.columns.length >= ch.expect.columns)) continue
    return f.say
  }
  if (out.error) return `O terminal recusou o comando: ${out.error}`
  const r = out.result!
  if (r.columns.length !== ch.expect.columns) return `O sistema esperava ${ch.expect.columns} coluna(s) e recebeu ${r.columns.length}. Nada aconteceu.`
  if (r.rows.length !== ch.expect.rows) return `O sistema reconheceu ${r.rows.length} registro(s), mas a operação não se completou. Releia o objetivo.`
  return 'A quantidade bate, mas os dados não. Algum valor está diferente do que o sistema procura.'
}

const kindOf = (v: unknown): NonNullable<PyFeedback['when']['result']> =>
  v == null ? 'none' : typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'number' : typeof v === 'string' ? 'str' : Array.isArray(v) ? 'list' : 'dict'

const short = (v: unknown) => {
  const s = JSON.stringify(v) ?? 'None'
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

/**
 * Retorno do terminal Python: consequência no mundo + pista contextual, sem
 * revelar a resposta. `caseOk` diz quais casos conferem (pelo hash de cada um).
 */
export function pyFeedback(ch: PyChallenge, code: string, out: PyCollect, caseOk: boolean[]): string {
  // Aspas duplas viram simples e palavras inteiras casam por fronteira: "for" não
  // casa em "informe", nem 'consumo' no nome da função consumo_por_maquina.
  const c = code.toLowerCase().replace(/\s+/g, ' ').replace(/"/g, "'")
  const has = (p: string) => new RegExp(/^\w+$/.test(p) ? `\\b${p}\\b` : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(c)
  const results = out.results ?? []
  const firstError = out.error ?? results.find((r) => r.error)?.error
  const first = results[0]
  const failing = caseOk.map((ok, i) => (ok ? -1 : i)).filter((i) => i >= 0)
  for (const f of ch.feedback) {
    const w = f.when
    if (w.error !== undefined) {
      if (!firstError || !firstError.toLowerCase().includes(w.error.toLowerCase())) continue
    } else if (out.error) continue
    if (w.codeLacks && has(w.codeLacks)) continue
    if (w.codeHas && !has(w.codeHas)) continue
    if (w.result && (!first || first.error || kindOf(first.value) !== w.result)) continue
    if (w.onlyCase !== undefined && (failing.length !== 1 || failing[0] !== w.onlyCase)) continue
    return f.say
  }
  if (out.error) return `O controlador recusou o código: ${out.error.trim()}`
  if (firstError) {
    const i = results.findIndex((r) => r.error)
    return `O caso ${i + 1}${ch.caseNames?.[i] ? ` (${ch.caseNames[i]})` : ''} parou com um erro: ${firstError}`
  }
  if (first && first.value == null) return 'A função devolveu None. Falta um return com o resultado?'
  const i = failing[0] ?? 0
  const name = ch.caseNames?.[i] ? ` (${ch.caseNames[i]})` : ''
  return `${caseOk.filter(Boolean).length} de ${caseOk.length} casos conferem. O caso ${i + 1}${name} devolveu ${short(results[i]?.value)}, e não era isso que o controlador esperava.`
}
