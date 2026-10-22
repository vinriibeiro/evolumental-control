// Combate por ações (não por perguntas): o jogador investiga, descobre a
// vulnerabilidade com ferramentas de conhecimento e só então causa efeito
// real. Ataques "às cegas" existem, mas o inimigo se recupera mais rápido do
// que eles conseguem desgastar — o conhecimento decide a eficiência.

export interface CombatAction {
  id: string
  label: string
  description: string
  /** Conhecimentos necessários (obtidos em outras ações). */
  requires?: string[]
  /** scan: revela um painel · terminal: desafio de terminal · input: digitar um valor descoberto · attack: força bruta. */
  kind: 'scan' | 'terminal' | 'input' | 'attack'
  reveals?: string
  challenge?: string
  input?: { prompt: string; placeholder?: string }
  /** Conhecimento obtido em caso de sucesso. */
  learns?: string
  damage?: number
  /** Variação do firewall em caso de sucesso (negativa derruba). */
  firewall?: number
  ignoresFirewall?: boolean
  /** Consequência de um valor errado. */
  wrong?: { signal?: number; firewall?: number; text: string }
  success?: string
  /** Ação de leitura: não dá a vez ao inimigo. */
  free?: boolean
}

export interface EnemyMove {
  text: string
  firewall?: number
  signal?: number
  heal?: number
}

export interface EncounterDef {
  id: string
  name: string
  intro: string
  integrity: number
  firewall: number
  maxFirewall: number
  signal: number
  panels: Array<{ id: string; label: string; content: string }>
  actions: CombatAction[]
  pattern: EnemyMove[]
  victory: string
  defeat: string
}

export interface CombatState {
  integrity: number
  firewall: number
  signal: number
  turn: number
  knowledge: string[]
  revealed: string[]
  log: Array<{ who: 'player' | 'enemy' | 'system'; text: string }>
  outcome: 'ongoing' | 'won' | 'lost'
}

export function startCombat(def: EncounterDef): CombatState {
  return {
    integrity: def.integrity,
    firewall: def.firewall,
    signal: def.signal,
    turn: 0,
    knowledge: [],
    revealed: [],
    log: [{ who: 'system', text: def.intro }],
    outcome: 'ongoing',
  }
}

export function available(def: EncounterDef, s: CombatState): CombatAction[] {
  return def.actions.filter((a) => (a.requires ?? []).every((k) => s.knowledge.includes(k)) && !(a.learns && s.knowledge.includes(a.learns) && a.kind !== 'attack'))
}

/**
 * Resolve uma ação. `success` vem da validação feita fora do motor (terminal
 * ou valor digitado); scans e ataques são sempre "sucesso".
 */
export function act(def: EncounterDef, s0: CombatState, actionId: string, success = true): CombatState {
  if (s0.outcome !== 'ongoing') return s0
  const a = def.actions.find((x) => x.id === actionId)
  if (!a || !available(def, s0).some((x) => x.id === a.id)) return s0
  const s: CombatState = { ...s0, log: [...s0.log], knowledge: [...s0.knowledge], revealed: [...s0.revealed] }

  if (!success) {
    const w = a.wrong ?? { text: 'Nada acontece.' }
    s.signal = Math.max(0, s.signal - (w.signal ?? 0))
    s.firewall = Math.min(def.maxFirewall, s.firewall + (w.firewall ?? 0))
    s.log.push({ who: 'system', text: w.text })
  } else {
    if (a.reveals && !s.revealed.includes(a.reveals)) s.revealed.push(a.reveals)
    if (a.learns && !s.knowledge.includes(a.learns)) s.knowledge.push(a.learns)
    if (a.firewall) s.firewall = Math.max(0, Math.min(def.maxFirewall, s.firewall + a.firewall))
    if (a.damage) {
      if (s.firewall > 0 && !a.ignoresFirewall) {
        s.firewall -= 1
        s.log.push({ who: 'player', text: `${a.success ?? a.label}. O firewall absorve o impacto (−1 firewall).` })
      } else {
        s.integrity = Math.max(0, s.integrity - a.damage)
        s.log.push({ who: 'player', text: `${a.success ?? a.label} (−${a.damage} integridade).` })
      }
    } else if (a.success) s.log.push({ who: 'player', text: a.success })
  }

  if (s.integrity <= 0) {
    s.outcome = 'won'
    s.log.push({ who: 'system', text: def.victory })
    return s
  }
  if (!a.free || !success) {
    const move = def.pattern[s.turn % def.pattern.length]
    s.turn += 1
    s.firewall = Math.min(def.maxFirewall, s.firewall + (move.firewall ?? 0))
    s.signal = Math.max(0, s.signal - (move.signal ?? 0))
    s.integrity = Math.min(def.integrity, s.integrity + (move.heal ?? 0))
    s.log.push({ who: 'enemy', text: move.text })
  }
  if (s.signal <= 0) {
    s.outcome = 'lost'
    s.log.push({ who: 'system', text: def.defeat })
  }
  return s
}
