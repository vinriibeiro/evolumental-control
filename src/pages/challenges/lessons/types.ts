export interface LessonCheckpoint {
  question: string
  options: string[]
  /** Índice da alternativa correta, começando em zero. */
  correct: number
  explanation: string
}

export interface Lesson {
  concept: string
  workedExample: string
  pitfall: string
  checkpoint: LessonCheckpoint
}
