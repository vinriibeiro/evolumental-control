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

  -- Stub mínimo do armazenamento do Supabase (bucket + objetos com RLS)
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
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
})

describe('biblioteca (livros privados)', () => {
  const book = (id: string, title: string) =>
    db.query(`insert into public.library_books (id, title, file_name, size) values ($1, $2, $3, 1000)`, [id, title, `${id}.epub`]);

  it('o bucket é privado e tem limite de 50 MiB por arquivo', async () => {
    const r = await db.query<{ public: boolean; file_size_limit: string }>(`select public, file_size_limit from storage.buckets where id = 'livros'`);
    expect(r.rows[0].public).toBe(false);
    expect(Number(r.rows[0].file_size_limit)).toBe(52428800);
  });

  it('um usuário não vê, altera nem apaga os livros de outro', async () => {
    await as(ALICE, async () => {
      await book('aaaa1111', 'Livro da Alice');
    });
    await as(BOB, async () => {
      expect((await db.query(`select * from public.library_books`)).rows).toHaveLength(0);
      expect((await db.query(`update public.library_books set title = 'hack' where id = 'aaaa1111'`)).affectedRows).toBe(0);
      expect((await db.query(`delete from public.library_books where id = 'aaaa1111'`)).affectedRows).toBe(0);
      await expect(
        db.query(`insert into public.library_books (user_id, id, title, file_name, size) values ($1, 'bbbb', 'x', 'x.epub', 1)`, [ALICE]),
      ).rejects.toThrow();
    });
    await as(ALICE, async () => {
      expect((await db.query<{ title: string }>(`select title from public.library_books`)).rows[0].title).toBe('Livro da Alice');
    });
  });

  it('valida progresso, formato do id e lista de marcadores', async () => {
    await as(ALICE, async () => {
      await expect(db.query(`insert into public.library_books (id, title, file_name, size, progress) values ('c1', 't', 'f', 1, 101)`)).rejects.toThrow();
      await expect(db.query(`insert into public.library_books (id, title, file_name, size) values ('../x', 't', 'f', 1)`)).rejects.toThrow();
      await expect(db.query(`insert into public.library_books (id, title, file_name, size, bookmarks) values ('c2', 't', 'f', 1, '{}'::jsonb)`)).rejects.toThrow();
    });
  });

  it('anon não acessa a tabela de livros', async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
    await expect(db.query(`select * from public.library_books`)).rejects.toThrow();
    await db.exec(`reset role;`);
  });

  it('o armazenamento só aceita arquivos na pasta do próprio usuário', async () => {
    await as(ALICE, async () => {
      await db.query(`insert into storage.objects (bucket_id, name) values ('livros', $1)`, [`${ALICE}/aaaa1111.epub`]);
      await expect(db.query(`insert into storage.objects (bucket_id, name) values ('livros', $1)`, [`${BOB}/x.epub`])).rejects.toThrow();
      await expect(db.query(`insert into storage.objects (bucket_id, name) values ('livros', 'solto.epub')`)).rejects.toThrow();
    });
    await as(BOB, async () => {
      expect((await db.query(`select * from storage.objects where bucket_id = 'livros'`)).rows).toHaveLength(0);
      expect((await db.query(`delete from storage.objects where bucket_id = 'livros'`)).affectedRows).toBe(0);
    });
    await as(ALICE, async () => {
      expect((await db.query(`select * from storage.objects where bucket_id = 'livros'`)).rows).toHaveLength(1);
    });
  });

  it('excluir a conta remove os livros do usuário', async () => {
    await as(BOB, async () => {
      await book('bbbb2222', 'Livro do Bob');
    });
    await as(BOB, async () => {
      await db.query(`select public.delete_my_account()`);
    });
    const left = await db.query<{ user_id: string }>(`select user_id from public.library_books`);
    expect(left.rows.map((r) => r.user_id)).toEqual([ALICE]);
  });
});

describe('áudios dos tópicos (privados)', () => {
  const novoTopico = async () => {
    const subj = await db.query<{ id: string }>(`insert into public.subjects (name) values ('Inglês') returning id`)
    const top = await db.query<{ id: string }>(`insert into public.topics (subject_id, name) values ($1, 'Lesson 01') returning id`, [subj.rows[0].id])
    return top.rows[0].id
  }
  const audio = (id: string, topic: string) =>
    db.query(`insert into public.topic_audios (id, topic_id, name, file_name, size) values ($1, $2, 'Track 1', 'L01_T01.mp3', 1000)`, [id, topic])

  it('o bucket de áudios é privado, com limite de 50 MiB por arquivo', async () => {
    const r = await db.query<{ public: boolean; file_size_limit: string }>(`select public, file_size_limit from storage.buckets where id = 'audios'`)
    expect(r.rows[0].public).toBe(false)
    expect(Number(r.rows[0].file_size_limit)).toBe(52428800)
  })

  it('um usuário não vê, altera nem apaga os áudios de outro', async () => {
    const topico = await as(ALICE, async () => {
      const t = await novoTopico()
      await audio('aud11111', t)
      return t
    })
    await as(BOB, async () => {
      expect((await db.query(`select * from public.topic_audios`)).rows).toHaveLength(0)
      expect((await db.query(`update public.topic_audios set name = 'hack' where id = 'aud11111'`)).affectedRows).toBe(0)
      expect((await db.query(`delete from public.topic_audios where id = 'aud11111'`)).affectedRows).toBe(0)
      // não dá para ligar um áudio ao tópico de outra pessoa (FK composta)
      await expect(audio('aud22222', topico)).rejects.toThrow()
    })
    await as(ALICE, async () => {
      expect((await db.query(`select * from public.topic_audios`)).rows).toHaveLength(1)
    })
  })

  it('apagar o tópico apaga os metadados dos áudios', async () => {
    await as(ALICE, async () => {
      const t = await novoTopico()
      await audio('aud33333', t)
      await db.query(`delete from public.topics where id = $1`, [t])
      expect((await db.query(`select * from public.topic_audios where id = 'aud33333'`)).rows).toHaveLength(0)
    })
  })

  it('valida o formato do id e anon não acessa', async () => {
    await as(ALICE, async () => {
      const t = await novoTopico()
      await expect(audio('../x', t)).rejects.toThrow()
    })
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
    await expect(db.query(`select * from public.topic_audios`)).rejects.toThrow()
    await db.exec(`reset role;`)
  })

  it('o armazenamento de áudios só aceita arquivos na pasta do próprio usuário', async () => {
    await as(ALICE, async () => {
      await db.query(`insert into storage.objects (bucket_id, name) values ('audios', $1)`, [`${ALICE}/aud11111.mp3`])
      await expect(db.query(`insert into storage.objects (bucket_id, name) values ('audios', $1)`, [`${BOB}/x.mp3`])).rejects.toThrow()
    })
    await as(BOB, async () => {
      expect((await db.query(`select * from storage.objects where bucket_id = 'audios'`)).rows).toHaveLength(0)
      expect((await db.query(`delete from storage.objects where bucket_id = 'audios'`)).affectedRows).toBe(0)
    })
  })
})
