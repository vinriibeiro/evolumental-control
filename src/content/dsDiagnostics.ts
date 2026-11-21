// Banco de questões do diagnóstico de conhecimento da trilha de Ciência de Dados.
// Cada questão tem quatro alternativas e uma única correta (`answer`, índice a partir de 0).
// Os `id` são estáveis: respostas já gravadas dependem deles.
import type { DiagnosticQuestion, TrackKey } from '@/content/dsTypes'
import { DS_TOPICS } from '@/content/dsTrail'

// ── Tabelas de exemplo reutilizadas nas questões de SQL ──────────────────────

const T_PRODUTOS = `produtos
id | nome    | preco
 1 | Caneta  |   3.00
 2 | Caderno |  18.00
 3 | Mochila | 120.00
 4 | Lápis   |   2.00`

const T_FUNCIONARIOS = `funcionarios
id | nome | setor | salario
 1 | Ana  | TI    | 5000
 2 | Bia  | RH    | 4000
 3 | Caio | TI    | 7000
 4 | Duda | RH    | 4500
 5 | Enzo | TI    | 3500`

const T_PEDIDOS_STATUS = `pedidos
id | status    | valor
 1 | pago      | 100
 2 | pendente  | 250
 3 | pago      | 300
 4 | cancelado |  80
 5 | pago      |  50`

const T_CLIENTES_PEDIDOS = `clientes
id | nome
 1 | Ana
 2 | Bruno
 3 | Carla

pedidos
id | cliente_id | valor
10 | 1          | 100
11 | 1          |  50
12 | 2          | 200
13 | NULL       |  70`

const T_VENDAS = `vendas
id | vendedor | regiao | valor
 1 | Ana      | Sul    | 100
 2 | Ana      | Sul    | 300
 3 | Bia      | Norte  | 200
 4 | Caio     | Sul    |  50
 5 | Bia      | Norte  | 400`

const T_RANKING = `vendas
id | vendedor | valor
 1 | Ana      | 300
 2 | Bia      | 500
 3 | Caio     | 300
 4 | Duda     | 100`

const T_VENDAS_MES = `vendas_mes
mes | valor
  1 | 100
  2 | 150
  3 |  50
  4 | 200`

const T_PEDIDOS_DATA = `pedidos
id | data       | valor
 1 | 2025-01-10 | 100
 2 | 2025-01-25 | 300
 3 | 2025-02-03 | 200
 4 | 2025-02-14 |  50
 5 | 2025-02-28 | 250`

// ── DataFrame de exemplo reutilizado nas questões de Pandas ──────────────────

const DF_PRODUTOS = `import pandas as pd

df = pd.DataFrame({
    'produto': ['caneta', 'caderno', 'mochila', 'lápis'],
    'categoria': ['escrita', 'papel', 'bolsas', 'escrita'],
    'preco': [3.0, 18.0, 120.0, 2.0],
})`

