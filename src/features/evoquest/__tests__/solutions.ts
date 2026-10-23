// Soluções de referência. Ficam SÓ nos testes: o app nunca importa este
// arquivo, então o gabarito não vai para o navegador. Os testes executam cada
// solução no SQLite real e geram os hashes de content/expected.ts.

export const SQL_SOLUTIONS: Record<string, string> = {
  guild_board: "SELECT titulo, regiao FROM missoes WHERE status = 'aberta';",
  sql_door: "SELECT * FROM employees WHERE status = 'active' AND clearance >= 4;",
  sql_logs: "SELECT * FROM access_logs WHERE action = 'UPDATE' AND (hour < 7 OR hour >= 20);",
  sql_who:
    "SELECT DISTINCT e.name, e.department, e.status FROM access_logs l JOIN employees e ON e.id = l.employee_id WHERE l.action = 'UPDATE' AND (l.hour < 7 OR l.hour >= 20);",
  sql_badges: 'SELECT b.badge_id FROM badges b LEFT JOIN badge_uses u ON u.badge_id = b.badge_id WHERE u.id IS NULL;',
  sql_cafe: "SELECT day, SUM(cups) AS total FROM coffee WHERE machine = 'subsolo' GROUP BY day ORDER BY total DESC LIMIT 1;",
  sent_procs: "SELECT pid FROM processes WHERE owner = 'unknown' AND cpu > 80;",
  sent_conns: 'SELECT source_ip FROM connections WHERE port = 8443 GROUP BY source_ip HAVING COUNT(*) > 5;',
  boss_logs: "SELECT * FROM audit WHERE actor = 'root' AND ts >= '2026-10-21 22:00' ORDER BY ts;",
  boss_join:
    'SELECT e.name, c.salary, p.amount FROM payroll p JOIN contracts c ON c.employee_id = p.employee_id JOIN employees e ON e.id = p.employee_id WHERE p.amount <> c.salary;',
  boss_agg:
    "SELECT e.department, SUM(p.amount - c.salary) FROM payroll p JOIN contracts c ON c.employee_id = p.employee_id JOIN employees e ON e.id = p.employee_id WHERE p.origin <> 'ghost' GROUP BY e.department HAVING SUM(p.amount - c.salary) > 0;",
  boss_fix:
    "UPDATE payroll SET amount = (SELECT c.salary FROM contracts c WHERE c.employee_id = payroll.employee_id) WHERE origin = 'rh'; DELETE FROM payroll WHERE origin = 'ghost';",
  // Almoxarifado (GROUP BY)
  sup_guided: 'SELECT fornecedor_id, COUNT(*) AS entregas FROM entregas GROUP BY fornecedor_id;',
  sup_independent: 'SELECT fornecedor_id, SUM(itens) FROM entregas GROUP BY fornecedor_id;',
  sup_drone: "SELECT fornecedor_id, COUNT(*) FROM entregas WHERE status = 'atrasada' GROUP BY fornecedor_id;",
  sup_transfer:
    'SELECT f.nome, n.total - e.total FROM fornecedores f JOIN (SELECT fornecedor_id, SUM(itens) AS total FROM notas GROUP BY fornecedor_id) n ON n.fornecedor_id = f.id JOIN (SELECT fornecedor_id, SUM(itens) AS total FROM entregas GROUP BY fornecedor_id) e ON e.fornecedor_id = f.id WHERE n.total - e.total > 0;',
}

/** Outros caminhos válidos (o resultado é que é conferido, não a consulta). */
export const ALTERNATIVE_SOLUTIONS: Array<{ challenge: string; query: string }> = [
  {
    challenge: 'sup_transfer',
    query:
      'WITH n AS (SELECT fornecedor_id, SUM(itens) t FROM notas GROUP BY fornecedor_id), e AS (SELECT fornecedor_id, SUM(itens) t FROM entregas GROUP BY fornecedor_id) SELECT f.nome, n.t - e.t AS diferenca FROM n JOIN e USING (fornecedor_id) JOIN fornecedores f ON f.id = n.fornecedor_id WHERE n.t > e.t;',
  },
  {
    challenge: 'sup_transfer',
    query:
      'SELECT f.nome, (SELECT SUM(itens) FROM notas WHERE fornecedor_id = f.id) - (SELECT SUM(itens) FROM entregas WHERE fornecedor_id = f.id) AS d FROM fornecedores f WHERE (SELECT SUM(itens) FROM notas WHERE fornecedor_id = f.id) > (SELECT SUM(itens) FROM entregas WHERE fornecedor_id = f.id);',
  },
  { challenge: 'sup_independent', query: 'select fornecedor_id, sum(itens) as total from entregas group by 1 order by 1 desc' },
]

