-- =====================================================================
-- EVoLuMentaL Control — EvoQuest RPG (Mundo Evolumental)
-- Migração 20261023000100_evoquest_rpg
--
-- Somente aditiva. O progresso de missões e as recompensas passam SEMPRE pela
-- RPC game_complete_step (security definer):
-- * o catálogo (game_quest_steps) define recompensa, ordem e o hash SHA-256 da
--   resposta esperada — e não é legível pelos usuários;
-- * cada etapa exige a anterior, confere o hash e é creditada uma única vez
--   no livro-razão game_rewards (origem quest:<missão>:<etapa>);
-- * game_saves guarda só posição, inventário e escolhas (sem valor de troca).
-- =====================================================================

create table public.game_quest_steps (
  key text primary key check (char_length(key) <= 120),
  quest_id text not null check (char_length(quest_id) <= 60),
  position integer not null check (position >= 0),
  requires text references public.game_quest_steps (key) deferrable initially deferred,
  xp integer not null default 0 check (xp between 0 and 10000),
  coins integer not null default 0 check (coins between 0 and 10000),
  check_hash text check (check_hash is null or check_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.game_quest_steps enable row level security;
revoke all on public.game_quest_steps from anon, authenticated;

create table public.game_quest_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_key text not null references public.game_quest_steps (key),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, step_key)
);

create table public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot text not null default 'main' check (slot ~ '^[a-z0-9_-]{1,20}$'),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, slot)
);

create trigger game_quest_progress_updated_at before update on public.game_quest_progress
  for each row execute function public.set_updated_at();
create trigger game_saves_updated_at before update on public.game_saves
  for each row execute function public.set_updated_at();

-- Progresso: o usuário só LÊ o próprio; escrever, só pela RPC.
alter table public.game_quest_progress enable row level security;
alter table public.game_quest_progress force row level security;
create policy game_quest_progress_select on public.game_quest_progress for select to authenticated using (user_id = auth.uid());
revoke all on public.game_quest_progress from anon;
grant select on public.game_quest_progress to authenticated;

-- Salvamento: CRUD do próprio usuário.
alter table public.game_saves enable row level security;
alter table public.game_saves force row level security;
create policy game_saves_select on public.game_saves for select to authenticated using (user_id = auth.uid());
create policy game_saves_insert on public.game_saves for insert to authenticated with check (user_id = auth.uid());
create policy game_saves_update on public.game_saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy game_saves_delete on public.game_saves for delete to authenticated using (user_id = auth.uid());
revoke all on public.game_saves from anon;
grant select, insert, update, delete on public.game_saves to authenticated;

