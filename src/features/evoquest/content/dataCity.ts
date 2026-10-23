// Cidade dos Dados — fatia vertical do novo EvoQuest (SQL).
// Missão principal "O Servidor Fantasma", duas secundárias, a Sentinela
// (combate por ações), o painel de energia (lógica) e o chefe em 4 fases.
import type { InputChallenge, SqlChallenge, SwitchPuzzle } from '../challenges'
import type { EncounterDef } from '../engine/combat'
import type { DialogueDef, QuestDef, RegionDef } from '../engine/types'
import { STATION_SPOT } from './cities'
import { canvas, exp, type BossDef } from './registry'

const W = 34
const H = 24

// Legenda: # parede · . piso · , faixa de luz · S rack de servidores · d/c/p portas
// (segurança, núcleo, energia) · L piso do núcleo · ~ canaleta
const m = canvas(W, H, '#')
m.rect(1, 1, 11, 6, '.').rect(1, 1, 11, 1, 'S') // sala de segurança
m.rect(13, 1, 21, 6, 'L').rect(13, 1, 15, 1, 'S').rect(19, 1, 21, 1, 'S') // núcleo
m.rect(23, 1, 32, 6, '.').rect(23, 1, 32, 1, 'S') // sala de energia
m.set(6, 7, 'd').set(17, 7, 'c').set(27, 7, 'p')
m.rect(1, 8, 32, 12, '.').rect(1, 10, 32, 10, ',') // corredor principal
m.rect(20, 8, 22, 9, '#').rect(20, 11, 22, 12, '#') // passagem estreita (a Sentinela guarda)
m.set(6, 13, '.').set(27, 13, '.')
m.rect(1, 14, 11, 22, '.') // saguão
m.rect(23, 14, 32, 22, '.').rect(23, 20, 32, 20, '~') // subsolo
m.rect(1, 14, 1, 15, 'S').rect(11, 14, 11, 15, 'S')

