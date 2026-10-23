// Executa o código do aluno em um namespace novo e compara cada caso de teste.
// Também usado pelo teste que valida os gabaritos com o Python local.
// _run: laboratório clássico (compara com os casos esperados). _collect e _exec:
// mundo do EvoQuest (só devolvem valores/saída; o gabarito fica num hash).
export const HARNESS = String.raw`
import json, math, traceback

def _eq(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-6)
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(map(str, a)) == set(map(str, b)) and all(_eq(a[k], b.get(k, b.get(str(k)))) for k in a)
    return a == b

def _plain(v):
    try:
        import numpy as np
        if isinstance(v, np.generic):
            return v.item()
    except ImportError:
        pass
    if hasattr(v, 'tolist'):
        return v.tolist()
    if hasattr(v, 'to_dict'):
        return v.to_dict()
    return v

def _run(source, entry, tests_json):
    ns = {}
    out = []
    try:
        exec(compile(source, '<seu codigo>', 'exec'), ns)
    except Exception:
        return json.dumps({'error': traceback.format_exc(limit=1)})
    fn = ns.get(entry)
    if not callable(fn):
        return json.dumps({'error': 'Defina a funcao ' + entry + '(...).'})
    for t in json.loads(tests_json):
        try:
            got = _plain(fn(*t['args']))
            out.append({'ok': bool(_eq(got, t['expected'])), 'got': repr(got)})
        except Exception as e:
            out.append({'ok': False, 'got': type(e).__name__ + ': ' + str(e)})
    return json.dumps({'results': out})

def _jsonable(v):
    # Forma serializavel e estavel: tuplas/conjuntos viram listas, NaN vira None,
    # chaves de dicionario viram texto (como no JSON).
    v = _plain(v)
    if isinstance(v, float) and v != v:
        return None
    if isinstance(v, (set, frozenset)):
        return sorted((_jsonable(x) for x in v), key=repr)
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    return v

def _collect(source, entry, args_json):
    # Mundo (EvoQuest RPG): executa a funcao em cada caso e devolve os VALORES.
    # O gabarito nao vem junto: o navegador compara o hash do resultado.
    ns = {}
    try:
        exec(compile(source, '<seu codigo>', 'exec'), ns)
    except Exception:
        return json.dumps({'error': traceback.format_exc(limit=1)})
    fn = ns.get(entry)
    if not callable(fn):
        return json.dumps({'error': 'Defina a funcao ' + entry + '(...).'})
    out = []
    for args in json.loads(args_json):
        try:
            out.append({'value': _jsonable(fn(*args))})
        except Exception as e:
            out.append({'error': type(e).__name__ + ': ' + str(e)})
    return json.dumps({'results': out}, default=str)

def _exec(source):
    # Exemplo resolvido da ficha de campo: roda e devolve o que foi impresso.
    import io, contextlib
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(source, '<exemplo>', 'exec'), {})
    except Exception:
        return json.dumps({'error': traceback.format_exc(limit=1), 'stdout': buf.getvalue()})
    return json.dumps({'stdout': buf.getvalue()})
`
