// Regenera supabase/migrations/20261022000100_evoquest_catalog.sql a partir do
// conteúdo em src/game/content (via o teste de sincronia, em modo escrita).
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx', ['vitest', 'run', 'src/game/__tests__/content.test.ts', '-t', 'catálogo'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, UPDATE_CATALOG: '1' },
})
process.exit(r.status ?? 1)
