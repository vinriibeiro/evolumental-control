// Laço do jogo: entrada → simulação → desenho, num único <canvas>.
// O React não re-renderiza a cada quadro: o runtime só avisa quando algo que a
// interface mostra muda (o que está à frente do personagem, troca de região).
import { approach, facingEntity, findPath, parseMap, safeSpawn, SPEED, step, tileAt, type Body, type GridMap } from '../engine/map'
import { check } from '../engine/state'
import type { Dir, EntityDef, Interaction, RegionDef, WorldState } from '../engine/types'
import type { WorldContent } from '../content/registry'
import { TILE, drawCharacter, drawMarker, drawObject, tileSprite } from './sprites'

export interface RuntimeCallbacks {
  /** Entidade à frente mudou (para o botão de ação e a dica "E · Falar"). */
  onFocus: (e: EntityDef | null) => void
  onInteract: (e: EntityDef, i: Interaction) => void
  /** Houve movimento (conta como atividade para o tempo de estudo). */
  onActivity: () => void
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
}

export class GameRuntime {
  // Por objeto (não por id): Minha Cidade é regerada quando as matérias mudam.
  private maps = new WeakMap<RegionDef, GridMap>()
  private keys = new Set<string>()
  private stick = { dx: 0, dy: 0 }
  private raf = 0
  private last = 0
  private walk = 0
  private focus: EntityDef | null = null
  private lastActivity = 0
  paused = false
  /**
   * Apresentação guiada: teclado, joystick e "interagir" ficam desligados e o
   * personagem só anda pelo piloto automático (walkTo).
   */
  locked = false
  private route: { points: Body[]; facing: Dir | null; done: () => void } | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private content: WorldContent,
    private world: { current: WorldState },
    private cb: RuntimeCallbacks,
    private opts: { reducedMotion: boolean },
  ) {}

  get region(): RegionDef {
    return this.content.regions[this.world.current.region]
  }

  map(region = this.region): GridMap {
    let m = this.maps.get(region)
    if (!m) {
      m = parseMap(region.map)
      this.maps.set(region, m)
    }
    return m
  }

  start() {
    const s = this.world.current
    const fix = safeSpawn(this.map(), this.region, s)
    s.x = fix.x
    s.y = fix.y
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clearKeys)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clearKeys)
  }

  setStick(dx: number, dy: number) {
    this.stick = { dx, dy }
  }

  clearKeys = () => {
    this.keys.clear()
    this.stick = { dx: 0, dy: 0 }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.paused || isTyping(e)) return
    if (KEYS[e.code]) {
      this.keys.add(e.code)
      e.preventDefault()
    } else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      if (!e.repeat) this.interact()
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  /** Visíveis na região atual (inimigos derrotados somem). */
  entities(): EntityDef[] {
    return this.region.entities.filter((e) => check(this.world.current, e.visible, this.content.quests))
  }

  /**
   * Piloto automático: anda pelo caminho mais curto até ficar de frente para a
   * entidade (na região atual). Resolve false se não houver caminho.
   */
  walkToEntity(id: string): Promise<boolean> {
    const e = this.entities().find((x) => x.id === id)
    const solids = this.entities().filter((x) => x.solid)
    const map = this.map()
    const flags = this.world.current.flags
    const spot = e && approach(map, e, flags, solids)
    const points = spot && findPath(map, this.world.current, spot, flags, solids)
    if (!spot || !points) return Promise.resolve(false)
    return new Promise((resolve) => {
      this.route = { points, facing: spot.facing, done: () => resolve(true) }
    })
  }

  interact() {
    if (this.paused || this.locked || !this.focus) return
    const e = this.focus
    const i = e.on.find((x) => check(this.world.current, x.when, this.content.quests))
    if (i) this.cb.onInteract(e, i)
  }

  private loop = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.update(dt)
    this.draw(now / 1000)
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    const s = this.world.current
    let dx = this.stick.dx
    let dy = this.stick.dy
    for (const k of this.keys) {
      dx += KEYS[k][0]
      dy += KEYS[k][1]
    }
    if (this.paused || this.locked) dx = dy = 0
    if (this.route && !this.paused) return this.follow(dt)
    const solids = this.entities().filter((e) => e.solid)
    const r = step(this.map(), s, { dx, dy }, dt, s.flags, solids)
    if (r.facing) s.facing = r.facing
    if (r.moved) {
      s.x = r.x
      s.y = r.y
      this.walk += dt * 8
      const now = performance.now()
      if (now - this.lastActivity > 5000) {
        this.lastActivity = now
        this.cb.onActivity()
      }
    } else this.walk = 0
    const f = this.paused ? null : facingEntity(s, this.entities())
    if (f !== this.focus) {
      this.focus = f
      this.cb.onFocus(f)
    }
  }

  /** Avança no caminho do piloto automático (sem colisão: o caminho já evita obstáculos). */
  private follow(dt: number) {
    const s = this.world.current
    const r = this.route!
    let budget = SPEED * 0.85 * Math.min(dt, 0.05)
    while (budget > 0 && r.points.length) {
      const p = r.points[0]
      const dx = p.x - s.x
      const dy = p.y - s.y
      const dist = Math.hypot(dx, dy)
      if (dist > 1e-3) s.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      if (dist <= budget) {
        s.x = p.x
        s.y = p.y
        budget -= dist
        r.points.shift()
      } else {
        s.x += (dx / dist) * budget
        s.y += (dy / dist) * budget
        budget = 0
      }
    }
    this.walk += dt * 8
    if (!r.points.length) {
      if (r.facing) s.facing = r.facing
      this.route = null
      this.walk = 0
      r.done()
    }
  }

  /** Pixels de jogo por pixel de tela (inteiro: pixel art nítida). */
  private scale(w: number, h: number) {
    return Math.max(1, Math.floor(Math.min(w / (TILE * 15), h / (TILE * 9.5))))
  }

  private draw(t: number) {
    const cv = this.canvas
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(cv.clientWidth * dpr)
    const h = Math.round(cv.clientHeight * dpr)
    if (cv.width !== w || cv.height !== h) {
      cv.width = w
      cv.height = h
    }
    const c = cv.getContext('2d')!
    c.imageSmoothingEnabled = false
    const k = this.scale(w, h)
    const map = this.map()
    const s = this.world.current
    const viewW = w / k
    const viewH = h / k
    const mapW = map.width * TILE
    const mapH = map.height * TILE
    const camX = mapW <= viewW ? (mapW - viewW) / 2 : clamp(s.x * TILE - viewW / 2, 0, mapW - viewW)
    const camY = mapH <= viewH ? (mapH - viewH) / 2 : clamp(s.y * TILE - viewH / 2, 0, mapH - viewH)
    const dark = this.region.palette === 'data'
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = dark ? '#0b0e14' : '#2f6b35'
    c.fillRect(0, 0, w, h)
    c.setTransform(k, 0, 0, k, -Math.round(camX * k), -Math.round(camY * k))

    const x0 = Math.max(0, Math.floor(camX / TILE))
    const y0 = Math.max(0, Math.floor(camY / TILE))
    const x1 = Math.min(map.width - 1, Math.ceil((camX + viewW) / TILE))
    const y1 = Math.min(map.height - 1, Math.ceil((camY + viewH) / TILE))
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const tile = tileAt(map, x, y)
        if (!tile) continue
        const open = Boolean(tile.openWhen && s.flags[tile.openWhen])
        c.drawImage(tileSprite(tile.sprite, open), x * TILE, y * TILE)
      }

    // Personagens e objetos ordenados pelo "pé" (profundidade simples).
    const anim = this.opts.reducedMotion ? 0 : t
    const drawables: Array<{ y: number; draw: () => void }> = []
    for (const e of this.entities()) {
      const px = e.x * TILE
      const py = e.y * TILE
      drawables.push({
        y: py + TILE,
        draw: () => {
          const sp = this.content.speakers[e.sprite]
          if (sp && e.kind === 'npc') drawCharacter(c, px + 8, py + 15, sp.look, 'down', 0, this.opts.reducedMotion ? 0 : Math.round(Math.sin(t * 2 + e.x) * 0.5))
          else drawObject(c, e.sprite, px, py, anim, e.sprite === 'board' && s.steps.includes('tutorial:board') ? 'lit' : e.sprite === 'panel' && s.flags.power_on ? '#38ff9c' : undefined)
          if (e.marker && check(s, e.marker, this.content.quests)) drawMarker(c, px + 8, py + 8, anim)
        },
      })
    }
    const look = s.character?.look ?? { skin: '#e2b48c', hair: '#3b2b20', outfit: '#2a78d6', accent: '#deb887' }
    drawables.push({ y: s.y * TILE + 4, draw: () => drawCharacter(c, s.x * TILE, s.y * TILE + 4, look, s.facing as Dir, Math.floor(this.walk) % 2 === 1 ? 1 : 0) })
    drawables.sort((a, b) => a.y - b.y)
    for (const d of drawables) d.draw()

    // Destaque do que está à frente (forma + brilho, não só cor).
    if (this.focus && !this.paused) {
      const fx = this.focus.x * TILE
      const fy = this.focus.y * TILE
      c.strokeStyle = 'rgba(245,222,179,0.9)'
      c.lineWidth = 1
      c.strokeRect(fx + 0.5, fy + 0.5, TILE - 1, TILE - 1)
    }

    // Vinheta: a cidade é escura, a vila tem luz do dia.
    c.setTransform(1, 0, 0, 1, 0, 0)
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}
