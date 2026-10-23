import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { invalidateTables, useAll, useSessions } from '@/hooks/data'
import { useProfile } from '@/hooks/useSettings'
import { eq, inList } from '@/lib/data/types'
import { netSeconds } from '@/lib/timer/engine'
import { levelFromXp } from '@/game/engine/rules'
import { useGameSettings } from '@/game/useGame'
import type { SqlChallenge, SwitchPuzzle } from './challenges'
import { WORLD } from './content'
import { cityById, cityOfTicket, type CityDef } from './content/cities'
import { buildMyCity, levelFor, LOT_COUNT, MY_CITY, type LotView } from './content/myCity'
import { currentStep, stepKey } from './engine/state'
import type { EntityDef, Interaction } from './engine/types'
import { GameRuntime } from './render/runtime'
import { recordPlayTime } from './services/world'
import { play } from './ui/audio'
import { Hud, TouchControls } from './ui/Controls'
import { Dialogue, SayBox } from './ui/Dialogue'
import { BossView, CombatView, PuzzleView } from './ui/Encounters'
import { MyCityPanel } from './ui/MyCityPanel'
import { Onboarding } from './ui/Onboarding'
import { Panels, type PanelTab } from './ui/Panels'
import { BusBoarding, BusRide, TicketCounter } from './ui/Station'
import { Terminal } from './ui/Terminal'
import { useWorld } from './ui/useWorld'

type Overlay =
  | { kind: 'dialogue'; id: string; npc: string }
  | { kind: 'say'; text: string }
  | { kind: 'terminal'; id: string }
  | { kind: 'combat'; id: string }
  | { kind: 'puzzle'; id: string }
  | { kind: 'boss'; id: string }
  | { kind: 'panel'; tab: PanelTab }
  | { kind: 'tickets' }
  | { kind: 'bus' }
  | { kind: 'ride'; to: string }
  | { kind: 'lot'; lot: number | null }

const TEXT_KEY = 'evl-world-text'
const IDLE_MS = 120_000
const FLUSH_MS = 10 * 60_000

function readText() {
  try {
    return localStorage.getItem(TEXT_KEY) === 'lg'
  } catch {
    return false
  }
}

/**
 * Mundo Evolumental: tela cheia, fora do layout do Control. Sem menus para
 * tudo: as funções do jogo estão em lugares e objetos do mundo.
 */
