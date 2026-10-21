// Instala trilhas do catálogo no estudo do usuário: cria (ou reaproveita, pelo
// nome) matérias e tópicos, adiciona referências oficiais e, opcionalmente,
// monta um ciclo de estudos com durações proporcionais aos pesos.
import type { DataBackend } from '@/lib/data/types'
import { eq } from '@/lib/data/types'
import { distributeByWeight } from '@/lib/cycle'
import type { Subject, Topic } from '@/types/db'
import type { SubjectDef, TopicTree } from '@/content/trails'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

export interface InstallItem {
  subject: SubjectDef
  weight: number
}

export interface InstallOptions {
  cycleName?: string
  /** Minutos por volta do ciclo; null = não criar ciclo. */
  cycleMinutes?: number | null
}

export interface InstallResult {
  subjectsCreated: number
  subjectsReused: number
  topicsCreated: number
  materialsCreated: number
  cycleId: string | null
}

export async function installTrail(backend: DataBackend, items: InstallItem[], opts: InstallOptions = {}): Promise<InstallResult> {
  const result: InstallResult = { subjectsCreated: 0, subjectsReused: 0, topicsCreated: 0, materialsCreated: 0, cycleId: null }
  const { rows: existingSubjects } = await backend.list('subjects')
  let nextOrder = existingSubjects.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
  const subjectIds: string[] = []

  for (const { subject: def, weight } of items) {
    let subject: Subject | undefined = existingSubjects.find((s) => norm(s.name) === norm(def.name))
    if (subject) {
      result.subjectsReused++
      if (subject.status === 'archived') {
        ;[subject] = await backend.update('subjects', [eq('id', subject.id)], { status: 'active', archived_at: null })
      }
    } else {
      ;[subject] = await backend.insert('subjects', [
        {
          name: def.name,
          description: def.description,
          color: def.color,
          icon: def.icon,
          difficulty: def.difficulty,
          priority: Math.min(5, Math.max(1, Math.round(weight >= 10 ? 5 : weight >= 8 ? 4 : weight >= 5 ? 3 : 2))),
          status: 'active',
          sort_order: nextOrder++,
        },
      ])
      existingSubjects.push(subject)
      result.subjectsCreated++
    }
    subjectIds.push(subject.id)

    // Tópicos: mescla por nome dentro do mesmo pai.
    const { rows: topics } = await backend.list('topics', { filters: [eq('subject_id', subject.id)] })
    const children = new Map<string, Topic[]>()
    for (const t of topics) {
      const k = t.parent_id ?? ''
      children.set(k, [...(children.get(k) ?? []), t])
    }
    const walk = async (tree: TopicTree, parentId: string | null) => {
      const siblings = children.get(parentId ?? '') ?? []
      let order = siblings.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
      for (const node of tree) {
        const [name, sub] = typeof node === 'string' ? [node, null] : node
        let topic = siblings.find((t) => norm(t.name) === norm(name))
        if (!topic) {
          ;[topic] = await backend.insert('topics', [{ subject_id: subject!.id, parent_id: parentId, name, sort_order: order++ }])
          siblings.push(topic)
          children.set(parentId ?? '', siblings)
          result.topicsCreated++
        }
        if (sub) await walk(sub, topic.id)
      }
    }
    await walk(def.topics, null)

    if (def.references?.length) {
      const { rows: mats } = await backend.list('study_materials', { filters: [eq('subject_id', subject.id)] })
      const have = new Set(mats.map((m) => m.url))
      const fresh = def.references.filter((r) => !have.has(r.url)).map((r) => ({ subject_id: subject!.id, topic_id: null, title: r.title, url: r.url }))
      if (fresh.length) {
        await backend.insert('study_materials', fresh)
        result.materialsCreated += fresh.length
      }
    }
  }

  if (opts.cycleMinutes && opts.cycleMinutes >= 5 && items.length) {
    const durations = distributeByWeight(
      items.map((i) => i.weight),
      opts.cycleMinutes,
    )
    const { count } = await backend.list('study_cycles', { filters: [eq('status', 'active')], count: true, limit: 1 })
    const [cycle] = await backend.insert('study_cycles', [
      { name: (opts.cycleName ?? 'Ciclo da trilha').slice(0, 160), description: 'Criado a partir de uma trilha. Durações proporcionais ao peso de cada matéria.', status: count ? 'paused' : 'active', auto_advance: true },
    ])
    // Ordem do ciclo: intercala matérias de maior e menor peso para variar o estudo.
    const order = items.map((it, i) => ({ i, w: it.weight })).sort((a, b) => b.w - a.w)
    const interleaved: number[] = []
    for (let a = 0, b = order.length - 1; a <= b; a++, b--) {
      interleaved.push(order[a].i)
      if (a !== b) interleaved.push(order[b].i)
    }
    await backend.insert(
      'study_cycle_items',
      interleaved.map((idx, pos) => ({
        cycle_id: cycle.id,
        subject_id: subjectIds[idx],
        duration_minutes: Math.max(5, durations[idx]),
        weight: Math.max(0.1, Math.min(100, items[idx].weight)),
        sort_order: pos,
        activity_type: 'theory' as const,
      })),
    )
    result.cycleId = cycle.id
  }
  return result
}
