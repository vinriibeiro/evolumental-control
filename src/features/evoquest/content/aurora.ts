// Usina de Aurora — história própria da cidade de Python, no mesmo modelo
// pedagógico do Almoxarifado: dicionários como ACUMULADORES (contar, somar e
// filtrar por chave) ensinados DENTRO do problema do mundo.
//
//   problema   a linha de montagem parou: o controlador recebe as leituras dos
//              sensores uma a uma e só entende resumos por máquina
//   lição      ficha de campo no próprio controlador (objetivo, por quê, 3
//              frases, exemplo Python que o jogador executa, erros comuns)
//   guiada     completar o .get() de uma função pronta (contar leituras)   → painel acende
//   independ.  escrever do zero a soma de consumo por máquina              → portão abre
//   combate    o robô de manutenção: a função certa revela qual máquina
//              recalibra o robô; o código errado custa sinal
//   transfer.  outro problema, duas listas: metas × produção por turno para
//              achar quem ficou abaixo — vale qualquer caminho (resultado)
//   debrief    o que aprendeu, o que aplicou, onde teve dificuldade, o que revisar
//
// O código do jogador roda no Pyodide (worker isolado); o navegador compara o
// hash do conjunto de resultados e o servidor confere o mesmo hash. As
// ENTRADAS de cada caso são visíveis; o gabarito, não.
import type { InputChallenge, PyChallenge } from '../challenges'
import type { EncounterDef } from '../engine/combat'
import type { LessonDef } from '../engine/pedagogy'
import type { DialogueDef, EntityDef, ItemDef, QuestDef, RegionDef, Speaker } from '../engine/types'
import { canvas, exp, expPy } from './registry'

export const PLANT_ID = 'aurora_plant'
/** Onde o portão deixa o jogador de volta em Aurora (a leste da praça). */
export const PLANT_EXIT = { region: 'lab_aurora', x: 24.5, y: 11.5 }
/** Onde o jogador aparece ao entrar na Usina. */
export const PLANT_ENTRY = { region: PLANT_ID, x: 3.5, y: 11.5 }

/** Portão da Usina, colocado na cidade gerada de Aurora (praça, lado leste). */
export const PLANT_GATE: EntityDef = {
  id: 'portao_usina',
  kind: 'portal',
  x: 24,
  y: 10,
  name: 'Portão da Usina',
  sprite: 'portal',
  verb: 'Entrar',
  marker: { step: 'city_lab_aurora:mentor', notStep: 'py_line:talk' },
  on: [
    { when: { notStep: 'city_lab_aurora:mentor' }, do: 'say', text: 'O portão da Usina está trancado. A Prefeitura, na praça, tem a chave.' },
    { do: 'effects', effects: [{ type: 'teleport', ...PLANT_ENTRY }], text: 'As portas de metal se abrem. Lá dentro, o barulho das máquinas parou.' },
  ],
}

/** Fala extra da Prefeitura de Aurora apresentando a Usina. */
export const PLANT_MENTOR_HINT = 'Ah, e a Usina, a leste da praça, parou. A engenheira Nadir pediu alguém que saiba Python — o portão está aberto para você.'

const W = 20
const H = 14
// Legenda: # parede · . piso · , faixa · M máquina · g portão do galpão · h porta da sala de planejamento
const m = canvas(W, H, '#')
m.rect(1, 9, 18, 12, '.').rect(1, 10, 18, 10, ',') // sala de controle
m.rect(1, 1, 13, 7, '.') // galpão
m.rect(15, 1, 18, 7, '.') // sala de planejamento
m.rect(2, 2, 8, 2, 'M').rect(2, 5, 8, 5, 'M').rect(10, 2, 12, 2, 'M')
m.set(10, 8, 'g').set(14, 4, 'h')

