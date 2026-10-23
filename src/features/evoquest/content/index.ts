import { subjectMeta } from '@/game/catalog'
import { stepKey } from '../engine/state'
import { CITIES } from './cities'
import { ITEMS, SPEAKERS } from './common'
import { DATA_CITY, DATA_CITY_CHALLENGES, DATA_CITY_DIALOGUES, DATA_CITY_INPUTS, DATA_CITY_QUESTS, POWER_PUZZLE, ROOT_BOSS, SENTINEL } from './dataCity'
import { buildCity, CLASSIC_CONTENT, GENERATED_REWARDS } from './generatedCity'
import { GUILD_BOARD, HUB, HUB_DIALOGUES, SIDE_BOARD, TUTORIAL } from './hub'
import { buildMyCity, emptyLots } from './myCity'
import { byId, type WorldContent } from './registry'

/** Cidades sem história escrita à mão: geradas das unidades do modo clássico. */
const GENERATED = CITIES.filter((c) => CLASSIC_CONTENT[c.subject]).map((c) => buildCity(c, CLASSIC_CONTENT[c.subject], subjectMeta(c.subject)?.name ?? c.blurb))

/**
 * Recompensas por etapa. Só etapas que exigem conhecimento validado rendem
 * XP; conversas e deslocamentos valem 0 (não há o que "farmar"). O servidor
 * guarda os mesmos valores (migração do catálogo) e é quem credita.
 */
const REWARDS: Record<string, { xp: number; coins: number }> = {
  'side_board:query': { xp: 30, coins: 10 },
  'sql_main:door': { xp: 40, coins: 5 },
  'sql_main:logs': { xp: 60, coins: 5 },
  'sql_main:who': { xp: 80, coins: 10 },
  'sql_main:sentinel': { xp: 120, coins: 15 },
  'sql_main:power': { xp: 50, coins: 5 },
  'sql_main:boss_logs': { xp: 70, coins: 5 },
  'sql_main:boss_join': { xp: 90, coins: 10 },
  'sql_main:boss_agg': { xp: 110, coins: 10 },
  'sql_main:boss_fix': { xp: 160, coins: 25 },
  'sql_main:finale': { xp: 100, coins: 40 },
  'side_badges:find': { xp: 70, coins: 10 },
  'side_cafe:find': { xp: 60, coins: 10 },
}
for (const g of GENERATED)
  for (const s of g.quest.steps) {
    if (s.objective.type === 'answered') REWARDS[stepKey(g.quest.id, s.id)] = GENERATED_REWARDS.unit
    if (s.id === 'finale') REWARDS[stepKey(g.quest.id, s.id)] = GENERATED_REWARDS.finale
  }

const quests = byId([TUTORIAL, SIDE_BOARD, ...DATA_CITY_QUESTS, ...GENERATED.map((g) => g.quest)])
const rewards: WorldContent['rewards'] = {}
for (const q of Object.values(quests)) for (const s of q.steps) rewards[stepKey(q.id, s.id)] = REWARDS[stepKey(q.id, s.id)] ?? { xp: 0, coins: 0 }

export const WORLD: WorldContent = {
  // my_city é trocada em tempo de execução pela versão com as matérias do jogador.
  regions: byId([HUB, DATA_CITY, ...GENERATED.map((g) => g.region), buildMyCity(emptyLots())]),
  speakers: byId([...SPEAKERS, ...GENERATED.flatMap((g) => g.speakers)]),
  dialogues: byId([...HUB_DIALOGUES, ...DATA_CITY_DIALOGUES, ...GENERATED.flatMap((g) => g.dialogues)]),
  items: byId([...ITEMS, ...GENERATED.flatMap((g) => g.items)]),
  quests,
  challenges: byId([GUILD_BOARD, ...DATA_CITY_CHALLENGES, ...DATA_CITY_INPUTS, POWER_PUZZLE]),
  encounters: byId([SENTINEL]),
  bosses: byId([ROOT_BOSS]),
  rewards,
}

/** Árvore de habilidades de SQL (ver docs/REDESIGN.md). */
export const SQL_SKILLS: Array<{ id: string; name: string; requires: string[]; covers: string[] }> = [
  { id: 'fundamentos', name: 'Fundamentos', requires: [], covers: ['select'] },
  { id: 'select', name: 'SELECT', requires: ['fundamentos'], covers: ['select'] },
  { id: 'filtros', name: 'Filtros', requires: ['select'], covers: ['where', 'logic', 'orderby'] },
  { id: 'join', name: 'JOIN', requires: ['filtros'], covers: ['join', 'distinct', 'leftjoin'] },
  { id: 'agregacao', name: 'Agregação', requires: ['filtros'], covers: ['groupby', 'having'] },
  { id: 'subqueries', name: 'Subqueries', requires: ['join', 'agregacao'], covers: ['subquery'] },
  { id: 'avancado', name: 'SQL Avançado', requires: ['subqueries'], covers: ['update'] },
]

export const START = { region: 'hub', x: HUB.spawn.x + 0.5, y: HUB.spawn.y + 0.5 }
