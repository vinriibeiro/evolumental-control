-- =====================================================================
-- EVoLuMentaL Control — EvoQuest: evidências de aprendizagem
-- Migração 20261027000000_evoquest_evidencias
--
-- Somente aditiva. Separa DOMÍNIO de XP:
-- * XP, moedas e progresso narrativo continuam em game_complete_step /
--   game_rewards (uma vez por etapa, catálogo do servidor).
-- * game_evidence guarda COMO o jogador resolveu cada atividade do mundo:
--   estágio (guiada, independente, transferência, chefe), nível de ajuda
--   (0 = sozinho … 4 = explicação completa) e tentativas. O domínio do
--   Control lê estas linhas; XP não lê.
-- * Gravação só pela RPC game_record_evidence (security definer):
--   estágio e conceito vêm do catálogo (não do cliente), a resposta é
--   conferida pelo hash nas atividades fixas, a operação é idempotente pelo id
--   gerado no cliente e há limite diário por atividade (anti-spam).
-- * Atividades parametrizadas (revisão de campo com dados gerados por
--   semente) não têm gabarito fixo no servidor: ficam marcadas e limitadas.
-- =====================================================================

create table public.game_activities (
  id text primary key check (char_length(id) <= 80),
  subject text not null check (char_length(subject) <= 40),
  concept text not null check (char_length(concept) <= 60),
  stage text not null check (stage in ('guided', 'independent', 'transfer', 'boss')),
  check_hash text check (check_hash is null or check_hash ~ '^[0-9a-f]{64}$'),
  parametric boolean not null default false,
  daily_limit integer not null default 20 check (daily_limit between 1 and 200),
  updated_at timestamptz not null default now()
);
-- Catálogo (com gabaritos): RLS ligado e nenhuma política — só as RPCs leem.
alter table public.game_activities enable row level security;
revoke all on public.game_activities from anon, authenticated;

