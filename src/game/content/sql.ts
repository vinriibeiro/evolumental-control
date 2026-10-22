import type { SubjectContent } from '../types'
import { cat, code, err, fill, match, mcq, multi, num, order, out, short, sqlLab, step, tf } from './_build'

// Banco de exemplo usado em todos os laboratórios (SQLite, executado no navegador).
export const LOJA = `
CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, cidade TEXT, estado TEXT, data_cadastro TEXT);
CREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, categoria TEXT, preco REAL);
CREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER REFERENCES clientes(id), data TEXT, status TEXT);
CREATE TABLE itens (pedido_id INTEGER REFERENCES pedidos(id), produto_id INTEGER REFERENCES produtos(id), quantidade INTEGER);
INSERT INTO clientes VALUES
 (1,'Ana Souza','Brasília','DF','2024-01-15'),(2,'Bruno Lima','São Paulo','SP','2024-02-20'),
 (3,'Carla Dias','Brasília','DF','2024-03-05'),(4,'Diego Rocha','Rio de Janeiro','RJ','2024-03-18'),
 (5,'Elisa Melo','São Paulo','SP','2024-04-02'),(6,'Fábio Nunes','Goiânia','GO','2024-05-10');
INSERT INTO produtos VALUES
 (1,'Caderno','Papelaria',25.0),(2,'Caneta','Papelaria',5.0),(3,'Mochila','Acessórios',150.0),
 (4,'Fone','Eletrônicos',200.0),(5,'Mouse','Eletrônicos',80.0),(6,'Garrafa','Acessórios',40.0),(7,'Teclado','Eletrônicos',120.0);
INSERT INTO pedidos VALUES
 (101,1,'2024-06-01','entregue'),(102,2,'2024-06-03','entregue'),(103,1,'2024-06-10','cancelado'),
 (104,3,'2024-06-12','entregue'),(105,4,'2024-07-01','pendente'),(106,2,'2024-07-05','entregue'),
 (107,5,'2024-07-08','entregue'),(108,1,'2024-07-20','pendente');
INSERT INTO itens VALUES
 (101,1,2),(101,2,5),(102,4,1),(103,3,1),(104,5,2),(104,6,1),(105,7,1),
 (106,1,3),(106,2,10),(107,4,2),(108,6,2),(108,2,2);
`

const clientes = {
  caption: 'clientes (amostra)',
  columns: ['id', 'nome', 'cidade', 'estado'],
  rows: [
    [1, 'Ana Souza', 'Brasília', 'DF'],
    [2, 'Bruno Lima', 'São Paulo', 'SP'],
    [3, 'Carla Dias', 'Brasília', 'DF'],
    [4, 'Diego Rocha', 'Rio de Janeiro', 'RJ'],
    [5, 'Elisa Melo', 'São Paulo', 'SP'],
    [6, 'Fábio Nunes', 'Goiânia', 'GO'],
  ],
}
const produtos = {
  caption: 'produtos',
  columns: ['id', 'nome', 'categoria', 'preco'],
  rows: [
    [1, 'Caderno', 'Papelaria', 25],
    [2, 'Caneta', 'Papelaria', 5],
    [3, 'Mochila', 'Acessórios', 150],
    [4, 'Fone', 'Eletrônicos', 200],
    [5, 'Mouse', 'Eletrônicos', 80],
    [6, 'Garrafa', 'Acessórios', 40],
    [7, 'Teclado', 'Eletrônicos', 120],
  ],
}

