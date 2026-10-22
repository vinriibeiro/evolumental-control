// Gera o catálogo de etapas do servidor (game_quest_steps) a partir do
// conteúdo. O teste de catálogo garante que a migração está sincronizada.
import { WORLD } from './content'
import { EXPECTED } from './content/expected'
import { stepKey } from './engine/state'

const q = (v: string | null) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`)

export function questCatalogRows() {
  const rows: Array<{ key: string; quest: string; position: number; requires: string | null; xp: number; coins: number; hash: string | null }> = []
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
      })
    })
  }
  return rows
}

export function questCatalogSql(): string {
  const values = questCatalogRows()
    .map((r) => `  (${q(r.key)}, ${q(r.quest)}, ${r.position}, ${q(r.requires)}, ${r.xp}, ${r.coins}, ${q(r.hash)})`)
    .join(',\n')
  return `insert into public.game_quest_steps (key, quest_id, position, requires, xp, coins, check_hash) values\n${values}\non conflict (key) do update set quest_id = excluded.quest_id, position = excluded.position, requires = excluded.requires, xp = excluded.xp, coins = excluded.coins, check_hash = excluded.check_hash;`
}
