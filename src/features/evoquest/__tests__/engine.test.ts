import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { WORLD, START } from '../content'
import { act, available, startCombat } from '../engine/combat'
import { facingEntity, parseMap, step, tileSolid } from '../engine/map'
import { applyEffects, check, completeStep, newWorld, reconcile, stepsCompletedBy } from '../engine/state'
import type { Interaction, WorldState } from '../engine/types'
import { canonSwitches, sha256 } from '../challenges'
import { RAW_SOLUTIONS } from './solutions'
import { POWER_PUZZLE } from '../content/dataCity'

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

  it('tutorial completo libera o portal e inicia a missão da cidade', () => {
    let s = newWorld(START)
    s = applyEffects(s, [{ type: 'startQuest', quest: 'tutorial' }]).state
    expect(stepsCompletedBy(s, Q, { type: 'talk', npc: 'iara', endedAt: 'i2' })).toHaveLength(0)
    s = play(s, { type: 'talk', npc: 'iara', endedAt: 'i4' })
    s = play(s, { type: 'solve', challenge: 'guild_board' })
    s = play(s, { type: 'talk', npc: 'iara', endedAt: 'r3' })
    expect(s.quests.tutorial.done).toBe(true)
    expect(s.flags.map_unlocked).toBe(true)
    expect(s.quests.sql_main).toEqual({ step: 0, done: false })
    expect(check(s, { at: 'sql_main:travel' }, Q)).toBe(true)
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
})
