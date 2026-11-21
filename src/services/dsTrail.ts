// Trilha de Ciência de Dados: ativa/atualiza os cinco pilares no estudo do usuário SEM duplicar nada.
//
// Identificação: cada pilar (matéria) e cada tópico tem uma chave estável (`trail_key`). Ao sincronizar:
//   1. o que já tem a chave fica como está (progresso, anotações e ordem preservados);
//   2. o que existe com o mesmo nome e ainda sem chave é ADOTADO (ganha a chave; nada é recriado);
//   3. só o que realmente falta é criado.
// Rodar de novo não muda nada — é assim que novos tópicos do conteúdo chegam a quem já usa a trilha.
import { DS_TRACKS } from '@/content/dsTrail'
import type { TrackDef } from '@/content/dsTypes'
import { eq, inList, type DataBackend } from '@/lib/data/types'
import { addDays, type DayKey } from '@/lib/time'
import type { Assessment, Insert, Subject, Topic } from '@/types/db'
import type { DiagnosticScore } from '@/lib/trail'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

export interface SyncResult {
  subjectsCreated: number
  subjectsAdopted: number
  topicsCreated: number
  topicsAdopted: number
}

const priorityFor = (share: number) => (share >= 30 ? 5 : share >= 20 ? 4 : share >= 10 ? 3 : 2)

export async function syncDsTrail(backend: DataBackend, opts: { weeklyMinutes: number; tracks?: TrackDef[] }): Promise<SyncResult> {
  const tracks = opts.tracks ?? DS_TRACKS
  const result: SyncResult = { subjectsCreated: 0, subjectsAdopted: 0, topicsCreated: 0, topicsAdopted: 0 }
  const { rows: subjects } = await backend.list('subjects')
  let nextOrder = subjects.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
  const subjectFor = new Map<string, Pick<Subject, 'id'>>()
  const freshSubjects: Array<Insert<'subjects'> & { id: string }> = []

  for (const track of tracks) {
    const found = subjects.find((s) => s.trail_key === track.trailKey) ?? subjects.find((s) => !s.trail_key && norm(s.name) === norm(track.name))
    if (found) {
      if (!found.trail_key) {
        await backend.update('subjects', [eq('id', found.id)], { trail_key: track.trailKey, ...(found.status === 'archived' ? { status: 'active' as const, archived_at: null } : {}) })
        result.subjectsAdopted++
      }
      subjectFor.set(track.key, found)
      continue
    }
    const id = crypto.randomUUID()
    freshSubjects.push({
      id,
      name: track.name,
      description: track.summary,
      color: '#171717',
      difficulty: 3,
      priority: priorityFor(track.share),
      // participação do pilar na meta semanal (SQL 30%, Python 30%, ML 25%, Inglês 10%, Power BI 5%)
      weekly_goal_hours: Math.max(0.5, Math.round((opts.weeklyMinutes / 60) * (track.share / 100) * 2) / 2),
      status: 'active',
      sort_order: nextOrder++,
      trail_key: track.trailKey,
    })
    subjectFor.set(track.key, { id })
  }
  if (freshSubjects.length) {
    await backend.insert('subjects', freshSubjects)
    result.subjectsCreated = freshSubjects.length
  }

  const subjectIds = [...subjectFor.values()].map((s) => s.id)
  const { rows: topics } = await backend.list('topics', { filters: [inList('subject_id', subjectIds)] })
  // a chave é única por usuário: procura também fora das matérias da trilha (tópico movido pelo usuário)
  const { rows: keyed } = await backend.list('topics', { filters: [inList('trail_key', tracks.flatMap((t) => t.topics.map((x) => x.key)))] })
  const haveKey = new Set([...topics, ...keyed].map((t) => t.trail_key).filter(Boolean))
  const freshTopics: Insert<'topics'>[] = []
  for (const track of tracks) {
    const subjectId = subjectFor.get(track.key)!.id
    const own = topics.filter((t) => t.subject_id === subjectId)
    let order = own.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
    for (const def of track.topics) {
      if (haveKey.has(def.key)) continue
      const twin: Topic | undefined = own.find((t) => !t.trail_key && t.parent_id == null && norm(t.name) === norm(def.title))
      if (twin) {
        await backend.update('topics', [eq('id', twin.id)], { trail_key: def.key, ...(twin.estimated_minutes == null ? { estimated_minutes: def.minutes } : {}) })
        twin.trail_key = def.key
        result.topicsAdopted++
      } else {
        freshTopics.push({ subject_id: subjectId, name: def.title, description: def.objective, sort_order: order++, estimated_minutes: def.minutes, trail_key: def.key })
      }
      haveKey.add(def.key)
    }
  }
  for (let i = 0; i < freshTopics.length; i += 500) await backend.insert('topics', freshTopics.slice(i, i + 500))
  result.topicsCreated = freshTopics.length
  return result
}

