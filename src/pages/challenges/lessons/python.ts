import type { Lesson } from './types'

export const PYTHON_LESSONS: Record<string, Lesson> = {
  "python-first_steps-1": {
    concept: "O terminal é uma área de texto onde você vê a saída do programa. Em Python, print() envia uma mensagem para essa saída. As aspas delimitam a mensagem no código.",
    workedExample: "print(\"Até amanhã!\")\n\nSaída esperada: Até amanhã!\nAs aspas pertencem ao código. A exclamação pertence à mensagem.",
    pitfall: "Escrever print(Até amanhã!) sem aspas faz o Python tentar interpretar as palavras como código.",
    checkpoint: {
      question: "Qual mensagem aparece ao executar print(\"Boa tarde!\")?",
      options: [
        "\"Boa tarde!\"",
        "Boa tarde!",
        "print(Boa tarde!)"
      ],
      correct: 1,
      explanation: "print() mostra o conteúdo da string. As aspas que a delimitam não aparecem na saída."
    }
  },
  "python-first_steps-2": {
    concept: "Depois de escrever uma mensagem fixa com print(), use input() para receber texto. Guarde a resposta numa variável. Uma f-string usa chaves para colocar o valor dessa variável no meio da mensagem.",
    workedExample: "cidade = input(\"Em que cidade você mora? \")\nprint(f\"Destino: {cidade}\")\n\nQuem digitar Recife verá Destino: Recife na última linha.",
    pitfall: "Sem o f antes das aspas, {cidade} aparece como texto literal.",
    checkpoint: {
      question: "Se animal = \"gato\", qual expressão produz o texto Meu gato?",
      options: [
        "\"Meu {animal}\"",
        "f\"Meu animal\"",
        "f\"Meu {animal}\""
      ],
      correct: 2,
      explanation: "O f ativa a interpolação, e as chaves indicam qual variável deve ser lida."
    }
  },
  "python-first_steps-3": {
    concept: "O Python executa as instruções de cima para baixo. input() mostra um aviso e pausa a execução até receber Enter. Quando a entrada serve só de pausa, você pode deixar a resposta sem variável.",
    workedExample: "print(\"A porta se abriu.\")\ninput(\"Pressione Enter para entrar...\")\nprint(\"Havia um piano no salão.\")\n\nO texto do piano só aparece depois de pressionar Enter.",
    pitfall: "Uma pausa colocada antes da primeira mensagem espera Enter antes de começar a história.",
    checkpoint: {
      question: "Em qual posição você coloca input() para mostrar A, esperar Enter e então mostrar B?",
      options: [
        "Entre print(\"A\") e print(\"B\")",
        "Antes dos dois print()",
        "Depois dos dois print()"
      ],
      correct: 0,
      explanation: "A pausa precisa estar entre as duas mensagens. Tudo acima do input() já aconteceu quando a pessoa vê o aviso."
    }
  },
  "python-first_steps-4": {
    concept: "Você já usou input() para ler texto. Para calcular, converta esse texto com float(). A função sqrt(), do módulo math, retorna a raiz quadrada de um número não negativo.",
    workedExample: "from math import sqrt\n\nmedida = float(\"81\")\nprint(sqrt(medida))  # 9.0\n\nA conversão acontece antes de chamar sqrt().",
    pitfall: "sqrt(\"81\") recebe texto e falha. Uma entrada negativa também está fora do domínio da raiz quadrada real.",
    checkpoint: {
      question: "Qual expressão calcula a raiz quadrada quando entrada contém o texto \"36\"?",
      options: [
        "sqrt(entrada)",
        "float(sqrt(entrada))",
        "sqrt(float(entrada))"
      ],
      correct: 2,
      explanation: "sqrt() precisa receber um número. Converta a entrada antes de chamar a função."
    }
  },
  "python-first_steps-5": {
    concept: "O operador * faz multiplicação entre números. Com texto e um inteiro, ele repete o texto. A conversão numérica da lição anterior evita confundir as duas operações.",
    workedExample: "print(\"3\" * 2)       # 33, texto repetido\nprint(int(\"3\") * 2)  # 6, resultado numérico\n\nUse float() no lugar de int() quando a entrada puder ter casas decimais.",
    pitfall: "Multiplicar diretamente o retorno de input() repete os caracteres.",
    checkpoint: {
      question: "Qual é o resultado numérico de float(\"-4\") * 2?",
      options: [
        "-4.0",
        "-8.0",
        "8.0"
      ],
      correct: 1,
      explanation: "float() transforma \"-4\" em -4.0. Multiplicar por dois preserva o sinal negativo e dobra a magnitude."
    }
  },
  "python-basic-1": {
    concept: "Com números já convertidos, use % para obter o resto da divisão. Uma condição if verifica esse resto. O bloco else cobre o outro resultado possível.",
    workedExample: "quantidade = 15\nif quantidade % 3 == 0:\n    print(\"Cabe em grupos de três\")\nelse:\n    print(\"Sobra pelo menos um\")\n\nComo 15 % 3 vale zero, o primeiro bloco é executado.",
    pitfall: "Use == para comparar. O sinal = atribui um valor e não serve como comparação simples no if.",
    checkpoint: {
      question: "Qual valor Python calcula para 14 % 4?",
      options: [
        "3",
        "3.5",
        "2"
      ],
      correct: 2,
      explanation: "Quatro cabe três vezes em 14, totalizando 12. O operador % devolve os 2 que sobraram."
    }
  },
  "python-basic-2": {
    concept: "Um for repete um bloco para cada valor de uma sequência. Um acumulador começa antes do laço e recebe parte do resultado a cada repetição. range(início, fim) inclui o início e exclui o fim.",
    workedExample: "total = 0\nfor numero in range(2, 5):\n    total += numero\nprint(total)  # 9\n\nO acumulador passa por 2, 5 e 9 ao somar 2, 3 e 4.",
    pitfall: "Inicializar total = 0 dentro do laço apaga a soma feita nas repetições anteriores.",
    checkpoint: {
      question: "Quais números aparecem em range(3, 7)?",
      options: [
        "3, 4, 5, 6",
        "3, 4, 5, 6, 7",
        "4, 5, 6, 7"
      ],
      correct: 0,
      explanation: "range() inclui 3 e para antes de 7. Para incluir 7, o segundo argumento teria de ser 8."
    }
  },
  "python-basic-3": {
    concept: "Uma lista guarda vários valores na ordem em que foram inseridos. sum() faz a soma e len() dá a quantidade. Dividir esses resultados calcula a média. A formatação da f-string controla a apresentação.",
    workedExample: "tempos = [12, 15, 18]\nmedia = sum(tempos) / len(tempos)\nprint(f\"{media:.2f}\")  # 15.00\n\nA média continua numérica. O formato com duas casas só é aplicado ao exibir.",
    pitfall: "Dividir por uma quantidade fixa quebra a média se a lista mudar. Uma lista vazia também não tem média definida por essa divisão.",
    checkpoint: {
      question: "Qual expressão calcula a média da lista valores quando ela contém pelo menos um número?",
      options: [
        "sum(valores) / valores[-1]",
        "len(valores) / sum(valores)",
        "sum(valores) / len(valores)"
      ],
      correct: 2,
      explanation: "O denominador é o número de itens. O último valor e a soma dos itens medem outras coisas."
    }
  },
  "python-basic-4": {
    concept: "Assim como o for percorre uma faixa numérica, ele pode percorrer um texto caractere a caractere. lower() deixa as letras minúsculas. Use in para verificar se uma letra pertence a um conjunto de caracteres.",
    workedExample: "contagem = 0\nfor letra in \"Sol e Mar\".lower():\n    if letra in \"aeiou\":\n        contagem += 1\nprint(contagem)  # 3\n\nAs letras o, e e a passam no teste. Os espaços ficam de fora.",
    pitfall: "lower() troca maiúsculas por minúsculas. Ele não transforma é em e, então é não está na string aeiou.",
    checkpoint: {
      question: "Quantas letras de \"ÁREA\".lower() pertencem a \"aeiou\"?",
      options: [
        "3",
        "2",
        "1"
      ],
      correct: 1,
      explanation: "O resultado de lower() é \"área\". Apenas e e a aparecem em \"aeiou\", portanto a contagem é 2."
    }
  },
  "python-basic-5": {
    concept: "Uma função nomeia uma operação reutilizável. O parâmetro recebe o valor de cada chamada. return entrega o resultado para a linha que chamou a função, permitindo guardá-lo ou usá-lo em outro cálculo.",
    workedExample: "def area_quadrado(lado):\n    return lado * lado\n\narea = area_quadrado(4)\nprint(area + 1)  # 17\n\nO resultado da função foi reaproveitado em uma expressão.",
    pitfall: "Se a função só usar print(), ela mostra o resultado, mas a chamada devolve None quando não há return.",
    checkpoint: {
      question: "O que acontece se area_quadrado(4) apenas imprimir 16 e não tiver return?",
      options: [
        "A chamada devolve 16 e não imprime nada",
        "A chamada devolve a string \"16\"",
        "Ela imprime 16 e a chamada devolve None"
      ],
      correct: 2,
      explanation: "print() escreve na saída. Uma função que chega ao fim sem return devolve None."
    }
  },
  "python-intermediate-1": {
    concept: "Um dicionário guarda campos por nome. Uma expressão geradora usa for para percorrer os registros e if para filtrar os elegíveis antes de extrair seus valores. sum() pode consumir esse gerador diretamente.",
    workedExample: "tarefas = [{\"horas\": 2, \"ativa\": True}, {\"horas\": 5, \"ativa\": False}]\nprint(sum(t[\"horas\"] for t in tarefas if t[\"ativa\"]))  # 2\n\nSó o registro ativo envia um valor para sum().",
    pitfall: "Somar primeiro e filtrar depois perde a informação de quais registros entraram no total.",
    checkpoint: {
      question: "Qual valor sum() devolve quando nenhum registro satisfaz o filtro?",
      options: [
        "0",
        "None",
        "ValueError"
      ],
      correct: 0,
      explanation: "A soma parte de zero por padrão. Sem valores elegíveis, o resultado permanece zero."
    }
  },
  "python-intermediate-2": {
    concept: "Você já leu campos de um dicionário. Agora use uma chave para acumular vários itens. setdefault(chave, []) devolve a lista já guardada ou cria uma lista na primeira ocorrência da chave.",
    workedExample: "rotas = [(\"norte\", \"A\"), (\"sul\", \"B\"), (\"norte\", \"C\")]\ngrupos = {}\nfor zona, parada in rotas:\n    grupos.setdefault(zona, []).append(parada)\nprint(grupos)  # {\"norte\": [\"A\", \"C\"], \"sul\": [\"B\"]}",
    pitfall: "Atribuir grupos[zona] = [parada] a cada repetição substitui os itens anteriores daquela zona.",
    checkpoint: {
      question: "Se grupos[\"norte\"] já contém [\"A\"], o que acontece ao chamar grupos.setdefault(\"norte\", []).append(\"C\")?",
      options: [
        "A lista é substituída por [\"C\"]",
        "A lista existente passa a ser [\"A\", \"C\"]",
        "A chave é removida quando o valor padrão é []"
      ],
      correct: 1,
      explanation: "setdefault() devolve o valor que já existe. append() altera a mesma lista guardada na chave."
    }
  },
  "python-intermediate-3": {
    concept: "Ler um arquivo e interpretar JSON são passos diferentes. Path.read_text() lê bytes como texto, json.loads() interpreta a sintaxe, e isinstance() verifica se o resultado tem o tipo que a função promete.",
    workedExample: "import json\n\npreferencias = json.loads('[\"claro\", \"escuro\"]')\nprint(isinstance(preferencias, dict))  # False\n\nO texto é JSON válido, mas representa uma lista. Validade sintática e formato esperado são verificações separadas.",
    pitfall: "Capturar Exception engole falhas inesperadas. Trate os casos que seu contrato prevê, como arquivo ausente e JSON malformado.",
    checkpoint: {
      question: "O que json.loads(\"[]\") retorna?",
      options: [
        "Um dicionário vazio",
        "Uma lista vazia",
        "Um erro de JSON"
      ],
      correct: 1,
      explanation: "Os colchetes formam uma lista válida. Para exigir um dicionário, verifique o tipo após interpretar o texto."
    }
  },
  "python-intermediate-4": {
    concept: "Uma exceção interrompe o bloco try em que ocorreu. Ao pôr o try dentro do laço, você trata a conversão de um item e segue para o próximo. Guarde os casos válidos e inválidos em coleções diferentes.",
    workedExample: "for codigo in [\"12\", \"A7\", \"08\"]:\n    try:\n        print(int(codigo))\n    except ValueError:\n        print(\"Código inválido:\", codigo)\n\nA saída mostra 12, um aviso sobre A7 e depois 8.",
    pitfall: "Um try envolvendo todo o for transfere o controle para except na primeira falha e abandona os itens restantes daquele laço.",
    checkpoint: {
      question: "Qual posição do try permite continuar lendo itens depois de um ValueError?",
      options: [
        "Ao redor do for inteiro",
        "Depois de executar todas as conversões",
        "Dentro do for, ao redor da conversão de um item"
      ],
      correct: 2,
      explanation: "Ao tratar a exceção dentro do corpo do for, o programa termina a repetição atual e avança à seguinte."
    }
  },
  "python-intermediate-5": {
    concept: "Uma dataclass representa um objeto com campos nomeados. Métodos usam self para acessar os campos daquela instância. Valide a operação antes de mudar o estado para manter as regras do objeto em caso de erro.",
    workedExample: "from dataclasses import dataclass\n\n@dataclass\nclass Estoque:\n    unidades: int = 3\n\n    def retirar(self, quantidade):\n        if not 0 < quantidade <= self.unidades:\n            raise ValueError(\"Retirada inválida\")\n        self.unidades -= quantidade\n\nTentar retirar 5 deixa o estoque em 3.",
    pitfall: "Alterar o saldo e depois verificar se a operação era válida pode deixar um objeto inválido quando a exceção é levantada.",
    checkpoint: {
      question: "Em Estoque(unidades=3), qual é o estado depois de uma tentativa de retirar 5 e capturar o erro?",
      options: [
        "3, pois a validação falha antes da subtração",
        "-2, porque a exceção sempre acontece após a mudança",
        "0, porque levantar ValueError zera a instância"
      ],
      correct: 0,
      explanation: "A condição é verificada antes de self.unidades -= quantidade. Nenhuma alteração ocorre quando o método levanta ValueError."
    }
  },
  "python-advanced-1": {
    concept: "Um gerador suspende a execução em yield e entrega um valor de cada vez. islice() consome até um limite de itens de um iterador. Combine os dois para manter em memória só o lote atual.",
    workedExample: "from itertools import islice\n\norigem = iter([\"A\", \"B\", \"C\"])\nprint(list(islice(origem, 2)))  # [\"A\", \"B\"]\nprint(list(islice(origem, 2)))  # [\"C\"]\n\nAs duas leituras usam o mesmo iterador, que guarda a posição.",
    pitfall: "Recriar iter(iteravel) a cada lote a partir de uma lista reinicia a leitura e pode produzir sempre os mesmos itens.",
    checkpoint: {
      question: "O que acontece se você chamar islice(origem, 2) uma terceira vez no exemplo?",
      options: [
        "Volta a produzir [\"A\", \"B\"]",
        "Produz um iterador vazio",
        "Levanta IndexError porque faltam dois itens"
      ],
      correct: 1,
      explanation: "A origem foi esgotada. islice() devolve até o número pedido e termina normalmente se a fonte não tiver mais valores."
    }
  },
  "python-advanced-2": {
    concept: "Um decorador pode envolver uma função sem mudar as chamadas do programa. lru_cache() guarda resultados por argumentos. Em uma recursão com subproblemas repetidos, isso reaproveita cálculos. maxsize limita a quantidade de entradas recentes.",
    workedExample: "from functools import lru_cache\n\n@lru_cache(maxsize=2)\ndef quadrado(numero):\n    return numero * numero\n\nquadrado(5)\nquadrado(5)\nprint(quadrado.cache_info().hits)  # 1",
    pitfall: "O cache usa os argumentos como chaves, então eles precisam ser hasháveis. Evite cache em funções que dependem de estado externo variável ou têm efeitos necessários a cada chamada.",
    checkpoint: {
      question: "Em quadrado(5), quadrado(5), qual chamada calcula o resultado dentro da função?",
      options: [
        "Apenas a segunda",
        "As duas, porque maxsize é 2",
        "Apenas a primeira"
      ],
      correct: 2,
      explanation: "A primeira chamada registra o resultado para a chave 5. A segunda encontra essa chave no cache."
    }
  },
  "python-advanced-3": {
    concept: "Abrir o destino em modo de escrita costuma truncar o arquivo imediatamente. Prepare a nova versão em um temporário no mesmo diretório, feche o temporário e use os.replace() para trocar o nome somente depois de concluir a escrita. Use finally para cuidar da limpeza.",
    workedExample: "Imagine preferencias.json com {\"tema\": \"claro\"}. Escreva {\"tema\": \"escuro\"} em um temporário ao lado. Se a serialização falhar, descarte o temporário e mantenha o arquivo anterior. Se terminar, feche o temporário e substitua preferencias.json.",
    pitfall: "Um temporário em outro disco pode impedir a troca atômica. Fazer a substituição com o arquivo temporário aberto também pode falhar no Windows.",
    checkpoint: {
      question: "Se a serialização falhar antes de chamar os.replace(), qual arquivo deve continuar intacto?",
      options: [
        "O destino original",
        "Apenas o temporário",
        "Nenhum, pois criar um temporário já sobrescreve o destino"
      ],
      correct: 0,
      explanation: "A escrita foi feita num caminho separado. O destino só muda quando a operação de substituição é concluída."
    }
  },
  "python-advanced-4": {
    concept: "Uma corrotina cede a vez quando usa await em uma espera assíncrona. Semaphore(n) limita quantas corrotinas entram na região protegida ao mesmo tempo. gather() espera pelo conjunto e entrega resultados na ordem das entradas.",
    workedExample: "limite = asyncio.Semaphore(2)\n\nasync def preparar(relatorio):\n    async with limite:\n        await asyncio.sleep(0.1)\n        return relatorio\n\nSe quatro relatórios são solicitados juntos, até dois estarão dentro do bloco protegido.",
    pitfall: "time.sleep() bloqueia a thread do loop de eventos. Use await asyncio.sleep() para permitir que outras corrotinas avancem.",
    checkpoint: {
      question: "Se gather() recebe tarefas A, B e C, e C termina antes de A, em que ordem os resultados são retornados?",
      options: [
        "C, A, B, seguindo a ordem de conclusão",
        "A, B, C, seguindo a ordem dos argumentos",
        "Em ordem aleatória, a menos que o semáforo valha 1"
      ],
      correct: 1,
      explanation: "gather() mantém a ordem dos argumentos. O semáforo controla o acesso à região, não ordena a lista de resultados."
    }
  },
  "python-advanced-5": {
    concept: "Separe a regra de negócio numa função que recebe dados e retorna um valor. Teste entradas comuns, limites e entradas rejeitadas. Em unittest, assertRaises() verifica que uma operação inválida realmente falha.",
    workedExample: "def frete(peso):\n    if peso < 0:\n        raise ValueError(\"Peso inválido\")\n    return 0 if peso == 0 else 10\n\nNo teste, use self.assertEqual(frete(0), 0) para o limite e with self.assertRaises(ValueError): frete(-1) para a rejeição.",
    pitfall: "Um teste que apenas chama a função pode passar com qualquer resultado. Escreva a saída ou a exceção que você espera.",
    checkpoint: {
      question: "Qual ferramenta de unittest verifica que um percentual inválido levanta ValueError?",
      options: [
        "assertEqual(resultado, ValueError)",
        "assertAlmostEqual(resultado, ValueError)",
        "assertRaises(ValueError)"
      ],
      correct: 2,
      explanation: "assertRaises() observa a execução e falha se o bloco terminar normalmente ou levantar uma exceção de outro tipo."
    }
  }
}
