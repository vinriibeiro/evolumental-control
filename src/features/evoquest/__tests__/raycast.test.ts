// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseMap } from '../engine/map'
import { WORLD } from '../content'
import { PLANT_ENTRY } from '../content/aurora'
import { aimedEntity, angleOf, bestLookAngle, castColumn, dirOf, normAngle, project, renderClass, turnDelta } from '../render/raycast'

describe('primeira pessoa: ângulos', () => {
  it('direção cardeal ↔ ângulo (ida e volta) e normalização', () => {
    for (const d of ['up', 'right', 'down', 'left'] as const) expect(dirOf(angleOf(d))).toBe(d)
    expect(dirOf(angleOf('up') + 0.3)).toBe('up')
    expect(normAngle(Math.PI * 3)).toBeCloseTo(Math.PI)
    expect(normAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2)
    expect(turnDelta(angleOf('right'), angleOf('up'))).toBeCloseTo(-Math.PI / 2)
    expect(turnDelta(angleOf('left'), angleOf('up'))).toBeCloseTo(Math.PI / 2)
  })
})

describe('primeira pessoa: raios na grade', () => {
  const city = parseMap(WORLD.regions.data_city.map)

  it('a porta fechada é parede; aberta, o raio passa e acha a parede de trás', () => {
    // Em frente à porta de segurança (6,7), olhando para cima.
    const closed = castColumn(city, {}, 6.5, 8.6, 0, -1)
    expect(closed.at(-1)).toMatchObject({ cellX: 6, cellY: 7, side: 1, low: false })
    expect(closed.at(-1)!.dist).toBeCloseTo(0.6, 5)
    const open = castColumn(city, { door_security: true }, 6.5, 8.6, 0, -1)
    expect(open.at(-1)!.cellY).toBeLessThan(7)
    expect(renderClass(city, 6, 7, {})).toBe('wall')
    expect(renderClass(city, 6, 7, { door_security: true })).toBe('floor')
  })

  it('muretas (água) ficam no caminho e o raio continua até a parede inteira', () => {
    const port = parseMap(WORLD.regions.babel_port.map)
    // No cais (5.5, 5.5) olhando para o norte: água nas linhas 1–2, parede na linha 0.
    const hits = castColumn(port, {}, 5.5, 5.5, 0, -1)
    expect(hits.map((h) => h.low)).toEqual([true, false])
    expect(hits[0]).toMatchObject({ sprite: 'water', cellY: 2 })
    expect(hits[0].dist).toBeCloseTo(2.5, 5)
    expect(hits[1]).toMatchObject({ sprite: 'brick', cellY: 0 })
    expect(hits[1].dist).toBeCloseTo(4.5, 5)
  })

  it('árvores não são parede para o raio (viram cartaz), mas a cerca é mureta', () => {
    const babel = parseMap(WORLD.regions.language_tower.map)
    const tree = babel.def.rows.findIndex((r) => r.includes('T'))
    expect(tree).toBeGreaterThan(0)
    expect(renderClass(babel, babel.def.rows[tree].indexOf('T'), tree, {})).toBe('sprite')
    expect(renderClass(babel, 0, 0, {})).toBe('low')
    expect(renderClass(babel, -1, 0, {})).toBe('wall')
  })

  it('o raio sai do mapa sem parede quando não há nada: lista vazia', () => {
    const open = parseMap({ rows: ['...', '...', '...'], legend: { '.': { solid: false, sprite: 'grass' } } })
    expect(castColumn(open, {}, 1.5, 1.5, 1, 0)).toEqual([])
  })
})

describe('primeira pessoa: mira, projeção e para onde olhar', () => {
  it('mira: a entidade no centro da tela e perto; de costas, nada', () => {
    const ents = WORLD.regions.data_city.entities
    expect(aimedEntity({ x: 8.5, y: 18.4 }, angleOf('up'), ents)?.id).toBe('maya')
    expect(aimedEntity({ x: 8.5, y: 18.4 }, angleOf('down'), ents)).toBeNull()
    // Um pouco fora do centro ainda vale; muito fora, não.
    expect(aimedEntity({ x: 8.5, y: 18.4 }, angleOf('up') + 0.3, ents)?.id).toBe('maya')
    expect(aimedEntity({ x: 8.5, y: 18.4 }, angleOf('up') + 0.9, ents)).toBeNull()
  })

  it('projeção: à frente fica no centro com profundidade positiva; atrás tem profundidade negativa', () => {
    const p = project(5, 5, angleOf('right'), 8, 5)
    expect(p.x).toBeCloseTo(0)
    expect(p.depth).toBeCloseTo(3)
    expect(project(5, 5, angleOf('right'), 2, 5).depth).toBeLessThan(0)
    // À direita de quem olha para o leste é o sul (y maior).
    expect(project(5, 5, angleOf('right'), 8, 6).x).toBeGreaterThan(0)
  })

  it('ao chegar à Usina, olha-se para o galpão (leste), não para a parede', () => {
    const plant = parseMap(WORLD.regions.aurora_plant.map)
    expect(dirOf(bestLookAngle(plant, {}, PLANT_ENTRY.x, PLANT_ENTRY.y, 'up'))).toBe('right')
    // Empate: mantém a preferência.
    const open = parseMap({ rows: ['#####', '#...#', '#...#', '#...#', '#####'], legend: { '#': { solid: true, sprite: 'wall' }, '.': { solid: false, sprite: 'grass' } } })
    expect(dirOf(bestLookAngle(open, {}, 2.5, 2.5, 'down'))).toBe('down')
  })
})
