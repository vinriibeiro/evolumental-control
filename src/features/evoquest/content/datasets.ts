// Bancos de dados do mundo (SQLite). Cada terminal abre um banco NOVO em
// memória a partir deste SQL: nada do que o jogador executa persiste, então
// é seguro experimentar qualquer comando.

const EMPLOYEES = `
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, department TEXT, clearance INTEGER, status TEXT);
INSERT INTO employees VALUES
 (1, 'Maya Kort', 'Análise', 4, 'active'),
 (2, 'Brás Teles', 'Segurança', 5, 'active'),
 (3, 'José Pixel', 'Manutenção', 2, 'active'),
 (4, 'Renata Antunes', 'TI', 5, 'vacation'),
 (5, 'Caio Mendes', 'TI', 3, 'active'),
 (6, 'Lia Duarte', 'Financeiro', 4, 'inactive'),
 (7, 'Otto Reis', 'Segurança', 4, 'active'),
 (8, 'Nina Sato', 'Análise', 2, 'active'),
 (9, 'Paulo Viana', 'Financeiro', 5, 'active'),
 (10, 'Teo Lima', 'TI', 4, 'active');
`

const SECURITY = `${EMPLOYEES}
CREATE TABLE access_logs (id INTEGER PRIMARY KEY, employee_id INTEGER, action TEXT, target TEXT, day TEXT, hour INTEGER);
INSERT INTO access_logs VALUES
 (1, 1, 'SELECT', 'payroll', '2026-10-21', 9),
 (2, 2, 'LOGIN', 'door_a', '2026-10-21', 8),
 (3, 4, 'UPDATE', 'payroll', '2026-10-21', 23),
 (4, 5, 'UPDATE', 'contracts', '2026-10-21', 14),
 (5, 4, 'UPDATE', 'payroll', '2026-10-22', 2),
 (6, 10, 'SELECT', 'contracts', '2026-10-21', 21),
 (7, 3, 'LOGIN', 'door_b', '2026-10-21', 6),
 (8, 9, 'UPDATE', 'budget', '2026-10-21', 19),
 (9, 4, 'DELETE', 'audit', '2026-10-22', 3),
 (10, 7, 'LOGIN', 'door_a', '2026-10-21', 20),
 (11, 5, 'UPDATE', 'payroll', '2026-10-22', 18),
 (12, 1, 'UPDATE', 'reports', '2026-10-21', 10),
 (13, 4, 'UPDATE', 'contracts', '2026-10-22', 5),
 (14, 8, 'SELECT', 'reports', '2026-10-21', 7),
 (15, 2, 'UPDATE', 'badges', '2026-10-21', 7),
 (16, 6, 'LOGIN', 'door_c', '2026-10-20', 22);
CREATE TABLE badges (badge_id TEXT PRIMARY KEY, employee_id INTEGER, issued TEXT);
INSERT INTO badges VALUES
 ('B-01', 1, '2025-02-10'), ('B-02', 2, '2024-11-03'), ('B-03', 3, '2025-06-21'), ('B-04', 4, '2023-09-14'),
 ('B-05', 5, '2026-01-08'), ('B-06', 6, '2024-04-30'), ('B-07', 7, '2025-08-19'), ('B-08', 8, '2026-09-29');
CREATE TABLE badge_uses (id INTEGER PRIMARY KEY, badge_id TEXT, door TEXT, day TEXT);
INSERT INTO badge_uses VALUES
 (1, 'B-01', 'door_a', '2026-10-21'), (2, 'B-02', 'door_a', '2026-10-21'), (3, 'B-03', 'door_b', '2026-10-21'),
 (4, 'B-05', 'door_a', '2026-10-20'), (5, 'B-07', 'door_a', '2026-10-21'), (6, 'B-02', 'door_c', '2026-10-20'),
 (7, 'B-01', 'door_b', '2026-10-19'), (8, 'B-05', 'door_c', '2026-10-21');
`

const CAFE = `
CREATE TABLE coffee (id INTEGER PRIMARY KEY, day TEXT, shift TEXT, machine TEXT, cups INTEGER);
INSERT INTO coffee VALUES
 (1, '2026-10-16', 'manhã', 'subsolo', 14), (2, '2026-10-16', 'tarde', 'subsolo', 9), (3, '2026-10-16', 'manhã', 'saguão', 30),
 (4, '2026-10-17', 'manhã', 'subsolo', 11), (5, '2026-10-17', 'tarde', 'subsolo', 6), (6, '2026-10-17', 'noite', 'subsolo', 4),
 (7, '2026-10-17', 'manhã', 'saguão', 41), (8, '2026-10-20', 'manhã', 'subsolo', 18), (9, '2026-10-20', 'tarde', 'subsolo', 12),
 (10, '2026-10-20', 'manhã', 'saguão', 22), (11, '2026-10-21', 'manhã', 'subsolo', 10), (12, '2026-10-21', 'noite', 'subsolo', 19),
 (13, '2026-10-21', 'tarde', 'saguão', 25), (14, '2026-10-22', 'madrugada', 'subsolo', 7);
`

