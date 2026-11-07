// Plano de 28 dias para o concurso CGU 2026 — Cargo 2 (AFFC · TI · Ciência de Dados), banca Cebraspe, prova em 13/12/2026.
// Dia 1 = 07/11/2026 (CGU_START_DATE); o dia 28 cai em 04/12/2026.
//
// Fontes conferidas em 06/11/2026: Edital nº 1 (PDF oficial) e Edital nº 2 (retificação só do subitem 6.2.4 e de datas de
// atendimento especializado; conteúdo programático e data da prova inalterados). Materiais: pastas reais do Google Drive do
// usuário (IDs conferidos arquivo a arquivo pelo conector do Drive em 06/11/2026; as pastas Avaliação, Otimização, Transformação,
// Engenharia de Prompt, Modelagem Lógica e DAMA só têm apostila em PDF). O progresso de cada aula fica em Cursos (importar a pasta).
//
// Questões: QConcursos, sempre com o filtro de banca Cebraspe (`examining_board_ids[]=2`). As páginas de disciplina/assunto e o
// efeito do filtro foram conferidos em 07/11/2026 (ex.: Banco de Dados › SQL: 4.727 questões → 835 só da Cebraspe). O QConcursos
// não tem uma disciplina chamada "Ciência de Dados": aprendizado de máquina, redes neurais, PLN e MLOps ficam em Engenharia de
// Software › Inteligência Artificial e em Noções de Informática › Inteligência Artificial e Automação, além de Banco de Dados ›
// Data Mining / Big Data e Estatística (regressão, modelos lineares, resíduos, séries temporais). Lei 12.846 (e Decreto 11.129),
// Lei 12.813, Decreto 9.203 e Lei 14.129 têm assunto próprio em Legislação Federal. Os slugs novos foram tirados do índice de
// busca do próprio QConcursos em 07/11/2026 (o site bloqueia leitura automatizada; confira abrindo no navegador, logado).

export type CguBlock = 'P1' | 'P2' | 'P3' | 'P4' | 'Geral'
export type CguTaskKind = 'diagnostico' | 'aula' | 'leitura' | 'questoes' | 'revisao' | 'discursiva' | 'simulado'

/** Um filtro pronto do QConcursos (disciplina ou assunto, já com a banca Cebraspe). */
export interface QcLink {
  label: string
  url: string
}

export type CguLink =
  | { kind: 'drive'; driveId: string; folderId: string; folder: string; media: 'video' | 'pdf' | 'folder' }
  | { kind: 'qc'; tema: string; subtemas: string[]; quantidade: number; links: QcLink[] }
  | { kind: 'route'; to: string }

export interface CguTask {
  id: string
  day: number
  block: CguBlock
  kind: CguTaskKind
  title: string
  /** O que abrir. */
  open: string
  /** Até onde ir. */
  until: string
  minutes: number
  link: CguLink
}

export interface CguDay {
  day: number
  theme: string
  tasks: CguTask[]
}

export const CGU_EXAM_DATE = '2026-12-13'
/** Dia 1 do plano. O dia atual é contado a partir desta data, não do primeiro toque em "Começar". */
export const CGU_START_DATE = '2026-11-07'
export const CGU_DAILY_LIMIT_MINUTES = 180

/** Pontuação da prova objetiva (edital nº 1, itens 7.1, 8.11.4 e 15) e da discursiva (item 9). */
export const CGU_SCORING = {
  P1: { itens: 40, peso: 1, minimo: 8, nome: 'Conhecimentos básicos' },
  P2: { itens: 40, peso: 1, minimo: 12, nome: 'Conhecimentos complementares' },
  P3: { itens: 90, peso: 2, minimo: 54, nome: 'Conhecimentos específicos' },
  total: { minimo: 78, maximo: 260 },
  /** Questão de 30 linhas (30 pts, NQ1 = NC − 6×NE÷TL) + situação-problema de 60 linhas (70 pts, NQ2 = NC − 14×NE÷TL); mínimo 50. */
  P4: { q1: { linhas: 30, pontos: 30, fatorErro: 6 }, q2: { linhas: 60, pontos: 70, fatorErro: 14 }, minimo: 50 },
} as const

/** Temas do edital (grafia exata de banco-questoes/cgu/programa-cgu-2026.json; mantida como chave do mapeamento). */
export const T = {
  dem: 'CGU P1 · Estado, democracia, direitos e ciência política',
  soc: 'CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento',
  eti: 'CGU P1 · Ética pública e responsabilidade profissional',
  adm: 'CGU P1 · Administração pública e políticas públicas',
  gov: 'CGU P2 · Governança, riscos e integridade',
  tra: 'CGU P2 · Transparência, ouvidoria e participação social',
  dir: 'CGU P2 · Direito público, controle e responsabilização',
  evi: 'CGU P2 · Evidências, dados e inteligência artificial',
  aud: 'CGU P2 · Auditoria governamental e atuação integrada da CGU',
  sta: 'CGU P3 · Estatística, programação e análise de dados',
  eng: 'CGU P3 · Engenharia, arquitetura e governança de dados',
  ml: 'CGU P3 · Aprendizado de máquina e inteligência artificial',
  ops: 'CGU P3 · Operação, governança e gestão de soluções de dados e IA',
} as const

// ---------------------------------------------------------------------------------------------------------------------
// QConcursos — filtros prontos. Padrão de URL conferido em 07/11/2026:
//   https://www.qconcursos.com/questoes-de-concursos/disciplinas/<disciplina>/<assunto>/questoes?examining_board_ids[]=2
// (sub-assuntos usam slug plano, sem o pai no caminho; o mesmo filtro vale sem <assunto> para a disciplina inteira).
const QC_BASE = 'https://www.qconcursos.com/questoes-de-concursos'
export const QC_CEBRASPE = 'examining_board_ids%5B%5D=2'
/** Slugs das disciplinas do QConcursos (conferidos no índice de disciplinas em 07/11/2026). */
export const QC_DISCIPLINAS = {
  bd: 'tecnologia-da-informacao-banco-de-dados',
  es: 'tecnologia-da-informacao-engenharia-de-software',
  prog: 'tecnologia-da-informacao-programacao',
  gti: 'tecnologia-da-informacao-governanca-de-ti',
  seg: 'tecnologia-da-informacao-seguranca-da-informacao',
  est: 'estatistica-estatistica',
  rl: 'matematica-raciocinio-logico',
  adm: 'administracao-administracao-publica',
  afo: 'administracao-administracao-financeira-e-orcamentaria',
  gp: 'administracao-gerencia-de-projetos',
  eti: 'administracao-etica-na-administracao-publica',
  audg: 'ciencias-contabeis-auditoria-governamental',
  aud: 'ciencias-contabeis-auditoria',
  cext: 'direito-controle-externo',
  dadm: 'direito-direito-administrativo',
  dcon: 'direito-direito-constitucional',
  ddig: 'direito-direito-digital',
  lfed: 'direito-legislacao-federal',
  cpol: 'ciencias-sociais-ciencia-politica',
  soc: 'ciencias-sociais-sociologia',
  ninf: 'tecnologia-da-informacao-nocoes-de-informatica',
  arq: 'tecnologia-da-informacao-arquitetura-de-software',
  dfin: 'direito-direito-financeiro',
} as const
const QD = QC_DISCIPLINAS
export const qcUrl = (disciplina: string, assunto?: string) => `${QC_BASE}/disciplinas/${disciplina}${assunto ? `/${assunto}` : ''}/questoes?${QC_CEBRASPE}`
const L = (label: string, disciplina: string, assunto?: string): QcLink => ({ label, url: qcUrl(disciplina, assunto) })
/** Revisão: busca geral da banca; na página do QConcursos, filtre pelas questões que você errou. */
export const QC_REVISAO: QcLink = { label: 'QConcursos · questões Cebraspe (filtre “que errei”)', url: `${QC_BASE}/questoes?${QC_CEBRASPE}` }

interface QcTheme {
  /** Filtros para "todos os subtemas" (diagnóstico, simulado e questões gerais do tema). */
  all: QcLink[]
  /** Filtros por subtema do edital (mesma grafia usada nas tarefas). */
  sub: Record<string, QcLink[]>
}

