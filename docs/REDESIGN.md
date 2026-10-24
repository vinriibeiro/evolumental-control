# Redesign estrutural — Explorador de Estudos e EvoQuest RPG

Documento vivo do redesign. Fase 1 (auditoria) concluída em 22/10/2026 sobre o código da versão 1.0.0
(117 testes verdes, tipos e lint limpos).

## 1. Problemas encontrados

**Organização (Control)**

- Hierarquia rasa no topo: `subjects` é uma lista plana. Não existe "Área" nem "Pasta" acima da matéria, então um
  concurso com 20 matérias vira um mural de 20 cards sem agrupamento.
- Tópicos já aceitam profundidade ilimitada (`topics.parent_id`), mas todo nó é "tópico": não há como ter uma pasta
  organizadora dentro da matéria sem que ela entre no cálculo de progresso.
- Navegação em três telas (lista de matérias → matéria → modal do tópico). O tópico vive num modal: não tem URL
  própria estável, não tem histórico de sessões e não comporta notas longas.
- Arrastar só reordena dentro do mesmo nível; mudar de nível exige o modal "Mover para…".
- A proteção contra ciclos (mover um tópico para dentro de um descendente) existe só no cliente.
- Colar edital cria a estrutura direto, sem prévia editável.
- Sem favoritos, sem seleção múltipla, sem menu de contexto, sem breadcrumbs.

**EvoQuest**

- O núcleo é `fila de desafios → resposta → XP`. Mesmo os laboratórios SQL/Python reais aparecem como "mais uma
  pergunta". O mapa é uma tela de seleção; o chefe é um quiz com 3 vidas.
- Conteúdo e motor estão bem separados para *desafios* (`src/game/content/*`, `engine/rules.ts`), mas não existe
  modelo de mundo, NPC, diálogo, inventário ou missão.
- O que é bom e fica: XP calculado no servidor, livro-razão idempotente (`game_rewards`), anti-farm, gabarito
  protegido, laboratórios SQL (sql.js) e Python (Pyodide) em Web Workers, registro de tempo ativo como sessão.

**Código**

- Organização por `pages/`: regras de domínio misturadas a componentes de página (ex.: `SubjectDetailPage.tsx`,
  618 linhas, contém árvore, importação e modal de mover).
- Arquivos grandes em páginas (`CalendarPage` 807, `PlayPage` 525, `ChallengeView` 524).

## 2. Arquitetura proposta

Migração gradual para organização por feature, sem big-bang: o código novo nasce em `src/features/<domínio>/`,
o antigo é movido quando for tocado.

```text
src/
  app/                 rotas, shell, provedores
  features/
    explorer/          Explorador de Estudos (pastas, matérias, tópicos, breadcrumbs, prévia de edital)
      model.ts         árvore unificada, caminhos, regras de mover (puro, testado)
      service.ts       operações compostas sobre o DataBackend
      components/      árvore, painel de conteúdo, página do tópico, menus
    timer/             (existente)
    evoquest/
      engine/          mundo, colisão, movimento, interação, missões, diálogo, inventário (puro, testado)
      content/         mundos, NPCs, diálogos, itens, missões — DADOS, sem JSX
      render/          renderizador canvas 2D
      ui/              HUD, diálogo, inventário, diário, terminal
      services/        persistência e recompensas via DataBackend
  game/                (existente) motor de desafios, laboratórios e catálogo — reaproveitado pelo RPG
  components/ui/       design system do Control
  lib/                 utilitários puros
```

## 3. Estrutura de navegação

- Barra lateral do Control agrupada em **Estudar** (Visão geral, Meu espaço, Explorador, Trilhas),
  **Planejar** (Cronômetro, Cronograma, Ciclo, Calendário), **Fixar** (Revisões, Flashcards, Mapas, Questões),
  **Medir** (Metas, Relatórios) e um acesso destacado ao **EvoQuest**, que abre em tela própria, sem a barra lateral.
- Explorador em `/materias`, com URLs estáveis para cada nível:
  `/materias/pasta/:id`, `/materias/:subjectId`, `/materias/:subjectId/topico/:topicId`.
  Links antigos (`/materias/:id?topico=`) são redirecionados.

## 4. Novo modelo de pastas e tópicos

