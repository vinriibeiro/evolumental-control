// @vitest-environment node
//
// Executa a migração real em um PostgreSQL embutido (PGlite) com um stub
// mínimo do esquema `auth` do Supabase, e verifica o isolamento entre usuários
// por RLS, as restrições de integridade e a view de tempo líquido.
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

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  const dir = join(__dirname, '..', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'))
  }
  await db.exec(`
    insert into auth.users (id, email) values ('${ALICE}', 'alice@example.com'), ('${BOB}', 'bob@example.com');
  `)
}, 60000)

describe('migração + RLS', () => {
  it('cria perfis automaticamente para novos usuários', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.profiles`)
    expect(r.rows[0].n).toBe(2)
  })

  it('um usuário não vê, altera nem exclui dados de outro', async () => {
    const subjectId = await as(ALICE, async () => {
      const r = await db.query<{ id: string }>(`insert into public.subjects (name) values ('Direito Administrativo') returning id`)
      return r.rows[0].id
    })

    await as(BOB, async () => {
      const seen = await db.query(`select * from public.subjects`)
      expect(seen.rows).toHaveLength(0)
      const upd = await db.query(`update public.subjects set name = 'hack' where id = $1`, [subjectId])
      expect(upd.affectedRows).toBe(0)
      const del = await db.query(`delete from public.subjects where id = $1`, [subjectId])
      expect(del.affectedRows).toBe(0)
      const profiles = await db.query<{ id: string }>(`select id from public.profiles`)
      expect(profiles.rows.map((p) => p.id)).toEqual([BOB])
    })

    await as(ALICE, async () => {
      const r = await db.query<{ name: string }>(`select name from public.subjects where id = $1`, [subjectId])
      expect(r.rows[0].name).toBe('Direito Administrativo')
    })
  })

  it('impede inserir linhas em nome de outro usuário', async () => {
    await as(BOB, async () => {
      await expect(db.query(`insert into public.subjects (user_id, name) values ($1, 'x')`, [ALICE])).rejects.toThrow()
    })
  })

  it('impede vincular registros a linhas de outro usuário (FK composta)', async () => {
    const aliceSubject = await as(ALICE, async () => {
      const r = await db.query<{ id: string }>(`insert into public.subjects (name) values ('Português') returning id`)
      return r.rows[0].id
    })
    await as(BOB, async () => {
      await expect(
        db.query(`insert into public.topics (subject_id, name) values ($1, 'Crase')`, [aliceSubject]),
      ).rejects.toThrow()
    })
  })

  it('anon não acessa nenhuma tabela', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select * from public.subjects`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })

  it('valida coerência de questões no banco (acertos + erros <= total)', async () => {
    await as(ALICE, async () => {
      await expect(
        db.query(`insert into public.question_records (date, total, correct, wrong) values (current_date, 10, 8, 5)`),
      ).rejects.toThrow()
      const ok = await db.query(`insert into public.question_records (date, total, correct, wrong) values (current_date, 10, 8, 2) returning id`)
      expect(ok.rows).toHaveLength(1)
    })
  })

  it('permite apenas uma sessão ativa por usuário e calcula o tempo líquido', async () => {
    await as(ALICE, async () => {
      const s = await db.query<{ id: string }>(
        `insert into public.study_sessions (started_at, status) values ('2026-10-01T10:00:00Z', 'active') returning id`,
      )
      const sessionId = s.rows[0].id
      await expect(
        db.query(`insert into public.study_sessions (started_at, status) values ('2026-10-01T11:00:00Z', 'active')`),
      ).rejects.toThrow()

      await db.query(
        `insert into public.study_session_pauses (session_id, started_at, ended_at) values ($1, '2026-10-01T10:20:00Z', '2026-10-01T10:30:00Z')`,
        [sessionId],
      )
      // Pausa ainda aberta ao finalizar: conta até o fim da sessão.
      await db.query(
        `insert into public.study_session_pauses (session_id, started_at) values ($1, '2026-10-01T10:50:00Z')`,
        [sessionId],
      )
      await db.query(
        `update public.study_sessions set status = 'completed', ended_at = '2026-10-01T11:00:00Z', adjustment_seconds = 60 where id = $1`,
        [sessionId],
      )
      const net = await db.query<{ net_seconds: number; paused_seconds: number }>(
        `select net_seconds, paused_seconds from public.study_session_net where id = $1`,
        [sessionId],
      )
      // 60 min - 10 min - 10 min + 1 min = 41 min
      expect(net.rows[0].paused_seconds).toBe(20 * 60)
      expect(net.rows[0].net_seconds).toBe(41 * 60)
    })
    await as(BOB, async () => {
      const net = await db.query(`select * from public.study_session_net`)
      expect(net.rows).toHaveLength(0)
    })
  })

  it('registra revisão de flashcard de forma atômica e idempotente', async () => {
    await as(ALICE, async () => {
      const deck = await db.query<{ id: string }>(`insert into public.flashcard_decks (name) values ('Geral') returning id`)
      const card = await db.query<{ id: string }>(
        `insert into public.flashcards (deck_id, front, back) values ($1, 'Frente', 'Verso') returning id`,
        [deck.rows[0].id],
      )
      const reviewId = '33333333-3333-4333-8333-333333333333'
      const call = () =>
        db.query<{ ok: boolean }>(
          `select public.record_flashcard_review($1, $2, 3::smallint, now(), 'review', 2.5, 1, 1, 0, now() + interval '1 day') as ok`,
          [reviewId, card.rows[0].id],
        )
      expect((await call()).rows[0].ok).toBe(true)
      expect((await call()).rows[0].ok).toBe(false)
      const n = await db.query<{ n: number }>(`select count(*)::int as n from public.flashcard_reviews where card_id = $1`, [card.rows[0].id])
      expect(n.rows[0].n).toBe(1)
      const c = await db.query<{ status: string; repetitions: number }>(`select status, repetitions from public.flashcards where id = $1`, [card.rows[0].id])
      expect(c.rows[0]).toMatchObject({ status: 'review', repetitions: 1 })
    })
    await as(BOB, async () => {
      const cards = await db.query(`select * from public.flashcards`)
      expect(cards.rows).toHaveLength(0)
    })
  })

  it('excluir matéria mantém sessões (vínculo nulo) e remove tópicos em cascata', async () => {
    await as(BOB, async () => {
      const subj = await db.query<{ id: string }>(`insert into public.subjects (name) values ('Informática') returning id`)
      const sid = subj.rows[0].id
      await db.query(`insert into public.topics (subject_id, name) values ($1, 'Redes')`, [sid])
      const sess = await db.query<{ id: string }>(
        `insert into public.study_sessions (subject_id, started_at, ended_at, status) values ($1, now() - interval '1 hour', now(), 'completed') returning id`,
        [sid],
      )
      await db.query(`delete from public.subjects where id = $1`, [sid])
      const topics = await db.query(`select * from public.topics where subject_id = $1`, [sid])
      expect(topics.rows).toHaveLength(0)
      const s = await db.query<{ subject_id: string | null; user_id: string }>(
        `select subject_id, user_id from public.study_sessions where id = $1`,
        [sess.rows[0].id],
      )
      expect(s.rows[0]).toEqual({ subject_id: null, user_id: BOB })
    })
  })
  it('reset_my_data apaga só os dados do próprio usuário e mantém a conta', async () => {
    await as(ALICE, async () => {
      await db.query(`insert into public.subjects (name) values ('Alice fica')`)
    })
    const bobBefore = await as(BOB, async () => {
      await db.query(`insert into public.subjects (name) values ('Bob some')`)
      await db.query(`select public.reset_my_data()`)
      const r = await db.query<{ n: number }>(`select count(*)::int as n from public.subjects`)
      return r.rows[0].n
    })
    expect(bobBefore).toBe(0)
    await as(ALICE, async () => {
      const r = await db.query<{ n: number }>(`select count(*)::int as n from public.subjects`)
      expect(r.rows[0].n).toBeGreaterThan(0)
    })
    const users = await db.query(`select id from auth.users where id = $1`, [BOB])
    expect(users.rows).toHaveLength(1)
  })

  it('delete_my_account remove a conta e os dados do usuário logado, sem afetar outros', async () => {
    const CAROL = '44444444-4444-4444-8444-444444444444'
    await db.exec(`insert into auth.users (id, email) values ('${CAROL}', 'carol@example.com')`)
    await as(CAROL, async () => {
      await db.query(`insert into public.subjects (name) values ('Carol')`)
      await db.query(`select public.delete_my_account()`)
    })
    const u = await db.query(`select id from auth.users where id = $1`, [CAROL])
    expect(u.rows).toHaveLength(0)
    const left = await db.query(`select id from public.subjects where user_id = $1`, [CAROL])
    expect(left.rows).toHaveLength(0)
    const alice = await db.query(`select id from auth.users where id = $1`, [ALICE])
    expect(alice.rows).toHaveLength(1)
  })

  it('anon não pode chamar as funções de zerar/excluir', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select public.delete_my_account()`)).rejects.toThrow()
    await expect(db.query(`select public.reset_my_data()`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })

  describe('Explorador: pastas', () => {
    const DAVE = '55555555-5555-4555-8555-555555555555'
    const EVE = '66666666-6666-4666-8666-666666666666'
    beforeAll(async () => {
      await db.exec(`insert into auth.users (id, email) values ('${DAVE}', 'dave@example.com'), ('${EVE}', 'eve@example.com')`)
    })

    it('isola pastas por usuário e impede guardar matéria na pasta de outro', async () => {
      const folder = await as(DAVE, async () => (await db.query<{ id: string }>(`insert into public.study_folders (name, kind) values ('SEFAZ', 'area') returning id`)).rows[0].id)
      await as(EVE, async () => {
        expect((await db.query(`select * from public.study_folders`)).rows).toHaveLength(0)
        expect((await db.query(`update public.study_folders set name = 'x' where id = $1`, [folder])).affectedRows).toBe(0)
        await expect(db.query(`insert into public.subjects (name, folder_id) values ('Invasão', $1)`, [folder])).rejects.toThrow()
        await expect(db.query(`insert into public.study_folders (name, parent_id) values ('Sub', $1)`, [folder])).rejects.toThrow()
      })
    })

    it('área fica sempre na raiz e pastas/tópicos não formam ciclos', async () => {
      await as(DAVE, async () => {
        const a = (await db.query<{ id: string }>(`insert into public.study_folders (name) values ('A') returning id`)).rows[0].id
        const b = (await db.query<{ id: string }>(`insert into public.study_folders (name, parent_id) values ('B', $1) returning id`, [a])).rows[0].id
        const c = (await db.query<{ id: string }>(`insert into public.study_folders (name, parent_id) values ('C', $1) returning id`, [b])).rows[0].id
        await expect(db.query(`update public.study_folders set parent_id = $1 where id = $2`, [c, a])).rejects.toThrow(/dentro dela mesma/)
        await expect(db.query(`insert into public.study_folders (name, kind, parent_id) values ('Área', 'area', $1)`, [a])).rejects.toThrow()

        const s = (await db.query<{ id: string }>(`insert into public.subjects (name, folder_id) values ('BD', $1) returning id`, [b])).rows[0].id
        const t1 = (await db.query<{ id: string }>(`insert into public.topics (subject_id, name, kind) values ($1, 'SQL', 'folder') returning id`, [s])).rows[0].id
        const t2 = (await db.query<{ id: string }>(`insert into public.topics (subject_id, parent_id, name) values ($1, $2, 'JOIN') returning id`, [s, t1])).rows[0].id
        await expect(db.query(`update public.topics set parent_id = $1 where id = $2`, [t2, t1])).rejects.toThrow(/dentro dele mesmo/)
        await expect(db.query(`insert into public.topics (subject_id, name, kind) values ($1, 'x', 'pasta')`, [s])).rejects.toThrow()

        // Excluir a pasta: subpastas saem, a matéria volta para a raiz com seus tópicos.
        await db.query(`delete from public.study_folders where id = $1`, [a])
        expect((await db.query(`select id from public.study_folders where id in ($1, $2)`, [b, c])).rows).toHaveLength(0)
        expect((await db.query<{ folder_id: string | null }>(`select folder_id from public.subjects where id = $1`, [s])).rows[0].folder_id).toBeNull()
        expect((await db.query(`select id from public.topics where subject_id = $1`, [s])).rows).toHaveLength(2)
      })
    })

    it('reset_my_data também apaga as pastas do usuário', async () => {
      await as(EVE, async () => {
        await db.query(`insert into public.study_folders (name) values ('Minha pasta')`)
        await db.query(`select public.reset_my_data()`)
        expect((await db.query(`select * from public.study_folders`)).rows).toHaveLength(0)
      })
      await as(DAVE, async () => {
        expect((await db.query(`select * from public.study_folders`)).rows.length).toBeGreaterThan(0)
      })
    })
  })
})
