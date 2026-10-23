// Cidades geradas a partir do conteúdo do EvoQuest clássico. Cada unidade
// vira um prédio com um guardião; vencer o chefe da unidade (no modo clássico,
// conferido no servidor) cumpre a etapa da missão da cidade. Assim toda
// disciplina tem uma cidade jogável sem escrever uma história à mão.
//
// O guardião abre o painel da unidade (ui/UnitHub): a unidade vira uma
// sequência pedagógica — lição → prática guiada (reconhecer) → prática
// sozinho (produzir) → desafio integrado (chefe) — com o próximo passo
// recomendado e o motivo (game/engine/stages.ts).
import type { SubjectContent } from '@/game/types'
import dax from '@/game/content/dax'
import estatistica from '@/game/content/estatistica'
import ingles from '@/game/content/ingles'
import logica from '@/game/content/logica'
import m from '@/game/content/m'
import portugues from '@/game/content/portugues'
import python from '@/game/content/python'
import type { CharacterLook, DialogueDef, EntityDef, ItemDef, QuestDef, RegionDef, Speaker } from '../engine/types'
import { STATION_SPOT, type CityDef } from './cities'
import { canvas } from './registry'

export const CLASSIC_CONTENT: Record<string, SubjectContent> = { dax, estatistica, ingles, logica, m, portugues, python }

export interface GeneratedCity {
  region: RegionDef
  speakers: Speaker[]
  dialogues: DialogueDef[]
  quest: QuestDef
  items: ItemDef[]
}

const LOOKS: CharacterLook[] = [
  { skin: '#c99068', hair: '#2b1d14', outfit: '#2a78d6', accent: '#f5deb3' },
  { skin: '#8d5a3b', hair: '#1c1410', outfit: '#1baf7a', accent: '#eda100' },
  { skin: '#f1cfa8', hair: '#b4483c', outfit: '#6250d6', accent: '#f5deb3' },
  { skin: '#e5b38a', hair: '#d9d4cc', outfit: '#9b3d2f', accent: '#38d0ff' },
]

/** Recompensas da missão de cada cidade gerada (espelhadas no servidor). */
export const GENERATED_REWARDS = { unit: { xp: 60, coins: 25 }, finale: { xp: 100, coins: 35 } }

export const cityQuestId = (city: string) => `city_${city}`

/** Desafio de chefe da unidade (ou o último, se a unidade não tiver chefe marcado). */
export function unitBoss(unit: SubjectContent['units'][number]): string {
  return (unit.challenges.find((c) => c.boss) ?? unit.challenges[unit.challenges.length - 1]).id
}

