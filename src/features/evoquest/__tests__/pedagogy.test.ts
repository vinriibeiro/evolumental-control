import 'fake-indexeddb/auto'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { runQuery } from '@/game/lab/sqlCore'
import { LocalBackend } from '@/lib/data/local'
import { activityCatalogRows } from '../catalogSql'
import { canonResult, sha256 } from '../challenges'
import { LEARNING_PATHS, WORLD } from '../content'
import { DATASETS } from '../content/datasets'
import { FIELD_GROUPBY, fieldChallenge, generateField } from '../content/fieldReview'
import { worldOpportunities, type EvidenceLike } from '../engine/opportunities'
import { canReveal, debrief, evidenceCredit, FULL_EXPLANATION, recordAttempt, reveal, startLadder, STAGE_WEIGHT } from '../engine/pedagogy'
import { latestResults, questActivities } from '../ui/FieldReport'
import { SQL_SOLUTIONS } from './solutions'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})

describe('escada de pistas', () => {
  it('não abre pista sem tentar; cada degrau exige uma nova tentativa', () => {
    let s = startLadder()
    expect(canReveal(s)).toBe(false)
    expect(reveal(s)).toBe(s)
    s = recordAttempt(s)
    s = reveal(s)
    expect(s.level).toBe(1)
    // Pedir de novo sem tentar não sobe.
    expect(reveal(s).level).toBe(1)
    for (let i = 2; i <= FULL_EXPLANATION; i++) s = reveal(recordAttempt(s))
    expect(s.level).toBe(FULL_EXPLANATION)
    expect(canReveal(recordAttempt(s))).toBe(false)
    expect(s.attempts).toBe(FULL_EXPLANATION)
  })
})

describe('evidência: domínio separado de XP', () => {
  it('estágio define o peso; ajuda reduz o crédito; explicação completa não conta acerto', () => {
    expect(STAGE_WEIGHT.guided < STAGE_WEIGHT.independent && STAGE_WEIGHT.independent < STAGE_WEIGHT.transfer && STAGE_WEIGHT.transfer < STAGE_WEIGHT.boss).toBe(true)
    expect(evidenceCredit('independent', 0, true)).toEqual({ weight: 2, correct: 2 })
    expect(evidenceCredit('independent', 2, true).correct).toBeCloseTo(1.2)
    expect(evidenceCredit('transfer', 4, true)).toEqual({ weight: 3, correct: 0 })
    expect(evidenceCredit('guided', 0, false)).toEqual({ weight: 1, correct: 0 })
  })

  it('relatório: aprendeu, aplicou, dificuldade e revisão', () => {
    const d = debrief(
      [
        { activity: 'a', title: 'Guiada', stage: 'guided', concept: 'groupby', help: 0, attempts: 1, solved: true },
        { activity: 'b', title: 'Independente', stage: 'independent', concept: 'groupby', help: 2, attempts: 3, solved: true },
        { activity: 'c', title: 'Transferência', stage: 'transfer', concept: 'groupby', help: 4, attempts: 5, solved: true },
      ],
      () => 'GROUP BY',
    )
    expect(d.learned).toEqual(['GROUP BY'])
    expect(d.applied).toEqual(['Guiada'])
    expect(d.struggled.map((s) => s.why)).toEqual(['2 pistas', 'precisou da explicação completa'])
    expect(d.review).toEqual(['GROUP BY'])
  })
})

