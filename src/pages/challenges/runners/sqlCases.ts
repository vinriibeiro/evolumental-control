import type { Challenge } from '../catalog'

const extraPeople = `
DELETE FROM pessoas WHERE id=1;
INSERT INTO pessoas VALUES (6,'Adriana',35,'Belém'),(7,'Ana',44,'Curitiba'),(8,'Zeca',35,'Manaus');
`
const extraProducts = `
UPDATE produtos SET estoque=2 WHERE id=3;
INSERT INTO produtos VALUES (6,'Cabo','Informática',1200,10),(7,'Caneca','Cozinha',2000,0),(8,'Suporte','Informática',900,0);
`
const extraOrders = `
INSERT INTO clientes VALUES (7,'Elaine'),(8,'Felipe'),(9,'Gustavo'),(10,'Helena');
INSERT INTO pedidos VALUES
(7,7,999999,'cancelado','2026-01-03'),(8,1,9000,'pago','2026-01-03'),
(9,8,23000,'pago','2026-03-05'),(10,8,2000,'pago','2026-03-05'),(11,9,1000,'pago','2026-01-02'),
(12,9,90000,'cancelado','2026-03-08');
`
const extraTeam = `
INSERT INTO equipe VALUES (6,'Fábio',NULL),(7,'Gabi',6),(8,'Hugo',5),(9,'Iara',1),(10,'Julia',9);
`

export function sqlSetup(challenge: Challenge) {
  const start = challenge.prompt.indexOf('CREATE TABLE')
  const end = challenge.prompt.indexOf('\n\nTarefa', start)
  if (start < 0 || end < 0) throw new Error('A preparação SQLite deste desafio está indisponível.')
  return challenge.prompt.slice(start, end)
}

export function sqlVariant(id: string): string {
  if (id.startsWith('sql-first_steps-')) return extraPeople
  if (id === 'sql-advanced-5') return 'UPDATE produtos SET estoque=1 WHERE id=1;'
  if (id.startsWith('sql-basic-')) return extraProducts
  if (id === 'sql-advanced-4') return extraTeam
  return extraOrders
}