const CPOL = {
  estado: L('Ciência Política › Elementos do Estado', QD.cpol, 'os-elementos-do-estado-populacao-x-povo-territorio-finalidade-nacao-soberania'),
  weber: L('Ciência Política › Weber e legitimidade do poder', QD.cpol, 'max-weber-e-a-legitimidade-do-poder-nacionalismo'),
  concepcoes: L('Ciência Política › Concepções teóricas de Estado', QD.cpol, 'concepcoes-teoricas-de-estado'),
  democracia: L('Ciência Política › Democracia direta, representativa e participativa', QD.cpol, 'democracia-direta-indireta-ou-representativa-semidireta-e-participativa-democracia-liberal-teoria-das-elites-e-democracia-majoritaria-e-consensual'),
  poliarquia: L('Ciência Política › Poliarquia, sistemas eleitorais, partidos e grupos de pressão', QD.cpol, 'poliarquia-democracia-pluralista-deliberativa-e-teorias-democraticas-contemporaneas-sistema-representativo-sistemas-eleitorais-e-partidos-politicos-grupos-de-pressao-e-opiniao-publica'),
  poderes: L('Ciência Política › Separação de poderes e sistemas de governo', QD.cpol, 'montesquieu-e-a-separacao-de-poderes-executivo-legislativo-e-judiciario-sistemas-de-governo-presidencialismo-e-parlamentarismo'),
  federalismo: L('Ciência Política › Formas de Estado e federalismo', QD.cpol, 'formas-de-estado-unitario-federal-e-confederal-modelos-de-federalismo'),
  bemEstar: L('Ciência Política › Estado de bem-estar e políticas públicas', QD.cpol, 'estado-de-bem-estar-social-politicas-publicas-e-politicas-sociais-no-brasil-e-no-mundo'),
  brasil: L('Ciência Política › Pensamento político no Brasil', QD.cpol, 'historia-e-pensamento-politico-no-brasil'),
}
const DCON = {
  principios: L('Constitucional › Princípios fundamentais da República', QD.dcon, 'principios-fundamentais-da-republica'),
  direitosFund: L('Constitucional › Teoria dos direitos fundamentais', QD.dcon, 'teoria-dos-direitos-fundamentais'),
  sociais: L('Constitucional › Direitos sociais', QD.dcon, 'direitos-sociais'),
  politicos: L('Constitucional › Direitos políticos', QD.dcon, 'direitos-politicos'),
  federalismo: L('Constitucional › Federalismo brasileiro', QD.dcon, 'o-federalismo-brasileiro'),
  competencias: L('Constitucional › Repartição de competências', QD.dcon, 'reparticao-de-competencias-constitucionais'),
  admPrincipios: L('Constitucional › Princípios da Administração Pública (art. 37)', QD.dcon, 'principios-da-administracao-publica'),
  separacao: L('Constitucional › Separação dos poderes', QD.dcon, 'principio-da-separacao-dos-poderes'),
  tcu: L('Constitucional › TCU e fiscalização (arts. 70 a 75)', QD.dcon, 'tribunal-de-contas-da-uniao-tcu-e-fiscalizacao-contabil-financeira-e-orcamentaria-da-uniao'),
  ordemSocial: L('Constitucional › Ordem social', QD.dcon, 'ordem-social'),
}
const ADM = {
  estado: L('Adm. Pública › Estado, governo e administração', QD.adm, 'conceitos-estado-governo-e-administracao-publica'),
  organizacao: L('Adm. Pública › Organização e estrutura do Estado', QD.adm, 'organizacao-e-estrutura-do-estado-governo-e-administracao'),
  modelos: L('Adm. Pública › Modelos teóricos (patrimonialista, burocrático, gerencial)', QD.adm, 'modelos-teoricos-de-administracao-publica'),
  governanca: L('Adm. Pública › Governabilidade, governança e accountability', QD.adm, 'governabilidade-governanca-e-accountability'),
  principiosGov: L('Adm. Pública › Princípios de governança pública', QD.adm, 'principios-de-governanca-publica'),
  accountability: L('Adm. Pública › Accountability e transparência', QD.adm, 'accountability-e-transparencia-na-administracao-publica'),
  compliance: L('Adm. Pública › Compliance na administração pública', QD.adm, 'compliance-na-administracao-publica'),
  govEletronico: L('Adm. Pública › Governo eletrônico e transparência', QD.adm, 'governo-eletronico-e-transparencia'),
  lai: L('Adm. Pública › Transparência e Lei de Acesso à Informação', QD.adm, 'transparencia-e-a-lei-de-acesso-a-informacao'),
  politicas: L('Adm. Pública › Gestão de políticas públicas', QD.adm, 'gestao-de-politicas-publicas'),
  resultados: L('Adm. Pública › Gestão por resultados', QD.adm, 'gestao-por-resultados'),
  afo: L('Adm. Financeira e Orçamentária (toda a disciplina)', QD.afo),
}
const AFO = {
  instrumentos: L('AFO › Instrumentos de planejamento (PPA, LDO, LOA)', QD.afo, 'instrumentos-de-planejamento'),
  ciclo: L('AFO › Ciclo orçamentário', QD.afo, 'ciclo-orcamentario'),
  orcamento: L('AFO › Orçamento público', QD.afo, 'orcamento-publico-em-afo'),
  execucao: L('AFO › Execução orçamentária', QD.afo, 'execucao-orcamentaria'),
}
const DFIN = {
  leisOrcamentarias: L('Direito Financeiro › Leis orçamentárias (PPA, LDO e LOA)', QD.dfin, 'as-leis-orcamentarias-ppa-ldo-e-loa'),
}
const ETI = {
  todas: L('Ética na Administração Pública (toda a disciplina)', QD.eti),
  intro: L('Ética › Ética, moral e orientações gerais', QD.eti, 'introducao-etica-e-moral-e-orientacoes-gerais'),
  dec1171: L('Ética › Código de Ética do Servidor (Decreto 1.171/1994)', QD.eti, 'codigo-de-etica-profissional-do-servidor-publico-civil-do-poder-executivo-federal-decreto-n-1-171-de-1994'),
  altaAdm: L('Ética › Código de Conduta da Alta Administração Federal', QD.eti, 'codigo-de-conduta-da-alta-administracao-federal'),
  improbidade: L('Ética › Improbidade (Lei 8.429) e Lei 8.112', QD.eti, 'atos-e-sancoes-na-lei-de-improbidade-lei-n-8-429-de-1992-e-no-estatuto-dos-servidores-publicos-federais-lei-n-8-112-de-1990'),
  gestaoEtica: L('Ética › Sistema de Gestão da Ética (Decreto 6.029/2007)', QD.eti, 'sistema-de-gestao-da-etica-do-poder-executivo-federal-decreto-n-6-029-de-2007'),
}
const DADM = {
  principios: L('Direito Administrativo › Princípios da Administração', QD.dadm, 'principios-da-administracao-publica'),
  organizacao: L('Direito Administrativo › Organização da Administração', QD.dadm, 'organizacao-da-administracao-publica'),
  atos: L('Direito Administrativo › Atos administrativos', QD.dadm, 'atos-administrativos'),
  requisitos: L('Direito Administrativo › Requisitos do ato (competência, finalidade, forma, motivo, objeto)', QD.dadm, 'requisitos-do-ato-administrativo-competencia-finalidade-forma-motivo-e-objeto'),
  motivos: L('Direito Administrativo › Teoria dos motivos determinantes', QD.dadm, 'teoria-dos-motivos-determinantes'),
  processo: L('Direito Administrativo › Processo administrativo (Lei 9.784/1999)', QD.dadm, 'processo-administrativo-lei-n-9-784-de-1999-e-lei-n-14-210-de-2021'),
  controle: L('Direito Administrativo › Controle da Administração', QD.dadm, 'controle-da-administracao-publica'),
  improbidade: L('Direito Administrativo › Improbidade administrativa (Leis 8.429 e 14.230)', QD.dadm, 'improbidade-administrativa-lei-n-8-429-de-1992-e-lei-n-14-230-de-2021'),
  responsabilidade: L('Direito Administrativo › Responsabilidade civil do Estado', QD.dadm, 'responsabilidade-civil-do-estado'),
  licitacoes: L('Direito Administrativo › Licitações (Lei 14.133/2021)', QD.dadm, 'licitacoes-e-lei-n-14-133-de-2021'),
  contratos: L('Direito Administrativo › Contratos administrativos (Lei 14.133/2021)', QD.dadm, 'contratos-administrativos-lei-n-14-133-de-2021'),
}
const AUDG = {
  todas: L('Auditoria Governamental (toda a disciplina)', QD.audg),
  auditoria: L('Auditoria Governamental › Conceitos, finalidade e tipos', QD.audg, 'auditoria-governamental'),
  governanca: L('Auditoria Governamental › Governança e análise de risco', QD.audg, 'governanca-e-analise-de-risco'),
  govSetorPublico: L('Auditoria Governamental › Governança no setor público', QD.audg, 'governanca-no-setor-publico'),
  coso: L('Auditoria Governamental › Estrutura de análise de risco (COSO)', QD.audg, 'estrutura-conceitual-de-analise-de-risco-coso'),
  sci: L('Auditoria Governamental › Sistema de Controle Interno (SCI)', QD.audg, 'sistema-de-controle-interno-sci'),
  cgu: L('Auditoria Governamental › Controladoria-Geral da União', QD.audg, 'controladoria-geral-da-uniao-cgu'),
  scipef: L('Auditoria Governamental › SCI do Poder Executivo Federal', QD.audg, 'sistema-de-controle-interno-do-poder-executivo-federal-scipef'),
  interna: L('Auditoria Governamental › Auditoria interna governamental', QD.audg, 'auditoria-interna-governamental'),
  externo: L('Auditoria Governamental › Controle externo', QD.audg, 'controle-externo'),
  testes: L('Auditoria Governamental › Testes, procedimentos e técnicas', QD.audg, 'testes-procedimentos-e-tecnicas-de-auditoria'),
  processo: L('Auditoria Governamental › Processo de auditoria', QD.audg, 'processo-de-auditoria'),
  evidencia: L('Auditoria Governamental › Evidência de auditoria', QD.audg, 'evidencia-de-auditoria-governamental'),
  planejamento: L('Auditoria Governamental › Planejamento e programa de auditoria', QD.audg, 'planejamento-e-programa-de-auditoria'),
  normas: L('Auditoria Governamental › Normas da INTOSAI e do IIA', QD.audg, 'normas-da-intosai-e-do-iia'),
}
const AUD = {
  controleInterno: L('Auditoria › Controle interno', QD.aud, 'controle-interno'),
  coso: L('Auditoria › Controle interno COSO', QD.aud, 'controle-interno-coso'),
  riscoGov: L('Auditoria › Gestão de risco, controle e governança corporativa', QD.aud, 'gestao-de-risco-controle-e-governanca-corporativa'),
  fraude: L('Auditoria › Fraude e erro', QD.aud, 'fraude-e-erro'),
}
const CEXT = {
  normas: L('Controle Externo › Normas constitucionais (arts. 70 a 75)', QD.cext, 'normas-constitucionais-sobre-o-controle-externo'),
  art74: L('Controle Externo › Art. 74 (sistema de controle interno)', QD.cext, 'art-74-sistema-de-controle-interno'),
  funcoes: L('Controle Externo › Funções dos Tribunais de Contas', QD.cext, 'funcoes-dos-tribunais-de-contas'),
}
const LFED = {
  lai: L('Legislação Federal › Lei 12.527/2011 (acesso à informação) e Decreto 7.724', QD.lfed, 'lei-n-12-527-de-2011-lei-de-acesso-a-informacao-e-decreto-n-7-724-de-2012'),
  usuarios: L('Legislação Federal › Lei 13.460/2017 (usuários dos serviços públicos e ouvidorias)', QD.lfed, 'lei-n-13-460-de-2017-dispoe-sobre-participacao-protecao-e-defesa-dos-direitos-do-usuario-dos-servicos-publicos-da-administracao-publica'),
  dec3591: L('Legislação Federal › Decreto 3.591/2000 (SCI do Executivo federal)', QD.lfed, 'decreto-n-3-591-de-2000-sistema-de-controle-interno-do-poder-executivo-federal-e-legislacao-especifica'),
  dl200: L('Legislação Federal › Decreto-Lei 200/1967', QD.lfed, 'decreto-lei-200-de-1967-organizacao-da-administracao-federal'),
  anticorrupcao: L('Legislação Federal › Lei 12.846/2013 (Lei Anticorrupção)', QD.lfed, 'lei-n-12-846-de-2013-responsabilizacao-administrativa-e-civil-de-pessoas-juridicas-pela-pratica-de-atos-contra-a-administracao-publica-nacional-ou-estrangeira-lei-anticorrupcao'),
  dec11129: L('Legislação Federal › Decreto 11.129/2022 (regulamento da Lei Anticorrupção, programa de integridade)', QD.lfed, 'decreto-n-11-129-de-2022-regulamenta-a-lei-n-12-846-de-2013'),
  conflito: L('Legislação Federal › Lei 12.813/2013 (conflito de interesses)', QD.lfed, 'lei-12-813-de-2013-conflito-de-interesses-no-exercicio-de-cargo-ou-emprego-do-poder-executivo-federal-e-impedimentos-posteriores-ao-exercicio-do-cargo-ou-emprego'),
  dec9203: L('Legislação Federal › Decreto 9.203/2017 (política de governança pública)', QD.lfed, 'decreto-n-9-203-de-2017-politica-de-governanca-da-administracao-publica-federal-direta-autarquica-e-fundacional'),
  govDigital: L('Legislação Federal › Lei 14.129/2021 (governo digital)', QD.lfed, 'lei-n-14-129-de-2021-principios-regras-e-instrumentos-para-o-governo-digital'),
}
const DDIG = {
  lgpd: L('Direito Digital › LGPD (Lei 13.709/2018)', QD.ddig, 'lei-n-13-709-de-2018-lei-geral-de-protecao-de-dados-pessoais-lgpd'),
  tratamento: L('Direito Digital › LGPD: tratamento de dados pessoais', QD.ddig, 'tratamento-de-dados-pessoais'),
  poderPublico: L('Direito Digital › LGPD: tratamento pelo Poder Público', QD.ddig, 'tratamento-de-dados-pessoais-pelo-poder-publico'),
  seguranca: L('Direito Digital › LGPD: segurança, boas práticas e fiscalização', QD.ddig, 'seguranca-boas-praticas-e-fiscalizacao'),
  agentes: L('Direito Digital › LGPD: agentes de tratamento', QD.ddig, 'agentes-de-tratamento-de-dados-pessoais'),
  fundamentos: L('Direito Digital › Fundamentos do direito digital', QD.ddig, 'aspectos-conceituais-e-fundamentos-do-direito-digital'),
}
const SOC = {
  todas: L('Sociologia (toda a disciplina)', QD.soc),
  estratificacao: L('Sociologia › Estratificação e desigualdade social', QD.soc, 'estratificacao-e-desigualdade-social'),
  racaClasseGenero: L('Sociologia › Desigualdades de raça, classe e gênero', QD.soc, 'desigualdades-de-raca-classe-e-genero'),
  desigualdadeBrasil: L('Sociologia › Desigualdade social no Brasil', QD.soc, 'desigualdade-social-no-brasil'),
  cidadania: L('Sociologia › Cidadania e movimentos sociais', QD.soc, 'cidadania-e-movimentos-sociais'),
  direitos: L('Sociologia › Direitos civis, políticos e sociais', QD.soc, 'direitos-civis-politicos-e-sociais'),
  movimentosBrasil: L('Sociologia › Movimentos sociais no Brasil', QD.soc, 'movimentos-sociais-no-brasil'),
  identidade: L('Sociologia › Cultura e identidade nacional', QD.soc, 'cultura-e-identidade-nacional'),
  trabalho: L('Sociologia › Globalização e mudanças no trabalho', QD.soc, 'globalizacao-reestruturacao-produtiva-e-mudancas-recentes-do-trabalho'),
  urbano: L('Sociologia › Segregação socioespacial e políticas urbanas', QD.soc, 'segregacao-socioespacial-e-politicas-publicas-urbanas'),
  politica: L('Sociologia › Política, poder e Estado', QD.soc, 'politica-poder-e-estado'),
}
const EST = {
  todas: L('Estatística (toda a disciplina)', QD.est),
  descritiva: L('Estatística › Estatística descritiva (análise exploratória)', QD.est, 'estatistica-descritiva-analise-exploratoria-de-dados'),
  variaveis: L('Estatística › Tipos de variáveis', QD.est, 'tipos-de-variaveis'),
  posicao: L('Estatística › Medidas de posição (média, mediana, moda)', QD.est, 'medidas-de-posicao-tendencia-central-media-mediana-e-moda'),
  dispersao: L('Estatística › Medidas de dispersão', QD.est, 'medidas-de-dispersao-amplitude-desvio-medio-variancia-desvio-padrao-e-coeficiente-de-variacao'),
  boxplot: L('Estatística › Cinco números e boxplot', QD.est, 'esquema-de-cinco-numeros-e-boxplot'),
  probabilidade: L('Estatística › Cálculo de probabilidades', QD.est, 'calculo-de-probabilidades'),
  bayes: L('Estatística › Probabilidade condicional, Bayes e independência', QD.est, 'probabilidade-condicional-teorema-de-bayes-e-independencia'),
  distribuicoes: L('Estatística › Principais distribuições', QD.est, 'principais-distribuicoes-de-probabilidade'),
  normal: L('Estatística › Distribuição normal', QD.est, 'distribuicao-normal'),
  inferencia: L('Estatística › Inferência estatística', QD.est, 'inferencia-estatistica'),
  ic: L('Estatística › Intervalos de confiança', QD.est, 'intervalos-de-confianca'),
  testes: L('Estatística › Testes de hipóteses', QD.est, 'testes-de-hipoteses'),
  aas: L('Estatística › Amostragem aleatória simples', QD.est, 'amostragem-aleatoria-simples'),
  tamanho: L('Estatística › Tamanho da amostra', QD.est, 'tamanho-da-amostra'),
  correlacao: L('Estatística › Covariância e correlação', QD.est, 'covariancia-correlacao'),
  regressao: L('Estatística › Regressão linear', QD.est, 'regressao-linear'),
  anova: L('Estatística › Análise de variância', QD.est, 'analise-de-variancia'),
  modelosLineares: L('Estatística › Modelos lineares', QD.est, 'modelos-lineares'),
  residuos: L('Estatística › Análise dos resíduos', QD.est, 'analise-dos-residuos'),
  series: L('Estatística › Análise de séries temporais', QD.est, 'analise-de-series-temporais'),
  graficos: L('Estatística › Gráficos (barras, colunas e histograma)', QD.est, 'graficos-estatisticos-barras-ou-colunas-e-histograma'),
}
const PROG = {
  python: L('Programação › Python', QD.prog, 'python'),
  conceitos: L('Programação › Conceitos básicos de programação', QD.prog, 'conceitos-basicos-de-programacao'),
  estruturada: L('Programação › Programação estruturada', QD.prog, 'programacao-estruturada'),
  poo: L('Programação › Programação orientada a objetos', QD.prog, 'programacao-orientada-a-objetos'),
  tipos: L('Programação › Tipos de dados', QD.prog, 'tipos-de-dados'),
}
const BD = {
  todas: L('Banco de Dados (toda a disciplina)', QD.bd),
  modeloRelacional: L('Banco de Dados › Modelo relacional', QD.bd, 'modelo-relacional'),
  formasNormais: L('Banco de Dados › Formas normais', QD.bd, 'formas-normais'),
  modelagem: L('Banco de Dados › Modelagem de dados', QD.bd, 'modelagem-de-dados'),
  transacoes: L('Banco de Dados › Gerência de transações', QD.bd, 'gerencia-de-transacoes'),
  multidimensional: L('Banco de Dados › Bancos multidimensionais', QD.bd, 'banco-de-dados-multidimensionais'),
  dw: L('Banco de Dados › Data Warehouse', QD.bd, 'dw-data-warehouse'),
  dataMart: L('Banco de Dados › Data Mart', QD.bd, 'datamart'),
  olap: L('Banco de Dados › OLAP', QD.bd, 'olap-on-line-analytical-processing'),
  sql: L('Banco de Dados › SQL', QD.bd, 'sql'),
  algebra: L('Banco de Dados › Álgebra relacional', QD.bd, 'algebra-relacional'),
  indices: L('Banco de Dados › Índices', QD.bd, 'indices'),
  visao: L('Banco de Dados › Visão (view)', QD.bd, 'visao-view'),
  etl: L('Banco de Dados › ETL', QD.bd, 'etl-extract-transform-load'),
  bi: L('Banco de Dados › Business Intelligence', QD.bd, 'bi-business-intelligence'),
  bigData: L('Banco de Dados › Big Data', QD.bd, 'big-data'),
  distribuidos: L('Banco de Dados › Bancos paralelos e distribuídos', QD.bd, 'banco-de-dados-paralelos-e-distribuidos'),
  dataMining: L('Banco de Dados › Data Mining', QD.bd, 'data-mining'),
  metadados: L('Banco de Dados › Metadados e metainformação', QD.bd, 'metadados-e-metainformacao'),
  dicionario: L('Banco de Dados › Dicionário de dados', QD.bd, 'dicionario-de-dados'),
  catalogo: L('Banco de Dados › Catálogo de um banco de dados', QD.bd, 'catalogo-de-um-banco-de-dados'),
  administracao: L('Banco de Dados › Administração de banco de dados', QD.bd, 'administracao-de-banco-de-dados'),
  seguranca: L('Banco de Dados › Segurança', QD.bd, 'seguranca'),
  textuais: L('Banco de Dados › Bancos de dados textuais', QD.bd, 'banco-de-dados-textuais'),
  geral: L('Banco de Dados › Banco de dados (geral)', QD.bd, 'banco-de-dados'),
}
const ES = {
  ia: L('Engenharia de Software › Inteligência Artificial', QD.es, 'inteligencia-artificial'),
  agil: L('Engenharia de Software › Desenvolvimento ágil', QD.es, 'processos-de-software-desenvolvimento-agil'),
  scrum: L('Engenharia de Software › Scrum', QD.es, 'scrum'),
  configuracao: L('Engenharia de Software › Gerência de configuração (versionamento)', QD.es, 'gerencia-de-configuracao'),
  testes: L('Engenharia de Software › Teste de software', QD.es, 'teste-de-software'),
  qualidade: L('Engenharia de Software › Qualidade de software', QD.es, 'qualidade-de-software'),
  requisitos: L('Engenharia de Software › Engenharia de requisitos', QD.es, 'engenharia-de-requisitos'),
  projetos: L('Engenharia de Software › Gestão de projetos', QD.es, 'gestao-de-projetos-em-engenharia-de-software'),
  desenvolvimento: L('Engenharia de Software › Desenvolvimento de software (DevOps, CI/CD)', QD.es, 'desenvolvimento-de-software'),
}
const NINF = {
  ia: L('Noções de Informática › Inteligência Artificial e automação (ML, redes neurais, PLN)', QD.ninf, 'inteligencia-artificial-e-automacao'),
}
const ARQ = {
  cicloVida: L('Arquitetura de Software › Ciclo de vida (pipelines, registro de modelos)', QD.arq, 'ciclo-de-vida'),
}
const GTI = {
  todas: L('Governança de TI (toda a disciplina)', QD.gti),
  conceitos: L('Governança de TI › Conceitos básicos', QD.gti, 'conceitos-basicos-em-governanca-de-ti'),
  servicos: L('Governança de TI › Gerência de serviços', QD.gti, 'gerencia-de-servicos'),
  itil4: L('Governança de TI › ITIL 4', QD.gti, 'itil-4'),
  in4: L('Governança de TI › Instrução Normativa nº 4 (contratação de TI)', QD.gti, 'instrucao-normativa-n-4'),
  peti: L('Governança de TI › Planejamento estratégico de TI (PETI/PDTI)', QD.gti, 'planejamento-estrategico-de-ti-peti'),
  auditoriaTi: L('Governança de TI › Auditoria de TI', QD.gti, 'auditoria-de-ti'),
  cobit2019: L('Governança de TI › COBIT 2019', QD.gti, 'cobit-2019'),
}
const SEG = L('Segurança da Informação (toda a disciplina)', QD.seg)
const RL = L('Raciocínio Lógico (toda a disciplina)', QD.rl)
const GP = L('Gerência de Projetos (toda a disciplina)', QD.gp)

