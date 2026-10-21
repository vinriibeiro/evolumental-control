-- =====================================================================
-- EVoLuMentaL Control — esquema inicial
-- Migração 20261021000000_init
--
-- Princípios:
--  * Todo registro pertence a um usuário (user_id = auth.uid() por padrão).
--  * RLS habilitado em todas as tabelas: cada usuário só enxerga e altera
--    as próprias linhas.
--  * Chaves estrangeiras compostas (id, user_id) impedem que um usuário
--    vincule registros a linhas de outro usuário, mesmo conhecendo o UUID.
--  * Horas líquidas NÃO são armazenadas: são derivadas de sessões e pausas
--    (veja a view study_session_net).
--  * Exclusões: planejamento/organização em cascata; históricos (sessões,
--    questões, cartões) perdem apenas o vínculo (SET NULL) e são mantidos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Matérias e tópicos
-- ---------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  color text not null default '#DEB887' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text check (icon is null or char_length(icon) <= 40),
  priority smallint not null default 3 check (priority between 1 and 5),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  weekly_goal_hours numeric(6, 2) check (weekly_goal_hours is null or weekly_goal_hours between 0 and 168),
  start_date date,
  target_date date,
  notes text check (notes is null or char_length(notes) <= 10000),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  exam text check (exam is null or char_length(exam) <= 200),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (target_date is null or start_date is null or target_date >= start_date)
);
create index subjects_user_idx on public.subjects (user_id, status, sort_order);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 300),
  description text check (description is null or char_length(description) <= 4000),
  sort_order integer not null default 0,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'reviewing')),
  mastery smallint not null default 0 check (mastery between 0 and 5),
  priority smallint not null default 3 check (priority between 1 and 5),
  weight numeric(6, 2) not null default 1 check (weight > 0 and weight <= 100),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 0 and 100000),
  notes text check (notes is null or char_length(notes) <= 10000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (parent_id is null or parent_id <> id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.topics (id, user_id) on delete cascade
);
create index topics_subject_idx on public.topics (user_id, subject_id, parent_id, sort_order);
create index topics_parent_idx on public.topics (parent_id);
create index topics_completed_idx on public.topics (user_id, completed_at) where completed_at is not null;

-- completed_at acompanha o status: preenchido ao concluir, limpo ao reabrir.
create or replace function public.topics_track_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger topics_track_completion
  before insert or update of status on public.topics
  for each row execute function public.topics_track_completion();

create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);
create index study_materials_topic_idx on public.study_materials (user_id, topic_id);

-- ---------------------------------------------------------------------
-- Cronogramas e ciclos (referenciados pelas sessões)
-- ---------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  start_date date not null,
  end_date date not null,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date >= start_date and end_date - start_date <= 400)
);
create index study_plans_user_idx on public.study_plans (user_id, status);

