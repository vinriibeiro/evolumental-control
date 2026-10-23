// Vila Evolumental — o HUB. Funcionalidades viram lugares: a Sala de
// Troféus é uma sala, o Quadro de Missões é um objeto, a Rodoviária leva às
// cidades (uma por disciplina) e à cidade do próprio jogador.
import type { SqlChallenge } from '../challenges'
import type { DialogueDef, QuestDef, RegionDef } from '../engine/types'
import { canvas, exp } from './registry'

const W = 32
const H = 31

// Legenda: # cerca · . grama · , caminho · O praça · T árvore · R telhado · B parede · D porta · F flores · ~ água
// Rodoviária: Q telhado azul · W parede · K guichê · A asfalto · 1–8 ônibus (4 × 2 tiles)
const map = canvas(W, H, '.')
map.rect(0, 0, W - 1, 0, '#').rect(0, H - 1, W - 1, H - 1, '#').rect(0, 0, 0, H - 1, '#').rect(W - 1, 0, W - 1, H - 1, '#')
const building = (x: number, y: number) => {
  map.rect(x, y, x + 5, y + 1, 'R').rect(x, y + 2, x + 5, y + 2, 'B').set(x + 2, y + 2, 'D')
  map.rect(x + 2, y + 3, x + 2, y + 3, ',')
}
building(2, 1) // Biblioteca
building(13, 1) // Guilda
building(24, 1) // Oficina
building(2, 8) // Mercado
building(24, 8) // Arena
building(2, 15) // Sala de Troféus
building(24, 15) // Casa
map.rect(11, 7, 20, 13, 'O') // praça
map.rect(4, 5, 27, 5, ',') // rua norte
map.rect(15, 4, 15, 6, ',')
map.rect(4, 12, 10, 12, ',').rect(21, 12, 26, 12, ',') // ligações oeste/leste
map.rect(4, 11, 4, 11, ',').rect(26, 11, 26, 11, ',')
map.rect(15, 14, 15, 17, ',') // rua sul
map.rect(4, 18, 27, 18, ',')
map.rect(4, 19, 4, 19, ',').rect(26, 19, 26, 19, ',')
map.rect(12, 15, 13, 17, '~').rect(17, 15, 18, 17, '~')
map.rect(1, 19, 1, 20, 'T').rect(30, 19, 30, 20, 'T').set(9, 3, 'T').set(22, 3, 'T').set(10, 16, 'F').set(20, 16, 'F').set(9, 9, 'F').set(22, 9, 'F')
// Rodoviária, ao sul da praça
map.rect(15, 19, 15, 23, ',')
map.rect(5, 21, 13, 22, 'Q').rect(5, 23, 13, 23, 'W').set(8, 23, 'K').set(10, 23, 'K')
map.rect(4, 24, 27, 26, 'O')
map.rect(4, 27, 27, 29, 'A')
map.rect(17, 27, 20, 27, '1').set(18, 27, '2').set(19, 27, '3').set(20, 27, '4')
map.rect(17, 28, 20, 28, '5').set(18, 28, '6').set(19, 28, '7').set(20, 28, '8')
map.set(2, 25, 'T').set(29, 25, 'T').set(24, 22, 'F').set(26, 22, 'F')

