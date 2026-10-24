// Gera o SQL que publica o catálogo global no servidor (desafios, regras de
// recompensa e loja). Usado por `npm run game:catalog` e pelo teste que
// garante que a migração está sincronizada com o conteúdo.
import type { Challenge, SubjectContent } from './types'
import { ALL_RULES, SHOP } from './engine/rewards'

/**
 * Migração que publica o catálogo ATUAL. Ao mudar o conteúdo depois que uma
 * versão já foi aplicada, aponte para um arquivo novo (as anteriores ficam
 * como histórico; todas são idempotentes).
 */
export const CATALOG_MIGRATION = '20261029000000_evoquest_catalogo_ingles.sql'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Gabarito verificável no servidor (apenas tipos objetivos). */
export function answerKey(c: Challenge): Record<string, unknown> | null {
  switch (c.type) {
    case 'mcq':
    case 'listen':
      return { t: 'choice', v: c.answer }
    case 'tf':
      return { t: 'bool', v: c.answer }
    case 'find_error':
      return { t: 'index', v: c.answer }
    case 'numeric':
      return { t: 'num', v: c.answer, tol: c.tolerance ?? 1e-9 }
    default:
      return null
  }
}

export function buildCatalogSql(contents: SubjectContent[]): string {
  const rows = contents.flatMap((s) =>
    s.units.flatMap((u) =>
      u.challenges.map((c) => {
        const key = answerKey(c)
        return `  (${q(c.id)}, ${q(s.subjectId)}, ${q(u.id)}, ${q(c.type)}, ${c.difficulty}, ${c.v ?? 1}, ${c.boss ? 'true' : 'false'}, ${key ? `${q(JSON.stringify(key))}::jsonb` : 'null'})`
      }),
    ),
  )
  const rules = ALL_RULES.map((r) => `  (${q(r.key)}, ${q(r.kind)}, ${q(r.metric)}, ${r.target}, ${r.xp}, ${r.coins}, ${r.param ? 'true' : 'false'})`)
  const shop = SHOP.map((i) => `  (${q(i.id)}, ${q(i.kind)}, ${q(i.name)}, ${i.price})`)
  return `-- =====================================================================
-- EvoQuest — catálogo global (GERADO por \`npm run game:catalog\`; não edite à mão)
-- Idempotente: pode ser executado de novo sempre que o conteúdo mudar.
-- ${rows.length} desafios · ${rules.length} regras de recompensa · ${shop.length} itens da loja
-- =====================================================================

insert into public.game_challenge_catalog (id, subject_id, unit_id, type, difficulty, version, boss, answer_key) values
${rows.join(',\n')}
on conflict (id) do update set
  subject_id = excluded.subject_id, unit_id = excluded.unit_id, type = excluded.type,
  difficulty = excluded.difficulty, version = excluded.version, boss = excluded.boss,
  answer_key = excluded.answer_key, updated_at = now();

insert into public.game_reward_rules (key, kind, metric, target, xp, coins, param) values
${rules.join(',\n')}
on conflict (key) do update set
  kind = excluded.kind, metric = excluded.metric, target = excluded.target,
  xp = excluded.xp, coins = excluded.coins, param = excluded.param;

insert into public.game_shop_items (id, kind, name, price) values
${shop.join(',\n')}
on conflict (id) do update set kind = excluded.kind, name = excluded.name, price = excluded.price;
`
}
