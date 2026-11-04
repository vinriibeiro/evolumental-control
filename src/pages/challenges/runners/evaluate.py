"""Avaliador executado exclusivamente dentro do Python do navegador."""
import ast
import asyncio
import builtins
import contextlib
import copy
import dataclasses
import inspect
import io
import json
import math
import os
from pathlib import Path
import pprint
import re
import sqlite3
import sys
import tempfile
import time
import traceback
import types
import unittest
from unittest import mock


MAX_OUTPUT = 10000
is_close = math.isclose


class BoundedOutput(io.StringIO):
    def write(self, text):
        remaining = MAX_OUTPUT - self.tell()
        if len(text) > remaining:
            super().write(text[:max(0, remaining)])
            raise ValueError("A saída excedeu 10.000 caracteres.")
        return super().write(text)


def numeric_output(output):
    return [float(value.replace(",", ".")) for value in re.findall(r"(?<!\w)[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?", output)]


class CaseMismatch(AssertionError):
    """Divergência com valores obtido e esperado, exibidos lado a lado ao aluno."""
    def __init__(self, message, got, expected):
        super().__init__(message)
        self.got = got
        self.expected = expected


def format_value(value, limit=600):
    text = value if isinstance(value, str) else pprint.pformat(value, width=60, compact=True)
    return text if len(text) <= limit else text[:limit] + "…"


def number_text(value):
    return str(int(value)) if isinstance(value, float) and value.is_integer() else str(value)


def expect_number(output, expected):
    values = numeric_output(output)
    if not (values and is_close(values[-1], expected, abs_tol=1e-9)):
        shown = output.strip() or "(nada foi impresso)"
        raise CaseMismatch(f"O resultado esperado para esta entrada é {number_text(expected)}.", shown, number_text(expected))


def expect_error(error, fn, *args):
    try:
        fn(*args)
    except error:
        return
    raise AssertionError(f"Era esperado um erro {error.__name__} nesta condição.")


def check_student_tests(student):
    def run_tests():
        suite = unittest.TestLoader().loadTestsFromModule(student)
        assert suite.countTestCases() > 0, "Defina testes unittest em uma classe TestCase."
        return unittest.TextTestRunner(stream=BoundedOutput()).run(suite).wasSuccessful()

    assert run_tests(), "Os testes unittest precisam passar com sua implementação."
    original = student.aplicar_desconto
    mutations = [
        ("desconto normal", lambda value, pct: value >= 0 and 0 < pct < 100, lambda value, _pct: value),
        ("percentual zero", lambda value, pct: value >= 0 and pct == 0, lambda value, _pct: value + 1),
        ("desconto total", lambda value, pct: value >= 0 and pct == 100, lambda value, _pct: 1),
        ("valor negativo", lambda value, _pct: value < 0, lambda _value, _pct: 0),
        ("percentual inválido", lambda _value, pct: not 0 <= pct <= 100, lambda _value, _pct: 0),
    ]
    for label, applies, incorrect in mutations:
        def mutant(valor, percentual):
            return incorrect(valor, percentual) if applies(valor, percentual) else original(valor, percentual)
        with mock.patch.object(student, "aplicar_desconto", mutant):
            assert not run_tests(), f"Adicione um teste que detecte uma falha de {label}."


class AsyncRunToAwait(ast.NodeTransformer):
    """Adapta asyncio.run(...) no nível do script ao loop do navegador."""
    def __init__(self, tree):
        self.module_names = {"asyncio"}
        self.run_names = set()
        for item in ast.walk(tree):
            if isinstance(item, ast.Import):
                self.module_names.update(name.asname or name.name for name in item.names if name.name == "asyncio")
            if isinstance(item, ast.ImportFrom) and item.module == "asyncio":
                self.run_names.update(name.asname or name.name for name in item.names if name.name == "run")

    def visit_FunctionDef(self, node):
        return node

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_ClassDef = visit_FunctionDef

    def visit_Call(self, node):
        function = node.func
        named = isinstance(function, ast.Name) and function.id in self.run_names
        qualified = isinstance(function, ast.Attribute) and function.attr == "run" and isinstance(function.value, ast.Name) and function.value.id in self.module_names
        if (named or qualified) and len(node.args) == 1 and not node.keywords:
            return ast.copy_location(ast.Await(self.visit(node.args[0])), node)
        return self.generic_visit(node)


