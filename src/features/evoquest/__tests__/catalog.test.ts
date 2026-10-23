// @vitest-environment node
//
// Conteúdo do mundo × soluções: executa cada solução no SQLite real, confere o
// hash guardado em content/expected.ts e o catálogo da migração do servidor.
// Para regerar após mudar conteúdo/soluções:
//   UPDATE_QUEST_CATALOG=1 npx vitest run src/features/evoquest/__tests__/catalog.test.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { runQuery } from '@/game/lab/sqlCore'
import { canonResult, sha256, sqlFeedback, type SqlChallenge } from '../challenges'
import { WORLD } from '../content'
import { DATASETS } from '../content/datasets'
import { EXPECTED } from '../content/expected'
import { WORLD_CATALOG_MIGRATION, worldCatalogSql } from '../catalogSql'
import { ALTERNATIVE_SOLUTIONS, RAW_SOLUTIONS, SQL_SOLUTIONS, WRONG_ANSWERS } from './solutions'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})

const UPDATE = Boolean(process.env.UPDATE_QUEST_CATALOG)
const ROOT = join(__dirname, '..', '..', '..', '..')

function run(ch: SqlChallenge, query: string) {
  try {
    return { result: runQuery(SQL, DATASETS[ch.database], ch.verify ? `${query}\n;${ch.verify}` : query) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

describe('catálogo do mundo', () => {
  it('toda solução executa e o hash esperado está sincronizado', async () => {
    const generated: Record<string, { hash: string; columns: number; rows: number }> = {}
    for (const ch of Object.values(WORLD.challenges)) {
      if (ch.kind === 'sql') {
        const sol = SQL_SOLUTIONS[ch.id]
        expect(sol, `solução de ${ch.id}`).toBeTruthy()
        expect(DATASETS[ch.database], `banco ${ch.database}`).toBeTruthy()
        const out = run(ch, sol)
        expect(out.error, `${ch.id}: ${out.error}`).toBeUndefined()
        const r = out.result!
        expect(r.rows.length, `${ch.id} não pode ter resultado vazio`).toBeGreaterThan(0)
        generated[ch.id] = { hash: await sha256(canonResult(r, ch.orderMatters)), columns: r.columns.length, rows: r.rows.length }
      } else {
        const raw = RAW_SOLUTIONS[ch.id]
        expect(raw, `resposta de ${ch.id}`).toBeTruthy()
        generated[ch.id] = { hash: await sha256(raw), columns: 0, rows: 0 }
      }
    }
    for (const enc of Object.keys(WORLD.encounters)) generated[enc] = { hash: await sha256(RAW_SOLUTIONS[enc]), columns: 0, rows: 0 }

    const file = join(ROOT, 'src/features/evoquest/content/expected.ts')
    const body = `// ARQUIVO GERADO — não edite à mão.\n// Regere com: UPDATE_QUEST_CATALOG=1 npx vitest run src/features/evoquest/__tests__/catalog.test.ts\nexport const EXPECTED: Record<string, { hash: string; columns: number; rows: number }> = ${JSON.stringify(generated, null, 2)}\n`
    if (UPDATE) writeFileSync(file, body)
    else expect(EXPECTED).toEqual(generated)
  })

  it('a migração do servidor tem o mesmo catálogo de etapas e passagens (recompensas, hashes e preços)', () => {
    const file = join(ROOT, 'supabase/migrations', WORLD_CATALOG_MIGRATION)
    const sqlText = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const section = `-- <catalogo>\n${worldCatalogSql()}\n-- </catalogo>`
    if (UPDATE) writeFileSync(file, sqlText.replace(/-- <catalogo>[\s\S]*-- <\/catalogo>/, section))
    else expect(sqlText.match(/-- <catalogo>[\s\S]*-- <\/catalogo>/)?.[0], 'Rode com UPDATE_QUEST_CATALOG=1').toBe(section)
  })

  it('erros típicos recebem retorno contextual (sem revelar a resposta)', () => {
    for (const w of WRONG_ANSWERS) {
      const ch = WORLD.challenges[w.challenge] as SqlChallenge
      const out = run(ch, w.query)
      const say = sqlFeedback(ch, w.query, out)
      expect(say, `${w.challenge}: ${w.query}`).toContain(w.expect)
      expect(say).not.toContain(SQL_SOLUTIONS[w.challenge])
    }
  })

  it('o gabarito não está no conteúdo enviado ao navegador (exceto a explicação completa, último degrau da escada)', () => {
    // A explicação completa só abre depois de 3 pistas e novas tentativas, e
    // resolver com ela não gera evidência de domínio. O resto não revela a resposta.
    const shipped = JSON.stringify(Object.values(WORLD.challenges).map((c) => ({ ...c, explanation: undefined })))
    for (const sol of Object.values(SQL_SOLUTIONS)) expect(shipped).not.toContain(sol)
  })

  it('mais de um caminho válido: soluções alternativas dão o mesmo resultado esperado', async () => {
    for (const a of ALTERNATIVE_SOLUTIONS) {
      const ch = WORLD.challenges[a.challenge] as SqlChallenge
      const out = run(ch, a.query)
      expect(out.error, `${a.challenge}: ${out.error}`).toBeUndefined()
      expect(await sha256(canonResult(out.result!, ch.orderMatters)), a.query).toBe(ch.expect.hash)
    }
  })

  it('atividades pedagógicas têm conceito, estágio, escada de 3 pistas e explicação', () => {
    for (const ch of Object.values(WORLD.challenges)) {
      if (ch.kind !== 'sql' || !ch.stage) continue
      expect(ch.concept, ch.id).toBeTruthy()
      expect(ch.ladder, ch.id).toHaveLength(3)
      expect(ch.explanation?.length, ch.id).toBeGreaterThan(40)
      if (ch.lesson) expect(WORLD.lessons[ch.lesson], ch.id).toBeTruthy()
    }
  })
})
