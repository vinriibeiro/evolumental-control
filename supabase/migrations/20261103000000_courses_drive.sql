-- =====================================================================
-- VLM Control — Cursos e materiais do Google Drive
-- Migração 20261103000000_courses_drive
--
-- Guarda SÓ referências e metadados dos arquivos do Drive (IDs, nomes, tipos, hierarquia, ordem, vínculos)
-- e o progresso do usuário. Nenhum arquivo, blob ou base64 é armazenado aqui: a mídia continua no Drive.
--   * course_sources   -> pastas do Drive cadastradas como fonte (e o resultado da última importação);
--   * course_nodes     -> catálogo: curso → módulos (em qualquer profundidade) → aulas/materiais;
--   * course_progress  -> conclusão e último acesso por arquivo do Drive (sobrevive a reimportações).
-- Mesmas convenções do init: user_id default auth.uid(), FKs compostas (id, user_id), RLS forçado por usuário.
-- =====================================================================

create table public.course_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drive_folder_id text not null check (drive_folder_id ~ '^[A-Za-z0-9_-]{10,128}$'),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  label text check (label is null or char_length(btrim(label)) between 1 and 200),
  config jsonb not null default '{"courseLevel": 1, "excluded": []}'::jsonb check (jsonb_typeof(config) = 'object'),
  last_sync_at timestamptz,
  last_sync_status text not null default 'never' check (last_sync_status in ('never', 'ok', 'partial', 'failed')),
  last_sync_report jsonb check (last_sync_report is null or jsonb_typeof(last_sync_report) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, drive_folder_id)
);

create table public.course_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_id uuid not null,
  parent_id uuid,
  kind text not null check (kind in ('course', 'module', 'item')),
  drive_id text not null check (drive_id ~ '^[A-Za-z0-9_-]{10,128}$'),
  drive_parent_id text check (drive_parent_id is null or drive_parent_id ~ '^[A-Za-z0-9_-]{10,128}$'),
  placement_key text not null check (char_length(placement_key) between 1 and 300),
  title text not null check (char_length(title) between 1 and 500),
  custom_title text check (custom_title is null or char_length(btrim(custom_title)) between 1 and 300),
  mime_type text not null check (char_length(mime_type) between 1 and 200),
  resource_key text check (resource_key is null or resource_key ~ '^[A-Za-z0-9_-]{1,128}$'),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  drive_modified_at timestamptz,
  via_shortcut text check (via_shortcut is null or via_shortcut ~ '^[A-Za-z0-9_-]{10,128}$'),
  sort_order integer not null default 0,
  sort_manual boolean not null default false,
  parent_manual boolean not null default false,
  hidden boolean not null default false,
  status text not null default 'available' check (status in ('available', 'missing', 'excluded')),
  missing_since timestamptz,
  subject_id uuid,
  topic_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, source_id, placement_key),
  check (parent_id is null or parent_id <> id),
  foreign key (source_id, user_id) references public.course_sources (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.course_nodes (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index course_nodes_source_idx on public.course_nodes (user_id, source_id);
create index course_nodes_parent_idx on public.course_nodes (user_id, parent_id);
create index course_nodes_drive_idx on public.course_nodes (user_id, drive_id);

create table public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drive_id text not null check (drive_id ~ '^[A-Za-z0-9_-]{10,128}$'),
  completed_at timestamptz,
  last_opened_at timestamptz,
  last_node_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, drive_id),
  foreign key (last_node_id, user_id) references public.course_nodes (id, user_id) on delete set null (last_node_id)
);
create index course_progress_opened_idx on public.course_progress (user_id, last_opened_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['course_sources', 'course_nodes', 'course_progress'] loop
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

-- "Zerar todos os dados" também zera o progresso nos cursos; o catálogo (fontes e itens) é conteúdo e fica.
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
  delete from public.calendar_tasks where user_id = uid;
  delete from public.study_goals where user_id = uid;
  delete from public.study_plan_items where user_id = uid;
  delete from public.study_plans where user_id = uid;
  delete from public.study_cycle_items where user_id = uid;
  delete from public.study_cycles where user_id = uid;
  delete from public.course_progress where user_id = uid;

  -- o gatilho topics_track_completion limpa completed_at junto com o status
  update public.topics set status = 'not_started', mastery = 0 where user_id = uid;

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;
