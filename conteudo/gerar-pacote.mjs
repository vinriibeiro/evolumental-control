// Gera conteudo/pacote-estudos.json para importar em
// Configurações → Seus dados → Importar dados (JSON).
// Uso: node conteudo/gerar-pacote.mjs
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const id = () => randomUUID()

// ---------------------------------------------------------------------
// Matérias e tópicos (árvore: [nome, filhos?])
// ---------------------------------------------------------------------
const SUBJECTS = [
  {
    name: 'SQL',
    color: '#2A78D6',
    icon: '🗄️',
    priority: 5,
    difficulty: 3,
    weekly_goal_hours: 4,
    description: 'Consultas, modelagem e desempenho em bancos relacionais.',
    tree: [
      ['Fundamentos', [['Bancos relacionais e tabelas'], ['Tipos de dados'], ['DDL × DML × DCL'], ['Chaves primárias e estrangeiras']]],
      ['Consultas básicas', [['SELECT e aliases'], ['WHERE e operadores'], ['ORDER BY'], ['DISTINCT'], ['LIMIT / TOP / OFFSET']]],
      ['Funções e expressões', [['Funções de agregação (COUNT, SUM, AVG, MIN, MAX)'], ['Funções de texto'], ['Funções de data'], ['CASE WHEN'], ['Tratamento de NULL (COALESCE, NULLIF)']]],
      ['Agrupamento', [['GROUP BY'], ['HAVING'], ['GROUPING SETS / ROLLUP / CUBE']]],
      ['Joins', [['INNER JOIN'], ['LEFT / RIGHT JOIN'], ['FULL OUTER JOIN'], ['CROSS JOIN'], ['SELF JOIN'], ['Anti-join e semi-join (NOT EXISTS / EXISTS)']]],
      ['Subconsultas e CTEs', [['Subconsulta escalar e em lista (IN)'], ['Subconsulta correlacionada'], ['CTE (WITH)'], ['CTE recursiva']]],
      ['Window functions', [['ROW_NUMBER, RANK, DENSE_RANK'], ['LAG e LEAD'], ['Totais acumulados (SUM OVER)'], ['PARTITION BY e ORDER BY na janela'], ['Frames (ROWS / RANGE)']]],
      ['Modificação de dados', [['INSERT'], ['UPDATE'], ['DELETE'], ['MERGE / UPSERT']]],
      ['Modelagem', [['Normalização (1FN, 2FN, 3FN)'], ['Constraints (CHECK, UNIQUE, NOT NULL)'], ['Modelo dimensional (fato e dimensão)']]],
      ['Transações', [['Propriedades ACID'], ['Níveis de isolamento'], ['Locks e deadlocks']]],
      ['Objetos do banco', [['Views'], ['Stored procedures'], ['Funções'], ['Triggers']]],
      ['Desempenho', [['Índices (B-tree, compostos)'], ['Plano de execução'], ['Consultas SARGable']]],
    ],
  },
  {
    name: 'Python',
    color: '#EB6834',
    icon: '🐍',
    priority: 5,
    difficulty: 3,
    weekly_goal_hours: 4,
    description: 'Linguagem, estruturas de dados, POO e análise de dados.',
    tree: [
      ['Fundamentos', [['Sintaxe e indentação'], ['Variáveis e tipos'], ['Operadores'], ['Strings e f-strings'], ['Entrada e saída']]],
      ['Controle de fluxo', [['if / elif / else'], ['for e while'], ['break, continue e else em laços'], ['match / case']]],
      ['Estruturas de dados', [['Listas'], ['Tuplas'], ['Dicionários'], ['Conjuntos'], ['Compreensões (list/dict/set)']]],
      ['Funções', [['Parâmetros, *args e **kwargs'], ['Escopo (LEGB)'], ['Funções lambda'], ['Decorators'], ['Type hints']]],
      ['Módulos e pacotes', [['import e __name__'], ['pip e requirements'], ['Ambientes virtuais (venv)']]],
      ['Orientação a objetos', [['Classes e instâncias'], ['Herança e composição'], ['Métodos especiais (dunder)'], ['Propriedades'], ['dataclasses']]],
      ['Erros e exceções', [['try / except / else / finally'], ['Exceções personalizadas'], ['Context managers (with)']]],
      ['Arquivos e dados', [['Leitura e escrita de arquivos'], ['JSON'], ['CSV'], ['pathlib']]],
      ['Iteradores e geradores', [['Protocolo de iteração'], ['yield e geradores'], ['itertools']]],
      ['Análise de dados', [['NumPy'], ['pandas: Series e DataFrame'], ['Limpeza de dados'], ['groupby e agregações'], ['merge e join'], ['Visualização com matplotlib']]],
      ['Boas práticas', [['PEP 8'], ['Testes com pytest'], ['Logging'], ['Git básico']]],
      ['Automação e APIs', [['requests e APIs REST'], ['Automação de planilhas'], ['Agendamento de scripts']]],
    ],
  },
  {
    name: 'Power BI',
    color: '#EDA100',
    icon: '📊',
    priority: 4,
    difficulty: 3,
    weekly_goal_hours: 3,
    exam: 'PL-300 — Microsoft Power BI Data Analyst',
    description: 'Preparação, modelagem, DAX, visualização e publicação.',
    tree: [
      ['Visão geral', [['Power BI Desktop, Service e Mobile'], ['Licenças (Free, Pro, PPU, Fabric)'], ['Fluxo: obter → modelar → visualizar → publicar']]],
      ['Power Query', [['Conectores e fontes de dados'], ['Transformações comuns'], ['Linguagem M'], ['Mesclar e acrescentar consultas'], ['Parâmetros'], ['Perfil e qualidade de dados']]],
      ['Modelagem', [['Esquema estrela'], ['Tabelas fato e dimensão'], ['Relacionamentos e cardinalidade'], ['Direção do filtro cruzado'], ['Tabela calendário'], ['Hierarquias']]],
      ['DAX', [['Colunas calculadas × medidas'], ['Contexto de linha e de filtro'], ['CALCULATE'], ['Iteradores (SUMX, AVERAGEX)'], ['FILTER e ALL'], ['Inteligência de tempo'], ['Variáveis (VAR / RETURN)']]],
      ['Visualizações', [['Escolha do visual certo'], ['Formatação e temas'], ['Interações entre visuais'], ['Drill-down e drill-through'], ['Dicas de ferramenta'], ['Indicadores (bookmarks)']]],
      ['Publicação e compartilhamento', [['Workspaces'], ['Apps'], ['Atualização agendada'], ['Gateway de dados']]],
      ['Segurança', [['Row-Level Security (RLS)'], ['Funções e permissões']]],
      ['Desempenho', [['Motor VertiPaq'], ['Performance Analyzer'], ['DAX Studio']]],
      ['Certificação PL-300', [['Preparar os dados'], ['Modelar os dados'], ['Visualizar e analisar'], ['Gerenciar e proteger']]],
    ],
  },
  {
    name: 'Inglês',
    color: '#1BAF7A',
    icon: '🔤',
    priority: 4,
    difficulty: 4,
    weekly_goal_hours: 3,
    exam: 'Cambridge C1 Advanced / C2 Proficiency',
    description: 'Inglês avançado: vocabulário, expressões, gramática e habilidades.',
    tree: [
      ['Nível C1', [['Vocabulário C1'], ['Phrasal verbs'], ['Idioms e collocations'], ['Gramática C1']]],
      ['Nível C2', [['Vocabulário C2'], ['Idioms avançados'], ['Collocations e registro formal'], ['Gramática avançada']]],
      ['Reading', [['Skimming e scanning'], ['Inferência'], ['Textos acadêmicos']]],
      ['Listening', [['Sotaques'], ['Notas durante o áudio']]],
      ['Writing', [['Essays'], ['Reports e proposals'], ['Coesão e conectivos']]],
      ['Speaking', [['Fluência'], ['Pronúncia e entonação'], ['Discussão e argumentação']]],
      ['Exames', [['CAE (C1 Advanced)'], ['CPE (C2 Proficiency)'], ['IELTS']]],
    ],
  },
  {
    name: 'SEVEN',
    color: '#6250D6',
    icon: '📡',
    priority: 5,
    difficulty: 3,
    weekly_goal_hours: 14,
    description: 'Serviço SEVEN — sistema de gestão de vendas da Seven Telecom.',
    tree: [
      ['Vendas', [['Lançamento unitário e em lote'], ['Filtros e exportação CSV']]],
      ['Viabilidade', [['Consulta de endereço por CEP'], ['Resposta do backoffice']]],
      ['Confirmação D-1 / D-15'],
      ['Fechamento do dia', [['Resumo e mix de produtos'], ['Exportação PDF, Excel e WhatsApp']]],
      ['Rota de instalação', [['Agenda por turno'], ['Reagendamento']]],
      ['Indicadores e FPD', [['Conectividade e cancelamento'], ['Ranking de vendedores']]],
      ['Premiação e comissão', [['Faixas e bônus'], ['Plano do mês']]],
      ['Central de alterações (auditoria)'],
      ['Usuários, perfis e segurança'],
      ['Banco PostgreSQL e API Node/Express'],
    ],
  },
]

