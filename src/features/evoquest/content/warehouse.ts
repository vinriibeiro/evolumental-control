// Almoxarifado da Cidade dos Dados — vertical slice do novo modelo
// pedagógico: GROUP BY ensinado DENTRO do problema do mundo.
//
//   problema   o painel de reposição travou: ele só entende resumos por fornecedor
//   lição      ficha de campo no próprio terminal (objetivo, por quê, 3 frases,
//              exemplo que o jogador executa, erros comuns)
//   guiada     completar o GROUP BY de uma consulta pronta         → painel acende
//   independ.  escrever do zero a soma de itens por fornecedor     → portão abre
//   combate    o drone de inventário: a consulta certa revela qual fornecedor
//              recalibra o drone; o valor errado custa sinal
//   transfer.  outro problema, outra tabela: cruzar notas × entregas para achar
//              quem cobrou a mais — vale qualquer caminho (validação pelo resultado)
//   debrief    o que aprendeu, o que aplicou, onde teve dificuldade, o que revisar
//
// Cada atividade resolvida grava EVIDÊNCIA (estágio + nível de ajuda) para o
// domínio do Control; XP e moedas seguem pelo catálogo de etapas do servidor.
import type { InputChallenge, SqlChallenge } from '../challenges'
import type { EncounterDef } from '../engine/combat'
import type { LessonDef } from '../engine/pedagogy'
import type { DialogueDef, ItemDef, QuestDef, RegionDef, Speaker } from '../engine/types'
import { canvas, exp } from './registry'

export const WAREHOUSE_ID = 'data_warehouse'
/** Onde o elevador de carga deixa o jogador na Cidade dos Dados. */
export const WAREHOUSE_EXIT = { region: 'data_city', x: 9.5, y: 21.5 }

const W = 20
const H = 14
// Legenda: # parede · . piso · , faixa · S prateleira · g portão do depósito · h porta do arquivo
const m = canvas(W, H, '#')
m.rect(1, 9, 18, 12, '.').rect(1, 10, 18, 10, ',') // recepção
m.rect(1, 1, 13, 7, '.') // depósito
m.rect(15, 1, 18, 7, '.') // arquivo
m.rect(2, 2, 8, 2, 'S').rect(2, 5, 8, 5, 'S').rect(10, 2, 12, 2, 'S')
m.set(10, 8, 'g').set(14, 4, 'h')

