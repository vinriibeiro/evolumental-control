// Vila Evolumental — o HUB. Funcionalidades viram lugares: a Sala de
// Troféus é uma sala, o Quadro de Missões é um objeto, o Portal leva às regiões.
import type { SqlChallenge } from '../challenges'
import type { DialogueDef, QuestDef, RegionDef } from '../engine/types'
import { canvas, exp } from './registry'

const W = 32
const H = 22

// Legenda: # cerca · . grama · , caminho · O praça · T árvore · R telhado · B parede · D porta · F flores · ~ água · = ponte
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
        { when: { at: 'tutorial:board' }, do: 'dialogue', dialogue: 'iara_board' },
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
        { when: { notStep: 'tutorial:talk_iara' }, do: 'say', text: 'O quadro está apagado. Talvez a Mestra Iara saiba o que houve.' },
        { when: { at: 'tutorial:board' }, do: 'terminal', challenge: 'guild_board' },
        { do: 'effects', effects: [{ type: 'navigate', to: '#journal' }], text: 'O quadro brilha com as missões em aberto.' },
      ],
    },
    {
      id: 'portal',
      kind: 'portal',
      x: 15,
      y: 9,
      name: 'Portal das Disciplinas',
      sprite: 'portal',
      verb: 'Atravessar',
      marker: { at: 'sql_main:travel' },
      on: [{ when: { flag: 'map_unlocked' }, do: 'worldmap' }, { do: 'say', text: 'O portal pulsa, mas não reage. A Guilda guarda a chave dele.' }],
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
      {
        id: 'i2',
        speaker: 'iara',
        text: 'Nosso Quadro de Missões apagou ontem à noite. Ele só responde a quem sabe perguntar do jeito certo.',
        choices: [
          { text: 'Perguntar como?', next: 'i3' },
          { text: 'Deixa comigo.', next: 'i4' },
        ],
      },
      { id: 'i3', speaker: 'iara', text: 'Com SQL. O quadro guarda as missões numa tabela chamada missoes. Peça a ele só as que estão abertas.', next: 'i4' },
      { id: 'i4', speaker: 'iara', text: 'Ele fica logo ali, à direita da porta da Guilda. Fique de frente para ele e aperte E — ou toque em "Consultar".' },
    ],
  },
  {
    id: 'iara_board',
    start: 'b1',
    nodes: [{ id: 'b1', speaker: 'iara', text: 'Ficou em dúvida? Você pode perguntar qualquer coisa ao quadro. Comece por SELECT * FROM missoes e veja como cada status está escrito.' }],
  },
  {
    id: 'iara_report',
    start: 'r1',
    nodes: [
      { id: 'r1', speaker: 'iara', text: '"O Servidor Fantasma"... A Cidade dos Dados está pedindo ajuda há dois dias e ninguém conseguia ler o pedido.', next: 'r2' },
      { id: 'r2', speaker: 'iara', text: 'Leve este Mapa do Mundo. O Portal no centro da praça agora responde a você.', next: 'r3', effects: [{ type: 'give', item: 'mapa_mundo' }] },
      { id: 'r3', speaker: 'iara', text: 'Lá, ninguém vai te dar alternativas para marcar. Vão te dar um terminal. Boa sorte.' },
    ],
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
  summary: 'O Quadro de Missões apagou. Faça-o responder.',
  rewardText: 'Mapa do Mundo e o Portal das Disciplinas',
  steps: [
    { id: 'talk_iara', text: 'Fale com a Mestra Iara, em frente à Guilda.', objective: { type: 'talk', npc: 'iara', dialogueEnds: 'i4' } },
    { id: 'board', text: 'Faça o Quadro de Missões mostrar as missões abertas.', objective: { type: 'solve', challenge: 'guild_board' }, skills: ['select', 'where'] },
    {
      id: 'report',
      text: 'Conte à Mestra Iara o que o quadro revelou.',
      objective: { type: 'talk', npc: 'iara', dialogueEnds: 'r3' },
      onComplete: [{ type: 'flag', flag: 'map_unlocked' }, { type: 'startQuest', quest: 'sql_main' }, { type: 'toast', text: 'Portal das Disciplinas desbloqueado.' }],
    },
  ],
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
