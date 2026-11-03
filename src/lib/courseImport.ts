// Catálogo de cursos a partir da leitura de uma pasta do Drive (regras puras, sem rede nem banco).
//
// 1. buildPlan: transforma o que foi lido (crawlFolder) em curso → módulos → aulas/materiais, conforme o
//    mapeamento escolhido (nível dos cursos e pastas excluídas), em ordem natural.
// 2. reconcile: compara o plano com o catálogo já salvo e devolve só o necessário (inserir/atualizar).
//    - Reconhece os itens pelo ID do Drive na posição (pasta/arquivo): renomear no Drive não cria outra aula.
//    - Preserva nome personalizado, vínculos, ocultação, ordem e pasta definidas à mão.
//    - Só marca como "não encontrado" o que sumiu de uma pasta lida por completo; o resto fica como está.
import { FOLDER_MIME, materialType, naturalCompare, type MaterialKind } from './drive'
import type { CrawlEntry, CrawlIssue, CrawlResult } from './driveCrawl'
import type { CourseNode, CourseNodeKind, CourseSourceConfig, Insert, Patch } from '@/types/db'

export interface PlanNode {
  key: string
  driveId: string
  driveParentId: string | null
  parentKey: string | null
  kind: CourseNodeKind
  title: string
  mimeType: string
  resourceKey: string | null
  size: number | null
  modifiedTime: string | null
  durationMs: number | null
  viaShortcut: string | null
  sortOrder: number
  depth: number
  /** Caminho legível (para a prévia). */
  path: string
}

export interface PlanSummary {
  courses: number
  modules: number
  items: number
  byKind: Partial<Record<MaterialKind, number>>
  /** Itens sem visualizador incorporado (ficam no catálogo com "Abrir no Drive"). */
  incompatible: Array<{ title: string; mimeType: string; path: string }>
  emptyFolders: Array<{ title: string; path: string }>
  excludedFolders: number
  /** Arquivos que aparecem em mais de um lugar (referências ao mesmo arquivo). */
  repeatedFiles: number
  failedFolders: CrawlIssue[]
  skipped: CrawlIssue[]
  truncated: boolean
}

export interface Plan {
  nodes: PlanNode[]
  summary: PlanSummary
}

export const placementKey = (parentId: string | null, id: string) => `${parentId ?? ''}/${id}`

