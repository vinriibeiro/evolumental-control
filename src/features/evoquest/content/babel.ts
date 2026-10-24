// Porto de Babel — história própria da cidade de Inglês, no mesmo modelo
// pedagógico do Almoxarifado e da Usina: entender NÚMEROS (0–20) e NOMES
// SOLETRADOS de ouvido, dentro do problema do mundo.
//
//   problema   a rádio da Capitania só fala inglês; navios chamam ao mesmo
//              tempo e a operadora não dá conta de registrar portões,
//              contêineres, horas e nomes
//   lição      ficha de campo no próprio rádio (objetivo, por quê, 3 frases,
//              exemplo que o navegador lê em voz alta, erros comuns)
//   guiada     ditado curto: escrever o que o navio disse                → o painel acende
//   independ.  registro de atracação: três números de uma troca de falas → o portão do cais abre
//   combate    o atendente automático da Alfândega: o menu de voz revela a
//              opção certa; a opção errada recomeça o menu
//   transfer.  navio desconhecido: nome soletrado + números, sem ajuda
//   debrief    o que aprendeu, o que aplicou, onde teve dificuldade, o que revisar
//
// A voz é sintetizada no navegador (Web Speech), então o texto das falas
// precisa estar no pacote — a mesma proteção do modo clássico. O que o
// servidor confere é o hash da resposta canônica.
import ingles from '@/game/content/ingles'
import type { EnChallenge, InputChallenge } from '../challenges'
import type { EncounterDef } from '../engine/combat'
import type { LessonDef } from '../engine/pedagogy'
import type { DialogueDef, EntityDef, ItemDef, QuestDef, RegionDef, Speaker } from '../engine/types'
import { canvas, exp, expEn } from './registry'

export const PORT_ID = 'babel_port'
/** Linha da praça na cidade gerada de Babel (depende de quantas unidades o inglês tem). */
const PLAZA_Y = 1 + Math.ceil(ingles.units.length / 3) * 7
/** Onde o portão deixa o jogador de volta em Babel (a leste da praça). */
export const PORT_EXIT = { region: 'language_tower', x: 24.5, y: PLAZA_Y + 3.5 }
/** Onde o jogador aparece ao entrar no Porto. */
export const PORT_ENTRY = { region: PORT_ID, x: 3.5, y: 11.5 }

/** Portão do Porto, colocado na cidade gerada de Babel (praça, lado leste). */
export const PORT_GATE: EntityDef = {
  id: 'portao_porto',
  kind: 'portal',
  x: 24,
  y: PLAZA_Y + 2,
  name: 'Portão do Porto',
  sprite: 'portal',
  verb: 'Entrar',
  marker: { step: 'city_language_tower:mentor', notStep: 'en_radio:talk' },
  on: [
    { when: { notStep: 'city_language_tower:mentor' }, do: 'say', text: 'O portão do Porto está trancado. A Prefeitura, na praça, tem a chave.' },
    { do: 'effects', effects: [{ type: 'teleport', ...PORT_ENTRY }], text: 'O portão se abre. Cheiro de maresia e, ao fundo, um rádio chiando em inglês.' },
  ],
}

/** Fala extra da Prefeitura de Babel apresentando o Porto. */
export const PORT_MENTOR_HINT = 'Ah, e o Porto, a leste da praça, está um caos: a Marisa, da rádio da Capitania, pediu alguém que entenda inglês de ouvido — o portão está aberto para você.'

const W = 20
const H = 14
// Legenda: # parede · . piso · , faixa · D cais · ~ água · g portão do cais · h porta da Alfândega
const m = canvas(W, H, '#')
m.rect(1, 9, 18, 12, '.').rect(1, 10, 18, 10, ',') // Capitania (sala do rádio)
m.rect(1, 1, 13, 7, 'D').rect(1, 1, 13, 2, '~') // cais, com a água ao norte
m.rect(15, 1, 18, 7, '.') // Alfândega
m.set(10, 8, 'g').set(14, 4, 'h')

