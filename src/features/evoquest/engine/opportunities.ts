// Oportunidades no mundo: o que vale fazer agora, com o MOTIVO explícito.
// Regras determinísticas sobre as evidências (nada de IA): dificuldade
// recorrente vira oportunidade de recuperação, conceito parado há dias vira
// revisão espaçada, missão de aprendizagem liberada vira convite e o motor de
// próxima ação do Control (recommend) aponta onde praticar no mundo. Nunca
// cria revisão ou flashcard no Control sozinha — só aponta.
import type { Stage } from './pedagogy'

export interface EvidenceLike {
  concept: string
  stage: Stage
  help_level: number
  solved: boolean
  created_at: string
}

export interface Opportunity {
  id: string
  kind: 'recovery' | 'control' | 'spaced' | 'mission'
  title: string
  /** Por que esta oportunidade aparece (regra legível). */
  reason: string
  /** Onde fazer no mundo. */
  where: string
}

const DAY = 86_400_000

/**
 * @param concepts conceito → { nome, onde praticar }
 * @param missions missões de aprendizagem liberadas e ainda não concluídas
 */
export function worldOpportunities(
  rows: EvidenceLike[],
  concepts: Record<string, { name: string; where: string }>,
  missions: Array<{ id: string; title: string; where: string }>,
  now: number,
): Opportunity[] {
  const out: Opportunity[] = []
  for (const [concept, info] of Object.entries(concepts)) {
    const mine = rows.filter((r) => r.concept === concept).sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (!mine.length) continue
    // Dificuldade recorrente: 2+ registros difíceis (não resolvida ou 2+ pistas)
    // nos últimos 14 dias, sem um acerto independente limpo depois deles.
    const recent = mine.filter((r) => now - Date.parse(r.created_at) <= 14 * DAY)
    const hard = recent.filter((r) => !r.solved || r.help_level >= 2)
    const lastHard = hard[0]
    const cleanAfter = lastHard && recent.some((r) => r.solved && r.help_level <= 1 && r.stage !== 'guided' && r.created_at > lastHard.created_at)
    if (hard.length >= 2 && !cleanAfter) {
      out.push({
        id: `recovery:${concept}`,
        kind: 'recovery',
        title: `Recuperar ${info.name}`,
        reason: `${hard.length} atividades com dificuldade nos últimos 14 dias (não concluídas ou com 2+ pistas) e nenhum acerto independente depois.`,
        where: info.where,
      })
      continue
    }
    // Revisão espaçada: último acerto há 7+ dias.
    const lastSolved = mine.find((r) => r.solved)
    const days = lastSolved ? Math.floor((now - Date.parse(lastSolved.created_at)) / DAY) : null
    if (days != null && days >= 7)
      out.push({ id: `spaced:${concept}`, kind: 'spaced', title: `Revisar ${info.name}`, reason: `Último acerto há ${days} dias: uma revisão curta agora ajuda a não esquecer.`, where: info.where })
  }
  for (const m of missions) out.push({ id: `mission:${m.id}`, kind: 'mission', title: m.title, reason: 'Missão de aprendizagem liberada e ainda não concluída.', where: m.where })
  return sortOpportunities(out)
}

const ORDER: Record<Opportunity['kind'], number> = { recovery: 0, control: 1, spaced: 2, mission: 3 }
export const sortOpportunities = (list: Opportunity[]) => [...list].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])

/** Recomendação do Control (motor de próxima ação), só o que importa aqui. */
export interface ControlRec {
  topicId: string | null
  reasons: Array<{ label: string; points: number; info?: boolean }>
}

/**
 * Recomendações do Control cujo tópico corresponde a um conceito com missão
 * no mundo viram oportunidades, com os mesmos motivos do Control (os de maior
 * peso). Só conceitos com caminho liberado; no máximo `limit`, um por conceito.
 */
export function controlOpportunities(
  recs: ControlRec[],
  topicConcept: Map<string, string>,
  paths: Record<string, { name: string; where: string }>,
  limit = 2,
): Opportunity[] {
  const out: Opportunity[] = []
  for (const r of recs) {
    const concept = r.topicId ? topicConcept.get(r.topicId) : undefined
    const path = concept ? paths[concept] : undefined
    if (!concept || !path || out.some((o) => o.id === `control:${concept}`)) continue
    const top = r.reasons
      .filter((x) => !x.info && x.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map((x) => x.label.toLowerCase())
    out.push({
      id: `control:${concept}`,
      kind: 'control',
      title: `Praticar ${path.name}`,
      reason: `O Control recomenda este tópico agora${top.length ? `: ${top.join('; ')}` : ''}.`,
      where: path.where,
    })
    if (out.length >= limit) break
  }
  return out
}