/** Mapeamento tema do edital → filtros do QConcursos. Subtemas usam a mesma grafia das tarefas do plano. */
export const QC_LINKS: Record<string, QcTheme> = {
  [T.dem]: {
    all: [CPOL.democracia, DCON.principios, DCON.politicos, ADM.governanca, DADM.improbidade],
    sub: {
      '1 Estado e legitimidade': [CPOL.estado, CPOL.weber, CPOL.concepcoes, ADM.estado],
      '2 Democracia e representação': [CPOL.democracia, CPOL.poliarquia, CPOL.poderes, DCON.separacao],
      '3 Federalismo e capacidades estatais': [DCON.federalismo, DCON.competencias, CPOL.federalismo],
      '4 Ordem constitucional e direitos': [DCON.principios, DCON.direitosFund, DCON.sociais, DCON.politicos, DCON.admPrincipios],
      '5 Valor público e controle': [ADM.accountability, DADM.controle, DCON.tcu],
      '6 Corrupção como fenômeno político e social': [DADM.improbidade, LFED.anticorrupcao, ADM.compliance],
      '7 Mecanismos de reprodução e captura': [CPOL.poliarquia, ADM.compliance],
      '8 Consequências e respostas à corrupção': [LFED.anticorrupcao, DADM.improbidade, ADM.accountability],
      '9 Estado e modelos de desenvolvimento econômico': [CPOL.bemEstar, CPOL.brasil],
    },
  },
  [T.soc]: {
    all: [SOC.estratificacao, SOC.desigualdadeBrasil, SOC.cidadania, SOC.identidade, DCON.ordemSocial],
    sub: {
      '1 Fundamentos sociológicos': [SOC.estratificacao, SOC.racaClasseGenero],
      '2 Formação social e cidadania no Brasil': [SOC.cidadania, SOC.direitos, SOC.movimentosBrasil, SOC.identidade],
      '3 População, território e trabalho': [SOC.trabalho, SOC.urbano],
      '4 Diversidade e acesso a direitos': [SOC.racaClasseGenero, SOC.direitos],
      '5 Desenvolvimento e realidade brasileira': [SOC.desigualdadeBrasil, DCON.ordemSocial, CPOL.bemEstar],
    },
  },
  [T.eti]: {
    all: [ETI.intro, ETI.dec1171, ETI.altaAdm, LFED.conflito, ETI.improbidade],
    sub: {
      '1 Fundamentos da ética pública': [ETI.intro],
      '2 Deveres profissionais': [ETI.dec1171, ETI.altaAdm],
      '3 Conflitos de interesses e imparcialidade': [LFED.conflito, DADM.processo, ETI.altaAdm, ETI.gestaoEtica],
      '4 Relações de trabalho e atendimento': [ETI.dec1171, ETI.intro],
      '5 Integridade como responsabilidade institucional': [ETI.gestaoEtica, ADM.compliance],
    },
  },
  [T.adm]: {
    all: [ADM.organizacao, ADM.modelos, ADM.politicas, AFO.instrumentos, ADM.govEletronico],
    sub: {
      '1 Organização administrativa': [ADM.organizacao, DADM.organizacao],
      '2 Modelos de administração': [ADM.modelos, ADM.resultados],
      '3 Políticas públicas': [ADM.politicas],
      '4 Planejamento e recursos': [AFO.instrumentos, AFO.ciclo, DFIN.leisOrcamentarias, AFO.orcamento, AFO.execucao, ADM.afo],
      '5 Serviços e transformação digital': [ADM.govEletronico, LFED.govDigital, NINF.ia],
    },
  },
  [T.gov]: {
    all: [LFED.dec9203, AUDG.governanca, AUD.controleInterno, LFED.anticorrupcao, ADM.compliance],
    sub: {
      '1 Governança e responsabilidades': [LFED.dec9203, AUDG.govSetorPublico, ADM.principiosGov, ADM.governanca],
      '2 Riscos e controles essenciais': [AUDG.coso, AUD.controleInterno, AUD.coso, AUD.riscoGov],
      '3 Integridade pública': [LFED.dec11129, ADM.compliance, ETI.gestaoEtica],
      '4 Integridade privada': [LFED.anticorrupcao, LFED.dec11129, ADM.compliance, AUD.fraude],
      '5 Prevenção e melhoria institucional': [LFED.dec9203, AUD.riscoGov, ADM.compliance],
    },
  },
  [T.tra]: {
    all: [LFED.lai, DDIG.lgpd, LFED.usuarios, ADM.lai, ADM.accountability],
    sub: {
      '1 Acesso à informação': [LFED.lai, ADM.lai],
      '2 Transparência e proteção de dados': [DDIG.lgpd, DDIG.poderPublico, DDIG.tratamento],
      '3 Ouvidoria e proteção das pessoas': [LFED.usuarios],
      '4 Participação e melhoria de serviços': [LFED.usuarios, LFED.govDigital, ADM.accountability, ADM.govEletronico],
      '5 Integridade da informação e comunicação': [DDIG.fundamentos, LFED.govDigital, ADM.govEletronico],
    },
  },
  [T.dir]: {
    all: [DADM.atos, DADM.processo, DADM.controle, AUDG.sci, DADM.improbidade],
    sub: {
      '1 Decisão administrativa': [DADM.requisitos, DADM.motivos, DADM.principios],
      '2 Processo e garantias': [DADM.processo],
      '3 Funções de controle e melhoria da gestão': [DADM.controle, AUDG.sci, AUDG.cgu, CEXT.normas, CEXT.art74],
      '4 Responsabilização em nível introdutório': [DADM.improbidade, DADM.responsabilidade],
      '5 Proteção e encaminhamento': [DADM.processo, ETI.dec1171],
    },
  },
  [T.evi]: {
    all: [EST.descritiva, AUDG.evidencia, RL, ES.ia, AUDG.testes],
    sub: {
      '1 Perguntas e fontes': [AUDG.evidencia, AUDG.planejamento],
      '2 Leitura de dados e indicadores': [EST.descritiva, EST.posicao],
      '3 Inferências e erros de raciocínio': [RL, EST.inferencia, EST.correlacao],
      '4 Integridade da evidência e proteção': [AUDG.evidencia, AUDG.testes],
      '5 Uso responsável de inteligência artificial': [ES.ia, NINF.ia],
    },
  },
  [T.aud]: {
    all: [AUDG.todas, AUDG.auditoria, AUDG.sci, AUDG.processo, AUDG.testes],
    sub: {
      '1 Propósito, serviços e papéis': [AUDG.auditoria, AUDG.interna, AUDG.scipef, AUDG.normas],
      '2 Ciclo do trabalho': [AUDG.planejamento, AUDG.processo],
      '3 Evidência e conclusão': [AUDG.evidencia, AUDG.testes],
      '4 Comunicação e acompanhamento': [AUDG.processo, AUDG.normas],
      '5 Integração entre funções da CGU': [AUDG.cgu, AUDG.sci, LFED.dec3591],
    },
  },
  [T.sta]: {
    all: [EST.todas, EST.descritiva, EST.probabilidade, EST.inferencia, PROG.python],
    sub: {
      '1 Exploração e descrição': [EST.descritiva, EST.posicao, EST.dispersao, EST.variaveis, EST.boxplot, EST.graficos],
      '2 Probabilidade e inferência': [EST.probabilidade, EST.bayes, EST.distribuicoes, EST.normal, EST.inferencia, EST.ic, EST.testes, EST.aas, EST.tamanho],
      '3 Relações entre variáveis': [EST.correlacao, EST.regressao, EST.modelosLineares, EST.residuos, EST.series, EST.anova],
      '4 Programação para análise': [PROG.python, PROG.conceitos, PROG.estruturada, PROG.poo, PROG.tipos],
      '5 Preparação e transformação': [BD.dataMining, BD.etl, ES.ia],
    },
  },
  [T.eng]: {
    all: [BD.todas, BD.sql, BD.modeloRelacional, BD.dw, BD.bigData],
    sub: {
      '1 Modelagem e arquiteturas': [BD.modeloRelacional, BD.formasNormais, BD.modelagem, BD.transacoes, BD.multidimensional, BD.dw, BD.dataMart, BD.olap, BD.geral],
      '2 SQL e consultas analíticas': [BD.sql, BD.algebra, BD.indices, BD.visao],
      '3 Ingestão e integração': [BD.etl, BD.bi, BD.bigData],
      '4 Processamento distribuído': [BD.distribuidos, BD.bigData],
      '5 Qualidade e rastreabilidade': [BD.metadados, BD.dicionario, BD.catalogo, BD.administracao],
      '6 Compartilhamento e proteção': [BD.seguranca, DDIG.tratamento, DDIG.seguranca, DDIG.agentes],
    },
  },
  [T.ml]: {
    all: [ES.ia, NINF.ia, BD.dataMining, BD.bigData, BD.textuais],
    sub: {
      '1 Seleção e construção de modelos': [ES.ia, NINF.ia, BD.dataMining],
      '2 Validação e generalização': [ES.ia, NINF.ia, BD.dataMining],
      '3 Métricas e efeitos das decisões': [ES.ia, NINF.ia, EST.testes],
      '4 Redes neurais': [ES.ia, NINF.ia],
      '5 Linguagem natural e modelos generativos': [ES.ia, NINF.ia, BD.textuais],
      '6 Agentes e uso seguro de ferramentas': [ES.ia, NINF.ia, SEG],
    },
  },
  [T.ops]: {
    all: [ES.ia, GTI.todas, ES.agil, GTI.in4, DADM.licitacoes],
    sub: {
      '1 Ciclo de vida e MLOps': [ES.ia, ES.desenvolvimento, ARQ.cicloVida, ES.configuracao, ES.testes, ES.qualidade],
      '2 Sustentação de soluções analíticas': [GTI.servicos, GTI.itil4, SEG],
      '3 Governança e responsabilidade': [LFED.dec9203, LFED.govDigital, DDIG.poderPublico, GTI.conceitos, GTI.auditoriaTi, GTI.cobit2019],
      '4 Gestão de produtos de dados': [ES.scrum, ES.agil, ES.requisitos, GTI.peti, GP, ES.projetos],
      '5 Contratação e controle de soluções': [GTI.in4, DADM.licitacoes, DADM.contratos, LFED.dl200],
    },
  },
}

