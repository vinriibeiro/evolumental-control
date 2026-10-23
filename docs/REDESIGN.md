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
  os assets são desenhados por código (pixel art procedural), carregados por região sob demanda.
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
- Atualizar `e2e/evoquest.mjs`: o modo clássico saiu de `/evoquest` para `/evoquest/treino`.
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
- Minha Cidade ainda não tem desafios próprios (ideia: usar os flashcards da matéria); cidades geradas sem história própria.
- Indicadores são calculados no navegador sobre 365 dias; para contas grandes, mover agregações para views/RPCs.
- Vínculo EvoQuest ↔ tópicos do Control é por nome; nomes diferentes não se ligam.
