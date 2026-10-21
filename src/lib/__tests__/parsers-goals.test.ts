import { describe, expect, it } from 'vitest'
import { parseCardsCsv, cardsToCsv } from '@/services/flashcards'
import { parseOutline } from '@/pages/subjects/topicOps'
import { goalValue, history, progress, type GoalData } from '@/lib/goals'
import { buildTree, flattenTree, weightedProgress } from '@/lib/tree'
import { chunkText, pickVoice } from '@/hooks/useSpeech'
import type { StudyGoal, Topic } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'

describe('importação CSV de flashcards', () => {
  it('lê cabeçalho, ponto e vírgula, BOM e tags', () => {
    const csv = String.fromCharCode(0xfeff) + 'frente;verso;observacao;tags\n"O que é ato vinculado?";"Ato sem margem de escolha";;adm|atos\nSem verso;;;\n'
    const rows = parseCardsCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ line: 2, front: 'O que é ato vinculado?', back: 'Ato sem margem de escolha', note: null, tags: ['adm', 'atos'], error: null })
    expect(rows[1].error).toBe('Verso vazio')
  })

  it('sem cabeçalho usa a ordem frente, verso', () => {
    const rows = parseCardsCsv('Capital do Brasil,Brasília\n')
    expect(rows[0]).toMatchObject({ front: 'Capital do Brasil', back: 'Brasília', error: null })
  })

  it('exporta e reimporta sem perdas', () => {
    const csv = cardsToCsv([{ front: 'A, "b"', back: 'linha\nnova', note: null, tags: ['x', 'y'] }])
    const back = parseCardsCsv(csv)
    expect(back[0]).toMatchObject({ front: 'A, "b"', back: 'linha\nnova', tags: ['x', 'y'] })
  })
})

describe('estrutura do edital (texto indentado)', () => {
  it('converte recuo em níveis e remove marcadores', () => {
    const nodes = parseOutline('1. Atos administrativos\n  - Conceito\n  - Requisitos\n      Competência\nPoderes\n\tPoder de polícia')
    expect(nodes).toEqual([
      { name: 'Atos administrativos', depth: 0 },
      { name: 'Conceito', depth: 1 },
      { name: 'Requisitos', depth: 1 },
      { name: 'Competência', depth: 2 },
      { name: 'Poderes', depth: 0 },
      { name: 'Poder de polícia', depth: 1 },
    ])
  })

  it('nunca pula níveis (recuo exagerado vira o próximo nível)', () => {
    expect(parseOutline('A\n        B').map((n) => n.depth)).toEqual([0, 1])
  })
})

describe('árvore e progresso ponderado', () => {
  const t = (id: string, parent: string | null, status: Topic['status'], weight = 1, order = 0) =>
    ({ id, parent_id: parent, status, weight, sort_order: order, name: id, subject_id: 's' }) as Topic
  it('considera apenas folhas e seus pesos', () => {
    const topics = [t('a', null, 'in_progress'), t('a1', 'a', 'completed', 3), t('a2', 'a', 'not_started', 1), t('b', null, 'completed', 1)]
    const p = weightedProgress(topics)
    expect(p.total).toBe(3)
    expect(p.done).toBe(2)
    expect(p.percent).toBe(80)
  })
  it('monta e achata a hierarquia respeitando a ordem', () => {
    const tree = buildTree([t('b', null, 'not_started', 1, 1), t('a', null, 'not_started', 1, 0), t('a1', 'a', 'not_started')])
    expect(flattenTree(tree).map((n) => `${n.depth}:${n.id}`)).toEqual(['0:a', '1:a1', '0:b'])
    expect(flattenTree(tree, new Set(['a'])).map((n) => n.id)).toEqual(['a', 'b'])
  })
})

describe('metas', () => {
  const session = (start: string, end: string, subject: string | null = 's1'): SessionWithPauses =>
    ({ id: start, started_at: start, ended_at: end, adjustment_seconds: 0, status: 'completed', subject_id: subject, pauses: [] }) as unknown as SessionWithPauses
  const data: GoalData = {
    timezone: 'America/Sao_Paulo',
    sessions: [session('2026-10-19T12:00:00Z', '2026-10-19T14:00:00Z'), session('2026-10-20T12:00:00Z', '2026-10-20T13:00:00Z', 's2')],
    questions: [
      { date: '2026-10-19', total: 20, correct: 15, wrong: 5, subject_id: 's1' },
      { date: '2026-10-20', total: 10, correct: 5, wrong: 5, subject_id: 's2' },
    ] as GoalData['questions'],
    topics: [{ subject_id: 's1', completed_at: '2026-10-20T15:00:00Z' }],
    reviews: [{ reviewed_at: '2026-10-20T15:00:00Z' }, { reviewed_at: '2026-10-01T15:00:00Z' }],
  }
  const week = { from: '2026-10-19', to: '2026-10-25' }
  const g = (metric: StudyGoal['metric'], subject: string | null = null) => ({ metric, subject_id: subject })

  it('calcula cada indicador a partir dos registros', () => {
    expect(goalValue(g('study_hours'), week, data)).toBe(3)
    expect(goalValue(g('study_hours', 's1'), week, data)).toBe(2)
    expect(goalValue(g('study_days'), week, data)).toBe(2)
    expect(goalValue(g('sessions'), week, data)).toBe(2)
    expect(goalValue(g('questions'), week, data)).toBe(30)
    expect(Math.round(goalValue(g('accuracy'), week, data))).toBe(67)
    expect(goalValue(g('topics_completed'), week, data)).toBe(1)
    expect(goalValue(g('flashcards_reviewed'), week, data)).toBe(1)
  })

  it('progresso informa percentual, restante e cumprimento', () => {
    const p = progress({ metric: 'study_hours', subject_id: null, target: 4 }, week, data)
    expect(p).toMatchObject({ value: 3, percent: 75, remaining: 1, met: false })
  })

  it('histórico respeita o início da meta (não inventa períodos)', () => {
    const goal = { id: 'g', metric: 'questions', period: 'weekly', target: 10, subject_id: null, start_date: '2026-10-12', end_date: null } as StudyGoal
    const h = history(goal, '2026-10-26', data)
    expect(h.map((x) => x.range.from)).toEqual(['2026-10-19', '2026-10-12'])
    expect(h[0].met).toBe(true)
  })
})

describe('voz', () => {
  it('divide textos longos em partes curtas sem perder conteúdo', () => {
    const text = 'Frase um. '.repeat(60)
    const parts = chunkText(text, 100)
    expect(parts.every((p) => p.length <= 100)).toBe(true)
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text.trim())
  })
  it('prefere voz pt-BR e respeita a escolha do usuário', () => {
    const voices = [
      { voiceURI: 'en', lang: 'en-US', name: 'En' },
      { voiceURI: 'pt', lang: 'pt-PT', name: 'Pt' },
      { voiceURI: 'br', lang: 'pt-BR', name: 'Br' },
    ] as SpeechSynthesisVoice[]
    expect(pickVoice(voices, null)?.voiceURI).toBe('br')
    expect(pickVoice(voices, 'en')?.voiceURI).toBe('en')
    expect(pickVoice([voices[0]], null)).toBeNull()
  })
})
