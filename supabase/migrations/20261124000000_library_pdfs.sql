-- Os arquivos usam o bucket privado "livros" e suas políticas por pasta do usuário.
create table public.library_pdfs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[0-9a-f]{64}$'),
  revision uuid not null,
  file_key uuid not null,
  book jsonb check (
    book is null or (jsonb_typeof(book) = 'object' and book ? 'id' and book->>'id' = id)
  ),
  primary key (user_id, id)
);

-- book = null preserva a exclusão quando outro aparelho volta a ficar online.
alter table public.library_pdfs enable row level security;
alter table public.library_pdfs force row level security;
create policy library_pdfs_select on public.library_pdfs for select to authenticated using (user_id = auth.uid());
create policy library_pdfs_insert on public.library_pdfs for insert to authenticated with check (user_id = auth.uid());
create policy library_pdfs_update on public.library_pdfs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.library_pdfs from anon, authenticated;
grant select, insert, update on public.library_pdfs to authenticated;