PYTHON_HINTS = (
    (IndentationError, "A indentação está incorreta. Use 4 espaços em cada bloco e mantenha o mesmo recuo em todas as linhas dele."),
    (SyntaxError, "Erro de sintaxe: confira parênteses e aspas que foram abertos e não fechados, os dois-pontos no fim de if, for e def, e a grafia das palavras-chave."),
    (NameError, "Esse nome não existe neste ponto. Confira a digitação (maiúsculas e minúsculas contam) e se a variável ou função foi criada antes de ser usada."),
    (TypeError, "Uma operação recebeu tipos incompatíveis. Lembre que input() devolve texto: converta com int() ou float() antes de calcular."),
    (ValueError, "O valor recebido não tem o formato esperado. Confira a conversão (int, float) e os dados lidos."),
    (ZeroDivisionError, "Houve divisão por zero. Trate esse caso antes de dividir."),
    (IndexError, "O índice está fora da lista. Lembre que a contagem começa em 0 e termina em len(lista) - 1."),
    (KeyError, "A chave não existe no dicionário. Confira a grafia ou use .get(chave) para ter um valor padrão."),
    (AttributeError, "Esse objeto não tem o método ou atributo usado. Confira o nome e o tipo do valor."),
    (EOFError, "O código chamou input() mais vezes do que há entradas no teste. Leia apenas as entradas pedidas no enunciado."),
    (RecursionError, "A recursão não termina. Defina um caso-base que pare as chamadas."),
)


BRACKETS = {"(": "parêntese", "[": "colchete", "{": "chave"}
STATEMENTS = {
    "'if' statement": "o if", "'elif' statement": "o elif", "'else' statement": "o else", "'for' statement": "o for",
    "'while' statement": "o while", "'try' statement": "o try", "'except' statement": "o except", "'with' statement": "o with",
    "function definition": "a definição da função (def)", "class definition": "a definição da classe (class)",
}
SYNTAX_MESSAGES = (
    (r"'(.)' was never closed", lambda m: f"O {BRACKETS.get(m[1], 'delimitador')} “{m[1]}” aberto aqui nunca foi fechado. Feche-o antes do fim da instrução."),
    (r"unterminated string literal", lambda m: "O texto entre aspas não foi fechado. Termine o texto com a mesma aspa, na mesma linha."),
    (r"unterminated triple-quoted string", lambda m: "O texto com aspas triplas não foi fechado. Termine-o com as mesmas três aspas."),
    (r"expected ':'", lambda m: "Falta o sinal de dois-pontos (:) no fim desta linha."),
    (r"expected an indented block after (.+?) on line (\d+)", lambda m: f"Depois de {STATEMENTS.get(m[1], m[1])} (linha {m[2]}), o bloco precisa de recuo. Use 4 espaços."),
    (r"unexpected indent", lambda m: "Esta linha tem mais recuo do que o esperado. Alinhe-a com o bloco anterior."),
    (r"unindent does not match", lambda m: "O recuo desta linha não coincide com nenhum bloco anterior. Use sempre 4 espaços por nível."),
    (r"Missing parentheses in call to 'print'", lambda m: "Em Python 3, print é uma função: escreva print(...) com parênteses."),
    (r"'return' outside function", lambda m: "return só pode ser usado dentro de uma função (def)."),
    (r"invalid character '(.+?)' \(U\+([0-9A-F]+)\)", lambda m: f"O caractere «{m[1]}» não é aceito no código. Troque aspas curvas e traços especiais por aspas retas (\" ou ') e sinais comuns."),
    (r"invalid decimal literal", lambda m: "Há um número colado em letras (como 2x). Separe com um operador, por exemplo 2 * x."),
    (r"cannot assign to (.+?) here", lambda m: f"Não é possível atribuir um valor a {m[1]}. Para comparar, use ==; para guardar um valor, use um nome de variável à esquerda do =."),
    (r"expected 'except' or 'finally' block", lambda m: "O bloco try precisa de um except (ou finally) logo depois."),
    (r"positional argument follows keyword argument", lambda m: "Argumentos nomeados (nome=valor) devem vir depois dos posicionais."),
    (r"invalid syntax", lambda m: "O Python não entendeu esta instrução. Confira palavras-chave, vírgulas, dois-pontos, operadores e fechamento de parênteses."),
)
RUNTIME_MESSAGES = (
    (NameError, r"name '(.+?)' is not defined", lambda m: f"O nome “{m[1]}” não existe neste ponto. Crie a variável ou função antes de usá-la e confira a grafia."),
    (ZeroDivisionError, r".*", lambda m: "Houve divisão por zero."),
    (ValueError, r"invalid literal for int\(\) with base 10: (.+)", lambda m: f"Não é possível converter {m[1]} para inteiro. Verifique se o texto lido contém só dígitos."),
    (ValueError, r"could not convert string to float: (.+)", lambda m: f"Não é possível converter {m[1]} para número decimal."),
    (TypeError, r"unsupported operand type\(s\) for (.+?): '(.+?)' and '(.+?)'", lambda m: f"A operação {m[1]} não aceita {m[2]} com {m[3]}. Converta os valores para o mesmo tipo (int() ou float())."),
    (TypeError, r"can only concatenate str \(not \"(.+?)\"\) to str", lambda m: f"Só é possível juntar texto com texto, mas veio {m[1]}. Converta com str() ou use uma f-string."),
    (TypeError, r"missing (\d+) required positional argument", lambda m: "A função foi chamada com menos argumentos do que declara."),
    (TypeError, r"'(.+?)' object is not callable", lambda m: f"Um valor do tipo {m[1]} foi usado como função. Confira se um nome de função foi sobrescrito por uma variável."),
    (IndexError, r".*", lambda m: "O índice está fora dos limites da sequência."),
    (KeyError, r".*", lambda m: "A chave procurada não existe no dicionário."),
    (AttributeError, r"'(.+?)' object has no attribute '(.+?)'", lambda m: f"Um valor do tipo {m[1]} não tem o atributo ou método “{m[2]}”."),
    (EOFError, r".*", lambda m: "O código chamou input() mais vezes do que o teste fornece."),
    (RecursionError, r".*", lambda m: "A recursão não termina. Defina um caso-base."),
)


