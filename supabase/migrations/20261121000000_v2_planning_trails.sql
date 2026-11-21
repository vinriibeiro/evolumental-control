-- =====================================================================
-- VLM Control 2.0 — planejamento pessoal, trilhas, projetos e diagnósticos
-- Migração 20261121000000_v2_planning_trails
--
-- Só ACRESCENTA: colunas novas (com valor padrão) em tabelas que já existem
-- e três tabelas novas. Nenhuma linha existente é alterada ou apagada, e a
-- versão anterior do app continua funcionando com este esquema.
--
--   * calendar_tasks  -> categoria, prioridade, compromisso fixo, prazo,
--                        recorrência (série), origem (sem duplicar) e projeto;
--   * study_sessions  -> tarefa, projeto e conteúdo de origem da sessão;
--   * subjects/topics -> identificador estável da trilha e evidência de conhecimento;
--   * study_goals     -> metas por entregas (lista de itens e prazo);
--   * inbox_items     -> caixa de entrada rápida;
--   * projects        -> projetos práticos / portfólio;
--   * assessments     -> diagnósticos de conhecimento (histórico, nunca sobrescrito).
--
-- Reversão: ver o bloco comentado no fim do arquivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Projetos práticos
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  objective text check (objective is null or char_length(objective) <= 2000),
  track text check (track is null or char_length(track) <= 40),
  skills jsonb not null default '[]'::jsonb check (jsonb_typeof(skills) = 'array'),
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'in_review', 'done')),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  due_date date,
  repo_url text check (repo_url is null or (char_length(repo_url) <= 500 and repo_url ~* '^https?://')),
  published boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 8000),
  template_key text check (template_key is null or char_length(template_key) <= 120),
  topic_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(topic_keys) = 'array'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
-- o mesmo modelo de projeto não é instalado duas vezes
create unique index projects_template_key on public.projects (user_id, template_key) where template_key is not null;

-- ---------------------------------------------------------------------
-- Tarefas do planejamento
-- ---------------------------------------------------------------------
alter table public.calendar_tasks
  add constraint calendar_tasks_id_user_key unique (id, user_id),
  add column category text check (category is null or char_length(category) between 1 and 40),
  add column priority smallint not null default 2 check (priority between 1 and 3),
  add column fixed boolean not null default false,
  add column due_date date,
  add column series_id uuid,
  add column recurrence jsonb check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  add column done_at timestamptz,
  add column origin_key text check (origin_key is null or char_length(origin_key) between 1 and 200),
  add column project_id uuid,
  add constraint calendar_tasks_project_fk foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id);

-- uma ocorrência por dia em cada série recorrente; uma tarefa por origem
create unique index calendar_tasks_series_day on public.calendar_tasks (user_id, series_id, date) where series_id is not null;
create unique index calendar_tasks_origin on public.calendar_tasks (user_id, origin_key) where origin_key is not null;
create index calendar_tasks_user_date_idx on public.calendar_tasks (user_id, date);

-- ---------------------------------------------------------------------
-- Sessões: de onde o estudo começou
-- ---------------------------------------------------------------------
alter table public.study_sessions
  add column task_id uuid,
  add column project_id uuid,
  add column source jsonb check (source is null or jsonb_typeof(source) = 'object'),
  add constraint study_sessions_task_fk foreign key (task_id, user_id) references public.calendar_tasks (id, user_id) on delete set null (task_id),
  add constraint study_sessions_project_fk foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id);
create index study_sessions_project_idx on public.study_sessions (user_id, project_id) where project_id is not null;

-- ---------------------------------------------------------------------
-- Trilhas: identificação estável (sem instalar duas vezes) e evidência de conhecimento
-- ---------------------------------------------------------------------
alter table public.subjects
  add column trail_key text check (trail_key is null or char_length(trail_key) between 1 and 120);
create unique index subjects_trail_key on public.subjects (user_id, trail_key) where trail_key is not null;