/** Filtros da tarefa: por subtema (sem repetir URL) ou, sem subtemas, os do tema inteiro. */
export function qcLinksFor(tema: string, subtemas: readonly string[]): QcLink[] {
  const theme = QC_LINKS[tema]
  if (!theme) return []
  const list = subtemas.length ? subtemas.flatMap((s) => theme.sub[s] ?? []) : theme.all
  const seen = new Set<string>()
  return list.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)))
}

interface Folder {
  id: string
  name: string
}

/** Pastas do Drive (curso "TI Descomplicada - Fiscal e Controle"). IDs conferidos em 06/11/2026. */
export const CGU_FOLDERS = {
  aed: { id: '1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p', name: 'Ciclo Básico › Ciência de Dados › 02- Análise Exploratória e Visualização de Dados' },
  sql1: { id: '1u-A52VLgf6TZplFZFTcMZbwPAIHK-XIo', name: 'Ciclo Básico › Banco de Dados › 06- SQL, PARTE 1' },
  sql2: { id: '1Ahr4FXtFfMRP7Raonj9XITQetT-XOrK2', name: 'Ciclo Básico › Banco de Dados › 07- SQL, PARTE 2' },
  py: { id: '1VeCFl0qaEVIyZGiA-Yic20W0_WHU06db', name: 'Ciclo Avançado › Programação › 02- Python' },
  ml: { id: '1OqS-UKs1eCSfInsQ7bVoBew3aRX44IOG', name: 'Ciclo Básico › Ciência de Dados › 03- Machine Learning' },
  rn: { id: '1OMyxUC_Bn9Yq3M1meggnBsD2X8FEQfaN', name: 'Ciclo Básico › Ciência de Dados › 04- Redes Neurais' },
  pln: { id: '1En8_GUXKhV0bSxQpRY8lWPUheUmVm7K3', name: 'Ciclo Básico › Ciência de Dados › 05- Processamento de Linguagem Natural' },
  aval: { id: '1f-5zWZKBjTFZf3SfAndHE6aAPGuV-VLF', name: 'Ciclo Básico › Ciência de Dados › 06- Avaliação de Modelos Preditivos' },
  otim: { id: '18Av2svTu_o5BegxznJULLmL79sT83uLQ', name: 'Ciclo Avançado › Ciência de Dados › 07- Otimização de Modelos Preditivos' },
  transf: { id: '1d0_FDDFU8va36fJMxrFpOZVrcQ4DY57H', name: 'Ciclo Avançado › Ciência de Dados › 08- Transformação de Dados' },
  prompt: { id: '1I0ErxdYsiQZva3TLg54vD13ZKELxGALS', name: 'Ciclo Avançado › Ciência de Dados › 09- Engenharia de Prompt' },
  mlog: { id: '1fl_yf-4Ogp5pPflCj4t0W9WfbGnAOrjx', name: 'Ciclo Básico › Banco de Dados › 04- Modelagem Lógica - Modelo Relacional' },
  multi: { id: '1W01xw1YWeAhU-bW8slZvUZdZW4t7RHZY', name: 'Ciclo Básico › Banco de Dados › 10- Modelo Multidimensional' },
  big: { id: '1WgBJCboBdKfMex-MZmgwMbpFHi1Ofcat', name: 'Ciclo Básico › Banco de Dados › 11- Big Data e Data Mining' },
  nosql: { id: '1tXzep4aQAvbtwzM9NzAEM_StAw0wy_4L', name: 'Ciclo Básico › Banco de Dados › 12- Bancos de Dados NoSQL' },
  dama: { id: '16FlhoJMjt5NAEoB2rW4d_dxzze0NwB_Z', name: 'Ciclo Básico › Banco de Dados › 15- Governança de Dados - DAMA DMBOK' },
  ageis: { id: '1R4TViIgBrCob3gSF40KYOKI4E8_9jMRV', name: 'Ciclo Avançado › Gestão e Governança › 04- Gestão de Projeto - Metodologias Ágeis' },
} satisfies Record<string, Folder>
const F = CGU_FOLDERS

