// Laço do jogo: entrada → simulação → desenho, num único <canvas>, em
// PRIMEIRA PESSOA. O React não re-renderiza a cada quadro: o runtime só avisa
// quando algo que a interface mostra muda (o que está na mira, troca de região).
//
// Controles: W/S (ou ↑/↓) andam para a frente/trás; A/D (ou ←/→) giram;
// Shift + A/D anda de lado; mouse gira depois de um clique no canvas (pointer
// lock); E/Enter/Espaço interagem. No celular, o joystick anda (vertical) e
// gira (horizontal).
import { approach, findPath, parseMap, safeSpawn, SPEED, step, tileAt, type Body, type GridMap } from '../engine/map'
import { check } from '../engine/state'
import type { Dir, EntityDef, Interaction, RegionDef, WorldState } from '../engine/types'
import type { WorldContent } from '../content/registry'
import { FirstPersonView, skyOf, type Billboard } from './fpsView'
import { aimedEntity, angleOf, bestLookAngle, dirOf, normAngle, SPRITE_TILES, turnDelta } from './raycast'
import { TILE, drawCharacter, drawMarker, drawObject } from './sprites'

export interface RuntimeCallbacks {
  /** Entidade na mira mudou (para o botão de ação e a dica "E · Falar"). */
  onFocus: (e: EntityDef | null) => void
  onInteract: (e: EntityDef, i: Interaction) => void
  /** Houve movimento (conta como atividade para o tempo de estudo). */
  onActivity: () => void
}

/** Teclas de movimento: [frente/trás, giro]. */
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [1, 0],
  KeyW: [1, 0],
  ArrowDown: [-1, 0],
  KeyS: [-1, 0],
  ArrowLeft: [0, -1],
  KeyA: [0, -1],
  ArrowRight: [0, 1],
  KeyD: [0, 1],
}

const TURN_SPEED = 2.4 // rad/s com o teclado
const MOUSE_TURN = 0.0022 // rad por pixel do mouse
const AUTOPILOT_TURN = 7 // rad/s ao virar no piloto automático