| Nível | Tabela | Observação |
|---|---|---|
| Área de estudo | `study_folders` com `kind = 'area'` | sempre na raiz |
| Pasta | `study_folders` com `kind = 'folder'` | `parent_id` em outra pasta/área, profundidade livre |
| Matéria | `subjects` + `folder_id` (nulo = raiz) | todo o resto do app continua apontando para a matéria |
| Pasta dentro da matéria | `topics` com `kind = 'folder'` | não entra no progresso ponderado |
| Tópico / subtópico | `topics` com `kind = 'topic'` | como hoje |

Novas colunas: `favorite` em pastas, matérias e tópicos. Gatilhos no banco impedem ciclos em pastas e tópicos.
Excluir uma pasta exclui as subpastas, mas as matérias de dentro **voltam para a raiz** (`on delete set null`):
nenhum histórico é perdido por reorganizar.

## 5. Arquitetura do EvoQuest

- **Motor puro (TypeScript, sem React)**: mapa em tiles com camada de colisão, entidades (jogador, NPC, objeto,
  portal), passo de simulação determinístico, máquina de missões orientada a dados, diálogo em grafo pequeno com
  condições/efeitos, inventário.
- **Renderização**: um único `<canvas>` 2D com laço `requestAnimationFrame`; React só desenha o HUD e as janelas
  (diálogo, terminal, inventário), atualizado por eventos, nunca a cada quadro. Sem engine externa: o mundo é pequeno,
  os assets são desenhados por código (pixel art procedural), carregados por região sob demanda. Desde 24/10/2026 a
  visão é em **primeira pessoa** (raycasting sobre a mesma grade; ver a seção datada no fim).
- **Conteúdo como dados**: cada região é um módulo `content/<região>.ts` com mapa, NPCs, diálogos, itens e missões.
  O motor não conhece SQL, inglês ou lógica: objetivos são tipos genéricos (`interact`, `talk`, `collect`, `sql`,
  `python`, `puzzle`, `choice`) validados por validadores registrados.
- **Servidor**: progresso de missão e recompensas passam por RPC `security definer` idempotente, com recompensa
  definida em catálogo no servidor (o cliente nunca informa XP ou moedas). Etapas com consulta SQL são validadas
  pelo hash do resultado esperado guardado só no servidor.

## 6. Conceito do HUB

Praça central (Vila Evolumental) com locais físicos no mapa em vez de menus: **Guilda dos Estudos** com o Quadro de
Missões (missões e revisão "habilidades enferrujando"), **Biblioteca** (lições), **Oficina** (laboratórios livres),
**Sala de Troféus** (conquistas), **Mercado** (cosméticos), **Casa** (perfil, avatar, títulos) e o
**Portal das Disciplinas** para as regiões.

## 7. As oito regiões

| Região | Disciplina | Núcleo de jogo |
|---|---|---|
| Cidade dos Dados | SQL | invadir/recuperar sistemas com terminal SQL real |
| Laboratório Aurora | Python para Dados | scripts que controlam drones, sensores e robôs (Pyodide) |
| Torre dos Idiomas | Inglês | NPCs falam inglês, áudio com velocidade, pistas e negociação |
| Templo da Lógica | Raciocínio Lógico | portas lógicas, suspeitos mentirosos, mecanismos |
| Observatório | Estatística | decisões sob incerteza com leituras de sensores |
| Arquivo Público | Português | investigação de documentos, ambiguidades, contratos |
| Torre de Comando | DAX | métricas e painéis que decidem o rumo da corporação |
| Refinaria | Linguagem M | pipelines de limpeza que destravam o fluxo de dados |

## 8. Loop de gameplay

Explorar → encontrar problema → investigar (falar, examinar, coletar pistas) → usar conhecimento numa ferramenta
(terminal, script, mecanismo) → ver a consequência no mundo (porta abre, NPC reage, luz volta) → recompensa
validada no servidor → desbloqueio (área, item, habilidade) → explorar de novo.

## 9. Sistema de missões

Tipos: principal, secundária, contrato, evento, domínio. Cada missão é um objeto de dados com etapas ordenadas;
cada etapa tem um objetivo tipado, gatilhos (`onComplete` → efeitos: dar item, abrir porta, mudar estado de NPC,
desbloquear região). O diário mostra ✓ concluída, ● atual, ○ futura.

