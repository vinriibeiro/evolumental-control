// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { loadPyodide, type PyodideInterface } from 'pyodide'
import evaluator from './evaluate.py?raw'
import { CHALLENGES, type Challenge } from '../catalog'
import type { PracticeResult } from '../practiceTypes'
import { VARIATIONS, type Variation } from '../variations'
import { pythonCases } from './pythonCases'
import { sqlSetup, sqlVariant } from './sqlCases'

// Executa o mesmo avaliador do sandbox, mas no Pyodide do Node: valida o Python real sem navegador.
let runtime: PyodideInterface
beforeAll(async () => { runtime = await loadPyodide({ stdout: () => {}, stderr: () => {} }) }, 60_000)

async function run(request: unknown): Promise<PracticeResult> {
  runtime.globals.set('practice_request_json', JSON.stringify(request))
  return JSON.parse(await runtime.runPythonAsync(`${evaluator}\nawait evaluate(json.loads(practice_request_json))`)) as PracticeResult
}

function practice(challenge: Challenge | Variation, draft: string) {
  const variation = 'baseId' in challenge ? challenge : undefined
  if (challenge.track === 'python') return run({ id: challenge.id, track: 'python', draft, tests: variation?.tests ?? pythonCases[challenge.id] })
  return run({ id: challenge.id, track: 'sql', draft, setup: sqlSetup(challenge), variant: variation?.extraData ?? sqlVariant(challenge.id), reference: challenge.solution })
}
const find = (id: string) => [...CHALLENGES, ...VARIATIONS].find((item) => item.id === id)!
const firstFailure = (result: PracticeResult) => result.cases.find((item) => !item.passed)!

describe('soluções oficiais', () => {
  it.each([...CHALLENGES, ...VARIATIONS].filter(({ track }) => track !== 'git'))('passam em $id', async (challenge) => {
    const result = await practice(challenge, challenge.solution)
    expect(result.passed, JSON.stringify(result.cases)).toBe(true)
    expect(result.cases.every((item) => item.detail === undefined)).toBe(true)
  })
})

describe('orientação de Python', () => {
  it('mostra entrada, saída obtida e saída esperada quando um teste falha', async () => {
    const result = await practice(find('python-first_steps-5'), 'n = float(input())\nprint(n * 3)')
    const failed = firstFailure(result)
    expect(failed.detail).toMatchObject({ kind: 'Saída diferente do esperado', input: '7', got: '21.0', expected: '14' })
  })

  it('mostra a chamada, o retorno obtido e o esperado de funções', async () => {
    const result = await practice(find('python-intermediate-1'), 'def total_aprovado(pedidos):\n    return sum(p["valor"] for p in pedidos)')
    const detail = firstFailure(result).detail!
    expect(detail.input).toContain('student.total_aprovado(')
    expect(detail.got).toBe('259')
    expect(detail.expected).toBe('50')
  })

  it('traduz erros de sintaxe e indica a linha', async () => {
    const open = firstFailure(await practice(find('python-first_steps-1'), 'print("Bom dia!"')).detail!
    expect(open).toMatchObject({ kind: 'Erro de sintaxe', line: 1, code: 'print("Bom dia!"' })
    expect(open.explanation).toContain('nunca foi fechado')
    const colon = firstFailure(await practice(find('python-basic-1'), 'numero = int(input())\nif numero % 2 == 0\n    print("Par")')).detail!
    expect(colon).toMatchObject({ line: 2, kind: 'Erro de sintaxe' })
    expect(colon.explanation).toContain('dois-pontos')
    const indent = firstFailure(await practice(find('python-basic-1'), 'numero = int(input())\nif numero % 2 == 0:\nprint("Par")')).detail!
    expect(indent.kind).toBe('Erro de indentação')
    expect(indent.explanation).toContain('recuo')
  })

  it('explica erros de execução com a linha do aluno', async () => {
    const detail = firstFailure(await practice(find('python-first_steps-1'), 'x = 1\nprint(y)')).detail!
    expect(detail).toMatchObject({ kind: 'Erro durante a execução', line: 2, code: 'print(y)' })
    expect(detail.explanation).toContain('“y”')
  })

  it('aceita variações com respostas certas e reprova respostas decoradas', async () => {
    const memorized = await practice(find('python-first_steps-5~v1'), 'n = float(input())\nprint(n * 2)')
    expect(firstFailure(memorized).detail).toMatchObject({ expected: '120', got: '4.0', input: '2' })
    const mixed = await practice(find('python-basic-1~v1'), 'n = int(input())\nif n % 2 == 0:\n    print("Par")\nelse:\n    print("Ímpar")')
    expect(mixed.passed).toBe(false)
  })
})

