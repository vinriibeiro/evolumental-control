-- =====================================================================
-- EVoLuMentaL Control — Biblioteca (leitor de EPUB)
-- Migração 20261031000000_library
--
-- Guarda, de forma PRIVADA, os livros EPUB de cada usuário para que apareçam
-- em qualquer aparelho em que ele entrar:
--   * public.library_books  -> metadados, posição de leitura e marcadores;
--   * bucket de armazenamento 'livros' (privado) -> arquivo do livro e a capa,
--     sempre em  <user_id>/<id>.epub  e  <user_id>/<id>.cover .
-- Só o dono (auth.uid()) enxerga, grava ou apaga os próprios itens.
-- O limite por arquivo do plano gratuito do Supabase (50 MB) vale para o bucket.
-- =====================================================================

create table public.library_books (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- impressão digital do conteúdo (SHA-256 truncado); evita o mesmo livro duas vezes
  id text not null check (id ~ '^[0-9a-z-]{1,64}$'),
  title text not null check (char_length(title) between 1 and 500),
  author text not null default '' check (char_length(author) <= 500),
  file_name text not null check (char_length(file_name) between 1 and 500),
  size bigint not null check (size >= 0),
  cover_type text check (cover_type is null or char_length(cover_type) <= 100),
  has_cover boolean not null default false,
  weights jsonb check (weights is null or jsonb_typeof(weights) = 'array'),
  bookmarks jsonb not null default '[]'::jsonb check (jsonb_typeof(bookmarks) = 'array'),
  location text check (location is null or char_length(location) <= 2000),
  progress smallint not null default 0 check (progress between 0 and 100),
  added_at timestamptz not null default now(),
  last_read_at timestamptz,
  -- hora (do aparelho) da última mudança de posição/marcadores: vence a mais recente
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.library_books enable row level security;
alter table public.library_books force row level security;
create policy library_books_select on public.library_books for select to authenticated using (user_id = auth.uid());
create policy library_books_insert on public.library_books for insert to authenticated with check (user_id = auth.uid());
create policy library_books_update on public.library_books for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy library_books_delete on public.library_books for delete to authenticated using (user_id = auth.uid());
revoke all on public.library_books from anon;
grant select, insert, update, delete on public.library_books to authenticated;

-- Bucket privado (nunca público). 52428800 bytes = 50 MiB, o teto do plano gratuito.
insert into storage.buckets (id, name, public, file_size_limit)
values ('livros', 'livros', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy livros_select on storage.objects for select to authenticated
  using (bucket_id = 'livros' and (storage.foldername(name))[1] = auth.uid()::text);
create policy livros_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'livros' and (storage.foldername(name))[1] = auth.uid()::text);
create policy livros_update on storage.objects for update to authenticated
  using (bucket_id = 'livros' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'livros' and (storage.foldername(name))[1] = auth.uid()::text);
create policy livros_delete on storage.objects for delete to authenticated
  using (bucket_id = 'livros' and (storage.foldername(name))[1] = auth.uid()::text);