export const HUB: RegionDef = {
  id: 'hub',
  name: 'Vila Evolumental',
  subtitle: 'Sede da Guilda dos Estudos',
  subject: null,
  palette: 'hub',
  spawn: { x: 15, y: 11 },
  map: {
    rows: map.rows(),
    legend: {
      '#': { solid: true, sprite: 'hedge' },
      '.': { solid: false, sprite: 'grass' },
      ',': { solid: false, sprite: 'path' },
      O: { solid: false, sprite: 'plaza' },
      T: { solid: true, sprite: 'tree' },
      R: { solid: true, sprite: 'roof' },
      B: { solid: true, sprite: 'wall' },
      D: { solid: true, sprite: 'door' },
      F: { solid: false, sprite: 'flowers' },
      '~': { solid: true, sprite: 'water' },
      Q: { solid: true, sprite: 'roof:#2f5f8a' },
      W: { solid: true, sprite: 'wall' },
      K: { solid: true, sprite: 'ticket_window' },
      A: { solid: false, sprite: 'asphalt' },
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 1), { solid: true, sprite: `bus_${i}` }])),
    },
  },
  entities: [
    {
      id: 'iara',
      kind: 'npc',
      x: 13,
      y: 5,
      name: 'Mestra Iara',
      sprite: 'iara',
      solid: true,
      verb: 'Falar',
      marker: { notStep: 'tutorial:report' },
      on: [
        { when: { notStep: 'tutorial:talk_iara' }, do: 'dialogue', dialogue: 'iara_intro' },
        { when: { at: 'tutorial:board' }, do: 'citychoice' },
        { when: { at: 'tutorial:report' }, do: 'dialogue', dialogue: 'iara_report' },
        { do: 'dialogue', dialogue: 'iara_idle' },
      ],
    },
    {
      id: 'quadro',
      kind: 'object',
      x: 17,
      y: 4,
      name: 'Quadro de Missões',
      sprite: 'board',
      solid: true,
      verb: 'Consultar',
      marker: { at: 'tutorial:board' },
      on: [
        { when: { notStep: 'tutorial:talk_iara' }, do: 'say', text: 'O quadro mostra pedidos de ajuda de todas as cidades. A Mestra Iara explica como funciona.' },
        { when: { at: 'tutorial:board' }, do: 'citychoice' },
        // Depois da apresentação, o quadro vira um desafio opcional de SQL.
        { when: { at: 'side_board:query' }, do: 'terminal', challenge: 'guild_board' },
        { when: { questDone: 'side_board' }, do: 'effects', effects: [{ type: 'navigate', to: '#journal' }], text: 'O quadro brilha com as missões em aberto.' },
        {
          do: 'effects',
          effects: [{ type: 'startQuest', quest: 'side_board' }],
          text: 'O quadro também responde a consultas SQL. Use-o de novo para tentar o desafio.',
        },
      ],
    },
    {
      id: 'placa_rodoviaria',
      kind: 'object',
      x: 15,
      y: 9,
      name: 'Placa da Rodoviária',
      sprite: 'sign',
      verb: 'Ler',
      on: [{ do: 'say', text: 'RODOVIÁRIA ↓ — ao sul da praça. Ônibus para todas as cidades. Passagens no balcão.' }],
    },
    {
      id: 'dora',
      kind: 'npc',
      x: 9,
      y: 24,
      name: 'Dora, bilheteira',
      sprite: 'dora',
      solid: true,
      verb: 'Comprar passagem',
      marker: { at: 'tutorial:trip' },
      on: [
        { when: { notFlag: 'map_unlocked' }, do: 'say', text: 'A bilheteria só atende quem tem registro na Guilda. Fale com a Mestra Iara primeiro.' },
        { do: 'tickets' },
      ],
    },
    {
      id: 'onibus',
      kind: 'object',
      x: 16,
      y: 26,
      name: 'Ônibus',
      sprite: 'bus_stop',
      verb: 'Embarcar',
      on: [{ when: { notFlag: 'map_unlocked' }, do: 'say', text: 'O motorista só leva quem tem passagem. A bilheteria fica no prédio da Rodoviária.' }, { do: 'bus' }],
    },
    {
      id: 'lina',
      kind: 'npc',
      x: 23,
      y: 24,
      name: 'Arquiteta Lina',
      sprite: 'lina',
      solid: true,
      verb: 'Falar',
      marker: { flag: 'city_visited', notItem: 'escritura' },
      on: [
        { when: { notFlag: 'city_visited' }, do: 'dialogue', dialogue: 'lina_wait' },
        { when: { notItem: 'escritura' }, do: 'dialogue', dialogue: 'lina_deed' },
        { do: 'dialogue', dialogue: 'lina_idle' },
      ],
    },
    {
      id: 'tomo',
      kind: 'npc',
      x: 18,
      y: 12,
      name: 'Tomo',
      sprite: 'tomo',
      solid: true,
      verb: 'Falar',
      on: [{ do: 'dialogue', dialogue: 'tomo' }],
    },
    {
      id: 'biblioteca',
      kind: 'object',
      x: 4,
      y: 4,
      name: 'Biblioteca',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Lições de SQL, sem pressa.', effects: [{ type: 'navigate', to: '/evoquest/sql' }] }],
    },
    {
      id: 'oficina',
      kind: 'object',
      x: 26,
      y: 4,
      name: 'Oficina',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Laboratórios livres de SQL e Python.', effects: [{ type: 'navigate', to: '/evoquest/laboratorio' }] }],
    },
    {
      id: 'mercado',
      kind: 'object',
      x: 4,
      y: 11,
      name: 'Mercado de cosméticos',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Só cosméticos: nada aqui se compra com dinheiro real.', effects: [{ type: 'navigate', to: '/evoquest/perfil' }] }],
    },
    {
      id: 'arena',
      kind: 'object',
      x: 26,
      y: 11,
      name: 'Arena de treino',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Treino rápido, contra o relógio e desafios de chefe clássicos.', effects: [{ type: 'navigate', to: '/evoquest/treino' }] }],
    },
    {
      id: 'trofeus',
      kind: 'object',
      x: 4,
      y: 18,
      name: 'Sala de Troféus',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Conquistas e missões diárias.', effects: [{ type: 'navigate', to: '/evoquest/missoes' }] }],
    },
    {
      id: 'casa',
      kind: 'object',
      x: 26,
      y: 18,
      name: 'Sua casa',
      sprite: 'sign',
      verb: 'Entrar',
      on: [{ do: 'effects', text: 'Perfil, títulos e histórico.', effects: [{ type: 'navigate', to: '/evoquest/historico' }] }],
    },
  ],
}

