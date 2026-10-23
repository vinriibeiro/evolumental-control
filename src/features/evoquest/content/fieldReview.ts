// Revisão de campo: exercícios PARAMETRIZADOS de GROUP BY. Cada semente gera
// outro depósito (nomes, quantidades e a pergunta mudam), então não dá para
// decorar a resposta — só reaplicar o conceito. Vale como evidência de
// domínio (prática independente), nunca como XP ou moedas.
//
// A resposta esperada é calculada aqui a partir dos dados gerados (não existe
// consulta-gabarito no pacote). Por não ter gabarito fixo, o servidor marca a
// atividade como parametrizada e limita os registros por dia.
import type { SqlChallenge } from '../challenges'
import { canonResult, sha256 } from '../challenges'
import { rng, type FieldTemplate } from './fieldCommon'
import { FIELD_DICT } from './fieldReviewPy'

export type { FieldTemplate } from './fieldCommon'
export { rng } from './fieldCommon'

export const FIELD_GROUPBY: FieldTemplate = { id: 'field_groupby', subject: 'sql', concept: 'groupby', stage: 'independent', title: 'Revisão de campo — GROUP BY', dailyLimit: 5 }
/** Todos os modelos parametrizados (SQL e Python): vão para o catálogo do servidor. */
export const FIELD_TEMPLATES: FieldTemplate[] = [FIELD_GROUPBY, FIELD_DICT]

const DEPOTS = ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro', 'Porto', 'Serra']
const PRODUCTS = ['cabo', 'placa', 'sensor', 'bateria', 'filtro']
const STATUSES = ['ok', 'pendente']

export type FieldVariant = 'sum' | 'count_where' | 'having'

export interface FieldInstance {
  seed: number
  variant: FieldVariant
  dataset: string
  schema: Array<{ table: string; columns: string[] }>
  brief: string
  /** Resultado esperado (colunas, linhas) calculado a partir dos dados. */
  expected: { columns: string[]; rows: Array<Array<string | number>> }
  ladder: [string, string, string]
  explanation: string
}

