# VLM Control 2.0 — decisões e mapa da nova versão

Documento de referência da 2.0 (novembro/2026). Explica **o que mudou, onde cada coisa ficou e por quê**.
A regra de ouro desta versão: nada útil foi apagado, nenhum dado existente é alterado sem o usuário pedir e
toda funcionalidade nova reaproveita os motores que já existiam (sessões, revisões, cronograma, laboratório, leitores).

## 1. Navegação: seis áreas

| Área | Rota | O que tem dentro (abas) |
|---|---|---|
| Meu Planejamento | `/` | Planejamento (tela inicial), Rotinas, Revisões, Ciclo de estudos |
| Trilhas de Estudo | `/trilhas` | Trilhas (Ciência de Dados), Projetos, Laboratório, Matérias, Flashcards, Questões, Outras trilhas (catálogo antigo) · também `/diagnostico/:pilar` e o Plano CGU (`/cgu`) |
| Biblioteca | `/biblioteca` | Estante (EPUB + PDF), Cursos, Áudios, Vídeos · leitores em `/livros/:id` e `/livros/pdf/:id` |
| Sala de Estudos | `/sala` | Sessão (cronômetro / modo foco / confirmação), Histórico |
| Metas e Evolução | `/metas` | Metas, Evolução, Relatório semanal, Exercícios |
| Configurações | `/configuracoes` | — |

Endereços antigos continuam funcionando: `/cronometro` → `/sala` (mantém `?bloco=`, `?materia=` etc.),
`/calendario`, `/cronograma` e `/espaco` → `/`, `/relatorios` → `/evolucao`, `/livros` → `/biblioteca`,
`/banco-de-questoes/desafios` → `/laboratorio`. A busca (Ctrl K) lista todas as abas.

Páginas que deixaram de existir como tela própria (o conteúdo foi absorvido):
- **Visão geral / Dashboard** e **Relatórios** → Evolução (`/evolucao`) e o resumo do dia da tela inicial.
- **Meu espaço de estudos** → tela inicial (dia, continuar de onde parei) e Sala de Estudos (bloco de notas: o texto salvo continua o mesmo).
- **Calendário** → tela inicial (dia/semana/mês). O modo "Ciclo" virou a aba Ciclo de estudos.
- **Pasta Biblioteca** (cartões) → abas da própria Biblioteca.

## 2. Identidade visual

Tokens em `src/index.css` (todo o app usa os tokens, não cores soltas):
branco `#FFFFFF` (fundo), `#F7F7F7` (secundário), preto `#171717` (texto), vermelho Vasco `#B91C1C` (destaque),
bordas `#E5E7EB`. O vermelho aparece só em: botão principal, item selecionado, "hoje", atraso/conflito e atenção.
Verde foi eliminado (inclusive o "sucesso", que agora é preto). Gráficos: série principal em vermelho e as demais em
cinzas. Logo e ícones do app regenerados (`scripts/gerar-icones.mjs`): preto e branco com a seta da evolução em vermelho.
Tema escuro mantido com a mesma lógica.

## 3. Modelo de dados (migração aditiva)

`supabase/migrations/20261121000000_v2_planning_trails.sql` — **só acrescenta**; o app anterior continua funcionando
com o esquema novo e há um bloco de reversão comentado no fim do arquivo. No modo local, o Dexie sobe para a v3 e
preenche as colunas novas das linhas antigas com o valor padrão (`src/lib/data/local.ts`).

- `calendar_tasks`: `category`, `priority`, `fixed`, `due_date`, `series_id`, `recurrence`, `done_at`, `origin_key`, `project_id`.
  Índices únicos parciais: uma ocorrência por dia em cada série; uma tarefa por `origin_key` (cópias de semana e modelos não duplicam).
- `study_sessions`: `task_id`, `project_id`, `source` (de onde o estudo começou — o cronômetro reconhece o conteúdo).
- `subjects`/`topics`: `trail_key` (identificador estável, único por usuário), `topics.knowledge` (`self` | `demonstrated`), `topics.practiced_at`.
- `study_goals`: metas por entregas (`kind`, `checklist`, `due_date`, `done_at`) e a métrica `projects_completed`.
- Tabelas novas com RLS no mesmo padrão (só o dono): `inbox_items`, `projects`, `assessments`.
- "Zerar todos os dados" também limpa a caixa de entrada e a evidência de conhecimento; projetos e histórico de diagnósticos ficam.

A Biblioteca tem sua própria migração aditiva (`20261121010000_v2_library.sql`), descrita em `docs/BIBLIOTECA.md`.

**Antes de publicar com Supabase:** aplicar as duas migrações no projeto (na ordem dos nomes).

## 4. Meu Planejamento (tela inicial)

