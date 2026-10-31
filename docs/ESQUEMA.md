# Esquema do banco de dados

Fonte da verdade: `supabase/migrations/20261021000000_init.sql`. Os tipos TypeScript equivalentes estão em `src/types/db.ts` e as relações em `src/lib/data/schema.ts` (usadas também pelo modo local).

## Convenções

- Toda tabela de dados tem `user_id uuid not null default auth.uid()`, `created_at` e `updated_at` (mantido por gatilho).
- RLS habilitado e forçado; políticas `select/insert/update/delete` exigem `user_id = auth.uid()`.
- Referências entre tabelas usam FKs compostas `(coluna, user_id) → (id, user_id)`, que impedem apontar para dados de outro usuário.
- Requer PostgreSQL 15+ (usa `ON DELETE SET NULL (coluna)` em FKs compostas). Projetos Supabase atuais atendem.
- Totais derivados **não** são armazenados (ex.: tempo líquido, tempo estudado por tópico, progresso de metas).

## Tabelas

| Tabela | Finalidade | Destaques |
|---|---|---|
| `profiles` | Nome e preferências (`settings` JSONB) | Criado por gatilho em `auth.users`. |
| `subjects` | Matérias | prioridade/dificuldade 1–5, meta semanal, datas, edital, status (`active/paused/completed/archived`). |
| `topics` | Tópicos e subtópicos (árvore por `parent_id`) | status, domínio 0–5, prioridade, peso (progresso ponderado), estimativa, `completed_at` mantido por gatilho. |
| `study_materials` | Links/materiais por matéria ou tópico | URL validada (`http/https`). |
| `study_sessions` | Sessões de estudo | modo, status (`active`, `pending_review`, `completed`, `cancelled`), início/fim, `adjustment_seconds`, configuração e estado das fases do temporizador, vínculos com bloco do cronograma e do ciclo. Índice único parcial: uma sessão viva por usuário. |
| `study_session_pauses` | Pausas manuais (`pause`) e programadas (`break`) | No máximo uma pausa aberta por sessão. |
| `study_plans` / `study_plan_items` | Cronogramas e seus blocos | Configuração de disponibilidade em JSONB; blocos com status `pending/done/partial/missed/rescheduled`. |
| `study_cycles` / `study_cycle_items` | Ciclos e seus blocos | Posição (`current_index`), progresso do bloco e voltas; no máximo um ciclo ativo por usuário. |
| `calendar_tasks` | Tarefas, prazos e provas | Data e horário opcionais. |
| `reviews` | Revisões planejadas/realizadas | `status = done` exige `done_at`. |
| `flashcard_decks` / `flashcards` / `flashcard_reviews` | Baralhos, cartões e histórico de respostas | Agendamento SM-2 no cartão; tags `text[]` com índice GIN. |
| `mind_maps` | (legado) Mapas mentais | Recurso removido da interface; a tabela e os dados antigos continuam no esquema e nos backups. |
| `study_goals` | Metas | Indicador, período, alvo; ajustes criam nova versão (`previous_goal_id`) e encerram a anterior. |
| `question_records` | Desempenho em questões | `correct + wrong ≤ total`. |

## Política de exclusão

| Ao excluir… | Em cascata | Vínculo removido (histórico mantido) |
|---|---|---|
| Matéria | tópicos, materiais, blocos de cronograma e ciclo, revisões, metas da matéria | sessões, questões, baralhos, cartões, mapas, tarefas |
| Tópico | subtópicos, materiais, revisões | sessões, questões, cartões, baralhos, mapas, blocos |
| Sessão | pausas | revisões que a referenciavam |
| Cronograma / ciclo | seus blocos | sessões vinculadas |
| Baralho | cartões e respostas | — |

A interface mostra essas contagens antes de confirmar e oferece arquivamento de matérias e baralhos.

## Objetos auxiliares

- `study_session_net` (view, `security_invoker`): tempo líquido e pausado por sessão finalizada, com a mesma regra do app.
- `record_flashcard_review(...)` (função, `security invoker`): grava a resposta e atualiza o agendamento do cartão na mesma transação; idempotente pelo ID da resposta.
- `topics_track_completion` (gatilho): preenche/limpa `completed_at` conforme o status.
- `handle_new_user` (gatilho, `security definer`): cria o perfil de cada novo usuário.
