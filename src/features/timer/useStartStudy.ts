// "Iniciar estudo" em qualquer lugar do app (trilha, livro, PDF, exercício, tarefa, projeto).
// O conteúdo de origem vai junto com a sessão, então o cronômetro já sabe o que está sendo estudado.
// Só existe UMA sessão em andamento: se já houver uma, ela é reaberta em vez de criar outra.
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { useSettings } from '@/hooks/useSettings'
import type { ActivityType, SessionSource } from '@/types/db'
import type { SessionWithPauses } from '@/lib/data/types'
import { useLiveSession, useSessionActions } from './useLiveSession'

export interface StudyTarget {
  subject_id?: string | null
  topic_id?: string | null
  activity_type?: ActivityType
  source?: SessionSource | null
  task_id?: string | null
  plan_item_id?: string | null
  project_id?: string | null
  /** Duração planejada (min). Com `mode: 'countdown'` vira contagem regressiva. */
  minutes?: number | null
  mode?: 'stopwatch' | 'countdown' | 'pomodoro'
  /** 'room' (padrão) abre a Sala de Estudos; 'stay' mantém a tela atual (ex.: leitor de PDF), com o cronômetro compacto no topo. */
  after?: 'room' | 'stay'
}

export const ROOM_PATH = '/sala'

export function sameSource(a: SessionSource | null | undefined, b: SessionSource | null | undefined): boolean {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id)
}

/** A sessão em andamento é deste conteúdo? */
export function isLiveFor(live: SessionWithPauses | null | undefined, target: Pick<StudyTarget, 'source' | 'task_id' | 'plan_item_id'>): boolean {
  if (!live) return false
  if (target.source && sameSource(live.source, target.source)) return true
  if (target.task_id && live.task_id === target.task_id) return true
  if (target.plan_item_id && live.plan_item_id === target.plan_item_id) return true
  return false
}

export function useStartStudy() {
  const live = useLiveSession()
  const actions = useSessionActions()
  const settings = useSettings()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const start = useCallback(
    async (target: StudyTarget) => {
      const current = live.data ?? null
      if (current) {
        if (isLiveFor(current, target)) {
          if (target.after !== 'stay') navigate(ROOM_PATH)
          return current
        }
        const label = current.source?.label
        const open = await confirm({
          title: 'Já existe uma sessão em andamento',
          message: `${label ? `Você está estudando "${label}". ` : ''}Só uma sessão fica ativa por vez, para o tempo não ser contado em dobro. Finalize a sessão atual antes de começar outra.`,
          confirmLabel: 'Abrir a sessão atual',
        })
        if (open) navigate(ROOM_PATH)
        return null
      }
      try {
        const mode = target.mode ?? (target.minutes ? 'countdown' : 'stopwatch')
        const session = await actions.start({
          subject_id: target.subject_id ?? null,
          topic_id: target.topic_id ?? null,
          activity_type: target.activity_type ?? 'theory',
          mode,
          planned_minutes: target.minutes ?? null,
          pomodoro: mode === 'pomodoro' ? settings.pomodoro : undefined,
          plan_item_id: target.plan_item_id ?? null,
          task_id: target.task_id ?? null,
          project_id: target.project_id ?? null,
          source: target.source ?? null,
        })
        if (target.after !== 'stay') navigate(ROOM_PATH)
        else toast.success('Sessão iniciada. O cronômetro fica no topo da tela.')
        return session ?? null
      } catch (e) {
        actions.resetStartId()
        toast.error(e)
        return null
      }
    },
    [live.data, actions, settings.pomodoro, navigate, confirm, toast],
  )

  return { start, live: live.data ?? null, pending: actions.pending, isLiveFor: (t: Pick<StudyTarget, 'source' | 'task_id' | 'plan_item_id'>) => isLiveFor(live.data, t) }
}
