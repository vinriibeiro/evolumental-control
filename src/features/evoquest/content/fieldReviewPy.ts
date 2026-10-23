// Revisão de campo em Python: exercícios PARAMETRIZADOS de dicionários como
// acumuladores (contar, somar e filtrar por chave). Cada semente gera outra
// linha de máquinas (nomes, consumos, status e a pergunta mudam), então não dá
// para decorar a resposta — só reaplicar o conceito. Vale como evidência de
// domínio (prática independente), nunca como XP ou moedas.
//
// A resposta esperada é calculada aqui a partir dos dados gerados (não existe
// função-gabarito no pacote). Por não ter gabarito fixo, o servidor marca a
// atividade como parametrizada e limita os registros por dia.
import type { PyChallenge } from '../challenges'
import { canonCases, canonValue, sha256 } from '../challenges'
import { rng, type FieldTemplate } from './fieldCommon'

export const FIELD_DICT: FieldTemplate = { id: 'field_dict', subject: 'python', concept: 'colecoes', stage: 'independent', title: 'Revisão de campo — Dicionários', dailyLimit: 5 }

const MACHINES = ['prensa', 'torno', 'fresa', 'solda', 'pintura', 'corte', 'dobra']
const STATUSES = ['ok', 'falha']

export type PyFieldVariant = 'sum' | 'count_where' | 'threshold'

export interface Reading {
  maquina: string
  consumo: number
  status: string
}

export interface PyFieldInstance {
  seed: number
  variant: PyFieldVariant
  entry: string
  /** Entradas de cada caso: a lista de leituras (turno cheio, turno curto, sem leituras). */
  cases: Array<[Reading[]]>
  caseNames: string[]
  brief: string
  /** Resultado esperado de cada caso, calculado a partir dos dados. */
  expected: Array<Record<string, number>>
  ladder: [string, string, string]
  explanation: string
}

function readings(r: () => number, machines: string[], n: number, forceStatus?: string): Reading[] {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const rows = Array.from({ length: n }, (_, i) => ({ maquina: machines[i % machines.length], consumo: 1 + Math.floor(r() * 20), status: pick(STATUSES) }))
  // Embaralha de forma determinística para as máquinas não virem em blocos.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  if (forceStatus && rows.length) rows[0].status = forceStatus
  return rows
}

const sums = (rows: Reading[]) => {
  const out: Record<string, number> = {}
  for (const x of rows) out[x.maquina] = (out[x.maquina] ?? 0) + x.consumo
  return out
}

