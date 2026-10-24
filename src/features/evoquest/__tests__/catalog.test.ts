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
import { canonCases, canonEnAnswer, canonEnField, canonEnglishWords, canonResult, canonValue, enFeedback, enTranscript, isPedagogic, pyFeedback, sha256, sqlFeedback, type EnChallenge, type PyChallenge, type SqlChallenge } from '../challenges'
import { WORLD } from '../content'
import { DATASETS } from '../content/datasets'
import { EXPECTED } from '../content/expected'
import { WORLD_CATALOG_MIGRATION, worldCatalogSql } from '../catalogSql'
import { collectLocal, PYTHON_AVAILABLE } from './pyLocal'
import { ALTERNATIVE_SOLUTIONS, EN_ALTERNATIVES, EN_SOLUTIONS, EN_WRONG, PY_ALTERNATIVES, PY_EXPECTED, PY_SOLUTIONS, PY_WRONG, RAW_SOLUTIONS, SQL_SOLUTIONS, WRONG_ANSWERS } from './solutions'

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
    const generated: Record<string, { hash: string; columns: number; rows: number; cases?: string[] }> = {}
    for (const ch of Object.values(WORLD.challenges)) {
      if (ch.kind === 'python') {
        // O hash sai dos valores esperados (PY_EXPECTED); o teste com CPython confere a solução.
        const values = PY_EXPECTED[ch.id]
        expect(values, `valores esperados de ${ch.id}`).toBeTruthy()
        expect(values.length, `${ch.id}: um valor por caso`).toBe(ch.cases.length)
        expect(PY_SOLUTIONS[ch.id], `solução de ${ch.id}`).toBeTruthy()
        const cases = await Promise.all(values.map((v) => sha256(canonValue(v))))
        generated[ch.id] = { hash: await sha256(canonCases(values.map((value) => ({ value })))), columns: 0, rows: values.length, cases }
      } else if (ch.kind === 'english') {
        // O hash sai do que o jogador deve anotar (EN_SOLUTIONS); o teste abaixo confere que está na transmissão.
        const sol = EN_SOLUTIONS[ch.id]
        expect(sol, `resposta de ${ch.id}`).toBeTruthy()
        const parts = ch.task.type === 'form' ? await Promise.all(ch.task.fields.map((f) => sha256(canonEnField((sol as Record<string, string>)[f.id] ?? '', f.normalize)))) : []
        generated[ch.id] = { hash: await sha256(canonEnAnswer(ch, sol)), columns: 0, rows: parts.length, cases: parts }
      } else if (ch.kind === 'sql') {
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
    const body = `// ARQUIVO GERADO — não edite à mão.\n// Regere com: UPDATE_QUEST_CATALOG=1 npx vitest run src/features/evoquest/__tests__/catalog.test.ts\nexport const EXPECTED: Record<string, { hash: string; columns: number; rows: number; cases?: string[] }> = ${JSON.stringify(generated, null, 2)}\n`
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
    for (const sol of Object.values(PY_SOLUTIONS)) expect(shipped).not.toContain(JSON.stringify(sol).slice(1, -1))
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
      if (!isPedagogic(ch) || !ch.stage) continue
      expect(ch.concept, ch.id).toBeTruthy()
      expect(ch.ladder, ch.id).toHaveLength(3)
      expect(ch.explanation?.length, ch.id).toBeGreaterThan(40)
      if (ch.lesson) expect(WORLD.lessons[ch.lesson], ch.id).toBeTruthy()
    }
  })
})

