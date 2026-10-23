// Minha Cidade: a cidade do próprio jogador, construída com as matérias do
// Control. Cada lote recebe uma matéria e o prédio cresce com as horas
// líquidas estudadas nela (desenvolvimento físico) e funciona conforme o
// domínio da matéria (desenvolvimento funcional) — o mapa é gerado de novo
// quando algo muda.
import type { MasteryLevel } from '@/lib/insight/mastery'
import type { RegionDef } from '../engine/types'
import { STATION_SPOT } from './cities'
import { canvas } from './registry'

export const MY_CITY = 'my_city'
export const LOT_COUNT = 6

export const LEVELS: Array<{ name: string; hours: number }> = [
  { name: 'Terreno', hours: 0 },
  { name: 'Fundação', hours: 1 },
  { name: 'Casa', hours: 5 },
  { name: 'Sobrado', hours: 15 },
  { name: 'Prédio', hours: 40 },
  { name: 'Torre', hours: 100 },
]

export interface LevelInfo {
  level: number
  name: string
  next: { name: string; hours: number } | null
  /** 0..1 até o próximo nível (1 no último). */
  progress: number
}

export function levelFor(seconds: number): LevelInfo {
  const hours = Math.max(0, seconds) / 3600
  let level = 0
  for (let i = 0; i < LEVELS.length; i++) if (hours >= LEVELS[i].hours) level = i
  const next = LEVELS[level + 1] ?? null
  const from = LEVELS[level].hours
  return { level, name: LEVELS[level].name, next, progress: next ? Math.min(1, (hours - from) / (next.hours - from)) : 1 }
}

/**
 * Desenvolvimento FUNCIONAL do prédio: vem do domínio da matéria no Control
 * (prática verificada, retenção…), não do tempo. Horas constroem o prédio;
 * domínio faz ele funcionar.
 */
export const FUNCTIONS: Record<MasteryLevel, { name: string; text: string }> = {
  none: { name: 'Às escuras', text: 'Ainda sem prática verificada: o prédio existe, mas não funciona.' },
  unconsolidated: { name: 'Luz de serviço', text: 'Primeiros acertos: só o térreo acende.' },
  fragile: { name: 'Meio expediente', text: 'Funciona com falhas: os erros recentes ainda pesam.' },
  developing: { name: 'Em operação', text: 'Funciona no dia a dia: falta consolidar.' },
  consolidating: { name: 'Movimentado', text: 'Gente entrando e saindo: o domínio está se firmando.' },
  mastered: { name: 'Referência da cidade', text: 'Domínio consolidado: o prédio atende a cidade inteira.' },
}

export function functionFor(m: { value: number; level: MasteryLevel } | null | undefined) {
  const level: MasteryLevel = m?.level ?? 'none'
  return { level, value: m?.value ?? 0, ...FUNCTIONS[level] }
}

export interface LotView {
  subjectId: string | null
  name: string
  color: string
  level: number
}

const HEX = /^#[0-9a-f]{6}$/i

/** Lotes vazios (antes de carregar as matérias, ou sem nenhuma construída). */
export const emptyLots = (): LotView[] => Array.from({ length: LOT_COUNT }, () => ({ subjectId: null, name: 'Terreno livre', color: '#8a6239', level: 0 }))

/** Canto superior esquerdo de cada lote (6 × 4 tiles de prédio + calçada). */
export const lotOrigin = (i: number) => ({ x: 2 + (i % 3) * 9, y: 1 + Math.floor(i / 3) * 8 })