const subjects = []
const topics = []
const leafTopics = new Map() // matéria → folhas
const topicByName = new Map() // "Matéria/Tópico" → id

SUBJECTS.forEach((s, i) => {
  const sid = id()
  subjects.push({
    id: sid,
    name: s.name,
    description: s.description,
    color: s.color,
    icon: s.icon,
    priority: s.priority,
    difficulty: s.difficulty,
    weekly_goal_hours: s.weekly_goal_hours,
    status: 'active',
    exam: s.exam ?? null,
    sort_order: i,
  })
  const leaves = []
  const walk = (nodes, parent) =>
    nodes.forEach(([name, children], order) => {
      const tid = id()
      topics.push({ id: tid, subject_id: sid, parent_id: parent, name, sort_order: order, status: 'not_started', priority: 3, weight: 1 })
      topicByName.set(`${s.name}/${name}`, tid)
      if (children?.length) walk(children, tid)
      else leaves.push(tid)
    })
  walk(s.tree, null)
  leafTopics.set(s.name, leaves)
  s.id = sid
})

// ---------------------------------------------------------------------
// Flashcards de inglês — [frente, definição, tradução, exemplo]
// ---------------------------------------------------------------------
const C1_VOCAB = [
  ['ubiquitous', 'Seeming to be everywhere at the same time.', 'onipresente', 'Smartphones have become ubiquitous in modern life.'],
  ['meticulous', 'Showing great attention to detail; very careful.', 'meticuloso', 'She kept meticulous records of every expense.'],
  ['detrimental', 'Causing harm or damage.', 'prejudicial', 'Lack of sleep is detrimental to your health.'],
  ['feasible', 'Possible and practical to do.', 'viável', 'The plan is technically feasible but expensive.'],
  ['inevitable', 'Certain to happen; unavoidable.', 'inevitável', 'Some delays were inevitable given the weather.'],
  ['ambiguous', 'Open to more than one interpretation.', 'ambíguo', 'The wording of the contract is ambiguous.'],
  ['scrutinize', 'To examine closely and thoroughly.', 'examinar minuciosamente', 'Auditors will scrutinize the company’s accounts.'],
  ['alleviate', 'To make a problem or suffering less severe.', 'aliviar, amenizar', 'The new road should alleviate traffic congestion.'],
  ['compelling', 'Convincing; evoking strong interest.', 'convincente, envolvente', 'She made a compelling case for reform.'],
  ['pragmatic', 'Dealing with things sensibly and realistically.', 'pragmático', 'We need a pragmatic approach, not an idealistic one.'],
  ['notorious', 'Famous for something bad.', 'famigerado, de má fama', 'The area is notorious for traffic jams.'],
  ['reluctant', 'Unwilling and hesitant.', 'relutante', 'He was reluctant to admit his mistake.'],
  ['substantial', 'Of considerable size, importance or worth.', 'substancial', 'They received a substantial amount of funding.'],
  ['undermine', 'To weaken gradually or secretly.', 'minar, enfraquecer', 'Constant criticism can undermine confidence.'],
  ['advocate (v.)', 'To publicly recommend or support.', 'defender, advogar', 'Many experts advocate a gradual approach.'],
  ['profound', 'Very great or intense; showing deep insight.', 'profundo', 'The discovery had a profound impact on medicine.'],
  ['coherent', 'Logical and consistent.', 'coerente', 'Her argument was clear and coherent.'],
  ['diligent', 'Showing care and effort in one’s work.', 'diligente, aplicado', 'A diligent student reviews notes every day.'],
  ['elusive', 'Difficult to find, catch or achieve.', 'difícil de alcançar, evasivo', 'Success remained elusive for years.'],
  ['hinder', 'To create difficulties that delay or prevent something.', 'atrapalhar, dificultar', 'Bad weather hindered the rescue efforts.'],
  ['implement', 'To put a plan or decision into effect.', 'implementar', 'The company will implement the new policy next month.'],
  ['incentive', 'Something that motivates someone to act.', 'incentivo', 'Tax breaks are an incentive for investment.'],
  ['inherent', 'Existing as a natural, permanent quality.', 'inerente', 'There are risks inherent in any investment.'],
  ['mitigate', 'To make something less severe or serious.', 'mitigar, atenuar', 'Measures were taken to mitigate the risks.'],
  ['obsolete', 'No longer produced or used; out of date.', 'obsoleto', 'Fax machines are almost obsolete.'],
  ['plausible', 'Seeming reasonable or probable.', 'plausível', 'That is a plausible explanation.'],
  ['prevalent', 'Widespread in a particular area or time.', 'predominante, comum', 'The disease is prevalent in tropical regions.'],
  ['reinforce', 'To strengthen or support.', 'reforçar', 'The results reinforce our initial hypothesis.'],
  ['resilient', 'Able to recover quickly from difficulties.', 'resiliente', 'Children are often remarkably resilient.'],
  ['sceptical / skeptical', 'Not easily convinced; having doubts.', 'cético', 'Scientists were sceptical of the claims.'],
  ['tedious', 'Too long, slow or dull; tiresome.', 'tedioso, maçante', 'Data entry can be tedious work.'],
  ['versatile', 'Able to adapt to many different functions.', 'versátil', 'Python is a versatile programming language.'],
  ['vulnerable', 'Exposed to the possibility of being harmed.', 'vulnerável', 'Older systems are vulnerable to attacks.'],
  ['discrepancy', 'A lack of compatibility between facts or figures.', 'discrepância', 'There is a discrepancy between the two reports.'],
  ['consensus', 'General agreement.', 'consenso', 'The committee reached a consensus.'],
  ['contemplate', 'To think deeply about; to consider as a possibility.', 'contemplar, cogitar', 'She is contemplating a career change.'],
  ['deteriorate', 'To become progressively worse.', 'deteriorar(-se)', 'His health deteriorated rapidly.'],
  ['endorse', 'To declare public approval or support.', 'endossar, apoiar', 'The proposal was endorsed by the board.'],
  ['exacerbate', 'To make a problem worse.', 'agravar', 'The drought exacerbated food shortages.'],
  ['fluctuate', 'To rise and fall irregularly.', 'oscilar', 'Prices fluctuate depending on demand.'],
  ['comprehensive', 'Including all or nearly all elements.', 'abrangente, completo', 'We need a comprehensive review of the process.'],
  ['conspicuous', 'Clearly visible; attracting attention.', 'chamativo, evidente', 'He felt conspicuous in his bright suit.'],
  ['deliberate (adj.)', 'Done consciously and intentionally.', 'deliberado, intencional', 'It was a deliberate attempt to mislead.'],
  ['eloquent', 'Fluent or persuasive in speaking or writing.', 'eloquente', 'She gave an eloquent speech.'],
  ['explicit', 'Stated clearly and in detail.', 'explícito', 'The instructions were explicit.'],
  ['tentative', 'Not certain or fixed; provisional.', 'provisório, hesitante', 'We made tentative plans to meet.'],
  ['thorough', 'Complete with regard to every detail.', 'minucioso, completo', 'The police conducted a thorough investigation.'],
  ['underlying', 'Fundamental but not obvious.', 'subjacente', 'We need to address the underlying causes.'],
  ['widespread', 'Found or distributed over a large area or among many people.', 'generalizado', 'There is widespread concern about the issue.'],
  ['bias', 'Prejudice in favour of or against something.', 'viés, parcialidade', 'The study was criticized for its bias.'],
  ['commence', 'To begin (formal).', 'começar, iniciar', 'The ceremony will commence at noon.'],
  ['contend', 'To claim something as true in an argument.', 'sustentar, alegar', 'Critics contend that the law is unfair.'],
  ['foster', 'To encourage the development of something.', 'fomentar, promover', 'Teachers should foster curiosity.'],
  ['hamper', 'To hinder or impede progress.', 'dificultar, atrapalhar', 'The investigation was hampered by a lack of evidence.'],
  ['imply', 'To suggest something without saying it directly.', 'insinuar, dar a entender', 'Are you implying that I lied?'],
  ['infer', 'To deduce from evidence and reasoning.', 'inferir, deduzir', 'From his tone, I inferred that he was upset.'],
  ['overwhelming', 'Very great in amount, force or effect.', 'esmagador, avassalador', 'The response was overwhelming.'],
  ['pursue', 'To follow or try to achieve something.', 'buscar, seguir', 'She decided to pursue a career in law.'],
  ['sustainable', 'Able to be maintained; not harming the environment.', 'sustentável', 'We need sustainable growth.'],
  ['viable', 'Capable of working successfully.', 'viável', 'It is not a viable solution in the long term.'],
]