export const DATA_CITY: RegionDef = {
  id: 'data_city',
  name: 'Cidade dos Dados',
  subtitle: 'Distrito Relacional',
  subject: 'sql',
  palette: 'data',
  spawn: { x: 6, y: 19 },
  onEnter: [{ type: 'startQuest', quest: 'sql_main' }, { type: 'flag', flag: 'city_visited' }],
  map: {
    rows: m.rows(),
    legend: {
      '#': { solid: true, sprite: 'metal_wall' },
      '.': { solid: false, sprite: 'metal_floor' },
      ',': { solid: false, sprite: 'neon_floor' },
      S: { solid: true, sprite: 'rack' },
      L: { solid: false, sprite: 'core_floor' },
      '~': { solid: false, sprite: 'cable' },
      d: { solid: true, openWhen: 'door_security', sprite: 'door_security' },
      c: { solid: true, openWhen: 'power_on', sprite: 'door_core' },
      p: { solid: true, openWhen: 'power_access', sprite: 'door_power' },
    },
  },
  entities: [
    {
      id: 'saida',
      kind: 'portal',
      x: 2,
      y: 21,
      name: 'Ponto de ônibus',
      sprite: 'bus_stop',
      verb: 'Embarcar',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...STATION_SPOT }], text: 'O ônibus leva você de volta à Rodoviária da Vila Evolumental.' }],
    },
    {
      id: 'maya',
      kind: 'npc',
      x: 8,
      y: 17,
      name: 'Maya Kort',
      sprite: 'maya',
      solid: true,
      verb: 'Falar',
      marker: { at: 'sql_main:talk_maya' },
      on: [
        { when: { at: 'sql_main:talk_maya' }, do: 'dialogue', dialogue: 'maya_intro' },
        { when: { at: 'sql_main:finale' }, do: 'dialogue', dialogue: 'maya_finale' },
        { when: { at: 'sql_main:door' }, do: 'say', text: 'Maya: "O terminal fica ao lado da porta, no corredor. Ativos, nível 4 ou mais."' },
        { when: { at: 'sql_main:logs' }, do: 'say', text: 'Maya: "Ninguém trabalha de madrugada aqui. Se tem UPDATE às 3 da manhã, é o nosso fantasma."' },
        { when: { at: 'sql_main:who' }, do: 'say', text: 'Maya: "Os logs só têm o employee_id. O nome está em employees. Junte as duas tabelas."' },
        { when: { at: 'sql_main:sentinel' }, do: 'say', text: 'Maya: "A Sentinela não cai na força bruta. Descubra o que a está controlando."' },
        { when: { questDone: 'sql_main' }, do: 'say', text: 'Maya: "A cidade está respirando de novo. Volte quando quiser — sempre tem dado esquisito por aqui."' },
        { do: 'say', text: 'Maya: "Estou acompanhando tudo pelos monitores. Siga em frente."' },
      ],
    },
    {
      id: 'terminal_porta',
      kind: 'object',
      x: 8,
      y: 8,
      name: 'Terminal da porta de segurança',
      sprite: 'terminal',
      solid: true,
      verb: 'Usar terminal',
      marker: { at: 'sql_main:door' },
      on: [
        { when: { at: 'sql_main:door' }, do: 'terminal', challenge: 'sql_door' },
        { when: { flag: 'door_security' }, do: 'say', text: 'PORTA LIBERADA — 5 crachás autorizados.' },
        { do: 'say', text: 'ACESSO RESTRITO. Fale com a equipe de análise no saguão.' },
      ],
    },
    {
      id: 'bras',
      kind: 'npc',
      x: 8,
      y: 4,
      name: 'Brás Teles',
      sprite: 'bras',
      solid: true,
      verb: 'Falar',
      marker: { at: 'sql_main:talk_bras' },
      on: [
        { when: { at: 'sql_main:talk_bras' }, do: 'dialogue', dialogue: 'bras_meet' },
        { when: { at: 'side_badges:report' }, do: 'dialogue', dialogue: 'bras_badges_done' },
        { when: { step: 'sql_main:talk_bras', notStep: 'side_badges:find' }, do: 'dialogue', dialogue: 'bras_badges' },
        { do: 'say', text: 'Brás: "Estou de olho. Em tudo."' },
      ],
    },
    {
      id: 'terminal_logs',
      kind: 'object',
      x: 2,
      y: 3,
      name: 'Terminal de logs',
      sprite: 'terminal',
      solid: true,
      verb: 'Usar terminal',
      marker: { at: 'sql_main:logs' },
      on: [
        { when: { at: 'sql_main:logs' }, do: 'terminal', challenge: 'sql_logs' },
        { when: { at: 'sql_main:who' }, do: 'terminal', challenge: 'sql_who' },
        { when: { at: 'side_badges:find' }, do: 'terminal', challenge: 'sql_badges' },
        { do: 'say', text: 'O terminal mostra o cursor piscando. Nada mais a investigar aqui por enquanto.' },
      ],
    },
    {
      id: 'sentinela',
      kind: 'enemy',
      x: 21,
      y: 10,
      name: 'Sentinela S-7',
      sprite: 'sentinel',
      solid: true,
      visible: { notFlag: 'sentinel_down' },
      verb: 'Enfrentar',
      marker: { at: 'sql_main:sentinel' },
      on: [
        { when: { at: 'sql_main:sentinel' }, do: 'combat', encounter: 'enc_sentinel' },
        { do: 'say', text: 'A Sentinela gira o sensor vermelho na sua direção. "ACESSO NEGADO." Melhor investigar antes.' },
      ],
    },
    {
      id: 'ze',
      kind: 'npc',
      x: 25,
      y: 16,
      name: 'Zé Pixel',
      sprite: 'ze',
      solid: true,
      verb: 'Falar',
      marker: { at: 'sql_main:talk_ze' },
      on: [
        { when: { at: 'sql_main:talk_ze' }, do: 'dialogue', dialogue: 'ze_manual' },
        { when: { at: 'side_cafe:report' }, do: 'dialogue', dialogue: 'ze_cafe_done' },
        { when: { step: 'sql_main:talk_ze', notStep: 'side_cafe:find' }, do: 'dialogue', dialogue: 'ze_cafe' },
        { do: 'say', text: 'Zé: "Se o painel morder, não fui eu que avisei. Quer dizer, fui sim."' },
      ],
    },
    {
      id: 'cafeteira',
      kind: 'object',
      x: 31,
      y: 15,
      name: 'Máquina de café do subsolo',
      sprite: 'coffee',
      solid: true,
      verb: 'Ler registros',
      marker: { at: 'side_cafe:find' },
      on: [
        { when: { at: 'side_cafe:find' }, do: 'terminal', challenge: 'sql_cafe' },
        { do: 'say', text: 'A máquina ronca. Cheiro de café queimado.' },
      ],
    },
    {
      id: 'painel',
      kind: 'object',
      x: 28,
      y: 3,
      name: 'Painel de energia',
      sprite: 'panel',
      solid: true,
      verb: 'Mexer no painel',
      marker: { at: 'sql_main:power' },
      on: [
        { when: { at: 'sql_main:power' }, do: 'puzzle', puzzle: 'puzzle_power' },
        { when: { flag: 'power_on' }, do: 'say', text: 'Os quatro disjuntores zumbem em harmonia. Núcleo energizado.' },
        { do: 'say', text: 'Quatro disjuntores: A, B, C e D. Sem o manual, mexer aqui é loteria.' },
      ],
    },
    {
      id: 'root',
      kind: 'enemy',
      x: 17,
      y: 3,
      name: 'ROOT',
      sprite: 'root',
      solid: true,
      visible: { notFlag: 'root_defeated' },
      verb: 'Enfrentar',
      marker: { at: 'sql_main:boss_logs' },
      on: [{ do: 'boss', boss: 'boss_root' }],
    },
  ],
}

