// Contratos do conteúdo da trilha de Ciência de Dados (VLM Control 2.0).
// As chaves (`key`, `trailKey`, `id`) são ESTÁVEIS: é por elas que o app reconhece o que já foi instalado,
// respondido ou concluído. Mude textos à vontade; nunca renomeie uma chave já publicada.
import type { ChallengeLevel, ChallengeTrack } from '@/pages/challenges/catalog'

export type TrackKey = 'sql' | 'python' | 'ml' | 'powerbi'

export interface TrailTopicDef {
  /** Ex.: 'ds.sql.join'. */
  key: string
  title: string
  /** Objetivo de aprendizagem: o que serei capaz de fazer ao terminar. */
  objective: string
  /** Chaves dos tópicos que precisam vir antes. */
  prerequisites: string[]
  /** Conteúdo recomendado, em itens curtos. */
  content: string[]
  /** Material associado (documentação oficial e referências gratuitas). */
  materials: Array<{ title: string; url: string }>
  exercise: {
    /** Exercício prático do tópico, em uma ou duas frases objetivas. */
    prompt: string
    /** Desafios do laboratório que praticam este tópico. */
    lab?: { track: ChallengeTrack; level: ChallengeLevel }
  }
  /** Estimativa de duração em minutos. */
  minutes: number
  /** 'project' = tópico de projeto prático (abre a área de projetos). */
  kind?: 'lesson' | 'project'
}

export interface TrackDef {
  key: TrackKey
  /** Ex.: 'ds.sql' — identifica a matéria instalada. */
  trailKey: string
  /** Nome da matéria criada para o pilar. */
  name: string
  /** Participação no plano semanal, em % (SQL 30, Python 30, ML 25, Power BI 15). */
  share: number
  summary: string
  /** Sessões curtas (10 a 20 min) fazem sentido neste pilar. */
  shortSessions?: boolean
  topics: TrailTopicDef[]
}

export interface DiagnosticQuestion {
  /** Ex.: 'dq.sql.join.1'. */
  id: string
  track: TrackKey
  /** Tópico da trilha que a questão avalia. */
  topicKey: string
  /** 1 = básico, 2 = intermediário, 3 = avançado. */
  level: 1 | 2 | 3
  /** Competência avaliada (ex.: 'Interpretação de consultas', 'JOIN', 'Window Functions'). */
  skill: string
  /** practical = ler/construir código ou resolver um problema; concept = conceito. */
  kind: 'practical' | 'concept'
  prompt: string
  /** Trecho de código ou dados exibido com a questão. */
  code?: string
  options: string[]
  /** Índice da alternativa correta. */
  answer: number
  explanation: string
}

export interface ProjectTemplate {
  /** Ex.: 'tpl.sql.vendas'. */
  key: string
  track: TrackKey
  name: string
  description: string
  objective: string
  skills: string[]
  difficulty: 1 | 2 | 3
  steps: string[]
  deliverables: string[]
  /** Tópicos da trilha praticados (chaves). */
  topicKeys: string[]
  estimatedHours: number
}
