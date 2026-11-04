// E2E das trilhas de Python, SQL e Git: orientação de erros, dicas graduais, fila "Revisar meus erros",
// persistência, celular e isolamento da execução. Usa o modo local e executa o Pyodide de verdade.
// Uso: npm run dev (em outro terminal) e depois `node e2e/learning.mjs [url] [pasta-screenshots]`.
// O navegador pode ser indicado com CHROME_PATH.
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'e2e/screens'
mkdirSync(OUT, { recursive: true })

const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((path) => path && existsSync(path))
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] })
const PAGE = `${BASE}/banco-de-questoes/desafios`
const RUN_TIMEOUT = 180_000

const results = []
const errors = []
let page

async function newPage(options = {}) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...options })
  await context.addInitScript(() => {
    window.__frames = []
    new MutationObserver((list) => {
      for (const mutation of list) for (const node of mutation.addedNodes) {
        if (node.tagName === 'IFRAME') window.__frames.push({ sandbox: node.getAttribute('sandbox'), title: node.title })
      }
    }).observe(document, { childList: true, subtree: true })
  })
  const next = await context.newPage()
  next.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  next.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`))
  return next
}

async function step(name, fn) {
  try {
    await fn()
    results.push(['OK', name])
  } catch (error) {
    results.push(['FALHOU', name, error.message.split('\n')[0]])
    await page.screenshot({ path: `${OUT}/falha-${results.length}.png`, fullPage: true }).catch(() => {})
  }
}
const check = (condition, message) => { if (!condition) throw new Error(message) }

const pick = async (track, level, title) => {
  await page.getByRole('radio', { name: new RegExp(`^${track}`) }).click()
  await page.getByRole('radiogroup', { name: 'Nível de dificuldade' }).getByRole('radio', { name: level }).click()
  await page.locator('ol button', { hasText: title }).click()
  await page.getByRole('heading', { level: 2, name: title }).waitFor()
}
const write = async (label, text) => page.getByLabel(label).fill(text)
const test = async () => {
  await page.getByRole('button', { name: 'Testar solução' }).click()
  await page.getByText(/Você acertou|A solução precisa de ajustes/).waitFor({ timeout: RUN_TIMEOUT })
}
const result = () => page.locator('[aria-live="polite"]').filter({ hasText: /Você acertou|A solução precisa de ajustes/ })
const queue = () => page.getByRole('region', { name: 'Revisar meus erros' })
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const store = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((key) => key.includes(':challenges:')).map((key) => [key, localStorage.getItem(key)])))

page = await newPage()
const external = []
page.on('request', (request) => { if (!/^(http:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(request.url())) external.push(request.url()) })

await step('abre o laboratório e a fila começa vazia', async () => {
  await page.goto(PAGE)
  await page.getByRole('heading', { name: 'Laboratório de desafios' }).waitFor()
  await queue().getByText('Nenhum erro pendente').waitFor()
})

await step('Python: erro de sintaxe mostra linha e explicação em português', async () => {
  await write('Seu código', 'print("Bom dia!"')
  await test()
  const box = result()
  await box.getByText('Erro de sintaxe').waitFor()
  await box.getByText('Linha 1').waitFor()
  await box.getByText(/nunca foi fechado/).waitFor()
  await page.screenshot({ path: `${OUT}/python-sintaxe.png`, fullPage: true })
})

await step('dicas graduais: conceito, estratégia e solução opcional', async () => {
  await page.getByRole('button', { name: 'Dica 1: o conceito' }).click()
  await page.getByText('Dica 1 · O conceito').waitFor()
  check(await page.getByText('Dica 2 · A estratégia').count() === 0, 'a dica 2 apareceu antes da hora')
  await page.getByRole('button', { name: 'Dica 2: a estratégia' }).click()
  await page.getByText('Dica 2 · A estratégia').waitFor()
  await page.getByText(/solução comentada continua disponível/).waitFor()
  check(await page.getByRole('button', { name: 'Sem mais dicas' }).isDisabled(), 'o botão deveria encerrar as dicas')
  check(!(await page.locator('details', { hasText: 'Ver solução comentada' }).evaluate((node) => node.open)), 'a solução deve começar recolhida')
})

await step('Python: corrigir e aprovar encerra a pendência sem variação', async () => {
  await queue().getByText('1 tentativa sem acerto').waitFor()
  await write('Seu código', 'print("Bom dia!")')
  await test()
  await result().getByText('Você acertou').waitFor()
  await page.getByText('Prática aprovada').first().waitFor()
  await queue().getByText('Nenhum erro pendente').waitFor()
})

await step('Python: saída obtida e esperada com entrada de exemplo', async () => {
  await pick('Python', 'Primeiros passos', 'O dobro de um número')
  await write('Seu código', 'n = float(input())\nprint(n * 3)')
  await test()
  const box = result()
  await box.getByText('Entrada de exemplo').first().waitFor()
  check(await box.getByText('Saída obtida').first().isVisible() && await box.getByText('Saída esperada').first().isVisible(), 'faltam blocos de saída')
  check((await box.innerText()).includes('21.0') && (await box.innerText()).includes('14'), 'valores obtido/esperado ausentes')
  await queue().getByText('Entrada numérica e cálculo').waitFor()
  await page.screenshot({ path: `${OUT}/python-saida.png`, fullPage: true })
})

await step('revisão: variação com outro contexto reprova a resposta decorada e aprova a correta', async () => {
  const before = await store()
  await queue().getByRole('button', { name: /Tentar de novo: Entrada numérica/ }).click()
  await page.getByRole('heading', { level: 2, name: 'Horas em minutos' }).waitFor()
  await page.getByText('Revisão · variação').waitFor()
  await write('Seu código', 'h = float(input())\nprint(h * 2)')
  await test()
  await result().getByText('Saída esperada').first().waitFor()
  check((await result().innerText()).includes('120'), 'a saída esperada da variação deveria ser 120')
  await write('Seu código', 'h = float(input())\nprint(h * 60)')
  await test()
  await result().getByText('Você acertou').waitFor()
  await page.getByText('Conceito revisado').first().waitFor()
  await queue().getByText('Nenhum erro pendente').waitFor()
  const after = await store()
  // Rascunhos e aprovações já salvos permanecem idênticos.
  for (const [key, value] of Object.entries(before)) {
    if (/:(draft|verified|completed):|:challenges:v1$/.test(key)) check(after[key] === value, `a chave ${key} foi alterada`)
  }
  check(!Object.keys(after).some((key) => key.includes('verified:python-first_steps-5')), 'a revisão aprovou o exercício original')
  await page.getByRole('button', { name: 'Voltar à trilha' }).click()
  await page.getByRole('heading', { level: 2, name: 'O dobro de um número' }).waitFor()
  check(await page.getByLabel('Seu código').inputValue() === 'n = float(input())\nprint(n * 3)', 'o rascunho original mudou')
})

await step('SQL: sintaxe, coluna ausente, ordem e tabela comparativa', async () => {
  await pick('SQL', 'Primeiros passos', 'Organize por idade')
  await write('Seu código', 'SELEC nome, idade FROM pessoas')
  await test()
  await result().getByText('Erro de sintaxe').first().waitFor()
  await write('Seu código', 'SELECT nome FROM pessoas ORDER BY idade DESC, nome')
  await test()
  await result().getByText('Colunas diferentes do esperado').first().waitFor()
  await result().getByText(/Faltam colunas: idade/).first().waitFor()
  await write('Seu código', 'SELECT nome, idade FROM pessoas ORDER BY idade ASC, nome')
  await test()
  await result().getByText('Ordem incorreta').first().waitFor()
  await result().getByRole('table').first().waitFor()
  check(await result().getByRole('table').count() >= 2, 'faltam as duas tabelas comparativas')
  await page.screenshot({ path: `${OUT}/sql-ordem.png`, fullPage: true })
  await write('Seu código', 'SELECT nome, idade FROM pessoas WHERE idade > 20 ORDER BY idade DESC, nome')
  await test()
  await result().getByText('Resultado divergente').first().waitFor()
  await write('Seu código', 'SELECT nome, idade FROM pessoas ORDER BY idade DESC, nome ASC')
  await test()
  await result().getByText('Você acertou').waitFor()
})

await step('Git: mostra o comando em que saiu do caminho e o estado do repositório', async () => {
  await pick('Git', 'Primeiros passos', 'Seu primeiro commit')
  await write('Seus comandos', "printf 'Aprendi a fazer um commit\\n' > aprendizado.txt\ngit commit -m \"Registra aprendizado\"")
  await test()
  const box = result()
  await box.getByText('Fora do caminho').waitFor()
  await box.getByText(/Comando 2 de 4/).waitFor()
  await box.getByText('Antes do comando').waitFor()
  await box.getByText('Esperado depois').waitFor()
  await box.getByText('Preparado para o próximo commit: aprendizado.txt.').waitFor()
  check((await box.innerText()).includes('git commit -m Registra aprendizado'), 'o comando digitado não aparece')
  await page.screenshot({ path: `${OUT}/git-estado.png`, fullPage: true })
  check(await queue().getByText('Primeiro commit: preparar e registrar').isVisible(), 'o conceito de Git não entrou na fila')
})

await step('Git: variação com outro estado inicial, errada e certa', async () => {
  await queue().getByRole('button', { name: /Tentar de novo: Primeiro commit/ }).click()
  await page.getByRole('heading', { level: 2, name: 'Registre seu diário de estudos' }).waitFor()
  await page.getByText('agenda.txt', { exact: false }).first().waitFor()
  await write('Seus comandos', "printf 'Aprendi a fazer um commit\\n' > aprendizado.txt")
  await test()
  await result().getByText('Fora do caminho').waitFor()
  await write('Seus comandos', "printf 'Hoje estudei Git\\n' > diario.txt\ngit add diario.txt\ngit commit -m \"Registra diario\"\ngit log -1 --oneline")
  await test()
  await result().getByText('Você acertou').waitFor()
  await result().getByText(/Novo commit: d1a0002 Registra diario/).waitFor()
  await page.getByText('Conceito revisado').first().waitFor()
})

await step('persistência: erros, rascunhos e aprovações sobrevivem a recarregar', async () => {
  await page.goto(PAGE)
  await page.getByRole('heading', { name: 'Laboratório de desafios' }).waitFor()
  const saved = await store()
  check(Object.keys(saved).some((key) => key.endsWith(':review:python-first_steps-5')), 'registro de revisão ausente')
  check(Object.keys(saved).some((key) => key.endsWith(':reviewdraft:python-first_steps-5~v1')), 'rascunho da variação ausente')
  check(Object.keys(saved).some((key) => key.endsWith(':verified:python-first_steps-1')), 'aprovação anterior ausente')
})

await step('persistência: erro pendente reaparece após recarregar', async () => {
  await pick('Python', 'Primeiros passos', 'O dobro de um número')
  await write('Seu código', 'n = float(input())\nprint(n + 1)')
  await test()
  await page.reload()
  await queue().getByText('Entrada numérica e cálculo').waitFor()
  await queue().getByText(/\d+ tentativas? sem acerto/).first().waitFor()
  await queue().getByRole('button', { name: /Dispensar: Entrada numérica/ }).click()
  await queue().getByText('Nenhum erro pendente').waitFor()
  await page.reload()
  await queue().getByText('Nenhum erro pendente').waitFor()
})

await step('isolamento: iframe sem allow-same-origin, sem rede e removido ao terminar', async () => {
  await pick('Python', 'Primeiros passos', 'Seu primeiro bom dia')
  const code = [
    'import urllib.request',
    'try:',
    '    urllib.request.urlopen("https://example.com", timeout=2)',
    '    print("REDE LIVRE")',
    'except Exception as erro:',
    '    print("rede bloqueada:", type(erro).__name__)',
    'try:',
    '    import js',
    '    print("JS:", js.document, js.localStorage)',
    'except Exception as erro:',
    '    print("js bloqueado:", type(erro).__name__)',
  ].join('\n')
  external.length = 0
  await write('Seu código', code)
  await test()
  const text = await result().innerText()
  check(!text.includes('REDE LIVRE'), 'a execução alcançou a rede')
  check(text.includes('rede bloqueada') && text.includes('js bloqueado'), 'as tentativas não foram bloqueadas')
  check(external.length === 0, `requisições externas durante a execução: ${external.join(', ')}`)
  const frames = await page.evaluate(() => window.__frames)
  check(frames.length >= 1 && frames.every((frame) => frame.sandbox === 'allow-scripts'), `sandbox inesperado: ${JSON.stringify(frames)}`)
  check(await page.locator('iframe').count() === 0, 'o iframe do sandbox não foi removido')
})

// Celular: sem rolagem lateral, com tabelas, estado do Git e fila visíveis.
await page.context().close()
page = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

await step('celular: sem rolagem lateral com tabelas, estado do Git e fila', async () => {
  await page.goto(PAGE)
  await page.getByRole('heading', { name: 'Laboratório de desafios' }).waitFor()
  check(await overflow() <= 1, `rolagem lateral inicial: ${await overflow()}px`)
  await pick('SQL', 'Primeiros passos', 'Organize por idade')
  await write('Seu código', 'SELECT nome, idade FROM pessoas ORDER BY idade ASC, nome')
  await test()
  await result().getByText('Ordem incorreta').first().waitFor()
  check(await overflow() <= 1, `rolagem lateral com tabelas: ${await overflow()}px`)
  await page.screenshot({ path: `${OUT}/celular-sql.png`, fullPage: true })
  await pick('Git', 'Primeiros passos', 'Seu primeiro commit')
  await write('Seus comandos', "printf 'Aprendi a fazer um commit\\n' > aprendizado.txt\ngit commit -m \"Registra aprendizado\"")
  await test()
  await result().getByText('Esperado depois').waitFor()
  check(await overflow() <= 1, `rolagem lateral com estado do Git: ${await overflow()}px`)
  await page.screenshot({ path: `${OUT}/celular-git.png`, fullPage: true })
  await queue().scrollIntoViewIfNeeded()
  check(await overflow() <= 1, `rolagem lateral com a fila: ${await overflow()}px`)
  await page.screenshot({ path: `${OUT}/celular-fila.png` })
  const tap = await queue().getByRole('button', { name: /Tentar de novo/ }).first().boundingBox()
  check(tap && tap.height >= 32 && tap.width >= 32, 'botão da fila pequeno demais para toque')
})

await browser.close()

for (const [status, name, reason] of results) console.log(`${status === 'OK' ? '✔' : '✘'} ${name}${reason ? ` — ${reason}` : ''}`)
const relevant = errors.filter((message) => !/Failed to load resource|favicon/i.test(message))
if (relevant.length) console.log(`\nErros de console/página (${relevant.length}):\n${[...new Set(relevant)].slice(0, 10).join('\n')}`)
process.exit(results.some(([status]) => status === 'FALHOU') || relevant.length ? 1 : 0)
