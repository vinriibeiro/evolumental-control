// Plano de 28 dias para o concurso CGU 2026 — Cargo 2 (AFFC · TI · Ciência de Dados), banca Cebraspe, prova em 13/12/2026.
//
// Fontes conferidas em 06/11/2026: Edital nº 1 (PDF oficial) e Edital nº 2 (retificação só do subitem 6.2.4 e de datas de
// atendimento especializado; conteúdo programático e data da prova inalterados). Materiais: pastas reais do Google Drive do
// usuário (IDs conferidos arquivo a arquivo pelo conector do Drive em 06/11/2026; as pastas Avaliação, Otimização, Transformação,
// Engenharia de Prompt, Modelagem Lógica e DAMA só têm apostila em PDF). O progresso de cada aula fica em Cursos (importar a pasta).

export type CguBlock = 'P1' | 'P2' | 'P3' | 'P4' | 'Geral'
export type CguTaskKind = 'diagnostico' | 'aula' | 'leitura' | 'questoes' | 'revisao' | 'discursiva' | 'simulado'

export type CguLink =
  | { kind: 'drive'; driveId: string; folderId: string; folder: string; media: 'video' | 'pdf' | 'folder' }
  | { kind: 'banco'; tema: string; subtemas: string[]; quantidade: number }
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

/** Temas do banco de questões (grafia exata de banco-questoes/cgu/programa-cgu-2026.json). */
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
const banco = (day: number, block: CguBlock, tema: string, subtemas: string[], quantidade: number, minutes: number, kind: CguTaskKind = 'questoes') =>
  task(
    day,
    block,
    kind,
    `${KIND_TITLE[kind] ?? 'Questões'} · ${tema.replace(/^CGU P\d · /, '')}`,
    `Banco de questões → tema “${tema}”${subtemas.length ? ` → subtemas ${subtemas.join(', ')}` : ' → todos os subtemas'} → ${quantidade} questões`,
    kind === 'diagnostico' ? 'Sem consultar nada. Anote certas e erradas e lance no Plano CGU.' : `Responda as ${quantidade}, confira o gabarito e anote cada erro no bloco de notas (motivo em 1 linha).`,
    minutes,
    { kind: 'banco', tema, subtemas, quantidade },
  )
