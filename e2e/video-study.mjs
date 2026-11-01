// Requer o servidor Vite em modo local. Usa perfil isolado, sem dados pessoais.
// node e2e/video-study.mjs [url] [pasta-capturas]
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = process.argv[3] ?? 'e2e/screens/video-study'
mkdirSync(out, { recursive: true })
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'A página tem rolagem horizontal')
}

try {
  await page.goto(`${base}/videos`)
  await page.getByText('Modo local:').waitFor()
  await page.evaluate(async () => {
    const { LocalBackend } = await import('/src/lib/data/local.ts')
    const b = new LocalBackend()
    const [s] = await b.insert('subjects', [{ name: 'Ciência de Dados · Python' }])
    const topics = await b.insert('topics', [
      { subject_id: s.id, name: '01 · Conceitos de programação', sort_order: 0 },
      { subject_id: s.id, name: '02 · Primeiros comandos', sort_order: 1 },
    ])
    await b.insert('study_materials', [
      { subject_id: s.id, topic_id: topics[0].id, title: 'Introdução ao Python · Sua primeira aula', url: 'https://www.youtube.com/watch?v=S9uPNppGsGo' },
      { subject_id: s.id, topic_id: topics[1].id, title: 'Primeiros passos com Python', url: 'https://www.youtube.com/watch?v=Mp0vhMDI7fA' },
    ])
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Introdução ao Python · Sua primeira aula' }).waitFor()
  const iframe = await page.locator('iframe').elementHandle()
  await page.getByLabel('Duração do estudo em minutos').fill('5')
  await page.getByRole('button', { name: 'Iniciar foco' }).click()
  await page.getByRole('button', { name: 'Pausar foco', exact: true }).waitFor()
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true })
  await noOverflow()
  console.log('OK | inicia sessão de videoaula junto ao player')

  await page.getByRole('button', { name: 'Modo cinema', exact: true }).click()
  assert.equal(await page.locator('.app-sidebar').isVisible(), false)
  assert.equal(await iframe.evaluate((el) => el === document.querySelector('iframe')), true)
  await page.screenshot({ path: `${out}/cinema.png`, fullPage: true })
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.app-sidebar').isVisible(), true)
  console.log('OK | modo cinema e Escape preservam o player')

  await page.getByRole('button', { name: 'Tela cheia', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.fullscreenElement?.classList.contains('video-classroom')), true)
  assert.equal(await page.getByRole('region', { name: 'Temporizador de estudo' }).isVisible(), true)
  assert.equal(await iframe.evaluate((el) => el === document.querySelector('iframe')), true)
  await page.screenshot({ path: `${out}/tela-cheia.png` })
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click()
  console.log('OK | tela cheia real mantém temporizador e iframe')

  await page.getByRole('button', { name: 'Pausar foco', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar foco', exact: true }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Continuar foco', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Continuar foco', exact: true }).click()
  await page.getByRole('button', { name: 'Pausar foco', exact: true }).waitFor()
  console.log('OK | pausa persiste após recarregar')

  // Desloca só o início da sessão de teste; não espera cinco minutos reais.
  await page.evaluate(async () => {
    const { LocalBackend } = await import('/src/lib/data/local.ts')
    const b = new LocalBackend()
    const [s] = await b.listSessions({ filters: [{ column: 'status', op: 'eq', value: 'active' }] })
    await b.update('study_sessions', [{ column: 'id', op: 'eq', value: s.id }], { adjustment_seconds: 245 })
  })
  await page.reload()
  await page.getByText('Seu tempo está acabando. Prepare-se para uma pausa.').waitFor()
  await page.screenshot({ path: `${out}/aviso.png`, fullPage: true })
  await page.evaluate(async () => {
    const { LocalBackend } = await import('/src/lib/data/local.ts')
    const b = new LocalBackend()
    const [s] = await b.listSessions({ filters: [{ column: 'status', op: 'eq', value: 'active' }] })
    await b.update('study_sessions', [{ column: 'id', op: 'eq', value: s.id }], { adjustment_seconds: 305 })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continuar estudando', exact: true }).waitFor()
  console.log('OK | avisos antecipado e final com timestamps persistidos')

  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await page.getByRole('button', { name: 'Concluído', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Prosseguir', exact: true }).click()
  await page.getByRole('heading', { name: 'Primeiros passos com Python' }).waitFor()
  await page.getByRole('button', { name: 'Anterior', exact: true }).click()
  await page.getByRole('heading', { name: 'Introdução ao Python · Sua primeira aula' }).waitFor()
  console.log('OK | conclusão e navegação entre aulas')

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await noOverflow()
    const caption = await page.locator('.video-timer-caption').boundingBox()
    assert.ok(caption.width >= 200, 'A descrição do timer ficou espremida')
    await page.screenshot({ path: `${out}/largura-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Modo cinema', exact: true }).click()
    await noOverflow()
    await page.getByRole('button', { name: 'Sair do cinema', exact: true }).click()
  }
  console.log('OK | celular e tablet sem rolagem horizontal')

  await page.getByRole('button', { name: 'Finalizar foco', exact: true }).click()
  await page.getByRole('link', { name: 'Revisar e salvar sessão' }).click()
  await page.getByRole('heading', { name: 'Resumo da sessão' }).waitFor()
  await page.getByRole('button', { name: 'Salvar sessão', exact: true }).click()
  await page.getByRole('heading', { name: 'Nova sessão de estudo' }).waitFor()
  console.log('OK | finaliza, revisa e salva no cronômetro')
  assert.deepEqual(errors, [], 'Erros JavaScript no app')
  console.log('OK | nenhum erro JavaScript no app')
} finally {
  await browser.close()
}