describe('orientação de SQL', () => {
  const people = () => find('sql-first_steps-4')

  it('separa erro de sintaxe, coluna inexistente e tabela inexistente', async () => {
    expect(firstFailure(await practice(people(), 'SELEC nome FROM pessoas')).detail?.kind).toBe('Erro de sintaxe')
    expect(firstFailure(await practice(people(), 'SELECT nome, idades FROM pessoas')).detail?.kind).toBe('Coluna inexistente')
    expect(firstFailure(await practice(people(), 'SELECT nome, idade FROM gente')).detail?.kind).toBe('Tabela inexistente')
  })

  it('mostra colunas faltando ou sobrando com as duas tabelas', async () => {
    const missing = firstFailure(await practice(people(), 'SELECT nome FROM pessoas ORDER BY idade DESC, nome')).detail!
    expect(missing.kind).toBe('Colunas diferentes do esperado')
    expect(missing.explanation).toContain('Faltam colunas: idade')
    expect(missing.gotTable?.columns).toEqual(['nome'])
    expect(missing.expectedTable?.columns).toEqual(['nome', 'idade'])
    const extra = firstFailure(await practice(people(), 'SELECT nome, idade, cidade FROM pessoas ORDER BY idade DESC, nome')).detail!
    expect(extra.explanation).toContain('a mais: cidade')
  })

  it('diferencia ordem incorreta de resultado divergente', async () => {
    const order = firstFailure(await practice(people(), 'SELECT nome, idade FROM pessoas ORDER BY idade ASC, nome')).detail!
    expect(order.kind).toBe('Ordem incorreta')
    expect(order.gotTable?.rows[0]).toEqual(['Bruno', '17'])
    expect(order.expectedTable?.rows[0]).toEqual(['Carla', '35'])
    const fewer = firstFailure(await practice(people(), 'SELECT nome, idade FROM pessoas WHERE idade > 20 ORDER BY idade DESC, nome')).detail!
    expect(fewer).toMatchObject({ kind: 'Resultado divergente' })
    expect(fewer.explanation).toContain('Faltam 2 linha(s)')
    const wrongOrderOfColumns = firstFailure(await practice(people(), 'SELECT idade, nome FROM pessoas ORDER BY idade DESC, nome')).detail!
    expect(wrongOrderOfColumns.kind).toBe('Colunas fora de ordem')
  })

  it('cobra o alias pedido e reprova consultas ajustadas só aos dados do enunciado', async () => {
    const alias = firstFailure(await practice(find('sql-basic-3~v1'), 'SELECT setor, COUNT(*) FROM chamados GROUP BY setor ORDER BY setor')).detail!
    expect(alias.kind).toBe('Nome de coluna diferente')
    const hardcoded = await practice(find('sql-first_steps-3~v1'), "SELECT id, titulo, ano FROM livros WHERE id = 2")
    expect(hardcoded.cases.map((item) => item.passed)).toEqual([true, false])
    const like = await practice(find('sql-first_steps-3~v1'), "SELECT id, titulo, ano FROM livros WHERE titulo LIKE '%Vidas Secas%'")
    expect(like.cases.map((item) => item.passed)).toEqual([true, false])
    const inner = await practice(find('sql-intermediate-2~v1'), 'SELECT a.id, a.nome FROM alunos a JOIN matriculas m ON m.aluno_id = a.id ORDER BY a.id')
    expect(firstFailure(inner).detail?.kind).toBe('Resultado divergente')
  })
})
