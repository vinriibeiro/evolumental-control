// Gera o catálogo do servidor a partir do conteúdo: etapas de missão
// (game_quest_steps) e passagens da Rodoviária (game_shop_items, kind
// 'ticket'). O teste de catálogo garante que a migração está sincronizada.
import { WORLD } from './content'
import { CITIES, ticketId } from './content/cities'
import { EXPECTED } from './content/expected'
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

/** Bloco entre `-- <catalogo>` e `-- </catalogo>` da migração mais recente do mundo. */
export const worldCatalogSql = () => `${questCatalogSql()}\n\n${ticketCatalogSql()}`

/** Migração que guarda o catálogo atual (as anteriores ficam como histórico). */
export const WORLD_CATALOG_MIGRATION = '20261024000000_evoquest_rodoviaria.sql'
