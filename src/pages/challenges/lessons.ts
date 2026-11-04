import { GIT_LESSONS } from './lessons/git'
import { PYTHON_LESSONS } from './lessons/python'
import { SQL_LESSONS } from './lessons/sql'
import type { Lesson } from './lessons/types'

export type { Lesson, LessonCheckpoint } from './lessons/types'

export const LESSONS: Record<string, Lesson> = { ...PYTHON_LESSONS, ...SQL_LESSONS, ...GIT_LESSONS }