const SQL_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'dq.sql.fundamentos.1',
    track: 'sql',
    topicKey: 'ds.sql.fundamentos',
    level: 1,
    skill: 'Interpretação de consultas',
    kind: 'concept',
    prompt: 'Em que ordem lógica o banco avalia as cláusulas de um SELECT?',
    options: [
      'SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY',
      'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY',
      'FROM → SELECT → WHERE → GROUP BY → ORDER BY → HAVING',
      'WHERE → FROM → GROUP BY → SELECT → HAVING → ORDER BY',
    ],
    answer: 1,
    explanation: 'Primeiro o banco monta as linhas (FROM), filtra (WHERE), agrupa (GROUP BY), filtra os grupos (HAVING), calcula as colunas (SELECT) e só então ordena (ORDER BY).',
  },
  {
    id: 'dq.sql.fundamentos.2',
    track: 'sql',
    topicKey: 'ds.sql.fundamentos',
    level: 1,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Quantas linhas a consulta devolve?',
    code: `clientes
id | nome  | cidade
 1 | Ana   | Recife
 2 | Bruno | Natal
 3 | Carla | Recife
 4 | Davi  | NULL

SELECT DISTINCT cidade
FROM clientes
WHERE cidade IS NOT NULL;`,
    options: ['4 linhas', '3 linhas', '2 linhas', '1 linha'],
    answer: 2,
    explanation: 'O WHERE descarta a linha com cidade NULL e o DISTINCT elimina a repetição de Recife: sobram Recife e Natal.',
  },
  {
    id: 'dq.sql.select.1',
    track: 'sql',
    topicKey: 'ds.sql.select',
    level: 1,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Qual é o resultado da consulta, na ordem em que as linhas aparecem?',
    code: `${T_PRODUTOS}

SELECT nome
FROM produtos
WHERE preco > 2.50
ORDER BY preco DESC
LIMIT 2;`,
    options: ['Lápis e Caneta', 'Caneta e Caderno', 'Mochila, Caderno e Caneta', 'Mochila e Caderno'],
    answer: 3,
    explanation: 'O filtro mantém Caneta, Caderno e Mochila; a ordenação decrescente por preço coloca Mochila e Caderno primeiro e o LIMIT 2 corta o restante.',
  },
  {
    id: 'dq.sql.select.2',
    track: 'sql',
    topicKey: 'ds.sql.select',
    level: 1,
    skill: 'Construção de consultas',
    kind: 'practical',
    prompt: 'Qual consulta lista nome e preço dos produtos, do mais barato para o mais caro?',
    code: T_PRODUTOS,
    options: [
      'SELECT nome, preco FROM produtos ORDER BY preco ASC;',
      'SELECT nome, preco FROM produtos GROUP BY preco;',
      'SELECT nome, preco FROM produtos SORT BY preco;',
      'SELECT nome, preco ORDER BY preco FROM produtos;',
    ],
    answer: 0,
    explanation: 'A ordenação é feita com ORDER BY, que vem depois do FROM; ASC (o padrão) ordena do menor para o maior.',
  },
  {
    id: 'dq.sql.select.3',
    track: 'sql',
    topicKey: 'ds.sql.select',
    level: 2,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Em que ordem os nomes aparecem no resultado?',
    code: `${T_FUNCIONARIOS}

SELECT nome
FROM funcionarios
WHERE salario >= 4000
ORDER BY setor ASC, salario DESC;`,
    options: ['Ana, Bia, Caio, Duda', 'Caio, Ana, Duda, Bia', 'Duda, Bia, Caio, Ana', 'Bia, Duda, Ana, Caio'],
    answer: 2,
    explanation: 'Enzo sai pelo filtro. Primeiro vem o setor RH (Duda 4500, Bia 4000) e depois TI (Caio 7000, Ana 5000), cada setor do maior para o menor salário.',
  },
  {
    id: 'dq.sql.filtros.1',
    track: 'sql',
    topicKey: 'ds.sql.filtros',
    level: 1,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Que número a consulta devolve?',
    code: `${T_PEDIDOS_STATUS}

SELECT COUNT(*)
FROM pedidos
WHERE status = 'pago' AND valor >= 100;`,
    options: ['2', '3', '4', '5'],
    answer: 0,
    explanation: 'Apenas os pedidos 1 (100) e 3 (300) são pagos e têm valor a partir de 100; o pedido 5 é pago, mas vale 50.',
  },
  {
    id: 'dq.sql.filtros.2',
    track: 'sql',
    topicKey: 'ds.sql.filtros',
    level: 2,
    skill: 'Construção de consultas',
    kind: 'practical',
    prompt: 'Qual consulta devolve os clientes sem telefone cadastrado (Bruno e Carla)?',
    code: `clientes
id | nome  | telefone
 1 | Ana   | 9999-0001
 2 | Bruno | NULL
 3 | Carla | NULL`,
    options: [
      'SELECT nome FROM clientes WHERE telefone = NULL;',
      "SELECT nome FROM clientes WHERE telefone = '';",
      'SELECT nome FROM clientes WHERE telefone IS NULL;',
      'SELECT nome FROM clientes WHERE telefone <> NULL;',
    ],
    answer: 2,
    explanation: 'NULL significa "valor desconhecido": qualquer comparação com = ou <> resulta em desconhecido e a linha não é devolvida. O teste correto é IS NULL.',
  },
  {
    id: 'dq.sql.filtros.3',
    track: 'sql',
    topicKey: 'ds.sql.filtros',
    level: 2,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Que número a consulta devolve?',
    code: `produtos
id | nome        | preco
 1 | Caneta azul |  3
 2 | Caderno     | 18
 3 | Canetão     |  7
 4 | Borracha    |  2
 5 | Estojo      | 25

SELECT COUNT(*)
FROM produtos
WHERE nome LIKE 'Can%' AND preco BETWEEN 3 AND 7;`,
    options: ['3', '2', '1', '0'],
    answer: 1,
    explanation: "'Can%' casa com Caneta azul e Canetão (Caderno começa com 'Cad'). BETWEEN inclui os extremos, então 3 e 7 entram: duas linhas.",
  },
  {
    id: 'dq.sql.filtros.4',
    track: 'sql',
    topicKey: 'ds.sql.filtros',
    level: 2,
    skill: 'Interpretação de consultas',
    kind: 'practical',
    prompt: 'Quais ids a consulta devolve?',
    code: `${T_PEDIDOS_STATUS}

SELECT id
FROM pedidos
WHERE status = 'pago' OR status = 'pendente' AND valor > 200;`,
    options: ['2 e 3', '1, 3 e 5', '1, 2, 3, 4 e 5', '1, 2, 3 e 5'],
    answer: 3,
    explanation: "AND é avaliado antes de OR: a condição equivale a status = 'pago' OR (status = 'pendente' AND valor > 200). Entram os três pagos (1, 3 e 5) e o pendente acima de 200 (2).",
  },
  {
    id: 'dq.sql.join.1',
    track: 'sql',
    topicKey: 'ds.sql.join',
    level: 1,
    skill: 'JOIN',
    kind: 'practical',
    prompt: 'Que número a consulta devolve?',
    code: `${T_CLIENTES_PEDIDOS}

SELECT COUNT(*)
FROM clientes c
INNER JOIN pedidos p ON p.cliente_id = c.id;`,
    options: ['2', '3', '4', '5'],
    answer: 1,
    explanation: 'O INNER JOIN mantém só os pares com correspondência: pedidos 10 e 11 (Ana) e 12 (Bruno). Carla não tem pedido e o pedido 13 não tem cliente.',
  },
  {
    id: 'dq.sql.join.2',
    track: 'sql',
    topicKey: 'ds.sql.join',
    level: 2,
    skill: 'JOIN',
    kind: 'practical',
    prompt: 'Quantas linhas a consulta devolve?',
    code: `${T_CLIENTES_PEDIDOS}

SELECT c.nome, p.id
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id;`,
    options: ['5 linhas', '3 linhas', '4 linhas', '7 linhas'],
    answer: 2,
    explanation: 'O LEFT JOIN preserva todos os clientes: Ana aparece duas vezes, Bruno uma e Carla uma vez com p.id NULL. O pedido 13, sem cliente, não entra.',
  },
  {
    id: 'dq.sql.join.3',
    track: 'sql',
    topicKey: 'ds.sql.join',
    level: 2,
    skill: 'JOIN',
    kind: 'practical',
    prompt: 'Qual consulta lista os clientes que nunca fizeram um pedido?',
    code: T_CLIENTES_PEDIDOS,
    options: [
      'SELECT c.nome FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL;',
      'SELECT c.nome FROM clientes c INNER JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL;',
      'SELECT c.nome FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id = NULL;',
      'SELECT c.nome FROM clientes c INNER JOIN pedidos p ON p.cliente_id <> c.id;',
    ],
    answer: 0,
    explanation: 'O LEFT JOIN mantém os clientes sem pedido com as colunas de pedidos em NULL; filtrar p.id IS NULL deixa só esses clientes (Carla).',
  },
  {
    id: 'dq.sql.join.4',
    track: 'sql',
    topicKey: 'ds.sql.join',
    level: 3,
    skill: 'JOIN',
    kind: 'practical',
    prompt: 'Qual é o valor de qtd na linha de Carla?',
    code: `${T_CLIENTES_PEDIDOS}

SELECT c.nome, COUNT(p.id) AS qtd
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
GROUP BY c.nome
ORDER BY c.nome;`,
    options: ['Carla não aparece no resultado', 'NULL', '1', '0'],
    answer: 3,
    explanation: 'O LEFT JOIN mantém Carla com p.id NULL, e COUNT(p.id) conta apenas valores não nulos: o resultado é 0. COUNT(*) devolveria 1.',
  },
  {
    id: 'dq.sql.groupby.1',
    track: 'sql',
    topicKey: 'ds.sql.groupby',
    level: 1,
    skill: 'Agregações',
    kind: 'practical',
    prompt: 'Qual é o resultado da consulta?',
    code: `${T_VENDAS}

SELECT regiao, SUM(valor) AS total
FROM vendas
GROUP BY regiao;`,
    options: [
      'Sul = 450 e Norte = 600',
      'Sul = 400 e Norte = 600',
      'Sul = 3 e Norte = 2',
      'Uma única linha com 1050',
    ],
    answer: 0,
    explanation: 'O GROUP BY cria um grupo por região: Sul soma 100 + 300 + 50 = 450 e Norte soma 200 + 400 = 600.',
  },
  {
    id: 'dq.sql.groupby.2',
    track: 'sql',
    topicKey: 'ds.sql.groupby',
    level: 2,
    skill: 'Agregações',
    kind: 'practical',
    prompt: 'Quais vendedores a consulta devolve?',
    code: `${T_VENDAS}

SELECT vendedor
FROM vendas
GROUP BY vendedor
HAVING SUM(valor) > 300;`,
    options: ['Apenas Bia', 'Ana, Bia e Caio', 'Ana e Bia', 'Apenas Ana'],
    answer: 2,
    explanation: 'Os totais são Ana 400, Bia 600 e Caio 50. O HAVING filtra os grupos depois da soma e mantém Ana e Bia.',
  },
  {
    id: 'dq.sql.groupby.3',
    track: 'sql',
    topicKey: 'ds.sql.groupby',
    level: 2,
    skill: 'Agregações',
    kind: 'concept',
    prompt: 'Qual é a diferença entre WHERE e HAVING?',
    options: [
      'WHERE só funciona com números; HAVING só funciona com textos.',
      'WHERE filtra linhas antes do agrupamento; HAVING filtra grupos depois da agregação.',
      'WHERE filtra grupos depois da agregação; HAVING filtra linhas antes do agrupamento.',
      'Não há diferença: são sinônimos e podem ser trocados livremente.',
    ],
    answer: 1,
    explanation: 'O WHERE atua sobre as linhas originais, antes do GROUP BY; o HAVING atua sobre os grupos e por isso pode usar funções de agregação como SUM e COUNT.',
  },
  {
    id: 'dq.sql.groupby.4',
    track: 'sql',
    topicKey: 'ds.sql.groupby',
    level: 2,
    skill: 'Agregações',
    kind: 'practical',
    prompt: 'Quais são, nesta ordem, os três valores devolvidos?',
    code: `avaliacoes
id | nota
 1 | 8
 2 | NULL
 3 | 6
 4 | 10

SELECT COUNT(*), COUNT(nota), AVG(nota)
FROM avaliacoes;`,
    options: ['4, 4 e 6', '3, 3 e 8', '4, 3 e 6', '4, 3 e 8'],
    answer: 3,
    explanation: 'COUNT(*) conta todas as linhas (4); COUNT(nota) ignora o NULL (3); AVG também ignora o NULL: (8 + 6 + 10) / 3 = 8.',
  },
  {
    id: 'dq.sql.subconsultas.1',
    track: 'sql',
    topicKey: 'ds.sql.subconsultas',
    level: 2,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Quais funcionários a consulta devolve?',
    code: `${T_FUNCIONARIOS}

SELECT nome
FROM funcionarios
WHERE salario > (SELECT AVG(salario) FROM funcionarios);`,
    options: ['Apenas Caio', 'Ana e Caio', 'Ana, Caio e Duda', 'Bia, Duda e Enzo'],
    answer: 1,
    explanation: 'A média é 24000 / 5 = 4800. Acima dela estão Ana (5000) e Caio (7000).',
  },
  {
    id: 'dq.sql.subconsultas.2',
    track: 'sql',
    topicKey: 'ds.sql.subconsultas',
    level: 2,
    skill: 'Construção de consultas',
    kind: 'practical',
    prompt: 'Qual consulta devolve os clientes que têm pelo menos um pedido com valor acima de 150?',
    code: T_CLIENTES_PEDIDOS,
    options: [
      'SELECT nome FROM clientes WHERE id = (SELECT cliente_id FROM pedidos);',
      'SELECT nome FROM clientes WHERE valor > 150;',
      'SELECT nome FROM clientes WHERE id IN (SELECT cliente_id FROM pedidos WHERE valor > 150);',
      'SELECT nome FROM clientes WHERE id IN (SELECT id FROM pedidos WHERE valor > 150);',
    ],
    answer: 2,
    explanation: 'A subconsulta precisa devolver os cliente_id dos pedidos acima de 150 e o IN compara com o id do cliente. As outras opções geram erro ou comparam com o id do pedido.',
  },
  {
    id: 'dq.sql.subconsultas.3',
    track: 'sql',
    topicKey: 'ds.sql.subconsultas',
    level: 3,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Quais funcionários a consulta devolve?',
    code: `${T_FUNCIONARIOS}

SELECT nome
FROM funcionarios f
WHERE salario = (
  SELECT MAX(salario)
  FROM funcionarios
  WHERE setor = f.setor
);`,
    options: ['Apenas Caio', 'Ana e Bia', 'Caio e Bia', 'Caio e Duda'],
    answer: 3,
    explanation: 'A subconsulta correlacionada calcula o maior salário do setor de cada linha: 7000 em TI (Caio) e 4500 em RH (Duda).',
  },
  {
    id: 'dq.sql.cte.1',
    track: 'sql',
    topicKey: 'ds.sql.cte',
    level: 2,
    skill: 'CTE',
    kind: 'concept',
    prompt: 'O que a cláusula WITH (CTE) faz em uma consulta?',
    options: [
      'Cria uma tabela permanente no banco de dados.',
      'Cria um índice temporário para acelerar a consulta.',
      'Define um resultado nomeado e temporário, que existe apenas durante aquela consulta.',
      'Abre uma transação que precisa ser confirmada com COMMIT.',
    ],
    answer: 2,
    explanation: 'A CTE dá nome a uma consulta auxiliar que pode ser referenciada na consulta principal; nada fica gravado no banco depois da execução.',
  },
  {
    id: 'dq.sql.cte.2',
    track: 'sql',
    topicKey: 'ds.sql.cte',
    level: 2,
    skill: 'CTE',
    kind: 'practical',
    prompt: 'Que número a consulta devolve?',
    code: `${T_VENDAS}

WITH totais AS (
  SELECT vendedor, SUM(valor) AS total
  FROM vendas
  GROUP BY vendedor
)
SELECT COUNT(*)
FROM totais
WHERE total >= 400;`,
    options: ['3', '2', '1', '0'],
    answer: 1,
    explanation: 'A CTE gera os totais Ana 400, Bia 600 e Caio 50; a consulta principal conta os que têm 400 ou mais: Ana e Bia.',
  },
  {
    id: 'dq.sql.cte.3',
    track: 'sql',
    topicKey: 'ds.sql.cte',
    level: 3,
    skill: 'CTE',
    kind: 'practical',
    prompt: 'Que número a consulta devolve?',
    code: `WITH RECURSIVE n AS (
  SELECT 1 AS x
  UNION ALL
  SELECT x + 1 FROM n WHERE x < 4
)
SELECT SUM(x) FROM n;`,
    options: ['10', '4', '6', '15'],
    answer: 0,
    explanation: 'A CTE recursiva gera 1, 2, 3 e 4 (para quando x chega a 4). A soma é 10.',
  },
  {
    id: 'dq.sql.window.1',
    track: 'sql',
    topicKey: 'ds.sql.window',
    level: 2,
    skill: 'Window Functions',
    kind: 'practical',
    prompt: 'Qual é o valor de pos na linha de Duda?',
    code: `${T_RANKING}

SELECT vendedor,
       RANK() OVER (ORDER BY valor DESC) AS pos
FROM vendas;`,
    options: ['2', '3', '4', '1'],
    answer: 2,
    explanation: 'Bia fica em 1º; Ana e Caio empatam em 2º; o RANK pula a posição seguinte e Duda fica em 4º. Com DENSE_RANK ela ficaria em 3º.',
  },
  {
    id: 'dq.sql.window.2',
    track: 'sql',
    topicKey: 'ds.sql.window',
    level: 2,
    skill: 'Window Functions',
    kind: 'concept',
    prompt: 'Qual é a principal diferença entre SUM(valor) com GROUP BY e SUM(valor) OVER (PARTITION BY …)?',
    options: [
      'O GROUP BY devolve uma linha por grupo; a função de janela mantém todas as linhas e acrescenta o cálculo a cada uma.',
      'A função de janela devolve uma linha por grupo; o GROUP BY mantém todas as linhas.',
      'A função de janela só pode ser usada junto com GROUP BY.',
      'Não há diferença no resultado; a função de janela é apenas mais rápida.',
    ],
    answer: 0,
    explanation: 'Funções de janela não reduzem o número de linhas: cada linha continua no resultado, acompanhada do valor calculado sobre a sua partição.',
  },
  {
    id: 'dq.sql.window.3',
    track: 'sql',
    topicKey: 'ds.sql.window',
    level: 3,
    skill: 'Window Functions',
    kind: 'practical',
    prompt: 'Qual é o valor de acumulado na linha do mês 3?',
    code: `${T_VENDAS_MES}

SELECT mes,
       SUM(valor) OVER (ORDER BY mes) AS acumulado
FROM vendas_mes;`,
    options: ['300', '50', '500', '200'],
    answer: 0,
    explanation: 'Com ORDER BY dentro do OVER, a soma vai do início até a linha atual: 100 + 150 + 50 = 300.',
  },
  {
    id: 'dq.sql.window.4',
    track: 'sql',
    topicKey: 'ds.sql.window',
    level: 3,
    skill: 'Window Functions',
    kind: 'practical',
    prompt: 'A tabela pedidos tem as colunas id, cliente_id, data e valor. Qual consulta devolve apenas o pedido mais recente de cada cliente?',
    options: [
      'SELECT *, ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY data DESC) AS rn FROM pedidos WHERE rn = 1;',
      'SELECT * FROM (SELECT p.*, ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY data DESC) AS rn FROM pedidos p) t WHERE rn = 1;',
      'SELECT * FROM pedidos ORDER BY data DESC LIMIT 1;',
      'SELECT * FROM pedidos GROUP BY cliente_id HAVING data = MAX(data);',
    ],
    answer: 1,
    explanation: 'O ROW_NUMBER numera os pedidos de cada cliente do mais novo para o mais antigo. Como funções de janela não podem ser usadas no WHERE da mesma consulta, o filtro rn = 1 é feito em uma consulta externa (ou CTE).',
  },
  {
    id: 'dq.sql.window.5',
    track: 'sql',
    topicKey: 'ds.sql.window',
    level: 3,
    skill: 'Window Functions',
    kind: 'practical',
    prompt: 'Quais são os valores de variacao nos meses 1 e 2, nesta ordem?',
    code: `${T_VENDAS_MES}

SELECT mes,
       valor - LAG(valor) OVER (ORDER BY mes) AS variacao
FROM vendas_mes;`,
    options: ['0 e 50', 'NULL e 50', '100 e 150', 'NULL e -50'],
    answer: 1,
    explanation: 'LAG busca o valor da linha anterior. No mês 1 não há linha anterior (NULL, e a subtração também dá NULL); no mês 2, 150 − 100 = 50.',
  },
  {
    id: 'dq.sql.modelagem.1',
    track: 'sql',
    topicKey: 'ds.sql.modelagem',
    level: 1,
    skill: 'Problemas práticos',
    kind: 'concept',
    prompt: 'Um cliente pode fazer vários pedidos e cada pedido pertence a um único cliente. Onde deve ficar a chave estrangeira?',
    options: [
      'Na tabela clientes, em uma coluna pedido_id.',
      'Nas duas tabelas, uma apontando para a outra.',
      'Em nenhuma: basta repetir o nome do cliente em cada pedido.',
      'Na tabela pedidos, em uma coluna cliente_id que referencia clientes(id).',
    ],
    answer: 3,
    explanation: 'Em um relacionamento um-para-muitos, a chave estrangeira fica no lado "muitos": cada pedido guarda o id do seu cliente.',
  },
  {
    id: 'dq.sql.modelagem.2',
    track: 'sql',
    topicKey: 'ds.sql.modelagem',
    level: 2,
    skill: 'Problemas práticos',
    kind: 'concept',
    prompt: 'Um pedido pode conter vários produtos e um produto pode estar em vários pedidos. Como modelar esse relacionamento?',
    options: [
      'Com uma tabela associativa (por exemplo, itens_pedido) contendo pedido_id e produto_id.',
      'Com uma coluna produtos na tabela pedidos guardando os ids separados por vírgula.',
      'Com uma coluna pedido_id na tabela produtos.',
      'Com colunas produto1, produto2, produto3… na tabela pedidos.',
    ],
    answer: 0,
    explanation: 'Relacionamentos muitos-para-muitos são resolvidos com uma tabela intermediária, que tem uma chave estrangeira para cada lado e pode guardar atributos como quantidade e preço.',
  },
  {
    id: 'dq.sql.otimizacao.1',
    track: 'sql',
    topicKey: 'ds.sql.otimizacao',
    level: 2,
    skill: 'Problemas práticos',
    kind: 'concept',
    prompt: 'Uma tabela pedidos tem milhões de linhas e a consulta "SELECT * FROM pedidos WHERE cliente_id = 42" está lenta. Qual é a primeira medida mais indicada?',
    options: [
      'Acrescentar ORDER BY cliente_id ao final da consulta.',
      'Analisar o plano com EXPLAIN e criar um índice em pedidos(cliente_id).',
      'Trocar o WHERE por HAVING.',
      'Acrescentar DISTINCT ao SELECT.',
    ],
    answer: 1,
    explanation: 'Sem índice, o banco lê a tabela inteira para achar poucas linhas. O EXPLAIN confirma a varredura sequencial, e um índice na coluna filtrada permite localizar as linhas diretamente.',
  },
  {
    id: 'dq.sql.otimizacao.2',
    track: 'sql',
    topicKey: 'ds.sql.otimizacao',
    level: 3,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Existe um índice comum em pedidos(data_pedido). Qual filtro permite ao banco usar esse índice para buscar os pedidos de 2025?',
    options: [
      'WHERE EXTRACT(YEAR FROM data_pedido) = 2025',
      "WHERE CAST(data_pedido AS TEXT) LIKE '2025%'",
      "WHERE data_pedido >= DATE '2025-01-01' AND data_pedido < DATE '2026-01-01'",
      "WHERE TO_CHAR(data_pedido, 'YYYY') = '2025'",
    ],
    answer: 2,
    explanation: 'Aplicar uma função ou conversão sobre a coluna impede o uso de um índice comum. Comparar a coluna diretamente com um intervalo de datas mantém o filtro aproveitável pelo índice.',
  },
  {
    id: 'dq.sql.analise.1',
    track: 'sql',
    topicKey: 'ds.sql.analise',
    level: 2,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Qual é o ticket médio devolvido pela consulta?',
    code: `${T_PEDIDOS_DATA}

SELECT AVG(valor) AS ticket_medio
FROM pedidos;`,
    options: ['150', '180', '225', '900'],
    answer: 1,
    explanation: 'O ticket médio é o faturamento dividido pelo número de pedidos: (100 + 300 + 200 + 50 + 250) / 5 = 900 / 5 = 180.',
  },
  {
    id: 'dq.sql.analise.2',
    track: 'sql',
    topicKey: 'ds.sql.analise',
    level: 2,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Qual é o resultado da consulta?',
    code: `${T_PEDIDOS_DATA}

SELECT DATE_TRUNC('month', data) AS mes,
       SUM(valor) AS faturamento
FROM pedidos
GROUP BY 1
ORDER BY 1;`,
    options: [
      'Janeiro = 300 e fevereiro = 250',
      'Janeiro = 2 e fevereiro = 3',
      'Uma única linha com 900',
      'Janeiro = 400 e fevereiro = 500',
    ],
    answer: 3,
    explanation: 'DATE_TRUNC leva cada data para o primeiro dia do mês, formando um grupo por mês: janeiro soma 100 + 300 = 400 e fevereiro soma 200 + 50 + 250 = 500.',
  },
  {
    id: 'dq.sql.analise.3',
    track: 'sql',
    topicKey: 'ds.sql.analise',
    level: 3,
    skill: 'Problemas práticos',
    kind: 'practical',
    prompt: 'Quais são, nesta ordem, os valores de grandes e total?',
    code: `${T_PEDIDOS_DATA}

SELECT SUM(CASE WHEN valor >= 200 THEN 1 ELSE 0 END) AS grandes,
       COUNT(*) AS total
FROM pedidos;`,
    options: ['2 e 5', '750 e 5', '3 e 5', '3 e 3'],
    answer: 2,
    explanation: 'O CASE vale 1 para os pedidos de 300, 200 e 250 e 0 para os demais; a soma dá 3. COUNT(*) conta as 5 linhas.',
  },
]

