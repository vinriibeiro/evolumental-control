// Executado como módulo em um worker cujo proprietário tem origem opaca.
function objectUrl(data, type) {
  return URL.createObjectURL(new Blob([data], { type }))
}

self.onmessage = async ({ data }) => {
  self.onmessage = null
  const { files, harness, request } = data
  const indexURL = 'https://practice-runtime.invalid/'
  const urls = [
    objectUrl(files[0], 'text/javascript'),
    objectUrl(files[1], 'text/javascript'),
  ]
  // A inicialização do Pyodide busca estes dois recursos. Responda diretamente
  // com os bytes transferidos, sem liberar conexões no sandbox.
  self.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === indexURL + 'pyodide.asm.wasm') {
      return new Response(files[2], { headers: { 'Content-Type': 'application/wasm' } })
    }
    if (url === indexURL + 'python_stdlib.zip') {
      return new Response(files[3], { headers: { 'Content-Type': 'application/zip' } })
    }
    throw new TypeError('O ambiente de prática não tem acesso à rede.')
  }
  try {
    const [{ loadPyodide }, { default: createModule }] = await Promise.all([
      import(urls[0]),
      import(urls[1]),
    ])
    const runtime = await loadPyodide({
      indexURL,
      lockFileContents: new TextDecoder().decode(files[4]),
      createPyodideModule: createModule,
      enableRunUntilComplete: false,
      jsglobals: Object.create(null),
      stdin: () => null,
      stdout: () => {},
      stderr: () => {},
    })
    runtime.globals.set('practice_request_json', JSON.stringify(request))
    self.postMessage({ kind: 'running' })
    const json = await runtime.runPythonAsync(harness + '\nawait evaluate(json.loads(practice_request_json))')
    const result = JSON.parse(json)
    // O Python conta pontos de código. O limite da interface é em UTF-16.
    result.output = result.output.slice(0, 10_000)
    for (const entry of result.cases) entry.feedback = entry.feedback.slice(0, 1600)
    self.postMessage({ kind: 'result', result })
  } catch (error) {
    self.postMessage({ kind: 'error', message: String(error?.message || error).slice(0, 1000) })
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url))
    self.close()
  }
}