const SENTINEL = `
CREATE TABLE processes (pid INTEGER PRIMARY KEY, name TEXT, owner TEXT, cpu INTEGER);
INSERT INTO processes VALUES
 (1, 'init', 'system', 91), (88, 'vision', 'system', 34), (212, 'patrol', 'system', 27), (733, 'cache-sync', 'unknown', 12),
 (1024, 'alarm', 'security', 3), (2048, 'motor', 'system', 45), (4096, 'svc-maint', 'unknown', 97), (5120, 'logger', 'security', 8);
CREATE TABLE connections (id INTEGER PRIMARY KEY, source_ip TEXT, port INTEGER);
INSERT INTO connections VALUES
 (1, '10.0.1.20', 443), (2, '10.0.66.6', 8443), (3, '10.0.66.6', 8443), (4, '10.0.1.20', 8443), (5, '10.0.66.6', 8443),
 (6, '10.0.7.3', 5432), (7, '10.0.66.6', 8443), (8, '10.0.66.6', 8443), (9, '10.0.7.3', 8443), (10, '10.0.66.6', 8443),
 (11, '10.0.66.6', 22), (12, '10.0.1.20', 443), (13, '10.0.7.3', 8443), (14, '10.0.66.6', 8443), (15, '10.0.7.3', 8443);
`

const CORE_BASE = `${EMPLOYEES}
CREATE TABLE audit (id INTEGER PRIMARY KEY, actor TEXT, action TEXT, target TEXT, ts TEXT);
INSERT INTO audit VALUES
 (1, 'maya', 'SELECT', 'payroll', '2026-10-21 09:12'),
 (2, 'root', 'LOGIN', 'core', '2026-10-21 22:41'),
 (3, 'root', 'UPDATE', 'payroll', '2026-10-21 23:05'),
 (4, 'teo', 'SELECT', 'contracts', '2026-10-21 21:30'),
 (5, 'root', 'UPDATE', 'payroll', '2026-10-22 01:17'),
 (6, 'root', 'DISABLE', 'sentinel_rules', '2026-10-21 22:58'),
 (7, 'root', 'LOGIN', 'core', '2026-10-20 23:59'),
 (8, 'root', 'DELETE', 'access_logs', '2026-10-22 03:02'),
 (9, 'bras', 'LOGIN', 'door_a', '2026-10-22 07:55');
CREATE TABLE contracts (employee_id INTEGER PRIMARY KEY, salary INTEGER);
INSERT INTO contracts VALUES (1, 8200), (2, 9100), (3, 4300), (5, 6900), (7, 7600), (8, 5200), (9, 11800), (10, 7400);
CREATE TABLE payroll (id INTEGER PRIMARY KEY, employee_id INTEGER, amount INTEGER, origin TEXT);
INSERT INTO payroll VALUES
 (1, 1, 8200, 'rh'), (2, 2, 9100, 'rh'), (3, 3, 4300, 'rh'), (4, 5, 9900, 'rh'),
 (5, 7, 7600, 'rh'), (6, 8, 6400, 'rh'), (7, 9, 14800, 'rh'), (8, 10, 8900, 'rh');
`

// Durante a luta, ROOT injeta lançamentos fantasmas na folha.
const CORE_GHOSTS = `${CORE_BASE}
INSERT INTO payroll VALUES (9, 2, 3000, 'ghost'), (10, 9, 5000, 'ghost'), (11, 3, 2500, 'ghost');
`

const GUILD = `
CREATE TABLE missoes (id INTEGER PRIMARY KEY, titulo TEXT, regiao TEXT, status TEXT);
INSERT INTO missoes VALUES
 (1, 'A Ponte de Vidro', 'Templo da Lógica', 'em breve'),
 (2, 'O Servidor Fantasma', 'Cidade dos Dados', 'aberta'),
 (3, 'Primeiros Passos', 'Vila Evolumental', 'concluida'),
 (4, 'Sinais Perdidos', 'Torre dos Idiomas', 'em breve'),
 (5, 'O Drone Teimoso', 'Laboratório Aurora', 'em breve');
`