def translate_message(pairs, message):
    for pattern, build in pairs:
        found = re.search(pattern, message)
        if found:
            return build(found)
    return ""


def translate_runtime(exc):
    message = str(exc)
    for kind, pattern, build in RUNTIME_MESSAGES:
        if isinstance(exc, kind):
            found = re.search(pattern, message)
            if found:
                return build(found)
    return ""


def explain_python_error(exc, source):
    """Localiza a linha do aluno e explica a mensagem em português; retorna (texto, detalhe)."""
    hint = next((text for kind, text in PYTHON_HINTS if isinstance(exc, kind)), "")
    lines = source.splitlines()

    def line_text(number):
        return lines[number - 1].strip() if number and 0 < number <= len(lines) else ""

    syntax = isinstance(exc, SyntaxError)
    if syntax:
        number = exc.lineno
        original = f"{type(exc).__name__}: {exc.msg}"
        explanation = translate_message(SYNTAX_MESSAGES, exc.msg or "") or "O Python não conseguiu interpretar este trecho. Confira a escrita desta linha."
        kind = "Erro de indentação" if isinstance(exc, IndentationError) else "Erro de sintaxe"
        code = (exc.text or "").strip() or line_text(number)
    else:
        frames = [frame for frame in traceback.extract_tb(exc.__traceback__) if frame.filename == "exercicio.py"]
        number = frames[-1].lineno if frames else None
        original = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        if not frames:
            return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__, limit=-3)), {"kind": "Erro durante a execução", "original": original}
        explanation = translate_runtime(exc) or hint
        kind = "Erro durante a execução"
        code = line_text(number)
    where = f"Linha {number}: {code}\n" if number and code else ""
    text = f"{where}{explanation}\n{original}" if syntax else f"{where}{original}" + (f"\nDica: {hint}" if hint else "")
    detail = {"kind": kind, "explanation": explanation, "original": original}
    if number:
        detail["line"] = number
    if code:
        detail["code"] = code[:300]
    return text, detail


class CheckRewriter(ast.NodeTransformer):
    """Registra os dois lados de `assert a == b` para mostrar obtido e esperado."""
    def visit_Assert(self, node):
        test = node.test
        if isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.Eq):
            call = ast.Call(
                func=ast.Name("_compare", ast.Load()),
                args=[test.left, test.comparators[0], ast.Constant(ast.unparse(test.left))],
                keywords=[],
            )
            node.test = ast.copy_location(call, test)
        return node


