import { stepKey } from '../engine/state'
import { ITEMS, SPEAKERS } from './common'
import { DATA_CITY, DATA_CITY_CHALLENGES, DATA_CITY_DIALOGUES, DATA_CITY_INPUTS, DATA_CITY_QUESTS, POWER_PUZZLE, ROOT_BOSS, SENTINEL } from './dataCity'
import { GUILD_BOARD, HUB, HUB_DIALOGUES, TUTORIAL } from './hub'
import { byId, type WorldContent } from './registry'

/**
 * Recompensas por etapa. Só etapas que exigem conhecimento validado rendem
 * XP; conversas e deslocamentos valem 0 (não há o que "farmar"). O servidor
 * guarda os mesmos valores (migração do catálogo) e é quem credita.
 */
const REWARDS: Record<string, { xp: number; coins: number }> = {
  'tutorial:board': { xp: 30, coins: 10 },
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

const quests = byId([TUTORIAL, ...DATA_CITY_QUESTS])
const rewards: WorldContent['rewards'] = {}
for (const q of Object.values(quests)) for (const s of q.steps) rewards[stepKey(q.id, s.id)] = REWARDS[stepKey(q.id, s.id)] ?? { xp: 0, coins: 0 }

export const WORLD: WorldContent = {
  regions: byId([HUB, DATA_CITY]),
  speakers: byId(SPEAKERS),
  dialogues: byId([...HUB_DIALOGUES, ...DATA_CITY_DIALOGUES]),
  items: byId(ITEMS),
  quests,
  challenges: byId([GUILD_BOARD, ...DATA_CITY_CHALLENGES, ...DATA_CITY_INPUTS, POWER_PUZZLE]),
  encounters: byId([SENTINEL]),
  bosses: byId([ROOT_BOSS]),
  rewards,
}

/** Regiões do mapa do mundo (as que ainda não têm fatia jogável aparecem bloqueadas). */
export const WORLD_MAP: Array<{ id: string; name: string; subject: string; blurb: string; playable: boolean; x: number; y: number }> = [
  { id: 'data_city', name: 'Cidade dos Dados', subject: 'sql', blurb: 'SQL · DAX · Linguagem M', playable: true, x: 78, y: 50 },
  { id: 'lab_aurora', name: 'Laboratório Aurora', subject: 'python', blurb: 'Python para Dados', playable: false, x: 50, y: 84 },
  { id: 'language_tower', name: 'Torre dos Idiomas', subject: 'ingles', blurb: 'Inglês', playable: false, x: 50, y: 14 },
  { id: 'logic_temple', name: 'Templo da Lógica', subject: 'logica', blurb: 'Raciocínio Lógico', playable: false, x: 20, y: 50 },
  { id: 'observatory', name: 'Observatório', subject: 'estatistica', blurb: 'Estatística', playable: false, x: 24, y: 20 },
  { id: 'archive', name: 'Arquivo Público', subject: 'portugues', blurb: 'Português', playable: false, x: 22, y: 80 },
  { id: 'command_tower', name: 'Torre de Comando', subject: 'dax', blurb: 'DAX', playable: false, x: 78, y: 20 },
  { id: 'refinery', name: 'Refinaria', subject: 'm', blurb: 'Linguagem M', playable: false, x: 78, y: 82 },
]

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
