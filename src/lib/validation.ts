import { z } from 'zod'
import { ACTIVITY_TYPES } from './labels'

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)

const optDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data inválida.')
  .transform((v) => (v ? v : null))
  .nullable()
  .optional()
  .transform((v) => v ?? null)

const optNumber = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === '' || v == null) return null
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `Informe um número entre ${min} e ${max}.` })
        return z.NEVER
      }
      return n
    })

export const activitySchema = z.enum(ACTIVITY_TYPES as [string, ...string[]])

export const subjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome da matéria.').max(160, 'Máximo de 160 caracteres.'),
    description: optText(4000),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.'),
    icon: optText(40),
    priority: z.coerce.number().int().min(1).max(5),
    difficulty: z.coerce.number().int().min(1).max(5),
    weekly_goal_hours: optNumber(0, 168),
    start_date: optDate,
    target_date: optDate,
    notes: optText(10000),
    status: z.enum(['active', 'paused', 'completed', 'archived']),
    exam: optText(200),
  })
  .refine((v) => !v.start_date || !v.target_date || v.target_date >= v.start_date, {
    message: 'A conclusão prevista deve ser depois do início.',
    path: ['target_date'],
  })

export const topicSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do tópico.').max(300, 'Máximo de 300 caracteres.'),
  description: optText(4000),
  status: z.enum(['not_started', 'in_progress', 'completed', 'reviewing']),
  mastery: z.coerce.number().int().min(0).max(5),
  priority: z.coerce.number().int().min(1).max(5),
  weight: z.coerce.number().gt(0, 'O peso deve ser maior que zero.').max(100, 'Máximo 100.'),
  estimated_minutes: optNumber(0, 100000),
  notes: optText(10000),
})

export const questionSchema = z
  .object({
    subject_id: z.string().uuid().nullable(),
    topic_id: z.string().uuid().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
    total: z.coerce.number({ error: 'Informe o total.' }).int('Use números inteiros.').min(1, 'Informe ao menos 1 questão.').max(100000),
    correct: z.coerce.number().int('Use números inteiros.').min(0, 'Não pode ser negativo.'),
    wrong: z.coerce.number().int('Use números inteiros.').min(0, 'Não pode ser negativo.'),
    board: optText(120),
    exam: optText(200),
    source: optText(300),
    notes: optText(4000),
  })
  .refine((v) => v.correct <= v.total, { message: 'Os acertos não podem exceder o total respondido.', path: ['correct'] })
  .refine((v) => v.correct + v.wrong <= v.total, { message: 'Acertos + erros não podem exceder o total.', path: ['wrong'] })

export const flashcardSchema = z.object({
  front: z.string().trim().min(1, 'Preencha a frente.').max(10000),
  back: z.string().trim().min(1, 'Preencha o verso.').max(10000),
  note: optText(10000),
  tags: z.array(z.string().trim().min(1).max(60)).max(50),
})

export const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Use um endereço iniciado por http:// ou https://')

const optCover = z
  .string()
  .trim()
  .max(500, 'Máximo de 500 caracteres.')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine(
    (v) => v === null || /^#[0-9A-Fa-f]{6}$/.test(v) || /^preset:[a-z0-9_-]{1,40}$/.test(v) || /^https?:\/\/\S+$/i.test(v),
    'Capa inválida. Use uma cor, um padrão ou URL http(s).',
  )

export const notebookSchema = z.object({
  title: z.string().trim().min(1, 'Informe o nome do caderno.').max(200, 'Máximo de 200 caracteres.'),
  description: optText(4000),
  icon: optText(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.'),
  cover: optCover,
  subject_id: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), 'Matéria inválida.'),
})

export const notebookNodeSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(300, 'Máximo de 300 caracteres.'),
  node_type: z.enum(['section', 'page']),
  icon: optText(40),
  color: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)
    .refine((v) => v === null || /^#[0-9A-Fa-f]{6}$/.test(v), 'Cor inválida.'),
  status: z.enum(['draft', 'in_progress', 'ready', 'reviewing', 'reviewed', 'archived']).optional(),
})

export const notebookTagSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da tag.').max(60, 'Máximo de 60 caracteres.'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.'),
})

/** Valida e devolve dados ou um mapa campo → mensagem. */
export function validate<S extends z.ZodType>(schema: S, values: unknown): { data: z.output<S>; errors: null } | { data: null; errors: Record<string, string> } {
  const r = schema.safeParse(values)
  if (r.success) return { data: r.data, errors: null }
  const errors: Record<string, string> = {}
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_'
    if (!errors[key]) errors[key] = issue.message
  }
  return { data: null, errors }
}
