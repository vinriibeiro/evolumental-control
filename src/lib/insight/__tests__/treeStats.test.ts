import { describe, expect, it } from 'vitest'
import { metricDisplay } from '@/features/explorer/metric'
import { buildExplorer } from '@/features/explorer/model'
import { masteryIndex } from '../evidence'
import { treeStats } from '../treeStats'
import { daysAgo, NOW, questions, session, subject, topic, TODAY, TZ } from './fixtures'

const pt = subject('pt', { name: 'Português', priority: 5 })
const topics = [
  topic('sint', 'pt', { name: 'Sintaxe' }),
  topic('crase', 'pt', { name: 'Crase', parent_id: 'sint', weight: 2 }),
  topic('reg', 'pt', { name: 'Regência', parent_id: 'sint', priority: 2 }),
  topic('int', 'pt', { name: 'Interpretação' }),
]
const input = {
  subjects: [pt],
  topics,
  sessions: [session('2026-10-20T13:00:00Z', 40, { subject_id: 'pt', topic_id: 'crase' }), session('2026-10-21T13:00:00Z', 20, { subject_id: 'pt', topic_id: null })],
  questions: [questions(daysAgo(1), 20, 10, { subject_id: 'pt', topic_id: 'crase' }), questions(daysAgo(1), 10, 9, { subject_id: 'pt', topic_id: 'reg' }), questions(daysAgo(1), 5, 5, { subject_id: 'pt', topic_id: null })],
  reviews: [],
  cards: [],
  today: TODAY,
  tz: TZ,
}
const idx = masteryIndex(input, NOW)
const stats = treeStats(topics, idx.evidence)

describe('totais por nó (mapa do edital)', () => {
  it('tópico pai soma subtópicos; matéria soma tudo, inclusive registros sem tópico', () => {
    expect(stats.byTopic.get('crase')).toEqual({ seconds: 2400, questions: 20, correct: 10 })
    expect(stats.byTopic.get('sint')).toEqual({ seconds: 2400, questions: 30, correct: 19 })
    expect(stats.byTopic.get('int')).toEqual({ seconds: 0, questions: 0, correct: 0 })
    expect(stats.bySubject.get('pt')).toEqual({ seconds: 3600, questions: 35, correct: 24 })
  })

  it('tópico sem questões e sem sessões: zeros, e acerto mostra "—"', () => {
    const ex = buildExplorer([], [pt], topics)
    const n = ex.byKey.get('topic:int')!
    const ctx = { progress: () => 0, mastery: () => idx.byTopic.get('int')!, stats: () => stats.byTopic.get('int')! }
    expect(metricDisplay('accuracy', n, ctx)).toMatchObject({ text: '—', percent: null })
    expect(metricDisplay('mastery', n, ctx)).toMatchObject({ text: 'sem dados' })
    expect(metricDisplay('time', n, ctx)!.text).toBe('0min')
  })

  it('cada indicador vem com texto acessível (nunca só cor)', () => {
    const ex = buildExplorer([], [pt], topics)
    const n = ex.byKey.get('topic:sint')!
    const ctx = { progress: () => 50, mastery: () => idx.byTopic.get('sint')!, stats: () => stats.byTopic.get('sint')! }
    const m = idx.byTopic.get('sint')!
    expect(metricDisplay('progress', n, ctx)).toEqual({ text: '50%', percent: 50, aria: '50% do conteúdo concluído' })
    expect(metricDisplay('mastery', n, ctx)!.aria).toMatch(new RegExp(`Domínio ${m.value}%`))
    expect(metricDisplay('accuracy', n, ctx)).toMatchObject({ text: '63%', aria: '63% de acerto em 30 questões' })
    expect(metricDisplay('questions', n, ctx)!.text).toBe('30')
    expect(metricDisplay('priority', ex.byKey.get('topic:reg')!, ctx)!.text).toBe('Baixa')
    expect(metricDisplay('priority', ex.byKey.get('subject:pt')!, ctx)!.text).toBe('Muito alta')
  })

  it('domínio do pai respeita o peso dos filhos (Crase pesa 2)', () => {
    const c = idx.byTopic.get('crase')!.value
    const r = idx.byTopic.get('reg')!.value
    expect(idx.byTopic.get('sint')!.value).toBe(Math.round((2 * c + r) / 3))
  })
})