export class GameRuntime {
  // Por objeto (não por id): Minha Cidade é regerada quando as matérias mudam.
  private maps = new WeakMap<RegionDef, GridMap>()
  private keys = new Set<string>()
  private shift = false
  private stick = { dx: 0, dy: 0 }
  private mouseTurn = 0
  private raf = 0
  private last = 0
  private walk = 0
  private focus: EntityDef | null = null
  private lastActivity = 0
  private view = new FirstPersonView()
  /** Cartazes prontos, por chave (entidade + quadro de animação + estado): evita redesenhar e reler pixels a cada quadro. */
  private boards = new Map<string, HTMLCanvasElement>()
  /** Para onde o jogador olha (radianos); `facing` do estado é derivado daqui. */
  private angle = 0
  private syncedFacing: Dir | null = null
  private lastRegion: RegionDef | null = null
  private _paused = false
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
    private opts: { reducedMotion: boolean; touch: boolean },
  ) {}

  get paused() {
    return this._paused
  }

  /** Com uma janela aberta o mouse volta a ser do jogador (sai do pointer lock). */
  set paused(v: boolean) {
    this._paused = v
    if (v && document.pointerLockElement === this.canvas) document.exitPointerLock?.()
  }

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
    this.canvas.addEventListener('click', this.onClick)
    document.addEventListener('mousemove', this.onMouseMove)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clearKeys)
    this.canvas.removeEventListener('click', this.onClick)
    document.removeEventListener('mousemove', this.onMouseMove)
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.()
  }

  setStick(dx: number, dy: number) {
    this.stick = { dx, dy }
  }

  clearKeys = () => {
    this.keys.clear()
    this.shift = false
    this.stick = { dx: 0, dy: 0 }
    this.mouseTurn = 0
  }

  /** Vira para uma direção cardeal (testes E2E e chegada a um lugar). */
  face(d: Dir) {
    this.angle = angleOf(d)
    this.world.current.facing = d
    this.syncedFacing = d
    // Quem manda olhar para um lado já escolheu: não troca pelo "melhor" olhar da chegada.
    this.lastRegion = this.region
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this._paused || isTyping(e)) return
    if (e.key === 'Shift') this.shift = true
    if (KEYS[e.code]) {
      this.keys.add(e.code)
      e.preventDefault()
    } else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      if (!e.repeat) this.interact()
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shift = false
    this.keys.delete(e.code)
  }

  /** Clique no mundo (desktop): prende o mouse para olhar em volta. */
  private onClick = () => {
    if (this._paused || this.locked || this.opts.touch) return
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.()
  }

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas || this._paused || this.locked) return
    this.mouseTurn += e.movementX * MOUSE_TURN
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
    if (this._paused || this.locked || !this.focus) return
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

  /** Mantém o ângulo e o `facing` salvo em acordo, nos dois sentidos. */
  private syncAngle() {
    const s = this.world.current
    if (this.lastRegion !== this.region) {
      // Chegou a um lugar novo (ou carregou o jogo): olha para onde há mais chão.
      this.lastRegion = this.region
      this.angle = bestLookAngle(this.map(), s.flags, s.x, s.y, s.facing)
      s.facing = dirOf(this.angle)
      this.syncedFacing = s.facing
    } else if (s.facing !== this.syncedFacing) {
      // Alguém mudou o facing por fora (ex.: __eq.place nos testes).
      this.angle = angleOf(s.facing)
      this.syncedFacing = s.facing
    }
  }

  private writeFacing() {
    const s = this.world.current
    s.facing = dirOf(this.angle)
    this.syncedFacing = s.facing
  }

  private update(dt: number) {
    const s = this.world.current
    this.syncAngle()
    if (this.route && !this._paused) return this.follow(dt)

    let forward = this.stick.dy ? -this.stick.dy : 0
    let turn = this.stick.dx
    let strafe = 0
    for (const k of this.keys) {
      forward += KEYS[k][0]
      if (this.shift) strafe += KEYS[k][1]
      else turn += KEYS[k][1]
    }
    if (this._paused || this.locked) {
      forward = turn = strafe = 0
      this.mouseTurn = 0
    }
    this.angle = normAngle(this.angle + turn * TURN_SPEED * dt + this.mouseTurn)
    this.mouseTurn = 0

    const dirX = Math.cos(this.angle)
    const dirY = Math.sin(this.angle)
    const mx = dirX * forward - dirY * strafe
    const my = dirY * forward + dirX * strafe
    const solids = this.entities().filter((e) => e.solid)
    const r = step(this.map(), s, { dx: mx, dy: my }, dt, s.flags, solids)
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
    this.writeFacing()
    const f = this._paused ? null : aimedEntity(s, this.angle, this.entities())
    if (f !== this.focus) {
      this.focus = f
      this.cb.onFocus(f)
    }
  }

  /** Avança no caminho do piloto automático (sem colisão: o caminho já evita obstáculos), virando a câmera antes de andar. */
  private follow(dt: number) {
    const s = this.world.current
    const r = this.route!
    let budget = SPEED * 0.85 * Math.min(dt, 0.05)
    while (budget > 0 && r.points.length) {
      const p = r.points[0]
      const dx = p.x - s.x
      const dy = p.y - s.y
      const dist = Math.hypot(dx, dy)
      if (dist > 1e-3) {
        const target = Math.atan2(dy, dx)
        const delta = turnDelta(this.angle, target)
        if (Math.abs(delta) > 0.05 && !this.opts.reducedMotion) {
          // Vira primeiro; anda depois (sem deslizar de lado).
          const maxTurn = AUTOPILOT_TURN * dt
          this.angle = normAngle(this.angle + Math.sign(delta) * Math.min(Math.abs(delta), maxTurn))
          break
        }
        this.angle = target
      }
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
      if (r.facing) this.angle = angleOf(r.facing)
      this.route = null
      this.walk = 0
      this.writeFacing()
      r.done()
    } else this.writeFacing()
  }

  /** Cartaz de uma entidade: marca de missão em cima, sprite embaixo (16 × 32). */
  private billboard(e: EntityDef, t: number): HTMLCanvasElement {
    const s = this.world.current
    const marker = Boolean(e.marker && check(s, e.marker, this.content.quests))
    const lit = e.sprite === 'board' ? s.steps.includes('tutorial:board') : e.sprite === 'panel' ? s.flags.power_on : false
    // Animações mudam no máximo 8 vezes por segundo: chave por "tick" de animação.
    const tick = this.opts.reducedMotion ? 0 : Math.floor(t * 8)
    const key = `${this.region.id}|${e.id}|${tick}|${marker ? 1 : 0}|${lit ? 1 : 0}`
    const hit = this.boards.get(key)
    if (hit) return hit
    if (this.boards.size > 400) this.boards.clear()
    const cv = document.createElement('canvas')
    cv.width = TILE
    cv.height = TILE * 2
    const c = cv.getContext('2d')!
    const anim = this.opts.reducedMotion ? 0 : tick / 8
    const sp = this.content.speakers[e.sprite]
    const at = tick / 8
    if (sp && e.kind === 'npc') drawCharacter(c, 8, 31, sp.look, 'down', 0, this.opts.reducedMotion ? 0 : Math.round(Math.sin(at * 2 + e.x) * 0.5))
    else drawObject(c, e.sprite, 0, TILE, anim, e.sprite === 'board' && lit ? 'lit' : e.sprite === 'panel' && lit ? '#38ff9c' : undefined)
    if (marker) drawMarker(c, 8, 30, anim)
    this.boards.set(key, cv)
    return cv
  }

  /** Cartaz de um objeto do cenário (árvore), sem o chão do tile atrás. */
  private objectImage(sprite: string, t: number): HTMLCanvasElement {
    const tick = this.opts.reducedMotion ? 0 : Math.floor(t * 8)
    const key = `obj|${sprite}|${tick}`
    const hit = this.boards.get(key)
    if (hit) return hit
    const cv = document.createElement('canvas')
    cv.width = TILE
    cv.height = TILE
    drawObject(cv.getContext('2d')!, sprite, 0, 0, tick / 8)
    this.boards.set(key, cv)
    return cv
  }

  private sprites(t: number): Billboard[] {
    const map = this.map()
    const out: Billboard[] = []
    for (const e of this.entities()) out.push({ x: e.x + 0.5, y: e.y + 0.5, img: this.billboard(e, t), focus: e === this.focus })
    // Árvores: sólidas para andar, cartazes para ver.
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const tile = tileAt(map, x, y)
        if (tile && SPRITE_TILES.has(tile.sprite)) out.push({ x: x + 0.5, y: y + 0.5, img: this.objectImage(tile.sprite, t) })
      }
    return out
  }

  private draw(t: number) {
    const cv = this.canvas
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(cv.clientWidth * dpr)
    const h = Math.round(cv.clientHeight * dpr)
    if (w === 0 || h === 0) return
    if (cv.width !== w || cv.height !== h) {
      cv.width = w
      cv.height = h
    }
    const c = cv.getContext('2d')!
    const s = this.world.current
    const bob = this.opts.reducedMotion ? 0 : Math.sin(this.walk * 0.9) * 2
    const focusRect = this.view.render(c, w, h, {
      map: this.map(),
      flags: s.flags,
      sky: skyOf(this.region),
      px: s.x,
      py: s.y,
      angle: this.angle,
      bob,
      sprites: this.sprites(t),
    })

    // Destaque do que está na mira (forma + brilho, não só cor).
    if (focusRect && !this._paused) {
      c.strokeStyle = 'rgba(245,222,179,0.9)'
      c.lineWidth = Math.max(1, Math.round(dpr))
      c.strokeRect(Math.round(focusRect.x) + 0.5, Math.round(focusRect.y) + 0.5, Math.round(focusRect.w), Math.round(focusRect.h))
    }
    // Mira discreta no centro.
    c.fillStyle = 'rgba(245,222,179,0.7)'
    c.fillRect(Math.round(w / 2) - 1, Math.round(h / 2) - 1, 2 * dpr, 2 * dpr)

    this.drawMinimap(c, w, h, dpr)
  }

  /** Minimapa: planta da região com o jogador e o que há por perto. */
  private drawMinimap(c: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
    const map = this.map()
    const s = this.world.current
    const cell = Math.max(2, Math.round(3 * dpr))
    const mw = map.width * cell
    const mh = map.height * cell
    const pad = Math.round(10 * dpr)
    // Desktop: canto inferior direito; celular: canto superior esquerdo, abaixo do HUD.
    const ox = this.opts.touch ? pad : w - mw - pad
    const oy = this.opts.touch ? Math.round(104 * dpr) : h - mh - Math.round(52 * dpr)
    c.fillStyle = 'rgba(20,16,13,0.82)'
    c.fillRect(ox - 3, oy - 3, mw + 6, mh + 6)
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const tile = tileAt(map, x, y)
        if (!tile) continue
        const open = Boolean(tile.openWhen && s.flags[tile.openWhen])
        const solid = tile.openWhen ? !open : tile.solid
        c.fillStyle = tile.openWhen ? (open ? '#5a7a62' : '#eda100') : solid ? '#6b5a44' : '#2a2016'
        c.fillRect(ox + x * cell, oy + y * cell, cell, cell)
      }
    for (const e of this.entities()) {
      c.fillStyle = e.kind === 'npc' ? '#38d0ff' : e.kind === 'enemy' ? '#ff3d3d' : e.kind === 'portal' ? '#7c8cff' : '#f5deb3'
      c.fillRect(ox + e.x * cell, oy + e.y * cell, cell, cell)
    }
    // Jogador: ponto com a direção do olhar.
    const px = ox + s.x * cell
    const py = oy + s.y * cell
    c.strokeStyle = '#ffd75e'
    c.lineWidth = Math.max(1, dpr)
    c.beginPath()
    c.moveTo(px, py)
    c.lineTo(px + Math.cos(this.angle) * cell * 2.2, py + Math.sin(this.angle) * cell * 2.2)
    c.stroke()
    c.fillStyle = '#ffd75e'
    c.beginPath()
    c.arc(px, py, Math.max(1.5, cell * 0.6), 0, Math.PI * 2)
    c.fill()
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}
