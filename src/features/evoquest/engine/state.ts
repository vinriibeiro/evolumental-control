// Estado do mundo: condições, efeitos e progresso de missões. Funções puras:
// cada operação devolve um estado novo (fácil de salvar, testar e desfazer).
import type { Cond, Effect, QuestDef, WorldState } from './types'

export function newWorld(spawn: { region: string; x: number; y: number }): WorldState {
  return {
    version: 1,
    character: null,
    region: spawn.region,
    x: spawn.x,
    y: spawn.y,
    facing: 'down',
    flags: {},
    inventory: [],
    quests: {},
    rel: {},
    steps: [],
    unlocked: [],
    introSeen: false,
  }
}

export function check(state: WorldState, cond: Cond | undefined, quests: Record<string, QuestDef>): boolean {
  if (!cond) return true
  if (cond.flag && !state.flags[cond.flag]) return false
  if (cond.notFlag && state.flags[cond.notFlag]) return false
  if (cond.item && !state.inventory.includes(cond.item)) return false
  if (cond.notItem && state.inventory.includes(cond.notItem)) return false
  if (cond.step && !state.steps.includes(cond.step)) return false
  if (cond.notStep && state.steps.includes(cond.notStep)) return false
  if (cond.questDone && !state.quests[cond.questDone]?.done) return false
  if (cond.at) {
    const [q, s] = cond.at.split(':')
    if (currentStep(state, quests[q])?.id !== s) return false
  }
  return true
}

export interface EffectOutput {
  state: WorldState
  toasts: string[]
  navigate: string | null
}

export function applyEffects(state: WorldState, effects: Effect[] | undefined): EffectOutput {
  let s = state
  const toasts: string[] = []
  let navigate: string | null = null
  for (const e of effects ?? []) {
    switch (e.type) {
      case 'flag':
        s = { ...s, flags: { ...s.flags, [e.flag]: e.value ?? true } }
        break
      case 'give':
        if (!s.inventory.includes(e.item)) s = { ...s, inventory: [...s.inventory, e.item] }
        break
      case 'take':
        s = { ...s, inventory: s.inventory.filter((i) => i !== e.item) }
        break
      case 'startQuest':
        if (!s.quests[e.quest]) s = { ...s, quests: { ...s.quests, [e.quest]: { step: 0, done: false } } }
        break
      case 'rel':
        s = { ...s, rel: { ...s.rel, [e.npc]: Math.max(-3, Math.min(3, (s.rel[e.npc] ?? 0) + e.delta)) } }
        break
      case 'toast':
        toasts.push(e.text)
        break
      case 'navigate':
        navigate = e.to
        break
      case 'teleport':
        s = { ...s, region: e.region, x: e.x, y: e.y }
        break
    }
  }
  return { state: s, toasts, navigate }
}

export function currentStep(state: WorldState, quest: QuestDef | undefined) {
  if (!quest) return undefined
  const p = state.quests[quest.id]
  if (!p || p.done) return undefined
  return quest.steps[p.step]
}

export const stepKey = (quest: string, step: string) => `${quest}:${step}`

/** Evento do mundo que pode cumprir objetivos. */
export type WorldEvent =
  | { type: 'talk'; npc: string; endedAt?: string }
  | { type: 'interact'; target: string }
  | { type: 'item'; item: string }
  | { type: 'flag'; flag: string }
  | { type: 'solve'; challenge: string }

/** Etapas (de qualquer missão ativa) que este evento cumpre agora. */
export function stepsCompletedBy(state: WorldState, quests: Record<string, QuestDef>, ev: WorldEvent): Array<{ quest: QuestDef; key: string }> {
  const out: Array<{ quest: QuestDef; key: string }> = []
  for (const q of Object.values(quests)) {
    const step = currentStep(state, q)
    if (!step) continue
    const o = step.objective
    const hit =
      (o.type === 'talk' && ev.type === 'talk' && o.npc === ev.npc && (!o.dialogueEnds || o.dialogueEnds === ev.endedAt)) ||
      (o.type === 'interact' && ev.type === 'interact' && o.target === ev.target) ||
      (o.type === 'item' && ev.type === 'item' && o.item === ev.item) ||
      (o.type === 'flag' && ev.type === 'flag' && o.flag === ev.flag) ||
      (o.type === 'solve' && ev.type === 'solve' && o.challenge === ev.challenge)
    if (hit) out.push({ quest: q, key: stepKey(q.id, step.id) })
  }
  return out
}

/**
 * Avança a missão depois que o servidor confirmou a etapa. Idempotente: se a
 * etapa já não é a atual, nada muda. Aplica os efeitos da etapa e, ao fim,
 * os da missão.
 */
export function completeStep(state: WorldState, quest: QuestDef, stepId: string): EffectOutput {
  const p = state.quests[quest.id]
  const step = currentStep(state, quest)
  if (!p || !step || step.id !== stepId) return { state, toasts: [], navigate: null }
  const key = stepKey(quest.id, stepId)
  const next = p.step + 1
  const done = next >= quest.steps.length
  let s: WorldState = {
    ...state,
    steps: state.steps.includes(key) ? state.steps : [...state.steps, key],
    quests: { ...state.quests, [quest.id]: { step: next, done } },
  }
  const a = applyEffects(s, step.onComplete)
  s = a.state
  if (!done) return a
  const b = applyEffects(s, quest.onComplete)
  return { state: b.state, toasts: [...a.toasts, ...b.toasts], navigate: b.navigate ?? a.navigate }
}

/**
 * Reconcilia o salvamento local com as etapas confirmadas pelo servidor
 * (fonte da verdade): uma etapa confirmada nunca "volta", e o progresso
 * local não passa à frente do que o servidor sabe para etapas com recompensa.
 */
export function reconcile(state: WorldState, quests: Record<string, QuestDef>, serverSteps: string[]): WorldState {
  const confirmed = new Set(serverSteps)
  let s = { ...state, steps: [...new Set([...state.steps, ...serverSteps])] }
  for (const q of Object.values(quests)) {
    let last = -1
    q.steps.forEach((st, i) => {
      if (confirmed.has(stepKey(q.id, st.id))) last = i
    })
    if (last < 0) continue
    const cur = s.quests[q.id]
    if (!cur || cur.step <= last) {
      s = { ...s, quests: { ...s.quests, [q.id]: { step: last + 1, done: last + 1 >= q.steps.length } } }
      // Reaplica efeitos das etapas confirmadas (portas abertas, itens).
      for (let i = cur?.step ?? 0; i <= last; i++) s = applyEffects(s, q.steps[i].onComplete).state
      if (last + 1 >= q.steps.length) s = applyEffects(s, q.onComplete).state
    }
  }
  return s
}
