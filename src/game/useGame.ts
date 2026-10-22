// Hooks e serviços do EvoQuest sobre a camada de dados existente.
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { useAll, invalidateTables } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import type { DataBackend, GameAnswerInput } from '@/lib/data/types'
import { DataError } from '@/lib/data/types'
import { addManualSession } from '@/services/sessions'
import { dayKey, startOfWeek, todayKey, zonedDayStart, addDays } from '@/lib/time'
import type { EvoQuestSettings, GameAnswer, GameMode, GameSession, UserSettings } from '@/types/db'
import { loadSubject, SUBJECTS, subjectMeta } from './catalog'
import { levelFromXp } from './engine/rules'
import { ACHIEVEMENTS, claimSource, computeMetric, currentStreak, longestStreak, missionsFor, type MetricData, type RewardRule } from './engine/rewards'
import type { SubjectContent } from './types'

export const GAME_TABLES = ['game_sessions', 'game_answers', 'game_rewards', 'game_purchases'] as const

export const DEFAULT_GAME_SETTINGS: EvoQuestSettings = {
  links: {},
  registerTime: true,
  dailyMinutes: 15,
  sound: true,
  avatar: null,
  title: null,
  reducedMotion: false,
}

export const gameSettings = (s: UserSettings): EvoQuestSettings => ({ ...DEFAULT_GAME_SETTINGS, ...(s.evoquest ?? {}), links: { ...(s.evoquest?.links ?? {}) } })

export function useGameSettings() {
  const settings = useSettings()
  const update = useUpdateSettings()
  const game = gameSettings(settings)
  return {
    game,
    settings,
    save: (patch: Partial<EvoQuestSettings>) => update.mutateAsync({ evoquest: { ...game, ...patch } }),
    saving: update.isPending,
  }
}

/** Conteúdo de uma disciplina (carregado sob demanda e mantido em cache). */
export function useSubjectContent(id: string | null | undefined) {
  return useQuery({
    queryKey: ['game-content', id],
    queryFn: () => loadSubject(id!),
    enabled: Boolean(id && subjectMeta(id)),
    staleTime: Infinity,
  })
}

export function useAllContent() {
  return useQuery({
    queryKey: ['game-content', 'all'],
    queryFn: () => Promise.all(SUBJECTS.map((s) => loadSubject(s.id))),
    staleTime: Infinity,
  })
}

/** Todos os dados do jogador (respostas, partidas, livro-razão e compras). */
export function useGameData() {
  const answers = useAll('game_answers')
  const sessions = useAll('game_sessions')
  const rewards = useAll('game_rewards')
  const purchases = useAll('game_purchases')
  const queries = [answers, sessions, rewards, purchases]
  return {
    isPending: queries.some((q) => q.isPending),
    isError: queries.some((q) => q.isError),
    error: queries.find((q) => q.error)?.error,
    refetch: () => queries.forEach((q) => q.refetch()),
    answers: answers.data ?? [],
    sessions: sessions.data ?? [],
    rewards: rewards.data ?? [],
    purchases: purchases.data ?? [],
  }
}

export interface PlayerSummary {
  xp: number
  coins: number
  level: ReturnType<typeof levelFromXp>
  activeDays: string[]
  streak: number
  bestStreak: number
  todayMinutes: number
  todayAnswers: number
  owned: Set<string>
  claimed: Set<string>
}

export function summarize(data: ReturnType<typeof useGameData>, tz: string): PlayerSummary {
  const xp = data.rewards.reduce((s, r) => s + r.xp, 0)
  const coins = data.rewards.reduce((s, r) => s + r.coins, 0)
  const days = data.answers.map((a) => dayKey(new Date(a.answered_at).getTime(), tz))
  const today = todayKey(tz)
  const from = zonedDayStart(today, tz)
  const todaySessions = data.sessions.filter((s) => s.status !== 'active' && s.finished_at && new Date(s.finished_at).getTime() >= from)
  return {
    xp,
    coins,
    level: levelFromXp(xp),
    activeDays: [...new Set(days)],
    streak: currentStreak(days, today),
    bestStreak: longestStreak(days),
    todayMinutes: Math.floor(todaySessions.reduce((s, x) => s + x.active_seconds, 0) / 60),
    todayAnswers: days.filter((d) => d === today).length,
    owned: new Set(data.purchases.map((p) => p.item_id)),
    claimed: new Set(data.rewards.filter((r) => r.source.startsWith('claim:')).map((r) => r.source)),
  }
}

export function metricData(data: ReturnType<typeof useGameData>, contents: SubjectContent[]): MetricData {
  const all = contents.flatMap((c) => c.units.flatMap((u) => u.challenges))
  return {
    answers: data.answers,
    sessions: data.sessions,
    bossIds: new Set(all.filter((c) => c.boss).map((c) => c.id)),
    labIds: new Set(all.filter((c) => c.type === 'sql' || c.type === 'python').map((c) => c.id)),
  }
}

export interface MissionView {
  rule: RewardRule
  period: string | null
  param: string | null
  progress: number
  done: boolean
  claimed: boolean
  source: string
}

