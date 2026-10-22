import type { SubjectContent } from '../types'
import { cat, fill, match, mcq, multi, num, order, short, step, tf } from './_build'

const content: SubjectContent = {
  subjectId: 'estatistica',
  units: [
    {
      id: 'estatistica.u1',
      title: 'Estatística descritiva',
      summary: 'Tipos de variáveis, média, mediana, moda e gráficos.',
      topics: [
        { id: 'variaveis', name: 'Tipos de variáveis' },
        { id: 'tendencia', name: 'Medidas de tendência central' },
        { id: 'graficos', name: 'Tabelas e gráficos' },
      ],
      lesson: [
        { title: 'Tipos de variáveis', body: 'Qualitativas (categorias): nominais (sem ordem: cor, UF) ou ordinais (com ordem: escolaridade). Quantitativas (números): discretas (contagens: nº de filhos) ou contínuas (medidas: altura, tempo).' },
        { title: 'Média, mediana e moda', body: 'Média = soma / quantidade (sensível a valores extremos). Mediana = valor central dos dados ORDENADOS (com n par, média dos dois centrais). Moda = valor mais frequente.', example: 'Dados: 2, 4, 4, 5, 7, 8 → média 5; mediana (4+5)/2 = 4,5; moda 4.' },
        { title: 'Assimetria', body: 'Com cauda longa à direita (poucos valores muito altos, como renda), a média fica acima da mediana. Por isso a mediana é preferida para salários.' },
        { title: 'Gráficos', body: 'Barras: comparar categorias. Linha: evolução no tempo. Histograma: distribuição de variável contínua. Dispersão: relação entre duas variáveis numéricas. Evite pizza com muitas fatias.' },
      ],
      challenges: [
        cat('estatistica.u1.c01', 'variaveis', 2, 'Classifique as variáveis.', ['Qualitativa nominal', 'Qualitativa ordinal', 'Quantitativa discreta', 'Quantitativa contínua'], [['Estado (UF)', 0], ['Escolaridade', 1], ['Número de filhos', 2], ['Altura', 3], ['Tempo de prova', 3], ['Classe social (A, B, C)', 1]], 'Ordinais têm ordem natural; discretas são contagens; contínuas são medidas.'),
        num('estatistica.u1.c02', 'tendencia', 1, 'Calcule a média de 2, 4, 4, 5, 7, 8.', 5, 'Soma 30 ÷ 6 = 5.', { calc: { op: 'mean', data: [2, 4, 4, 5, 7, 8] } }),
        num('estatistica.u1.c03', 'tendencia', 2, 'Calcule a mediana de 2, 4, 4, 5, 7, 8.', 4.5, 'n = 6 (par): média dos centrais 4 e 5 = 4,5.', { tolerance: 0.001, calc: { op: 'median', data: [2, 4, 4, 5, 7, 8] } }),
        num('estatistica.u1.c04', 'tendencia', 2, 'Calcule a mediana de 9, 1, 7, 3, 5.', 5, 'Ordene primeiro: 1, 3, 5, 7, 9 → central = 5.', { calc: { op: 'median', data: [9, 1, 7, 3, 5] }, whyWrong: 'Pegar o elemento do meio SEM ordenar daria 7.' }),
        mcq('estatistica.u1.c05', 'tendencia', 2, 'Qual medida é mais adequada para resumir salários de uma empresa com poucos diretores muito bem pagos?', ['Média', 'Mediana', 'Amplitude', 'Soma'], 1, 'A mediana é robusta a valores extremos; a média seria puxada para cima.'),
        tf('estatistica.u1.c06', 'tendencia', 2, 'Um conjunto de dados pode ter mais de uma moda.', true, 'Bimodal (duas modas) ou multimodal. Também pode ser amodal (sem moda).'),
        match('estatistica.u1.c07', 'graficos', 1, 'Associe o objetivo ao gráfico.', [['Evolução mensal das vendas', 'Linha'], ['Comparar vendas por região', 'Barras'], ['Distribuição das idades', 'Histograma'], ['Relação entre horas de estudo e nota', 'Dispersão']], 'Escolha o gráfico pela pergunta que ele precisa responder.'),
        num('estatistica.u1.c08', 'tendencia', 3, 'A média de 4 provas é 7. Qual nota na 5ª prova faz a média subir para 7,4?', 9, 'Soma atual 28; precisa de 5 × 7,4 = 37; 37 − 28 = 9.'),
        mcq('estatistica.u1.c09', 'tendencia', 3, 'Em uma distribuição assimétrica à direita, em geral:', ['média < mediana', 'média > mediana', 'média = mediana = moda', 'a moda é sempre a maior'], 1, 'A cauda direita (valores altos) puxa a média para cima.'),
        num('estatistica.u1.c10', 'tendencia', 3, 'Média ponderada: prova A (nota 6, peso 2) e prova B (nota 9, peso 3). Qual a média final?', 7.8, '(6×2 + 9×3) / (2+3) = (12 + 27) / 5 = 7,8.', { tolerance: 0.001 }),
        multi('estatistica.u1.boss', 'tendencia', 4, 'Chefe da unidade: tempos de estudo (min) de uma semana: 30, 45, 45, 60, 120.', [
          step.num('estatistica.u1.boss.s1', 'Média?', 60, '300 / 5 = 60.'),
          step.num('estatistica.u1.boss.s2', 'Mediana?', 45, 'Valor central: 45.'),
          step.num('estatistica.u1.boss.s3', 'Moda?', 45, 'Aparece duas vezes.'),
        ], 'O dia de 120 min puxou a média acima da mediana.', { boss: true, calc: { op: 'mean', data: [30, 45, 45, 60, 120] } }),
      ],
    },
    {
      id: 'estatistica.u2',
      title: 'Medidas de dispersão',
      summary: 'Amplitude, variância, desvio padrão, CV e quartis.',
      topics: [
        { id: 'dispersao', name: 'Variância e desvio padrão' },
        { id: 'cv', name: 'Coeficiente de variação' },
        { id: 'quartis', name: 'Quartis e boxplot' },
      ],
      lesson: [
        { title: 'Por que medir dispersão', body: 'Dois grupos podem ter a mesma média e comportamentos muito diferentes. Dispersão mede o quanto os dados se afastam do centro.' },
        { title: 'Variância e desvio padrão', body: 'Variância = média dos quadrados dos desvios em relação à média. População: divide por n. Amostra: divide por n − 1. Desvio padrão = raiz da variância, na mesma unidade dos dados.', example: 'Dados 2,4,4,4,5,5,7,9: média 5; soma dos quadrados dos desvios 32; variância populacional 32/8 = 4; desvio 2.' },
        { title: 'Coeficiente de variação', body: 'CV = desvio padrão / média × 100%. Compara dispersões de conjuntos com unidades ou médias diferentes.' },
        { title: 'Quartis', body: 'Q1, Q2 (mediana) e Q3 dividem os dados ordenados em quatro partes. Amplitude interquartil IQR = Q3 − Q1. No boxplot, valores além de 1,5 × IQR das caixas costumam ser marcados como atípicos.' },
      ],
      challenges: [
        num('estatistica.u2.c01', 'dispersao', 1, 'Qual a amplitude de 3, 8, 1, 10, 6?', 9, 'Máximo − mínimo = 10 − 1 = 9.', { calc: { op: 'range', data: [3, 8, 1, 10, 6] } }),
        num('estatistica.u2.c02', 'dispersao', 3, 'Variância POPULACIONAL de 2, 4, 4, 4, 5, 5, 7, 9.', 4, 'Média 5; desvios ao quadrado somam 32; 32 / 8 = 4.', { calc: { op: 'var_pop', data: [2, 4, 4, 4, 5, 5, 7, 9] } }),
        num('estatistica.u2.c03', 'dispersao', 2, 'Desvio padrão POPULACIONAL de 2, 4, 4, 4, 5, 5, 7, 9.', 2, '√4 = 2.', { calc: { op: 'sd_pop', data: [2, 4, 4, 4, 5, 5, 7, 9] } }),
        num('estatistica.u2.c04', 'dispersao', 3, 'Variância AMOSTRAL de 1, 2, 3, 4, 5.', 2.5, 'Média 3; desvios² = 4+1+0+1+4 = 10; 10 / (5 − 1) = 2,5.', { tolerance: 0.001, calc: { op: 'var_sample', data: [1, 2, 3, 4, 5] } }),
        num('estatistica.u2.c05', 'dispersao', 4, 'Desvio padrão AMOSTRAL de 1, 2, 3, 4, 5 (2 casas decimais).', 1.58, '√2,5 ≈ 1,58.', { tolerance: 0.01, calc: { op: 'sd_sample', data: [1, 2, 3, 4, 5] } }),
        tf('estatistica.u2.c06', 'dispersao', 2, 'Somar 10 a todos os valores de um conjunto não altera o desvio padrão.', true, 'Os desvios em relação à média continuam os mesmos. Já multiplicar por k multiplica o desvio por |k|.'),
        tf('estatistica.u2.c07', 'dispersao', 3, 'Multiplicar todos os valores por 3 multiplica a variância por 3.', false, 'A variância é multiplicada por 3² = 9; o desvio padrão, por 3.'),
        num('estatistica.u2.c08', 'cv', 3, 'Dados 10, 12, 14 (amostra). Qual o coeficiente de variação, em %? (2 casas)', 16.67, 'Média 12; s² = (4+0+4)/2 = 4; s = 2; CV = 2/12 = 16,67%.', { tolerance: 0.01, unit: '%', calc: { op: 'cv_sample', data: [10, 12, 14] } }),
        mcq('estatistica.u2.c09', 'cv', 3, 'Turma A: média 60, desvio 6. Turma B: média 80, desvio 12. Qual é relativamente mais homogênea?', ['A (CV 10%)', 'B (CV 15%)', 'Iguais', 'Não é possível comparar'], 0, 'CV A = 6/60 = 10%; CV B = 12/80 = 15%. Menor CV → mais homogênea.'),
        num('estatistica.u2.c10', 'quartis', 3, 'Se Q1 = 20 e Q3 = 50, qual a amplitude interquartil?', 30, 'IQR = Q3 − Q1 = 30.'),
        num('estatistica.u2.c11', 'quartis', 4, 'Com Q1 = 20 e Q3 = 50, a partir de qual valor (limite superior) um dado é considerado atípico pelo critério 1,5 × IQR?', 95, 'Q3 + 1,5 × 30 = 50 + 45 = 95.'),
        fill('estatistica.u2.c12', 'dispersao', 2, 'Complete.', 'Na variância amostral, divide-se a soma dos quadrados dos desvios por ___.', [{ accept: ['n - 1', 'n-1', 'n − 1'], options: ['n', 'n - 1', 'n + 1', 'n²'] }], 'n − 1 corrige o viés de usar a média da própria amostra.'),
        multi('estatistica.u2.boss', 'dispersao', 5, 'Chefe da unidade: dois atendentes atendem 4, 6, 8 e 2, 6, 10 chamados/dia.', [
          step.num('estatistica.u2.boss.s1', 'Média do atendente 1?', 6, '(4 + 6 + 8) / 3 = 6.'),
          step.num('estatistica.u2.boss.s2', 'Variância populacional do atendente 2? (2 casas)', 10.67, '(16 + 0 + 16)/3 ≈ 10,67.', 0.01),
          step.mcq('estatistica.u2.boss.s3', 'Quem é mais regular?', ['Atendente 1', 'Atendente 2', 'Iguais'], 0, 'Mesma média, menor dispersão (variância 2,67).'),
        ], 'Médias iguais não significam desempenho igual: olhe a dispersão.', { boss: true, calc: { op: 'var_pop', data: [2, 6, 10] } }),
      ],
    },
    {
      id: 'estatistica.u3',
      title: 'Probabilidade e inferência',
      summary: 'Distribuição normal, amostragem, correlação e testes.',
      topics: [
        { id: 'normal', name: 'Distribuição normal' },
        { id: 'amostragem', name: 'Amostragem' },
        { id: 'correlacao', name: 'Correlação e regressão' },
      ],
      lesson: [
        { title: 'Distribuição normal', body: 'Simétrica, em forma de sino; média = mediana = moda. Regra 68–95–99,7: cerca de 68% dos dados ficam a 1 desvio da média, 95% a 2 e 99,7% a 3.' },
        { title: 'Escore z', body: 'z = (x − média) / desvio. Indica quantos desvios um valor está acima (z > 0) ou abaixo (z < 0) da média.' },
        { title: 'Amostragem', body: 'Aleatória simples: todos têm a mesma chance. Estratificada: sorteia dentro de grupos (estratos). Sistemática: a cada k elementos. Por conglomerados: sorteia grupos inteiros. Amostras de conveniência geram viés.' },
        { title: 'Correlação', body: 'O coeficiente de Pearson r varia de −1 a 1 e mede relação LINEAR. r próximo de 0 não exclui relação não linear. Correlação não implica causalidade.' },
      ],
      challenges: [
        num('estatistica.u3.c01', 'normal', 2, 'Em uma normal, aproximadamente qual % dos dados fica entre média − 2 desvios e média + 2 desvios?', 95, 'Regra empírica 68–95–99,7.', { unit: '%', tolerance: 0.5 }),
        num('estatistica.u3.c02', 'normal', 2, 'Média 70, desvio 5. Qual o escore z de uma nota 80?', 2, 'z = (80 − 70) / 5 = 2.'),
        mcq('estatistica.u3.c03', 'normal', 3, 'Notas com média 70 e desvio 5 (normal). Aproximadamente qual % tirou acima de 75?', ['16%', '34%', '50%', '68%'], 0, '75 é z = 1. Entre −1 e 1 ficam 68%; sobram 32% nas caudas, 16% em cada uma.'),
        cat('estatistica.u3.c04', 'amostragem', 3, 'Identifique o tipo de amostragem.', ['Aleatória simples', 'Estratificada', 'Sistemática', 'Conveniência'], [['Sortear 100 CPFs da lista completa', 0], ['Sortear 30 alunos de cada série', 1], ['Entrevistar a cada 10º cliente da fila', 2], ['Perguntar só aos amigos', 3]], 'A estratificada garante representação de cada grupo; conveniência não é probabilística.'),
        tf('estatistica.u3.c05', 'correlacao', 2, 'Se r = 0,9 entre sorvetes vendidos e afogamentos, sorvete causa afogamento.', false, 'Correlação não implica causalidade: a temperatura (variável de confusão) explica as duas.'),
        mcq('estatistica.u3.c06', 'correlacao', 2, 'Qual valor de r indica a relação linear mais forte?', ['0,5', '−0,85', '0,1', '0,7'], 1, 'A força é dada por |r|; o sinal indica a direção. |−0,85| é o maior.'),
        match('estatistica.u3.c07', 'correlacao', 2, 'Associe o valor de r à interpretação.', [['r ≈ 1', 'Linear positiva forte'], ['r ≈ −1', 'Linear negativa forte'], ['r ≈ 0', 'Sem relação linear'], ['r = 0,4', 'Positiva moderada/fraca']], 'O coeficiente de Pearson só capta relação linear.'),
        num('estatistica.u3.c08', 'correlacao', 3, 'Na reta ŷ = 50 + 5x (x = horas de estudo, y = nota), qual a nota prevista para 6 horas?', 80, '50 + 5 × 6 = 80.'),
        short('estatistica.u3.c09', 'amostragem', 3, 'Como se chama o erro sistemático que surge quando a amostra não representa a população? (uma palavra)', ['viés', 'vies', 'vicio', 'vício'], 'Viés (ou vício) de seleção.', { accentSensitive: false }),
        mcq('estatistica.u3.c10', 'amostragem', 4, 'Ao aumentar o tamanho da amostra (mantido o resto), a margem de erro de uma estimativa:', ['aumenta', 'diminui', 'não muda', 'vira zero'], 1, 'O erro padrão cai proporcionalmente a 1/√n.'),
        order('estatistica.u3.c11', 'normal', 3, 'Ordene as faixas da MENOR para a MAIOR proporção de dados numa normal.', ['Acima de z = 2', 'Entre z = 1 e z = 2', 'Entre z = 0 e z = 1', 'Entre z = −1 e z = 1'], '≈ 2,5%, ≈ 13,5%, ≈ 34% e ≈ 68%.'),
        multi('estatistica.u3.boss', 'normal', 5, 'Chefe final de Estatística: prova com média 600 e desvio 100 (normal).', [
          step.num('estatistica.u3.boss.s1', 'Escore z de 750?', 1.5, '(750 − 600) / 100.', 0.001),
          step.mcq('estatistica.u3.boss.s2', 'Aproximadamente qual % ficou entre 500 e 700?', ['50%', '68%', '95%', '99,7%'], 1, '±1 desvio.'),
          step.mcq('estatistica.u3.boss.s3', 'Uma nota 900 é:', ['comum', 'rara (z = 3)', 'abaixo da média', 'impossível'], 1, 'Acima de 3 desvios ficam só ≈ 0,15% dos dados.'),
        ], 'Converta para z e use a regra 68–95–99,7.', { boss: true }),
      ],
    },
  ],
}

export default content
