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
| Visão geral | Tempo líquido de hoje/semana/mês/total, metas, sequência de dias, revisões e flashcards pendentes, conteúdos concluídos, gráficos (evolução, por matéria, planejado × realizado, por atividade, constância) com filtro de período e alternativa em tabela. |
| Meu espaço de estudos | O dia em uma tela: sessão em andamento, próximo bloco do ciclo, blocos e revisões de hoje, tarefas e bloco de notas com salvamento automático. |
| Trilhas | Trilhas prontas por carreira (Auditor Fiscal, Policial Federal, Professor SEEDF de Português, Professor de Português, Programador, Front-end, Back-end, Mobile, DevOps/SRE, Cloud, Cibersegurança, Engenharia de Dados, Analista e Cientista de Dados, Engenheiro de IA, QA, UX/UI, Product Manager, Suporte) e por matéria, com tópicos na ordem de estudo, pesos, fontes e criação automática do ciclo. Cada tópico tem atalhos de pesquisa (Google, YouTube, questões). |
| Matérias e tópicos | Matérias com cor, ícone, prioridade, dificuldade, meta semanal, datas, edital e status; tópicos/subtópicos em profundidade ilimitada; arrastar para reordenar, mover, duplicar subárvore, colar a estrutura do edital como texto indentado, pesquisa em todos os níveis, progresso ponderado, materiais/links, arquivamento. |
| Cronômetro | Cronômetro, temporizador, Pomodoro e intervalos personalizados; pausar/continuar/finalizar/cancelar/reiniciar; alertas visuais e sonoros; resumo antes de salvar; lançamento manual sem sobreposição. |
| Cronograma | Planos com disponibilidade, compromissos, blocos, metas por dia/semana; proposta automática (regras determinísticas e visíveis) com prévia das diferenças; visões dia/semana/mês/lista; status concluído/parcial/não realizado/remarcado; detecção de conflitos; iniciar estudo a partir do bloco. |
| Ciclo de estudos | Vários ciclos, um ativo; blocos reordenáveis com peso, duração e intervalo; avanço pela execução registrada; decisão explícita em execuções parciais. |
| Calendário / Planejamento | Grade de horários de 30 em 30 min (dia e semana) e visão mensal: clique num horário para criar um bloco, arraste para mover, puxe a borda para mudar a duração. Camadas (planejamento, histórico realizado, revisões, tarefas), minicalendário, Planejar (proposta automática), Replanejar (atrasados → próximo horário livre) e Remover. |
| Flashcards | Baralhos e cartões ilimitados, pastas, tags, vínculo com matéria/tópico, importação CSV com prévia, exportação, revisão com repetição espaçada (SM-2 ajustável), modos vencidos/todos/aleatório/selecionados/contínuo, leitura por voz local (Web Speech API). |
| Mapas mentais | Editor com React Flow: nós editáveis, conexões, cores, tamanhos e formas, desfazer/refazer, atalhos, salvamento automático, exportação PNG/PDF, vínculo com matéria/tópico. |
| Revisões | Revisões planejadas × realizadas; concluir, adiar, cancelar, reabrir; agendamento automático após estudar um tópico. |
| Questões | Registro por matéria/tópico/banca/concurso com validação; taxa de acertos, evolução e assuntos que exigem atenção. |
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

As migrações versionadas ficam em `supabase/migrations/` e devem ser aplicadas em ordem: `20261021000000_init.sql`, `20261021120000_reset_and_delete_account.sql`, `20261022000000_evoquest.sql`, `20261022000100_evoquest_catalog.sql`, `20261022120000_evoquest_catalog_ditado.sql` (catálogo atualizado, idempotente), `20261023000000_explorer.sql`, `20261023000100_evoquest_rpg.sql` e `20261024000000_evoquest_rodoviaria.sql` (Rodoviária, passagens e cidades por disciplina). Em um projeto já existente, aplique **só as que ainda não rodou**.

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

## EvoQuest — Aprenda Jogando

Módulo gamificado em `/evoquest` (menu lateral). Tudo roda dentro do app, com a mesma identidade visual, no modo local e no Supabase.

**Conteúdo:** 8 disciplinas, 3 unidades cada, com lição antes da prática e um chefe por unidade. São 296 desafios no total, cada um com explicação, id estável e versão.

| Disciplina | Desafios | Destaques |
|---|---|---|
| Inglês (A1→B1) | 49 | escuta com voz do navegador (normal/lenta), **ditado** (ouvir e escrever, correção palavra a palavra), treino só de escuta, tradução após responder, texto alternativo acessível |
| Português (concursos) | 33 | acentuação, concordância, regência, crase, pontuação, interpretação |
| Raciocínio Lógico | 36 | equivalências, argumentos, diagramas, contagem, probabilidade |
| Estatística | 36 | cálculos conferidos automaticamente pelos testes |
| DAX | 33 | casos com tabelas e resultado conhecido (não executa Power BI) |
| Linguagem M | 33 | casos com resultado deduzido das regras (não executa Power Query) |
| SQL | 38 | 6 laboratórios reais em SQLite (sql.js/WASM) |
| Python para Dados | 38 | 4 laboratórios reais em Pyodide (CPython + pandas em WASM) |

**Mundo (`/evoquest`):** cada disciplina é uma cidade. Da **Rodoviária** da Vila Evolumental (ao sul da praça) sai um ônibus para cada cidade, e o bilhete é comprado no balcão com moedas:
- a primeira passagem é o vale da Guilda, entregue no fim do tutorial: é grátis e vale para a cidade que o jogador escolher;
- as demais custam 80 moedas cada; comprada uma vez, a linha fica liberada para sempre, e a volta para a Vila é grátis;
- a compra passa pela RPC `game_buy_ticket` (no modo local, pela mesma regra em `LocalBackend`); `game_buy` não vende passagens.

| Cidade | Disciplina | Como joga |
|---|---|---|
| Cidade dos Dados | SQL | história escrita à mão (terminal SQL real, Sentinela, chefe ROOT) |
| Aurora, Babel, Silogia, Gaussópolis, Vernácula, Medida Certa, Pipeline | Python, Inglês, Lógica, Estatística, Português, DAX, M | geradas das unidades do modo clássico (`content/generatedCity.ts`): cada unidade é um prédio com um guardião (lição, treino e chefe); vencer o chefe, conferido no servidor em `game_answers`, cumpre a etapa e rende 25 moedas |

**Minha Cidade:** depois da primeira viagem, a Arquiteta Lina (na Rodoviária) entrega a escritura de um terreno com 6 lotes. Cada lote recebe uma matéria do Control, e o prédio cresce com o tempo líquido estudado nela: Fundação com 1 h, Casa com 5 h, Sobrado com 15 h, Prédio com 40 h e Torre com 100 h. Pelo prédio dá para abrir o cronômetro, os flashcards e a página daquela matéria.

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
