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
    expect(await complete(ALICE, 'tutorial:talk_iara')).toMatchObject({ applied: true, xp: 0 })
    await expect(complete(ALICE, 'tutorial:board', 'resposta inventada')).rejects.toThrow(/não confere/)
    await expect(complete(ALICE, 'tutorial:board', null)).rejects.toThrow(/não confere/)
    expect(await totals(ALICE)).toBe(0)

    // Resposta canônica do quadro (mesma forma que o cliente envia).
    const canon = `2|${JSON.stringify(['O Servidor Fantasma', 'Cidade dos Dados'])}`
    expect(await complete(ALICE, 'tutorial:board', canon)).toMatchObject({ applied: true, xp: 30, coins: 10 })
    expect(await complete(ALICE, 'tutorial:board', canon)).toMatchObject({ applied: false, xp: 0 })
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

  it('anon não chama a RPC', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select public.game_complete_step('tutorial:talk_iara', null)`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })
})