export const DATA_CITY_DIALOGUES: DialogueDef[] = [
  {
    id: 'maya_intro',
    start: 'm1',
    nodes: [
      { id: 'm1', speaker: 'maya', text: 'Você é da Guilda? Ótimo. Eu sou a Maya, analista. Temos um fantasma no servidor.', next: 'm2' },
      {
        id: 'm2',
        speaker: 'maya',
        text: 'Desde ontem à noite, registros mudam sozinhos. Portas trancam, a folha de pagamento enlouqueceu e a Sentinela do corredor começou a barrar a equipe.',
        choices: [
          { text: 'Fantasma? Sério?', next: 'm3' },
          { text: 'Por onde eu começo?', next: 'm4' },
        ],
      },
      { id: 'm3', speaker: 'maya', text: 'Fantasmas não digitam UPDATE. Alguém digita. Vamos descobrir quem.', next: 'm4' },
      {
        id: 'm4',
        speaker: 'maya',
        text: 'A sala de segurança trancou. O terminal da porta, no corredor, só libera crachás de funcionários ATIVOS com nível de acesso 4 ou mais. Encontre essas pessoas no banco e a porta reconhece os crachás.',
      },
    ],
  },
  {
    id: 'maya_finale',
    start: 'f1',
    nodes: [
      { id: 'f1', speaker: 'maya', text: 'A folha bate com os contratos. Os fantasmas sumiram. E a Sentinela voltou a cumprimentar as pessoas, o que é quase assustador.', next: 'f2' },
      { id: 'f2', speaker: 'maya', text: 'ROOT usava a credencial da Renata desde que ela saiu de férias. Já trocamos todas as senhas — e desativamos aqueles crachás parados.', next: 'f3' },
      { id: 'f3', speaker: 'maya', text: 'A cidade te deve uma. Leve isto: aqui, quem tem o emblema é tratado como da casa.', effects: [{ type: 'give', item: 'nucleo_restaurado' }] },
    ],
  },
  {
    id: 'bras_meet',
    start: 'b1',
    nodes: [
      {
        id: 'b1',
        speaker: 'bras',
        text: 'Quem abriu a minha porta? Identifique-se.',
        choices: [
          { text: 'Sou da Guilda dos Estudos. A Maya pediu ajuda.', next: 'b2', effects: [{ type: 'rel', npc: 'bras', delta: 1 }] },
          { text: 'Sou da manutenção.', next: 'b3', effects: [{ type: 'rel', npc: 'bras', delta: -1 }] },
        ],
      },
      { id: 'b2', speaker: 'bras', text: 'A Guilda. Hum. Então você sabe ler um log. Tome um crachá temporário: ele abre a sala de energia.', next: 'b4', effects: [{ type: 'give', item: 'cracha_temporario' }, { type: 'flag', flag: 'power_access' }] },
      { id: 'b3', speaker: 'bras', text: 'Manutenção? Conheço todo mundo da manutenção, e você não é. ...Se a Maya confia, eu tolero. Crachá temporário. Não me faça me arrepender.', next: 'b4', effects: [{ type: 'give', item: 'cracha_temporario' }, { type: 'flag', flag: 'power_access' }] },
      { id: 'b4', speaker: 'bras', text: 'O terminal de logs fica no canto, à esquerda. Procure alterações fora do expediente. Aqui ninguém trabalha de madrugada.' },
    ],
  },
  {
    id: 'bras_badges',
    start: 'bs1',
    nodes: [
      {
        id: 'bs1',
        speaker: 'bras',
        text: 'Já que está aqui: tem crachá emitido que nunca passou em porta nenhuma. Crachá parado é crachá que alguém pode clonar. Descubra quais são — o terminal de logs também acessa badges e badge_uses.',
        choices: [{ text: 'Eu descubro.', effects: [{ type: 'startQuest', quest: 'side_badges' }] }, { text: 'Agora não.' }],
      },
    ],
  },
  {
    id: 'bras_badges_done',
    start: 'bd1',
    nodes: [
      { id: 'bd1', speaker: 'bras', text: 'B-04, B-06 e B-08. Um deles é da Renata. Desativei os três agora mesmo.', next: 'bd2' },
      { id: 'bd2', speaker: 'bras', text: 'Você tem bons olhos. Eu não costumo dizer isso.', effects: [{ type: 'rel', npc: 'bras', delta: 1 }] },
    ],
  },
  {
    id: 'ze_manual',
    start: 'z1',
    nodes: [
      { id: 'z1', speaker: 'ze', text: 'Opa! A Sentinela caiu? Você é das minhas. Sou o Zé, cuido de tudo que tem fio aqui embaixo.', next: 'z2' },
      { id: 'z2', speaker: 'ze', text: 'Vai religar o núcleo? Sem energia, a porta dele não abre. O painel fica na sala de energia, lá em cima à direita.', next: 'z3' },
      { id: 'z3', speaker: 'ze', text: 'Leva meu manual. Lê com calma (tecla I abre o inventário), que aquele painel morde.', effects: [{ type: 'give', item: 'manual_painel' }] },
    ],
  },
  {
    id: 'ze_cafe',
    start: 'zc1',
    nodes: [
      {
        id: 'zc1',
        speaker: 'ze',
        text: 'Pergunta séria: em que dia a máquina AQUI DO SUBSOLO serviu mais café? Apostei com o Brás que foi numa sexta. Os registros estão na própria máquina.',
        choices: [{ text: 'Vou olhar os registros.', effects: [{ type: 'startQuest', quest: 'side_cafe' }] }, { text: 'Depois.' }],
      },
    ],
  },
  {
    id: 'ze_cafe_done',
    start: 'zd1',
    nodes: [
      { id: 'zd1', speaker: 'ze', text: 'Dia 20?! Uma terça?! ...Perdi a aposta. O Brás vai ficar insuportável.', next: 'zd2' },
      { id: 'zd2', speaker: 'ze', text: 'Toma, uma ficha de café. Pelo menos alguém aqui sabe somar direito.', effects: [{ type: 'give', item: 'ficha_cafe' }, { type: 'rel', npc: 'ze', delta: 1 }] },
    ],
  },
]

