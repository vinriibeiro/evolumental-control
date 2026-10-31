# PRD — VLM Control: rotinas inteligentes (sem IA) e prática diária de inglês

## 1. Contexto

O VLM Control é um gerenciador e organizador de estudos (React + TypeScript + Vite, dados locais no navegador ou Supabase). O jogo EvoQuest **já foi removido** do `main` e não deve voltar: o produto é apenas gerenciador de estudos, com cronograma, ciclo e calendário.

O app já possui, e **deve ser reaproveitado** (não reconstruir):
- `src/lib/planner.ts`: cronograma automático por regras determinísticas e visíveis (`PLANNER_RULES`, `generatePlan`, `diffPlan`, `replanLate`).
- `src/lib/cycle.ts`: ciclos de estudo (`distributeByWeight`, avanço por execução).
- `src/content/trails.ts`: trilhas prontas, incluindo **Analista de Dados** (`analista_dados`) e **Cientista de Dados** (`cientista_dados`), e a matéria de inglês (`ingles_leitura`).
- Páginas de Cronograma, Ciclo de estudos, Calendário, Trilhas, Metas, Cronômetro e lançamento manual de sessões.

## 2. Objetivo

Adicionar uma **inteligência limitada, sem inteligência artificial**: regras determinísticas e explicáveis que montam **rotinas** de estudo — ciclo, cronograma e tarefas recorrentes — de forma **automática** (a partir de um modelo e da disponibilidade) ou **manual** (a pessoa monta e ajusta), sempre com prévia antes de aplicar.

E entregar pronta a rotina do usuário: **migrar de Analista de Dados para Cientista de Dados**.

## 3. Requisitos funcionais

### R1. Motor de rotinas (regras, sem IA)
- Módulo puro e testável (ex.: `src/lib/routine.ts`). Entrada: pilares (nome, peso, frequência desejada — diária, dias por semana ou semanal —, duração típica do bloco, tipo de atividade, matérias/trilha associadas), disponibilidade semanal (dias e janelas de horário, limite diário/semanal), data de início e, opcionalmente, marcos com data (ex.: prova de certificação).
- Saída determinística: itens de ciclo com pesos e durações (reusar `distributeByWeight`), configuração do cronograma compatível com `generatePlan`, blocos fixos para pilares de frequência diária (ex.: inglês todos os dias), tarefas recorrentes de calendário (ex.: LinkedIn semanal) e marcos.
- Regras visíveis na tela (lista `ROUTINE_RULES`, no mesmo estilo de `PLANNER_RULES`), e para cada bloco proposto um motivo curto ("por que este bloco aqui").
- Mesmas entradas geram sempre a mesma rotina. Sem chamadas a serviços externos, sem LLM.

### R2. Modelos de rotina
- Catálogo de modelos editáveis. Obrigatório: **"Transição: Analista → Cientista de Dados"**, com os pilares:
  1. **Estudo de Ciência de Dados** (maior peso): estatística, matemática para ML, Python, machine learning — reaproveitando a trilha `cientista_dados`.
  2. **Manter-se pronto em Análise de Dados** (peso médio, prática semanal, nunca zerar): SQL, Power BI, Excel, storytelling — trilha `analista_dados`.
  3. **Resolver problemas de Ciência de Dados** (projetos práticos e desafios, semanal).
  4. **LinkedIn e carreira** (semanal, tarefas): título e "Sobre" orientados a ciência de dados, destacar projetos, publicar aprendizados, conexões na área.
  5. **Certificações** (marcos com data definidos pelo usuário; o modelo sugere exemplos editáveis, sem inventar datas).
  6. **Inglês — prática diária** (todos os dias, bloco curto; sem material).
- Também um modelo genérico ("Rotina em branco") para o modo manual.

### R3. Página "Rotinas"
- Nova página no menu. Assistente em passos: escolher modelo (ou em branco) → ajustar pilares, pesos e frequências → informar disponibilidade → **prévia** (ciclo, semana-tipo do cronograma, tarefas, regras e motivos) → **Aplicar**.
- Aplicar cria/atualiza os dados usando as entidades existentes (matérias e tópicos das trilhas, ciclo ativo, cronograma e blocos, tarefas de calendário, metas). **Idempotente**: não duplica matérias já existentes; reaplicar mostra a diferença (reusar `diffPlan`) e só altera o necessário. Nunca apaga histórico de estudo.
- Modo manual: editar a rotina aplicada (pilares, pesos, horários) e regerar com prévia.

### R4. Aba "Inglês"
- Nova página "Inglês" no menu, focada em **prática diária, sem material didático**: registrar prática rápida (minutos e habilidade: ouvir, falar, ler, escrever, vocabulário), meta diária (padrão 20 min, configurável), sequência de dias praticados, calendário do mês com os dias praticados e totais por habilidade.
- Reaproveitar o armazenamento existente (sessões de estudo vinculadas à matéria de inglês) para funcionar no modo local e no Supabase **sem nova migração**, se possível. Se for indispensável armazenar algo novo, implementar nos dois modos e documentar.

### R5. Integração
- "Rotina de hoje" visível na Visão geral / Meu espaço: blocos do dia por pilar e se o inglês do dia já foi feito.
- O bloco diário de inglês da rotina abre a aba Inglês.

### R6. Sem jogo
- Nenhuma tela, rota, texto ou dado do EvoQuest/jogo no app.

## 4. Requisitos não funcionais
- Sem IA/LLM e sem novas dependências externas (bibliotecas já presentes podem ser usadas).
- Preservar todas as funcionalidades e os testes existentes (Vitest) e a checagem de tipos (`npm run typecheck`).
- Funcionar no modo local (IndexedDB) e com Supabase.
- Português do Brasil, acessível (rótulos, foco, contraste) e responsivo.
- Testes automatizados para o motor de rotinas, os modelos e as regras da aba Inglês.

## 5. Fora do escopo
- Conteúdo/material didático de inglês ou de ciência de dados.
- Publicação/deploy (o deploy na Vercel é decisão do usuário).
- Qualquer integração com LinkedIn ou serviços externos (as tarefas de LinkedIn são lembretes/checklist).