-- ── RPC: concluir etapa (valida e credita no servidor; idempotente) ──────
create or replace function public.game_complete_step(p_step text, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c public.game_quest_steps;
  v_id uuid;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into c from public.game_quest_steps where key = p_step;
  if not found then
    raise exception 'Etapa desconhecida' using errcode = '22023';
  end if;
  if exists (select 1 from public.game_quest_progress where user_id = uid and step_key = p_step) then
    return jsonb_build_object('applied', false, 'xp', 0, 'coins', 0);
  end if;
  if c.requires is not null and not exists (select 1 from public.game_quest_progress where user_id = uid and step_key = c.requires) then
    raise exception 'Etapa anterior não concluída' using errcode = '22023';
  end if;
  if c.check_hash is not null then
    if p_answer is null or char_length(p_answer) > 20000
       or encode(sha256(convert_to(p_answer, 'UTF8')), 'hex') <> c.check_hash then
      raise exception 'Resposta não confere' using errcode = '22023';
    end if;
  end if;

  insert into public.game_quest_progress (user_id, step_key) values (uid, p_step)
  on conflict (user_id, step_key) do nothing
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('applied', false, 'xp', 0, 'coins', 0);
  end if;

  if c.xp > 0 or c.coins > 0 then
    insert into public.game_rewards (user_id, source, kind, xp, coins)
    values (uid, 'quest:' || p_step, 'mission', c.xp, c.coins)
    on conflict (user_id, source) do nothing;
  end if;
  return jsonb_build_object('applied', true, 'xp', c.xp, 'coins', c.coins);
end;
$$;

-- Zerar dados do jogo passa a incluir progresso e salvamento.
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
end;
$$;

revoke all on function public.game_complete_step(text, text) from public, anon;
grant execute on function public.game_complete_step(text, text) to authenticated;
revoke all on function public.game_wipe_my_data() from public, anon;
grant execute on function public.game_wipe_my_data() to authenticated;

-- ── Catálogo (GERADO a partir de src/features/evoquest/content) ──────────
-- <catalogo>
insert into public.game_quest_steps (key, quest_id, position, requires, xp, coins, check_hash) values
  ('tutorial:talk_iara', 'tutorial', 0, null, 0, 0, null),
  ('tutorial:board', 'tutorial', 1, 'tutorial:talk_iara', 30, 10, 'be3b9f5ae488754dce58547dc501d2fe43abb1343985e493932720b6920feab7'),
  ('tutorial:report', 'tutorial', 2, 'tutorial:board', 0, 0, null),
  ('sql_main:travel', 'sql_main', 0, null, 0, 0, null),
  ('sql_main:talk_maya', 'sql_main', 1, 'sql_main:travel', 0, 0, null),
  ('sql_main:door', 'sql_main', 2, 'sql_main:talk_maya', 40, 5, 'd5b4cd5c0fee70045ce6063f1925e539e210703f1f27ddec2121fbbb8e8df401'),
  ('sql_main:talk_bras', 'sql_main', 3, 'sql_main:door', 0, 0, null),
  ('sql_main:logs', 'sql_main', 4, 'sql_main:talk_bras', 60, 5, '33a7c3e0b423a02f274508878a611f73cc8a7875152dce669f8ecd2607a5cf6d'),
  ('sql_main:who', 'sql_main', 5, 'sql_main:logs', 80, 10, '4f3eff0d16439bb41ddb663f31635abd5b661ea45006ee81829398dfd013131d'),
  ('sql_main:sentinel', 'sql_main', 6, 'sql_main:who', 120, 15, 'b61eb51eb7cfabb4e182bed833f9a8e633068e91fcb75bf63c9214659e2f9adf'),
  ('sql_main:talk_ze', 'sql_main', 7, 'sql_main:sentinel', 0, 0, null),
  ('sql_main:power', 'sql_main', 8, 'sql_main:talk_ze', 50, 5, 'fdb04ccfdd19a99e96a714aa4d61956b91ab49ac553ed1bfc50ca9696471a32d'),
  ('sql_main:boss_logs', 'sql_main', 9, 'sql_main:power', 70, 5, '9df7caba2ae13e97119653f1e84bc6a9e4663e98ed5a397f17ac8f68a9686d16'),
  ('sql_main:boss_join', 'sql_main', 10, 'sql_main:boss_logs', 90, 10, 'd5e95d68d5543aae7c1bb8f5069de2ccd2b443dc14fe6d16445c2d1a31a3965f'),
  ('sql_main:boss_agg', 'sql_main', 11, 'sql_main:boss_join', 110, 10, '2682fee5af69884782c4e84bcd933554c893bc2612dec97f069251a40412f543'),
  ('sql_main:boss_fix', 'sql_main', 12, 'sql_main:boss_agg', 160, 25, '41637736b1d6b40e4ca4eb4a81b735b62168675aed43f580141037d0538ef6de'),
  ('sql_main:finale', 'sql_main', 13, 'sql_main:boss_fix', 100, 40, null),
  ('side_badges:find', 'side_badges', 0, null, 70, 10, 'fcf1ccbe5eceb152ad9d092beb6175a9d69c138b1cfb35027f71c2888353ec12'),
  ('side_badges:report', 'side_badges', 1, 'side_badges:find', 0, 0, null),
  ('side_cafe:find', 'side_cafe', 0, null, 60, 10, 'aa4a1c6d3da290bb6ce724570e5d8586f6776a5a5d1a0afb7bffd7504002743d'),
  ('side_cafe:report', 'side_cafe', 1, 'side_cafe:find', 0, 0, null)
on conflict (key) do update set quest_id = excluded.quest_id, position = excluded.position, requires = excluded.requires, xp = excluded.xp, coins = excluded.coins, check_hash = excluded.check_hash;
-- </catalogo>