const C1_PHRASAL = [
  ['bring about', 'To cause something to happen.', 'provocar, ocasionar', 'The internet brought about huge social changes.'],
  ['carry out', 'To perform or conduct (a task, study, plan).', 'realizar, executar', 'They carried out a survey of 500 people.'],
  ['come across', 'To find by chance; to give a certain impression.', 'deparar-se com; passar uma impressão', 'He comes across as confident in interviews.'],
  ['come up with', 'To think of an idea, plan or solution.', 'ter (uma ideia), bolar', 'She came up with a brilliant solution.'],
  ['cut down on', 'To reduce the amount of something.', 'reduzir, diminuir', 'I’m trying to cut down on sugar.'],
  ['do away with', 'To abolish; to get rid of.', 'abolir, acabar com', 'They did away with the old dress code.'],
  ['draw up', 'To prepare a document, list or plan.', 'redigir, elaborar', 'The lawyer drew up a new contract.'],
  ['fall through', 'To fail to happen.', 'não dar certo, ir por água abaixo', 'Our holiday plans fell through.'],
  ['figure out', 'To understand or solve something.', 'descobrir, entender', 'I can’t figure out how this works.'],
  ['get across', 'To communicate an idea successfully.', 'transmitir, fazer entender', 'He struggled to get his point across.'],
  ['get round to', 'To finally do something after a delay.', 'arranjar tempo para', 'I’ll get round to fixing it eventually.'],
  ['go along with', 'To agree with or accept.', 'concordar com, aceitar', 'They went along with the decision.'],
  ['hold back', 'To hesitate; to restrain (feelings, information).', 'conter(-se), segurar', 'Don’t hold back — tell me what you think.'],
  ['lay off', 'To dismiss workers, usually for economic reasons.', 'demitir (por corte)', 'The factory laid off 200 workers.'],
  ['look into', 'To investigate.', 'investigar, examinar', 'We’ll look into your complaint.'],
  ['make up for', 'To compensate for.', 'compensar', 'Nothing can make up for lost time.'],
  ['point out', 'To draw attention to something.', 'apontar, salientar', 'She pointed out several errors.'],
  ['put forward', 'To propose an idea or plan.', 'propor, apresentar', 'He put forward a new proposal.'],
  ['put off', 'To postpone; to discourage.', 'adiar; desanimar', 'Don’t put off your studies until the last minute.'],
  ['rule out', 'To exclude a possibility.', 'descartar', 'The police have ruled out foul play.'],
  ['run into', 'To meet by chance; to encounter (problems).', 'topar com, esbarrar em', 'We ran into some technical problems.'],
  ['set up', 'To establish or arrange.', 'criar, montar, configurar', 'She set up her own company.'],
  ['sort out', 'To resolve or organize.', 'resolver, organizar', 'Let’s sort out this misunderstanding.'],
  ['stand out', 'To be very noticeable or better than others.', 'destacar-se', 'Her work really stands out.'],
  ['take on', 'To accept work or responsibility; to hire.', 'assumir; contratar', 'I can’t take on any more projects.'],
  ['take over', 'To gain control of.', 'assumir o controle', 'A larger firm took over the company.'],
  ['turn down', 'To refuse or reject.', 'recusar', 'She turned down the job offer.'],
  ['wear off', 'To gradually disappear (an effect).', 'passar (efeito)', 'The anaesthetic will wear off soon.'],
  ['weigh up', 'To consider carefully before deciding.', 'ponderar, avaliar', 'Weigh up the pros and cons before deciding.'],
  ['back up', 'To support; to make a copy of data.', 'apoiar; fazer backup', 'Back up your files regularly.'],
  ['break down', 'To stop working; to divide into parts for analysis.', 'quebrar; detalhar', 'Let’s break down the problem into smaller steps.'],
  ['call off', 'To cancel.', 'cancelar', 'The match was called off due to rain.'],
  ['catch up on', 'To do something you haven’t had time to do.', 'pôr em dia', 'I need to catch up on my emails.'],
  ['phase out', 'To gradually stop using something.', 'eliminar gradualmente', 'Plastic bags are being phased out.'],
  ['brush up on', 'To improve a skill you used to have.', 'reciclar, relembrar', 'I need to brush up on my French.'],
  ['come down to', 'To be essentially a matter of.', 'resumir-se a', 'In the end, it all comes down to money.'],
  ['live up to', 'To meet expectations or standards.', 'corresponder às expectativas', 'The film didn’t live up to the hype.'],
  ['single out', 'To choose one person or thing from a group for attention.', 'destacar, escolher', 'She was singled out for praise.'],
  ['stem from', 'To originate from or be caused by.', 'originar-se de, decorrer de', 'Many problems stem from poor communication.'],
  ['boil down to', 'To be reduced to its essential point.', 'resumir-se a', 'The debate boils down to one question: cost.'],
]