export const PLANT: RegionDef = {
  id: PLANT_ID,
  name: 'Usina de Aurora',
  subtitle: 'Aurora · galpão das máquinas',
  subject: 'python',
  palette: 'data',
  spawn: { x: 3, y: 11 },
  onEnter: [{ type: 'flag', flag: 'city_visited' }],
  map: {
    rows: m.rows(),
    legend: {
      '#': { solid: true, sprite: 'metal_wall' },
      '.': { solid: false, sprite: 'metal_floor' },
      ',': { solid: false, sprite: 'neon_floor' },
      M: { solid: true, sprite: 'machine' },
      g: { solid: true, openWhen: 'line_gate', sprite: 'door_power' },
      h: { solid: true, openWhen: 'robot_down', sprite: 'door_core' },
    },
  },
  entities: [
    {
      id: 'portao_volta',
      kind: 'portal',
      x: 1,
      y: 11,
      name: 'Portão da Usina',
      sprite: 'portal',
      verb: 'Sair',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...PLANT_EXIT }], text: 'Você volta à praça de Aurora.' }],
    },
    {
      id: 'nadir',
      kind: 'npc',
      x: 6,
      y: 10,
      name: 'Nadir, engenheira',
      sprite: 'nadir',
      solid: true,
      verb: 'Falar',
      marker: { notStep: 'py_line:talk' },
      on: [
        { when: { notStep: 'py_line:talk' }, do: 'dialogue', dialogue: 'nadir_intro' },
        { when: { at: 'py_line:debrief' }, do: 'dialogue', dialogue: 'nadir_debrief' },
        { when: { at: 'py_line:guided' }, do: 'say', text: 'Nadir: "O controlador fica ao lado do portão do galpão. A ficha de campo está no inventário (I), se quiser reler."' },
        { when: { at: 'py_line:independent' }, do: 'say', text: 'Nadir: "Agora o controlador quer o CONSUMO, não a contagem. Mesma ideia, outro valor somado."' },
        { when: { at: 'py_line:robot' }, do: 'say', text: 'Nadir: "Esse robô refaz a ronda sem parar e trava a sala de planejamento. Descubra qual máquina ele quer atender."' },
        { when: { at: 'py_line:transfer' }, do: 'say', text: 'Nadir: "Na sala de planejamento está o quadro de metas. Alguma máquina produziu menos do que devia."' },
        { when: { questDone: 'py_line' }, do: 'debrief', quest: 'py_line' },
        { do: 'say', text: 'Nadir: "Linha rodando. Volte quando quiser praticar com as leituras."' },
      ],
    },
    {
      id: 'controlador',
      kind: 'object',
      x: 11,
      y: 9,
      name: 'Controlador da linha',
      sprite: 'terminal',
      solid: true,
      verb: 'Usar controlador',
      marker: { at: 'py_line:guided' },
      on: [
        { when: { at: 'py_line:guided' }, do: 'terminal', challenge: 'line_guided' },
        { when: { at: 'py_line:independent' }, do: 'terminal', challenge: 'line_independent' },
        { when: { notStep: 'py_line:talk' }, do: 'say', text: 'CONTROLADOR PARADO — "RESUMO POR MÁQUINA NÃO RECEBIDO". Fale com a engenheira.' },
        { do: 'say', text: 'Controlador da linha: galpão liberado. Totais por máquina em dia.' },
      ],
    },
    {
      id: 'robot',
      kind: 'enemy',
      x: 13,
      y: 4,
      name: 'Robô de manutenção R-9',
      sprite: 'robot',
      solid: true,
      visible: { notFlag: 'robot_down' },
      verb: 'Enfrentar',
      marker: { at: 'py_line:robot' },
      on: [
        { when: { at: 'py_line:robot' }, do: 'combat', encounter: 'enc_robot' },
        { do: 'say', text: 'O robô gira o braço: "MANUTENÇÃO PENDENTE. AGUARDE ORDEM DE SERVIÇO."' },
      ],
    },
    {
      id: 'mesa_campo_usina',
      kind: 'object',
      x: 9,
      y: 11,
      name: 'Mesa de revisão de campo',
      sprite: 'terminal',
      solid: true,
      verb: 'Revisar',
      visible: { questDone: 'py_line' },
      on: [{ do: 'field', template: 'field_dict' }],
    },
    {
      id: 'quadro_metas',
      kind: 'object',
      x: 17,
      y: 2,
      name: 'Quadro de metas',
      sprite: 'panel',
      solid: true,
      verb: 'Consultar',
      marker: { at: 'py_line:transfer' },
      on: [
        { when: { at: 'py_line:transfer' }, do: 'terminal', challenge: 'line_transfer' },
        { when: { flag: 'line_fixed' }, do: 'say', text: 'Quadro atualizado. M2 e M3 estão marcadas em vermelho: abaixo da meta.' },
        { do: 'say', text: 'Quadro com as metas de peças do dia, uma por máquina.' },
      ],
    },
  ],
}

