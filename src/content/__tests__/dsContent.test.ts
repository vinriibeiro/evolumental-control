import { describe, expect, it } from 'vitest'
import { DS_QUESTIONS, questionsFor } from '@/content/dsDiagnostics'
import { DS_PROJECT_TEMPLATES, templatesForTopic } from '@/content/dsProjects'
import { DS_TOPICS, DS_TRACKS, topicByKey, trackByKey, trackOf } from '@/content/dsTrail'
import type { TrackKey } from '@/content/dsTypes'
import { CHALLENGES } from '@/pages/challenges/catalog'

const TRACK_KEYS: TrackKey[] = ['sql', 'python', 'ml', 'powerbi']
const TOPIC_KEYS = new Set(DS_TOPICS.map((t) => t.key))

describe('trilha de Ciência de Dados', () => {
  it('tem os quatro pilares de dados na ordem certa, com participações 30/30/25/15', () => {
    expect(DS_TRACKS.map((t) => t.key)).toEqual(TRACK_KEYS)
    expect(DS_TRACKS.map((t) => t.trailKey)).toEqual(['ds.sql', 'ds.python', 'ds.ml', 'ds.powerbi'])
    expect(DS_TRACKS.map((t) => t.name)).toEqual(['SQL', 'Python', 'Machine Learning', 'Power BI'])
    expect(DS_TRACKS.map((t) => t.share)).toEqual([30, 30, 25, 15])
    expect(DS_TRACKS.reduce((sum, t) => sum + t.share, 0)).toBe(100)
    for (const track of DS_TRACKS) expect(track.summary.trim(), track.key).not.toBe('')
  })

  it('tem 12, 14, 16 e 5 tópicos', () => {
    expect(DS_TRACKS.map((t) => t.topics.length)).toEqual([12, 14, 16, 5])
    expect(DS_TOPICS).toHaveLength(47)
  })

  it('usa chaves únicas no padrão ds.<pilar>.<slug>, com o prefixo do próprio pilar', () => {
    expect(TOPIC_KEYS.size).toBe(DS_TOPICS.length)
    for (const track of DS_TRACKS) {
      for (const topic of track.topics) {
        expect(topic.key, topic.key).toMatch(/^ds\.(sql|python|ml|powerbi)\.[a-z0-9_]+$/)
        expect(topic.key.startsWith(`${track.trailKey}.`), topic.key).toBe(true)
      }
    }
  })

  it('termina SQL, Python e Machine Learning com um tópico de projeto', () => {
    const projects = DS_TOPICS.filter((t) => t.kind === 'project').map((t) => t.key)
    expect(projects).toEqual(['ds.sql.projetos', 'ds.python.projetos', 'ds.ml.projetos'])
    for (const key of ['sql', 'python', 'ml'] as const) {
      expect(trackByKey(key)?.topics.at(-1)?.kind, key).toBe('project')
    }
  })

  it('tem pré-requisitos existentes, sem autorreferência e sempre anteriores dentro do pilar', () => {
    for (const track of DS_TRACKS) {
      track.topics.forEach((topic, index) => {
        expect(new Set(topic.prerequisites).size, topic.key).toBe(topic.prerequisites.length)
        for (const pre of topic.prerequisites) {
          expect(TOPIC_KEYS.has(pre), `${topic.key} → ${pre}`).toBe(true)
          expect(pre, topic.key).not.toBe(topic.key)
          const position = track.topics.findIndex((t) => t.key === pre)
          if (position >= 0) expect(position, `${topic.key} → ${pre}`).toBeLessThan(index)
        }
      })
    }
    for (const key of ['sql', 'python', 'powerbi'] as const) {
      expect(trackByKey(key)?.topics[0].prerequisites, key).toEqual([])
    }
    for (const topic of trackByKey('powerbi')?.topics ?? []) {
      expect(topic.prerequisites.every((pre) => pre.startsWith('ds.powerbi.')), topic.key).toBe(true)
    }
  })

  it('tem um grafo de pré-requisitos sem ciclos', () => {
    const state = new Map<string, 'visiting' | 'done'>()
    const visit = (key: string, path: string[]): void => {
      if (state.get(key) === 'done') return
      if (state.get(key) === 'visiting') throw new Error(`Ciclo de pré-requisitos: ${[...path, key].join(' → ')}`)
      state.set(key, 'visiting')
      for (const pre of topicByKey(key)?.prerequisites ?? []) visit(pre, [...path, key])
      state.set(key, 'done')
    }
    expect(() => DS_TOPICS.forEach((topic) => visit(topic.key, []))).not.toThrow()
  })

  it('preenche objetivo, conteúdo, materiais, exercício e duração em todos os tópicos', () => {
    for (const topic of DS_TOPICS) {
      expect(topic.title.trim(), topic.key).not.toBe('')
      expect(topic.objective.trim().length, topic.key).toBeGreaterThan(20)
      expect(topic.content.length, topic.key).toBeGreaterThanOrEqual(3)
      expect(topic.content.every((item) => item.trim() !== ''), topic.key).toBe(true)
      expect(topic.materials.length, topic.key).toBeGreaterThanOrEqual(1)
      expect(topic.materials.length, topic.key).toBeLessThanOrEqual(3)
      for (const material of topic.materials) {
        expect(material.title.trim(), topic.key).not.toBe('')
        expect(material.url, topic.key).toMatch(/^https:\/\/\S+$/)
      }
      expect(topic.exercise.prompt.trim().length, topic.key).toBeGreaterThan(20)
      expect(topic.minutes, topic.key).toBeGreaterThan(0)
    }
  })

  it('só aponta para combinações de laboratório que existem no catálogo', () => {
    const available = new Set(CHALLENGES.map((c) => `${c.track}/${c.level}`))
    const withLab = DS_TOPICS.filter((t) => t.exercise.lab)
    expect(withLab.length).toBeGreaterThan(0)
    for (const topic of withLab) {
      const lab = topic.exercise.lab!
      expect(available.has(`${lab.track}/${lab.level}`), topic.key).toBe(true)
      expect(lab.track, topic.key).toBe(trackOf(topic.key)?.key)
    }
  })

  it('resolve tópicos e pilares pelos auxiliares', () => {
    expect(topicByKey('ds.sql.join')?.title).toBe('JOIN')
    expect(topicByKey('ds.nada.aqui')).toBeUndefined()
    expect(trackOf('ds.ml.pipelines')?.key).toBe('ml')
    expect(trackOf('ds.nada.aqui')).toBeUndefined()
    expect(trackByKey('powerbi')?.trailKey).toBe('ds.powerbi')
    expect(DS_TOPICS[0].key).toBe('ds.sql.fundamentos')
    expect(DS_TOPICS.at(-1)?.key).toBe('ds.powerbi.visualizacao')
  })
})

