// Mapa em tiles, colisão e movimento. Coordenadas em tiles (o centro do
// tile (x, y) fica em x + 0.5, y + 0.5). Sem dependência de navegador.
import type { Dir, EntityDef, MapDef, RegionDef, WorldState } from './types'

export interface GridMap {
  width: number
  height: number
  cells: string[]
  def: MapDef
}

export function parseMap(def: MapDef): GridMap {
  const width = Math.max(...def.rows.map((r) => r.length))
  const cells = def.rows.map((r) => r.padEnd(width, ' '))
  for (const r of cells) for (const ch of r) if (ch !== ' ' && !def.legend[ch]) throw new Error(`Tile sem legenda: "${ch}"`)
  return { width, height: cells.length, cells, def }
}

export function tileAt(map: GridMap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null
  const ch = map.cells[y][x]
  return ch === ' ' ? null : map.def.legend[ch]
}

export function tileSolid(map: GridMap, x: number, y: number, flags: Record<string, boolean>): boolean {
  const t = tileAt(map, x, y)
  if (!t) return true
  if (t.openWhen) return !flags[t.openWhen]
  return t.solid
}

/** Caixa de colisão do personagem (em tiles), centrada nos pés. */
const HALF_W = 0.3
const HALF_H = 0.22

export interface Body {
  x: number
  y: number
}

function overlaps(map: GridMap, x: number, y: number, flags: Record<string, boolean>, solids: Body[]): boolean {
  const x0 = Math.floor(x - HALF_W)
  const x1 = Math.floor(x + HALF_W - 1e-6)
  const y0 = Math.floor(y - HALF_H)
  const y1 = Math.floor(y + HALF_H - 1e-6)
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileSolid(map, tx, ty, flags)) return true
  // Entidades sólidas ocupam o próprio tile.
  return solids.some((e) => Math.abs(e.x + 0.5 - x) < 0.5 + HALF_W && Math.abs(e.y + 0.5 - y) < 0.5 + HALF_H)
}

export interface MoveInput {
  dx: number
  dy: number
}

export const SPEED = 4.2 // tiles por segundo

/**
 * Move com colisão separada por eixo (desliza nas paredes). Diagonais são
 * normalizadas. dt em segundos, limitado para não atravessar paredes em
 * quadros longos.
 */
export function step(map: GridMap, pos: Body, input: MoveInput, dt: number, flags: Record<string, boolean>, solids: Body[]): { x: number; y: number; facing: Dir | null; moved: boolean } {
  const len = Math.hypot(input.dx, input.dy)
  if (len < 0.01) return { x: pos.x, y: pos.y, facing: null, moved: false }
  const k = Math.min(1, len)
  const vx = (input.dx / len) * k * SPEED * Math.min(dt, 0.05)
  const vy = (input.dy / len) * k * SPEED * Math.min(dt, 0.05)
  let { x, y } = pos
  if (vx && !overlaps(map, x + vx, y, flags, solids)) x += vx
  if (vy && !overlaps(map, x, y + vy, flags, solids)) y += vy
  const facing: Dir = Math.abs(input.dx) > Math.abs(input.dy) ? (input.dx > 0 ? 'right' : 'left') : input.dy > 0 ? 'down' : 'up'
  return { x, y, facing, moved: x !== pos.x || y !== pos.y }
}

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/**
 * Entidade com que o jogador interage: a mais próxima à frente dele (ou
 * colada nele), até 1,3 tile de distância.
 */
export function facingEntity(pos: Body & { facing: Dir }, entities: EntityDef[]): EntityDef | null {
  const [fx, fy] = DIRS[pos.facing]
  let best: EntityDef | null = null
  let bestScore = Infinity
  for (const e of entities) {
    const ex = e.x + 0.5 - pos.x
    const ey = e.y + 0.5 - pos.y
    const dist = Math.hypot(ex, ey)
    if (dist > 1.3) continue
    const ahead = dist < 0.6 ? 1 : (ex * fx + ey * fy) / dist
    if (ahead < 0.35) continue
    const score = dist - ahead * 0.5
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

/** Garante uma posição válida (ex.: salvamento antigo dentro de uma parede). */
export function safeSpawn(map: GridMap, region: RegionDef, state: Pick<WorldState, 'x' | 'y' | 'flags'>): Body {
  if (!overlaps(map, state.x, state.y, state.flags, [])) return { x: state.x, y: state.y }
  return { x: region.spawn.x + 0.5, y: region.spawn.y + 0.5 }
}
