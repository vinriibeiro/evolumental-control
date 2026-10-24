// Revisão de campo em inglês: chamadas de rádio PARAMETRIZADAS. Cada semente
// gera outro navio, outros números (0–20), outra hora ou outro nome soletrado,
// então não dá para decorar a resposta — só ouvir de novo. Vale como evidência
// de domínio (prática independente), nunca como XP ou moedas.
//
// A resposta esperada é calculada aqui a partir do que a transmissão diz. Por
// não ter gabarito fixo, o servidor marca a atividade como parametrizada e
// limita os registros por dia.
import type { EnChallenge, EnField } from '../challenges'
import { canonEnField, NUMBER_WORDS, sha256 } from '../challenges'
import { rng, type FieldTemplate } from './fieldCommon'

export const FIELD_RADIO: FieldTemplate = { id: 'field_radio', subject: 'ingles', concept: 'numbers', stage: 'independent', title: 'Revisão de campo — Rádio do Porto', dailyLimit: 5 }

/** Nomes curtos, só letras A–Z, para soletrar. */
const SHIPS = ['Kalina', 'Mira', 'Orion', 'Vega', 'Lotus', 'Nadia', 'Pilar', 'Rubi', 'Tiger', 'Luna']

export type EnFieldVariant = 'cargo' | 'spell' | 'time'

export interface EnFieldInstance {
  seed: number
  variant: EnFieldVariant
  lines: EnChallenge['lines']
  fields: EnField[]
  /** Valor esperado de cada campo, já na forma canônica (dígitos ou letras). */
  expected: string[]
  brief: string
  translation: string
  ladder: [string, string, string]
  explanation: string
}

const word = (n: number) => NUMBER_WORDS[n]
const spell = (name: string) => name.toUpperCase().split('').join(', ')

