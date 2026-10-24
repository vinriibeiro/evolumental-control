# EVoLuMentaL Control

Plataforma de controle de estudos em geral — concursos, faculdade, carreira em tecnologia, idiomas ou qualquer outro objetivo: matérias e tópicos, cronômetro com tempo líquido confiável, cronograma automático, ciclo de estudos, calendário, flashcards com repetição espaçada e leitura em voz alta, mapas mentais editáveis, revisões, registro de questões, metas e relatórios.

![Logo](public/brand/logo-full.svg)

## Sumário

- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e execução local](#instalação-e-execução-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Modo local × Supabase](#modo-local--supabase)
- [Configurar o backend (Supabase)](#configurar-o-backend-supabase)
- [Aplicar as migrações](#aplicar-as-migrações)
- [Testes e verificações](#testes-e-verificações)
- [Inteligência de estudo](#inteligência-de-estudo)
- [EvoQuest — Aprenda Jogando](#evoquest--aprenda-jogando)
- [Arquitetura](#arquitetura)
- [Regras de negócio importantes](#regras-de-negócio-importantes)
- [Segurança](#segurança)
- [Backup e recuperação](#backup-e-recuperação)
- [Deploy](#deploy)
- [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)

## Funcionalidades

| Módulo | O que faz |
|---|---|
| Hoje | A tela principal: resumo do dia, **próxima ação recomendada** (com os motivos), plano do dia (planejado, sugerido, atrasado, revisão, tarefa, concluído) e pendências acionáveis. "Ignorar por hoje" vale até o fim do dia. |
| Visão geral | Organizada em três perguntas — *Como estou hoje?*, *O que preciso fazer?* e *Estou evoluindo?* (feed de evolução, visão semanal com "Por que este plano?", calendário anual de constância e previsão de conclusão). Os gráficos detalhados continuam abaixo, com filtro de período e alternativa em tabela. |
| Trilhas | Trilhas prontas por carreira (Auditor Fiscal, Policial Federal, Professor SEEDF de Português, Professor de Português, Programador, Front-end, Back-end, Mobile, DevOps/SRE, Cloud, Cibersegurança, Engenharia de Dados, Analista e Cientista de Dados, Engenheiro de IA, QA, UX/UI, Product Manager, Suporte) e por matéria, com tópicos na ordem de estudo, pesos, fontes e criação automática do ciclo. Cada tópico tem atalhos de pesquisa (Google, YouTube, questões). |
| Matérias e tópicos | Matérias com cor, ícone, prioridade, dificuldade, meta semanal, datas, edital e status; tópicos/subtópicos em profundidade ilimitada; arrastar para reordenar, mover, duplicar subárvore, colar a estrutura do edital como texto indentado, pesquisa em todos os níveis, progresso ponderado, materiais/links, arquivamento. |
| Cronômetro | Cronômetro, temporizador, Pomodoro e intervalos personalizados; pausar/continuar/finalizar/cancelar/reiniciar; alertas visuais e sonoros; resumo antes de salvar; lançamento manual sem sobreposição. |
| Cronograma | Planos com disponibilidade, compromissos, blocos, metas por dia/semana; proposta automática (regras determinísticas e visíveis) com prévia das diferenças; visões dia/semana/mês/lista; status concluído/parcial/não realizado/remarcado; detecção de conflitos; iniciar estudo a partir do bloco. |
| Ciclo de estudos | Vários ciclos, um ativo; blocos reordenáveis com peso, duração e intervalo; avanço pela execução registrada; decisão explícita em execuções parciais. |
| Calendário / Planejamento | Grade de horários de 30 em 30 min (dia e semana) e visão mensal: clique num horário para criar um bloco, arraste para mover, puxe a borda para mudar a duração. Camadas (planejamento, histórico realizado, revisões, tarefas), minicalendário, Planejar (proposta automática), Replanejar (atrasados → próximo horário livre) e Remover. |
| Flashcards | Baralhos e cartões ilimitados, pastas, tags, vínculo com matéria/tópico, importação CSV com prévia, exportação, revisão com repetição espaçada (SM-2 ajustável), modos vencidos/todos/aleatório/selecionados/contínuo, leitura por voz local (Web Speech API). |
| Mapas mentais | Editor com React Flow: nós editáveis, conexões, cores, tamanhos e formas, desfazer/refazer, atalhos, salvamento automático, exportação PNG/PDF, vínculo com matéria/tópico. |
| Revisões | Revisões planejadas × realizadas; concluir, adiar, cancelar, reabrir; agendamento automático após estudar um tópico. |
| Questões | Registro por matéria/tópico/banca/concurso com validação; taxa de acertos, evolução e assuntos que exigem atenção. Ao registrar erros, o motivo é opcional (não sabia, esqueci, interpretação, distração, cálculo, confundiu conceitos, chute, outro) e o app oferece revisão, bloco no ciclo ou flashcard — nunca cria nada sozinho. |
| Caderno de erros | `/questoes/caderno`: filtros por matéria, tópico, período, motivo, banca, concurso e situação; erros por matéria/tópico, motivos mais frequentes, tópicos reincidentes, erros recentes, taxa de reincidência e frases só com dados observáveis. |
| Metas | Horas, sessões, questões, acertos, tópicos, flashcards e dias de estudo por dia/semana/mês; progresso, histórico e ajuste sem perder o passado. |
| Relatórios | Filtros por período, matéria, tópico e atividade; indicadores e gráficos; exportação CSV/JSON. |
| Configurações | Perfil, senha, tema claro/escuro/sistema, metas padrão, fuso horário, formato de hora, Pomodoro, som, voz e velocidade, parâmetros da repetição espaçada e exportação completa dos dados. |

## Pré-requisitos

- **Node.js 20.19+** (testado com 24.22.1 LTS) e npm.
- Opcional, para nuvem: um projeto no [Supabase](https://supabase.com) (plano gratuito serve) ou a [Supabase CLI](https://supabase.com/docs/guides/cli).
- Opcional, para os testes E2E: Microsoft Edge ou Google Chrome instalados.

> **Importante (Windows + Google Drive):** mantenha o projeto em um disco local (ex.: `C:\Users\<você>\Projetos\...`). Pastas sincronizadas pelo Google Drive (`G:\Meu Drive`) não suportam bem o `node_modules` (erros `EBADF` e instalação muito lenta).

## Instalação e execução local

```bash
npm install
npm run dev          # http://localhost:5173
```

Sem variáveis de ambiente, o app abre em **modo local** (veja abaixo). Para produção:

```bash
npm run build        # verifica tipos e gera dist/
npm run preview      # serve o build localmente
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto (Project Settings → API → Project URL). |
| `VITE_SUPABASE_ANON_KEY` | Chave pública **anon** (Project Settings → API). |

Nunca use a chave `service_role` em variáveis `VITE_*`: tudo que começa com `VITE_` vai para o navegador. A segurança dos dados vem das políticas RLS do banco, não do sigilo da chave anon.

## Modo local × Supabase

| | Modo local | Supabase |
|---|---|---|
| Quando | `VITE_SUPABASE_*` ausentes | variáveis configuradas |
| Onde ficam os dados | IndexedDB **deste navegador** | PostgreSQL do seu projeto |
| Login | não há (perfil local único) | e-mail e senha reais, recuperação por e-mail |
| Sincronização entre dispositivos | **não** | sim |
| Uso indicado | desenvolvimento, testes, uso pessoal em um só navegador | uso real, multiusuário |

O modo local é explícito: uma faixa no topo de todas as telas avisa que não há sincronização. Ele reproduz as regras do banco (padrões, restrições únicas, cascatas e a revisão atômica de flashcards) para que o comportamento seja o mesmo nos dois modos. Limpar os dados do navegador apaga os dados do modo local — exporte antes em Configurações → Seus dados.

## Configurar o backend (Supabase)

1. Crie um projeto no Supabase.
2. Aplique a migração (próxima seção).
3. Em **Authentication → Providers**, mantenha **Email** habilitado. Em produção, mantenha "Confirm email" ativo.
4. Em **Authentication → URL Configuration**:
   - *Site URL*: a URL onde o app será servido (ex.: `http://localhost:5173` no desenvolvimento).
   - *Redirect URLs*: inclua `http://localhost:5173/redefinir-senha` e a URL equivalente de produção (usada na recuperação de senha).
5. Preencha `.env.local` com a URL e a chave anon e reinicie `npm run dev`.

**Primeiro usuário:** crie a conta pela tela **Criar conta** do próprio app (não existem credenciais de demonstração). Para testes, é possível criar um usuário em *Authentication → Users → Add user* com uma senha forte gerada na hora; não versione essas credenciais.

## Aplicar as migrações

As migrações versionadas ficam em `supabase/migrations/` e devem ser aplicadas em ordem: `20261021000000_init.sql`, `20261021120000_reset_and_delete_account.sql`, `20261022000000_evoquest.sql`, `20261022000100_evoquest_catalog.sql`, `20261022120000_evoquest_catalog_ditado.sql` (catálogo atualizado, idempotente), `20261023000000_explorer.sql`, `20261023000100_evoquest_rpg.sql`, `20261024000000_evoquest_rodoviaria.sql` (Rodoviária, passagens e cidades por disciplina), `20261025000000_evoquest_apresentacao_guiada.sql` (catálogo da apresentação guiada) `20261026000000_caderno_de_erros.sql` (tabela `question_errors`), `20261027000000_evoquest_evidencias.sql` (evidências de aprendizagem do EvoQuest: `game_activities`, `game_evidence`, RPC `game_record_evidence`) `20261028000000_evoquest_aurora.sql` (só catálogo: etapas e atividades da missão em Python da Usina de Aurora), `20261029000000_evoquest_catalogo_ingles.sql` (catálogo de desafios com o inglês do zero ao C2) , `20261029000100_evoquest_cidade_ingles.sql` (etapas da cidade de Inglês com os 8 prédios; aplicar depois da anterior) e `20261030000000_evoquest_babel.sql` (só catálogo: etapas e atividades da missão de escuta do Porto de Babel). Em um projeto já existente, aplique **só as que ainda não rodou**.

- **Pelo painel:** abra *SQL Editor*, cole o conteúdo do arquivo e execute.
- **Pela CLI:**
  ```bash
  supabase link --project-ref <ref-do-projeto>
  supabase db push
  ```

A migração cria tabelas, chaves estrangeiras compostas, índices, gatilhos, a view `study_session_net`, a função `record_flashcard_review` e todas as políticas RLS. A documentação do esquema está em [`docs/ESQUEMA.md`](docs/ESQUEMA.md).

## Testes e verificações

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest: regras de negócio + migração/RLS em PostgreSQL embutido
npm run check        # tudo acima + build de produção
```

`npm test` inclui:

- **Tempo líquido e cronômetro** (`src/lib/__tests__/engine.test.ts`): desconto de pausas abertas/fechadas, tempo congelado durante a pausa (inclusive o arredondamento), reconstrução só a partir de timestamps (equivale a recarregar a página), sessões que cruzam a meia-noite no fuso do usuário, fases de Pomodoro.
- **Serviço de sessões no backend local** (`src/services/__tests__/sessions.test.ts`): iniciar/pausar/continuar/finalizar, cliques repetidos sem duplicar sessão ou pausa, confirmação idempotente, sessão cancelada não contabilizada, avanço do ciclo, revisões automáticas, lançamento manual sem sobreposição, cascata de exclusão, persistência idempotente da revisão de flashcard.
- **Ciclo, repetição espaçada, planejador, datas** (`rules.test.ts`) e **CSV, estrutura do edital, árvore, metas e voz** (`parsers-goals.test.ts`).
- **Migração real + RLS** (`supabase/tests/rls.test.ts`): executa o SQL em PostgreSQL (PGlite) com um stub do esquema `auth` e verifica que um usuário não lê, altera, exclui nem referencia dados de outro; que `anon` não acessa tabelas; restrições de questões; sessão ativa única; a view de tempo líquido; e a RPC atômica de flashcards.

Testes de ponta a ponta no navegador (modo local; requer `npm run dev` em outro terminal):

```bash
npm run test:e2e     # fluxos reais + todas as páginas em desktop e celular
npm run screenshots  # capturas de estados com dados de exemplo
```

## Inteligência de estudo

O app transforma o que já está registrado (sessões, questões, revisões, flashcards, EvoQuest, cronograma) em decisões. **Nada é IA e nada é opaco**: são funções puras e determinísticas em `src/lib/insight/`, testadas em `src/lib/insight/__tests__/`, que explicam cada número. Os indicadores são **calculados, não guardados** — a única tabela nova é a do caderno de erros, porque o motivo de um erro é uma informação que só o usuário tem.

**Janela de dados.** Os indicadores leem os últimos 365 dias de sessões, questões e respostas do EvoQuest (`hooks/useInsight.ts`), mais revisões e flashcards. Evidências mais antigas já pesam quase nada pela meia-vida de 45 dias.

### Domínio por tópico (0–100)

"Concluído" não é "dominado". O domínio (`mastery.ts`) combina, quando existem:

| Componente | Cálculo | Peso |
|---|---|---|
| Prática | acerto ponderado pela recência: `(Σ w·acertos + 2) / (Σ w·total + 4)`, `w = 0,5^(idade/45 dias)`; respostas do EvoQuest (ligadas pelo nome do tópico) contam meia questão; tanto as respostas do modo clássico (estágio pelo tipo: reconhecer = guiada, produzir = independente, chefe/multietapas = desafio integrado; dica e nova tentativa reduzem o crédito) quanto as atividades das missões de aprendizagem entram com peso por estágio (guiada 1, independente 2, transferência 3, desafio integrado 4) × crédito pela ajuda (sem pista 1; 1, 2 e 3 pistas 0,8 / 0,6 / 0,3; explicação completa 0) | 0,5 |
| Retenção | média de flashcards revisados `min(1, intervalo/21 d) × 0,85^lapsos` e de revisões feitas ÷ (feitas + atrasadas) | 0,2 |
| Exposição | `1 − e^(−minutos/estimado)` (estimado do tópico ou 90 min) | 0,2 |
| Autoavaliação | nota 0–5 do tópico ÷ 5 | 0,1 |

A média usa só os componentes presentes. Regras conservadoras:
- sem prática verificada (questões ou flashcards), o domínio não passa de **55%**; com prática só no EvoQuest (sem questões nem flashcards), não passa de **59%**; com menos de 10 questões, não passa de **79%**;
- esquecimento: depois de 14 dias sem contato, −1% a cada 2,4 dias (no mínimo ×0,7);
- reincidência: ≥ 3 erros nos últimos 14 dias com acerto < 60% → −10; erros em ≥ 2 dias diferentes nos últimos 30 com acerto < 70% → −5. Um erro isolado quase não mexe no valor.

| Faixa | Classificação |
|---|---|
| 0–19 | Ainda não consolidado |
| 20–39 | Frágil |
| 40–59 | Em desenvolvimento |
| 60–79 | Em consolidação |
| 80–100 | Dominado |

Junto do valor aparecem a **confiança** (baixa < 8 evidências, média < 30, alta ≥ 30 — com "Estimativa inicial — poucos dados" quando baixa), a quantidade de evidências, o último contato e o "porquê" (componentes e observações). Tópicos pai, matérias e pastas agregam os filhos **pelo peso**, contando conteúdo sem dados como 0.

**Mapa do edital.** No Explorador, "Mostrar" alterna o indicador da árvore, das listas e dos cards entre progresso, domínio, tempo, questões, acerto e prioridade — sempre com texto, nunca só cor.

### Motor de próxima ação

`recommend.ts` dá pontos explícitos a cada tópico (ou matéria sem tópicos, ou grupo de flashcards vencidos) e cada ponto vira um motivo legível:

| Sinal | Pontos |
|---|---|
| prioridade da matéria + do tópico | 3 × (soma − 2), até 24 |
| peso no edital | 3 × (peso − 1), até 9 |
| dificuldade | 2 × (dificuldade − 3) |
| domínio baixo / conteúdo novo | (100 − domínio)/5 / 8 |
| revisão | atrasada 25 + 2/dia (até 40); vence hoje 15 |
| erros recentes · reincidência · caderno | 2/erro (14 d, até 15) · 8 · 1/erro não resolvido (até 10) |
| tempo parado | 1 a cada 2 dias sem contato (a partir de 3), até 15 |
| meta semanal · prova próxima | 15 × fração que falta · 10 se ≤ 30 dias |
| cronograma · ciclo | bloco agora/próximas 2 h 30, atrasado 20, mais tarde 10 · 12 |
| repetição | −20 se o tópico já teve ≥ 45 min hoje; −10 se a matéria ≥ 90 min |

Ficam de fora matérias arquivadas/pausadas/concluídas, pastas, itens ignorados hoje, tópicos dominados e concluídos sem revisão pendente, e sugestões que não cabem no tempo livre (quando a disponibilidade está configurada). Empates seguem ordem estável; no topo, no máximo 2 itens da mesma matéria. O tipo sugerido é revisão, estudo, questões ou flashcards. O score não é salvo.

### Planejado × realizado

No Cronograma: média semanal planejada × realizada nas últimas 6 semanas completas (a atual fica de fora), execução e a frase "planejamento X% acima do ritmo". "Ajustar próximos planos ao meu ritmo" mostra uma **prévia** (antes/depois por semana) e só encurta blocos **futuros e pendentes** na proporção realizado ÷ planejado (entre 30% e 100%, múltiplos de 5 min, mínimo 15 min). O histórico não muda.

### Previsão de conclusão

`forecast.ts`: conteúdo restante = tópicos-folha não concluídos × (estimativa do tópico, ou média histórica dos concluídos, ou 90 min) × peso − tempo já estudado neles. Ritmo atual = média semanal das últimas 4 semanas completas. Mostra a data estimada, o ritmo necessário para uma data-alvo (a da matéria ou uma escolhida), a diferença e os cenários "+30 min/dia", "+1 h/dia" e meta personalizada, sinalizando ritmos acima da disponibilidade. É sempre apresentada como projeção e não altera o cronograma.

### Visão semanal, feed e constância

- **Esta semana**: disponibilidade (só se configurada), planejado, realizado, distribuição (conteúdo novo, revisões, questões, flashcards, reserva) e **"Por que este plano?"**, com as regras reais do planejador (prioridade, dificuldade, prova próxima, frequência, meta coberta) separadas dos ajustes sugeridos (acerto baixo, revisões vencendo, plano acima da disponibilidade).
- **Sua evolução**: até 10 conquistas reais comparando hoje com 3 semanas atrás — domínio que subiu ou chegou a 80%, tópico que deixou de ser frágil, matéria concluída, matéria que deixou de ser a mais fraca, dias estudados na semana, meta semanal batida, constância maior, marcos de horas, acerto que subiu, revisões feitas.
- **Constância no último ano**: um quadrado por dia (53 semanas), com o detalhe ao passar o mouse, focar ou tocar (tempo, questões, flashcards e matérias) e a mesma informação em tabela.

### Busca global e comandos (Ctrl/Cmd+K)

Pesquisa matérias, tópicos, flashcards, baralhos, questões (inclusive as ligadas aos tópicos encontrados), tarefas, mapas, trilhas e páginas, com resultados agrupados e contagem. Matérias e tópicos têm ações rápidas (Estudar, Questões, Revisar). Comandos: iniciar sessão, "estudar <matéria>", registrar estudo manual, fazer questões, revisar atrasados, revisar flashcards, nova tarefa, novo flashcard, novo mapa, abrir calendário, caderno de erros e cronograma. As consultas são limitadas por categoria no backend.

### Caderno de erros (tabela `question_errors`)

Cada linha classifica parte dos erros de um registro de questões: `reason`, `count`, `note`, `resolved`/`resolved_at`. Matéria, tópico, data, banca e concurso vêm do registro (sem duplicar). FK composta `(record_id, user_id)` com exclusão em cascata, RLS por usuário e gatilhos que garantem **soma dos motivos ≤ erros do registro** nas duas direções (inserir/alterar motivo e diminuir os erros do registro). O modo local (`LocalBackend`) aplica exatamente as mesmas regras. Testes: `supabase/tests/errors.test.ts` (PostgreSQL real) e `src/lib/insight/__tests__/errors.test.ts`.

### Limitações conhecidas

- Os indicadores são calculados no navegador sobre a janela de 365 dias. Para contas com muitos anos de dados, o próximo passo é mover agregações para views/RPCs no banco.
- O vínculo do EvoQuest com tópicos do Control é por nome do tópico dentro da disciplina correspondente; nomes muito diferentes não se ligam.
- A escuta do EvoQuest (modo clássico e Porto de Babel) depende das vozes instaladas no sistema; sem voz em inglês, resta a transcrição, que conta como contato e não como domínio de escuta.
- Questões são registradas em lote (total/acertos por registro), então o caderno de erros classifica quantidades por motivo, não questões individuais.
- O planejador gera blocos por prioridade × dificuldade; desempenho e revisões aparecem como **sugestões** na visão semanal, não alteram a geração automática.

## EvoQuest — Aprenda Jogando

Módulo gamificado em `/evoquest` (menu lateral). Tudo roda dentro do app, com a mesma identidade visual, no modo local e no Supabase.

**Conteúdo:** 8 disciplinas, 3 unidades cada, com lição antes da prática e um chefe por unidade. São 296 desafios no total, cada um com explicação, id estável e versão.

| Disciplina | Desafios | Destaques |
|---|---|---|
| Inglês (do zero → C2, 8 unidades) | 143 | escuta com voz do navegador (normal/lenta), **ditado** (ouvir e escrever, correção palavra a palavra), treino só de escuta, tradução após responder, texto alternativo acessível |
| Português (concursos) | 33 | acentuação, concordância, regência, crase, pontuação, interpretação |
| Raciocínio Lógico | 36 | equivalências, argumentos, diagramas, contagem, probabilidade |
| Estatística | 36 | cálculos conferidos automaticamente pelos testes |
| DAX | 33 | casos com tabelas e resultado conhecido (não executa Power BI) |
| Linguagem M | 33 | casos com resultado deduzido das regras (não executa Power Query) |
| SQL | 38 | 6 laboratórios reais em SQLite (sql.js/WASM) |
| Python para Dados | 38 | 4 laboratórios reais em Pyodide (CPython + pandas em WASM) |

**Apresentação guiada:** na primeira vez, o personagem anda sozinho (piloto automático) da Mestra Iara ao Quadro de Missões — onde o jogador escolhe a cidade —, à bilheteria e ao ônibus; o jogador só avança as falas. O controle do personagem começa na chegada à cidade escolhida. O antigo desafio SQL do quadro virou a missão opcional "O quadro que responde".

**Mundo (`/evoquest`):** jogado em **primeira pessoa** (raycasting sobre a grade de tiles, com a pixel art desenhada por código): **W/S** ou ↑/↓ andam, **A/D** ou ←/→ giram, **Shift + A/D** anda de lado, um clique no mundo prende o mouse para olhar em volta e **E** (Enter/Espaço) interage com o que está na mira; no celular, o joystick anda (vertical) e gira (horizontal) e o botão de ação fala. Um minimapa mostra a planta da região, as portas e quem está por perto. Cada disciplina é uma cidade. Da **Rodoviária** da Vila Evolumental (ao sul da praça) sai um ônibus para cada cidade, e o bilhete é comprado no balcão com moedas:
- a primeira passagem é o vale da Guilda, entregue no fim do tutorial: é grátis e vale para a cidade que o jogador escolher;
- as demais custam 80 moedas cada; comprada uma vez, a linha fica liberada para sempre, e a volta para a Vila é grátis;
- a compra passa pela RPC `game_buy_ticket` (no modo local, pela mesma regra em `LocalBackend`); `game_buy` não vende passagens.

| Cidade | Disciplina | Como joga |
|---|---|---|
| Cidade dos Dados | SQL | história escrita à mão (terminal SQL real, Sentinela, chefe ROOT) e a missão de aprendizagem do Almoxarifado (GROUP BY) |
| Aurora | Python | cidade gerada **mais** a Usina de Aurora, história própria com terminal Python real (missão "A Linha de Montagem Muda", dicionários como acumuladores) |
| Babel | Inglês | cidade gerada **mais** o Porto de Babel, história própria com **rádio** (escuta pela voz do navegador, ditado e registro de atracação; missão "Rádio do Porto", números de 0 a 20 e nomes soletrados de ouvido) |
| Silogia, Gaussópolis, Vernácula, Medida Certa, Pipeline | Lógica, Estatística, Português, DAX, M | geradas das unidades do modo clássico (`content/generatedCity.ts`): cada unidade é um prédio; o guardião abre o **painel da unidade** (lição → prática guiada → prática sozinho → desafio integrado), com o próximo passo e o motivo e um relatório da unidade; vencer o chefe, conferido no servidor em `game_answers`, cumpre a etapa e rende 25 moedas |

**Minha Cidade:** depois da primeira viagem, a Arquiteta Lina (na Rodoviária) entrega a escritura de um terreno com 6 lotes. Cada lote recebe uma matéria do Control, e o prédio cresce com o tempo líquido estudado nela: Fundação com 1 h, Casa com 5 h, Sobrado com 15 h, Prédio com 40 h e Torre com 100 h. Pelo prédio dá para abrir o cronômetro, os flashcards e a página daquela matéria. Cada prédio construído tem um **morador** que revisa com você, dentro do jogo, os flashcards vencidos da matéria — os mesmos cartões, o mesmo SM-2 e o mesmo registro de revisão do módulo Flashcards (sem XP, nada duplicado).

**Funcionamento da Minha Cidade:** o tamanho do prédio (obra) vem do **tempo**; o **funcionamento** vem do **domínio** da matéria no Control (`functionFor` em `content/myCity.ts`): Às escuras (sem prática verificada) → Luz de serviço → Meio expediente → Em operação → Movimentado → Referência da cidade. No mapa, o funcionamento aparece nas janelas: apagadas (sem domínio), metade acesas (frágil) ou todas acesas (em operação para cima). Estudar muito sem praticar constrói um prédio grande e apagado.

**Missões de aprendizagem (modelo pedagógico):** em vez de "pergunta → resposta → XP", a missão segue *problema no mundo → descoberta → aprendizagem → experimentação → aplicação → consequência*. A primeira é **O Almoxarifado em Pane** (GROUP BY), no subsolo da Cidade dos Dados — o elevador de carga abre depois da etapa "quem foi" (JOIN) da missão principal:

| Etapa | O que acontece |
|---|---|
| Problema | Otávia, a almoxarife: o painel de reposição travou porque só entende resumos por fornecedor |
| Lição | ficha de campo no próprio terminal: objetivo, por que importa, 3 frases, exemplo resolvido que o jogador **executa** e erros comuns (após a 1ª tentativa) |
| Guiada | completar o `GROUP BY` de uma consulta pronta → o painel acende |
| Independente | escrever do zero a soma de itens por fornecedor → o portão abre |
| Combate | o drone de inventário: a consulta certa (WHERE antes do GROUP BY) revela qual fornecedor recalibra o drone; valor errado custa sinal |
| Transferência | outro problema e outras tabelas (notas × entregas): achar quem cobrou a mais — vale qualquer caminho (JOIN de subconsultas, CTE, subconsultas correlacionadas), porque o arquivo confere o resultado |
| Debrief | relatório de campo: o que aprendeu, o que aplicou com pouca ou nenhuma ajuda, onde teve dificuldade, o que vale revisar e como cada atividade contou no domínio |

- **Escada de pistas** (`engine/pedagogy.ts`): tentar sozinho → pista 1 (conceito) → pista 2 (a parte do problema) → pista 3 (parte da solução) → explicação completa. Cada degrau só abre depois de uma nova tentativa; o nível usado vai junto com a evidência.
- **Domínio ≠ XP:** XP, moedas e história continuam no catálogo de etapas (`game_complete_step`, uma vez por etapa). O domínio vem de `game_evidence`, gravada só pela RPC `game_record_evidence` (`security definer`): estágio e conceito vêm do catálogo do servidor, a resposta é conferida pelo hash, o id gerado no cliente torna o envio idempotente e há limite diário por atividade. Resolver depois da explicação completa conta como contato, não como acerto; sair depois de tentar sem resolver registra a dificuldade.
- **Revisão de campo** (`content/fieldReview.ts`): exercícios de GROUP BY **parametrizados** — cada semente gera outro depósito, outros números e outra pergunta (soma, contagem com filtro ou HAVING), então não dá para decorar. A resposta é calculada dos dados gerados (não há consulta-gabarito no pacote); só vale evidência (sem XP), com limite de 5 por dia.
- **Oportunidades** (Diário, tecla J): regras determinísticas com o motivo escrito — dificuldade recorrente vira *recuperação*, o **motor de próxima ação do Control** (`recommend`) aponta onde praticar no mundo quando o tópico recomendado corresponde ao conceito de uma missão liberada (com os motivos de maior peso do próprio Control), último acerto há 7+ dias vira *revisão*, missão liberada vira *convite*.
- **Revisão no Control só por clique:** o relatório de campo oferece "Revisar em 3/7 dias" para o tópico do Control ligado ao conceito (mesma ligação por nome/vínculo usada no domínio). Sem tópico ligado, explica como ligar. Nada é agendado automaticamente.

**Segunda missão de aprendizagem — A Linha de Montagem Muda (Python, dicionários como acumuladores)**, na **Usina de Aurora** (`content/aurora.ts`). O Portão da Usina fica a leste da praça de Aurora e abre depois da conversa com a Prefeitura, que apresenta a engenheira Nadir. Mesmo formato do Almoxarifado, com o **terminal Python** como adaptador da disciplina:

| Etapa | O que acontece |
|---|---|
| Problema | o controlador da linha recebe as leituras dos sensores uma a uma e só entende resumos por máquina |
| Lição | ficha de campo com exemplo **Python** executável (contar chamados por setor com `.get(chave, 0)`) e erros comuns (`KeyError`, esquecer o `return`, criar o dicionário dentro do laço) |
| Guiada | completar o `.get()` de uma função pronta que conta leituras por máquina → o controlador acende |
| Independente | escrever do zero a soma de consumo por máquina → o portão do galpão abre |
| Combate | o robô de manutenção R-9: a função certa (um `if` antes de acumular) revela qual máquina tem mais falhas; código errado custa sinal |
| Transferência | duas listas (metas × produção por turno): quais máquinas ficaram abaixo da meta e quanto faltou — vale qualquer caminho (`dict` acumulador, `Counter`, `defaultdict`, compreensão), porque o quadro confere o resultado |
| Debrief | relatório de campo e **revisão de campo em Python** (`content/fieldReviewPy.ts`): cada semente gera outra linha de máquinas e outra pergunta (soma, contagem com filtro ou limiar sobre o total) |

- **Terminal Python do mundo** (`ui/PyTerminal.tsx`): o código roda no Pyodide, num worker isolado, no modo `collect` do harness (`game/lab/pyHarness.ts`): a função do jogador é chamada em cada **caso visível** (as entradas ficam na lateral) e o navegador compara o hash do conjunto de resultados (`canonCases`: chaves de dicionário ordenadas, números com 6 decimais, listas na ordem). O gabarito não vai para o navegador; o servidor confere o mesmo hash em `game_complete_step` e `game_record_evidence`. Há também um hash por caso, só para o retorno ("o caso 2 falhou: uma máquina sem produção também fica abaixo da meta").
- **Retorno contextual em Python** (`pyFeedback`): por erro (`KeyError`, `NameError`…), por trecho que falta no código (palavra inteira; aspas duplas valem como simples), pelo tipo do valor devolvido (`None`, número, lista…) e pelo único caso que falhou.
- **Vínculo com o Control:** o conceito é `colecoes` ("Listas e dicionários" no catálogo de Python). Um tópico do Control chamado "Dicionários" numa matéria ligada a Python para Dados recebe a evidência e as sugestões.
**Terceira missão de aprendizagem — Rádio do Porto (Inglês, números de 0 a 20 e nomes soletrados de ouvido)**, no **Porto de Babel** (`content/babel.ts`). O Portão do Porto fica a leste da praça de Babel e abre depois da conversa com a Prefeitura, que apresenta a operadora Marisa. Mesmo formato, com o **rádio** como adaptador da disciplina — aqui a habilidade é **escutar**:

| Etapa | O que acontece |
|---|---|
| Problema | a rádio da Capitania só fala inglês; navios chamam ao mesmo tempo e a operadora não dá conta de registrar portões, contêineres, horas e nomes |
| Lição | ficha de campo com exemplo **falado** pelo navegador ("Gate number fourteen. I repeat: one, four."), 3 frases (0–12 têm nome próprio; 13–19 terminam em -teen; na dúvida, dígito a dígito) e erros comuns (fifteen × fifty, eight × eighteen) |
| Guiada | ditado curto: escrever o que o Blue Star disse → o painel acende |
| Independente | registro de atracação de uma troca de falas (contêineres, portão, hora) → o portão do cais abre |
| Combate | o atendente automático da Alfândega: ouvir o menu de voz inteiro no rádio revela a opção "falar com um agente"; opção errada reinicia o menu e custa sinal |
| Transferência | navio desconhecido: nome soletrado letra a letra + números, sem ajuda (conceito "Alfabeto e soletrar") |
| Debrief | relatório de campo e **revisão de campo em inglês** (`content/fieldReviewEn.ts`): cada semente gera outra chamada (carga + portão, nome soletrado + portão, ou hora + portão com confirmação da Capitania) |

- **Rádio do mundo** (`ui/EnTerminal.tsx`): a transmissão é lida pela voz do próprio navegador (Web Speech, normal ou devagar, quantas vezes quiser; nada sai do navegador) e o texto fica oculto até resolver. Resposta canônica (`canonEnAnswer`): no ditado, palavras normalizadas como no corretor do modo clássico (pontuação, caixa, contrações) e algarismos por extenso ("7" = "seven"); no registro, campos separados por `|` — campos numéricos aceitam "15" ou "fifteen", nomes soletrados só letras A–Z (hifens e acentos fora). Um hash por campo só para o retorno ("só a hora não bateu"); no ditado o retorno conta quantas palavras bateram, sem dizer quais.
- **Transcrição:** quem não consegue ouvir pode mostrar o texto e resolver a etapa, mas a evidência entra como "explicação completa" (contato com o conceito, não domínio de escuta). Como a voz é sintetizada no navegador, o texto das falas está no pacote — a mesma proteção do modo clássico; o servidor confere o hash da resposta canônica como nas outras missões.
- **Vínculo com o Control:** conceitos `numbers` ("Números de 0 a 20") e `spell` ("Alfabeto e soletrar"), tópicos da primeira unidade do inglês. Tópicos do Control com esses nomes numa matéria ligada a Inglês recebem a evidência e as sugestões.
- **Para outra cidade com história própria:** escrever uma `LessonDef`, desafios com `stage`/`concept`/`ladder`/`explanation`, uma missão `kind: 'mastery'`, um item em `LEARNING_PATHS` (com o modelo de revisão de campo) e, se a cidade for gerada, os acréscimos em `CITY_EXTRAS` (portal e fala da Prefeitura). O catálogo do servidor (`activityCatalogRows`) e o relatório saem do conteúdo. Adaptadores existentes: terminal SQL, terminal Python e rádio em inglês (`ChallengeTerminal` escolhe pelo `kind`).
- **Cidades geradas (as outras 7 disciplinas):** o mesmo modelo, sem tabela nova. O estágio de cada desafio clássico sai do tipo (`game/engine/stages.ts`): escolher/associar/ordenar = guiada; escrever/calcular/completar código = independente; chefe e multietapas = desafio integrado. O guardião abre `ui/UnitHub.tsx`: as quatro etapas, o **próximo passo com motivo** (sem respostas → lição; guiada < 70% → guiada; produção < 4 respostas ou < 70% → sozinho; chefe não vencido → chefe; depois, revisão do tópico mais fraco) e o relatório da unidade. A prática por etapa usa `/evoquest/jogar?...&etapa=guiada|sozinho` (unidade sem desafios daquela etapa usa a unidade inteira). O Diário mostra **recuperações** dos prédios (2+ erros em 14 dias, acerto < 60%, sem acerto limpo depois) e sugestões do Control para tópicos dessas cidades.

**Modos:**
- partida rápida (3/5/10/15 min ou personalizada);
- trilha por unidade;
- chefe, com 3 vidas;
- revisão inteligente: caixas de Leitner com intervalos de 1, 3, 7, 16 e 35 dias, e erro volta em 10 min;
- contra o relógio (90 s);
- laboratório;
- flashcards em modo jogo (reaproveita seus cartões e o SM-2).

**Tipos de desafio:** múltipla escolha, V/F, ditado, lacunas, associação, ordenação, categorização (arrastar ou tocar), achar o erro, numérico com tolerância, resposta curta, completar código, prever saída, multietapas, escuta, SQL e Python.

**Regras** (fonte única em `src/game/engine/rules.ts`, espelhada em SQL):
- **XP:**
  - base de 8 + 4 × dificuldade;
  - combo +10% a cada 3 acertos, até +50%;
  - dica ×0,75; nova tentativa ×0,5;
  - repetir um desafio já acertado há menos de 20 h rende 0 XP; revisar depois rende ×0,5;
  - respostas em menos de 1 s rendem 0 XP.
- **Combo:** um erro só reduz o combo pela metade.
- **Níveis:** cada nível exige 50 XP a mais que o anterior.
- **Moedas:** só para cosméticos. Não há dinheiro real, sorteio nem caixa surpresa.
- **Domínio:** é conservador, calculado como cobertura × (acerto recente suavizado + retenção nas revisões).

**Segurança e integridade** (migração `20261022000000_evoquest.sql`):
- as tabelas `game_*` têm RLS **somente leitura**; toda escrita passa pelas RPCs `game_start_session`, `game_submit_answer`, `game_finish_session`, `game_claim` e `game_buy`, que são `security definer` e agem só sobre `auth.uid()`;
- o XP é calculado no servidor. Os tipos objetivos (escolha, V/F, erro, numérico) são recorrigidos com o gabarito do catálogo; o servidor limita o tempo informado ao tempo real;
- respostas têm id gerado no cliente e o livro-razão `game_rewards` é único por origem, então recarregar ou reenviar não duplica recompensas;
- missões e conquistas são conferidas por métricas recalculadas no servidor, com limite de 3 missões por dia e 3 por semana;
- o catálogo global (`game_challenge_catalog`, `game_reward_rules`, `game_shop_items`) não tem política de escrita, e o gabarito não é legível pelos usuários.

**Tempo de estudo:**
- ao encerrar uma partida, o tempo ativo é registrado como sessão de estudo (atividade "Questões") na matéria vinculada no mapa da disciplina;
- só conta tempo com a aba visível e interação nos últimos 2 min;
- se já houver sessão no mesmo intervalo (ex.: cronômetro ligado), **não** registra de novo;
- o registro pode ser desligado em Perfil.

**Adicionar conteúdo ou disciplina:**
1. Crie `src/game/content/<id>.ts` usando os construtores de `_build.ts`.
2. Registre a disciplina em `src/game/catalog.ts`.
3. Se a versão atual do catálogo já foi aplicada, crie um nome novo em `CATALOG_MIGRATION` (`src/game/catalogSql.ts`). Depois rode `npm run game:catalog` para gerar o SQL (idempotente) e aplique-o no SQL Editor.
4. Rode `npm test`.

O motor não muda. Nunca reutilize um id; ao corrigir um gabarito, incremente `v`.

**Testes do EvoQuest:**
- `src/game/__tests__/content.test.ts` verifica:
  - a estrutura de todos os desafios;
  - que todo gabarito é aceito e uma resposta errada é recusada;
  - os cálculos de estatística;
  - as soluções SQL executadas no SQLite;
  - que o catálogo SQL está sincronizado.
- `src/game/__tests__/python.test.ts` valida as saídas e as soluções de Python com CPython local + pandas. É pulado se não houver Python; use as variáveis `PYTHON` e `PYTHONPATH`.
- `src/features/evoquest/__tests__/catalog.test.ts`, `pedagogy.test.ts` e `enterminal.test.tsx` conferem a missão do Porto de Babel: o hash sai do que o jogador deve anotar (`EN_SOLUTIONS`) e um teste garante que cada valor está de fato na transmissão (por extenso ou soletrado); formas alternativas de escrever valem, erros típicos têm retorno sem revelar a resposta, a revisão de campo é conferida em 40 sementes e o rádio é testado com a voz substituída por um registro.
- `src/features/evoquest/__tests__/catalog.test.ts`, `pedagogy.test.ts` e `pyterminal.test.tsx` conferem a missão da Usina de Aurora: os hashes saem dos valores esperados em `solutions.ts`; com CPython local (sem pandas), as soluções, os caminhos alternativos, os erros típicos, a revisão de campo em Python (24 sementes) e o terminal Python rodam no mesmo harness do Pyodide (`pyLocal.ts`). Sem Python, esses blocos são pulados.
- `supabase/tests/evoquest.test.ts` verifica em PostgreSQL real:
  - fórmula de XP idêntica entre SQL e TS (> 1.000 combinações);
  - recorreção pelo gabarito e idempotência;
  - anti-farm e RLS;
  - missões, conquistas e loja;
  - "zerar dados".
- `npm run test:e2e:evoquest` é o E2E no navegador: trilha, retomada após recarregar, laboratórios SQL/Python, conquistas, escuta, celular e tema escuro. `SKIP_PYTHON=1` pula o Pyodide.

**Dependências novas:** `sql.js` (SQLite WASM, empacotado no app). O Pyodide v314.0.7 (Python 3.14, pandas 3.0) é carregado **sob demanda** do CDN jsDelivr só ao abrir um laboratório de Python, dentro de um Web Worker com limite de tempo.

## Arquitetura

```
src/
  app/              App, rotas, autenticação, provedor de dados, layout (barra lateral, cabeçalho, pesquisa, notificações)
  components/       UI reutilizável (ui/), gráficos (charts/), marca (brand/), seletores e helpers
  features/timer/   sessão ativa, ações do cronômetro, alertas globais, lista de sessões
  hooks/            dados (TanStack Query), configurações, estatísticas, voz, utilitários
  lib/
    data/           camada de dados: interface comum, backend Supabase, backend local (Dexie), metadados do esquema
    timer/          motor do cronômetro (timestamps) e som
    cycle.ts srs.ts planner.ts goals.ts stats.ts time.ts tree.ts validation.ts
  pages/            uma pasta por módulo
  services/         operações compostas (sessões, flashcards, mapas)
  types/db.ts       tipos do modelo de dados
supabase/
  migrations/       SQL versionado
  tests/            testes da migração e RLS
e2e/                testes de navegador (Playwright + Edge/Chrome do sistema)
```

Stack: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query 5, Supabase JS 2, Dexie 4 (IndexedDB), Recharts 3, React Flow 12, dnd-kit, Zod 4, Lucide, Vitest 5, PGlite.

Desempenho: consultas filtradas no banco e paginadas ("Carregar mais"), cache com invalidação apenas das tabelas afetadas (inclusive cascatas), sincronização entre abas via `BroadcastChannel`, páginas carregadas sob demanda e bibliotecas pesadas (gráficos, mapas, exportação) em pacotes separados. O cronômetro re-renderiza a tela mas **não grava nada a cada segundo**: só há escrita ao iniciar, pausar, continuar, trocar de fase e finalizar.

## Regras de negócio importantes

- **Tempo líquido** = ⌊(fim − início) − pausas⌋ + ajuste explícito. Nada disso é armazenado como total; é sempre derivado das sessões e pausas (`netSeconds` no app e a view `study_session_net` no banco usam a mesma regra). Sessões canceladas e em andamento não entram nos indicadores.
- **Sessão ativa única por usuário** (índice único parcial). Inserções usam IDs gerados no cliente e atualizações são condicionais ao status, então cliques repetidos e outras abas não duplicam registros.
- **Ao finalizar**, o horário de término é congelado e a sessão fica "aguardando confirmação" (sobrevive a recarregar). O usuário revisa matéria, tópico, atividade, observação e um ajuste manual em minutos (registrado na sessão).
- **Cancelar** descarta a sessão (não conta) ou, por escolha explícita, salva o tempo aproveitado.
- **Ciclo**: avança apenas quando um bloco é concluído por sessões vinculadas; execução parcial pergunta se mantém a posição (retomar) ou avança; dias sem estudo não alteram a posição.
- **Cronograma automático**: regras determinísticas listadas na própria tela (sem IA). A proposta só substitui blocos *pendentes* a partir de hoje — concluídos, parciais e não realizados ficam como histórico.
- **Revisões**: só são marcadas como feitas por ação explícita (botão ou caixa marcada no resumo da sessão).
- **Repetição espaçada**: SM-2 com quatro respostas; parâmetros ajustáveis em Configurações; cada resposta é gravada junto com o novo agendamento em uma transação idempotente.
- **Exclusões**: organização/planejamento em cascata; históricos (sessões, questões, cartões, mapas) apenas perdem o vínculo e continuam nos relatórios. A confirmação mostra quantos registros serão excluídos ou desvinculados, e matérias podem ser arquivadas em vez de excluídas.
- **Sem limites artificiais**: não há teto de matérias, tópicos, cartões ou mapas no código; a capacidade depende da infraestrutura.

## Segurança

- Autenticação do Supabase (senhas nunca passam pelo código do app nem são armazenadas por ele).
- RLS habilitado e forçado em todas as tabelas: `user_id = auth.uid()` em leitura, inserção, alteração e exclusão; `anon` sem acesso.
- Chaves estrangeiras compostas `(id, user_id)` impedem vincular registros a linhas de outro usuário, mesmo conhecendo o UUID.
- Validação em dois níveis: Zod nos formulários e `CHECK`/`NOT NULL`/FKs no banco (ex.: acertos + erros ≤ total, faixas de prioridade, formatos de cor/horário, tamanho máximo de textos).
- O texto dos flashcards nunca é enviado a serviços de voz externos (Web Speech API local).
- Cabeçalhos de segurança de exemplo em `vercel.json`.

## Backup e recuperação

- **Pelo usuário:** Configurações → Seus dados → *Exportar todos os dados* gera um JSON com todas as tabelas (sessões incluem as pausas). Relatórios exportam CSV/JSON por período.
- **Supabase (administrador):** os planos pagos fazem backups diários automáticos (e PITR opcional). Em qualquer plano, um dump lógico pode ser feito com:
  ```bash
  supabase db dump --data-only -f backup-dados.sql     # dados
  supabase db dump -f backup-esquema.sql               # esquema
  ```
  Para recuperar em um projeto novo: aplique a migração, depois `psql "<connection-string>" -f backup-dados.sql`.
- **Modo local:** os dados vivem só no navegador; faça exportações periódicas.

## Aplicativo no celular (PWA)

O EVoLuMentaL pode ser instalado pelo navegador, sem loja de aplicativos (`public/manifest.webmanifest`, ícones em `public/icons/`, service worker em `public/sw.js`):

- **Android (Chrome/Edge):** menu ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

O botão **Instalar aplicativo** aparece no login, no menu do perfil e em Configurações. O service worker só é registrado no build de produção, busca as páginas sempre na rede (cópia local apenas como reserva offline) e nunca intercepta chamadas ao Supabase. Para regerar os ícones a partir da logo: `node scripts/gerar-icones.mjs`.

## Deploy

É um app estático (SPA). Qualquer hospedagem estática serve, desde que todas as rotas caiam no `index.html`:

- Vercel: `vercel.json` já inclui o rewrite e cabeçalhos.
- Netlify/Cloudflare Pages: `public/_redirects` já está incluído.

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de build da hospedagem e adicione a URL de produção em *Redirect URLs* no Supabase.

## Limitações conhecidas e próximos passos

Limitações atuais (honestas):

- O fluxo com **Supabase real** (login, RLS via PostgREST, RPC) foi verificado por tipos e pelos testes da migração em PostgreSQL embutido, mas não contra um projeto Supabase hospedado neste ambiente, por falta de credenciais. Ao conectar, faça um teste rápido: cadastro, login, criar matéria, cronômetro, revisão de flashcard.
- O **modo local** não tem login nem sincronização; dados dependem do navegador.
- Sessões são pareadas entre abas pelo banco (uma sessão ativa por usuário) e pelo `BroadcastChannel`; não há atualização em tempo real entre *dispositivos* diferentes sem recarregar (o app recarrega ao focar a janela).
- Painéis com séries históricas longas (dashboard e metas) baixam as sessões do intervalo e agregam no navegador. Para contas com muitos anos de dados, o próximo passo é usar agregações no banco (a view `study_session_net` já existe para isso).
- O editor de mapas salva o documento inteiro a cada alteração (com intervalo de 0,6 s); mapas muito grandes (milhares de nós) podem ficar lentos.
- A exclusão da conta no Supabase deve ser feita pelo administrador (Authentication → Users); os dados são removidos em cascata.

Próximos passos sugeridos: banco de questões integrado; notificações push opcionais; sincronização em tempo real (Supabase Realtime); PWA/offline-first com fila de sincronização; agregações no servidor para relatórios de longo prazo; importação de editais em PDF.
