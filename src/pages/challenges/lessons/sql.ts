import type { Lesson } from './types'

export const SQL_LESSONS: Record<string, Lesson> = {
  "sql-first_steps-1": {
    concept: "Uma tabela guarda linhas e colunas. SELECT escolhe o que aparece no resultado e FROM escolhe a tabela. Use * para explorar todas as colunas. ORDER BY especifica a ordem das linhas.",
    workedExample: "Na tabela livros(id, titulo), há as linhas (2, \"Contos\") e (1, \"Atlas\").\n\nSELECT * FROM livros ORDER BY id;\n\nO resultado traz id e titulo. Atlas aparece antes de Contos.",
    pitfall: "Sem ORDER BY, o banco pode devolver as linhas em outra ordem. A ordem em que elas foram inseridas não é uma promessa da consulta.",
    checkpoint: {
      question: "Qual parte de SELECT * FROM livros ORDER BY id define a tabela lida?",
      options: [
        "SELECT *",
        "FROM livros",
        "ORDER BY id"
      ],
      correct: 1,
      explanation: "FROM indica a fonte. SELECT define as colunas de saída e ORDER BY ordena as linhas do resultado."
    }
  },
  "sql-first_steps-2": {
    concept: "Depois de explorar uma tabela inteira, liste os nomes das colunas de que precisa após SELECT. A ordem desses nomes define a ordem das colunas no resultado. A ordem das linhas é definida por ORDER BY.",
    workedExample: "Na tabela filmes(id, titulo, ano), a linha (1, \"O Menino e o Mundo\", 2013) tem três campos.\n\nSELECT ano, titulo FROM filmes;\n\nO resultado tem duas colunas, ano primeiro e titulo depois. id fica de fora.",
    pitfall: "Escolher duas colunas não limita a consulta a duas linhas. A projeção muda as colunas, não a quantidade de registros.",
    checkpoint: {
      question: "Qual consulta retorna as colunas titulo e ano, nessa ordem?",
      options: [
        "SELECT titulo, ano FROM filmes;",
        "SELECT ano, titulo FROM filmes;",
        "SELECT * FROM filmes ORDER BY titulo, ano;"
      ],
      correct: 0,
      explanation: "A lista depois de SELECT define quais colunas aparecem e em que ordem elas são exibidas."
    }
  },
  "sql-first_steps-3": {
    concept: "WHERE restringe as linhas lidas pela consulta. A expressão depois de WHERE precisa ser verdadeira para a linha entrar no resultado. Escreva valores de texto entre aspas simples.",
    workedExample: "Na tabela jogos(nome, genero), Xadrez tem genero Estratégia e Corrida tem genero Esporte.\n\nSELECT nome FROM jogos WHERE genero = 'Estratégia';\n\nO resultado contém Xadrez.",
    pitfall: "O valor Estratégia é um texto. Sem aspas simples, o SQLite tenta interpretar a palavra como nome de coluna.",
    checkpoint: {
      question: "Qual condição procura linhas em que a coluna turno vale \"noite\"?",
      options: [
        "WHERE turno = noite",
        "WHERE 'turno' = 'noite'",
        "WHERE turno = 'noite'"
      ],
      correct: 2,
      explanation: "turno é o identificador da coluna. Já noite é o valor textual que precisa estar entre aspas simples."
    }
  },
  "sql-first_steps-4": {
    concept: "ORDER BY aceita várias chaves. ASC coloca a primeira chave em ordem crescente e DESC faz o inverso. A segunda chave só decide a posição quando a primeira empata.",
    workedExample: "Na tabela placar(nome, pontos), Ana e Davi têm 8 pontos e Lia tem 5.\n\nSELECT nome, pontos FROM placar ORDER BY pontos DESC, nome ASC;\n\nA sequência é Ana, Davi, Lia. Ana aparece antes de Davi porque os pontos empatam.",
    pitfall: "Escrever DESC no fim de uma lista de chaves inverte só a coluna anterior ao DESC, não todas as chaves.",
    checkpoint: {
      question: "Qual cláusula ordena pela nota mais alta e, em empate, pelo nome em ordem alfabética?",
      options: [
        "ORDER BY nome ASC, nota DESC",
        "ORDER BY nota DESC, nome ASC",
        "ORDER BY nota ASC, nome DESC"
      ],
      correct: 1,
      explanation: "A nota vem primeiro porque é o critério principal. DESC faz as maiores notas aparecerem antes, e nome ASC resolve o empate."
    }
  },
  "sql-first_steps-5": {
    concept: "COUNT(*) conta linhas e devolve um valor agregado. Sem GROUP BY, esse valor resume o conjunto inteiro selecionado. AS dá um nome que explica o que aquela coluna representa.",
    workedExample: "Na tabela mensagens(remetente), há três linhas com Ana, NULL e Leo.\n\nSELECT COUNT(*) AS total FROM mensagens;\n\nA consulta retorna 3. A linha com remetente nulo também é uma linha.",
    pitfall: "COUNT(remetente) conta apenas as linhas em que remetente não é NULL. Use COUNT(*) quando a pergunta for sobre todas as linhas.",
    checkpoint: {
      question: "Qual valor COUNT(*) retorna para uma tabela vazia?",
      options: [
        "NULL",
        "Uma consulta sem linhas de resultado",
        "0"
      ],
      correct: 2,
      explanation: "COUNT(*) sem agrupamento retorna uma linha com a contagem. Se não houver linhas para contar, a contagem é zero."
    }
  },
  "sql-basic-1": {
    concept: "Você já usou WHERE com uma condição. AND exige que todas as condições conectadas sejam verdadeiras na mesma linha. OR aceita uma linha se pelo menos uma das condições for verdadeira.",
    workedExample: "Na tabela reservas(sala, confirmada), estão (\"A\", 1), (\"A\", 0) e (\"B\", 1).\n\nSELECT sala FROM reservas WHERE sala = 'A' AND confirmada = 1;\n\nApenas a primeira linha passa pelos dois testes.",
    pitfall: "Usar OR nesse exemplo aceita a reserva não confirmada de A e a reserva confirmada de B. Ao misturar AND e OR, use parênteses para mostrar o agrupamento.",
    checkpoint: {
      question: "Qual condição seleciona apenas chamados urgentes que ainda estão abertos?",
      options: [
        "WHERE urgente = 1 AND status = 'aberto'",
        "WHERE urgente = 1 OR status = 'aberto'",
        "WHERE urgente = 0 AND status = 'aberto'"
      ],
      correct: 0,
      explanation: "As duas características são obrigatórias na mesma linha. Por isso, a condição precisa usar AND."
    }
  },
  "sql-basic-2": {
    concept: "SELECT pode calcular uma expressão para cada linha usando as colunas disponíveis. Dê um alias à expressão para nomear o resultado e referenciá-lo em ORDER BY.",
    workedExample: "Na tabela assinaturas(plano, meses, mensalidade_centavos), o plano B tem 3 meses a 2500 centavos.\n\nSELECT plano, meses * mensalidade_centavos AS total_centavos\nFROM assinaturas ORDER BY total_centavos DESC;\n\nO total do plano B é 7500 centavos.",
    pitfall: "Uma expressão em SELECT mostra um cálculo no resultado. Ela não grava uma coluna nova nem altera valores armazenados.",
    checkpoint: {
      question: "O que SELECT quantidade * custo AS total produz para uma linha com quantidade 4 e custo 300?",
      options: [
        "Cria uma nova coluna persistente com o valor 1200",
        "Mostra 1200 na coluna total do resultado",
        "Mostra 304 na coluna total do resultado"
      ],
      correct: 1,
      explanation: "O operador * multiplica os valores naquela linha. O alias nomeia a saída calculada da consulta."
    }
  },
  "sql-basic-3": {
    concept: "GROUP BY reúne linhas que têm o mesmo valor na chave indicada. Em seguida, funções como COUNT() e SUM() produzem um resumo por grupo. Escolha a chave que responde à pergunta.",
    workedExample: "Na tabela livros(genero), há duas linhas com Ficção e uma com História.\n\nSELECT genero, COUNT(*) AS quantidade FROM livros GROUP BY genero ORDER BY genero;\n\nO resultado contém dois grupos, Ficção com 2 e História com 1.",
    pitfall: "Sem GROUP BY, a contagem é geral. Agrupar pelo id de cada livro também não ajuda quando o objetivo é somar por gênero.",
    checkpoint: {
      question: "O que define uma linha de saída em SELECT setor, COUNT(*) FROM pessoas GROUP BY setor?",
      options: [
        "Cada pessoa cadastrada",
        "Cada valor distinto de setor",
        "Cada valor possível de COUNT(*)"
      ],
      correct: 1,
      explanation: "O banco reúne pessoas com o mesmo setor. Cada grupo produz uma linha com seu setor e sua contagem."
    }
  },
  "sql-basic-4": {
    concept: "WHERE filtra linhas antes do agrupamento. HAVING filtra os grupos depois que COUNT(), SUM() ou outra agregação já foi calculada. Você pode usar os dois filtros na mesma consulta.",
    workedExample: "Na tabela livros(genero), há duas linhas com Ficção e uma com História.\n\nSELECT genero, COUNT(*) AS quantidade FROM livros\nGROUP BY genero HAVING COUNT(*) >= 2;\n\nApenas o grupo Ficção satisfaz a contagem mínima.",
    pitfall: "COUNT(*) ainda não está disponível em WHERE. Para perguntar sobre o tamanho de um grupo, use HAVING.",
    checkpoint: {
      question: "Em qual cláusula entra a condição SUM(pontos) > 100 para manter equipes que somaram mais de 100 pontos?",
      options: [
        "WHERE",
        "ORDER BY",
        "HAVING"
      ],
      correct: 2,
      explanation: "O total da equipe existe após o agrupamento. HAVING pode usar o total para decidir se o grupo permanece."
    }
  },
  "sql-basic-5": {
    concept: "LIKE compara um texto com um padrão. % representa zero ou mais caracteres e _ representa exatamente um caractere. A posição do símbolo determina se a busca é por prefixo, sufixo ou trecho.",
    workedExample: "Na tabela contatos(nome), estão Ana, André e Joana.\n\nSELECT nome FROM contatos WHERE nome LIKE 'An%';\n\nAna e André passam porque começam com An. Joana não começa com esse prefixo.",
    pitfall: "O padrão '%ana' procura um final. Para procurar um trecho em qualquer posição, coloque % antes e depois.",
    checkpoint: {
      question: "Qual padrão seleciona nomes que terminam em \"son\"?",
      options: [
        "LIKE '%son'",
        "LIKE 'son%'",
        "LIKE '_son'"
      ],
      correct: 0,
      explanation: "O % antes de son aceita qualquer prefixo, inclusive vazio. Como não há % depois, o texto precisa terminar em son."
    }
  },
  "sql-intermediate-1": {
    concept: "JOIN combina linhas de duas tabelas usando uma relação definida em ON. Use a chave que identifica a entidade, como aluno_id em inscrições. Aliases curtos ajudam a qualificar colunas com nomes iguais.",
    workedExample: "alunos(id, nome) contém (1, \"Bia\"). inscricoes(aluno_id, turma) contém (1, \"T2\").\n\nSELECT a.nome, i.turma FROM alunos AS a\nJOIN inscricoes AS i ON i.aluno_id = a.id;\n\nBia é associada à turma T2 pela chave 1.",
    pitfall: "Ligar tabelas por um nome que pode se repetir causa associações erradas. Sem uma condição de ligação, você pode combinar todas as linhas com todas.",
    checkpoint: {
      question: "Se Bia tem id 1 e duas inscrições com aluno_id 1, quantas linhas o JOIN retorna para Bia?",
      options: [
        "Uma, porque a tabela alunos tem só uma Bia",
        "Duas, uma por inscrição correspondente",
        "Zero, porque a chave aparece repetida em inscrições"
      ],
      correct: 1,
      explanation: "Cada inscrição que satisfaz ON forma uma linha com Bia. O JOIN não elimina as correspondências adicionais."
    }
  },
  "sql-intermediate-2": {
    concept: "Um LEFT JOIN preserva cada linha da tabela à esquerda. Quando falta correspondência, as colunas da direita ficam NULL. Testar a chave direita com IS NULL identifica os registros sem relação.",
    workedExample: "salas(id) contém 1 e 2. reservas(id, sala_id) contém (8, 1).\n\nSELECT s.id FROM salas AS s\nLEFT JOIN reservas AS r ON r.sala_id = s.id\nWHERE r.id IS NULL;\n\nSó a sala 2 aparece, pois não tem reserva.",
    pitfall: "A comparação = NULL não testa ausência. Use IS NULL e escolha uma coluna da direita que nunca seja nula numa correspondência válida.",
    checkpoint: {
      question: "Por que usar LEFT JOIN para encontrar salas sem reserva?",
      options: [
        "Ele remove automaticamente todas as salas reservadas",
        "Ele deixa uma linha com valores NULL do lado direito para uma sala sem reserva",
        "Ele troca o id da sala pelo id da reserva"
      ],
      correct: 1,
      explanation: "O LEFT JOIN mantém a sala mesmo sem par. O filtro IS NULL usa essa linha para identificar a ausência."
    }
  },
  "sql-intermediate-3": {
    concept: "Quando um LEFT JOIN precisa preservar todos os registros à esquerda, coloque em ON as condições que limitam quais registros da direita contam. Depois do agrupamento, COALESCE() substitui um total NULL por zero.",
    workedExample: "turmas(id) contém 1 e 2. presencas(turma_id, confirmada) contém apenas (1, 1).\n\nSELECT t.id, COALESCE(SUM(p.confirmada), 0) AS presencas\nFROM turmas t LEFT JOIN presencas p\nON p.turma_id = t.id AND p.confirmada = 1\nGROUP BY t.id;\n\nA turma 1 tem 1 e a turma 2 continua no resultado com 0.",
    pitfall: "Colocar p.confirmada = 1 em WHERE elimina a linha sem par porque nela p.confirmada é NULL.",
    checkpoint: {
      question: "Onde filtrar o status do registro direito para preservar toda linha da esquerda no LEFT JOIN?",
      options: [
        "No ON da junção",
        "No WHERE como status = 'confirmado'",
        "Em HAVING COUNT(*) > 0"
      ],
      correct: 0,
      explanation: "ON decide quais linhas da direita podem corresponder. Mesmo que nenhuma passe, a linha da esquerda continua disponível."
    }
  },
  "sql-intermediate-4": {
    concept: "Uma subconsulta escalar fornece um único valor para a consulta externa. Calcule nela a estatística de referência e compare cada linha elegível com esse resultado. Defina o mesmo conjunto nos dois lados quando a comparação pedir isso.",
    workedExample: "Na tabela tempos(segundos), há 10, 20 e 30.\n\nSELECT segundos FROM tempos\nWHERE segundos > (SELECT AVG(segundos) FROM tempos);\n\nA média é 20 e apenas 30 é estritamente maior.",
    pitfall: "Usar >= em vez de > inclui valores iguais à média. Calcular a média sobre um conjunto diferente também muda o significado do filtro.",
    checkpoint: {
      question: "Para tempos 10, 20 e 30, quais linhas passam por segundos > AVG(...) quando a média é 20?",
      options: [
        "20 e 30",
        "Apenas 30",
        "10 e 30"
      ],
      correct: 1,
      explanation: "O operador > exige valor estritamente maior. O valor 20 é igual à média e não passa."
    }
  },
  "sql-intermediate-5": {
    concept: "Datas ISO no formato AAAA-MM-DD permitem extrair o mês de maneira previsível. No SQLite, strftime('%Y-%m', data) produz uma chave que inclui ano e mês. Agrupe por essa chave para resumir períodos.",
    workedExample: "Na tabela visitas(data), há 2025-12-31, 2026-01-01 e 2026-01-15.\n\nSELECT strftime('%Y-%m', data) AS mes, COUNT(*) AS total\nFROM visitas GROUP BY strftime('%Y-%m', data) ORDER BY mes;\n\nO resultado é 2025-12 com 1 e 2026-01 com 2.",
    pitfall: "Agrupar por %m sozinho mistura o mesmo mês de anos diferentes.",
    checkpoint: {
      question: "Qual chave separa janeiro de 2025 e janeiro de 2026?",
      options: [
        "strftime('%m', data)",
        "strftime('%d', data)",
        "strftime('%Y-%m', data)"
      ],
      correct: 2,
      explanation: "A chave inclui o ano e o mês. As duas datas viram 2025-01 e 2026-01, portanto pertencem a grupos diferentes."
    }
  },
  "sql-advanced-1": {
    concept: "Uma CTE nomeia um resultado intermediário de uma consulta. Calcule o total por participante nela e use DENSE_RANK() na consulta externa para classificar os totais. Empates recebem a mesma posição e não pulam a seguinte.",
    workedExample: "placar(nome, pontos) tem Lua com 90, Sol com 90 e Mar com 70.\n\nSELECT nome, DENSE_RANK() OVER (ORDER BY pontos DESC) AS posicao\nFROM placar ORDER BY posicao, nome;\n\nLua e Sol ficam em 1. Mar fica em 2.",
    pitfall: "Colocar nome dentro do ORDER BY da janela faz nomes diferentes deixarem de empatar. Use nome só para ordenar a apresentação final.",
    checkpoint: {
      question: "Quais posições DENSE_RANK() atribui aos valores 100, 100 e 80 em ordem decrescente?",
      options: [
        "1, 1 e 2",
        "1, 1 e 3",
        "1, 2 e 3"
      ],
      correct: 0,
      explanation: "DENSE_RANK() atribui uma posição a cada valor distinto. O próximo valor distinto recebe a posição imediatamente seguinte."
    }
  },
  "sql-advanced-2": {
    concept: "Uma soma com OVER() usa uma janela e mantém uma linha por registro de entrada. Para uma soma acumulada por data, prepare uma linha por dia e defina a janela da primeira linha até a linha atual.",
    workedExample: "Na tabela diario(dia, pontos), estão (1, 3), (2, 5) e (3, 2).\n\nSELECT dia, SUM(pontos) OVER (ORDER BY dia\nROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS acumulado\nFROM diario ORDER BY dia;\n\nOs totais são 3, 8 e 10.",
    pitfall: "Se a entrada tiver várias linhas com a mesma data, você pode ver vários acumulados no mesmo dia. Agrupe antes quando a saída deve ter uma linha diária.",
    checkpoint: {
      question: "Para valores diários 4, 1 e 7, qual acumulado aparece na segunda linha?",
      options: [
        "1",
        "5",
        "12"
      ],
      correct: 1,
      explanation: "A segunda janela contém os valores da primeira e da segunda linha. A terceira ainda está fora da janela."
    }
  },
  "sql-advanced-3": {
    concept: "ROW_NUMBER() numera linhas na ordem definida pela janela. PARTITION BY reinicia a numeração para cada grupo. Use um critério final de desempate para escolher a mesma linha quando as datas coincidirem.",
    workedExample: "Na tabela entregas(pessoa_id, id, dia), há (1, 4, \"2026-05-02\"), (1, 5, \"2026-05-02\") e (2, 8, \"2026-04-01\").\n\nROW_NUMBER() OVER (PARTITION BY pessoa_id ORDER BY dia DESC, id DESC)\n\nO número 1 é atribuído ao id 5 para a pessoa 1 e ao id 8 para a pessoa 2.",
    pitfall: "Usar somente a data na ordenação deixa o desempate indefinido. Para filtrar pelo número da janela, calcule-o numa CTE e use o filtro na consulta externa.",
    checkpoint: {
      question: "O que acontece se remover PARTITION BY pessoa_id e filtrar apenas a linha numerada como 1?",
      options: [
        "Você mantém uma linha por pessoa",
        "As datas empatadas geram várias linhas numeradas como 1",
        "Você mantém uma única linha do conjunto inteiro"
      ],
      correct: 2,
      explanation: "Sem partição, todas as linhas compartilham a mesma sequência. ROW_NUMBER() atribui o número 1 apenas à primeira."
    }
  },
  "sql-advanced-4": {
    concept: "Uma CTE recursiva começa com uma consulta âncora. A parte recursiva usa os resultados encontrados para descobrir os próximos. Numa árvore, a junção liga cada filho ao pai já descoberto e pode aumentar o nível em um.",
    workedExample: "Imagine pastas(id, pai_id) com raiz 10, filha 11 de 10 e filha 12 de 11.\n\nA âncora retorna 11 no nível 1. A etapa recursiva encontra 12 pelo pai 11 e retorna nível 2. Como 12 não tem filhos, a expansão termina.",
    pitfall: "Iniciar pela própria raiz muda a numeração. A tabela do exercício não tem ciclos. Ao adaptar a consulta a outras fontes, garanta que ela não visite a mesma cadeia indefinidamente.",
    checkpoint: {
      question: "Qual condição encontra a próxima geração a partir de uma linha d da CTE que já foi descoberta?",
      options: [
        "filho.pai_id = d.id",
        "filho.id = d.id",
        "filho.id = d.pai_id"
      ],
      correct: 0,
      explanation: "O campo pai_id do filho aponta para o identificador do pai. As outras condições encontram a própria linha ou sobem para o pai."
    }
  },
  "sql-advanced-5": {
    concept: "BEGIN inicia uma transação. A conexão enxerga suas alterações ainda não confirmadas, então SELECT pode conferi-las. ROLLBACK desfaz as mudanças da transação. Uma condição no próprio UPDATE torna a verificação e a alteração parte da mesma operação.",
    workedExample: "Em um banco de treino, pontos(id, saldo) contém (1, 8).\n\nBEGIN;\nUPDATE pontos SET saldo = saldo - 3 WHERE id = 1 AND saldo >= 3;\nSELECT saldo FROM pontos WHERE id = 1;\nROLLBACK;\n\nO SELECT interno mostra 5. Depois do ROLLBACK, a linha volta a mostrar 8.",
    pitfall: "Testar o saldo apenas em um SELECT separado deixa a regra fora do UPDATE. Se o saldo disponível for insuficiente, a condição no UPDATE impede a redução.",
    checkpoint: {
      question: "Se o saldo inicial for 2 e a condição do UPDATE for saldo >= 3, qual saldo a transação verá?",
      options: [
        "-1 até o ROLLBACK",
        "2, porque o UPDATE não altera a linha",
        "0, porque a redução é ajustada automaticamente"
      ],
      correct: 1,
      explanation: "A linha não satisfaz o WHERE. Como ela fica fora do UPDATE, o saldo continua 2 antes e depois do ROLLBACK."
    }
  }
}
