// @vitest-environment node
//
// EvoQuest RPG no PostgreSQL real (PGlite): etapas em ordem, resposta
// conferida pelo hash, recompensa creditada uma única vez, progresso só via
// RPC, catálogo ilegível e isolamento entre usuários.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { RAW_SOLUTIONS } from '@/features/evoquest/__tests__/solutions'

const ALICE = '11111111-1111-4111-8111-111111111111'
const BOB = '22222222-2222-4222-8222-222222222222'

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

let db: PGlite

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role;`)
  }
}

const complete = (user: string, step: string, answer: string | null = null) =>
  as(user, async () => (await db.query<{ r: { applied: boolean; xp: number; coins: number } }>(`select public.game_complete_step($1, $2) as r`, [step, answer])).rows[0].r)

const totals = (user: string) => as(user, async () => (await db.query<{ xp: number }>(`select coalesce(sum(xp), 0)::int as xp from public.game_rewards`)).rows[0].xp)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  const dir = join(__dirname, '..', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, file), 'utf8'))
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');`)
}, 60000)

describe('EvoQuest RPG — game_complete_step', () => {
  it('exige a etapa anterior', async () => {
    await expect(complete(ALICE, 'tutorial:board', 'qualquer')).rejects.toThrow(/anterior/)
  })

  it('confere a resposta pelo hash e credita uma única vez', async () => {
    // Na apresentação guiada, o quadro é só a escolha da cidade: sem resposta e sem recompensa.
    expect(await complete(ALICE, 'tutorial:talk_iara')).toMatchObject({ applied: true, xp: 0 })
    expect(await complete(ALICE, 'tutorial:board')).toMatchObject({ applied: true, xp: 0, coins: 0 })

    // O desafio SQL do quadro continua validado pelo hash, como missão opcional.
    await expect(complete(ALICE, 'side_board:query', 'resposta inventada')).rejects.toThrow(/não confere/)
    await expect(complete(ALICE, 'side_board:query', null)).rejects.toThrow(/não confere/)
    expect(await totals(ALICE)).toBe(0)
    const canon = `2|${JSON.stringify(['O Servidor Fantasma', 'Cidade dos Dados'])}`
    expect(await complete(ALICE, 'side_board:query', canon)).toMatchObject({ applied: true, xp: 30, coins: 10 })
    expect(await complete(ALICE, 'side_board:query', canon)).toMatchObject({ applied: false, xp: 0 })
    expect(await totals(ALICE)).toBe(30)
  })

  it('valida puzzle e combate pela resposta, não pela palavra do cliente', async () => {
    const steps = ['sql_main:travel', 'sql_main:talk_maya']
    for (const s of steps) await complete(BOB, s)
    await expect(complete(BOB, 'sql_main:door', 'x')).rejects.toThrow()
    // Pular etapas não funciona mesmo com a resposta certa.
    await expect(complete(BOB, 'sql_main:sentinel', RAW_SOLUTIONS.enc_sentinel)).rejects.toThrow(/anterior/)
  })

  it('progresso e catálogo: usuário só lê o próprio progresso e não lê o catálogo', async () => {
    await as(BOB, async () => {
      const mine = await db.query<{ step_key: string }>(`select step_key from public.game_quest_progress`)
      expect(mine.rows.map((r) => r.step_key).sort()).toEqual(['sql_main:talk_maya', 'sql_main:travel'])
      await expect(db.query(`select * from public.game_quest_steps`)).rejects.toThrow()
      await expect(db.query(`insert into public.game_quest_progress (step_key) values ('sql_main:door')`)).rejects.toThrow()
      await expect(db.query(`insert into public.game_rewards (source, kind, xp) values ('quest:x', 'mission', 999)`)).rejects.toThrow()
    })
  })

  it('salvamento é isolado por usuário e some ao zerar dados', async () => {
    await as(ALICE, () => db.query(`insert into public.game_saves (data) values ('{"region":"hub"}')`))
    await as(BOB, async () => {
      expect((await db.query(`select * from public.game_saves`)).rows).toHaveLength(0)
      expect((await db.query(`update public.game_saves set data = '{}'`)).affectedRows).toBe(0)
    })
    await as(ALICE, async () => {
      await db.query(`select public.reset_my_data()`)
      expect((await db.query(`select * from public.game_saves`)).rows).toHaveLength(0)
      expect((await db.query(`select * from public.game_quest_progress`)).rows).toHaveLength(0)
    })
  })

  it('Rodoviária: só depois do tutorial; primeira passagem grátis, depois moedas; sem duplicar', async () => {
    const CAROL = '33333333-3333-4333-8333-333333333333'
    await db.exec(`insert into auth.users (id, email) values ('${CAROL}', 'c@example.com');`)
    const buy = (city: string) => as(CAROL, async () => (await db.query<{ r: { bought: boolean; price: number } }>(`select public.game_buy_ticket($1) as r`, [city])).rows[0].r)
    const coins = () => as(CAROL, async () => (await db.query<{ c: number }>(`select coalesce(sum(coins), 0)::int as c from public.game_rewards`)).rows[0].c)

    await expect(buy('archive')).rejects.toThrow(/Rodoviária/)
    await complete(CAROL, 'tutorial:talk_iara')
    await complete(CAROL, 'tutorial:board')
    await complete(CAROL, 'tutorial:report')
    await expect(buy('atlantida')).rejects.toThrow(/desconhecida/)
    expect(await buy('archive')).toEqual({ bought: true, price: 0 })
    expect(await buy('archive')).toEqual({ bought: false, price: 0 })
    expect(await coins()).toBe(0)
    await expect(buy('data_city')).rejects.toThrow(/insuficientes/)

    // Passagem não se compra pela loja de cosméticos nem por insert direto.
    await as(CAROL, async () => {
      await expect(db.query(`select public.game_buy('ticket_data_city')`)).rejects.toThrow(/desconhecido/)
      await expect(db.query(`insert into public.game_purchases (item_id, price) values ('ticket_data_city', 0)`)).rejects.toThrow()
    })

    await db.exec(`reset role; insert into public.game_rewards (user_id, source, kind, xp, coins) values ('${CAROL}', 'teste:bonus', 'mission', 0, 100);`)
    expect(await buy('data_city')).toMatchObject({ bought: true, price: 80 })
    expect(await coins()).toBe(20)
  })

  it('etapa de cidade gerada exige o chefe acertado em game_answers', async () => {
    const steps = await db.query<{ key: string; require_answer: string }>(`select key, require_answer from public.game_quest_steps where key = 'city_archive:unit_1'`)
    const boss = steps.rows[0].require_answer
    expect(boss).toMatch(/^portugues\./)
    await complete(ALICE, 'city_archive:arrive')
    await complete(ALICE, 'city_archive:mentor')
    await expect(complete(ALICE, 'city_archive:unit_1')).rejects.toThrow(/não vencido/)
    const sid = '44444444-4444-4444-8444-444444444444'
    await db.exec(`reset role;
      insert into public.game_sessions (id, user_id, subject_id, mode) values ('${sid}', '${ALICE}', 'portugues', 'boss');
      insert into public.game_answers (id, user_id, session_id, challenge_id, subject_id, correct) values (gen_random_uuid(), '${ALICE}', '${sid}', '${boss}', 'portugues', false);`)
    await expect(complete(ALICE, 'city_archive:unit_1')).rejects.toThrow(/não vencido/)
    await db.exec(`insert into public.game_answers (id, user_id, session_id, challenge_id, subject_id, correct) values (gen_random_uuid(), '${ALICE}', '${sid}', '${boss}', 'portugues', true);`)
    expect(await complete(ALICE, 'city_archive:unit_1')).toMatchObject({ applied: true, coins: 25 })
    // Acerto de outra pessoa não conta.
    await complete(BOB, 'city_archive:arrive')
    await complete(BOB, 'city_archive:mentor')
    await expect(complete(BOB, 'city_archive:unit_1')).rejects.toThrow(/não vencido/)
  })

  it('anon não chama a RPC', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select public.game_complete_step('tutorial:talk_iara', null)`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })
})
