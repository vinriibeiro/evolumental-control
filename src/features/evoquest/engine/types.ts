// Tipos do motor do EvoQuest RPG. O motor não conhece disciplinas: SQL,
// inglês ou lógica entram apenas como conteúdo (dados) e validadores.

export type Dir = 'up' | 'down' | 'left' | 'right'

/** Condição sobre o estado do mundo (todas as chaves presentes precisam valer). */
export interface Cond {
  flag?: string
  notFlag?: string
  item?: string
  notItem?: string
  /** Etapa de missão já concluída (`missao:etapa`). */
  step?: string
  notStep?: string
  /** Etapa atual da missão é esta (`missao:etapa`). */
  at?: string
  questDone?: string
}

export type Effect =
  | { type: 'flag'; flag: string; value?: boolean }
  | { type: 'give'; item: string }
  | { type: 'take'; item: string }
  | { type: 'startQuest'; quest: string }
  | { type: 'rel'; npc: string; delta: number }
  | { type: 'toast'; text: string }
  /** Sai do mundo e abre uma tela do app (ex.: Sala de Troféus → conquistas). */
  | { type: 'navigate'; to: string }
  | { type: 'teleport'; region: string; x: number; y: number }

export interface Tile {
  solid: boolean
  /** Bloqueia só enquanto a flag NÃO estiver ligada (portas). */
  openWhen?: string
}

export interface MapDef {
  rows: string[]
  legend: Record<string, Tile & { sprite: string }>
}

export interface EntityDef {
  id: string
  kind: 'npc' | 'object' | 'portal' | 'enemy'
  x: number
  y: number
  name: string
  sprite: string
  solid?: boolean
  /** Some do mapa quando a condição deixa de valer (ex.: inimigo derrotado). */
  visible?: Cond
  /** Rótulo do botão de ação no celular ("Falar", "Usar terminal"…). */
  verb?: string
  /** Interação: em ordem, a primeira cuja condição vale é usada. */
  on: Interaction[]
  /** Marca de missão sobre a cabeça quando a condição vale. */
  marker?: Cond
}

export type Interaction = { when?: Cond } & (
  | { do: 'dialogue'; dialogue: string }
  | { do: 'terminal'; challenge: string }
  | { do: 'combat'; encounter: string }
  | { do: 'puzzle'; puzzle: string }
  | { do: 'boss'; boss: string }
  /** Abre o mapa do mundo. */
  | { do: 'worldmap' }
  /** Balcão da Rodoviária: compra de passagens. */
  | { do: 'tickets' }
  /** Ônibus: embarque para uma cidade com passagem. */
  | { do: 'bus' }
  /** Quadro de Missões na apresentação: escolher a primeira cidade. */
  | { do: 'citychoice' }
  /** Minha Cidade: prefeitura (todos os lotes) ou um lote específico. */
  | { do: 'lot'; lot: number | null }
  /** Morador da Minha Cidade: revisa os flashcards vencidos da matéria. */
  | { do: 'cards'; subject: string }
  | { do: 'effects'; effects: Effect[]; text?: string }
  | { do: 'say'; text: string }
)

export interface RegionDef {
  id: string
  name: string
  subtitle: string
  /** Disciplina do EvoQuest clássico a que a região pertence. */
  subject: string | null
  palette: string
  map: MapDef
  spawn: { x: number; y: number }
  entities: EntityDef[]
  /** Efeitos aplicados ao entrar na região (ex.: iniciar a missão da cidade). */
  onEnter?: Effect[]
}

export interface Speaker {
  id: string
  name: string
  role: string
  /** Paleta do retrato desenhado no diálogo. */
  look: CharacterLook
}

export interface CharacterLook {
  skin: string
  hair: string
  outfit: string
  accent: string
}

export interface DialogueChoice {
  text: string
  next?: string
  when?: Cond
  effects?: Effect[]
}

export interface DialogueNode {
  id: string
  speaker: string
  text: string
  next?: string
  choices?: DialogueChoice[]
  effects?: Effect[]
}

export interface DialogueDef {
  id: string
  start: string
  nodes: DialogueNode[]
}

/** Objetivo de uma etapa de missão. */
export type Objective =
  | { type: 'talk'; npc: string; dialogueEnds?: string }
  | { type: 'interact'; target: string }
  | { type: 'item'; item: string }
  | { type: 'flag'; flag: string }
  /** Resolvido por um desafio de conhecimento (terminal, combate, puzzle). */
  | { type: 'solve'; challenge: string }
  /**
   * Desafio do modo clássico respondido corretamente (ex.: chefe da unidade).
   * O servidor confere em game_answers; o cliente só avisa que vale tentar.
   */
  | { type: 'answered'; challenge: string }

export interface QuestStep {
  id: string
  /** Texto do diário/HUD. */
  text: string
  objective: Objective
  /** Habilidades exercitadas (árvore de habilidades). */
  skills?: string[]
  onComplete?: Effect[]
}

export type QuestKind = 'main' | 'side' | 'contract' | 'event' | 'mastery'

export interface QuestDef {
  id: string
  kind: QuestKind
  title: string
  region: string
  summary: string
  steps: QuestStep[]
  /** Exibido no diário; o valor real vem do servidor. */
  rewardText: string
  onComplete?: Effect[]
}

export interface QuestProgress {
  /** Índice da etapa atual (== steps.length quando concluída). */
  step: number
  done: boolean
}

export interface CharacterProfile {
  name: string
  look: CharacterLook
}

/** Estado salvo do mundo. Recompensas e etapas validadas ficam no servidor. */
export interface WorldState {
  version: 1
  character: CharacterProfile | null
  region: string
  x: number
  y: number
  facing: Dir
  flags: Record<string, boolean>
  inventory: string[]
  quests: Record<string, QuestProgress>
  /** Relação com NPCs (-3..3). */
  rel: Record<string, number>
  /** Etapas confirmadas pelo servidor (`missao:etapa`). */
  steps: string[]
  unlocked: string[]
  introSeen: boolean
  /** Minha Cidade: matéria do Control construída em cada lote (null = terreno vazio). */
  myCity?: { lots: Array<string | null> }
}

export interface ItemDef {
  id: string
  name: string
  description: string
  icon: string
  /** Documento legível no inventário (ex.: manual do painel). */
  read?: string
}
