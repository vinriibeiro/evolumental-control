import type { NotebookContentDoc } from '@/types/db'

const PREFIX = 'evl:kb-draft:'
/** Intervalo mínimo (5 min) entre snapshots automáticos em `notebook_page_versions`. */
export const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000
/** Retenção máxima de snapshots por página para evitar crescimento ilimitado. */
export const MAX_PAGE_VERSIONS = 30

export interface LocalPageDraft {
  nodeId: string
  title: string
  contentJson: NotebookContentDoc
  baseRevision: number
  savedAt: string
}

export function saveLocalDraft(draft: LocalPageDraft): void {
  try {
    localStorage.setItem(PREFIX + draft.nodeId, JSON.stringify(draft))
  } catch {
    /* quota cheia ou armazenamento indisponível */
  }
}

export function loadLocalDraft(nodeId: string): LocalPageDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + nodeId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalPageDraft>
    if (
      parsed.nodeId !== nodeId ||
      typeof parsed.savedAt !== 'string' ||
      typeof parsed.baseRevision !== 'number' ||
      !parsed.contentJson ||
      parsed.contentJson.type !== 'doc' ||
      !Array.isArray(parsed.contentJson.content)
    ) {
      return null
    }
    return {
      nodeId,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      contentJson: parsed.contentJson,
      baseRevision: parsed.baseRevision,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export function clearLocalDraft(nodeId: string): void {
  try {
    localStorage.removeItem(PREFIX + nodeId)
  } catch {
    /* indisponível */
  }
}

/** Decide se devemos criar um novo snapshot automático com base na data do último snapshot. */
export function shouldCreateAutoSnapshot(lastSnapshotIso: string | null | undefined, nowMs = Date.now()): boolean {
  if (!lastSnapshotIso) return true
  const lastMs = Date.parse(lastSnapshotIso)
  if (!Number.isFinite(lastMs)) return true
  return nowMs - lastMs >= AUTO_SNAPSHOT_INTERVAL_MS
}