export const PORT: RegionDef = {
  id: PORT_ID,
  name: 'Porto de Babel',
  subtitle: 'Babel · Capitania e cais',
  subject: 'ingles',
  palette: 'town',
  spawn: { x: 3, y: 11 },
  onEnter: [{ type: 'flag', flag: 'city_visited' }],
  map: {
    rows: m.rows(),
    legend: {
      '#': { solid: true, sprite: 'brick' },
      '.': { solid: false, sprite: 'plaza' },
      ',': { solid: false, sprite: 'path' },
      D: { solid: false, sprite: 'dock' },
      '~': { solid: true, sprite: 'water' },
      g: { solid: true, openWhen: 'pier_gate', sprite: 'door_power' },
      h: { solid: true, openWhen: 'bot_down', sprite: 'door_core' },
    },
  },
  entities: [
    {
      id: 'portao_volta_porto',
      kind: 'portal',
      x: 1,
      y: 11,
      name: 'Portão do Porto',
      sprite: 'portal',
      verb: 'Sair',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...PORT_EXIT }], text: 'Você volta à praça de Babel.' }],
    },
    {
      id: 'marisa',
      kind: 'npc',
      x: 6,
      y: 10,
      name: 'Marisa, operadora de rádio',
      sprite: 'marisa',
      solid: true,
      verb: 'Falar',
      marker: { notStep: 'en_radio:talk' },
      on: [
        { when: { notStep: 'en_radio:talk' }, do: 'dialogue', dialogue: 'marisa_intro' },
        { when: { at: 'en_radio:debrief' }, do: 'dialogue', dialogue: 'marisa_debrief' },
        { when: { at: 'en_radio:guided' }, do: 'say', text: 'Marisa: "O rádio fica ao lado do portão do cais. A ficha de campo está no inventário (I), se quiser reler."' },
        { when: { at: 'en_radio:independent' }, do: 'say', text: 'Marisa: "Agora é o registro de verdade: contêineres, portão e hora. Ouça devagar quantas vezes precisar."' },
        { when: { at: 'en_radio:bot' }, do: 'say', text: 'Marisa: "Aquele atendente automático trava a porta da Alfândega. Ouça o menu inteiro e descubra a opção para falar com um agente."' },
        { when: { at: 'en_radio:transfer' }, do: 'say', text: 'Marisa: "Na Alfândega está o livro de atracação. Um navio que não está na lista acabou de chamar — registre o nome como ele soletrou."' },
        { when: { questDone: 'en_radio' }, do: 'debrief', quest: 'en_radio' },
        { do: 'say', text: 'Marisa: "Porto em ordem. Volte quando quiser praticar com as chamadas."' },
      ],
    },
    {
      id: 'radio',
      kind: 'object',
      x: 11,
      y: 9,
      name: 'Rádio da Capitania',
      sprite: 'radio',
      solid: true,
      verb: 'Usar rádio',
      marker: { at: 'en_radio:guided' },
      on: [
        { when: { at: 'en_radio:guided' }, do: 'terminal', challenge: 'radio_guided' },
        { when: { at: 'en_radio:independent' }, do: 'terminal', challenge: 'radio_independent' },
        { when: { notStep: 'en_radio:talk' }, do: 'say', text: 'O rádio chia em inglês: "…Babel Port, do you copy?…" Fale com a operadora.' },
        { do: 'say', text: 'Rádio da Capitania: canal livre. Todos os navios registrados.' },
      ],
    },
    {
      id: 'atendente',
      kind: 'enemy',
      x: 13,
      y: 4,
      name: 'Atendente automático da Alfândega',
      sprite: 'speaker_bot',
      solid: true,
      visible: { notFlag: 'bot_down' },
      verb: 'Atender',
      marker: { at: 'en_radio:bot' },
      on: [
        { when: { at: 'en_radio:bot' }, do: 'combat', encounter: 'enc_atendente' },
        { do: 'say', text: 'A caixa de som repete, em inglês: "Welcome to Babel Customs. Please listen to the following options…"' },
      ],
    },
    {
      id: 'mesa_campo_porto',
      kind: 'object',
      x: 9,
      y: 11,
      name: 'Mesa de revisão de campo',
      sprite: 'terminal',
      solid: true,
      verb: 'Revisar',
      visible: { questDone: 'en_radio' },
      on: [{ do: 'field', template: 'field_radio' }],
    },
    {
      id: 'livro_atracacao',
      kind: 'object',
      x: 17,
      y: 2,
      name: 'Livro de atracação',
      sprite: 'board',
      solid: true,
      verb: 'Registrar',
      marker: { at: 'en_radio:transfer' },
      on: [
        { when: { at: 'en_radio:transfer' }, do: 'terminal', challenge: 'radio_transfer' },
        { when: { flag: 'port_logged' }, do: 'say', text: 'Livro de atracação: KALINA, 18 contêineres, portão 20 — registrado à mão, letra por letra.' },
        { do: 'say', text: 'Livro de atracação da Alfândega: nome do navio, carga e portão, um navio por linha.' },
      ],
    },
  ],
}

