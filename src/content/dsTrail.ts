// Trilha de Ciência de Dados: cinco pilares, na ordem em que entram no plano semanal.
// As chaves (`ds.<pilar>.<slug>`) são estáveis — mude textos à vontade, nunca uma chave publicada.
import type { TrackDef, TrackKey, TrailTopicDef } from '@/content/dsTypes'

const PG = 'https://www.postgresql.org/docs/current'
const PY = 'https://docs.python.org/3'
const NP = 'https://numpy.org/doc/stable'
const PD = 'https://pandas.pydata.org/docs'
const SK = 'https://scikit-learn.org/stable'
const MS = 'https://learn.microsoft.com'

const link = (title: string, url: string) => ({ title, url })

const SQL_TOPICS: TrailTopicDef[] = [
  {
    key: 'ds.sql.fundamentos',
    title: 'Fundamentos e consultas',
    objective: 'Ao terminar, consigo explicar o que são tabela, linha, coluna e chave e executar minhas primeiras consultas em um banco relacional.',
    prerequisites: [],
    content: [
      'O que é um banco de dados relacional e para que serve o SQL',
      'Tabelas, linhas, colunas, tipos de dados e valores nulos (NULL)',
      'Chave primária e chave estrangeira',
      'Como instalar ou abrir um ambiente de prática (PostgreSQL ou SQLite)',
      'Anatomia de uma consulta: SELECT … FROM …',
    ],
    materials: [
      link('PostgreSQL — Tutorial: primeiros passos', `${PG}/tutorial-start.html`),
      link('PostgreSQL — Tutorial: a linguagem SQL', `${PG}/tutorial-sql.html`),
    ],
    exercise: {
      prompt: 'Crie uma tabela clientes (id, nome, cidade), insira cinco linhas e escreva uma consulta que mostre todas as colunas e outra que mostre só nome e cidade.',
      lab: { track: 'sql', level: 'first_steps' },
    },
    minutes: 120,
  },
  {
    key: 'ds.sql.select',
    title: 'SELECT, WHERE e ORDER BY',
    objective: 'Ao terminar, consigo escolher colunas, filtrar linhas e ordenar o resultado de uma consulta em uma única tabela.',
    prerequisites: ['ds.sql.fundamentos'],
    content: [
      'Escolha de colunas, apelidos com AS e colunas calculadas',
      'Filtro de linhas com WHERE e operadores de comparação',
      'Ordenação com ORDER BY (ASC, DESC e mais de uma coluna)',
      'DISTINCT para eliminar repetições',
      'LIMIT e OFFSET para recortar o resultado',
    ],
    materials: [
      link('PostgreSQL — Tutorial: consultando uma tabela', `${PG}/tutorial-select.html`),
      link('PostgreSQL — Referência do comando SELECT', `${PG}/sql-select.html`),
    ],
    exercise: {
      prompt: 'Em uma tabela de produtos, liste nome e preço dos cinco itens mais caros de uma categoria, do maior para o menor preço.',
      lab: { track: 'sql', level: 'first_steps' },
    },
    minutes: 150,
  },
  {
    key: 'ds.sql.filtros',
    title: 'Operadores e filtros',
    objective: 'Ao terminar, consigo combinar condições com AND, OR e NOT e usar IN, BETWEEN, LIKE e IS NULL sem errar a precedência.',
    prerequisites: ['ds.sql.select'],
    content: [
      'Operadores lógicos AND, OR e NOT e a precedência entre eles',
      'IN e BETWEEN para listas e intervalos',
      'LIKE e curingas (% e _) para buscar parte de um texto',
      'NULL: por que usar IS NULL e IS NOT NULL em vez de = NULL',
      'CASE WHEN para criar categorias dentro da consulta',
    ],
    materials: [
      link('PostgreSQL — Operadores de comparação', `${PG}/functions-comparison.html`),
      link('PostgreSQL — Operadores lógicos', `${PG}/functions-logical.html`),
      link('PostgreSQL — Busca por padrões (LIKE)', `${PG}/functions-matching.html`),
    ],
    exercise: {
      prompt: 'Liste os pedidos pagos ou pendentes com valor entre 100 e 500 cujo nome do cliente começa com "Mar" e que tenham data de entrega preenchida.',
      lab: { track: 'sql', level: 'basic' },
    },
    minutes: 150,
  },
  {
    key: 'ds.sql.join',
    title: 'JOIN',
    objective: 'Ao terminar, consigo combinar duas ou mais tabelas com INNER e LEFT JOIN e prever quantas linhas o resultado terá.',
    prerequisites: ['ds.sql.filtros'],
    content: [
      'Por que os dados ficam em tabelas separadas e como as chaves as ligam',
      'INNER JOIN: apenas as linhas com correspondência',
      'LEFT, RIGHT e FULL JOIN: preservando linhas sem correspondência',
      'Como encontrar registros sem par (LEFT JOIN … WHERE … IS NULL)',
      'Junções com mais de duas tabelas e o cuidado com linhas duplicadas',
    ],
    materials: [
      link('PostgreSQL — Tutorial: junções entre tabelas', `${PG}/tutorial-join.html`),
      link('PostgreSQL — Expressões de tabela (FROM e JOIN)', `${PG}/queries-table-expressions.html`),
    ],
    exercise: {
      prompt: 'Com as tabelas clientes e pedidos, liste o nome de cada cliente com o valor de seus pedidos e, em outra consulta, os clientes que nunca compraram.',
      lab: { track: 'sql', level: 'intermediate' },
    },
    minutes: 240,
  },
  {
    key: 'ds.sql.groupby',
    title: 'GROUP BY e HAVING',
    objective: 'Ao terminar, consigo resumir dados por grupo com COUNT, SUM, AVG, MIN e MAX e filtrar os grupos com HAVING.',
    prerequisites: ['ds.sql.filtros'],
    content: [
      'Funções de agregação: COUNT, SUM, AVG, MIN e MAX',
      'COUNT(*) × COUNT(coluna) e o efeito dos valores NULL',
      'GROUP BY com uma ou mais colunas',
      'HAVING: filtro aplicado depois da agregação (diferente de WHERE)',
      'Agregação combinada com JOIN',
    ],
    materials: [
      link('PostgreSQL — Tutorial: funções de agregação', `${PG}/tutorial-agg.html`),
      link('PostgreSQL — Funções de agregação', `${PG}/functions-aggregate.html`),
    ],
    exercise: {
      prompt: 'Calcule, por categoria de produto, a quantidade de itens e o preço médio, mostrando apenas as categorias com mais de três produtos.',
      lab: { track: 'sql', level: 'basic' },
    },
    minutes: 180,
  },
  {
    key: 'ds.sql.subconsultas',
    title: 'Subconsultas',
    objective: 'Ao terminar, consigo usar uma consulta dentro de outra no WHERE, no FROM e no SELECT, inclusive subconsultas correlacionadas.',
    prerequisites: ['ds.sql.join', 'ds.sql.groupby'],
    content: [
      'Subconsulta escalar (devolve um único valor)',
      'Subconsultas com IN, EXISTS e NOT EXISTS',
      'Subconsulta no FROM (tabela derivada)',
      'Subconsulta correlacionada: avaliada para cada linha externa',
      'Quando preferir JOIN e quando preferir subconsulta',
    ],
    materials: [
      link('PostgreSQL — Expressões de subconsulta', `${PG}/functions-subquery.html`),
      link('PostgreSQL — Consultas (visão geral)', `${PG}/queries.html`),
    ],
    exercise: {
      prompt: 'Liste os funcionários que ganham acima da média da empresa e, depois, os que ganham acima da média do próprio setor.',
      lab: { track: 'sql', level: 'intermediate' },
    },
    minutes: 180,
  },
  {
    key: 'ds.sql.cte',
    title: 'CTE (WITH)',
    objective: 'Ao terminar, consigo organizar consultas longas em etapas nomeadas com WITH e escrever uma CTE recursiva simples.',
    prerequisites: ['ds.sql.subconsultas'],
    content: [
      'Sintaxe do WITH e escopo de uma CTE',
      'Encadeamento de várias CTEs na mesma consulta',
      'CTE × subconsulta × tabela temporária: legibilidade e reuso',
      'WITH RECURSIVE para sequências e hierarquias',
    ],
    materials: [
      link('PostgreSQL — Consultas WITH (CTE)', `${PG}/queries-with.html`),
    ],
    exercise: {
      prompt: 'Reescreva uma consulta com subconsultas aninhadas usando duas CTEs: uma com o total por cliente e outra que classifica os clientes por faixa de gasto.',
      lab: { track: 'sql', level: 'advanced' },
    },
    minutes: 150,
  },
  {
    key: 'ds.sql.window',
    title: 'Window Functions',
    objective: 'Ao terminar, consigo calcular rankings, acumulados e comparações entre linhas com OVER, PARTITION BY e ORDER BY sem perder o detalhe das linhas.',
    prerequisites: ['ds.sql.groupby', 'ds.sql.cte'],
    content: [
      'A cláusula OVER: PARTITION BY e ORDER BY',
      'ROW_NUMBER, RANK e DENSE_RANK',
      'Agregações em janela: soma acumulada e média móvel',
      'LAG e LEAD para comparar com a linha anterior ou a seguinte',
      'Padrão "o primeiro de cada grupo" com ROW_NUMBER',
    ],
    materials: [
      link('PostgreSQL — Tutorial: funções de janela', `${PG}/tutorial-window.html`),
      link('PostgreSQL — Funções de janela', `${PG}/functions-window.html`),
    ],
    exercise: {
      prompt: 'Para uma tabela de vendas mensais, calcule o faturamento acumulado no ano, a variação em relação ao mês anterior e o ranking dos vendedores em cada mês.',
      lab: { track: 'sql', level: 'advanced' },
    },
    minutes: 270,
  },
  {
    key: 'ds.sql.modelagem',
    title: 'Modelagem relacional',
    objective: 'Ao terminar, consigo desenhar um modelo com entidades, relacionamentos e chaves, normalizado até a terceira forma normal.',
    prerequisites: ['ds.sql.join'],
    content: [
      'Entidades, atributos e relacionamentos (1:1, 1:N e N:N)',
      'Chaves primárias, estrangeiras e tabelas associativas',
      'Normalização: 1FN, 2FN e 3FN',
      'Restrições: NOT NULL, UNIQUE, CHECK e FOREIGN KEY',
      'Noções de modelo dimensional (fato e dimensão) para análise',
    ],
    materials: [
      link('PostgreSQL — Definição de dados (DDL)', `${PG}/ddl.html`),
      link('PostgreSQL — Restrições', `${PG}/ddl-constraints.html`),
      link('PostgreSQL — Tutorial: chaves estrangeiras', `${PG}/tutorial-fk.html`),
    ],
    exercise: {
      prompt: 'Modele uma livraria (livros, autores, clientes e pedidos com vários itens), escreva os CREATE TABLE com as restrições e justifique cada chave estrangeira.',
    },
    minutes: 240,
  },
  {
    key: 'ds.sql.otimizacao',
    title: 'Otimização de consultas',
    objective: 'Ao terminar, consigo ler um plano de execução, identificar o gargalo e melhorar a consulta com índices e reescritas simples.',
    prerequisites: ['ds.sql.window', 'ds.sql.modelagem'],
    content: [
      'Como o banco executa uma consulta: varredura sequencial × uso de índice',
      'EXPLAIN e EXPLAIN ANALYZE: leitura do plano',
      'Índices: quando ajudam, quando atrapalham e índices compostos',
      'Filtros que impedem o uso de índice (funções sobre a coluna)',
      'Boas práticas: selecionar só o necessário e filtrar cedo',
    ],
    materials: [
      link('PostgreSQL — Usando o EXPLAIN', `${PG}/using-explain.html`),
      link('PostgreSQL — Índices', `${PG}/indexes.html`),
      link('PostgreSQL — Dicas de desempenho', `${PG}/performance-tips.html`),
    ],
    exercise: {
      prompt: 'Pegue uma consulta lenta com filtro por data e JOIN, rode EXPLAIN ANALYZE, crie um índice adequado e compare o plano e o tempo antes e depois.',
    },
    minutes: 240,
  },
  {
    key: 'ds.sql.analise',
    title: 'SQL aplicado à análise de dados',
    objective: 'Ao terminar, consigo responder perguntas de negócio com SQL: indicadores, séries por período, participações e comparações.',
    prerequisites: ['ds.sql.window'],
    content: [
      'Indicadores: faturamento, ticket médio, taxa de conversão e recorrência',
      'Agrupamento por período com funções de data',
      'Agregação condicional com CASE WHEN',
      'Participação percentual e comparação com o período anterior',
      'Análise de coorte e retenção em nível introdutório',
    ],
    materials: [
      link('PostgreSQL — Funções de data e hora', `${PG}/functions-datetime.html`),
      link('PostgreSQL — Expressões condicionais (CASE)', `${PG}/functions-conditional.html`),
    ],
    exercise: {
      prompt: 'Em uma base de pedidos, calcule por mês o faturamento, o ticket médio, a quantidade de clientes distintos e a variação percentual em relação ao mês anterior.',
      lab: { track: 'sql', level: 'intermediate' },
    },
    minutes: 240,
  },
  {
    key: 'ds.sql.projetos',
    title: 'Projetos práticos de SQL',
    objective: 'Ao terminar, consigo conduzir uma análise completa em SQL, da pergunta ao resultado documentado em um repositório.',
    prerequisites: ['ds.sql.otimizacao', 'ds.sql.analise'],
    content: [
      'Escolha de uma base pública e definição das perguntas de negócio',
      'Carga dos dados e conferência da qualidade',
      'Consultas analíticas organizadas e comentadas',
      'Documentação das decisões e dos resultados em um README',
    ],
    materials: [
      link('PostgreSQL — Tutorial completo', `${PG}/tutorial.html`),
      link('PostgreSQL — A linguagem SQL', `${PG}/sql.html`),
    ],
    exercise: {
      prompt: 'Escolha um dos projetos de SQL da área de projetos e entregue o arquivo .sql comentado e o README com as conclusões.',
    },
    minutes: 360,
    kind: 'project',
  },
]

