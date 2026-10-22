import type { SubjectContent } from '../types'
import { cat, code, err, fill, match, mcq, multi, num, order, out, pyLab, short, step, tf } from './_build'

const content: SubjectContent = {
  subjectId: 'python',
  units: [
    {
      id: 'python.u1',
      title: 'Fundamentos para dados',
      summary: 'Tipos, listas, dicionários, laços e funções.',
      topics: [
        { id: 'tipos', name: 'Tipos e operadores' },
        { id: 'colecoes', name: 'Listas e dicionários' },
        { id: 'funcoes', name: 'Laços, compreensões e funções' },
      ],
      lesson: [
        { title: 'Tipos básicos', body: 'int (inteiros), float (decimais), str (texto), bool (True/False) e None (ausência de valor). A divisão / sempre retorna float; // é a divisão inteira e % o resto.', example: '7 / 2   # 3.5\n7 // 2  # 3\n7 % 2   # 1' },
        { title: 'Listas', body: 'Listas são sequências mutáveis com índice a partir de 0. Índices negativos contam do fim; fatias [início:fim] não incluem o fim.', example: 'v = [10, 20, 30, 40]\nv[0]    # 10\nv[-1]   # 40\nv[1:3]  # [20, 30]' },
        { title: 'Dicionários', body: 'Pares chave → valor. Use .get(chave, padrão) para evitar KeyError e .items() para percorrer pares.', example: "precos = {'caneta': 5, 'caderno': 25}\nprecos.get('lapis', 0)  # 0" },
        { title: 'Compreensões', body: 'Uma list comprehension cria listas de forma declarativa: [expressão for item in iterável if condição].', example: 'quadrados = [x * x for x in range(5) if x % 2 == 0]  # [0, 4, 16]' },
        { title: 'Funções', body: 'def define uma função; return devolve o valor (sem return, a função devolve None). Evite listas como valor padrão de parâmetro: o objeto é compartilhado entre chamadas.' },
      ],
      challenges: [
        out('python.u1.c01', 'tipos', 1, 'O que é impresso?', 'print(7 // 2, 7 % 2)', 'python', ['3 1'], '// é a divisão inteira (3) e % o resto (1). print separa os valores com espaço.'),
        mcq('python.u1.c02', 'tipos', 1, 'Qual o tipo de `3 / 3` em Python 3?', ['int', 'float', 'str', 'bool'], 1, 'O operador / sempre retorna float: 3 / 3 == 1.0.', { whyWrong: 'Para obter int use //.' }),
        out('python.u1.c03', 'colecoes', 1, 'O que é impresso?', 'v = [10, 20, 30, 40]\nprint(v[-1], v[1:3])', 'python', ['40 [20, 30]'], 'v[-1] é o último elemento; a fatia [1:3] pega os índices 1 e 2 (o 3 não entra).'),
        tf('python.u1.c04', 'colecoes', 1, 'Tuplas são imutáveis: depois de criadas, não é possível trocar um elemento.', true, 'Por isso tuplas podem ser chaves de dicionário, enquanto listas não.'),
        mcq('python.u1.c05', 'colecoes', 2, "Dado d = {'a': 1}, o que `d.get('b', 0)` retorna?", ['KeyError', 'None', '0', "'b'"], 2, '.get devolve o valor padrão (0) quando a chave não existe. d["b"] lançaria KeyError.'),
        out('python.u1.c06', 'funcoes', 2, 'O que é impresso?', 'print([x * x for x in range(5) if x % 2 == 0])', 'python', ['[0, 4, 16]'], 'range(5) gera 0..4; os pares são 0, 2 e 4; seus quadrados: 0, 4, 16.'),
        fill('python.u1.c07', 'funcoes', 1, 'Complete a definição de função.', '___ dobro(x):\n    ___ x * 2', [['def'], ['return']], 'def cria a função e return devolve o resultado.', { caseSensitive: true }),
        err('python.u1.c08', 'funcoes', 2, 'Toque na linha com o erro que faz a função devolver None.', ['def soma(lista):', '    total = 0', '    for x in lista:', '        total += x', '    print(total)'], 4, '    return total', 'print só mostra na tela; quem chama a função recebe None. Use return para devolver o valor.'),
        match('python.u1.c09', 'tipos', 1, 'Associe o valor ao tipo.', [['42', 'int'], ['3.14', 'float'], ["'42'", 'str'], ['True', 'bool']], 'Aspas tornam o valor texto, mesmo que pareça número.'),
        out('python.u1.c10', 'colecoes', 2, 'O que é impresso?', "precos = {'caneta': 5, 'caderno': 25}\ntotal = 0\nfor nome, preco in precos.items():\n    total += preco\nprint(total)", 'python', ['30'], '.items() devolve pares (chave, valor); 5 + 25 = 30.'),
        out('python.u1.c11', 'funcoes', 4, 'Pegadinha clássica: o que é impresso?', 'def adiciona(x, lista=[]):\n    lista.append(x)\n    return lista\n\nadiciona(1)\nprint(adiciona(2))', 'python', ['[1, 2]'], 'O valor padrão [] é criado UMA vez, quando a função é definida, e é compartilhado entre chamadas. Use lista=None e crie a lista dentro da função.'),
        pyLab('python.u1.lab1', 'funcoes', 2, 'Escreva `media(valores)` que devolve a média de uma lista de números, ou None se a lista estiver vazia.', 'def media(valores):\n    # seu código aqui\n    pass\n', 'def media(valores):\n    if not valores:\n        return None\n    return sum(valores) / len(valores)\n', 'media', [{ args: [[2, 4, 6]], expected: 4 }, { args: [[10]], expected: 10 }, { args: [[]], expected: null }, { args: [[1, 2]], expected: 1.5 }], 'sum/len resolve; trate a lista vazia antes para não dividir por zero.'),
        multi('python.u1.boss', 'colecoes', 3, 'Chefe da unidade: contando palavras.', [
          step.mcq('python.u1.boss.s1', "Qual estrutura é ideal para contar quantas vezes cada palavra aparece?", ['list', 'dict', 'tuple', 'str'], 1, 'Dicionário palavra → contagem (ou collections.Counter).'),
          step.mcq('python.u1.boss.s2', "Qual linha incrementa a contagem sem KeyError?", ['c[p] += 1', 'c[p] = c.get(p, 0) + 1', 'c.append(p)', 'c[p] == c[p] + 1'], 1, '.get(p, 0) devolve 0 para palavras novas.'),
          step.num('python.u1.boss.s3', "Em 'a b a c a'.split(), quantas vezes aparece 'a'?", 3, 'split() gera [a, b, a, c, a].'),
        ], 'Contar ocorrências é um padrão de dicionário (ou Counter).', { boss: true }),
      ],
    },
    {
      id: 'python.u2',
      title: 'pandas: carregar e filtrar',
      summary: 'DataFrame, seleção, filtros e ordenação.',
      topics: [
        { id: 'dataframe', name: 'DataFrame e Series' },
        { id: 'selecao', name: 'Seleção com loc/iloc' },
        { id: 'filtro', name: 'Filtros booleanos' },
      ],
      lesson: [
        { title: 'DataFrame e Series', body: 'Um DataFrame é uma tabela com colunas nomeadas; cada coluna é uma Series. Por convenção, importe com `import pandas as pd`.', example: "import pandas as pd\ndf = pd.DataFrame({'produto': ['A', 'B'], 'preco': [10, 20]})\ndf.shape  # (2, 2)" },
        { title: 'Explorar', body: 'df.head() mostra as primeiras linhas, df.info() tipos e nulos, df.describe() estatísticas das colunas numéricas, df.shape (linhas, colunas).' },
        { title: 'loc × iloc', body: 'loc seleciona por RÓTULO (nomes de índice e colunas; a fatia inclui o fim). iloc seleciona por POSIÇÃO inteira (a fatia exclui o fim, como em listas).', example: "df.loc[0, 'preco']\ndf.iloc[0, 1]" },
        { title: 'Filtros', body: 'Uma comparação em coluna gera uma máscara booleana. Combine máscaras com & (e), | (ou) e ~ (não), SEMPRE com parênteses — and/or do Python não funcionam com Series.', example: "df[(df['preco'] > 10) & (df['produto'] != 'C')]" },
      ],
      challenges: [
        mcq('python.u2.c01', 'dataframe', 1, 'Qual o import padrão do pandas?', ['import pandas', 'import pandas as pd', 'from pandas import *', 'import pd'], 1, 'A convenção `pd` é usada na documentação e na comunidade.'),
        out('python.u2.c02', 'dataframe', 1, 'O que é impresso?', "import pandas as pd\ndf = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})\nprint(df.shape)", 'python', ['(3, 2)'], 'shape devolve (linhas, colunas): 3 linhas e 2 colunas.'),
        match('python.u2.c03', 'dataframe', 1, 'Associe o método ao que ele mostra.', [['df.head()', 'Primeiras linhas'], ['df.info()', 'Tipos e não nulos'], ['df.describe()', 'Estatísticas numéricas'], ['df.columns', 'Nomes das colunas']], 'São os primeiros comandos de qualquer exploração.'),
        mcq('python.u2.c04', 'selecao', 2, 'Qual a diferença entre loc e iloc?', ['Nenhuma', 'loc usa rótulos; iloc usa posições inteiras', 'loc usa posições; iloc usa rótulos', 'iloc só funciona com colunas'], 1, 'loc = label (rótulo); iloc = integer location (posição).'),
        err('python.u2.c05', 'filtro', 2, 'Toque no trecho que gera erro.', ['df[', "(df['preco'] > 10) and (df['qtd'] > 0)", ']'], 1, "(df['preco'] > 10) & (df['qtd'] > 0)", 'and tenta converter uma Series inteira em um único bool e gera ValueError. Use &, | e ~ com parênteses.'),
        out('python.u2.c06', 'filtro', 2, 'O que é impresso?', "import pandas as pd\ndf = pd.DataFrame({'preco': [5, 25, 150, 40]})\nprint(len(df[df['preco'] > 30]))", 'python', ['2'], 'Preços acima de 30: 150 e 40.'),
        fill('python.u2.c07', 'filtro', 2, 'Complete para manter as linhas de SP OU RJ.', "df[(df['uf'] == 'SP') ___ (df['uf'] == 'RJ')]", [['|']], '| é o "ou" elemento a elemento. Alternativa: df[df[\'uf\'].isin([\'SP\', \'RJ\'])].', { caseSensitive: true }),
        code('python.u2.c08', 'filtro', 2, 'Complete com o método que testa pertencimento a uma lista.', "df[df['uf'].___(['SP', 'RJ'])]", [['isin']], 'Series.isin(lista) devolve a máscara booleana de pertencimento.'),
        tf('python.u2.c09', 'selecao', 3, "Com índice padrão 0..n, `df.loc[0:2]` retorna 3 linhas, enquanto `df.iloc[0:2]` retorna 2.", true, 'Fatias com loc incluem o rótulo final; com iloc, a posição final é excluída.'),
        mcq('python.u2.c10', 'dataframe', 2, 'Como ordenar o DataFrame pela coluna preco, do maior para o menor?', ["df.sort('preco')", "df.sort_values('preco', ascending=False)", "df.order_by('preco desc')", "df.sort_index('preco')"], 1, 'sort_values ordena por valores de coluna; ascending=False inverte.'),
        pyLab('python.u2.lab1', 'filtro', 3, 'Escreva `caros(registros, limite)` que recebe uma lista de dicionários {"produto", "preco"} e devolve a LISTA de nomes de produtos com preço maior que o limite, na ordem original. Use pandas.', "import pandas as pd\n\ndef caros(registros, limite):\n    df = pd.DataFrame(registros)\n    # seu código aqui\n", "import pandas as pd\n\ndef caros(registros, limite):\n    df = pd.DataFrame(registros)\n    if df.empty:\n        return []\n    return df.loc[df['preco'] > limite, 'produto'].tolist()\n", 'caros', [
          { args: [[{ produto: 'Caneta', preco: 5 }, { produto: 'Fone', preco: 200 }, { produto: 'Mouse', preco: 80 }], 50], expected: ['Fone', 'Mouse'] },
          { args: [[{ produto: 'Caneta', preco: 5 }], 50], expected: [] },
          { args: [[{ produto: 'A', preco: 51 }, { produto: 'B', preco: 50 }], 50], expected: ['A'] },
        ], 'Filtre com a máscara e selecione a coluna com loc; .tolist() converte a Series em lista.', { packages: ['pandas'] }),
        multi('python.u2.boss', 'filtro', 4, 'Chefe da unidade: filtrando vendas.', [
          step.mcq('python.u2.boss.s1', 'Qual expressão seleciona vendas acima de 100 em SP?', ["df[df.valor > 100 and df.uf == 'SP']", "df[(df.valor > 100) & (df.uf == 'SP')]", "df.loc[valor > 100, uf == 'SP']", "df.filter(valor > 100)"], 1, 'Máscaras combinadas com & e parênteses.'),
          step.mcq('python.u2.boss.s2', 'Como pegar só a coluna valor do resultado?', ["resultado['valor']", 'resultado.iloc[valor]', "resultado.get_column('valor')", 'resultado(valor)'], 0, 'Selecionar uma coluna pelo nome devolve uma Series.'),
          step.mcq('python.u2.boss.s3', 'E para somar essa coluna?', ["resultado['valor'].sum()", "sum.resultado['valor']", "resultado.total('valor')", "resultado['valor'].count()"], 0, '.sum() soma; .count() contaria os não nulos.'),
        ], 'Filtro → seleção de coluna → agregação.', { boss: true }),
      ],
    },
    {
      id: 'python.u3',
      title: 'pandas: agrupar e limpar',
      summary: 'groupby, agregações, nulos, merge.',
      topics: [
        { id: 'groupby', name: 'groupby e agregações' },
        { id: 'nulos', name: 'Dados ausentes' },
        { id: 'merge', name: 'Junções com merge' },
      ],
      lesson: [
        { title: 'groupby', body: 'groupby divide o DataFrame em grupos, aplica uma agregação e combina o resultado (split-apply-combine). É o GROUP BY do SQL.', example: "df.groupby('categoria')['preco'].mean()" },
        { title: 'Várias agregações', body: 'Use .agg para calcular várias medidas ao mesmo tempo, inclusive com nomes próprios.', example: "df.groupby('uf').agg(total=('valor', 'sum'), pedidos=('id', 'count'))" },
        { title: 'Dados ausentes', body: 'NaN representa ausência. isna() detecta, dropna() remove linhas, fillna(valor) preenche. A maioria das agregações ignora NaN (mean, sum).', example: "df['nota'].isna().sum()  # quantos nulos" },
        { title: 'merge', body: 'pd.merge(a, b, on="chave", how=...) junta tabelas como um JOIN. how="inner" (padrão) mantém só pares; "left" mantém todas as linhas de a.' },
      ],
      challenges: [
        out('python.u3.c01', 'groupby', 2, 'O que é impresso?', "import pandas as pd\ndf = pd.DataFrame({'cat': ['A', 'B', 'A'], 'v': [10, 5, 30]})\nprint(df.groupby('cat')['v'].sum().to_dict())", 'python', ["{'A': 40, 'B': 5}"], 'Grupo A: 10 + 30 = 40; grupo B: 5.'),
        mcq('python.u3.c02', 'groupby', 2, 'Qual é o equivalente em pandas de SELECT uf, COUNT(*) FROM vendas GROUP BY uf?', ["vendas.groupby('uf').size()", "vendas.count('uf')", "vendas['uf'].sum()", "vendas.groupby('uf').mean()"], 0, '.size() conta as linhas de cada grupo (inclui nulos); .count() conta não nulos por coluna.'),
        out('python.u3.c03', 'nulos', 2, 'O que é impresso?', "import pandas as pd\ns = pd.Series([1.0, None, 3.0])\nprint(s.mean())", 'python', ['2.0'], 'mean ignora o NaN: (1 + 3) / 2 = 2.0.'),
        match('python.u3.c04', 'nulos', 1, 'Associe o método à ação.', [['isna()', 'Marca valores ausentes'], ['dropna()', 'Remove linhas com ausentes'], ['fillna(0)', 'Substitui ausentes por 0'], ['notna()', 'Marca valores presentes']], 'Escolha a estratégia conforme o significado do dado ausente.'),
        tf('python.u3.c05', 'nulos', 2, 'Preencher todos os nulos com 0 é sempre a melhor escolha em análise de dados.', false, 'Zero tem significado (ex.: venda zero). Às vezes é melhor remover, usar a mediana ou manter o nulo e reportar.'),
        cat('python.u3.c06', 'merge', 2, 'Classifique cada situação pelo tipo de merge adequado.', ['how="inner"', 'how="left"'], [['Só clientes que compraram', 0], ['Todos os clientes, mesmo sem compras', 1], ['Pedidos com produto cadastrado', 0], ['Todos os produtos e suas vendas (se houver)', 1]], 'inner mantém apenas pares; left preserva tudo da tabela da esquerda.'),
        code('python.u3.c07', 'merge', 2, 'Complete a junção de pedidos com clientes pela coluna cliente_id.', "pd.merge(pedidos, clientes, ___='cliente_id', how='___')", [['on'], ['inner', 'left']], 'on define a chave; how define o tipo (inner mantém só pares, left preserva todos os pedidos).'),
        num('python.u3.c08', 'groupby', 3, "Com df = {'uf': ['SP','SP','RJ'], 'valor': [100, 300, 50]}, quanto vale df.groupby('uf')['valor'].mean()['SP']?", 200, '(100 + 300) / 2 = 200.'),
        order('python.u3.c09', 'groupby', 2, 'Ordene as etapas de uma análise de vendas por categoria.', ['Carregar os dados com pd.read_csv', 'Tratar valores ausentes', 'Agrupar por categoria', 'Ordenar o resultado e visualizar'], 'Carregar → limpar → agregar → apresentar.'),
        short('python.u3.c10', 'groupby', 2, 'Qual método do DataFrame permite várias agregações nomeadas após o groupby?', ['agg', '.agg', 'agg()', 'aggregate'], '.agg (ou .aggregate) aceita várias funções e nomes de saída.'),
        pyLab('python.u3.lab1', 'groupby', 3, 'Escreva `total_por_uf(vendas)` que recebe uma lista de dicionários {"uf", "valor"} e devolve um DICIONÁRIO uf → soma dos valores, usando pandas.', "import pandas as pd\n\ndef total_por_uf(vendas):\n    df = pd.DataFrame(vendas)\n    # seu código aqui\n", "import pandas as pd\n\ndef total_por_uf(vendas):\n    df = pd.DataFrame(vendas)\n    if df.empty:\n        return {}\n    return {k: float(v) for k, v in df.groupby('uf')['valor'].sum().items()}\n", 'total_por_uf', [
          { args: [[{ uf: 'SP', valor: 100 }, { uf: 'RJ', valor: 50 }, { uf: 'SP', valor: 300 }]], expected: { SP: 400, RJ: 50 } },
          { args: [[{ uf: 'DF', valor: 10.5 }]], expected: { DF: 10.5 } },
          { args: [[]], expected: {} },
        ], 'groupby + sum e conversão para dicionário (.to_dict() também serve).', { packages: ['pandas'] }),
        pyLab('python.u3.lab2', 'nulos', 3, 'Escreva `limpar(notas)` que recebe uma lista de números (com possíveis None), substitui os ausentes pela MEDIANA dos presentes e devolve a lista resultante.', "import pandas as pd\n\ndef limpar(notas):\n    s = pd.Series(notas, dtype='float')\n    # seu código aqui\n", "import pandas as pd\n\ndef limpar(notas):\n    s = pd.Series(notas, dtype='float')\n    return s.fillna(s.median()).tolist()\n", 'limpar', [
          { args: [[7, null, 9, 5]], expected: [7, 7, 9, 5] },
          { args: [[null, 10, 20]], expected: [15, 10, 20] },
          { args: [[1, 2, 3]], expected: [1, 2, 3] },
        ], 'median() ignora os ausentes; fillna preenche.', { packages: ['pandas'] }),
        multi('python.u3.boss', 'groupby', 5, 'Chefe final de Python: relatório por categoria.', [
          step.mcq('python.u3.boss.s1', 'Para ter total e quantidade por categoria em uma linha, use:', ["df.groupby('cat').agg(total=('v', 'sum'), n=('v', 'count'))", "df.sum('cat')", "df.groupby('v').cat()", "df.pivot('cat')"], 0, 'agg com agregações nomeadas.'),
          step.mcq('python.u3.boss.s2', 'Depois, para ordenar do maior total para o menor:', [".sort_values('total', ascending=False)", '.sort()', ".order('total')", '.sort_index(False)'], 0, 'sort_values pela coluna criada.'),
          step.num('python.u3.boss.s3', "Se cat A tem v = [10, 30] e cat B tem v = [5], qual o total de A?", 40, '10 + 30.'),
        ], 'agrupar → agregar com nomes → ordenar.', { boss: true }),
      ],
    },
  ],
}

export default content