export const DATA_CITY_QUESTS: QuestDef[] = [
  {
    id: 'sql_main',
    kind: 'main',
    title: 'O Servidor Fantasma',
    region: 'data_city',
    summary: 'Alguém está alterando os registros da Cidade dos Dados durante a madrugada.',
    rewardText: 'XP, moedas e o Emblema da Cidade dos Dados',
    steps: [
      { id: 'travel', text: 'Pegue o ônibus da Rodoviária até a Cidade dos Dados.', objective: { type: 'flag', flag: 'visited_data_city' } },
      { id: 'talk_maya', text: 'Fale com Maya no saguão.', objective: { type: 'talk', npc: 'maya', dialogueEnds: 'm4' } },
      {
        id: 'door',
        text: 'Abra a sala de segurança pelo terminal da porta.',
        objective: { type: 'solve', challenge: 'sql_door' },
        skills: ['select', 'where'],
        onComplete: [{ type: 'flag', flag: 'door_security' }],
      },
      { id: 'talk_bras', text: 'Converse com Brás, o chefe de segurança.', objective: { type: 'talk', npc: 'bras', dialogueEnds: 'b4' } },
      { id: 'logs', text: 'Investigue os logs: alterações fora do expediente.', objective: { type: 'solve', challenge: 'sql_logs' }, skills: ['where', 'logic'] },
      {
        id: 'who',
        text: 'Descubra quem fez as alterações.',
        objective: { type: 'solve', challenge: 'sql_who' },
        skills: ['join', 'distinct'],
        onComplete: [{ type: 'give', item: 'log_impresso' }],
      },
      {
        id: 'sentinel',
        text: 'Neutralize a Sentinela corrompida no corredor.',
        objective: { type: 'solve', challenge: 'enc_sentinel' },
        skills: ['where', 'groupby'],
        onComplete: [{ type: 'flag', flag: 'sentinel_down' }],
      },
      { id: 'talk_ze', text: 'Encontre o Zé no subsolo (corredor, depois para baixo).', objective: { type: 'talk', npc: 'ze', dialogueEnds: 'z3' } },
      { id: 'power', text: 'Religue o núcleo no painel da sala de energia.', objective: { type: 'solve', challenge: 'puzzle_power' }, onComplete: [{ type: 'flag', flag: 'power_on' }] },
      { id: 'boss_logs', text: 'Enfrente ROOT no núcleo — fase 1: os rastros.', objective: { type: 'solve', challenge: 'boss_logs' }, skills: ['where', 'orderby'] },
      { id: 'boss_join', text: 'ROOT — fase 2: os pagamentos que não batem.', objective: { type: 'solve', challenge: 'boss_join' }, skills: ['join'] },
      { id: 'boss_agg', text: 'ROOT — fase 3: quanto foi desviado.', objective: { type: 'solve', challenge: 'boss_agg' }, skills: ['groupby', 'having'] },
      {
        id: 'boss_fix',
        text: 'ROOT — fase 4: restaure a folha de pagamento.',
        objective: { type: 'solve', challenge: 'boss_fix' },
        skills: ['update', 'subquery'],
        onComplete: [{ type: 'flag', flag: 'root_defeated' }],
      },
      { id: 'finale', text: 'Volte ao saguão e conte tudo à Maya.', objective: { type: 'talk', npc: 'maya', dialogueEnds: 'f3' } },
    ],
    onComplete: [{ type: 'flag', flag: 'data_city_clear' }, { type: 'toast', text: 'Cidade dos Dados restaurada!' }],
  },
  {
    id: 'side_badges',
    kind: 'side',
    title: 'Crachás Parados',
    region: 'data_city',
    summary: 'Brás quer saber quais crachás nunca foram usados.',
    rewardText: 'XP e a confiança do Brás',
    steps: [
      { id: 'find', text: 'Encontre os crachás sem nenhum uso (terminal de logs).', objective: { type: 'solve', challenge: 'sql_badges' }, skills: ['join', 'leftjoin'] },
      { id: 'report', text: 'Conte ao Brás quais são.', objective: { type: 'talk', npc: 'bras', dialogueEnds: 'bd2' } },
    ],
  },
  {
    id: 'side_cafe',
    kind: 'side',
    title: 'A Aposta do Café',
    region: 'data_city',
    summary: 'Zé apostou que a máquina do subsolo bateu recorde numa sexta.',
    rewardText: 'XP e uma ficha de café',
    steps: [
      { id: 'find', text: 'Descubra o dia recorde da máquina do subsolo.', objective: { type: 'solve', challenge: 'sql_cafe' }, skills: ['groupby', 'orderby'] },
      { id: 'report', text: 'Conte ao Zé o resultado da aposta.', objective: { type: 'talk', npc: 'ze', dialogueEnds: 'zd2' } },
    ],
  },
]

// ── Terminais ─────────────────────────────────────────────────────────────
const sql = (c: Omit<SqlChallenge, 'kind' | 'expect'>): SqlChallenge => ({ kind: 'sql', expect: exp(c.id), ...c })