export const PLANT_SPEAKERS: Speaker[] = [
  { id: 'nadir', name: 'Nadir', role: 'Engenheira de automação da Usina', look: { skin: '#c99068', hair: '#3b2b20', outfit: '#2f7f73', accent: '#eda100' } },
  { id: 'robot', name: 'Robô R-9', role: 'Manutenção automática', look: { skin: '#2f7f73', hair: '#eda100', outfit: '#2a313d', accent: '#38ff9c' } },
]

export const PLANT_ITEMS: ItemDef[] = [
  {
    id: 'ficha_dicionarios',
    name: 'Ficha de campo: dicionários',
    icon: '📒',
    description: 'Resumo da lição da Nadir para consultar a qualquer momento.',
    read: [
      'DICIONÁRIOS — acumular por chave',
      '',
      '• A chave é o grupo (a máquina); o valor é o que você acumula (contagem ou soma).',
      '• Percorra a lista com for e atualize a chave: d[chave] = d.get(chave, 0) + valor.',
      '• .get(chave, 0) devolve 0 na primeira vez que a chave aparece (sem KeyError).',
      '• Para contar, some 1; para somar, some o campo; para filtrar, um if antes.',
      '',
      "Exemplo: por_setor[setor] = por_setor.get(setor, 0) + 1",
    ].join('\n'),
  },
  { id: 'selo_usina', name: 'Selo da Usina', icon: '⚙️', description: 'Dado pela Nadir a quem religou a linha de montagem resumindo as leituras.' },
]

export const PLANT_DIALOGUES: DialogueDef[] = [
  {
    id: 'nadir_intro',
    start: 'n1',
    nodes: [
      {
        id: 'n1',
        speaker: 'nadir',
        text: 'Você é da Guilda? Sou a Nadir, engenheira de automação. A linha parou: o controlador recebe as leituras dos sensores uma a uma e não consegue mais acompanhar.',
        next: 'n2',
        effects: [{ type: 'startQuest', quest: 'py_line' }],
      },
      {
        id: 'n2',
        speaker: 'nadir',
        text: 'Ele precisa de um RESUMO por máquina: quantas leituras, quanto consumo. Em Python, isso é um dicionário que acumula por chave. O controlador tem uma ficha de campo curta — e deixo uma cópia com você.',
        next: 'n3',
        effects: [{ type: 'give', item: 'ficha_dicionarios' }],
      },
      { id: 'n3', speaker: 'nadir', text: 'O controlador fica ao lado do portão do galpão. Vai lá.' },
    ],
  },
  {
    id: 'nadir_debrief',
    start: 'd1',
    debrief: 'py_line',
    nodes: [
      { id: 'd1', speaker: 'nadir', text: 'Linha religada, robô recalibrado e as máquinas abaixo da meta na mesa da diretoria. Tudo isso saiu de acumular valores num dicionário.', next: 'd2', effects: [{ type: 'give', item: 'selo_usina' }] },
      { id: 'd2', speaker: 'nadir', text: 'Fica com o selo. E dá uma olhada no relatório de campo: ele mostra onde você foi bem e o que vale revisar.' },
    ],
  },
]