export const PORT_SPEAKERS: Speaker[] = [
  { id: 'marisa', name: 'Marisa', role: 'Operadora de rádio da Capitania', look: { skin: '#b97a52', hair: '#1c1410', outfit: '#2a5aa8', accent: '#f5deb3' } },
  { id: 'atendente', name: 'Atendente automático', role: 'Menu de voz da Alfândega', look: { skin: '#2a313d', hair: '#38d0ff', outfit: '#3b3f46', accent: '#ff3d3d' } },
]

export const PORT_ITEMS: ItemDef[] = [
  {
    id: 'ficha_numeros',
    name: 'Ficha de campo: números e letras',
    icon: '📻',
    description: 'Resumo da lição da Marisa para consultar a qualquer momento.',
    read: [
      'NÚMEROS E LETRAS DE OUVIDO',
      '',
      '• 0 a 12 têm nome próprio: zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve.',
      '• 13 a 19 terminam em -TEEN (thirteen … nineteen); 20 é twenty. Dezenas terminam em -TY: fifteen (15) ≠ fifty (50).',
      '• Na dúvida, repita dígito a dígito: "one five" = 15.',
      '• Letras que enganam: A soa "êi", E soa "i", I soa "ai", G soa "dji", J soa "djêi", H soa "êitch", R soa "ar", Y soa "uai".',
      '• Anote a soletração letra por letra, como foi dita — não como você acha que se escreve.',
      '',
      'Pedir repetição: "Could you repeat that, please?" · Perguntar a grafia: "How do you spell it?"',
    ].join('\n'),
  },
  { id: 'selo_porto', name: 'Selo do Porto', icon: '⚓', description: 'Dado pela Marisa a quem pôs a rádio da Capitania de Babel em ordem.' },
]

export const PORT_DIALOGUES: DialogueDef[] = [
  {
    id: 'marisa_intro',
    start: 'n1',
    nodes: [
      {
        id: 'n1',
        speaker: 'marisa',
        text: 'Você veio da Guilda? Sou a Marisa, operadora de rádio da Capitania. Hoje o porto está um caos: três navios chamando em inglês ao mesmo tempo e eu sozinha no rádio.',
        next: 'n2',
        effects: [{ type: 'startQuest', quest: 'en_radio' }],
      },
      {
        id: 'n2',
        speaker: 'marisa',
        text: 'Quase tudo que eles dizem é NÚMERO — portão, contêineres, hora — e nome de navio soletrado. O rádio tem uma ficha de campo curta, e deixo uma cópia com você: números de 0 a 20 e o alfabeto, de ouvido.',
        next: 'n3',
        effects: [{ type: 'give', item: 'ficha_numeros' }],
      },
      { id: 'n3', speaker: 'marisa', text: 'O rádio fica ao lado do portão do cais. Vai lá e anota o que o próximo navio disser.' },
    ],
  },
  {
    id: 'marisa_debrief',
    start: 'd1',
    debrief: 'en_radio',
    nodes: [
      { id: 'd1', speaker: 'marisa', text: 'Portão do cais aberto, Alfândega atendendo e o Kalina no livro. Tudo isso saiu de ouvir com calma números e letras — e de pedir "devagar" sem vergonha.', next: 'd2', effects: [{ type: 'give', item: 'selo_porto' }] },
      { id: 'd2', speaker: 'marisa', text: 'Fica com o selo. E dá uma olhada no relatório de campo: ele mostra onde você foi bem e o que vale revisar.' },
    ],
  },
]

