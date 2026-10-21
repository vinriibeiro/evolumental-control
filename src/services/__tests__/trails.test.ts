import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { CAREER_TRAILS, SUBJECT_LIBRARY, countTopics, subjectByKey, type TopicTree } from '@/content/trails'
import { installTrail } from '@/services/trails'

let n = 0
const fresh = () => new LocalBackend(`trails-${++n}`)
const items = (key: string) => CAREER_TRAILS.find((c) => c.key === key)!.subjects.map((s) => ({ subject: subjectByKey(s.key), weight: s.weight }))

describe('catálogo de trilhas', () => {
  it('chaves únicas e todas as matérias das carreiras existem', () => {
    const keys = SUBJECT_LIBRARY.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const c of CAREER_TRAILS) {
      for (const s of c.subjects) {
        expect(() => subjectByKey(s.key)).not.toThrow()
        expect(s.weight).toBeGreaterThan(0)
      }
      expect(c.sources.length).toBeGreaterThan(0)
      expect(c.sources.every((s) => /^https:\/\//.test(s.url))).toBe(true)
    }
  })

  it('tem as carreiras pedidas, incluindo professor da SEEDF e de Português', () => {
    const keys = CAREER_TRAILS.map((c) => c.key)
    for (const k of ['analista_dados', 'auditor_fiscal', 'cientista_dados', 'policial_federal', 'programador', 'professor_seedf_portugues', 'professor_portugues']) expect(keys).toContain(k)
    expect(CAREER_TRAILS.filter((c) => c.area === 'Tecnologia').length).toBeGreaterThanOrEqual(14)
  })

  it('Professor SEEDF soma as 120 questões da prova (divisão estimada)', () => {
    const t = CAREER_TRAILS.find((c) => c.key === 'professor_seedf_portugues')!
    expect(t.subjects.reduce((a, s) => a + s.weight, 0)).toBe(120)
  })

  it('Auditor Fiscal soma as 140 questões do último edital (80 + 60)', () => {
    const t = CAREER_TRAILS.find((c) => c.key === 'auditor_fiscal')!
    expect(t.subjects.reduce((a, s) => a + s.weight, 0)).toBe(140)
  })

  it('Agente PF soma os 120 itens da objetiva (+ discursiva e TAF)', () => {
    const t = CAREER_TRAILS.find((c) => c.key === 'policial_federal')!
    const objective = t.subjects.filter((s) => s.key !== 'discursiva' && s.key !== 'taf')
    expect(objective.reduce((a, s) => a + s.weight, 0)).toBe(120)
  })

  it('não há tópicos irmãos repetidos nem nomes vazios ou longos demais', () => {
    const check = (tree: TopicTree) => {
      const names = tree.map((x) => (typeof x === 'string' ? x : x[0]).toLowerCase())
      expect(new Set(names).size).toBe(names.length)
      for (const x of tree) {
        const name = typeof x === 'string' ? x : x[0]
        expect(name.trim().length).toBeGreaterThan(0)
        expect(name.length).toBeLessThanOrEqual(300)
        if (typeof x !== 'string') check(x[1])
      }
    }
    for (const s of SUBJECT_LIBRARY) check(s.topics)
  })
})

describe('instalação de trilhas', () => {
  it('cria matérias, tópicos aninhados, referências e ciclo proporcional aos pesos', async () => {
    const backend = fresh()
    const it_ = items('auditor_fiscal')
    const r = await installTrail(backend, it_, { cycleMinutes: 600, cycleName: 'Ciclo AFRFB' })
    expect(r.subjectsCreated).toBe(it_.length)
    const expectedTopics = it_.reduce((a, i) => a + countTopics(i.subject.topics), 0)
    expect(r.topicsCreated).toBe(expectedTopics)
    expect(r.materialsCreated).toBeGreaterThan(0)
    const cycle = await backend.get('study_cycles', r.cycleId!)
    expect(cycle?.status).toBe('active')
    const { rows: cycleItems } = await backend.list('study_cycle_items', { filters: [eq('cycle_id', r.cycleId!)] })
    expect(cycleItems).toHaveLength(it_.length)
    const total = cycleItems.reduce((a, c) => a + c.duration_minutes, 0)
    expect(Math.abs(total - 600)).toBeLessThanOrEqual(5 * it_.length)
    // Matéria com 10 questões recebe mais tempo que a de 6.
    const subjects = (await backend.list('subjects')).rows
    const minutesOf = (name: string) => cycleItems.find((c) => c.subject_id === subjects.find((s) => s.name === name)!.id)!.duration_minutes
    expect(minutesOf('Direito Tributário')).toBeGreaterThan(minutesOf('Estatística'))
  })

  it('instalar de novo, ou outra trilha com matérias em comum, não duplica nada', async () => {
    const backend = fresh()
    await installTrail(backend, items('auditor_fiscal'))
    const again = await installTrail(backend, items('auditor_fiscal'))
    expect(again.subjectsCreated).toBe(0)
    expect(again.topicsCreated).toBe(0)
    expect(again.materialsCreated).toBe(0)
    // A trilha da PF compartilha Português, Constitucional, Administrativo, Estatística, RL e Contabilidade.
    const pf = await installTrail(backend, items('policial_federal'))
    expect(pf.subjectsReused).toBe(6)
    const names = (await backend.list('subjects')).rows.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('grava em lotes: poucas chamadas ao servidor mesmo com centenas de tópicos', async () => {
    const inner = fresh()
    let calls = 0
    const counted = new Proxy(inner, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver)
        if (typeof v === 'function' && ['list', 'insert', 'update', 'remove', 'count', 'get'].includes(String(prop))) {
          return (...args: unknown[]) => {
            calls++
            return v.apply(target, args)
          }
        }
        return v
      },
    })
    const r = await installTrail(counted, items('auditor_fiscal'), { cycleMinutes: 600 })
    expect(r.topicsCreated).toBeGreaterThan(300)
    expect(calls).toBeLessThanOrEqual(15)
  })

  it('complementa uma matéria que o usuário já tinha (mesmo nome, sem acento/caixa)', async () => {
    const backend = fresh()
    const [mine] = await backend.insert('subjects', [{ name: 'lingua portuguesa' }])
    await backend.insert('topics', [{ subject_id: mine.id, name: 'Crase' }])
    const r = await installTrail(backend, [{ subject: subjectByKey('portugues'), weight: 1 }])
    expect(r.subjectsReused).toBe(1)
    const { rows } = await backend.list('topics', { filters: [eq('subject_id', mine.id), eq('name', 'Crase')] })
    expect(rows).toHaveLength(1)
  })
})