describe('diagnóstico de conhecimento', () => {
  it('tem ids únicos no padrão dq.<pilar>.<slug>.<n>, coerentes com o tópico', () => {
    const ids = DS_QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const q of DS_QUESTIONS) {
      expect(q.id, q.id).toMatch(/^dq\.(sql|python|ml|powerbi)\.[a-z0-9_]+\.\d+$/)
      expect(q.id.replace(/^dq\./, 'ds.').replace(/\.\d+$/, ''), q.id).toBe(q.topicKey)
    }
  })

  it('tem quatro alternativas distintas, uma resposta válida e explicação em cada questão', () => {
    for (const q of DS_QUESTIONS) {
      expect(q.options, q.id).toHaveLength(4)
      expect(new Set(q.options.map((o) => o.trim())).size, q.id).toBe(4)
      expect(q.options.every((o) => o.trim() !== ''), q.id).toBe(true)
      expect([0, 1, 2, 3], q.id).toContain(q.answer)
      expect(q.prompt.trim(), q.id).not.toBe('')
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(20)
      expect([1, 2, 3], q.id).toContain(q.level)
      expect(['practical', 'concept'], q.id).toContain(q.kind)
      if (q.code !== undefined) expect(q.code.trim(), q.id).not.toBe('')
    }
  })

  it('liga cada questão a um tópico existente do próprio pilar', () => {
    for (const q of DS_QUESTIONS) {
      expect(TOPIC_KEYS.has(q.topicKey), q.id).toBe(true)
      expect(trackOf(q.topicKey)?.key, q.id).toBe(q.track)
    }
  })

  it('tem pelo menos duas questões em todo tópico avaliado', () => {
    const perTopic = new Map<string, number>()
    for (const q of DS_QUESTIONS) perTopic.set(q.topicKey, (perTopic.get(q.topicKey) ?? 0) + 1)
    for (const [topicKey, count] of perTopic) expect(count, topicKey).toBeGreaterThanOrEqual(2)
  })

  it('atinge a quantidade mínima por pilar e cobre os tópicos essenciais de SQL', () => {
    const minimum: Record<TrackKey, number> = { sql: 26, python: 26, ml: 20, powerbi: 12 }
    for (const key of TRACK_KEYS) {
      expect(DS_QUESTIONS.filter((q) => q.track === key).length, key).toBeGreaterThanOrEqual(minimum[key])
    }
    const sqlTopics = new Set(DS_QUESTIONS.filter((q) => q.track === 'sql').map((q) => q.topicKey))
    for (const slug of ['select', 'filtros', 'join', 'groupby', 'subconsultas', 'cte', 'window', 'analise']) {
      expect(sqlTopics.has(`ds.sql.${slug}`), slug).toBe(true)
    }
  })

  it('avalia as competências previstas em cada pilar', () => {
    const skills: Record<TrackKey, string[]> = {
      sql: ['Interpretação de consultas', 'Construção de consultas', 'JOIN', 'Agregações', 'CTE', 'Window Functions', 'Problemas práticos'],
      python: ['Fundamentos', 'Estruturas de dados', 'Funções', 'Manipulação de arquivos', 'Pandas', 'NumPy', 'Resolução de problemas'],
      ml: ['Estatística', 'Preparação de dados', 'Seleção de algoritmos', 'Treinamento', 'Validação', 'Avaliação de modelos', 'Interpretação dos resultados'],
      powerbi: ['Modelagem', 'DAX', 'Power Query', 'Desempenho'],
    }
    for (const key of TRACK_KEYS) {
      const used = new Set(DS_QUESTIONS.filter((q) => q.track === key).map((q) => q.skill))
      expect([...used].sort(), key).toEqual([...skills[key]].sort())
    }
  })

  it('prioriza questões práticas em SQL e Python, mistura níveis e varia a posição da resposta', () => {
    for (const key of ['sql', 'python'] as const) {
      const all = DS_QUESTIONS.filter((q) => q.track === key)
      expect(all.filter((q) => q.kind === 'practical').length / all.length, key).toBeGreaterThan(0.7)
    }
    for (const key of TRACK_KEYS) {
      const all = DS_QUESTIONS.filter((q) => q.track === key)
      expect(new Set(all.map((q) => q.level)).size, key).toBe(3)
      const positions = [0, 1, 2, 3].map((i) => all.filter((q) => q.answer === i).length)
      expect(Math.min(...positions), `${key}: ${positions.join('/')}`).toBeGreaterThanOrEqual(2)
      expect(Math.max(...positions) / all.length, `${key}: ${positions.join('/')}`).toBeLessThan(0.4)
    }
  })

  it('ordena questionsFor pela ordem da trilha e, depois, pelo nível', () => {
    const order = new Map(DS_TOPICS.map((t, i) => [t.key, i] as const))
    let total = 0
    for (const key of TRACK_KEYS) {
      const list = questionsFor(key)
      total += list.length
      expect(list.every((q) => q.track === key), key).toBe(true)
      for (let i = 1; i < list.length; i++) {
        const previous = list[i - 1]
        const current = list[i]
        const byTopic = order.get(previous.topicKey)! - order.get(current.topicKey)!
        expect(byTopic, `${previous.id} antes de ${current.id}`).toBeLessThanOrEqual(0)
        if (byTopic === 0) expect(previous.level, `${previous.id} antes de ${current.id}`).toBeLessThanOrEqual(current.level)
      }
    }
    expect(total).toBe(DS_QUESTIONS.length)
  })
})