export const WAREHOUSE: RegionDef = {
  id: WAREHOUSE_ID,
  name: 'Almoxarifado',
  subtitle: 'Cidade dos Dados · subsolo de cargas',
  subject: 'sql',
  palette: 'data',
  spawn: { x: 3, y: 11 },
  onEnter: [{ type: 'flag', flag: 'city_visited' }],
  map: {
    rows: m.rows(),
    legend: {
      '#': { solid: true, sprite: 'metal_wall' },
      '.': { solid: false, sprite: 'metal_floor' },
      ',': { solid: false, sprite: 'neon_floor' },
      S: { solid: true, sprite: 'rack' },
      g: { solid: true, openWhen: 'supply_gate', sprite: 'door_power' },
      h: { solid: true, openWhen: 'drone_down', sprite: 'door_core' },
    },
  },
  entities: [
    {
      id: 'elevador_volta',
      kind: 'portal',
      x: 1,
      y: 11,
      name: 'Elevador de carga',
      sprite: 'bus_stop',
      verb: 'Subir',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...WAREHOUSE_EXIT }], text: 'O elevador range e sobe até o saguão.' }],
    },
    {
      id: 'otavia',
      kind: 'npc',
      x: 6,
      y: 10,
      name: 'Otávia, almoxarife',
      sprite: 'otavia',
      solid: true,
      verb: 'Falar',
      marker: { notStep: 'sql_supply:talk' },
      on: [
        { when: { notStep: 'sql_supply:talk' }, do: 'dialogue', dialogue: 'otavia_intro' },
        { when: { at: 'sql_supply:debrief' }, do: 'dialogue', dialogue: 'otavia_debrief' },
        { when: { at: 'sql_supply:guided' }, do: 'say', text: 'Otávia: "O painel fica ao lado do portão. A ficha de campo está no inventário (I), se quiser reler."' },
        { when: { at: 'sql_supply:independent' }, do: 'say', text: 'Otávia: "Agora o painel quer os ITENS, não as entregas. Mesma ideia, outra função."' },
        { when: { at: 'sql_supply:drone' }, do: 'say', text: 'Otávia: "Esse drone reconta tudo e trava a porta do arquivo. Descubra o que ele quer ouvir."' },
        { when: { at: 'sql_supply:transfer' }, do: 'say', text: 'Otávia: "No arquivo estão as notas fiscais. Alguém cobrou mais do que entregou."' },
        { when: { questDone: 'sql_supply' }, do: 'debrief', quest: 'sql_supply' },
        { do: 'say', text: 'Otávia: "Almoxarifado em ordem. Volte quando quiser praticar com os registros."' },
      ],
    },
    {
      id: 'painel_reposicao',
      kind: 'object',
      x: 11,
      y: 9,
      name: 'Painel de reposição',
      sprite: 'terminal',
      solid: true,
      verb: 'Usar painel',
      marker: { at: 'sql_supply:guided' },
      on: [
        { when: { at: 'sql_supply:guided' }, do: 'terminal', challenge: 'sup_guided' },
        { when: { at: 'sql_supply:independent' }, do: 'terminal', challenge: 'sup_independent' },
        { when: { notStep: 'sql_supply:talk' }, do: 'say', text: 'PAINEL TRAVADO — "RESUMO POR FORNECEDOR NÃO RECEBIDO". Fale com a almoxarife.' },
        { do: 'say', text: 'Painel de reposição: portão liberado. Totais por fornecedor em dia.' },
      ],
    },
    {
      id: 'drone',
      kind: 'enemy',
      x: 13,
      y: 4,
      name: 'Drone de inventário D-3',
      sprite: 'drone',
      solid: true,
      visible: { notFlag: 'drone_down' },
      verb: 'Enfrentar',
      marker: { at: 'sql_supply:drone' },
      on: [
        { when: { at: 'sql_supply:drone' }, do: 'combat', encounter: 'enc_drone' },
        { do: 'say', text: 'O drone gira as hélices: "CONTAGEM INCONSISTENTE. AGUARDE RECALIBRAÇÃO."' },
      ],
    },
    {
      id: 'mesa_campo',
      kind: 'object',
      x: 9,
      y: 11,
      name: 'Mesa de revisão de campo',
      sprite: 'terminal',
      solid: true,
      verb: 'Revisar',
      visible: { questDone: 'sql_supply' },
      on: [{ do: 'field', template: 'field_groupby' }],
    },
    {
      id: 'arquivo_notas',
      kind: 'object',
      x: 17,
      y: 2,
      name: 'Arquivo de notas fiscais',
      sprite: 'terminal',
      solid: true,
      verb: 'Investigar',
      marker: { at: 'sql_supply:transfer' },
      on: [
        { when: { at: 'sql_supply:transfer' }, do: 'terminal', challenge: 'sup_transfer' },
        { when: { flag: 'supply_fixed' }, do: 'say', text: 'Notas conferidas. A divergência da Cabos & Cia está marcada em vermelho.' },
        { do: 'say', text: 'Gavetas de notas fiscais, organizadas por fornecedor.' },
      ],
    },
  ],
}

export const WAREHOUSE_SPEAKERS: Speaker[] = [
  { id: 'otavia', name: 'Otávia', role: 'Almoxarife da Cidade dos Dados', look: { skin: '#b07a54', hair: '#2b211b', outfit: '#3f6f4a', accent: '#eda100' } },
  { id: 'drone', name: 'Drone D-3', role: 'Inventário automático', look: { skin: '#59606b', hair: '#38d0ff', outfit: '#2c3138', accent: '#38d0ff' } },
]

export const WAREHOUSE_ITEMS: ItemDef[] = [
  {
    id: 'ficha_groupby',
    name: 'Ficha de campo: GROUP BY',
    icon: '📒',
    description: 'Resumo da lição da Otávia para consultar a qualquer momento.',
    read: [
      'GROUP BY — resumir por grupo',
      '',
      '• GROUP BY coluna junta as linhas com o mesmo valor: cada grupo vira UMA linha.',
      '• Uma função de agregação resume cada grupo: COUNT(*) conta, SUM(x) soma, AVG(x) faz a média.',
      '• No SELECT entram só a coluna do grupo e agregações.',
      '• WHERE filtra LINHAS antes de agrupar.',
      '',
      'Exemplo: SELECT setor, COUNT(*) FROM chamados GROUP BY setor;',
    ].join('\n'),
  },
  { id: 'selo_almoxarifado', name: 'Selo do Almoxarifado', icon: '🏷️', description: 'Dado pela Otávia a quem reorganizou o almoxarifado resumindo os dados.' },
]