export const DATA_CITY_CHALLENGES = [
  sql({
    id: 'sql_door',
    title: 'Terminal da porta de segurança',
    speaker: 'maya',
    brief: 'Localize os funcionários ATIVOS com clearance (nível de acesso) maior ou igual a 4. O leitor precisa da ficha completa de cada um.',
    database: 'security',
    starter: 'SELECT *\nFROM employees\n',
    feedback: [
      { when: { columns: 'fewer' }, say: 'O leitor de crachás pisca em amarelo: ele precisa da ficha COMPLETA (todas as colunas) para reconhecer cada pessoa.' },
      { when: { noRows: true }, say: 'Nenhum crachá reconhecido. Texto diferencia maiúsculas: veja exatamente como o status está escrito na tabela.' },
      { when: { moreRows: true, queryLacks: 'status' }, say: 'A porta destrava por um segundo e trava de novo: ela reconheceu crachás de gente de férias e desligada. Falta filtrar pelo status.' },
      { when: { moreRows: true, queryLacks: 'clearance' }, say: 'O alarme apita: até quem tem nível 2 seria liberado. Falta filtrar pelo nível de acesso.' },
      { when: { fewerRows: true, queryHas: 'clearance > 4' }, say: 'Faltou gente: quem tem EXATAMENTE nível 4 também pode entrar. "Maior ou igual" não é o mesmo que "maior".' },
      { when: { moreRows: true, queryHas: ' or ' }, say: 'A porta aceita gente demais: com OR, basta UMA condição ser verdadeira. Aqui as duas precisam valer ao mesmo tempo.' },
    ],
    hints: ['Duas condições ao mesmo tempo: status ativo E nível alto.', "O status está escrito em inglês, em minúsculas: 'active'."],
    success: 'CLACK. A porta da sala de segurança desliza. "5 crachás autorizados", diz o terminal.',
    skills: ['select', 'where'],
  }),
  sql({
    id: 'sql_logs',
    title: 'Terminal de logs',
    speaker: 'bras',
    brief: 'Mostre todas as colunas das alterações (action = UPDATE) feitas fora do expediente: antes das 7h ou a partir das 20h (coluna hour).',
    database: 'security',
    starter: 'SELECT *\nFROM access_logs\n',
    feedback: [
      { when: { moreRows: true, queryHas: ' or ', queryLacks: '(' }, say: 'O log despeja logins e consultas noturnas também. AND é avaliado antes de OR: sem parênteses, o filtro de UPDATE vale só para a primeira condição de horário.' },
      { when: { moreRows: true, queryLacks: 'update' }, say: 'Aparecem logins e leituras. Brás resmunga: "Eu pedi ALTERAÇÕES."' },
      { when: { fewerRows: true, queryHas: '> 20' }, say: 'Faltou a alteração das 20h em ponto? "A partir das 20h" inclui o 20.' },
      { when: { fewerRows: true, queryHas: '<= 7' }, say: 'Algo estranho: às 7h o expediente já começou. "Antes das 7h" é menor que 7.' },
      { when: { noRows: true }, say: 'Nada encontrado. Lembre que os valores de action estão em maiúsculas.' },
    ],
    hints: ['São duas faixas de horário: hour < 7 OU hour >= 20.', 'Agrupe as faixas de horário entre parênteses e combine com action = \'UPDATE\'.'],
    success: 'Três alterações de madrugada na folha e nos contratos. Todas com o mesmo employee_id: 4.',
    skills: ['where', 'logic'],
  }),
  sql({
    id: 'sql_who',
    title: 'Terminal de logs — cruzamento',
    speaker: 'maya',
    brief: 'Cruze essas alterações suspeitas (UPDATE fora do expediente) com employees e mostre nome, departamento e status de quem as fez — cada pessoa uma única vez.',
    database: 'security',
    starter: 'SELECT\nFROM access_logs l\n',
    feedback: [
      { when: { moreRows: true, queryLacks: 'distinct' }, say: 'O mesmo nome aparece repetido, uma vez por alteração. O painel só aceita cada pessoa uma vez (DISTINCT).' },
      { when: { moreRows: true }, say: 'Aparece gente demais: confira se o filtro de horário e de ação continua lá depois do JOIN.' },
      { when: { error: 'ambiguous' }, say: 'As duas tabelas têm uma coluna com esse nome. Diga de qual tabela ela vem (ex.: e.status ou l.id).' },
      { when: { columns: 'more' }, say: 'O painel só tem três campos: nome, departamento e status.' },
    ],
    hints: ['O JOIN liga access_logs.employee_id a employees.id.', 'SELECT DISTINCT remove as linhas repetidas.'],
    success: 'RENATA ANTUNES — TI — status: vacation. Maya arregala os olhos: "Ela está de férias em Lisboa desde segunda. Alguém está usando o acesso dela."',
    skills: ['join', 'distinct'],
  }),
  sql({
    id: 'sql_badges',
    title: 'Terminal de logs — crachás',
    speaker: 'bras',
    brief: 'Liste o badge_id dos crachás que NUNCA aparecem em badge_uses.',
    database: 'security',
    starter: 'SELECT b.badge_id\nFROM badges b\n',
    feedback: [
      { when: { noRows: true, queryLacks: 'left' }, say: 'Com JOIN comum, crachás sem uso somem do resultado antes de você poder filtrá-los. Mantenha TODOS os crachás (LEFT JOIN) e fique com os que não têm par.' },
      { when: { moreRows: true, queryHas: 'left join', queryLacks: 'is null' }, say: 'O LEFT JOIN manteve todos os crachás — agora falta ficar só com os que não encontraram nenhum uso (a coluna do outro lado fica NULL).' },
      { when: { moreRows: true }, say: 'Crachás repetidos ou usados aparecem na lista. Brás cruza os braços.' },
      { when: { error: '= null' }, say: 'Nada é "igual" a NULL. Use IS NULL.' },
    ],
    hints: ['LEFT JOIN badge_uses u ON u.badge_id = b.badge_id', 'Quem não tem uso fica com u.id IS NULL.'],
    success: 'Três crachás parados: B-04, B-06 e B-08.',
    skills: ['join', 'leftjoin'],
  }),
  sql({
    id: 'sql_cafe',
    title: 'Registros da máquina de café',
    speaker: 'ze',
    brief: 'Considerando só a máquina do subsolo, descubra o dia com mais cafés servidos no total. Mostre o dia e o total — apenas o campeão.',
    database: 'cafe',
    starter: 'SELECT day, cups, machine\nFROM coffee\n',
    feedback: [
      { when: { queryLacks: 'group by' }, say: 'Cada linha é um turno, não um dia. Some os cafés por dia (GROUP BY day).' },
      { when: { moreRows: true }, say: 'Zé quer só o campeão: um dia. Ordene do maior para o menor e limite a 1.' },
      { when: { queryLacks: 'subsolo' }, say: 'Esse resultado mistura a máquina do saguão. O Zé apostou na do subsolo.' },
      { when: { columns: 'more' }, say: 'Só o dia e o total, por favor. O Zé não lê tabela larga.' },
    ],
    hints: ['WHERE machine = \'subsolo\' antes de agrupar.', 'ORDER BY SUM(cups) DESC LIMIT 1'],
    success: '2026-10-20: 30 cafés. Uma terça-feira.',
    skills: ['groupby', 'orderby'],
  }),
  sql({
    id: 'sent_procs',
    title: 'Sentinela S-7 — tabela de processos',
    speaker: 'terminal',
    brief: 'Encontre o pid do processo de dono desconhecido (owner = unknown) que está consumindo mais de 80% de CPU.',
    database: 'sentinel',
    starter: 'SELECT *\nFROM processes\n',
    feedback: [
      { when: { moreRows: true }, say: 'Mais de um processo na mira. Derrubar o errado deixa a Sentinela mais agressiva — refine o filtro.' },
      { when: { columns: 'more' }, say: 'A interface de ataque só aceita o pid.' },
    ],
    hints: ["owner = 'unknown' AND cpu > 80"],
    success: 'Um único processo: svc-maint, pid 4096, 97% de CPU.',
    skills: ['where'],
  }),
  sql({
    id: 'sent_conns',
    title: 'Sentinela S-7 — conexões',
    speaker: 'terminal',
    brief: 'Na porta de manutenção (8443), descubra qual source_ip abriu mais de 5 conexões.',
    database: 'sentinel',
    starter: 'SELECT source_ip, COUNT(*)\nFROM connections\n',
    feedback: [
      { when: { queryLacks: 'group by' }, say: 'O contador junta tudo num número só. Conte por IP (GROUP BY source_ip).' },
      { when: { moreRows: true, queryLacks: 'having' }, say: 'Vários IPs aparecem. Filtre os GRUPOS com mais de 5 conexões — isso é HAVING, não WHERE.' },
      { when: { columns: 'more' }, say: 'O bloqueador só precisa do IP.' },
    ],
    hints: ['WHERE port = 8443 GROUP BY source_ip HAVING COUNT(*) > 5'],
    success: '10.0.66.6 — sete conexões na porta de manutenção.',
    skills: ['groupby', 'having'],
  }),
  sql({
    id: 'boss_logs',
    title: 'Núcleo — trilha de auditoria',
    speaker: 'maya',
    brief: 'Mostre tudo o que o ator root fez a partir de 2026-10-21 22:00 (coluna ts), em ordem cronológica.',
    database: 'core',
    starter: 'SELECT *\nFROM audit\n',
    orderMatters: true,
    feedback: [
      { when: { moreRows: true, queryLacks: 'ts' }, say: 'Inclui um login antigo de ROOT. Filtre a partir de 21/10 às 22h: as datas estão como texto no formato AAAA-MM-DD HH:MM e comparam em ordem.' },
      { when: { queryLacks: 'order by' }, say: 'Os rastros estão fora de ordem — ROOT conta com a sua confusão. Ordene por ts.' },
      { when: { queryHas: 'desc' }, say: 'Cronológico é do mais antigo para o mais recente.' },
    ],
    hints: ["ts >= '2026-10-21 22:00'", 'ORDER BY ts'],
    success: 'LOGIN 22:41 · DESLIGOU as regras da Sentinela 22:58 · UPDATE na folha 23:05 e 01:17 · APAGOU os logs de acesso 03:02.',
    skills: ['where', 'orderby'],
  }),
  sql({
    id: 'boss_join',
    title: 'Núcleo — folha × contratos',
    speaker: 'maya',
    brief: 'Mostre nome, salário do contrato e valor pago de cada funcionário cujo pagamento difere do contrato (payroll × contracts × employees).',
    database: 'core',
    starter: 'SELECT e.name, c.salary, p.amount\nFROM payroll p\n',
    feedback: [
      { when: { moreRows: true, queryLacks: '<>' }, say: 'Aparece a folha inteira. ROOT ri: "Achou a diferença?" Filtre só onde valor pago e salário NÃO são iguais (<> ou !=).' },
      { when: { error: 'ambiguous' }, say: 'Coluna ambígua: diga de qual tabela ela vem (p., c. ou e.).' },
      { when: { fewerRows: true }, say: 'Falta gente. Use JOIN pelas chaves: payroll.employee_id = contracts.employee_id = employees.id.' },
    ],
    hints: ['JOIN contracts c ON c.employee_id = p.employee_id', 'JOIN employees e ON e.id = p.employee_id … WHERE p.amount <> c.salary'],
    success: 'Quatro pagamentos inflados: Caio, Nina, Paulo e Teo. O dinheiro saía pela folha.',
    skills: ['join'],
  }),
  sql({
    id: 'boss_agg',
    title: 'Núcleo — o tamanho do desvio',
    speaker: 'maya',
    brief: 'ROOT está injetando lançamentos falsos (origin = ghost). Ignorando-os, mostre por departamento a soma de (valor pago − salário), só onde essa soma é positiva.',
    database: 'core_ghosts',
    starter: 'SELECT e.department, SUM(p.amount - c.salary)\nFROM payroll p\nJOIN contracts c ON c.employee_id = p.employee_id\nJOIN employees e ON e.id = p.employee_id\n',
    feedback: [
      { when: { fewerRows: true, queryLacks: 'ghost' }, say: 'O Financeiro sumiu do resultado: os lançamentos fantasmas de ROOT estão mascarando o desvio. Exclua origin = \'ghost\' antes de somar.' },
      { when: { moreRows: true, queryLacks: 'having' }, say: 'Departamentos sem desvio aparecem também. Filtre os GRUPOS com soma positiva (HAVING).' },
      { when: { queryLacks: 'group by' }, say: 'Um número só não diz quem desviou. Agrupe por departamento.' },
    ],
    hints: ["WHERE p.origin <> 'ghost'", 'GROUP BY e.department HAVING SUM(p.amount - c.salary) > 0'],
    success: 'TI: 4.500 · Financeiro: 3.000 · Análise: 1.200. A máscara de ROOT trinca.',
    skills: ['groupby', 'having'],
  }),
  sql({
    id: 'boss_fix',
    title: 'Núcleo — restauração',
    speaker: 'maya',
    brief: 'Restaure a folha: os pagamentos legítimos devem voltar ao valor do contrato e os lançamentos fantasmas precisam desaparecer. O núcleo confere o resultado depois do seu comando.',
    database: 'core_ghosts',
    starter: "UPDATE payroll\nSET amount = (SELECT c.salary FROM contracts c WHERE c.employee_id = payroll.employee_id)\nWHERE origin = 'rh';\n\n-- e os fantasmas?\n",
    verify:
      "SELECT (SELECT COUNT(*) FROM payroll p JOIN contracts c ON c.employee_id = p.employee_id WHERE p.amount <> c.salary) AS divergentes, (SELECT COUNT(*) FROM payroll WHERE origin = 'ghost') AS fantasmas, (SELECT COUNT(*) FROM payroll) AS lancamentos;",
    feedback: [
      { when: { queryLacks: 'delete' }, say: 'ROOT gargalha: os fantasmas continuam na folha. Uma alteração não basta: remova-os (DELETE … WHERE origin = \'ghost\').' },
      { when: { queryLacks: 'update' }, say: 'Os fantasmas sumiram, mas os pagamentos inflados continuam. Corrija os valores com UPDATE.' },
    ],
    hints: ["DELETE FROM payroll WHERE origin = 'ghost';", 'Rode o UPDATE e o DELETE juntos, separados por ponto e vírgula.'],
    success: 'divergentes: 0 · fantasmas: 0 · lançamentos: 8. O núcleo volta ao azul.',
    skills: ['update', 'subquery'],
  }),
]

