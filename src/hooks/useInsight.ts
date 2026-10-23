// Dados para os indicadores de domínio e recomendação. Carrega só a janela
// recente (365 dias) de sessões, questões e respostas do EvoQuest — o peso de
// evidências mais antigas já é desprezível pela meia-vida da fórmula — e
// calcula tudo no navegador a partir das tabelas existentes (nada persistido).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { fetchAll, fetchAllSessions } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import type { DataBackend } from '@/lib/data/types'
import { eq, gte, inList } from '@/lib/data/types'
import { masteryIndex, type InsightInput } from '@/lib/insight/evidence'
import { classicAnswers, gameEvidenceByTopic, worldEvidenceAnswers, type GameTopicCatalog } from '@/lib/insight/game'
import { addDays, todayKey, zonedDayStart } from '@/lib/time'
import { gameSettings } from '@/game/useGame'
import type { Challenge } from '@/game/types'
import type { UserSettings } from '@/types/db'

export const INSIGHT_TABLES = ['subjects', 'topics', 'study_sessions', 'study_session_pauses', 'question_records', 'question_errors', 'reviews', 'flashcards', 'game_answers', 'game_evidence'] as const
export const INSIGHT_WINDOW_DAYS = 365

export async function loadInsightInput(backend: DataBackend, settings: UserSettings): Promise<InsightInput> {
  const tz = settings.timezone
  const today = todayKey(tz)
  const from = addDays(today, -INSIGHT_WINDOW_DAYS)
  const fromIso = new Date(zonedDayStart(from, tz)).toISOString()
  const [subjects, topics, sessions, questions, reviews, cards, quizAnswers, world] = await Promise.all([
    fetchAll(backend, 'subjects'),
    fetchAll(backend, 'topics'),
    fetchAllSessions(backend, { filters: [eq('status', 'completed'), gte('started_at', fromIso)] }),
    fetchAll(backend, 'question_records', { filters: [gte('date', from)] }),
    fetchAll(backend, 'reviews', { filters: [inList('status', ['planned', 'postponed', 'done'])] }),
    fetchAll(backend, 'flashcards'),
    fetchAll(backend, 'game_answers', { filters: [gte('answered_at', fromIso)] }),
    // Evidências do mundo (missões de aprendizagem): ponderadas por estágio e ajuda.
    fetchAll(backend, 'game_evidence', { filters: [gte('created_at', fromIso)] }).catch(() => []),
  ])
  // Caderno de erros: só dos registros da janela que têm erros (em lotes de ids).
  const withErrors = questions.filter((q) => q.wrong > 0).map((q) => q.id)
  const errors: NonNullable<InsightInput['errors']> = []
  for (let i = 0; i < withErrors.length; i += 100) errors.push(...(await fetchAll(backend, 'question_errors', { filters: [inList('record_id', withErrors.slice(i, i + 100))] })))
  let game: InsightInput['game']
  if (quizAnswers.length || world.length) {
    const { loadSubject } = await import('@/game/catalog')
    const catalog: GameTopicCatalog = {}
    const challenges = new Map<string, Challenge>()
    for (const id of [...new Set([...quizAnswers.map((a) => a.subject_id), ...world.map((w) => w.subject)])]) {
      const content = await loadSubject(id).catch(() => null)
      if (!content) continue
      catalog[id] = content.units.flatMap((u) => u.topics)
      for (const u of content.units) for (const c of u.challenges) challenges.set(c.id, c)
    }
    // Respostas clássicas e evidências do mundo, ponderadas por estágio e ajuda.
    const answers = [...classicAnswers(quizAnswers, challenges), ...worldEvidenceAnswers(world)]
    game = gameEvidenceByTopic(answers, catalog, topics, subjects, gameSettings(settings).links)
  }
  return { subjects, topics, sessions, questions, errors, reviews, cards, game, today, tz }
}

/** Entrada crua (recarrega quando qualquer tabela usada muda). */
export function useInsightInput(enabled = true) {
  const backend = useBackend()
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  return useQuery({
    queryKey: ['data', [...INSIGHT_TABLES], 'insight', backend.kind, today, settings.timezone, settings.evoquest?.links ?? null],
    queryFn: () => loadInsightInput(backend, settings),
    staleTime: 60_000,
    enabled,
  })
}

/** Domínio de todos os tópicos e matérias. */
export function useMastery(enabled = true) {
  const input = useInsightInput(enabled)
  const index = useMemo(() => (input.data ? masteryIndex(input.data, Date.now()) : null), [input.data])
  return { index, input: input.data ?? null, isPending: input.isPending, error: input.error, refetch: input.refetch }
}