## 10. Modelo de dados necessário

Migração `20261023000000_explorer.sql` (aditiva):
`study_folders`; `subjects.folder_id`, `subjects.favorite`; `topics.kind`, `topics.favorite`; gatilhos anti-ciclo.

Migração `20261023000100_evoquest_rpg.sql` (aditiva):
`game_world_state` (1 linha por usuário: posição, região, flags, inventário, missões — salvamento),
`game_quest_catalog` (servidor: recompensas e hashes de validação, sem leitura pelo usuário),
RPC `game_complete_step` (valida, registra no livro-razão `game_rewards` com origem `quest:<missão>:<etapa>`,
idempotente) e RPC `game_save_world` (salva só campos cosméticos/posição; progresso sensível só via RPC).

## 11. Reaproveitado

`DataBackend` (local e Supabase), `RELATIONS`/cascatas, hooks TanStack Query, design system de `components/ui`,
`useSafeDelete`, `parseOutline`, `TopicForm`/`SubjectForm`, `CardForm`, `SessionList`, laboratórios SQL/Python,
`game_rewards` como livro-razão, regras de XP, Leitner, registro de tempo ativo (`useGame`), catálogo de desafios
(vira banco de "situações" para revisão no mundo).

## 12. Removido ou refatorado

- `SubjectsPage` (mural de cards) → substituída pelo Explorador.
- `SubjectDetailPage` → vira o painel de conteúdo da matéria dentro do Explorador; árvore e importação saem dela.
- `TopicPanel` (modal) → vira a página do tópico.
- EvoQuest: `EvoQuestHome` deixa de ser a porta de entrada; o modo clássico (partida rápida, chefe-quiz,
  contra o relógio) continua acessível pela Oficina/Arena como modo de treino, sem ser o núcleo.

## 13. Plano de migração

1. Migrações apenas aditivas; colunas novas com padrão (`kind = 'topic'`, `favorite = false`, `folder_id = null`).
   Dados existentes aparecem na raiz do Explorador exatamente como estavam.
2. Modo local: Dexie versão 3 com os novos índices; o `upgrade` preenche os padrões nas linhas antigas.
3. Exportação/importação JSON passa a incluir `study_folders`; arquivos antigos continuam importáveis.
4. Progresso do EvoQuest atual (XP, moedas, compras, respostas) permanece no mesmo livro-razão; o mundo novo soma a ele.

## 14. Plano de implementação

| Fase | Entrega | Estado |
|---|---|---|
| 1 | Auditoria e plano (este documento) | concluída |
| 2 | Explorador: pastas, árvore, breadcrumbs, arrastar, pesquisa, favoritos, seleção múltipla, menu de contexto, visualizações, página do tópico, prévia do edital | concluída (testes unitários, PGlite e E2E) |
| 3 | Fundação do EvoQuest: motor, mapa, personagem, movimento, interação, NPC, diálogo, inventário, missões, persistência | concluída |
| 4 | Fatia vertical: Cidade dos Dados (SQL) completa com chefe | conteúdo, servidor e telas prontos; E2E cobre do tutorial até a porta de segurança |

### Pendências da fatia vertical (próxima sessão)

- E2E no navegador de Brás → logs → JOIN → Sentinela → Zé → painel → chefe → final (o motor e o servidor já estão testados).
- Polimento de arte e animação; sons de passos; revisar textos com jogadores reais.
- Aplicar no Supabase as migrações `20261023000000_explorer.sql` e `20261023000100_evoquest_rpg.sql`.
| 5 | Ferramentas de conteúdo para novas regiões | em parte: `buildCity` gera cidades a partir das unidades do modo clássico |
| 6 | Migração progressiva das demais disciplinas | primeira versão em 22/10: uma cidade por disciplina, Rodoviária, passagens e Minha Cidade |

### Rodoviária e cidades (22/10/2026)