// Os desafios de digitação usados no combate validam pelo hash do valor.
export const DATA_CITY_INPUTS: InputChallenge[] = [
  { kind: 'input', id: 'sent_pid', title: 'Encerrar processo', brief: 'kill -9 <pid>', normalize: 'digits', expect: exp('sent_pid') },
  { kind: 'input', id: 'sent_ip', title: 'Bloquear IP', brief: 'firewall block <ip>', normalize: 'trim', expect: exp('sent_ip') },
]

export const POWER_PUZZLE: SwitchPuzzle = {
  kind: 'switches',
  id: 'puzzle_power',
  title: 'Painel de energia do núcleo',
  brief: 'Quatro disjuntores. O manual do Zé tem as regras (inventário, tecla I). Quando estiver pronto, energize.',
  switches: [
    { id: 'A', label: 'A — Auxiliar' },
    { id: 'B', label: 'B — Barramento' },
    { id: 'C', label: 'C — Resfriamento' },
    { id: 'D', label: 'D — Porta do subsolo' },
  ],
  rules: [
    { text: 'Exatamente dois ligados.', ok: (s) => Object.values(s).filter(Boolean).length === 2, fail: 'O núcleo tosse e apaga: a carga não fecha. Ele precisa de exatamente dois disjuntores.' },
    { text: 'A ligado exige C desligado.', ok: (s) => !(s.A && s.C), fail: 'Faíscas! A e C juntos sobrecarregam a linha. O painel desarma.' },
    { text: 'B e D em estados diferentes.', ok: (s) => Boolean(s.B) !== Boolean(s.D), fail: 'Um zumbido grave: B e D no mesmo estado entram em ressonância.' },
    { text: 'C ligado.', ok: (s) => Boolean(s.C), fail: 'Alarme de temperatura! Sem resfriamento (C), o núcleo derreteria. Desarmado por segurança.' },
    { text: 'D desligado.', ok: (s) => !s.D, fail: 'Lá embaixo, a porta do subsolo se abre e o Zé grita. O religamento é abortado.' },
  ],
  success: 'Um clarão azul percorre os cabos. A porta do núcleo destrava com um suspiro hidráulico.',
  expect: exp('puzzle_power'),
}

