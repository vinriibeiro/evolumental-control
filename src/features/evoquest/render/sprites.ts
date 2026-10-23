// Pixel art procedural (16×16 por tile). Nada de imagens externas: cada tile
// e personagem é desenhado por código uma vez e guardado em cache.
import type { CharacterLook, Dir } from '../engine/types'

export const TILE = 16

type Ctx = CanvasRenderingContext2D

const cache = new Map<string, HTMLCanvasElement>()

function make(key: string, draw: (c: Ctx) => void): HTMLCanvasElement {
  const hit = cache.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = TILE
  cv.height = TILE
  const c = cv.getContext('2d')!
  draw(c)
  cache.set(key, cv)
  return cv
}

// Ruído determinístico para texturas (sem Math.random: o mapa não "pisca").
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const px = (c: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function speckle(c: Ctx, base: string, dots: string[], density: number, seed: number) {
  px(c, base, 0, 0, TILE, TILE)
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (hash(x, y, seed) < density) px(c, dots[Math.floor(hash(y, x, seed + 1) * dots.length)], x, y)
}

const TILES: Record<string, (c: Ctx) => void> = {
  // ── Vila ──
  grass: (c) => speckle(c, '#5f9e4b', ['#6fb056', '#4f8a3f', '#78bb5d'], 0.18, 1),
  flowers: (c) => {
    speckle(c, '#5f9e4b', ['#6fb056', '#4f8a3f'], 0.15, 2)
    for (const [x, y, col] of [[3, 4, '#f5deb3'], [10, 3, '#e87ba4'], [6, 11, '#eda100'], [12, 12, '#f5deb3']] as const) {
      px(c, col, x, y, 2, 2)
      px(c, '#3b2b20', x + 1, y + 2)
    }
  },
  path: (c) => speckle(c, '#c9a77a', ['#b8956a', '#d6b88e', '#a9865c'], 0.22, 3),
  plaza: (c) => {
    px(c, '#b7aa98', 0, 0, TILE, TILE)
    px(c, '#9d907e', 0, 7, TILE, 1)
    px(c, '#9d907e', 7, 0, 1, 7)
    px(c, '#9d907e', 15, 8, 1, 8)
    px(c, '#c8bcab', 1, 1, 5, 1)
    px(c, '#c8bcab', 9, 9, 5, 1)
  },
  hedge: (c) => {
    speckle(c, '#2f6b35', ['#3c7f41', '#24562a', '#4a8f4c'], 0.35, 4)
    px(c, '#1e4723', 0, 14, TILE, 2)
  },
  tree: (c) => {
    speckle(c, '#5f9e4b', ['#4f8a3f'], 0.12, 5)
    px(c, '#6b4a2b', 7, 10, 2, 5)
    c.fillStyle = '#2f7a3a'
    c.beginPath()
    c.arc(8, 7, 6, 0, Math.PI * 2)
    c.fill()
    px(c, '#3f9a48', 5, 3, 3, 2)
    px(c, '#245f2c', 9, 9, 4, 2)
  },
  roof: (c) => {
    px(c, '#9b3d2f', 0, 0, TILE, TILE)
    for (let y = 0; y < TILE; y += 4) {
      px(c, '#7f2f24', 0, y + 3, TILE, 1)
      for (let x = (y / 4) % 2 ? 0 : 4; x < TILE; x += 8) px(c, '#7f2f24', x, y, 1, 3)
    }
  },
  wall: (c) => {
    px(c, '#e6d7bd', 0, 0, TILE, TILE)
    px(c, '#c9b694', 0, 15, TILE, 1)
    px(c, '#8a6a46', 3, 4, 4, 5)
    px(c, '#a9d4e8', 4, 5, 2, 3)
    px(c, '#8a6a46', 10, 4, 4, 5)
    px(c, '#a9d4e8', 11, 5, 2, 3)
  },
  door: (c) => {
    px(c, '#e6d7bd', 0, 0, TILE, TILE)
    px(c, '#6b4a2b', 3, 2, 10, 14)
    px(c, '#8a6239', 4, 3, 8, 13)
    px(c, '#eda100', 10, 9, 1, 1)
  },
  water: (c) => {
    speckle(c, '#3a7bbf', ['#4d8fd1', '#2f6aa6'], 0.15, 6)
    px(c, '#9fd0f5', 3, 5, 4, 1)
    px(c, '#9fd0f5', 9, 11, 3, 1)
  },
  // ── Cidade dos Dados ──
  metal_floor: (c) => {
    px(c, '#1d2430', 0, 0, TILE, TILE)
    px(c, '#252e3c', 0, 0, TILE, 1)
    px(c, '#252e3c', 0, 0, 1, TILE)
    px(c, '#141a23', 15, 0, 1, TILE)
    px(c, '#141a23', 0, 15, TILE, 1)
    px(c, '#2c3647', 7, 7, 2, 2)
  },
  neon_floor: (c) => {
    TILES.metal_floor(c)
    px(c, '#0b5b78', 0, 7, TILE, 2)
    px(c, '#38d0ff', 0, 7, TILE, 1)
  },
  core_floor: (c) => {
    px(c, '#171b2b', 0, 0, TILE, TILE)
    px(c, '#26305a', 0, 0, TILE, 1)
    px(c, '#26305a', 0, 0, 1, TILE)
    px(c, '#3b4f9a', 7, 7, 2, 2)
  },
  cable: (c) => {
    TILES.metal_floor(c)
    px(c, '#3a2a10', 0, 5, TILE, 6)
    px(c, '#eda100', 0, 6, TILE, 1)
    px(c, '#2a78d6', 0, 8, TILE, 1)
    px(c, '#e34948', 0, 9, TILE, 1)
  },
  metal_wall: (c) => {
    px(c, '#3a4352', 0, 0, TILE, TILE)
    px(c, '#4a5568', 0, 0, TILE, 2)
    px(c, '#2a313d', 0, 12, TILE, 4)
    px(c, '#56637a', 2, 5, 3, 1)
    px(c, '#56637a', 10, 8, 4, 1)
  },
  rack: (c) => {
    px(c, '#11151c', 0, 0, TILE, TILE)
    px(c, '#2a313d', 1, 0, 14, 15)
    for (let y = 2; y < 14; y += 3) {
      px(c, '#1a1f28', 2, y, 12, 2)
      px(c, hash(y, 3) > 0.5 ? '#38ff9c' : '#38d0ff', 3, y, 1, 1)
      px(c, '#eda100', 5, y, 1, 1)
    }
  },
  door_security: (c) => door(c, '#eda100'),
  door_core: (c) => door(c, '#7c8cff'),
  door_power: (c) => door(c, '#38ff9c'),
}

function door(c: Ctx, color: string) {
  px(c, '#3a4352', 0, 0, TILE, TILE)
  px(c, '#20262f', 2, 1, 12, 15)
  px(c, '#2c3440', 3, 2, 4, 14)
  px(c, '#2c3440', 9, 2, 4, 14)
  px(c, color, 7, 2, 2, 14)
}

/** Porta destrancada: piso com trilho, para o jogador ver que pode passar. */
function openDoor(c: Ctx, color: string) {
  TILES.metal_floor(c)
  px(c, '#20262f', 0, 0, 2, TILE)
  px(c, '#20262f', 14, 0, 2, TILE)
  px(c, color, 2, 0, 1, TILE)
  px(c, color, 13, 0, 1, TILE)
}

/** Clareia (amt > 0) ou escurece (amt < 0) uma cor #rrggbb. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)))
  const [r, g, b] = [f(n >> 16), f((n >> 8) & 255), f(n & 255)]
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const HEX = /^#[0-9a-f]{6}$/i

/** Tiles com cor no nome (`roof:#rrggbb`, `ground:#rrggbb`): cada cidade tem a sua. */
function parametric(name: string): ((c: Ctx) => void) | null {
  const [kind, color] = name.split(':')
  if (!color || !HEX.test(color)) return null
  if (kind === 'roof')
    return (c) => {
      px(c, color, 0, 0, TILE, TILE)
      for (let y = 0; y < TILE; y += 4) {
        px(c, shade(color, -0.12), 0, y + 3, TILE, 1)
        for (let x = (y / 4) % 2 ? 0 : 4; x < TILE; x += 8) px(c, shade(color, -0.12), x, y, 1, 3)
      }
    }
  if (kind === 'ground') return (c) => speckle(c, color, [shade(color, 0.06), shade(color, -0.06), shade(color, 0.1)], 0.2, 7)
  return null
}

// Ônibus 64×32 (4 × 2 tiles), visto de cima; cada tile recorta um pedaço.
let busImage: HTMLCanvasElement | null = null
function bus(): HTMLCanvasElement {
  if (busImage) return busImage
  const cv = document.createElement('canvas')
  cv.width = TILE * 4
  cv.height = TILE * 2
  const c = cv.getContext('2d')!
  const floor = tileSprite('asphalt')
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) c.drawImage(floor, x * TILE, y * TILE)
  px(c, 'rgba(0,0,0,0.3)', 3, 28, 60, 3)
  px(c, '#eda100', 2, 3, 60, 25)
  px(c, '#c47f12', 2, 22, 60, 6)
  px(c, '#f5deb3', 4, 5, 56, 2)
  for (let x = 8; x < 56; x += 10) px(c, '#2a4a6a', x, 9, 8, 8)
  px(c, '#2a4a6a', 56, 8, 5, 12) // para-brisa
  px(c, '#20262f', 12, 27, 7, 3)
  px(c, '#20262f', 44, 27, 7, 3)
  px(c, '#6b4a2b', 48, 18, 6, 9) // porta
  px(c, '#fffbe6', 61, 6, 1, 3)
  px(c, '#fffbe6', 61, 20, 1, 3)
  busImage = cv
  return cv
}