/** Caminho de aprendizagem do conceito (quadro de oportunidades). */
export const RADIO_PATH = {
  quest: 'en_radio',
  concept: 'numbers',
  unlockedBy: 'city_language_tower:mentor',
  where: 'Babel → Portão do Porto (leste da praça)',
  practice: 'Porto de Babel → mesa de revisão de campo',
  fieldTemplate: 'field_radio',
}

export const RADIO_QUEST: QuestDef = {
  id: 'en_radio',
  kind: 'mastery',
  title: 'Rádio do Porto',
  region: PORT_ID,
  summary: 'A rádio da Capitania só fala inglês e a operadora não dá conta das chamadas. Aprenda a entender números e nomes soletrados de ouvido e ponha o Porto de Babel para funcionar.',
  rewardText: 'XP, moedas, o Selo do Porto e evidência de domínio em números e soletração de ouvido',
  steps: [
    { id: 'talk', text: 'Fale com a Marisa na Capitania do Porto.', objective: { type: 'talk', npc: 'marisa', dialogueEnds: 'n3' } },
    { id: 'guided', text: 'No rádio, anote o que o navio disse (ditado guiado).', objective: { type: 'solve', challenge: 'radio_guided' }, skills: ['listen', 'numbers'] },
    {
      id: 'independent',
      text: 'Agora preencha o registro de atracação de ouvido para abrir o portão do cais.',
      objective: { type: 'solve', challenge: 'radio_independent' },
      skills: ['listen', 'numbers'],
      onComplete: [{ type: 'flag', flag: 'pier_gate' }, { type: 'toast', text: 'O portão do cais subiu.' }],
    },
    {
      id: 'bot',
      text: 'Passe pelo atendente automático que bloqueia a Alfândega.',
      objective: { type: 'solve', challenge: 'enc_atendente' },
      skills: ['listen', 'numbers'],
      onComplete: [{ type: 'flag', flag: 'bot_down' }],
    },
    {
      id: 'transfer',
      text: 'No livro de atracação, registre o navio desconhecido: nome soletrado, carga e portão.',
      objective: { type: 'solve', challenge: 'radio_transfer' },
      skills: ['listen', 'numbers', 'spell', 'transfer'],
      onComplete: [{ type: 'flag', flag: 'port_logged' }],
    },
    { id: 'debrief', text: 'Conte à Marisa o que descobriu.', objective: { type: 'talk', npc: 'marisa', dialogueEnds: 'd2' } },
  ],
  onComplete: [{ type: 'toast', text: 'Rádio do Porto em ordem!' }],
}