describe('Porto de Babel: rádio em inglês', () => {
  const enChallenges = Object.values(WORLD.challenges).filter((c): c is EnChallenge => c.kind === 'english')

  it('cada resposta esperada está de fato na transmissão (número por extenso ou letras soletradas)', () => {
    expect(enChallenges.length).toBeGreaterThan(0)
    for (const ch of enChallenges) {
      const sol = EN_SOLUTIONS[ch.id]
      const spoken = canonEnglishWords(enTranscript(ch))
      if (ch.task.type === 'dictation') {
        expect(typeof sol).toBe('string')
        expect(canonEnglishWords(sol as string), ch.id).toBe(spoken)
      } else {
        for (const f of ch.task.fields) {
          const v = (sol as Record<string, string>)[f.id]
          expect(v, `${ch.id}.${f.id}`).toBeTruthy()
          if (f.normalize === 'letters') expect(spoken.replace(/ /g, ''), `${ch.id}.${f.id}: soletração`).toContain(v.toLowerCase().split('').join(''))
          else expect(spoken.split(' '), `${ch.id}.${f.id}: ${v} por extenso`).toContain(canonEnglishWords(v))
        }
      }
    }
  })

  it('outras formas de escrever a mesma resposta valem (algarismos ou por extenso, caixa, pontuação, hifens)', async () => {
    for (const a of EN_ALTERNATIVES) {
      const ch = WORLD.challenges[a.challenge] as EnChallenge
      expect(await sha256(canonEnAnswer(ch, a.input)), `${a.challenge}: ${JSON.stringify(a.input)}`).toBe(ch.expect.hash)
    }
  })

  it('erros típicos recebem retorno contextual (sem revelar a resposta)', async () => {
    for (const w of EN_WRONG) {
      const ch = WORLD.challenges[w.challenge] as EnChallenge
      const ok = ch.task.type === 'form' ? await Promise.all(ch.task.fields.map(async (f, i) => (await sha256(canonEnField((w.input as Record<string, string>)[f.id] ?? '', f.normalize))) === ch.expect.parts[i])) : []
      const say = enFeedback(ch, w.input, ok)
      expect(say, `${w.challenge}: ${JSON.stringify(w.input)}`).toContain(w.expect)
      // O retorno não entrega a transmissão inteira nem a resposta canônica.
      expect(say).not.toContain(enTranscript(ch))
      expect(say.toLowerCase()).not.toContain(canonEnAnswer(ch, EN_SOLUTIONS[w.challenge]).toLowerCase())
    }
  })

  it('o ditado só conta quantas palavras bateram; o formulário aponta só o campo', () => {
    const guided = WORLD.challenges.radio_guided as EnChallenge
    const say = enFeedback(guided, 'Hello Babel this is the Blue Sky gate seven please', [])
    expect(say).toContain('9 de 10')
    expect(say).not.toContain('star')
    const form = WORLD.challenges.radio_independent as EnChallenge
    expect(enFeedback(form, { containers: '15', gate: '11', hour: '9' }, [true, true, false])).toContain('hora não bateu')
  })
})

/** Verdade de cada caso pelo hash, como o terminal Python faz. */
async function caseOk(ch: PyChallenge, out: ReturnType<typeof collectLocal>) {
  return Promise.all(
    ch.cases.map(async (_, i) => {
      const r = out.results?.[i]
      return r && !r.error ? (await sha256(canonValue(r.value))) === ch.expect.cases[i] : false
    }),
  )
}

describe.skipIf(!PYTHON_AVAILABLE)('Usina de Aurora: soluções em Python (CPython local, mesmo harness do Pyodide)', () => {
  const pyChallenges = Object.values(WORLD.challenges).filter((c): c is PyChallenge => c.kind === 'python')

  it('cada solução devolve exatamente os valores esperados; o código inicial não', async () => {
    expect(pyChallenges.length).toBeGreaterThan(0)
    for (const ch of pyChallenges) {
      const good = collectLocal(PY_SOLUTIONS[ch.id], ch.entry, ch.cases)
      expect(good.error, `${ch.id}: ${good.error}`).toBeUndefined()
      expect(canonCases(good.results!), ch.id).toBe(canonCases(PY_EXPECTED[ch.id].map((value) => ({ value }))))
      expect(await sha256(canonCases(good.results!)), ch.id).toBe(ch.expect.hash)
      const starter = collectLocal(ch.starter, ch.entry, ch.cases)
      expect(starter.error != null || (await sha256(canonCases(starter.results ?? []))) !== ch.expect.hash, `${ch.id}: o código inicial já passa`).toBe(true)
    }
  })

  it('mais de um caminho válido: soluções alternativas dão o mesmo resultado', async () => {
    for (const a of PY_ALTERNATIVES) {
      const ch = WORLD.challenges[a.challenge] as PyChallenge
      const out = collectLocal(a.code, ch.entry, ch.cases)
      expect(out.error, `${a.challenge}: ${out.error}`).toBeUndefined()
      expect(await sha256(canonCases(out.results!)), a.code).toBe(ch.expect.hash)
    }
  })

  it('erros típicos recebem retorno contextual (sem revelar a resposta)', async () => {
    for (const w of PY_WRONG) {
      const ch = WORLD.challenges[w.challenge] as PyChallenge
      const code = w.code === 'STARTER' ? ch.starter : w.code
      const out = collectLocal(code, ch.entry, ch.cases)
      const say = pyFeedback(ch, code, out, await caseOk(ch, out))
      expect(say, `${w.challenge}: ${code}`).toContain(w.expect)
      expect(say).not.toContain(PY_SOLUTIONS[w.challenge])
    }
  })
})
