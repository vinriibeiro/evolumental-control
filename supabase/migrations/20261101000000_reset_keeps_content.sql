-- "Zerar todos os dados" passa a zerar só o PROGRESSO, sem apagar o conteúdo.
-- Apaga: sessões e pausas, revisões de tópicos, cronogramas, ciclos, tarefas do calendário e metas;
--        zera o progresso dos tópicos (status, domínio) e volta as preferências ao padrão.
-- Mantém: matérias e tópicos (a estrutura onde ficam os vídeos e os áudios), materiais e links (vídeos),
--         baralhos e flashcards (com o histórico deles), mapas mentais, registros de questões,
--         livros e áudios (tabelas e arquivos).
-- Antes, a função apagava matérias e tópicos, o que levava junto, em cascata, os materiais e os áudios.
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

  -- o gatilho topics_track_completion limpa completed_at junto com o status
  update public.topics set status = 'not_started', mastery = 0 where user_id = uid;

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;