export default function WorldPage() {
  const w = useWorld()
  const backend = useBackend()
  const navigate = useNavigate()
  const profile = useProfile()
  const { game, save: saveGame } = useGameSettings()
  const qc = useQueryClient()
  const totals = useQuery({ queryKey: ['data', ['game_rewards'], 'totals', backend.kind], queryFn: () => backend.gameTotals() })
  const purchases = useAll('game_purchases')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtime = useRef<GameRuntime | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [focus, setFocus] = useState<EntityDef | null>(null)
  const [textLarge, setTextLarge] = useState(readText)
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)
  const systemReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const reducedMotion = game.reducedMotion || Boolean(systemReduced)
  const sound = game.sound
  const state = w.world.current
  const hasCharacter = Boolean(state?.character)

  // ── Tempo ativo → sessão de estudo ──────────────────────────────────────
  const lastInput = useRef(Date.now())
  const active = useRef(0)
  const touchInput = useCallback(() => (lastInput.current = Date.now()), [])
  const flushTime = useCallback(async () => {
    const secs = active.current
    if (secs < 60 || !w.world.current) return
    active.current = 0
    const region = WORLD.regions[w.world.current.region]
    const r = await recordPlayTime(backend, { activeSeconds: secs, subject: region.subject ?? '', regionName: region.name, settings: game }).catch(() => 'error' as const)
    if (r === 'registered') w.toast(`${Math.floor(secs / 60)} min de estudo registrados.`)
  }, [backend, game, w])

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInput.current < IDLE_MS && hasCharacter) active.current += 1
    }, 1000)
    const flush = window.setInterval(() => void flushTime(), FLUSH_MS)
    window.addEventListener('keydown', touchInput)
    window.addEventListener('pointerdown', touchInput)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(flush)
      window.removeEventListener('keydown', touchInput)
      window.removeEventListener('pointerdown', touchInput)
      void flushTime()
    }
  }, [flushTime, touchInput, hasCharacter])

  // ── Runtime do canvas ───────────────────────────────────────────────────
  const onInteract = useCallback(
    (e: EntityDef, i: Interaction) => {
      play('blip', sound)
      void w.fire({ type: 'interact', target: e.id })
      switch (i.do) {
        case 'dialogue':
          return setOverlay({ kind: 'dialogue', id: i.dialogue, npc: e.id })
        case 'say':
          return setOverlay({ kind: 'say', text: i.text })
        case 'terminal':
          return setOverlay({ kind: 'terminal', id: i.challenge })
        case 'combat':
          return setOverlay({ kind: 'combat', id: i.encounter })
        case 'puzzle':
          return setOverlay({ kind: 'puzzle', id: i.puzzle })
        case 'boss':
          return setOverlay({ kind: 'boss', id: i.boss })
        case 'worldmap':
          return setOverlay({ kind: 'panel', tab: 'map' })
        case 'tickets':
          return setOverlay({ kind: 'tickets' })
        case 'bus':
          return setOverlay({ kind: 'bus' })
        case 'lot':
          return setOverlay({ kind: 'lot', lot: i.lot })
        case 'effects':
          w.apply(i.effects)
          if (i.text) w.toast(i.text)
      }
    },
    [sound, w],
  )

  useEffect(() => {
    if (!canvasRef.current || !hasCharacter || !w.world.current) return
    const rt = new GameRuntime(canvasRef.current, WORLD, w.world as { current: NonNullable<typeof w.world.current> }, { onFocus: setFocus, onInteract, onActivity: touchInput }, { reducedMotion })
    runtime.current = rt
    rt.start()
    return () => rt.stop()
    // O runtime vive enquanto a tela existir; preferências mudam via ref abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCharacter, w.loading])

  // Só em desenvolvimento: permite aos testes E2E posicionar o personagem.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const g = window as unknown as { __eq?: unknown }
    g.__eq = {
      state: () => w.world.current,
      place: (x: number, y: number, facing: 'up' | 'down' | 'left' | 'right') => {
        const s = w.world.current
        if (s) Object.assign(s, { x, y, facing })
      },
    }
    return () => {
      delete g.__eq
    }
  }, [w.world])

  useEffect(() => {
    if (runtime.current) runtime.current.paused = Boolean(overlay)
    if (overlay) runtime.current?.clearKeys()
  }, [overlay])

  // Atalhos de painel e Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        // O ônibus não para no meio da estrada.
        if (overlay && overlay.kind !== 'dialogue' && overlay.kind !== 'ride') setOverlay(null)
        return
      }
      const map: Record<string, PanelTab> = { KeyI: 'inventory', KeyJ: 'journal', KeyK: 'skills', KeyM: 'map', KeyO: 'settings' }
      const tab = map[e.code]
      if (!tab || (overlay && overlay.kind !== 'panel')) return
      e.preventDefault()
      setOverlay(overlay?.kind === 'panel' && overlay.tab === tab ? null : { kind: 'panel', tab })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  // Navegação pedida por efeitos (lugares do HUB que abrem telas do app).
  useEffect(() => {
    const to = w.pendingNav
    if (!to) return
    w.clearNav()
    if (to === '#journal') return setOverlay({ kind: 'panel', tab: 'journal' })
    void (async () => {
      await w.save()
      await flushTime()
      navigate(to)
    })()
  }, [w, navigate, flushTime])

  const exit = async () => {
    await w.save()
    await flushTime()
    navigate('/')
  }

  // ── Rodoviária ──────────────────────────────────────────────────────────
  const owned = useMemo(() => new Set((purchases.data ?? []).map((p) => cityOfTicket(p.item_id)).filter((c): c is string => Boolean(c))), [purchases.data])

  const buyTicket = async (c: CityDef) => {
    const r = await backend.gameBuyTicket(c.id)
    await invalidateTables(qc, ['game_purchases', 'game_rewards'])
    if (!r.bought) return
    play('success', sound)
    if (r.price === 0 && w.world.current?.inventory.includes('vale_bilhete')) w.apply([{ type: 'take', item: 'vale_bilhete' }])
    w.toast(r.price ? `Passagem para ${c.name}: −${r.price} moedas.` : `Vale trocado: passagem para ${c.name}.`, 'reward')
    setOverlay({ kind: 'bus' })
  }

  /** Chegada do ônibus: a primeira viagem a uma cidade cumpre a etapa do tutorial. */
  const arrive = useCallback(
    (region: string) => {
      const r = WORLD.regions[region]
      setOverlay(null)
      w.apply([...(cityById(region) ? [{ type: 'flag' as const, flag: 'first_trip' }] : []), { type: 'teleport', region, x: r.spawn.x + 0.5, y: r.spawn.y + 0.5 }])
      w.toast(`${r.name} — ${r.subtitle}`)
    },
    [w],
  )

  // ── Minha Cidade: matérias do Control viram prédios ────────────────────
  const myCityOn = Boolean(state?.flags.my_city_unlocked)
  const subjects = useAll('subjects', {}, { enabled: myCityOn })
  const studied = useSessions({ filters: [eq('status', 'completed')] }, { enabled: myCityOn })
  const citySubjects = useMemo(() => (subjects.data ?? []).filter((s) => !s.archived_at).map((s) => ({ id: s.id, name: s.name, color: s.color })), [subjects.data])
  const secondsBySubject = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of studied.data ?? []) if (s.subject_id) m.set(s.subject_id, (m.get(s.subject_id) ?? 0) + netSeconds(s, s.pauses))
    return m
  }, [studied.data])
  const lots = state?.myCity?.lots
  useEffect(() => {
    const byId = new Map(citySubjects.map((s) => [s.id, s]))
    const view: LotView[] = Array.from({ length: LOT_COUNT }, (_, i) => {
      const s = lots?.[i] ? byId.get(lots[i]!) : undefined
      return s ? { subjectId: s.id, name: s.name, color: s.color, level: levelFor(secondsBySubject.get(s.id) ?? 0).level } : { subjectId: null, name: 'Terreno livre', color: '#8a6239', level: 0 }
    })
    // O runtime lê as regiões a cada quadro: trocar o objeto redesenha a cidade.
    WORLD.regions[MY_CITY] = buildMyCity(view)
  }, [citySubjects, secondsBySubject, lots])

  const assignLot = (lot: number, subjectId: string | null) => {
    const s = w.world.current
    if (!s) return
    const next = Array.from({ length: LOT_COUNT }, (_, i) => s.myCity?.lots[i] ?? null)
    next[lot] = subjectId
    w.commit({ ...s, myCity: { lots: next } })
    void w.save()
    if (subjectId) w.toast('Obra iniciada! O prédio cresce conforme você estuda essa matéria.', 'reward')
  }

  // ── Chefes do modo clássico cumprem etapas das cidades geradas ─────────
  const checked = useRef(new Set<string>())
  useEffect(() => {
    const s = w.world.current
    if (!s || w.loading) return
    const targets: string[] = []
    for (const q of Object.values(WORLD.quests)) {
      const st = currentStep(s, q)
      if (st?.objective.type === 'answered' && !s.steps.includes(stepKey(q.id, st.id)) && !checked.current.has(st.objective.challenge)) targets.push(st.objective.challenge)
    }
    if (!targets.length) return
    for (const t of targets) checked.current.add(t)
    void backend
      .list('game_answers', { filters: [inList('challenge_id', targets), eq('correct', true)], limit: 200 })
      .then(async ({ rows }) => {
        const won = new Set(rows.map((r) => r.challenge_id))
        for (const t of targets) if (won.has(t)) await w.fire({ type: 'answered', challenge: t })
      })
      .catch(() => targets.forEach((t) => checked.current.delete(t)))
    // version: a etapa atual muda a cada commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.version, w.loading, backend])

  const objective = useMemo(() => {
    if (!state) return null
    const quests = Object.values(WORLD.quests).filter((q) => state.quests[q.id] && !state.quests[q.id].done)
    const q = quests.find((x) => x.kind === 'main') ?? quests[0]
    const s = q && currentStep(state, q)
    return q && s ? { quest: q.title, text: s.text } : null
    // version: o estado é mutável no ref; o HUD acompanha os commits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, w.version])

  if (w.loading || profile.isPending) return <Shell textLarge={textLarge} reducedMotion={reducedMotion}><p className="m-auto text-[var(--eq-muted)]">Carregando o mundo…</p></Shell>
  if (w.error || !state)
    return (
      <Shell textLarge={textLarge} reducedMotion={reducedMotion}>
        <div className="m-auto max-w-md text-center">
          <p>Não foi possível carregar o mundo.</p>
          <button className="eq-btn mt-4" onClick={() => navigate('/')}>
            Voltar ao Control
          </button>
        </div>
      </Shell>
    )

  if (!state.character)
    return (
      <Shell textLarge={textLarge} reducedMotion={reducedMotion}>
        <Onboarding
          defaultName={profile.data?.display_name?.split(' ')[0] ?? ''}
          onDone={(character) => {
            w.commit({ ...state, character, introSeen: true })
            void w.save()
          }}
        />
      </Shell>
    )

  const xp = totals.data?.xp ?? 0
  const lvl = levelFromXp(xp)
  const region = WORLD.regions[state.region]
  const bossPhase = (() => {
    const q = WORLD.quests.sql_main
    const p = state.quests.sql_main
    if (!p) return 0
    if (p.done) return 4
    const idx = q.steps.findIndex((s) => s.id === 'boss_logs')
    return Math.max(0, Math.min(4, p.step - idx))
  })()
  const close = () => setOverlay(null)

  return (
    <Shell textLarge={textLarge} reducedMotion={reducedMotion}>
      <canvas ref={canvasRef} className="eq-pixel absolute inset-0 size-full" role="img" aria-label={`${region.name}. ${focus ? `À frente: ${focus.name}.` : ''}`} />
      <Hud
        level={lvl.level}
        progress={lvl.progress}
        coins={totals.data?.coins ?? 0}
        regionName={region.name}
        objective={objective}
        focus={overlay ? null : focus}
        touch={touch}
        onPanel={(tab) => setOverlay({ kind: 'panel', tab })}
        onExit={() => void exit()}
      />
      {touch && !overlay && <TouchControls focus={focus} onStick={(dx, dy) => runtime.current?.setStick(dx, dy)} onAction={() => runtime.current?.interact()} />}

      <div aria-live="polite" className="pointer-events-none absolute top-20 right-2 flex w-72 flex-col gap-2">
        {w.toasts.map((t) => (
          <p key={t.id} className={`eq-panel eq-pop px-3 py-2 text-sm ${t.tone === 'reward' ? 'text-[var(--eq-gold)]' : t.tone === 'error' ? 'text-[var(--eq-bad)]' : ''}`}>
            {t.text}
          </p>
        ))}
      </div>

      {overlay && (
        <div className={`absolute inset-0 flex justify-center bg-black/45 p-3 ${overlay.kind === 'dialogue' || overlay.kind === 'say' ? 'items-end pb-6' : 'items-center'}`}>
          {overlay.kind === 'dialogue' && (
            <Dialogue
              dialogue={WORLD.dialogues[overlay.id]}
              state={state}
              reducedMotion={reducedMotion}
              sound={sound}
              onEffects={w.apply}
              onEnd={(last) => {
                close()
                void w.fire({ type: 'talk', npc: overlay.npc, endedAt: last })
              }}
            />
          )}
          {overlay.kind === 'say' && <SayBox text={overlay.text} onClose={close} />}
          {overlay.kind === 'terminal' && (
            <Terminal challenge={WORLD.challenges[overlay.id] as SqlChallenge} sound={sound} onSolved={(answer) => w.fire({ type: 'solve', challenge: overlay.id }, answer)} onClose={close} />
          )}
          {overlay.kind === 'combat' && (
            <CombatView encounter={WORLD.encounters[overlay.id]} sound={sound} onWin={(answer) => w.fire({ type: 'solve', challenge: overlay.id }, answer)} onClose={close} />
          )}
          {overlay.kind === 'puzzle' && (
            <PuzzleView
              puzzle={WORLD.challenges[overlay.id] as SwitchPuzzle}
              sound={sound}
              hasManual={state.inventory.includes('manual_painel')}
              onSolved={(answer) => w.fire({ type: 'solve', challenge: overlay.id }, answer)}
              onClose={close}
            />
          )}
          {overlay.kind === 'boss' && (
            <BossView boss={WORLD.bosses[overlay.id]} phase={bossPhase} sound={sound} onSolvePhase={(challenge, answer) => w.fire({ type: 'solve', challenge }, answer)} onClose={close} />
          )}
          {overlay.kind === 'tickets' && <TicketCounter region={state.region} owned={owned} coins={totals.data?.coins ?? 0} onBuy={buyTicket} onBoard={() => setOverlay({ kind: 'bus' })} onClose={close} />}
          {overlay.kind === 'bus' && (
            <BusBoarding
              region={state.region}
              owned={owned}
              myCity={Boolean(state.flags.my_city_unlocked)}
              onBoard={(to) => setOverlay({ kind: 'ride', to })}
              onTickets={() => setOverlay({ kind: 'tickets' })}
              onClose={close}
            />
          )}
          {overlay.kind === 'ride' && <BusRide to={WORLD.regions[overlay.to].name} reducedMotion={reducedMotion} onArrive={() => arrive(overlay.to)} />}
          {overlay.kind === 'lot' && (
            <MyCityPanel
              lots={state.myCity?.lots ?? []}
              subjects={citySubjects}
              seconds={secondsBySubject}
              focus={overlay.lot}
              onAssign={assignLot}
              onNavigate={(to) => {
                close()
                void w.save().then(() => flushTime()).then(() => navigate(to))
              }}
              onClose={close}
            />
          )}
          {overlay.kind === 'panel' && (
            <Panels
              tab={overlay.tab}
              state={state}
              onTab={(tab) => setOverlay({ kind: 'panel', tab })}
              onClose={close}
              owned={owned}
              prefs={{ textLarge, reducedMotion: game.reducedMotion, sound }}
              onPrefs={(p) => {
                if (p.textLarge !== undefined) {
                  setTextLarge(p.textLarge)
                  try {
                    localStorage.setItem(TEXT_KEY, p.textLarge ? 'lg' : 'md')
                  } catch {
                    /* preferência só nesta sessão */
                  }
                }
                if (p.sound !== undefined || p.reducedMotion !== undefined) void saveGame({ ...(p.sound !== undefined ? { sound: p.sound } : {}), ...(p.reducedMotion !== undefined ? { reducedMotion: p.reducedMotion } : {}) })
              }}
            />
          )}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, textLarge, reducedMotion }: { children: React.ReactNode; textLarge: boolean; reducedMotion: boolean }) {
  return (
    <div className="eq-root fixed inset-0 flex overflow-hidden select-none" data-text={textLarge ? 'lg' : 'md'} data-motion={reducedMotion ? 'reduced' : 'full'}>
      {children}
    </div>
  )
}