/** Gera o exercício da semente: mesma semente, mesmo exercício. */
export function generateEnField(seed: number): EnFieldInstance {
  const r = rng(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const ship = pick(SHIPS)
  const variant: EnFieldVariant = (['cargo', 'spell', 'time'] as const)[seed % 3]
  const gate = 1 + Math.floor(r() * 20)
  const base = { seed, variant }

  if (variant === 'cargo') {
    let containers = Math.floor(r() * 21)
    if (containers === gate) containers = (containers + 7) % 21
    return {
      ...base,
      lines: [{ who: `Navio ${ship}`, say: `Babel Port, this is the ${ship}. We have ${word(containers)} containers. Requesting gate ${word(gate)}.` }],
      fields: [
        { id: 'containers', label: 'Contêineres', placeholder: 'quantos', normalize: 'digits' },
        { id: 'gate', label: 'Portão', placeholder: 'número', normalize: 'digits' },
      ],
      expected: [String(containers), String(gate)],
      brief: `O ${ship} chama o Porto. Anote quantos contêineres traz e qual portão pede.`,
      translation: `Porto de Babel, aqui é o ${ship}. Temos ${containers} contêineres. Solicitamos o portão ${gate}.`,
      ladder: ['Dois números: a carga vem com "containers"; o portão vem depois de "gate".', 'Ouça o fim de cada número: -teen é 13 a 19; 0 a 12 têm nome próprio; twenty é 20.', 'Ouça devagar e repita cada número dígito a dígito antes de anotar.'],
      explanation: `O navio diz "${word(containers)} containers" (${containers}) e "gate ${word(gate)}" (${gate}). Em caso de dúvida entre -teen e -ty, o fim da palavra decide; aqui todos os números estão entre 0 e 20.`,
    }
  }

  if (variant === 'spell')
    return {
      ...base,
      lines: [{ who: 'Navio desconhecido', say: `Babel Port, this is the ${ship}. I spell: ${spell(ship)}. Requesting gate ${word(gate)}.` }],
      fields: [
        { id: 'name', label: 'Nome do navio (como foi soletrado)', placeholder: 'LETRAS', normalize: 'letters' },
        { id: 'gate', label: 'Portão', placeholder: 'número', normalize: 'digits' },
      ],
      expected: [ship.toUpperCase(), String(gate)],
      brief: 'Um navio fora da lista chama o Porto e soletra o nome. Anote o nome letra por letra e o portão pedido.',
      translation: `Porto de Babel, aqui é o ${ship}. Soletro: ${spell(ship)}. Solicitamos o portão ${gate}.`,
      ladder: ['Primeiro o nome soletrado, letra a letra; depois "gate" + número.', `O nome tem ${ship.length} letras. Lembre: A soa "êi", E soa "i", I soa "ai", Y soa "uai".`, 'Anote cada letra como foi dita, na ordem, e só depois leia o nome inteiro.'],
      explanation: `O navio soletra ${spell(ship)} — ${ship.toUpperCase()} — e pede "gate ${word(gate)}" (${gate}). Soletração se anota letra por letra, como foi dita, não como o nome pareceria se escrever.`,
    }

  const hour = 1 + Math.floor(r() * 12)
  return {
    ...base,
    lines: [
      { who: `Navio ${ship}`, say: `Babel Port, this is the ${ship}. We arrive at ${word(hour)} o'clock. Requesting gate ${word(gate)}.` },
      { who: 'Capitania', say: `${ship}, copy. Gate ${word(gate)} at ${word(hour)} o'clock.` },
    ],
    fields: [
      { id: 'hour', label: "Hora de chegada (o'clock)", placeholder: 'hora', normalize: 'digits' },
      { id: 'gate', label: 'Portão', placeholder: 'número', normalize: 'digits' },
    ],
    expected: [String(hour), String(gate)],
    brief: `O ${ship} avisa a hora de chegada e pede um portão; a Capitania confirma. Anote a hora e o portão.`,
    translation: `Porto de Babel, aqui é o ${ship}. Chegamos às ${hour} horas. Solicitamos o portão ${gate}. — ${ship}, entendido. Portão ${gate} às ${hour} horas.`,
    ladder: ['A hora vem logo antes de "o\'clock"; o portão vem depois de "gate". A Capitania repete os dois.', 'Horas vão de 1 a 12 (nomes próprios); o portão pode ser um -teen ou twenty.', 'Ouça a confirmação da Capitania devagar: ela repete os dois números na mesma ordem.'],
    explanation: `O navio diz "at ${word(hour)} o'clock" (${hour} horas) e "gate ${word(gate)}" (${gate}); a Capitania repete os dois. A confirmação é a segunda chance de ouvir cada número.`,
  }
}

/** Monta o desafio do rádio para a semente (hashes calculados no navegador). */
export async function enFieldChallenge(seed: number): Promise<EnChallenge> {
  const f = generateEnField(seed)
  const parts = await Promise.all(f.expected.map((v, i) => sha256(canonEnField(v, f.fields[i].normalize))))
  return {
    kind: 'english',
    id: FIELD_RADIO.id,
    title: FIELD_RADIO.title,
    speaker: 'marisa',
    brief: f.brief,
    lines: f.lines,
    task: { type: 'form', fields: f.fields },
    translation: f.translation,
    seed,
    expect: { hash: await sha256(f.expected.map((v, i) => canonEnField(v, f.fields[i].normalize)).join('|')), parts },
    feedback: [
      { when: { onlyField: 'gate' }, say: 'Só o portão não bateu. Ouça de novo a parte depois de "gate": -teen (13–19), nome próprio (0–12) ou twenty?' },
      { when: { onlyField: 'containers' }, say: 'Só a carga não bateu. Ouça de novo a parte antes de "containers" e repita o número dígito a dígito.' },
      { when: { onlyField: 'hour' }, say: 'Só a hora não bateu. Ouça a palavra logo antes de "o\'clock" — a Capitania repete na segunda fala.' },
      { when: { onlyField: 'name' }, say: 'Só o nome não bateu. Ouça a soletração devagar e anote letra por letra, como foi dita.' },
    ],
    stage: FIELD_RADIO.stage,
    concept: FIELD_RADIO.concept,
    lesson: f.variant === 'spell' ? 'lesson_spell' : 'lesson_numbers',
    ladder: f.ladder,
    explanation: f.explanation,
    success: 'Chamada registrada. Marisa anota no caderno de campo.',
    skills: ['listen', 'numbers'],
  }
}
