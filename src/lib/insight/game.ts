// Liga respostas do EvoQuest a tópicos do Control: a disciplina do jogo
// precisa corresponder à matéria (vínculo em Perfil do EvoQuest ou nome
// parecido) e o nome do tópico do jogo precisa casar com o do tópico.
import { relatedGameSubject } from '@/features/explorer/insights'
import type { GameAnswer, Subject, Topic } from '@/types/db'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sameTopic = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)))

export interface GameTopicCatalog {
  /** Disciplina do jogo → tópicos (id do jogo → nome). */
  [gameSubject: string]: Array<{ id: string; name: string }>
}

export function gameEvidenceByTopic(
  answers: Array<Pick<GameAnswer, 'subject_id' | 'topic' | 'correct' | 'answered_at'>>,
  catalog: GameTopicCatalog,
  topics: Topic[],
  subjects: Subject[],
  links: Record<string, string | null>,
): Map<string, { total: number; correct: number; lastAt: number | null }> {
  const out = new Map<string, { total: number; correct: number; lastAt: number | null }>()
  if (!answers.length) return out
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  // (disciplina do jogo, tópico do jogo) → tópicos do Control
  const target = new Map<string, string[]>()
  for (const t of topics) {
    if (t.kind === 'folder') continue
    const s = subjectById.get(t.subject_id)
    if (!s) continue
    const games = Object.keys(catalog).filter((g) => links[g] === s.id || relatedGameSubject(s.name, s.exam) === g || relatedGameSubject(t.name) === g)
    const name = fold(t.name)
    for (const g of games)
      for (const gt of catalog[g])
        if (sameTopic(name, fold(gt.name))) {
          const k = `${g}|${gt.id}`
          target.set(k, [...(target.get(k) ?? []), t.id])
        }
  }
  for (const a of answers) {
    for (const topicId of target.get(`${a.subject_id}|${a.topic}`) ?? []) {
      const cur = out.get(topicId) ?? { total: 0, correct: 0, lastAt: null }
      const at = Date.parse(a.answered_at)
      out.set(topicId, { total: cur.total + 1, correct: cur.correct + (a.correct ? 1 : 0), lastAt: cur.lastAt == null || at > cur.lastAt ? at : cur.lastAt })
    }
  }
  return out
}
