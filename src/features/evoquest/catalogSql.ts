// Gera o catálogo do servidor a partir do conteúdo: etapas de missão
// (game_quest_steps), passagens da Rodoviária (game_shop_items, kind
// 'ticket') e atividades pedagógicas (game_activities, evidência de domínio).
// O teste de catálogo garante que a migração está sincronizada.
import { isPedagogic } from './challenges'
import { WORLD } from './content'
import { CITIES, ticketId } from './content/cities'
import { EXPECTED } from './content/expected'
import { FIELD_TEMPLATES } from './content/fieldReview'
import { stepKey } from './engine/state'

const q = (v: string | null) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`)

export function questCatalogRows() {
  const rows: Array<{ key: string; quest: string; position: number; requires: string | null; xp: number; coins: number; hash: string | null; answer: string | null }> = []
  for (const quest of Object.values(WORLD.quests)) {
    quest.steps.forEach((s, i) => {
      const key = stepKey(quest.id, s.id)
      // Terminais, puzzles e combates: o servidor confere o hash da resposta.
      const challenge = s.objective.type === 'solve' ? s.objective.challenge : null
      rows.push({
        key,
        quest: quest.id,
        position: i,
        requires: i > 0 ? stepKey(quest.id, quest.steps[i - 1].id) : null,
        xp: WORLD.rewards[key].xp,
        coins: WORLD.rewards[key].coins,
        hash: challenge ? (EXPECTED[challenge]?.hash ?? null) : null,
        // Chefes do modo clássico: o servidor procura o acerto em game_answers.
        answer: s.objective.type === 'answered' ? s.objective.challenge : null,
      })
    })
  }
  return rows
}

export function questCatalogSql(): string {
  const values = questCatalogRows()
    .map((r) => `  (${q(r.key)}, ${q(r.quest)}, ${r.position}, ${q(r.requires)}, ${r.xp}, ${r.coins}, ${q(r.hash)}, ${q(r.answer)})`)
    .join(',\n')
  return `insert into public.game_quest_steps (key, quest_id, position, requires, xp, coins, check_hash, require_answer) values\n${values}\non conflict (key) do update set quest_id = excluded.quest_id, position = excluded.position, requires = excluded.requires, xp = excluded.xp, coins = excluded.coins, check_hash = excluded.check_hash, require_answer = excluded.require_answer;`
}

export function ticketCatalogSql(): string {
  const values = CITIES.map((c) => `  (${q(ticketId(c.id))}, 'ticket', ${q(`Passagem para ${c.name}`)}, ${c.price})`).join(',\n')
  return `insert into public.game_shop_items (id, kind, name, price) values\n${values}\non conflict (id) do update set kind = excluded.kind, name = excluded.name, price = excluded.price;`
}

/**
 * Atividades que geram evidência de domínio: desafios do mundo com estágio
 * pedagógico (hash fixo) e modelos parametrizados (sem gabarito fixo).
 */
export function activityCatalogRows() {
  const rows: Array<{ id: string; subject: string; concept: string; stage: string; hash: string | null; parametric: boolean; dailyLimit: number }> = []
  for (const ch of Object.values(WORLD.challenges)) {
    if (!isPedagogic(ch) || !ch.stage || !ch.concept) continue
    const lesson = ch.lesson ? WORLD.lessons[ch.lesson] : null
    rows.push({ id: ch.id, subject: lesson?.subject ?? (ch.kind === 'python' ? 'python' : 'sql'), concept: ch.concept, stage: ch.stage, hash: EXPECTED[ch.id]?.hash ?? null, parametric: false, dailyLimit: 20 })
  }
  for (const t of FIELD_TEMPLATES) rows.push({ id: t.id, subject: t.subject, concept: t.concept, stage: t.stage, hash: null, parametric: true, dailyLimit: t.dailyLimit })
  return rows
}

export function activityCatalogSql(): string {
  const values = activityCatalogRows()
    .map((r) => `  (${q(r.id)}, ${q(r.subject)}, ${q(r.concept)}, ${q(r.stage)}, ${q(r.hash)}, ${r.parametric}, ${r.dailyLimit})`)
    .join(',\n')
  return `insert into public.game_activities (id, subject, concept, stage, check_hash, parametric, daily_limit) values\n${values}\non conflict (id) do update set subject = excluded.subject, concept = excluded.concept, stage = excluded.stage, check_hash = excluded.check_hash, parametric = excluded.parametric, daily_limit = excluded.daily_limit, updated_at = now();`
}

/** Bloco entre `-- <catalogo>` e `-- </catalogo>` da migração mais recente do mundo. */
export const worldCatalogSql = () => `${questCatalogSql()}\n\n${ticketCatalogSql()}\n\n${activityCatalogSql()}`

/** Migração que guarda o catálogo atual (as anteriores ficam como histórico). */
export const WORLD_CATALOG_MIGRATION = '20261029000100_evoquest_cidade_ingles.sql'