describe('missão do Almoxarifado (vertical slice)', () => {
  it('tem a cadeia completa: conversa → guiada → independente → combate → transferência → debrief', () => {
    const q = WORLD.quests.sql_supply
    expect(q.kind).toBe('mastery')
    expect(q.steps.map((s) => s.id)).toEqual(['talk', 'guided', 'independent', 'drone', 'transfer', 'debrief'])
    expect(WORLD.dialogues.otavia_debrief.debrief).toBe('sql_supply')
    expect(questActivities('sql_supply').map((c) => [c.id, c.stage])).toEqual([
      ['sup_guided', 'guided'],
      ['sup_independent', 'independent'],
      ['sup_drone', 'independent'],
      ['sup_transfer', 'transfer'],
    ])
  })

  it('a lição de campo tem objetivo, por quê, no máximo 3 frases e exemplo executável', () => {
    const l = WORLD.lessons.lesson_groupby
    expect(l.learningObjective && l.whyItMatters).toBeTruthy()
    expect(l.explanation.length).toBeLessThanOrEqual(3)
    const r = runQuery(SQL, DATASETS.lesson_groupby, l.workedExample!.code)
    expect(r.rows).toHaveLength(3)
  })

  it('relatório usa o registro resolvido mais recente de cada atividade', () => {
    const acts = questActivities('sql_supply')
    const row = (activity_id: string, created_at: string, solved: boolean, help_level = 0) =>
      ({ activity_id, created_at, solved, help_level, attempts: 1, stage: 'guided', concept: 'groupby' }) as Parameters<typeof latestResults>[1][number]
    const r = latestResults(acts, [row('sup_guided', '2026-10-01', false), row('sup_guided', '2026-10-02', true, 1), row('sup_guided', '2026-10-03', false)])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ solved: true, help: 1 })
  })
})

describe('revisão de campo parametrizada', () => {
  it('a mesma semente gera o mesmo exercício; sementes diferentes variam dados e pergunta', () => {
    expect(generateField(42)).toEqual(generateField(42))
    const variants = new Set([1, 2, 3].map((s) => generateField(s).variant))
    expect(variants.size).toBe(3)
    expect(generateField(10).dataset).not.toBe(generateField(13).dataset)
  })

  it('a resposta calculada confere com uma consulta SQL de verdade (várias sementes)', async () => {
    const reference = (seed: number) => {
      const f = generateField(seed)
      if (f.variant === 'sum') return 'SELECT deposito, SUM(qtd) FROM pedidos GROUP BY deposito'
      const m = f.brief.match(/'(\w+)'|MAIS de (\d+)/)!
      return f.variant === 'count_where' ? `SELECT deposito, COUNT(*) FROM pedidos WHERE status = '${m[1]}' GROUP BY deposito` : `SELECT deposito, SUM(qtd) FROM pedidos GROUP BY deposito HAVING SUM(qtd) > ${m[2]}`
    }
    for (let seed = 1; seed <= 60; seed++) {
      const f = generateField(seed)
      const ch = await fieldChallenge(seed)
      const r = runQuery(SQL, f.dataset, reference(seed))
      expect(r.rows.length, `semente ${seed}`).toBeGreaterThan(0)
      expect(await sha256(canonResult(r)), `semente ${seed}`).toBe(ch.expect.hash)
      expect(ch).toMatchObject({ id: FIELD_GROUPBY.id, stage: 'independent', seed })
    }
  })

  it('o pacote não traz consulta-gabarito: só a explicação (último degrau) mostra a consulta', async () => {
    const ch = await fieldChallenge(7)
    expect(JSON.stringify({ ...ch, explanation: undefined })).not.toMatch(/SELECT deposito, (SUM|COUNT)\(/)
  })

  it('no catálogo do servidor é parametrizada e tem limite diário', () => {
    expect(activityCatalogRows().find((r) => r.id === FIELD_GROUPBY.id)).toMatchObject({ parametric: true, hash: null, dailyLimit: 5 })
    const fixed = activityCatalogRows().filter((r) => !r.parametric)
    expect(fixed.map((r) => r.id).sort()).toEqual(['sup_drone', 'sup_guided', 'sup_independent', 'sup_transfer'])
    expect(fixed.every((r) => /^[0-9a-f]{64}$/.test(r.hash!))).toBe(true)
  })
})

describe('oportunidades no mundo (regras com motivo)', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  const ev = (daysAgo: number, solved: boolean, help: number, stage: EvidenceLike['stage'] = 'independent'): EvidenceLike => ({
    concept: 'groupby',
    stage,
    help_level: help,
    solved,
    created_at: new Date(now - daysAgo * 86_400_000).toISOString(),
  })
  const concepts = { groupby: { name: 'GROUP BY', where: 'Almoxarifado' } }

  it('dificuldade recorrente vira recuperação, com o motivo', () => {
    const [o] = worldOpportunities([ev(1, false, 1), ev(2, true, 3)], concepts, [], now)
    expect(o).toMatchObject({ kind: 'recovery', title: 'Recuperar GROUP BY' })
    expect(o.reason).toMatch(/2 atividades com dificuldade/)
  })

  it('um acerto independente limpo depois da dificuldade encerra a recuperação', () => {
    expect(worldOpportunities([ev(0.5, true, 0), ev(1, false, 1), ev(2, true, 3)], concepts, [], now)).toEqual([])
  })

  it('acerto guiado não basta para encerrar; acerto antigo vira revisão espaçada', () => {
    expect(worldOpportunities([ev(0.5, true, 0, 'guided'), ev(1, false, 1), ev(2, true, 3)], concepts, [], now)[0].kind).toBe('recovery')
    expect(worldOpportunities([ev(9, true, 0)], concepts, [], now)[0]).toMatchObject({ kind: 'spaced', reason: expect.stringMatching(/9 dias/) })
  })

  it('missão de aprendizagem liberada aparece como convite', () => {
    expect(LEARNING_PATHS[0]).toMatchObject({ quest: 'sql_supply', unlockedBy: 'sql_main:who' })
    expect(worldOpportunities([], {}, [{ id: 'sql_supply', title: 'X', where: 'Y' }], now)[0].kind).toBe('mission')
  })
})

