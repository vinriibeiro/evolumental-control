// Registro de conteúdo do mundo. Regiões, NPCs, diálogos, itens, missões e
// desafios são DADOS: o motor e a interface só leem daqui.
import type { Challenge } from '../challenges'
import type { EncounterDef } from '../engine/combat'
import type { DialogueDef, ItemDef, QuestDef, RegionDef, Speaker } from '../engine/types'
import type { LessonDef } from '../engine/pedagogy'
import { EXPECTED } from './expected'

export interface BossPhase {
  challenge: string
  title: string
  taunt: string
}

export interface BossDef {
  id: string
  name: string
  speaker: string
  intro: string
  phases: BossPhase[]
  defeat: string
}

export interface WorldContent {
  regions: Record<string, RegionDef>
  speakers: Record<string, Speaker>
  dialogues: Record<string, DialogueDef>
  items: Record<string, ItemDef>
  quests: Record<string, QuestDef>
  challenges: Record<string, Challenge>
  encounters: Record<string, EncounterDef>
  bosses: Record<string, BossDef>
  /** Lições de campo (conceito, exemplo resolvido, erros comuns). */
  lessons: Record<string, LessonDef>
  /** Recompensa de cada etapa (`missao:etapa`) — espelhada no catálogo do servidor. */
  rewards: Record<string, { xp: number; coins: number }>
}

/** Resultado esperado (gerado pelos testes a partir das soluções). */
export function exp(id: string): { hash: string; columns: number; rows: number } {
  return EXPECTED[id] ?? { hash: 'pendente', columns: 0, rows: 0 }
}

/** Terminal Python: hash do conjunto de casos e de cada caso (só para o retorno). */
export function expPy(id: string): { hash: string; cases: string[] } {
  const e = EXPECTED[id]
  return { hash: e?.hash ?? 'pendente', cases: e?.cases ?? [] }
}

/** Rádio (inglês): hash da resposta inteira e um hash por campo do registro (só para o retorno). */
export function expEn(id: string): { hash: string; parts: string[] } {
  const e = EXPECTED[id]
  return { hash: e?.hash ?? 'pendente', parts: e?.cases ?? [] }
}

export function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]))
}

/** Pintura de mapas: evita contar caracteres à mão. */
export function canvas(w: number, h: number, fill: string) {
  const g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill))
  const api = {
    rect(x0: number, y0: number, x1: number, y1: number, ch: string) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch
      return api
    },
    box(x0: number, y0: number, x1: number, y1: number, wall: string, floor: string) {
      api.rect(x0, y0, x1, y1, wall)
      api.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, floor)
      return api
    },
    set(x: number, y: number, ch: string) {
      g[y][x] = ch
      return api
    },
    rows: () => g.map((r) => r.join('')),
  }
  return api
}
