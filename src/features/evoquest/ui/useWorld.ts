import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { invalidateTables } from '@/hooks/data'
import { WORLD } from '../content'
import { applyEffects, completeStep, stepsCompletedBy, type WorldEvent } from '../engine/state'
import type { Effect, WorldState } from '../engine/types'
import { loadWorld, saveWorld } from '../services/world'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'reward' | 'error'
}

/**
 * Estado do mundo + operações. A posição muda a cada quadro direto no ref
 * (sem re-render); o resto passa por `commit`, que re-renderiza o HUD.
 * Etapas de missão só avançam depois que o backend confirma.
 */
export function useWorld() {
  const backend = useBackend()
  const qc = useQueryClient()
  const world = useRef<WorldState | null>(null)
  const saveId = useRef<string | null>(null)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    let alive = true
    loadWorld(backend)
      .then((r) => {
        if (!alive) return
        world.current = r.state
        saveId.current = r.saveId
        setLoading(false)
      })
      .catch((e) => alive && (setError(e), setLoading(false)))
    return () => {
      alive = false
    }
  }, [backend])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3800)
  }, [])

  const save = useCallback(async () => {
    if (!world.current) return
    dirty.current = false
    try {
      saveId.current = await saveWorld(backend, world.current, saveId.current)
    } catch {
      dirty.current = true
    }
  }, [backend])

  const commit = useCallback((next: WorldState) => {
    world.current = next
    dirty.current = true
    setVersion((v) => v + 1)
  }, [])

  // Salvamento periódico da posição e ao sair da aba.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (world.current) void save()
    }, 15000)
    const onHide = () => document.visibilityState === 'hidden' && void save()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [save])

  /** Confirma no backend cada etapa cumprida pelo evento (sem fila: uso interno). */
  const runEvent = useCallback(
    async (ev: WorldEvent, answer: string | null): Promise<boolean> => {
      const hits = stepsCompletedBy(world.current!, WORLD.quests, ev)
      if (!hits.length) return false
      for (const hit of hits) {
        const r = await backend.gameCompleteStep(hit.key, answer)
        const stepId = hit.key.split(':')[1]
        const out = completeStep(world.current!, hit.quest, stepId)
        commit(out.state)
        for (const t of out.toasts) toast(t)
        if (r.applied && (r.xp || r.coins)) toast(`+${r.xp} XP${r.coins ? ` · +${r.coins} moedas` : ''}`, 'reward')
        if (out.navigate) setPendingNav(out.navigate)
        // Efeitos da etapa podem cumprir outras etapas (flags, itens).
        const effects = [...(hit.quest.steps.find((x) => x.id === stepId)?.onComplete ?? []), ...(out.state.quests[hit.quest.id]?.done ? (hit.quest.onComplete ?? []) : [])]
        for (const e of effects) {
          const next: WorldEvent | null = e.type === 'flag' ? { type: 'flag', flag: e.flag } : e.type === 'give' ? { type: 'item', item: e.item } : null
          if (next) await runEvent(next, null)
        }
      }
      return true
    },
    [backend, commit, toast],
  )

  /** Fila: eventos de fora são confirmados um de cada vez, em ordem. */
  const fire = useCallback(
    (ev: WorldEvent, answer: string | null = null): Promise<boolean> => {
      const run = async () => {
        const changed = await runEvent(ev, answer)
        if (changed) {
          await invalidateTables(qc, ['game_rewards', 'game_quest_progress'])
          await save()
        }
        return changed
      }
      const p = chain.current.then(run, run)
      chain.current = p.catch(() => null)
      return p.catch((e) => {
        toast(e instanceof Error ? e.message : 'Não foi possível confirmar a etapa.', 'error')
        return false
      })
    },
    [runEvent, qc, save, toast],
  )

  const followUps = useCallback(
    async (effects: Effect[] | undefined) => {
      for (const e of effects ?? []) {
        const ev: WorldEvent | null = e.type === 'flag' ? { type: 'flag', flag: e.flag } : e.type === 'give' ? { type: 'item', item: e.item } : null
        if (ev) await fire(ev)
      }
    },
    [fire],
  )

  /** Aplica efeitos (diálogos, objetos) e dispara os eventos que eles geram. */
  const apply = useCallback(
    (effects: Effect[] | undefined) => {
      if (!effects?.length || !world.current) return
      const prev = world.current
      const out = applyEffects(prev, effects)
      commit(out.state)
      for (const t of out.toasts) toast(t)
      if (out.navigate) setPendingNav(out.navigate)
      if (out.state.region !== prev.region) void enterRegion(out.state.region)
      void followUps(effects)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enterRegion é estável o bastante (declarada abaixo)
    [commit, toast, followUps],
  )

  const enterRegion = useCallback(
    async (region: string) => {
      // Efeitos de chegada (ex.: a missão da cidade começa) antes da marca de visita.
      const onEnter = WORLD.regions[region]?.onEnter
      if (onEnter?.length) commit(applyEffects(world.current!, onEnter).state)
      const flag = `visited_${region}`
      if (!world.current!.flags[flag]) {
        commit({ ...world.current!, flags: { ...world.current!.flags, [flag]: true } })
        await fire({ type: 'flag', flag })
      }
      await followUps(onEnter)
      await save()
    },
    [commit, fire, followUps, save],
  )

  return {
    world,
    version,
    loading,
    error,
    toasts,
    toast,
    commit,
    apply,
    fire,
    save,
    enterRegion,
    pendingNav,
    clearNav: () => setPendingNav(null),
    isDirty: () => dirty.current,
  }
}
