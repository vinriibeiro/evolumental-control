// Geometria da visão em primeira pessoa (raycasting sobre a grade de tiles).
// Funções puras, sem canvas: o que o renderizador desenha e o que o motor usa
// para saber para onde o jogador olha e o que está na mira.
//
// Convenção de ângulos: eixo y para baixo (como o mapa). 0 = leste (direita),
// π/2 = sul (baixo), π = oeste, −π/2 = norte (cima).
import type { GridMap } from '../engine/map'
import { tileAt } from '../engine/map'
import type { Dir, EntityDef } from '../engine/types'

export const FOV = 0.66 // metade da largura do plano da câmera (≈ 66°)
export const MAX_DEPTH = 24

const ANGLES: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }

export const angleOf = (d: Dir) => ANGLES[d]

/** Normaliza para (−π, π]. */
export function normAngle(a: number): number {
  let r = a % (Math.PI * 2)
  if (r > Math.PI) r -= Math.PI * 2
  if (r <= -Math.PI) r += Math.PI * 2
  return r
}

/** Direção cardeal mais próxima do ângulo (para salvar e para as condições do mundo). */
export function dirOf(angle: number): Dir {
  const a = normAngle(angle)
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return 'right'
  if (a > Math.PI / 4 && a <= (3 * Math.PI) / 4) return 'down'
  if (a > -(3 * Math.PI) / 4 && a <= -Math.PI / 4) return 'up'
  return 'left'
}

/** Menor giro de `from` até `to` (em radianos, com sinal). */
export const turnDelta = (from: number, to: number) => normAngle(to - from)

/**
 * Como cada tile aparece em primeira pessoa: chão (anda-se por cima), parede
 * (altura inteira), mureta (meia altura: água, cercas — vê-se por cima) ou
 * sprite (árvores: sólidas para andar, mas desenhadas como cartaz no centro).
 */
export type TileRender = 'floor' | 'wall' | 'low' | 'sprite'
export const LOW_TILES = new Set(['water', 'hedge'])
export const SPRITE_TILES = new Set(['tree'])

export function renderClass(map: GridMap, x: number, y: number, flags: Record<string, boolean>): TileRender {
  const t = tileAt(map, x, y)
  if (!t) return 'wall'
  if (t.openWhen) return flags[t.openWhen] ? 'floor' : 'wall'
  if (!t.solid) return 'floor'
  if (SPRITE_TILES.has(t.sprite)) return 'sprite'
  if (LOW_TILES.has(t.sprite)) return 'low'
  return 'wall'
}

export interface Hit {
  /** Distância perpendicular (sem olho de peixe). */
  dist: number
  /** 0 = face vertical (x), 1 = face horizontal (y). */
  side: 0 | 1
  /** Coluna da textura (0..1). */
  texX: number
  sprite: string
  low: boolean
  cellX: number
  cellY: number
}

/**
 * Lança um raio pela grade (DDA) e devolve as faces atingidas, da mais perto
 * para a mais longe: muretas no caminho e, por fim, a primeira parede inteira
 * (ou nada, se o raio sair do mapa antes).
 */
export function castColumn(map: GridMap, flags: Record<string, boolean>, px: number, py: number, rayX: number, rayY: number, maxDepth = MAX_DEPTH): Hit[] {
  const hits: Hit[] = []
  let cellX = Math.floor(px)
  let cellY = Math.floor(py)
  const deltaX = rayX === 0 ? Infinity : Math.abs(1 / rayX)
  const deltaY = rayY === 0 ? Infinity : Math.abs(1 / rayY)
  const stepX = rayX < 0 ? -1 : 1
  const stepY = rayY < 0 ? -1 : 1
  let sideX = rayX < 0 ? (px - cellX) * deltaX : (cellX + 1 - px) * deltaX
  let sideY = rayY < 0 ? (py - cellY) * deltaY : (cellY + 1 - py) * deltaY
  let prevLow = false
  for (let i = 0; i < 128; i++) {
    let side: 0 | 1
    if (sideX < sideY) {
      sideX += deltaX
      cellX += stepX
      side = 0
    } else {
      sideY += deltaY
      cellY += stepY
      side = 1
    }
    const dist = side === 0 ? sideX - deltaX : sideY - deltaY
    if (dist > maxDepth) break
    if (cellX < 0 || cellY < 0 || cellX >= map.width || cellY >= map.height) break
    const cls = renderClass(map, cellX, cellY, flags)
    if (cls === 'floor' || cls === 'sprite') {
      prevLow = false
      continue
    }
    const t = tileAt(map, cellX, cellY)!
    let wallX = side === 0 ? py + dist * rayY : px + dist * rayX
    wallX -= Math.floor(wallX)
    const texX = (side === 0 && rayX > 0) || (side === 1 && rayY < 0) ? 1 - wallX : wallX
    const hit: Hit = { dist, side, texX, sprite: t.sprite, low: cls === 'low', cellX, cellY }
    if (cls === 'low') {
      // Várias células de água seguidas: só a face de entrada do bloco é visível.
      if (!prevLow) hits.push(hit)
      prevLow = true
      continue
    }
    hits.push(hit)
    return hits
  }
  return hits
}

/** Posição de um ponto do mundo na câmera: x normalizado (−1..1 dentro da tela) e profundidade. */
export function project(px: number, py: number, angle: number, x: number, y: number): { x: number; depth: number } {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const planeX = -dirY * FOV
  const planeY = dirX * FOV
  const ex = x - px
  const ey = y - py
  const invDet = 1 / (planeX * dirY - dirX * planeY)
  const tx = invDet * (dirY * ex - dirX * ey)
  const depth = invDet * (-planeY * ex + planeX * ey)
  return { x: depth > 0 ? tx / depth : 0, depth }
}

/**
 * Entidade na mira: a mais próxima dentro de um cone estreito à frente (ou
 * colada no jogador), até `maxDist` tiles.
 */
export function aimedEntity(pos: { x: number; y: number }, angle: number, entities: EntityDef[], maxDist = 1.7): EntityDef | null {
  const fx = Math.cos(angle)
  const fy = Math.sin(angle)
  let best: EntityDef | null = null
  let bestScore = Infinity
  for (const e of entities) {
    const ex = e.x + 0.5 - pos.x
    const ey = e.y + 0.5 - pos.y
    const dist = Math.hypot(ex, ey)
    if (dist > maxDist) continue
    const ahead = dist < 0.6 ? 1 : (ex * fx + ey * fy) / dist
    // cos 28° ≈ 0.88: a entidade precisa estar quase no centro da tela.
    if (ahead < 0.88) continue
    const score = dist - ahead
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

/**
 * Para onde olhar ao chegar a um lugar: a direção cardeal com mais chão livre
 * à frente (evita nascer de cara para a parede). Empate: mantém `prefer`.
 */
export function bestLookAngle(map: GridMap, flags: Record<string, boolean>, px: number, py: number, prefer: Dir): number {
  let best = prefer
  let bestFree = -1
  for (const d of ['up', 'right', 'down', 'left'] as Dir[]) {
    const a = angleOf(d)
    const hits = castColumn(map, flags, px, py, Math.cos(a), Math.sin(a), 40)
    const wall = hits.find((h) => !h.low)
    const free = wall ? wall.dist : 40
    if (free > bestFree + 1e-6 || (d === prefer && free >= bestFree - 1e-6)) {
      bestFree = free
      best = d
    }
  }
  return angleOf(best)
}