create table public.game_evidence (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id text not null references public.game_activities (id),
  subject text not null,
  concept text not null,
  stage text not null check (stage in ('guided', 'independent', 'transfer', 'boss')),
  help_level smallint not null check (help_level between 0 and 4),
  attempts smallint not null check (attempts between 0 and 1000),
  solved boolean not null,
  seed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_evidence_user_idx on public.game_evidence (user_id, created_at desc);
create index game_evidence_activity_idx on public.game_evidence (user_id, activity_id, created_at desc);
create trigger game_evidence_updated_at before update on public.game_evidence
  for each row execute function public.set_updated_at();

-- O usuário só LÊ as próprias evidências; escrever, só pela RPC.
alter table public.game_evidence enable row level security;
alter table public.game_evidence force row level security;
create policy game_evidence_select on public.game_evidence for select to authenticated using (user_id = auth.uid());
revoke all on public.game_evidence from anon;
grant select on public.game_evidence to authenticated;

create or replace function public.game_record_evidence(
  p_id uuid, p_activity text, p_help smallint, p_attempts smallint, p_solved boolean, p_seed integer, p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a public.game_activities;
  v_today integer;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into a from public.game_activities where id = p_activity;
  if not found then
    raise exception 'Atividade desconhecida' using errcode = '22023';
  end if;
  if exists (select 1 from public.game_evidence where id = p_id) then
    return jsonb_build_object('applied', false);
  end if;
  if p_help is null or p_help < 0 or p_help > 4 or p_attempts is null or p_attempts < 0 or p_attempts > 1000 then
    raise exception 'Dados de evidência inválidos' using errcode = '22023';
  end if;
  if a.parametric and p_seed is null then
    raise exception 'Atividade parametrizada exige a semente' using errcode = '22023';
  end if;
  -- Resolvido: nas atividades fixas, a resposta precisa conferir com o gabarito.
  if p_solved and not a.parametric and a.check_hash is not null then
    if p_answer is null or char_length(p_answer) > 20000
       or encode(sha256(convert_to(p_answer, 'UTF8')), 'hex') <> a.check_hash then
      raise exception 'Resposta não confere' using errcode = '22023';
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(uid::text || p_activity));
  select count(*) into v_today from public.game_evidence
   where user_id = uid and activity_id = p_activity and created_at > now() - interval '1 day';
  if v_today >= a.daily_limit then
    raise exception 'Limite diário de registros desta atividade atingido' using errcode = '22023';
  end if;
  insert into public.game_evidence (id, user_id, activity_id, subject, concept, stage, help_level, attempts, solved, seed)
  values (p_id, uid, p_activity, a.subject, a.concept, a.stage, p_help, p_attempts, p_solved, p_seed);
  return jsonb_build_object('applied', true);
end;
$$;

revoke all on function public.game_record_evidence(uuid, text, smallint, smallint, boolean, integer, text) from public, anon;
grant execute on function public.game_record_evidence(uuid, text, smallint, smallint, boolean, integer, text) to authenticated;

-- "Zerar dados do jogo" passa a incluir as evidências.
create or replace function public.game_wipe_my_data()
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
  delete from public.game_answers where user_id = uid;
  delete from public.game_sessions where user_id = uid;
  delete from public.game_rewards where user_id = uid;
  delete from public.game_purchases where user_id = uid;
  delete from public.game_quest_progress where user_id = uid;
  delete from public.game_saves where user_id = uid;
  delete from public.game_evidence where user_id = uid;
end;
$$;

-- ── Catálogo (GERADO a partir de src/features/evoquest/content) ──────────
-- <catalogo>
insert into public.game_quest_steps (key, quest_id, position, requires, xp, coins, check_hash, require_answer) values
  ('tutorial:talk_iara', 'tutorial', 0, null, 0, 0, null, null),
  ('tutorial:board', 'tutorial', 1, 'tutorial:talk_iara', 0, 0, null, null),
  ('tutorial:report', 'tutorial', 2, 'tutorial:board', 0, 0, null, null),
  ('tutorial:trip', 'tutorial', 3, 'tutorial:report', 0, 0, null, null),
  ('side_board:query', 'side_board', 0, null, 30, 10, 'be3b9f5ae488754dce58547dc501d2fe43abb1343985e493932720b6920feab7', null),
  ('sql_main:travel', 'sql_main', 0, null, 0, 0, null, null),
  ('sql_main:talk_maya', 'sql_main', 1, 'sql_main:travel', 0, 0, null, null),
  ('sql_main:door', 'sql_main', 2, 'sql_main:talk_maya', 40, 5, 'd5b4cd5c0fee70045ce6063f1925e539e210703f1f27ddec2121fbbb8e8df401', null),
  ('sql_main:talk_bras', 'sql_main', 3, 'sql_main:door', 0, 0, null, null),
  ('sql_main:logs', 'sql_main', 4, 'sql_main:talk_bras', 60, 5, '33a7c3e0b423a02f274508878a611f73cc8a7875152dce669f8ecd2607a5cf6d', null),
  ('sql_main:who', 'sql_main', 5, 'sql_main:logs', 80, 10, '4f3eff0d16439bb41ddb663f31635abd5b661ea45006ee81829398dfd013131d', null),
  ('sql_main:sentinel', 'sql_main', 6, 'sql_main:who', 120, 15, 'b61eb51eb7cfabb4e182bed833f9a8e633068e91fcb75bf63c9214659e2f9adf', null),
  ('sql_main:talk_ze', 'sql_main', 7, 'sql_main:sentinel', 0, 0, null, null),
  ('sql_main:power', 'sql_main', 8, 'sql_main:talk_ze', 50, 5, 'fdb04ccfdd19a99e96a714aa4d61956b91ab49ac553ed1bfc50ca9696471a32d', null),
  ('sql_main:boss_logs', 'sql_main', 9, 'sql_main:power', 70, 5, '9df7caba2ae13e97119653f1e84bc6a9e4663e98ed5a397f17ac8f68a9686d16', null),
  ('sql_main:boss_join', 'sql_main', 10, 'sql_main:boss_logs', 90, 10, 'd5e95d68d5543aae7c1bb8f5069de2ccd2b443dc14fe6d16445c2d1a31a3965f', null),
  ('sql_main:boss_agg', 'sql_main', 11, 'sql_main:boss_join', 110, 10, '2682fee5af69884782c4e84bcd933554c893bc2612dec97f069251a40412f543', null),
  ('sql_main:boss_fix', 'sql_main', 12, 'sql_main:boss_agg', 160, 25, '41637736b1d6b40e4ca4eb4a81b735b62168675aed43f580141037d0538ef6de', null),
  ('sql_main:finale', 'sql_main', 13, 'sql_main:boss_fix', 100, 40, null, null),
  ('side_badges:find', 'side_badges', 0, null, 70, 10, 'fcf1ccbe5eceb152ad9d092beb6175a9d69c138b1cfb35027f71c2888353ec12', null),
  ('side_badges:report', 'side_badges', 1, 'side_badges:find', 0, 0, null, null),
  ('side_cafe:find', 'side_cafe', 0, null, 60, 10, 'aa4a1c6d3da290bb6ce724570e5d8586f6776a5a5d1a0afb7bffd7504002743d', null),
  ('side_cafe:report', 'side_cafe', 1, 'side_cafe:find', 0, 0, null, null),
  ('sql_supply:talk', 'sql_supply', 0, null, 0, 0, null, null),
  ('sql_supply:guided', 'sql_supply', 1, 'sql_supply:talk', 20, 5, '0f9c8612088116a298e62c1151e9393c8efb872df5a5101f99a88e9953aa1d6b', null),
  ('sql_supply:independent', 'sql_supply', 2, 'sql_supply:guided', 40, 10, '8cf8aafb21bc9f5a4c2fa5ae91512974c15aeee386fb54a2440e596db99563e9', null),
  ('sql_supply:drone', 'sql_supply', 3, 'sql_supply:independent', 60, 10, 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35', null),
  ('sql_supply:transfer', 'sql_supply', 4, 'sql_supply:drone', 100, 25, '4f51ff64efa995039a9477b9b1d11c25e74c3066952f2e511b158dde5b279d1f', null),
  ('sql_supply:debrief', 'sql_supply', 5, 'sql_supply:transfer', 0, 0, null, null),
  ('city_lab_aurora:arrive', 'city_lab_aurora', 0, null, 0, 0, null, null),
  ('city_lab_aurora:mentor', 'city_lab_aurora', 1, 'city_lab_aurora:arrive', 0, 0, null, null),
  ('city_lab_aurora:unit_1', 'city_lab_aurora', 2, 'city_lab_aurora:mentor', 60, 25, null, 'python.u1.boss'),
  ('city_lab_aurora:unit_2', 'city_lab_aurora', 3, 'city_lab_aurora:unit_1', 60, 25, null, 'python.u2.boss'),
  ('city_lab_aurora:unit_3', 'city_lab_aurora', 4, 'city_lab_aurora:unit_2', 60, 25, null, 'python.u3.boss'),
  ('city_lab_aurora:finale', 'city_lab_aurora', 5, 'city_lab_aurora:unit_3', 100, 35, null, null),
  ('city_language_tower:arrive', 'city_language_tower', 0, null, 0, 0, null, null),
  ('city_language_tower:mentor', 'city_language_tower', 1, 'city_language_tower:arrive', 0, 0, null, null),
  ('city_language_tower:unit_1', 'city_language_tower', 2, 'city_language_tower:mentor', 60, 25, null, 'ingles.u1.boss'),
  ('city_language_tower:unit_2', 'city_language_tower', 3, 'city_language_tower:unit_1', 60, 25, null, 'ingles.u2.boss'),
  ('city_language_tower:unit_3', 'city_language_tower', 4, 'city_language_tower:unit_2', 60, 25, null, 'ingles.u3.boss'),
  ('city_language_tower:finale', 'city_language_tower', 5, 'city_language_tower:unit_3', 100, 35, null, null),
  ('city_logic_temple:arrive', 'city_logic_temple', 0, null, 0, 0, null, null),
  ('city_logic_temple:mentor', 'city_logic_temple', 1, 'city_logic_temple:arrive', 0, 0, null, null),
  ('city_logic_temple:unit_1', 'city_logic_temple', 2, 'city_logic_temple:mentor', 60, 25, null, 'logica.u1.boss'),
  ('city_logic_temple:unit_2', 'city_logic_temple', 3, 'city_logic_temple:unit_1', 60, 25, null, 'logica.u2.boss'),
  ('city_logic_temple:unit_3', 'city_logic_temple', 4, 'city_logic_temple:unit_2', 60, 25, null, 'logica.u3.boss'),
  ('city_logic_temple:finale', 'city_logic_temple', 5, 'city_logic_temple:unit_3', 100, 35, null, null),
  ('city_observatory:arrive', 'city_observatory', 0, null, 0, 0, null, null),
  ('city_observatory:mentor', 'city_observatory', 1, 'city_observatory:arrive', 0, 0, null, null),
  ('city_observatory:unit_1', 'city_observatory', 2, 'city_observatory:mentor', 60, 25, null, 'estatistica.u1.boss'),
  ('city_observatory:unit_2', 'city_observatory', 3, 'city_observatory:unit_1', 60, 25, null, 'estatistica.u2.boss'),
  ('city_observatory:unit_3', 'city_observatory', 4, 'city_observatory:unit_2', 60, 25, null, 'estatistica.u3.boss'),
  ('city_observatory:finale', 'city_observatory', 5, 'city_observatory:unit_3', 100, 35, null, null),
  ('city_archive:arrive', 'city_archive', 0, null, 0, 0, null, null),
  ('city_archive:mentor', 'city_archive', 1, 'city_archive:arrive', 0, 0, null, null),
  ('city_archive:unit_1', 'city_archive', 2, 'city_archive:mentor', 60, 25, null, 'portugues.u1.boss'),
  ('city_archive:unit_2', 'city_archive', 3, 'city_archive:unit_1', 60, 25, null, 'portugues.u2.boss'),
  ('city_archive:unit_3', 'city_archive', 4, 'city_archive:unit_2', 60, 25, null, 'portugues.u3.boss'),
  ('city_archive:finale', 'city_archive', 5, 'city_archive:unit_3', 100, 35, null, null),
  ('city_command_tower:arrive', 'city_command_tower', 0, null, 0, 0, null, null),
  ('city_command_tower:mentor', 'city_command_tower', 1, 'city_command_tower:arrive', 0, 0, null, null),
  ('city_command_tower:unit_1', 'city_command_tower', 2, 'city_command_tower:mentor', 60, 25, null, 'dax.u1.boss'),
  ('city_command_tower:unit_2', 'city_command_tower', 3, 'city_command_tower:unit_1', 60, 25, null, 'dax.u2.boss'),
  ('city_command_tower:unit_3', 'city_command_tower', 4, 'city_command_tower:unit_2', 60, 25, null, 'dax.u3.boss'),
  ('city_command_tower:finale', 'city_command_tower', 5, 'city_command_tower:unit_3', 100, 35, null, null),
  ('city_refinery:arrive', 'city_refinery', 0, null, 0, 0, null, null),
  ('city_refinery:mentor', 'city_refinery', 1, 'city_refinery:arrive', 0, 0, null, null),
  ('city_refinery:unit_1', 'city_refinery', 2, 'city_refinery:mentor', 60, 25, null, 'm.u1.boss'),
  ('city_refinery:unit_2', 'city_refinery', 3, 'city_refinery:unit_1', 60, 25, null, 'm.u2.boss'),
  ('city_refinery:unit_3', 'city_refinery', 4, 'city_refinery:unit_2', 60, 25, null, 'm.u3.boss'),
  ('city_refinery:finale', 'city_refinery', 5, 'city_refinery:unit_3', 100, 35, null, null)
on conflict (key) do update set quest_id = excluded.quest_id, position = excluded.position, requires = excluded.requires, xp = excluded.xp, coins = excluded.coins, check_hash = excluded.check_hash, require_answer = excluded.require_answer;

insert into public.game_shop_items (id, kind, name, price) values
  ('ticket_data_city', 'ticket', 'Passagem para Cidade dos Dados', 80),
  ('ticket_lab_aurora', 'ticket', 'Passagem para Aurora', 80),
  ('ticket_language_tower', 'ticket', 'Passagem para Babel', 80),
  ('ticket_logic_temple', 'ticket', 'Passagem para Silogia', 80),
  ('ticket_observatory', 'ticket', 'Passagem para Gaussópolis', 80),
  ('ticket_archive', 'ticket', 'Passagem para Vernácula', 80),
  ('ticket_command_tower', 'ticket', 'Passagem para Medida Certa', 80),
  ('ticket_refinery', 'ticket', 'Passagem para Pipeline', 80)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, price = excluded.price;

insert into public.game_activities (id, subject, concept, stage, check_hash, parametric, daily_limit) values
  ('sup_guided', 'sql', 'groupby', 'guided', '0f9c8612088116a298e62c1151e9393c8efb872df5a5101f99a88e9953aa1d6b', false, 20),
  ('sup_independent', 'sql', 'groupby', 'independent', '8cf8aafb21bc9f5a4c2fa5ae91512974c15aeee386fb54a2440e596db99563e9', false, 20),
  ('sup_drone', 'sql', 'groupby', 'independent', 'a896e7b9c817a15756814b476641b3e3a028de6320662f12f984bf3c8ec27d84', false, 20),
  ('sup_transfer', 'sql', 'groupby', 'transfer', '4f51ff64efa995039a9477b9b1d11c25e74c3066952f2e511b158dde5b279d1f', false, 20),
  ('field_groupby', 'sql', 'groupby', 'independent', null, true, 5)
on conflict (id) do update set subject = excluded.subject, concept = excluded.concept, stage = excluded.stage, check_hash = excluded.check_hash, parametric = excluded.parametric, daily_limit = excluded.daily_limit, updated_at = now();
-- </catalogo>