def prepare_check(source):
    tree = ast.fix_missing_locations(CheckRewriter().visit(ast.parse(source, "<check>")))
    return compile(tree, "<check>", "exec")


def mismatch_detail(exc, mismatch, case, output, message):
    """Entrada de exemplo, saída obtida e saída esperada de uma verificação que falhou."""
    typed = case.get("input") or []
    detail = {"kind": "Resultado diferente do esperado", "explanation": message}
    if isinstance(exc, CaseMismatch):
        detail.update(kind="Saída diferente do esperado", got=format_value(exc.got), expected=format_value(exc.expected))
    elif mismatch:
        detail.update(kind="Resultado diferente do esperado", got=format_value(mismatch["got"]), expected=format_value(mismatch["expected"]))
        if not typed:
            detail["input"] = mismatch["call"][:400]
    elif output.strip():
        detail.update(kind="Saída fora do esperado", got=format_value(output))
    if typed:
        detail["input"] = "\n".join(typed) if any(typed) else "(apenas Enter)"
    elif "input" not in detail and not mismatch and "got" in detail:
        detail["input"] = "(nenhuma entrada)"
    return detail


async def evaluate_python_case(source, case, challenge_id):
    out = BoundedOutput()
    pauses = []
    answers = iter(case.get("input", []))
    timings = {"active": 0, "count": 0, "peak": 0, "semaphore": False, "blocking": False}

    def simulated_input(_prompt=""):
        pauses.append(out.tell())
        try:
            return next(answers)
        except StopIteration:
            raise EOFError("O código pediu mais entradas do que o caso de teste fornece.") from None

    original_sleep = asyncio.sleep
    original_semaphore = asyncio.Semaphore

    async def observed_sleep(delay, result=None):
        assert is_close(delay, 0.1), "As tarefas devem esperar 0,1 segundo."
        timings["active"] += 1
        timings["count"] += 1
        timings["peak"] = max(timings["peak"], timings["active"])
        try:
            return await original_sleep(delay, result)
        finally:
            timings["active"] -= 1

    class ObservedSemaphore(original_semaphore):
        def __init__(self, value=1):
            assert value == 2, "Configure o semáforo com duas vagas."
            timings["semaphore"] = True
            super().__init__(value)

    def forbidden_sleep(*_args, **_kwargs):
        timings["blocking"] = True
        raise AssertionError("Use asyncio.sleep em tarefas assíncronas.")

    student = types.ModuleType("__main__")
    student.__file__ = "exercicio.py"
    student.__dict__["__builtins__"] = dict(vars(builtins), input=simulated_input)
    cwd = os.getcwd()
    error = None
    detail = None
    mismatch = {}

    def compare(left, right, text):
        equal = left == right
        if not equal:
            mismatch.update(got=left, expected=right, call=text)
        return equal

    try:
        tree = ast.parse(source, "exercicio.py")
        running_async = challenge_id == "python-advanced-4"
        if running_async:
            tree = ast.fix_missing_locations(AsyncRunToAwait(tree).visit(tree))
        program = compile(tree, "exercicio.py", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        with tempfile.TemporaryDirectory() as directory, contextlib.ExitStack() as stack:
            os.chdir(directory)
            try:
                stack.enter_context(contextlib.redirect_stdout(out))
                stack.enter_context(contextlib.redirect_stderr(out))
                stack.enter_context(mock.patch.dict(sys.modules, {"__main__": student}))
                stack.enter_context(mock.patch.object(sys, "argv", ["exercicio.py"]))
                if running_async:
                    stack.enter_context(mock.patch.object(asyncio, "sleep", observed_sleep))
                    stack.enter_context(mock.patch.object(asyncio, "Semaphore", ObservedSemaphore))
                    stack.enter_context(mock.patch.object(time, "sleep", forbidden_sleep))
                try:
                    result = eval(program, student.__dict__)
                    if inspect.isawaitable(result):
                        await result
                except SystemExit as exc:
                    if challenge_id != "python-advanced-5" or exc.code not in (None, 0):
                        raise AssertionError(f"O programa encerrou com código {exc.code}.") from exc
                output = out.getvalue()
                checks = dict(globals(), student=student, output=output, pauses=pauses, timings=timings, tree=tree, _compare=compare)
                exec(prepare_check(case["check"]), checks)
            finally:
                os.chdir(cwd)
    except AssertionError as exc:
        error = str(exc) or "O resultado não atende a este cenário. Confira as entradas e a regra do exercício."
        detail = mismatch_detail(exc, mismatch, case, out.getvalue(), error)
    except BaseException as exc:
        error, detail = explain_python_error(exc, source)
        if out.getvalue().strip():
            detail["got"] = out.getvalue()[:1500]
    result = {"label": case["label"], "passed": error is None, "feedback": (error or "Resultado correto.")[:1600]}
    if detail and error is not None:
        result["detail"] = detail
    return result, out.getvalue()


def sql_statements(source):
    start = 0
    for index, character in enumerate(source):
        if character == ";" and sqlite3.complete_statement(source[start:index + 1]):
            yield source[start:index + 1]
            start = index + 1
    if source[start:].strip():
        yield source[start:]


def collect(cursor):
    if cursor.description is None:
        return None
    rows = cursor.fetchmany(151)
    if len(rows) > 150:
        raise ValueError("A consulta retornou mais de 150 linhas de treino.")
    return tuple(col[0].casefold() for col in cursor.description), rows


def sql_connection(setup, variant):
    connection = sqlite3.connect(":memory:", isolation_level=None, cached_statements=0)
    connection.executescript(setup + "\n" + variant)
    connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1_000_000)
    connection.setlimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
    steps = 0

    def budget():
        nonlocal steps
        steps += 1
        return 1 if steps > 500 else 0

    connection.set_progress_handler(budget, 1000)
    return connection


