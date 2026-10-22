// @vitest-environment node
//
// Integridade de TODO o conteúdo do EvoQuest: estrutura, gabaritos que se
// autocorrigem, cálculos de estatística conferidos, soluções de SQL executadas
// de verdade no SQLite (sql.js) e catálogo do servidor sincronizado.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { SUBJECTS } from '../catalog'
import { buildCatalogSql } from '../catalogSql'
import { correctResponse, grade } from '../engine/grade'
import { compareResults, runQuery } from '../lab/sqlCore'
import type { Challenge, Response, SubjectContent } from '../types'

let contents: SubjectContent[] = []
let SQL: SqlJsStatic

beforeAll(async () => {
  contents = await Promise.all(SUBJECTS.map((s) => s.load()))
  SQL = await initSqlJs()
})

const every = () => contents.flatMap((s) => s.units.flatMap((u) => u.challenges.map((c) => ({ s, u, c }))))

function stat(op: NonNullable<Challenge['calc']>['op'], d: number[]): number {
  const n = d.length
  const mean = d.reduce((a, b) => a + b, 0) / n
  const ss = d.reduce((a, b) => a + (b - mean) ** 2, 0)
  const sorted = [...d].sort((a, b) => a - b)
  switch (op) {
    case 'mean':
      return mean
    case 'median':
      return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    case 'range':
      return sorted[n - 1] - sorted[0]
    case 'var_pop':
      return ss / n
    case 'var_sample':
      return ss / (n - 1)
    case 'sd_pop':
      return Math.sqrt(ss / n)
    case 'sd_sample':
      return Math.sqrt(ss / (n - 1))
    case 'cv_sample':
      return (Math.sqrt(ss / (n - 1)) / mean) * 100
  }
}

/** Uma resposta certamente errada, para provar que o corretor não aceita tudo. */
function wrongResponse(c: Challenge): Response | null {
  switch (c.type) {
    case 'mcq':
    case 'listen':
      return { type: c.type, choice: (c.answer + 1) % c.options.length }
    case 'tf':
      return { type: 'tf', value: !c.answer }
    case 'find_error':
      return { type: 'find_error', index: (c.answer + 1) % c.tokens.length }
    case 'numeric':
      return { type: 'numeric', value: c.answer + 1000 }
    case 'order':
      return { type: 'order', items: [...c.items].reverse() }
    case 'short':
    case 'code_output':
      return { type: c.type, text: '___resposta errada___' }
    case 'fill':
    case 'code_complete':
      return { type: c.type, values: c.blanks.map(() => 'xyz') }
    default:
      return null
  }
}

