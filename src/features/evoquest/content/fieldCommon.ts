// Base das revisões de campo parametrizadas (SQL, Python…): o modelo que o
// servidor conhece (game_activities, parametric = true) e o gerador de
// números determinístico que faz "mesma semente, mesmo exercício".
import type { Stage } from '../engine/pedagogy'

export interface FieldTemplate {
  /** Id da atividade no catálogo do servidor (game_activities). */
  id: string
  subject: string
  concept: string
  stage: Stage
  title: string
  /** Registros de evidência aceitos por dia. */
  dailyLimit: number
}

/** PRNG pequeno e determinístico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
