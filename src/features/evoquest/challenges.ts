// Desafios de conhecimento usados pelo mundo: terminal SQL, valor digitado
// e painel lógico. O gabarito NÃO vai para o navegador: cada desafio guarda
// só o hash SHA-256 da resposta canônica (gerado pelos testes a partir das
// soluções, que ficam fora do pacote do app). O servidor confere o mesmo hash.
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

export interface SqlChallenge {
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
  // ── Pedagogia (opcional) ──
  /** Estágio da aprendizagem: define o peso da evidência de domínio. */
  stage?: Stage
  /** Tópico do EvoQuest exercitado (ex.: "groupby"). */
  concept?: string
  /** Lição de campo mostrada no terminal (id em WORLD.lessons). */
  lesson?: string
  /** Escada de pistas: conceito → parte do problema → parte da solução. */
  ladder?: [string, string, string]
  /** Explicação completa (último degrau): o raciocínio inteiro. */
  explanation?: string
  /** Banco gerado na hora (revisão de campo parametrizada) em vez de DATASETS[database]. */
  inline?: { dataset: string; schema: Array<{ table: string; columns: string[] }> }
  /** Semente do exercício parametrizado (vai junto com a evidência). */
  seed?: number
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

export type Challenge = SqlChallenge | InputChallenge | SwitchPuzzle

const norm = (v: unknown) => (v == null ? null : typeof v === 'number' ? String(Number(v.toFixed(6))) : String(v))

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
