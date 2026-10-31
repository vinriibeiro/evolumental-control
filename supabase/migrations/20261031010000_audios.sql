-- =====================================================================
-- EVoLuMentaL Control — Áudios dos tópicos (aulas em mp3)
-- Migração 20261031010000_audios
--
-- Guarda, de forma PRIVADA, os áudios que o usuário anexa a um tópico (por
-- exemplo, as faixas de uma lição de inglês) para tocarem em qualquer aparelho:
--   * public.topic_audios -> metadados de cada faixa, ligadas ao tópico;
--   * bucket de armazenamento 'audios' (privado) -> o arquivo, sempre em
--     <user_id>/<id>.mp3 .
-- Só o dono (auth.uid()) enxerga, grava ou apaga os próprios itens.
-- Limite por arquivo do plano gratuito do Supabase: 50 MB.
-- Atenção: apagar um tópico apaga os metadados das faixas (cascata), mas os
-- arquivos no bucket só saem pelo app ou pelo painel de Storage.
-- =====================================================================

create table public.topic_audios (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- impressão digital do conteúdo (SHA-256 truncado)
  id text not null check (id ~ '^[0-9a-z-]{1,64}$'),
  topic_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 300),
  file_name text not null check (char_length(file_name) between 1 and 500),
  size bigint not null check (size >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);
create index topic_audios_topic_idx on public.topic_audios (user_id, topic_id, sort_order);

alter table public.topic_audios enable row level security;
alter table public.topic_audios force row level security;
create policy topic_audios_select on public.topic_audios for select to authenticated using (user_id = auth.uid());
create policy topic_audios_insert on public.topic_audios for insert to authenticated with check (user_id = auth.uid());
create policy topic_audios_update on public.topic_audios for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy topic_audios_delete on public.topic_audios for delete to authenticated using (user_id = auth.uid());
revoke all on public.topic_audios from anon;
grant select, insert, update, delete on public.topic_audios to authenticated;

-- Bucket privado (nunca público). 52428800 bytes = 50 MiB, o teto do plano gratuito.
insert into storage.buckets (id, name, public, file_size_limit)
values ('audios', 'audios', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy audios_select on storage.objects for select to authenticated
  using (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
create policy audios_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
create policy audios_update on storage.objects for update to authenticated
  using (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
create policy audios_delete on storage.objects for delete to authenticated
  using (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