/** Caminho de aprendizagem do conceito (quadro de oportunidades). */
export const LINE_PATH = {
  quest: 'py_line',
  concept: 'colecoes',
  unlockedBy: 'city_lab_aurora:mentor',
  where: 'Aurora → Portão da Usina (leste da praça)',
  practice: 'Usina de Aurora → mesa de revisão de campo',
  fieldTemplate: 'field_dict',
}

export const LINE_QUEST: QuestDef = {
  id: 'py_line',
  kind: 'mastery',
  title: 'A Linha de Montagem Muda',
  region: PLANT_ID,
  summary: 'O controlador da linha só entende resumos por máquina. Aprenda a acumular valores num dicionário e use isso para religar a Usina.',
  rewardText: 'XP, moedas, o Selo da Usina e evidência de domínio em dicionários',
  steps: [
    { id: 'talk', text: 'Fale com a Nadir na sala de controle da Usina.', objective: { type: 'talk', npc: 'nadir', dialogueEnds: 'n3' } },
    { id: 'guided', text: 'No controlador, conte as leituras por máquina (prática guiada).', objective: { type: 'solve', challenge: 'line_guided' }, skills: ['dict'] },
    {
      id: 'independent',
      text: 'Agora some o consumo por máquina, do zero, para abrir o galpão.',
      objective: { type: 'solve', challenge: 'line_independent' },
      skills: ['dict', 'loop'],
      onComplete: [{ type: 'flag', flag: 'line_gate' }, { type: 'toast', text: 'O portão do galpão subiu.' }],
    },
    {
      id: 'robot',
      text: 'Recalibre o robô de manutenção que bloqueia a sala de planejamento.',
      objective: { type: 'solve', challenge: 'enc_robot' },
      skills: ['dict', 'filter'],
      onComplete: [{ type: 'flag', flag: 'robot_down' }],
    },
    {
      id: 'transfer',
      text: 'No quadro de metas, descubra quais máquinas produziram menos do que a meta.',
      objective: { type: 'solve', challenge: 'line_transfer' },
      skills: ['dict', 'loop', 'transfer'],
      onComplete: [{ type: 'flag', flag: 'line_fixed' }],
    },
    { id: 'debrief', text: 'Conte à Nadir o que descobriu.', objective: { type: 'talk', npc: 'nadir', dialogueEnds: 'd2' } },
  ],
  onComplete: [{ type: 'toast', text: 'Linha de montagem religada!' }],
}

export const LESSON_DICT: LessonDef = {
  id: 'lesson_dict',
  subject: 'python',
  concept: 'colecoes',
  conceptName: 'Dicionários (acumular por chave)',
  title: 'Ficha de campo: dicionários como acumuladores',
  learningObjective: 'Resumir uma lista de registros em um dicionário com uma entrada por grupo: contar, somar ou filtrar por máquina, setor, dia…',
  prerequisites: ['listas e laço for', 'dicionários: criar, ler e gravar chaves'],
  whyItMatters: 'Dados chegam como listas de registros; perguntas reais são "quanto por máquina?", "quantos por cliente?". Acumular num dicionário é o GROUP BY do Python puro — e a base do groupby do pandas.',
  explanation: [
    'Um dicionário guarda pares chave → valor: a chave é o grupo (a máquina) e o valor é o que você acumula (contagem ou soma).',
    'Percorra a lista com for e, em cada registro, atualize a chave: d[chave] = d.get(chave, 0) + valor. O .get(chave, 0) devolve 0 na primeira vez que a chave aparece.',
    'Para contar, some 1; para somar, some o campo do registro; para filtrar, ponha um if antes de acumular.',
  ],
  workedExample: {
    lang: 'python',
    caption: 'Quantos chamados cada setor abriu? Execute e veja: seis itens viram três pares, um por setor.',
    code: "chamados = ['TI', 'RH', 'TI', 'Compras', 'TI', 'RH']\npor_setor = {}\nfor setor in chamados:\n    por_setor[setor] = por_setor.get(setor, 0) + 1\nprint(por_setor)",
  },
  commonMistakes: [
    'Usar d[chave] += 1 antes de a chave existir: KeyError na primeira vez. Use .get(chave, 0).',
    'Esquecer o return: a função devolve None e o controlador não recebe nada.',
    'Criar o dicionário dentro do laço: ele é zerado a cada volta e só sobra o último registro.',
  ],
}

