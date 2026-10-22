// @vitest-environment node
//
// EvoQuest no PostgreSQL real (PGlite): fórmula de XP idêntica à do cliente,
// recompensas calculadas e validadas no servidor, idempotência, RLS somente
// leitura, missões/conquistas verificadas, loja e "zerar dados".
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { computeXp } from '@/game/engine/rules'

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
let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role;`)
  }
}

/** Simula a passagem do tempo: empurra para trás todos os carimbos do jogo. */
async function age(interval: string) {
  await db.exec(`
    reset role;
    update public.game_sessions set started_at = started_at - interval '${interval}', finished_at = finished_at - interval '${interval}';
    update public.game_answers set answered_at = answered_at - interval '${interval}';
  `)
}

async function start(user: string, subject = 'sql', mode = 'quick') {
  const id = uuid()
  await as(user, () => db.query(`select * from public.game_start_session($1, $2, null, $3, '{}', 600)`, [id, subject, mode]))
  await age('1 hour')
  return id
}

type Outcome = { xp: number; coins: number; combo: number; correct: boolean; duplicate: boolean }

async function answer(user: string, session: string, challenge: string, response: unknown, correct: boolean, id = uuid(), seconds = 20): Promise<Outcome> {
  const r = await as(user, () =>
    db.query<{ r: Outcome }>(`select public.game_submit_answer($1, $2, $3, 1, 't', $4, $5, false, $6, $7::jsonb) as r`, [id, session, challenge, correct, correct ? 1 : 0, seconds, JSON.stringify(response)]),
  )
  await age('1 minute')
  return r.rows[0].r
}

const totals = (user: string) => as(user, async () => (await db.query<{ xp: number; coins: number }>(`select xp::int, coins::int from public.game_totals()`)).rows[0])

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  const dir = join(__dirname, '..', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, file), 'utf8'))
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'alice@example.com'), ('${BOB}', 'bob@example.com');`)
}, 60000)