- O Portal das Disciplinas saiu da praça. Agora as viagens são de ônibus, a partir da Rodoviária (sul da Vila). A Dora vende as passagens no balcão e a Lina entrega a escritura da Minha Cidade.
- Tutorial: a Iara entrega o vale; a nova etapa `tutorial:trip` termina na primeira viagem. A missão de cada cidade começa ao chegar nela (`RegionDef.onEnter`).
- Servidor (`20261024000000_evoquest_rodoviaria.sql`): `game_buy_ticket` (a primeira passagem sai grátis, as outras custam moedas; não duplica), `game_quest_steps.require_answer` (a etapa exige um desafio acertado em `game_answers`) e `game_buy` limitado a cosméticos.
- Pendências: escrever a história própria de cada cidade gerada; dar à Minha Cidade conteúdo jogável (desafios a partir dos flashcards da matéria); aplicar a migração no Supabase.

Critério de aprovação da fatia vertical: sem XP, moedas e níveis, a missão ainda é interessante? O jogador está
*fazendo* algo ou só *respondendo*?

### Inteligência de estudo e apresentação guiada (22–23/10/2026)

Publicado na `main` em 23/10 (commit `48949da`). Detalhes e fórmulas no README, seção "Inteligência de estudo".

- EvoQuest: a primeira visita é guiada (piloto automático da Iara ao ônibus; o jogador escolhe a cidade no Quadro de Missões e assume o controle na cidade). O desafio SQL do quadro virou a missão opcional `side_board`.
- Camada `src/lib/insight/` (pura, testada): domínio por tópico, motor de próxima ação, lógica do dia, planejado × realizado, caderno de erros, previsão, visão semanal, feed e calendário de constância.
- Telas: Hoje (`/espaco`, primeira do menu), mapa do edital no Explorador, cartão planejado × realizado no Cronograma, Caderno de erros (`/questoes/caderno`), previsão por matéria, Visão geral em três perguntas, Ctrl+K com comandos.
- Banco: `question_errors` (migração 20261026000000) com a mesma regra no modo local.

Pendências:
- Minha Cidade: cada prédio construído tem um morador que revisa os flashcards vencidos da matéria (23/10). Cidades geradas continuam sem história própria.
- Indicadores são calculados no navegador sobre 365 dias; para contas grandes, mover agregações para views/RPCs.
- Vínculo EvoQuest ↔ tópicos do Control é por nome; nomes diferentes não se ligam.

### Navegação em categorias e pedagogia do EvoQuest (23/10/2026)

**Navegação.** A barra lateral virou um accordion (`src/app/nav.ts` + `src/app/SidebarNav.tsx`): Hoje sempre visível; Estudar, Planejar, Fixar, Analisar e EvoQuest recolhíveis, uma aberta por vez, aberta sozinha na categoria da rota, estado guardado na sessão, `aria-expanded`/`aria-controls`, item e categoria destacados (ponto + texto para leitor de tela). Busca e Configurações ficam no rodapé. Nenhuma URL mudou; os itens do EvoQuest usam parâmetros (`/evoquest?painel=mapa`, `?painel=diario`, `?ir=minha-cidade`) que o mundo trata e limpa. No celular, as abas de baixo continuam iguais (Hoje e EvoQuest a um toque).

**Diagnóstico dos desafios (antes):** 296 desafios clássicos — 54 múltipla escolha, 27 V/F, 46 numéricos, 23 lacunas, 17 associação, 17 categorização, 15 achar o erro, 11 ordenação, 9 resposta curta, 12 ditado, 6 escuta, 24 multietapas (todos os chefes), 18 prever saída, 7 completar código, 6 SQL, 4 Python. Cerca de 27% eram reconhecimento puro (MCQ/VF), ~28% outras formas de reconhecimento e ~3% aplicação real; os itens são fixos (memorizáveis). As cidades geradas levam à fila do modo clássico. A Cidade dos Dados aplicava o conhecimento, mas não ensinava (2 pistas estáticas, sem exemplo, sem prática guiada, sem debrief), e as conquistas do mundo viravam só XP, nunca evidência de domínio.

**Feito (fatia vertical em SQL — GROUP BY):** modelo pedagógico genérico (`engine/pedagogy.ts`), lição de campo com exemplo executável, escada de pistas, missão `sql_supply` com guiada → independente → combate → transferência (múltiplos caminhos) → debrief, evidências separadas de XP (`game_evidence` + RPC, espelhada no modo local, Dexie v6), integração com o domínio do Control (`worldEvidenceAnswers` em `lib/insight/game.ts`), revisão de campo parametrizada, quadro de oportunidades com motivo, Minha Cidade com obra (tempo) × funcionamento (domínio). Migração `20261027000000_evoquest_evidencias.sql`.