const PYTHON_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'dq.python.sintaxe.1',
    track: 'python',
    topicKey: 'ds.python.sintaxe',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `x = 7
y = 2
print(x // y, x % y, x / y)`,
    options: ['3.5 1 3', '3 1 3.5', '3 1 3', '4 1 3.5'],
    answer: 1,
    explanation: '// é a divisão inteira (3), % é o resto (1) e / é a divisão real, que sempre devolve float (3.5).',
  },
  {
    id: 'dq.python.sintaxe.2',
    track: 'python',
    topicKey: 'ds.python.sintaxe',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `nome = 'Ana'
idade = 30
print(f'{nome} tem {idade + 1} anos')`,
    options: ['{nome} tem {idade + 1} anos', 'Ana tem 30 + 1 anos', 'Ana tem 31 anos', 'Ocorre um TypeError'],
    answer: 2,
    explanation: 'Em uma f-string, o que está entre chaves é avaliado como expressão Python e o resultado é inserido no texto.',
  },
  {
    id: 'dq.python.tipos.1',
    track: 'python',
    topicKey: 'ds.python.tipos',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `a = '5'
b = 2
print(a + str(b), int(a) + b)`,
    options: ['7 7', '52 7', '52 52', 'Ocorre um TypeError'],
    answer: 1,
    explanation: "Somar duas strings concatena ('5' + '2' = '52'); depois de converter com int(), a soma é numérica (5 + 2 = 7).",
  },
  {
    id: 'dq.python.tipos.2',
    track: 'python',
    topicKey: 'ds.python.tipos',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `s = 'Python para Dados'
print(s[0:6].upper(), len(s))`,
    options: ['PYTHON 17', 'PYTHON 15', 'Python 17', 'PYTHON P 17'],
    answer: 0,
    explanation: 's[0:6] pega os caracteres das posições 0 a 5 ("Python"); upper() converte para maiúsculas; len conta os 17 caracteres, incluindo os dois espaços.',
  },
  {
    id: 'dq.python.tipos.3',
    track: 'python',
    topicKey: 'ds.python.tipos',
    level: 2,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: "print(type(10 / 2).__name__, int('7') + 1, '3' * 2)",
    options: ['int 8 6', 'float 71 33', 'int 8 33', 'float 8 33'],
    answer: 3,
    explanation: "A divisão com / sempre devolve float; int('7') + 1 é 8; multiplicar uma string por 2 a repete ('33').",
  },
  {
    id: 'dq.python.condicionais.1',
    track: 'python',
    topicKey: 'ds.python.condicionais',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `nota = 6.5
if nota >= 7:
    print('aprovado')
elif nota >= 5:
    print('recuperação')
else:
    print('reprovado')`,
    options: ['reprovado', 'aprovado', 'recuperação', 'aprovado e, na linha seguinte, recuperação'],
    answer: 2,
    explanation: '6.5 não é maior ou igual a 7, então o if falha; a condição do elif (nota >= 5) é verdadeira e apenas esse bloco é executado.',
  },
  {
    id: 'dq.python.condicionais.2',
    track: 'python',
    topicKey: 'ds.python.condicionais',
    level: 2,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `idade = 20
tem_ingresso = False
vip = True
print(idade >= 18 and (tem_ingresso or vip), not vip or tem_ingresso)`,
    options: ['True False', 'True True', 'False False', 'False True'],
    answer: 0,
    explanation: 'Primeira expressão: True and (False or True) = True. Segunda: not é aplicado antes do or, então (not True) or False = False.',
  },
  {
    id: 'dq.python.lacos.1',
    track: 'python',
    topicKey: 'ds.python.lacos',
    level: 1,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `total = 0
for i in range(1, 5):
    total += i
print(total)`,
    options: ['15', '10', '4', '5'],
    answer: 1,
    explanation: 'range(1, 5) gera 1, 2, 3 e 4 (o limite final não entra). A soma é 10.',
  },
  {
    id: 'dq.python.lacos.2',
    track: 'python',
    topicKey: 'ds.python.lacos',
    level: 2,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `n = 0
while n < 10:
    n += 3
print(n)`,
    options: ['9', '10', '12', '3'],
    answer: 2,
    explanation: 'n passa por 3, 6 e 9; como 9 ainda é menor que 10, o laço roda mais uma vez e n chega a 12, quando a condição deixa de valer.',
  },
  {
    id: 'dq.python.lacos.3',
    track: 'python',
    topicKey: 'ds.python.lacos',
    level: 2,
    skill: 'Fundamentos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `quadrados = [n * n for n in range(6) if n % 2 == 0]
print(quadrados)`,
    options: ['[0, 2, 4]', '[4, 16, 36]', '[0, 1, 4, 9, 16, 25]', '[0, 4, 16]'],
    answer: 3,
    explanation: 'range(6) gera de 0 a 5; o if mantém os pares (0, 2 e 4) e a expressão n * n eleva cada um ao quadrado.',
  },
  {
    id: 'dq.python.lacos.4',
    track: 'python',
    topicKey: 'ds.python.lacos',
    level: 2,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `for i in range(5):
    if i == 1:
        continue
    if i == 3:
        break
    print(i, end=' ')`,
    options: ['0 2', '0 1 2', '0 2 4', '0 2 3'],
    answer: 0,
    explanation: 'continue pula o restante da volta quando i é 1; break encerra o laço quando i é 3. Só 0 e 2 são impressos.',
  },
  {
    id: 'dq.python.funcoes.1',
    track: 'python',
    topicKey: 'ds.python.funcoes',
    level: 1,
    skill: 'Funções',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `def dobro(x):
    return x * 2

print(dobro(dobro(3)))`,
    options: ['6', '9', '12', '36'],
    answer: 2,
    explanation: 'A chamada interna devolve 6, que é passado para a chamada externa: 6 * 2 = 12.',
  },
  {
    id: 'dq.python.funcoes.2',
    track: 'python',
    topicKey: 'ds.python.funcoes',
    level: 2,
    skill: 'Funções',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `def saudacao(nome, cumprimento='Olá'):
    return f'{cumprimento}, {nome}!'

print(saudacao('Bia', cumprimento='Oi'))`,
    options: ['Olá, Bia!', 'Oi, Bia!', 'Bia, Oi!', 'Ocorre um TypeError'],
    answer: 1,
    explanation: 'O valor padrão só é usado quando o argumento não é informado; aqui cumprimento foi passado por nome com o valor "Oi".',
  },
  {
    id: 'dq.python.funcoes.3',
    track: 'python',
    topicKey: 'ds.python.funcoes',
    level: 2,
    skill: 'Funções',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `def soma(a, b):
    resultado = a + b

print(soma(2, 3))`,
    options: ['5', '0', 'Ocorre um NameError', 'None'],
    answer: 3,
    explanation: 'A função calcula o resultado, mas não o devolve. Uma função sem return devolve None.',
  },
  {
    id: 'dq.python.funcoes.4',
    track: 'python',
    topicKey: 'ds.python.funcoes',
    level: 3,
    skill: 'Funções',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `pessoas = [('Ana', 31), ('Bia', 25), ('Caio', 40)]
ordenadas = sorted(pessoas, key=lambda p: p[1], reverse=True)
print(ordenadas[0][0])`,
    options: ['Caio', 'Ana', 'Bia', '40'],
    answer: 0,
    explanation: 'A lambda usa a idade (posição 1 da tupla) como critério; com reverse=True a maior idade vem primeiro, e [0][0] pega o nome dessa pessoa.',
  },
  {
    id: 'dq.python.estruturas.1',
    track: 'python',
    topicKey: 'ds.python.estruturas',
    level: 1,
    skill: 'Estruturas de dados',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `frutas = ['maçã', 'banana', 'uva']
frutas.append('kiwi')
print(frutas[-1], len(frutas), frutas[1:3])`,
    options: [
      "uva 4 ['banana', 'uva', 'kiwi']",
      "kiwi 3 ['banana', 'uva']",
      "kiwi 4 ['banana', 'uva']",
      "kiwi 4 ['maçã', 'banana', 'uva']",
    ],
    answer: 2,
    explanation: 'append acrescenta ao final; o índice -1 é o último elemento; a lista passa a ter 4 itens; a fatia [1:3] pega as posições 1 e 2.',
  },
  {
    id: 'dq.python.estruturas.2',
    track: 'python',
    topicKey: 'ds.python.estruturas',
    level: 2,
    skill: 'Estruturas de dados',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `estoque = {'caneta': 10, 'lápis': 4}
estoque['caneta'] -= 3
estoque['borracha'] = estoque.get('borracha', 0) + 1
print(estoque)`,
    options: [
      'Ocorre um KeyError',
      "{'caneta': 7, 'lápis': 4, 'borracha': 1}",
      "{'caneta': 7, 'lápis': 4}",
      "{'caneta': 10, 'lápis': 4, 'borracha': 0}",
    ],
    answer: 1,
    explanation: 'get devolve o valor padrão (0) quando a chave não existe, sem gerar erro; somando 1, a nova chave borracha é criada com valor 1.',
  },
  {
    id: 'dq.python.estruturas.3',
    track: 'python',
    topicKey: 'ds.python.estruturas',
    level: 2,
    skill: 'Estruturas de dados',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `a = {1, 2, 3, 4}
b = {3, 4, 5}
print(len(a | b), a & b, a - b)`,
    options: ['5 {3, 4} {1, 2}', '7 {3, 4} {1, 2}', '5 {1, 2} {3, 4}', '5 {3, 4} {5}'],
    answer: 0,
    explanation: 'A união (|) tem 5 elementos distintos; a interseção (&) são os elementos comuns; a diferença (-) são os que estão em a e não estão em b.',
  },
  {
    id: 'dq.python.estruturas.4',
    track: 'python',
    topicKey: 'ds.python.estruturas',
    level: 2,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `palavras = ['sql', 'python', 'sql', 'ml', 'python', 'sql']
contagem = {}
for p in palavras:
    contagem[p] = contagem.get(p, 0) + 1
print(max(contagem, key=contagem.get), contagem['python'])`,
    options: ['python 2', 'sql 3', 'ml 1', 'sql 2'],
    answer: 3,
    explanation: 'O dicionário termina com sql: 3, python: 2 e ml: 1. max com key=contagem.get devolve a chave de maior contagem (sql), e contagem["python"] é 2.',
  },
  {
    id: 'dq.python.estruturas.5',
    track: 'python',
    topicKey: 'ds.python.estruturas',
    level: 3,
    skill: 'Estruturas de dados',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `a = [1, 2, 3]
b = a
c = a.copy()
b.append(4)
print(len(a), len(c))`,
    options: ['3 3', '4 4', '4 3', '3 4'],
    answer: 2,
    explanation: 'b = a não copia a lista: os dois nomes apontam para o mesmo objeto, então o append aparece em a. Já c é uma cópia independente e continua com 3 itens.',
  },
  {
    id: 'dq.python.arquivos.1',
    track: 'python',
    topicKey: 'ds.python.arquivos',
    level: 1,
    skill: 'Manipulação de arquivos',
    kind: 'practical',
    prompt: 'Qual trecho lê todas as linhas de dados.txt e garante que o arquivo seja fechado mesmo se ocorrer um erro durante a leitura?',
    options: [
      "f = open('dados.txt', 'w')\nlinhas = f.readlines()",
      "with open('dados.txt', encoding='utf-8') as f:\n    linhas = f.readlines()",
      "linhas = read('dados.txt')",
      "f = open('dados.txt', encoding='utf-8')\nlinhas = f.readlines()",
    ],
    answer: 1,
    explanation: "O with fecha o arquivo automaticamente ao sair do bloco, inclusive em caso de exceção. O modo 'w' apagaria o conteúdo, e abrir sem with deixa o fechamento por sua conta.",
  },
  {
    id: 'dq.python.arquivos.2',
    track: 'python',
    topicKey: 'ds.python.arquivos',
    level: 2,
    skill: 'Manipulação de arquivos',
    kind: 'practical',
    prompt: 'Um script roda todos os dias e precisa acrescentar uma linha ao final de log.txt sem apagar o que já existe. Qual modo usar em open()?',
    options: ["'r'", "'w'", "'a'", "'x'"],
    answer: 2,
    explanation: "'a' (append) escreve no final do arquivo, preservando o conteúdo. 'w' apaga tudo antes de escrever, 'r' só lê e 'x' falha se o arquivo já existir.",
  },
  {
    id: 'dq.python.arquivos.3',
    track: 'python',
    topicKey: 'ds.python.arquivos',
    level: 2,
    skill: 'Manipulação de arquivos',
    kind: 'practical',
    prompt: 'O arquivo vendas.csv tem o conteúdo mostrado nas três primeiras linhas. O que o código imprime?',
    code: `produto,valor
caneta,3
caderno,18

import csv

with open('vendas.csv', encoding='utf-8') as f:
    linhas = list(csv.DictReader(f))
print(len(linhas), linhas[1]['produto'], type(linhas[0]['valor']).__name__)`,
    options: ['2 caderno str', '3 caneta str', '2 caderno int', '3 caderno int'],
    answer: 0,
    explanation: 'O DictReader usa a primeira linha como cabeçalho, então sobram 2 registros. O módulo csv sempre lê os valores como texto (str); a conversão para número é feita por você.',
  },
  {
    id: 'dq.python.erros.1',
    track: 'python',
    topicKey: 'ds.python.erros',
    level: 1,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `try:
    valor = int('12a')
except ValueError:
    valor = 0
finally:
    print('fim')
print(valor)`,
    options: [
      '0 e, na linha seguinte, fim',
      'fim e, na linha seguinte, 0',
      'Apenas a mensagem de erro ValueError',
      'fim e, na linha seguinte, 12',
    ],
    answer: 1,
    explanation: "int('12a') gera ValueError, o except define valor = 0, o finally sempre executa (imprime fim) e só depois o último print mostra 0.",
  },
  {
    id: 'dq.python.erros.2',
    track: 'python',
    topicKey: 'ds.python.erros',
    level: 2,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `def dividir(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None

print(dividir(10, 0), dividir(9, 3))`,
    options: ['0 3', 'Ocorre um ZeroDivisionError', 'None 3', 'None 3.0'],
    answer: 3,
    explanation: 'A divisão por zero é capturada e a função devolve None; 9 / 3 é uma divisão real e devolve o float 3.0.',
  },
  {
    id: 'dq.python.numpy.1',
    track: 'python',
    topicKey: 'ds.python.numpy',
    level: 1,
    skill: 'NumPy',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import numpy as np

a = np.array([1, 2, 3])
print(a * 2, a.sum())`,
    options: ['[1 2 3 1 2 3] 6', '[2 4 6] 6', '[2 4 6] 12', '[1 2 3 1 2 3] 12'],
    answer: 1,
    explanation: 'Em um array NumPy a multiplicação é feita elemento a elemento ([2 4 6]), diferente de uma lista, que seria repetida. a.sum() soma o array original: 6.',
  },
  {
    id: 'dq.python.numpy.2',
    track: 'python',
    topicKey: 'ds.python.numpy',
    level: 2,
    skill: 'NumPy',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import numpy as np

m = np.arange(6).reshape(2, 3)
print(m.shape, m[1, 0], m.sum(axis=0))`,
    options: ['(3, 2) 2 [3 5 7]', '(2, 3) 3 [ 3 12]', '(2, 3) 3 [3 5 7]', '(2, 3) 1 [3 5 7]'],
    answer: 2,
    explanation: 'm é [[0, 1, 2], [3, 4, 5]]: 2 linhas e 3 colunas. m[1, 0] é o primeiro elemento da segunda linha (3) e axis=0 soma ao longo das linhas, coluna por coluna: [3 5 7].',
  },
  {
    id: 'dq.python.numpy.3',
    track: 'python',
    topicKey: 'ds.python.numpy',
    level: 2,
    skill: 'NumPy',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import numpy as np

v = np.array([5, 12, 7, 20, 3])
print(v[v > 6].mean())`,
    options: ['9.4', '13.0', '39', '3'],
    answer: 1,
    explanation: 'A máscara booleana v > 6 seleciona 12, 7 e 20; a média desses três valores é 39 / 3 = 13.0.',
  },
  {
    id: 'dq.python.numpy.4',
    track: 'python',
    topicKey: 'ds.python.numpy',
    level: 3,
    skill: 'NumPy',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import numpy as np

a = np.array([[1, 2], [3, 4]])
b = np.array([10, 20])
print((a + b)[1])`,
    options: ['[11 22]', '[13 14]', 'Ocorre um ValueError', '[13 24]'],
    answer: 3,
    explanation: 'Por broadcasting, b é somado a cada linha de a: o resultado é [[11, 22], [13, 24]] e o índice 1 seleciona a segunda linha.',
  },
  {
    id: 'dq.python.pandas.1',
    track: 'python',
    topicKey: 'ds.python.pandas',
    level: 1,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'Qual expressão devolve apenas as linhas de df com preco maior que 10?',
    code: DF_PRODUTOS,
    options: ["df['preco' > 10]", 'df.filter(preco > 10)', "df[df['preco'] > 10]", "df.where('preco' > 10)"],
    answer: 2,
    explanation: "df['preco'] > 10 gera uma Series de True/False; usada entre colchetes, ela mantém apenas as linhas marcadas como True.",
  },
  {
    id: 'dq.python.pandas.2',
    track: 'python',
    topicKey: 'ds.python.pandas',
    level: 2,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'Depois de criar df, o que a linha final imprime?',
    code: `${DF_PRODUTOS}

print(df.groupby('categoria')['preco'].sum()['escrita'])`,
    options: ['3.0', '5.0', '2', '143.0'],
    answer: 1,
    explanation: 'O groupby soma o preço dentro de cada categoria; em "escrita" estão a caneta (3.0) e o lápis (2.0), total 5.0.',
  },
  {
    id: 'dq.python.pandas.3',
    track: 'python',
    topicKey: 'ds.python.pandas',
    level: 2,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import pandas as pd

s = pd.Series([10.0, None, 20.0, 30.0])
print(s.mean(), s.fillna(0).mean(), s.isna().sum())`,
    options: ['nan 15.0 1', '15.0 15.0 1', '20.0 20.0 0', '20.0 15.0 1'],
    answer: 3,
    explanation: 'mean() ignora valores ausentes: 60 / 3 = 20.0. Depois do fillna(0) o zero entra na conta: 60 / 4 = 15.0. isna().sum() conta 1 valor ausente.',
  },
  {
    id: 'dq.python.pandas.4',
    track: 'python',
    topicKey: 'ds.python.pandas',
    level: 2,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import pandas as pd

clientes = pd.DataFrame({'id': [1, 2, 3], 'nome': ['Ana', 'Bruno', 'Carla']})
pedidos = pd.DataFrame({'cliente_id': [1, 1, 2], 'valor': [100, 50, 200]})
r = clientes.merge(pedidos, left_on='id', right_on='cliente_id', how='left')
print(len(r), r['valor'].isna().sum())`,
    options: ['4 1', '3 0', '3 1', '4 0'],
    answer: 0,
    explanation: "O merge com how='left' funciona como um LEFT JOIN: Ana aparece duas vezes, Bruno uma e Carla uma vez com valor ausente (NaN). São 4 linhas e 1 ausente.",
  },
  {
    id: 'dq.python.pandas.5',
    track: 'python',
    topicKey: 'ds.python.pandas',
    level: 3,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'Depois de criar df, o que a linha final imprime?',
    code: `${DF_PRODUTOS}

print(df.sort_values('preco', ascending=False).head(2)['produto'].tolist())`,
    options: ["['lápis', 'caneta']", "['caneta', 'caderno']", "['mochila', 'caderno']", "['mochila']"],
    answer: 2,
    explanation: 'sort_values com ascending=False ordena do maior para o menor preço; head(2) pega as duas primeiras linhas: mochila (120.0) e caderno (18.0).',
  },
  {
    id: 'dq.python.visualizacao.1',
    track: 'python',
    topicKey: 'ds.python.visualizacao',
    level: 1,
    skill: 'Resolução de problemas',
    kind: 'concept',
    prompt: 'Qual gráfico é o mais indicado para ver a distribuição de uma variável numérica contínua, como a idade dos clientes?',
    options: ['Gráfico de pizza', 'Histograma', 'Gráfico de linhas', 'Gráfico de dispersão'],
    answer: 1,
    explanation: 'O histograma divide os valores em faixas e mostra quantas observações caem em cada uma, revelando a forma da distribuição.',
  },
  {
    id: 'dq.python.visualizacao.2',
    track: 'python',
    topicKey: 'ds.python.visualizacao',
    level: 2,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'Considerando "import matplotlib.pyplot as plt" e duas listas x e y, qual trecho cria um gráfico de dispersão e nomeia o eixo horizontal como "Preço"?',
    options: [
      "fig, ax = plt.subplots()\nax.plot(x, y)\nax.xlabel = 'Preço'",
      "plt.bar(x, y)\nplt.title('Preço')",
      "plt.hist(x)\nplt.ylabel('Preço')",
      "fig, ax = plt.subplots()\nax.scatter(x, y)\nax.set_xlabel('Preço')",
    ],
    answer: 3,
    explanation: 'scatter desenha o gráfico de dispersão e set_xlabel define o rótulo do eixo x. plot desenha linhas, bar desenha barras e hist desenha um histograma.',
  },
  {
    id: 'dq.python.eda.1',
    track: 'python',
    topicKey: 'ds.python.eda',
    level: 1,
    skill: 'Pandas',
    kind: 'concept',
    prompt: 'Você acabou de carregar um CSV em df. Qual método mostra contagem, média, desvio-padrão, mínimo, quartis e máximo das colunas numéricas?',
    options: ['df.info()', 'df.describe()', 'df.head()', 'df.sort_values()'],
    answer: 1,
    explanation: 'describe() devolve as estatísticas descritivas das colunas numéricas. info() mostra tipos e contagem de não nulos, e head() mostra as primeiras linhas.',
  },
  {
    id: 'dq.python.eda.2',
    track: 'python',
    topicKey: 'ds.python.eda',
    level: 2,
    skill: 'Pandas',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `import pandas as pd

s = pd.Series(['SP', 'RJ', 'SP', 'MG', 'SP', 'RJ'])
print(s.value_counts().index[0], s.nunique())`,
    options: ['RJ 3', 'SP 6', 'SP 3', 'MG 1'],
    answer: 2,
    explanation: 'value_counts ordena do valor mais frequente para o menos frequente, então o primeiro índice é SP; nunique conta os valores distintos (SP, RJ e MG).',
  },
  {
    id: 'dq.python.automacao.1',
    track: 'python',
    topicKey: 'ds.python.automacao',
    level: 2,
    skill: 'Manipulação de arquivos',
    kind: 'practical',
    prompt: 'O que este código imprime?',
    code: `from pathlib import Path

p = Path('relatorios/2025/vendas_jan.csv')
print(p.suffix, p.stem, p.parent.name)`,
    options: [
      '.csv vendas_jan 2025',
      'csv vendas_jan.csv relatorios',
      '.csv vendas_jan.csv 2025',
      'csv vendas_jan relatorios',
    ],
    answer: 0,
    explanation: 'suffix é a extensão com o ponto (.csv), stem é o nome do arquivo sem a extensão (vendas_jan) e parent.name é o nome da pasta que o contém (2025).',
  },
  {
    id: 'dq.python.automacao.2',
    track: 'python',
    topicKey: 'ds.python.automacao',
    level: 2,
    skill: 'Resolução de problemas',
    kind: 'practical',
    prompt: 'Considerando "from pathlib import Path", qual trecho lista os arquivos .csv que estão diretamente na pasta dados, sem entrar em subpastas?',
    options: [
      "list(Path('dados').rglob('*.csv'))",
      "list(Path('dados').glob('*.csv'))",
      "open('dados/*.csv')",
      "Path('dados').read_text('*.csv')",
    ],
    answer: 1,
    explanation: 'glob("*.csv") procura apenas na própria pasta. rglob faz a busca recursiva, incluindo subpastas, e open não aceita curingas.',
  },
]

const ML_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'dq.ml.estatistica.1',
    track: 'ml',
    topicKey: 'ds.ml.estatistica',
    level: 1,
    skill: 'Estatística',
    kind: 'practical',
    prompt: 'Os salários de cinco pessoas (em milhares de reais) estão abaixo. Qual medida representa melhor o salário típico do grupo?',
    code: '2, 4, 4, 6, 100',
    options: [
      'A média (23,2), porque usa todos os valores.',
      'A mediana (4), porque não é distorcida pelo valor extremo.',
      'O máximo (100), porque mostra o potencial do grupo.',
      'A amplitude (98), porque mostra a diferença entre os extremos.',
    ],
    answer: 1,
    explanation: 'O valor 100 puxa a média para 23,2, acima de quatro dos cinco salários. A mediana (valor central, 4) é robusta a valores atípicos.',
  },
  {
    id: 'dq.ml.estatistica.2',
    track: 'ml',
    topicKey: 'ds.ml.estatistica',
    level: 1,
    skill: 'Estatística',
    kind: 'concept',
    prompt: 'O que o desvio-padrão de uma variável mede?',
    options: [
      'O valor que mais se repete.',
      'O valor que divide os dados ao meio.',
      'A diferença entre o maior e o menor valor.',
      'O quanto os valores se dispersam em torno da média.',
    ],
    answer: 3,
    explanation: 'O desvio-padrão é a raiz quadrada da variância e indica a distância típica dos valores em relação à média. As outras alternativas descrevem moda, mediana e amplitude.',
  },
  {
    id: 'dq.ml.estatistica.3',
    track: 'ml',
    topicKey: 'ds.ml.estatistica',
    level: 2,
    skill: 'Interpretação dos resultados',
    kind: 'concept',
    prompt: 'Em uma cidade litorânea, a venda de sorvetes e o número de afogamentos têm correlação de 0,85. O que se pode concluir?',
    options: [
      'As duas variáveis crescem juntas, mas isso não prova que uma causa a outra; o calor pode influenciar ambas.',
      'Vender sorvete causa afogamentos.',
      'Afogamentos aumentam a venda de sorvetes.',
      'As duas variáveis não têm relação, pois a correlação é menor que 1.',
    ],
    answer: 0,
    explanation: 'Correlação mede associação, não causalidade. Uma terceira variável (a temperatura) pode explicar o aumento das duas ao mesmo tempo.',
  },
  {
    id: 'dq.ml.probabilidade.1',
    track: 'ml',
    topicKey: 'ds.ml.probabilidade',
    level: 1,
    skill: 'Estatística',
    kind: 'practical',
    prompt: 'Uma urna tem 3 bolas vermelhas e 2 azuis. Retirando duas bolas sem reposição, qual é a probabilidade de as duas serem vermelhas?',
    options: ['9/25', '3/10', '3/5', '1/2'],
    answer: 1,
    explanation: 'A primeira é vermelha com probabilidade 3/5; restando 2 vermelhas em 4 bolas, a segunda é vermelha com 2/4. O produto é 6/20 = 3/10.',
  },
  {
    id: 'dq.ml.probabilidade.2',
    track: 'ml',
    topicKey: 'ds.ml.probabilidade',
    level: 3,
    skill: 'Estatística',
    kind: 'practical',
    prompt: 'Uma doença atinge 1% da população. Um teste detecta 90% dos doentes e dá falso positivo em 10% dos saudáveis. Se uma pessoa testou positivo, qual é a probabilidade aproximada de estar doente?',
    options: ['Cerca de 90%', 'Cerca de 50%', 'Cerca de 8%', 'Cerca de 1%'],
    answer: 2,
    explanation: 'Pelo teorema de Bayes: 0,01 × 0,90 / (0,01 × 0,90 + 0,99 × 0,10) = 0,009 / 0,108 ≈ 8,3%. Como a doença é rara, a maioria dos positivos vem dos saudáveis.',
  },
  {
    id: 'dq.ml.algebra.1',
    track: 'ml',
    topicKey: 'ds.ml.algebra',
    level: 1,
    skill: 'Treinamento',
    kind: 'practical',
    prompt: 'Um modelo linear calcula a previsão como o produto escalar entre os pesos e as variáveis. Qual é o produto escalar dos vetores abaixo?',
    code: `w = [1, 2, 3]
x = [4, 0, -1]`,
    options: ['1', '7', '[4, 0, -3]', '12'],
    answer: 0,
    explanation: 'O produto escalar soma os produtos elemento a elemento: 1 × 4 + 2 × 0 + 3 × (−1) = 4 + 0 − 3 = 1.',
  },
  {
    id: 'dq.ml.algebra.2',
    track: 'ml',
    topicKey: 'ds.ml.algebra',
    level: 2,
    skill: 'Treinamento',
    kind: 'practical',
    prompt: 'X é uma matriz de dados com shape (100, 3) e w é um vetor de pesos com shape (3,). Qual é o shape de X @ w no NumPy?',
    options: ['(3,)', '(100, 3)', '(100,)', 'Ocorre um erro de dimensões incompatíveis'],
    answer: 2,
    explanation: 'O produto de uma matriz 100 × 3 por um vetor de 3 elementos gera um vetor com 100 valores: uma previsão para cada linha de X.',
  },
  {
    id: 'dq.ml.preparacao.1',
    track: 'ml',
    topicKey: 'ds.ml.preparacao',
    level: 1,
    skill: 'Preparação de dados',
    kind: 'concept',
    prompt: 'A coluna "cidade" tem valores como Recife, Natal e Fortaleza, sem ordem entre eles. Como prepará-la para uma regressão linear?',
    options: [
      'Numerar as cidades em ordem alfabética (1, 2, 3…).',
      'Aplicar StandardScaler diretamente ao texto.',
      'Manter o texto como está; o modelo converte sozinho.',
      'Aplicar one-hot encoding, criando uma coluna indicadora para cada cidade.',
    ],
    answer: 3,
    explanation: 'Numerar categorias sem ordem cria uma falsa relação de grandeza entre elas. O one-hot encoding representa cada categoria por uma coluna 0/1, sem impor ordem.',
  },
  {
    id: 'dq.ml.preparacao.2',
    track: 'ml',
    topicKey: 'ds.ml.preparacao',
    level: 2,
    skill: 'Preparação de dados',
    kind: 'concept',
    prompt: 'Você vai padronizar as variáveis numéricas com StandardScaler. Qual é o procedimento correto?',
    options: [
      'Ajustar o scaler (fit) apenas no treino e aplicar transform no treino e no teste.',
      'Ajustar o scaler em todos os dados e só depois separar treino e teste.',
      'Ajustar um scaler no treino e outro, separado, no teste.',
      'Ajustar o scaler apenas no teste e aplicar transform no treino.',
    ],
    answer: 0,
    explanation: 'A média e o desvio-padrão devem ser aprendidos só com o treino. Usar o teste nesse cálculo é vazamento de dados: o modelo recebe informação que não teria em produção.',
  },
  {
    id: 'dq.ml.preparacao.3',
    track: 'ml',
    topicKey: 'ds.ml.preparacao',
    level: 2,
    skill: 'Preparação de dados',
    kind: 'concept',
    prompt: 'A coluna "renda" tem 5% de valores ausentes e uma distribuição muito assimétrica, com alguns valores altíssimos. Qual é a estratégia simples mais adequada?',
    options: [
      'Preencher com zero, pois é um valor neutro.',
      'Excluir a coluna inteira do modelo.',
      'Preencher com a mediana calculada no conjunto de treino.',
      'Preencher com a média calculada com treino e teste juntos.',
    ],
    answer: 2,
    explanation: 'A mediana é robusta aos valores extremos e deve ser calculada apenas no treino para evitar vazamento. Zero distorce a distribuição, e descartar a coluna por 5% de ausentes desperdiça informação.',
  },
  {
    id: 'dq.ml.regressao.1',
    track: 'ml',
    topicKey: 'ds.ml.regressao',
    level: 1,
    skill: 'Interpretação dos resultados',
    kind: 'practical',
    prompt: 'Um modelo de regressão linear para preço de imóveis chegou à equação abaixo. Como interpretar o coeficiente 3000?',
    code: 'preco = 50000 + 3000 * area_m2',
    options: [
      'Todo imóvel custa pelo menos R$ 3.000.',
      'Cada metro quadrado adicional aumenta o preço previsto em R$ 3.000.',
      'O modelo erra, em média, R$ 3.000.',
      'A área explica 3.000% da variação do preço.',
    ],
    answer: 1,
    explanation: 'O coeficiente indica quanto a previsão muda quando a variável aumenta em uma unidade. O valor fixo (intercepto) é 50000.',
  },
  {
    id: 'dq.ml.regressao.2',
    track: 'ml',
    topicKey: 'ds.ml.regressao',
    level: 2,
    skill: 'Avaliação de modelos',
    kind: 'practical',
    prompt: 'Qual é o erro absoluto médio (MAE) das previsões abaixo?',
    code: `valores reais:     10, 20, 30
valores previstos: 12, 18, 33`,
    options: ['Aproximadamente 2,33', 'Aproximadamente 5,67', '7', '1'],
    answer: 0,
    explanation: 'Os erros absolutos são 2, 2 e 3; a média é 7 / 3 ≈ 2,33. O valor 5,67 é o erro quadrático médio (MSE).',
  },
  {
    id: 'dq.ml.classificacao.1',
    track: 'ml',
    topicKey: 'ds.ml.classificacao',
    level: 1,
    skill: 'Seleção de algoritmos',
    kind: 'concept',
    prompt: 'Uma empresa quer prever se cada cliente vai cancelar a assinatura no próximo mês (sim ou não), usando um histórico em que o resultado é conhecido. Que tipo de problema é esse?',
    options: [
      'Regressão, resolvida com regressão linear.',
      'Agrupamento, resolvido com K-Means.',
      'Classificação binária, resolvida, por exemplo, com regressão logística.',
      'Redução de dimensionalidade, resolvida com PCA.',
    ],
    answer: 2,
    explanation: 'O alvo tem duas categorias e há rótulos históricos: é classificação supervisionada binária. Regressão prevê números contínuos, e K-Means e PCA não usam rótulos.',
  },
  {
    id: 'dq.ml.classificacao.2',
    track: 'ml',
    topicKey: 'ds.ml.classificacao',
    level: 2,
    skill: 'Interpretação dos resultados',
    kind: 'concept',
    prompt: 'Um classificador marca como positivo quem tem probabilidade prevista acima de 0,5. O que tende a acontecer se o limiar for reduzido para 0,2?',
    options: [
      'Menos casos são marcados como positivos: o recall sobe e a precisão cai.',
      'Nada muda, pois o limiar não afeta as previsões.',
      'Mais casos são marcados como positivos: a precisão sobe e o recall cai.',
      'Mais casos são marcados como positivos: o recall tende a subir e a precisão tende a cair.',
    ],
    answer: 3,
    explanation: 'Com um limiar menor, o modelo marca mais casos como positivos: captura mais positivos reais (recall maior), mas inclui mais falsos positivos (precisão menor).',
  },
  {
    id: 'dq.ml.arvores.1',
    track: 'ml',
    topicKey: 'ds.ml.arvores',
    level: 2,
    skill: 'Treinamento',
    kind: 'concept',
    prompt: 'Uma árvore de decisão sem limite de profundidade tem 100% de acurácia no treino e 70% no teste. O que está acontecendo e o que fazer?',
    options: [
      'Subajuste (underfitting): é preciso aumentar a profundidade.',
      'Sobreajuste (overfitting): limitar a profundidade ou exigir mais amostras por folha.',
      'O modelo está ideal: 100% no treino é o objetivo.',
      'O conjunto de teste está errado e deve ser descartado.',
    ],
    answer: 1,
    explanation: 'A árvore memorizou o treino e não generaliza. Restringir a complexidade (max_depth, min_samples_leaf) ou usar um conjunto de árvores reduz o sobreajuste.',
  },
  {
    id: 'dq.ml.arvores.2',
    track: 'ml',
    topicKey: 'ds.ml.arvores',
    level: 2,
    skill: 'Seleção de algoritmos',
    kind: 'concept',
    prompt: 'Como uma Random Forest obtém resultados mais estáveis do que uma única árvore de decisão?',
    options: [
      'Treina muitas árvores em amostras aleatórias dos dados e das variáveis e combina as previsões.',
      'Treina uma única árvore muito mais profunda.',
      'Treina árvores em sequência, cada uma corrigindo os erros da anterior.',
      'Padroniza as variáveis antes de treinar uma única árvore.',
    ],
    answer: 0,
    explanation: 'A Random Forest usa bagging: cada árvore vê uma amostra diferente dos dados e um subconjunto das variáveis; a média ou o voto reduz a variância. Árvores em sequência descrevem o boosting.',
  },
  {
    id: 'dq.ml.boosting.1',
    track: 'ml',
    topicKey: 'ds.ml.boosting',
    level: 2,
    skill: 'Seleção de algoritmos',
    kind: 'concept',
    prompt: 'O que caracteriza o Gradient Boosting em relação à Random Forest?',
    options: [
      'As árvores são treinadas de forma independente e em paralelo.',
      'Usa uma única árvore muito profunda.',
      'As árvores são treinadas em sequência, cada uma corrigindo os erros do conjunto anterior.',
      'Não usa árvores, apenas modelos lineares.',
    ],
    answer: 2,
    explanation: 'No boosting, cada nova árvore é ajustada aos erros (resíduos) que o conjunto atual ainda comete, e as contribuições são somadas.',
  },
  {
    id: 'dq.ml.boosting.2',
    track: 'ml',
    topicKey: 'ds.ml.boosting',
    level: 3,
    skill: 'Treinamento',
    kind: 'concept',
    prompt: 'Ao reduzir a taxa de aprendizado (learning_rate) de 0,3 para 0,03 em um Gradient Boosting, o que normalmente é preciso ajustar para manter o desempenho?',
    options: [
      'Reduzir o número de árvores na mesma proporção.',
      'Remover o conjunto de validação.',
      'Padronizar as variáveis de entrada.',
      'Aumentar o número de árvores, de preferência com parada antecipada (early stopping).',
    ],
    answer: 3,
    explanation: 'Com passos menores, cada árvore contribui menos e o modelo precisa de mais árvores para convergir. A parada antecipada encontra a quantidade adequada usando um conjunto de validação.',
  },
  {
    id: 'dq.ml.nao_supervisionado.1',
    track: 'ml',
    topicKey: 'ds.ml.nao_supervisionado',
    level: 1,
    skill: 'Seleção de algoritmos',
    kind: 'concept',
    prompt: 'Uma loja quer dividir seus clientes em grupos de comportamento parecido, mas não existe nenhuma coluna dizendo a que grupo cada cliente pertence. Qual técnica é a mais indicada?',
    options: ['Regressão linear', 'K-Means', 'Regressão logística', 'Random Forest para classificação'],
    answer: 1,
    explanation: 'Sem rótulos, o problema é de aprendizado não supervisionado. O K-Means agrupa observações semelhantes; as outras opções exigem uma variável-alvo.',
  },
  {
    id: 'dq.ml.nao_supervisionado.2',
    track: 'ml',
    topicKey: 'ds.ml.nao_supervisionado',
    level: 2,
    skill: 'Preparação de dados',
    kind: 'concept',
    prompt: 'Você vai aplicar K-Means a duas variáveis: renda anual (de 20.000 a 300.000) e idade (de 18 a 80). Por que é importante padronizá-las antes?',
    options: [
      'Porque o K-Means se baseia em distâncias, e a variável de maior escala dominaria o agrupamento.',
      'Porque o K-Means só aceita valores entre 0 e 1.',
      'Porque a padronização define automaticamente o número de grupos.',
      'Não é importante: o K-Means não é afetado pela escala das variáveis.',
    ],
    answer: 0,
    explanation: 'Sem padronizar, diferenças de milhares na renda pesariam muito mais que diferenças de dezenas na idade, e os grupos refletiriam quase só a renda.',
  },
  {
    id: 'dq.ml.avaliacao.1',
    track: 'ml',
    topicKey: 'ds.ml.avaliacao',
    level: 2,
    skill: 'Avaliação de modelos',
    kind: 'practical',
    prompt: 'Com a matriz de confusão abaixo, quais são a precisão e o recall da classe positiva?',
    code: `                 previsto positivo | previsto negativo
real positivo            40        |        20
real negativo            10        |        30`,
    options: [
      'Precisão 0,67 e recall 0,80',
      'Precisão 0,70 e recall 0,70',
      'Precisão 0,80 e recall 0,67',
      'Precisão 0,40 e recall 0,60',
    ],
    answer: 2,
    explanation: 'Precisão = VP / (VP + FP) = 40 / 50 = 0,80. Recall = VP / (VP + FN) = 40 / 60 ≈ 0,67. O valor 0,70 é a acurácia.',
  },
  {
    id: 'dq.ml.avaliacao.2',
    track: 'ml',
    topicKey: 'ds.ml.avaliacao',
    level: 2,
    skill: 'Avaliação de modelos',
    kind: 'concept',
    prompt: 'Em uma base de fraudes, 99% das transações são legítimas. Um modelo que sempre responde "legítima" atinge 99% de acurácia. O que isso mostra?',
    options: [
      'Que o modelo é excelente e pode ir para produção.',
      'Que a acurácia engana em classes desbalanceadas; é melhor olhar recall, precisão e F1 da classe de fraude.',
      'Que a base está errada e precisa ser descartada.',
      'Que acurácia e recall são sempre iguais.',
    ],
    answer: 1,
    explanation: 'O modelo não detecta nenhuma fraude (recall zero), mas a acurácia fica alta por causa da classe majoritária. Métricas focadas na classe de interesse revelam o problema.',
  },
  {
    id: 'dq.ml.avaliacao.3',
    track: 'ml',
    topicKey: 'ds.ml.avaliacao',
    level: 3,
    skill: 'Avaliação de modelos',
    kind: 'practical',
    prompt: 'Um classificador tem precisão 0,50 e recall 1,00. Qual é o F1?',
    options: ['0,75', '0,50', '1,00', 'Aproximadamente 0,67'],
    answer: 3,
    explanation: 'F1 é a média harmônica: 2 × (0,50 × 1,00) / (0,50 + 1,00) = 1,00 / 1,50 ≈ 0,67. Ela fica mais próxima do menor dos dois valores do que a média simples (0,75).',
  },
  {
    id: 'dq.ml.validacao.1',
    track: 'ml',
    topicKey: 'ds.ml.validacao',
    level: 1,
    skill: 'Validação',
    kind: 'concept',
    prompt: 'Por que os dados são separados em treino e teste antes de treinar um modelo?',
    options: [
      'Para estimar o desempenho do modelo em dados que ele nunca viu.',
      'Para que o treinamento fique mais rápido.',
      'Para aumentar a quantidade de dados disponíveis.',
      'Para que o modelo decore melhor os exemplos.',
    ],
    answer: 0,
    explanation: 'Avaliar com os mesmos dados usados no treino superestima o desempenho. O conjunto de teste simula dados novos e mede a capacidade de generalização.',
  },
  {
    id: 'dq.ml.validacao.2',
    track: 'ml',
    topicKey: 'ds.ml.validacao',
    level: 2,
    skill: 'Validação',
    kind: 'practical',
    prompt: 'Em uma validação cruzada de 5 partes (5-fold) com 1.000 amostras, o que acontece em cada rodada?',
    options: [
      'O modelo treina com 200 amostras e é validado com 800.',
      'O modelo treina com as 1.000 amostras e é validado com 200 sorteadas entre elas.',
      'O modelo treina com 800 amostras e é validado com as 200 restantes; ao final, cada amostra foi usada uma vez na validação.',
      'O modelo treina com 500 amostras e é validado com 500.',
    ],
    answer: 2,
    explanation: 'Os dados são divididos em 5 partes de 200. Em cada rodada, uma parte fica para validação e as outras quatro (800) para treino; as partes se revezam.',
  },
  {
    id: 'dq.ml.validacao.3',
    track: 'ml',
    topicKey: 'ds.ml.validacao',
    level: 3,
    skill: 'Validação',
    kind: 'concept',
    prompt: 'Você vai prever as vendas das próximas semanas a partir do histórico diário. Como validar o modelo corretamente?',
    options: [
      'Com K-Fold embaralhando as datas, para misturar bem os períodos.',
      'Treinando sempre com o período anterior e validando no período seguinte, sem embaralhar (por exemplo, TimeSeriesSplit).',
      'Usando os mesmos dados para treino e validação.',
      'Validando apenas com os dias mais antigos do histórico.',
    ],
    answer: 1,
    explanation: 'Em séries temporais, embaralhar faz o modelo treinar com o futuro para prever o passado. A validação deve respeitar a ordem do tempo.',
  },
  {
    id: 'dq.ml.features.1',
    track: 'ml',
    topicKey: 'ds.ml.features',
    level: 2,
    skill: 'Preparação de dados',
    kind: 'practical',
    prompt: 'A base tem a coluna "data_compra" (por exemplo, 2025-03-14). Qual é a melhor forma de aproveitá-la em um modelo que prevê vendas?',
    options: [
      'Usar o texto da data como está.',
      'Aplicar one-hot encoding com uma coluna para cada data distinta.',
      'Remover a coluna, pois datas nunca ajudam.',
      'Derivar variáveis como dia da semana, mês e indicador de fim de semana.',
    ],
    answer: 3,
    explanation: 'O modelo não aproveita uma data bruta, e uma coluna por data não generaliza para datas futuras. Variáveis derivadas capturam padrões que se repetem, como sazonalidade semanal e mensal.',
  },
  {
    id: 'dq.ml.features.2',
    track: 'ml',
    topicKey: 'ds.ml.features',
    level: 3,
    skill: 'Interpretação dos resultados',
    kind: 'concept',
    prompt: 'Um modelo deve prever, no momento da concessão do crédito, se o cliente ficará inadimplente. Ele usa a variável "dias_em_atraso_na_ultima_parcela" e atinge 99% de acerto. Qual é o problema?',
    options: [
      'Nenhum: quanto maior o acerto, melhor o modelo.',
      'A variável tem escala diferente das demais.',
      'Vazamento do alvo: essa informação só existe depois do evento que se quer prever.',
      'O modelo está subajustado.',
    ],
    answer: 2,
    explanation: 'A variável só é conhecida depois da concessão e praticamente revela a resposta. Em produção ela não estará disponível, e o desempenho real será muito pior.',
  },
  {
    id: 'dq.ml.pipelines.1',
    track: 'ml',
    topicKey: 'ds.ml.pipelines',
    level: 2,
    skill: 'Validação',
    kind: 'practical',
    prompt: 'Qual é a principal vantagem de colocar o StandardScaler dentro do Pipeline neste código?',
    code: `pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('model', LogisticRegression()),
])
scores = cross_val_score(pipe, X, y, cv=5)`,
    options: [
      'Em cada rodada, o scaler é ajustado apenas com a parte de treino, evitando vazamento de dados.',
      'O scaler deixa de ser necessário e é ignorado.',
      'O modelo passa a ser treinado apenas uma vez, em vez de cinco.',
      'O Pipeline escolhe automaticamente o melhor algoritmo.',
    ],
    answer: 0,
    explanation: 'Dentro do Pipeline, o fit de cada etapa acontece só nos dados de treino de cada rodada; a parte de validação é apenas transformada, como aconteceria com dados novos.',
  },
  {
    id: 'dq.ml.pipelines.2',
    track: 'ml',
    topicKey: 'ds.ml.pipelines',
    level: 2,
    skill: 'Preparação de dados',
    kind: 'concept',
    prompt: 'Uma base tem colunas numéricas (que precisam de padronização) e categóricas (que precisam de one-hot encoding). Qual recurso do scikit-learn aplica cada transformação ao grupo certo de colunas dentro de um Pipeline?',
    options: ['train_test_split', 'ColumnTransformer', 'GridSearchCV', 'cross_val_score'],
    answer: 1,
    explanation: 'O ColumnTransformer recebe uma lista de transformações e as colunas em que cada uma deve atuar, e junta os resultados em uma única matriz.',
  },
  {
    id: 'dq.ml.mlops.1',
    track: 'ml',
    topicKey: 'ds.ml.mlops',
    level: 1,
    skill: 'Treinamento',
    kind: 'concept',
    prompt: 'Para que serve o rastreamento de experimentos (por exemplo, com o MLflow Tracking)?',
    options: [
      'Para treinar o modelo mais rápido usando GPU.',
      'Para substituir o conjunto de teste.',
      'Para limpar os dados automaticamente.',
      'Para registrar parâmetros, métricas e artefatos de cada execução, permitindo comparar e reproduzir resultados.',
    ],
    answer: 3,
    explanation: 'Sem registro, é difícil saber qual combinação de dados, código e hiperparâmetros gerou cada resultado. O rastreamento guarda esse histórico de forma organizada.',
  },
  {
    id: 'dq.ml.mlops.2',
    track: 'ml',
    topicKey: 'ds.ml.mlops',
    level: 2,
    skill: 'Avaliação de modelos',
    kind: 'concept',
    prompt: 'Um modelo em produção tinha bom desempenho, mas piorou aos poucos ao longo de meses, sem nenhuma mudança no código. Qual é a explicação mais provável e a ação adequada?',
    options: [
      'O modelo "cansou"; basta reiniciar o servidor.',
      'O modelo estava subajustado desde o início; nada a fazer.',
      'Os dados mudaram em relação aos de treino (data drift); é preciso monitorar e treinar novamente com dados recentes.',
      'A métrica foi calculada errada no treino; basta trocar de métrica.',
    ],
    answer: 2,
    explanation: 'O comportamento dos dados muda com o tempo (novos perfis de clientes, preços, sazonalidade). Monitorar a distribuição das entradas e o desempenho indica quando treinar de novo.',
  },
]

const INGLES_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'dq.ingles.leitura.1',
    track: 'ingles',
    topicKey: 'ds.ingles.leitura',
    level: 1,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'De acordo com o trecho, o que você deve fazer?',
    code: 'This function is deprecated since version 2.0 and will be removed in a future release. Use read_table() instead.',
    options: [
      'Continuar usando a função, pois ela foi melhorada na versão 2.0.',
      'Trocar a função por read_table(), pois ela será removida em uma versão futura.',
      'Instalar a versão 2.0 para que a função passe a funcionar.',
      'Usar a função junto com read_table() para obter o resultado completo.',
    ],
    answer: 1,
    explanation: '"Deprecated" indica que o recurso está obsoleto e deixará de existir; "use … instead" recomenda a substituição.',
  },
  {
    id: 'dq.ingles.leitura.2',
    track: 'ingles',
    topicKey: 'ds.ingles.leitura',
    level: 2,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'Segundo o trecho, o que acontece quando os índices não coincidem e nenhum valor de preenchimento é informado?',
    code: 'By default, the join is performed on the index. If the indexes do not match, the missing values are filled with NaN unless a fill value is provided.',
    options: [
      'A operação gera um erro.',
      'As linhas sem correspondência são removidas.',
      'Os valores ausentes são preenchidos com zero.',
      'Os valores ausentes ficam como NaN.',
    ],
    answer: 3,
    explanation: '"Filled with NaN unless a fill value is provided" significa que o preenchimento é NaN, a não ser que um valor de preenchimento seja fornecido.',
  },
  {
    id: 'dq.ingles.leitura.3',
    track: 'ingles',
    topicKey: 'ds.ingles.leitura',
    level: 2,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'O que acontece se o parâmetro não for informado?',
    code: 'Note: This parameter is optional. If omitted, it defaults to None, in which case all columns are used.',
    options: [
      'Todas as colunas são usadas.',
      'Nenhuma coluna é usada.',
      'A função gera um erro pedindo o parâmetro.',
      'Apenas a primeira coluna é usada.',
    ],
    answer: 0,
    explanation: '"If omitted, it defaults to None" indica o valor padrão quando o parâmetro é omitido, e "in which case all columns are used" descreve o efeito: todas as colunas.',
  },
  {
    id: 'dq.ingles.leitura.4',
    track: 'ingles',
    topicKey: 'ds.ingles.leitura',
    level: 3,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'Qual afirmação está de acordo com o trecho?',
    code: 'The function does not modify the array in place; it returns a new sorted copy. Raises ValueError if the input array is empty.',
    options: [
      'A função ordena o array original e não devolve nada.',
      'A função devolve None quando o array está vazio.',
      'A função devolve uma nova cópia ordenada e gera ValueError quando o array está vazio.',
      'A função altera o array original e também devolve uma cópia.',
    ],
    answer: 2,
    explanation: '"Does not modify … in place" significa que o original não é alterado; "returns a new sorted copy" indica o retorno; "raises ValueError if … empty" indica o erro para array vazio.',
  },
  {
    id: 'dq.ingles.vocabulario.1',
    track: 'ingles',
    topicKey: 'ds.ingles.vocabulario',
    level: 1,
    skill: 'Vocabulário',
    kind: 'concept',
    prompt: 'Em documentação técnica, o que significa dizer que um recurso é "deprecated"?',
    options: [
      'Que é novo e experimental.',
      'Que é obrigatório.',
      'Que está obsoleto e seu uso é desaconselhado, pois deve ser removido no futuro.',
      'Que foi criptografado.',
    ],
    answer: 2,
    explanation: 'Um recurso "deprecated" ainda funciona, mas foi substituído por outro e tende a ser removido em versões futuras.',
  },
  {
    id: 'dq.ingles.vocabulario.2',
    track: 'ingles',
    topicKey: 'ds.ingles.vocabulario',
    level: 1,
    skill: 'Vocabulário',
    kind: 'practical',
    prompt: 'Na frase abaixo, o que significa "outage"?',
    code: 'The dashboard was unavailable for two hours due to a database outage.',
    options: [
      'Uma interrupção do serviço.',
      'Uma atualização programada.',
      'Um relatório de saída.',
      'Um aumento de desempenho.',
    ],
    answer: 0,
    explanation: '"Outage" é o período em que um serviço fica fora do ar. A frase diz que o painel ficou indisponível por duas horas por causa de uma interrupção no banco de dados.',
  },
  {
    id: 'dq.ingles.vocabulario.3',
    track: 'ingles',
    topicKey: 'ds.ingles.vocabulario',
    level: 2,
    skill: 'Vocabulário',
    kind: 'practical',
    prompt: 'Qual é a tradução mais adequada de "actually" nesta frase?',
    code: 'Actually, the query is fast; the network is the bottleneck.',
    options: ['Atualmente', 'Na verdade', 'Finalmente', 'Rapidamente'],
    answer: 1,
    explanation: '"Actually" é um falso cognato: significa "na verdade". "Atualmente" em inglês é "currently" ou "nowadays".',
  },
  {
    id: 'dq.ingles.vocabulario.4',
    track: 'ingles',
    topicKey: 'ds.ingles.vocabulario',
    level: 2,
    skill: 'Vocabulário',
    kind: 'practical',
    prompt: 'Na frase abaixo, o que "throughput" descreve?',
    code: 'After the optimization, the pipeline throughput increased from 2,000 to 10,000 rows per second.',
    options: [
      'O tempo de espera de cada requisição.',
      'A quantidade de erros registrados.',
      'O espaço ocupado em disco.',
      'A quantidade de dados processada por unidade de tempo.',
    ],
    answer: 3,
    explanation: '"Throughput" é a vazão: quanto o sistema processa por unidade de tempo (aqui, linhas por segundo). O tempo de espera de uma requisição é "latency".',
  },
  {
    id: 'dq.ingles.escrita.1',
    track: 'ingles',
    topicKey: 'ds.ingles.escrita',
    level: 1,
    skill: 'Gramática aplicada',
    kind: 'practical',
    prompt: 'Qual alternativa completa corretamente a frase?',
    code: 'I ___ the bug yesterday and deployed the fix this morning.',
    options: ['fix', 'have fixed', 'fixed', 'am fixing'],
    answer: 2,
    explanation: 'Com um momento definido e encerrado no passado ("yesterday"), usa-se o simple past: "fixed". O present perfect ("have fixed") não combina com "yesterday".',
  },
  {
    id: 'dq.ingles.escrita.2',
    track: 'ingles',
    topicKey: 'ds.ingles.escrita',
    level: 2,
    skill: 'Gramática aplicada',
    kind: 'practical',
    prompt: 'Qual alternativa completa corretamente a frase, na voz passiva?',
    code: 'The report ___ generated every night by a scheduled job.',
    options: ['is', 'are', 'has', 'does'],
    answer: 0,
    explanation: 'A voz passiva no presente é formada por "to be" + particípio: "The report is generated". O sujeito é singular, por isso "is".',
  },
  {
    id: 'dq.ingles.escrita.3',
    track: 'ingles',
    topicKey: 'ds.ingles.escrita',
    level: 2,
    skill: 'Gramática aplicada',
    kind: 'practical',
    prompt: 'Qual mensagem é a mais adequada para pedir a revisão de um colega em um contexto profissional?',
    options: [
      'Review my pull request now.',
      'Could you please review my pull request when you have a chance?',
      'You must to review my pull request.',
      'I want that you review my pull request.',
    ],
    answer: 1,
    explanation: '"Could you please…" é a forma educada de fazer um pedido. As outras são bruscas ou têm erros de gramática ("must to", "want that you").',
  },
  {
    id: 'dq.ingles.entrevistas.1',
    track: 'ingles',
    topicKey: 'ds.ingles.entrevistas',
    level: 2,
    skill: 'Gramática aplicada',
    kind: 'practical',
    prompt: 'Você começou a trabalhar com SQL há três anos e continua trabalhando. Qual alternativa completa corretamente a frase?',
    code: 'I ___ with SQL for three years.',
    options: ['am working', 'work', 'was working', 'have been working'],
    answer: 3,
    explanation: 'Para uma ação que começou no passado e continua no presente, com "for + período", usa-se o present perfect (continuous): "have been working".',
  },
  {
    id: 'dq.ingles.entrevistas.2',
    track: 'ingles',
    topicKey: 'ds.ingles.entrevistas',
    level: 2,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'O que o entrevistador está pedindo?',
    code: 'Could you walk me through a data project you have worked on?',
    options: [
      'Que você explique, passo a passo, um projeto de dados em que trabalhou.',
      'Que você caminhe com ele até a sala do projeto.',
      'Que você envie o código do projeto por e-mail.',
      'Que você diga quanto tempo o projeto durou.',
    ],
    answer: 0,
    explanation: '"Walk me through" é uma expressão que significa "explique para mim passo a passo".',
  },
  {
    id: 'dq.ingles.ciencia_dados.1',
    track: 'ingles',
    topicKey: 'ds.ingles.ciencia_dados',
    level: 1,
    skill: 'Vocabulário',
    kind: 'practical',
    prompt: 'Que termo descreve a situação abaixo?',
    code: 'The model performs very well on the training set but poorly on unseen data.',
    options: ['Underfitting', 'Overfitting', 'Data cleaning', 'Feature scaling'],
    answer: 1,
    explanation: 'Ir muito bem no treino e mal em dados novos ("unseen data") é a definição de overfitting (sobreajuste).',
  },
  {
    id: 'dq.ingles.ciencia_dados.2',
    track: 'ingles',
    topicKey: 'ds.ingles.ciencia_dados',
    level: 2,
    skill: 'Compreensão de textos técnicos',
    kind: 'practical',
    prompt: 'Segundo o trecho, como os hiperparâmetros foram ajustados?',
    code: 'We held out 20% of the data as a test set and tuned the hyperparameters using 5-fold cross-validation on the remaining 80%.',
    options: [
      'Usando os 20% reservados para teste.',
      'Usando todos os dados, sem separação.',
      'Com validação cruzada de 5 partes sobre os 80% restantes.',
      'Manualmente, sem nenhuma validação.',
    ],
    answer: 2,
    explanation: '"Held out 20% … as a test set" indica que 20% foram reservados para teste; "tuned … using 5-fold cross-validation on the remaining 80%" indica onde o ajuste foi feito.',
  },
  {
    id: 'dq.ingles.ciencia_dados.3',
    track: 'ingles',
    topicKey: 'ds.ingles.ciencia_dados',
    level: 2,
    skill: 'Vocabulário',
    kind: 'practical',
    prompt: 'Na frase abaixo, o que significa "features"?',
    code: 'The dataset has 12 features and one target column.',
    options: [
      'As funcionalidades do programa.',
      'Os erros encontrados nos dados.',
      'As linhas da tabela.',
      'As variáveis de entrada usadas pelo modelo.',
    ],
    answer: 3,
    explanation: 'Em Machine Learning, "features" são as variáveis explicativas (colunas de entrada); "target" é a variável que se quer prever.',
  },
]

const POWERBI_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'dq.powerbi.dax.1',
    track: 'powerbi',
    topicKey: 'ds.powerbi.dax',
    level: 1,
    skill: 'DAX',
    kind: 'concept',
    prompt: 'Qual é a diferença entre uma coluna calculada e uma medida no Power BI?',
    options: [
      'Não há diferença; são dois nomes para o mesmo recurso.',
      'A coluna calculada é avaliada linha a linha na atualização e fica armazenada no modelo; a medida é calculada no momento da consulta, conforme os filtros do visual.',
      'A medida é avaliada linha a linha e fica armazenada no modelo; a coluna calculada é calculada conforme os filtros do visual.',
      'Colunas calculadas são escritas em M e medidas são escritas em DAX.',
    ],
    answer: 1,
    explanation: 'Colunas calculadas ocupam memória e têm um valor fixo por linha; medidas não são armazenadas e respondem ao contexto de filtro de cada visual.',
  },
  {
    id: 'dq.powerbi.dax.2',
    track: 'powerbi',
    topicKey: 'ds.powerbi.dax',
    level: 2,
    skill: 'DAX',
    kind: 'practical',
    prompt: 'A tabela Vendas tem as colunas Quantidade e PrecoUnitario. Qual medida calcula corretamente a receita total (quantidade × preço de cada linha)?',
    options: [
      'Receita = SUM(Vendas[Quantidade]) * SUM(Vendas[PrecoUnitario])',
      'Receita = SUM(Vendas[Quantidade] * Vendas[PrecoUnitario])',
      'Receita = SUMX(Vendas, Vendas[Quantidade] * Vendas[PrecoUnitario])',
      'Receita = AVERAGE(Vendas[Quantidade]) * AVERAGE(Vendas[PrecoUnitario])',
    ],
    answer: 2,
    explanation: 'SUMX percorre a tabela linha a linha, calcula a expressão e soma os resultados. SUM aceita apenas uma coluna, e multiplicar as somas dá um valor diferente da soma dos produtos.',
  },
  {
    id: 'dq.powerbi.dax.3',
    track: 'powerbi',
    topicKey: 'ds.powerbi.dax',
    level: 2,
    skill: 'DAX',
    kind: 'practical',
    prompt: 'Qual é a vantagem de usar DIVIDE nesta medida, em vez do operador "/"?',
    code: 'Margem % = DIVIDE([Lucro], [Receita])',
    options: [
      'DIVIDE trata a divisão por zero devolvendo BLANK (ou um valor alternativo), em vez de erro ou infinito.',
      'DIVIDE arredonda o resultado para duas casas decimais.',
      'DIVIDE formata o resultado automaticamente como porcentagem.',
      'DIVIDE ignora os filtros aplicados ao visual.',
    ],
    answer: 0,
    explanation: 'Quando o denominador é zero ou vazio, DIVIDE devolve BLANK ou o terceiro argumento, se informado. Formatação e arredondamento são configurados à parte.',
  },
  {
    id: 'dq.powerbi.dax.4',
    track: 'powerbi',
    topicKey: 'ds.powerbi.dax',
    level: 2,
    skill: 'DAX',
    kind: 'practical',
    prompt: 'Em um visual filtrado para março de 2025, o que esta medida devolve?',
    code: 'Vendas YTD = TOTALYTD([Total Vendas], Calendario[Data])',
    options: [
      'As vendas apenas de março de 2025.',
      'As vendas de março de 2024.',
      'As vendas de todo o ano de 2025, de janeiro a dezembro.',
      'As vendas acumuladas de 1º de janeiro até o fim de março de 2025.',
    ],
    answer: 3,
    explanation: 'TOTALYTD ("year to date") acumula a medida do início do ano até a última data do contexto de filtro atual.',
  },
  {
    id: 'dq.powerbi.dax.5',
    track: 'powerbi',
    topicKey: 'ds.powerbi.dax',
    level: 3,
    skill: 'DAX',
    kind: 'practical',
    prompt: 'A medida abaixo é colocada em uma tabela visual que tem Vendas[Regiao] nas linhas (Norte, Sul e Leste). Que valor aparece na linha "Norte"?',
    code: 'Vendas Sul = CALCULATE(SUM(Vendas[Valor]), Vendas[Regiao] = "Sul")',
    options: [
      'O total de vendas da região Norte.',
      'Vazio (BLANK), pois Norte é diferente de Sul.',
      'O total de vendas da região Sul.',
      'O total de vendas de todas as regiões.',
    ],
    answer: 2,
    explanation: 'O filtro passado ao CALCULATE substitui o filtro existente na mesma coluna. Em qualquer linha, o filtro de Regiao vindo do visual é trocado por "Sul", e a medida mostra o total do Sul.',
  },
  {
    id: 'dq.powerbi.modelagem.1',
    track: 'powerbi',
    topicKey: 'ds.powerbi.modelagem',
    level: 1,
    skill: 'Modelagem',
    kind: 'concept',
    prompt: 'Em um modelo estrela de vendas, qual das tabelas abaixo é a tabela fato?',
    options: [
      'Produto (uma linha por produto, com nome e categoria).',
      'Cliente (uma linha por cliente, com cidade e segmento).',
      'Calendário (uma linha por dia).',
      'Vendas (uma linha por item vendido, com quantidade e valor).',
    ],
    answer: 3,
    explanation: 'A tabela fato registra os eventos do negócio e guarda os valores numéricos que serão agregados; as dimensões descrevem quem, o quê e quando.',
  },
  {
    id: 'dq.powerbi.modelagem.2',
    track: 'powerbi',
    topicKey: 'ds.powerbi.modelagem',
    level: 2,
    skill: 'Modelagem',
    kind: 'concept',
    prompt: 'Qual é a configuração recomendada para o relacionamento entre a dimensão Produto e a fato Vendas?',
    options: [
      'Um-para-muitos (Produto → Vendas), com filtro em direção única, da dimensão para a fato.',
      'Muitos-para-muitos, com filtro em ambas as direções.',
      'Um-para-um, com filtro em ambas as direções.',
      'Nenhum relacionamento; as tabelas devem ser combinadas apenas com medidas.',
    ],
    answer: 0,
    explanation: 'Cada produto aparece uma vez na dimensão e muitas vezes na fato. O filtro em direção única (dimensão filtra fato) é o padrão do esquema estrela: é previsível e eficiente.',
  },
  {
    id: 'dq.powerbi.modelagem.3',
    track: 'powerbi',
    topicKey: 'ds.powerbi.modelagem',
    level: 2,
    skill: 'Modelagem',
    kind: 'concept',
    prompt: 'Por que criar uma tabela calendário dedicada, em vez de usar diretamente a coluna de data da tabela de vendas?',
    options: [
      'Porque o Power BI não aceita colunas de data em tabelas fato.',
      'Porque as funções de inteligência de tempo precisam de datas contínuas, e a mesma tabela pode filtrar várias tabelas fato.',
      'Porque a tabela calendário reduz o modelo pela metade.',
      'Porque só a tabela calendário pode ser usada em gráficos de linhas.',
    ],
    answer: 1,
    explanation: 'Uma tabela de datas completa (sem dias faltando) é a base das funções de inteligência de tempo e serve de dimensão comum para vendas, metas, estoque etc.',
  },
  {
    id: 'dq.powerbi.power_query.1',
    track: 'powerbi',
    topicKey: 'ds.powerbi.power_query',
    level: 1,
    skill: 'Power Query',
    kind: 'concept',
    prompt: 'Qual é o papel do Power Query no Power BI?',
    options: [
      'Criar medidas com a linguagem DAX.',
      'Desenhar os visuais do relatório.',
      'Conectar às fontes, limpar e transformar os dados antes de carregá-los no modelo.',
      'Publicar o relatório no serviço do Power BI.',
    ],
    answer: 2,
    explanation: 'O Power Query é a etapa de extração e transformação: cada passo fica gravado (em linguagem M) e é reaplicado a cada atualização.',
  },
  {
    id: 'dq.powerbi.power_query.2',
    track: 'powerbi',
    topicKey: 'ds.powerbi.power_query',
    level: 2,
    skill: 'Power Query',
    kind: 'practical',
    prompt: 'A planilha abaixo tem uma coluna para cada mês. Qual transformação do Power Query a converte em uma tabela com as colunas Produto, Mês e Valor?',
    code: `Produto | Jan | Fev | Mar
