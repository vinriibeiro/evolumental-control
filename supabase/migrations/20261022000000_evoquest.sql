-- =====================================================================
-- EVoLuMentaL Control — EvoQuest (aprendizagem gamificada)
-- Migração 20261022000000_evoquest
--
-- Princípios:
--   * XP, moedas, missões, conquistas e compras são calculados AQUI, no
--     servidor. O cliente só lê suas linhas (RLS somente leitura) e chama RPCs.
--   * Toda concessão é idempotente: respostas têm id gerado pelo cliente e o
--     livro-razão game_rewards é único por (usuário, origem). Recarregar a
--     página ou reenviar a requisição nunca duplica recompensas.
--   * O catálogo global (desafios, regras de recompensa e loja) não tem
--     nenhuma política de escrita: só migrações (papel do dono) o alteram.
--   * A fórmula de XP (game_xp_for) espelha src/game/engine/rules.ts; o teste
--     supabase/tests/evoquest.test.ts compara as duas.
-- =====================================================================

-- ── Catálogo global (preenchido por 20261022000100_evoquest_catalog.sql) ──
create table public.game_challenge_catalog (
  id text primary key check (char_length(id) <= 80),
  subject_id text not null,
  unit_id text not null,
  type text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  version integer not null default 1,
  boss boolean not null default false,
  -- Gabarito dos tipos objetivos (escolha, V/F, erro, numérico). O servidor
  -- recorrige a resposta com ele; os demais tipos usam a correção do cliente.
  answer_key jsonb,
  updated_at timestamptz not null default now()
);
create index game_catalog_subject_idx on public.game_challenge_catalog (subject_id);

create table public.game_reward_rules (
  key text primary key,
  kind text not null check (kind in ('daily', 'weekly', 'achievement')),
  metric text not null,
  target integer not null check (target > 0),
  xp integer not null check (xp >= 0),
  coins integer not null check (coins >= 0),
  param boolean not null default false
);

create table public.game_shop_items (
  id text primary key,
  kind text not null check (kind in ('avatar', 'title')),
  name text not null,
  price integer not null check (price > 0)
);

-- RLS ligado e nenhuma política: usuários comuns não leem nem escrevem o
-- catálogo diretamente (o gabarito fica protegido); as RPCs abaixo são
-- security definer e o consultam.
alter table public.game_challenge_catalog enable row level security;
alter table public.game_reward_rules enable row level security;
alter table public.game_shop_items enable row level security;
revoke all on public.game_challenge_catalog, public.game_reward_rules, public.game_shop_items from anon, authenticated;

-- ── Dados do jogador ──────────────────────────────────────────────────────
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id text not null check (char_length(subject_id) <= 40),
  unit_id text check (unit_id is null or char_length(unit_id) <= 60),
  mode text not null check (mode in ('quick', 'trail', 'review', 'time_attack', 'boss', 'lab', 'cards')),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  queue text[] not null default '{}' check (cardinality(queue) <= 200),
  planned_seconds integer check (planned_seconds is null or planned_seconds between 30 and 14400),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  answered integer not null default 0,
  correct integer not null default 0,
  xp integer not null default 0,
  coins integer not null default 0,
  combo integer not null default 0,
  best_combo integer not null default 0,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  study_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (status = 'active' or finished_at is not null),
  foreign key (study_session_id, user_id) references public.study_sessions (id, user_id) on delete set null (study_session_id)
);
create index game_sessions_user_idx on public.game_sessions (user_id, status, started_at desc);

create table public.game_answers (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  challenge_id text not null,
  challenge_version integer not null default 1,
  subject_id text not null,
  topic text not null default '',
  correct boolean not null,
  score numeric(4, 3) not null default 0 check (score between 0 and 1),
  used_hint boolean not null default false,
  attempt smallint not null default 1 check (attempt between 1 and 50),
  seconds integer not null default 0 check (seconds between 0 and 86400),
  xp integer not null default 0,
  coins integer not null default 0,
  combo integer not null default 0,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.game_sessions (id, user_id) on delete cascade
);
create index game_answers_challenge_idx on public.game_answers (user_id, challenge_id, answered_at desc);
create index game_answers_time_idx on public.game_answers (user_id, answered_at desc);
create index game_answers_session_idx on public.game_answers (session_id, answered_at);