alter table public.topics
  add column trail_key text check (trail_key is null or char_length(trail_key) between 1 and 120),
  add column knowledge text check (knowledge is null or knowledge in ('self', 'demonstrated')),
  add column practiced_at timestamptz;
create unique index topics_trail_key on public.topics (user_id, trail_key) where trail_key is not null;

-- ---------------------------------------------------------------------
-- Metas por entregas e meta de projetos concluídos
-- ---------------------------------------------------------------------
alter table public.study_goals drop constraint study_goals_metric_check;
alter table public.study_goals
  add constraint study_goals_metric_check check (metric in ('study_hours', 'sessions', 'questions', 'accuracy', 'topics_completed', 'flashcards_reviewed', 'study_days', 'projects_completed')),
  add column kind text not null default 'metric' check (kind in ('metric', 'deliverable')),
  add column checklist jsonb check (checklist is null or jsonb_typeof(checklist) = 'array'),
  add column due_date date,
  add column done_at timestamptz;

-- ---------------------------------------------------------------------
-- Caixa de entrada rápida
-- ---------------------------------------------------------------------
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  processed_at timestamptz,
  task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.calendar_tasks (id, user_id) on delete set null (task_id)
);
create index inbox_items_user_idx on public.inbox_items (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Diagnósticos de conhecimento (cada tentativa é uma linha nova)
-- ---------------------------------------------------------------------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track text not null check (char_length(track) between 1 and 40),
  taken_at timestamptz not null default now(),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array'),
  total integer not null default 0 check (total >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= total),
  start_key text check (start_key is null or char_length(start_key) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_user_track_idx on public.assessments (user_id, track, taken_at desc);

-- ---------------------------------------------------------------------
-- updated_at + RLS das tabelas novas (mesmo padrão das demais: só o dono)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'inbox_items', 'assessments'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- "Zerar todos os dados": também esvazia a caixa de entrada e a evidência de conhecimento dos tópicos.
-- Projetos e o histórico de diagnósticos são conteúdo do usuário e ficam.
-- ---------------------------------------------------------------------
create or replace function public.reset_my_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  delete from public.study_session_pauses where user_id = uid;
  delete from public.reviews where user_id = uid;
  delete from public.study_sessions where user_id = uid;
  delete from public.inbox_items where user_id = uid;
  delete from public.calendar_tasks where user_id = uid;
  delete from public.study_goals where user_id = uid;
  delete from public.study_plan_items where user_id = uid;
  delete from public.study_plans where user_id = uid;
  delete from public.study_cycle_items where user_id = uid;
  delete from public.study_cycles where user_id = uid;
  delete from public.course_progress where user_id = uid;

  -- o gatilho topics_track_completion limpa completed_at junto com o status
  update public.topics set status = 'not_started', mastery = 0, knowledge = null, practiced_at = null where user_id = uid;

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

-- =====================================================================
-- REVERSÃO (execute manualmente, se precisar voltar ao esquema anterior):
--
--   drop table public.assessments;
--   drop table public.inbox_items;
--   alter table public.study_goals drop column done_at, drop column due_date, drop column checklist, drop column kind;
--   delete from public.study_goals where metric = 'projects_completed';
--   alter table public.study_goals drop constraint study_goals_metric_check;
--   alter table public.study_goals add constraint study_goals_metric_check check (metric in ('study_hours','sessions','questions','accuracy','topics_completed','flashcards_reviewed','study_days'));
--   alter table public.topics drop column practiced_at, drop column knowledge, drop column trail_key;
--   alter table public.subjects drop column trail_key;
--   alter table public.study_sessions drop column source, drop column project_id, drop column task_id;
--   alter table public.calendar_tasks drop column project_id, drop column origin_key, drop column done_at, drop column recurrence,
--     drop column series_id, drop column due_date, drop column fixed, drop column priority, drop column category,
--     drop constraint calendar_tasks_id_user_key;
--   drop table public.projects;
--   (e recrie public.reset_my_data() como em 20261103000000_courses_drive.sql)
-- =====================================================================
