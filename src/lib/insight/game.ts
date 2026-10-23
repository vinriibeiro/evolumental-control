// Liga respostas do EvoQuest a tópicos do Control: a disciplina do jogo
// precisa corresponder à matéria (vínculo em Perfil do EvoQuest ou nome
// parecido) e o nome do tópico do jogo precisa casar com o do tópico.
//
// Evidências do mundo (game_evidence) entram com PESO: o estágio pedagógico
// define quantas "questões equivalentes" a atividade vale e o nível de ajuda
// reduz o crédito do acerto (ver engine/pedagogy). XP não entra aqui.
import { relatedGameSubject } from '@/features/explorer/insights'
import { evidenceCredit, type HelpLevel } from '@/features/evoquest/engine/pedagogy'
import type { GameAnswer, GameEvidence, Subject, Topic } from '@/types/db'

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

/** Resposta do jogo com peso: `correct` pode ser fracionário (crédito parcial). */
export interface WeightedGameAnswer {
  subject_id: string
  topic: string
  answered_at: string
  correct: boolean | number
  /** Questões equivalentes (padrão 1). */
  weight?: number
}

/** Converte evidências do mundo em respostas ponderadas (estágio × ajuda). */
export function worldEvidenceAnswers(rows: Array<Pick<GameEvidence, 'subject' | 'concept' | 'stage' | 'help_level' | 'solved' | 'created_at'>>): WeightedGameAnswer[] {
  return rows.map((r) => {
    const c = evidenceCredit(r.stage, Math.min(4, Math.max(0, r.help_level)) as HelpLevel, r.solved)
    return { subject_id: r.subject, topic: r.concept, answered_at: r.created_at, correct: c.correct, weight: c.weight }
  })
}

export function gameEvidenceByTopic(
  answers: Array<Pick<GameAnswer, 'subject_id' | 'topic' | 'correct' | 'answered_at'> | WeightedGameAnswer>,
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
      const weight = ('weight' in a && a.weight) || 1
      const correct = typeof a.correct === 'number' ? a.correct : a.correct ? weight : 0
      out.set(topicId, { total: cur.total + weight, correct: cur.correct + correct, lastAt: cur.lastAt == null || at > cur.lastAt ? at : cur.lastAt })
    }
  }
  return out
}
