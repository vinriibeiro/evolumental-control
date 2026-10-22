// Modelo genérico de conteúdo do EvoQuest. Nada aqui é específico de uma
// disciplina: uma nova disciplina é apenas um novo arquivo de conteúdo que
// usa estes tipos (ver src/game/catalog.ts).

export type Difficulty = 1 | 2 | 3 | 4 | 5

export interface DataTable {
  caption?: string
  columns: string[]
  rows: Array<Array<string | number | null>>
}

interface Base {
  /** Identificador estável: `<disciplina>.<unidade>.<código>`. Nunca reutilize. */
  id: string
  /** Versão do conteúdo; incremente ao corrigir o gabarito. */
  v?: number
  topic: string
  difficulty: Difficulty
  prompt: string
  /** Explicação mostrada SEMPRE após a resposta (acertando ou errando). */
  explanation: string
  /** Por que as respostas erradas mais comuns estão erradas. */
  whyWrong?: string
  hint?: string
  /** Contexto/cenário exibido acima do enunciado. */
  context?: string
  table?: DataTable
  code?: { lang: 'sql' | 'python' | 'dax' | 'm' | 'text'; source: string }
  /** Tempo estimado em segundos (padrão depende do tipo). */
  seconds?: number
  tags?: string[]
  /** Reservado ao desafio de chefe da unidade. */
  boss?: boolean
  /** Verificação matemática opcional usada pelos testes de conteúdo. */
  calc?: { op: 'mean' | 'median' | 'range' | 'var_pop' | 'var_sample' | 'sd_pop' | 'sd_sample' | 'cv_sample'; data: number[] }
}

export type Challenge =
  | (Base & { type: 'mcq'; options: string[]; answer: number })
  | (Base & { type: 'tf'; answer: boolean })
  | (Base & { type: 'fill'; template: string; blanks: Array<{ accept: string[]; options?: string[] }>; caseSensitive?: boolean })
  | (Base & { type: 'match'; pairs: Array<[string, string]> })
  | (Base & { type: 'order'; items: string[] })
  | (Base & { type: 'categorize'; categories: string[]; items: Array<{ text: string; cat: number }> })
  | (Base & { type: 'find_error'; tokens: string[]; answer: number; fix: string })
  | (Base & { type: 'numeric'; answer: number; tolerance?: number; unit?: string })
  | (Base & { type: 'short'; accept: string[]; caseSensitive?: boolean; accentSensitive?: boolean })
  | (Base & { type: 'code_complete'; template: string; blanks: Array<{ accept: string[] }>; caseSensitive?: boolean })
  | (Base & { type: 'code_output'; accept: string[] })
  | (Base & { type: 'multistep'; steps: StepChallenge[] })
  | (Base & { type: 'listen'; say: string; lang?: string; options: string[]; answer: number; translation?: string })
  /** Ditado: ouvir o áudio e escrever o que foi dito. */
  | (Base & { type: 'dictation'; say: string; lang?: string; accept: string[]; translation?: string })
  | (Base & { type: 'sql'; dataset: string; solution: string; orderMatters?: boolean; starter?: string })
  | (Base & { type: 'python'; starter: string; solution: string; entry: string; tests: Array<{ args: unknown[]; expected: unknown }>; packages?: string[] })

export type ChallengeType = Challenge['type']
export type StepChallenge = Extract<Challenge, { type: 'mcq' | 'numeric' | 'short' | 'tf' }> & { id: string }

export interface LessonSection {
  title: string
  body: string
  example?: string
}

export interface Unit {
  id: string
  title: string
  summary: string
  topics: Array<{ id: string; name: string }>
  lesson: LessonSection[]
  challenges: Challenge[]
}

export interface SubjectContent {
  subjectId: string
  /** Conjuntos de dados compartilhados pelos desafios de laboratório. */
  datasets?: Record<string, string>
  units: Unit[]
}

/** Metadados leves (sempre carregados). O conteúdo vem sob demanda. */
export interface SubjectMeta {
  id: string
  name: string
  short: string
  icon: string
  color: string
  description: string
  level: string
  capabilities: Array<'sql' | 'python' | 'speech'>
  /** Matéria do planejamento com nome parecido (sugestão de vínculo). */
  matchNames: string[]
  load: () => Promise<SubjectContent>
}

/** Resposta do usuário, por tipo. */
export type Response =
  | { type: 'mcq' | 'listen'; choice: number }
  | { type: 'tf'; value: boolean }
  | { type: 'fill' | 'code_complete'; values: string[] }
  | { type: 'match'; pairs: Record<string, string> }
  | { type: 'order'; items: string[] }
  | { type: 'categorize'; assignment: Record<string, number> }
  | { type: 'find_error'; index: number }
  | { type: 'numeric'; value: number }
  | { type: 'short' | 'code_output' | 'dictation'; text: string }
  | { type: 'multistep'; steps: Response[] }
  | { type: 'sql'; query: string; result?: { columns: string[]; rows: unknown[][] }; matches?: boolean; error?: string }
  | { type: 'python'; code: string; passed?: number; total?: number; error?: string }

export interface GradeResult {
  correct: boolean
  /** 0..1 — usado em multietapas e laboratórios. */
  score: number
  detail?: string
}
