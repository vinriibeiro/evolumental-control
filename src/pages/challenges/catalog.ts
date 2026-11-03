export type ChallengeTrack = 'python' | 'sql' | 'git'
export type ChallengeLevel = 'first_steps' | 'basic' | 'intermediate' | 'advanced'

export interface Challenge {
  id: string
  track: ChallengeTrack
  level: ChallengeLevel
  title: string
  prompt: string
  starter: string
  hints: string[]
  solution: string
  criteria: string[]
}

export const TRACKS: Array<{ value: ChallengeTrack; label: string; description: string }> = [
  { value: 'python', label: 'Python', description: 'Do primeiro print a programas com testes e concorrência.' },
  { value: 'sql', label: 'SQL', description: 'De um SELECT a consultas analíticas e transações.' },
  { value: 'git', label: 'Git', description: 'Do primeiro commit a fluxos seguros de colaboração.' },
]

export const LEVELS: Array<{ value: ChallengeLevel; label: string }> = [
  { value: 'first_steps', label: 'Primeiros passos' },
  { value: 'basic', label: 'Básico' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
]

/** Catálogo autoral e determinístico. Todo código é material de estudo, sem execução no app. */
export const CHALLENGES: Challenge[] = [
  {
    "id": "python-first_steps-1",
    "track": "python",
    "level": "first_steps",
    "title": "Seu primeiro bom dia",
    "prompt": "Pratique em Python 3 no seu computador.\n\nMostre exatamente Bom dia! na tela. Não é necessário receber nenhuma entrada.",
    "starter": "# Escreva sua primeira mensagem aqui\n",
    "hints": [
      "Use a função print().",
      "O texto deve ficar entre aspas."
    ],
    "solution": "print(\"Bom dia!\")  # print mostra uma mensagem no terminal.\n",
    "criteria": [
      "O programa executa sem erro.",
      "A saída é exatamente: Bom dia!"
    ]
  },
  {
    "id": "python-first_steps-2",
    "track": "python",
    "level": "first_steps",
    "title": "Qual é o seu nome?",
    "prompt": "Pratique em Python 3 no seu computador.\n\nPeça o nome da pessoa e responda: Olá, Ana! Prazer em conhecer você. Troque Ana pelo nome informado.",
    "starter": "# Leia o nome e monte a saudação\n",
    "hints": [
      "input() devolve o texto digitado.",
      "Guarde o resultado em nome e use uma f-string."
    ],
    "solution": "nome = input(\"Qual é o seu nome? \")\nprint(f\"Olá, {nome}! Prazer em conhecer você.\")  # f-string insere a variável no texto.\n",
    "criteria": [
      "O nome é pedido ao usuário.",
      "A saudação usa o nome digitado."
    ]
  },
  {
    "id": "python-first_steps-3",
    "track": "python",
    "level": "first_steps",
    "title": "Uma história em três capítulos",
    "prompt": "Pratique em Python 3 no seu computador.\n\nConte uma história curta em três partes. Mostre a primeira parte, espere a pessoa pressionar Enter e só então mostre a segunda. Espere outro Enter antes do final.",
    "starter": "# Sua história começa aqui\n",
    "hints": [
      "input() também pode ser usado apenas para esperar Enter.",
      "Alterne print(), input(), print(), input(), print()."
    ],
    "solution": "print(\"Lia encontrou uma chave no jardim.\")\ninput(\"Pressione Enter para continuar...\")  # Aguarda a pessoa antes de continuar.\nprint(\"A chave abriu uma pequena caixa de madeira.\")\ninput(\"Pressione Enter para ver o final...\")\nprint(\"Dentro havia um mapa para a próxima aventura!\")\n",
    "criteria": [
      "A história tem três partes.",
      "Existem duas pausas, antes das partes seguintes."
    ]
  },
  {
    "id": "python-first_steps-4",
    "track": "python",
    "level": "first_steps",
    "title": "Descubra a raiz quadrada",
    "prompt": "Pratique em Python 3 no seu computador.\n\nReceba um número não negativo e mostre sua raiz quadrada. Para este primeiro exercício, considere que a entrada é válida. Exemplo: 25 → 5.0.",
    "starter": "# Importe sqrt e leia o número\n",
    "hints": [
      "A função está no módulo math.",
      "Converta o texto de input() com float()."
    ],
    "solution": "from math import sqrt\n\nnumero = float(input(\"Digite um número não negativo: \"))\nprint(sqrt(numero))  # sqrt calcula a raiz; float permite números decimais.\n",
    "criteria": [
      "A entrada é convertida para número.",
      "25 produz 5.0 e 0 produz 0.0."
    ]
  },
  {
    "id": "python-first_steps-5",
    "track": "python",
    "level": "first_steps",
    "title": "O dobro de um número",
    "prompt": "Pratique em Python 3 no seu computador.\n\nPeça um número e mostre o dobro. Experimente 7, 0 e -3; os resultados devem ser 14, 0 e -6 (com ou sem .0).",
    "starter": "# Leia um número e multiplique por dois\n",
    "hints": [
      "input() devolve texto; converta antes de multiplicar.",
      "Use o operador *."
    ],
    "solution": "numero = float(input(\"Digite um número: \"))\ndobro = numero * 2  # Multiplicação numérica, sem repetir uma string.\nprint(dobro)\n",
    "criteria": [
      "O resultado é numérico.",
      "Os três exemplos produzem o dobro correto."
    ]
  },
  {
    "id": "python-basic-1",
    "track": "python",
    "level": "basic",
    "title": "Par ou ímpar",
    "prompt": "Pratique em Python 3 no seu computador.\n\nLeia um inteiro e informe Par ou Ímpar. Zero deve ser par.",
    "starter": "# Leia um inteiro e verifique o resto da divisão\n",
    "hints": [
      "Use o operador de resto %.",
      "Uma condição if/else escolhe a mensagem."
    ],
    "solution": "numero = int(input(\"Inteiro: \"))\nif numero % 2 == 0:  # Resto zero significa divisibilidade por 2.\n    print(\"Par\")\nelse:\n    print(\"Ímpar\")\n",
    "criteria": [
      "0 e 8 são pares.",
      "-3 e 7 são ímpares."
    ]
  },
  {
    "id": "python-basic-2",
    "track": "python",
    "level": "basic",
    "title": "Some de 1 até N",
    "prompt": "Pratique em Python 3 no seu computador.\n\nReceba um inteiro N >= 1. Use um laço para somar os números de 1 até N, incluindo N. Para N=5, mostre 15.",
    "starter": "# Use um acumulador e um for\n",
    "hints": [
      "Comece o acumulador em zero.",
      "range(1, n + 1) inclui o N."
    ],
    "solution": "n = int(input(\"N (>= 1): \"))\ntotal = 0\nfor numero in range(1, n + 1):  # O limite final de range não é incluído.\n    total += numero\nprint(total)\n",
    "criteria": [
      "Usa um laço.",
      "N=1 produz 1; N=5 produz 15."
    ]
  },
  {
    "id": "python-basic-3",
    "track": "python",
    "level": "basic",
    "title": "A média da turma",
    "prompt": "Pratique em Python 3 no seu computador.\n\nDada a lista [7.5, 8.0, 6.5, 10.0], calcule e imprima a média com duas casas decimais. Não altere os valores.",
    "starter": "notas = [7.5, 8.0, 6.5, 10.0]\n# Calcule a média\n",
    "hints": [
      "sum() soma uma lista e len() conta os itens.",
      "O formato :.2f mostra duas casas."
    ],
    "solution": "notas = [7.5, 8.0, 6.5, 10.0]\nmedia = sum(notas) / len(notas)  # Soma dividida pela quantidade.\nprint(f\"{media:.2f}\")\n",
    "criteria": [
      "A média é 8.00.",
      "A lista original é preservada."
    ]
  },
  {
    "id": "python-basic-4",
    "track": "python",
    "level": "basic",
    "title": "Conte as vogais",
    "prompt": "Pratique em Python 3 no seu computador.\n\nReceba uma frase e conte as letras a, e, i, o, u sem diferenciar maiúsculas. Neste exercício, letras acentuadas não contam. \"Ola mundo\" contém 4 vogais.",
    "starter": "# Percorra o texto em minúsculas\n",
    "hints": [
      "Use lower() para normalizar o texto.",
      "Teste cada letra com in \"aeiou\"."
    ],
    "solution": "frase = input(\"Frase: \")\ntotal = 0\nfor letra in frase.lower():  # Normaliza maiúsculas antes de comparar.\n    if letra in \"aeiou\":\n        total += 1\nprint(total)\n",
    "criteria": [
      "Ola mundo retorna 4.",
      "Texto vazio retorna 0.",
      "Consoantes e espaços não são contados."
    ]
  },
  {
    "id": "python-basic-5",
    "track": "python",
    "level": "basic",
    "title": "Sua primeira função",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie celsius_para_fahrenheit(celsius), que retorna celsius * 9 / 5 + 32. Mostre os resultados para 0 e 100. A função deve retornar o valor, sem pedir entrada.",
    "starter": "def celsius_para_fahrenheit(celsius):\n    # Retorne a conversão\n    pass\n",
    "hints": [
      "Defina um parâmetro celsius.",
      "Use return dentro da função e print fora dela."
    ],
    "solution": "def celsius_para_fahrenheit(celsius):\n    return celsius * 9 / 5 + 32  # Retornar permite reutilizar o resultado.\n\nprint(celsius_para_fahrenheit(0))\nprint(celsius_para_fahrenheit(100))\n",
    "criteria": [
      "0 retorna 32 e 100 retorna 212.",
      "A função pode ser chamada com outros números."
    ]
  },
  {
    "id": "python-intermediate-1",
    "track": "python",
    "level": "intermediate",
    "title": "Pedidos aprovados",
    "prompt": "Pratique em Python 3 no seu computador.\n\nImplemente total_aprovado(pedidos). Cada pedido tem status e valor. Some apenas os valores com status \"aprovado\". Uma lista vazia retorna 0. Exemplo: aprovado/20, cancelado/50, aprovado/30 → 50.",
    "starter": "def total_aprovado(pedidos):\n    pass\n",
    "hints": [
      "Filtre pelo campo status.",
      "sum() com expressão geradora devolve zero para lista vazia."
    ],
    "solution": "def total_aprovado(pedidos):\n    # A expressão geradora filtra antes de somar.\n    return sum(p[\"valor\"] for p in pedidos if p[\"status\"] == \"aprovado\")\n\nprint(total_aprovado([{\"status\": \"aprovado\", \"valor\": 20}, {\"status\": \"cancelado\", \"valor\": 50}, {\"status\": \"aprovado\", \"valor\": 30}]))\n",
    "criteria": [
      "O exemplo retorna 50.",
      "Pedidos cancelados são ignorados.",
      "A entrada não é modificada."
    ]
  },
  {
    "id": "python-intermediate-2",
    "track": "python",
    "level": "intermediate",
    "title": "Agrupe por categoria",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie agrupar(itens), devolvendo um dicionário categoria → lista de nomes. Preserve a ordem de entrada dentro de cada categoria. Exemplo: (\"fruta\",\"maçã\"), (\"livro\",\"Python\"), (\"fruta\",\"banana\").",
    "starter": "def agrupar(itens):\n    pass\n",
    "hints": [
      "O dicionário guarda uma lista por categoria.",
      "setdefault() ajuda a criar a lista inicial."
    ],
    "solution": "def agrupar(itens):\n    grupos = {}\n    for categoria, nome in itens:\n        grupos.setdefault(categoria, []).append(nome)  # Cria uma lista apenas quando necessário.\n    return grupos\n\nprint(agrupar([(\"fruta\", \"maçã\"), (\"livro\", \"Python\"), (\"fruta\", \"banana\")]))\n",
    "criteria": [
      "fruta contém maçã e banana nessa ordem.",
      "Entrada vazia devolve {}."
    ]
  },
  {
    "id": "python-intermediate-3",
    "track": "python",
    "level": "intermediate",
    "title": "Leia configurações com segurança",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie carregar_config(caminho): leia um JSON UTF-8 e retorne um dicionário. Se o arquivo não existir ou contiver JSON inválido, retorne {}. Se o JSON válido não for um objeto, retorne {}. Não oculte outros erros de acesso.",
    "starter": "def carregar_config(caminho):\n    pass\n",
    "hints": [
      "Use pathlib e json.loads().",
      "Capture somente as duas exceções especificadas."
    ],
    "solution": "import json\nfrom pathlib import Path\n\ndef carregar_config(caminho):\n    try:\n        dados = json.loads(Path(caminho).read_text(encoding=\"utf-8\"))\n    except (FileNotFoundError, json.JSONDecodeError):\n        return {}  # Falhas esperadas possuem uma resposta definida.\n    return dados if isinstance(dados, dict) else {}\n",
    "criteria": [
      "Lê um objeto JSON válido.",
      "Arquivo ausente, JSON inválido e JSON [] retornam {}.",
      "Outros erros de acesso continuam visíveis."
    ]
  },
  {
    "id": "python-intermediate-4",
    "track": "python",
    "level": "intermediate",
    "title": "Valide sem interromper tudo",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie converter_inteiros(valores): receba strings e retorne (numeros, invalidos). Preserve a ordem. [\"10\",\"x\",\"-2\",\"3.5\"] deve resultar em ([10,-2],[\"x\",\"3.5\"]).",
    "starter": "def converter_inteiros(valores):\n    pass\n",
    "hints": [
      "Converta cada item separadamente.",
      "Capture ValueError dentro do laço."
    ],
    "solution": "def converter_inteiros(valores):\n    numeros, invalidos = [], []\n    for valor in valores:\n        try:\n            numeros.append(int(valor))\n        except ValueError:  # Um item ruim não interrompe os outros.\n            invalidos.append(valor)\n    return numeros, invalidos\n",
    "criteria": [
      "O exemplo produz a tupla esperada.",
      "Um valor inválido não interrompe a conversão dos demais."
    ]
  },
  {
    "id": "python-intermediate-5",
    "track": "python",
    "level": "intermediate",
    "title": "Uma conta com regras",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie uma dataclass Conta com saldo inicial 0. Métodos depositar e sacar devem aceitar valores positivos; sacar não pode ultrapassar o saldo. Use ValueError em operações inválidas e mantenha o saldo anterior.",
    "starter": "from dataclasses import dataclass\n\n@dataclass\nclass Conta:\n    saldo: float = 0.0\n    # Implemente os métodos\n",
    "hints": [
      "Valide antes de alterar saldo.",
      "raise ValueError comunica uma operação inválida."
    ],
    "solution": "from dataclasses import dataclass\n\n@dataclass\nclass Conta:\n    saldo: float = 0.0\n\n    def depositar(self, valor):\n        if valor <= 0:\n            raise ValueError(\"O depósito deve ser positivo\")\n        self.saldo += valor\n\n    def sacar(self, valor):\n        # Valide antes de alterar qualquer estado.\n        if valor <= 0 or valor > self.saldo:\n            raise ValueError(\"Saque inválido\")\n        self.saldo -= valor\n",
    "criteria": [
      "Depositar 100 e sacar 30 deixa saldo 70.",
      "Depósito zero e saque maior que saldo falham.",
      "Falhas não alteram o saldo."
    ]
  },
  {
    "id": "python-advanced-1",
    "track": "python",
    "level": "advanced",
    "title": "Processe em lotes",
    "prompt": "Pratique em Python 3 no seu computador.\n\nImplemente lotes(iteravel, tamanho), um gerador que consome qualquer iterável em grupos de até tamanho itens. Não carregue a entrada toda em memória. O último lote pode ser menor. Tamanho <= 0 deve gerar ValueError.",
    "starter": "def lotes(iteravel, tamanho):\n    pass\n",
    "hints": [
      "Transforme a entrada em iterador uma única vez.",
      "islice() e yield permitem trabalhar sob demanda."
    ],
    "solution": "from itertools import islice\n\ndef lotes(iteravel, tamanho):\n    if tamanho <= 0:\n        raise ValueError(\"Tamanho deve ser positivo\")\n    origem = iter(iteravel)\n    while True:\n        lote = list(islice(origem, tamanho))  # Consome somente o próximo lote.\n        if not lote:\n            return\n        yield lote\n\nprint(list(lotes(range(7), 3)))  # [[0,1,2], [3,4,5], [6]]\n",
    "criteria": [
      "range(7),3 gera três lotes conforme exemplo.",
      "Entrada vazia não gera lotes.",
      "Não converte a entrada inteira em lista."
    ]
  },
  {
    "id": "python-advanced-2",
    "track": "python",
    "level": "advanced",
    "title": "Cache com limites",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie fibonacci(n) com functools.lru_cache(maxsize=128). Use a definição F(0)=0, F(1)=1 e rejeite n negativo com ValueError. Exiba fibonacci(30) e as estatísticas do cache.",
    "starter": "# Use lru_cache para memorizar os subproblemas\n",
    "hints": [
      "O decorator precisa ficar acima da função.",
      "Casos-base impedem recursão infinita."
    ],
    "solution": "from functools import lru_cache\n\n@lru_cache(maxsize=128)\ndef fibonacci(n):\n    if n < 0:\n        raise ValueError(\"n deve ser não negativo\")\n    if n < 2:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nprint(fibonacci(30))  # 832040\nprint(fibonacci.cache_info())  # Demonstra o reaproveitamento dos resultados.\n",
    "criteria": [
      "fibonacci(30) é 832040.",
      "Argumento negativo falha.",
      "O cache possui limite 128 e registra acertos."
    ]
  },
  {
    "id": "python-advanced-3",
    "track": "python",
    "level": "advanced",
    "title": "Escrita com substituição atômica",
    "prompt": "Pratique em Python 3 no seu computador.\n\nCrie salvar_json(caminho, dados) para um diretório já existente: escreva UTF-8 em arquivo temporário no mesmo diretório e use os.replace para substituir o destino somente após sucesso. Remova o temporário em caso de erro. Execute apenas com arquivos de treino.",
    "starter": "def salvar_json(caminho, dados):\n    pass\n",
    "hints": [
      "O temporário precisa estar no mesmo diretório.",
      "Use finally para a limpeza e feche o arquivo antes de substituir."
    ],
    "solution": "import json\nimport os\nimport tempfile\nfrom pathlib import Path\n\ndef salvar_json(caminho, dados):\n    destino = Path(caminho)\n    temporario = None\n    try:\n        with tempfile.NamedTemporaryFile(mode=\"w\", encoding=\"utf-8\", dir=destino.parent, delete=False) as arquivo:\n            temporario = Path(arquivo.name)\n            json.dump(dados, arquivo, ensure_ascii=False)\n            arquivo.flush()\n            os.fsync(arquivo.fileno())\n        os.replace(temporario, destino)  # Mesmo sistema de arquivos: substituição atômica.\n    finally:\n        if temporario is not None:\n            temporario.unlink(missing_ok=True)\n",
    "criteria": [
      "JSON inválido para serialização preserva o destino anterior.",
      "O arquivo final usa UTF-8.",
      "Temporários são limpos mesmo se houver falha."
    ]
  },
  {
    "id": "python-advanced-4",
    "track": "python",
    "level": "advanced",
    "title": "Concorrência com limite",
    "prompt": "Pratique em Python 3 no seu computador.\n\nUse asyncio para executar cinco tarefas de treino que esperam 0.1 segundo e retornam o dobro de um número. Limite a duas tarefas simultâneas com Semaphore e preserve a ordem dos resultados. Não faça chamadas à rede.",
    "starter": "# Implemente as tarefas e o limite de concorrência\n",
    "hints": [
      "async with Semaphore controla a região concorrente.",
      "asyncio.gather() reúne os resultados na ordem informada."
    ],
    "solution": "import asyncio\n\nasync def principal():\n    limite = asyncio.Semaphore(2)\n\n    async def dobro(numero):\n        async with limite:\n            await asyncio.sleep(0.1)  # Simula espera sem bloquear o event loop.\n            return numero * 2\n\n    resultados = await asyncio.gather(*(dobro(n) for n in range(5)))\n    print(resultados)  # gather preserva a ordem de entrada.\n\nasyncio.run(principal())\n",
    "criteria": [
      "O resultado é [0,2,4,6,8].",
      "Há no máximo duas tarefas dentro da região limitada.",
      "Não usa time.sleep() nem rede."
    ]
  },
  {
    "id": "python-advanced-5",
    "track": "python",
    "level": "advanced",
    "title": "Teste uma regra de desconto",
    "prompt": "Pratique em Python 3 no seu computador.\n\nImplemente aplicar_desconto(valor, percentual), com valor >= 0 e percentual entre 0 e 100. Rejeite entradas fora desses limites com ValueError. Escreva testes unittest para desconto normal, zero, total e dois casos inválidos.",
    "starter": "# Escreva a função e os testes em um arquivo de treino\n",
    "hints": [
      "Use assertAlmostEqual() para resultados decimais.",
      "assertRaises() verifica falhas esperadas."
    ],
    "solution": "import unittest\n\ndef aplicar_desconto(valor, percentual):\n    if valor < 0 or not 0 <= percentual <= 100:\n        raise ValueError(\"Valor ou percentual inválido\")\n    return valor * (1 - percentual / 100)\n\nclass TestDesconto(unittest.TestCase):\n    def test_normal(self):\n        self.assertAlmostEqual(aplicar_desconto(200, 15), 170)\n\n    def test_limites(self):\n        self.assertEqual(aplicar_desconto(50, 0), 50)\n        self.assertEqual(aplicar_desconto(50, 100), 0)\n\n    def test_invalidos(self):\n        for valor, percentual in [(-1, 10), (100, 101)]:\n            with self.subTest(valor=valor, percentual=percentual):\n                with self.assertRaises(ValueError):\n                    aplicar_desconto(valor, percentual)\n\nif __name__ == \"__main__\":\n    unittest.main()  # Execute este arquivo para rodar os testes.\n",
    "criteria": [
      "Todos os cenários exigidos têm teste.",
      "Erros não são engolidos.",
      "Os testes passam no ambiente do aluno."
    ]
  },
  {
    "id": "sql-first_steps-1",
    "track": "sql",
    "level": "first_steps",
    "title": "Veja sua primeira tabela",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT, idade INTEGER, cidade TEXT);\nINSERT INTO pessoas VALUES\n(1,'Ana',22,'Brasília'), (2,'Bruno',17,'Recife'), (3,'Carla',35,'Brasília'),\n(4,'Diego',28,'Recife'), (5,'Eva',19,'Salvador');\n\nTarefa\nListe todas as colunas e linhas de pessoas, ordenadas por id.",
    "starter": "-- Escreva seu SELECT\n",
    "hints": [
      "SELECT lê os dados.",
      "Use FROM pessoas e ORDER BY id."
    ],
    "solution": "-- * seleciona todas as colunas; ORDER BY torna a ordem explícita.\nSELECT * FROM pessoas ORDER BY id;",
    "criteria": [
      "Retorna cinco linhas.",
      "A primeira pessoa é Ana e a última é Eva."
    ]
  },
  {
    "id": "sql-first_steps-2",
    "track": "sql",
    "level": "first_steps",
    "title": "Escolha as colunas",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT, idade INTEGER, cidade TEXT);\nINSERT INTO pessoas VALUES\n(1,'Ana',22,'Brasília'), (2,'Bruno',17,'Recife'), (3,'Carla',35,'Brasília'),\n(4,'Diego',28,'Recife'), (5,'Eva',19,'Salvador');\n\nTarefa\nMostre apenas nome e cidade, nessa ordem de colunas, ordenando por id.",
    "starter": "SELECT -- escolha as colunas\n",
    "hints": [
      "Separe os nomes das colunas com vírgula.",
      "Não use * nesta consulta."
    ],
    "solution": "-- Escolher colunas evita trazer dados desnecessários.\nSELECT nome, cidade FROM pessoas ORDER BY id;",
    "criteria": [
      "Apenas nome e cidade são retornados.",
      "As cinco pessoas aparecem."
    ]
  },
  {
    "id": "sql-first_steps-3",
    "track": "sql",
    "level": "first_steps",
    "title": "Encontre uma pessoa",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT, idade INTEGER, cidade TEXT);\nINSERT INTO pessoas VALUES\n(1,'Ana',22,'Brasília'), (2,'Bruno',17,'Recife'), (3,'Carla',35,'Brasília'),\n(4,'Diego',28,'Recife'), (5,'Eva',19,'Salvador');\n\nTarefa\nBusque a pessoa cujo nome é exatamente Ana. Retorne id, nome e idade.",
    "starter": "-- Use WHERE para filtrar\n",
    "hints": [
      "Use WHERE nome = ...",
      "O texto Ana precisa de aspas simples."
    ],
    "solution": "-- Textos SQL usam aspas simples.\nSELECT id, nome, idade FROM pessoas WHERE nome = 'Ana';",
    "criteria": [
      "Retorna apenas Ana.",
      "A idade retornada é 22."
    ]
  },
  {
    "id": "sql-first_steps-4",
    "track": "sql",
    "level": "first_steps",
    "title": "Organize por idade",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT, idade INTEGER, cidade TEXT);\nINSERT INTO pessoas VALUES\n(1,'Ana',22,'Brasília'), (2,'Bruno',17,'Recife'), (3,'Carla',35,'Brasília'),\n(4,'Diego',28,'Recife'), (5,'Eva',19,'Salvador');\n\nTarefa\nRetorne nome e idade da pessoa mais velha para a mais nova. Em empate, ordene por nome.",
    "starter": "-- Ordene sem modificar a tabela\n",
    "hints": [
      "ORDER BY permite várias colunas.",
      "Use DESC na idade."
    ],
    "solution": "-- DESC inverte a ordem; a segunda chave resolve empates.\nSELECT nome, idade FROM pessoas ORDER BY idade DESC, nome ASC;",
    "criteria": [
      "Carla aparece primeiro.",
      "Bruno aparece por último."
    ]
  },
  {
    "id": "sql-first_steps-5",
    "track": "sql",
    "level": "first_steps",
    "title": "Conte as pessoas",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT, idade INTEGER, cidade TEXT);\nINSERT INTO pessoas VALUES\n(1,'Ana',22,'Brasília'), (2,'Bruno',17,'Recife'), (3,'Carla',35,'Brasília'),\n(4,'Diego',28,'Recife'), (5,'Eva',19,'Salvador');\n\nTarefa\nRetorne a quantidade total de pessoas com a coluna chamada total_pessoas.",
    "starter": "-- Faça uma contagem\n",
    "hints": [
      "Use COUNT(*).",
      "AS cria o alias total_pessoas."
    ],
    "solution": "-- COUNT(*) conta as linhas; AS define um nome para o resultado.\nSELECT COUNT(*) AS total_pessoas FROM pessoas;",
    "criteria": [
      "Retorna uma linha e uma coluna.",
      "total_pessoas é 5."
    ]
  },
  {
    "id": "sql-basic-1",
    "track": "sql",
    "level": "basic",
    "title": "Combine condições",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nListe nome e estoque de produtos da categoria Informática com estoque maior que zero. Ordene por nome.",
    "starter": "-- Combine dois filtros\n",
    "hints": [
      "Use AND.",
      "O produto sem estoque deve ficar de fora."
    ],
    "solution": "-- AND exige que as duas condições sejam verdadeiras.\nSELECT nome, estoque FROM produtos\nWHERE categoria = 'Informática' AND estoque > 0\nORDER BY nome;",
    "criteria": [
      "Retorna apenas Teclado, com estoque 4."
    ]
  },
  {
    "id": "sql-basic-2",
    "track": "sql",
    "level": "basic",
    "title": "Valores calculados",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nMostre nome e valor_estoque_centavos (preço × estoque), do maior valor para o menor; em empate, por id.",
    "starter": "-- Crie uma coluna calculada\n",
    "hints": [
      "Multiplique as duas colunas.",
      "O alias pode ser usado em ORDER BY."
    ],
    "solution": "-- Todos os valores são inteiros em centavos, sem arredondamento monetário.\nSELECT nome, preco_centavos * estoque AS valor_estoque_centavos\nFROM produtos ORDER BY valor_estoque_centavos DESC, id;",
    "criteria": [
      "Teclado tem 60000 centavos em estoque.",
      "Mouse tem valor zero e aparece por último."
    ]
  },
  {
    "id": "sql-basic-3",
    "track": "sql",
    "level": "basic",
    "title": "Resuma por categoria",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nRetorne categoria e quantidade_produtos para cada categoria, ordenando pelo nome da categoria.",
    "starter": "-- Agrupe os produtos\n",
    "hints": [
      "COUNT(*) passa a contar dentro de cada grupo.",
      "Use GROUP BY categoria."
    ],
    "solution": "-- GROUP BY forma um grupo por categoria.\nSELECT categoria, COUNT(*) AS quantidade_produtos\nFROM produtos GROUP BY categoria ORDER BY categoria;",
    "criteria": [
      "Há três categorias.",
      "Papelaria e Informática têm dois produtos cada."
    ]
  },
  {
    "id": "sql-basic-4",
    "track": "sql",
    "level": "basic",
    "title": "Filtre grupos",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nMostre apenas categorias com mais de um produto, com categoria e quantidade_produtos, em ordem alfabética.",
    "starter": "-- Filtre o resultado agregado\n",
    "hints": [
      "Use HAVING depois de GROUP BY.",
      "A categoria Livros não deve aparecer."
    ],
    "solution": "-- HAVING filtra grupos; WHERE filtraria linhas antes de agrupar.\nSELECT categoria, COUNT(*) AS quantidade_produtos\nFROM produtos GROUP BY categoria HAVING COUNT(*) > 1 ORDER BY categoria;",
    "criteria": [
      "Retorna Informática e Papelaria.",
      "Ambas as contagens são 2."
    ]
  },
  {
    "id": "sql-basic-5",
    "track": "sql",
    "level": "basic",
    "title": "Busque parte de um nome",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nRetorne id e nome dos produtos cujo nome começa com C, ordenados por id.",
    "starter": "-- Use um padrão com LIKE\n",
    "hints": [
      "LIKE permite um padrão textual.",
      "O padrão é C seguido de %."
    ],
    "solution": "-- % representa qualquer sequência depois do prefixo.\nSELECT id, nome FROM produtos WHERE nome LIKE 'C%' ORDER BY id;",
    "criteria": [
      "Retorna Caderno e Caneta.",
      "Não altera os produtos."
    ]
  },
  {
    "id": "sql-intermediate-1",
    "track": "sql",
    "level": "intermediate",
    "title": "Sua primeira junção",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nListe id do pedido, nome do cliente e total_centavos de todos os pedidos pagos. Ordene pelo id do pedido.",
    "starter": "-- Relacione clientes e pedidos\n",
    "hints": [
      "Use JOIN ... ON.",
      "Filtre status após relacionar as tabelas."
    ],
    "solution": "-- A relação usa a chave do cliente, não o texto do nome.\nSELECT p.id, c.nome, p.total_centavos\nFROM pedidos AS p JOIN clientes AS c ON c.id = p.cliente_id\nWHERE p.status = 'pago' ORDER BY p.id;",
    "criteria": [
      "Retorna cinco pedidos pagos.",
      "O pedido 4 é excluído."
    ]
  },
  {
    "id": "sql-intermediate-2",
    "track": "sql",
    "level": "intermediate",
    "title": "Quem ainda não comprou?",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nEncontre clientes sem nenhum pedido, incluindo cancelados como pedidos existentes. Retorne id e nome, em ordem de id.",
    "starter": "-- Preserve quem não possui relação\n",
    "hints": [
      "Use LEFT JOIN e IS NULL.",
      "Não filtre pelo status nesta tarefa."
    ],
    "solution": "-- LEFT JOIN preserva o cliente; p.id nulo indica falta de correspondência.\nSELECT c.id, c.nome FROM clientes AS c\nLEFT JOIN pedidos AS p ON p.cliente_id = c.id\nWHERE p.id IS NULL ORDER BY c.id;",
    "criteria": [
      "Somente Diego é retornado."
    ]
  },
  {
    "id": "sql-intermediate-3",
    "track": "sql",
    "level": "intermediate",
    "title": "Total pago de cada cliente",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nRetorne todos os clientes com total_pago_centavos, inclusive clientes sem pagamentos com zero. Ordene pelo id do cliente.",
    "starter": "-- Cuidado para manter clientes sem pedidos\n",
    "hints": [
      "O filtro de pago deve ficar no ON.",
      "Use COALESCE(SUM(...), 0)."
    ],
    "solution": "-- O filtro no ON mantém os clientes; COALESCE converte a ausência de soma em zero.\nSELECT c.nome, COALESCE(SUM(p.total_centavos), 0) AS total_pago_centavos\nFROM clientes AS c LEFT JOIN pedidos AS p\nON p.cliente_id = c.id AND p.status = 'pago'\nGROUP BY c.id, c.nome ORDER BY c.id;",
    "criteria": [
      "Ana:15000, Bruno:20000, Carla:20000, Diego:0.",
      "O pedido cancelado não entra na soma."
    ]
  },
  {
    "id": "sql-intermediate-4",
    "track": "sql",
    "level": "intermediate",
    "title": "Acima da média",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nSelecione os pedidos pagos com total_centavos estritamente acima da média dos próprios pedidos pagos. Retorne id e total_centavos em ordem de id.",
    "starter": "-- Uma subconsulta pode calcular a média\n",
    "hints": [
      "A média dos pagos é 11000 centavos.",
      "Use uma subconsulta escalar com AVG()."
    ],
    "solution": "-- A média considera o mesmo conjunto de pedidos pagos da consulta externa.\nSELECT id, total_centavos FROM pedidos\nWHERE status = 'pago' AND total_centavos > (\n  SELECT AVG(total_centavos) FROM pedidos WHERE status = 'pago'\n) ORDER BY id;",
    "criteria": [
      "Retorna pedidos 3 e 5.",
      "Pedidos cancelados são ignorados na média e no resultado."
    ]
  },
  {
    "id": "sql-intermediate-5",
    "track": "sql",
    "level": "intermediate",
    "title": "Analise por mês",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nRetorne mes (AAAA-MM), quantidade e total_centavos dos pedidos pagos em cada mês, em ordem cronológica.",
    "starter": "-- SQLite usa strftime para extrair o mês\n",
    "hints": [
      "Use strftime('%Y-%m', data).",
      "Agrupe depois de filtrar os pagos."
    ],
    "solution": "-- Datas no formato ISO permitem agrupamento mensal previsível.\nSELECT strftime('%Y-%m', data) AS mes, COUNT(*) AS quantidade,\n       SUM(total_centavos) AS total_centavos\nFROM pedidos WHERE status = 'pago'\nGROUP BY strftime('%Y-%m', data) ORDER BY mes;",
    "criteria": [
      "Janeiro:3 pedidos e 35000 centavos.",
      "Fevereiro:2 pedidos e 20000 centavos."
    ]
  },
  {
    "id": "sql-advanced-1",
    "track": "sql",
    "level": "advanced",
    "title": "Ranking sem perder empates",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nCom uma CTE, some os pagamentos por cliente e classifique do maior total para o menor usando DENSE_RANK. Clientes sem pagamento ficam de fora. Retorne nome, total_pago_centavos e posicao; desempate a exibição pelo nome.",
    "starter": "-- CTE + função de janela\n",
    "hints": [
      "Agregue na CTE antes de ranquear.",
      "DENSE_RANK preserva o empate entre Bruno e Carla."
    ],
    "solution": "-- DENSE_RANK dá a mesma posição para totais iguais, sem pular a próxima.\nWITH totais AS (\n SELECT c.nome, SUM(p.total_centavos) AS total_pago_centavos\n FROM clientes c JOIN pedidos p ON p.cliente_id = c.id\n WHERE p.status = 'pago' GROUP BY c.id, c.nome\n)\nSELECT nome, total_pago_centavos,\n DENSE_RANK() OVER (ORDER BY total_pago_centavos DESC) AS posicao\nFROM totais ORDER BY posicao, nome;",
    "criteria": [
      "Bruno e Carla ficam na posição 1.",
      "Ana fica na posição 2."
    ]
  },
  {
    "id": "sql-advanced-2",
    "track": "sql",
    "level": "advanced",
    "title": "Faturamento acumulado",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nAgrupe o faturamento pago por dia e calcule o acumulado cronológico. Retorne data, total_dia e acumulado_centavos. Use uma janela com ROWS explicitamente.",
    "starter": "-- Agregue os dias antes de calcular a janela\n",
    "hints": [
      "Crie uma CTE diario.",
      "SUM(...) OVER (...) faz a soma acumulada."
    ],
    "solution": "-- A janela opera sobre uma linha por dia, evitando duplicar datas empatadas.\nWITH diario AS (\n SELECT data, SUM(total_centavos) AS total_dia FROM pedidos\n WHERE status = 'pago' GROUP BY data\n)\nSELECT data, total_dia, SUM(total_dia) OVER (\n ORDER BY data ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\n) AS acumulado_centavos FROM diario ORDER BY data;",
    "criteria": [
      "Os acumulados são 10000,35000,50000,55000.",
      "03/01 aparece uma única vez."
    ]
  },
  {
    "id": "sql-advanced-3",
    "track": "sql",
    "level": "advanced",
    "title": "O pedido mais recente",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);\nCREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, total_centavos INTEGER, status TEXT, data TEXT);\nINSERT INTO clientes VALUES (1,'Ana'),(2,'Bruno'),(3,'Carla'),(4,'Diego');\nINSERT INTO pedidos VALUES\n(1,1,10000,'pago','2026-01-01'), (2,1,5000,'pago','2026-01-03'),\n(3,2,20000,'pago','2026-01-03'), (4,2,3000,'cancelado','2026-01-04'),\n(5,3,15000,'pago','2026-02-01'), (6,3,5000,'pago','2026-02-02');\n\nTarefa\nRetorne o último pedido pago de cada cliente, usando ROW_NUMBER. Em datas iguais, escolha o pedido de maior id. Retorne cliente_id, id, data.",
    "starter": "-- Classifique dentro de cada cliente\n",
    "hints": [
      "Use PARTITION BY cliente_id.",
      "Filtre rn=1 na consulta externa."
    ],
    "solution": "-- O segundo critério torna a escolha determinística em empate de data.\nWITH classificados AS (\n SELECT cliente_id, id, data, ROW_NUMBER() OVER (\n  PARTITION BY cliente_id ORDER BY data DESC, id DESC\n ) AS rn FROM pedidos WHERE status = 'pago'\n)\nSELECT cliente_id, id, data FROM classificados WHERE rn = 1 ORDER BY cliente_id;",
    "criteria": [
      "Retorna ids 2,3,6.",
      "Há uma linha por cliente com pagamentos."
    ]
  },
  {
    "id": "sql-advanced-4",
    "track": "sql",
    "level": "advanced",
    "title": "Hierarquia com recursão",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE equipe (id INTEGER PRIMARY KEY, nome TEXT, gestor_id INTEGER);\nINSERT INTO equipe VALUES (1,'Ana',NULL),(2,'Bruno',1),(3,'Carla',1),(4,'Diego',2),(5,'Eva',4);\n\nTarefa\nListe os descendentes de Ana (id=1), sem incluir a própria Ana. Retorne id, nome e nivel: subordinados diretos têm nível 1. Ordene por nivel e id.",
    "starter": "-- Use WITH RECURSIVE\n",
    "hints": [
      "A estrutura de treino não contém ciclos.",
      "Una a âncora com o passo recursivo usando UNION ALL."
    ],
    "solution": "-- A âncora encontra filhos diretos; o passo recursivo expande os próximos níveis.\nWITH RECURSIVE descendentes AS (\n SELECT id, nome, 1 AS nivel FROM equipe WHERE gestor_id = 1\n UNION ALL\n SELECT e.id, e.nome, d.nivel + 1\n FROM equipe e JOIN descendentes d ON e.gestor_id = d.id\n)\nSELECT id, nome, nivel FROM descendentes ORDER BY nivel, id;",
    "criteria": [
      "Bruno e Carla:nível1, Diego:2, Eva:3.",
      "Ana não aparece."
    ]
  },
  {
    "id": "sql-advanced-5",
    "track": "sql",
    "level": "advanced",
    "title": "Transação com conferência",
    "prompt": "Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:\n\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, categoria TEXT, preco_centavos INTEGER, estoque INTEGER);\nINSERT INTO produtos VALUES\n(1,'Caderno','Papelaria',1200,10), (2,'Caneta','Papelaria',300,20),\n(3,'Mouse','Informática',8000,0), (4,'Teclado','Informática',15000,4), (5,'Livro','Livros',5000,3);\n\nTarefa\nEm banco de treino, reduza o estoque do Caderno (id=1) em 2 somente se houver estoque suficiente. Confira o novo estoque dentro da transação e termine com ROLLBACK para deixar os dados originais intactos.",
    "starter": "-- Execute as instruções uma a uma no banco de treino\n",
    "hints": [
      "BEGIN inicia e ROLLBACK desfaz a transação.",
      "Inclua estoque >= 2 no próprio UPDATE."
    ],
    "solution": "BEGIN TRANSACTION;\n-- A condição no UPDATE evita que o estoque fique negativo.\nUPDATE produtos SET estoque = estoque - 2 WHERE id = 1 AND estoque >= 2;\nSELECT id, estoque FROM produtos WHERE id = 1; -- Mostra 8 dentro da transação.\nROLLBACK;\nSELECT id, estoque FROM produtos WHERE id = 1; -- Volta para 10.\n",
    "criteria": [
      "Dentro da transação, estoque é 8.",
      "Depois do ROLLBACK, estoque é 10.",
      "Nenhum produto alheio é alterado."
    ]
  },
  {
    "id": "git-first_steps-1",
    "track": "git",
    "level": "first_steps",
    "title": "Conheça sua ferramenta",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nAbra o Git Bash em uma pasta reservada a exercícios, sem arquivos de projetos reais.\n\nTarefa\nMostre a versão do Git instalada e consulte a ajuda curta de git status. Não crie commits.",
    "starter": "# Anote aqui os comandos que você usará\n",
    "hints": [
      "A opção --version pertence ao comando git.",
      "A opção -h mostra a ajuda curta de um subcomando."
    ],
    "solution": "git --version  # Mostra a versão instalada.\ngit status -h  # Exibe a ajuda curta sem alterar arquivos.\n",
    "criteria": [
      "A versão instalada é exibida.",
      "Você localiza a descrição de git status."
    ]
  },
  {
    "id": "git-first_steps-2",
    "track": "git",
    "level": "first_steps",
    "title": "Crie um repositório de treino",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nCrie uma pasta nova e vazia chamada treino-git-inicio e entre nela pelo Git Bash.\n\nTarefa\nInicialize um repositório com a branch main e confirme o estado. Não trabalhe numa pasta já versionada.",
    "starter": "# Inicialize e consulte o estado\n",
    "hints": [
      "Use git init.",
      "-b main escolhe o nome da branch inicial."
    ],
    "solution": "git init -b main  # Inicializa apenas a pasta de treino atual.\ngit status\n",
    "criteria": [
      "O status informa branch main.",
      "Não há commits nem arquivos de projetos reais."
    ]
  },
  {
    "id": "git-first_steps-3",
    "track": "git",
    "level": "first_steps",
    "title": "Assine apenas este repositório",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta nova de treino, execute git init -b main.\n\nTarefa\nConfigure nome Aluno de Treino e e-mail aluno@example.invalid somente neste repositório. Exiba os dois valores locais; não altere a configuração global.",
    "starter": "# Configure a identidade local\n",
    "hints": [
      "Use git config --local.",
      "--get lê uma configuração."
    ],
    "solution": "git config --local user.name \"Aluno de Treino\"\ngit config --local user.email \"aluno@example.invalid\"\n# --local limita a configuração a este repositório.\ngit config --local --get user.name\ngit config --local --get user.email\n",
    "criteria": [
      "Nome e e-mail locais correspondem ao enunciado.",
      "Nenhuma opção --global é usada."
    ]
  },
  {
    "id": "git-first_steps-4",
    "track": "git",
    "level": "first_steps",
    "title": "Enxergue um arquivo novo",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-status\ncd treino-git-status\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie ideias.txt com a frase Minha primeira ideia e use git status --short. Identifique o significado de ?? antes do nome. Não adicione o arquivo ainda.",
    "starter": "# Crie o arquivo e inspecione\n",
    "hints": [
      "Crie o arquivo antes de consultar o status.",
      "Um arquivo novo ainda não está preparado para commit."
    ],
    "solution": "printf 'Minha primeira ideia\\n' > ideias.txt\ngit status --short  # ?? indica arquivo não rastreado.\n",
    "criteria": [
      "ideias.txt aparece com ??.",
      "Nenhum commit adicional é criado."
    ]
  },
  {
    "id": "git-first_steps-5",
    "track": "git",
    "level": "first_steps",
    "title": "Seu primeiro commit",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-primeiro\ncd treino-git-primeiro\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie aprendizado.txt com Aprendi a fazer um commit. Prepare somente esse arquivo, crie um commit com mensagem Registra aprendizado e confira a última mensagem.",
    "starter": "# Prepare, registre e confira\n",
    "hints": [
      "git add seleciona o conteúdo do commit.",
      "git commit -m recebe a mensagem."
    ],
    "solution": "printf 'Aprendi a fazer um commit\\n' > aprendizado.txt\ngit add aprendizado.txt  # Prepara explicitamente o arquivo desejado.\ngit commit -m \"Registra aprendizado\"\ngit log -1 --oneline\n",
    "criteria": [
      "O novo arquivo está no commit.",
      "A mensagem final é Registra aprendizado."
    ]
  },
  {
    "id": "git-basic-1",
    "track": "git",
    "level": "basic",
    "title": "Leia o histórico",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-historico\ncd treino-git-historico\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\nprintf 'Segunda linha\\n' >> notas.txt\ngit add notas.txt\ngit commit -m \"Amplia notas\"\n\nTarefa\nMostre os dois últimos commits numa linha por commit. Depois veja quais arquivos o último commit alterou.",
    "starter": "# Explore sem modificar o histórico\n",
    "hints": [
      "git log pode limitar a quantidade com -2.",
      "git show --stat resume os arquivos alterados."
    ],
    "solution": "git log -2 --oneline\ngit show --stat HEAD  # HEAD identifica o commit atual.\n",
    "criteria": [
      "Dois commits aparecem em ordem do mais novo ao mais antigo.",
      "O resumo aponta notas.txt."
    ]
  },
  {
    "id": "git-basic-2",
    "track": "git",
    "level": "basic",
    "title": "Entenda as diferenças",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-diff\ncd treino-git-diff\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nAdicione uma linha ainda não preparada a notas.txt. Veja o diff; prepare o arquivo e veja novamente tanto git diff quanto git diff --staged. Explique a diferença.",
    "starter": "# Compare trabalho e área de preparação\n",
    "hints": [
      "Observe o que muda após git add.",
      "--staged revela o conteúdo do próximo commit."
    ],
    "solution": "printf 'Nova linha\\n' >> notas.txt\ngit diff  # Compara o diretório de trabalho com a área de preparação.\ngit add notas.txt\ngit diff  # Agora não há diferenças não preparadas.\ngit diff --staged  # Compara o conteúdo preparado com o último commit.\n",
    "criteria": [
      "Você vê a linha adicionada antes do add.",
      "Depois do add, o diff simples fica vazio e o staged mostra a alteração."
    ]
  },
  {
    "id": "git-basic-3",
    "track": "git",
    "level": "basic",
    "title": "Um commit com escopo",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-escopo\ncd treino-git-escopo\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie resumo.txt e rascunho.txt. Faça um commit apenas de resumo.txt. Deixe rascunho.txt não rastreado.",
    "starter": "# Escolha explicitamente um arquivo\n",
    "hints": [
      "Evite git add . neste exercício.",
      "Use o caminho específico em git add."
    ],
    "solution": "printf 'Resumo final\\n' > resumo.txt\nprintf 'Ideias ainda abertas\\n' > rascunho.txt\ngit add resumo.txt\ngit commit -m \"Adiciona resumo\"\ngit status --short  # rascunho.txt continua com ??.\n",
    "criteria": [
      "O commit contém somente resumo.txt.",
      "rascunho.txt continua fora do histórico."
    ]
  },
  {
    "id": "git-basic-4",
    "track": "git",
    "level": "basic",
    "title": "Trabalhe numa branch",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-branch\ncd treino-git-branch\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie e troque para a branch estudo/python. Adicione uma anotação a notas.txt e faça um commit. Confira as branches sem mesclar ainda.",
    "starter": "# Abra uma linha de trabalho independente\n",
    "hints": [
      "git switch -c cria e troca de branch.",
      "Um commit atualiza a branch em que você está."
    ],
    "solution": "git switch -c estudo/python\nprintf 'Praticar Python\\n' >> notas.txt\ngit add notas.txt\ngit commit -m \"Planeja estudo de Python\"\ngit branch  # A estrela marca a branch atual.\n",
    "criteria": [
      "estudo/python está selecionada.",
      "main permanece no commit anterior."
    ]
  },
  {
    "id": "git-basic-5",
    "track": "git",
    "level": "basic",
    "title": "Sua primeira integração",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-integracao\ncd treino-git-integracao\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\ngit switch -c melhoria\nprintf 'Melhoria de treino\\n' >> notas.txt\ngit add notas.txt\ngit commit -m \"Melhora notas\"\n\nTarefa\nVolte à main e integre melhoria por fast-forward. Confira o histórico. Não apague branches.",
    "starter": "# Integre a evolução linear\n",
    "hints": [
      "A integração é feita na branch de destino.",
      "--ff-only exige que main apenas avance."
    ],
    "solution": "git switch main\ngit merge --ff-only melhoria  # Falha com segurança se o histórico não permitir fast-forward.\ngit log --oneline --all --graph\n",
    "criteria": [
      "main e melhoria apontam para o mesmo commit.",
      "O histórico continua linear."
    ]
  },
  {
    "id": "git-intermediate-1",
    "track": "git",
    "level": "intermediate",
    "title": "Resolva um conflito",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-conflito\ncd treino-git-conflito\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\ngit switch -c alternativa\nprintf 'Estudar Python\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Plano Python\"\ngit switch main\nprintf 'Estudar SQL\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Plano SQL\"\n\nTarefa\nFaça merge de alternativa em main. Resolva o conflito mantendo as duas linhas Estudar Python e Estudar SQL, nessa ordem. Finalize o merge.",
    "starter": "# Faça o merge e resolva o conflito no arquivo\n",
    "hints": [
      "Os marcadores mostram as duas versões.",
      "Após resolver, git add sinaliza que o arquivo está pronto."
    ],
    "solution": "git merge alternativa  # Conflito esperado: as duas branches mudaram a mesma linha.\n# Depois de ler o conflito, substitua apenas notas.txt pelo resultado combinado:\nprintf 'Estudar Python\\nEstudar SQL\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Combina planos de estudo\"\ngit status\n",
    "criteria": [
      "As duas linhas finais estão presentes.",
      "Nenhum marcador de conflito permanece.",
      "O status não indica merge em andamento."
    ]
  },
  {
    "id": "git-intermediate-2",
    "track": "git",
    "level": "intermediate",
    "title": "Guarde uma pausa de trabalho",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-stash\ncd treino-git-stash\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nEdite notas.txt sem commit. Guarde a alteração num stash nomeado, confira o estado limpo e reaplique com stash apply. Preserve o stash para conferência.",
    "starter": "# Guarde e recupere sem excluir o stash\n",
    "hints": [
      "git stash push guarda alterações rastreadas.",
      "Use apply em vez de pop para manter a referência de conferência."
    ],
    "solution": "printf 'Trabalho em andamento\\n' >> notas.txt\ngit stash push -m \"Pausa do exercício\"\ngit status --short\ngit stash list\ngit stash apply stash@{0}  # apply mantém a cópia no stash.\ngit diff\n",
    "criteria": [
      "O estado fica limpo após guardar.",
      "A alteração reaparece depois de apply.",
      "O stash continua listado."
    ]
  },
  {
    "id": "git-intermediate-3",
    "track": "git",
    "level": "intermediate",
    "title": "Desfaça preservando o histórico",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-revert\ncd treino-git-revert\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\nprintf 'Anotacao incorreta\\n' >> notas.txt\ngit add notas.txt\ngit commit -m \"Adiciona anotacao incorreta\"\n\nTarefa\nDesfaça o último commit criando um novo commit com git revert. Preserve todo o histórico.",
    "starter": "# Reverta sem reescrever commits\n",
    "hints": [
      "git revert preserva o commit original.",
      "--no-edit usa a mensagem proposta pelo Git."
    ],
    "solution": "git revert --no-edit HEAD  # Cria um novo commit que desfaz o anterior.\ngit log -3 --oneline\ncat notas.txt\n",
    "criteria": [
      "A anotação incorreta é removida.",
      "O histórico tem o commit original e o de reversão.",
      "Não usa reset --hard."
    ]
  },
  {
    "id": "git-intermediate-4",
    "track": "git",
    "level": "intermediate",
    "title": "Um remoto só de treino",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-remoto\ncd treino-git-remoto\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie um remoto bare no diretório irmão remoto-treino.git e conecte-o como origin. Envie main e confira as referências. Tudo deve permanecer local, sem GitHub ou credenciais.",
    "starter": "# Crie um remoto local e publique apenas o exercício\n",
    "hints": [
      "Um repositório bare pode receber pushes.",
      "origin é apenas o nome convencional do remoto."
    ],
    "solution": "git init --bare ../remoto-treino.git\ngit remote add origin ../remoto-treino.git\ngit push -u origin main  # O destino é uma pasta local de treino.\ngit remote -v\ngit branch -vv\n",
    "criteria": [
      "origin aponta para a pasta irmã local.",
      "main acompanha origin/main.",
      "Nenhuma conta externa é utilizada."
    ]
  },
  {
    "id": "git-intermediate-5",
    "track": "git",
    "level": "intermediate",
    "title": "Ignore arquivos gerados",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-ignore\ncd treino-git-ignore\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie debug.log e uma regra *.log em .gitignore. Versione somente .gitignore e confira que debug.log está ignorado. O arquivo deve permanecer no disco.",
    "starter": "# Ignore logs antes de rastreá-los\n",
    "hints": [
      ".gitignore contém padrões, um por linha.",
      "git check-ignore -v explica a regra aplicada."
    ],
    "solution": "printf 'Log local\\n' > debug.log\nprintf '*.log\\n' > .gitignore\ngit add .gitignore\ngit commit -m \"Ignora logs gerados\"\ngit check-ignore -v debug.log  # Mostra a regra responsável.\n",
    "criteria": [
      "debug.log existe e não está no commit.",
      ".gitignore está versionado.",
      "A regra responsável é exibida."
    ]
  },
  {
    "id": "git-advanced-1",
    "track": "git",
    "level": "advanced",
    "title": "Transfira um commit específico",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-cherry\ncd treino-git-cherry\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\ngit switch -c experimento\nprintf 'Anotacao isolada\\n' > guia.txt\ngit add guia.txt\ngit commit -m \"Cria guia\"\ngit tag guia-pronto\ngit switch main\n\nTarefa\nTraga para main apenas o commit marcado por guia-pronto, usando cherry-pick. Confira que guia.txt foi criado e que a branch experimento continua existindo.",
    "starter": "# Transfira uma alteração escolhida\n",
    "hints": [
      "Uma tag pode nomear o commit desejado.",
      "Cherry-pick aplica o patch de um commit."
    ],
    "solution": "git cherry-pick guia-pronto  # Aplica o commit selecionado à branch atual.\ngit log -2 --oneline\ngit branch\ncat guia.txt\n",
    "criteria": [
      "main contém guia.txt.",
      "experimento continua existindo.",
      "A operação termina sem conflito pendente."
    ]
  },
  {
    "id": "git-advanced-2",
    "track": "git",
    "level": "advanced",
    "title": "Rebase de uma branch privada",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-rebase\ncd treino-git-rebase\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\ngit switch -c recurso-local\nprintf 'Guia do recurso\\n' > recurso.txt\ngit add recurso.txt\ngit commit -m \"Cria recurso\"\ngit switch main\nprintf 'Guia da base\\n' > base.txt\ngit add base.txt\ngit commit -m \"Atualiza base\"\ngit switch recurso-local\n\nTarefa\nAtualize recurso-local com a nova main usando rebase. A branch é exclusivamente local e nunca foi compartilhada. Confira que ambos os arquivos existem. Não use force push.",
    "starter": "# Reaplique apenas a branch privada de treino\n",
    "hints": [
      "O rebase é iniciado na branch que será atualizada.",
      "Commits compartilhados exigem outra coordenação; aqui não há remoto."
    ],
    "solution": "git rebase main  # Recria o commit privado sobre a base atualizada.\ngit log --graph --oneline --all\ncat base.txt\ncat recurso.txt\n# Se surgisse conflito, seria necessário resolver e usar git rebase --continue.\n",
    "criteria": [
      "recurso-local passa a conter a evolução de main.",
      "Os dois arquivos permanecem.",
      "Nenhum push forçado é usado."
    ]
  },
  {
    "id": "git-advanced-3",
    "track": "git",
    "level": "advanced",
    "title": "Investigue com bisect",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-bisect\ncd treino-git-bisect\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\nprintf 'ok\\n' > estado.txt\ngit add estado.txt\ngit commit -m \"Estado saudavel\"\ngit tag inicio-saudavel\nprintf 'Documentacao\\n' > guia.txt\ngit add guia.txt\ngit commit -m \"Inclui guia\"\nprintf 'erro\\n' > estado.txt\ngit add estado.txt\ngit commit -m \"Introduz regressao\"\nprintf 'Mais contexto\\n' >> guia.txt\ngit add guia.txt\ngit commit -m \"Amplia guia\"\n\nTarefa\nLocalize o primeiro commit em que estado.txt deixa de conter ok. Use bisect com um teste local de leitura e retorne à branch original ao finalizar.",
    "starter": "# Faça busca binária sobre o histórico de treino\n",
    "hints": [
      "O commit bom é nomeado pela tag inicio-saudavel.",
      "Um teste com saída 0 é bom; falha normal indica ruim."
    ],
    "solution": "git bisect start HEAD inicio-saudavel\n# grep retorna 0 quando encontra ok; bisect usa o código de saída como diagnóstico.\ngit bisect run sh -c 'grep -qx \"ok\" estado.txt'\ngit bisect reset  # Encerra a investigação e retorna à branch original.\n",
    "criteria": [
      "O culpado tem mensagem Introduz regressao.",
      "bisect é encerrado com reset próprio da investigação.",
      "Nenhum arquivo real é executado ou alterado pelo teste."
    ]
  },
  {
    "id": "git-advanced-4",
    "track": "git",
    "level": "advanced",
    "title": "Recupere usando o reflog",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-reflog\ncd treino-git-reflog\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\ngit switch --detach\nprintf 'Descoberta de treino\\n' > descoberta.txt\ngit add descoberta.txt\ngit commit -m \"Descoberta em detached HEAD\"\ngit switch main\n\nTarefa\nEncontre no reflog o commit Descoberta em detached HEAD e crie uma branch recuperada apontando para seu hash. Não use reset e não altere main.",
    "starter": "# Substitua HASH_ENCONTRADO pelo identificador exibido no reflog\n",
    "hints": [
      "O reflog registra movimentações recentes do HEAD.",
      "git branch nome hash cria uma referência sem trocar de branch."
    ],
    "solution": "git reflog --oneline\n# Leia o hash da entrada com a mensagem do commit recuperável.\ngit branch recuperada HASH_ENCONTRADO\ngit show recuperada:descoberta.txt\ngit log --oneline --all --graph\n",
    "criteria": [
      "A branch recuperada aponta para o commit da descoberta.",
      "main permanece no mesmo commit.",
      "descoberta.txt pode ser lido pela nova referência."
    ]
  },
  {
    "id": "git-advanced-5",
    "track": "git",
    "level": "advanced",
    "title": "Duas pastas, um histórico",
    "prompt": "Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir treino-git-worktree\ncd treino-git-worktree\ngit init -b main\ngit config user.name \"Aluno de Treino\"\ngit config user.email \"aluno@example.invalid\"\nprintf 'Versao inicial\\n' > notas.txt\ngit add notas.txt\ngit commit -m \"Cria notas de treino\"\n\nTarefa\nCrie um worktree irmão treino-worktree-notas com uma nova branch revisar-notas. Liste os worktrees e faça um commit dentro do novo. Confirme que a pasta principal continua em main. Não remova pastas.",
    "starter": "# Abra outra área de trabalho para a branch de treino\n",
    "hints": [
      "git worktree add cria uma segunda área de trabalho.",
      "Use git -C para agir na pasta correta."
    ],
    "solution": "git worktree add -b revisar-notas ../treino-worktree-notas\n# -C executa o comando na pasta indicada, sem trocar o diretório do terminal.\nprintf 'Revisao paralela\\n' >> ../treino-worktree-notas/notas.txt\ngit -C ../treino-worktree-notas add notas.txt\ngit -C ../treino-worktree-notas commit -m \"Revisa notas\"\ngit worktree list\ngit branch --show-current\n",
    "criteria": [
      "Dois worktrees são listados.",
      "A nova branch contém o commit de revisão.",
      "A pasta principal continua em main."
    ]
  }
]
