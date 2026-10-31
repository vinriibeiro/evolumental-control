import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, answerOptions, filterQuestions, isCorrect, parseBlocks, recordAnswer, sessionNote, shuffled, summarizeProgress, toggleFavorite, type BankQuestion, type Progress } from '../questionBank'

const q = (id: string, extra: Partial<BankQuestion> = {}): BankQuestion => ({
  id,
  tema: 'SQL',
  subtema: 'JOINs',
  nivel: 'basico',
  tipo: 'multipla_escolha',
  estilo: 'concurso',
  enunciado: 'Qual cláusula filtra grupos?',
  alternativas: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
  gabarito: 'B',
  explicacao: 'HAVING filtra grupos.',
  tags: ['having'],
  ...extra,
})

describe('filtros', () => {
  const all = [q('sql-1'), q('sql-2', { nivel: 'extremo', tipo: 'certo_errado', estilo: 'entrevista', gabarito: 'C', alternativas: undefined }), q('sql-3', { enunciado: 'Função de JANELA com partição' })]

  it('filtra por nível, tipo e estilo', () => {
    expect(filterQuestions(all, { ...EMPTY_FILTERS, niveis: ['extremo'] }, {}).map((x) => x.id)).toEqual(['sql-2'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, tipos: ['certo_errado'] }, {}).map((x) => x.id)).toEqual(['sql-2'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, estilos: ['concurso'] }, {}).map((x) => x.id)).toEqual(['sql-1', 'sql-3'])
  })

  it('busca por texto sem diferenciar acento e maiúscula', () => {
    expect(filterQuestions(all, { ...EMPTY_FILTERS, busca: 'janela' }, {}).map((x) => x.id)).toEqual(['sql-3'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, busca: 'função' }, {}).map((x) => x.id)).toEqual(['sql-3'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, busca: 'sql-2' }, {}).map((x) => x.id)).toEqual(['sql-2'])
  })

  it('filtra por situação: não respondidas, que errei e favoritas', () => {
    let p: Progress = {}
    p = recordAnswer(p, 'sql-1', true)
    p = recordAnswer(p, 'sql-2', false)
    p = toggleFavorite(p, 'sql-3')
    expect(filterQuestions(all, { ...EMPTY_FILTERS, status: 'nao_respondidas' }, p).map((x) => x.id)).toEqual(['sql-3'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, status: 'erradas' }, p).map((x) => x.id)).toEqual(['sql-2'])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, status: 'favoritas' }, p).map((x) => x.id)).toEqual(['sql-3'])
  })

  it('uma questão errada que depois foi acertada deixa de contar como errada', () => {
    let p = recordAnswer({}, 'sql-1', false)
    p = recordAnswer(p, 'sql-1', true)
    expect(p['sql-1']).toEqual([2, 1, 1, 0])
    expect(filterQuestions(all, { ...EMPTY_FILTERS, status: 'erradas' }, p)).toEqual([])
  })
})

describe('respostas', () => {
  it('monta as alternativas e confere o gabarito', () => {
    const me = q('a')
    expect(answerOptions(me).map((o) => o.key)).toEqual(['A', 'B', 'C', 'D'])
    expect(isCorrect(me, 'B')).toBe(true)
    expect(isCorrect(me, 'A')).toBe(false)
    const ce = q('b', { tipo: 'certo_errado', alternativas: undefined, gabarito: 'E' })
    expect(answerOptions(ce)).toEqual([{ key: 'C', label: 'Certo' }, { key: 'E', label: 'Errado' }])
    expect(isCorrect(ce, 'E')).toBe(true)
  })

  it('favoritar preserva as tentativas e desfavoritar volta ao estado anterior', () => {
    let p = recordAnswer({}, 'x', true)
    p = toggleFavorite(p, 'x')
    expect(p.x).toEqual([1, 1, 1, 1])
    p = toggleFavorite(p, 'x')
    expect(p.x).toEqual([1, 1, 1, 0])
  })

  it('resume o progresso', () => {
    let p: Progress = {}
    p = recordAnswer(p, 'a', true)
    p = recordAnswer(p, 'b', false)
    p = toggleFavorite(p, 'c')
    expect(summarizeProgress(p)).toEqual({ answered: 2, correctLast: 1, wrongLast: 1, favorites: 1 })
    expect(summarizeProgress(p, ['a', 'z'])).toEqual({ answered: 1, correctLast: 1, wrongLast: 0, favorites: 0 })
  })
})

describe('texto com código', () => {
  it('separa texto e blocos de código', () => {
    const blocks = parseBlocks('Considere:\n```sql\nSELECT 1;\nSELECT 2;\n```\nQual a saída?')
    expect(blocks).toEqual([
      { type: 'text', text: 'Considere:' },
      { type: 'code', lang: 'sql', text: 'SELECT 1;\nSELECT 2;' },
      { type: 'text', text: 'Qual a saída?' },
    ])
    expect(parseBlocks('Só texto.')).toEqual([{ type: 'text', text: 'Só texto.' }])
  })
})

describe('utilidades', () => {
  it('embaralha sem alterar a lista original', () => {
    const base = [1, 2, 3, 4, 5]
    let n = 0
    const out = shuffled(base, () => [0.1, 0.9, 0.3, 0.7][n++ % 4])
    expect([...out].sort()).toEqual(base)
    expect(base).toEqual([1, 2, 3, 4, 5])
  })

  it('descreve a sessão', () => {
    expect(sessionNote('SQL', [], 20)).toBe('Banco de questões · SQL · todos os subtemas · 20 questão(ões)')
    expect(sessionNote('SQL', ['JOINs', 'DDL e DML'], 5)).toBe('Banco de questões · SQL · JOINs, DDL e DML · 5 questão(ões)')
    expect(sessionNote('SQL', ['a', 'b', 'c', 'd'], 5)).toContain('4 subtemas')
  })
})