/** Monta o catálogo proposto. Pastas sem nenhum arquivo (em qualquer nível abaixo) ficam de fora e aparecem na prévia. */
export function buildPlan(crawl: CrawlResult, config: CourseSourceConfig): Plan {
  const root = crawl.root
  const summary: PlanSummary = {
    courses: 0,
    modules: 0,
    items: 0,
    byKind: {},
    incompatible: [],
    emptyFolders: [],
    excludedFolders: 0,
    repeatedFiles: 0,
    failedFolders: crawl.failedFolders,
    skipped: crawl.skipped,
    truncated: crawl.truncated,
  }
  if (!root) return { nodes: [], summary }
  const excluded = new Set(config.excluded)
  const children = new Map<string, CrawlEntry[]>()
  for (const e of crawl.entries) children.set(e.parentId, [...(children.get(e.parentId) ?? []), e])
  const isFolder = (e: CrawlEntry) => e.mimeType === FOLDER_MIME
  const sorted = (list: CrawlEntry[]) => [...list].sort((a, b) => naturalCompare(a.name, b.name) || Number(isFolder(b)) - Number(isFolder(a)) || a.id.localeCompare(b.id))

  // Quantos arquivos há abaixo de cada pasta (sem contar as excluídas).
  const fileCount = new Map<string, number>()
  const countFiles = (folderId: string, trail: Set<string>): number => {
    if (fileCount.has(folderId)) return fileCount.get(folderId)!
    // Pasta que não pôde ser lida por completo não é "vazia": fica no catálogo e o conteúdo dela não é julgado.
    if (!crawl.listedFolders.has(folderId)) return 1
    let n = 0
    for (const e of children.get(folderId) ?? []) {
      if (!isFolder(e)) n++
      else if (!excluded.has(e.id) && !trail.has(e.id)) n += countFiles(e.id, new Set([...trail, e.id]))
    }
    fileCount.set(folderId, n)
    return n
  }

  const nodes: PlanNode[] = []
  const fileSeen = new Map<string, number>()
  const base = (e: CrawlEntry) => ({
    driveId: e.id,
    driveParentId: e.parentId,
    title: e.name,
    mimeType: e.mimeType,
    resourceKey: e.resourceKey,
    size: e.size,
    modifiedTime: e.modifiedTime,
    durationMs: e.durationMs,
    viaShortcut: e.viaShortcut,
  })

  const walk = (folderId: string, parentKey: string, depth: number, path: string) => {
    let order = 0
    for (const e of sorted(children.get(folderId) ?? [])) {
      const key = placementKey(e.parentId, e.id)
      const here = `${path} › ${e.name}`
      if (isFolder(e)) {
        if (excluded.has(e.id)) {
          summary.excludedFolders++
          continue
        }
        if (countFiles(e.id, new Set([e.id])) === 0) {
          summary.emptyFolders.push({ title: e.name, path: here })
          continue
        }
        nodes.push({ ...base(e), key, parentKey, kind: 'module', sortOrder: order++, depth, path: here })
        summary.modules++
        walk(e.id, key, depth + 1, here)
      } else {
        nodes.push({ ...base(e), key, parentKey, kind: 'item', sortOrder: order++, depth, path: here })
        summary.items++
        fileSeen.set(e.id, (fileSeen.get(e.id) ?? 0) + 1)
        const type = materialType(e.mimeType)
        summary.byKind[type.kind] = (summary.byKind[type.kind] ?? 0) + 1
        if (!type.embeddable) summary.incompatible.push({ title: e.name, mimeType: e.mimeType, path: here })
      }
    }
  }

  const rootEntry: CrawlEntry = { id: root.id, name: root.name, mimeType: FOLDER_MIME, parentId: '', resourceKey: root.resourceKey ?? null, size: null, modifiedTime: root.modifiedTime ?? null, durationMs: null, viaShortcut: null }
  const rootCourse = (sortOrder: number, onlyFiles: boolean) => {
    const key = placementKey(null, root.id)
    nodes.push({ ...base(rootEntry), driveParentId: null, key, parentKey: null, kind: 'course', sortOrder, depth: 0, path: root.name })
    summary.courses++
    if (!onlyFiles) return walk(root.id, key, 1, root.name)
    let order = 0
    for (const e of sorted((children.get(root.id) ?? []).filter((x) => !isFolder(x)))) {
      nodes.push({ ...base(e), key: placementKey(e.parentId, e.id), parentKey: key, kind: 'item', sortOrder: order++, depth: 1, path: `${root.name} › ${e.name}` })
      summary.items++
      fileSeen.set(e.id, (fileSeen.get(e.id) ?? 0) + 1)
      const type = materialType(e.mimeType)
      summary.byKind[type.kind] = (summary.byKind[type.kind] ?? 0) + 1
      if (!type.embeddable) summary.incompatible.push({ title: e.name, mimeType: e.mimeType, path: `${root.name} › ${e.name}` })
    }
  }

  if (config.courseLevel === 0) {
    if (countFiles(root.id, new Set([root.id])) > 0) rootCourse(0, false)
  } else {
    let order = 0
    const top = sorted(children.get(root.id) ?? [])
    // Arquivos soltos na pasta raiz formam um curso com o nome da própria pasta.
    if (top.some((e) => !isFolder(e))) rootCourse(order++, true)
    for (const e of top.filter(isFolder)) {
      if (excluded.has(e.id)) {
        summary.excludedFolders++
        continue
      }
      if (countFiles(e.id, new Set([e.id])) === 0) {
        summary.emptyFolders.push({ title: e.name, path: `${root.name} › ${e.name}` })
        continue
      }
      const key = placementKey(e.parentId, e.id)
      nodes.push({ ...base(e), key, parentKey: null, kind: 'course', sortOrder: order++, depth: 0, path: e.name })
      summary.courses++
      walk(e.id, key, 1, e.name)
    }
  }
  summary.repeatedFiles = [...fileSeen.values()].filter((n) => n > 1).length
  return { nodes, summary }
}

export interface ReconcileResult {
  inserts: Array<Insert<'course_nodes'> & { id: string }>
  updates: Array<{ id: string; patch: Patch<'course_nodes'> }>
  counts: { inserted: number; updated: number; unchanged: number; missing: number; restored: number; excluded: number; unverified: number }
}

const sameIso = (a: string | null | undefined, b: string | null | undefined) => (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null)

/**
 * Compara o plano com o catálogo salvo da mesma fonte. `seenKeys`/`seenDriveIds` são TODAS as posições lidas no
 * Drive (inclusive pastas excluídas e vazias), para distinguir "deixado de fora" de "sumiu do Drive".
 */
