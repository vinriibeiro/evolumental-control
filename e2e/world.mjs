// E2E do Mundo Evolumental (modo local): primeira experiência, tutorial
// jogável, Rodoviária (vale → passagem → ônibus), as primeiras etapas da
// Cidade dos Dados e a Minha Cidade.
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

await step('tutorial: Iara → Quadro de Missões (SQL real) → recompensa e Rodoviária', async () => {
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
  await page.getByText('Rodoviária liberada').waitFor()
  const s = await st()
  if (!s.inventory.includes('mapa_mundo') || !s.inventory.includes('vale_bilhete')) throw new Error('sem o Mapa do Mundo ou o vale')
})

await step('Rodoviária: vale vira passagem grátis; a segunda cidade custa moedas; ônibus leva à cidade', async () => {
  await useAt(9.5, 25.5, 'up', 'Dora, bilheteira')
  await page.getByRole('dialog', { name: 'Bilheteria da Rodoviária' }).waitFor()
  await page.screenshot({ path: `${OUT}/mundo-bilheteria.png` })
  await page.locator('li', { hasText: 'Cidade dos Dados' }).getByRole('button', { name: /Trocar o vale/ }).click()
  await page.getByRole('dialog', { name: 'Embarque' }).waitFor()
  await page.getByRole('button', { name: /Comprar outra passagem/ }).click()
  await page.locator('li', { hasText: 'Babel' }).getByText(/Faltam \d+ moedas/).waitFor()
  await page.getByRole('button', { name: /Ir para o embarque/ }).click()
  await page.getByRole('button', { name: /Cidade dos Dados/ }).click()
  await page.getByText('Em viagem para').waitFor()
  await page.getByText('Fale com Maya no saguão').first().waitFor()
  const s = await st()
  if (s.region !== 'data_city' || s.inventory.includes('vale_bilhete')) throw new Error(`região ${s.region} / vale não usado`)
})

await step('Cidade dos Dados: Maya; porta de segurança com SQL', async () => {
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
  await page.waitForTimeout(300)
})

await step('painéis: diário, habilidades, inventário e mapa com passagens', async () => {
  await page.keyboard.press('j')
  await page.getByText('O Servidor Fantasma').first().waitFor()
  await page.keyboard.press('k')
  await page.getByText('Aprendida').first().waitFor()
  await page.keyboard.press('i')
  await page.getByText('Mapa do Mundo').first().waitFor()
  await page.screenshot({ path: `${OUT}/mundo-paineis.png` })
  await page.keyboard.press('m')
  await page.getByLabel('Passagem comprada').first().waitFor()
  await page.screenshot({ path: `${OUT}/mundo-mapa.png` })
  await page.keyboard.press('Escape')
})

await step('volta de ônibus; Lina entrega a escritura; Minha Cidade', async () => {
  await useAt(2.5, 20.5, 'down', 'Ponto de ônibus')
  await page.waitForTimeout(500)
  if ((await st()).region !== 'hub') throw new Error('não voltou à Vila')
  await page.screenshot({ path: `${OUT}/mundo-rodoviaria.png` })
  await useAt(23.5, 25.5, 'up', 'Arquiteta Lina')
  await talkThrough()
  await page.getByText('Linha "Minha Cidade" liberada').waitFor()
  await useAt(15.5, 26.5, 'right', 'Ônibus')
  await page.getByRole('button', { name: /Minha Cidade/ }).click()
  await page.getByText('Minha Cidade').first().waitFor()
  await page.waitForTimeout(2200)
  if ((await st()).region !== 'my_city') throw new Error('não chegou à Minha Cidade')
  await useAt(5.5, 6.5, 'up', 'Lote 1')
  await page.getByRole('dialog', { name: 'Prefeitura da Minha Cidade' }).waitFor()
  await page.screenshot({ path: `${OUT}/mundo-minha-cidade-lote.png` })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${OUT}/mundo-minha-cidade.png` })
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