const C1_IDIOMS = [
  ['a blessing in disguise', 'Something that seems bad but turns out to be good.', 'há males que vêm para bem', 'Losing that job was a blessing in disguise.'],
  ['bite off more than you can chew', 'To take on more than you can manage.', 'dar um passo maior que a perna', 'I bit off more than I could chew with three courses at once.'],
  ['cut corners', 'To do something cheaply or carelessly.', 'fazer de qualquer jeito, economizar no essencial', 'Never cut corners on safety.'],
  ['get the hang of', 'To learn how to do something.', 'pegar o jeito', 'You’ll soon get the hang of it.'],
  ['hit the nail on the head', 'To describe exactly what is causing a situation.', 'acertar em cheio', 'You’ve hit the nail on the head.'],
  ['in the long run', 'Over a long period; eventually.', 'a longo prazo', 'It will save money in the long run.'],
  ['keep an eye on', 'To watch carefully.', 'ficar de olho em', 'Keep an eye on the budget.'],
  ['on the same page', 'In agreement; sharing the same understanding.', 'em sintonia', 'Let’s make sure we’re on the same page.'],
  ['play it by ear', 'To improvise rather than plan.', 'ver na hora, improvisar', 'We don’t have a plan — let’s play it by ear.'],
  ['the bottom line', 'The most important fact or consideration.', 'o principal, o que importa', 'The bottom line is that we need more staff.'],
  ['a steep learning curve', 'A situation in which you must learn a lot quickly.', 'curva de aprendizado íngreme', 'Starting a new job involves a steep learning curve.'],
  ['under the weather', 'Slightly ill.', 'indisposto', 'I’m feeling a bit under the weather today.'],
  ['by and large', 'On the whole; generally.', 'de modo geral', 'By and large, the project was a success.'],
  ['take something for granted', 'To fail to appreciate something because it is always there.', 'não dar valor, achar óbvio', 'We often take clean water for granted.'],
  ['be on the fence', 'To be undecided.', 'estar em cima do muro', 'I’m still on the fence about moving abroad.'],
  ['back to square one', 'Back to the beginning after a failure.', 'de volta à estaca zero', 'The test failed, so we’re back to square one.'],
  ['call it a day', 'To stop working for the day.', 'encerrar por hoje', 'It’s late — let’s call it a day.'],
  ['a far cry from', 'Very different from.', 'muito diferente de', 'This flat is a far cry from our old house.'],
  ['make ends meet', 'To earn just enough money to live.', 'fazer as contas fecharem', 'Many families struggle to make ends meet.'],
  ['jump on the bandwagon', 'To join a popular trend.', 'entrar na onda', 'Many companies jumped on the AI bandwagon.'],
  ['raise awareness', 'To increase people’s knowledge of an issue.', 'conscientizar', 'The campaign aims to raise awareness of mental health.'],
  ['pose a threat', 'To constitute a danger.', 'representar uma ameaça', 'Rising sea levels pose a threat to coastal cities.'],
  ['meet a deadline', 'To finish something by the required time.', 'cumprir um prazo', 'We worked overnight to meet the deadline.'],
  ['draw a conclusion', 'To reach a judgement after considering facts.', 'tirar uma conclusão', 'It’s too early to draw any conclusions.'],
  ['bear in mind', 'To remember or consider.', 'ter em mente', 'Bear in mind that the shop closes early.'],
  ['take into account', 'To consider when making a decision.', 'levar em conta', 'We must take costs into account.'],
  ['a vicious circle', 'A situation in which one problem causes another that makes the first worse.', 'círculo vicioso', 'Debt can become a vicious circle.'],
  ['strike a balance', 'To find a compromise between two things.', 'encontrar um equilíbrio', 'It’s hard to strike a balance between work and family.'],
  ['come to terms with', 'To accept something difficult.', 'aceitar, conformar-se com', 'He is still coming to terms with the loss.'],
  ['at stake', 'At risk; to be won or lost.', 'em jogo', 'Thousands of jobs are at stake.'],
]

// Gramática: [pergunta, resposta, explicação]
const C1_GRAMMAR = [
  ['Complete with inversion: “Never ___ such a mess.” (I / see)', 'Never have I seen such a mess.', 'Negative or limiting adverbials at the start (never, rarely, seldom, hardly) trigger auxiliary–subject inversion.'],
  ['Rewrite with “Not only”: “She speaks French and also Arabic.”', 'Not only does she speak French, but she also speaks Arabic.', '“Not only” at the start of the clause requires inversion.'],
  ['Complete: “No sooner had we arrived ___ it started to rain.”', 'than', '“No sooner … than” and “Hardly / Scarcely … when” express that one thing happened immediately after another.'],
  ['Mixed conditional: “If I had taken the job, I ___ (live) in London now.”', 'would be living / would live', 'Past condition (third conditional) with a present result (second conditional).'],
  ['Mixed conditional: “If she weren’t so shy, she ___ (speak) at yesterday’s meeting.”', 'would have spoken', 'Present/general condition with a past result.'],
  ['It-cleft — emphasise “John”: “John broke the window.”', 'It was John who broke the window.', 'Cleft sentences: It + be + emphasised element + who/that …'],
  ['Wh-cleft — emphasise the need: “I need a holiday.”', 'What I need is a holiday.', 'What + clause + be + emphasised element.'],
  ['Express regret: “I didn’t study. I wish ___.”', 'I wish I had studied.', 'wish + past perfect for regrets about the past.'],
  ['Complete: “It’s high time we ___ (leave).”', 'left', '“It’s (high/about) time” + past simple refers to the present: it should already be happening.'],
  ['Passive reporting: “People believe he is rich.”', 'He is believed to be rich. / It is believed that he is rich.', 'Reporting verbs (believe, say, think, report) + to-infinitive or it + that-clause.'],
  ['Passive reporting (past): “People say she left the country.”', 'She is said to have left the country.', 'Use a perfect infinitive (to have + past participle) for an earlier action.'],
  ['Deduction about the past: “I’m sure he forgot.” / “I’m sure he didn’t forget.”', 'He must have forgotten. / He can’t have forgotten.', 'must have / can’t have / might have + past participle.'],
  ['“I bought milk, but there was already some.” Which modal?', 'I needn’t have bought milk.', '“needn’t have done” = it was done but was unnecessary; “didn’t need to do” usually = it wasn’t done because it wasn’t necessary.'],
  ['Participle clause: “Because she felt tired, she went to bed.”', 'Feeling tired, she went to bed.', 'Present participle clauses can express reason or time when the subject is the same.'],
  ['Perfect participle: “After he had finished the report, he left.”', 'Having finished the report, he left.', 'Having + past participle shows that one action was completed before another.'],
  ['Conditional inversion: “If I had known, I would have helped.”', 'Had I known, I would have helped.', 'Also: “Should you need help, …” (= If you need) and “Were I you, …” (= If I were you).'],
  ['Complete: “You won’t pass ___ you study harder.”', 'unless', '“unless” = except if / if … not.'],
  ['Complete: “By June, I ___ (work) here for ten years.”', 'will have been working', 'Future perfect continuous: duration up to a point in the future.'],
  ['Complete: “I’d rather you ___ (not tell) anyone.”', 'didn’t tell', '“would rather” + another subject + past simple for present/future preferences.'],
  ['Mandative subjunctive: “The doctor recommended that he ___ (rest).”', 'rest', 'After recommend, insist, suggest, demand (+ that) use the base form (formal), or “should rest” in British English.'],
]