export const WAREHOUSE_DIALOGUES: DialogueDef[] = [
  {
    id: 'otavia_intro',
    start: 'o1',
    nodes: [
      { id: 'o1', speaker: 'otavia', text: 'Você é da Guilda? Sou a Otávia, do almoxarifado. A cidade está sem peças: o painel de reposição travou.', next: 'o2', effects: [{ type: 'startQuest', quest: 'sql_supply' }] },
      {
        id: 'o2',
        speaker: 'otavia',
        text: 'Ele não aceita item por item: pede um RESUMO por fornecedor. Isso é GROUP BY. O painel tem uma ficha de campo curta — e deixo uma cópia com você.',
        next: 'o3',
        effects: [{ type: 'give', item: 'ficha_groupby' }],
      },
      { id: 'o3', speaker: 'otavia', text: 'O painel fica ao lado do portão. Vai lá.' },
    ],
  },
  {
    id: 'otavia_debrief',
    start: 'd1',
    debrief: 'sql_supply',
    nodes: [
      { id: 'd1', speaker: 'otavia', text: 'Portão aberto, drone recalibrado e a Cabos & Cia pega cobrando a mais. Tudo isso saiu de resumir dados.', next: 'd2', effects: [{ type: 'give', item: 'selo_almoxarifado' }] },
      { id: 'd2', speaker: 'otavia', text: 'Fica com o selo. E dá uma olhada no relatório de campo: ele mostra onde você foi bem e o que vale revisar.' },
    ],
  },
]

/**
 * Caminho de aprendizagem do conceito: onde a missão começa, o que a libera e
 * onde praticar depois (usado pelo quadro de oportunidades).
 */
export const SUPPLY_PATH = {
  quest: 'sql_supply',
  concept: 'groupby',
  unlockedBy: 'sql_main:who',
  where: 'Cidade dos Dados → elevador de carga (Almoxarifado)',
  practice: 'Almoxarifado → mesa de revisão de campo',
}

export const SUPPLY_QUEST: QuestDef = {
  id: 'sql_supply',
  kind: 'mastery',
  title: 'O Almoxarifado em Pane',
  region: WAREHOUSE_ID,
  summary: 'O painel de reposição só entende resumos por fornecedor. Aprenda GROUP BY e use-o para destravar o depósito.',
  rewardText: 'XP, moedas, o Selo do Almoxarifado e evidência de domínio em GROUP BY',
  steps: [
    { id: 'talk', text: 'Fale com a Otávia na recepção do almoxarifado.', objective: { type: 'talk', npc: 'otavia', dialogueEnds: 'o3' } },
    { id: 'guided', text: 'No painel de reposição, conte as entregas por fornecedor (prática guiada).', objective: { type: 'solve', challenge: 'sup_guided' }, skills: ['groupby'] },
    {
      id: 'independent',
      text: 'Agora some os itens por fornecedor, do zero, para abrir o portão.',
      objective: { type: 'solve', challenge: 'sup_independent' },
      skills: ['groupby', 'agg'],
      onComplete: [{ type: 'flag', flag: 'supply_gate' }, { type: 'toast', text: 'O portão do depósito subiu.' }],
    },
    {
      id: 'drone',
      text: 'Recalibre o drone de inventário que bloqueia o arquivo.',
      objective: { type: 'solve', challenge: 'enc_drone' },
      skills: ['groupby', 'where'],
      onComplete: [{ type: 'flag', flag: 'drone_down' }],
    },
    {
      id: 'transfer',
      text: 'No arquivo, descubra qual fornecedor cobrou mais itens do que entregou.',
      objective: { type: 'solve', challenge: 'sup_transfer' },
      skills: ['groupby', 'join', 'subquery'],
      onComplete: [{ type: 'flag', flag: 'supply_fixed' }],
    },
    { id: 'debrief', text: 'Conte à Otávia o que descobriu.', objective: { type: 'talk', npc: 'otavia', dialogueEnds: 'd2' } },
  ],
  onComplete: [{ type: 'toast', text: 'Almoxarifado em ordem!' }],
}