/** Respostas digitadas / estados (já na forma canônica). */
export const RAW_SOLUTIONS: Record<string, string> = {
  sent_pid: '4096',
  sent_ip: '10.0.66.6',
  puzzle_power: 'A0B1C1D0',
  enc_sentinel: '4096|10.0.66.6',
  line_worst: 'M3',
  enc_robot: 'M3',
  sup_worst: '2',
  enc_drone: '2',
}

/** Erros típicos e o retorno que o terminal deve dar (trecho). */
export const WRONG_ANSWERS: Array<{ challenge: string; query: string; expect: string }> = [
  // Almoxarifado (GROUP BY): o retorno explica o erro de conceito, sem dar a consulta.
  { challenge: 'sup_guided', query: 'SELECT fornecedor_id, COUNT(*) AS entregas FROM entregas GROUP BY ____;', expect: 'Troque pela coluna' },
  { challenge: 'sup_guided', query: 'SELECT fornecedor_id, COUNT(*) AS entregas FROM entregas GROUP BY id;', expect: 'uma linha por ENTREGA' },
  { challenge: 'sup_independent', query: 'SELECT fornecedor_id, COUNT(*) FROM entregas GROUP BY fornecedor_id;', expect: 'some a coluna itens' },
  { challenge: 'sup_drone', query: 'SELECT fornecedor_id, COUNT(*) FROM entregas GROUP BY fornecedor_id;', expect: 'WHERE vem antes do GROUP BY' },
  { challenge: 'sup_drone', query: "SELECT fornecedor_id, COUNT(*) FROM entregas WHERE COUNT(*) > 0 AND status = 'atrasada' GROUP BY fornecedor_id;", expect: 'COUNT não pode ficar no WHERE' },
  { challenge: 'sql_door', query: 'SELECT * FROM employees WHERE clearance >= 4;', expect: 'status' },
  { challenge: 'sql_door', query: "SELECT * FROM employees WHERE status = 'Active' AND clearance >= 4;", expect: 'maiúsculas' },
  { challenge: 'sql_door', query: "SELECT * FROM employees WHERE status = 'active' AND clearance > 4;", expect: 'Maior ou igual' },
  { challenge: 'sql_door', query: "SELECT name FROM employees WHERE status = 'active' AND clearance >= 4;", expect: 'ficha COMPLETA' },
  { challenge: 'sql_logs', query: "SELECT * FROM access_logs WHERE action = 'UPDATE' AND hour < 7 OR hour >= 20;", expect: 'parênteses' },
  { challenge: 'sql_who', query: "SELECT e.name, e.department, e.status FROM access_logs l JOIN employees e ON e.id = l.employee_id WHERE l.action = 'UPDATE' AND (l.hour < 7 OR l.hour >= 20);", expect: 'DISTINCT' },
  { challenge: 'sql_badges', query: 'SELECT b.badge_id FROM badges b JOIN badge_uses u ON u.badge_id = b.badge_id WHERE u.id IS NULL;', expect: 'LEFT JOIN' },
  { challenge: 'sql_cafe', query: "SELECT day, SUM(cups) FROM coffee GROUP BY day ORDER BY 2 DESC LIMIT 1;", expect: 'subsolo' },
  { challenge: 'boss_agg', query: 'SELECT e.department, SUM(p.amount - c.salary) FROM payroll p JOIN contracts c ON c.employee_id = p.employee_id JOIN employees e ON e.id = p.employee_id GROUP BY e.department HAVING SUM(p.amount - c.salary) > 0;', expect: 'fantasmas' },
  { challenge: 'boss_fix', query: "UPDATE payroll SET amount = (SELECT c.salary FROM contracts c WHERE c.employee_id = payroll.employee_id) WHERE origin = 'rh';", expect: 'DELETE' },
]

// ── Usina de Aurora (Python: dicionários como acumuladores) ──────────────
// Soluções e valores esperados ficam SÓ aqui. O hash de content/expected.ts
// sai de PY_EXPECTED; o teste com CPython local confere que as soluções
// produzem exatamente esses valores (e que o código inicial não).

export const PY_SOLUTIONS: Record<string, string> = {
  line_guided: "def leituras_por_maquina(leituras):\n    contagem = {}\n    for leitura in leituras:\n        maquina = leitura['maquina']\n        contagem[maquina] = contagem.get(maquina, 0) + 1\n    return contagem\n",
  line_independent: "def consumo_por_maquina(leituras):\n    total = {}\n    for leitura in leituras:\n        m = leitura['maquina']\n        total[m] = total.get(m, 0) + leitura['consumo']\n    return total\n",
  line_robot: "def falhas_por_maquina(leituras):\n    falhas = {}\n    for leitura in leituras:\n        if leitura['status'] == 'falha':\n            m = leitura['maquina']\n            falhas[m] = falhas.get(m, 0) + 1\n    return falhas\n",
  line_transfer:
    "def abaixo_da_meta(metas, producao):\n    produzido = {}\n    for p in producao:\n        produzido[p['maquina']] = produzido.get(p['maquina'], 0) + p['pecas']\n    resultado = {}\n    for m in metas:\n        falta = m['pecas'] - produzido.get(m['maquina'], 0)\n        if falta > 0:\n            resultado[m['maquina']] = falta\n    return resultado\n",
}