// ── Dados da missão (visíveis ao jogador; o gabarito é só o hash) ──
type Leitura = { maquina: string; consumo: number; status: 'ok' | 'falha' }
const L = (maquina: string, consumo: number, status: 'ok' | 'falha'): Leitura => ({ maquina, consumo, status })

/** Turno da manhã: 12 leituras de 4 máquinas. */
export const LEITURAS_MANHA: Leitura[] = [
  L('M1', 12, 'ok'),
  L('M2', 20, 'falha'),
  L('M1', 15, 'ok'),
  L('M3', 8, 'falha'),
  L('M2', 18, 'ok'),
  L('M4', 10, 'ok'),
  L('M3', 9, 'falha'),
  L('M1', 11, 'falha'),
  L('M2', 22, 'falha'),
  L('M3', 7, 'falha'),
  L('M4', 12, 'ok'),
  L('M2', 19, 'ok'),
]
/** Turno da noite: outra lista, outras máquinas (evita resposta decorada). */
export const LEITURAS_NOITE: Leitura[] = [L('M7', 5, 'falha'), L('M7', 6, 'ok'), L('M8', 4, 'ok')]

const LEITURA_CASES: unknown[][] = [[LEITURAS_MANHA], [LEITURAS_NOITE], [[]]]
const LEITURA_NAMES = ['Turno da manhã', 'Turno da noite', 'Sem leituras']

type Meta = { maquina: string; pecas: number }
const P = (maquina: string, pecas: number): Meta => ({ maquina, pecas })
export const METAS_DIA: Meta[] = [P('M1', 120), P('M2', 150), P('M3', 90), P('M4', 60)]
export const PRODUCAO_DIA: Meta[] = [P('M1', 50), P('M2', 70), P('M3', 30), P('M4', 35), P('M1', 45), P('M2', 60), P('M3', 25), P('M4', 30), P('M1', 30), P('M2', 15)]

const py = (c: Omit<PyChallenge, 'kind' | 'expect'>): PyChallenge => ({ kind: 'python', expect: expPy(c.id), ...c })

const KEYERROR = 'KeyError: você leu uma chave que ainda não existe no dicionário. Na primeira vez que a máquina aparece, .get(chave, 0) devolve 0.'

