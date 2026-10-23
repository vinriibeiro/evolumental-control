-- =====================================================================
-- EVoLuMentaL Control — Caderno de erros
-- Migração 20261026000000_caderno_de_erros
--
-- Somente aditiva. Cada registro de questões pode ter os erros classificados
-- por motivo (com quantidade, observação e "resolvido"). Matéria, tópico,
-- data, banca e concurso vêm do registro (não são duplicados aqui).
-- * FK composta (record_id, user_id): impossível ligar a registro de outro usuário.
-- * A soma das quantidades de um registro nunca passa do número de erros dele
--   (gatilhos nas duas tabelas). O modo local reproduz a mesma regra.
-- * Excluir o registro exclui a classificação (cascata).
-- =====================================================================

alter table public.question_records add constraint question_records_id_user_key unique (id, user_id);

create table public.question_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  record_id uuid not null,
  reason text not null check (reason in ('nao_sabia', 'esqueci', 'interpretacao', 'distracao', 'calculo', 'confundiu', 'chute', 'outro')),
  count integer not null default 1 check (count between 1 and 100000),
  note text check (note is null or char_length(note) <= 2000),
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (record_id, user_id) references public.question_records (id, user_id) on delete cascade
);
create index question_errors_record_idx on public.question_errors (user_id, record_id);
create index question_errors_reason_idx on public.question_errors (user_id, reason);

create trigger question_errors_updated_at before update on public.question_errors
  for each row execute function public.set_updated_at();

-- Soma das quantidades ≤ erros do registro.
create or replace function public.question_errors_check_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_wrong integer;
  v_sum integer;
begin
  select wrong into v_wrong from public.question_records where id = new.record_id and user_id = new.user_id;
  select coalesce(sum(count), 0) into v_sum from public.question_errors where record_id = new.record_id and id <> new.id;
  if v_sum + new.count > coalesce(v_wrong, 0) then
    raise exception 'Os erros classificados (%) passam do total de erros do registro (%).', v_sum + new.count, coalesce(v_wrong, 0) using errcode = '23514';
  end if;
  if new.resolved and new.resolved_at is null then new.resolved_at := now(); end if;
  if not new.resolved then new.resolved_at := null; end if;
  return new;
end;
$$;

create trigger question_errors_total before insert or update on public.question_errors
  for each row execute function public.question_errors_check_total();

create or replace function public.question_records_check_errors()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sum integer;
begin
  select coalesce(sum(count), 0) into v_sum from public.question_errors where record_id = new.id;
  if new.wrong < v_sum then
    raise exception 'Este registro tem % erro(s) classificados; reduza a classificação antes de diminuir os erros.', v_sum using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger question_records_errors before update of wrong on public.question_records
  for each row execute function public.question_records_check_errors();

alter table public.question_errors enable row level security;
alter table public.question_errors force row level security;
create policy question_errors_select on public.question_errors for select to authenticated using (user_id = auth.uid());
create policy question_errors_insert on public.question_errors for insert to authenticated with check (user_id = auth.uid());
create policy question_errors_update on public.question_errors for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy question_errors_delete on public.question_errors for delete to authenticated using (user_id = auth.uid());
revoke all on public.question_errors from anon;
grant select, insert, update, delete on public.question_errors to authenticated;
