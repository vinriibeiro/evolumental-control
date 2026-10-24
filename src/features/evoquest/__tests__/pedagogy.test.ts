import 'fake-indexeddb/auto'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { runQuery } from '@/game/lab/sqlCore'
import { LocalBackend } from '@/lib/data/local'
import { activityCatalogRows } from '../catalogSql'
import { canonCases, canonEnField, canonEnglishWords, canonResult, canonValue, enTranscript, pyFeedback, sha256, type PyChallenge } from '../challenges'
import { fieldTemplateOf, LEARNING_PATHS, WORLD } from '../content'
import { PLANT_ENTRY, PLANT_EXIT } from '../content/aurora'
import { PORT_ENTRY, PORT_EXIT } from '../content/babel'
import { enFieldChallenge, FIELD_RADIO, generateEnField } from '../content/fieldReviewEn'
import { DATASETS } from '../content/datasets'
import { FIELD_GROUPBY, fieldChallenge, generateField } from '../content/fieldReview'
import { FIELD_DICT, generatePyField, pyFieldChallenge } from '../content/fieldReviewPy'
import { collectLocal, PYTHON_AVAILABLE } from './pyLocal'
import { controlOpportunities, sortOpportunities, worldOpportunities, type ControlRec, type EvidenceLike } from '../engine/opportunities'
import { buildMyCity, emptyLots, lightFor } from '../content/myCity'
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
    expect(fixed.map((r) => r.id).sort()).toEqual(['line_guided', 'line_independent', 'line_robot', 'line_transfer', 'radio_guided', 'radio_independent', 'radio_menu', 'radio_transfer', 'sup_drone', 'sup_guided', 'sup_independent', 'sup_transfer'])
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

describe('motor de próxima ação do Control dentro do mundo', () => {
  const paths = { groupby: { name: 'GROUP BY', where: 'Almoxarifado' } }
  const topicConcept = new Map([['t-gb', 'groupby']])
  const rec = (topicId: string | null, reasons: ControlRec['reasons']) => ({ topicId, reasons })

  it('recomendação de um tópico ligado a um conceito vira oportunidade com os motivos de maior peso do Control', () => {
    const [o, ...rest] = controlOpportunities(
      [
        rec('outro', [{ label: 'Revisão atrasada', points: 30 }]),
        rec('t-gb', [
          { label: 'Domínio baixo', points: 12 },
          { label: 'Acerto recente 40%', points: 0, info: true },
          { label: 'Erros recentes', points: 6 },
          { label: 'Prioridade', points: 3 },
        ]),
        rec('t-gb', [{ label: 'Repetido', points: 5 }]),
      ],
      topicConcept,
      paths,
    )
    expect(rest).toEqual([])
    expect(o).toMatchObject({ id: 'control:groupby', kind: 'control', title: 'Praticar GROUP BY', where: 'Almoxarifado' })
    expect(o.reason).toBe('O Control recomenda este tópico agora: domínio baixo; erros recentes.')
  })

  it('conceito sem caminho liberado não aparece; ordem: recuperação, Control, revisão, missão', () => {
    expect(controlOpportunities([rec('t-gb', [])], topicConcept, {})).toEqual([])
    const kinds = sortOpportunities([
      { id: 'm', kind: 'mission', title: '', reason: '', where: '' },
      { id: 's', kind: 'spaced', title: '', reason: '', where: '' },
      { id: 'c', kind: 'control', title: '', reason: '', where: '' },
      { id: 'r', kind: 'recovery', title: '', reason: '', where: '' },
    ]).map((o) => o.kind)
    expect(kinds).toEqual(['recovery', 'control', 'spaced', 'mission'])
  })
})

