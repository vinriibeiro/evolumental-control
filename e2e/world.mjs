// E2E do Mundo Evolumental (modo local): primeira experiência, tutorial
// jogável, viagem pelo Portal e as primeiras etapas da Cidade dos Dados.
// Uso: npm run dev (em outro terminal) e `node e2e/world.mjs [url] [pasta]`.
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'e2e/screens'
mkdirSync(OUT, { recursive: true })
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['OK', name])
  } catch (e) {
    results.push(['FALHOU', name, e.message.split('\n')[0]])
    await page.screenshot({ path: `${OUT}/mundo-falha-${results.length}.png` }).catch(() => {})
  }
}
const place = (x, y, facing) => page.evaluate(([x, y, f]) => window.__eq.place(x, y, f), [x, y, facing])
const st = () => page.evaluate(() => window.__eq.state())
async function talkThrough() {
  // Avança falas e escolhe sempre a primeira opção, até a caixa fechar.
  for (let i = 0; i < 20; i++) {
    const dlg = page.getByRole('dialog')
    if (!(await dlg.count())) return
    const choice = dlg.getByRole('button', { name: /^1 / })
    if (await choice.count()) await choice.click()
    else await dlg.getByRole('button', { name: /Continuar|Encerrar|Mostrar tudo|OK/ }).click()
    await page.waitForTimeout(120)
  }
}
async function useAt(x, y, facing, name) {
  await place(x, y, facing)
  // Espera a dica de interação ("E · Verbo · Nome"), não qualquer texto com o nome.
  await page.locator('p.eq-panel', { hasText: name }).filter({ has: page.locator('strong') }).first().waitFor({ timeout: 5000 })
  await page.keyboard.press('e')
}
async function runSql(query) {
  const editor = page.getByLabel('Comando SQL')
  await editor.fill(query)
  await page.getByRole('button', { name: /Executar/ }).click()
}

await step('primeira experiência: cena, criação de personagem e chegada à Vila', async () => {
  await page.goto(`${BASE}/evoquest`)
  await page.getByRole('button', { name: 'Pular' }).click()
  await page.getByLabel('Nome do personagem').fill('Vini')
  await page.getByText('Aurora').click()
  await page.getByRole('button', { name: 'Entrar na Vila' }).click()
  await page.getByText('Vila Evolumental').first().waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/mundo-vila.png` })
})

await step('anda com o teclado e colide (não atravessa a Guilda)', async () => {
  await place(15.5, 5.5, 'up')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyW')
  const s = await st()
  if (s.y < 4.2) throw new Error(`atravessou a parede: y=${s.y}`)
})

await step('tutorial: Iara → Quadro de Missões (SQL real) → recompensa e Portal', async () => {
  await useAt(13.5, 6.5, 'up', 'Mestra Iara')
  await talkThrough()
  await page.getByText('Faça o Quadro de Missões mostrar').first().waitFor()
  await useAt(17.5, 5.5, 'up', 'Quadro de Missões')
  await runSql("SELECT titulo, regiao FROM missoes WHERE status = 'aberto';")
  await page.getByText('nenhuma missão tem esse status').waitFor()
  await runSql("SELECT titulo, regiao FROM missoes WHERE status = 'aberta';")
  await page.getByText('O SERVIDOR FANTASMA').first().waitFor()
  await page.getByText('+30 XP').first().waitFor()
  await page.screenshot({ path: `${OUT}/mundo-terminal.png` })
  await page.getByRole('button', { name: 'Continuar' }).click()
  await useAt(13.5, 6.5, 'up', 'Mestra Iara')
  await talkThrough()
  await page.getByText('Portal das Disciplinas desbloqueado').waitFor()
  const s = await st()
  if (!s.inventory.includes('mapa_mundo')) throw new Error('sem o Mapa do Mundo')
})

await step('Portal → Cidade dos Dados; Maya; porta de segurança com SQL', async () => {
  await useAt(15.5, 10.5, 'up', 'Portal das Disciplinas')
  await page.getByRole('button', { name: /Cidade dos Dados/ }).click()
  await page.getByText('Fale com Maya no saguão').first().waitFor()
  await useAt(8.5, 18.5, 'up', 'Maya Kort')
  await talkThrough()
  await page.getByText('Abra a sala de segurança').first().waitFor()
  await useAt(8.5, 9.5, 'up', 'Terminal da porta')
  await runSql('SELECT * FROM employees WHERE clearance >= 4;')
  await page.getByText('Falta filtrar pelo status').waitFor()
  await runSql("SELECT * FROM employees WHERE status = 'active' AND clearance >= 4;")
  await page.getByText('5 crachás autorizados').first().waitFor()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(500)
  const s = await st()
  if (!s.flags.door_security) throw new Error('porta não abriu')
  await place(6.5, 8.5, 'up')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(600)
  await page.keyboard.up('KeyW')
  if ((await st()).y > 7.5) throw new Error('não entrou na sala de segurança')
  await page.screenshot({ path: `${OUT}/mundo-cidade.png` })
})

await step('progresso persiste após recarregar (servidor/local reconciliado)', async () => {
  await page.reload()
  await page.getByText('Converse com Brás').first().waitFor()
  const s = await st()
  if (s.region !== 'data_city') throw new Error(`região ${s.region}`)
})

await step('painéis: diário, habilidades e inventário', async () => {
  await page.keyboard.press('j')
  await page.getByText('O Servidor Fantasma').first().waitFor()
  await page.keyboard.press('k')
  await page.getByText('Aprendida').first().waitFor()
  await page.keyboard.press('i')
  await page.getByText('Mapa do Mundo').first().waitFor()
  await page.screenshot({ path: `${OUT}/mundo-paineis.png` })
  await page.keyboard.press('Escape')
})

await step('celular: joystick e botão de ação, sem rolagem', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', storageState: await ctx.storageState() })
  const p = await m.newPage()
  p.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`))
  await p.goto(`${BASE}/evoquest`)
  // Novo contexto = novo IndexedDB: passa pela criação rápida.
  await p.getByRole('button', { name: 'Pular' }).click()
  await p.getByRole('button', { name: 'Entrar na Vila' }).isDisabled()
  await p.getByLabel('Nome do personagem').fill('Teste')
  await p.getByRole('button', { name: 'Entrar na Vila' }).click()
  await p.getByRole('button', { name: /Ação|Nada por perto/ }).waitFor()
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  if (over) throw new Error('rolagem horizontal')
  await p.screenshot({ path: `${OUT}/mundo-celular.png` })
  await m.close()
})

await browser.close()
for (const r of results) console.log(r.join(' | '))
console.log(errors.length ? `\nErros de console:\n${errors.join('\n')}` : '\nSem erros de console.')
process.exit(results.some((r) => r[0] !== 'OK') || errors.length ? 1 : 0)