`src/pages/planning/`. Tarefas (`calendar_tasks`) e blocos do cronograma (`study_plan_items`) aparecem juntos,
mas cada registro continua na sua tabela (sem cópias). Decisões:
- **Mínimo de cliques:** campo rápido aceita só o título; horário no começo e duração no fim são opcionais (`19h Python 1h`, `src/lib/quickAdd.ts`). Título que começa com o nome de uma matéria vira estudo dessa matéria. No formulário, só título e data; o resto fica em "Mais opções".
- **Calendário dia/semana/mês:** criar clicando no horário, arrastar (inclusive entre dias e itens sem horário), redimensionar, concluir, filtro por categoria, conflitos marcados em vermelho, histórico realizado opcional.
- **Recorrência:** cada ocorrência é uma tarefa normal com o mesmo `series_id`; séries sem fim são estendidas uma vez por dia até 8 semanas à frente, sem recriar dias apagados.
- **Categorias:** Estudos, Trabalho, Pessoal, Compromissos, Outros + as criadas no próprio formulário.
- **Semana:** resumo (concluídas, pendências, estudo realizado × planejado por matéria, horas livres, compromissos, prioridades), copiar semana anterior e modelos de semana — sempre com prévia e sem repetir o que já existe.
- **Caixa de entrada:** anota em uma linha; vira tarefa depois.
- **Continuar de onde parei:** último estudo (com "Retomar", que reabre o mesmo conteúdo no cronômetro) e último livro/PDF lido. A "Rotina de hoje" e o cartão "CGU · Hoje" aparecem aqui só para quem tem rotina aplicada ou já começou o Plano CGU.
- **Reorganizar minha semana** (`src/lib/replan.ts`, função pura e testada): prévia com atrasadas, novos horários, conflitos e o que não coube (com motivo). Respeita compromissos, disponibilidade, janela preferida, limite diário, prazos, prioridade, déficit da meta semanal da matéria e a ordem dos tópicos. Não move concluídas, compromissos fixos nem recorrentes que não são estudo. Aceitar tudo ou só o selecionado; aplica atualizando o próprio registro (vínculos com trilha/tópico preservados).
- **Planejamento adaptativo:** compara duração prevista × real das sessões iniciadas a partir de atividades; com 3+ amostras e diferença ≥ 25% sugere revisar a duração. Nunca altera preferências sozinho.

## 5. Trilhas, diagnóstico e projetos

- Conteúdo em `src/content/dsTrail.ts` (5 pilares, 54 tópicos com objetivo, pré-requisitos, conteúdo, material oficial, exercício, duração), `dsDiagnostics.ts` (137 questões) e `dsProjects.ts` (13 modelos). Chaves estáveis: mudar texto é seguro; renomear chave não.
- **Sem duplicação** (`src/services/dsTrail.ts`): pilar/tópico com a chave fica como está; com o mesmo nome e sem chave é adotado (progresso preservado); só o que falta é criado. Conteúdo novo chega sozinho a quem já ativou.
- **Estados** (`src/lib/trail.ts`): concluído (só depois do exercício prático ou de demonstrar), demonstrado em avaliação, autodeclarado, em andamento, disponível, aguardando pré-requisito. Tempo de estudo nunca marca domínio.
- **Diagnóstico:** opcional, rápido (2 por assunto) ou completo; um assunto só é "demonstrado" com 2+ questões certas e nenhuma errada; resultado por assunto e por competência, lacunas, não avaliados e ponto de partida. Cada tentativa é um registro novo.
- **Projetos:** um registro por projeto, ligado a vários tópicos; o mesmo modelo não vira dois projetos (índice único). Link do GitHub opcional, sem credenciais. Indicadores contam etapas/entregáveis concluídos, tempo investido e publicações — criar não conta.
- **Laboratório integrado:** "Abrir desafios" no tópico abre o laboratório no nível certo; desafio verificado vira um registro de exercício (uma vez por desafio) que alimenta metas e relatórios.

## 6. Sala de Estudos e cronômetro

Um único cronômetro para o app todo (`src/features/timer/useStartStudy.ts`). "Iniciar estudo" em tópico, tarefa,
bloco, projeto, livro ou PDF grava a origem na sessão; o banco garante uma sessão ativa por usuário (trocar de página
ou recarregar não duplica; tentar iniciar outra pede para finalizar a atual). Cronômetro compacto no topo de todas as
telas com pausar/continuar. Modo foco: conteúdo, tempo, controles e anotações rápidas. Ao salvar, a tarefa de origem é
concluída quando o tempo cobre 90% da duração prevista. Cálculo de tempo líquido inalterado (`src/lib/timer/engine.ts`).

## 7. Metas e Evolução

Ver `src/pages/goals`, `src/pages/reports`, `src/lib/evolution.ts` e `src/lib/weeklyReport.ts`. Metas quantitativas e por
entregas; Evolução com planejado × realizado, comparação com o período anterior e "Dados insuficientes" quando falta base;
Relatório semanal por regras, separando **Dado** de **Sugestão por regra**. Exportação CSV e PDF.

## 8. Testes

`npm run check` (typecheck, lint, unitários, build) e os e2e em `e2e/` (`npm run dev` em outro terminal, depois `npm run test:e2e`).
Pendência conhecida e anterior à 2.0: `e2e/courses.mjs` ainda simula o login do Google em janela pop-up, mas o app passou a
conectar na mesma aba (#11), então esse script para no passo "conectado (só leitura)". Testes novos cobrem: navegação das seis áreas,
replanejamento (incluindo o exemplo Python de terça), entrada rápida, recorrência, cópia de semana e modelos sem
duplicar, instalação/adoção da trilha, diagnóstico (exemplo SQL → JOIN), histórico de avaliações, laboratório sem
duplicar, integridade do conteúdo e a migração SQL com RLS (PGlite).