describe('backend local: game_record_evidence (mesmas regras da RPC)', () => {
  it('confere a resposta, é idempotente, exige semente e respeita o limite diário', async () => {
    const b = new LocalBackend(`evid-${Date.now()}`)
    const ch = WORLD.challenges.sup_guided
    const answer = canonResult(runQuery(SQL, DATASETS.supply, SQL_SOLUTIONS.sup_guided))
    await expect(b.gameRecordEvidence({ id: crypto.randomUUID(), activity: 'inexistente', help: 0, attempts: 1, solved: true, answer })).rejects.toThrow(/desconhecida/)
    await expect(b.gameRecordEvidence({ id: crypto.randomUUID(), activity: ch.id, help: 0, attempts: 1, solved: true, answer: 'inventada' })).rejects.toThrow(/não confere/)
    await expect(b.gameRecordEvidence({ id: crypto.randomUUID(), activity: ch.id, help: 9, attempts: 1, solved: false })).rejects.toThrow(/inválidos/)
    const id = crypto.randomUUID()
    expect(await b.gameRecordEvidence({ id, activity: ch.id, help: 1, attempts: 2, solved: true, answer })).toEqual({ applied: true })
    expect(await b.gameRecordEvidence({ id, activity: ch.id, help: 1, attempts: 2, solved: true, answer })).toEqual({ applied: false })
    // Não resolvida não precisa de resposta (é evidência de dificuldade).
    expect(await b.gameRecordEvidence({ id: crypto.randomUUID(), activity: ch.id, help: 2, attempts: 4, solved: false })).toEqual({ applied: true })
    const rows = (await b.list('game_evidence')).rows
    expect(rows).toHaveLength(2)
    // Estágio e conceito vêm do catálogo, não do cliente; nenhuma recompensa.
    expect(rows.every((r) => r.stage === 'guided' && r.concept === 'groupby' && r.subject === 'sql')).toBe(true)
    expect(await b.gameTotals()).toEqual({ xp: 0, coins: 0 })

    await expect(b.gameRecordEvidence({ id: crypto.randomUUID(), activity: FIELD_GROUPBY.id, help: 0, attempts: 1, solved: true })).rejects.toThrow(/semente/)
    for (let i = 0; i < FIELD_GROUPBY.dailyLimit; i++) await b.gameRecordEvidence({ id: crypto.randomUUID(), activity: FIELD_GROUPBY.id, help: 0, attempts: 1, solved: true, seed: i + 1 })
    await expect(b.gameRecordEvidence({ id: crypto.randomUUID(), activity: FIELD_GROUPBY.id, help: 0, attempts: 1, solved: true, seed: 99 })).rejects.toThrow(/Limite diário/)
  })
})