const C2_VOCAB = [
  ['ephemeral', 'Lasting for a very short time.', 'efêmero', 'Fame on social media is often ephemeral.'],
  ['obfuscate', 'To make something unclear or difficult to understand.', 'ofuscar, tornar obscuro', 'The report obfuscates the real figures.'],
  ['quintessential', 'Representing the most perfect or typical example.', 'por excelência, típico', 'He is the quintessential English gentleman.'],
  ['juxtapose', 'To place close together for contrasting effect.', 'justapor', 'The exhibition juxtaposes old and new art.'],
  ['ostensibly', 'Apparently or supposedly, but perhaps not actually.', 'aparentemente, supostamente', 'He was ostensibly there to help, but spent the day chatting.'],
  ['perfunctory', 'Carried out with minimum effort or interest.', 'superficial, feito por obrigação', 'She gave the document a perfunctory glance.'],
  ['recalcitrant', 'Stubbornly uncooperative.', 'recalcitrante, teimoso', 'A recalcitrant student refused to follow the rules.'],
  ['sycophantic', 'Excessively flattering in order to gain advantage.', 'bajulador', 'He was surrounded by sycophantic advisers.'],
  ['ineffable', 'Too great or extreme to be expressed in words.', 'inefável, indescritível', 'They felt an ineffable sense of joy.'],
  ['pernicious', 'Having a harmful effect, especially in a gradual way.', 'pernicioso, nocivo', 'Misinformation has a pernicious effect on democracy.'],
  ['equanimity', 'Mental calmness, especially in a difficult situation.', 'serenidade, equanimidade', 'She accepted the news with equanimity.'],
  ['cogent', 'Clear, logical and convincing.', 'convincente, lógico', 'He presented a cogent argument.'],
  ['esoteric', 'Intended for or understood by only a small group.', 'hermético, esotérico', 'The lecture was full of esoteric jargon.'],
  ['fastidious', 'Very attentive to detail; difficult to please.', 'exigente, meticuloso', 'He is fastidious about his appearance.'],
  ['idiosyncratic', 'Peculiar to an individual.', 'peculiar, idiossincrático', 'She has an idiosyncratic writing style.'],
  ['magnanimous', 'Generous or forgiving, especially towards a rival.', 'magnânimo', 'He was magnanimous in victory.'],
  ['nonchalant', 'Appearing casually calm and relaxed.', 'despreocupado, indiferente', 'She gave a nonchalant shrug.'],
  ['obsequious', 'Excessively eager to please or obey.', 'servil, subserviente', 'The obsequious waiter kept refilling our glasses.'],
  ['paradigm', 'A typical model or pattern of something.', 'paradigma', 'The discovery caused a paradigm shift in physics.'],
  ['placate', 'To make someone less angry or hostile.', 'apaziguar, aplacar', 'The manager tried to placate the customer.'],
  ['precarious', 'Not securely held; dangerously uncertain.', 'precário, instável', 'Their financial situation is precarious.'],
  ['prolific', 'Producing much work or many results.', 'prolífico', 'Agatha Christie was a prolific author.'],
  ['querulous', 'Complaining in a petulant or whining manner.', 'queixoso, lamuriento', 'A querulous voice interrupted the meeting.'],
  ['reticent', 'Not revealing one’s thoughts or feelings readily.', 'reservado, reticente', 'He was reticent about his past.'],
  ['serendipity', 'The occurrence of fortunate events by chance.', 'acaso feliz', 'It was pure serendipity that we met.'],
  ['superfluous', 'Unnecessary; more than is needed.', 'supérfluo', 'Remove any superfluous words from your essay.'],
  ['tenacious', 'Persistent; not giving up easily.', 'tenaz, persistente', 'She is a tenacious negotiator.'],
  ['vindicate', 'To clear of blame or show to be right.', 'inocentar; dar razão a', 'The new evidence vindicated him.'],
  ['zealous', 'Showing great energy or enthusiasm for a cause.', 'zeloso, fervoroso', 'A zealous supporter of reform.'],
  ['acquiesce', 'To accept something reluctantly but without protest.', 'consentir, aquiescer', 'She acquiesced to their demands.'],
  ['anachronistic', 'Belonging to a different period; out of date.', 'anacrônico', 'The law seems anachronistic today.'],
  ['belie', 'To give a false impression of; to contradict.', 'desmentir, disfarçar', 'His calm manner belied his anxiety.'],
  ['capricious', 'Given to sudden, unaccountable changes.', 'caprichoso, volúvel', 'The weather in the mountains is capricious.'],
  ['circumvent', 'To find a way around an obstacle or rule.', 'contornar, burlar', 'They found a way to circumvent the regulations.'],
  ['conundrum', 'A confusing and difficult problem.', 'enigma, dilema', 'Funding remains a conundrum for the project.'],
  ['deleterious', 'Causing harm or damage.', 'nocivo, deletério', 'Smoking has deleterious effects on health.'],
  ['disparate', 'Essentially different in kind; not comparable.', 'díspar', 'The book links disparate ideas.'],
  ['enervate', 'To cause someone to feel drained of energy.', 'esgotar, debilitar', 'The heat enervated everyone.'],
  ['exculpate', 'To show or declare that someone is not guilty.', 'inocentar, exculpar', 'The evidence exculpated the suspect.'],
  ['facetious', 'Treating serious issues with inappropriate humour.', 'jocoso, engraçadinho', 'Don’t be facetious — this is serious.'],
  ['gregarious', 'Fond of company; sociable.', 'sociável, gregário', 'She is gregarious and loves parties.'],
  ['hackneyed', 'Overused and therefore lacking originality.', 'batido, clichê', 'The film relies on hackneyed plots.'],
  ['impetuous', 'Acting quickly without thought or care.', 'impetuoso', 'It was an impetuous decision.'],
  ['inexorable', 'Impossible to stop or prevent.', 'inexorável', 'The inexorable rise of technology.'],
  ['laconic', 'Using very few words.', 'lacônico', 'His laconic reply was simply “No.”'],
  ['mollify', 'To appease the anger or anxiety of someone.', 'acalmar, apaziguar', 'The apology did little to mollify her.'],
  ['obstinate', 'Stubbornly refusing to change one’s opinion.', 'obstinado, teimoso', 'He remained obstinate despite the evidence.'],
  ['proclivity', 'A tendency to do something regularly.', 'propensão, inclinação', 'He has a proclivity for risk-taking.'],
  ['rescind', 'To revoke or cancel officially.', 'revogar, rescindir', 'The company rescinded the job offer.'],
  ['salient', 'Most noticeable or important.', 'principal, mais relevante', 'Summarise the salient points.'],
  ['tacit', 'Understood or implied without being stated.', 'tácito', 'There was a tacit agreement not to discuss it.'],
  ['truculent', 'Eager to argue or fight; aggressively defiant.', 'truculento, agressivo', 'He gave a truculent response to the criticism.'],
  ['unequivocal', 'Leaving no doubt; unambiguous.', 'inequívoco', 'She issued an unequivocal denial.'],
  ['venerate', 'To regard with great respect.', 'venerar', 'They venerate their ancestors.'],
  ['vicarious', 'Experienced through the feelings or actions of another person.', 'indireto, vicário', 'She took vicarious pleasure in her son’s success.'],
  ['wane', 'To decrease in strength or extent.', 'diminuir, declinar', 'Interest in the topic has waned.'],
  ['alacrity', 'Brisk and cheerful readiness.', 'presteza, prontidão', 'She accepted the invitation with alacrity.'],
  ['assuage', 'To make an unpleasant feeling less intense.', 'aliviar, mitigar', 'Nothing could assuage his guilt.'],
  ['erudite', 'Having or showing great knowledge or learning.', 'erudito', 'He is an erudite scholar of medieval history.'],
  ['incongruous', 'Not in harmony or keeping with the surroundings.', 'destoante, incongruente', 'Modern furniture looked incongruous in the old castle.'],
]

