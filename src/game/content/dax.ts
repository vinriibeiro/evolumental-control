import type { SubjectContent } from '../types'
import { cat, code, err, fill, match, mcq, multi, num, order, out, step, tf } from './_build'

// DAX não é executado aqui: os desafios usam casos com resultado conhecido,
// calculado pelas regras da linguagem sobre as tabelas mostradas.
const vendas = {
  caption: 'Vendas',
  columns: ['Produto', 'Categoria', 'Quantidade', 'Preco'],
  rows: [
    ['Caderno', 'Papelaria', 2, 25],
    ['Caneta', 'Papelaria', 5, 5],
    ['Fone', 'Eletrônicos', 1, 200],
    ['Mouse', 'Eletrônicos', 2, 80],
    ['Caderno', 'Papelaria', 3, 25],
  ],
}

const content: SubjectContent = {
  subjectId: 'dax',
  units: [
    {
      id: 'dax.u1',
      title: 'Medidas e colunas calculadas',
      summary: 'Sintaxe, agregações, iteradores e boas práticas.',
      topics: [
        { id: 'sintaxe', name: 'Sintaxe e referências' },
        { id: 'medidas', name: 'Medida × coluna calculada' },
        { id: 'iteradores', name: 'Iteradores (SUMX…)' },
      ],
      lesson: [
        { title: 'Como estudar DAX aqui', body: 'Os desafios de DAX usam casos com resultado conhecido, calculado pelas regras da linguagem sobre as tabelas exibidas. Nenhuma fórmula é executada por um motor do Power BI neste app — para praticar de verdade, reproduza os casos no Power BI Desktop.' },
        { title: 'Referências', body: "Colunas: Tabela[Coluna] (aspas simples quando o nome da tabela tem espaço: 'Dim Data'[Ano]). Medidas: [Nome da Medida], sem tabela — convenção que ajuda a distinguir medida de coluna." },
        { title: 'Medida × coluna calculada', body: 'Coluna calculada: avaliada linha a linha no refresh e armazenada (ocupa memória; útil para fatiar). Medida: avaliada no momento da consulta, no contexto do visual (filtros, linhas, colunas). Totais e KPIs devem ser medidas.' },
        { title: 'Agregadores × iteradores', body: 'SUM(Coluna) soma uma coluna. SUMX(Tabela, expressão) percorre a tabela linha a linha, avalia a expressão e soma. Use SUMX quando precisa multiplicar colunas: SUMX(Vendas, Vendas[Quantidade] * Vendas[Preco]).', example: 'Receita = SUMX ( Vendas, Vendas[Quantidade] * Vendas[Preco] )' },
        { title: 'DIVIDE', body: 'DIVIDE(numerador, denominador[, alternativo]) evita erro de divisão por zero e devolve BLANK (ou o alternativo).' },
      ],
      challenges: [
        mcq('dax.u1.c01', 'medidas', 1, 'Qual o melhor lugar para "Receita Total" que deve responder a filtros de ano e região?', ['Coluna calculada', 'Medida', 'Tabela calculada', 'Coluna no Power Query'], 1, 'Medidas são avaliadas no contexto de filtro do visual.'),
        num('dax.u1.c02', 'iteradores', 2, 'Qual o resultado de SUMX(Vendas, Vendas[Quantidade] * Vendas[Preco]) sem filtros?', 485, '2×25 + 5×5 + 1×200 + 2×80 + 3×25 = 50 + 25 + 200 + 160 + 75 = 485.', { table: vendas }),
        num('dax.u1.c03', 'iteradores', 1, 'Qual o resultado de SUM(Vendas[Quantidade])?', 13, '2 + 5 + 1 + 2 + 3 = 13.', { table: vendas }),
        err('dax.u1.c04', 'iteradores', 2, 'Toque no trecho que gera erro.', ['Receita =', 'SUM(', 'Vendas[Quantidade] * Vendas[Preco]', ')'], 1, 'SUMX( Vendas, ...', 'SUM aceita apenas uma coluna. Para multiplicar linha a linha, use SUMX(Vendas, Vendas[Quantidade] * Vendas[Preco]).'),
        fill('dax.u1.c05', 'sintaxe', 1, 'Complete a medida de divisão segura.', 'Ticket Médio = ___([Receita], [Pedidos])', [['DIVIDE']], 'DIVIDE devolve BLANK quando o denominador é zero, em vez de erro.', { caseSensitive: false }),
        tf('dax.u1.c06', 'medidas', 2, 'Colunas calculadas são recalculadas a cada clique no relatório.', false, 'Colunas calculadas são computadas no refresh do modelo e armazenadas. Medidas é que são avaliadas a cada consulta.'),
        match('dax.u1.c07', 'sintaxe', 2, 'Associe a função ao que faz.', [['COUNTROWS', 'Conta linhas de uma tabela'], ['DISTINCTCOUNT', 'Conta valores distintos'], ['AVERAGEX', 'Média de expressão linha a linha'], ['DIVIDE', 'Divisão segura']], 'Funções X são iteradores; as demais agregam diretamente.'),
        num('dax.u1.c08', 'sintaxe', 2, 'Qual o resultado de DISTINCTCOUNT(Vendas[Produto])?', 4, 'Caderno, Caneta, Fone e Mouse (Caderno aparece duas vezes).', { table: vendas }),
        out('dax.u1.c09', 'iteradores', 3, 'No visual por Categoria, qual valor a medida mostra para Eletrônicos? (só o número)', 'Receita = SUMX ( Vendas, Vendas[Quantidade] * Vendas[Preco] )', 'dax', ['360'], 'O filtro Categoria = Eletrônicos deixa Fone (1×200) e Mouse (2×80): 200 + 160 = 360.', { table: vendas }),
        cat('dax.u1.c10', 'medidas', 3, 'Medida ou coluna calculada?', ['Medida', 'Coluna calculada'], [['% de crescimento ano a ano', 0], ['Faixa etária do cliente para fatiar', 1], ['Ticket médio', 0], ['Nome completo = Nome & " " & Sobrenome', 1]], 'Agregações dependentes de contexto → medida. Atributos fixos por linha usados como eixo/filtro → coluna (ou, melhor ainda, Power Query).'),
        multi('dax.u1.boss', 'iteradores', 4, 'Chefe da unidade: papelaria.', [
          step.num('dax.u1.boss.s1', 'Receita (SUMX) de Papelaria?', 150, '2×25 + 5×5 + 3×25 = 50 + 25 + 75 = 150.'),
          step.num('dax.u1.boss.s2', 'Quantidade total de Papelaria?', 10, '2 + 5 + 3.'),
          step.num('dax.u1.boss.s3', 'DIVIDE(Receita, Quantidade) em Papelaria?', 15, '150 / 10 = 15.'),
        ], 'Aplique o filtro de categoria e só então itere.', { boss: true, table: vendas }),
      ],
    },
    {
      id: 'dax.u2',
      title: 'CALCULATE e contexto',
      summary: 'Contexto de linha e de filtro, CALCULATE, ALL e FILTER.',
      topics: [
        { id: 'contexto', name: 'Contexto de filtro e de linha' },
        { id: 'calculate', name: 'CALCULATE' },
        { id: 'all', name: 'ALL, REMOVEFILTERS e percentuais' },
      ],
      lesson: [
        { title: 'Contexto de filtro', body: 'Conjunto de filtros ativos (segmentações, linhas/colunas do visual, filtros da página). Uma medida é recalculada para cada célula com o seu contexto.' },
        { title: 'Contexto de linha', body: 'Existe em colunas calculadas e dentro de iteradores (SUMX, FILTER): "a linha atual". Contexto de linha NÃO filtra automaticamente outras tabelas.' },
        { title: 'CALCULATE', body: 'CALCULATE(expressão, filtros…) avalia a expressão em um contexto de filtro modificado. Filtros simples sobre uma coluna substituem os filtros existentes naquela coluna.', example: "Receita Eletrônicos =\nCALCULATE ( [Receita], Vendas[Categoria] = \"Eletrônicos\" )" },
        { title: 'ALL e percentuais', body: 'ALL(Tabela ou Coluna) remove filtros. % do total = DIVIDE([Receita], CALCULATE([Receita], ALL(Vendas[Categoria]))).' },
        { title: 'Transição de contexto', body: 'CALCULATE dentro de um contexto de linha transforma a linha atual em filtro. Por isso uma medida chamada dentro de SUMX é avaliada "para aquela linha".' },
      ],
      challenges: [
        num('dax.u2.c01', 'calculate', 2, 'Qual o valor de CALCULATE([Receita], Vendas[Categoria] = "Papelaria") no total do relatório?', 150, 'Papelaria: 50 + 25 + 75 = 150.', { table: vendas }),
        num('dax.u2.c02', 'calculate', 3, 'Num visual por Categoria, quanto CALCULATE([Receita], Vendas[Categoria] = "Papelaria") mostra na linha de Eletrônicos?', 150, 'O filtro do CALCULATE sobre Categoria SUBSTITUI o filtro da linha (Eletrônicos). Resultado: 150 em todas as linhas.', { table: vendas, whyWrong: 'Muita gente espera BLANK, mas o filtro simples sobrescreve o da mesma coluna. KEEPFILTERS mudaria isso.' }),
        num('dax.u2.c03', 'all', 3, '% do total da Papelaria: DIVIDE([Receita], CALCULATE([Receita], ALL(Vendas[Categoria]))) — em % com 2 casas.', 30.93, '150 / 485 ≈ 0,3093 = 30,93%.', { table: vendas, tolerance: 0.01, unit: '%' }),
        mcq('dax.u2.c04', 'contexto', 2, 'Onde existe contexto de LINHA?', ['Em medidas, sempre', 'Em colunas calculadas e dentro de iteradores', 'Somente em segmentações', 'Em nenhum lugar'], 1, 'Colunas calculadas e funções que iteram (SUMX, FILTER, ADDCOLUMNS…).'),
        code('dax.u2.c05', 'all', 2, 'Complete para ignorar o filtro de categoria.', 'Receita Total Geral = CALCULATE ( [Receita], ___ ( Vendas[Categoria] ) )', [['ALL', 'REMOVEFILTERS']], 'ALL/REMOVEFILTERS removem os filtros da coluna dentro do CALCULATE.', { caseSensitive: false }),
        tf('dax.u2.c06', 'contexto', 3, 'Numa coluna calculada da tabela Vendas, SUM(Vendas[Quantidade]) devolve a quantidade da linha atual.', false, 'Sem transição de contexto, SUM ignora o contexto de linha e soma a coluna inteira (13 em todas as linhas). CALCULATE(SUM(...)) faria a transição.'),
        mcq('dax.u2.c07', 'calculate', 3, 'Qual medida conta só vendas com Quantidade > 2?', ['COUNTROWS(Vendas[Quantidade] > 2)', 'CALCULATE(COUNTROWS(Vendas), Vendas[Quantidade] > 2)', 'COUNT(Vendas, Quantidade > 2)', 'FILTER(COUNTROWS(Vendas) > 2)'], 1, 'CALCULATE com um filtro de coluna. Na tabela: Caneta (5) e Caderno (3) → 2 linhas.'),
        order('dax.u2.c08', 'calculate', 4, 'Ordene como o CALCULATE avalia a expressão.', ['Copia o contexto de filtro atual', 'Aplica a transição de contexto (se houver linha)', 'Aplica os argumentos de filtro', 'Avalia a expressão no novo contexto'], 'Visão simplificada: filtros explícitos têm prioridade sobre os herdados da transição.'),
        err('dax.u2.c09', 'calculate', 3, 'Toque no trecho que causa o erro.', ['Receita Alta =', 'CALCULATE ( [Receita],', '[Receita] > 100', ')'], 2, 'FILTER ( VALUES ( Vendas[Produto] ), [Receita] > 100 )', 'Argumentos de filtro booleanos não podem usar medidas. Use FILTER sobre uma tabela para avaliar a medida linha a linha.'),
        num('dax.u2.c10', 'all', 3, 'Num visual por Produto, quanto CALCULATE([Receita], ALL(Vendas)) mostra na linha "Mouse"?', 485, 'ALL(Vendas) remove todos os filtros da tabela: sempre o total geral.', { table: vendas }),
        multi('dax.u2.boss', 'all', 5, 'Chefe da unidade: participação por categoria.', [
          step.num('dax.u2.boss.s1', 'Receita de Eletrônicos?', 360, '200 + 160.'),
          step.num('dax.u2.boss.s2', 'Denominador com ALL(Vendas[Categoria])?', 485, 'Total sem filtro de categoria.'),
          step.num('dax.u2.boss.s3', '% de Eletrônicos (2 casas)?', 74.23, '360/485 ≈ 74,23%.', 0.01),
        ], 'Numerador no contexto atual; denominador sem o filtro de categoria.', { boss: true, table: vendas }),
      ],
    },
    {
      id: 'dax.u3',
      title: 'Inteligência de tempo e variáveis',
      summary: 'Tabela calendário, YTD, ano anterior, VAR e RETURN.',
      topics: [
        { id: 'calendario', name: 'Tabela calendário' },
        { id: 'tempo', name: 'Funções de tempo' },
        { id: 'var', name: 'VAR e legibilidade' },
      ],
      lesson: [
        { title: 'Tabela calendário', body: 'Funções de inteligência de tempo exigem uma tabela de datas contínua (sem lacunas), marcada como tabela de datas e relacionada à fato pela coluna de data.' },
        { title: 'Funções comuns', body: 'TOTALYTD / DATESYTD: acumulado no ano. SAMEPERIODLASTYEAR: mesmo período no ano anterior. DATEADD(datas, -1, MONTH): desloca o período.', example: 'Receita AA = CALCULATE ( [Receita], SAMEPERIODLASTYEAR ( Calendario[Data] ) )' },
        { title: 'VAR / RETURN', body: 'Variáveis guardam resultados intermediários: deixam a fórmula legível e evitam recalcular. São avaliadas uma vez, no contexto em que foram definidas.', example: 'Cresc % =\nVAR Atual = [Receita]\nVAR Anterior = [Receita AA]\nRETURN DIVIDE ( Atual - Anterior, Anterior )' },
      ],
      challenges: [
        tf('dax.u3.c01', 'calendario', 2, 'Funções como SAMEPERIODLASTYEAR funcionam melhor com uma tabela de datas contínua marcada como tabela de datas.', true, 'Lacunas ou datas fora de uma tabela própria geram resultados errados ou vazios.'),
        mcq('dax.u3.c02', 'tempo', 2, 'Qual função retorna o mesmo período do ano anterior?', ['PREVIOUSDAY', 'SAMEPERIODLASTYEAR', 'LASTDATE', 'YEARFRAC'], 1, 'Usada dentro de CALCULATE para comparar com o ano anterior.'),
        num('dax.u3.c03', 'var', 3, 'Receita atual = 1200 e do ano anterior = 1000. Quanto vale DIVIDE(Atual − Anterior, Anterior) em %?', 20, '(1200 − 1000) / 1000 = 0,2 = 20%.', { unit: '%', tolerance: 0.01 }),
        out('dax.u3.c04', 'tempo', 3, 'Vendas mensais: jan = 100, fev = 150, mar = 50. Qual valor a medida abaixo mostra em março?', 'Receita YTD = TOTALYTD ( [Receita], Calendario[Data] )', 'dax', ['300'], 'Acumulado do ano até março: 100 + 150 + 50 = 300.'),
        code('dax.u3.c05', 'var', 2, 'Complete a estrutura de variáveis.', '___ Atual = [Receita]\n___ DIVIDE ( Atual, 2 )', [['VAR'], ['RETURN']], 'VAR define; RETURN encerra com a expressão final.', { caseSensitive: false }),
        mcq('dax.u3.c06', 'var', 3, 'Uma VAR definida ANTES de um CALCULATE é afetada pelos filtros desse CALCULATE?', ['Sim, sempre', 'Não: a variável já foi avaliada no contexto original', 'Só com ALL', 'Só em colunas calculadas'], 1, 'Variáveis são constantes depois de avaliadas. Erro comum: "VAR x = [Receita] RETURN CALCULATE(x, ...)" não muda x.'),
        match('dax.u3.c07', 'tempo', 2, 'Associe a medida ao resultado.', [['TOTALYTD', 'Acumulado no ano'], ['SAMEPERIODLASTYEAR', 'Mesmo período do ano anterior'], ['DATEADD(…, -1, MONTH)', 'Mês anterior'], ['DATESINPERIOD', 'Janela móvel de datas']], 'Todas retornam tabelas de datas usadas como filtro em CALCULATE (exceto TOTALYTD, que já calcula).'),
        cat('dax.u3.c08', 'calendario', 3, 'Isso deve ficar na tabela Calendário ou na tabela de fatos?', ['Calendário', 'Fato (Vendas)'], [['Ano, Mês, Trimestre', 0], ['Quantidade vendida', 1], ['Dia da semana', 0], ['Valor unitário', 1]], 'Modelo estrela: atributos de data na dimensão; valores numéricos de eventos na fato.'),
        fill('dax.u3.c09', 'tempo', 3, 'Complete a medida do ano anterior.', 'Receita AA = ___ ( [Receita], SAMEPERIODLASTYEAR ( Calendario[Data] ) )', [['CALCULATE']], 'SAMEPERIODLASTYEAR devolve as datas; CALCULATE aplica-as como filtro.', { caseSensitive: false }),
        num('dax.u3.c10', 'tempo', 4, 'Receita por mês: jan 100, fev 150, mar 50, abr 200. Média móvel de 3 meses em abril (mar, fev e abr)?', 133.33, '(150 + 50 + 200) / 3 ≈ 133,33.', { tolerance: 0.01 }),
        multi('dax.u3.boss', 'tempo', 5, 'Chefe final de DAX: painel de crescimento.', [
          step.num('dax.u3.boss.s1', 'Receita 2024 = 800, 2025 = 1000. Crescimento %?', 25, '(1000 − 800) / 800 = 25%.', 0.01),
          step.mcq('dax.u3.boss.s2', 'Se a receita do ano anterior for zero, DIVIDE devolve:', ['erro', 'BLANK (ou o valor alternativo)', 'zero sempre', 'infinito'], 1, 'DIVIDE trata o zero no denominador.'),
          step.mcq('dax.u3.boss.s3', 'A forma mais legível de escrever essa medida usa:', ['VAR/RETURN', 'Coluna calculada', 'Tabela duplicada', 'Medida implícita'], 0, 'Variáveis nomeiam os passos.'),
        ], 'Combine CALCULATE + tempo + VAR + DIVIDE.', { boss: true }),
      ],
    },
  ],
}

export default content