export function missionViews(data: ReturnType<typeof useGameData>, contents: SubjectContent[], tz: string, claimed: Set<string>): { daily: MissionView[]; weekly: MissionView[]; achievements: MissionView[] } {
  const md = metricData(data, contents)
  const today = todayKey(tz)
  const played = [...new Set(data.answers.map((a) => a.subject_id))].sort()
  const view = (rule: RewardRule, period: string | null, param: string | null): MissionView => {
    const range = period ? { from: zonedDayStart(period, tz), to: zonedDayStart(addDays(period, rule.kind === 'weekly' ? 7 : 1), tz) } : null
    const progress = computeMetric(rule.metric, param, md, range, tz)
    const source = claimSource(rule, period, param)
    return { rule, period, param, progress, done: progress >= rule.target, claimed: claimed.has(source), source }
  }
  const missions = missionsFor(today, played.length ? played : SUBJECTS.map((s) => s.id))
  return {
    daily: missions.filter((m) => m.rule.kind === 'daily').map((m) => view(m.rule, m.period, m.param)),
    weekly: missions.filter((m) => m.rule.kind === 'weekly').map((m) => view(m.rule, m.period, m.param)),
    achievements: ACHIEVEMENTS.map((r) => view(r, null, null)),
  }
}

export const weekKey = (tz: string) => startOfWeek(todayKey(tz))

// ── Mutações ─────────────────────────────────────────────────────────────
export function useGameMutation<A, R>(fn: (backend: DataBackend, args: A) => Promise<R>, tables: string[] = [...GAME_TABLES]) {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: A) => fn(backend, args),
    onSettled: () => invalidateTables(qc, tables),
  })
}

export async function startGame(backend: DataBackend, input: { subjectId: string; unitId: string | null; mode: GameMode; queue: string[]; plannedSeconds: number | null }): Promise<GameSession> {
  return backend.gameStart({ id: crypto.randomUUID(), ...input })
}

export const submitAnswer = (backend: DataBackend, input: GameAnswerInput) => backend.gameAnswer(input)

/**
 * Encerra a partida. Se configurado, registra o tempo ativo como sessão de
 * estudo (atividade "questões") na matéria vinculada. Regra única contra
 * contagem dupla: se já houver uma sessão no mesmo intervalo (ex.: o
 * cronômetro estava rodando), o tempo NÃO é registrado de novo.
 */
export async function finishGame(
  backend: DataBackend,
  input: { session: GameSession; activeSeconds: number; status: 'finished' | 'abandoned'; settings: EvoQuestSettings },
): Promise<{ session: GameSession; time: 'registered' | 'skipped-overlap' | 'skipped-short' | 'disabled' }> {
  const { session, settings } = input
  let studyId: string | null = null
  let time: 'registered' | 'skipped-overlap' | 'skipped-short' | 'disabled' = 'disabled'
  const minutes = Math.floor(input.activeSeconds / 60)
  if (settings.registerTime && input.status === 'finished') {
    if (minutes < 1) time = 'skipped-short'
    else {
      try {
        const meta = subjectMeta(session.subject_id)
        const row = await addManualSession(backend, {
          subject_id: settings.links[session.subject_id] ?? null,
          topic_id: null,
          activity_type: 'questions',
          started_at: Date.now() - minutes * 60_000,
          duration_minutes: minutes,
          notes: `EvoQuest — ${meta?.name ?? session.subject_id} (${MODE_LABELS[session.mode]})`,
        })
        studyId = row.id
        time = 'registered'
      } catch (e) {
        if (e instanceof DataError && e.code === 'validation') time = 'skipped-overlap'
        else throw e
      }
    }
  }
  const finished = await backend.gameFinish({ sessionId: session.id, activeSeconds: input.activeSeconds, status: input.status, studySessionId: studyId })
  return { session: finished, time }
}

export const MODE_LABELS: Record<GameMode, string> = {
  quick: 'Partida rápida',
  trail: 'Trilha',
  review: 'Revisão inteligente',
  time_attack: 'Contra o relógio',
  boss: 'Desafio do chefe',
  lab: 'Laboratório',
  cards: 'Flashcards',
}

/** Partidas não encerradas que ainda podem ser retomadas. */
export function resumable(sessions: GameSession[], answers: GameAnswer[]) {
  return sessions
    .filter((s) => s.status === 'active' && s.queue.length > 0)
    .map((s) => {
      const done = answers.filter((a) => a.session_id === s.id).map((a) => a.challenge_id)
      const left = s.queue.filter((id) => !done.includes(id))
      return { session: s, left: left.length, done: done.length }
    })
    // Partidas abertas e abandonadas sem nenhuma resposta não poluem a lista.
    .filter((r) => r.done > 0 && r.left > 0)
    .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at))
}

export function useMemoSummary(data: ReturnType<typeof useGameData>, tz: string) {
  return useMemo(() => summarize(data, tz), [data.answers, data.rewards, data.sessions, data.purchases, tz]) // eslint-disable-line react-hooks/exhaustive-deps
}