export const HUB_DIALOGUES: DialogueDef[] = [
  {
    id: 'iara_intro',
    start: 'i1',
    nodes: [
      { id: 'i1', speaker: 'iara', text: 'Que bom que você chegou, {name}. Aqui na Vila Evolumental, conhecimento não é prova: é ferramenta.', next: 'i2', effects: [{ type: 'startQuest', quest: 'tutorial' }] },
      { id: 'i2', speaker: 'iara', text: 'Cada cidade do mundo cuida de uma disciplina, e todas estão pedindo ajuda. Os pedidos chegam aqui, no Quadro de Missões da Guilda.', next: 'i3' },
      { id: 'i3', speaker: 'iara', text: 'Venha comigo até o quadro. Escolha a cidade que você quer ajudar primeiro: é para lá que você vai.' },
    ],
  },
  {
    id: 'iara_report',
    start: 'r1',
    nodes: [
      { id: 'r1', speaker: 'iara', text: '{destino}, então. Boa escolha: eles vão gostar de ver você chegar.', next: 'r2' },
      {
        id: 'r2',
        speaker: 'iara',
        text: 'Leve o Mapa do Mundo e este vale da Guilda. A Rodoviária fica ao sul da praça: vou com você até lá, e a Dora troca o vale pela sua passagem.',
        next: 'r3',
        effects: [{ type: 'give', item: 'mapa_mundo' }, { type: 'give', item: 'vale_bilhete' }],
      },
      { id: 'r3', speaker: 'iara', text: 'As próximas passagens você paga com as moedas que ganhar ajudando as cidades. Vamos?' },
    ],
  },
  {
    id: 'dora_guide',
    start: 'd1',
    nodes: [
      { id: 'd1', speaker: 'dora', text: 'Bem-vindo(a) à Rodoviária, {name}! Ah, um vale da Guilda.', next: 'd2' },
      { id: 'd2', speaker: 'dora', text: 'Uma passagem para {destino}, saindo agora. Comprada uma vez, a linha é sua para sempre. Boa viagem!' },
    ],
  },
  {
    id: 'lina_wait',
    start: 'l1',
    nodes: [{ id: 'l1', speaker: 'lina', text: 'Sou arquiteta da Prefeitura. Volte aqui depois da sua primeira viagem: tenho um terreno com o seu nome.' }],
  },
  {
    id: 'lina_deed',
    start: 'l1',
    nodes: [
      { id: 'l1', speaker: 'lina', text: 'Já conheceu uma cidade de verdade! Agora é a sua vez de construir uma.', next: 'l2' },
      { id: 'l2', speaker: 'lina', text: 'Cada lote da sua cidade recebe uma das matérias que você estuda no Control. O prédio cresce com as horas estudadas: fundação, casa, sobrado, prédio e torre.', next: 'l3' },
      {
        id: 'l3',
        speaker: 'lina',
        text: 'Aqui está a escritura. O ônibus da linha "Minha Cidade" é de graça para a proprietária ou o proprietário.',
        effects: [{ type: 'give', item: 'escritura' }, { type: 'flag', flag: 'my_city_unlocked' }, { type: 'toast', text: 'Linha "Minha Cidade" liberada no ônibus.' }],
      },
    ],
  },
  {
    id: 'lina_idle',
    start: 'l1',
    nodes: [{ id: 'l1', speaker: 'lina', text: 'A planta da sua cidade fica na Prefeitura de lá. Escolha a matéria de cada lote e estude: o resto a obra faz sozinha.' }],
  },
  {
    id: 'iara_idle',
    start: 'x1',
    nodes: [{ id: 'x1', speaker: 'iara', text: 'Quando quiser treinar sem história, a Arena e a Oficina estão abertas. E fale com o Tomo se sentir que alguma habilidade está enferrujando.' }],
  },
  {
    id: 'tomo',
    start: 't1',
    nodes: [
      {
        id: 't1',
        speaker: 'tomo',
        text: 'Habilidades enferrujam quando ficam paradas. Eu acompanho o que você aprendeu e aviso quando é hora de revisitar.',
        choices: [
          { text: 'Quero revisar agora.', effects: [{ type: 'navigate', to: '/evoquest/revisao' }] },
          { text: 'Como funciona?', next: 't2' },
          { text: 'Depois.' },
        ],
      },
      { id: 't2', speaker: 'tomo', text: 'Cada acerto empurra a próxima revisão para mais longe: 1, 3, 7, 16 e 35 dias. Errou? Volta em 10 minutos. Sem castigo — só memória.' },
    ],
  },
]