let seq = 0
const task = (day: number, block: CguBlock, kind: CguTaskKind, title: string, open: string, until: string, minutes: number, link: CguLink): CguTask => ({
  id: `d${String(day).padStart(2, '0')}-${String(++seq).padStart(3, '0')}`,
  day,
  block,
  kind,
  title,
  open,
  until,
  minutes,
  link,
})
const video = (day: number, block: CguBlock, f: Folder, driveId: string, title: string, until: string, minutes: number) =>
  task(day, block, 'aula', title, f.name, until, minutes, { kind: 'drive', driveId, folderId: f.id, folder: f.name, media: 'video' })
const pdf = (day: number, block: CguBlock, f: Folder, driveId: string, title: string, until: string, minutes: number) =>
  task(day, block, 'leitura', title, f.name, until, minutes, { kind: 'drive', driveId, folderId: f.id, folder: f.name, media: 'pdf' })
const KIND_TITLE: Partial<Record<CguTaskKind, string>> = { questoes: 'Questões', simulado: 'Simulado', diagnostico: 'Diagnóstico' }
/** Tarefa de questões no QConcursos (banca Cebraspe): abre o primeiro filtro; os demais ficam listados na tarefa. */
const qc = (day: number, block: CguBlock, tema: string, subtemas: string[], quantidade: number, minutes: number, kind: CguTaskKind = 'questoes') => {
  const links = qcLinksFor(tema, subtemas)
  const resto = links.length > 1 ? ` (+${links.length - 1} filtro${links.length > 2 ? 's' : ''})` : ''
  return task(
    day,
    block,
    kind,
    `${KIND_TITLE[kind] ?? 'Questões'} · ${tema.replace(/^CGU P\d · /, '')}`,
    `QConcursos (Cebraspe) → ${links[0]?.label ?? tema}${resto} → ${quantidade} questões`,
    kind === 'diagnostico'
      ? 'Sem consultar nada. Anote certas e erradas e lance no Plano CGU.'
      : `Responda as ${quantidade} (divida entre os filtros), confira gabarito e comentários e anote cada erro no bloco de notas (motivo em 1 linha).`,
    minutes,
    { kind: 'qc', tema, subtemas, quantidade, links },
  )
}
const revisao = (day: number, title: string, until: string, minutes: number) =>
  task(day, 'Geral', 'revisao', title, 'QConcursos → suas questões erradas (filtro “que errei”, logado) + bloco de notas em Meu espaço', until, minutes, { kind: 'qc', tema: 'Revisão', subtemas: [], quantidade: 0, links: [QC_REVISAO] })
