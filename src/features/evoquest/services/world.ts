// Persistência do mundo e integração com o restante do app.
import { z } from 'zod'
import type { DataBackend } from '@/lib/data/types'
import { DataError, eq } from '@/lib/data/types'
import { fetchAll } from '@/hooks/data'
import { addManualSession } from '@/services/sessions'
import type { EvoQuestSettings } from '@/types/db'
import { START, WORLD } from '../content'
import { newWorld, reconcile } from '../engine/state'
import type { WorldState } from '../engine/types'

const lookSchema = z.object({ skin: z.string().max(20), hair: z.string().max(20), outfit: z.string().max(20), accent: z.string().max(20) })

/** O salvamento vem do banco do próprio usuário, mas é validado como entrada externa. */
const saveSchema = z.object({
  version: z.literal(1),
  character: z.object({ name: z.string().min(1).max(40), look: lookSchema }).nullable(),
  region: z.string().max(40),
  x: z.number().finite(),
  y: z.number().finite(),
  facing: z.enum(['up', 'down', 'left', 'right']),
  flags: z.record(z.string(), z.boolean()),
  inventory: z.array(z.string().max(60)).max(200),
  quests: z.record(z.string(), z.object({ step: z.number().int().min(0), done: z.boolean() })),
  rel: z.record(z.string(), z.number()),
  steps: z.array(z.string().max(120)).max(1000),
  unlocked: z.array(z.string()).max(50),
  introSeen: z.boolean(),
  myCity: z.object({ lots: z.array(z.string().max(60).nullable()).max(12) }).optional(),
})

export function parseSave(raw: unknown): WorldState | null {
  const r = saveSchema.safeParse(raw)
  if (!r.success || !WORLD.regions[r.data.region]) return null
  return r.data as WorldState
}

export async function loadWorld(backend: DataBackend): Promise<{ state: WorldState; saveId: string | null }> {
  const [saves, progress] = await Promise.all([
    backend.list('game_saves', { filters: [eq('slot', 'main')], limit: 1 }),
    fetchAll(backend, 'game_quest_progress'),
  ])
  const row = saves.rows[0]
  const base = (row && parseSave(row.data)) || newWorld(START)
  // O servidor é a fonte da verdade sobre etapas concluídas.
  return { state: reconcile(base, WORLD.quests, progress.map((p) => p.step_key)), saveId: row?.id ?? null }
}

export async function saveWorld(backend: DataBackend, state: WorldState, saveId: string | null): Promise<string> {
  const data = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  if (saveId) {
    const [r] = await backend.update('game_saves', [eq('id', saveId)], { data })
    if (r) return r.id
  }
  try {
    const [r] = await backend.insert('game_saves', [{ slot: 'main', data }])
    return r.id
  } catch (e) {
    // Outra aba criou o salvamento primeiro: atualiza o existente.
    if (!(e instanceof DataError) || e.code !== 'duplicate') throw e
    const existing = await backend.list('game_saves', { filters: [eq('slot', 'main')], limit: 1 })
    const id = existing.rows[0].id
    await backend.update('game_saves', [eq('id', id)], { data })
    return id
  }
}

export type TimeResult = 'registered' | 'skipped-overlap' | 'skipped-short' | 'disabled'

/**
 * Registra o tempo ATIVO jogado como sessão de estudo na matéria vinculada à
 * disciplina da região. Mesma regra do modo clássico: se já houver sessão no
 * intervalo (ex.: o cronômetro estava ligado), não registra de novo.
 */
export async function recordPlayTime(backend: DataBackend, input: { activeSeconds: number; subject: string; regionName: string; settings: EvoQuestSettings }): Promise<TimeResult> {
  if (!input.settings.registerTime) return 'disabled'
  const minutes = Math.floor(input.activeSeconds / 60)
  if (minutes < 1) return 'skipped-short'
  try {
    await addManualSession(backend, {
      subject_id: input.settings.links[input.subject] ?? null,
      topic_id: null,
      activity_type: 'questions',
      started_at: Date.now() - minutes * 60_000,
      duration_minutes: minutes,
      notes: `EvoQuest — ${input.regionName} (mundo)`,
    })
    return 'registered'
  } catch (e) {
    if (e instanceof DataError && e.code === 'validation') return 'skipped-overlap'
    throw e
  }
}
