// Cursos e materiais do Drive sobre a camada de dados comum (modo local e Supabase).
// Só grava referências, metadados, organização e progresso — nunca o conteúdo dos arquivos.
import { fetchAll } from '@/hooks/data'
import { DataError, eq, type DataBackend } from '@/lib/data/types'
import { buildPlan, reconcile, type ReconcileResult } from '@/lib/courseImport'
import type { CrawlResult } from '@/lib/driveCrawl'
import type { CourseNode, CourseProgress, CourseSource, CourseSourceConfig, CourseSyncReport, TableName } from '@/types/db'

export const COURSE_TABLES: TableName[] = ['course_sources', 'course_nodes', 'course_progress']

export const DEFAULT_CONFIG: CourseSourceConfig = { courseLevel: 1, excluded: [] }

export function sourceConfig(s: Pick<CourseSource, 'config'>): CourseSourceConfig {
  const c = (s.config ?? {}) as Partial<CourseSourceConfig>
  return {
    courseLevel: c.courseLevel === 0 ? 0 : 1,
    excluded: Array.isArray(c.excluded) ? c.excluded.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [],
  }
}

/** Cadastra a pasta (ou devolve a já cadastrada com o mesmo ID). */
export async function addSource(backend: DataBackend, folderId: string, title: string): Promise<CourseSource> {
  const { rows } = await backend.list('course_sources', { filters: [eq('drive_folder_id', folderId)], limit: 1 })
  if (rows[0]) return rows[0]
  try {
    const [row] = await backend.insert('course_sources', [{ drive_folder_id: folderId, title: title.slice(0, 500) || folderId, config: DEFAULT_CONFIG }])
    return row
  } catch (e) {
    if (e instanceof DataError && e.code === 'duplicate') {
      const again = await backend.list('course_sources', { filters: [eq('drive_folder_id', folderId)], limit: 1 })
      if (again.rows[0]) return again.rows[0]
    }
    throw e
  }
}

export interface SyncPreview {
  plan: ReturnType<typeof buildPlan>
  diff: ReconcileResult
}

/** Calcula a prévia (o que entraria, mudaria ou seria sinalizado) sem gravar nada. */
export async function previewSync(backend: DataBackend, source: CourseSource, crawl: CrawlResult, config: CourseSourceConfig, now = new Date().toISOString()): Promise<SyncPreview> {
  const existing = await fetchAll(backend, 'course_nodes', { filters: [eq('source_id', source.id)] })
  const plan = buildPlan(crawl, config)
  return { plan, diff: reconcile(existing, plan, crawl, source.id, now) }
}

async function inParallel<T>(items: T[], limit: number, fn: (x: T) => Promise<unknown>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

/**
 * Aplica a prévia: insere o que é novo (pais antes dos filhos), atualiza o que mudou e registra o resultado na fonte.
 * Uma leitura com falha fatal não mexe no catálogo; uma leitura parcial só sinaliza o que foi conferido.
 */
export async function applySync(backend: DataBackend, source: CourseSource, crawl: CrawlResult, config: CourseSourceConfig, preview?: SyncPreview, onProgress?: (done: number, total: number) => void): Promise<CourseSyncReport> {
  const now = new Date().toISOString()
  if (crawl.fatal || !crawl.root) {
    const report: CourseSyncReport = { error: crawl.fatal?.message ?? 'Pasta não lida.' }
    await backend.update('course_sources', [eq('id', source.id)], { last_sync_at: now, last_sync_status: 'failed', last_sync_report: report })
    return report
  }
  const { diff } = preview ?? (await previewSync(backend, source, crawl, config, now))
  const total = diff.inserts.length + diff.updates.length
  let done = 0
  for (let i = 0; i < diff.inserts.length; i += 500) {
    const batch = diff.inserts.slice(i, i + 500)
    await backend.insert('course_nodes', batch)
    done += batch.length
    onProgress?.(done, total)
  }
  await inParallel(diff.updates, 6, async (u) => {
    await backend.update('course_nodes', [eq('id', u.id)], u.patch)
    onProgress?.(++done, total)
  })
  const partial = crawl.failedFolders.length > 0 || crawl.truncated
  const report: CourseSyncReport = {
    inserted: diff.counts.inserted,
    updated: diff.counts.updated,
    missing: diff.counts.missing,
    restored: diff.counts.restored,
    excluded: diff.counts.excluded,
    unverified: diff.counts.unverified,
    failedFolders: crawl.failedFolders.slice(0, 50).map((f) => ({ id: f.id, name: f.name.slice(0, 200), message: f.message.slice(0, 300) })),
    skipped: crawl.skipped.length,
    truncated: crawl.truncated,
  }
  await backend.update('course_sources', [eq('id', source.id)], {
    title: crawl.root.name.slice(0, 500) || source.title,
    config,
    last_sync_at: now,
    last_sync_status: partial ? 'partial' : 'ok',
    last_sync_report: report,
  })
  return report
}

async function upsertProgress(backend: DataBackend, driveId: string, patch: Partial<Pick<CourseProgress, 'completed_at' | 'last_opened_at' | 'last_node_id'>>): Promise<CourseProgress> {
  const { rows } = await backend.list('course_progress', { filters: [eq('drive_id', driveId)], limit: 1 })
  if (rows[0]) return (await backend.update('course_progress', [eq('id', rows[0].id)], patch))[0] ?? rows[0]
  try {
    return (await backend.insert('course_progress', [{ drive_id: driveId, ...patch }]))[0]
  } catch (e) {
    // outra aba ou aparelho criou ao mesmo tempo
    if (e instanceof DataError && e.code === 'duplicate') {
      const again = await backend.list('course_progress', { filters: [eq('drive_id', driveId)], limit: 1 })
      if (again.rows[0]) return (await backend.update('course_progress', [eq('id', again.rows[0].id)], patch))[0] ?? again.rows[0]
    }
    throw e
  }
}

/** Conclusão manual: o app não sabe quanto do vídeo/documento foi visto. */
export function setCompleted(backend: DataBackend, node: Pick<CourseNode, 'id' | 'drive_id'>, done: boolean) {
  return upsertProgress(backend, node.drive_id, { completed_at: done ? new Date().toISOString() : null, last_node_id: node.id })
}

/** Registra o último material aberto (para "Continuar estudando"). */
export function markOpened(backend: DataBackend, node: Pick<CourseNode, 'id' | 'drive_id'>) {
  return upsertProgress(backend, node.drive_id, { last_opened_at: new Date().toISOString(), last_node_id: node.id })
}

/** Remove a fonte e o catálogo dela. O progresso (por arquivo do Drive) fica e volta se a pasta for cadastrada de novo. */
export function removeSource(backend: DataBackend, sourceId: string) {
  return backend.remove('course_sources', [eq('id', sourceId)])
}