const discursiva = (day: number, parte: 1 | 2, tema: string, minutes: number) =>
  task(
    day,
    'P4',
    'discursiva',
    parte === 1 ? 'Discursiva · questão de 30 linhas (P2)' : 'Discursiva · situação-problema de 60 linhas (P3)',
    `Plano CGU → Espelho da discursiva. Tema: ${tema}`,
    parte === 1
      ? 'Escreva à mão em até 30 linhas (máx. 40 min); depois corrija pelo espelho: conteúdo (NC até 30) e erros (NE). NQ1 = NC − 6×NE÷TL.'
      : 'Escreva à mão em até 60 linhas (máx. 70 min); depois corrija pelo espelho: NC até 70. NQ2 = NC − 14×NE÷TL.',
    minutes,
    { kind: 'route', to: '/cgu#discursiva' },
  )

function build(): CguDay[] {
  seq = 0
  const d: Array<[string, CguTask[]]> = []
  const add = (theme: string, ...tasks: CguTask[]) => d.push([theme, tasks])

  // Semana 1 — diagnóstico e base do P3
  add(
    'Diagnóstico + Estatística descritiva',
    qc(1, 'P1', T.dem, [], 10, 12, 'diagnostico'),
    qc(1, 'P2', T.aud, [], 10, 12, 'diagnostico'),
    qc(1, 'P3', T.sta, [], 10, 12, 'diagnostico'),
    qc(1, 'P3', T.eng, [], 10, 12, 'diagnostico'),
    qc(1, 'P3', T.ml, [], 10, 12, 'diagnostico'),
    video(1, 'P3', F.aed, '1huUdohKztOGq7ng3s3gMzx3hmIynwaPb', 'Aula · Análise exploratória (vídeo 001)', 'Assista até o fim (pode usar 1,5×). Anote: tipos de variável, medidas de posição e dispersão.', 50),
    pdf(1, 'P3', F.aed, '1P-Tsb7Z1m1CQrYVZQaiX93C41OV4_y9B', 'Leitura · apostila de AED (001.pdf)', 'Só o trecho de estatística descritiva (medidas de posição e dispersão). Marque dúvidas no leitor.', 25),
    qc(1, 'P3', T.sta, ['1 Exploração e descrição'], 15, 25),
    revisao(1, 'Fechamento do dia 1', 'Releia os erros do diagnóstico e lance certas/erradas por bloco no Plano CGU (redistribui o tempo).', 10),
  )
  add(
    'Estatística descritiva + P1',
    video(2, 'P3', F.aed, '1UoWnz2WID8dg9l5DxJFaJrM4rZJvVMU0', 'Aula · AED (vídeo 002)', 'Até o fim.', 40),
    qc(2, 'P3', T.sta, ['1 Exploração e descrição'], 20, 35),
    qc(2, 'P1', T.dem, ['1 Estado e legitimidade', '2 Democracia e representação'], 15, 25),
    revisao(2, 'Revisão dos erros de ontem', 'Refaça só as que errou no dia 1.', 20),
  )
  add(
    'SQL (P3) + Governança (P2)',
    video(3, 'P3', F.sql1, '12ayrTMJPdzB9H_i_kEFaK4KSauZVY_7_', 'Aula · SQL conceitos gerais (03)', 'Até o fim.', 35),
    video(3, 'P3', F.sql1, '1OouiyBM3ewS4-eCUWb5pRtZwndPg9ilv', 'Aula · DML e DQL (07)', 'Até o fim; pause e escreva as consultas.', 45),
    qc(3, 'P3', T.eng, ['2 SQL e consultas analíticas'], 20, 35),
    qc(3, 'P2', T.gov, ['1 Governança e responsabilidades', '2 Riscos e controles essenciais'], 15, 25),
  )
  add(
    'Python (P3) + Sociedade (P1)',
    video(4, 'P3', F.py, '1If_cddMHbRFauOC-9aRnbLF5MRCtLkZo', 'Aula · Python parte 01 (conceitos)', 'Até o fim.', 40),
    video(4, 'P3', F.py, '1YRfmZ24A6XNHmt_VA37U_SqfNAkC-2_O', 'Aula · Python parte 02 (coleções)', 'Até o minuto 45; o resto fica para o dia 9.', 45),
    qc(4, 'P3', T.sta, ['4 Programação para análise'], 20, 35),
    qc(4, 'P1', T.soc, [], 15, 25),
  )
  add(
    'Machine learning (P3) + Transparência (P2)',
    video(5, 'P3', F.ml, '1c7me4kBi90bBctsvpQVf910X04ndtK4_', 'Aula · Machine Learning conceitos gerais (01)', 'Até o fim (~45 min). Anote supervisionado × não supervisionado.', 45),
    video(5, 'P3', F.ml, '1FV-rXzYbIOIJdapkzuyhMugWndKd-8AR', 'Aula · Underfit × Overfit (02)', 'Até o fim (~20 min): viés, variância, sobreajuste.', 20),
    qc(5, 'P3', T.ml, ['1 Seleção e construção de modelos'], 20, 35),
    qc(5, 'P2', T.tra, [], 15, 25),
    revisao(5, 'Revisão rápida', 'Refaça os erros dos dias 3 e 4.', 20),
  )
  add(
    'Probabilidade e inferência (P3) + Direito público (P2)',
    video(6, 'P3', F.aed, '1t33iLWovfKJ0LvxBdiy37S_qN81jD_SQ', 'Aula · AED (vídeo 003)', 'Até o fim.', 45),
    qc(6, 'P3', T.sta, ['2 Probabilidade e inferência'], 20, 40),
    qc(6, 'P2', T.dir, [], 15, 25),
    revisao(6, 'Revisão da semana 1', 'Todas as “Que errei” da semana; reescreva a regra correta de cada uma.', 30),
  )
  add(
    'Discursiva (parte 1) + Ética e Auditoria',
    discursiva(7, 1, 'Integridade pública: distinção entre existência documental, implementação e efetividade de um programa de integridade (P2 · Governança)', 60),
    qc(7, 'P1', T.eti, [], 15, 25),
    qc(7, 'P2', T.aud, [], 15, 25),
    revisao(7, 'Fechamento da semana 1', 'Lance no Plano CGU o resultado líquido por bloco (certas − erradas) e veja o foco sugerido.', 20),
  )
  // Semana 2
  add(
    'SQL analítico (P3) + Administração (P1)',
    video(8, 'P3', F.sql2, '12HWqZULMUuzWK2d6GXIfPBT6RZ6YHL8j', 'Aula · SQL JOIN (06)', 'Até o fim (~25 min).', 25),
    video(8, 'P3', F.sql2, '1czbXJUbPgAplsoFpPfMn6vNLCN6qh1uB', 'Aula · SQL cláusulas de agrupamento (03)', 'Até o fim (~30 min): GROUP BY, HAVING, agregações.', 35),
    qc(8, 'P3', T.eng, ['2 SQL e consultas analíticas'], 20, 35),
    qc(8, 'P1', T.adm, [], 15, 25),
    revisao(8, 'Revisão', 'Erros de SQL dos dias 3 e 8.', 20),
  )
  add(
    'Python: controle de fluxo e funções (P3) + Evidências (P2)',
    video(9, 'P3', F.py, '1OJhK03R8A1ws4GoSk8W69l_EKOo5etjl', 'Aula · Python parte 05 (condicionais)', 'Até o fim.', 30),
    video(9, 'P3', F.py, '15gF1a41_0vfs-bXuT8cJHlXsYnxKtUDO', 'Aula · Python parte 06 (repetição)', 'Até o fim.', 35),
    video(9, 'P3', F.py, '1-BfanuzRejtBZpeTMnFxxcVXNTrCCr2w', 'Aula · Python parte 07 (funções)', 'Até o minuto 40.', 40),
    video(9, 'P3', F.py, '1k_XZ8tVgLzX_chf5_Tmah3sligvPaOBr', 'Aula · Python parte 09 (tratamento de exceções)', 'Até o fim (~15 min).', 15),
    qc(9, 'P3', T.sta, ['4 Programação para análise'], 15, 25),
    qc(9, 'P2', T.evi, [], 15, 25),
  )
  add(
    'Discursiva (parte 2) + MLOps',
    discursiva(10, 2, 'Situação-problema: órgão quer priorizar fiscalizações com um modelo de risco; discuta validação, vazamento de informação, métricas, revisão humana e contestação (P3 · ML/Ops)', 90),
    video(10, 'P3', F.big, '1cqlfKX2el5HfBPnjD36zydEUIajlw9zE', 'Aula · CRISP-DM (04)', 'Até o fim (~15 min): fases do ciclo de vida de um projeto de dados.', 15),
    qc(10, 'P3', T.ops, ['1 Ciclo de vida e MLOps'], 15, 25),
    revisao(10, 'Revisão', 'Erros de ML e Python da semana.', 30),
  )
  add(
    'Validação e métricas (P3) + Estado e democracia (P1)',
    pdf(11, 'P3', F.aval, '1cl3YWFHUib6svWfrKytK--Vwgz3DJsyj', 'Leitura · apostila Avaliação de Modelos Preditivos (001.pdf)', 'Matriz de confusão, precisão, sensibilidade, especificidade, ROC, validação cruzada. Marque dúvidas.', 35),
    video(11, 'P3', F.ml, '1ZClUtCc2j_k0RZr1asYJ8FiiaHeVpfsq', 'Aula · Regressão logística (12)', 'Até o fim (~15 min).', 15),
    video(11, 'P3', F.ml, '15rg2fDzo9LIZ0i0ZdtNO74a4Y1Wk4wWG', 'Aula · Árvores de decisão (13)', 'Até o fim (~25 min).', 25),
    qc(11, 'P3', T.ml, ['2 Validação e generalização', '3 Métricas e efeitos das decisões'], 25, 45),
    qc(11, 'P1', T.dem, [], 15, 25),
  )
  add(
    'Modelagem e arquiteturas de dados (P3) + Governança (P2)',
    video(12, 'P3', F.multi, '1Iz2hPh4RKUkZVUi-ep9DquOxInp_G-Mk', 'Aula · Modelo multidimensional conceitos gerais (01)', 'Até o fim (~30 min): DW, data mart, fato e dimensão.', 30),
    video(12, 'P3', F.multi, '18ejzNgAUnkKmGRLBlXqII2_YWtz5-8ru', 'Aula · Esquemas dimensionais (04)', 'Até o fim (~15 min): estrela e floco de neve.', 15),
    pdf(12, 'P3', F.mlog, '1LVCwBdDZ_8hLRmep13fuPIl_Cfo6l0se', 'Leitura · apostila Modelo Relacional (001.pdf)', 'Só o trecho de normalização e integridade.', 30),
    qc(12, 'P3', T.eng, ['1 Modelagem e arquiteturas'], 20, 35),
    qc(12, 'P2', T.gov, [], 15, 25),
  )
  add(
    'Simulado fracionado 1 · P1 + P2',
    qc(13, 'P1', T.dem, [], 10, 12, 'simulado'),
    qc(13, 'P1', T.soc, [], 10, 12, 'simulado'),
    qc(13, 'P1', T.eti, [], 10, 12, 'simulado'),
    qc(13, 'P1', T.adm, [], 10, 12, 'simulado'),
    qc(13, 'P2', T.gov, [], 8, 10, 'simulado'),
    qc(13, 'P2', T.tra, [], 8, 10, 'simulado'),
    qc(13, 'P2', T.dir, [], 8, 10, 'simulado'),
    qc(13, 'P2', T.evi, [], 8, 10, 'simulado'),
    qc(13, 'P2', T.aud, [], 8, 10, 'simulado'),
    revisao(13, 'Correção do simulado 1', 'Calcule a nota líquida de P1 e P2 (certas − erradas) e lance no Plano CGU. Mínimos: P1 ≥ 8, P2 ≥ 12.', 50),
  )
  add(
    'Revisão + Python em questões',
    video(14, 'P3', F.py, '1LMXD4k-lhTQpMlaGLNBDA65f3x6kg2vW', 'Aula · Python questões resolvidas, bloco I', 'Pause antes de cada resposta e resolva você primeiro.', 50),
    qc(14, 'P3', T.sta, ['5 Preparação e transformação'], 20, 35),
    qc(14, 'P2', T.tra, [], 15, 25),
    revisao(14, 'Revisão da semana 2', 'Todas as “Que errei” da semana.', 40),
  )
  // Semana 3
  add(
    'Redes neurais e PLN (P3) + Sociedade (P1)',
    video(15, 'P3', F.rn, '10ub2NJDIXloGxIXCtgQcmSw8RGCMh24c', 'Aula · Redes neurais conceitos gerais (01)', 'Até o fim (~50 min): perceptron, camadas, retropropagação em nível conceitual.', 50),
    video(15, 'P3', F.pln, '1vd1umrDviqVqOf8iwWJYj1oKD-e97bYB', 'Aula · PLN conceitos gerais (01)', 'Até o minuto 40 (embeddings, similaridade).', 40),
    qc(15, 'P3', T.ml, ['4 Redes neurais', '5 Linguagem natural e modelos generativos'], 25, 45),
    qc(15, 'P1', T.soc, [], 15, 25),
  )
  add(
    'Operação e governança de soluções (P3) + Direito público (P2)',
    qc(16, 'P3', T.ops, ['1 Ciclo de vida e MLOps', '2 Sustentação de soluções analíticas'], 25, 45),
    task(16, 'P3', 'leitura', 'Leitura · edital cguops (itens 3 a 5)', 'Plano CGU → Edital → Operação, governança e gestão de soluções de dados e IA', 'Leia os itens 3, 4 e 5 e escreva 1 frase por subitem (governança, produtos de dados, contratação).', 40, { kind: 'route', to: '/cgu#edital' }),
    video(16, 'P3', F.ageis, '1iFADEn4LiI5CpVB_SUmD6zQpUmqQ8RKI', 'Aula · Scrum (02)', 'Até o minuto 35: papéis, eventos e artefatos (edital cguops 4.4).', 35),
    video(16, 'P3', F.ageis, '1QKYq1pQzoMgrg95zjBmJDiy7cunwhRc1', 'Aula · Kanban (04)', 'Até o fim (~20 min).', 20),
    qc(16, 'P2', T.dir, [], 15, 25),
  )
  add(
    'Discursiva (parte 1) + Qualidade de dados',
    discursiva(17, 1, 'Acesso à informação × proteção de dados pessoais: compatibilização, anonimização e risco de reidentificação (P2 · Transparência)', 60),
    qc(17, 'P3', T.eng, ['5 Qualidade e rastreabilidade'], 20, 35),
    qc(17, 'P1', T.eti, [], 15, 25),
    revisao(17, 'Revisão', 'Erros dos dias 15 e 16.', 30),
  )
  add(
    'Ingestão, Big Data e NoSQL (P3) + Auditoria (P2)',
    video(18, 'P3', F.big, '1EmIf6OSEujWevSTDqVTXPOgy2IYpWH0n', 'Aula · Big Data (01)', 'Até o fim (~30 min): volume, processamento em lote e fluxo.', 30),
    video(18, 'P3', F.nosql, '1dwE4yYPeluF2Jo84L1T_f52O7ZV05FA_', 'Aula · NoSQL conceitos gerais (01)', 'Até o minuto 40: consistência, escalabilidade.', 40),
    video(18, 'P3', F.nosql, '1s3Ip7uH6XPLjh3EDrX-GRJsJW_uZBqmf', 'Aula · Tipos de NoSQL (02)', 'Até o fim (~25 min): documental, chave-valor, colunar, grafos.', 25),
    qc(18, 'P3', T.eng, ['3 Ingestão e integração', '4 Processamento distribuído'], 25, 45),
    qc(18, 'P2', T.aud, [], 15, 25),
  )
  add(
    'Relações entre variáveis (P3) + Administração (P1)',
    video(19, 'P3', F.aed, '1mT3qaFGT1AW1uWdHdnFIOK-G3VceJ84-', 'Aula · AED (vídeo 004)', 'Até o fim (correlação, regressão).', 40),
    qc(19, 'P3', T.sta, ['3 Relações entre variáveis'], 20, 35),
    video(19, 'P3', F.py, '1e8eA354xUP3K1cCYRvEjS495XYsUC65d', 'Aula · Python questões resolvidas, bloco II', 'Resolva antes de ver cada resposta.', 45),
    qc(19, 'P1', T.adm, [], 15, 25),
  )
  add(
    'Simulado fracionado 2 · P3 (45 itens)',
    qc(20, 'P3', T.sta, [], 12, 24, 'simulado'),
    qc(20, 'P3', T.eng, [], 11, 22, 'simulado'),
    qc(20, 'P3', T.ml, [], 11, 22, 'simulado'),
    qc(20, 'P3', T.ops, [], 11, 22, 'simulado'),
    revisao(20, 'Correção do simulado 2', 'Nota líquida × 2 = pontos de P3. Projete para 90 itens; mínimo 54. Lance no Plano CGU.', 60),
  )
  add(
    'Revisão + Discursiva (parte 2)',
    revisao(21, 'Revisão dos simulados', 'Refaça todas as erradas dos simulados 1 e 2.', 50),
    discursiva(21, 2, 'Situação-problema: proposta de data lake/lakehouse com dados pessoais de beneficiários; discuta arquitetura, qualidade, linhagem, minimização, anonimização e governança (P3 · Engenharia)', 90),
  )
  // Semana 4
  add(
    'Governança de dados (P3) + Evidências (P2)',
    pdf(22, 'P3', F.dama, '1q5p_yaLBGbBIDleIvomH1ls4EWgkLFWQ', 'Leitura · apostila Governança de Dados DAMA-DMBOK (001.pdf)', 'Metadados, catálogo, linhagem e dimensões de qualidade. Marque dúvidas no leitor.', 50),
    qc(22, 'P3', T.eng, ['5 Qualidade e rastreabilidade', '6 Compartilhamento e proteção'], 25, 45),
    qc(22, 'P2', T.evi, [], 15, 25),
    revisao(22, 'Revisão', 'Erros do dia 21.', 20),
  )
  add(
    'Otimização, LLMs e agentes (P3) + Estado e democracia (P1)',
    pdf(23, 'P3', F.otim, '13ggU7FbX5aHiO-8WIGlEY9mXZCXEAGmw', 'Leitura · apostila Otimização de Modelos Preditivos', 'Regularização, hiperparâmetros, validação cruzada.', 30),
    pdf(23, 'P3', F.prompt, '1TxfMm-Sg7MnFM1Xg1nmxkiXE6yZwc30x', 'Leitura · apostila Engenharia de Prompt', 'Prompts, RAG, alucinações e limites (edital cguml 5 e 6).', 30),
    video(23, 'P3', F.rn, '1FZwrxEbSyL-3sj0EdO1wJhRP-TvSVWWu', 'Aula · Tipos de redes neurais (04)', 'Até o minuto 40: convolucionais, recorrentes, transformers.', 40),
    qc(23, 'P3', T.ml, ['5 Linguagem natural e modelos generativos', '6 Agentes e uso seguro de ferramentas'], 25, 45),
    qc(23, 'P1', T.dem, [], 15, 25),
  )
  add(
    'Gestão e contratação de soluções (P3) + P2',
    qc(24, 'P3', T.ops, ['3 Governança e responsabilidade', '4 Gestão de produtos de dados', '5 Contratação e controle de soluções'], 30, 55),
    video(24, 'P3', F.sql2, '1g5lc-cv5TFslMF9ZfVlZzK43xbpQ1S-R', 'Aula · SQL subconsultas (04)', 'Até o minuto 40; depois resolva 5 questões do subtema 2 de Engenharia.', 40),
    qc(24, 'P2', T.gov, [], 10, 15),
    qc(24, 'P2', T.tra, [], 10, 15),
    revisao(24, 'Revisão', 'Erros de operação e SQL.', 20),
  )
  add(
    'Preparação de dados (P3) + P1',
    pdf(25, 'P3', F.transf, '1NG2uZWQgrdkaOwz_N0Bky4ObGQc2E7KM', 'Leitura · apostila Transformação de Dados', 'Ausentes, outliers, codificação, normalização e vazamento de informação.', 45),
    qc(25, 'P3', T.sta, ['5 Preparação e transformação'], 20, 35),
    qc(25, 'P3', T.eng, ['3 Ingestão e integração'], 15, 25),
    qc(25, 'P1', T.soc, [], 8, 12),
    qc(25, 'P1', T.eti, [], 8, 12),
    revisao(25, 'Revisão', 'Erros do dia.', 20),
  )
  add(
    'Discursiva completa cronometrada',
    discursiva(26, 1, 'Tema livre de P2 sorteado do edital (escolha um subitem que você ainda não escreveu)', 45),
    discursiva(26, 2, 'Situação-problema de P3 sorteada do edital (ML ou engenharia de dados)', 75),
    revisao(26, 'Correção pelo espelho', 'Corrija as duas pelo espelho e reescreva o parágrafo mais fraco de cada.', 40),
  )
  add(
    'Simulado fracionado 3 · P3 (45 itens)',
    qc(27, 'P3', T.sta, [], 12, 24, 'simulado'),
    qc(27, 'P3', T.eng, [], 11, 22, 'simulado'),
    qc(27, 'P3', T.ml, [], 11, 22, 'simulado'),
    qc(27, 'P3', T.ops, [], 11, 22, 'simulado'),
    revisao(27, 'Correção do simulado 3', 'Compare com o simulado 2. Lance no Plano CGU.', 60),
  )
  add(
    'Revisão final leve',
    revisao(28, 'Revisão final · P3', '“Que errei” dos temas P3: só leia enunciado, gabarito e regra. Nada novo hoje.', 50),
    revisao(28, 'Revisão final · P1 e P2', '“Que errei” de P1 e P2.', 40),
    task(28, 'Geral', 'leitura', 'Checklist da prova', 'Plano CGU → Edital', 'Horário, documento, caneta preta transparente; prova objetiva de manhã (5h) e discursiva à tarde (3h30).', 15, { kind: 'route', to: '/cgu#edital' }),
  )
  return d.map(([theme, tasks], i) => ({ day: i + 1, theme, tasks }))
}

export const CGU_PLAN: CguDay[] = build()