describe('Minha Cidade: janelas acesas pelo domínio', () => {
  it('nível de domínio → janelas apagadas, meio acesas ou acesas', () => {
    expect(['none', 'unconsolidated', 'fragile', 'developing', 'consolidating', 'mastered'].map((l) => lightFor(l as Parameters<typeof lightFor>[0]))).toEqual([0, 1, 1, 2, 2, 2])
  })

  it('a forma do prédio vem do tempo; as janelas, do domínio', () => {
    const lot = (light?: 0 | 1 | 2) => [{ subjectId: 's', name: 'SQL', color: '#336699', level: 4, light }, ...emptyLots().slice(1)]
    const rows = (light?: 0 | 1 | 2) => buildMyCity(lot(light)).map.rows.slice(1, 5).map((r) => r.slice(2, 8))
    expect(rows(undefined)[2]).toContain('H')
    expect(rows(0)[2]).toMatch(/^k+D?k*$/)
    expect(rows(2)[2]).toMatch(/^n+D?n*$/)
    // Mesmo tamanho (tempo) com qualquer domínio.
    expect(rows(0).map((r) => r.replace(/[kmn]/g, 'H'))).toEqual(rows(undefined))
    expect(buildMyCity(lot(1)).map.legend.m.sprite).toBe('wall_tall_lit1')
  })
})

describe('forma canônica dos valores de Python', () => {
  it('ignora a ordem das chaves, normaliza números e preserva a ordem das listas', () => {
    expect(canonValue({ b: 1, a: 2 })).toBe(canonValue({ a: 2, b: 1 }))
    expect(canonValue({ a: 1.0 })).toBe(canonValue({ a: 1 }))
    expect(canonValue(0.1 + 0.2)).toBe(canonValue(0.3))
    expect(canonValue([1, 2])).not.toBe(canonValue([2, 1]))
    expect(canonValue(null)).toBe('null')
    expect(canonValue({ x: [true, 'a', { k: null }] })).toBe('{"x":[true,"a",{"k":null}]}')
    expect(canonCases([{ value: {} }, { error: 'KeyError: x' }])).toBe('2|{}\n!KeyError: x')
  })

  it('retorno do terminal Python (sem Python): None, erro num caso, caso único que falhou, código recusado', () => {
    const ch = WORLD.challenges.line_transfer as PyChallenge
    const none = { results: ch.cases.map(() => ({ value: null })) }
    expect(pyFeedback(ch, 'def abaixo_da_meta(m, p):\n    pass', none, [false, false, false])).toContain('devolveu None')
    const boom = { results: [{ error: "KeyError: 'M9'" }, { value: {} }, { value: {} }] }
    expect(pyFeedback(ch, 'x', boom, [false, true, true])).toContain('KeyError')
    const only1 = { results: [{ value: { M2: 5, M3: 35 } }, { value: {} }, { value: {} }] }
    expect(pyFeedback(ch, 'x', only1, [true, false, true])).toContain('sem NENHUMA produção')
    expect(pyFeedback(ch, 'def (', { error: 'SyntaxError: invalid syntax' }, [false, false, false])).toContain('recusou o código')
    const partial = { results: [{ value: { M2: 5 } }, { value: {} }, { value: {} }] }
    expect(pyFeedback(ch, 'x', partial, [false, false, true])).toMatch(/1 de 3 casos conferem.*Dia 1/)
  })
})

