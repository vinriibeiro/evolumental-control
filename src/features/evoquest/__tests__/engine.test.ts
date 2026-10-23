import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { WORLD, START } from '../content'
import { act, available, startCombat } from '../engine/combat'
import { approach, facingEntity, findPath, parseMap, step, tileSolid } from '../engine/map'
import { applyEffects, check, completeStep, newWorld, reconcile, stepsCompletedBy } from '../engine/state'
import type { Interaction, WorldState } from '../engine/types'
import { canonSwitches, sha256 } from '../challenges'
import { RAW_SOLUTIONS } from './solutions'
import { POWER_PUZZLE } from '../content/dataCity'
import { CITIES, destFlag, destinationOf, STATION_SPOT, TICKET_PRICE } from '../content/cities'
import { CLASSIC_CONTENT, cityQuestId } from '../content/generatedCity'
import { buildMyCity, emptyLots, levelFor, LOT_COUNT } from '../content/myCity'
import { questCatalogRows } from '../catalogSql'
import { SUBJECTS } from '@/game/catalog'

const Q = WORLD.quests

describe('integridade do conteúdo', () => {
  it('toda referência (diálogo, desafio, combate, chefe, item, falante) existe', () => {
    for (const r of Object.values(WORLD.regions)) {
      for (const e of r.entities) {
        for (const i of e.on as Interaction[]) {
          if (i.do === 'dialogue') expect(WORLD.dialogues[i.dialogue], `${e.id} → ${i.dialogue}`).toBeTruthy()
          if (i.do === 'terminal') expect(WORLD.challenges[i.challenge], `${e.id} → ${i.challenge}`).toBeTruthy()
          if (i.do === 'puzzle') expect(WORLD.challenges[i.puzzle]).toBeTruthy()
          if (i.do === 'combat') expect(WORLD.encounters[i.encounter]).toBeTruthy()
          if (i.do === 'boss') expect(WORLD.bosses[i.boss]).toBeTruthy()
        }
      }
    }
    for (const d of Object.values(WORLD.dialogues)) {
      const ids = new Set(d.nodes.map((n) => n.id))
      expect(ids.has(d.start)).toBe(true)
      for (const n of d.nodes) {
        expect(WORLD.speakers[n.speaker], `${d.id}/${n.id}`).toBeTruthy()
        if (n.next) expect(ids.has(n.next), `${d.id}/${n.id} → ${n.next}`).toBe(true)
        for (const c of n.choices ?? []) if (c.next) expect(ids.has(c.next)).toBe(true)
        for (const e of [...(n.effects ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])]) {
          if (e.type === 'give') expect(WORLD.items[e.item]).toBeTruthy()
          if (e.type === 'startQuest') expect(Q[e.quest]).toBeTruthy()
        }
      }
    }
    for (const q of Object.values(Q))
      for (const s of q.steps) {
        if (s.objective.type === 'solve') {
          const id = s.objective.challenge
          expect(WORLD.challenges[id] || WORLD.encounters[id], `${q.id}:${s.id}`).toBeTruthy()
        }
        if (s.objective.type === 'talk' && s.objective.dialogueEnds) {
          const found = Object.values(WORLD.dialogues).some((d) => d.nodes.some((n) => n.id === s.objective.type && false) || d.nodes.some((n) => n.id === (s.objective as { dialogueEnds: string }).dialogueEnds))
          expect(found, `${q.id}:${s.id}`).toBe(true)
        }
      }
    for (const b of Object.values(WORLD.bosses)) for (const p of b.phases) expect(WORLD.challenges[p.challenge]).toBeTruthy()
  })

  it('todas as entidades são alcançáveis a partir do ponto de entrada (com as portas abertas)', () => {
    const open = { door_security: true, power_on: true, power_access: true, sentinel_down: true }
    for (const r of Object.values(WORLD.regions)) {
      const map = parseMap(r.map)
      const solid = new Set(r.entities.filter((e) => e.solid && e.kind !== 'enemy').map((e) => `${e.x},${e.y}`))
      const seen = new Set<string>()
      const queue: Array<[number, number]> = [[r.spawn.x, r.spawn.y]]
      expect(tileSolid(map, r.spawn.x, r.spawn.y, open), `${r.id} spawn`).toBe(false)
      while (queue.length) {
        const [x, y] = queue.shift()!
        const k = `${x},${y}`
        if (seen.has(k) || tileSolid(map, x, y, open) || solid.has(k)) continue
        seen.add(k)
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
      }
      for (const e of r.entities) {
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`))
        expect(near, `${r.id}: ${e.id} inalcançável`).toBe(true)
      }
    }
  })

  it('a Sentinela bloqueia a passagem até ser derrotada', () => {
    const r = WORLD.regions.data_city
    const map = parseMap(r.map)
    const s = r.entities.find((e) => e.id === 'sentinela')!
    expect(tileSolid(map, s.x, s.y - 1, {})).toBe(true)
    expect(tileSolid(map, s.x, s.y + 1, {})).toBe(true)
  })
})

describe('motor: movimento e interação', () => {
  const map = parseMap(WORLD.regions.data_city.map)

  it('colide com paredes e portas fechadas; abre com a flag', () => {
    // Na frente da porta de segurança (6,7), vindo do corredor.
    const pos = { x: 6.5, y: 8.6 }
    let p = pos
    for (let i = 0; i < 40; i++) p = step(map, p, { dx: 0, dy: -1 }, 0.05, {}, [])
    expect(p.y).toBeGreaterThan(8.1)
    p = pos
    for (let i = 0; i < 40; i++) p = step(map, p, { dx: 0, dy: -1 }, 0.05, { door_security: true }, [])
    expect(p.y).toBeLessThan(7)
  })

  it('diagonal não é mais rápida e quadros longos não atravessam paredes', () => {
    const a = step(map, { x: 5.5, y: 10.5 }, { dx: 1, dy: 0 }, 0.05, {}, [])
    const b = step(map, { x: 5.5, y: 10.5 }, { dx: 1, dy: 1 }, 0.05, {}, [])
    expect(Math.hypot(b.x - 5.5, b.y - 10.5)).toBeCloseTo(a.x - 5.5, 5)
    const c = step(map, { x: 1.5, y: 10.5 }, { dx: -1, dy: 0 }, 10, {}, [])
    expect(c.x).toBeGreaterThan(1.29)
  })

  it('interage com a entidade à frente', () => {
    const ents = WORLD.regions.data_city.entities
    expect(facingEntity({ x: 8.5, y: 18.4, facing: 'up' }, ents)?.id).toBe('maya')
    expect(facingEntity({ x: 8.5, y: 18.4, facing: 'down' }, ents)).toBeNull()
  })
})

describe('motor: missões', () => {
  const play = (s: WorldState, ev: Parameters<typeof stepsCompletedBy>[2]) => {
    for (const hit of stepsCompletedBy(s, Q, ev)) s = completeStep(s, hit.quest, hit.key.split(':')[1]).state
    return s
  }

  it('tutorial libera a Rodoviária; a missão da cidade só começa ao chegar nela', () => {
    let s = newWorld(START)
    s = applyEffects(s, [{ type: 'startQuest', quest: 'tutorial' }]).state
    expect(stepsCompletedBy(s, Q, { type: 'talk', npc: 'iara', endedAt: 'i2' })).toHaveLength(0)
    s = play(s, { type: 'talk', npc: 'iara', endedAt: 'i3' })
    s = play(s, { type: 'flag', flag: 'city_chosen' })
    s = play(s, { type: 'talk', npc: 'iara', endedAt: 'r3' })
    expect(s.flags.map_unlocked).toBe(true)
    expect(s.quests.sql_main).toBeUndefined()
    expect(check(s, { at: 'tutorial:trip' }, Q)).toBe(true)
    s = play(s, { type: 'flag', flag: 'first_trip' })
    expect(s.quests.tutorial.done).toBe(true)

    // Chegada de ônibus: efeitos de entrada da região + marca de visita.
    for (const city of ['data_city', 'language_tower']) {
      s = applyEffects(s, WORLD.regions[city].onEnter).state
      s = play(s, { type: 'flag', flag: `visited_${city}` })
    }
    expect(s.flags.city_visited).toBe(true)
    expect(s.quests.sql_main).toEqual({ step: 1, done: false })
    expect(check(s, { at: 'city_language_tower:mentor' }, Q)).toBe(true)
  })

  it('cidade gerada: só o chefe da unidade atual cumpre a etapa', () => {
    const q = Q.city_language_tower
    let s = applyEffects(newWorld(START), [{ type: 'startQuest', quest: q.id }]).state
    s = play(s, { type: 'flag', flag: 'visited_language_tower' })
    s = play(s, { type: 'talk', npc: 'language_tower_mentor', endedAt: 'm3' })
    const bosses = q.steps.flatMap((st) => (st.objective.type === 'answered' ? [st.objective.challenge] : []))
    expect(play(s, { type: 'answered', challenge: bosses[1] })).toBe(s)
    for (const b of bosses) s = play(s, { type: 'answered', challenge: b })
    expect(check(s, { at: `${q.id}:finale` }, Q)).toBe(true)
  })

  it('completeStep é idempotente e só avança a etapa atual', () => {
    let s = applyEffects(newWorld(START), [{ type: 'startQuest', quest: 'sql_main' }]).state
    expect(completeStep(s, Q.sql_main, 'door').state).toBe(s)
    s = completeStep(s, Q.sql_main, 'travel').state
    expect(completeStep(s, Q.sql_main, 'travel').state).toBe(s)
    expect(s.quests.sql_main.step).toBe(1)
  })

  it('reconcilia com o servidor: etapas confirmadas reaplicam portas e itens', () => {
    const s = reconcile(newWorld(START), Q, ['sql_main:travel', 'sql_main:talk_maya', 'sql_main:door', 'sql_main:talk_bras', 'sql_main:logs', 'sql_main:who'])
    expect(s.quests.sql_main.step).toBe(6)
    expect(s.flags.door_security).toBe(true)
    expect(s.inventory).toContain('log_impresso')
  })
})

describe('apresentação guiada (piloto automático)', () => {
  const hub = WORLD.regions.hub
  const map = parseMap(hub.map)
  const solids = hub.entities.filter((e) => e.solid)
  const spot = (id: string) => approach(map, hub.entities.find((e) => e.id === id)!, {}, solids)

  it('há caminho do início até Iara, Quadro, Dora e ônibus, sem atravessar nada', () => {
    let pos = { x: START.x, y: START.y }
    for (const id of ['iara', 'quadro', 'iara', 'dora', 'onibus']) {
      const target = spot(id)
      expect(target, id).toBeTruthy()
      const path = findPath(map, pos, target!, {}, solids)
      expect(path, `caminho até ${id}`).toBeTruthy()
      for (const p of path!) expect(tileSolid(map, Math.floor(p.x), Math.floor(p.y), {})).toBe(false)
      // Ao chegar, a entidade está à frente do personagem.
      const end = path!.length ? path![path!.length - 1] : pos
      expect(facingEntity({ ...end, facing: target!.facing }, hub.entities)?.id).toBe(id)
      pos = end
    }
  })

  it('findPath: passos de um tile, inalcançável = null', () => {
    const path = findPath(map, { x: 15.5, y: 11.5 }, { x: 15, y: 13 }, {}, [])!
    expect(path).toEqual([{ x: 15.5, y: 12.5 }, { x: 15.5, y: 13.5 }])
    expect(findPath(map, { x: 15.5, y: 11.5 }, { x: 0, y: 0 }, {}, [])).toBeNull()
  })

  it('a cidade escolhida no quadro vira o destino das falas', () => {
    expect(destinationOf({ [destFlag('archive')]: true })?.name).toBe('Vernácula')
    expect(destinationOf({})).toBeNull()
  })
})

describe('cidades e Rodoviária', () => {
  it('uma cidade por disciplina, todas jogáveis e com volta de ônibus', () => {
    expect(new Set(CITIES.map((c) => c.subject)).size).toBe(SUBJECTS.length)
    for (const c of CITIES) {
      const r = WORLD.regions[c.id]
      expect(r, c.id).toBeTruthy()
      expect(r.subject).toBe(c.subject)
      const m = parseMap(r.map)
      expect(tileSolid(m, r.spawn.x, r.spawn.y, {}), `${c.id}: nasce dentro de algo sólido`).toBe(false)
      const ponto = r.entities.find((e) => e.sprite === 'bus_stop')!
      expect(ponto.on[0]).toMatchObject({ do: 'effects', effects: [{ type: 'teleport', ...STATION_SPOT }] })
      expect(r.onEnter).toContainEqual({ type: 'flag', flag: 'city_visited' })
    }
    const hub = parseMap(WORLD.regions.hub.map)
    expect(tileSolid(hub, Math.floor(STATION_SPOT.x), Math.floor(STATION_SPOT.y), {})).toBe(false)
  })

  it('etapas das cidades geradas exigem os chefes reais de cada unidade, com moedas', () => {
    for (const c of CITIES.filter((x) => CLASSIC_CONTENT[x.subject])) {
      const q = Q[cityQuestId(c.id)]
      const units = CLASSIC_CONTENT[c.subject].units
      const answered = q.steps.filter((s) => s.objective.type === 'answered')
      expect(answered).toHaveLength(units.length)
      answered.forEach((s, i) => {
        const boss = units[i].challenges.find((ch) => ch.boss)
        expect(s.objective).toEqual({ type: 'answered', challenge: boss?.id })
        expect(WORLD.rewards[`${q.id}:${s.id}`].coins).toBeGreaterThan(0)
      })
    }
    const rows = questCatalogRows()
    expect(rows.filter((r) => r.answer).every((r) => r.hash === null && r.requires)).toBe(true)
  })

  it('Minha Cidade: prédio cresce com as horas estudadas', () => {
    expect(levelFor(0).name).toBe('Terreno')
    expect(levelFor(3600).name).toBe('Fundação')
    expect(levelFor(5 * 3600 - 1).name).toBe('Fundação')
    expect(levelFor(100 * 3600)).toMatchObject({ name: 'Torre', next: null, progress: 1 })
    expect(levelFor(10 * 3600).progress).toBeCloseTo(0.5)
    const lots = emptyLots().map((l, i) => ({ ...l, subjectId: `s${i}`, name: `M${i}`, color: '#2a78d6', level: i }))
    const r = buildMyCity(lots)
    const m = parseMap(r.map)
    expect(tileSolid(m, r.spawn.x, r.spawn.y, {})).toBe(false)
    expect(r.entities.filter((e) => e.id.startsWith('lote_'))).toHaveLength(LOT_COUNT)
    expect(r.map.rows.join('')).toContain('Y') // a torre (nível 5) tem telhado dourado
    expect(r.entities.find((e) => e.id === 'lote_4')?.name).toBe('M4 · Prédio')
    // Cada prédio construído tem um morador (NPC) que abre a revisão de flashcards da matéria.
    const moradores = r.entities.filter((e) => e.id.startsWith('morador_'))
    expect(moradores).toHaveLength(LOT_COUNT)
    expect(moradores[2]).toMatchObject({ kind: 'npc', sprite: 'morador', on: [{ do: 'cards', subject: 's2' }] })
    expect(WORLD.speakers.morador).toBeTruthy()
    const empty = buildMyCity(emptyLots())
    expect(empty.entities.some((e) => e.id.startsWith('morador_'))).toBe(false)
    for (const m of moradores) expect(tileSolid(parseMap(r.map), m.x, m.y, {}), `morador ${m.id} em tile sólido`).toBe(false)
  })
})

describe('motor: combate por ações', () => {
  const def = WORLD.encounters.enc_sentinel

  it('força bruta não vence: o firewall absorve e o inimigo se recupera', () => {
    let s = startCombat(def)
    for (let i = 0; i < 200 && s.outcome === 'ongoing'; i++) s = act(def, s, 'pulse')
    expect(s.outcome).toBe('lost')
    expect(s.integrity).toBeGreaterThan(0)
  })

  it('investigar → descobrir → agir vence; ações exigem o conhecimento certo', () => {
    let s = startCombat(def)
    expect(available(def, s).map((a) => a.id)).not.toContain('kill')
    s = act(def, s, 'logs')
    s = act(def, s, 'scan')
    expect(s.turn).toBe(0) // leitura não dá a vez ao inimigo
    s = act(def, s, 'procs', true)
    s = act(def, s, 'kill', false)
    expect(s.firewall).toBeGreaterThan(0)
    s = act(def, s, 'kill', true)
    expect(s.firewall).toBe(0)
    s = act(def, s, 'trace', true)
    s = act(def, s, 'block', true)
    expect(s.outcome).toBe('won')
  })
})

describe('desafios: puzzle e backend local', () => {
  it('o estado correto do painel cumpre todas as regras e bate com o hash', async () => {
    const on = { A: false, B: true, C: true, D: false }
    expect(POWER_PUZZLE.rules.every((r) => r.ok(on))).toBe(true)
    expect(await sha256(canonSwitches(POWER_PUZZLE, on))).toBe(POWER_PUZZLE.expect.hash)
    // Solução única.
    let ok = 0
    for (let m = 0; m < 16; m++) {
      const s = { A: Boolean(m & 1), B: Boolean(m & 2), C: Boolean(m & 4), D: Boolean(m & 8) }
      if (POWER_PUZZLE.rules.every((r) => r.ok(s))) ok++
    }
    expect(ok).toBe(1)
  })

  it('backend local espelha a RPC: ordem, hash e crédito único', async () => {
    const b = new LocalBackend(`rpg-${Date.now()}`)
    await expect(b.gameCompleteStep('sql_main:talk_maya', null)).rejects.toThrow(/anterior/)
    expect(await b.gameCompleteStep('sql_main:travel', null)).toMatchObject({ applied: true, xp: 0 })
    for (const s of ['talk_maya', 'door', 'talk_bras', 'logs', 'who']) {
      await b.gameCompleteStep(`sql_main:${s}`, null).catch(() => null)
    }
    // door exige o hash: sem resposta, a cadeia para em talk_maya.
    await expect(b.gameCompleteStep('sql_main:sentinel', RAW_SOLUTIONS.enc_sentinel)).rejects.toThrow(/anterior/)
    expect((await b.gameTotals()).xp).toBe(0)
  })

  it('backend local: passagens (vale grátis, depois moedas) e chefe exigido', async () => {
    const b = new LocalBackend(`rpg-ticket-${Date.now()}`)
    await expect(b.gameBuyTicket('archive')).rejects.toThrow(/Rodoviária/)
    await b.gameCompleteStep('tutorial:talk_iara', null)
    await b.gameCompleteStep('tutorial:board', null)
    await b.gameCompleteStep('tutorial:report', null)
    await expect(b.gameBuyTicket('atlantida')).rejects.toThrow(/desconhecida/)
    expect(await b.gameBuyTicket('archive')).toEqual({ bought: true, price: 0 })
    expect(await b.gameBuyTicket('archive')).toEqual({ bought: false, price: 0 })
    await expect(b.gameBuyTicket('data_city')).rejects.toThrow(/insuficientes/)

    // Chefe da unidade 1 de Português: só vale depois de acertado.
    const q = cityQuestId('archive')
    await b.gameCompleteStep(`${q}:arrive`, null)
    await b.gameCompleteStep(`${q}:mentor`, null)
    await expect(b.gameCompleteStep(`${q}:unit_1`, null)).rejects.toThrow(/não vencido/)
    const boss = (Q[q].steps[2].objective as { challenge: string }).challenge
    const session = await b.gameStart({ id: crypto.randomUUID(), subjectId: 'portugues', unitId: null, mode: 'boss', queue: [boss], plannedSeconds: 300 })
    await b.insert('game_answers', [{ id: crypto.randomUUID(), session_id: session.id, challenge_id: boss, subject_id: 'portugues', correct: true } as never])
    expect(await b.gameCompleteStep(`${q}:unit_1`, null)).toMatchObject({ applied: true, coins: 25 })

    await b.insert('game_rewards', [{ id: crypto.randomUUID(), source: 'test:bonus', kind: 'mission', xp: 0, coins: 100 } as never])
    const before = (await b.gameTotals()).coins
    expect(await b.gameBuyTicket('data_city')).toEqual({ bought: true, price: TICKET_PRICE })
    expect((await b.gameTotals()).coins).toBe(before - TICKET_PRICE)
  })
})
