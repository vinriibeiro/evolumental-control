-- =====================================================================
-- VLM Knowledge — Meus Cadernos (Fundação relacional + segurança)
-- Migração 20261127000000_vlm_knowledge
--
-- Migração estritamente ADITIVA. Não altera nem remove tabelas históricas.
-- Cria as estruturas do módulo Meus Cadernos:
--   * notebooks                -> cadernos digitais (independentes ou vinculados a matéria)
--   * notebook_nodes           -> árvore hierárquica unificada (section / page) sem limite artificial
--   * notebook_page_contents   -> conteúdo estruturado JSON versionado + texto pesquisável (FTS)
--   * notebook_page_versions   -> histórico de snapshots e restauração
--   * notebook_tags            -> tags globais de conhecimento
--   * notebook_tag_links       -> associação de tags a cadernos e páginas/seções
--   * notebook_page_links      -> links internos entre páginas/blocos e backlinks
--   * notebook_flashcard_links -> vínculos não destrutivos com flashcards existentes (SM-2)
--   * notebook_templates       -> templates personalizados de páginas
--   * notebook_resource_links  -> referências a matérias, tópicos, cursos, PDFs, EPUBs e links
--   * notebook_attachments     -> metadados de anexos privados (bucket privado 'cadernos')
--   * move_notebook_node(...)  -> movimentação transacional de nó/subárvore entre seções e cadernos
--
-- Regras de preservação:
--   * reset_my_data() NÃO apaga cadernos nem anotações escritas pelo usuário.
--   * delete_my_account() remove tudo em cascata via auth.users(id) ON DELETE CASCADE.
--   * Excluir página/caderno mantém flashcards e histórico de revisões (ON DELETE SET NULL).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cadernos
-- ---------------------------------------------------------------------
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  icon text check (icon is null or char_length(icon) <= 40),
  color text not null default '#171717' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  cover text check (
    cover is null or (
      char_length(cover) <= 500
      and (cover ~ '^#[0-9A-Fa-f]{6}$' or cover ~ '^preset:[a-z0-9_-]{1,40}$' or cover ~* '^https?://')
    )
  ),
  is_favorite boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create index notebooks_user_active_idx on public.notebooks (user_id, sort_order, updated_at desc) where deleted_at is null;
create index notebooks_user_subject_idx on public.notebooks (user_id, subject_id) where subject_id is not null;

-- ---------------------------------------------------------------------
-- 2. Nós hierárquicos (seções, subseções, páginas e subpáginas)
-- ---------------------------------------------------------------------
create table public.notebook_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid not null,
  parent_id uuid,
  node_type text not null check (node_type in ('section', 'page')),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  icon text check (icon is null or char_length(icon) <= 40),
  cover text check (
    cover is null or (
      char_length(cover) <= 500
      and (cover ~ '^#[0-9A-Fa-f]{6}$' or cover ~ '^preset:[a-z0-9_-]{1,40}$' or cover ~* '^https?://')
    )
  ),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'ready', 'reviewing', 'reviewed', 'archived')),
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  needs_review boolean not null default false,
  is_favorite boolean not null default false,
  is_pinned boolean not null default false,
  position integer not null default 0,
  subject_id uuid,
  topic_id uuid,
  last_studied_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id),
  unique (id, user_id),
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);
create index notebook_nodes_tree_idx on public.notebook_nodes (user_id, notebook_id, parent_id, position) where deleted_at is null;
create index notebook_nodes_updated_idx on public.notebook_nodes (user_id, updated_at desc) where deleted_at is null;
create index notebook_nodes_studied_idx on public.notebook_nodes (user_id, last_studied_at desc) where deleted_at is null and last_studied_at is not null;
create index notebook_nodes_subject_idx on public.notebook_nodes (user_id, subject_id) where subject_id is not null;
create index notebook_nodes_topic_idx on public.notebook_nodes (user_id, topic_id) where topic_id is not null;

-- Integridade hierárquica: impede pai de outro caderno e impede ciclos em qualquer profundidade.
-- Executa em AFTER INSERT OR UPDATE para permitir atualizações multi-linha atômicas (ex.: move_notebook_node).
create or replace function public.notebook_nodes_validate_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_notebook uuid;
  v_has_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  select notebook_id into v_parent_notebook
    from public.notebook_nodes
   where id = new.parent_id and user_id = new.user_id;

  if v_parent_notebook is null or v_parent_notebook <> new.notebook_id then
    raise exception 'O nó pai precisa pertencer ao mesmo caderno.' using errcode = '23514';
  end if;

  with recursive ancestors as (
    select id, parent_id, 1 as depth
      from public.notebook_nodes
     where id = new.parent_id and user_id = new.user_id
    union all
    select n.id, n.parent_id, a.depth + 1
      from public.notebook_nodes n
      join ancestors a on n.id = a.parent_id
     where n.user_id = new.user_id
       and a.depth < 256
       and n.id <> new.id
  )
  select exists (
    select 1 from ancestors where id = new.id or parent_id = new.id or depth >= 256
  ) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Hierarquia inválida: ciclo detectado em notebook_nodes.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger notebook_nodes_hierarchy_check
  after insert or update of parent_id, notebook_id on public.notebook_nodes
  for each row execute function public.notebook_nodes_validate_hierarchy();