const revisao = (day: number, title: string, until: string, minutes: number) =>
  task(day, 'Geral', 'revisao', title, 'Banco de questões → status “Que errei” + bloco de notas em Meu espaço', until, minutes, { kind: 'route', to: '/banco-de-questoes' })
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
    banco(1, 'P1', T.dem, [], 10, 12, 'diagnostico'),
    banco(1, 'P2', T.aud, [], 10, 12, 'diagnostico'),
    banco(1, 'P3', T.sta, [], 10, 12, 'diagnostico'),
    banco(1, 'P3', T.eng, [], 10, 12, 'diagnostico'),
    banco(1, 'P3', T.ml, [], 10, 12, 'diagnostico'),
    video(1, 'P3', F.aed, '1huUdohKztOGq7ng3s3gMzx3hmIynwaPb', 'Aula · Análise exploratória (vídeo 001)', 'Assista até o fim (pode usar 1,5×). Anote: tipos de variável, medidas de posição e dispersão.', 50),
    pdf(1, 'P3', F.aed, '1P-Tsb7Z1m1CQrYVZQaiX93C41OV4_y9B', 'Leitura · apostila de AED (001.pdf)', 'Só o trecho de estatística descritiva (medidas de posição e dispersão). Marque dúvidas no leitor.', 25),
    banco(1, 'P3', T.sta, ['1 Exploração e descrição'], 15, 25),
    revisao(1, 'Fechamento do dia 1', 'Releia os erros do diagnóstico e lance certas/erradas por bloco no Plano CGU (redistribui o tempo).', 10),
  )
  add(
    'Estatística descritiva + P1',
    video(2, 'P3', F.aed, '1UoWnz2WID8dg9l5DxJFaJrM4rZJvVMU0', 'Aula · AED (vídeo 002)', 'Até o fim.', 40),
    banco(2, 'P3', T.sta, ['1 Exploração e descrição'], 20, 35),
    banco(2, 'P1', T.dem, ['1 Estado e legitimidade', '2 Democracia e representação'], 15, 25),
    revisao(2, 'Revisão dos erros de ontem', 'Refaça só as que errou no dia 1.', 20),
  )
  add(
    'SQL (P3) + Governança (P2)',
    video(3, 'P3', F.sql1, '12ayrTMJPdzB9H_i_kEFaK4KSauZVY_7_', 'Aula · SQL conceitos gerais (03)', 'Até o fim.', 35),
    video(3, 'P3', F.sql1, '1OouiyBM3ewS4-eCUWb5pRtZwndPg9ilv', 'Aula · DML e DQL (07)', 'Até o fim; pause e escreva as consultas.', 45),
    banco(3, 'P3', T.eng, ['2 SQL e consultas analíticas'], 20, 35),
    banco(3, 'P2', T.gov, ['1 Governança e responsabilidades', '2 Riscos e controles essenciais'], 15, 25),
  )
  add(
    'Python (P3) + Sociedade (P1)',
    video(4, 'P3', F.py, '1If_cddMHbRFauOC-9aRnbLF5MRCtLkZo', 'Aula · Python parte 01 (conceitos)', 'Até o fim.', 40),
    video(4, 'P3', F.py, '1YRfmZ24A6XNHmt_VA37U_SqfNAkC-2_O', 'Aula · Python parte 02 (coleções)', 'Até o minuto 45; o resto fica para o dia 9.', 45),
    banco(4, 'P3', T.sta, ['4 Programação para análise'], 20, 35),
    banco(4, 'P1', T.soc, [], 15, 25),
  )
  add(
    'Machine learning (P3) + Transparência (P2)',
    video(5, 'P3', F.ml, '1c7me4kBi90bBctsvpQVf910X04ndtK4_', 'Aula · Machine Learning conceitos gerais (01)', 'Até o fim (~45 min). Anote supervisionado × não supervisionado.', 45),
    video(5, 'P3', F.ml, '1FV-rXzYbIOIJdapkzuyhMugWndKd-8AR', 'Aula · Underfit × Overfit (02)', 'Até o fim (~20 min): viés, variância, sobreajuste.', 20),
    banco(5, 'P3', T.ml, ['1 Seleção e construção de modelos'], 20, 35),
    banco(5, 'P2', T.tra, [], 15, 25),
    revisao(5, 'Revisão rápida', 'Refaça os erros dos dias 3 e 4.', 20),
  )
  add(
    'Probabilidade e inferência (P3) + Direito público (P2)',
    video(6, 'P3', F.aed, '1t33iLWovfKJ0LvxBdiy37S_qN81jD_SQ', 'Aula · AED (vídeo 003)', 'Até o fim.', 45),
    banco(6, 'P3', T.sta, ['2 Probabilidade e inferência'], 20, 40),
    banco(6, 'P2', T.dir, [], 15, 25),
    revisao(6, 'Revisão da semana 1', 'Todas as “Que errei” da semana; reescreva a regra correta de cada uma.', 30),
  )
  add(
    'Discursiva (parte 1) + Ética e Auditoria',
    discursiva(7, 1, 'Integridade pública: distinção entre existência documental, implementação e efetividade de um programa de integridade (P2 · Governança)', 60),
    banco(7, 'P1', T.eti, [], 15, 25),
    banco(7, 'P2', T.aud, [], 15, 25),
    revisao(7, 'Fechamento da semana 1', 'Lance no Plano CGU o resultado líquido por bloco (certas − erradas) e veja o foco sugerido.', 20),
  )
  // Semana 2
  add(
    'SQL analítico (P3) + Administração (P1)',
    video(8, 'P3', F.sql2, '12HWqZULMUuzWK2d6GXIfPBT6RZ6YHL8j', 'Aula · SQL JOIN (06)', 'Até o fim (~25 min).', 25),
    video(8, 'P3', F.sql2, '1czbXJUbPgAplsoFpPfMn6vNLCN6qh1uB', 'Aula · SQL cláusulas de agrupamento (03)', 'Até o fim (~30 min): GROUP BY, HAVING, agregações.', 35),
    banco(8, 'P3', T.eng, ['2 SQL e consultas analíticas'], 20, 35),
    banco(8, 'P1', T.adm, [], 15, 25),
    revisao(8, 'Revisão', 'Erros de SQL dos dias 3 e 8.', 20),
  )
  add(
    'Python: controle de fluxo e funções (P3) + Evidências (P2)',
    video(9, 'P3', F.py, '1OJhK03R8A1ws4GoSk8W69l_EKOo5etjl', 'Aula · Python parte 05 (condicionais)', 'Até o fim.', 30),
    video(9, 'P3', F.py, '15gF1a41_0vfs-bXuT8cJHlXsYnxKtUDO', 'Aula · Python parte 06 (repetição)', 'Até o fim.', 35),
    video(9, 'P3', F.py, '1-BfanuzRejtBZpeTMnFxxcVXNTrCCr2w', 'Aula · Python parte 07 (funções)', 'Até o minuto 40.', 40),
    video(9, 'P3', F.py, '1k_XZ8tVgLzX_chf5_Tmah3sligvPaOBr', 'Aula · Python parte 09 (tratamento de exceções)', 'Até o fim (~15 min).', 15),
    banco(9, 'P3', T.sta, ['4 Programação para análise'], 15, 25),
    banco(9, 'P2', T.evi, [], 15, 25),
  )
  add(
    'Discursiva (parte 2) + MLOps',
    discursiva(10, 2, 'Situação-problema: órgão quer priorizar fiscalizações com um modelo de risco; discuta validação, vazamento de informação, métricas, revisão humana e contestação (P3 · ML/Ops)', 90),
    video(10, 'P3', F.big, '1cqlfKX2el5HfBPnjD36zydEUIajlw9zE', 'Aula · CRISP-DM (04)', 'Até o fim (~15 min): fases do ciclo de vida de um projeto de dados.', 15),
    banco(10, 'P3', T.ops, ['1 Ciclo de vida e MLOps'], 15, 25),
    revisao(10, 'Revisão', 'Erros de ML e Python da semana.', 30),
  )
  add(
    'Validação e métricas (P3) + Estado e democracia (P1)',
    pdf(11, 'P3', F.aval, '1cl3YWFHUib6svWfrKytK--Vwgz3DJsyj', 'Leitura · apostila Avaliação de Modelos Preditivos (001.pdf)', 'Matriz de confusão, precisão, sensibilidade, especificidade, ROC, validação cruzada. Marque dúvidas.', 35),
    video(11, 'P3', F.ml, '1ZClUtCc2j_k0RZr1asYJ8FiiaHeVpfsq', 'Aula · Regressão logística (12)', 'Até o fim (~15 min).', 15),
    video(11, 'P3', F.ml, '15rg2fDzo9LIZ0i0ZdtNO74a4Y1Wk4wWG', 'Aula · Árvores de decisão (13)', 'Até o fim (~25 min).', 25),
    banco(11, 'P3', T.ml, ['2 Validação e generalização', '3 Métricas e efeitos das decisões'], 25, 45),
    banco(11, 'P1', T.dem, [], 15, 25),
  )
  add(
    'Modelagem e arquiteturas de dados (P3) + Governança (P2)',
    video(12, 'P3', F.multi, '1Iz2hPh4RKUkZVUi-ep9DquOxInp_G-Mk', 'Aula · Modelo multidimensional conceitos gerais (01)', 'Até o fim (~30 min): DW, data mart, fato e dimensão.', 30),
    video(12, 'P3', F.multi, '18ejzNgAUnkKmGRLBlXqII2_YWtz5-8ru', 'Aula · Esquemas dimensionais (04)', 'Até o fim (~15 min): estrela e floco de neve.', 15),
    pdf(12, 'P3', F.mlog, '1LVCwBdDZ_8hLRmep13fuPIl_Cfo6l0se', 'Leitura · apostila Modelo Relacional (001.pdf)', 'Só o trecho de normalização e integridade.', 30),
    banco(12, 'P3', T.eng, ['1 Modelagem e arquiteturas'], 20, 35),
    banco(12, 'P2', T.gov, [], 15, 25),
  )
  add(
    'Simulado fracionado 1 · P1 + P2',
    banco(13, 'P1', T.dem, [], 10, 12, 'simulado'),
    banco(13, 'P1', T.soc, [], 10, 12, 'simulado'),
    banco(13, 'P1', T.eti, [], 10, 12, 'simulado'),
    banco(13, 'P1', T.adm, [], 10, 12, 'simulado'),
    banco(13, 'P2', T.gov, [], 8, 10, 'simulado'),
    banco(13, 'P2', T.tra, [], 8, 10, 'simulado'),
    banco(13, 'P2', T.dir, [], 8, 10, 'simulado'),
    banco(13, 'P2', T.evi, [], 8, 10, 'simulado'),
    banco(13, 'P2', T.aud, [], 8, 10, 'simulado'),
    revisao(13, 'Correção do simulado 1', 'Calcule a nota líquida de P1 e P2 (certas − erradas) e lance no Plano CGU. Mínimos: P1 ≥ 8, P2 ≥ 12.', 50),
  )
  add(
    'Revisão + Python em questões',
    video(14, 'P3', F.py, '1LMXD4k-lhTQpMlaGLNBDA65f3x6kg2vW', 'Aula · Python questões resolvidas, bloco I', 'Pause antes de cada resposta e resolva você primeiro.', 50),
    banco(14, 'P3', T.sta, ['5 Preparação e transformação'], 20, 35),
    banco(14, 'P2', T.tra, [], 15, 25),
    revisao(14, 'Revisão da semana 2', 'Todas as “Que errei” da semana.', 40),
  )
  // Semana 3
  add(
    'Redes neurais e PLN (P3) + Sociedade (P1)',
    video(15, 'P3', F.rn, '10ub2NJDIXloGxIXCtgQcmSw8RGCMh24c', 'Aula · Redes neurais conceitos gerais (01)', 'Até o fim (~50 min): perceptron, camadas, retropropagação em nível conceitual.', 50),
    video(15, 'P3', F.pln, '1vd1umrDviqVqOf8iwWJYj1oKD-e97bYB', 'Aula · PLN conceitos gerais (01)', 'Até o minuto 40 (embeddings, similaridade).', 40),
    banco(15, 'P3', T.ml, ['4 Redes neurais', '5 Linguagem natural e modelos generativos'], 25, 45),
    banco(15, 'P1', T.soc, [], 15, 25),
  )
  add(
    'Operação e governança de soluções (P3) + Direito público (P2)',
    banco(16, 'P3', T.ops, ['1 Ciclo de vida e MLOps', '2 Sustentação de soluções analíticas'], 25, 45),
    task(16, 'P3', 'leitura', 'Leitura · edital cguops (itens 3 a 5)', 'Plano CGU → Edital → Operação, governança e gestão de soluções de dados e IA', 'Leia os itens 3, 4 e 5 e escreva 1 frase por subitem (governança, produtos de dados, contratação).', 40, { kind: 'route', to: '/cgu#edital' }),
    video(16, 'P3', F.ageis, '1iFADEn4LiI5CpVB_SUmD6zQpUmqQ8RKI', 'Aula · Scrum (02)', 'Até o minuto 35: papéis, eventos e artefatos (edital cguops 4.4).', 35),
    video(16, 'P3', F.ageis, '1QKYq1pQzoMgrg95zjBmJDiy7cunwhRc1', 'Aula · Kanban (04)', 'Até o fim (~20 min).', 20),
    banco(16, 'P2', T.dir, [], 15, 25),
  )
  add(
    'Discursiva (parte 1) + Qualidade de dados',
    discursiva(17, 1, 'Acesso à informação × proteção de dados pessoais: compatibilização, anonimização e risco de reidentificação (P2 · Transparência)', 60),
    banco(17, 'P3', T.eng, ['5 Qualidade e rastreabilidade'], 20, 35),
    banco(17, 'P1', T.eti, [], 15, 25),
    revisao(17, 'Revisão', 'Erros dos dias 15 e 16.', 30),
  )
  add(
    'Ingestão, Big Data e NoSQL (P3) + Auditoria (P2)',
    video(18, 'P3', F.big, '1EmIf6OSEujWevSTDqVTXPOgy2IYpWH0n', 'Aula · Big Data (01)', 'Até o fim (~30 min): volume, processamento em lote e fluxo.', 30),
    video(18, 'P3', F.nosql, '1dwE4yYPeluF2Jo84L1T_f52O7ZV05FA_', 'Aula · NoSQL conceitos gerais (01)', 'Até o minuto 40: consistência, escalabilidade.', 40),
    video(18, 'P3', F.nosql, '1s3Ip7uH6XPLjh3EDrX-GRJsJW_uZBqmf', 'Aula · Tipos de NoSQL (02)', 'Até o fim (~25 min): documental, chave-valor, colunar, grafos.', 25),
    banco(18, 'P3', T.eng, ['3 Ingestão e integração', '4 Processamento distribuído'], 25, 45),
    banco(18, 'P2', T.aud, [], 15, 25),
  )
  add(
    'Relações entre variáveis (P3) + Administração (P1)',
    video(19, 'P3', F.aed, '1mT3qaFGT1AW1uWdHdnFIOK-G3VceJ84-', 'Aula · AED (vídeo 004)', 'Até o fim (correlação, regressão).', 40),
    banco(19, 'P3', T.sta, ['3 Relações entre variáveis'], 20, 35),
    video(19, 'P3', F.py, '1e8eA354xUP3K1cCYRvEjS495XYsUC65d', 'Aula · Python questões resolvidas, bloco II', 'Resolva antes de ver cada resposta.', 45),
    banco(19, 'P1', T.adm, [], 15, 25),
  )
  add(
    'Simulado fracionado 2 · P3 (45 itens)',
    banco(20, 'P3', T.sta, [], 12, 24, 'simulado'),
    banco(20, 'P3', T.eng, [], 11, 22, 'simulado'),
    banco(20, 'P3', T.ml, [], 11, 22, 'simulado'),
    banco(20, 'P3', T.ops, [], 11, 22, 'simulado'),
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
    banco(22, 'P3', T.eng, ['5 Qualidade e rastreabilidade', '6 Compartilhamento e proteção'], 25, 45),
    banco(22, 'P2', T.evi, [], 15, 25),
    revisao(22, 'Revisão', 'Erros do dia 21.', 20),
  )
  add(
    'Otimização, LLMs e agentes (P3) + Estado e democracia (P1)',
    pdf(23, 'P3', F.otim, '13ggU7FbX5aHiO-8WIGlEY9mXZCXEAGmw', 'Leitura · apostila Otimização de Modelos Preditivos', 'Regularização, hiperparâmetros, validação cruzada.', 30),
    pdf(23, 'P3', F.prompt, '1TxfMm-Sg7MnFM1Xg1nmxkiXE6yZwc30x', 'Leitura · apostila Engenharia de Prompt', 'Prompts, RAG, alucinações e limites (edital cguml 5 e 6).', 30),
    video(23, 'P3', F.rn, '1FZwrxEbSyL-3sj0EdO1wJhRP-TvSVWWu', 'Aula · Tipos de redes neurais (04)', 'Até o minuto 40: convolucionais, recorrentes, transformers.', 40),
    banco(23, 'P3', T.ml, ['5 Linguagem natural e modelos generativos', '6 Agentes e uso seguro de ferramentas'], 25, 45),
    banco(23, 'P1', T.dem, [], 15, 25),
  )
  add(
    'Gestão e contratação de soluções (P3) + P2',
    banco(24, 'P3', T.ops, ['3 Governança e responsabilidade', '4 Gestão de produtos de dados', '5 Contratação e controle de soluções'], 30, 55),
    video(24, 'P3', F.sql2, '1g5lc-cv5TFslMF9ZfVlZzK43xbpQ1S-R', 'Aula · SQL subconsultas (04)', 'Até o minuto 40; depois resolva 5 questões do subtema 2 de Engenharia.', 40),
    banco(24, 'P2', T.gov, [], 10, 15),
    banco(24, 'P2', T.tra, [], 10, 15),
    revisao(24, 'Revisão', 'Erros de operação e SQL.', 20),
  )
  add(
    'Preparação de dados (P3) + P1',
    pdf(25, 'P3', F.transf, '1NG2uZWQgrdkaOwz_N0Bky4ObGQc2E7KM', 'Leitura · apostila Transformação de Dados', 'Ausentes, outliers, codificação, normalização e vazamento de informação.', 45),
    banco(25, 'P3', T.sta, ['5 Preparação e transformação'], 20, 35),
    banco(25, 'P3', T.eng, ['3 Ingestão e integração'], 15, 25),
    banco(25, 'P1', T.soc, [], 8, 12),
    banco(25, 'P1', T.eti, [], 8, 12),
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
    banco(27, 'P3', T.sta, [], 12, 24, 'simulado'),
    banco(27, 'P3', T.eng, [], 11, 22, 'simulado'),
    banco(27, 'P3', T.ml, [], 11, 22, 'simulado'),
    banco(27, 'P3', T.ops, [], 11, 22, 'simulado'),
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