export const LESSON_GROUPBY: LessonDef = {
  id: 'lesson_groupby',
  subject: 'sql',
  concept: 'groupby',
  conceptName: 'GROUP BY',
  title: 'Ficha de campo: GROUP BY',
  learningObjective: 'Resumir uma tabela em uma linha por grupo: contar, somar ou tirar a média por fornecedor, setor, dia…',
  prerequisites: ['SELECT e WHERE', 'funções COUNT e SUM'],
  whyItMatters: 'Perguntas reais quase nunca são sobre uma linha só: são "quanto por cliente?", "quantos por mês?". GROUP BY responde isso direto no banco.',
  explanation: [
    'GROUP BY coluna junta as linhas que têm o mesmo valor nessa coluna: cada grupo vira UMA linha no resultado.',
    'Uma função de agregação resume cada grupo: COUNT(*) conta as linhas, SUM(x) soma, AVG(x) faz a média.',
    'No SELECT entram só a coluna do grupo e as agregações. Para filtrar linhas ANTES de agrupar, use WHERE.',
  ],
  workedExample: {
    caption: 'Quantos chamados cada setor abriu? Execute e veja: nove linhas viram três, uma por setor.',
    code: 'SELECT setor, COUNT(*) AS chamados\nFROM chamados\nGROUP BY setor;',
    dataset: 'lesson_groupby',
  },
  commonMistakes: [
    'Pôr no SELECT uma coluna que não está no GROUP BY (cada grupo tem vários valores dela).',
    'Esquecer o GROUP BY: COUNT(*) vira um número só para a tabela inteira.',
    'Agrupar pela coluna errada (ex.: pelo id da linha): cada linha vira um grupo.',
  ],
}

const sql = (c: Omit<SqlChallenge, 'kind' | 'expect'>): SqlChallenge => ({ kind: 'sql', expect: exp(c.id), ...c })