const content: SubjectContent = {
  subjectId: 'sql',
  datasets: { loja: LOJA },
  units: [
    {
      id: 'sql.u1',
      title: 'Consultas essenciais',
      summary: 'SELECT, WHERE, ORDER BY, LIMIT e operadores.',
      topics: [
        { id: 'select', name: 'SELECT e colunas' },
        { id: 'where', name: 'Filtros com WHERE' },
        { id: 'order', name: 'Ordenação e LIMIT' },
      ],
      lesson: [
        { title: 'A estrutura de uma consulta', body: 'Uma consulta lê dados com SELECT (quais colunas) e FROM (de qual tabela). Use * só para explorar: em relatórios, liste as colunas que precisa.', example: 'SELECT nome, cidade\nFROM clientes;' },
        { title: 'Filtrando linhas', body: 'WHERE mantém apenas as linhas em que a condição é verdadeira. Combine condições com AND/OR e use parênteses para deixar a precedência explícita. Textos ficam entre aspas simples.', example: "SELECT nome FROM produtos\nWHERE categoria = 'Eletrônicos' AND preco < 150;" },
        { title: 'Operadores úteis', body: 'IN testa uma lista, BETWEEN um intervalo fechado (inclui as pontas), LIKE padrões de texto (% = qualquer sequência, _ = um caractere) e IS NULL testa ausência de valor — nunca use = NULL.' },
        { title: 'Ordenar e limitar', body: 'ORDER BY ordena (ASC é o padrão; DESC inverte). LIMIT n devolve só as n primeiras linhas. Sem ORDER BY, a ordem do resultado não é garantida.', example: 'SELECT nome, preco FROM produtos\nORDER BY preco DESC\nLIMIT 3;' },
        { title: 'Ordem lógica de execução', body: 'O banco avalia FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. Por isso um apelido criado no SELECT não pode ser usado no WHERE.' },
      ],
      challenges: [
        mcq('sql.u1.c01', 'select', 1, 'Qual comando retorna apenas as colunas nome e cidade da tabela clientes?', ['SELECT * FROM clientes', 'SELECT nome, cidade FROM clientes', 'GET nome, cidade FROM clientes', 'SELECT clientes FROM nome, cidade'], 1, 'SELECT lista as colunas desejadas, separadas por vírgula, e FROM indica a tabela.', { whyWrong: 'SELECT * traz todas as colunas; GET não é SQL; a última inverte tabela e colunas.' }),
        fill('sql.u1.c02', 'where', 1, 'Complete para listar os produtos da categoria Papelaria.', "SELECT nome FROM produtos ___ categoria = 'Papelaria';", [['WHERE']], 'WHERE filtra as linhas pela condição.', { hint: 'É a cláusula de filtro.' }),
        mcq('sql.u1.c03', 'where', 2, 'Como buscar clientes cujo nome começa com "Ca"?', ["WHERE nome = 'Ca%'", "WHERE nome LIKE 'Ca%'", "WHERE nome LIKE '%Ca'", "WHERE nome IN ('Ca')"], 1, "LIKE com % no final aceita qualquer continuação: 'Ca%' casa com Carla, Caio…", { whyWrong: "= compara literalmente (inclusive o %); '%Ca' procura nomes que TERMINAM com Ca." }),
        tf('sql.u1.c04', 'where', 2, 'A condição `preco BETWEEN 40 AND 120` inclui produtos com preço exatamente 40 e 120.', true, 'BETWEEN é um intervalo fechado: equivale a preco >= 40 AND preco <= 120.'),
        err('sql.u1.c05', 'where', 2, 'Toque no trecho que impede a consulta de encontrar clientes sem estado.', ['SELECT nome', 'FROM clientes', 'WHERE estado = NULL'], 2, 'WHERE estado IS NULL', 'NULL significa "desconhecido": qualquer comparação com = NULL resulta em desconhecido, nunca verdadeiro. Use IS NULL.'),
        num('sql.u1.c06', 'where', 2, "Quantas linhas retorna: SELECT * FROM produtos WHERE categoria = 'Eletrônicos' AND preco < 150;", 2, 'Eletrônicos: Fone (200), Mouse (80) e Teclado (120). Abaixo de 150 ficam Mouse e Teclado.', { table: produtos }),
        order('sql.u1.c07', 'order', 2, 'Coloque as cláusulas na ordem em que devem ser ESCRITAS.', ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'LIMIT'], 'A escrita segue SELECT → FROM → WHERE → ORDER BY → LIMIT (GROUP BY/HAVING entram entre WHERE e ORDER BY).'),
        mcq('sql.u1.c08', 'order', 1, 'Qual consulta traz os 3 produtos mais caros?', ['SELECT nome FROM produtos ORDER BY preco LIMIT 3', 'SELECT nome FROM produtos ORDER BY preco DESC LIMIT 3', 'SELECT TOP nome FROM produtos', 'SELECT nome FROM produtos LIMIT 3 ORDER BY preco DESC'], 1, 'Ordene de forma decrescente (DESC) e depois limite. LIMIT vem depois de ORDER BY.', { whyWrong: 'Sem DESC você pega os mais baratos; LIMIT antes de ORDER BY é erro de sintaxe; TOP é de outro dialeto (SQL Server) e exige um número.' }),
        mcq('sql.u1.c09', 'where', 3, 'Qual resultado tem a consulta abaixo?', ['Todos os clientes de DF e de SP', 'Todos os de DF e só os de SP cadastrados antes de março/2024', 'Só os de DF e SP cadastrados antes de março/2024', 'Erro de sintaxe'], 1, "AND tem precedência sobre OR: a condição vira estado = 'DF' OR (estado = 'SP' AND data_cadastro < '2024-03-01'). Resultado: Ana, Carla e Bruno. Use parênteses para expressar a intenção.", { code: { lang: 'sql', source: "SELECT nome FROM clientes\nWHERE estado = 'DF' OR estado = 'SP'\n  AND data_cadastro < '2024-03-01';" }, whyWrong: 'Sem parênteses, o filtro de data só vale para SP — a terceira opção exigiria (estado = ... OR estado = ...) entre parênteses.' }),
        sqlLab('sql.u1.lab1', 'where', 2, 'Liste nome e preço dos produtos que custam entre 40 e 150 (inclusive), do mais barato para o mais caro.', 'SELECT nome, preco FROM produtos WHERE preco BETWEEN 40 AND 150 ORDER BY preco;', 'BETWEEN inclui as pontas e ORDER BY preco ordena de forma crescente.', { orderMatters: true, starter: 'SELECT nome, preco\nFROM produtos\n' }),
        multi('sql.u1.boss', 'order', 3, 'Chefe da unidade: analise a consulta e responda às etapas.', [
          step.mcq('sql.u1.boss.s1', 'Quantas colunas o resultado terá?', ['1', '2', '3', '4'], 1, 'nome e preco.'),
          step.num('sql.u1.boss.s2', 'Quantas linhas o resultado terá?', 2, 'Apenas Papelaria: Caderno e Caneta.'),
          step.mcq('sql.u1.boss.s3', 'Qual é a primeira linha?', ['Caneta, 5', 'Caderno, 25', 'Mochila, 150', 'Garrafa, 40'], 1, 'Ordenado do mais caro para o mais barato: Caderno (25) vem antes de Caneta (5).'),
        ], 'Leia na ordem lógica: FROM produtos → WHERE categoria → SELECT colunas → ORDER BY.', { boss: true, code: { lang: 'sql', source: "SELECT nome, preco FROM produtos\nWHERE categoria = 'Papelaria'\nORDER BY preco DESC;" }, table: produtos }),
      ],
    },
    {
      id: 'sql.u2',
      title: 'Agregações e agrupamentos',
      summary: 'COUNT, SUM, AVG, GROUP BY e HAVING.',
      topics: [
        { id: 'agg', name: 'Funções de agregação' },
        { id: 'groupby', name: 'GROUP BY' },
        { id: 'having', name: 'HAVING' },
      ],
      lesson: [
        { title: 'Agregar é resumir', body: 'COUNT conta linhas, SUM soma, AVG calcula a média, MIN/MAX acham extremos. Sem GROUP BY, toda a tabela vira uma única linha de resumo.', example: 'SELECT COUNT(*) AS total, AVG(preco) AS media\nFROM produtos;' },
        { title: 'COUNT(*) × COUNT(coluna)', body: 'COUNT(*) conta todas as linhas; COUNT(coluna) ignora os NULL daquela coluna; COUNT(DISTINCT coluna) conta valores diferentes.' },
        { title: 'GROUP BY', body: 'GROUP BY cria um grupo por valor (ou combinação de valores) e calcula as agregações em cada grupo. Toda coluna do SELECT que não estiver agregada deve estar no GROUP BY (o SQLite é permissivo, mas outros bancos dão erro).', example: 'SELECT categoria, COUNT(*) AS qtd\nFROM produtos\nGROUP BY categoria;' },
        { title: 'WHERE × HAVING', body: 'WHERE filtra linhas ANTES de agrupar; HAVING filtra grupos DEPOIS de agregar. Condições sobre SUM/COUNT/AVG vão no HAVING.', example: 'SELECT estado, COUNT(*) AS n\nFROM clientes\nGROUP BY estado\nHAVING COUNT(*) >= 2;' },
      ],
      challenges: [
        num('sql.u2.c01', 'agg', 1, 'Qual o resultado de SELECT COUNT(*) FROM produtos;', 7, 'A tabela produtos tem 7 linhas.', { table: produtos }),
        num('sql.u2.c02', 'agg', 2, 'Qual o resultado de SELECT SUM(preco) FROM produtos WHERE categoria = \'Acessórios\';', 190, 'Acessórios: Mochila (150) + Garrafa (40) = 190.', { table: produtos }),
        mcq('sql.u2.c03', 'agg', 2, 'Uma coluna tem 10 linhas, 3 delas com NULL. Quanto vale COUNT(coluna)?', ['10', '7', '3', 'NULL'], 1, 'COUNT(coluna) ignora NULL: 10 − 3 = 7. COUNT(*) daria 10.'),
        fill('sql.u2.c04', 'groupby', 1, 'Complete para contar produtos por categoria.', 'SELECT categoria, COUNT(*) FROM produtos ___ categoria;', [['GROUP BY']], 'GROUP BY categoria forma um grupo por categoria.'),
        match('sql.u2.c05', 'agg', 1, 'Associe cada função ao que ela calcula.', [['COUNT', 'Quantidade de linhas'], ['SUM', 'Soma dos valores'], ['AVG', 'Média aritmética'], ['MAX', 'Maior valor']], 'São as agregações básicas do SQL padrão.'),
        cat('sql.u2.c06', 'having', 2, 'Cada condição deve ir no WHERE ou no HAVING?', ['WHERE', 'HAVING'], [["status = 'entregue'", 0], ['COUNT(*) > 2', 1], ['preco > 50', 0], ['SUM(quantidade) >= 10', 1], ['AVG(preco) < 100', 1]], 'Condições sobre valores de linha → WHERE. Condições sobre agregações → HAVING.'),
        err('sql.u2.c07', 'having', 2, 'Toque no trecho com erro.', ['SELECT estado, COUNT(*)', 'FROM clientes', 'WHERE COUNT(*) > 1', 'GROUP BY estado'], 2, 'HAVING COUNT(*) > 1 (depois do GROUP BY)', 'Agregações não podem ser usadas no WHERE, que é avaliado antes do agrupamento.'),
        out('sql.u2.c08', 'groupby', 2, 'Quantas linhas esta consulta retorna? Digite só o número.', 'SELECT estado, COUNT(*)\nFROM clientes\nGROUP BY estado;', 'sql', ['4'], 'Há 4 estados distintos: DF, SP, RJ e GO — um grupo para cada.', { table: clientes }),
        num('sql.u2.c09', 'agg', 3, 'Qual é o preço médio dos produtos de Eletrônicos? (AVG)', 133.33, 'Eletrônicos: (200 + 80 + 120) / 3 = 400 / 3 ≈ 133,33.', { tolerance: 0.01, table: produtos }),
        tf('sql.u2.c10', 'groupby', 2, 'Em SQL padrão, `SELECT categoria, nome, COUNT(*) FROM produtos GROUP BY categoria` é válido.', false, 'nome não está agregado nem no GROUP BY: em PostgreSQL/SQL Server é erro. O SQLite aceita, mas devolve um nome arbitrário do grupo — evite.'),
        sqlLab('sql.u2.lab1', 'groupby', 2, 'Conte quantos clientes há por estado. Retorne estado e a quantidade.', 'SELECT estado, COUNT(*) AS qtd FROM clientes GROUP BY estado;', 'Agrupe por estado e conte as linhas de cada grupo.'),
        sqlLab('sql.u2.lab2', 'having', 3, 'Mostre as categorias com 3 ou mais produtos (categoria e quantidade).', 'SELECT categoria, COUNT(*) AS qtd FROM produtos GROUP BY categoria HAVING COUNT(*) >= 3;', 'A condição é sobre o COUNT do grupo, então vai no HAVING. Só Eletrônicos tem 3 produtos.'),
        multi('sql.u2.boss', 'having', 4, 'Chefe da unidade: pedidos por status.', [
          step.num('sql.u2.boss.s1', "Quantos pedidos têm status 'entregue'?", 5, '101, 102, 104, 106 e 107.'),
          step.num('sql.u2.boss.s2', "Quantos pedidos têm status 'pendente'?", 2, '105 e 108.'),
          step.mcq('sql.u2.boss.s3', 'Qual consulta lista só os status com mais de 1 pedido?', ['… WHERE COUNT(*) > 1 GROUP BY status', '… GROUP BY status HAVING COUNT(*) > 1', '… GROUP BY status WHERE COUNT(*) > 1', '… HAVING status > 1'], 1, 'Filtro sobre agregação = HAVING, depois do GROUP BY.'),
        ], 'Conte por status e filtre os grupos com HAVING.', { boss: true, table: { caption: 'pedidos', columns: ['id', 'cliente_id', 'data', 'status'], rows: [[101, 1, '2024-06-01', 'entregue'], [102, 2, '2024-06-03', 'entregue'], [103, 1, '2024-06-10', 'cancelado'], [104, 3, '2024-06-12', 'entregue'], [105, 4, '2024-07-01', 'pendente'], [106, 2, '2024-07-05', 'entregue'], [107, 5, '2024-07-08', 'entregue'], [108, 1, '2024-07-20', 'pendente']] } }),
      ],
    },
    {
      id: 'sql.u3',
      title: 'Junções e subconsultas',
      summary: 'INNER/LEFT JOIN, chaves e subconsultas.',
      topics: [
        { id: 'join', name: 'INNER JOIN' },
        { id: 'leftjoin', name: 'LEFT JOIN' },
        { id: 'subquery', name: 'Subconsultas e CTE' },
      ],
      lesson: [
        { title: 'Chaves', body: 'A chave primária (PK) identifica cada linha. A chave estrangeira (FK) aponta para a PK de outra tabela: pedidos.cliente_id → clientes.id.' },
        { title: 'INNER JOIN', body: 'Combina linhas das duas tabelas quando a condição do ON é verdadeira. Linhas sem par ficam de fora.', example: 'SELECT p.id, c.nome\nFROM pedidos p\nJOIN clientes c ON c.id = p.cliente_id;' },
        { title: 'LEFT JOIN', body: 'Mantém TODAS as linhas da tabela da esquerda; quando não há par, as colunas da direita vêm NULL. Ótimo para achar "quem não tem": LEFT JOIN + WHERE direita.id IS NULL.' },
        { title: 'Subconsultas e CTE', body: 'Uma subconsulta é um SELECT dentro de outro (em WHERE, FROM ou SELECT). Uma CTE (WITH nome AS (...)) dá nome a um resultado intermediário e deixa a consulta legível.', example: 'WITH totais AS (\n  SELECT pedido_id, SUM(quantidade) AS q\n  FROM itens GROUP BY pedido_id\n)\nSELECT * FROM totais WHERE q > 3;' },
        { title: 'Dialeto: SQLite', body: 'Os laboratórios rodam em SQLite no seu navegador. Particularidades: tipagem flexível (afinidade de tipo), datas guardadas como texto ISO (use date()/strftime()), concatenação com ||, sem RIGHT/FULL JOIN em versões antigas, e GROUP BY permissivo. A lógica de SELECT/JOIN/GROUP BY é a mesma do SQL padrão.' },
      ],
      challenges: [
        mcq('sql.u3.c01', 'join', 1, 'Qual a condição correta para juntar pedidos e clientes?', ['ON pedidos.id = clientes.id', 'ON pedidos.cliente_id = clientes.id', 'ON pedidos.cliente_id = clientes.nome', 'ON clientes.id = itens.pedido_id'], 1, 'A FK pedidos.cliente_id referencia a PK clientes.id.', { whyWrong: 'Comparar pedidos.id com clientes.id cruza identificadores sem relação.' }),
        tf('sql.u3.c02', 'join', 1, 'Um INNER JOIN entre clientes e pedidos inclui clientes que nunca fizeram pedidos.', false, 'INNER JOIN só mantém linhas com par. Para incluir clientes sem pedidos, use LEFT JOIN a partir de clientes.'),
        num('sql.u3.c03', 'leftjoin', 2, 'Quantas linhas retorna: SELECT c.nome FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL;', 1, 'Só Fábio Nunes (id 6) não tem pedidos.', { hint: 'Procure clientes cujo id não aparece em pedidos.cliente_id.' }),
        code('sql.u3.c04', 'leftjoin', 2, 'Complete para listar TODOS os clientes e, quando houver, seus pedidos.', 'SELECT c.nome, p.id\nFROM clientes c\n___ pedidos p ___ p.cliente_id = c.id;', [['LEFT JOIN', 'LEFT OUTER JOIN'], ['ON']], 'LEFT JOIN preserva todos os clientes; ON define a condição de junção.', { caseSensitive: false }),
        match('sql.u3.c05', 'join', 2, 'Associe o tipo de junção ao comportamento.', [['INNER JOIN', 'Só linhas com par nos dois lados'], ['LEFT JOIN', 'Todas da esquerda + pares da direita'], ['CROSS JOIN', 'Todas as combinações possíveis'], ['Self join', 'Tabela unida a ela mesma']], 'CROSS JOIN gera o produto cartesiano; self join usa apelidos diferentes para a mesma tabela.'),
        err('sql.u3.c06', 'join', 3, 'Toque no trecho que causa resultado errado (produto cartesiano).', ['SELECT p.id, c.nome', 'FROM pedidos p, clientes c', "WHERE p.status = 'entregue'"], 2, "WHERE p.cliente_id = c.id AND p.status = 'entregue'", 'Na sintaxe com vírgula, a condição de junção precisa estar no WHERE. Sem ela, cada pedido combina com todos os clientes.'),
        mcq('sql.u3.c07', 'subquery', 2, 'O que retorna a consulta?', ['Produtos com preço acima da média', 'Produtos com o maior preço', 'A média dos preços', 'Erro: subconsulta não permitida no WHERE'], 0, 'A subconsulta calcula a média (≈ 88,57) e o WHERE mantém os produtos acima dela: Mochila, Fone e Teclado.', { code: { lang: 'sql', source: 'SELECT nome FROM produtos\nWHERE preco > (SELECT AVG(preco) FROM produtos);' } }),
        num('sql.u3.c08', 'subquery', 3, 'Quantas linhas retorna a consulta do desafio anterior (preço acima da média)?', 3, 'Média = 620/7 ≈ 88,57. Acima: Mochila (150), Fone (200), Teclado (120).', { table: produtos }),
        short('sql.u3.c09', 'subquery', 2, 'Qual palavra-chave inicia uma CTE?', ['WITH'], 'WITH nome AS (SELECT ...) cria uma expressão de tabela nomeada usada pela consulta seguinte.'),
        order('sql.u3.c10', 'join', 3, 'Ordene as etapas para calcular o valor total de cada pedido.', ['Juntar itens com produtos pelo produto_id', 'Calcular quantidade × preco por linha', 'Agrupar por pedido_id', 'Somar os valores de cada grupo'], 'Primeiro junte para ter o preço, depois calcule por linha, agrupe e some.'),
        sqlLab('sql.u3.lab1', 'join', 3, 'Liste o id de cada pedido e o nome do cliente que o fez.', 'SELECT p.id, c.nome FROM pedidos p JOIN clientes c ON c.id = p.cliente_id;', 'INNER JOIN pela FK cliente_id. São 8 pedidos, todos com cliente.'),
        sqlLab('sql.u3.lab2', 'leftjoin', 3, 'Liste o nome dos clientes que nunca fizeram pedido.', 'SELECT c.nome FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL;', 'LEFT JOIN + IS NULL encontra quem não tem par. Também vale NOT IN / NOT EXISTS.'),
        sqlLab('sql.u3.lab3', 'join', 4, 'Calcule o valor total de cada pedido (pedido_id e total = soma de quantidade × preço). Ordene do maior para o menor total.', 'SELECT i.pedido_id, SUM(i.quantidade * pr.preco) AS total FROM itens i JOIN produtos pr ON pr.id = i.produto_id GROUP BY i.pedido_id ORDER BY total DESC, i.pedido_id;', 'Junte itens a produtos, multiplique e agregue por pedido. O maior é o 107 (2 fones = 400). Empates (102 e 104 = 200) podem vir em qualquer ordem entre si.', { orderMatters: false }),
        multi('sql.u3.boss', 'join', 5, 'Chefe final de SQL: faturamento dos pedidos entregues.', [
          step.num('sql.u3.boss.s1', 'Qual o total do pedido 101 (2 cadernos a 25 + 5 canetas a 5)?', 75, '2×25 + 5×5 = 75.'),
          step.num('sql.u3.boss.s2', 'Somando os pedidos entregues (101=75, 102=200, 104=200, 106=125, 107=400), qual o faturamento?', 1000, '75 + 200 + 200 + 125 + 400 = 1000.'),
          step.mcq('sql.u3.boss.s3', 'Onde entra o filtro de status para esse cálculo?', ["HAVING status = 'entregue'", "WHERE p.status = 'entregue' antes do GROUP BY", 'ORDER BY status', 'No ON do JOIN com produtos'], 1, 'É condição de linha (cada pedido), então WHERE — antes de agregar.'),
        ], 'Junte pedidos → itens → produtos, filtre por status no WHERE e some quantidade × preço.', { boss: true }),
      ],
    },
  ],
}

export default content
