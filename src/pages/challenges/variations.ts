import type { Challenge } from './catalog'
import { expectWord, printNumber, type PythonCase } from './runners/pythonCases'

/**
 * Variação de revisão: mesmo conceito de um exercício do catálogo, com outro contexto,
 * outros dados ou outro estado inicial. Reutiliza os avaliadores existentes; o progresso
 * do exercício original nunca é alterado por ela.
 */
export interface Variation extends Challenge {
  baseId: string
  /** Nome do conceito mostrado na fila de revisão. */
  concept: string
  /** Python: verificações próprias da variação. */
  tests?: PythonCase[]
  /** SQL: linhas extras usadas na verificação com dados diferentes. */
  extraData?: string
}

const gitIntro = 'Use Git Bash (Git 2.28+) em um repositório de treino. Nunca use seu projeto de trabalho para estes exercícios.'
const gitPrep = (folder: string, files: string[]) => `${gitIntro}\n\nPreparação\nEm uma pasta de treino, crie um diretório novo para este desafio e execute:\nmkdir ${folder}\ncd ${folder}\ngit init -b main\ngit config user.name "Aluno de Treino"\ngit config user.email "aluno@example.invalid"\n${files.join('\n')}`
const sqlIntro = 'Dialeto: SQLite. Use um banco de treino vazio para este desafio. Execute a preparação abaixo uma única vez:'