export const WAREHOUSE_CHALLENGES: SqlChallenge[] = [
  sql({
    id: 'sup_guided',
    title: 'Painel de reposição — contagem',
    speaker: 'otavia',
    stage: 'guided',
    concept: 'groupby',
    lesson: 'lesson_groupby',
    brief: 'O painel precisa de UMA linha por fornecedor com o número de entregas de cada um. A consulta está quase pronta: complete o GROUP BY.',
    database: 'supply',
    starter: 'SELECT fornecedor_id, COUNT(*) AS entregas\nFROM entregas\nGROUP BY ____;',
    feedback: [
      { when: { error: '', queryHas: '____' }, say: 'O painel não entende "____". Troque pela coluna que define cada grupo.' },
      { when: { moreRows: true }, say: 'O painel recebeu uma linha por ENTREGA: você agrupou por uma coluna que muda em toda linha. O grupo aqui é o fornecedor.' },
      { when: { fewerRows: true }, say: 'O painel recebeu um número só. Sem um GROUP BY pela coluna certa, a tabela inteira vira um grupo.' },
      { when: { error: 'no such column' }, say: 'Essa coluna não existe em entregas. As colunas estão listadas ao lado.' },
    ],
    hints: [],
    ladder: [
      'Lembre da ficha: GROUP BY recebe a coluna que define cada grupo — e o painel quer uma linha por fornecedor.',
      'Qual coluna de entregas diz de qual fornecedor veio a entrega? É ela que vai no lugar dos sublinhados.',
      'Fica assim no final: … GROUP BY fornecedor_id;',
    ],
    explanation:
      'Cada linha de entregas é uma entrega. Agrupando por fornecedor_id, todas as entregas do mesmo fornecedor viram um grupo, e COUNT(*) conta quantas linhas há em cada grupo: 5, 6, 4 e 5. A consulta completa é: SELECT fornecedor_id, COUNT(*) AS entregas FROM entregas GROUP BY fornecedor_id;',
    success: 'O painel acende: quatro fornecedores, com 5, 6, 4 e 5 entregas. Otávia: "Agora some os ITENS."',
    skills: ['groupby'],
  }),
  sql({
    id: 'sup_independent',
    title: 'Painel de reposição — portão',
    speaker: 'otavia',
    stage: 'independent',
    concept: 'groupby',
    lesson: 'lesson_groupby',
    brief: 'Para liberar o portão, o painel precisa do total de ITENS entregues por fornecedor: o fornecedor_id e a soma dos itens. Desta vez, escreva a consulta inteira.',
    database: 'supply',
    starter: '-- total de itens por fornecedor\n',
    feedback: [
      { when: { queryLacks: 'group by' }, say: 'O painel recebeu um total só, da tabela inteira. Falta agrupar por fornecedor.' },
      { when: { queryLacks: 'sum' }, say: 'Isso conta entregas. O portão quer a quantidade de ITENS: some a coluna itens.' },
      { when: { moreRows: true }, say: 'Linhas demais: agrupe só pelo fornecedor.' },
      { when: { columns: 'more' }, say: 'O painel só tem duas colunas: o fornecedor e a soma.' },
      { when: { columns: 'fewer' }, say: 'Falta uma coluna: o painel precisa saber de qual fornecedor é cada soma.' },
    ],
    hints: [],
    ladder: [
      'Mesma ideia da contagem, outra função: somar por grupo é SUM(coluna) com GROUP BY.',
      'A coluna a somar é itens; o grupo continua sendo fornecedor_id. A tabela é entregas.',
      'Estrutura: SELECT fornecedor_id, SUM(…) FROM entregas GROUP BY …;',
    ],
    explanation:
      'Somar por fornecedor = agrupar por fornecedor_id e aplicar SUM(itens) em cada grupo. O banco forma os quatro grupos e soma os itens de cada um: 50, 90, 25 e 40. Consulta: SELECT fornecedor_id, SUM(itens) AS total FROM entregas GROUP BY fornecedor_id;',
    success: 'CLUNK. O portão do depósito sobe: 50, 90, 25 e 40 itens. Lá dentro, um drone apita.',
    skills: ['groupby', 'agg'],
  }),
  sql({
    id: 'sup_drone',
    title: 'Drone D-3 — contagem de atrasos',
    speaker: 'drone',
    stage: 'independent',
    concept: 'groupby',
    lesson: 'lesson_groupby',
    brief: 'O drone só se recalibra com a contagem certa: quantas entregas ATRASADAS cada fornecedor teve? Mostre fornecedor_id e a contagem — só de quem atrasou.',
    database: 'supply',
    starter: 'SELECT fornecedor_id, COUNT(*)\nFROM entregas\n',
    feedback: [
      { when: { moreRows: true, queryLacks: 'atrasada' }, say: 'O drone apita: você contou TODAS as entregas. Filtre as atrasadas antes de agrupar — WHERE vem antes do GROUP BY.' },
      { when: { queryLacks: 'group by' }, say: 'Um número só: o drone quer a contagem POR fornecedor.' },
      { when: { error: 'misuse of aggregate' }, say: 'COUNT não pode ficar no WHERE: o WHERE filtra linhas, antes de existir contagem.' },
      { when: { columns: 'more' }, say: 'O drone lê só duas colunas: fornecedor e contagem.' },
    ],
    hints: [],
    ladder: ['Duas etapas: primeiro escolher as linhas (WHERE), depois agrupar e contar.', "O filtro é status = 'atrasada'; o grupo é fornecedor_id.", "… WHERE status = 'atrasada' GROUP BY fornecedor_id;"],
    explanation:
      "O WHERE roda antes do GROUP BY: primeiro ficam só as entregas atrasadas, depois elas são agrupadas por fornecedor e contadas. Fornecedores sem atraso nem aparecem. Consulta: SELECT fornecedor_id, COUNT(*) FROM entregas WHERE status = 'atrasada' GROUP BY fornecedor_id;",
    success: 'Atrasos por fornecedor: 1 → 1, 2 → 3, 4 → 2. O drone espera a recalibração.',
    skills: ['groupby', 'where'],
  }),
  sql({
    id: 'sup_transfer',
    title: 'Arquivo de notas fiscais',
    speaker: 'otavia',
    stage: 'transfer',
    concept: 'groupby',
    lesson: 'lesson_groupby',
    brief:
      'Algum fornecedor cobrou (notas) mais itens do que entregou (entregas). Descubra qual: mostre o NOME do fornecedor e a diferença (faturado − entregue). Vale qualquer caminho — o arquivo confere o resultado, não a consulta.',
    database: 'supply',
    starter: '-- notas: o que foi cobrado · entregas: o que chegou · fornecedores: os nomes\n',
    feedback: [
      { when: { moreRows: true }, say: 'Aparecem fornecedores que cobraram certo. Fique só com quem faturou MAIS do que entregou (diferença maior que zero).' },
      { when: { columns: 'fewer' }, say: 'O arquivo precisa do nome e da diferença.' },
      { when: { columns: 'more' }, say: 'Só duas colunas: nome e diferença.' },
      { when: { error: 'ambiguous' }, say: 'Duas tabelas têm uma coluna com esse nome. Diga de qual ela vem (ex.: e.itens).' },
      { when: { noRows: true }, say: 'Nenhum suspeito. Confira se está comparando os TOTAIS por fornecedor, não linha a linha.' },
    ],
    hints: [],
    ladder: [
      'Você precisa de dois resumos por fornecedor: total cobrado (notas) e total entregue (entregas). Cada um é um GROUP BY.',
      'Junte os dois resumos pelo fornecedor (e os nomes, de fornecedores) e fique só onde cobrado − entregue > 0.',
      'Um caminho: SELECT f.nome, n.total - e.total FROM fornecedores f JOIN (SELECT fornecedor_id, SUM(itens) AS total FROM notas GROUP BY fornecedor_id) n ON n.fornecedor_id = f.id JOIN (… o mesmo para entregas …) e ON … WHERE …',
    ],
    explanation:
      'Não dá para comparar nota com entrega linha a linha: os números estão quebrados de jeitos diferentes. Por isso resumimos as duas tabelas pelo mesmo grupo (fornecedor) e só depois comparamos os totais. A Cabos & Cia tem 110 itens em notas e 90 em entregas: 20 a mais. Uma solução usa duas subconsultas com GROUP BY ligadas por JOIN a fornecedores e filtra a diferença maior que zero.',
    success: 'Cabos & Cia: 20 itens cobrados a mais. Otávia bate na mesa: "Agora eu tenho prova."',
    skills: ['groupby', 'join', 'subquery'],
  }),
]

