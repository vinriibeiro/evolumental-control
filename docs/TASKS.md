# TASKS — Rotinas inteligentes e prática diária de inglês

| ID | Tarefa | Critérios de aceite | Depende de | Status |
|---|---|---|---|---|
| T001 | Motor de rotinas por regras (`src/lib/routine.ts`) | R1: saída determinística (ciclo, configuração de cronograma, blocos diários, tarefas recorrentes, marcos), `ROUTINE_RULES` e motivo por bloco; testes Vitest | — | Concluída |
| T002 | Modelos de rotina, incluindo "Transição: Analista → Cientista de Dados" | R2: seis pilares com pesos e frequências, ligados às trilhas `cientista_dados` e `analista_dados`; modelo em branco; testes | T001 | Concluída |
| T003 | Página "Rotinas": assistente automático com prévia e aplicação | R3: passos, prévia com regras e motivos, aplicar idempotente com as entidades existentes; menu | T001, T002 | Concluída |
| T004 | Modo manual: editar e regerar a rotina com prévia de diferenças | R3: edição de pilares/pesos/horários, regerar mostrando diferenças, sem apagar histórico | T003 | Concluída |
| T005 | Aba "Inglês": prática diária, meta, sequência e calendário | R4: registro rápido por habilidade, meta diária, sequência, calendário do mês, totais; modo local e Supabase; testes | — | Concluída |
| T006 | Integração: "Rotina de hoje" e inglês diário na rotina | R5: blocos do dia por pilar na Visão geral/Meu espaço; bloco de inglês abre a aba Inglês | T003, T005 | Concluída |
| T007 | Documentação e verificação final sem jogo | R6 e README atualizado (Rotinas, regras, aba Inglês); nenhuma referência ao EvoQuest | T006 | Concluída |