export const PLANT_CHALLENGES: PyChallenge[] = [
  py({
    id: 'line_guided',
    title: 'Controlador — leituras por máquina',
    speaker: 'nadir',
    stage: 'guided',
    concept: 'colecoes',
    lesson: 'lesson_dict',
    brief: 'O controlador precisa de UM par por máquina: máquina → número de leituras. A função está quase pronta: complete o .get() com a chave do grupo.',
    entry: 'leituras_por_maquina',
    cases: LEITURA_CASES,
    caseNames: LEITURA_NAMES,
    starter: "def leituras_por_maquina(leituras):\n    contagem = {}\n    for leitura in leituras:\n        maquina = leitura['maquina']\n        contagem[maquina] = contagem.get(____, 0) + 1\n    return contagem\n",
    feedback: [
      // "____" é um nome válido em Python: dá NameError no 1º caso (a lista vazia nem chega a usá-lo).
      { when: { codeHas: '____' }, say: 'O controlador não entende "____". Troque pelo nome da variável que guarda a chave do grupo — a máquina.' },
      { when: { error: 'KeyError' }, say: KEYERROR },
      { when: { result: 'none' }, say: 'A função devolveu None: o controlador não recebeu o dicionário. Falta o return.' },
      { when: { result: 'number' }, say: 'O controlador recebeu um número só. Ele quer um dicionário com uma entrada por máquina.' },
      { when: { onlyCase: 2 }, say: 'Os turnos conferem, mas sem leituras a função deve devolver um dicionário vazio ({}).' },
    ],
    ladder: [
      'Lembre da ficha: .get(chave, 0) recebe a CHAVE do grupo — e o grupo aqui é a máquina.',
      'Qual variável do laço guarda o nome da máquina da leitura atual? É ela que vai no lugar dos sublinhados.',
      'Fica assim: contagem[maquina] = contagem.get(maquina, 0) + 1',
    ],
    explanation:
      'Cada item de leituras é uma leitura. Agrupar por máquina é usar o nome da máquina como chave: na primeira vez, .get(maquina, 0) devolve 0 e somamos 1; nas seguintes, devolve a contagem até ali. No turno da manhã ficam M1: 3, M2: 4, M3: 3 e M4: 2. A linha completa é contagem[maquina] = contagem.get(maquina, 0) + 1, dentro do for, e return contagem no fim.',
    success: 'O controlador acende: M1 3, M2 4, M3 3, M4 2 leituras. Nadir: "Agora o CONSUMO."',
    skills: ['dict'],
  }),
  py({
    id: 'line_independent',
    title: 'Controlador — consumo por máquina',
    speaker: 'nadir',
    stage: 'independent',
    concept: 'colecoes',
    lesson: 'lesson_dict',
    brief: 'Para religar o galpão, o controlador precisa do consumo TOTAL de cada máquina: um dicionário máquina → soma do campo consumo. Desta vez, escreva a função inteira.',
    entry: 'consumo_por_maquina',
    cases: LEITURA_CASES,
    caseNames: LEITURA_NAMES,
    starter: 'def consumo_por_maquina(leituras):\n    # máquina -> soma de consumo\n    pass\n',
    feedback: [
      { when: { error: 'KeyError' }, say: KEYERROR },
      { when: { result: 'none' }, say: 'A função devolveu None. Crie o dicionário, acumule no laço e devolva com return.' },
      { when: { codeLacks: "'consumo'" }, say: 'Isso ignora o consumo. O galpão quer a SOMA do campo consumo de cada leitura.' },
      { when: { result: 'number' }, say: 'Um total só, da linha inteira. Falta acumular POR máquina, com o nome dela como chave.' },
      { when: { onlyCase: 2 }, say: 'Sem leituras, o resultado é um dicionário vazio. Confira se a função não quebra com a lista vazia.' },
    ],
    ladder: [
      'Mesma ideia da contagem, outro valor: em vez de somar 1, some o consumo da leitura.',
      "A chave continua sendo leitura['maquina']; o valor a somar é leitura['consumo'].",
      "Estrutura: total = {} · for leitura in leituras: total[m] = total.get(m, 0) + leitura['consumo'] · return total",
    ],
    explanation:
      "Somar por máquina = usar a máquina como chave e acumular leitura['consumo'] em vez de 1: total[m] = total.get(m, 0) + leitura['consumo']. No turno da manhã: M1 38, M2 79, M3 24 e M4 22. A função cria o dicionário vazio antes do laço, acumula e devolve com return.",
    success: 'CLUNK. O portão do galpão sobe: M1 38, M2 79, M3 24, M4 22. Lá dentro, um robô de manutenção gira o braço.',
    skills: ['dict', 'loop'],
  }),
  py({
    id: 'line_robot',
    title: 'Robô R-9 — falhas por máquina',
    speaker: 'robot',
    stage: 'independent',
    concept: 'colecoes',
    lesson: 'lesson_dict',
    brief: "O robô só se recalibra com a contagem certa: quantas leituras com status 'falha' cada máquina teve? Devolva um dicionário máquina → contagem, só com as máquinas que tiveram alguma falha.",
    entry: 'falhas_por_maquina',
    cases: LEITURA_CASES,
    caseNames: LEITURA_NAMES,
    starter: "def falhas_por_maquina(leituras):\n    falhas = {}\n    # só leituras com status 'falha'\n    return falhas\n",
    feedback: [
      { when: { error: 'KeyError' }, say: KEYERROR },
      { when: { result: 'none' }, say: 'A função devolveu None. O robô espera um dicionário.' },
      { when: { codeLacks: 'for' }, say: 'Sem percorrer as leituras não há o que contar: um for sobre leituras.' },
      { when: { codeLacks: 'if' }, say: "Nem toda leitura entra: só as com status 'falha'. Um if antes de acumular decide quem conta." },
      { when: { codeLacks: "'falha'" }, say: "Qual status entra na conta? Compare leitura['status'] com 'falha'." },
      { when: { onlyCase: 2 }, say: 'Sem leituras, nenhuma falha: dicionário vazio.' },
    ],
    ladder: [
      'Duas etapas: primeiro decidir se a leitura entra (if), depois acumular no dicionário.',
      "O filtro é leitura['status'] == 'falha'; a chave continua sendo a máquina.",
      "Dentro do for: if leitura['status'] == 'falha': falhas[m] = falhas.get(m, 0) + 1",
    ],
    explanation:
      "O if roda antes de acumular: só as leituras com status 'falha' chegam ao dicionário, por isso máquinas sem falha nem aparecem. No turno da manhã: M1 1, M2 2, M3 3 (M4 não teve falha). Função: for leitura in leituras: if leitura['status'] == 'falha': falhas[m] = falhas.get(m, 0) + 1, com m = leitura['maquina'].",
    success: 'Falhas por máquina: M1 → 1, M2 → 2, M3 → 3. O robô espera a recalibração.',
    skills: ['dict', 'filter'],
  }),
  py({
    id: 'line_transfer',
    title: 'Quadro de metas',
    speaker: 'nadir',
    stage: 'transfer',
    concept: 'colecoes',
    lesson: 'lesson_dict',
    brief:
      'A diretoria quer saber quais máquinas ficaram ABAIXO da meta do dia. metas traz uma meta de peças por máquina; producao traz o que cada turno produziu (várias linhas por máquina). Devolva um dicionário máquina → peças que faltaram (meta − produzido), só para quem ficou abaixo. Vale qualquer caminho — o quadro confere o resultado, não o código.',
    entry: 'abaixo_da_meta',
    cases: [
      [METAS_DIA, PRODUCAO_DIA],
      [[P('M9', 10)], []],
      [[P('M5', 10)], [P('M5', 10)]],
    ],
    caseNames: ['Dia 1', 'Máquina parada', 'Meta batida'],
    starter: "def abaixo_da_meta(metas, producao):\n    # metas: [{'maquina', 'pecas'}] · producao: [{'maquina', 'pecas'}], várias linhas por máquina\n    pass\n",
    feedback: [
      { when: { error: 'KeyError' }, say: KEYERROR },
      { when: { result: 'none' }, say: 'A função devolveu None. O quadro espera um dicionário máquina → peças que faltaram.' },
      { when: { result: 'list' }, say: 'O quadro precisa de um dicionário máquina → peças que faltaram, não de uma lista.' },
      { when: { onlyCase: 1 }, say: 'Uma máquina sem NENHUMA produção também fica abaixo da meta: faltou a meta inteira. Use .get(maquina, 0) ao buscar o produzido.' },
      { when: { onlyCase: 2 }, say: 'Meta batida exatamente não é "abaixo": só entram diferenças maiores que zero.' },
    ],
    ladder: [
      'Você precisa de um resumo da producao por máquina (soma de pecas) — é o mesmo dicionário acumulador de antes.',
      'Depois, para cada meta, compare: produzido = resumo.get(maquina, 0); se a meta for maior, guarde a diferença.',
      "Um caminho: produzido = {} · for p in producao: acumule p['pecas'] · resultado = {} · for m in metas: falta = m['pecas'] - produzido.get(m['maquina'], 0) · if falta > 0: resultado[m['maquina']] = falta",
    ],
    explanation:
      'Não dá para comparar meta com turno linha a linha: a produção vem quebrada em vários turnos. Por isso primeiro resumimos producao por máquina (dicionário acumulador) e só depois comparamos com cada meta, usando .get(maquina, 0) para quem não produziu nada. No dia 1, M2 produziu 145 de 150 (faltam 5) e M3 produziu 55 de 90 (faltam 35); M1 e M4 bateram a meta.',
    success: 'Quadro atualizado: M2 faltaram 5 peças, M3 faltaram 35. Nadir: "Agora a diretoria tem com o que trabalhar."',
    skills: ['dict', 'loop', 'transfer'],
  }),
]