/** Valor devolvido em cada caso (calculado à mão a partir dos dados de content/aurora.ts). */
export const PY_EXPECTED: Record<string, unknown[]> = {
  line_guided: [{ M1: 3, M2: 4, M3: 3, M4: 2 }, { M7: 2, M8: 1 }, {}],
  line_independent: [{ M1: 38, M2: 79, M3: 24, M4: 22 }, { M7: 11, M8: 4 }, {}],
  line_robot: [{ M1: 1, M2: 2, M3: 3 }, { M7: 1 }, {}],
  line_transfer: [{ M2: 5, M3: 35 }, { M9: 10 }, {}],
}

/** Outros caminhos válidos em Python (o resultado é que é conferido, não o código). */
export const PY_ALTERNATIVES: Array<{ challenge: string; code: string }> = [
  {
    challenge: 'line_independent',
    code: "from collections import defaultdict\n\ndef consumo_por_maquina(leituras):\n    t = defaultdict(int)\n    for l in leituras:\n        t[l['maquina']] += l['consumo']\n    return dict(t)\n",
  },
  {
    challenge: 'line_robot',
    code: "from collections import Counter\n\ndef falhas_por_maquina(leituras):\n    return dict(Counter(l['maquina'] for l in leituras if l['status'] == 'falha'))\n",
  },
  {
    challenge: 'line_transfer',
    code: "from collections import Counter\n\ndef abaixo_da_meta(metas, producao):\n    feito = Counter()\n    for p in producao:\n        feito[p['maquina']] += p['pecas']\n    return {m['maquina']: m['pecas'] - feito[m['maquina']] for m in metas if m['pecas'] > feito[m['maquina']]}\n",
  },
]

/** Erros típicos em Python e o retorno que o terminal deve dar (trecho). */
export const PY_WRONG: Array<{ challenge: string; code: string; expect: string }> = [
  { challenge: 'line_guided', code: 'STARTER', expect: 'Troque pelo nome da variável' },
  { challenge: 'line_guided', code: "def leituras_por_maquina(leituras):\n    contagem = {}\n    for leitura in leituras:\n        contagem[leitura['maquina']] += 1\n    return contagem\n", expect: 'KeyError' },
  { challenge: 'line_guided', code: "def leituras_por_maquina(leituras):\n    contagem = {}\n    for leitura in leituras:\n        maquina = leitura['maquina']\n        contagem[maquina] = contagem.get(maquina, 0) + 1\n", expect: 'Falta o return' },
  { challenge: 'line_independent', code: 'STARTER', expect: 'devolveu None' },
  { challenge: 'line_independent', code: "def consumo_por_maquina(leituras):\n    total = {}\n    for l in leituras:\n        total[l['maquina']] = total.get(l['maquina'], 0) + 1\n    return total\n", expect: 'SOMA do campo consumo' },
  { challenge: 'line_independent', code: "def consumo_por_maquina(leituras):\n    return sum(l['consumo'] for l in leituras)\n", expect: 'POR máquina' },
  { challenge: 'line_robot', code: 'STARTER', expect: 'Sem percorrer as leituras' },
  { challenge: 'line_robot', code: "def falhas_por_maquina(leituras):\n    falhas = {}\n    for l in leituras:\n        falhas[l['maquina']] = falhas.get(l['maquina'], 0) + 1\n    return falhas\n", expect: 'Um if antes de acumular' },
  {
    challenge: 'line_transfer',
    code: "def abaixo_da_meta(metas, producao):\n    produzido = {}\n    for p in producao:\n        produzido[p['maquina']] = produzido.get(p['maquina'], 0) + p['pecas']\n    return {m['maquina']: m['pecas'] - produzido[m['maquina']] for m in metas if m['maquina'] in produzido and m['pecas'] > produzido[m['maquina']]}\n",
    expect: 'sem NENHUMA produção',
  },
  {
    challenge: 'line_transfer',
    code: "def abaixo_da_meta(metas, producao):\n    produzido = {}\n    for p in producao:\n        produzido[p['maquina']] = produzido.get(p['maquina'], 0) + p['pecas']\n    return {m['maquina']: m['pecas'] - produzido.get(m['maquina'], 0) for m in metas if m['pecas'] >= produzido.get(m['maquina'], 0)}\n",
    expect: 'Meta batida exatamente',
  },
]