def execute_readonly(connection, source):
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
    connection.set_authorizer(lambda action, *_: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)
    results = []
    for statement in sql_statements(source):
        result = collect(connection.execute(statement))
        if result is not None:
            results.append(result)
    assert len(results) == 1, "Retorne uma única consulta com as colunas solicitadas."
    return results[0]


REQUIRED_ALIASES = {
    "sql-first_steps-5": {"total_pessoas"},
    "sql-basic-2": {"valor_estoque_centavos"},
    "sql-basic-3": {"quantidade_produtos"},
    "sql-basic-3~v1": {"quantidade_chamados"},
    "sql-basic-4": {"quantidade_produtos"},
    "sql-intermediate-3": {"total_pago_centavos"},
    "sql-intermediate-5": {"mes", "quantidade", "total_centavos"},
    "sql-advanced-1": {"total_pago_centavos", "posicao"},
    "sql-advanced-2": {"total_dia", "acumulado_centavos"},
    "sql-advanced-4": {"nivel"},
}
REQUIRED_SQL = {
    "sql-advanced-1": (r"\bWITH\b", r"\bDENSE_RANK\s*\("),
    "sql-advanced-2": (r"\bOVER\s*\(", r"\bROWS\b"),
    "sql-advanced-3": (r"\bROW_NUMBER\s*\(",),
    "sql-advanced-4": (r"\bWITH\s+RECURSIVE\b",),
}


def sql_tokens(source):
    return re.sub(r"""--[^\n]*|/\*[\s\S]*?\*/|'(?:''|[^'])*'|"(?:""|[^"])*"|\x60[^\x60]*\x60|\[[^\]]*\]""", " ", source).upper()


class SqlMismatch(AssertionError):
    """Divergência de SQL com tipo, explicação e as duas tabelas para comparação."""
    def __init__(self, kind, message, got, expected):
        super().__init__(message)
        self.kind = kind
        self.got = got
        self.expected = expected


def table_detail(result):
    columns, rows = result
    return {
        "columns": list(columns)[:12],
        "rows": [[("NULL" if value is None else str(value))[:60] for value in row[:12]] for row in rows[:6]],
        "total": len(rows),
    }