-- Livro-razão: saldo de XP e moedas = soma das linhas.
create table public.game_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (char_length(source) <= 200),
  kind text not null check (kind in ('answer', 'mission', 'achievement', 'purchase')),
  xp integer not null default 0,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

create table public.game_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  price integer not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['game_sessions', 'game_answers', 'game_rewards', 'game_purchases'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Somente leitura das próprias linhas; toda escrita passa pelas RPCs.
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_select', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ── Fórmula de XP (espelho de src/game/engine/rules.ts) ──────────────────
create or replace function public.game_xp_for(
  p_difficulty integer,
  p_correct boolean,
  p_score numeric,
  p_used_hint boolean,
  p_attempt integer,
  p_seconds integer,
  p_prior_correct integer,
  p_hours_since numeric,
  p_combo_before integer,
  out xp integer,
  out coins integer,
  out combo integer,
  out novelty numeric
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_quality numeric;
  v_mult numeric;
begin
  combo := case when p_correct then p_combo_before + 1 else floor(p_combo_before / 2.0)::integer end;
  v_quality := case when p_correct then 1 when p_score >= 0.5 then p_score * 0.5 else 0 end;
  novelty := case
    when p_prior_correct = 0 or p_hours_since is null then 1
    when p_hours_since < 20 then 0
    else 0.5
  end;
  if p_seconds < 1 or v_quality = 0 or novelty = 0 then
    xp := 0;
    coins := 0;
    return;
  end if;
  v_mult := 1 + least(0.5, 0.1 * floor(combo / 3.0));
  xp := round((8 + 4 * p_difficulty) * v_quality * novelty
    * (case when p_used_hint then 0.75 else 1 end)
    * (case when p_attempt > 1 then 0.5 else 1 end)
    * v_mult);
  coins := case when not p_correct then 0 when novelty = 1 and p_attempt = 1 then 2 else 1 end;
end;
$$;

-- Corrige uma resposta pelo gabarito do catálogo. Entradas malformadas = erro.
create or replace function public.game_check_key(p_key jsonb, p_response jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case p_key ->> 't'
    when 'choice' then (p_response ->> 'choice')::integer = (p_key ->> 'v')::integer
    when 'bool' then (p_response ->> 'value')::boolean = (p_key ->> 'v')::boolean
    when 'index' then (p_response ->> 'index')::integer = (p_key ->> 'v')::integer
    when 'num' then abs((p_response ->> 'value')::numeric - (p_key ->> 'v')::numeric) <= coalesce((p_key ->> 'tol')::numeric, 0.000000001)
    else false
  end is true;
exception when others then
  return false;
end;
$$;

-- ── RPC: iniciar partida ─────────────────────────────────────────────────
create or replace function public.game_start_session(
  p_id uuid,
  p_subject text,
  p_unit text,
  p_mode text,
  p_queue text[],
  p_planned_seconds integer
)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.game_sessions;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.game_challenge_catalog where subject_id = p_subject) then
    raise exception 'Disciplina desconhecida' using errcode = '22023';
  end if;
  insert into public.game_sessions (id, user_id, subject_id, unit_id, mode, queue, planned_seconds)
  values (p_id, uid, p_subject, p_unit, p_mode, coalesce(p_queue, '{}'), p_planned_seconds)
  on conflict (id) do nothing;
  select * into s from public.game_sessions where id = p_id and user_id = uid;
  if not found then
    raise exception 'Partida não encontrada' using errcode = 'P0002';
  end if;
  return s;
end;
$$;

-- ── RPC: registrar resposta (XP calculado no servidor, idempotente) ───────
create or replace function public.game_submit_answer(
  p_id uuid,
  p_session uuid,
  p_challenge text,
  p_version integer,
  p_topic text,
  p_correct boolean,
  p_score numeric,
  p_used_hint boolean,
  p_seconds integer,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.game_sessions;
  c public.game_challenge_catalog;
  a public.game_answers;
  v_correct boolean;
  v_score numeric;
  v_prior integer;
  v_last timestamptz;
  v_attempt integer;
  v_elapsed integer;
  v_seconds integer;
  r record;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  -- Trava a partida: respostas concorrentes da mesma partida são serializadas.
  select * into s from public.game_sessions where id = p_session and user_id = uid for update;
  if not found then
    raise exception 'Partida não encontrada' using errcode = 'P0002';
  end if;

  -- Idempotência: a mesma resposta enviada de novo devolve o resultado original.
  select * into a from public.game_answers where id = p_id and user_id = uid;
  if found then
    return jsonb_build_object('xp', a.xp, 'coins', a.coins, 'combo', a.combo, 'correct', a.correct, 'novelty', null, 'duplicate', true);
  end if;

  if s.status <> 'active' then
    raise exception 'Partida já encerrada' using errcode = '22023';
  end if;

  select * into c from public.game_challenge_catalog where id = p_challenge;
  if not found or c.subject_id <> s.subject_id then
    raise exception 'Desafio desconhecido' using errcode = '22023';
  end if;

  v_score := least(1, greatest(0, coalesce(p_score, 0)));
  v_correct := coalesce(p_correct, false);
  if c.answer_key is not null then
    v_correct := public.game_check_key(c.answer_key, p_response);
  end if;
  if v_correct then
    v_score := 1;
  elsif c.answer_key is not null then
    v_score := 0;
  end if;

  select count(*), max(answered_at) into v_prior, v_last
  from public.game_answers
  where user_id = uid and challenge_id = p_challenge and correct;

  select count(*) + 1 into v_attempt
  from public.game_answers
  where session_id = s.id and challenge_id = p_challenge;

  -- O tempo informado nunca pode superar o tempo real desde a última resposta.
  select extract(epoch from now() - coalesce(max(answered_at), s.started_at))::integer into v_elapsed
  from public.game_answers where session_id = s.id;
  v_seconds := least(greatest(coalesce(p_seconds, 0), 0), greatest(v_elapsed, 0), 86400);

  select * into r from public.game_xp_for(
    c.difficulty, v_correct, v_score, coalesce(p_used_hint, false), v_attempt, v_seconds,
    v_prior, extract(epoch from now() - v_last) / 3600, s.combo
  );

  insert into public.game_answers (id, user_id, session_id, challenge_id, challenge_version, subject_id, topic, correct, score, used_hint, attempt, seconds, xp, coins, combo)
  values (p_id, uid, s.id, p_challenge, coalesce(p_version, c.version), c.subject_id, left(coalesce(p_topic, ''), 60), v_correct, v_score, coalesce(p_used_hint, false), least(v_attempt, 50), v_seconds, r.xp, r.coins, r.combo);

  if r.xp > 0 or r.coins > 0 then
    insert into public.game_rewards (user_id, source, kind, xp, coins)
    values (uid, 'answer:' || p_id, 'answer', r.xp, r.coins)
    on conflict (user_id, source) do nothing;
  end if;

  update public.game_sessions
  set answered = answered + 1,
      correct = correct + (case when v_correct then 1 else 0 end),
      xp = xp + r.xp,
      coins = coins + r.coins,
      combo = r.combo,
      best_combo = greatest(best_combo, r.combo)
  where id = s.id;

  return jsonb_build_object('xp', r.xp, 'coins', r.coins, 'combo', r.combo, 'correct', v_correct, 'novelty', r.novelty, 'duplicate', false);
end;
$$;

-- ── RPC: encerrar partida (idempotente) ──────────────────────────────────
create or replace function public.game_finish_session(
  p_session uuid,
  p_active_seconds integer,
  p_status text,
  p_study_session uuid
)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.game_sessions;
  v_study uuid;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_status not in ('finished', 'abandoned') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  select * into s from public.game_sessions where id = p_session and user_id = uid for update;
  if not found then
    raise exception 'Partida não encontrada' using errcode = 'P0002';
  end if;
  if s.status <> 'active' then
    return s;
  end if;
  select id into v_study from public.study_sessions where id = p_study_session and user_id = uid;
  update public.game_sessions
  set status = p_status,
      finished_at = now(),
      -- Nunca mais que o tempo real decorrido desde o início.
      active_seconds = least(greatest(coalesce(p_active_seconds, 0), 0), greatest(extract(epoch from now() - started_at)::integer, 0), 86400),
      study_session_id = v_study
  where id = s.id
  returning * into s;
  return s;
end;
$$;

-- ── Métricas verificáveis (espelho de computeMetric em rewards.ts) ───────
create or replace function public.game_metric(
  p_uid uuid,
  p_metric text,
  p_param text,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  -- ga = respostas do usuário no período (todas, se p_from for nulo).
  case p_metric
    when 'answers', 'correct', 'subject', 'combo', 'xp', 'subjects', 'review', 'boss', 'lab', 'days', 'streak' then
      with ga as (
        select a.*, c.boss, c.type as ctype, s.mode
        from public.game_answers a
        join public.game_sessions s on s.id = a.session_id
        left join public.game_challenge_catalog c on c.id = a.challenge_id
        where a.user_id = p_uid and (p_from is null or (a.answered_at >= p_from and a.answered_at < p_to))
      )
      select case p_metric
        when 'answers' then (select count(*) from ga)
        when 'correct' then (select count(*) from ga where correct)
        when 'subject' then (select count(*) from ga where correct and subject_id = p_param)
        when 'combo' then (select coalesce(max(combo), 0) from ga)
        when 'xp' then (select coalesce(sum(xp), 0) from ga)
        when 'subjects' then (select count(distinct subject_id) from ga where correct)
        when 'review' then (select count(*) from ga where correct and mode = 'review')
        when 'boss' then (select count(*) from ga where correct and boss)
        when 'lab' then (select count(*) from ga where correct and ctype in ('sql', 'python'))
        when 'days' then (select count(distinct (answered_at at time zone p_tz)::date) from ga)
        when 'streak' then (
          select coalesce(max(n), 0) from (
            select count(*) as n from (
              select d, d - (row_number() over (order by d))::integer as grp
              from (select distinct (answered_at at time zone p_tz)::date as d from ga) days
            ) g group by grp
          ) runs
        )
      end into v;
    when 'minutes' then
      select coalesce(sum(active_seconds), 0) / 60 into v from public.game_sessions
      where user_id = p_uid and status = 'finished' and (p_from is null or (finished_at >= p_from and finished_at < p_to));
    when 'perfect' then
      select count(*) into v from public.game_sessions
      where user_id = p_uid and status = 'finished' and answered >= 5 and correct = answered
        and (p_from is null or (finished_at >= p_from and finished_at < p_to));
    else
      raise exception 'Métrica desconhecida' using errcode = '22023';
  end case;
  return v;
end;
$$;

-- ── RPC: resgatar missão/conquista (o servidor confere a meta) ───────────
create or replace function public.game_claim(p_rule text, p_period date, p_param text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rule public.game_reward_rules;
  v_tz text;
  v_today date;
  v_from timestamptz;
  v_to timestamptz;
  v_param text := null;
  v_source text;
  v_value integer;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into rule from public.game_reward_rules where key = p_rule;
  if not found then
    raise exception 'Regra desconhecida' using errcode = '22023';
  end if;

  select coalesce(settings ->> 'timezone', 'America/Sao_Paulo') into v_tz from public.profiles where id = uid;
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'America/Sao_Paulo';
  end if;
  v_today := (now() at time zone v_tz)::date;

  if rule.param then
    if not exists (select 1 from public.game_challenge_catalog where subject_id = p_param) then
      raise exception 'Disciplina inválida' using errcode = '22023';
    end if;
    v_param := p_param;
  end if;

  if rule.kind = 'achievement' then
    v_source := 'claim:' || rule.key;
  else
    if p_period is null or p_period > v_today or p_period < v_today - 14 then
      raise exception 'Período inválido' using errcode = '22023';
    end if;
    if rule.kind = 'weekly' and extract(isodow from p_period) <> 1 then
      raise exception 'A semana começa na segunda-feira' using errcode = '22023';
    end if;
    v_from := p_period::timestamp at time zone v_tz;
    v_to := (p_period + case when rule.kind = 'weekly' then 7 else 1 end)::timestamp at time zone v_tz;
    v_source := 'claim:' || rule.key || ':' || p_period::text || coalesce(':' || v_param, '');
  end if;

  -- Serializa os resgates do usuário (limite por período e saldo consistentes).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(uid::text));

  if exists (select 1 from public.game_rewards where user_id = uid and source = v_source) then
    return jsonb_build_object('applied', false, 'xp', 0, 'coins', 0);
  end if;

  if rule.kind <> 'achievement' and (
    select count(*) from public.game_rewards
    where user_id = uid and kind = 'mission' and source like 'claim:' || rule.kind || ':%:' || p_period::text || '%'
  ) >= 3 then
    raise exception 'Limite de missões do período atingido' using errcode = '22023';
  end if;

  v_value := public.game_metric(uid, rule.metric, v_param, v_from, v_to, v_tz);
  if v_value < rule.target then
    raise exception 'Meta ainda não atingida (%/%)', v_value, rule.target using errcode = '22023';
  end if;

  insert into public.game_rewards (user_id, source, kind, xp, coins)
  values (uid, v_source, case when rule.kind = 'achievement' then 'achievement' else 'mission' end, rule.xp, rule.coins);
  return jsonb_build_object('applied', true, 'xp', rule.xp, 'coins', rule.coins);
end;
$$;

-- ── RPC: comprar cosmético (moedas virtuais; sem dinheiro real) ──────────
create or replace function public.game_buy(p_item text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.game_shop_items;
  v_balance integer;
begin
  if uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into item from public.game_shop_items where id = p_item;
  if not found then
    raise exception 'Item desconhecido' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(uid::text));
  if exists (select 1 from public.game_purchases where user_id = uid and item_id = p_item) then
    return false;
  end if;
  select coalesce(sum(coins), 0) into v_balance from public.game_rewards where user_id = uid;
  if v_balance < item.price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;
  insert into public.game_purchases (user_id, item_id, price) values (uid, p_item, item.price);
  insert into public.game_rewards (user_id, source, kind, xp, coins) values (uid, 'buy:' || p_item, 'purchase', 0, -item.price);
  return true;
end;
$$;

-- ── Totais do jogador (lê só as próprias linhas via RLS) ─────────────────
create or replace function public.game_totals(out xp bigint, out coins bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(xp), 0), coalesce(sum(coins), 0) from public.game_rewards where user_id = auth.uid();
$$;

-- ── Zerar dados: inclui o EvoQuest ───────────────────────────────────────
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
end;
$$;

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

  update public.profiles set settings = '{}'::jsonb where id = uid;
end;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────
revoke all on function public.game_xp_for(integer, boolean, numeric, boolean, integer, integer, integer, numeric, integer) from public, anon;
revoke all on function public.game_check_key(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.game_metric(uuid, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.game_wipe_my_data() from public, anon;
revoke all on function public.game_start_session(uuid, text, text, text, text[], integer) from public, anon;
revoke all on function public.game_submit_answer(uuid, uuid, text, integer, text, boolean, numeric, boolean, integer, jsonb) from public, anon;
revoke all on function public.game_finish_session(uuid, integer, text, uuid) from public, anon;
revoke all on function public.game_claim(text, date, text) from public, anon;
revoke all on function public.game_buy(text) from public, anon;
revoke all on function public.game_totals() from public, anon;

grant execute on function public.game_xp_for(integer, boolean, numeric, boolean, integer, integer, integer, numeric, integer) to authenticated;
grant execute on function public.game_wipe_my_data() to authenticated;
grant execute on function public.game_start_session(uuid, text, text, text, text[], integer) to authenticated;
grant execute on function public.game_submit_answer(uuid, uuid, text, integer, text, boolean, numeric, boolean, integer, jsonb) to authenticated;
grant execute on function public.game_finish_session(uuid, integer, text, uuid) to authenticated;
grant execute on function public.game_claim(text, date, text) to authenticated;
grant execute on function public.game_buy(text) to authenticated;
grant execute on function public.game_totals() to authenticated;