-- ---------------------------------------------------------------------
-- 3. Conteúdo das páginas (separado dos metadados da árvore)
-- ---------------------------------------------------------------------
create table public.notebook_page_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  node_id uuid not null,
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb check (jsonb_typeof(content_json) = 'object'),
  content_schema_version integer not null default 1 check (content_schema_version >= 1),
  content_text text not null default '' check (char_length(content_text) <= 500000),
  word_count integer not null default 0 check (word_count >= 0),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, node_id),
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade
);
create index notebook_page_contents_node_idx on public.notebook_page_contents (user_id, node_id);
create index notebook_page_contents_fts_idx on public.notebook_page_contents using gin (to_tsvector('portuguese', content_text));

-- ---------------------------------------------------------------------
-- 4. Histórico de versões de páginas
-- ---------------------------------------------------------------------
create table public.notebook_page_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  node_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  content_schema_version integer not null default 1 check (content_schema_version >= 1),
  revision integer not null check (revision >= 1),
  reason text not null default 'snapshot' check (reason in ('snapshot', 'manual', 'restore', 'conflict_backup', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade
);
create index notebook_page_versions_node_idx on public.notebook_page_versions (user_id, node_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Tags globais e vínculos
-- ---------------------------------------------------------------------
create table public.notebook_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#525252' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index notebook_tags_user_name_key on public.notebook_tags (user_id, lower(btrim(name)));

create table public.notebook_tag_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tag_id uuid not null,
  notebook_id uuid,
  node_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((notebook_id is not null) <> (node_id is not null)),
  foreign key (tag_id, user_id) references public.notebook_tags (id, user_id) on delete cascade,
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade,
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade
);
create unique index notebook_tag_links_notebook_key on public.notebook_tag_links (user_id, tag_id, notebook_id) where notebook_id is not null;
create unique index notebook_tag_links_node_key on public.notebook_tag_links (user_id, tag_id, node_id) where node_id is not null;
create index notebook_tag_links_node_idx on public.notebook_tag_links (user_id, node_id) where node_id is not null;
create index notebook_tag_links_notebook_idx on public.notebook_tag_links (user_id, notebook_id) where notebook_id is not null;

-- ---------------------------------------------------------------------
-- 6. Links internos entre páginas/blocos (Knowledge Graph & Backlinks)
-- ---------------------------------------------------------------------
create table public.notebook_page_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  source_block_id text check (source_block_id is null or char_length(source_block_id) <= 80),
  target_block_id text check (target_block_id is null or char_length(target_block_id) <= 80),
  link_text text check (link_text is null or char_length(link_text) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_node_id <> target_node_id or target_block_id is not null),
  foreign key (source_node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade,
  foreign key (target_node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade
);
create index notebook_page_links_source_idx on public.notebook_page_links (user_id, source_node_id);
create index notebook_page_links_target_idx on public.notebook_page_links (user_id, target_node_id);

-- ---------------------------------------------------------------------
-- 7. Vínculos com flashcards existentes (sem duplicar SM-2; preserva histórico)
-- ---------------------------------------------------------------------
create table public.notebook_flashcard_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  flashcard_id uuid not null,
  notebook_id uuid,
  node_id uuid,
  block_id text check (block_id is null or char_length(block_id) <= 80),
  source_excerpt text check (source_excerpt is null or char_length(source_excerpt) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, flashcard_id),
  foreign key (flashcard_id, user_id) references public.flashcards (id, user_id) on delete cascade,
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete set null (notebook_id),
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete set null (node_id)
);
create index notebook_flashcard_links_notebook_idx on public.notebook_flashcard_links (user_id, notebook_id) where notebook_id is not null;
create index notebook_flashcard_links_node_idx on public.notebook_flashcard_links (user_id, node_id) where node_id is not null;

-- ---------------------------------------------------------------------
-- 8. Templates personalizados de páginas
-- ---------------------------------------------------------------------
create table public.notebook_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  category text check (category is null or char_length(category) <= 60),
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb check (jsonb_typeof(content_json) = 'object'),
  content_schema_version integer not null default 1 check (content_schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebook_templates_user_idx on public.notebook_templates (user_id, name);

-- ---------------------------------------------------------------------
-- 9. Referências a recursos (matérias, tópicos, cursos, PDFs, EPUBs, links)
-- ---------------------------------------------------------------------
create table public.notebook_resource_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid,
  node_id uuid,
  resource_kind text not null check (
    resource_kind in ('subject', 'topic', 'course_node', 'library_book', 'library_pdf', 'study_material', 'project', 'external_url')
  ),
  resource_id text check (resource_id is null or char_length(resource_id) <= 160),
  label text not null check (char_length(btrim(label)) between 1 and 300),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  location jsonb check (location is null or jsonb_typeof(location) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((notebook_id is not null) <> (node_id is not null)),
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade,
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete cascade
);
create index notebook_resource_links_node_idx on public.notebook_resource_links (user_id, node_id) where node_id is not null;
create index notebook_resource_links_notebook_idx on public.notebook_resource_links (user_id, notebook_id) where notebook_id is not null;
create index notebook_resource_links_target_idx on public.notebook_resource_links (user_id, resource_kind, resource_id) where resource_id is not null;

-- ---------------------------------------------------------------------
-- 10. Anexos privados dos cadernos + bucket privado 'cadernos'
-- ---------------------------------------------------------------------
create table public.notebook_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid not null,
  node_id uuid,
  storage_path text not null check (char_length(storage_path) between 1 and 500 and storage_path !~ '\.\.'),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 300),
  mime_type text not null check (
    mime_type in (
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'
    )
  ),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade,
  foreign key (node_id, user_id) references public.notebook_nodes (id, user_id) on delete set null (node_id)
);
create index notebook_attachments_node_idx on public.notebook_attachments (user_id, node_id) where node_id is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('cadernos', 'cadernos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy cadernos_select on storage.objects for select to authenticated
  using (bucket_id = 'cadernos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cadernos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cadernos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cadernos_update on storage.objects for update to authenticated
  using (bucket_id = 'cadernos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cadernos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cadernos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cadernos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 11. updated_at + RLS + FORCE RLS em todas as novas tabelas
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'notebooks',
    'notebook_nodes',
    'notebook_page_contents',
    'notebook_page_versions',
    'notebook_tags',
    'notebook_tag_links',
    'notebook_page_links',
    'notebook_flashcard_links',
    'notebook_templates',
    'notebook_resource_links',
    'notebook_attachments'
  ] loop
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
-- 12. Movimentação transacional de nó/subárvore entre seções e cadernos
-- ---------------------------------------------------------------------
create or replace function public.move_notebook_node(
  p_node_id uuid,
  p_target_notebook_id uuid,
  p_target_parent_id uuid,
  p_position integer default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_node record;
  v_parent record;
  v_pos integer;
  v_moved integer := 0;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select id, notebook_id, parent_id into v_node
    from public.notebook_nodes
   where id = p_node_id and user_id = uid;

  if not found then
    raise exception 'Nó não encontrado.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.notebooks where id = p_target_notebook_id and user_id = uid
  ) then
    raise exception 'Caderno de destino não encontrado.' using errcode = 'P0002';
  end if;

  if p_target_parent_id is not null then
    if p_target_parent_id = p_node_id then
      raise exception 'Não é possível mover um item para dentro dele mesmo.' using errcode = '23514';
    end if;

    select id, notebook_id into v_parent
      from public.notebook_nodes
     where id = p_target_parent_id and user_id = uid;

    if not found or v_parent.notebook_id <> p_target_notebook_id then
      raise exception 'Nó pai de destino inválido para este caderno.' using errcode = '23514';
    end if;

    -- Verifica se o pai de destino pertence à subárvore do nó movido (evita ciclo).
    if exists (
      with recursive subtree as (
        select id from public.notebook_nodes where id = p_node_id and user_id = uid
        union all
        select n.id
          from public.notebook_nodes n
          join subtree s on n.parent_id = s.id
         where n.user_id = uid
      )
      select 1 from subtree where id = p_target_parent_id
    ) then
      raise exception 'Não é possível mover um item para dentro de um descendente.' using errcode = '23514';
    end if;
  end if;

  if p_position is null then
    select coalesce(max(position), -1) + 1 into v_pos
      from public.notebook_nodes
     where user_id = uid
       and notebook_id = p_target_notebook_id
       and parent_id is not distinct from p_target_parent_id
       and deleted_at is null
       and id <> p_node_id;
  else
    v_pos := greatest(0, p_position);
  end if;

  -- Atualiza toda a subárvore em uma única instrução para preservar invariantes no trigger AFTER.
  with recursive subtree as (
    select id from public.notebook_nodes where id = p_node_id and user_id = uid
    union all
    select n.id
      from public.notebook_nodes n
      join subtree s on n.parent_id = s.id
     where n.user_id = uid
  )
  update public.notebook_nodes n
     set notebook_id = p_target_notebook_id,
         parent_id = case when n.id = p_node_id then p_target_parent_id else n.parent_id end,
         position = case when n.id = p_node_id then v_pos else n.position end
    from subtree s
   where n.id = s.id and n.user_id = uid;

  get diagnostics v_moved = row_count;
  return v_moved;
end;
$$;

revoke all on function public.move_notebook_node(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.move_notebook_node(uuid, uuid, uuid, integer) to authenticated;

-- =====================================================================
-- Nota sobre reset_my_data() e delete_my_account():
--   * reset_my_data() já limpa apenas progresso (sessões, agenda, ciclos,
--     revisões, metas, progresso de cursos e caixa de entrada) e preserva
--     conteúdo autoral do usuário — logo, os cadernos são preservados
--     automaticamente sem precisar alterar reset_my_data().
--   * delete_my_account() apaga auth.users(id), removendo todas as tabelas
--     acima em cascata (ON DELETE CASCADE).
-- =====================================================================