Pendências e próximos passos:
- Aplicar a migração `20261027000000_evoquest_evidencias.sql` no Supabase.
- Levar o modelo às outras cidades, uma por vez (cada uma com o adaptador da disciplina: Python com Pyodide, inglês com escuta/ditado, lógica com tabelas-verdade…). Não criar várias antes de validar o Almoxarifado com jogadores.
- ~~Motor de próxima ação no mundo~~ feito: recomendações do Control cujo tópico corresponde a um conceito com missão liberada aparecem no quadro de oportunidades, com os motivos do Control.
- ~~Agendar revisão~~ feito: botão explícito no relatório de campo (3 ou 7 dias) para o tópico ligado; nada automático.
- ~~Luzes da Minha Cidade~~ feito: janelas apagadas / meio acesas / acesas conforme o domínio.
- Nova trava de domínio: prática só no EvoQuest não passa de 59% (uma missão sozinha chegava a 74%).
- Atividades parametrizadas não têm gabarito no servidor (só semente + limite diário); a evidência da revisão de campo é, por isso, menos protegida que a das atividades fixas.

### Modelo pedagógico nas 7 cidades geradas (23/10/2026)

- Estágio pelo tipo do desafio clássico (`src/game/engine/stages.ts`): reconhecer = guiada (peso 1), produzir = independente (2), chefe/multietapas = desafio integrado (4); dica = crédito 0,8, nova tentativa = 0,6. O domínio do Control passou a usar esse peso também para as respostas do modo clássico (antes, toda resposta valia 1).
- Guardião de cada prédio → painel da unidade (`ui/UnitHub.tsx`): lição, prática guiada, prática sozinho, chefe; próximo passo com motivo; relatório (estatística por estágio, acertos sem ajuda, tópicos com acerto < 60%).
- `PlayPage` aceita `etapa=guiada|sozinho` (filtra os tipos da fila).
- Diário: recuperação de tópicos fracos dos prédios e sugestões do Control para tópicos dessas cidades.
- Corrigido: título do cabeçalho em `/evoquest/jogar` mostrava "Minha Cidade" (fallback pegava o item com parâmetros); agora mostra a categoria.
- Novo teste de integridade: toda etapa de conversa termina num nó final do diálogo (pegou um erro meu ao acrescentar uma fala na Prefeitura).
- Sem migração nova: as respostas clássicas já são corrigidas no servidor (`game_answers`).
- Próximos passos: histórias próprias por cidade (como o Almoxarifado) e exercícios parametrizados por disciplina (hoje só GROUP BY).

### Usina de Aurora: história própria de Python (23/10/2026)

Primeira cidade gerada a ganhar uma história no formato do Almoxarifado. O usuário escolheu Python como a disciplina de partida.