export const SENTINEL: EncounterDef = {
  id: 'enc_sentinel',
  name: 'Sentinela S-7',
  intro: 'A Sentinela bloqueia a passagem. Sensor vermelho, firewall ativo. Força bruta não vai bastar: descubra o que a controla.',
  integrity: 100,
  firewall: 3,
  maxFirewall: 5,
  signal: 4,
  panels: [
    { id: 'ports', label: 'Portas', content: '22 · fechada\n5432 · banco de dados\n8443 · MANUTENÇÃO — tráfego intenso' },
    { id: 'logs', label: 'Logs', content: '22:58 regras de segurança DESATIVADAS por root\n23:01 processo desconhecido assume o controle motor\n23:02 conexões repetidas na porta 8443' },
  ],
  actions: [
    { id: 'scan', label: 'Escanear portas', description: 'Mapeia as portas abertas da Sentinela.', kind: 'scan', reveals: 'ports', learns: 'ports', success: 'Varredura concluída: a porta de manutenção (8443) está escancarada.', free: true },
    { id: 'logs', label: 'Ler logs', description: 'Lê o registro interno.', kind: 'scan', reveals: 'logs', learns: 'logs', success: 'Os logs mostram um processo desconhecido controlando os motores.', free: true },
    { id: 'procs', label: 'Inspecionar processos', description: 'Abre a tabela de processos no terminal.', kind: 'terminal', challenge: 'sent_procs', requires: ['logs'], learns: 'pid', success: 'Você isolou o processo invasor.' },
    {
      id: 'kill',
      label: 'Encerrar processo',
      description: 'kill -9 no processo invasor.',
      kind: 'input',
      challenge: 'sent_pid',
      input: { prompt: 'kill -9', placeholder: 'pid' },
      requires: ['pid'],
      learns: 'killed',
      damage: 60,
      firewall: -5,
      ignoresFirewall: true,
      success: 'kill -9: o processo invasor cai e o firewall desaba',
      wrong: { signal: 1, firewall: 1, text: 'Você derrubou um processo legítimo. A Sentinela entra em modo defensivo (+1 firewall) e revida (−1 sinal).' },
    },
    { id: 'trace', label: 'Rastrear conexões', description: 'Conta as conexões por origem no terminal.', kind: 'terminal', challenge: 'sent_conns', requires: ['ports', 'killed'], learns: 'ip', success: 'Você encontrou quem controla a Sentinela de fora.' },
    {
      id: 'block',
      label: 'Bloquear IP',
      description: 'Corta o controle remoto.',
      kind: 'input',
      challenge: 'sent_ip',
      input: { prompt: 'firewall block', placeholder: 'ip' },
      requires: ['ip'],
      learns: 'blocked',
      damage: 60,
      ignoresFirewall: true,
      success: 'Conexão cortada: a Sentinela perde o controle remoto',
      wrong: { signal: 1, text: 'IP errado: o bloqueio atinge um servidor da cidade. A Sentinela aproveita (−1 sinal).' },
    },
    { id: 'pulse', label: 'Pulso de reinício', description: 'Ataque genérico. Funciona mal contra firewall.', kind: 'attack', damage: 10, success: 'Pulso de reinício' },
  ],
  pattern: [
    { text: 'A Sentinela varre o corredor com um feixe vermelho (−1 sinal).', signal: 1 },
    { text: 'A Sentinela reforça o firewall (+1).', firewall: 1 },
    { text: 'A Sentinela reinicia módulos danificados (+10 integridade).', heal: 10 },
    { text: 'Um alarme ecoa pelo corredor. Nada acontece — desta vez.' },
  ],
  victory: 'A Sentinela abaixa o sensor. Luz verde. "Modo patrulha restaurado. Bem-vindo(a)."',
  defeat: 'Seu sinal cai. Você recua para o corredor — a Sentinela volta à posição. Tente outra abordagem.',
}

