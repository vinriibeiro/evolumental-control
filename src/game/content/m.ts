import type { SubjectContent } from '../types'
import { cat, code, err, fill, match, mcq, multi, num, order, out, short, step, tf } from './_build'

// A linguagem M não é executada aqui: os desafios usam casos com resultado
// conhecido, deduzido das regras da linguagem sobre as tabelas mostradas.
const bruto = {
  caption: 'Tabela de origem',
  columns: ['Cliente', 'UF', 'Valor'],
  rows: [
    [' Ana ', 'df', '100'],
    ['Bruno', 'SP', null],
    ['Carla', 'df', '250'],
    ['Diego', 'RJ', '80'],
  ],
}

const content: SubjectContent = {
  subjectId: 'm',
  units: [
    {
      id: 'm.u1',
      title: 'Power Query: o básico',
      summary: 'Etapas aplicadas, tipos de dados e limpeza.',
      topics: [
        { id: 'etapas', name: 'Etapas e let/in' },
        { id: 'tipos', name: 'Tipos de dados' },
        { id: 'limpeza', name: 'Limpeza de texto e nulos' },
      ],
      lesson: [
        { title: 'Como estudar M aqui', body: 'Os desafios de M usam casos com resultado conhecido, deduzido das regras da linguagem sobre as tabelas exibidas. Nenhuma consulta é executada pelo mecanismo do Power Query neste app — reproduza os casos no Power BI Desktop ou no Excel para praticar.' },
        { title: 'Etapas aplicadas', body: 'Cada clique no editor gera uma etapa em M. Uma consulta é uma expressão let … in: cada linha nomeia um passo que usa o anterior; o in indica o resultado final.', example: 'let\n  Fonte = Csv.Document(File.Contents("vendas.csv")),\n  Cab = Table.PromoteHeaders(Fonte),\n  Tipos = Table.TransformColumnTypes(Cab, {{"Valor", type number}})\nin\n  Tipos' },
        { title: 'Tipos', body: 'Defina tipos cedo (texto, número, data). Colunas sem tipo ("any") atrapalham o modelo e as medidas. Erros de conversão aparecem como Error nas células.' },
        { title: 'M diferencia maiúsculas', body: 'M é case-sensitive: Table.SelectRows existe; table.selectrows não. Nomes de colunas também: "Valor" ≠ "valor".' },
        { title: 'Limpeza', body: 'Text.Trim remove espaços nas pontas; Text.Upper/Text.Proper ajustam caixa; Table.ReplaceValue substitui valores; Table.SelectRows filtra; null representa ausência.' },
      ],
      challenges: [
        mcq('m.u1.c01', 'etapas', 1, 'Na expressão let … in, o que vem depois do in?', ['A primeira etapa', 'O resultado final da consulta', 'Os comentários', 'A fonte de dados'], 1, 'O in indica qual etapa é devolvida (normalmente a última).'),
        tf('m.u1.c02', 'tipos', 1, 'A linguagem M diferencia maiúsculas de minúsculas em nomes de funções e colunas.', true, 'Table.SelectRows ≠ table.selectrows; "Valor" ≠ "valor".'),
        order('m.u1.c03', 'etapas', 2, 'Ordene as etapas típicas de uma consulta.', ['Conectar à fonte', 'Promover cabeçalhos', 'Definir tipos de dados', 'Filtrar e limpar', 'Carregar para o modelo'], 'Fonte → cabeçalhos → tipos → transformações → carga.'),
        out('m.u1.c04', 'limpeza', 1, 'Qual o resultado? (sem aspas)', 'Text.Trim("  Ana  ")', 'm', ['Ana'], 'Text.Trim remove os espaços do início e do fim.'),
        out('m.u1.c05', 'limpeza', 2, 'Qual o resultado? (sem aspas)', 'Text.Upper(Text.Trim(" df "))', 'm', ['DF'], 'Primeiro remove os espaços, depois converte para maiúsculas.'),
        fill('m.u1.c06', 'tipos', 2, 'Complete para tipar a coluna Valor como número.', 'Table.TransformColumnTypes(Fonte, {{"Valor", type ___}})', [['number']], 'type number. Outros: type text, type date, Int64.Type.', { caseSensitive: true }),
        num('m.u1.c07', 'limpeza', 2, 'Na tabela de origem, depois de Table.SelectRows(Fonte, each [Valor] <> null), quantas linhas restam?', 3, 'Só Bruno tem Valor nulo.', { table: bruto }),
        err('m.u1.c08', 'tipos', 2, 'Toque no trecho que gera erro.', ['Table.selectRows(', 'Fonte,', 'each [Valor] > 100', ')'], 0, 'Table.SelectRows(', 'M é case-sensitive: o nome correto é Table.SelectRows.'),
        match('m.u1.c09', 'tipos', 2, 'Associe a função à ação.', [['Table.PromoteHeaders', 'Usa a 1ª linha como cabeçalho'], ['Table.RemoveColumns', 'Remove colunas'], ['Table.RenameColumns', 'Renomeia colunas'], ['Table.Distinct', 'Remove linhas duplicadas']], 'Cada botão do editor corresponde a uma função Table.*.'),
        cat('m.u1.c10', 'limpeza', 3, 'Classifique o problema de qualidade na tabela de origem.', ['Espaços extras', 'Caixa inconsistente', 'Valor ausente'], [['" Ana "', 0], ['"df" vs "SP"', 1], ['Valor de Bruno', 2]], 'Trim, padronização de caixa e tratamento de nulos.', { table: bruto }),
        multi('m.u1.boss', 'limpeza', 4, 'Chefe da unidade: limpe a tabela de origem.', [
          step.mcq('m.u1.boss.s1', 'Para padronizar UF em maiúsculas, use:', ['Text.Upper', 'Text.Proper', 'Text.Trim', 'Number.From'], 0, 'Text.Upper("df") = "DF".'),
          step.mcq('m.u1.boss.s2', 'Para Valor virar número, use:', ['Table.TransformColumnTypes', 'Table.Sort', 'Table.Distinct', 'Text.Length'], 0, 'Definir o tipo converte o texto "100" em 100.'),
          step.num('m.u1.boss.s3', 'Após remover nulos e tipar, qual a soma de Valor?', 430, '100 + 250 + 80.'),
        ], 'Limpe texto, trate nulos e defina tipos antes de carregar.', { boss: true, table: bruto }),
      ],
    },
    {
      id: 'm.u2',
      title: 'Colunas, funções e each',
      summary: 'Colunas personalizadas, each/_ e condicionais.',
      topics: [
        { id: 'each', name: 'each e _' },
        { id: 'colunas', name: 'Colunas personalizadas' },
        { id: 'condicional', name: 'if then else' },
      ],
      lesson: [
        { title: 'each', body: 'each é um atalho para uma função de um parâmetro chamado _. "each [Valor] * 2" equivale a "(_) => _[Valor] * 2". [Valor] dentro do each é o campo da linha atual.' },
        { title: 'Coluna personalizada', body: 'Table.AddColumn(tabela, "Nome", each expressão, tipo).', example: 'Table.AddColumn(Fonte, "Total", each [Qtd] * [Preco], type number)' },
        { title: 'Condicional', body: 'if condição then valor else outro — o else é obrigatório em M. Operadores: and, or, not; igualdade com = e diferença com <>.' },
        { title: 'Concatenação e nulos', body: 'Textos se unem com &. Qualquer operação aritmética com null resulta em null (null + 1 = null). Use ?? (coalescência) para valor padrão: [Valor] ?? 0.' },
      ],
      challenges: [
        mcq('m.u2.c01', 'each', 2, '"each [Preco] * 2" é equivalente a:', ['(x) => [Preco] * 2', '(_) => _[Preco] * 2', 'Preco * 2', 'Table.Preco * 2'], 1, 'each cria uma função cujo parâmetro se chama _.'),
        code('m.u2.c02', 'colunas', 2, 'Complete para criar a coluna Total.', 'Table.___(Fonte, "Total", ___ [Qtd] * [Preco], type number)', [['AddColumn'], ['each']], 'Table.AddColumn com uma função each.'),
        err('m.u2.c03', 'condicional', 2, 'Toque no trecho que deixa a expressão inválida.', ['if [Valor] > 100', 'then "Alto"', '(fim da expressão)'], 2, 'else "Baixo"', 'Em M, o else é obrigatório.'),
        out('m.u2.c04', 'condicional', 2, 'Para Valor = 80, qual o resultado? (sem aspas)', 'if [Valor] >= 100 then "Alto" else if [Valor] >= 50 then "Médio" else "Baixo"', 'm', ['Médio'], '80 não é ≥ 100, mas é ≥ 50.'),
        out('m.u2.c05', 'colunas', 2, 'Qual o resultado? (sem aspas)', '"Power" & " " & "Query"', 'm', ['Power Query'], '& concatena textos.'),
        tf('m.u2.c06', 'colunas', 3, 'Em M, null + 10 resulta em 10.', false, 'Aritmética com null resulta em null. Use ([Valor] ?? 0) + 10.'),
        fill('m.u2.c07', 'colunas', 3, 'Complete para usar 0 quando Valor for nulo.', '[Valor] ___ 0', [['??']], '?? é o operador de coalescência: devolve o da direita se o da esquerda for null.', { caseSensitive: true }),
        out('m.u2.c08', 'colunas', 3, 'Qual o resultado?', 'Text.Length("Brasília")', 'm', ['8'], 'B-r-a-s-í-l-i-a: 8 caracteres.'),
        mcq('m.u2.c09', 'condicional', 2, 'Qual operador significa "diferente" em M?', ['!=', '<>', '=/=', 'not='], 1, 'M usa <> (como Excel e SQL).'),
        num('m.u2.c10', 'colunas', 3, 'Table.AddColumn(Fonte, "Dobro", each [Valor] * 2) sobre Valor = {10, null, 5}. Quantos valores NÃO nulos tem a nova coluna?', 2, 'null * 2 = null; restam 20 e 10.'),
        multi('m.u2.boss', 'condicional', 4, 'Chefe da unidade: classificação de clientes.', [
          step.mcq('m.u2.boss.s1', 'Qual expressão classifica Valor ≥ 200 como "VIP"?', ['each if [Valor] >= 200 then "VIP" else "Comum"', 'each if [Valor] >= 200 then "VIP"', 'if Valor >= 200 "VIP"', 'each [Valor] >= 200 ? "VIP" : "Comum"'], 0, 'if/then/else completo dentro do each.'),
          step.mcq('m.u2.boss.s2', 'Com Valor nulo, o que acontece em [Valor] >= 200?', ['dá true', 'dá false', 'a comparação resulta em null e o if gera Error naquela linha', 'erro de sintaxe na consulta'], 2, 'Comparar null com número resulta em null, e o if exige um valor lógico: a célula vira Error.'),
          step.mcq('m.u2.boss.s3', 'Para tratar o nulo explicitamente, use:', ['([Valor] ?? 0) >= 200', '[Valor] = null >= 200', 'Text.Trim([Valor])', 'Table.Distinct'], 0, 'Coalescência antes de comparar.'),
        ], 'Cuide dos nulos antes de comparar ou calcular.', { boss: true }),
      ],
    },
    {
      id: 'm.u3',
      title: 'Combinar e remodelar',
      summary: 'Mesclar, acrescentar, agrupar, dinamizar e não dinamizar.',
      topics: [
        { id: 'mesclar', name: 'Mesclar consultas' },
        { id: 'acrescentar', name: 'Acrescentar consultas' },
        { id: 'remodelar', name: 'Agrupar e dinamizar' },
      ],
      lesson: [
        { title: 'Mesclar × acrescentar', body: 'Mesclar (Table.NestedJoin) junta COLUNAS de duas tabelas por uma chave, como um JOIN. Acrescentar (Table.Combine) empilha LINHAS de tabelas com a mesma estrutura, como um UNION.' },
        { title: 'Tipos de junção', body: 'JoinKind.LeftOuter (todas da 1ª), JoinKind.Inner (só pares), JoinKind.FullOuter, JoinKind.LeftAnti (só as da 1ª SEM par — ótimo para achar faltantes).' },
        { title: 'Agrupar', body: 'Table.Group(tabela, {"UF"}, {{"Total", each List.Sum([Valor]), type number}}) = GROUP BY.' },
        { title: 'Não dinamizar', body: 'Unpivot transforma colunas (Jan, Fev, Mar…) em linhas (Mês, Valor) — o formato ideal para o modelo. Pivot faz o inverso.' },
      ],
      challenges: [
        cat('m.u3.c01', 'mesclar', 2, 'Mesclar ou acrescentar?', ['Mesclar', 'Acrescentar'], [['Vendas 2024 + Vendas 2025 (mesmas colunas)', 1], ['Pedidos + nome do cliente pela chave', 0], ['Planilhas mensais de mesmo layout', 1], ['Produtos + categoria pela chave', 0]], 'Mesclar adiciona colunas por chave; acrescentar empilha linhas.'),
        mcq('m.u3.c02', 'mesclar', 3, 'Qual tipo de junção encontra clientes SEM pedidos (tabela 1 = Clientes)?', ['JoinKind.Inner', 'JoinKind.LeftAnti', 'JoinKind.FullOuter', 'JoinKind.RightOuter'], 1, 'LeftAnti mantém apenas as linhas da primeira tabela sem correspondência.'),
        short('m.u3.c03', 'acrescentar', 2, 'Qual função empilha uma lista de tabelas? (Table.____)', ['Table.Combine', 'Combine'], 'Table.Combine({Tabela1, Tabela2}).', { caseSensitive: false }),
        mcq('m.u3.c04', 'remodelar', 2, 'Uma tabela tem colunas Produto, Jan, Fev, Mar. Para virar Produto, Mês, Valor, use:', ['Dinamizar coluna (Pivot)', 'Não dinamizar colunas (Unpivot)', 'Transpor', 'Mesclar'], 1, 'Unpivot transforma colunas em pares atributo/valor.'),
        num('m.u3.c05', 'remodelar', 3, 'Uma tabela com 5 produtos e as colunas Jan, Fev, Mar é não dinamizada (as 3 colunas de mês). Quantas linhas resultam?', 15, '5 produtos × 3 meses = 15 linhas.'),
        code('m.u3.c06', 'remodelar', 3, 'Complete o agrupamento por UF somando Valor.', 'Table.Group(Fonte, {"UF"}, {{"Total", each List.___([Valor]), type number}})', [['Sum']], 'List.Sum soma a lista de valores do grupo.'),
        out('m.u3.c07', 'remodelar', 3, 'Com UF = {DF, DF, SP} e Valor = {100, 250, 80}, qual o Total do grupo DF?', 'Table.Group(Fonte, {"UF"}, {{"Total", each List.Sum([Valor]), type number}})', 'm', ['350'], '100 + 250.'),
        tf('m.u3.c08', 'acrescentar', 2, 'Ao acrescentar tabelas com colunas diferentes, as colunas que faltam em uma delas são preenchidas com null.', true, 'Table.Combine une pelo nome da coluna; ausências viram null.'),
        match('m.u3.c09', 'mesclar', 3, 'Associe o JoinKind ao resultado.', [['Inner', 'Só linhas com par'], ['LeftOuter', 'Todas da primeira tabela'], ['FullOuter', 'Todas das duas tabelas'], ['LeftAnti', 'Só as da primeira sem par']], 'Os mesmos conceitos dos JOINs em SQL.'),
        order('m.u3.c10', 'mesclar', 3, 'Ordene os passos para trazer o nome do cliente para Pedidos.', ['Mesclar Pedidos com Clientes pela chave', 'Escolher o tipo de junção', 'Expandir a coluna de tabela aninhada', 'Selecionar só a coluna Nome'], 'O NestedJoin cria uma coluna de tabelas; depois expanda escolhendo as colunas.'),
        multi('m.u3.boss', 'remodelar', 5, 'Chefe final de M: relatório mensal.', [
          step.mcq('m.u3.boss.s1', 'Planilhas Jan.xlsx, Fev.xlsx, Mar.xlsx com o mesmo layout. Primeiro passo:', ['Acrescentar (ou pasta)', 'Mesclar', 'Dinamizar', 'Transpor'], 0, 'Empilhar arquivos de mesma estrutura.'),
          step.mcq('m.u3.boss.s2', 'Para trazer a categoria de cada produto:', ['Mesclar com Produtos', 'Acrescentar Produtos', 'Unpivot', 'Table.Distinct'], 0, 'Junção por chave.'),
          step.num('m.u3.boss.s3', '4 produtos × 3 meses após empilhar dão quantas linhas (1 linha por produto/mês)?', 12, '4 × 3.'),
        ], 'Acrescentar empilha; mesclar enriquece.', { boss: true }),
      ],
    },
  ],
}

export default content
