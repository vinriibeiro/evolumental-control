// Mapa de domínio do edital: qual indicador a árvore e as listas mostram.
// Cada valor vem com texto (nunca só cor) e, quando faz sentido, uma fração
// para a barra.
import { MASTERY_LEVEL_LABELS } from '@/lib/insight/mastery'
import type { NodeMastery } from '@/lib/insight/evidence'
import type { NodeStats } from '@/lib/insight/treeStats'
import { PRIORITY_LABELS } from '@/lib/labels'
import { formatDuration } from '@/lib/time'
import type { ExplorerNode } from './model'

export type ExplorerMetric = 'progress' | 'mastery' | 'time' | 'questions' | 'accuracy' | 'priority'

export const METRIC_LABELS: Record<ExplorerMetric, string> = {
  progress: 'Progresso',
  mastery: 'Domínio',
  time: 'Tempo',
  questions: 'Questões',
  accuracy: 'Acerto',
  priority: 'Prioridade',
}

export interface MetricDisplay {
  text: string
  /** 0–100 para a barra; null = só texto. */
  percent: number | null
  /** Frase completa para leitores de tela. */
  aria: string
}

export interface MetricContext {
  progress: (n: ExplorerNode) => number | null
  mastery: (n: ExplorerNode) => NodeMastery | null
  stats: (n: ExplorerNode) => NodeStats | null
}

export function metricDisplay(metric: ExplorerMetric, n: ExplorerNode, ctx: MetricContext): MetricDisplay | null {
  switch (metric) {
    case 'progress': {
      const p = ctx.progress(n)
      return p == null ? null : { text: `${Math.round(p)}%`, percent: p, aria: `${Math.round(p)}% do conteúdo concluído` }
    }
    case 'mastery': {
      const m = ctx.mastery(n)
      if (!m) return null
      if (m.level === 'none') return { text: 'sem dados', percent: null, aria: 'Domínio: sem dados' }
      return { text: `${m.value}%`, percent: m.value, aria: `Domínio ${m.value}%, ${MASTERY_LEVEL_LABELS[m.level]}` }
    }
    case 'time': {
      const s = ctx.stats(n)
      if (!s) return null
      return { text: s.seconds ? formatDuration(s.seconds) : '0min', percent: null, aria: `${formatDuration(s.seconds)} estudados (últimos 12 meses)` }
    }
    case 'questions': {
      const s = ctx.stats(n)
      if (!s) return null
      return { text: String(s.questions), percent: null, aria: `${s.questions} questões (últimos 12 meses)` }
    }
    case 'accuracy': {
      const s = ctx.stats(n)
      if (!s) return null
      if (!s.questions) return { text: '—', percent: null, aria: 'Acerto: sem questões' }
      const v = Math.round((s.correct / s.questions) * 100)
      return { text: `${v}%`, percent: v, aria: `${v}% de acerto em ${s.questions} questões` }
    }
    case 'priority': {
      const p = n.subject?.priority ?? n.topic?.priority
      return p == null ? null : { text: PRIORITY_LABELS[p], percent: null, aria: `Prioridade ${PRIORITY_LABELS[p]}` }
    }
  }
}
