import type { Project, ProjectStatus } from '@/types/db'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = { not_started: 'Não iniciado', in_progress: 'Em desenvolvimento', in_review: 'Aguardando revisão', done: 'Concluído' }
export const DIFFICULTY = ['', 'Iniciante', 'Intermediário', 'Avançado']

/** Progresso do projeto: etapas e entregáveis concluídos (nunca a simples criação). */
export function projectProgress(p: Pick<Project, 'steps' | 'deliverables'>): { done: number; total: number; pct: number } {
  const all = [...(p.steps ?? []), ...(p.deliverables ?? [])]
  const done = all.filter((x) => x.done).length
  return { done, total: all.length, pct: all.length ? (done / all.length) * 100 : 0 }
}
