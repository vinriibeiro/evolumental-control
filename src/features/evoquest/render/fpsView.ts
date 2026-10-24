// Visão em primeira pessoa: desenha paredes, chão, céu/teto e sprites
// (NPCs, objetos, árvores) a partir da mesma pixel art dos tiles, num buffer
// de baixa resolução que depois é ampliado sem suavização (pixel art nítida).
import type { GridMap } from '../engine/map'
import { tileAt } from '../engine/map'
import { castColumn, FOV, MAX_DEPTH, project, renderClass } from './raycast'
import { TILE, tileSprite } from './sprites'

export interface Billboard {
  /** Centro no mundo (em tiles) e imagem com os pés na borda de baixo (largura 16 = 1 tile). */
  x: number
  y: number
  img: HTMLCanvasElement
  focus?: boolean
}

export interface Scene {
  map: GridMap
  flags: Record<string, boolean>
  /** Céu de dia (cidades, Vila), céu de noite (Cidade dos Dados) ou teto (interiores). */
  sky: 'day' | 'night' | 'none'
  px: number
  py: number
  angle: number
  /** Deslocamento vertical do horizonte (balanço do passo), em pixels do buffer. */
  bob: number
  sprites: Billboard[]
}

export interface FocusRect {
  x: number
  y: number
  w: number
  h: number
}

type Texture = { data: Uint32Array; w: number; h: number }

const texCache = new Map<string, Texture>()
function texture(name: string, open = false): Texture {
  const key = `${name}${open ? ':open' : ''}`
  let t = texCache.get(key)
  if (!t) {
    const cv = tileSprite(name, open)
    const c = cv.getContext('2d')!
    t = { data: new Uint32Array(c.getImageData(0, 0, cv.width, cv.height).data.buffer), w: cv.width, h: cv.height }
    texCache.set(key, t)
  }
  return t
}

// Cartazes são canvases novos a cada mudança de quadro de animação; a leitura
// dos pixels fica guardada por canvas (some com ele).
const imageCache = new WeakMap<HTMLCanvasElement, Texture>()
function imageTexture(cv: HTMLCanvasElement): Texture {
  let t = imageCache.get(cv)
  if (!t) {
    const c = cv.getContext('2d')!
    t = { data: new Uint32Array(c.getImageData(0, 0, cv.width, cv.height).data.buffer), w: cv.width, h: cv.height }
    imageCache.set(cv, t)
  }
  return t
}

/** Escurece um pixel ABGR (little-endian) por um fator 0..1. */
function shade(v: number, f: number): number {
  if (f >= 1) return v
  const r = (v & 255) * f
  const g = ((v >>> 8) & 255) * f
  const b = ((v >>> 16) & 255) * f
  return ((v >>> 24) << 24) | (b << 16) | (g << 8) | r
}

const rgb = (r: number, g: number, b: number) => (255 << 24) | (b << 16) | (g << 8) | r
const mix = (a: [number, number, number], b: [number, number, number], t: number) => rgb(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t))

const SKY_TOP: [number, number, number] = [63, 143, 214]
const SKY_HORIZON: [number, number, number] = [191, 224, 245]
const NIGHT_TOP: [number, number, number] = [8, 11, 24]
const NIGHT_HORIZON: [number, number, number] = [46, 58, 92]
const CEIL_FAR: [number, number, number] = [18, 23, 33]
const CEIL_NEAR: [number, number, number] = [58, 70, 90]

/** Interiores são pequenos e iluminados: a névoa é mais suave do que ao ar livre; à noite, a rua some mais cedo. */
const fogFor = (sky: Scene['sky']) =>
  sky === 'day' ? (dist: number) => Math.max(0.18, Math.min(1, 1.12 - dist / 20)) : sky === 'night' ? (dist: number) => Math.max(0.22, Math.min(1, 1.15 - dist / 16)) : (dist: number) => Math.max(0.4, Math.min(1, 1.3 - dist / 14))

export class FirstPersonView {
  private buffer: HTMLCanvasElement = document.createElement('canvas')
  private image: ImageData | null = null
  private pixels: Uint32Array = new Uint32Array(0)
  private zFull = new Float32Array(0)
  private zLow = new Float32Array(0)
  private lowTop = new Int32Array(0)
  private floorTex: Array<Texture | null> = []
  private floorMap: GridMap | null = null
  private floorFlags = ''