describe('missão da Usina de Aurora (Python)', () => {
  it('tem a cadeia completa: conversa → guiada → independente → combate → transferência → debrief', () => {
    const q = WORLD.quests.py_line
    expect(q.kind).toBe('mastery')
    expect(q.steps.map((s) => s.id)).toEqual(['talk', 'guided', 'independent', 'robot', 'transfer', 'debrief'])
    expect(WORLD.dialogues.nadir_debrief.debrief).toBe('py_line')
    expect(questActivities('py_line').map((c) => [c.kind, c.id, c.stage])).toEqual([
      ['python', 'line_guided', 'guided'],
      ['python', 'line_independent', 'independent'],
      ['python', 'line_robot', 'independent'],
      ['python', 'line_transfer', 'transfer'],
    ])
    expect(LEARNING_PATHS.map((p) => p.quest)).toEqual(['sql_supply', 'py_line', 'en_radio'])
    expect(fieldTemplateOf('py_line')).toBe('field_dict')
    expect(fieldTemplateOf('sql_supply')).toBe('field_groupby')
    expect(fieldTemplateOf('sql_main')).toBeNull()
  })

  it('o portão da Usina fica em Aurora (chão livre, saída livre) e a Prefeitura apresenta a Usina', () => {
    const aurora = WORLD.regions.lab_aurora
    const plant = WORLD.regions.aurora_plant
    const gate = aurora.entities.find((e) => e.id === 'portao_usina')!
    expect(gate.kind).toBe('portal')
    expect(aurora.map.legend[aurora.map.rows[gate.y][gate.x]].solid).toBe(false)
    expect(aurora.map.legend[aurora.map.rows[Math.floor(PLANT_EXIT.y)][Math.floor(PLANT_EXIT.x)]].solid).toBe(false)
    expect(plant.map.legend[plant.map.rows[Math.floor(PLANT_ENTRY.y)][Math.floor(PLANT_ENTRY.x)]].solid).toBe(false)
    const intro = WORLD.dialogues.lab_aurora_mentor_intro
    expect(intro.nodes.some((n) => n.text.includes('Usina'))).toBe(true)
    expect(intro.nodes[intro.nodes.length - 1].id).toBe('m3')
    // Outras cidades geradas continuam sem a fala extra.
    expect(WORLD.dialogues.language_tower_mentor_intro.nodes.some((n) => n.text.includes('Usina'))).toBe(false)
  })

  it('a lição tem exemplo Python executável e as atividades entram no catálogo como python', () => {
    const l = WORLD.lessons.lesson_dict
    expect(l.subject).toBe('python')
    expect(l.workedExample?.lang).toBe('python')
    expect(l.explanation.length).toBeLessThanOrEqual(3)
    const rows = activityCatalogRows().filter((r) => r.subject === 'python')
    expect(rows.map((r) => r.id).sort()).toEqual(['field_dict', 'line_guided', 'line_independent', 'line_robot', 'line_transfer'])
    expect(rows.find((r) => r.id === 'field_dict')).toMatchObject({ parametric: true, hash: null, dailyLimit: 5, concept: 'colecoes' })
    expect(rows.filter((r) => !r.parametric).every((r) => /^[0-9a-f]{64}$/.test(r.hash!))).toBe(true)
  })

  it('o robô exige a função certa antes da recalibração; o hash do combate é o código da máquina', async () => {
    const enc = WORLD.encounters.enc_robot
    expect(enc.actions.find((a) => a.id === 'recalibrar')?.requires).toEqual(['fails'])
    expect(enc.actions.find((a) => a.id === 'consultar')?.challenge).toBe('line_robot')
    expect(await sha256('M3')).toBe(WORLD.challenges.line_worst.expect.hash)
  })
})

