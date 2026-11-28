import workerSource from './runtime.mjs?raw'
import evaluator from './evaluate.py?raw'
import type { PracticeResult } from './index'

// O iframe tem origem opaca. Os blobs só podem ser lidos pelo próprio sandbox.
// A página pai transfere bytes públicos do runtime, sem tokens, URLs ou dados de conta.
const SANDBOX_HTML = `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<script>
function start(event) {
  if (event.source !== parent || event.data?.kind !== 'practice-start' || !event.ports[0]) return;
  removeEventListener('message', start);
  const port = event.ports[0];
  const { workerSource, harness, files, request } = event.data;
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  let worker;
  const stop = () => {
    worker?.terminate();
    URL.revokeObjectURL(url);
    port.postMessage({ kind: 'stopped' });
    port.close();
  };
  port.onmessage = (message) => { if (message.data?.kind === 'stop') stop(); };
  try {
    // Módulos importados por import() funcionam dentro de workers clássicos.
    // O worker principal blob em um iframe opaco precisa ser clássico no Chromium.
    worker = new Worker(url);
    worker.onmessage = ({ data }) => port.postMessage(data);
    worker.onerror = (error) => port.postMessage({ kind: 'error', message: error.message || 'O ambiente do navegador foi interrompido.' });
    worker.postMessage({ harness, files, request }, files);
  } catch {
    port.postMessage({ kind: 'error', message: 'O navegador não conseguiu iniciar o ambiente isolado.' });
  }
}
addEventListener('message', start);
</script>
</html>`

const assets = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']
// A inicialização compila o WebAssembly sem cache e chega a 40 s em computadores comuns.
const startupBudget = 120_000
const executionBudget = 8_000

function validResult(value: unknown): value is PracticeResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<PracticeResult>
  if (typeof result.passed !== 'boolean' || typeof result.summary !== 'string' || result.summary.length > 300) return false
  if (result.output !== undefined && (typeof result.output !== 'string' || result.output.length > 10_000)) return false
  if (!Array.isArray(result.cases) || result.cases.length === 0 || result.cases.length > 10) return false
  return result.cases.every((entry) =>
    entry && typeof entry.label === 'string' && entry.label.length <= 160 &&
    typeof entry.passed === 'boolean' && typeof entry.feedback === 'string' && entry.feedback.length <= 1_600,
  ) && result.passed === result.cases.every((entry) => entry.passed)
}

async function loadRuntime(signal: AbortSignal) {
  const base = new URL('practice-runtime/', new URL(import.meta.env.BASE_URL, window.location.href))
  return Promise.all(assets.map(async (file) => {
    const response = await fetch(new URL(file, base), { credentials: 'omit', signal })
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('O ambiente de execução está indisponível. Verifique a conexão e tente novamente.')
    }
    return response.arrayBuffer()
  }))
}

export function runSandbox(request: unknown, signal?: AbortSignal): Promise<PracticeResult> {
  return new Promise<PracticeResult>((resolve, reject) => {
    const controller = new AbortController()
    let frame: HTMLIFrameElement | undefined
    let port: MessagePort | undefined
    let timer: ReturnType<typeof setTimeout>
    let settled = false
    let running = false
    let deadline = performance.now() + startupBudget

    const cleanup = () => {
      controller.abort()
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      const dispose = () => {
        port?.close()
        frame?.remove()
      }
      if (port) {
        const fallback = setTimeout(dispose, 200)
        port.onmessage = (event) => {
          if (event.data?.kind === 'stopped') {
            clearTimeout(fallback)
            dispose()
          }
        }
        port.postMessage({ kind: 'stop' })
      } else dispose()
    }

    const finish = (result: PracticeResult | Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (result instanceof Error) reject(result)
      else resolve(result)
    }

    const expire = () => finish(new Error(running
      ? 'Tempo de execução excedido. Revise laços, recursão ou consultas muito grandes.'
      : 'O ambiente demorou para iniciar. Tente novamente.'))
    const abort = () => finish(new DOMException('Execução cancelada.', 'AbortError'))
    if (signal?.aborted) { abort(); return }
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(expire, startupBudget)

    void loadRuntime(controller.signal).then((files) => {
      if (settled) return
      const iframe = document.createElement('iframe')
      iframe.hidden = true
      iframe.title = 'Ambiente isolado de prática'
      iframe.setAttribute('sandbox', 'allow-scripts')
      iframe.referrerPolicy = 'no-referrer'
      iframe.srcdoc = SANDBOX_HTML
      frame = iframe
      iframe.addEventListener('load', () => {
        if (settled || !iframe.contentWindow) return
        const channel = new MessageChannel()
        port = channel.port1
        channel.port1.onmessage = ({ data }) => {
          if (settled) return
          if (performance.now() >= deadline) { expire(); return }
          if (data?.kind === 'running' && !running) {
            running = true
            deadline = performance.now() + executionBudget
            clearTimeout(timer)
            timer = setTimeout(expire, executionBudget)
          } else if (data?.kind === 'result') {
            finish(running && validResult(data.result) ? data.result : new Error('O ambiente retornou um resultado inválido.'))
          } else if (data?.kind === 'error') {
            finish(new Error(typeof data.message === 'string' && data.message ? data.message.slice(0, 1000) : 'Não foi possível executar neste navegador.'))
          }
        }
        // A origem opaca exige "*". Somente o iframe recém-criado recebe o canal.
        iframe.contentWindow.postMessage({ kind: 'practice-start', workerSource, harness: evaluator, files, request }, '*', [channel.port2, ...files])
      }, { once: true })
      document.body.appendChild(iframe)
    }).catch((error: unknown) => finish(error instanceof Error ? error : new Error('Não foi possível iniciar a execução.')))
  })
}