create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  subject_id uuid,
  topic_id uuid,
  activity_type text not null default 'theory' check (activity_type in ('theory', 'questions', 'review', 'video', 'reading', 'flashcards', 'mock_exam', 'other')),
  status text not null default 'pending' check (status in ('pending', 'done', 'partial', 'missed', 'rescheduled')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.study_plans (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index study_plan_items_date_idx on public.study_plan_items (user_id, date, start_time);
create index study_plan_items_plan_idx on public.study_plan_items (plan_id, date);

create table public.study_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  status text not null default 'paused' check (status in ('active', 'paused', 'archived')),
  current_index integer not null default 0 check (current_index >= 0),
  current_progress_seconds integer not null default 0 check (current_progress_seconds >= 0),
  completed_rounds integer not null default 0 check (completed_rounds >= 0),
  auto_advance boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
-- No máximo um ciclo ativo por usuário.
create unique index study_cycles_one_active on public.study_cycles (user_id) where status = 'active';

create table public.study_cycle_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cycle_id uuid not null,
  subject_id uuid not null,
  topic_id uuid,
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  sort_order integer not null default 0,
  weight numeric(6, 2) not null default 1 check (weight > 0 and weight <= 100),
  break_minutes integer not null default 0 check (break_minutes between 0 and 240),
  activity_type text not null default 'theory' check (activity_type in ('theory', 'questions', 'review', 'video', 'reading', 'flashcards', 'mock_exam', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (cycle_id, user_id) references public.study_cycles (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index study_cycle_items_cycle_idx on public.study_cycle_items (cycle_id, sort_order);

-- ---------------------------------------------------------------------
-- Sessões de estudo e pausas
-- ---------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  activity_type text not null default 'theory' check (activity_type in ('theory', 'questions', 'review', 'video', 'reading', 'flashcards', 'mock_exam', 'other')),
  mode text not null default 'stopwatch' check (mode in ('stopwatch', 'countdown', 'pomodoro', 'intervals', 'manual')),
  status text not null default 'active' check (status in ('active', 'pending_review', 'completed', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_seconds integer check (planned_seconds is null or planned_seconds between 1 and 86400),
  adjustment_seconds integer not null default 0 check (adjustment_seconds between -86400 and 86400),
  timer_config jsonb,
  timer_state jsonb,
  notes text check (notes is null or char_length(notes) <= 4000),
  plan_item_id uuid,
  cycle_id uuid,
  cycle_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at),
  check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  check (status in ('active', 'cancelled') or ended_at is not null),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id),
  foreign key (plan_item_id, user_id) references public.study_plan_items (id, user_id) on delete set null (plan_item_id),
  foreign key (cycle_id, user_id) references public.study_cycles (id, user_id) on delete set null (cycle_id),
  foreign key (cycle_item_id, user_id) references public.study_cycle_items (id, user_id) on delete set null (cycle_item_id)
);
-- Uma única sessão em andamento (ou aguardando confirmação) por usuário:
-- evita contagem duplicada entre abas e dispositivos.
create unique index study_sessions_one_live on public.study_sessions (user_id) where status in ('active', 'pending_review');
create index study_sessions_started_idx on public.study_sessions (user_id, status, started_at desc);
create index study_sessions_subject_idx on public.study_sessions (user_id, subject_id, started_at desc);
create index study_sessions_topic_idx on public.study_sessions (user_id, topic_id) where topic_id is not null;
create index study_sessions_plan_item_idx on public.study_sessions (plan_item_id) where plan_item_id is not null;

create table public.study_session_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  kind text not null default 'pause' check (kind in ('pause', 'break')),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade
);
-- No máximo uma pausa aberta por sessão.
create unique index study_session_pauses_one_open on public.study_session_pauses (session_id) where ended_at is null;
create index study_session_pauses_session_idx on public.study_session_pauses (session_id, started_at);

-- Tempo líquido derivado: floor((fim - início) - pausas) + ajuste explícito do usuário.
-- (Mesma regra de src/lib/timer/engine.ts → netSeconds.)
create view public.study_session_net
with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.subject_id,
  s.topic_id,
  s.activity_type,
  s.status,
  s.started_at,
  s.ended_at,
  floor(coalesce(p.paused_exact, 0))::integer as paused_seconds,
  greatest(
    0,
    floor(extract(epoch from (s.ended_at - s.started_at)) - coalesce(p.paused_exact, 0))::integer
      + s.adjustment_seconds
  ) as net_seconds
from public.study_sessions s
left join lateral (
  select sum(
    extract(epoch from (least(coalesce(sp.ended_at, s.ended_at), s.ended_at) - greatest(sp.started_at, s.started_at)))
  ) as paused_exact
  from public.study_session_pauses sp
  where sp.session_id = s.id and sp.started_at < s.ended_at
) p on true
where s.ended_at is not null;

-- ---------------------------------------------------------------------
-- Calendário, revisões, metas, questões
-- ---------------------------------------------------------------------
create table public.calendar_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 4000),
  date date not null,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  subject_id uuid,
  topic_id uuid,
  kind text not null default 'task' check (kind in ('task', 'deadline', 'exam', 'other')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index calendar_tasks_date_idx on public.calendar_tasks (user_id, date);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  scheduled_for date not null,
  status text not null default 'planned' check (status in ('planned', 'done', 'postponed', 'cancelled')),
  done_at timestamptz,
  session_id uuid,
  notes text check (notes is null or char_length(notes) <= 4000),
  origin text not null default 'manual' check (origin in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Revisão realizada precisa registrar quando foi feita.
  check (status <> 'done' or done_at is not null),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete set null (session_id)
);
create index reviews_schedule_idx on public.reviews (user_id, status, scheduled_for);
create index reviews_topic_idx on public.reviews (user_id, topic_id) where topic_id is not null;

create table public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 160),
  metric text not null check (metric in ('study_hours', 'sessions', 'questions', 'accuracy', 'topics_completed', 'flashcards_reviewed', 'study_days')),
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  target numeric(10, 2) not null check (target > 0 and target <= 100000),
  subject_id uuid,
  status text not null default 'active' check (status in ('active', 'paused', 'superseded', 'archived')),
  start_date date not null default current_date,
  end_date date,
  previous_goal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (metric <> 'accuracy' or target <= 100),
  check (end_date is null or end_date >= start_date - 1),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (previous_goal_id, user_id) references public.study_goals (id, user_id) on delete set null (previous_goal_id)
);
create index study_goals_user_idx on public.study_goals (user_id, status);

create table public.question_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  date date not null,
  total integer not null check (total between 1 and 100000),
  correct integer not null check (correct >= 0),
  wrong integer not null check (wrong >= 0),
  board text check (board is null or char_length(board) <= 120),
  exam text check (exam is null or char_length(exam) <= 200),
  source text check (source is null or char_length(source) <= 300),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Acertos + erros nunca excedem o total (o restante são questões em branco).
  check (correct + wrong <= total),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index question_records_date_idx on public.question_records (user_id, date desc);
create index question_records_subject_idx on public.question_records (user_id, subject_id, date);

-- ---------------------------------------------------------------------
-- Flashcards
-- ---------------------------------------------------------------------
create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  folder text check (folder is null or char_length(folder) <= 120),
  subject_id uuid,
  topic_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index flashcard_decks_user_idx on public.flashcard_decks (user_id, archived, name);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid not null,
  subject_id uuid,
  topic_id uuid,
  front text not null check (char_length(btrim(front)) between 1 and 10000),
  back text not null check (char_length(btrim(back)) between 1 and 10000),
  note text check (note is null or char_length(note) <= 10000),
  tags text[] not null default '{}' check (cardinality(tags) <= 50),
  status text not null default 'new' check (status in ('new', 'learning', 'review', 'suspended')),
  ease numeric(5, 3) not null default 2.5 check (ease between 1.1 and 5),
  interval_days numeric(10, 4) not null default 0 check (interval_days between 0 and 36500),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (deck_id, user_id) references public.flashcard_decks (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index flashcards_due_idx on public.flashcards (user_id, status, due_at);
create index flashcards_deck_idx on public.flashcards (deck_id, created_at);
create index flashcards_topic_idx on public.flashcards (user_id, topic_id) where topic_id is not null;
create index flashcards_tags_idx on public.flashcards using gin (tags);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null default now(),
  interval_before numeric(10, 4) not null default 0,
  interval_after numeric(10, 4) not null default 0,
  ease_after numeric(5, 3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.flashcards (id, user_id) on delete cascade
);
create index flashcard_reviews_user_idx on public.flashcard_reviews (user_id, reviewed_at desc);
create index flashcard_reviews_card_idx on public.flashcard_reviews (card_id, reviewed_at desc);

-- Registra a revisão e atualiza o agendamento do cartão na mesma transação.
-- Idempotente: repetir a chamada com o mesmo p_review_id não aplica duas vezes.
create or replace function public.record_flashcard_review(
  p_review_id uuid,
  p_card_id uuid,
  p_rating smallint,
  p_reviewed_at timestamptz,
  p_status text,
  p_ease numeric,
  p_interval_days numeric,
  p_repetitions integer,
  p_lapses integer,
  p_due_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before numeric;
begin
  select interval_days into v_before
  from public.flashcards
  where id = p_card_id
  for update;

  if not found then
    raise exception 'Cartão não encontrado' using errcode = 'P0002';
  end if;

  insert into public.flashcard_reviews (id, card_id, rating, reviewed_at, interval_before, interval_after, ease_after)
  values (p_review_id, p_card_id, p_rating, p_reviewed_at, v_before, p_interval_days, p_ease)
  on conflict (id) do nothing;

  if not found then
    return false; -- já registrada
  end if;

  update public.flashcards
  set status = p_status,
      ease = p_ease,
      interval_days = p_interval_days,
      repetitions = p_repetitions,
      lapses = p_lapses,
      due_at = p_due_at,
      last_reviewed_at = p_reviewed_at
  where id = p_card_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Mapas mentais (nós, conexões, posições e estilos em um documento JSONB,
-- salvo atomicamente a cada alteração do editor).
-- ---------------------------------------------------------------------
create table public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  folder text check (folder is null or char_length(folder) <= 120),
  subject_id uuid,
  topic_id uuid,
  data jsonb not null default '{"nodes":[],"edges":[]}'::jsonb
    check (jsonb_typeof(data -> 'nodes') = 'array' and jsonb_typeof(data -> 'edges') = 'array')
    check (octet_length(data::text) <= 5000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index mind_maps_user_idx on public.mind_maps (user_id, updated_at desc);

-- ---------------------------------------------------------------------
-- Gatilhos updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'subjects', 'topics', 'study_materials', 'study_plans', 'study_plan_items',
    'study_cycles', 'study_cycle_items', 'study_sessions', 'study_session_pauses',
    'calendar_tasks', 'reviews', 'study_goals', 'question_records', 'flashcard_decks',
    'flashcards', 'flashcard_reviews', 'mind_maps'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array[
    'subjects', 'topics', 'study_materials', 'study_plans', 'study_plan_items',
    'study_cycles', 'study_cycle_items', 'study_sessions', 'study_session_pauses',
    'calendar_tasks', 'reviews', 'study_goals', 'question_records', 'flashcard_decks',
    'flashcards', 'flashcard_reviews', 'mind_maps'
  ] loop
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

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
revoke all on public.study_session_net from anon;
grant select on public.study_session_net to authenticated;
revoke all on function public.record_flashcard_review(uuid, uuid, smallint, timestamptz, text, numeric, numeric, integer, integer, timestamptz) from public, anon;
grant execute on function public.record_flashcard_review(uuid, uuid, smallint, timestamptz, text, numeric, numeric, integer, integer, timestamptz) to authenticated;