describe('revisão de campo em Python (parametrizada)', () => {
  it('a mesma semente gera o mesmo exercício; sementes diferentes variam a pergunta e os dados', () => {
    expect(generatePyField(42)).toEqual(generatePyField(42))
    expect(new Set([1, 2, 3].map((s) => generatePyField(s).variant)).size).toBe(3)
    expect(generatePyField(10).cases[0]).not.toEqual(generatePyField(13).cases[0])
  })

  it('hashes por caso e do conjunto saem dos valores calculados; sem leituras o resultado é {}', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const f = generatePyField(seed)
      const ch = await pyFieldChallenge(seed)
      expect(ch).toMatchObject({ id: FIELD_DICT.id, kind: 'python', stage: 'independent', seed, entry: 'resumo' })
      expect(ch.expect.cases).toHaveLength(3)
      expect(await sha256(canonCases(f.expected.map((value) => ({ value }))))).toBe(ch.expect.hash)
      expect(Object.keys(f.expected[0]).length, `semente ${seed}: turno cheio vazio`).toBeGreaterThan(0)
      expect(f.expected[2]).toEqual({})
      expect(ch.ladder).toHaveLength(3)
    }
  })

  it.skipIf(!PYTHON_AVAILABLE)('uma solução Python de verdade confere para várias sementes (CPython local)', async () => {
    const reference = (f: ReturnType<typeof generatePyField>) => {
      if (f.variant === 'sum') return "def resumo(leituras):\n    t = {}\n    for l in leituras:\n        t[l['maquina']] = t.get(l['maquina'], 0) + l['consumo']\n    return t\n"
      const m = f.brief.match(/status '(\w+)'|MAIS de (-?\d+)/)!
      if (f.variant === 'count_where') return `def resumo(leituras):\n    c = {}\n    for l in leituras:\n        if l['status'] == '${m[1]}':\n            c[l['maquina']] = c.get(l['maquina'], 0) + 1\n    return c\n`
      return `def resumo(leituras):\n    t = {}\n    for l in leituras:\n        t[l['maquina']] = t.get(l['maquina'], 0) + l['consumo']\n    return {k: v for k, v in t.items() if v > ${m[2]}}\n`
    }
    for (let seed = 1; seed <= 24; seed++) {
      const f = generatePyField(seed)
      const ch = await pyFieldChallenge(seed)
      const out = collectLocal(reference(f), ch.entry, ch.cases)
      expect(out.error, `semente ${seed}: ${out.error}`).toBeUndefined()
      expect(await sha256(canonCases(out.results!)), `semente ${seed}`).toBe(ch.expect.hash)
    }
  })
})

describe('missão do Porto de Babel (inglês: escuta)', () => {
  it('tem a cadeia completa: conversa → guiada → independente → combate → transferência → debrief', () => {
    const q = WORLD.quests.en_radio
    expect(q.kind).toBe('mastery')
    expect(q.steps.map((s) => s.id)).toEqual(['talk', 'guided', 'independent', 'bot', 'transfer', 'debrief'])
    expect(WORLD.dialogues.marisa_debrief.debrief).toBe('en_radio')
    expect(questActivities('en_radio').map((c) => [c.kind, c.id, c.stage])).toEqual([
      ['english', 'radio_guided', 'guided'],
      ['english', 'radio_independent', 'independent'],
      ['english', 'radio_menu', 'independent'],
      ['english', 'radio_transfer', 'transfer'],
    ])
    expect(fieldTemplateOf('en_radio')).toBe('field_radio')
  })

  it('o portão do Porto fica em Babel (chão livre, saída livre) e a Prefeitura apresenta o Porto', () => {
    const babel = WORLD.regions.language_tower
    const port = WORLD.regions.babel_port
    const gate = babel.entities.find((e) => e.id === 'portao_porto')!
    expect(gate.kind).toBe('portal')
    expect(babel.map.legend[babel.map.rows[gate.y][gate.x]].solid).toBe(false)
    expect(babel.map.legend[babel.map.rows[Math.floor(PORT_EXIT.y)][Math.floor(PORT_EXIT.x)]].solid).toBe(false)
    expect(port.map.legend[port.map.rows[Math.floor(PORT_ENTRY.y)][Math.floor(PORT_ENTRY.x)]].solid).toBe(false)
    // O portão não cai em cima de nenhuma outra entidade da cidade gerada.
    expect(babel.entities.filter((e) => e.x === gate.x && e.y === gate.y)).toHaveLength(1)
    const intro = WORLD.dialogues.language_tower_mentor_intro
    expect(intro.nodes.some((n) => n.text.includes('Marisa'))).toBe(true)
    expect(intro.nodes[intro.nodes.length - 1].id).toBe('m3')
    expect(WORLD.dialogues.logic_temple_mentor_intro.nodes.some((n) => n.text.includes('Porto'))).toBe(false)
  })

  it('as lições têm exemplo falado e as atividades entram no catálogo como ingles, com dois conceitos', () => {
    for (const id of ['lesson_numbers', 'lesson_spell']) {
      const l = WORLD.lessons[id]
      expect(l.subject).toBe('ingles')
      expect(l.workedExample?.lang).toBe('speech')
      expect(l.explanation.length).toBeLessThanOrEqual(3)
    }
    const rows = activityCatalogRows().filter((r) => r.subject === 'ingles')
    expect(rows.map((r) => r.id).sort()).toEqual(['field_radio', 'radio_guided', 'radio_independent', 'radio_menu', 'radio_transfer'])
    expect(rows.find((r) => r.id === 'radio_transfer')?.concept).toBe('spell')
    expect(rows.find((r) => r.id === 'field_radio')).toMatchObject({ parametric: true, hash: null, dailyLimit: 5, concept: 'numbers' })
    expect(rows.filter((r) => !r.parametric).every((r) => /^[0-9a-f]{64}$/.test(r.hash!))).toBe(true)
    // Os conceitos existem como tópicos do inglês clássico (é por eles que o Control recebe a evidência).
    const topics = new Set(Object.values(WORLD.regions).length ? ['numbers', 'spell'] : [])
    for (const r of rows) expect(topics.has(r.concept), r.id).toBe(true)
  })

  it('o atendente exige ouvir o menu antes de teclar; o hash do combate é a opção do agente', async () => {
    const enc = WORLD.encounters.enc_atendente
    expect(enc.actions.find((a) => a.id === 'teclar')?.requires).toEqual(['menu'])
    expect(enc.actions.find((a) => a.id === 'ouvir')?.challenge).toBe('radio_menu')
    expect(await sha256('19')).toBe(WORLD.challenges.radio_officer.expect.hash)
  })

  it('forma canônica do inglês: algarismos e por extenso valem o mesmo; letras ignoram hifens e acentos', () => {
    expect(canonEnglishWords('Gate 7, please!')).toBe('gate seven please')
    expect(canonEnglishWords("I'm at gate fifteen")).toBe('i am at gate fifteen')
    expect(canonEnField('fifteen', 'digits')).toBe('15')
    expect(canonEnField(' Gate 11 ', 'digits')).toBe('11')
    expect(canonEnField('07', 'digits')).toBe('7')
    expect(canonEnField('k-a-l-i-n-a', 'letters')).toBe('KALINA')
    expect(canonEnField('Kalína', 'letters')).toBe('KALINA')
    expect(canonEnField('', 'digits')).toBe('')
  })
})