Object.assign(TILES, {
  asphalt: (c: Ctx) => speckle(c, '#3b3f46', ['#45494f', '#33363c'], 0.2, 8),
  ticket_window: (c: Ctx) => {
    TILES.wall(c)
    px(c, '#e6d7bd', 3, 4, 10, 5)
    px(c, '#2a4a6a', 3, 3, 10, 7)
    px(c, '#a9d4e8', 4, 4, 8, 3)
    px(c, '#8a6239', 2, 10, 12, 2)
    px(c, '#f5deb3', 5, 12, 6, 2)
  },
  dirt: (c: Ctx) => speckle(c, '#9a7650', ['#8a6844', '#a9845c', '#7d5c3a'], 0.25, 9),
  foundation: (c: Ctx) => {
    px(c, '#9a9488', 0, 0, TILE, TILE)
    px(c, '#7e786d', 0, 7, TILE, 1)
    px(c, '#7e786d', 7, 0, 1, 7)
    px(c, '#7e786d', 3, 8, 1, 8)
    px(c, '#7e786d', 11, 8, 1, 8)
    px(c, '#b9b3a6', 0, 0, TILE, 1)
  },
  wall_tall: (c: Ctx) => {
    px(c, '#d9cbb2', 0, 0, TILE, TILE)
    for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) {
      px(c, '#6b5a44', x, y, 5, 5)
      px(c, '#a9d4e8', x + 1, y + 1, 3, 3)
    }
  },
})
for (let i = 0; i < 8; i++)
  TILES[`bus_${i}`] = (c) => c.drawImage(bus(), (i % 4) * TILE, Math.floor(i / 4) * TILE, TILE, TILE, 0, 0, TILE, TILE)

