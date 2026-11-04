export interface PythonCase {
  label: string
  input?: string[]
  check: string
}

export const printNumber = (label: string, input: string[], value: number): PythonCase => ({
  label,
  input,
  check: `expect_number(output, ${value})`,
})
export const expectWord = (input: string, word: string): PythonCase => ({
  label: `Entrada ${input}`,
  input: [input],
  check: `assert output.strip().casefold() == "${word}".casefold(), "Confira a palavra impressa para esta entrada."`,
})

export const pythonCases: Record<string, PythonCase[]> = {
  'python-first_steps-1': [
    { label: 'Mensagem exata', check: 'assert output.rstrip("\\r\\n") == "Bom dia!", "Imprima exatamente Bom dia!"' },
  ],
  'python-first_steps-2': ['Ana', 'João da Silva'].map((name) => ({
    label: `Nome ${name}`,
    input: [name],
    check: `assert len(pauses) == 1 and output.strip() == "Olá, ${name}! Prazer em conhecer você.", "Leia o nome e monte a saudação completa."`,
  })),
  'python-first_steps-3': [{
    label: 'Três capítulos, duas pausas', input: ['', ''],
    check: `assert len(pauses) == 2, "São necessárias duas pausas com input()."
a, b = pauses
assert output[:a].strip() and output[a:b].strip() and output[b:].strip(), "Imprima uma parte antes, uma entre as pausas e uma depois."`,
  }],
  'python-first_steps-4': [printNumber('Raiz de 25', ['25'], 5), printNumber('Raiz de zero', ['0'], 0), printNumber('Entrada decimal', ['2.25'], 1.5)],
  'python-first_steps-5': [printNumber('Entrada 7', ['7'], 14), printNumber('Entrada zero', ['0'], 0), printNumber('Entrada negativa', ['-3'], -6), printNumber('Entrada decimal', ['1.25'], 2.5)],
  'python-basic-1': [['0', 'Par'], ['8', 'Par'], ['-3', 'Ímpar'], ['7', 'Ímpar']].map(([input, word]) => expectWord(input, word)),
  'python-basic-2': [
    printNumber('N = 1', ['1'], 1), printNumber('N = 5', ['5'], 15), printNumber('N = 14', ['14'], 105),
    { label: 'Uso de um laço', input: ['4'], check: 'assert any(isinstance(n, (ast.For, ast.While)) for n in ast.walk(tree)), "Use um laço para somar os números."' },
  ],
  'python-basic-3': [
    { label: 'Lista e precisão', check: `assert re.search(r"(?<![\\d.])8[.,]00(?!\\d)", output), "Mostre a média com duas casas decimais."
assert student.notas == [7.5, 8.0, 6.5, 10.0], "Preserve a lista original."` },
  ],
  'python-basic-4': [
    printNumber('Ola mundo', ['Ola mundo'], 4), printNumber('Frase vazia', [''], 0),
    printNumber('Maiúsculas e acentos', ['AÉI Óu'], 3), printNumber('Consoantes', ['BrR  '], 0),
  ],
  'python-basic-5': [
    { label: 'Exemplos na saída', check: `assert numeric_output(output)[-2:] == [32, 212], "Mostre as conversões para 0 e 100."` },
    { label: 'Função reutilizável', check: `assert student.celsius_para_fahrenheit(0) == 32 and student.celsius_para_fahrenheit(100) == 212
assert student.celsius_para_fahrenheit(-40) == -40 and math.isclose(student.celsius_para_fahrenheit(12.5), 54.5), "Retorne a conversão para outros valores."` },
  ],
  'python-intermediate-1': [
    { label: 'Filtra e preserva pedidos', check: `orders = [{"status":"aprovado","valor":20},{"status":"cancelado","valor":200},{"status":"aprovado","valor":30},{"status":"pendente","valor":9}]
original = copy.deepcopy(orders)
assert student.total_aprovado(orders) == 50, "Some apenas os pedidos aprovados."
assert orders == original, "Preserve a lista original."` },
    { label: 'Lista vazia e valores diferentes', check: `assert student.total_aprovado([]) == 0
assert student.total_aprovado([{"status":"aprovado","valor":2.5},{"status":"cancelado","valor":25}]) == 2.5` },
  ],
  'python-intermediate-2': [
    { label: 'Categorias e ordem', check: `assert student.agrupar([("fruta","maçã"),("livro","Python"),("fruta","banana")]) == {"fruta":["maçã","banana"],"livro":["Python"]}` },
    { label: 'Entrada vazia e duplicatas', check: `assert student.agrupar([]) == {}
assert student.agrupar([("x","Z"),("x","A"),("x","Z")]) == {"x":["Z","A","Z"]}, "Preserve a ordem e os itens repetidos."` },
  ],
  'python-intermediate-3': [
    { label: 'Arquivo JSON UTF-8', check: `path = Path("config.json")
path.write_text('{"cidade":"Brasília","ativo":true}', encoding="utf-8")
assert student.carregar_config(path) == {"cidade":"Brasília","ativo":True}` },
    { label: 'Ausente, inválido e lista', check: `path = Path("config.json")
assert student.carregar_config(path) == {}
for text in ("{inválido", "[1,2,3]", "null"):
    path.write_text(text, encoding="utf-8")
    assert student.carregar_config(path) == {}` },
    { label: 'Erro de acesso não ocultado', check: `Path("pasta").mkdir()
expect_error(OSError, student.carregar_config, Path("pasta"))` },
  ],
  'python-intermediate-4': [
    { label: 'Válidos e inválidos intercalados', check: `assert student.converter_inteiros(["10","x","-2","3.5"]) == ([10,-2],["x","3.5"])` },
    { label: 'Valores alternativos e vazio', check: `assert student.converter_inteiros(["", " +4 ", "08", "1e2", "0"]) == ([4,8,0],["","1e2"])
assert student.converter_inteiros([]) == ([],[])` },
  ],
  'python-intermediate-5': [
    { label: 'Dataclass, saldo e movimentação', check: `assert dataclasses.is_dataclass(student.Conta), "Use @dataclass em Conta."
account = student.Conta()
assert account.saldo == 0
account.depositar(100)
account.sacar(30)
assert account.saldo == 70` },
    { label: 'Operações inválidas preservam saldo', check: `account = student.Conta()
account.depositar(10)
for method, amount in [(account.depositar,0),(account.depositar,-1),(account.sacar,0),(account.sacar,-1),(account.sacar,11)]:
    expect_error(ValueError, method, amount)
    assert account.saldo == 10
account.sacar(10)
assert account.saldo == 0` },
  ],
  'python-advanced-1': [
    { label: 'Lotes completos e incompletos', check: `assert list(student.lotes(range(7), 3)) == [[0,1,2],[3,4,5],[6]]
assert list(student.lotes(iter([]), 2)) == []
expect_error(ValueError, lambda: list(student.lotes(range(1), 0)))
expect_error(ValueError, lambda: list(student.lotes(range(1), -3)))` },
    { label: 'Consumo sob demanda', check: `seen = []
def source():
    for number in range(8):
        seen.append(number)
        yield number
result = student.lotes(source(), 2)
assert not seen and iter(result) is result, "Retorne um iterador sem consumir toda a entrada."
assert next(result) == [0,1] and seen == [0,1], "O primeiro lote deve consumir somente dois itens."` },
  ],
  'python-advanced-2': [
    { label: 'Valores de Fibonacci e validação', check: `assert [student.fibonacci(n) for n in [0,1,9,30]] == [0,1,34,832040]
expect_error(ValueError, student.fibonacci, -1)` },
    { label: 'Cache com limite e acertos', check: `student.fibonacci.cache_clear()
student.fibonacci(30)
before = student.fibonacci.cache_info()
student.fibonacci(30)
after = student.fibonacci.cache_info()
assert after.maxsize == 128 and after.hits > before.hits
assert 832040 in numeric_output(output) and "CacheInfo" in output, "Exiba fibonacci(30) e as estatísticas do cache."` },
  ],
  'python-advanced-3': [
    { label: 'Escreve UTF-8 e substitui após sucesso', check: `destination = Path("resultado.json")
destination.write_text('{"anterior":true}', encoding="utf-8")
with mock.patch.object(os, "replace", wraps=os.replace) as replace:
    student.salvar_json(destination, {"cidade":"Brasília"})
assert json.loads(destination.read_text(encoding="utf-8")) == {"cidade":"Brasília"}
assert replace.call_count == 1, "Use os.replace depois de gravar o temporário."
source, target = replace.call_args.args[:2]
assert Path(source).parent.resolve() == Path(target).parent.resolve() and list(Path(".").iterdir()) == [destination]` },
    { label: 'Falha preserva o original e limpa temporários', check: `destination = Path("resultado.json")
destination.write_text('{"anterior":true}', encoding="utf-8")
try:
    student.salvar_json(destination, {"inválido":object()})
except TypeError:
    pass
assert destination.read_text(encoding="utf-8") == '{"anterior":true}'
assert list(Path(".").iterdir()) == [destination], "Remova o arquivo temporário mesmo após erro."` },
  ],
  'python-advanced-4': [{
    label: 'Cinco tarefas com limite de duas', check: `assert any(line.strip().replace(" ", "") == "[0,2,4,6,8]" for line in output.splitlines()), "Exiba os cinco resultados na ordem."
assert timings["count"] == 5 and timings["peak"] == 2, "Execute cinco esperas concorrentes, com exatamente duas no pico."
assert timings["semaphore"], "Use asyncio.Semaphore para limitar a concorrência."
assert not timings["blocking"], "Use asyncio.sleep, sem time.sleep."`,
  }],
  'python-advanced-5': [
    { label: 'Desconto e limites', check: `assert math.isclose(student.aplicar_desconto(200, 15), 170)
assert student.aplicar_desconto(80, 0) == 80 and student.aplicar_desconto(80, 100) == 0
assert math.isclose(student.aplicar_desconto(99.99, 12.5), 87.49125)
for amount, percent in [(-1,10),(100,101),(100,-1)]:
    expect_error(ValueError, student.aplicar_desconto, amount, percent)` },
    { label: 'Testes unittest cobrem os cenários', check: `check_student_tests(student)` },
  ],
}