- **Conteúdo** (`content/aurora.ts`): região `aurora_plant` (sala de controle, galpão com portão, sala de planejamento com porta), Nadir (engenheira), robô de manutenção R-9 (sprite `robot`), tile `machine`, missão `py_line` (`talk → guided → independent → robot → transfer → debrief`), lição `lesson_dict` (conceito `colecoes`, exemplo Python executável), ficha e selo. O Portão da Usina entra na cidade gerada por `CITY_EXTRAS` (`buildCity` aceita entidades extras e uma fala a mais da Prefeitura, antes de `m3`).
- **Adaptador Python**: `PyChallenge` em `challenges.ts` (casos visíveis, `entry`, `expect.hash` do conjunto + `expect.cases` por caso), `canonValue`/`canonCases` (forma canônica), `pyFeedback` (erro, trecho que falta por palavra inteira, tipo do valor, caso único que falhou). Harness ganhou `_collect` (valores por caso, sem gabarito) e `_exec` (saída do exemplo); o worker aceita `mode`; `runPython.ts` expõe `collectPython` e `execPython`. `PyTerminal.tsx` espelha o terminal SQL (ficha, escada, evidência); `ChallengeTerminal` escolhe pelo `kind` e é usado no mundo, nos combates, nos chefes e na revisão de campo; `LessonCard` saiu do `Terminal.tsx` e roda exemplo SQL ou Python.
- **Revisão de campo em Python** (`content/fieldReviewPy.ts`, modelo `field_dict`): variantes soma / contagem com filtro / limiar sobre o total; três casos por semente (turno cheio, turno curto, lista vazia); resposta calculada em TS, hashes no navegador; `FieldReview` escolhe o gerador pelo modelo e o relatório descobre o modelo pela missão (`fieldTemplateOf`, em vez do `field_groupby` fixo).
- **Servidor**: nenhuma tabela nova. Migração `20261028000000_evoquest_aurora.sql` só com o bloco `-- <catalogo>` (etapas `py_line:*` com hash, atividades `line_*` e `field_dict` com `subject = 'python'`). `WORLD_CATALOG_MIGRATION` aponta para ela. **Pendente: aplicar no Supabase.**
- **Testes**: hashes de Python saem de `PY_EXPECTED` (valores calculados à mão em `solutions.ts`); com CPython local (`pyLocal.ts`, sem pandas), o catálogo confere soluções, alternativas (`defaultdict`, `Counter`, compreensão) e erros típicos; a revisão de campo é conferida em 24 sementes; `pyterminal.test.tsx` cobre ficha, escada, retorno e evidência com o harness real. Os blocos que precisam de Python são pulados sem ele. E2E: novo passo em `e2e/world.mjs` (contexto novo, vale da Guilda para Aurora, missão inteira com Pyodide do CDN).
- **Cuidados aprendidos**: `____` é um identificador válido em Python (dá `NameError`, não `SyntaxError`), então o retorno do código inicial casa pelo trecho, não pelo erro; `codeLacks` de uma palavra casa por fronteira, senão `consumo` casaria com o nome da função `consumo_por_maquina`; o teste de alcance abre as portas por uma lista fixa de flags — toda porta nova (`line_gate`, `robot_down`) precisa entrar lá.
- **Próximos passos**: validar a Usina com jogadores; terceira cidade (Inglês com escuta/ditado ou Lógica com tabela-verdade precisam de adaptadores novos; Estatística pode usar o terminal Python); exercícios parametrizados para os outros conceitos de Python (pandas exige carregar o pacote: mais lento na primeira vez).

### Inglês do zero ao C2 (24/10/2026)

- Pedido do usuário: inglês para quem parte do zero absoluto até o avançado, explicado em português.
- `src/game/content/ingles.ts` passou de 3 para 8 unidades, em ordem: **Do zero** (cumprimentos, pronomes, números 0–20, alfabeto e soletrar, como o inglês soa) → **Primeiras frases** (a/an/the, plural, this/that, there is/are, possessivos) → A1 → A2 → B1 → **B2** (passiva, discurso indireto, third conditional e wish, modais de dedução) → **C1** (inversão, condicionais mistas, cleft, conectores e colocações) → **C2** (subjuntivo, registro e falsos amigos, expressões idiomáticas, hedging).
- Cada unidade nova: 5–6 seções de lição, 4 ditados, escuta, reconhecimento (guiada) e produção (independente), e um chefe multietapas. Liberação em sequência (chefe vencido ou domínio ≥ 40%); quem já sabe o básico passa rápido vencendo os chefes iniciais.
- A cidade de Inglês (Babel) ganhou os prédios automaticamente (8 etapas de chefe na missão da cidade).
- Migrações novas (só catálogo): `20261029000000_evoquest_catalogo_ingles.sql` (gabaritos; `CATALOG_MIGRATION`) e `20261029000100_evoquest_cidade_ingles.sql` (etapas da cidade; `WORLD_CATALOG_MIGRATION`). Nenhuma migração aplicada foi alterada.
- Efeito colateral conhecido: as etapas da cidade são numeradas pela posição da unidade; quem já tinha vencido o chefe A1 na cidade (antiga `unit_1`) passa a ter o prédio "Do zero" marcado como feito. Os chefes clássicos não mudam.
- Próximos: história própria de Babel (conversas com NPCs, escuta em contexto), exercícios parametrizados de inglês.

### Porto de Babel: história própria de Inglês (24/10/2026)

Terceira cidade com história própria (depois do Almoxarifado e da Usina), com um adaptador novo: **escuta**. O conceito de partida é o da primeira unidade do inglês do zero — números de 0 a 20 e nomes soletrados, de ouvido, em contexto de rádio.