export function buildMyCity(lots: LotView[]): RegionDef {
  const W = 30
  const H = 20
  // Legenda: # cerca · . grama · , rua · O praça · d terra · f fundação · B parede · H parede alta
  // · D porta · Y telhado dourado · 0–5 telhado na cor da matéria do lote · T árvore · F flores
  const map = canvas(W, H, '.')
  map.rect(0, 0, W - 1, 0, '#').rect(0, H - 1, W - 1, H - 1, '#').rect(0, 0, 0, H - 1, '#').rect(W - 1, 0, W - 1, H - 1, '#')
  map.rect(1, 6, W - 2, 6, ',').rect(1, 14, W - 2, 14, ',').rect(15, 6, 15, 14, ',')
  map.rect(1, 16, W - 2, 18, 'O')
  map.set(28, 2, 'T').set(28, 10, 'F').set(1, 10, 'F')

  const legend: RegionDef['map']['legend'] = {
    '#': { solid: true, sprite: 'hedge' },
    '.': { solid: false, sprite: 'grass' },
    ',': { solid: false, sprite: 'path' },
    O: { solid: false, sprite: 'plaza' },
    d: { solid: false, sprite: 'dirt' },
    f: { solid: true, sprite: 'foundation' },
    B: { solid: true, sprite: 'wall' },
    H: { solid: true, sprite: 'wall_tall' },
    D: { solid: true, sprite: 'door' },
    Y: { solid: true, sprite: 'roof:#eda100' },
    T: { solid: true, sprite: 'tree' },
    F: { solid: false, sprite: 'flowers' },
  }

  const entities: RegionDef['entities'] = [
    {
      id: 'ponto',
      kind: 'portal',
      x: 2,
      y: 17,
      name: 'Ponto de ônibus',
      sprite: 'bus_stop',
      verb: 'Embarcar',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...STATION_SPOT }], text: 'O ônibus leva você de volta à Rodoviária da Vila Evolumental.' }],
    },
    { id: 'prefeitura', kind: 'object', x: 14, y: 16, name: 'Prefeitura · planta da cidade', sprite: 'board', solid: true, verb: 'Planejar', on: [{ do: 'lot', lot: null }] },
  ]

  lots.slice(0, LOT_COUNT).forEach((lot, i) => {
    const { x, y } = lotOrigin(i)
    const roof = String(i)
    legend[roof] = { solid: true, sprite: `roof:${HEX.test(lot.color) ? lot.color : '#9b3d2f'}` }
    map.rect(x, y, x + 5, y + 3, 'd')
    const lv = lot.subjectId ? lot.level : 0
    if (lv === 1) map.rect(x + 1, y + 2, x + 4, y + 3, 'f')
    if (lv === 2) map.rect(x + 1, y + 2, x + 4, y + 2, roof).rect(x + 1, y + 3, x + 4, y + 3, 'B').set(x + 2, y + 3, 'D')
    if (lv === 3) map.rect(x, y + 1, x + 5, y + 2, roof).rect(x, y + 3, x + 5, y + 3, 'B').set(x + 2, y + 3, 'D')
    if (lv >= 4) map.rect(x, y, x + 5, y, lv === 5 ? 'Y' : roof).rect(x, y + 1, x + 5, y + 3, 'H').set(x + 2, y + 3, 'D')
    entities.push({
      id: `lote_${i}`,
      kind: 'object',
      x: x + 3,
      y: y + 4,
      name: lot.subjectId ? `${lot.name} · ${LEVELS[lv].name}` : `Lote ${i + 1} · terreno livre`,
      sprite: 'sign',
      verb: lot.subjectId ? 'Visitar' : 'Construir',
      on: [{ do: 'lot', lot: i }],
    })
    // Todo prédio construído tem um morador que revisa os flashcards da matéria.
    if (lot.subjectId)
      entities.push({
        id: `morador_${i}`,
        kind: 'npc',
        x: x + 1,
        y: y + 4,
        name: `Morador · ${lot.name}`,
        sprite: 'morador',
        solid: true,
        verb: 'Revisar',
        on: [{ do: 'cards', subject: lot.subjectId }],
      })
  })

  return {
    id: MY_CITY,
    name: 'Minha Cidade',
    subtitle: 'Construída com as suas matérias',
    subject: null,
    palette: 'town',
    spawn: { x: 4, y: 17 },
    map: { rows: map.rows(), legend },
    entities,
  }
}