def compare_sql(connection, source, reference, exercise):
    expected = execute_readonly(connection, reference)
    got = execute_readonly(connection, source)
    expected_cols, expected_rows = expected
    columns, rows = got

    def mismatch(kind, message):
        return SqlMismatch(kind, message, got, expected)

    if len(columns) != len(expected_cols):
        missing = [name for name in expected_cols if name not in columns]
        extra = [name for name in columns if name not in expected_cols]
        parts = [f"O enunciado pede {len(expected_cols)} coluna(s) e sua consulta retornou {len(columns)}."]
        if len(columns) < len(expected_cols):
            parts.append("Faltam colunas: " + (", ".join(missing) if missing else "confira o enunciado") + ".")
        else:
            parts.append("Há colunas a mais: " + (", ".join(extra) if extra else "confira o enunciado") + ".")
        raise mismatch("Colunas diferentes do esperado", " ".join(parts))
    for index, name in enumerate(expected_cols):
        if name in REQUIRED_ALIASES.get(exercise, set()) and columns[index] != name:
            raise mismatch("Nome de coluna diferente", f"Dê o apelido {name} (AS {name}) à coluna {index + 1}. Hoje ela se chama {columns[index]}.")
    if columns != expected_cols and len(set(columns)) == len(columns) and set(columns) == set(expected_cols):
        raise mismatch("Colunas fora de ordem", "As colunas certas estão presentes, mas em outra ordem. Siga a ordem citada no enunciado.")
    if exercise == "sql-advanced-3":
        rows_equal = sorted(rows, key=repr) == sorted(expected_rows, key=repr)
    else:
        rows_equal = rows == expected_rows
    if not rows_equal and sorted(rows, key=repr) == sorted(expected_rows, key=repr):
        raise mismatch("Ordem incorreta", "As linhas estão certas, mas a ordem é diferente da pedida. Sem ORDER BY o SQL não garante a ordem: ordene exatamente como o enunciado indica.")
    if not rows_equal:
        if len(rows) < len(expected_rows):
            message = f"Faltam {len(expected_rows) - len(rows)} linha(s) no seu resultado. Revise filtros (WHERE/HAVING) e junções que descartam linhas."
        elif len(rows) > len(expected_rows):
            message = f"Há {len(rows) - len(expected_rows)} linha(s) a mais. Revise filtros, junções que repetem linhas e a necessidade de DISTINCT ou GROUP BY."
        else:
            message = "O número de linhas está certo, mas há valores diferentes. Compare as células destacadas."
        raise mismatch("Resultado divergente", message)
    for pattern in REQUIRED_SQL.get(exercise, ()):
        if not re.search(pattern, sql_tokens(source)):
            raise mismatch("Técnica pedida ausente", "A consulta precisa usar a técnica pedida no enunciado, mesmo que o resultado já pareça igual.")
    return columns, rows


def transaction_sql(connection, source, expected_during):
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
    actions = []
    read_stock = False

    def authorize(action, first, second, *_rest):
        nonlocal read_stock
        if action == sqlite3.SQLITE_READ and first == "produtos" and second == "estoque":
            read_stock = True
        if action in allowed:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_TRANSACTION and first in {"BEGIN", "ROLLBACK"}:
            actions.append(first)
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_UPDATE and first == "produtos" and second == "estoque" and connection.in_transaction:
            actions.append("UPDATE")
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY

    original = connection.execute("SELECT * FROM produtos ORDER BY id").fetchall()
    connection.set_authorizer(authorize)
    checked = False
    output = None
    for statement in sql_statements(source):
        read_stock = False
        cursor = connection.execute(statement)
        result = collect(cursor)
        consulted_stock = read_stock
        if result is not None:
            output = result
        if connection.in_transaction and actions[-1:] == ["UPDATE"]:
            during = connection.execute("SELECT * FROM produtos ORDER BY id").fetchall()
            assert during == [(*original[0][:-1], expected_during), *original[1:]], "Durante a transação, altere somente o estoque do Caderno quando houver unidades suficientes."
            if consulted_stock and result is not None and any(row in {(1, expected_during), (expected_during,)} for row in result[1]):
                checked = True
    assert actions == ["BEGIN", "UPDATE", "ROLLBACK"] and not connection.in_transaction, "Use BEGIN, UPDATE e ROLLBACK nesta ordem."
    assert checked, "Consulte o estoque do Caderno antes de executar ROLLBACK."
    assert connection.execute("SELECT * FROM produtos ORDER BY id").fetchall() == original, "ROLLBACK deve restaurar todo o estoque."
    return output


def display_rows(result):
    if result is None:
        return ""
    columns, rows = result
    table = [" | ".join(columns)]
    table.extend(" | ".join(str(value)[:140] if value is not None else "NULL" for value in row) for row in rows[:25])
    if len(rows) > 25:
        table.append(f"… {len(rows) - 25} linhas adicionais")
    return "\n".join(table)[:MAX_OUTPUT]