export const LESSON_NUMBERS: LessonDef = {
  id: 'lesson_numbers',
  subject: 'ingles',
  concept: 'numbers',
  conceptName: 'Números de 0 a 20',
  title: 'Ficha de campo: números de ouvido',
  learningObjective: 'Entender de ouvido números de 0 a 20 ditos em inglês — portões, horários, quantidades — e anotá-los certo.',
  prerequisites: ['ler os números de 0 a 20 em inglês'],
  whyItMatters: 'No rádio, no aeroporto, numa ligação: quase toda informação prática vem com um número. Trocar fifteen por fifty é errar o portão.',
  explanation: [
    'De 0 a 12 cada número tem nome próprio: zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve.',
    'De 13 a 19 termina em -teen, com a força no fim: thirTEEN, fourTEEN, fifTEEN, sixTEEN, sevenTEEN, eighTEEN, nineTEEN. Twenty é 20.',
    'Na dúvida entre -teen e -ty (fifteen × fifty), ouça o fim da palavra e confirme repetindo dígito a dígito: "one five".',
  ],
  workedExample: {
    lang: 'speech',
    caption: 'Ouça (normal e devagar) acompanhando o texto: o número vem inteiro e depois dígito a dígito.',
    code: 'Gate number fourteen. I repeat: one, four.',
  },
  commonMistakes: [
    'Confundir -teen com -ty: fifteen (15) × fifty (50), thirteen (13) × thirty (30).',
    'Anotar o que achou que ouviu sem ouvir de novo devagar: no rádio, repetir é de graça.',
    'Trocar eight (8) por eighteen (18): o -teen é o que separa.',
  ],
}

export const LESSON_SPELL: LessonDef = {
  id: 'lesson_spell',
  subject: 'ingles',
  concept: 'spell',
  conceptName: 'Alfabeto e soletrar',
  title: 'Ficha de campo: nomes soletrados',
  learningObjective: 'Anotar um nome soletrado em inglês letra por letra, sem trocar as letras que soam parecido com outras em português.',
  prerequisites: ['o alfabeto em inglês'],
  whyItMatters: 'Nome de pessoa, de navio, de rua, de usuário: em inglês, tudo que não se adivinha se soletra. Quem anota errado registra o navio errado.',
  explanation: [
    'Nomes são soletrados letra a letra. Para pedir: "How do you spell it?"; para confirmar, repita de volta: "K, A, L — correct?".',
    'Letras que enganam quem fala português: A soa "êi", E soa "i", I soa "ai", G soa "dji", J soa "djêi", H soa "êitch", R soa "ar", Y soa "uai".',
    'Anote cada letra conforme ouve, na ordem, e só depois leia o nome inteiro — não escreva como acha que se escreve.',
  ],
  workedExample: {
    lang: 'speech',
    caption: 'Ouça o nome dito inteiro e depois soletrado, letra por letra.',
    code: 'My name is Ana. A, N, A.',
  },
  commonMistakes: [
    'Ouvir E ("i") e escrever I; ouvir I ("ai") e escrever Y.',
    'Escrever o nome como ele se escreveria em português em vez do que foi soletrado.',
    'Perder uma letra e não pedir repetição: "Could you repeat that, please?"',
  ],
}

const en = (c: Omit<EnChallenge, 'kind' | 'expect'>): EnChallenge => ({ kind: 'english', expect: expEn(c.id), ...c })