describe('conteúdo do EvoQuest', () => {
  it('tem 8 disciplinas com ≥ 25 desafios cada (≥ 200 no total)', () => {
    expect(contents).toHaveLength(8)
    for (const s of contents) expect(s.units.flatMap((u) => u.challenges).length, s.subjectId).toBeGreaterThanOrEqual(25)
    expect(every().length).toBeGreaterThanOrEqual(200)
  })

  it('ids são únicos, estáveis e seguem <disciplina>.<unidade>.<código>', () => {
    const ids = every().map((x) => x.c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const { s, u, c } of every()) {
      expect(u.id.startsWith(`${s.subjectId}.`), u.id).toBe(true)
      expect(c.id.startsWith(`${u.id}.`), c.id).toBe(true)
    }
    for (const meta of SUBJECTS) expect(contents.find((c) => c.subjectId === meta.id), meta.id).toBeTruthy()
  })

  it('toda unidade tem lição, tópicos usados e exatamente um chefe', () => {
    for (const s of contents)
      for (const u of s.units) {
        expect(u.lesson.length, u.id).toBeGreaterThanOrEqual(3)
        expect(u.challenges.filter((c) => c.boss), u.id).toHaveLength(1)
        const topicIds = new Set(u.topics.map((t) => t.id))
        for (const c of u.challenges) expect(topicIds.has(c.topic), `${c.id} → ${c.topic}`).toBe(true)
        for (const t of u.topics) expect(u.challenges.some((c) => c.topic === t.id && !c.boss), `${u.id}/${t.id} sem desafio`).toBe(true)
      }
  })

  it('cada disciplina cobre pelo menos 3 níveis de dificuldade e 6 tipos de desafio', () => {
    for (const s of contents) {
      const all = s.units.flatMap((u) => u.challenges)
      expect(new Set(all.map((c) => c.difficulty)).size, s.subjectId).toBeGreaterThanOrEqual(3)
      expect(new Set(all.map((c) => c.type)).size, s.subjectId).toBeGreaterThanOrEqual(6)
    }
  })

  it('estrutura de cada tipo é válida', () => {
    const check = (c: Challenge) => {
      expect(c.prompt.trim().length, c.id).toBeGreaterThan(2)
      expect(c.explanation.trim().length, c.id).toBeGreaterThan(2)
      switch (c.type) {
        case 'mcq':
        case 'listen':
          expect(c.options.length).toBeGreaterThanOrEqual(2)
          expect(new Set(c.options).size, c.id).toBe(c.options.length)
          expect(c.answer).toBeGreaterThanOrEqual(0)
          expect(c.answer).toBeLessThan(c.options.length)
          if (c.type === 'listen') expect(c.say.length).toBeGreaterThan(3)
          break
        case 'fill':
        case 'code_complete':
          expect(c.template.split('___').length - 1, c.id).toBe(c.blanks.length)
          for (const b of c.blanks) {
            expect(b.accept.length).toBeGreaterThan(0)
            if ('options' in b && b.options) expect(b.options, c.id).toContain(b.accept[0])
          }
          break
        case 'match':
          expect(c.pairs.length).toBeGreaterThanOrEqual(3)
          expect(new Set(c.pairs.map((p) => p[0])).size, c.id).toBe(c.pairs.length)
          expect(new Set(c.pairs.map((p) => p[1])).size, c.id).toBe(c.pairs.length)
          break
        case 'order':
          expect(c.items.length).toBeGreaterThanOrEqual(3)
          expect(new Set(c.items).size, c.id).toBe(c.items.length)
          break
        case 'categorize':
          expect(c.categories.length).toBeGreaterThanOrEqual(2)
          expect(new Set(c.items.map((i) => i.text)).size, c.id).toBe(c.items.length)
          for (const i of c.items) expect(i.cat, c.id).toBeLessThan(c.categories.length)
          break
        case 'find_error':
          expect(c.answer).toBeLessThan(c.tokens.length)
          expect(c.fix.length).toBeGreaterThan(0)
          break
        case 'numeric':
          expect(Number.isFinite(c.answer)).toBe(true)
          break
        case 'short':
        case 'code_output':
          expect(c.accept.length).toBeGreaterThan(0)
          break
        case 'multistep':
          expect(c.steps.length).toBeGreaterThanOrEqual(2)
          expect(new Set(c.steps.map((s) => s.id)).size).toBe(c.steps.length)
          c.steps.forEach(check)
          break
        case 'python':
          expect(c.tests.length).toBeGreaterThanOrEqual(2)
          expect(c.solution).toContain(`def ${c.entry}(`)
          expect(c.starter).toContain(`def ${c.entry}(`)
          break
        case 'sql':
          expect(contents.find((s) => s.subjectId === c.id.split('.')[0])?.datasets?.[c.dataset], c.id).toBeTruthy()
          break
      }
    }
    every().forEach(({ c }) => check(c))
  })

  it('o gabarito de cada desafio é aceito e uma resposta errada é recusada', () => {
    for (const { c } of every()) {
      if (c.type === 'sql' || c.type === 'python') continue
      expect(grade(c, correctResponse(c)).correct, c.id).toBe(true)
      const wrong = wrongResponse(c)
      if (wrong) expect(grade(c, wrong).correct, `${c.id} aceitou resposta errada`).toBe(false)
    }
  })

  it('cálculos de estatística conferem com o gabarito', () => {
    const withCalc = every().filter((x) => x.c.calc)
    expect(withCalc.length).toBeGreaterThanOrEqual(8)
    for (const { c } of withCalc) {
      const v = stat(c.calc!.op, c.calc!.data)
      const answers = c.type === 'numeric' ? [{ answer: c.answer, tol: c.tolerance ?? 1e-9 }] : c.type === 'multistep' ? c.steps.filter((s) => s.type === 'numeric').map((s) => ({ answer: (s as { answer: number }).answer, tol: (s as { tolerance?: number }).tolerance ?? 1e-9 })) : []
      expect(answers.some((a) => Math.abs(a.answer - v) <= a.tol), `${c.id}: calculado ${v}`).toBe(true)
    }
  })

  it('soluções dos laboratórios de SQL executam no SQLite e o corretor as reconhece', () => {
    const labs = every().filter((x) => x.c.type === 'sql')
    expect(labs.length).toBeGreaterThanOrEqual(5)
    for (const { s, c } of labs) {
      if (c.type !== 'sql') continue
      const ds = s.datasets![c.dataset]
      const expected = runQuery(SQL, ds, c.solution)
      expect(expected.rows.length, c.id).toBeGreaterThan(0)
      expect(compareResults(expected, runQuery(SQL, ds, c.solution), c.orderMatters).matches).toBe(true)
      expect(compareResults(expected, runQuery(SQL, ds, 'SELECT 1'), c.orderMatters).matches, c.id).toBe(false)
    }
  })

  it('o comparador de SQL ignora apelidos e, quando pedido, exige a ordem', () => {
    const ds = contents.find((s) => s.subjectId === 'sql')!.datasets!.loja
    const a = runQuery(SQL, ds, 'SELECT nome AS n FROM produtos ORDER BY preco')
    const b = runQuery(SQL, ds, 'SELECT nome FROM produtos ORDER BY preco DESC')
    expect(compareResults(a, b, false).matches).toBe(true)
    expect(compareResults(a, b, true).matches).toBe(false)
    expect(compareResults(a, b, true).reason).toMatch(/ordem/)
  })

  it('consulta sem linhas é um resultado válido; sem SELECT é erro claro', () => {
    const ds = contents.find((s) => s.subjectId === 'sql')!.datasets!.loja
    expect(runQuery(SQL, ds, 'SELECT nome FROM produtos WHERE preco > 1000')).toEqual({ columns: ['nome'], rows: [] })
    expect(runQuery(SQL, ds, "UPDATE produtos SET preco = 0; SELECT SUM(preco) FROM produtos").rows).toEqual([[0]])
    expect(() => runQuery(SQL, ds, "UPDATE produtos SET preco = 0")).toThrow(/SELECT/)
    expect(() => runQuery(SQL, ds, 'SELEC nome FROM produtos')).toThrow()
  })

  it('valores de referência do banco de exemplo (usados em vários desafios)', () => {
    const ds = contents.find((s) => s.subjectId === 'sql')!.datasets!.loja
    const one = (q: string) => runQuery(SQL, ds, q).rows[0][0]
    expect(one(`SELECT COUNT(*) FROM produtos WHERE categoria = 'Eletrônicos' AND preco < 150`)).toBe(2)
    expect(one(`SELECT SUM(preco) FROM produtos WHERE categoria = 'Acessórios'`)).toBe(190)
    expect(one(`SELECT COUNT(*) FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL`)).toBe(1)
    expect(one(`SELECT COUNT(*) FROM produtos WHERE preco > (SELECT AVG(preco) FROM produtos)`)).toBe(3)
    expect(one(`SELECT SUM(i.quantidade * pr.preco) FROM itens i JOIN produtos pr ON pr.id = i.produto_id JOIN pedidos p ON p.id = i.pedido_id WHERE p.status = 'entregue'`)).toBe(1000)
    expect(one(`SELECT COUNT(*) FROM pedidos WHERE status = 'entregue'`)).toBe(5)
    expect(one(`SELECT COUNT(DISTINCT estado) FROM clientes`)).toBe(4)
    expect(one(`SELECT COUNT(*) FROM clientes WHERE estado = 'DF' OR estado = 'SP' AND data_cadastro < '2024-03-01'`)).toBe(3)
  })

  it('a migração do catálogo está sincronizada com o conteúdo', () => {
    const file = join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261022000100_evoquest_catalog.sql')
    const sql = buildCatalogSql(contents)
    if (process.env.UPDATE_CATALOG) writeFileSync(file, sql)
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'Rode `npm run game:catalog`').toBe(sql)
  })
})