const C2_IDIOMS = [
  ['the elephant in the room', 'An obvious problem that nobody wants to discuss.', 'o assunto que todos evitam', 'Budget cuts were the elephant in the room.'],
  ['a Pyrrhic victory', 'A victory won at too great a cost.', 'vitória de Pirro', 'It was a Pyrrhic victory that left the company bankrupt.'],
  ['have a chip on one’s shoulder', 'To feel resentful, often about past unfair treatment.', 'ser ressentido, ter mágoa', 'He has a chip on his shoulder about not going to university.'],
  ['grasp the nettle', 'To tackle a difficulty boldly.', 'pegar o touro pelos chifres', 'The government must grasp the nettle on pension reform.'],
  ['throw down the gauntlet', 'To issue a challenge.', 'lançar um desafio', 'The rival firm threw down the gauntlet with lower prices.'],
  ['pass the buck', 'To shift responsibility to someone else.', 'empurrar a responsabilidade', 'Stop passing the buck and fix the problem.'],
  ['a moot point', 'A matter open to debate, or no longer relevant.', 'questão discutível / irrelevante', 'Whether he knew is now a moot point.'],
  ['split hairs', 'To argue about very small, unimportant details.', 'discutir detalhes insignificantes', 'Let’s not split hairs over the wording.'],
  ['toe the line', 'To conform to rules or standards.', 'andar na linha', 'Employees are expected to toe the line.'],
  ['beat around the bush', 'To avoid talking about the main point.', 'fazer rodeios, enrolar', 'Stop beating around the bush and tell me.'],
  ['a double-edged sword', 'Something with both good and bad consequences.', 'faca de dois gumes', 'Fame is a double-edged sword.'],
  ['have one’s cake and eat it', 'To want two things that are incompatible.', 'querer o melhor dos dois mundos', 'You can’t have your cake and eat it.'],
  ['bury the hatchet', 'To end a conflict and make peace.', 'fazer as pazes', 'The two rivals finally buried the hatchet.'],
  ['get wind of', 'To hear about something secret or private.', 'ficar sabendo (por boatos)', 'The press got wind of the merger.'],
  ['go out on a limb', 'To take a risk by saying or doing something without support.', 'arriscar-se', 'I’ll go out on a limb and say he’ll win.'],
  ['read between the lines', 'To understand the hidden meaning.', 'ler nas entrelinhas', 'If you read between the lines, she’s unhappy.'],
  ['rest on one’s laurels', 'To rely on past success without further effort.', 'dormir sobre os louros', 'We can’t afford to rest on our laurels.'],
  ['stick one’s neck out', 'To take a risk, especially to help or speak up.', 'arriscar o pescoço', 'She stuck her neck out to defend me.'],
  ['take something with a pinch of salt', 'Not to believe something completely.', 'não levar ao pé da letra', 'Take his promises with a pinch of salt.'],
  ['the tip of the iceberg', 'A small, visible part of a much larger problem.', 'a ponta do iceberg', 'These complaints are just the tip of the iceberg.'],
  ['a red herring', 'Something that misleads or distracts.', 'pista falsa', 'The missing letter turned out to be a red herring.'],
  ['cut to the chase', 'To get to the point without wasting time.', 'ir direto ao ponto', 'Let’s cut to the chase: how much will it cost?'],
  ['play devil’s advocate', 'To argue the opposite view to test an idea.', 'bancar o advogado do diabo', 'Let me play devil’s advocate for a moment.'],
  ['be in the same boat', 'To be in the same difficult situation as others.', 'estar no mesmo barco', 'We’re all in the same boat.'],
  ['leave no stone unturned', 'To try every possible way to find or achieve something.', 'fazer de tudo, não poupar esforços', 'The police left no stone unturned.'],
  ['fly off the handle', 'To lose one’s temper suddenly.', 'perder as estribeiras', 'He flies off the handle at the smallest thing.'],
  ['have bigger fish to fry', 'To have more important things to deal with.', 'ter coisas mais importantes a fazer', 'I’d help, but I have bigger fish to fry.'],
  ['steal someone’s thunder', 'To take attention or credit from someone.', 'roubar a cena', 'She stole my thunder by announcing it first.'],
  ['a dark horse', 'A little-known competitor who unexpectedly succeeds.', 'azarão', 'The new candidate is a dark horse.'],
  ['add insult to injury', 'To make a bad situation even worse.', 'para piorar a situação', 'To add insult to injury, it started raining.'],
  ['bend over backwards', 'To try very hard to help or please.', 'fazer de tudo (para ajudar)', 'They bent over backwards to accommodate us.'],
  ['burn the midnight oil', 'To work or study late into the night.', 'virar a noite estudando/trabalhando', 'She’s been burning the midnight oil before the exam.'],
  ['throw caution to the wind', 'To act recklessly, ignoring risks.', 'jogar a cautela para o alto', 'He threw caution to the wind and quit his job.'],
  ['put the cart before the horse', 'To do things in the wrong order.', 'colocar a carroça na frente dos bois', 'Buying furniture before the house is putting the cart before the horse.'],
  ['par for the course', 'Normal or expected in a given situation.', 'o normal, o esperado', 'Delays are par for the course on this route.'],
  ['a storm in a teacup', 'A lot of fuss about something unimportant.', 'tempestade em copo d’água', 'The argument was a storm in a teacup.'],
  ['call a spade a spade', 'To speak frankly and directly.', 'dar nome aos bois', 'She always calls a spade a spade.'],
  ['keep something at bay', 'To prevent something unpleasant from affecting you.', 'manter afastado, sob controle', 'Regular exercise keeps stress at bay.'],
  ['be at loggerheads', 'To be in strong disagreement.', 'estar às turras', 'The two departments are at loggerheads.'],
  ['turn a blind eye', 'To deliberately ignore something wrong.', 'fazer vista grossa', 'Managers turned a blind eye to the problem.'],
]