export function buildCity(city: CityDef, content: SubjectContent, subjectName: string): GeneratedCity {
  const units = content.units
  const quest = cityQuestId(city.id)
  const rows = Math.ceil(units.length / 3)
  const W = 30
  const plazaY = 1 + rows * 7
  const H = plazaY + 10

  // Legenda: # cerca · . chão · , rua · O praça · R telhado · B parede · D porta · T árvore · F flores
  const map = canvas(W, H, '.')
  map.rect(0, 0, W - 1, 0, '#').rect(0, H - 1, W - 1, H - 1, '#').rect(0, 0, 0, H - 1, '#').rect(W - 1, 0, W - 1, H - 1, '#')
  const spots = units.map((_, i) => ({ x: 2 + (i % 3) * 9, y: 1 + Math.floor(i / 3) * 7 }))
  for (const { x, y } of spots) {
    map.rect(x, y, x + 5, y + 1, 'R').rect(x, y + 2, x + 5, y + 2, 'B').set(x + 2, y + 2, 'D')
    map.rect(x + 2, y + 3, x + 2, y + 4, ',')
    map.rect(2, y + 4, W - 3, y + 4, ',')
  }
  map.rect(10, plazaY, 19, plazaY + 4, 'O')
  map.rect(15, 5, 15, plazaY + 6, ',')
  map.rect(2, plazaY + 6, W - 3, plazaY + 6, ',')
  map.rect(2, plazaY + 7, 6, plazaY + 8, 'O')
  map.set(1, plazaY + 1, 'T').set(W - 2, plazaY + 1, 'T').set(1, plazaY + 3, 'T').set(W - 2, plazaY + 3, 'T')
  map.set(9, plazaY + 1, 'F').set(20, plazaY + 1, 'F').set(9, plazaY + 3, 'F').set(20, plazaY + 3, 'F')

  const speakers: Speaker[] = [{ id: `${city.id}_mentor`, name: `Prefeitura de ${city.name}`, role: `Cuida de ${city.name}`, look: { skin: '#a86f4c', hair: '#e8e2d6', outfit: city.theme.roof, accent: '#deb887' } }]
  const dialogues: DialogueDef[] = []
  const entities: EntityDef[] = [
    {
      id: 'ponto',
      kind: 'portal',
      x: 3,
      y: plazaY + 7,
      name: 'Ponto de ônibus',
      sprite: 'bus_stop',
      verb: 'Embarcar',
      on: [{ do: 'effects', effects: [{ type: 'teleport', ...STATION_SPOT }], text: 'O ônibus leva você de volta à Rodoviária da Vila Evolumental.' }],
    },
  ]

  const stepKeyOf = (i: number) => `${quest}:unit_${i + 1}`
  units.forEach((unit, i) => {
    const npc = `${city.id}_u${i + 1}`
    const title = unit.title
    speakers.push({ id: npc, name: `Guardiã(o) de ${title}`, role: `${subjectName} · unidade ${i + 1}`, look: LOOKS[i % LOOKS.length] })
    const s = spots[i]
    entities.push({
      id: npc,
      kind: 'npc',
      x: s.x + 4,
      y: s.y + 3,
      name: speakers[speakers.length - 1].name,
      sprite: npc,
      solid: true,
      verb: 'Falar',
      marker: { at: stepKeyOf(i) },
      on: [
        { when: { notStep: `${quest}:mentor` }, do: 'say', text: 'A porta está fechada. Fale primeiro com a Prefeitura, na praça.' },
        ...(i > 0 ? [{ when: { notStep: stepKeyOf(i - 1) }, do: 'say' as const, text: `Ainda não. Ajude primeiro o prédio de "${units[i - 1].title}".` }] : []),
        { do: 'unit', subject: city.subject, unit: unit.id },
      ],
    })
  })

  const mentor = `${city.id}_mentor`
  dialogues.push(
    {
      id: `${mentor}_intro`,
      start: 'm1',
      nodes: [
        { id: 'm1', speaker: mentor, text: `Bem-vindo(a) a ${city.name}, {name}! Aqui se vive de ${subjectName}.`, next: 'm2' },
        { id: 'm2', speaker: mentor, text: `Cada prédio da cidade guarda uma unidade. São ${units.length}, e cada uma tem um guardião e um chefe.`, next: 'm2b' },
        { id: 'm2b', speaker: mentor, text: 'Em cada prédio, o guardião mostra o caminho: lição, prática guiada, prática sozinho e o chefe. Ele também diz qual é o seu próximo passo e por quê.', next: 'm3' },
        // m3 continua sendo o último nó: a etapa "mentor" termina nele.
        { id: 'm3', speaker: mentor, text: 'Vença os chefes, um prédio de cada vez. Cada vitória rende moedas, e com elas você compra passagens para outras cidades na Rodoviária.' },
      ],
    },
    {
      id: `${mentor}_idle`,
      start: 'x1',
      nodes: [{ id: 'x1', speaker: mentor, text: 'Os guardiões estão nos prédios ao norte. O ponto de ônibus fica a sudoeste da praça.' }],
    },
    {
      id: `${mentor}_finale`,
      start: 'f1',
      nodes: [
        { id: 'f1', speaker: mentor, text: `Todos os chefes vencidos! ${city.name} não esquece quem a ajudou.`, next: 'f2', effects: [{ type: 'give', item: `emblema_${city.id}` }] },
        { id: 'f2', speaker: mentor, text: 'Leve o emblema da cidade. Quando quiser revisar, os guardiões continuam aqui.' },
      ],
    },
    {
      id: `${mentor}_done`,
      start: 'd1',
      nodes: [{ id: 'd1', speaker: mentor, text: `${city.name} está em paz, graças a você. Volte para revisar quando quiser.` }],
    },
  )
  entities.push({
    id: mentor,
    kind: 'npc',
    x: 14,
    y: plazaY + 2,
    name: speakers[0].name,
    sprite: mentor,
    solid: true,
    verb: 'Falar',
    marker: { at: `${quest}:mentor` },
    on: [
      { when: { at: `${quest}:mentor` }, do: 'dialogue', dialogue: `${mentor}_intro` },
      { when: { at: `${quest}:finale` }, do: 'dialogue', dialogue: `${mentor}_finale` },
      { when: { questDone: quest }, do: 'dialogue', dialogue: `${mentor}_done` },
      { do: 'dialogue', dialogue: `${mentor}_idle` },
    ],
  })

  const region: RegionDef = {
    id: city.id,
    name: city.name,
    subtitle: city.subtitle,
    subject: city.subject,
    palette: 'town',
    spawn: { x: 4, y: plazaY + 7 },
    onEnter: [{ type: 'startQuest', quest }, { type: 'flag', flag: 'city_visited' }],
    map: {
      rows: map.rows(),
      legend: {
        '#': { solid: true, sprite: 'hedge' },
        '.': { solid: false, sprite: `ground:${city.theme.ground}` },
        ',': { solid: false, sprite: `ground:${city.theme.path}` },
        O: { solid: false, sprite: 'plaza' },
        R: { solid: true, sprite: `roof:${city.theme.roof}` },
        B: { solid: true, sprite: 'wall' },
        D: { solid: true, sprite: 'door' },
        T: { solid: true, sprite: 'tree' },
        F: { solid: false, sprite: 'flowers' },
      },
    },
    entities,
  }

  const questDef: QuestDef = {
    id: quest,
    kind: 'main',
    title: `Os guardiões de ${city.name}`,
    region: city.id,
    summary: `Ajude os prédios de ${city.name} vencendo os chefes das unidades de ${subjectName}.`,
    rewardText: `Moedas para novas passagens e o Emblema de ${city.name}`,
    steps: [
      { id: 'arrive', text: `Chegue a ${city.name} de ônibus.`, objective: { type: 'flag', flag: `visited_${city.id}` } },
      { id: 'mentor', text: 'Fale com a Prefeitura, na praça da cidade.', objective: { type: 'talk', npc: mentor, dialogueEnds: 'm3' } },
      ...units.map((unit, i) => ({
        id: `unit_${i + 1}`,
        text: `Vença o chefe de "${unit.title}" (fale com o guardião do prédio).`,
        objective: { type: 'answered' as const, challenge: unitBoss(unit) },
      })),
      { id: 'finale', text: 'Volte à Prefeitura e conte que os chefes caíram.', objective: { type: 'talk', npc: mentor, dialogueEnds: 'f2' } },
    ],
  }

  return {
    region,
    speakers,
    dialogues,
    quest: questDef,
    items: [{ id: `emblema_${city.id}`, name: `Emblema de ${city.name}`, icon: '🏅', description: `Concedido a quem venceu todos os chefes de ${city.name}.` }],
  }
}
