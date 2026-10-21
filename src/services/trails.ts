// Instala trilhas do catálogo no estudo do usuário: cria (ou reaproveita, pelo
// nome) matérias e tópicos, adiciona referências oficiais e, opcionalmente,
// monta um ciclo de estudos com durações proporcionais aos pesos.
//
// Tudo é planejado em memória primeiro (com IDs gerados no cliente) e gravado
// em lotes — uma chamada por tabela e por nível da árvore de tópicos — para
// ser rápido mesmo com o servidor longe (ex.: Supabase em outra região).
import type { DataBackend } from '@/lib/data/types'
import { eq, inList } from '@/lib/data/types'
import { distributeByWeight } from '@/lib/cycle'
import type { Insert, Subject, Topic } from '@/types/db'
import type { SubjectDef, TopicTree } from '@/content/trails'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const BATCH = 500

export interface InstallItem {
  subject: SubjectDef
  weight: number
}

export interface InstallOptions {
  cycleName?: string
  /** Minutos por volta do ciclo; null = não criar ciclo. */
  cycleMinutes?: number | null
  onProgress?: (message: string) => void
}

export interface InstallResult {
  subjectsCreated: number
  subjectsReused: number
  topicsCreated: number
  materialsCreated: number
  cycleId: string | null
}

async function insertBatched<T extends 'subjects' | 'topics' | 'study_materials' | 'study_cycle_items'>(backend: DataBackend, table: T, rows: Insert<T>[]) {
  for (let i = 0; i < rows.length; i += BATCH) await backend.insert(table, rows.slice(i, i + BATCH))
}

export async function installTrail(backend: DataBackend, items: InstallItem[], opts: InstallOptions = {}): Promise<InstallResult> {
  const result: InstallResult = { subjectsCreated: 0, subjectsReused: 0, topicsCreated: 0, materialsCreated: 0, cycleId: null }
  const progress = opts.onProgress ?? (() => {})

  // 1) Matérias: reaproveita pelo nome (sem acento/caixa) ou cria em um único lote.
  progress('Verificando suas matérias…')
  const { rows: existing } = await backend.list('subjects')
  let nextOrder = existing.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
  const subjectIds: string[] = []
  const newSubjects: Array<Insert<'subjects'> & { id: string }> = []
  const reactivate: string[] = []
  const byName = new Map(existing.map((s) => [norm(s.name), s] as const))
  for (const { subject: def, weight } of items) {
    const found: Subject | undefined = byName.get(norm(def.name))
    if (found) {
      result.subjectsReused++
      subjectIds.push(found.id)
      if (found.status === 'archived') reactivate.push(found.id)
      continue
    }
    const id = crypto.randomUUID()
    newSubjects.push({
      id,
      name: def.name,
      description: def.description,
      color: def.color,
      icon: def.icon,
      difficulty: def.difficulty,
      priority: weight >= 10 ? 5 : weight >= 8 ? 4 : weight >= 5 ? 3 : 2,
      status: 'active',
      sort_order: nextOrder++,
    })
    byName.set(norm(def.name), { id, name: def.name } as Subject)
    subjectIds.push(id)
  }
  if (newSubjects.length) {
    progress(`Criando ${newSubjects.length} matéria(s)…`)
    await insertBatched(backend, 'subjects', newSubjects)
    result.subjectsCreated = newSubjects.length
  }
  if (reactivate.length) await backend.update('subjects', [inList('id', reactivate)], { status: 'active', archived_at: null })

  // 2) Tópicos: mescla por nome dentro do mesmo pai; agrupa os novos por nível.
  progress('Montando tópicos…')
  const reusedIds = subjectIds.filter((id) => !newSubjects.some((s) => s.id === id))
  const existingTopics: Topic[] = reusedIds.length ? (await backend.list('topics', { filters: [inList('subject_id', reusedIds)] })).rows : []
  const children = new Map<string, Array<{ id: string; name: string; sort_order: number }>>()
  const childKey = (subjectId: string, parentId: string | null) => `${subjectId}|${parentId ?? ''}`
  for (const t of existingTopics) {
    const k = childKey(t.subject_id, t.parent_id)
    children.set(k, [...(children.get(k) ?? []), t])
  }
  const levels: Array<Array<Insert<'topics'> & { id: string }>> = []
  const seenSubject = new Set<string>()
  items.forEach(({ subject: def }, idx) => {
    const subjectId = subjectIds[idx]
    if (seenSubject.has(subjectId)) return // mesma matéria repetida na lista
    seenSubject.add(subjectId)
    const walk = (tree: TopicTree, parentId: string | null, depth: number) => {
      const k = childKey(subjectId, parentId)
      const siblings = children.get(k) ?? []
      children.set(k, siblings)
      let order = siblings.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
      for (const node of tree) {
        const [name, sub] = typeof node === 'string' ? [node, null] : node
        let topic = siblings.find((t) => norm(t.name) === norm(name))
        if (!topic) {
          topic = { id: crypto.randomUUID(), name, sort_order: order++ }
          siblings.push(topic)
          ;(levels[depth] ??= []).push({ id: topic.id, subject_id: subjectId, parent_id: parentId, name, sort_order: topic.sort_order })
        }
        if (sub) walk(sub, topic.id, depth + 1)
      }
    }
    walk(def.topics, null, 0)
  })
  for (let depth = 0; depth < levels.length; depth++) {
    const rows = levels[depth] ?? []
    if (!rows.length) continue
    progress(`Gravando tópicos (nível ${depth + 1})…`)
    await insertBatched(backend, 'topics', rows)
    result.topicsCreated += rows.length
  }

  // 3) Referências oficiais (sem repetir links que a matéria já tem).
  const refs = items.flatMap(({ subject: def }, idx) => (def.references ?? []).map((r) => ({ subject_id: subjectIds[idx], title: r.title, url: r.url })))
  if (refs.length) {
    const { rows: mats } = await backend.list('study_materials', { filters: [inList('subject_id', [...new Set(refs.map((r) => r.subject_id))])] })
    const have = new Set(mats.map((m) => `${m.subject_id}|${m.url}`))
    const fresh = refs.filter((r) => !have.has(`${r.subject_id}|${r.url}`) && (have.add(`${r.subject_id}|${r.url}`), true)).map((r) => ({ ...r, topic_id: null }))
    if (fresh.length) {
      await insertBatched(backend, 'study_materials', fresh)
      result.materialsCreated = fresh.length
    }
  }

  // 4) Ciclo opcional, com durações proporcionais aos pesos.
  if (opts.cycleMinutes && opts.cycleMinutes >= 5 && items.length) {
    progress('Criando o ciclo de estudos…')
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
    await insertBatched(
      backend,
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
  progress('Pronto!')
  return result
}
