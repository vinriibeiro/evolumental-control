// @vitest-environment node
//
// Caderno de erros no PostgreSQL real (PGlite): isolamento por RLS, FK
// composta, "classificados ≤ erros" nas duas direções e cascata.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

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

const record = (user: string, wrong: number) =>
  as(user, async () => (await db.query<{ id: string }>(`insert into public.question_records (date, total, correct, wrong) values (current_date, 10, ${10 - wrong}, ${wrong}) returning id`)).rows[0].id)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  const dir = join(__dirname, '..', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, file), 'utf8'))
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');`)
}, 60000)

describe('caderno de erros — banco', () => {
  it('soma dos motivos não passa dos erros do registro', async () => {
    const id = await record(ALICE, 3)
    await as(ALICE, async () => {
      await db.query(`insert into public.question_errors (record_id, reason, count) values ($1, 'interpretacao', 2)`, [id])
      await expect(db.query(`insert into public.question_errors (record_id, reason, count) values ($1, 'calculo', 2)`, [id])).rejects.toThrow(/passam do total/)
      await db.query(`insert into public.question_errors (record_id, reason, count) values ($1, 'calculo', 1)`, [id])
      // Diminuir os erros do registro abaixo do classificado é recusado.
      await expect(db.query(`update public.question_records set wrong = 2, correct = 8 where id = $1`, [id])).rejects.toThrow(/classificados/)
      // Aumentar uma classificação também respeita o limite.
      await expect(db.query(`update public.question_errors set count = 3 where reason = 'calculo' and record_id = $1`, [id])).rejects.toThrow(/passam do total/)
    })
  })

  it('resolvido carimba a data; desfazer limpa', async () => {
    const id = await record(ALICE, 1)
    await as(ALICE, async () => {
      const e = (await db.query<{ id: string }>(`insert into public.question_errors (record_id, reason) values ($1, 'chute') returning id`, [id])).rows[0].id
      await db.query(`update public.question_errors set resolved = true where id = $1`, [e])
      expect((await db.query<{ resolved_at: string | null }>(`select resolved_at from public.question_errors where id = $1`, [e])).rows[0].resolved_at).not.toBeNull()
      await db.query(`update public.question_errors set resolved = false where id = $1`, [e])
      expect((await db.query<{ resolved_at: string | null }>(`select resolved_at from public.question_errors where id = $1`, [e])).rows[0].resolved_at).toBeNull()
    })
  })

  it('isolamento: Bob não vê nem cria erros ligados a registros da Alice', async () => {
    const id = await record(ALICE, 2)
    await as(ALICE, () => db.query(`insert into public.question_errors (record_id, reason) values ($1, 'esqueci')`, [id]))
    await as(BOB, async () => {
      expect((await db.query(`select * from public.question_errors`)).rows).toHaveLength(0)
      await expect(db.query(`insert into public.question_errors (record_id, reason) values ($1, 'esqueci')`, [id])).rejects.toThrow()
      expect((await db.query(`delete from public.question_errors`)).affectedRows).toBe(0)
    })
  })

  it('excluir o registro exclui a classificação; motivo inválido é recusado', async () => {
    const id = await record(ALICE, 2)
    await as(ALICE, async () => {
      await expect(db.query(`insert into public.question_errors (record_id, reason) values ($1, 'preguica')`, [id])).rejects.toThrow()
      await db.query(`insert into public.question_errors (record_id, reason, count) values ($1, 'distracao', 2)`, [id])
      await db.query(`delete from public.question_records where id = $1`, [id])
      expect((await db.query(`select * from public.question_errors where record_id = $1`, [id])).rows).toHaveLength(0)
    })
  })

  it('anon não acessa o caderno', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select * from public.question_errors`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })
})