describe('EvoQuest no servidor', () => {
  it('a fórmula de XP do SQL é idêntica à do cliente (rules.ts)', async () => {
    const cases = []
    for (const difficulty of [1, 3, 5])
      for (const correct of [true, false])
        for (const score of [0, 0.5, 0.67])
          for (const usedHint of [false, true])
            for (const attempt of [1, 2])
              for (const [priorCorrect, hours] of [[0, null], [1, 5], [2, 30]] as Array<[number, number | null]>)
                for (const comboBefore of [0, 2, 5, 14])
                  for (const seconds of [0, 12]) cases.push({ difficulty, correct, score, usedHint, attempt, seconds, priorCorrect, hoursSinceLastCorrect: hours, comboBefore })
    expect(cases.length).toBeGreaterThan(1000)
    const values = cases
      .map((c, i) => `(${i}, ${c.difficulty}, ${c.correct}, ${c.score}, ${c.usedHint}, ${c.attempt}, ${c.seconds}, ${c.priorCorrect}, ${c.hoursSinceLastCorrect ?? 'null'}, ${c.comboBefore})`)
      .join(',')
    const r = await db.query<{ i: number; xp: number; coins: number; combo: number }>(`
      select v.i, x.xp, x.coins, x.combo
      from (values ${values}) as v(i, d, ok, score, hint, attempt, secs, prior, hours, combo)
      cross join lateral public.game_xp_for(v.d, v.ok, v.score::numeric, v.hint, v.attempt, v.secs, v.prior, v.hours::numeric, v.combo) x
      order by v.i`)
    for (const row of r.rows) {
      const exp = computeXp(cases[row.i])
      expect({ xp: row.xp, coins: row.coins, combo: row.combo }, JSON.stringify(cases[row.i])).toEqual({ xp: exp.xp, coins: exp.coins, combo: exp.combo })
    }
  })

  it('o catálogo foi publicado e usuários comuns não o leem nem alteram', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.game_challenge_catalog`)
    expect(r.rows[0].n).toBeGreaterThanOrEqual(200)
    await as(ALICE, async () => {
      await expect(db.query(`select * from public.game_challenge_catalog`)).rejects.toThrow()
      await expect(db.query(`update public.game_challenge_catalog set difficulty = 5`)).rejects.toThrow()
      await expect(db.query(`insert into public.game_shop_items values ('x', 'avatar', 'x', 1)`)).rejects.toThrow()
    })
  })

  it('XP é calculado no servidor: o gabarito recorrige a resposta, ignorando o "correct" do cliente', async () => {
    const s = await start(ALICE)
    // sql.u1.c01: múltipla escolha cuja resposta certa é a opção 1.
    const lie = await answer(ALICE, s, 'sql.u1.c01', { type: 'mcq', choice: 0 }, true)
    expect(lie.correct).toBe(false)
    expect(lie.xp).toBe(0)
    const ok = await answer(ALICE, s, 'sql.u1.c08', { type: 'mcq', choice: 1 }, true)
    expect(ok.correct).toBe(true)
    expect(ok.xp).toBe(8 + 4 * 1)
    expect(ok.coins).toBe(2)
  })

  it('reenviar a mesma resposta (recarregar a página) não duplica recompensas', async () => {
    const s = await start(ALICE)
    const id = uuid()
    const before = await totals(ALICE)
    const first = await answer(ALICE, s, 'sql.u1.c04', { type: 'tf', value: true }, true, id)
    const again = await answer(ALICE, s, 'sql.u1.c04', { type: 'tf', value: true }, true, id)
    expect(first.duplicate).toBe(false)
    expect(again.duplicate).toBe(true)
    expect(again.xp).toBe(first.xp)
    const after = await totals(ALICE)
    expect(after.xp - before.xp).toBe(first.xp)
    const rows = await as(ALICE, () => db.query<{ n: number }>(`select count(*)::int as n from public.game_answers where id = $1`, [id]))
    expect(rows.rows[0].n).toBe(1)
  })

  it('anti-farm: repetir um desafio já acertado nas últimas horas não rende XP', async () => {
    const s = await start(ALICE)
    const r = await answer(ALICE, s, 'sql.u1.c08', { type: 'mcq', choice: 1 }, true)
    expect(r.correct).toBe(true)
    expect(r.xp).toBe(0)
    expect(r.coins).toBe(0)
  })

  it('respostas instantâneas não rendem recompensas e o tempo informado é limitado pelo real', async () => {
    const id = uuid()
    await as(ALICE, () => db.query(`select * from public.game_start_session($1, 'sql', null, 'quick', '{}', 600)`, [id]))
    // Sem envelhecer: a partida acabou de começar, então "300 s" vira ~0 s.
    const r = await as(ALICE, () => db.query<{ r: Outcome }>(`select public.game_submit_answer($1, $2, 'sql.u2.c03', 1, 't', true, 1, false, 300, '{"type":"mcq","choice":1}'::jsonb) as r`, [uuid(), id]))
    expect(r.rows[0].r.correct).toBe(true)
    expect(r.rows[0].r.xp).toBe(0)
    const sec = await as(ALICE, () => db.query<{ seconds: number }>(`select seconds from public.game_answers where session_id = $1`, [id]))
    expect(sec.rows[0].seconds).toBeLessThan(5)
  })

  it('rejeita desafios inexistentes ou de outra disciplina e partidas de outro usuário', async () => {
    const s = await start(ALICE)
    await expect(answer(ALICE, s, 'sql.nao.existe', {}, true)).rejects.toThrow(/desconhecido/)
    await expect(answer(ALICE, s, 'ingles.u1.c03', { type: 'mcq', choice: 1 }, true)).rejects.toThrow(/desconhecido/)
    await expect(answer(BOB, s, 'sql.u1.c01', { type: 'mcq', choice: 1 }, true)).rejects.toThrow(/não encontrada/)
    await expect(as(ALICE, () => db.query(`select * from public.game_start_session($1, 'inexistente', null, 'quick', '{}', 600)`, [uuid()]))).rejects.toThrow()
  })

  it('RLS: cada um só lê as próprias linhas e ninguém escreve direto nas tabelas', async () => {
    await as(BOB, async () => {
      expect((await db.query(`select * from public.game_answers`)).rows).toHaveLength(0)
      expect((await db.query(`select * from public.game_sessions`)).rows).toHaveLength(0)
      await expect(db.query(`insert into public.game_rewards (source, kind, xp, coins) values ('hack', 'answer', 99999, 99999)`)).rejects.toThrow()
    })
    await as(ALICE, async () => {
      await expect(db.query(`update public.game_answers set xp = 9999`)).rejects.toThrow()
      await expect(db.query(`update public.game_sessions set xp = 9999`)).rejects.toThrow()
      await expect(db.query(`delete from public.game_rewards`)).rejects.toThrow()
      await expect(db.query(`select public.game_metric($1, 'answers', null, null, null, 'UTC')`, [BOB])).rejects.toThrow()
    })
    const anon = db.exec(`reset role; set role anon; select * from public.game_sessions;`)
    await expect(anon).rejects.toThrow()
    await db.exec('reset role;')
  })

  it('encerrar partida limita o tempo ativo ao tempo real e é idempotente', async () => {
    const s = await start(ALICE) // começou "há 1 hora"
    const fin = await as(ALICE, () => db.query<{ active_seconds: number; status: string }>(`select active_seconds, status from public.game_finish_session($1, 999999, 'finished', null)`, [s]))
    expect(fin.rows[0].status).toBe('finished')
    expect(fin.rows[0].active_seconds).toBeGreaterThan(3500)
    expect(fin.rows[0].active_seconds).toBeLessThanOrEqual(3700)
    const again = await as(ALICE, () => db.query<{ active_seconds: number }>(`select active_seconds from public.game_finish_session($1, 10, 'finished', null)`, [s]))
    expect(again.rows[0].active_seconds).toBe(fin.rows[0].active_seconds)
    await expect(answer(ALICE, s, 'sql.u1.c02', {}, true)).rejects.toThrow(/encerrada/)
  })

  it('missões: o servidor confere a meta, não paga duas vezes e limita 3 por período', async () => {
    const today = (await db.query<{ d: string }>(`select to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as d`)).rows[0].d
    const claim = (rule: string, period: string | null = today, param: string | null = null) =>
      as(BOB, () => db.query<{ r: { applied: boolean; xp: number } }>(`select public.game_claim($1, $2::date, $3) as r`, [rule, period, param]))
    await expect(claim('daily:answers:10')).rejects.toThrow(/não atingida/)
    await expect(claim('daily:inventada:1')).rejects.toThrow(/desconhecida/)
    await expect(claim('daily:answers:10', '2020-01-01')).rejects.toThrow(/Período/)

    const s = await start(BOB)
    const tf = ['sql.u1.c04', 'sql.u2.c10', 'sql.u3.c02']
    for (let i = 0; i < 10; i++) await answer(BOB, s, tf[i % 3], { type: 'tf', value: i % 3 === 0 }, true)
    const ok = await claim('daily:answers:10')
    expect(ok.rows[0].r.applied).toBe(true)
    expect(ok.rows[0].r.xp).toBe(30)
    expect((await claim('daily:answers:10')).rows[0].r.applied).toBe(false)

    await expect(claim('daily:subject:5', today, 'nao-existe')).rejects.toThrow(/inválida/)
    expect((await claim('daily:subject:5', today, 'sql')).rows[0].r.applied).toBe(true)
    expect((await claim('daily:correct:8')).rows[0].r.applied).toBe(true)
    await expect(claim('daily:combo:5')).rejects.toThrow(/Limite/)
  })

  it('conquistas são verificadas e resgatadas uma única vez', async () => {
    const claim = () => as(BOB, () => db.query<{ r: { applied: boolean } }>(`select public.game_claim('ach:correct:1', null, null) as r`))
    expect((await claim()).rows[0].r.applied).toBe(true)
    expect((await claim()).rows[0].r.applied).toBe(false)
    await expect(as(BOB, () => db.query(`select public.game_claim('ach:correct:500', null, null)`))).rejects.toThrow(/não atingida/)
  })

  it('loja: só cosméticos com moedas virtuais, sem saldo negativo e sem compra duplicada', async () => {
    const buy = (item: string) => as(BOB, () => db.query<{ ok: boolean }>(`select public.game_buy($1) as ok`, [item]))
    await expect(buy('title.mestre')).rejects.toThrow(/insuficientes/)
    await expect(buy('item.inexistente')).rejects.toThrow(/desconhecido/)
    const before = await totals(BOB)
    expect(before.coins).toBeGreaterThanOrEqual(25)
    expect((await buy('title.curioso')).rows[0].ok).toBe(true)
    expect((await buy('title.curioso')).rows[0].ok).toBe(false)
    const after = await totals(BOB)
    expect(before.coins - after.coins).toBe(25)
    expect(after.xp).toBe(before.xp)
  })

  it('reset_my_data apaga o progresso do jogo só do próprio usuário', async () => {
    const aliceBefore = await as(ALICE, async () => (await db.query<{ n: number }>(`select count(*)::int as n from public.game_answers`)).rows[0].n)
    expect(aliceBefore).toBeGreaterThan(0)
    await as(BOB, () => db.query(`select public.reset_my_data()`))
    await as(BOB, async () => {
      for (const t of ['game_answers', 'game_sessions', 'game_rewards', 'game_purchases']) expect((await db.query(`select * from public.${t}`)).rows, t).toHaveLength(0)
    })
    const aliceAfter = await as(ALICE, async () => (await db.query<{ n: number }>(`select count(*)::int as n from public.game_answers`)).rows[0].n)
    expect(aliceAfter).toBe(aliceBefore)
  })
})