export function tileSprite(name: string, open = false): HTMLCanvasElement {
  const p = parametric(name)
  if (p) return make(name, p)
  if (open) {
    const color = name === 'door_security' ? '#eda100' : name === 'door_core' ? '#7c8cff' : '#38ff9c'
    return make(`${name}:open`, (c) => openDoor(c, color))
  }
  return make(name, TILES[name] ?? ((c) => px(c, '#ff00ff', 0, 0, TILE, TILE)))
}

// ── Personagens ──────────────────────────────────────────────────────────
/**
 * Personagem 12×15 desenhado no tile (x, y em pixels do mundo, pés no centro).
 * frame alterna as pernas ao andar; facing muda olhos/cabelo.
 */
export function drawCharacter(c: Ctx, x: number, y: number, look: CharacterLook, facing: Dir, frame: number, bob = 0) {
  const ox = Math.round(x - 6)
  const oy = Math.round(y - 15 + bob)
  // sombra
  c.fillStyle = 'rgba(0,0,0,0.28)'
  c.fillRect(ox + 2, Math.round(y) - 1, 8, 2)
  // pernas
  const step = frame % 2 === 1
  px(c, '#2a2320', ox + 3, oy + 12, 2, step ? 2 : 3)
  px(c, '#2a2320', ox + 7, oy + 12, 2, step ? 3 : 2)
  // corpo
  px(c, look.outfit, ox + 2, oy + 7, 8, 6)
  px(c, look.accent, ox + 2, oy + 9, 8, 1)
  px(c, look.skin, ox + (facing === 'left' ? 1 : 10), oy + 8, 1, 3)
  px(c, look.skin, ox + (facing === 'right' ? 10 : 1), oy + 8, 1, 3)
  // cabeça
  px(c, look.skin, ox + 3, oy + 2, 6, 5)
  px(c, look.hair, ox + 2, oy + 1, 8, 2)
  if (facing === 'up') px(c, look.hair, ox + 3, oy + 2, 6, 4)
  else {
    if (facing !== 'right') px(c, look.hair, ox + 2, oy + 2, 1, 3)
    if (facing !== 'left') px(c, look.hair, ox + 9, oy + 2, 1, 3)
    const ex = facing === 'left' ? -1 : facing === 'right' ? 1 : 0
    px(c, '#1a1210', ox + 4 + ex, oy + 4, 1, 1)
    px(c, '#1a1210', ox + 7 + ex, oy + 4, 1, 1)
  }
}