const PYTHON_TOPICS: TrailTopicDef[] = [
  {
    key: 'ds.python.sintaxe',
    title: 'Sintaxe e fundamentos',
    objective: 'Ao terminar, consigo escrever e executar um programa simples com variáveis, operadores, entrada e saída.',
    prerequisites: [],
    content: [
      'Como executar Python: interpretador, arquivo .py e notebook',
      'Variáveis, atribuição e nomes válidos',
      'Operadores aritméticos, de comparação e lógicos',
      'print(), input() e f-strings',
      'Indentação e comentários',
    ],
    materials: [
      link('Python — Tutorial oficial', `${PY}/tutorial/index.html`),
      link('Python — Uma introdução informal', `${PY}/tutorial/introduction.html`),
    ],
    exercise: {
      prompt: 'Escreva um programa que peça o nome e o ano de nascimento da pessoa e mostre uma frase com a idade que ela completa neste ano.',
      lab: { track: 'python', level: 'first_steps' },
    },
    minutes: 120,
  },
  {
    key: 'ds.python.tipos',
    title: 'Tipos de dados',
    objective: 'Ao terminar, consigo usar e converter int, float, str e bool e manipular textos com fatiamento e métodos de string.',
    prerequisites: ['ds.python.sintaxe'],
    content: [
      'int, float, bool e None',
      'Strings: indexação, fatiamento e métodos mais usados',
      'Conversão entre tipos com int(), float() e str()',
      'Divisão real (/), inteira (//) e resto (%)',
      'Valores considerados verdadeiros ou falsos',
    ],
    materials: [
      link('Python — Tipos embutidos', `${PY}/library/stdtypes.html`),
      link('Python — Uma introdução informal (números e textos)', `${PY}/tutorial/introduction.html`),
    ],
    exercise: {
      prompt: 'Receba um CPF digitado com pontos e traço, remova a pontuação, confira se restaram 11 dígitos e mostre o número formatado novamente.',
      lab: { track: 'python', level: 'first_steps' },
    },
    minutes: 120,
  },
  {
    key: 'ds.python.condicionais',
    title: 'Estruturas condicionais',
    objective: 'Ao terminar, consigo fazer o programa tomar decisões com if, elif e else combinando condições.',
    prerequisites: ['ds.python.tipos'],
    content: [
      'if, elif e else',
      'Operadores de comparação e os conectivos and, or e not',
      'Condições aninhadas e como simplificá-las',
      'Expressão condicional em uma linha',
      'match/case em nível introdutório',
    ],
    materials: [
      link('Python — Ferramentas de controle de fluxo', `${PY}/tutorial/controlflow.html`),
    ],
    exercise: {
      prompt: 'Escreva um programa que receba a nota e a frequência de um aluno e informe se ele está aprovado, em recuperação ou reprovado, explicando o motivo.',
      lab: { track: 'python', level: 'basic' },
    },
    minutes: 90,
  },
  {
    key: 'ds.python.lacos',
    title: 'Laços de repetição',
    objective: 'Ao terminar, consigo repetir tarefas com for e while, percorrer coleções e escrever compreensões de lista.',
    prerequisites: ['ds.python.condicionais'],
    content: [
      'for com range() e sobre sequências',
      'while e condições de parada',
      'break, continue e a cláusula else dos laços',
      'enumerate() e zip()',
      'Compreensão de lista (list comprehension)',
    ],
    materials: [
      link('Python — Ferramentas de controle de fluxo', `${PY}/tutorial/controlflow.html`),
      link('Python — Estruturas de dados (compreensões)', `${PY}/tutorial/datastructures.html`),
    ],
    exercise: {
      prompt: 'Dada uma lista de valores de vendas, calcule com um laço o total, a média e a quantidade de vendas acima da média, sem usar funções prontas de estatística.',
      lab: { track: 'python', level: 'basic' },
    },
    minutes: 150,
  },
  {
    key: 'ds.python.funcoes',
    title: 'Funções',
    objective: 'Ao terminar, consigo dividir um programa em funções com parâmetros, valores padrão e retorno, entendendo o escopo das variáveis.',
    prerequisites: ['ds.python.lacos'],
    content: [
      'def, parâmetros e return',
      'Argumentos posicionais, nomeados e valores padrão',
      '*args e **kwargs',
      'Escopo local e global',
      'Funções lambda e docstrings',
    ],
    materials: [
      link('Python — Definindo funções', `${PY}/tutorial/controlflow.html`),
      link('Python — Funções embutidas', `${PY}/library/functions.html`),
    ],
    exercise: {
      prompt: 'Crie a função calcular_desconto(valor, percentual=10) com docstring e use-a em outra função que aplica o desconto a uma lista de preços.',
      lab: { track: 'python', level: 'basic' },
    },
    minutes: 180,
  },
  {
    key: 'ds.python.estruturas',
    title: 'Estruturas de dados',
    objective: 'Ao terminar, consigo escolher entre lista, tupla, dicionário e conjunto e usar seus principais métodos para resolver problemas.',
    prerequisites: ['ds.python.funcoes'],
    content: [
      'Listas: métodos, fatiamento e ordenação',
      'Tuplas e desempacotamento',
      'Dicionários: acesso, get(), items() e contagem por chave',
      'Conjuntos: união, interseção e diferença',
      'Cópia × referência em objetos mutáveis',
    ],
    materials: [
      link('Python — Estruturas de dados', `${PY}/tutorial/datastructures.html`),
      link('Python — Tipos embutidos', `${PY}/library/stdtypes.html`),
    ],
    exercise: {
      prompt: 'A partir de uma lista de pedidos (dicionários com cliente, categoria e valor), monte um dicionário com o total gasto por categoria e mostre a categoria campeã.',
      lab: { track: 'python', level: 'intermediate' },
    },
    minutes: 240,
  },
  {
    key: 'ds.python.arquivos',
    title: 'Manipulação de arquivos',
    objective: 'Ao terminar, consigo ler e gravar arquivos de texto, CSV e JSON com segurança usando with e pathlib.',
    prerequisites: ['ds.python.estruturas'],
    content: [
      'open(), modos de abertura e a instrução with',
      'Codificação de texto (encoding) e quebras de linha',
      'Leitura e escrita de CSV com o módulo csv',
      'Leitura e escrita de JSON com o módulo json',
      'Caminhos de arquivo com pathlib',
    ],
    materials: [
      link('Python — Entrada e saída (arquivos)', `${PY}/tutorial/inputoutput.html`),
      link('Python — Módulo csv', `${PY}/library/csv.html`),
      link('Python — Módulo pathlib', `${PY}/library/pathlib.html`),
    ],
    exercise: {
      prompt: 'Leia um arquivo CSV de vendas, some os valores por produto e grave o resultado em um arquivo JSON.',
      lab: { track: 'python', level: 'intermediate' },
    },
    minutes: 150,
  },
  {
    key: 'ds.python.erros',
    title: 'Tratamento de erros',
    objective: 'Ao terminar, consigo prever falhas, tratar exceções com try/except e emitir mensagens de erro úteis.',
    prerequisites: ['ds.python.arquivos'],
    content: [
      'Erros de sintaxe × exceções',
      'try, except, else e finally',
      'Captura de exceções específicas (ValueError, KeyError, FileNotFoundError)',
      'raise e criação de exceções próprias',
      'Como ler um traceback',
    ],
    materials: [
      link('Python — Erros e exceções', `${PY}/tutorial/errors.html`),
      link('Python — Exceções embutidas', `${PY}/library/exceptions.html`),
    ],
    exercise: {
      prompt: 'Modifique o leitor de CSV do tópico anterior para ignorar linhas com valor inválido, contar quantas foram descartadas e avisar quando o arquivo não existir.',
      lab: { track: 'python', level: 'intermediate' },
    },
    minutes: 120,
  },
  {
    key: 'ds.python.numpy',
    title: 'NumPy',
    objective: 'Ao terminar, consigo criar arrays, fazer operações vetorizadas, filtrar com máscaras e agregar por eixo.',
    prerequisites: ['ds.python.estruturas'],
    content: [
      'ndarray: criação, shape e dtype',
      'Indexação, fatiamento e máscaras booleanas',
      'Operações vetorizadas e broadcasting',
      'Agregações por eixo (axis)',
      'Geração de números aleatórios',
    ],
    materials: [
      link('NumPy — Guia para iniciantes', `${NP}/user/absolute_beginners.html`),
      link('NumPy — Início rápido', `${NP}/user/quickstart.html`),
      link('NumPy — Broadcasting', `${NP}/user/basics.broadcasting.html`),
    ],
    exercise: {
      prompt: 'Gere uma matriz 12 × 3 de vendas mensais de três lojas e calcule, sem laços, o total por loja, a média por mês e os meses acima da média.',
    },
    minutes: 240,
  },
  {
    key: 'ds.python.pandas',
    title: 'Pandas',
    objective: 'Ao terminar, consigo carregar, filtrar, transformar, agrupar e combinar tabelas com DataFrames.',
    prerequisites: ['ds.python.numpy', 'ds.python.arquivos'],
    content: [
      'Series e DataFrame; leitura de CSV e Excel',
      'Seleção com colchetes, loc e iloc e filtros booleanos',
      'Criação e transformação de colunas',
      'Valores ausentes: isna, fillna e dropna',
      'groupby, agregações e ordenação',
      'merge e concat para combinar tabelas',
    ],
    materials: [
      link('pandas — 10 minutos de pandas', `${PD}/user_guide/10min.html`),
      link('pandas — Primeiros passos', `${PD}/getting_started/index.html`),
      link('pandas — Guia do usuário', `${PD}/user_guide/index.html`),
    ],
    exercise: {
      prompt: 'Carregue um CSV de pedidos, trate os valores ausentes, crie a coluna de valor total e mostre o faturamento por categoria em ordem decrescente.',
    },
    minutes: 360,
  },
  {
    key: 'ds.python.visualizacao',
    title: 'Visualização de dados',
    objective: 'Ao terminar, consigo escolher o gráfico adequado para cada pergunta e produzi-lo com Matplotlib e pandas, com título e eixos claros.',
    prerequisites: ['ds.python.pandas'],
    content: [
      'Figure e Axes: a anatomia de um gráfico no Matplotlib',
      'Linhas, barras, histograma, dispersão e boxplot: quando usar cada um',
      'Títulos, rótulos, legendas e escalas',
      'Gráficos direto do DataFrame com .plot()',
      'Boas práticas: menos tinta, mais informação',
    ],
    materials: [
      link('Matplotlib — Tutoriais', 'https://matplotlib.org/stable/tutorials/index.html'),
      link('Matplotlib — Galeria de exemplos', 'https://matplotlib.org/stable/gallery/index.html'),
      link('pandas — Visualização', `${PD}/user_guide/visualization.html`),
    ],
    exercise: {
      prompt: 'Com uma base de vendas, produza um gráfico de linhas do faturamento mensal, um de barras por categoria e um histograma do valor dos pedidos, todos com título e eixos nomeados.',
    },
    minutes: 240,
  },
  {
    key: 'ds.python.eda',
    title: 'Análise exploratória',
    objective: 'Ao terminar, consigo investigar uma base desconhecida, descrever suas variáveis e apontar padrões, problemas e hipóteses.',
    prerequisites: ['ds.python.visualizacao'],
    content: [
      'Primeira inspeção: head, info, describe e tipos de coluna',
      'Distribuições, valores ausentes e valores atípicos',
      'Relações entre variáveis: correlação e tabelas cruzadas',
      'Comparação entre grupos com groupby e gráficos',
      'Registro das conclusões em um notebook legível',
    ],
    materials: [
      link('pandas — Funcionalidades essenciais', `${PD}/user_guide/basics.html`),
      link('pandas — Agrupamento (groupby)', `${PD}/user_guide/groupby.html`),
    ],
    exercise: {
      prompt: 'Escolha uma base pública, formule cinco perguntas e responda cada uma com uma tabela ou um gráfico acompanhado de uma frase de conclusão.',
    },
    minutes: 300,
  },
  {
    key: 'ds.python.automacao',
    title: 'Automação',
    objective: 'Ao terminar, consigo transformar uma análise em um script reutilizável que processa arquivos e gera relatórios sem intervenção manual.',
    prerequisites: ['ds.python.erros', 'ds.python.pandas'],
    content: [
      'Organização do código em script, funções e módulos',
      'Ambientes virtuais e dependências',
      'Percorrer pastas e arquivos com pathlib',
      'Argumentos de linha de comando com argparse',
      'Registro de execução com logging',
    ],
    materials: [
      link('Python — Módulo pathlib', `${PY}/library/pathlib.html`),
      link('Python — Módulo argparse', `${PY}/library/argparse.html`),
      link('Python — Ambientes virtuais e pacotes', `${PY}/tutorial/venv.html`),
    ],
    exercise: {
      prompt: 'Escreva um script que leia todos os CSVs de uma pasta, consolide os dados e grave um resumo em Excel, recebendo a pasta como argumento.',
      lab: { track: 'python', level: 'advanced' },
    },
    minutes: 240,
  },
  {
    key: 'ds.python.projetos',
    title: 'Projetos aplicados de Python',
    objective: 'Ao terminar, consigo entregar um projeto de dados em Python, do dado bruto ao resultado publicado em um repositório.',
    prerequisites: ['ds.python.eda', 'ds.python.automacao'],
    content: [
      'Definição do problema e escolha da base',
      'Limpeza, análise e visualização em um fluxo reproduzível',
      'Estrutura de pastas, README e arquivo de dependências',
      'Publicação do projeto no GitHub',
    ],
    materials: [
      link('Python — Tutorial oficial', `${PY}/tutorial/index.html`),
      link('pandas — Guia do usuário', `${PD}/user_guide/index.html`),
    ],
    exercise: {
      prompt: 'Escolha um dos projetos de Python da área de projetos e publique o repositório com notebook, README e instruções para reproduzir.',
    },
    minutes: 360,
    kind: 'project',
  },
]