  /** Resolução interna: pixel art legível sem pesar (≈ 320–400 colunas). */
  private size(w: number, h: number): [number, number] {
    const W = w < 900 ? 320 : 400
    const H = Math.max(120, Math.min(300, Math.round((W * h) / Math.max(1, w))))
    return [W, H]
  }

  private ensure(W: number, H: number, c: CanvasRenderingContext2D) {
    if (this.buffer.width !== W || this.buffer.height !== H || !this.image) {
      this.buffer.width = W
      this.buffer.height = H
      this.image = c.createImageData(W, H)
      this.pixels = new Uint32Array(this.image.data.buffer)
      this.zFull = new Float32Array(W)
      this.zLow = new Float32Array(W)
      this.lowTop = new Int32Array(W)
    }
  }

  /** Textura do chão de cada célula (recalculada quando o mapa ou as portas mudam). */
  private floors(map: GridMap, flags: Record<string, boolean>) {
    const key = Object.keys(flags)
      .filter((k) => flags[k])
      .sort()
      .join(',')
    if (this.floorMap === map && this.floorFlags === key) return this.floorTex
    this.floorMap = map
    this.floorFlags = key
    const out: Array<Texture | null> = new Array(map.width * map.height)
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y)
        if (!t) {
          out[y * map.width + x] = null
          continue
        }
        const open = Boolean(t.openWhen && flags[t.openWhen])
        out[y * map.width + x] = texture(t.sprite, open)
      }
    this.floorTex = out
    return out
  }

  /** Desenha a cena no canvas de destino (w × h pixels) e devolve o retângulo do sprite em foco, na tela. */
  render(target: CanvasRenderingContext2D, w: number, h: number, s: Scene): FocusRect | null {
    const [W, H] = this.size(w, h)
    this.ensure(W, H, target)
    const px = this.pixels
    const horizon = Math.round(H / 2 + s.bob)
    const fog = fogFor(s.sky)
    const dirX = Math.cos(s.angle)
    const dirY = Math.sin(s.angle)
    const planeX = -dirY * FOV
    const planeY = dirX * FOV

    // ── Céu/teto e chão ──
    const floors = this.floors(s.map, s.flags)
    const mw = s.map.width
    const mh = s.map.height
    for (let y = 0; y < H; y++) {
      const row = y * W
      if (y < horizon) {
        const t = y / Math.max(1, horizon)
        const v = s.sky === 'day' ? mix(SKY_TOP, SKY_HORIZON, t * t) : s.sky === 'night' ? mix(NIGHT_TOP, NIGHT_HORIZON, t * t) : mix(CEIL_FAR, CEIL_NEAR, 1 - Math.min(1, (horizon - y) / Math.max(1, horizon)) ** 0.5)
        px.fill(v, row, row + W)
        continue
      }
      const p = y - horizon + 0.5
      const rowDist = (H / 2) / p
      const f = fog(rowDist)
      const stepX = (rowDist * 2 * planeX) / W
      const stepY = (rowDist * 2 * planeY) / W
      let fx = s.px + rowDist * (dirX - planeX)
      let fy = s.py + rowDist * (dirY - planeY)
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        const cx = Math.floor(fx)
        const cy = Math.floor(fy)
        if (cx < 0 || cy < 0 || cx >= mw || cy >= mh) {
          px[row + x] = s.sky === 'day' ? shade(rgb(47, 107, 53), f) : shade(rgb(11, 14, 20), f)
          continue
        }
        const tex = floors[cy * mw + cx]
        if (!tex) {
          px[row + x] = rgb(0, 0, 0)
          continue
        }
        const tx = ((fx - cx) * tex.w) | 0
        const ty = ((fy - cy) * tex.h) | 0
        px[row + x] = shade(tex.data[ty * tex.w + tx], f)
      }
    }

    // ── Paredes e muretas (de longe para perto, por coluna) ──
    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1
      const rayX = dirX + planeX * cameraX
      const rayY = dirY + planeY * cameraX
      const hits = castColumn(s.map, s.flags, s.px, s.py, rayX, rayY)
      this.zFull[x] = Infinity
      this.zLow[x] = Infinity
      this.lowTop[x] = H
      for (let i = hits.length - 1; i >= 0; i--) {
        const hit = hits[i]
        const lineH = H / hit.dist
        const tex = texture(hit.sprite)
        const texX = Math.min(tex.w - 1, (hit.texX * tex.w) | 0)
        const f = fog(hit.dist) * (hit.side === 1 ? 0.74 : 1)
        if (hit.low) {
          const y0 = Math.max(0, horizon)
          const y1 = Math.min(H, Math.round(horizon + lineH / 2))
          const span = Math.max(1, lineH / 2)
          for (let y = y0; y < y1; y++) {
            const ty = Math.min(tex.h - 1, (((y - horizon) / span) * tex.h) | 0)
            px[y * W + x] = shade(tex.data[ty * tex.w + texX], f)
          }
          if (hit.dist < this.zLow[x]) {
            this.zLow[x] = hit.dist
            this.lowTop[x] = y0
          }
        } else {
          const top = horizon - lineH / 2
          const y0 = Math.max(0, Math.round(top))
          const y1 = Math.min(H, Math.round(horizon + lineH / 2))
          for (let y = y0; y < y1; y++) {
            const ty = Math.min(tex.h - 1, Math.max(0, (((y - top) / lineH) * tex.h) | 0))
            px[y * W + x] = shade(tex.data[ty * tex.w + texX], f)
          }
          this.zFull[x] = hit.dist
        }
      }
    }

    // ── Sprites (NPCs, objetos, árvores), do mais longe para o mais perto ──
    let focusRect: FocusRect | null = null
    const projected = s.sprites
      .map((b) => ({ b, p: project(s.px, s.py, s.angle, b.x, b.y) }))
      .filter(({ p }) => p.depth > 0.15 && p.depth < MAX_DEPTH)
      .sort((a, b) => b.p.depth - a.p.depth)
    for (const { b, p } of projected) {
      const tex = imageTexture(b.img)
      const unit = H / p.depth // altura de 1 tile na tela
      const sh = (unit * tex.h) / TILE
      const sw = (unit * tex.w) / TILE
      const cx = (W / 2) * (1 + p.x)
      const bottom = horizon + unit / 2
      const top = bottom - sh
      const x0 = Math.max(0, Math.round(cx - sw / 2))
      const x1 = Math.min(W, Math.round(cx + sw / 2))
      const y0 = Math.max(0, Math.round(top))
      const y1 = Math.min(H, Math.round(bottom))
      const f = fog(p.depth)
      let drawn = false
      for (let x = x0; x < x1; x++) {
        if (p.depth >= this.zFull[x]) continue
        const tx = Math.min(tex.w - 1, Math.max(0, (((x - (cx - sw / 2)) / sw) * tex.w) | 0))
        const lowFrom = p.depth >= this.zLow[x] ? this.lowTop[x] : H
        for (let y = y0; y < y1 && y < lowFrom; y++) {
          const ty = Math.min(tex.h - 1, Math.max(0, (((y - top) / sh) * tex.h) | 0))
          const v = tex.data[ty * tex.w + tx]
          if (v >>> 24 < 40) continue
          px[y * W + x] = shade(v, f)
          drawn = true
        }
      }
      if (b.focus && drawn) focusRect = { x: cx - sw / 2, y: top, w: sw, h: sh }
    }

    // ── Amplia para a tela ──
    this.buffer.getContext('2d')!.putImageData(this.image!, 0, 0)
    target.setTransform(1, 0, 0, 1, 0, 0)
    target.imageSmoothingEnabled = false
    target.drawImage(this.buffer, 0, 0, W, H, 0, 0, w, h)
    if (!focusRect) return null
    const kx = w / W
    const ky = h / H
    return { x: focusRect.x * kx, y: focusRect.y * ky, w: focusRect.w * kx, h: focusRect.h * ky }
  }
}

/** Céu da região: o declarado ou, pela paleta, dia (town) ou teto (data). */
export const skyOf = (region: { palette: string; sky?: Scene['sky'] }): Scene['sky'] => region.sky ?? (region.palette === 'data' ? 'none' : 'day')

/** Para o minimapa e testes: classe de cada célula, sem desenhar. */
export const cellClass = renderClass