export const PORT_CHALLENGES: EnChallenge[] = [
  en({
    id: 'radio_guided',
    title: 'Rádio — a chamada do Blue Star',
    speaker: 'marisa',
    stage: 'guided',
    concept: 'numbers',
    lesson: 'lesson_numbers',
    brief: 'A Marisa precisa do registro exato da chamada. Ouça a transmissão (quantas vezes quiser, normal ou devagar) e escreva, em inglês, exatamente o que o navio disse.',
    lines: [{ who: 'Navio Blue Star', say: 'Hello, Babel. This is the Blue Star. Gate seven, please.' }],
    task: { type: 'dictation', prompt: 'Escreva aqui o que o navio disse, em inglês' },
    translation: 'Olá, Babel. Aqui é o Blue Star. Portão sete, por favor.',
    feedback: [
      // Primeiro o tamanho (faltou/sobrou), depois o número: com tudo anotado, o erro típico é o portão.
      { when: { length: 'fewer' }, say: 'Faltaram palavras. Ouça de novo devagar e anote palavra por palavra — pontuação e maiúsculas não importam.' },
      { when: { length: 'more' }, say: 'Sobraram palavras. A transmissão é curta: cumprimento, nome do navio e o pedido do portão.' },
      { when: { missing: 'seven' }, say: 'O número do portão não bateu. Ouça de novo devagar: é um número de 0 a 12, com nome próprio — não termina em -teen.' },
    ],
    ladder: [
      'A transmissão tem três partes: um cumprimento, "this is the" + nome do navio e "gate" + número + "please".',
      'O número está entre 0 e 12 — nome próprio, sem -teen. O nome do navio são duas palavras em inglês: uma cor e uma coisa do céu.',
      'Começa com "Hello, Babel. This is the Blue Star." — falta só a parte do portão.',
    ],
    explanation:
      'A frase inteira é "Hello, Babel. This is the Blue Star. Gate seven, please." São três partes: cumprimento (Hello, Babel), identificação (This is the Blue Star) e pedido (Gate seven, please). Seven = 7: nome próprio, de 0 a 12, sem -teen.',
    success: 'Marisa confere o registro e acende a luz verde do painel: "Blue Star, portão sete. Perfeito."',
    skills: ['listen', 'numbers'],
  }),
  en({
    id: 'radio_independent',
    title: 'Rádio — registro de atracação',
    speaker: 'marisa',
    stage: 'independent',
    concept: 'numbers',
    lesson: 'lesson_numbers',
    brief: 'Agora sem transcrição pronta: ouça a troca de mensagens entre o navio e a Capitania e preencha o registro de atracação — quantos contêineres, qual portão e a que hora.',
    lines: [
      { who: 'Navio Golden Fish', say: 'Babel Port, this is the Golden Fish. We have fifteen containers. Requesting gate eleven.' },
      { who: 'Capitania', say: "Golden Fish, copy. Gate eleven at four o'clock." },
    ],
    task: {
      type: 'form',
      fields: [
        { id: 'containers', label: 'Contêineres', placeholder: 'quantos', normalize: 'digits' },
        { id: 'gate', label: 'Portão', placeholder: 'número', normalize: 'digits' },
        { id: 'hour', label: 'Hora (o\'clock)', placeholder: 'hora', normalize: 'digits' },
      ],
    },
    translation: 'Porto de Babel, aqui é o Golden Fish. Temos quinze contêineres. Solicitamos o portão onze. — Golden Fish, entendido. Portão onze às quatro horas.',
    feedback: [
      { when: { onlyField: 'containers' }, say: 'O número de contêineres não bateu: fifteen ou fifty? Ouça o fim da palavra — -teen é de 13 a 19.' },
      { when: { onlyField: 'gate' }, say: 'O portão não bateu. Eleven e twelve têm nome próprio; cuidado para não confundir eleven (11) com seven (7).' },
      { when: { onlyField: 'hour' }, say: 'A hora não bateu: a Capitania confirma "at … o\'clock" na segunda fala. Ouça só ela, devagar.' },
    ],
    ladder: [
      'Cada campo é um número: dois ditos pelo navio (carga e portão) e um dito pela Capitania (a hora).',
      'Contêineres: termina em -teen (13 a 19). Portão: nome próprio, entre 10 e 12. Hora: a palavra logo antes de "o\'clock".',
      'Fifteen = 15 e eleven = 11 na fala do navio; "at four o\'clock" na resposta da Capitania.',
    ],
    explanation:
      'O navio diz "fifteen containers" (15) e "gate eleven" (11); a Capitania confirma "gate eleven at four o\'clock" (4 horas). Fifteen termina em -teen; eleven e twelve são os únicos entre 10 e 19 que não terminam em -teen; four é um dos nomes próprios de 0 a 12.',
    success: 'CLANK. O portão do cais sobe: Golden Fish, 15 contêineres, portão 11, às 4. Lá fora, uma caixa de som repete "Welcome to Babel Customs…"',
    skills: ['listen', 'numbers'],
  }),
  en({
    id: 'radio_menu',
    title: 'Atendente — menu de voz da Alfândega',
    speaker: 'atendente',
    stage: 'independent',
    concept: 'numbers',
    lesson: 'lesson_numbers',
    brief: 'O atendente automático só libera a porta pela opção certa. Ouça o menu inteiro e anote o número de cada opção: lista de portões, horários e falar com um agente.',
    lines: [{ who: 'Atendente', say: 'Welcome to Babel Customs. For the gate list, press three. For opening hours, press twelve. To speak to an officer, press nineteen. To repeat this menu, press zero.' }],
    task: {
      type: 'form',
      fields: [
        { id: 'gates', label: 'Lista de portões (gate list)', placeholder: 'press…', normalize: 'digits' },
        { id: 'hours', label: 'Horários (opening hours)', placeholder: 'press…', normalize: 'digits' },
        { id: 'officer', label: 'Falar com um agente (officer)', placeholder: 'press…', normalize: 'digits' },
      ],
    },
    translation: 'Bem-vindo à Alfândega de Babel. Para a lista de portões, tecle três. Para os horários de funcionamento, tecle doze. Para falar com um agente, tecle dezenove. Para repetir este menu, tecle zero.',
    feedback: [
      { when: { onlyField: 'officer' }, say: 'A opção para falar com um agente não bateu: nineteen (19) ou ninety (90)? Ouça o fim da palavra — -teen.' },
      { when: { onlyField: 'hours' }, say: 'A opção dos horários não bateu: twelve (12) tem nome próprio e não termina em -teen.' },
      { when: { onlyField: 'gates' }, say: 'A opção da lista de portões não bateu: é um número pequeno, de 0 a 12, com nome próprio.' },
    ],
    ladder: [
      'São quatro opções, cada uma com "press" + número. Você precisa das três primeiras.',
      'Lista de portões: 0 a 12. Horários: também nome próprio (10 a 12). Agente: termina em -teen.',
      'Three = 3, twelve = 12, nineteen = 19 (a opção zero só repete o menu).',
    ],
    explanation:
      'O menu diz "for the gate list, press three" (3), "for opening hours, press twelve" (12) e "to speak to an officer, press nineteen" (19); "press zero" só repete o menu. Nineteen termina em -teen; ninety (90) terminaria em -ty.',
    success: 'Menu anotado: 3 — lista de portões, 12 — horários, 19 — falar com um agente. O atendente espera a tecla.',
    skills: ['listen', 'numbers'],
  }),
  en({
    id: 'radio_transfer',
    title: 'Livro de atracação — navio desconhecido',
    speaker: 'marisa',
    stage: 'transfer',
    concept: 'spell',
    lesson: 'lesson_spell',
    brief: 'Um navio que não está na lista chama o Porto. Registre no livro o nome exatamente como foi soletrado, quantos contêineres traz e qual portão pede. Agora são letras e números juntos, sem a Marisa por perto.',
    lines: [{ who: 'Navio desconhecido', say: 'Babel Port, this is the Kalina. I spell: K, A, L, I, N, A. We have eighteen containers. Requesting gate twenty.' }],
    task: {
      type: 'form',
      fields: [
        { id: 'name', label: 'Nome do navio (como foi soletrado)', placeholder: 'LETRAS', normalize: 'letters' },
        { id: 'containers', label: 'Contêineres', placeholder: 'quantos', normalize: 'digits' },
        { id: 'gate', label: 'Portão', placeholder: 'número', normalize: 'digits' },
      ],
    },
    translation: 'Porto de Babel, aqui é o Kalina. Soletro: K, A, L, I, N, A. Temos dezoito contêineres. Solicitamos o portão vinte.',
    feedback: [
      { when: { onlyField: 'name' }, say: 'O nome não bateu. Ouça a soletração devagar, letra a letra: A soa "êi", E soa "i", I soa "ai". Escreva o que foi soletrado, não como você acha que se escreve.' },
      { when: { onlyField: 'containers' }, say: 'Contêineres: eighteen (18) ou eight (8)? O -teen muda tudo.' },
      { when: { onlyField: 'gate' }, say: 'O portão: twenty (20) termina em -ty — é a dezena, não um -teen.' },
    ],
    ladder: [
      'Três informações, na ordem em que aparecem: o nome soletrado, a quantidade e o portão.',
      'O nome tem seis letras; cuidado com I ("ai") e A ("êi"). Dos números, um termina em -teen e o outro em -ty.',
      'As letras são K, A, L, I, N, A; eighteen = 18; twenty = 20.',
    ],
    explanation:
      'O navio soletra K-A-L-I-N-A (as letras I e A soam "ai" e "êi"), diz "eighteen containers" (18, com -teen; eight seria 8) e pede "gate twenty" (20, com -ty: a dezena). No livro ficam KALINA, 18 e 20.',
    success: 'Registrado: KALINA, 18 contêineres, portão 20. Marisa, pelo rádio: "Agora a Alfândega tem com o que trabalhar."',
    skills: ['listen', 'numbers', 'spell', 'transfer'],
  }),
]