describe('revisão de campo em inglês (parametrizada)', () => {
  it('a mesma semente gera o mesmo exercício; sementes diferentes variam a situação e os números', () => {
    expect(generateEnField(42)).toEqual(generateEnField(42))
    expect(new Set([1, 2, 3].map((s) => generateEnField(s).variant)).size).toBe(3)
    expect(generateEnField(10).lines).not.toEqual(generateEnField(13).lines)
  })

  it('o valor esperado de cada campo está na transmissão e os hashes saem dele (várias sementes)', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const f = generateEnField(seed)
      const ch = await enFieldChallenge(seed)
      expect(ch).toMatchObject({ id: FIELD_RADIO.id, kind: 'english', stage: 'independent', seed })
      expect(ch.task.type).toBe('form')
      expect(ch.expect.parts).toHaveLength(f.fields.length)
      const spoken = canonEnglishWords(enTranscript(ch))
      f.fields.forEach((field, i) => {
        if (field.normalize === 'letters') expect(spoken.replace(/ /g, ''), `semente ${seed}: ${field.id}`).toContain(f.expected[i].toLowerCase())
        else expect(spoken.split(' '), `semente ${seed}: ${field.id}=${f.expected[i]}`).toContain(canonEnglishWords(f.expected[i]))
      })
      const canon = f.expected.map((v, i) => canonEnField(v, f.fields[i].normalize)).join('|')
      expect(await sha256(canon), `semente ${seed}`).toBe(ch.expect.hash)
      expect(ch.ladder).toHaveLength(3)
      expect(WORLD.lessons[ch.lesson!]).toBeTruthy()
    }
  })
})