export const TUTORIAL: QuestDef = {
  id: 'tutorial',
  kind: 'main',
  title: 'A Guilda dos Estudos',
  region: 'hub',
  summary: 'Escolha a cidade que você vai ajudar e pegue o ônibus até ela.',
  rewardText: 'Mapa do Mundo e o vale da primeira passagem',
  steps: [
    { id: 'talk_iara', text: 'Fale com a Mestra Iara, em frente à Guilda.', objective: { type: 'talk', npc: 'iara', dialogueEnds: 'i3' } },
    { id: 'board', text: 'Escolha no Quadro de Missões a cidade que você vai ajudar.', objective: { type: 'flag', flag: 'city_chosen' } },
    {
      id: 'report',
      text: 'Conte à Mestra Iara qual cidade você escolheu.',
      objective: { type: 'talk', npc: 'iara', dialogueEnds: 'r3' },
      onComplete: [{ type: 'flag', flag: 'map_unlocked' }, { type: 'toast', text: 'Rodoviária liberada: escolha sua primeira cidade.' }],
    },
    {
      id: 'trip',
      text: 'Na Rodoviária, ao sul da praça, troque o vale por uma passagem e embarque para a cidade que escolher.',
      objective: { type: 'flag', flag: 'first_trip' },
    },
  ],
}

/** O antigo desafio do quadro (SQL) virou missão opcional depois da apresentação. */
export const SIDE_BOARD: QuestDef = {
  id: 'side_board',
  kind: 'side',
  title: 'O quadro que responde',
  region: 'hub',
  summary: 'O Quadro de Missões guarda os pedidos numa tabela. Faça-o mostrar só os abertos.',
  rewardText: 'XP e moedas',
  steps: [{ id: 'query', text: 'Faça o Quadro de Missões mostrar o título e a região das missões abertas.', objective: { type: 'solve', challenge: 'guild_board' }, skills: ['select', 'where'] }],
}

export const GUILD_BOARD: SqlChallenge = {
  kind: 'sql',
  id: 'guild_board',
  title: 'Quadro de Missões',
  speaker: 'iara',
  brief: 'O quadro guarda as missões na tabela missoes. Faça-o mostrar o título e a região apenas das missões abertas.',
  database: 'guild',
  starter: "SELECT titulo, regiao\nFROM missoes\nWHERE status = '____';",
  expect: exp('guild_board'),
  feedback: [
    { when: { queryHas: '____' }, say: "O quadro não entende '____'. Rode SELECT * FROM missoes para ver como os status estão escritos e troque os sublinhados." },
    { when: { error: 'no such column' }, say: 'O quadro não conhece essa coluna. As colunas estão listadas ao lado: id, titulo, regiao e status.' },
    { when: { moreRows: true, queryLacks: 'where' }, say: 'O quadro acende todas as missões de uma vez, inclusive as encerradas. Falta filtrar pelo status.' },
    { when: { noRows: true }, say: 'O quadro fica escuro: nenhuma missão tem esse status. Confira a grafia exata (sem acento, minúsculas).' },
    { when: { columns: 'more' }, say: 'As letras se embaralham: o quadro só tem espaço para o título e a região.' },
  ],
  hints: ['Experimente primeiro: SELECT * FROM missoes;', 'Os status possíveis aparecem na última coluna. Qual deles significa "disponível"?'],
  success: 'O quadro acende em dourado: "O SERVIDOR FANTASMA — Cidade dos Dados".',
  skills: ['select', 'where'],
}