export const ROOT_BOSS: BossDef = {
  id: 'boss_root',
  name: 'ROOT, o Administrador Corrompido',
  speaker: 'root',
  intro: 'O núcleo pulsa em vermelho. Uma silhueta feita de linhas de log se ergue: "Você chegou longe com consultas de estagiário. Aqui, EU sou o banco."',
  phases: [
    { challenge: 'boss_logs', title: 'Fase 1 — Os rastros', taunt: '"Logs? Eu apaguei os logs." Mas a trilha de auditoria do núcleo ele não alcança.' },
    { challenge: 'boss_join', title: 'Fase 2 — A folha', taunt: '"Os números estão perfeitos. Confira, se for capaz." Os números só parecem perfeitos olhando uma tabela de cada vez.' },
    { challenge: 'boss_agg', title: 'Fase 3 — Os fantasmas', taunt: 'ROOT ruge e lançamentos-fantasma brotam na folha (origin = ghost), tentando esconder o rombo.' },
    { challenge: 'boss_fix', title: 'Fase 4 — A restauração', taunt: '"Você pode me ver. Mas não pode me desfazer." Pode, sim: com a operação certa.' },
  ],
  defeat: 'As linhas de log de ROOT se desfazem em silêncio. O núcleo volta ao azul.',
}