/** Objetos e criaturas (não humanos) desenhados no tile. */
export function drawObject(c: Ctx, sprite: string, x: number, y: number, t: number, accent?: string) {
  const ox = Math.round(x)
  const oy = Math.round(y)
  switch (sprite) {
    case 'terminal': {
      px(c, '#2a313d', ox + 2, oy + 3, 12, 12)
      px(c, '#0b1d16', ox + 3, oy + 4, 10, 7)
      const blink = Math.floor(t * 2) % 2 === 0
      px(c, '#38ff9c', ox + 4, oy + 5, 5, 1)
      px(c, '#38ff9c', ox + 4, oy + 7, 3, 1)
      if (blink) px(c, '#38ff9c', ox + 8, oy + 9, 2, 1)
      px(c, '#4a5568', ox + 4, oy + 12, 8, 2)
      break
    }
    case 'panel': {
      px(c, '#2a313d', ox + 1, oy + 1, 14, 14)
      for (let i = 0; i < 4; i++) {
        px(c, '#11151c', ox + 3 + i * 3, oy + 4, 2, 7)
        px(c, accent ?? '#eda100', ox + 3 + i * 3, oy + (i % 2 ? 5 : 8), 2, 2)
      }
      break
    }
    case 'coffee': {
      px(c, '#6b4a2b', ox + 3, oy + 2, 10, 13)
      px(c, '#3b2b20', ox + 5, oy + 4, 6, 4)
      px(c, '#e34948', ox + 11, oy + 4, 1, 1)
      px(c, '#f5deb3', ox + 6, oy + 10, 4, 3)
      if (Math.floor(t * 1.5) % 2) px(c, 'rgba(255,255,255,0.5)', ox + 7, oy + 7, 1, 2)
      break
    }
    case 'board': {
      px(c, '#6b4a2b', ox + 1, oy + 2, 14, 10)
      px(c, '#f5deb3', ox + 2, oy + 3, 12, 8)
      const lit = accent === 'lit'
      for (let i = 0; i < 3; i++) px(c, lit ? '#eda100' : '#c9b694', ox + 3, oy + 4 + i * 2, 9 - i * 2, 1)
      px(c, '#6b4a2b', ox + 3, oy + 12, 1, 4)
      px(c, '#6b4a2b', ox + 12, oy + 12, 1, 4)
      break
    }
    case 'sign': {
      px(c, '#6b4a2b', ox + 7, oy + 8, 2, 8)
      px(c, '#8a6239', ox + 2, oy + 2, 12, 7)
      px(c, '#f5deb3', ox + 4, oy + 4, 8, 1)
      px(c, '#f5deb3', ox + 4, oy + 6, 5, 1)
      break
    }
    case 'bus_stop': {
      px(c, '#3b3f46', ox + 7, oy + 4, 2, 12)
      px(c, '#2f5f8a', ox + 3, oy + 1, 10, 7)
      px(c, '#f5deb3', ox + 4, oy + 2, 8, 5)
      // ônibus estilizado na placa
      px(c, '#eda100', ox + 5, oy + 3, 6, 3)
      px(c, '#2a4a6a', ox + 6, oy + 3, 4, 1)
      px(c, '#20262f', ox + 6, oy + 6, 1, 1)
      px(c, '#20262f', ox + 9, oy + 6, 1, 1)
      break
    }
    case 'portal': {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3)
      c.save()
      c.globalAlpha = 0.35 + 0.35 * pulse
      c.fillStyle = '#7c8cff'
      c.beginPath()
      c.ellipse(ox + 8, oy + 9, 7, 6, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
      c.strokeStyle = '#deb887'
      c.lineWidth = 1
      c.beginPath()
      c.ellipse(ox + 8, oy + 9, 7, 6, 0, 0, Math.PI * 2)
      c.stroke()
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + (i * Math.PI) / 2
        px(c, '#f5deb3', ox + 8 + Math.round(Math.cos(a) * 5), oy + 9 + Math.round(Math.sin(a) * 4), 1, 1)
      }
      break
    }
    case 'sentinel': {
      const hover = Math.round(Math.sin(t * 2) * 1)
      c.fillStyle = 'rgba(0,0,0,0.3)'
      c.fillRect(ox + 3, oy + 14, 10, 2)
      px(c, '#59606b', ox + 2, oy + 2 + hover, 12, 10)
      px(c, '#2c3138', ox + 2, oy + 9 + hover, 12, 3)
      px(c, '#11151c', ox + 4, oy + 4 + hover, 8, 3)
      const sweep = Math.round((Math.sin(t * 2.5) + 1) * 3)
      px(c, '#ff3d3d', ox + 4 + sweep, oy + 5 + hover, 2, 1)
      px(c, '#ff3d3d', ox + 1, oy + 6 + hover, 1, 2)
      px(c, '#ff3d3d', ox + 14, oy + 6 + hover, 1, 2)
      break
    }
    case 'root': {
      const flick = Math.sin(t * 7) > 0.6
      c.save()
      c.globalAlpha = flick ? 0.65 : 0.9
      px(c, '#120814', ox + 3, oy, 10, 16)
      for (let i = 0; i < 7; i++) px(c, '#ff3d6e', ox + 4 + ((i * 3 + Math.floor(t * 6)) % 8), oy + 1 + i * 2, 2, 1)
      px(c, '#ff3d6e', ox + 5, oy + 3, 2, 1)
      px(c, '#ff3d6e', ox + 9, oy + 3, 2, 1)
      c.restore()
      break
    }
    default:
      px(c, '#ff00ff', ox + 4, oy + 4, 8, 8)
  }
}

/** Marca de missão ("!") flutuando sobre a entidade — com forma, não só cor. */
export function drawMarker(c: Ctx, x: number, y: number, t: number) {
  const oy = Math.round(y - 22 + Math.sin(t * 4) * 1.5)
  const ox = Math.round(x - 3)
  px(c, '#3b2b20', ox, oy, 7, 9)
  px(c, '#eda100', ox + 1, oy + 1, 5, 7)
  px(c, '#3b2b20', ox + 3, oy + 2, 1, 3)
  px(c, '#3b2b20', ox + 3, oy + 6, 1, 1)
}