// ── Almoxarifado (missão de GROUP BY) ─────────────────────────────────────
const SUPPLY = `
CREATE TABLE fornecedores (id INTEGER PRIMARY KEY, nome TEXT, cidade TEXT);
INSERT INTO fornecedores VALUES
 (1, 'Ferragens Nobre', 'Vila Evolumental'),
 (2, 'Cabos & Cia', 'Cidade dos Dados'),
 (3, 'Placa Viva', 'Aurora'),
 (4, 'Lumen Peças', 'Babel');
CREATE TABLE entregas (id INTEGER PRIMARY KEY, fornecedor_id INTEGER, dia TEXT, itens INTEGER, status TEXT);
INSERT INTO entregas VALUES
 (1, 2, '2026-10-01', 20, 'ok'),
 (2, 1, '2026-10-01', 10, 'ok'),
 (3, 4, '2026-10-02', 8, 'atrasada'),
 (4, 3, '2026-10-02', 5, 'ok'),
 (5, 2, '2026-10-03', 15, 'atrasada'),
 (6, 1, '2026-10-04', 12, 'ok'),
 (7, 4, '2026-10-05', 8, 'ok'),
 (8, 2, '2026-10-06', 15, 'ok'),
 (9, 3, '2026-10-07', 5, 'avariada'),
 (10, 1, '2026-10-08', 8, 'atrasada'),
 (11, 2, '2026-10-09', 20, 'atrasada'),
 (12, 4, '2026-10-10', 8, 'ok'),
 (13, 3, '2026-10-11', 10, 'ok'),
 (14, 1, '2026-10-12', 10, 'ok'),
 (15, 2, '2026-10-13', 10, 'ok'),
 (16, 4, '2026-10-14', 8, 'atrasada'),
 (17, 1, '2026-10-15', 10, 'ok'),
 (18, 3, '2026-10-16', 5, 'ok'),
 (19, 2, '2026-10-17', 10, 'atrasada'),
 (20, 4, '2026-10-18', 8, 'ok');
CREATE TABLE notas (id INTEGER PRIMARY KEY, fornecedor_id INTEGER, mes TEXT, itens INTEGER);
INSERT INTO notas VALUES
 (1, 1, '2026-10', 30),
 (2, 1, '2026-10', 20),
 (3, 2, '2026-10', 60),
 (4, 2, '2026-10', 50),
 (5, 3, '2026-10', 25),
 (6, 4, '2026-10', 24),
 (7, 4, '2026-10', 16);
`

/** Banco mínimo do exemplo resolvido da lição de GROUP BY. */
const LESSON_GROUPBY = `
CREATE TABLE chamados (id INTEGER PRIMARY KEY, setor TEXT, prioridade TEXT);
INSERT INTO chamados VALUES
 (1, 'TI', 'alta'), (2, 'RH', 'baixa'), (3, 'TI', 'baixa'), (4, 'Financeiro', 'alta'),
 (5, 'TI', 'alta'), (6, 'Financeiro', 'baixa'), (7, 'RH', 'alta'), (8, 'TI', 'baixa'), (9, 'Financeiro', 'alta');
`

export const DATASETS: Record<string, string> = {
  supply: SUPPLY,
  lesson_groupby: LESSON_GROUPBY,
  guild: GUILD,
  security: SECURITY,
  cafe: CAFE,
  sentinel: SENTINEL,
  core: CORE_BASE,
  core_ghosts: CORE_GHOSTS,
}

/** Esquema exibido no terminal (tabelas e colunas). */
export const SCHEMAS: Record<string, Array<{ table: string; columns: string[] }>> = {
  guild: [{ table: 'missoes', columns: ['id', 'titulo', 'regiao', 'status'] }],
  security: [
    { table: 'employees', columns: ['id', 'name', 'department', 'clearance', 'status'] },
    { table: 'access_logs', columns: ['id', 'employee_id', 'action', 'target', 'day', 'hour'] },
    { table: 'badges', columns: ['badge_id', 'employee_id', 'issued'] },
    { table: 'badge_uses', columns: ['id', 'badge_id', 'door', 'day'] },
  ],
  cafe: [{ table: 'coffee', columns: ['id', 'day', 'shift', 'machine', 'cups'] }],
  sentinel: [
    { table: 'processes', columns: ['pid', 'name', 'owner', 'cpu'] },
    { table: 'connections', columns: ['id', 'source_ip', 'port'] },
  ],
  core: [
    { table: 'audit', columns: ['id', 'actor', 'action', 'target', 'ts'] },
    { table: 'employees', columns: ['id', 'name', 'department', 'clearance', 'status'] },
    { table: 'contracts', columns: ['employee_id', 'salary'] },
    { table: 'payroll', columns: ['id', 'employee_id', 'amount', 'origin'] },
  ],
}
SCHEMAS.core_ghosts = SCHEMAS.core
SCHEMAS.supply = [
  { table: 'fornecedores', columns: ['id', 'nome', 'cidade'] },
  { table: 'entregas', columns: ['id', 'fornecedor_id', 'dia', 'itens', 'status'] },
  { table: 'notas', columns: ['id', 'fornecedor_id', 'mes', 'itens'] },
]
SCHEMAS.lesson_groupby = [{ table: 'chamados', columns: ['id', 'setor', 'prioridade'] }]