- **Conteúdo** (`content/babel.ts`): região `babel_port` (Capitania com o rádio, cais com água ao norte, Alfândega), Marisa (operadora de rádio), atendente automático da Alfândega (sprite `speaker_bot`, inimigo), tiles `dock` e `brick`, objeto `radio`, missão `en_radio` (`talk → guided → independent → bot → transfer → debrief`), lições `lesson_numbers` (conceito `numbers`) e `lesson_spell` (conceito `spell`) com exemplo **falado** (`workedExample.lang = 'speech'`: a ficha ganhou "Ouvir o exemplo / Devagar"), ficha e selo. O Portão do Porto entra na cidade gerada de Babel por `CITY_EXTRAS`; a posição é calculada do número de unidades do inglês (a praça desce quando o conteúdo cresce).
- **Adaptador de escuta** (`challenges.ts` → `EnChallenge`, `ui/EnTerminal.tsx`): a transmissão é lida pela voz do navegador (`speakAll`, normal ou devagar, quantas vezes quiser) e o texto fica oculto até resolver; a resposta é um **ditado** (escrever o que ouviu) ou um **formulário de registro** (contêineres, portão, hora, nome soletrado). Forma canônica (`canonEnAnswer`): ditado normalizado palavra a palavra (pontuação, caixa e contrações iguais ao corretor do modo clássico) com algarismos por extenso ("7" = "seven"); campos `digits` aceitam "15" ou "fifteen", `letters` só A–Z (hifens e acentos fora). Um hash por campo só para o retorno ("só a hora não bateu"); no ditado o retorno conta quantas palavras bateram, sem dizer quais. **Mostrar a transcrição** é permitido (acessibilidade) e vale como a explicação completa: resolve a etapa, mas a evidência entra com `help = 4` (contato, não domínio de escuta).
- **Limite conhecido:** a voz é sintetizada no navegador, então o texto das falas precisa estar no pacote — a mesma proteção do modo clássico (ditados e escutas). O servidor confere o hash da resposta canônica em `game_complete_step` e `game_record_evidence`, como nas outras missões.
- **Missão:** guiada = ditado curto do Blue Star (portão sete); independente = registro de atracação com três números de uma troca de falas (abre o portão do cais); combate = o atendente automático (ouvir o menu inteiro no rádio → `radio_menu`, depois teclar a opção do agente, `radio_officer` = 19; opção errada reinicia o menu); transferência = navio desconhecido soletrado (`KALINA|18|20`, conceito `spell`); debrief com a Marisa. Recompensas na mesma régua da Usina.
- **Revisão de campo em inglês** (`content/fieldReviewEn.ts`, modelo `field_radio`): três situações por semente (carga + portão, nome soletrado + portão, hora + portão com confirmação da Capitania), números de 0 a 20 por extenso, nomes de uma lista curta; resposta calculada em TS, hashes no navegador; conceito `numbers`, limite de 5 por dia.
- **Servidor:** nenhuma tabela nova. Migração `20261030000000_evoquest_babel.sql` só com o bloco `-- <catalogo>` (etapas `en_radio:*` com hash, atividades `radio_*` e `field_radio` com `subject = 'ingles'`). `WORLD_CATALOG_MIGRATION` aponta para ela. **Pendente: aplicar no Supabase** (junto com as anteriores ainda não aplicadas).
- **Testes:** `catalog.test.ts` ganhou o ramo do inglês (o hash sai de `EN_SOLUTIONS`; um teste confere que cada valor esperado está de fato na transmissão, por extenso ou soletrado; formas alternativas de escrever valem; erros típicos têm retorno sem revelar a resposta); `pedagogy.test.ts` cobre a cadeia da missão, o portão em chão livre, as lições com exemplo falado, o catálogo `ingles`, o atendente e a revisão de campo em 40 sementes; `enterminal.test.tsx` cobre ditado com pista e evidência, formulário por extenso, transcrição = contato e saída com dificuldade. E2E: novo passo em `e2e/world.mjs` (contexto novo, vale da Guilda para Babel, missão inteira; a voz é substituída por um registro do que seria lido).
- **Cuidados aprendidos:** a ordem das regras de retorno importa — tamanho (faltou/sobrou) antes da palavra que faltou, campo em branco antes de qualquer pista; a ficha e a transmissão têm um botão "Devagar" cada (nos testes, o último é o da transmissão); o teste de alcance abre portas por lista fixa de flags — `pier_gate` e `bot_down` entraram lá.
- **Próximos passos:** validar o Porto com jogadores (vozes variam por sistema; sem voz em inglês, só a transcrição); segunda fase de Babel com escuta de frases (unidades A1–A2); Silogia (lógica) precisa de adaptador de tabela-verdade; Estatística pode reaproveitar o terminal Python.