const ML_TOPICS: TrailTopicDef[] = [
  {
    key: 'ds.ml.estatistica',
    title: 'Fundamentos estatísticos',
    objective: 'Ao terminar, consigo resumir um conjunto de dados com medidas de posição e dispersão e interpretar correlação e amostragem.',
    prerequisites: ['ds.python.numpy'],
    content: [
      'Média, mediana e moda; efeito de valores atípicos',
      'Variância, desvio-padrão e quartis',
      'População × amostra e viés de amostragem',
      'Correlação e por que ela não implica causalidade',
      'Noções de intervalo de confiança e teste de hipótese',
    ],
    materials: [
      link('SciPy — Tutorial de estatística', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html'),
      link('Python — Módulo statistics', `${PY}/library/statistics.html`),
    ],
    exercise: {
      prompt: 'Para uma coluna numérica de uma base real, calcule média, mediana, desvio-padrão e quartis e explique em três frases o que esses números dizem.',
    },
    minutes: 240,
  },
  {
    key: 'ds.ml.probabilidade',
    title: 'Probabilidade',
    objective: 'Ao terminar, consigo calcular probabilidades simples e condicionais, aplicar o teorema de Bayes e reconhecer as distribuições mais comuns.',
    prerequisites: ['ds.ml.estatistica'],
    content: [
      'Eventos, espaço amostral e regras da soma e do produto',
      'Probabilidade condicional e independência',
      'Teorema de Bayes',
      'Distribuições binomial, normal e uniforme',
      'Valor esperado e variância',
    ],
    materials: [
      link('SciPy — Tutorial de estatística (distribuições)', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html'),
      link('NumPy — Amostragem aleatória', `${NP}/reference/random/index.html`),
    ],
    exercise: {
      prompt: 'Simule 10.000 lançamentos de dois dados com NumPy e compare a frequência da soma 7 com a probabilidade calculada à mão.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.algebra',
    title: 'Álgebra linear aplicada',
    objective: 'Ao terminar, consigo operar com vetores e matrizes no NumPy e relacionar essas operações ao funcionamento dos modelos.',
    prerequisites: ['ds.python.numpy'],
    content: [
      'Vetores, matrizes e suas dimensões (shape)',
      'Produto escalar e produto de matrizes',
      'Transposta, identidade e inversa',
      'Distância e norma entre vetores',
      'Como um modelo linear é escrito na forma X · w',
    ],
    materials: [
      link('NumPy — Álgebra linear', `${NP}/reference/routines.linalg.html`),
      link('NumPy — Início rápido', `${NP}/user/quickstart.html`),
    ],
    exercise: {
      prompt: 'Com NumPy, calcule as previsões de um modelo linear a partir de uma matriz X (5 × 2) e de um vetor de pesos, conferindo uma das linhas à mão.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.preparacao',
    title: 'Preparação de dados',
    objective: 'Ao terminar, consigo deixar uma base pronta para modelagem: tratar ausentes, codificar categorias, padronizar escalas e separar treino e teste sem vazamento.',
    prerequisites: ['ds.python.pandas', 'ds.ml.estatistica'],
    content: [
      'Separação entre treino e teste antes de qualquer ajuste',
      'Imputação de valores ausentes',
      'Codificação de variáveis categóricas (one-hot e ordinal)',
      'Padronização e normalização de variáveis numéricas',
      'Vazamento de dados (data leakage) e como evitá-lo',
    ],
    materials: [
      link('scikit-learn — Pré-processamento de dados', `${SK}/modules/preprocessing.html`),
      link('scikit-learn — Imputação de valores ausentes', `${SK}/modules/impute.html`),
      link('scikit-learn — Armadilhas comuns', `${SK}/common_pitfalls.html`),
    ],
    exercise: {
      prompt: 'Em uma base com colunas numéricas e categóricas, separe treino e teste, impute os ausentes, codifique as categorias e padronize os números ajustando tudo apenas no treino.',
    },
    minutes: 270,
  },
  {
    key: 'ds.ml.eda',
    title: 'Análise exploratória para modelagem',
    objective: 'Ao terminar, consigo explorar uma base com foco na variável-alvo e levantar hipóteses sobre quais variáveis ajudam o modelo.',
    prerequisites: ['ds.python.eda', 'ds.ml.estatistica'],
    content: [
      'Distribuição da variável-alvo e desbalanceamento de classes',
      'Relação de cada variável com o alvo',
      'Correlação entre variáveis explicativas',
      'Valores atípicos e erros de registro',
      'Definição de uma linha de base (baseline) simples',
    ],
    materials: [
      link('pandas — Visualização', `${PD}/user_guide/visualization.html`),
      link('scikit-learn — Guia do usuário', `${SK}/user_guide.html`),
    ],
    exercise: {
      prompt: 'Para uma base de classificação, mostre a proporção das classes, três gráficos relacionando variáveis ao alvo e a acurácia de uma baseline que sempre prevê a classe mais frequente.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.regressao',
    title: 'Regressão',
    objective: 'Ao terminar, consigo treinar e interpretar uma regressão linear e avaliar o erro com MAE, RMSE e R².',
    prerequisites: ['ds.ml.algebra', 'ds.ml.preparacao'],
    content: [
      'Regressão linear simples e múltipla',
      'Interpretação de coeficientes e do intercepto',
      'Métricas: MAE, MSE, RMSE e R²',
      'Regularização: Ridge e Lasso',
      'Análise de resíduos',
    ],
    materials: [
      link('scikit-learn — Modelos lineares', `${SK}/modules/linear_model.html`),
      link('scikit-learn — Primeiros passos', `${SK}/getting_started.html`),
    ],
    exercise: {
      prompt: 'Treine uma regressão linear para prever o preço de imóveis, informe MAE e R² no teste e explique o significado de dois coeficientes.',
    },
    minutes: 270,
  },
  {
    key: 'ds.ml.classificacao',
    title: 'Classificação',
    objective: 'Ao terminar, consigo treinar um classificador, interpretar as probabilidades previstas e ajustar o limiar de decisão.',
    prerequisites: ['ds.ml.probabilidade', 'ds.ml.regressao'],
    content: [
      'Problemas binários e multiclasse',
      'Regressão logística e probabilidades previstas',
      'Limiar de decisão e seu efeito em precisão e recall',
      'k-vizinhos mais próximos (KNN) como contraste',
      'Classes desbalanceadas',
    ],
    materials: [
      link('scikit-learn — Regressão logística e modelos lineares', `${SK}/modules/linear_model.html`),
      link('scikit-learn — Vizinhos mais próximos', `${SK}/modules/neighbors.html`),
    ],
    exercise: {
      prompt: 'Treine uma regressão logística para prever cancelamento de clientes e compare precisão e recall com os limiares 0,5 e 0,3.',
    },
    minutes: 270,
  },
  {
    key: 'ds.ml.arvores',
    title: 'Árvores e Random Forest',
    objective: 'Ao terminar, consigo treinar árvores de decisão e florestas aleatórias, controlar o sobreajuste e ler a importância das variáveis.',
    prerequisites: ['ds.ml.classificacao'],
    content: [
      'Como uma árvore escolhe as divisões (impureza)',
      'Profundidade, mínimo de amostras e sobreajuste',
      'Bagging e a ideia da Random Forest',
      'Importância de variáveis',
      'Vantagens: dispensa padronização e capta relações não lineares',
    ],
    materials: [
      link('scikit-learn — Árvores de decisão', `${SK}/modules/tree.html`),
      link('scikit-learn — Métodos de ensemble', `${SK}/modules/ensemble.html`),
    ],
    exercise: {
      prompt: 'Compare uma árvore sem limite de profundidade, uma árvore com max_depth=4 e uma Random Forest na mesma base, anotando o desempenho em treino e em teste.',
    },
    minutes: 240,
  },
  {
    key: 'ds.ml.boosting',
    title: 'Gradient Boosting',
    objective: 'Ao terminar, consigo treinar um modelo de gradient boosting e ajustar taxa de aprendizado, número de árvores e parada antecipada.',
    prerequisites: ['ds.ml.arvores'],
    content: [
      'Boosting × bagging: árvores em sequência corrigindo erros',
      'Taxa de aprendizado e número de árvores',
      'Parada antecipada (early stopping)',
      'HistGradientBoosting no scikit-learn',
      'Bibliotecas especializadas: XGBoost e LightGBM',
    ],
    materials: [
      link('scikit-learn — Métodos de ensemble (gradient boosting)', `${SK}/modules/ensemble.html`),
      link('XGBoost — Documentação', 'https://xgboost.readthedocs.io/en/stable/'),
    ],
    exercise: {
      prompt: 'Treine um HistGradientBoostingClassifier com parada antecipada e compare o resultado com a Random Forest do tópico anterior.',
    },
    minutes: 240,
  },
  {
    key: 'ds.ml.nao_supervisionado',
    title: 'Aprendizado não supervisionado',
    objective: 'Ao terminar, consigo agrupar dados sem rótulo com K-Means e reduzir dimensões com PCA, interpretando os resultados.',
    prerequisites: ['ds.ml.algebra', 'ds.ml.preparacao'],
    content: [
      'Quando não há variável-alvo: agrupamento e redução de dimensionalidade',
      'K-Means e a escolha do número de grupos',
      'Importância da padronização em métodos baseados em distância',
      'PCA: componentes e variância explicada',
      'Interpretação e nomeação dos grupos',
    ],
    materials: [
      link('scikit-learn — Agrupamento (clustering)', `${SK}/modules/clustering.html`),
      link('scikit-learn — Decomposição (PCA)', `${SK}/modules/decomposition.html`),
    ],
    exercise: {
      prompt: 'Segmente uma base de clientes com K-Means testando de 2 a 6 grupos, escolha um valor justificando e descreva o perfil de cada grupo.',
    },
    minutes: 240,
  },
  {
    key: 'ds.ml.avaliacao',
    title: 'Avaliação de modelos',
    objective: 'Ao terminar, consigo escolher a métrica certa para o problema e ler matriz de confusão, precisão, recall, F1 e curva ROC.',
    prerequisites: ['ds.ml.classificacao'],
    content: [
      'Matriz de confusão',
      'Acurácia, precisão, recall e F1',
      'Curvas ROC e precisão-recall; AUC',
      'Métricas de regressão revisitadas',
      'Como o custo dos erros define a métrica',
    ],
    materials: [
      link('scikit-learn — Métricas e avaliação', `${SK}/modules/model_evaluation.html`),
    ],
    exercise: {
      prompt: 'Para um classificador já treinado, monte a matriz de confusão, calcule precisão, recall e F1 à mão e confira com o classification_report.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.validacao',
    title: 'Validação cruzada',
    objective: 'Ao terminar, consigo estimar o desempenho de um modelo com validação cruzada e ajustar hiperparâmetros sem contaminar o conjunto de teste.',
    prerequisites: ['ds.ml.avaliacao'],
    content: [
      'Treino, validação e teste: o papel de cada conjunto',
      'K-Fold e K-Fold estratificado',
      'Validação para séries temporais',
      'Busca de hiperparâmetros com GridSearchCV e RandomizedSearchCV',
      'Sobreajuste ao conjunto de validação',
    ],
    materials: [
      link('scikit-learn — Validação cruzada', `${SK}/modules/cross_validation.html`),
      link('scikit-learn — Ajuste de hiperparâmetros', `${SK}/modules/grid_search.html`),
    ],
    exercise: {
      prompt: 'Avalie dois modelos com validação cruzada estratificada de 5 partes, informe média e desvio-padrão da métrica e ajuste um hiperparâmetro com GridSearchCV.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.features',
    title: 'Feature Engineering',
    objective: 'Ao terminar, consigo criar, transformar e selecionar variáveis que melhoram o modelo sem introduzir vazamento.',
    prerequisites: ['ds.ml.preparacao', 'ds.ml.validacao'],
    content: [
      'Variáveis derivadas de datas, textos e categorias',
      'Transformações: logaritmo, faixas (binning) e interações',
      'Agregações por entidade (por cliente, por produto)',
      'Seleção de variáveis',
      'Vazamento do alvo (target leakage)',
    ],
    materials: [
      link('scikit-learn — Pré-processamento de dados', `${SK}/modules/preprocessing.html`),
      link('scikit-learn — Seleção de variáveis', `${SK}/modules/feature_selection.html`),
    ],
    exercise: {
      prompt: 'Crie pelo menos cinco novas variáveis em uma base com datas e categorias e meça, com validação cruzada, quanto cada grupo de variáveis melhora o modelo.',
    },
    minutes: 240,
  },
  {
    key: 'ds.ml.pipelines',
    title: 'Pipelines',
    objective: 'Ao terminar, consigo encadear pré-processamento e modelo em um Pipeline do scikit-learn, validá-lo e salvá-lo.',
    prerequisites: ['ds.ml.features'],
    content: [
      'Pipeline: etapas de transformação seguidas do estimador',
      'ColumnTransformer para colunas numéricas e categóricas',
      'Pipeline dentro da validação cruzada e da busca de hiperparâmetros',
      'Persistência do modelo treinado',
    ],
    materials: [
      link('scikit-learn — Pipelines e estimadores compostos', `${SK}/modules/compose.html`),
      link('scikit-learn — Persistência de modelos', `${SK}/model_persistence.html`),
    ],
    exercise: {
      prompt: 'Monte um Pipeline com ColumnTransformer (imputação, padronização e one-hot) e um classificador, avalie com validação cruzada e salve o modelo final.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.mlops',
    title: 'Introdução a MLOps',
    objective: 'Ao terminar, consigo registrar experimentos, versionar modelos e explicar como um modelo é publicado e monitorado em produção.',
    prerequisites: ['ds.ml.pipelines'],
    content: [
      'Ciclo de vida de um modelo: do experimento à produção',
      'Rastreamento de experimentos (parâmetros, métricas e artefatos)',
      'Versionamento de dados, código e modelos',
      'Formas de servir um modelo: lote e API',
      'Monitoramento e desvio dos dados (data drift)',
    ],
    materials: [
      link('MLflow — Documentação', 'https://mlflow.org/docs/latest/'),
      link('scikit-learn — Persistência de modelos', `${SK}/model_persistence.html`),
    ],
    exercise: {
      prompt: 'Registre no MLflow três execuções do seu pipeline com hiperparâmetros diferentes e compare as métricas pela interface.',
    },
    minutes: 210,
  },
  {
    key: 'ds.ml.projetos',
    title: 'Projetos reais de Machine Learning',
    objective: 'Ao terminar, consigo conduzir um projeto de Machine Learning de ponta a ponta e apresentar resultados e limitações.',
    prerequisites: ['ds.ml.boosting', 'ds.ml.nao_supervisionado', 'ds.ml.mlops'],
    content: [
      'Formulação do problema e da métrica de sucesso',
      'Baseline, experimentos e comparação de modelos',
      'Validação honesta e análise de erros',
      'Comunicação dos resultados e das limitações',
    ],
    materials: [
      link('scikit-learn — Guia do usuário', `${SK}/user_guide.html`),
      link('scikit-learn — Armadilhas comuns', `${SK}/common_pitfalls.html`),
    ],
    exercise: {
      prompt: 'Escolha um dos projetos de Machine Learning da área de projetos e publique o repositório com notebook, modelo salvo e README com métricas e limitações.',
    },
    minutes: 480,
    kind: 'project',
  },
]

const INGLES_TOPICS: TrailTopicDef[] = [
  {
    key: 'ds.ingles.leitura',
    title: 'Leitura de documentação',
    objective: 'Ao terminar, consigo ler uma página de documentação técnica em inglês e extrair o que a função faz, seus parâmetros e avisos.',
    prerequisites: [],
    content: [
      'Estrutura típica de uma página de documentação',
      'Leitura por varredura: títulos, exemplos e notas',
      'Expressões recorrentes: by default, deprecated, returns, raises',
      'Como inferir o significado pelo contexto antes de traduzir',
    ],
    materials: [
      link('Python — Tutorial oficial (em inglês)', `${PY}/tutorial/index.html`),
      link('British Council — Reading', 'https://learnenglish.britishcouncil.org/skills/reading'),
    ],
    exercise: {
      prompt: 'Leia uma seção curta do tutorial oficial de Python em inglês e escreva, em português, três frases resumindo o que aprendeu.',
    },
    minutes: 15,
  },
  {
    key: 'ds.ingles.vocabulario',
    title: 'Vocabulário técnico',
    objective: 'Ao terminar, consigo reconhecer e usar os termos mais frequentes de programação e dados, evitando falsos cognatos.',
    prerequisites: ['ds.ingles.leitura'],
    content: [
      'Verbos de documentação: return, raise, pass, fetch, parse, deploy',
      'Termos de dados: dataset, feature, label, outlier, pipeline',
      'Falsos cognatos: actually, eventually, support, resume',
      'Revisão espaçada com um glossário pessoal',
    ],
    materials: [
      link('Google — Glossário de Machine Learning', 'https://developers.google.com/machine-learning/glossary'),
      link('Cambridge Dictionary', 'https://dictionary.cambridge.org/'),
    ],
    exercise: {
      prompt: 'Anote dez termos novos encontrados na documentação da semana e escreva uma frase em inglês com cada um.',
    },
    minutes: 10,
  },
  {
    key: 'ds.ingles.listening',
    title: 'Listening',
    objective: 'Ao terminar, consigo acompanhar um vídeo técnico curto em inglês e anotar suas ideias principais.',
    prerequisites: ['ds.ingles.vocabulario'],
    content: [
      'Escuta com legenda em inglês e, depois, sem legenda',
      'Reconhecimento de termos técnicos pela pronúncia',
      'Anotação de palavras-chave enquanto ouve',
      'Sotaques e ritmos diferentes de fala',
    ],
    materials: [
      link('British Council — Listening', 'https://learnenglish.britishcouncil.org/skills/listening'),
      link('BBC Learning English', 'https://www.bbc.co.uk/learningenglish/'),
    ],
    exercise: {
      prompt: 'Assista a cinco minutos de uma palestra técnica em inglês com legenda em inglês e anote cinco ideias principais.',
    },
    minutes: 15,
  },
  {
    key: 'ds.ingles.speaking',
    title: 'Speaking',
    objective: 'Ao terminar, consigo explicar em voz alta, em inglês simples, o que um trecho de código ou uma análise faz.',
    prerequisites: ['ds.ingles.listening'],
    content: [
      'Pronúncia de termos técnicos frequentes',
      'Frases para explicar código: "this function takes…", "it returns…"',
      'Técnica de repetição (shadowing) com trechos curtos',
      'Gravar a própria fala e ouvir depois',
    ],
    materials: [
      link('British Council — Speaking', 'https://learnenglish.britishcouncil.org/skills/speaking'),
      link('BBC Learning English', 'https://www.bbc.co.uk/learningenglish/'),
    ],
    exercise: {
      prompt: 'Grave um áudio de dois minutos explicando em inglês uma consulta SQL ou uma função em Python que você escreveu nesta semana.',
    },
    minutes: 15,
  },
  {
    key: 'ds.ingles.escrita',
    title: 'Escrita profissional',
    objective: 'Ao terminar, consigo escrever mensagens de commit, descrições de pull request e e-mails curtos em inglês claro e educado.',
    prerequisites: ['ds.ingles.vocabulario'],
    content: [
      'Mensagens de commit no imperativo: "Add", "Fix", "Remove"',
      'Descrição de pull request: contexto, mudança e como testar',
      'Pedidos educados: "Could you…", "Would you mind…"',
      'Tempos verbais mais usados: presente, passado simples e voz passiva',
    ],
    materials: [
      link('British Council — Writing', 'https://learnenglish.britishcouncil.org/skills/writing'),
      link('Google — Guia de estilo para documentação', 'https://developers.google.com/style'),
    ],
    exercise: {
      prompt: 'Escreva em inglês a mensagem de commit e a descrição de pull request de uma alteração que você fez em um projeto.',
    },
    minutes: 20,
  },
  {
    key: 'ds.ingles.entrevistas',
    title: 'Entrevistas técnicas em inglês',
    objective: 'Ao terminar, consigo me apresentar e descrever um projeto e minha experiência em inglês em uma entrevista técnica.',
    prerequisites: ['ds.ingles.speaking', 'ds.ingles.escrita'],
    content: [
      'Apresentação pessoal em um minuto',
      'Perguntas comuns: "Tell me about yourself", "Walk me through…"',
      'Descrição de um projeto: situação, tarefa, ação e resultado',
      'Como pedir que repitam ou esclareçam uma pergunta',
    ],
    materials: [
      link('BBC Learning English', 'https://www.bbc.co.uk/learningenglish/'),
      link('British Council — Grammar', 'https://learnenglish.britishcouncil.org/grammar'),
    ],
    exercise: {
      prompt: 'Escreva e grave em inglês a resposta para "Tell me about a data project you are proud of", com no máximo dois minutos.',
    },
    minutes: 20,
  },
  {
    key: 'ds.ingles.ciencia_dados',
    title: 'Inglês para Ciência de Dados',
    objective: 'Ao terminar, consigo ler artigos, documentação e discussões de Ciência de Dados em inglês e apresentar resultados de uma análise.',
    prerequisites: ['ds.ingles.vocabulario'],
    content: [
      'Vocabulário de estatística e Machine Learning',
      'Leitura de documentação do scikit-learn e do pandas',
      'Como descrever gráficos e tendências: "increases", "drops", "remains stable"',
      'Como relatar métricas e limitações de um modelo',
    ],
    materials: [
      link('Google — Glossário de Machine Learning', 'https://developers.google.com/machine-learning/glossary'),
      link('scikit-learn — Glossário de termos', `${SK}/glossary.html`),
    ],
    exercise: {
      prompt: 'Escreva em inglês um parágrafo de cinco frases descrevendo um gráfico e a principal conclusão de uma análise sua.',
    },
    minutes: 15,
  },
]

const POWERBI_TOPICS: TrailTopicDef[] = [
  {
    key: 'ds.powerbi.dax',
    title: 'DAX intermediário e avançado',
    objective: 'Ao terminar, consigo escrever medidas com CALCULATE, iteradores e inteligência de tempo entendendo os contextos de linha e de filtro.',
    prerequisites: [],
    content: [
      'Medida × coluna calculada',
      'Contexto de linha, contexto de filtro e transição de contexto',
      'CALCULATE e modificadores de filtro (ALL, REMOVEFILTERS, KEEPFILTERS)',
      'Iteradores: SUMX, AVERAGEX e RANKX',
      'Inteligência de tempo: TOTALYTD, SAMEPERIODLASTYEAR e DATEADD',
      'Variáveis (VAR) e DIVIDE',
    ],
    materials: [
      link('Microsoft Learn — Referência de DAX', `${MS}/dax/`),
      link('Microsoft Learn — Função CALCULATE', `${MS}/dax/calculate-function-dax`),
    ],
    exercise: {
      prompt: 'Crie as medidas de faturamento, faturamento do ano anterior, variação percentual e participação no total e valide os números em uma matriz.',
    },
    minutes: 300,
  },
  {
    key: 'ds.powerbi.modelagem',
    title: 'Modelagem de dados',
    objective: 'Ao terminar, consigo montar um modelo em esquema estrela com tabelas fato e dimensão, relacionamentos corretos e tabela calendário.',
    prerequisites: [],
    content: [
      'Esquema estrela: fatos e dimensões',
      'Relacionamentos: cardinalidade e direção do filtro',
      'Tabela calendário e marcação como tabela de datas',
      'Como evitar relacionamentos bidirecionais e muitos-para-muitos',
      'Granularidade das tabelas fato',
    ],
    materials: [
      link('Microsoft Learn — Esquema estrela no Power BI', `${MS}/power-bi/guidance/star-schema`),
      link('Microsoft Learn — Relacionamentos de modelo', `${MS}/power-bi/transform-model/desktop-relationships-understand`),
    ],
    exercise: {
      prompt: 'Transforme uma planilha única de vendas em um modelo estrela com as dimensões produto, cliente e calendário e confira se os totais continuam iguais.',
    },
    minutes: 240,
  },
  {
    key: 'ds.powerbi.power_query',
    title: 'Power Query',
    objective: 'Ao terminar, consigo conectar, limpar e remodelar dados no Power Query com etapas reproduzíveis e parâmetros.',
    prerequisites: [],
    content: [
      'Conexão com arquivos, pastas e bancos de dados',
      'Limpeza: tipos de dados, colunas, linhas e valores nulos',
      'Mesclar e acrescentar consultas',
      'Transformar colunas em linhas (unpivot) e agrupar',
      'Dobramento de consulta (query folding) e noções da linguagem M',
    ],
    materials: [
      link('Microsoft Learn — Documentação do Power Query', `${MS}/power-query/`),
      link('Microsoft Learn — Referência da linguagem M', `${MS}/powerquery-m/`),
    ],
    exercise: {
      prompt: 'Combine os arquivos mensais de uma pasta em uma única tabela, corrija os tipos de dados e transforme as colunas de meses em linhas.',
    },
    minutes: 240,
  },
  {
    key: 'ds.powerbi.desempenho',
    title: 'Otimização de desempenho',
    objective: 'Ao terminar, consigo diagnosticar um relatório lento e reduzir o tamanho do modelo e o tempo das consultas.',
    prerequisites: ['ds.powerbi.dax', 'ds.powerbi.modelagem', 'ds.powerbi.power_query'],
    content: [
      'Analisador de Desempenho: tempo de cada visual e da consulta DAX',
      'Redução do modelo: remoção de colunas e diminuição da cardinalidade',
      'Importação × DirectQuery',
      'Medidas eficientes: variáveis e filtros simples',
      'Menos visuais por página e interações bem definidas',
    ],
    materials: [
      link('Microsoft Learn — Guia de otimização do Power BI', `${MS}/power-bi/guidance/power-bi-optimization`),
      link('Microsoft Learn — Técnicas de redução de dados', `${MS}/power-bi/guidance/import-modeling-data-reduction`),
    ],
    exercise: {
      prompt: 'Use o Analisador de Desempenho em um relatório seu, identifique o visual mais lento e aplique duas melhorias medindo o antes e o depois.',
    },
    minutes: 180,
  },
  {
    key: 'ds.powerbi.visualizacao',
    title: 'Visualização profissional',
    objective: 'Ao terminar, consigo montar um relatório claro e consistente, com hierarquia visual, navegação e elementos de acessibilidade.',
    prerequisites: ['ds.powerbi.dax', 'ds.powerbi.modelagem'],
    content: [
      'Escolha do visual adequado para cada pergunta',
      'Layout, alinhamento e hierarquia visual',
      'Temas, cores e formatação condicional',
      'Segmentações, indicadores (bookmarks) e drill-through',
      'Acessibilidade e narrativa do relatório',
    ],
    materials: [
      link('Microsoft Learn — Documentação do Power BI', `${MS}/power-bi/`),
      link('Microsoft Learn — Orientações do Power BI', `${MS}/power-bi/guidance/`),
    ],
    exercise: {
      prompt: 'Redesenhe uma página de relatório existente aplicando tema, alinhamento e um cartão de destaque, e crie uma página de detalhes com drill-through.',
    },
    minutes: 180,
  },
]

export const DS_TRACKS: TrackDef[] = [
  {
    key: 'sql',
    trailKey: 'ds.sql',
    name: 'SQL',
    share: 30,
    summary: 'Das primeiras consultas a análises com JOIN, CTE e Window Functions, até modelagem, otimização e projetos.',
    topics: SQL_TOPICS,
  },
  {
    key: 'python',
    trailKey: 'ds.python',
    name: 'Python',
    share: 30,
    summary: 'Da sintaxe básica a NumPy, Pandas, visualização, análise exploratória e automação de relatórios.',
    topics: PYTHON_TOPICS,
  },
  {
    key: 'ml',
    trailKey: 'ds.ml',
    name: 'Machine Learning',
    share: 25,
    summary: 'Da base estatística aos modelos supervisionados e não supervisionados, com validação, pipelines e noções de MLOps.',
    topics: ML_TOPICS,
  },
  {
    key: 'ingles',
    trailKey: 'ds.ingles',
    name: 'Inglês para tecnologia',
    share: 10,
    summary: 'Sessões curtas e frequentes de leitura, vocabulário, escuta, fala e escrita voltadas ao dia a dia de dados.',
    shortSessions: true,
    topics: INGLES_TOPICS,
  },
  {
    key: 'powerbi',
    trailKey: 'ds.powerbi',
    name: 'Power BI',
    share: 5,
    summary: 'Aprofundamento em DAX, modelagem, Power Query, desempenho e apresentação profissional de relatórios.',
    topics: POWERBI_TOPICS,
  },
]

/** Todos os tópicos, na ordem dos pilares. */
export const DS_TOPICS: TrailTopicDef[] = DS_TRACKS.flatMap((track) => track.topics)

const TOPIC_INDEX = new Map<string, { topic: TrailTopicDef; track: TrackDef }>(
  DS_TRACKS.flatMap((track) => track.topics.map((topic) => [topic.key, { topic, track }] as const)),
)

export function trackOf(topicKey: string): TrackDef | undefined {
  return TOPIC_INDEX.get(topicKey)?.track
}

export function topicByKey(key: string): TrailTopicDef | undefined {
  return TOPIC_INDEX.get(key)?.topic
}

export function trackByKey(key: TrackKey): TrackDef | undefined {
  return DS_TRACKS.find((track) => track.key === key)
}