const C2_REGISTER = [
  ['a foregone conclusion', 'A result that is certain before it happens.', 'resultado já sabido, favas contadas', 'The election result was a foregone conclusion.'],
  ['bear the brunt of', 'To suffer the worst part of something.', 'arcar com o pior de', 'Small businesses bore the brunt of the crisis.'],
  ['wreak havoc', 'To cause great damage or chaos.', 'causar estragos', 'The storm wreaked havoc on the coast.'],
  ['pay lip service to', 'To express support without taking action.', 'apoiar só da boca para fora', 'Many firms pay lip service to diversity.'],
  ['come under fire', 'To be strongly criticised.', 'ser alvo de críticas', 'The minister came under fire for the decision.'],
  ['shed light on', 'To help explain or clarify.', 'esclarecer, lançar luz sobre', 'The study sheds light on sleep disorders.'],
  ['stand to reason', 'To be logical or obvious.', 'ser lógico, óbvio', 'It stands to reason that prices will rise.'],
  ['lend credence to', 'To make something more believable.', 'dar credibilidade a', 'The data lends credence to the theory.'],
  ['draw a distinction between', 'To point out the difference between two things.', 'fazer uma distinção entre', 'We must draw a distinction between the two cases.'],
  ['an uphill struggle', 'A very difficult effort over a long period.', 'uma luta árdua', 'Learning Mandarin is an uphill struggle.'],
  ['fall foul of', 'To come into conflict with (a law, rule or person).', 'infringir, entrar em conflito com', 'The company fell foul of data-protection rules.'],
  ['be steeped in', 'To be full of (history, tradition).', 'ser impregnado de', 'The city is steeped in history.'],
  ['far-reaching consequences', 'Effects that are wide-ranging and significant.', 'consequências de longo alcance', 'The reform will have far-reaching consequences.'],
  ['give rise to', 'To cause or produce.', 'dar origem a', 'The policy gave rise to widespread protests.'],
  ['in the wake of', 'Following, as a consequence of.', 'na esteira de, após', 'In the wake of the scandal, he resigned.'],
  ['be fraught with', 'To be full of (problems, danger).', 'estar repleto de (problemas)', 'The project was fraught with difficulties.'],
  ['take umbrage', 'To take offence.', 'ofender-se', 'She took umbrage at his remarks.'],
  ['be at odds with', 'To be in conflict or disagreement with.', 'estar em desacordo com', 'His statement is at odds with the facts.'],
  ['hold sway', 'To have great influence or power.', 'prevalecer, ter influência', 'Old traditions still hold sway in the village.'],
  ['err on the side of caution', 'To be more careful than may be necessary.', 'pecar pelo excesso de cautela', 'Let’s err on the side of caution.'],
  ['notwithstanding', 'In spite of (formal).', 'não obstante', 'Notwithstanding the difficulties, the project succeeded.'],
  ['insofar as', 'To the extent that.', 'na medida em que', 'The plan is useful insofar as it reduces costs.'],
  ['albeit', 'Although (used before an adjective or phrase).', 'embora, ainda que', 'It was a significant, albeit slow, improvement.'],
  ['whereby', 'By which; according to which (formal).', 'pelo qual', 'They set up a system whereby users can vote online.'],
  ['lest', 'For fear that; to avoid the risk that (formal).', 'para que não', 'He worked late lest he (should) miss the deadline.'],
]

const C2_GRAMMAR = [
  ['Inversion with “so”: “The noise was so loud that we couldn’t sleep.”', 'So loud was the noise that we couldn’t sleep.', 'So + adjective + be + subject; also “Such was the noise that …”.'],
  ['Inversion with “only when”: “We realised the mistake only when the results came in.”', 'Only when the results came in did we realise the mistake.', 'Only when / only after / only then → inversion in the main clause.'],
  ['Inversion with “little”: “He didn’t know what was about to happen.”', 'Little did he know what was about to happen.', '“Little” with a negative meaning at the start triggers inversion.'],
  ['Rewrite: “If it weren’t for your help, I would have failed.”', 'Were it not for your help, I would have failed. / But for your help, I would have failed.', 'Formal alternatives to “if it weren’t/hadn’t been for”.'],
  ['Inversion with “under no circumstances”: “You must not open this door under any circumstances.”', 'Under no circumstances must you open this door.', 'Negative adverbial phrase at the start → inversion.'],
  ['Inversion with “not until”: “I didn’t understand until much later.”', 'Not until much later did I understand.', 'The inversion goes in the main clause, after the time expression.'],
  ['Formal arrangement: “The president ___ visit Brazil next week.”', 'is to visit', '“be to + infinitive” for official plans; also for destiny: “He was never to see her again.”'],
  ['Concession with “much as”: “Although I like him, I can’t agree.”', 'Much as I like him, I can’t agree.', '“Much as” = although (emphatic, formal).'],
  ['Concession with “however”: “Even if it is very difficult, I’ll finish it.”', 'However difficult it is, I’ll finish it.', 'However / No matter how + adjective/adverb + subject + verb.'],
  ['Putative “should”: “It’s strange that he ___ say that.”', 'should say', '“should” after expressions of surprise or emotion (it’s odd/strange/surprising that …).'],
  ['Reduced relative clauses: “The man who is standing there is my uncle.”', 'The man standing there is my uncle.', 'Active → -ing participle; passive → past participle (“the book written in 1990”).'],
  ['Ellipsis: “Will it rain tomorrow?” — “I hope ___.” / “I hope ___.” (negative)', 'I hope so. / I hope not.', 'so/not replace a whole clause after hope, think, expect, be afraid.'],
  ['Emphatic “do”: make this sentence emphatic: “I appreciate your help.”', 'I do appreciate your help.', 'Auxiliary do/does/did adds emphasis or contrast in affirmative sentences.'],
  ['Future in the past: “I knew she ___ (come) later.”', 'would come / was going to come / was coming', 'Viewing the future from a point in the past.'],
  ['Fronting: emphasise the object in “I can’t stand his arrogance.”', 'His arrogance I can’t stand.', 'Moving the object to the front gives it emphasis (common in spoken and literary English).'],
  ['Causative “have”: “Someone stole my car.” (focus on what happened to me)', 'I had my car stolen.', '“have something done” also describes unpleasant experiences, not only services.'],
  ['Inverted comparison (formal): complete “She was very tired, as ___ the others.”', 'were', 'Inversion may follow “as” and “than” in formal style: “… than did his brother.”'],
  ['“Come what may” means…', 'Whatever happens.', 'Fixed subjunctive expression: “Come what may, I’ll support you.” (aconteça o que acontecer)'],
  ['“Not that …” — what does it add? “I didn’t go — not that I wanted to.”', 'It denies a possible inference.', 'Clarifies that something the listener might assume is not true. (não que eu quisesse)'],
  ['“Need” and “dare” as modals: correct form? “___ I say more?” / “How ___ you!”', 'Need / dare', 'As modals they take no -s and no “to”: “He needn’t come.”, “I daren’t ask.”'],
  ['“Provided that” vs “supposing”: which means “only if”?', 'Provided (that) / providing', '“Supposing” introduces an imaginary situation: “Supposing you won, what would you do?”'],
  ['“Had better” vs “would rather”: complete “You ___ leave now or you’ll miss the bus.”', 'had better', '“had better + base form” = strong advice/warning; “would rather” = preference.'],
  ['Inversion with “seldom”: “We seldom see such talent.”', 'Seldom do we see such talent.', 'seldom, rarely, hardly ever + inversion (formal).'],
  ['Inversion with “on no account”: “You shouldn’t tell her on any account.”', 'On no account should you tell her.', 'Negative adverbial phrase → inversion.'],
  ['Subjunctive “were” in formal hypotheses: “If I ___ in your position, I’d accept.”', 'were', '“were” is used for all persons in formal hypothetical conditions.'],
]