/** Gera o exercício da semente: mesmo seed, mesmo exercício. */
export function generateField(seed: number): FieldInstance {
  const r = rng(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const depots = [...DEPOTS].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * 2))
  const n = 10 + Math.floor(r() * 5)
  const rows = Array.from({ length: n }, (_, i) => ({ id: i + 1, deposito: depots[i % depots.length], produto: pick(PRODUCTS), qtd: 1 + Math.floor(r() * 20), status: pick(STATUSES) }))
  const variant: FieldVariant = (['sum', 'count_where', 'having'] as const)[seed % 3]
  const dataset = `CREATE TABLE pedidos (id INTEGER PRIMARY KEY, deposito TEXT, produto TEXT, qtd INTEGER, status TEXT);\nINSERT INTO pedidos VALUES\n${rows
    .map((x) => ` (${x.id}, '${x.deposito}', '${x.produto}', ${x.qtd}, '${x.status}')`)
    .join(',\n')};`
  const schema = [{ table: 'pedidos', columns: ['id', 'deposito', 'produto', 'qtd', 'status'] }]
  const sums = new Map<string, number>()
  for (const x of rows) sums.set(x.deposito, (sums.get(x.deposito) ?? 0) + x.qtd)

  if (variant === 'sum')
    return {
      seed,
      variant,
      dataset,
      schema,
      brief: 'Quantas unidades (qtd) cada depósito pediu no total? Mostre o depósito e a soma.',
      expected: { columns: ['deposito', 'total'], rows: [...sums].map(([d, s]) => [d, s]) },
      ladder: ['Uma linha por depósito com um total: é GROUP BY com uma função que soma.', 'O grupo é deposito; a coluna somada é qtd.', 'SELECT deposito, SUM(…) FROM pedidos GROUP BY …;'],
      explanation: 'Agrupando por deposito, cada depósito vira uma linha; SUM(qtd) soma as unidades de cada grupo. Consulta: SELECT deposito, SUM(qtd) FROM pedidos GROUP BY deposito;',
    }

  if (variant === 'count_where') {
    const status = pick(STATUSES)
    const counts = new Map<string, number>()
    for (const x of rows) if (x.status === status) counts.set(x.deposito, (counts.get(x.deposito) ?? 0) + 1)
    return {
      seed,
      variant,
      dataset,
      schema,
      brief: `Quantos pedidos com status '${status}' cada depósito tem? Mostre o depósito e a contagem (só quem tiver algum).`,
      expected: { columns: ['deposito', 'pedidos'], rows: [...counts].map(([d, c]) => [d, c]) },
      ladder: ['Primeiro escolha as linhas (WHERE), depois agrupe e conte.', `O filtro é status = '${status}'; o grupo é deposito.`, `… WHERE status = '${status}' GROUP BY deposito;`],
      explanation: `O WHERE roda antes do GROUP BY: ficam só os pedidos '${status}', que então são agrupados por depósito e contados com COUNT(*). Consulta: SELECT deposito, COUNT(*) FROM pedidos WHERE status = '${status}' GROUP BY deposito;`,
    }
  }

  // having: limiar entre o menor e o maior total, para sempre sobrar alguém (e nunca todos).
  const totals = [...sums.values()].sort((a, b) => a - b)
  let limit = totals[Math.floor(totals.length / 2) - (totals.length % 2 === 0 ? 1 : 0)]
  if (!totals.some((t) => t > limit)) limit = totals[0] - 1
  const over = [...sums].filter(([, s]) => s > limit)
  return {
    seed,
    variant,
    dataset,
    schema,
    brief: `Quais depósitos pediram MAIS de ${limit} unidades no total? Mostre o depósito e o total.`,
    expected: { columns: ['deposito', 'total'], rows: over.map(([d, s]) => [d, s]) },
    ladder: [
      'Filtrar por um TOTAL é diferente de filtrar linhas: o total só existe depois do GROUP BY.',
      'Para filtrar grupos use HAVING (o WHERE não enxerga SUM).',
      `… GROUP BY deposito HAVING SUM(qtd) > ${limit};`,
    ],
    explanation: `Agrupe por deposito, some qtd e filtre os GRUPOS com HAVING, que roda depois da agregação. Consulta: SELECT deposito, SUM(qtd) FROM pedidos GROUP BY deposito HAVING SUM(qtd) > ${limit};`,
  }
}

/** Monta o desafio do terminal para a semente (hash calculado no navegador). */
export async function fieldChallenge(seed: number): Promise<SqlChallenge> {
  const f = generateField(seed)
  const canon = canonResult({ columns: f.expected.columns, rows: f.expected.rows })
  return {
    kind: 'sql',
    id: FIELD_GROUPBY.id,
    title: FIELD_GROUPBY.title,
    speaker: 'otavia',
    brief: f.brief,
    database: `field:${seed}`,
    inline: { dataset: f.dataset, schema: f.schema },
    seed,
    starter: '-- tabela: pedidos\n',
    expect: { hash: await sha256(canon), columns: f.expected.columns.length, rows: f.expected.rows.length },
    feedback: [
      { when: { queryLacks: 'group by' }, say: 'Um total só para a tabela inteira: falta agrupar por depósito.' },
      { when: { moreRows: true }, say: 'Linhas demais: confira o grupo e o filtro.' },
      { when: { error: 'misuse of aggregate' }, say: 'Agregação no WHERE não funciona: o WHERE filtra linhas, antes de existir soma ou contagem. Para filtrar grupos, HAVING.' },
    ],
    hints: [],
    stage: FIELD_GROUPBY.stage,
    concept: FIELD_GROUPBY.concept,
    lesson: 'lesson_groupby',
    ladder: f.ladder,
    explanation: f.explanation,
    success: 'Planilha conferida. Otávia anota no caderno de campo.',
    skills: ['groupby'],
  }
}