/** Gera o exercício da semente: mesmo seed, mesmo exercício. */
export function generatePyField(seed: number): PyFieldInstance {
  const r = rng(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const machines = [...MACHINES].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * 2))
  const variant: PyFieldVariant = (['sum', 'count_where', 'threshold'] as const)[seed % 3]
  const status = variant === 'count_where' ? pick(STATUSES) : undefined
  const full = readings(r, machines, 8 + Math.floor(r() * 5), status)
  const short = readings(r, machines.slice(0, 2), 3, status)
  const cases: Array<[Reading[]]> = [[full], [short], [[]]]
  const caseNames = ['Turno cheio', 'Turno curto', 'Sem leituras']
  const base = { seed, variant, entry: 'resumo', cases, caseNames }

  if (variant === 'sum')
    return {
      ...base,
      brief: 'Quanto cada máquina consumiu no total (campo consumo)? Escreva resumo(leituras) devolvendo um dicionário máquina → soma.',
      expected: cases.map(([rows]) => sums(rows)),
      ladder: ['Uma entrada por máquina com um total: é um dicionário acumulador, somando o consumo.', "A chave é leitura['maquina']; o valor somado é leitura['consumo'].", "total[m] = total.get(m, 0) + leitura['consumo'] dentro do for; return total no fim."],
      explanation: "Use a máquina como chave e acumule o consumo: total[m] = total.get(m, 0) + leitura['consumo'] para cada leitura; .get(m, 0) cuida da primeira vez. Sem leituras, o laço não roda e sobra o dicionário vazio.",
    }

  if (variant === 'count_where') {
    const counts = (rows: Reading[]) => {
      const out: Record<string, number> = {}
      for (const x of rows) if (x.status === status) out[x.maquina] = (out[x.maquina] ?? 0) + 1
      return out
    }
    return {
      ...base,
      brief: `Quantas leituras com status '${status}' cada máquina teve? Escreva resumo(leituras) devolvendo um dicionário máquina → contagem, só com as máquinas que tiveram alguma.`,
      expected: cases.map(([rows]) => counts(rows)),
      ladder: ['Primeiro decida se a leitura entra (if), depois acumule no dicionário.', `O filtro é leitura['status'] == '${status}'; a chave é a máquina.`, `if leitura['status'] == '${status}': contagem[m] = contagem.get(m, 0) + 1`],
      explanation: `O if roda antes de acumular: só as leituras com status '${status}' chegam ao dicionário, por isso máquinas sem esse status nem aparecem. Função: for leitura in leituras: if leitura['status'] == '${status}': contagem[m] = contagem.get(m, 0) + 1.`,
    }
  }

  // threshold: limiar entre o menor e o maior total do turno cheio, para sempre sobrar alguém (e nunca todos).
  const totals = Object.values(sums(full)).sort((a, b) => a - b)
  let limit = totals[Math.floor(totals.length / 2) - (totals.length % 2 === 0 ? 1 : 0)]
  if (!totals.some((t) => t > limit)) limit = totals[0] - 1
  const over = (rows: Reading[]) => Object.fromEntries(Object.entries(sums(rows)).filter(([, s]) => s > limit))
  return {
    ...base,
    brief: `Quais máquinas consumiram MAIS de ${limit} no total? Escreva resumo(leituras) devolvendo um dicionário máquina → total, só com elas.`,
    expected: cases.map(([rows]) => over(rows)),
    ladder: [
      'Filtrar por um TOTAL é diferente de filtrar leituras: o total só existe depois de acumular tudo.',
      'Primeiro some por máquina num dicionário; depois percorra esse dicionário e fique só com quem passou do limite.',
      `{m: t for m, t in total.items() if t > ${limit}} — ou um segundo for com if.`,
    ],
    explanation: `Dois passos: acumule o consumo por máquina (total[m] = total.get(m, 0) + leitura['consumo']) e depois filtre os PARES do dicionário, não as leituras: {m: t for m, t in total.items() if t > ${limit}}. Filtrar antes de somar daria outro resultado.`,
  }
}

/** Monta o desafio do terminal Python para a semente (hashes calculados no navegador). */
export async function pyFieldChallenge(seed: number): Promise<PyChallenge> {
  const f = generatePyField(seed)
  const cases = await Promise.all(f.expected.map((v) => sha256(canonValue(v))))
  return {
    kind: 'python',
    id: FIELD_DICT.id,
    title: FIELD_DICT.title,
    speaker: 'nadir',
    brief: f.brief,
    entry: f.entry,
    cases: f.cases,
    caseNames: f.caseNames,
    starter: 'def resumo(leituras):\n    # leituras: lista de {"maquina", "consumo", "status"}\n    pass\n',
    seed,
    expect: { hash: await sha256(canonCases(f.expected.map((value) => ({ value })))), cases },
    feedback: [
      { when: { error: 'KeyError' }, say: 'KeyError: você leu uma chave que ainda não existe. Na primeira vez que a máquina aparece, .get(chave, 0) devolve 0.' },
      { when: { result: 'none' }, say: 'A função devolveu None. Crie o dicionário, acumule no laço e devolva com return.' },
      { when: { result: 'number' }, say: 'Um número só, da linha inteira. Falta acumular POR máquina, com o nome dela como chave.' },
      { when: { onlyCase: 2 }, say: 'Sem leituras, o resultado é um dicionário vazio. Confira se a função não quebra com a lista vazia.' },
    ],
    stage: FIELD_DICT.stage,
    concept: FIELD_DICT.concept,
    lesson: 'lesson_dict',
    ladder: f.ladder,
    explanation: f.explanation,
    success: 'Leituras conferidas. Nadir anota no caderno de campo.',
    skills: ['dict', 'loop'],
  }
}