describe('modelos de projeto', () => {
  it('tem chaves únicas no padrão tpl.<pilar>.<slug>, coerentes com o pilar', () => {
    const keys = DS_PROJECT_TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const template of DS_PROJECT_TEMPLATES) {
      expect(template.key, template.key).toMatch(/^tpl\.(sql|python|ml|powerbi)\.[a-z0-9_]+$/)
      expect(template.key.split('.')[1], template.key).toBe(template.track)
    }
  })

  it('tem 4 modelos de SQL, 4 de Python e 5 de Machine Learning', () => {
    const count = (key: TrackKey) => DS_PROJECT_TEMPLATES.filter((t) => t.track === key).length
    expect([count('sql'), count('python'), count('ml')]).toEqual([4, 4, 5])
    expect(DS_PROJECT_TEMPLATES).toHaveLength(13)
  })

  it('preenche descrição, objetivo, habilidades, etapas e entregas', () => {
    for (const template of DS_PROJECT_TEMPLATES) {
      const id = template.key
      expect(template.name.trim(), id).not.toBe('')
      expect(template.description.trim().length, id).toBeGreaterThan(40)
      expect(template.objective.trim().length, id).toBeGreaterThan(20)
      expect(template.skills.length, id).toBeGreaterThanOrEqual(3)
      expect(template.skills.length, id).toBeLessThanOrEqual(6)
      expect([1, 2, 3], id).toContain(template.difficulty)
      expect(template.steps.length, id).toBeGreaterThanOrEqual(5)
      expect(template.steps.length, id).toBeLessThanOrEqual(8)
      expect(template.steps.every((step) => step.trim() !== ''), id).toBe(true)
      expect(template.deliverables.length, id).toBeGreaterThanOrEqual(2)
      expect(template.deliverables.length, id).toBeLessThanOrEqual(4)
      expect(template.deliverables.every((item) => item.trim() !== ''), id).toBe(true)
      expect(template.estimatedHours, id).toBeGreaterThan(0)
    }
  })

  it('pratica apenas tópicos existentes, incluindo ao menos um do próprio pilar', () => {
    for (const template of DS_PROJECT_TEMPLATES) {
      expect(template.topicKeys.length, template.key).toBeGreaterThan(0)
      expect(new Set(template.topicKeys).size, template.key).toBe(template.topicKeys.length)
      for (const topicKey of template.topicKeys) expect(TOPIC_KEYS.has(topicKey), `${template.key} → ${topicKey}`).toBe(true)
      expect(template.topicKeys.some((topicKey) => trackOf(topicKey)?.key === template.track), template.key).toBe(true)
    }
  })

  it('encontra os modelos de um tópico com templatesForTopic', () => {
    expect(templatesForTopic('ds.sql.window').map((t) => t.key)).toEqual(['tpl.sql.analiticas', 'tpl.sql.indicadores'])
    expect(templatesForTopic('ds.nada.aqui')).toEqual([])
    for (const key of ['ds.sql.projetos', 'ds.python.projetos', 'ds.ml.projetos']) {
      const track = trackOf(key)?.key
      const expected = DS_PROJECT_TEMPLATES.filter((t) => t.track === track).map((t) => t.key)
      expect(templatesForTopic(key).map((t) => t.key), key).toEqual(expected)
    }
  })
})
