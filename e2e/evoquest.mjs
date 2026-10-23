// E2E do EvoQuest no modo local, usando o Edge/Chrome instalado.
// Uso: npm run dev (em outro terminal) e depois `node e2e/evoquest.mjs [url] [pasta-screenshots]`.
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'e2e/screens-evoquest'
const SKIP_PY = process.env.SKIP_PYTHON === '1'
mkdirSync(OUT, { recursive: true })

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text()}`))

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['OK', name])
  } catch (e) {
    results.push(['FALHOU', name, e.message.split('\n')[0]])
    await page.screenshot({ path: `${OUT}/falha-${results.length}.png`, fullPage: true }).catch(() => {})
  }
}

/** Preenche qualquer tipo de desafio com uma resposta (não necessariamente certa). */
async function answerAnything() {
  const card = page.locator('fieldset').first()
  for (const g of await card.locator('[role=radiogroup]').all()) {
    const first = g.locator('[role=radio]').first()
    if (await first.isVisible()) await first.click()
  }
  for (const s of await card.locator('select').all()) await s.selectOption({ index: 1 })
  for (const i of await card.locator('input, textarea').all()) if ((await i.inputValue()) === '') await i.fill('1')
}

async function playUntilSummary(max = 40) {
  const done = page.getByText(/Partida concluída|Subiu para o nível|Chefe derrotado|O chefe resistiu/).first()
  for (let n = 0; n < max; n++) {
    const verify = page.getByRole('button', { name: 'Verificar' })
    await Promise.race([verify.waitFor({ timeout: 15000 }), done.waitFor({ timeout: 15000 })])
    if (await done.isVisible().catch(() => false)) return n
    await answerAnything()
    await page.waitForTimeout(1100) // ritmo humano: respostas instantâneas não rendem XP (anti-spam)
    await verify.click()
    await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 15000 })
  }
  throw new Error('a partida não terminou')
}

await step('abre o EvoQuest com as 8 disciplinas', async () => {
  await page.goto(`${BASE}/evoquest/treino`)
  await page.getByRole('heading', { name: /EvoQuest/ }).waitFor()
  for (const name of ['Inglês', 'Português', 'Raciocínio Lógico', 'Estatística', 'DAX', 'Linguagem M', 'SQL', 'Python para Dados']) await page.getByRole('link', { name: new RegExp(name) }).first().waitFor()
  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true })
})

await step('mapa da disciplina e lição', async () => {
  await page.getByRole('link', { name: /SQL/ }).first().click()
  await page.getByRole('heading', { name: 'SQL' }).waitFor()
  await page.getByText(/Unidade 1: Consultas essenciais/).waitFor()
  await page.screenshot({ path: `${OUT}/02-mapa.png`, fullPage: true })
  await page.getByRole('link', { name: 'Lição' }).first().click()
  await page.getByRole('heading', { name: 'Consultas essenciais' }).waitFor()
  await page.screenshot({ path: `${OUT}/03-licao.png`, fullPage: true })
})

let sessionUrl = ''
await step('missão da trilha: responde, recebe feedback e retoma após recarregar', async () => {
  await page.getByRole('link', { name: /Praticar esta unidade/ }).click()
  await page.waitForURL(/sessao=/)
  sessionUrl = page.url()
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  await page.screenshot({ path: `${OUT}/04-desafio.png`, fullPage: true })
  await answerAnything()
  await page.getByRole('button', { name: 'Verificar' }).click()
  await page.getByText(/Correto!|Ainda não/).first().waitFor()
  await page.screenshot({ path: `${OUT}/05-feedback.png`, fullPage: true })
  await page.getByRole('button', { name: 'Continuar' }).click()
  // Recarregar no meio da partida: a resposta já registrada não volta.
  const before = await page.getByRole('progressbar', { name: 'Progresso da partida' }).getAttribute('aria-valuenow')
  await page.reload()
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  const after = await page.getByRole('progressbar', { name: 'Progresso da partida' }).getAttribute('aria-valuenow')
  if (before !== after) throw new Error(`progresso mudou ao recarregar: ${before} → ${after}`)
  const n = await playUntilSummary()
  if (n < 1) throw new Error('nenhum desafio jogado')
  await page.getByText('Domínio em SQL').waitFor()
  const acertos = await page.locator('dt', { hasText: 'Acertos' }).locator('xpath=following-sibling::dd').innerText()
  const xp = await page.locator('dt', { hasText: /^XP$/ }).locator('xpath=following-sibling::dd').innerText()
  if (Number(acertos.split('/')[0]) > 0 && Number(xp.replace('+', '')) <= 0) throw new Error(`acertou ${acertos} mas ganhou ${xp} XP`)
  await page.screenshot({ path: `${OUT}/06-resumo.png`, fullPage: true })
})

await step('a partida encerrada não pode ser respondida de novo (sem recompensa duplicada)', async () => {
  await page.goto(sessionUrl)
  await page.getByText(/Partida concluída|Subiu para o nível/).first().waitFor()
  if (await page.getByRole('button', { name: 'Verificar' }).isVisible()) throw new Error('a partida encerrada voltou a aceitar respostas')
})

await step('laboratório SQL executa no SQLite e corrige', async () => {
  await page.goto(`${BASE}/evoquest/laboratorio/sql.u1.lab1`)
  const editor = page.getByLabel('Editor SQL')
  await editor.fill('SELECT nome, preco FROM produtos WHERE preco > 1000;')
  await page.getByRole('button', { name: 'Executar' }).click()
  await page.getByText('0 linha(s)').waitFor({ timeout: 20000 })
  await editor.fill('SELECT nome, preco FROM produtos WHERE preco BETWEEN 40 AND 150 ORDER BY preco;')
  await page.getByRole('button', { name: 'Enviar resposta' }).click()
  await page.getByText('Resolvido!').waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/07-lab-sql.png`, fullPage: true })
})