export const PLANT_INPUTS: InputChallenge[] = [{ kind: 'input', id: 'line_worst', title: 'Recalibrar robô', brief: 'recalibrar --maquina <código>', normalize: 'upper', expect: exp('line_worst') }]

export const ROBOT: EncounterDef = {
  id: 'enc_robot',
  name: 'Robô de manutenção R-9',
  portrait: 'robot',
  intro: 'O robô bloqueia a porta da sala de planejamento repetindo "MANUTENÇÃO PENDENTE". Desligar não adianta: ele precisa saber qual máquina atender primeiro.',
  integrity: 100,
  firewall: 2,
  maxFirewall: 4,
  signal: 4,
  panels: [{ id: 'diag', label: 'Diagnóstico', content: 'ERRO: contagem de leituras com FALHA por máquina divergente.\nRecalibração exige o código da máquina com MAIS falhas.' }],
  actions: [
    { id: 'examinar', label: 'Examinar', description: 'Lê o painel de diagnóstico do robô.', kind: 'scan', reveals: 'diag', learns: 'diag', success: 'O diagnóstico aparece no visor do robô.', free: true },
    { id: 'consultar', label: 'Consultar leituras', description: 'Abre o controlador com as leituras dos sensores.', kind: 'terminal', challenge: 'line_robot', requires: ['diag'], learns: 'fails', success: 'Você tem a contagem de falhas por máquina.' },
    {
      id: 'recalibrar',
      label: 'Recalibrar',
      description: 'Envia a máquina com mais falhas.',
      kind: 'input',
      challenge: 'line_worst',
      input: { prompt: 'recalibrar --maquina', placeholder: 'código (ex.: M1)' },
      requires: ['fails'],
      learns: 'fixed',
      damage: 100,
      ignoresFirewall: true,
      success: 'Recalibração aceita',
      wrong: { signal: 1, firewall: 1, text: 'Máquina errada: o robô refaz a ronda e se fecha (+1 firewall, −1 sinal).' },
    },
    { id: 'desligar', label: 'Desligar', description: 'Força bruta. O robô religa sozinho.', kind: 'attack', damage: 10, success: 'Você aperta o botão de desligar' },
  ],
  pattern: [{ text: 'O robô apita e refaz a ronda das máquinas (+1 firewall).', firewall: 1 }, { text: 'O braço mecânico afasta você (−1 sinal).', signal: 1 }, { text: 'O robô aperta um parafuso. Nada mais acontece.' }],
  victory: 'O robô pisca verde: "ORDEM DE SERVIÇO: M3". Ele sai da frente da porta da sala de planejamento.',
  defeat: 'O robô empurra você até a sala de controle. Releia o diagnóstico e tente de novo.',
}