// ---------------------------------------------------------------------
// Baralhos e cartões
// ---------------------------------------------------------------------
const english = SUBJECTS.find((s) => s.name === 'Inglês')
const flashcard_decks = []
const flashcards = []
const now = new Date().toISOString()

function deck(name, description, topicPath, items, kind, tags) {
  const did = id()
  const topic_id = topicByName.get(`Inglês/${topicPath}`)
  flashcard_decks.push({ id: did, name, description, folder: 'Inglês', subject_id: english.id, topic_id })
  for (const it of items) {
    const card =
      kind === 'grammar'
        ? { front: it[0], back: it[1], note: it[2] }
        : { front: it[0], back: `${it[1]}\n\nPT: ${it[2]}`, note: `Ex.: ${it[3]}` }
    flashcards.push({ id: id(), deck_id: did, subject_id: english.id, topic_id, ...card, tags, status: 'new', due_at: now })
  }
}

deck('Inglês C1 — Vocabulário', 'Palavras de nível C1 com definição, tradução e exemplo.', 'Vocabulário C1', C1_VOCAB, 'vocab', ['C1', 'vocabulario'])
deck('Inglês C1 — Phrasal verbs', 'Phrasal verbs frequentes no nível C1.', 'Phrasal verbs', C1_PHRASAL, 'vocab', ['C1', 'phrasal-verbs'])
deck('Inglês C1 — Idioms e collocations', 'Expressões idiomáticas e combinações comuns.', 'Idioms e collocations', C1_IDIOMS, 'vocab', ['C1', 'idioms'])
deck('Inglês C1 — Gramática', 'Inversão, condicionais mistas, cleft sentences e mais.', 'Gramática C1', C1_GRAMMAR, 'grammar', ['C1', 'gramatica'])
deck('Inglês C2 — Vocabulário', 'Vocabulário avançado de nível C2.', 'Vocabulário C2', C2_VOCAB, 'vocab', ['C2', 'vocabulario'])
deck('Inglês C2 — Idioms', 'Expressões idiomáticas avançadas.', 'Idioms avançados', C2_IDIOMS, 'vocab', ['C2', 'idioms'])
deck('Inglês C2 — Collocations e registro formal', 'Collocations e conectores de registro acadêmico/formal.', 'Collocations e registro formal', C2_REGISTER, 'vocab', ['C2', 'registro-formal'])
deck('Inglês C2 — Gramática avançada', 'Inversões, concessões, subjuntivo e ênfase.', 'Gramática avançada', C2_GRAMMAR, 'grammar', ['C2', 'gramatica'])

// ---------------------------------------------------------------------
// Mapas mentais (um por matéria, gerados a partir da árvore de tópicos)
// ---------------------------------------------------------------------
function mindMap(s) {
  const nodes = [{ id: 'root', type: 'mind', position: { x: -90, y: -24 }, data: { label: s.name, color: '#3B2B20', size: 'lg', shape: 'pill' } }]
  const edges = []
  const branches = s.tree
  const half = Math.ceil(branches.length / 2)
  const sides = [branches.slice(0, half), branches.slice(half)]
  const ROW = 44
  sides.forEach((group, sideIdx) => {
    const dir = sideIdx === 0 ? 1 : -1
    const heights = group.map(([, ch]) => Math.max(1, ch?.length ?? 0) * ROW + 24)
    const total = heights.reduce((a, b) => a + b, 0)
    let y = -total / 2
    group.forEach(([name, children], bi) => {
      const h = heights[bi]
      const bid = `b-${sideIdx}-${bi}`
      const by = y + h / 2 - 20
      nodes.push({ id: bid, type: 'mind', position: { x: dir > 0 ? 220 : -440, y: by }, data: { label: name, color: s.color, size: 'md', shape: 'rounded' } })
      edges.push({ id: `e-${bid}`, source: 'root', target: bid, sourceHandle: dir > 0 ? 'right' : 'left', targetHandle: dir > 0 ? 'left' : 'right' })
      ;(children ?? []).forEach(([leaf], li) => {
        const lid = `${bid}-${li}`
        const ly = y + 12 + li * ROW
        nodes.push({ id: lid, type: 'mind', position: { x: dir > 0 ? 520 : -800, y: ly }, data: { label: leaf, color: '#DEB887', size: 'sm', shape: 'rounded' } })
        edges.push({ id: `e-${lid}`, source: bid, target: lid, sourceHandle: dir > 0 ? 'right' : 'left', targetHandle: dir > 0 ? 'left' : 'right' })
      })
      y += h
    })
  })
  return { id: id(), title: `Mapa — ${s.name}`, description: `Visão geral dos tópicos de ${s.name}.`, folder: 'Matérias', subject_id: s.id, topic_id: null, data: { nodes, edges } }
}
const mind_maps = SUBJECTS.map(mindMap)

// ---------------------------------------------------------------------
// Sessões do SEVEN: 200 dias seguidos, 2 h/dia (07:00–09:00, horário de
// Brasília, UTC−3) terminando em 21/10/2026 → 400 h e 200 dias seguidos.
// ---------------------------------------------------------------------
const seven = SUBJECTS.find((s) => s.name === 'SEVEN')
const sevenLeaves = leafTopics.get('SEVEN')
const LAST_DAY = Date.UTC(2026, 9, 21) // 21/10/2026
const DAYS = 200
const study_sessions = []
for (let i = DAYS - 1; i >= 0; i--) {
  const day = LAST_DAY - i * 86400000
  const start = new Date(day + 10 * 3600000) // 07:00 em Brasília
  const end = new Date(start.getTime() + 2 * 3600000)
  const n = DAYS - 1 - i
  study_sessions.push({
    id: id(),
    subject_id: seven.id,
    topic_id: sevenLeaves[n % sevenLeaves.length],
    activity_type: 'other',
    mode: 'manual',
    status: 'completed',
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    adjustment_seconds: 0,
    notes: 'Serviço SEVEN',
    pauses: [],
  })
}

const pacote = {
  aplicativo: 'EVoLuMentaL Control',
  tipo: 'pacote-de-conteudo',
  versao: 1,
  gerado_em: now,
  subjects: subjects.map(({ ...s }) => s),
  topics,
  flashcard_decks,
  flashcards,
  mind_maps,
  study_sessions,
}

const out = new URL('./pacote-estudos.json', import.meta.url)
writeFileSync(out, JSON.stringify(pacote, null, 2))
const hours = study_sessions.length * 2
console.log(
  `OK: ${subjects.length} matérias, ${topics.length} tópicos, ${flashcard_decks.length} baralhos, ${flashcards.length} flashcards, ${mind_maps.length} mapas, ${study_sessions.length} sessões (${hours} h, ${study_sessions[0].started_at.slice(0, 10)} → ${study_sessions.at(-1).started_at.slice(0, 10)})`,
)