await step('laboratório SQL: ordem errada é apontada', async () => {
  await page.goto(`${BASE}/evoquest/laboratorio/sql.u1.lab1`)
  await page.getByLabel('Editor SQL').fill('SELECT nome, preco FROM produtos WHERE preco BETWEEN 40 AND 150 ORDER BY preco DESC;')
  await page.getByRole('button', { name: 'Enviar resposta' }).click()
  await page.getByText(/ordem não/).waitFor({ timeout: 20000 })
})

await step('laboratório SQL: consulta infinita é interrompida sem travar a página', async () => {
  await page.goto(`${BASE}/evoquest/laboratorio/sql.u1.lab1`)
  await page.getByLabel('Editor SQL').fill('WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM r) SELECT max(x) FROM r;')
  await page.getByRole('button', { name: 'Executar' }).click()
  await page.getByText(/interrompida/).waitFor({ timeout: 20000 })
})

if (!SKIP_PY)
  await step('laboratório Python roda no Pyodide e corrige', async () => {
    await page.goto(`${BASE}/evoquest/laboratorio/python.u1.lab1`)
    await page.getByLabel('Editor Python').fill('def media(valores):\n    if not valores:\n        return None\n    return sum(valores) / len(valores)\n')
    await page.getByRole('button', { name: 'Enviar resposta' }).click()
    await page.getByText('Resolvido!').waitFor({ timeout: 180000 })
    await page.screenshot({ path: `${OUT}/08-lab-python.png`, fullPage: true })
  })

await step('conquistas: resgata recompensa verificada', async () => {
  await page.goto(`${BASE}/evoquest/missoes`)
  await page.getByRole('tab', { name: /Conquistas/ }).click()
  const card = page.locator('li').filter({ hasText: 'Mão no código' })
  await card.getByRole('button', { name: 'Resgatar' }).click()
  await card.getByText('Resgatada ✓').waitFor()
  await page.screenshot({ path: `${OUT}/09-conquistas.png`, fullPage: true })
})

await step('perfil, loja e sequência', async () => {
  await page.goto(`${BASE}/evoquest/perfil`)
  await page.getByText('Loja de cosméticos').waitFor()
  await page.getByText('Sequência de estudo').waitFor()
  await page.screenshot({ path: `${OUT}/10-perfil.png`, fullPage: true })
})