export const WAREHOUSE_INPUTS: InputChallenge[] = [{ kind: 'input', id: 'sup_worst', title: 'Recalibrar drone', brief: 'recalibrar --fornecedor <id>', normalize: 'digits', expect: exp('sup_worst') }]

export const DRONE: EncounterDef = {
  id: 'enc_drone',
  name: 'Drone de inventário D-3',
  portrait: 'drone',
  intro: 'O drone bloqueia a porta do arquivo repetindo "CONTAGEM INCONSISTENTE". Empurrar não adianta: ele precisa ser recalibrado com o dado certo.',
  integrity: 100,
  firewall: 2,
  maxFirewall: 4,
  signal: 4,
  panels: [{ id: 'diag', label: 'Diagnóstico', content: 'ERRO: contagem de entregas ATRASADAS por fornecedor divergente.\nRecalibração exige o id do fornecedor com MAIS atrasos.' }],
  actions: [
    { id: 'examinar', label: 'Examinar', description: 'Lê o painel de diagnóstico do drone.', kind: 'scan', reveals: 'diag', learns: 'diag', success: 'O diagnóstico aparece no visor do drone.', free: true },
    { id: 'consultar', label: 'Consultar entregas', description: 'Abre o terminal com a tabela de entregas.', kind: 'terminal', challenge: 'sup_drone', requires: ['diag'], learns: 'late', success: 'Você tem a contagem de atrasos por fornecedor.' },
    {
      id: 'recalibrar',
      label: 'Recalibrar',
      description: 'Envia o fornecedor com mais atrasos.',
      kind: 'input',
      challenge: 'sup_worst',
      input: { prompt: 'recalibrar --fornecedor', placeholder: 'id' },
      requires: ['late'],
      learns: 'fixed',
      damage: 100,
      ignoresFirewall: true,
      success: 'Recalibração aceita',
      wrong: { signal: 1, firewall: 1, text: 'Fornecedor errado: o drone reconta tudo e se fecha (+1 firewall, −1 sinal).' },
    },
    { id: 'empurrar', label: 'Empurrar', description: 'Força bruta. O drone volta para o lugar.', kind: 'attack', damage: 10, success: 'Você empurra o drone' },
  ],
  pattern: [{ text: 'O drone apita e reconta as caixas (+1 firewall).', firewall: 1 }, { text: 'Um braço mecânico afasta você (−1 sinal).', signal: 1 }, { text: 'O drone reorganiza uma prateleira. Nada mais acontece.' }],
  victory: 'O drone pisca verde: "CONTAGEM RECALIBRADA". Ele sai da frente da porta do arquivo.',
  defeat: 'O drone empurra você até a recepção. Releia o diagnóstico e tente de novo.',
}