export const VARIATIONS: Variation[] = [
  {
    id: 'python-first_steps-5~v1', baseId: 'python-first_steps-5', track: 'python', level: 'first_steps',
    title: 'Horas em minutos', concept: 'Entrada numérica e cálculo',
    prompt: 'Pratique em Python 3 no seu computador.\n\nPeça um número de horas (pode ser decimal) e mostre quantos minutos elas têm. Experimente 2, 0 e 0.5; os resultados devem ser 120, 0 e 30 (com ou sem .0).',
    starter: '# Leia as horas, converta para número e multiplique por 60\n',
    hints: ['input() devolve texto; converta antes de multiplicar.', 'Uma hora tem 60 minutos: use o operador *.'],
    solution: 'horas = float(input("Horas: "))\nminutos = horas * 60  # 1 hora = 60 minutos.\nprint(minutos)\n',
    criteria: ['O programa lê um número.', 'Mostra as horas convertidas em minutos.'],
    tests: [printNumber('Duas horas', ['2'], 120), printNumber('Zero hora', ['0'], 0), printNumber('Meia hora', ['0.5'], 30), printNumber('Valor negativo', ['-1.5'], -90)],
  },
  {
    id: 'python-basic-1~v1', baseId: 'python-basic-1', track: 'python', level: 'basic',
    title: 'Positivo, negativo ou zero', concept: 'Decisões com if, elif e else',
    prompt: 'Pratique em Python 3 no seu computador.\n\nLeia um inteiro e informe Positivo, Negativo ou Zero.',
    starter: '# Leia um inteiro e compare com zero\n',
    hints: ['Compare o número com zero usando > e <.', 'if, elif e else cobrem três resultados diferentes.'],
    solution: 'numero = int(input("Inteiro: "))\nif numero > 0:\n    print("Positivo")\nelif numero < 0:  # elif testa uma segunda condição.\n    print("Negativo")\nelse:\n    print("Zero")\n',
    criteria: ['Escolhe entre três mensagens.', 'Zero não é positivo nem negativo.'],
    tests: [['8', 'Positivo'], ['-3', 'Negativo'], ['0', 'Zero'], ['-100', 'Negativo'], ['1', 'Positivo']].map(([input, word]) => expectWord(input, word)),
  },
  {
    id: 'python-intermediate-1~v1', baseId: 'python-intermediate-1', track: 'python', level: 'intermediate',
    title: 'Entregas concluídas', concept: 'Filtrar e somar listas de dicionários',
    prompt: 'Pratique em Python 3 no seu computador.\n\nImplemente total_entregue(entregas). Cada entrega tem situacao e quantidade. Some apenas as quantidades com situacao "entregue". Uma lista vazia retorna 0. Exemplo: entregue/4, devolvido/2, entregue/6 → 10.',
    starter: 'def total_entregue(entregas):\n    pass\n',
    hints: ['Filtre pelo campo situacao.', 'sum() com expressão geradora devolve zero para lista vazia.'],
    solution: 'def total_entregue(entregas):\n    # A expressão geradora filtra antes de somar.\n    return sum(e["quantidade"] for e in entregas if e["situacao"] == "entregue")\n\nprint(total_entregue([{"situacao": "entregue", "quantidade": 4}, {"situacao": "devolvido", "quantidade": 2}, {"situacao": "entregue", "quantidade": 6}]))\n',
    criteria: ['Soma só entregas com situacao entregue.', 'Lista vazia retorna 0.'],
    tests: [
      { label: 'Filtra e preserva entregas', check: `entregas = [{"situacao":"entregue","quantidade":4},{"situacao":"devolvido","quantidade":2},{"situacao":"entregue","quantidade":6},{"situacao":"pendente","quantidade":9}]
original = copy.deepcopy(entregas)
assert student.total_entregue(entregas) == 10, "Some apenas as quantidades das entregas com situacao entregue."
assert entregas == original, "Preserve a lista original."` },
      { label: 'Lista vazia e valores diferentes', check: `assert student.total_entregue([]) == 0
assert student.total_entregue([{"situacao":"entregue","quantidade":1.5},{"situacao":"devolvido","quantidade":25}]) == 1.5` },
    ],
  },
  {
    id: 'sql-first_steps-3~v1', baseId: 'sql-first_steps-3', track: 'sql', level: 'first_steps',
    title: 'Encontre um livro', concept: 'Filtrar linhas com WHERE',
    prompt: `${sqlIntro}

CREATE TABLE livros (id INTEGER PRIMARY KEY, titulo TEXT, autor TEXT, ano INTEGER, genero TEXT);
INSERT INTO livros VALUES
(1,'Dom Casmurro','Machado de Assis',1899,'Romance'), (2,'Vidas Secas','Graciliano Ramos',1938,'Romance'),
(3,'O Alienista','Machado de Assis',1882,'Conto'), (4,'Capitães da Areia','Jorge Amado',1937,'Romance'),
(5,'Iracema','José de Alencar',1865,'Romance');

Tarefa
Busque o livro cujo título é exatamente Vidas Secas. Retorne id, titulo e ano.`,
    starter: '-- Use WHERE para filtrar pelo título\n',
    hints: ['Use WHERE titulo = ...', 'O título precisa de aspas simples.'],
    solution: "-- Textos SQL usam aspas simples.\nSELECT id, titulo, ano FROM livros WHERE titulo = 'Vidas Secas';",
    criteria: ['Filtra pelo título exato.', 'Retorna id, titulo e ano.'],
    extraData: "DELETE FROM livros WHERE id=2;\nINSERT INTO livros VALUES (6,'Vidas Secas','Graciliano Ramos',1938,'Romance'),(7,'Vidas Secas Ilustrado','Graciliano Ramos',2010,'Romance'),(8,'Dom Casmurro','Machado de Assis',1899,'Romance');",
  },
  {
    id: 'sql-basic-3~v1', baseId: 'sql-basic-3', track: 'sql', level: 'basic',
    title: 'Chamados por setor', concept: 'Agrupar e contar com GROUP BY',
    prompt: `${sqlIntro}

CREATE TABLE chamados (id INTEGER PRIMARY KEY, setor TEXT, prioridade TEXT, aberto_em TEXT);
INSERT INTO chamados VALUES
(1,'Financeiro','alta','2026-03-01'), (2,'Suporte','baixa','2026-03-01'),
(3,'Suporte','alta','2026-03-02'), (4,'Financeiro','baixa','2026-03-03'),
(5,'Suporte','média','2026-03-04'), (6,'Vendas','alta','2026-03-04');

Tarefa
Retorne setor e quantidade_chamados para cada setor, ordenando pelo nome do setor.`,
    starter: '-- Agrupe os chamados\n',
    hints: ['COUNT(*) passa a contar dentro de cada grupo.', 'Use GROUP BY setor.'],
    solution: '-- GROUP BY forma um grupo por setor.\nSELECT setor, COUNT(*) AS quantidade_chamados\nFROM chamados GROUP BY setor ORDER BY setor;',
    criteria: ['Agrupa por setor.', 'Usa o alias quantidade_chamados.'],
    extraData: "INSERT INTO chamados VALUES (7,'Vendas','baixa','2026-03-05'),(8,'RH','média','2026-03-05'),(9,'RH','alta','2026-03-06'),(10,'RH','alta','2026-03-07');",
  },
  {
    id: 'sql-intermediate-2~v1', baseId: 'sql-intermediate-2', track: 'sql', level: 'intermediate',
    title: 'Quem ainda não se matriculou?', concept: 'Encontrar ausências com LEFT JOIN',
    prompt: `${sqlIntro}

CREATE TABLE alunos (id INTEGER PRIMARY KEY, nome TEXT);
CREATE TABLE matriculas (id INTEGER PRIMARY KEY, aluno_id INTEGER, curso TEXT, status TEXT);
INSERT INTO alunos VALUES (1,'Lia'),(2,'Marcos'),(3,'Nina'),(4,'Otávio'),(5,'Paula');
INSERT INTO matriculas VALUES (1,1,'SQL','ativa'),(2,1,'Python','ativa'),(3,2,'SQL','cancelada'),(4,4,'Git','ativa');

Tarefa
Encontre alunos sem nenhuma matrícula, incluindo canceladas como matrículas existentes. Retorne id e nome, em ordem de id.`,
    starter: '-- Preserve quem não possui relação\n',
    hints: ['Use LEFT JOIN e IS NULL.', 'Não filtre pelo status nesta tarefa.'],
    solution: '-- LEFT JOIN preserva o aluno; m.id nulo indica falta de correspondência.\nSELECT a.id, a.nome FROM alunos AS a\nLEFT JOIN matriculas AS m ON m.aluno_id = a.id\nWHERE m.id IS NULL ORDER BY a.id;',
    criteria: ['Preserva alunos sem matrícula.', 'Conta matrículas canceladas como existentes.'],
    extraData: "INSERT INTO alunos VALUES (6,'Quésia'),(7,'Rui');\nINSERT INTO matriculas VALUES (5,3,'Git','cancelada'),(6,6,'Python','ativa');",
  },
  {
    id: 'git-first_steps-5~v1', baseId: 'git-first_steps-5', track: 'git', level: 'first_steps',
    title: 'Registre seu diário de estudos', concept: 'Primeiro commit: preparar e registrar',
    prompt: `${gitPrep('treino-git-diario', ["printf 'Agenda inicial\\n' > agenda.txt", 'git add agenda.txt', 'git commit -m "Cria agenda de treino"'])}\n\nTarefa\nCrie diario.txt com Hoje estudei Git. Prepare somente esse arquivo, crie um commit com mensagem Registra diario e confira a última mensagem.`,
    starter: '# Crie o arquivo, prepare, registre e confira\n',
    hints: ['git add seleciona o conteúdo do commit.', 'git commit -m recebe a mensagem; git log -1 --oneline confere o resultado.'],
    solution: "printf 'Hoje estudei Git\\n' > diario.txt\ngit add diario.txt  # Prepara explicitamente o arquivo desejado.\ngit commit -m \"Registra diario\"\ngit log -1 --oneline\n",
    criteria: ['Somente diario.txt entra no commit.', 'A mensagem é Registra diario.'],
  },
  {
    id: 'git-basic-3~v1', baseId: 'git-basic-3', track: 'git', level: 'basic',
    title: 'Commit só do relatório', concept: 'Commit com escopo controlado',
    prompt: `${gitPrep('treino-git-relatorio', ["printf 'Agenda inicial\\n' > agenda.txt", 'git add agenda.txt', 'git commit -m "Cria agenda de treino"'])}\n\nTarefa\nCrie anotacoes.txt e, depois, relatorio.txt. Faça um commit apenas de relatorio.txt. Deixe anotacoes.txt não rastreado.`,
    starter: '# Crie os arquivos e registre apenas o relatório\n',
    hints: ['Evite git add . neste exercício.', 'Use o caminho específico em git add e confira com git status --short.'],
    solution: "printf 'Ideias soltas\\n' > anotacoes.txt\nprintf 'Relatorio final\\n' > relatorio.txt\ngit add relatorio.txt\ngit commit -m \"Adiciona relatorio\"\ngit status --short  # anotacoes.txt continua com ??.\n",
    criteria: ['Somente relatorio.txt entra no commit.', 'anotacoes.txt segue não rastreado.'],
  },
  {
    id: 'git-basic-4~v1', baseId: 'git-basic-4', track: 'git', level: 'basic',
    title: 'Uma branch para estudar SQL', concept: 'Trabalhar numa branch',
    prompt: `${gitPrep('treino-git-branch-sql', ["printf 'Versao inicial\\n' > notas.txt", 'git add notas.txt', 'git commit -m "Cria notas de treino"', "printf 'Segunda linha\\n' >> notas.txt", 'git add notas.txt', 'git commit -m "Amplia notas"'])}\n\nTarefa\nCrie e troque para a branch estudo/sql. Acrescente uma anotação a notas.txt e faça um commit. Mostre só o nome da branch atual, sem mesclar ainda.`,
    starter: '# Abra uma branch, registre a mudança e confira\n',
    hints: ['git switch -c cria e troca de branch.', 'git branch --show-current imprime apenas o nome da branch atual.'],
    solution: "git switch -c estudo/sql\nprintf 'Praticar SQL\\n' >> notas.txt\ngit add notas.txt\ngit commit -m \"Planeja estudo de SQL\"\ngit branch --show-current  # Mostra só o nome da branch atual.\n",
    criteria: ['O commit fica em estudo/sql.', 'main não recebe o novo commit.'],
  },
]

const byBase = new Map(VARIATIONS.map((variation) => [variation.baseId, variation]))
const byId = new Map(VARIATIONS.map((variation) => [variation.id, variation]))

export const variationFor = (baseId: string): Variation | undefined => byBase.get(baseId)
export const variationById = (id: string): Variation | undefined => byId.get(id)