### Primeira pessoa (24/10/2026)

O usuário jogou e não gostou da visão de cima; pediu primeira pessoa. Escolha: **raycasting** sobre a grade de tiles existente (estilo Wolfenstein), reaproveitando mapas, NPCs, missões, terminais e a pixel art — nada de conteúdo mudou.

- **Geometria pura** (`render/raycast.ts`, testada em `raycast.test.ts`): DDA por coluna (`castColumn`) devolvendo as faces atingidas (muretas no caminho e a primeira parede inteira); classe de cada tile (`renderClass`: chão, parede, **mureta** para água e cerca — vê-se por cima —, **cartaz** para árvores); projeção de pontos na câmera (`project`); **mira** por cone estreito (`aimedEntity`, ~28° e até 1,7 tile) no lugar do "tile à frente"; `bestLookAngle` escolhe, ao chegar a um lugar, a direção cardeal com mais chão livre (ninguém nasce de cara para a parede). Ângulo ↔ direção cardeal (`angleOf`/`dirOf`): o `facing` salvo continua existindo e é derivado do ângulo, então saves antigos, condições do mundo e `__eq.place` dos testes seguem funcionando.
- **Vista** (`render/fpsView.ts`): buffer de baixa resolução (320–400 colunas, pixel art nítida) ampliado sem suavização; chão texturizado por *floor casting* com as texturas dos tiles (portas abertas mostram o trilho), céu em gradiente ao ar livre ou teto escuro nos interiores (`palette === 'data'`), névoa por distância (mais suave em interiores), paredes com a textura do tile e face lateral mais escura, sprites como cartazes ancorados no chão (NPC desenhado por `drawCharacter`, objetos por `drawObject`, marca de missão em cima: imagem 16 × 32) com oclusão por coluna (z-buffer das paredes inteiras e das muretas). Devolve o retângulo do sprite na mira para o contorno.
- **Runtime** (`render/runtime.ts`): W/S (↑/↓) andam para a frente/trás, A/D (←/→) giram, Shift + A/D anda de lado, clique no canvas prende o mouse (pointer lock) para olhar; E/Enter/Espaço interagem. Celular: joystick vertical anda, horizontal gira; o botão de ação continua. Balanço leve do passo (desligado com movimento reduzido). Piloto automático da apresentação vira a câmera antes de andar. **Minimapa** (planta da região, portas em amarelo/verde, NPCs em azul, inimigos em vermelho, portais em lilás, jogador com a direção do olhar) no canto inferior direito (desktop) ou superior esquerdo (celular). Pausar (janela aberta) solta o mouse.
- **Sprites novos**: `tree` em `drawObject` (copa e tronco sem o chão, para o cartaz). Tiles `roof:*` viram paredes (as casas das cidades geradas ficam com "paredes" de telha); vale revisitar as cidades geradas para dar fachadas de verdade.
- **Testes/E2E**: `raycast.test.ts` (ângulos, porta fechada × aberta, água como mureta + parede atrás, árvore como cartaz, mira, projeção, para onde olhar). No E2E, "andar com o teclado" passou a conferir deslocamento em qualquer direção e que D muda o `facing`; `__eq.place` também vira a câmera (`runtime.face`).
- **Pendências:** cidades geradas e Vila foram desenhadas para a visão de cima — paredes de "telhado" e praças vazias pedem fachadas, placas e mais objetos; portais são elipses no chão (pouco visíveis de frente: dar um arco/porta); sprites de NPC em tamanho de parede ficam grandes de perto; considerar céu noturno para a Cidade dos Dados (hoje teto escuro em toda região `data`); validar o desempenho em celulares antigos (floor casting por pixel) e a jogabilidade com o usuário.
