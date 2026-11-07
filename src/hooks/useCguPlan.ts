import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/auth'
import { useCourses } from '@/hooks/useCourses'
import { useSettings } from '@/hooks/useSettings'
import { type CguState, type ScoredBlock, type BlockScore, dayIndexFor, loadState, markDone, nextTask, pendingTasks, postpone, resolveLink, saveState, setScore, startTask, tasksForDay, undoDone } from '@/lib/cguPlan'
import type { CguTask } from '@/content/cguPlan'
import { todayKey } from '@/lib/time'

/** Trilha CGU da conta: estado persistido por usuário (localStorage), dia atual e abertura dos materiais nos players do app. */
export function useCguPlan() {
  const auth = useAuth()
  const scope = auth.mode === 'supabase' ? (auth.user?.id ?? 'anon') : 'local'
  const settings = useSettings()
  const today = todayKey(settings.timezone)
  const navigate = useNavigate()
  const courses = useCourses()
  const [state, setState] = useState<CguState>(() => loadState(scope))
  useEffect(() => setState(loadState(scope)), [scope])
  useEffect(() => saveState(scope, state), [scope, state])

  const day = dayIndexFor(today)
  const tasks = useMemo(() => tasksForDay(state, day), [state, day])
  const pending = useMemo(() => pendingTasks(state, day), [state, day])
  const next = useMemo(() => nextTask(state, day), [state, day])
  const catalog = useMemo(() => ({ views: courses.views, nodes: courses.nodes.data ?? [] }), [courses.views, courses.nodes.data])

  const resolve = useCallback((task: CguTask) => resolveLink(task.link, catalog), [catalog])
  const open = useCallback(
    (task: CguTask) => {
      setState((s) => startTask(s, task.id, today))
      const r = resolveLink(task.link, catalog)
      if (r.external) window.open(r.to, '_blank', 'noopener,noreferrer')
      else navigate(r.to)
    },
    [catalog, navigate, today],
  )

  return {
    scope,
    catalog,
    today,
    day,
    state,
    tasks,
    pending,
    next,
    catalogReady: !courses.isPending,
    resolve,
    open,
    complete: useCallback((task: CguTask) => setState((s) => markDone(s, task.id)), []),
    reopen: useCallback((task: CguTask) => setState((s) => undoDone(s, task.id)), []),
    postponeTo: useCallback((task: CguTask, toDay: number) => setState((s) => postpone(s, task.id, toDay)), []),
    score: useCallback((block: ScoredBlock, value: BlockScore) => setState((s) => setScore(s, block, value)), []),
  }
}