/** Falta alguma coisa do conteúdo atual no banco? (trilha nunca ativada, ou conteúdo novo desde a última vez) */
export function missingTrailKeys(subjects: Pick<Subject, 'trail_key'>[], topics: Pick<Topic, 'trail_key'>[], tracks: TrackDef[] = DS_TRACKS): { subjects: number; topics: number } {
  const s = new Set(subjects.map((x) => x.trail_key))
  const t = new Set(topics.map((x) => x.trail_key))
  return { subjects: tracks.filter((x) => !s.has(x.trailKey)).length, topics: tracks.flatMap((x) => x.topics).filter((x) => !t.has(x.key)).length }
}

/** Revisões automáticas do tópico concluído, sem repetir datas que já têm revisão planejada. */
export async function scheduleTopicReviews(backend: DataBackend, topic: Pick<Topic, 'id' | 'name' | 'subject_id'>, intervals: number[], today: DayKey): Promise<number> {
  if (!intervals.length) return 0
  const { rows: existing } = await backend.list('reviews', { filters: [eq('topic_id', topic.id), eq('status', 'planned')] })
  const taken = new Set(existing.map((r) => r.scheduled_for))
  const rows = [...new Set(intervals)]
    .map((d) => addDays(today, d))
    .filter((d) => !taken.has(d))
    .map((d) => ({ subject_id: topic.subject_id, topic_id: topic.id, title: `Revisar: ${topic.name}`, scheduled_for: d, origin: 'auto' as const }))
  if (rows.length) await backend.insert('reviews', rows)
  return rows.length
}

/**
 * Desafio do laboratório verificado = um exercício resolvido, lançado nos registros de exercícios (question_records)
 * com a origem `lab:<id>`. O mesmo desafio só é lançado uma vez. Devolve true se criou o registro.
 */
export async function recordLabExercise(backend: DataBackend, challenge: { id: string; track: string; title: string }, today: DayKey): Promise<boolean> {
  const source = `lab:${challenge.id}`
  const { rows: existing } = await backend.list('question_records', { filters: [eq('source', source)], limit: 1 })
  if (existing.length) return false
  const { rows: subjects } = await backend.list('subjects', { filters: [eq('trail_key', `ds.${challenge.track}`)], limit: 1 })
  await backend.insert('question_records', [{ date: today, total: 1, correct: 1, wrong: 0, source, subject_id: subjects[0]?.id ?? null, notes: `Laboratório: ${challenge.title}`.slice(0, 4000) }])
  return true
}

/** Grava o resultado do diagnóstico como um registro NOVO (o histórico nunca é sobrescrito). */
export async function saveAssessment(backend: DataBackend, track: string, score: DiagnosticScore): Promise<Assessment> {
  const [row] = await backend.insert('assessments', [{ track, taken_at: new Date().toISOString(), answers: score.answers, topics: score.topics, total: score.total, correct: score.correct, start_key: score.start_key }])
  return row
}

/**
 * Leva o resultado para a trilha: tópicos demonstrados ganham a marca "demonstrado em avaliação".
 * Só acrescenta evidência — nunca rebaixa um tópico concluído nem apaga o que o usuário declarou em outros tópicos.
 */
export async function applyAssessment(backend: DataBackend, score: Pick<DiagnosticScore, 'topics'>): Promise<number> {
  const keys = score.topics.filter((t) => t.outcome === 'demonstrated').map((t) => t.topic_key)
  if (!keys.length) return 0
  const updated = await backend.update('topics', [inList('trail_key', keys)], { knowledge: 'demonstrated' })
  return updated.length
}
