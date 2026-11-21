// Estado da trilha de Ciência de Dados para as telas: matérias/tópicos instalados (pelas chaves estáveis),
// estado de cada tópico e sincronização silenciosa quando o conteúdo ganha tópicos novos.
import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { DS_TRACKS } from '@/content/dsTrail'
import type { TrackDef, TrailTopicDef } from '@/content/dsTypes'
import { invalidateTables, useAll, useTransaction } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { inList, notNull } from '@/lib/data/types'
import { nextTopic, satisfiedKeys, topicState, trackProgress, type TopicState, type TrackProgress } from '@/lib/trail'
import { missingTrailKeys, syncDsTrail } from '@/services/dsTrail'
import type { Assessment, Review, Subject, Topic } from '@/types/db'

export interface TrackView {
  def: TrackDef
  subject: Subject | undefined
  progress: TrackProgress
  next: TrailTopicDef | null
  lastAssessment: Assessment | undefined
}

export function useDsTrail() {
  const backend = useBackend()
  const qc = useQueryClient()
  const settings = useSettings()
  const subjects = useAll('subjects', { filters: [notNull('trail_key')] })
  const topics = useAll('topics', { filters: [notNull('trail_key')] })
  const assessments = useAll('assessments', { order: [{ column: 'taken_at', ascending: false }] })
  const topicIds = useMemo(() => (topics.data ?? []).map((t) => t.id), [topics.data])
  const reviews = useAll('reviews', { filters: [inList('topic_id', topicIds), inList('status', ['planned', 'postponed'])] }, { enabled: topicIds.length > 0 })

  const install = useTransaction(['subjects', 'topics'], (b, _: void) => syncDsTrail(b, { weeklyMinutes: settings.weeklyGoalMinutes }))

  const loaded = subjects.isSuccess && topics.isSuccess
  const missing = useMemo(() => (loaded ? missingTrailKeys(subjects.data ?? [], topics.data ?? []) : null), [loaded, subjects.data, topics.data])
  const installed = loaded && (subjects.data ?? []).some((s) => DS_TRACKS.some((t) => t.trailKey === s.trail_key))

  // Trilha já ativada e o conteúdo ganhou algo novo: completa em silêncio (idempotente), uma vez por carregamento.
  const synced = useRef(false)
  useEffect(() => {
    if (!installed || !missing || synced.current || (missing.subjects === 0 && missing.topics === 0)) return
    synced.current = true
    syncDsTrail(backend, { weeklyMinutes: settings.weeklyGoalMinutes })
      .then(() => invalidateTables(qc, ['subjects', 'topics']))
      .catch(() => {})
  }, [installed, missing, backend, qc, settings.weeklyGoalMinutes])

  const rowByKey = useMemo(() => new Map<string, Topic>((topics.data ?? []).map((t) => [t.trail_key!, t])), [topics.data])
  const satisfied = useMemo(() => satisfiedKeys(topics.data ?? []), [topics.data])
  const nextReview = useMemo(() => {
    const m = new Map<string, Review>()
    for (const r of reviews.data ?? []) {
      if (!r.topic_id) continue
      const cur = m.get(r.topic_id)
      if (!cur || r.scheduled_for < cur.scheduled_for) m.set(r.topic_id, r)
    }
    return m
  }, [reviews.data])

  const tracks = useMemo<TrackView[]>(
    () =>
      DS_TRACKS.map((def) => ({
        def,
        subject: (subjects.data ?? []).find((s) => s.trail_key === def.trailKey),
        progress: trackProgress(def, rowByKey, satisfied),
        next: nextTopic(def, rowByKey, satisfied),
        lastAssessment: (assessments.data ?? []).find((a) => a.track === def.key),
      })),
    [subjects.data, rowByKey, satisfied, assessments.data],
  )

  const stateOf = (def: TrailTopicDef): TopicState => topicState(def, rowByKey.get(def.key), satisfied)

  return {
    loading: subjects.isPending || topics.isPending,
    error: subjects.isError ? subjects.error : topics.isError ? topics.error : null,
    refetch: () => (void subjects.refetch(), void topics.refetch()),
    installed,
    install,
    tracks,
    rowByKey,
    stateOf,
    nextReview,
    assessments: assessments.data ?? [],
  }
}
