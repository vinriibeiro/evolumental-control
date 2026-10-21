-- =====================================================================
-- EVoLuMentaL Control — zerar dados e excluir conta
-- Migração 20261021120000_reset_and_delete_account
-- =====================================================================

-- Apaga TODOS os dados de estudo do usuário logado e restaura as
-- preferências padrão. A conta (login) continua existindo.
-- security invoker: as políticas RLS continuam valendo, então só é possível
-- apagar as próprias linhas.
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

  -- Ordem pensada para não depender de cascatas entre tabelas.
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

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;

-- Exclui a conta do usuário logado. Todos os dados são removidos em cascata
-- (todas as tabelas referenciam auth.users com ON DELETE CASCADE).
-- security definer é necessário para apagar de auth.users, mas a função só
-- age sobre auth.uid(): ninguém consegue excluir a conta de outra pessoa.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