Caneta  | 100 | 120 |  90
Caderno |  80 |  95 | 110`,
    options: [
      'Transpor a tabela.',
      'Agrupar por Produto.',
      'Mesclar consultas.',
      'Selecionar as colunas de meses e usar "Transformar Colunas em Linhas" (unpivot).',
    ],
    answer: 3,
    explanation: 'O unpivot transforma as colunas de meses em pares atributo-valor, gerando uma linha por produto e mês — o formato adequado para análise.',
  },
  {
    id: 'dq.powerbi.power_query.3',
    track: 'powerbi',
    topicKey: 'ds.powerbi.power_query',
    level: 2,
    skill: 'Power Query',
    kind: 'concept',
    prompt: 'O que é o dobramento de consulta (query folding) no Power Query?',
    options: [
      'A tradução das etapas de transformação em uma consulta executada pela própria fonte de dados (por exemplo, SQL).',
      'A compactação do arquivo .pbix ao salvar.',
      'A junção de duas consultas em uma só com "Mesclar".',
      'A ocultação de etapas no painel de etapas aplicadas.',
    ],
    answer: 0,
    explanation: 'Quando há dobramento, filtros e agregações são executados no banco de origem, e só o resultado trafega para o Power BI, o que acelera a atualização.',
  },
  {
    id: 'dq.powerbi.desempenho.1',
    track: 'powerbi',
    topicKey: 'ds.powerbi.desempenho',
    level: 1,
    skill: 'Desempenho',
    kind: 'concept',
    prompt: 'Qual ação mais ajuda a reduzir o tamanho de um modelo importado no Power BI?',
    options: [
      'Aumentar a quantidade de visuais por página.',
      'Remover colunas que não são usadas e reduzir a cardinalidade das que ficam.',
      'Trocar o tema de cores do relatório.',
      'Renomear as tabelas com nomes mais curtos.',
    ],
    answer: 1,
    explanation: 'O armazenamento é feito por coluna e comprime melhor quando há poucos valores distintos. Menos colunas e menor cardinalidade significam um modelo menor e mais rápido.',
  },
  {
    id: 'dq.powerbi.desempenho.2',
    track: 'powerbi',
    topicKey: 'ds.powerbi.desempenho',
    level: 2,
    skill: 'Desempenho',
    kind: 'practical',
    prompt: 'Uma página do relatório demora para carregar. Qual recurso do Power BI Desktop mostra quanto tempo cada visual leva e a consulta DAX gerada por ele?',
    options: [
      'Exibição de Modelo',
      'Editor do Power Query',
      'Analisador de Desempenho (Performance Analyzer)',
      'Painel de Indicadores (Bookmarks)',
    ],
    answer: 2,
    explanation: 'O Analisador de Desempenho grava a duração de cada visual, separando o tempo da consulta DAX do tempo de renderização, e permite copiar a consulta para análise.',
  },
  {
    id: 'dq.powerbi.desempenho.3',
    track: 'powerbi',
    topicKey: 'ds.powerbi.desempenho',
    level: 2,
    skill: 'Desempenho',
    kind: 'concept',
    prompt: 'A tabela fato tem uma coluna DataHora com precisão de segundos, mas os relatórios só usam a data. O que fazer para melhorar o desempenho?',
    options: [
      'Converter a coluna para texto.',
      'Duplicar a coluna para acelerar os filtros.',
      'Criar uma coluna calculada em DAX repetindo o mesmo valor.',
      'Manter apenas a data (ou separar data e hora em colunas distintas), reduzindo a cardinalidade.',
    ],
    answer: 3,
    explanation: 'Uma coluna com segundos tem quase um valor distinto por linha e comprime mal. Guardar só a data reduz drasticamente a quantidade de valores distintos.',
  },
]

export const DS_QUESTIONS: DiagnosticQuestion[] = [
  ...SQL_QUESTIONS,
  ...PYTHON_QUESTIONS,
  ...ML_QUESTIONS,
  ...INGLES_QUESTIONS,
  ...POWERBI_QUESTIONS,
]

const TOPIC_ORDER = new Map(DS_TOPICS.map((topic, index) => [topic.key, index] as const))

/** Questões de um pilar, na ordem dos tópicos da trilha e, dentro de cada tópico, do nível mais básico ao mais avançado. */
export function questionsFor(track: TrackKey): DiagnosticQuestion[] {
  return DS_QUESTIONS.filter((question) => question.track === track).sort(
    (a, b) => (TOPIC_ORDER.get(a.topicKey) ?? 0) - (TOPIC_ORDER.get(b.topicKey) ?? 0) || a.level - b.level,
  )
}
