-- =====================================================================
-- EVoLuMentaL Control — Explorador de Estudos
-- Migração 20261023000000_explorer
--
-- Somente aditiva: nenhuma coluna ou linha existente é removida.
-- * study_folders: áreas de estudo e pastas (profundidade livre) acima das matérias.
-- * subjects.folder_id / favorite; topics.kind / favorite.
-- * Gatilhos que impedem ciclos em pastas e tópicos.
-- Excluir uma pasta exclui as subpastas; as matérias de dentro voltam para a
-- raiz (folder_id = null), preservando todo o histórico.
-- =====================================================================

create table public.study_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid,
  kind text not null default 'folder' check (kind in ('area', 'folder')),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text check (icon is null or char_length(icon) <= 40),
  sort_order integer not null default 0,
  favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (parent_id is null or parent_id <> id),
  check (kind = 'folder' or parent_id is null),
  foreign key (parent_id, user_id) references public.study_folders (id, user_id) on delete cascade
);
create index study_folders_user_idx on public.study_folders (user_id, parent_id, sort_order);

alter table public.subjects
  add column folder_id uuid,
  add column favorite boolean not null default false,
  add foreign key (folder_id, user_id) references public.study_folders (id, user_id) on delete set null (folder_id);
create index subjects_folder_idx on public.subjects (user_id, folder_id, sort_order);

alter table public.topics
  add column kind text not null default 'topic' check (kind in ('topic', 'folder')),
  add column favorite boolean not null default false;

-- ── Anti-ciclo ───────────────────────────────────────────────────────────
-- Recusa um parent_id que seja o próprio nó ou um de seus descendentes.
create or replace function public.study_folders_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select f.id, f.parent_id, 1 as depth from public.study_folders f where f.id = new.parent_id
      union all
      select f.id, f.parent_id, up.depth + 1 from public.study_folders f join up on f.id = up.parent_id where up.depth < 1000
    )
    select 1 from up where up.id = new.id
  ) then
    raise exception 'Não é possível mover uma pasta para dentro dela mesma.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger study_folders_no_cycle
  before insert or update of parent_id on public.study_folders
  for each row execute function public.study_folders_no_cycle();

create or replace function public.topics_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select t.id, t.parent_id, 1 as depth from public.topics t where t.id = new.parent_id
      union all
      select t.id, t.parent_id, up.depth + 1 from public.topics t join up on t.id = up.parent_id where up.depth < 1000
    )
    select 1 from up where up.id = new.id
  ) then
    raise exception 'Não é possível mover um tópico para dentro dele mesmo.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger topics_no_cycle
  before update of parent_id on public.topics
  for each row execute function public.topics_no_cycle();

-- ── updated_at + RLS (mesmo padrão das demais tabelas) ───────────────────
create trigger study_folders_updated_at before update on public.study_folders
  for each row execute function public.set_updated_at();

alter table public.study_folders enable row level security;
alter table public.study_folders force row level security;
create policy study_folders_select on public.study_folders for select to authenticated using (user_id = auth.uid());
create policy study_folders_insert on public.study_folders for insert to authenticated with check (user_id = auth.uid());
create policy study_folders_update on public.study_folders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy study_folders_delete on public.study_folders for delete to authenticated using (user_id = auth.uid());
revoke all on public.study_folders from anon;
grant select, insert, update, delete on public.study_folders to authenticated;

-- ── Zerar dados passa a incluir as pastas ────────────────────────────────
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

  perform public.game_wipe_my_data();

  delete from public.study_session_pauses where user_id = uid;
  delete from public.reviews where user_id = uid;
  delete from public.study_sessions where user_id = uid;
  delete from public.flashcard_reviews where user_id = uid;
  delete from public.flashcards where user_id = uid;
  delete from public.flashcard_decks where user_id = uid;
  delete from public.mind_maps where user_id = uid;
  delete from public.question_records where user_id = uid;
  delete from public.calendar_tasks where user_id = uid;
  delete from public.study_goals where user_id = uid;
  delete from public.study_plan_items where user_id = uid;
  delete from public.study_plans where user_id = uid;
  delete from public.study_cycle_items where user_id = uid;
  delete from public.study_cycles where user_id = uid;
  delete from public.study_materials where user_id = uid;
  delete from public.topics where user_id = uid;
  delete from public.subjects where user_id = uid;
  delete from public.study_folders where user_id = uid;

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;