export function reconcile(existing: CourseNode[], plan: Plan, crawl: CrawlResult, sourceId: string, now: string, newId: () => string = () => crypto.randomUUID()): ReconcileResult {
  const counts = { inserted: 0, updated: 0, unchanged: 0, missing: 0, restored: 0, excluded: 0, unverified: 0 }
  const byKey = new Map(existing.map((n) => [n.placement_key, n]))
  const matched = new Map<string, CourseNode>()
  const used = new Set<string>()
  for (const p of plan.nodes) {
    const e = byKey.get(p.key)
    if (e) {
      matched.set(p.key, e)
      used.add(e.id)
    }
  }
  // Movido de pasta no Drive: mesmo arquivo, posição nova. Só quando não há ambiguidade.
  const looseByDrive = new Map<string, CourseNode[]>()
  for (const n of existing) if (!used.has(n.id)) looseByDrive.set(n.drive_id, [...(looseByDrive.get(n.drive_id) ?? []), n])
  const planByDrive = new Map<string, number>()
  for (const p of plan.nodes) if (!matched.has(p.key)) planByDrive.set(p.driveId, (planByDrive.get(p.driveId) ?? 0) + 1)
  for (const p of plan.nodes) {
    if (matched.has(p.key)) continue
    const candidates = looseByDrive.get(p.driveId) ?? []
    if (candidates.length === 1 && planByDrive.get(p.driveId) === 1 && !used.has(candidates[0].id)) {
      matched.set(p.key, candidates[0])
      used.add(candidates[0].id)
    }
  }

  const ids = new Map<string, string>()
  const inserts: ReconcileResult['inserts'] = []
  const updates: ReconcileResult['updates'] = []
  for (const p of plan.nodes) {
    const parentId = p.parentKey ? (ids.get(p.parentKey) ?? null) : null
    const e = matched.get(p.key)
    if (!e) {
      const id = newId()
      ids.set(p.key, id)
      inserts.push({
        id,
        source_id: sourceId,
        parent_id: parentId,
        kind: p.kind,
        drive_id: p.driveId,
        drive_parent_id: p.driveParentId,
        placement_key: p.key,
        title: p.title.slice(0, 500),
        mime_type: p.mimeType.slice(0, 200),
        resource_key: p.resourceKey,
        size_bytes: p.size,
        duration_ms: p.durationMs,
        drive_modified_at: p.modifiedTime,
        via_shortcut: p.viaShortcut,
        sort_order: p.sortOrder,
        status: 'available',
      })
      counts.inserted++
      continue
    }
    ids.set(p.key, e.id)
    const patch: Patch<'course_nodes'> = {}
    const set = <K extends keyof Patch<'course_nodes'>>(k: K, v: Patch<'course_nodes'>[K]) => {
      if ((e as unknown as Record<string, unknown>)[k] !== v) patch[k] = v
    }
    set('kind', p.kind)
    set('title', p.title.slice(0, 500))
    set('mime_type', p.mimeType.slice(0, 200))
    set('resource_key', p.resourceKey)
    set('size_bytes', p.size)
    set('duration_ms', p.durationMs)
    if (!sameIso(e.drive_modified_at, p.modifiedTime)) patch.drive_modified_at = p.modifiedTime
    set('via_shortcut', p.viaShortcut)
    set('drive_parent_id', p.driveParentId)
    set('placement_key', p.key)
    if (!e.parent_manual) set('parent_id', parentId)
    if (!e.sort_manual) set('sort_order', p.sortOrder)
    if (e.status !== 'available') {
      patch.status = 'available'
      patch.missing_since = null
      counts.restored++
    }
    if (Object.keys(patch).length) {
      updates.push({ id: e.id, patch })
      counts.updated++
    } else counts.unchanged++
  }

  // O que não entrou no plano: deixado de fora pelo mapeamento, sumido do Drive ou não verificado.
  const seenKeys = new Set(crawl.entries.map((x) => placementKey(x.parentId, x.id)))
  if (crawl.root) seenKeys.add(placementKey(null, crawl.root.id))
  const rest = existing.filter((n) => !used.has(n.id))
  const goneFolders = new Set<string>()
  const decided = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const n of rest) {
      if (decided.has(n.id)) continue
      if (seenKeys.has(n.placement_key)) {
        decided.add(n.id)
        changed = true
        if (n.status !== 'excluded') {
          updates.push({ id: n.id, patch: { status: 'excluded', missing_since: null } })
          counts.excluded++
        }
        continue
      }
      const parent = n.drive_parent_id
      if (parent && (crawl.listedFolders.has(parent) || goneFolders.has(parent))) {
        decided.add(n.id)
        changed = true
        if (n.kind !== 'item') goneFolders.add(n.drive_id)
        if (n.status !== 'missing') {
          updates.push({ id: n.id, patch: { status: 'missing', missing_since: n.missing_since ?? now } })
          counts.missing++
        }
      }
    }
  }
  counts.unverified = rest.filter((n) => !decided.has(n.id)).length
  return { inserts, updates, counts }
}