def explain_sql_error(connection, message):
    """Traduz erros comuns do SQLite; retorna (tipo, explicação)."""
    def available(kind):
        connection.set_authorizer(None)
        tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        if kind == "tables":
            return ", ".join(tables)
        return ", ".join(f"{table}.{column[1]}" for table in tables for column in connection.execute(f'PRAGMA table_info("{table}")'))

    try:
        found = re.search(r"no such table: (\S+)", message)
        if found:
            return "Tabela inexistente", f'A tabela "{found[1]}" não existe neste exercício. Tabelas disponíveis: {available("tables")}. Confira a grafia.'
        found = re.search(r"no such column: (\S+)", message)
        if found:
            return "Coluna inexistente", f'A coluna "{found[1]}" não existe. Colunas disponíveis: {available("columns")}.'
        found = re.search(r"ambiguous column name: (\S+)", message)
        if found:
            return "Coluna ambígua", f'A coluna "{found[1]}" existe em mais de uma tabela. Indique de qual tabela ela vem, por exemplo apelido.{found[1]}.'
    except sqlite3.Error:
        pass
    found = re.search(r'near "([^"]*)": syntax error', message)
    if found:
        return "Erro de sintaxe", f'Erro de sintaxe perto de "{found[1]}". Confira a grafia das palavras-chave (SELECT, FROM, WHERE...), as vírgulas entre colunas e os parênteses.'
    if "incomplete input" in message:
        return "Erro de sintaxe", "A consulta está incompleta. Confira se falta alguma cláusula (como FROM ou ORDER BY), algum parêntese ou o ponto e vírgula final."
    if "aggregate" in message and "WHERE" in message:
        return "Agregação no lugar errado", "Funções de agregação, como COUNT e SUM, não podem ficar no WHERE. Use HAVING para filtrar grupos."
    if "misuse of aggregate" in message:
        return "Agregação no lugar errado", "Uma função de agregação foi usada onde não é permitida. Para filtrar o resultado de COUNT ou SUM, use HAVING."
    found = re.search(r"no such function: (\S+)", message)
    if found:
        return "Função inexistente", f'A função "{found[1]}" não existe no SQLite. Confira a grafia.'
    if "unrecognized token" in message:
        return "Erro de sintaxe", "Há um trecho que o SQLite não reconhece. Textos devem ficar entre aspas simples, como 'Ana'."
    return "Erro ao executar o SQL", message


def evaluate_sql_case(request, variant, label):
    connection = sql_connection(request["setup"], request["variant"] if variant else "")
    try:
        if variant:
            connection.execute("PRAGMA reverse_unordered_selects=ON")
        if request["id"] == "sql-advanced-5":
            result = transaction_sql(connection, request["draft"], 1 if variant else 8)
        else:
            result = compare_sql(connection, request["draft"], request["reference"], request["id"])
        return {"label": label, "passed": True, "feedback": "Resultado correto no banco de treino."}, display_rows(result)
    except (AssertionError, ValueError, sqlite3.Error) as exc:
        error = str(exc) or "A consulta não atende a este cenário."
        detail = {"kind": "Consulta fora do formato pedido", "explanation": error}
        if isinstance(exc, SqlMismatch):
            detail = {"kind": exc.kind, "explanation": error, "gotTable": table_detail(exc.got), "expectedTable": table_detail(exc.expected)}
        elif "not authorized" in error:
            error = "Este exercício limita as instruções às operações pedidas no enunciado."
            detail = {"kind": "Instrução não permitida", "explanation": error}
        elif isinstance(exc, sqlite3.Error):
            kind, error = explain_sql_error(connection, error)
            detail = {"kind": kind, "explanation": error, "original": str(exc)[:300]}
        return {"label": label, "passed": False, "feedback": error[:1600], "detail": detail}, ""
    finally:
        connection.close()


async def evaluate(request):
    cases = []
    output = ""
    if request["track"] == "python":
        for case in request["tests"]:
            result, sample = await evaluate_python_case(request["draft"], case, request["id"])
            cases.append(result)
            output = output or sample
    else:
        for variant, label in [(False, "Dados do enunciado"), (True, "Dados de verificação adicionais")]:
            result, sample = evaluate_sql_case(request, variant, label)
            cases.append(result)
            output = output or sample
    passed = sum(case["passed"] for case in cases)
    return json.dumps({
        "passed": passed == len(cases) and len(cases) > 0,
        "summary": f"{passed} de {len(cases)} verificações passaram." if len(cases) != 1 else f"{passed} de 1 verificação passou.",
        "cases": cases,
        "output": output[:MAX_OUTPUT],
    }, ensure_ascii=False)