export const PORT_INPUTS: InputChallenge[] = [{ kind: 'input', id: 'radio_officer', title: 'Teclar a opção', brief: 'press <número>', normalize: 'digits', expect: exp('radio_officer') }]

export const ATTENDANT: EncounterDef = {
  id: 'enc_atendente',
  name: 'Atendente automático da Alfândega',
  portrait: 'speaker_bot',
  intro: 'Uma caixa de som bloqueia a porta da Alfândega repetindo o menu em inglês. Desligar não adianta: ela só libera a porta pela opção certa.',
  integrity: 100,
  firewall: 2,
  maxFirewall: 4,
  signal: 4,
  panels: [{ id: 'diag', label: 'Etiqueta', content: 'MENU DE VOZ — Para liberar a porta, tecle a opção "falar com um agente" (speak to an officer).\nO menu só fala inglês. Opção errada reinicia o menu.' }],
  actions: [
    { id: 'examinar', label: 'Examinar', description: 'Lê a etiqueta colada na caixa de som.', kind: 'scan', reveals: 'diag', learns: 'diag', success: 'A etiqueta explica o menu.', free: true },
    { id: 'ouvir', label: 'Ouvir o menu', description: 'Abre o rádio e ouve o menu de voz inteiro.', kind: 'terminal', challenge: 'radio_menu', requires: ['diag'], learns: 'menu', success: 'Você tem o número de cada opção.' },
    {
      id: 'teclar',
      label: 'Teclar',
      description: 'Tecla a opção para falar com um agente.',
      kind: 'input',
      challenge: 'radio_officer',
      input: { prompt: 'press', placeholder: 'número (ex.: 3)' },
      requires: ['menu'],
      learns: 'opened',
      damage: 100,
      ignoresFirewall: true,
      success: 'Opção aceita',
      wrong: { signal: 1, firewall: 1, text: 'Opção errada: "Invalid option." O atendente recomeça o menu (+1 firewall, −1 sinal).' },
    },
    { id: 'desligar', label: 'Desligar da tomada', description: 'Força bruta. A caixa religa sozinha.', kind: 'attack', damage: 10, success: 'Você puxa o fio da tomada' },
  ],
  pattern: [{ text: 'A caixa de som repete o menu do início (+1 firewall).', firewall: 1 }, { text: 'Um apito agudo embaralha o rádio (−1 sinal).', signal: 1 }, { text: 'A caixa de som fica em silêncio por um instante. Nada mais acontece.' }],
  victory: 'A caixa de som responde: "Connecting you to an officer." A porta da Alfândega destrava.',
  defeat: 'O menu recomeça pela quinta vez e você desiste por ora. Releia a etiqueta e tente de novo.',
}