await step('inglês: áudio com alternativa acessível', async () => {
  await page.goto(`${BASE}/evoquest/jogar?s=ingles&m=quick&min=15`)
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  // Joga até encontrar um desafio de escuta (ou acabar).
  for (let i = 0; i < 25; i++) {
    const fallback = page.getByRole('button', { name: /mostrar o texto/ })
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.click()
      await page.locator('p[lang^=en]').waitFor()
      await page.screenshot({ path: `${OUT}/11-escuta.png`, fullPage: true })
      return
    }
    if (await page.getByText(/Partida concluída|Subiu para o nível/).first().isVisible().catch(() => false)) break
    await answerAnything()
    await page.getByRole('button', { name: 'Verificar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
  }
  throw new Error('nenhum desafio de escuta apareceu')
})

await step('ditado: ouve, escreve, acerta e vê a correção palavra a palavra', async () => {
  await page.goto(`${BASE}/evoquest/ingles`)
  await page.getByRole('link', { name: /Treino de escuta/ }).click()
  await page.waitForURL(/sessao=/)
  let right = false
  let diff = false
  for (let i = 0; i < 20 && !(right && diff); i++) {
    const verify = page.getByRole('button', { name: 'Verificar' })
    await verify.waitFor()
    if (!(await page.getByRole('button', { name: 'Ouvir o enunciado' }).isVisible().catch(() => false)) && i === 0) throw new Error('sem botão de ouvir o enunciado')
    const box = page.getByLabel('Escreva o que você ouviu')
    if (await box.isVisible().catch(() => false)) {
      if (!right) {
        // Usa a alternativa acessível para descobrir a frase e responder certo.
        await page.getByRole('button', { name: /mostrar o texto/ }).click()
        const said = (await page.locator('p[lang^=en]').innerText()).replace(/[“”]/g, '')
        await box.fill(said.toUpperCase().replace(/[.?!,]/g, ''))
      } else await box.fill('this is not the sentence')
    } else await answerAnything()
    await page.waitForTimeout(1100)
    await verify.click()
    await page.getByRole('button', { name: 'Continuar' }).waitFor()
    if (await box.count()) {
      if (!right && (await page.getByText('Correto!').isVisible())) {
        right = true
        await page.screenshot({ path: `${OUT}/11b-ditado-certo.png`, fullPage: true })
      } else if (right && (await page.getByLabel('Correção palavra por palavra').isVisible().catch(() => false))) {
        diff = true
        await page.screenshot({ path: `${OUT}/11c-ditado-correcao.png`, fullPage: true })
      }
    }
    if (await page.getByText(/Partida concluída|Subiu para o nível/).first().isVisible().catch(() => false)) break
    await page.getByRole('button', { name: 'Continuar' }).click()
  }
  if (!right || !diff) throw new Error(`ditado: certo=${right} correção=${diff}`)
})

await step('histórico, revisão, relógio, casos práticos e flashcards abrem', async () => {
  for (const [path, text] of [
    ['/evoquest/historico', 'Últimas partidas'],
    ['/evoquest/revisao', 'Revisão inteligente'],
    ['/evoquest/relogio', 'Contra o relógio'],
    ['/evoquest/laboratorio?s=dax', 'Casos práticos validados'],
    ['/evoquest/cartoes', /Nenhum flashcard vencido|Flashcards em modo jogo/],
  ]) {
    await page.goto(`${BASE}${path}`)
    await page.getByText(text).first().waitFor()
  }
})

await step('contra o relógio inicia com cronômetro', async () => {
  await page.goto(`${BASE}/evoquest/jogar?s=logica&m=time_attack`)
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  await page.getByText(/01:2\d|01:30/).first().waitFor()
})

await step('cartão do EvoQuest na visão geral', async () => {
  await page.goto(`${BASE}/`)
  await page.getByRole('main').getByText('EvoQuest', { exact: true }).first().waitFor()
})

await step('celular: partida sem rolagem horizontal', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/evoquest', '/evoquest/estatistica', '/evoquest/jogar?s=estatistica&m=quick&min=3', '/evoquest/laboratorio/sql.u2.lab1', '/evoquest/perfil']) {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) throw new Error(`${path}: rolagem horizontal de ${overflow}px`)
  }
  await page.screenshot({ path: `${OUT}/12-mobile-perfil.png`, fullPage: true })
  await page.goto(`${BASE}/evoquest/jogar?s=estatistica&m=quick&min=3`)
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  await page.screenshot({ path: `${OUT}/13-mobile-desafio.png` })
})

await step('tema escuro (pela preferência do app)', async () => {
  await page.setViewportSize({ width: 1366, height: 860 })
  await page.goto(`${BASE}/configuracoes`)
  await page.getByRole('radio', { name: /Escuro/ }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
  await page.goto(`${BASE}/evoquest/treino`)
  await page.getByRole('heading', { name: /EvoQuest/ }).waitFor()
  if (!(await page.evaluate(() => document.documentElement.classList.contains('dark')))) throw new Error('tema escuro não aplicado')
  await page.screenshot({ path: `${OUT}/14-dark.png`, fullPage: true })
  await page.goto(`${BASE}/evoquest/jogar?s=dax&m=lab&min=5`)
  await page.getByRole('button', { name: 'Verificar' }).waitFor()
  await page.screenshot({ path: `${OUT}/15-dark-caso-dax.png`, fullPage: true })
})

await browser.close()
for (const r of results) console.log(r.join(' — '))
const failed = results.filter((r) => r[0] !== 'OK').length
console.log(`\n${results.length - failed}/${results.length} OK`)
if (errors.length) console.log('Erros do navegador:\n' + [...new Set(errors)].slice(0, 20).join('\n'))
process.exit(failed || errors.length ? 1 : 0)
