import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import type { QuestionError } from '@/types/db'
import { analyzeErrors, filterErrors, joinErrors, unclassified } from '../errors'
import { questions, TODAY } from './fixtures'

const err = (id: string, record_id: string, reason: QuestionError['reason'], count: number, over: Partial<QuestionError> = {}): QuestionError => ({
  id,
  user_id: 'u',
  created_at: '',
  updated_at: '',
  record_id,
  reason,
  count,
  note: null,
  resolved: false,
  resolved_at: null,
  ...over,
})

const records = [
  { ...questions('2026-10-20', 30, 16, { subject_id: 'es', topic_id: 'graf', board: 'Cebraspe' }), id: 'r1' },
  { ...questions('2026-10-01', 20, 14, { subject_id: 'es', topic_id: 'graf', board: 'FGV' }), id: 'r2' },
  { ...questions('2026-10-21', 10, 7, { subject_id: 'pt', topic_id: 'crase', exam: 'TJ' }), id: 'r3' },
]
const errors = [
  err('e1', 'r1', 'interpretacao', 9),
  err('e2', 'r1', 'calculo', 3),
  err('e3', 'r2', 'interpretacao', 4, { resolved: true }),
  err('e4', 'r3', 'distracao', 2),
  err('orphan', 'nao-existe', 'outro', 1),
]
const name = (id: string | null) => ({ es: 'Estatística', pt: 'Português' })[id ?? ''] ?? 'Sem matéria'

describe('caderno de erros — análise', () => {
  const entries = joinErrors(errors, records)

  it('junta com o registro (data, matéria, tópico, banca) e ignora órfãos', () => {
    expect(entries.map((e) => e.id)).toEqual(['e4', 'e1', 'e2', 'e3'])
    expect(entries[1]).toMatchObject({ subjectId: 'es', topicId: 'graf', board: 'Cebraspe', date: '2026-10-20' })
  })

  it('filtros: matéria, período, motivo, banca, concurso e situação', () => {
    expect(filterErrors(entries, { subjectId: 'es' }).length).toBe(3)
    expect(filterErrors(entries, { from: '2026-10-15' }).map((e) => e.id)).toEqual(['e4', 'e1', 'e2'])
    expect(filterErrors(entries, { reason: 'interpretacao' }).length).toBe(2)
    expect(filterErrors(entries, { board: 'cebraspe' }).length).toBe(2)
    expect(filterErrors(entries, { exam: 'TJ' }).map((e) => e.id)).toEqual(['e4'])
    expect(filterErrors(entries, { status: 'open' }).length).toBe(3)
    expect(filterErrors(entries, { status: 'resolved' }).map((e) => e.id)).toEqual(['e3'])
  })

  it('indicadores e frases só com dados observáveis', () => {
    const a = analyzeErrors(entries, { today: TODAY, subjectName: name })
    expect(a.total).toBe(18)
    expect(a.open).toBe(14)
    expect(a.byReason[0]).toMatchObject({ reason: 'interpretacao', count: 13 })
    expect(a.bySubject[0]).toEqual({ id: 'es', count: 16 })
    expect(a.recurring.map((t) => t.id)).toEqual(['graf'])
    expect(a.recurrenceRate).toBe(0.5)
    expect(a.recent).toBe(14)
    expect(a.observations).toContain('72% dos erros classificados no período são de "Interpretação" (13 de 18).')
    expect(a.observations).toContain('81% dos seus erros classificados de Estatística estão relacionados a "Interpretação" (13 de 16).')
    expect(a.observations.join(' ')).not.toMatch(/você é|preguiç|ansied/i)
  })

  it('sem erros: indicadores vazios, sem frases', () => {
    const a = analyzeErrors([], { today: TODAY, subjectName: name })
    expect(a).toMatchObject({ total: 0, recurrenceRate: null, observations: [] })
  })

  it('erros sem motivo = erros do registro − classificados', () => {
    expect(unclassified(records, errors)).toBe(14 - 12 + 6 - 4 + 3 - 2)
  })
})

describe('caderno de erros — backend local (mesmas regras do banco)', () => {
  it('limite pelos erros do registro, nas duas direções, e cascata', async () => {
    const b = new LocalBackend(`erros-${Date.now()}`)
    const [rec] = await b.insert('question_records', [{ date: TODAY, total: 10, correct: 7, wrong: 3 }])
    await b.insert('question_errors', [{ record_id: rec.id, reason: 'interpretacao', count: 2 }])
    await expect(b.insert('question_errors', [{ record_id: rec.id, reason: 'calculo', count: 2 }])).rejects.toThrow(/passam do total/)
    await expect(b.update('question_records', [eq('id', rec.id)], { wrong: 1, correct: 9 })).rejects.toThrow(/classificados/)
    await expect(b.insert('question_errors', [{ record_id: 'nao-existe', reason: 'outro' }])).rejects.toThrow(/não encontrado/)
    const [e] = (await b.list('question_errors')).rows
    const [res] = await b.update('question_errors', [eq('id', e.id)], { resolved: true })
    expect(res.resolved_at).not.toBeNull()
    await b.remove('question_records', [eq('id', rec.id)])
    expect((await b.list('question_errors')).rows).toHaveLength(0)
  })
})
