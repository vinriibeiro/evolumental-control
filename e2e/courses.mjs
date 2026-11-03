// Cursos e materiais do Drive, de ponta a ponta no navegador (modo local).
// A API do Google (login e Drive) é SIMULADA aqui: valida a interface, a importação, a reimportação e a persistência,
// mas não comprova acesso a um Drive real. Requer o servidor Vite em modo local.
// node e2e/courses.mjs [url] [pasta-capturas]
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = process.argv[3] ?? 'e2e/screens/courses'
mkdirSync(out, { recursive: true })
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// Drive sintético (IDs e nomes fictícios)
const F = 'application/vnd.google-apps.folder'
const id = (s) => `fake_${s}`.padEnd(20, 'x')
const ROOT = id('root')
const tree = {
  [ROOT]: [{ id: id('alfa'), name: 'Curso Alfa', mimeType: F }, { id: id('beta'), name: 'Curso Beta', mimeType: F }, { id: id('vazia'), name: 'Pasta vazia', mimeType: F }],
  [id('alfa')]: [{ id: id('m10'), name: 'Módulo 10', mimeType: F }, { id: id('m2'), name: 'Módulo 2', mimeType: F }],
  [id('m2')]: [{ id: id('v1'), name: 'Aula 1.mp4', mimeType: 'video/mp4', size: '1000' }, { id: id('p1'), name: 'Apostila.pdf', mimeType: 'application/pdf' }],
  [id('m10')]: [{ id: id('z1'), name: 'Códigos.zip', mimeType: 'application/zip' }],
  [id('beta')]: [{ id: id('d1'), name: 'Resumo', mimeType: 'application/vnd.google-apps.document' }],
  [id('vazia')]: [],
}
const driveCalls = []
await context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({
  contentType: 'text/javascript',
  body: `window.google = { accounts: { oauth2: {
    initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'token-simulado', expires_in: 3600, scope: cfg.scope })) }),
    hasGrantedAllScopes: () => true, revoke: () => {} } } }`,
}))
await context.route('https://www.googleapis.com/drive/v3/files**', (r) => {
  const url = new URL(r.request().url())
  driveCalls.push({ url, auth: r.request().headers().authorization })
  const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) })
  const m = /\/files\/([^/?]+)$/.exec(url.pathname)
  if (m) return m[1] === ROOT ? json({ id: ROOT, name: 'Cursos (simulado)', mimeType: F }) : json({ error: { code: 404 } }, 404)
  const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1]
  const all = tree[parent] ?? []
  // paginação: um item por página
  const start = Number(url.searchParams.get('pageToken') ?? 0)
  json({ files: all.slice(start, start + 1), nextPageToken: start + 1 < all.length ? String(start + 1) : undefined })
})
await context.route(/https:\/\/(drive|docs)\.google\.com\/.*\/preview.*/, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Visualizador simulado</title><p>Visualizador simulado do Google</p>' }))

async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'A página tem rolagem horizontal')
}
const frameSrc = () => page.locator('iframe').getAttribute('src')

try {
  await page.goto(`${base}/cursos`)
  await page.getByText('Nenhuma pasta cadastrada').waitFor()
  await page.getByText(/ficam só neste navegador/).waitFor()
  await page.getByRole('button', { name: 'Adicionar pasta do Drive' }).click()
  await page.getByLabel('ID do cliente OAuth do Google').fill('123456789012-abcdefghij.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Conectar com o Google' }).click()
  await page.getByText('— conectado (só leitura)').waitFor()
  await page.getByLabel('Adicionar pasta do Drive').fill('https://evil.example.com/x')
  await page.getByRole('button', { name: 'Ler pasta e ver prévia' }).click()
  await page.getByText(/Cole o link de uma pasta do Google Drive/).waitFor()
  await page.getByLabel('Adicionar pasta do Drive').fill(`https://drive.google.com/drive/folders/${ROOT}?usp=sharing`)
  await page.getByRole('button', { name: 'Ler pasta e ver prévia' }).click()
  await page.getByText('Prévia da importação').waitFor()
  await page.getByText('2 curso(s) · 2 módulo(s) · 4 aula(s)/material(is)').waitFor()
  await page.getByText('Sem visualização na plataforma (1)').waitFor()
  await page.getByText('Pastas sem arquivos (ignoradas): 1').waitFor()
  await page.screenshot({ path: `${out}/previa.png`, fullPage: true })
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText(/Catálogo atualizado: 8 novo/).waitFor()
  assert.ok(driveCalls.length > 0 && driveCalls.every((c) => c.auth === 'Bearer token-simulado' && !c.url.searchParams.has('alt')), 'Chamadas ao Drive devem ser só de metadados, com o token')
  console.log('OK | conecta (simulado), valida o link, mostra a prévia e importa com paginação')

  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Curso Alfa' }).waitFor()
  await page.screenshot({ path: `${out}/catalogo.png`, fullPage: true })
  await noOverflow()
  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  await page.getByRole('heading', { name: 'Apostila.pdf' }).waitFor()
  assert.equal(await frameSrc(), `https://drive.google.com/file/d/${id('p1')}/preview`)
  // Módulo 2 antes do Módulo 10 (ordem natural)
  const panel = page.getByRole('complementary', { name: 'Conteúdo do curso' })
  const order = await panel.getByRole('button').allTextContents()
  assert.ok(order.findIndex((t) => t.includes('Módulo 2')) < order.findIndex((t) => t.includes('Módulo 10')), 'Ordem natural dos módulos')
  await page.getByRole('button', { name: 'Concluir' }).click()
  await page.getByRole('button', { name: 'Desmarcar conclusão' }).waitFor()
  await page.getByRole('button', { name: 'Próximo' }).click()
  await page.getByRole('heading', { name: 'Aula 1.mp4' }).waitFor()
  assert.equal(await frameSrc(), `https://drive.google.com/file/d/${id('v1')}/preview`)
  await page.screenshot({ path: `${out}/aula.png`, fullPage: true })
  console.log('OK | abre a aula no visualizador, conclui e avança')

  await page.reload()
  await page.getByRole('heading', { name: 'Aula 1.mp4' }).waitFor()
  await panel.getByText('1 de 3 concluídos').waitFor()
  await page.goto(`${base}/cursos`)
  await page.getByText('Continuar estudando').waitFor()
  console.log('OK | progresso e última aula persistem após recarregar')

  await page.getByRole('button', { name: 'Pastas do Drive' }).click()
  // o token do Google vive só na memória da aba: depois de recarregar, é preciso conectar de novo
  assert.equal(await page.getByRole('button', { name: 'Atualizar do Drive' }).isDisabled(), true)
  assert.equal(await page.getByLabel('ID do cliente OAuth do Google').inputValue(), '123456789012-abcdefghij.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Conectar com o Google' }).click()
  await page.getByRole('button', { name: 'Atualizar do Drive' }).click()
  await page.getByText('Novos: 0 · atualizados: 0 · sem mudança: 8').waitFor()
  await page.getByRole('button', { name: 'Aplicar atualização' }).click()
  await page.getByText(/Catálogo atualizado: 0 novo/).waitFor()
  await page.keyboard.press('Escape')
  await page.getByText('1 de 3 concluído(s)').waitFor()
  console.log('OK | reimportar não duplica e mantém o progresso')

  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  await page.getByRole('heading', { name: 'Aula 1.mp4' }).waitFor()
  const iframe = await page.locator('iframe').elementHandle()
  await page.getByRole('button', { name: 'Modo cinema', exact: true }).click()
  assert.equal(await page.locator('.app-sidebar').isVisible(), false)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Tela cheia', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).waitFor()
  assert.equal(await iframe.evaluate((el) => el === document.querySelector('iframe')), true)
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click()
  await panel.getByRole('button', { name: /Códigos\.zip/ }).click()
  await page.getByText('Sem visualização dentro da plataforma').waitFor()
  assert.equal(await page.locator('iframe').count(), 0)
  console.log('OK | modo cinema, tela cheia e formato sem visualizador')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/cursos`)
  await page.getByRole('link', { name: 'Curso Alfa' }).waitFor()
  await noOverflow()
  await page.screenshot({ path: `${out}/celular-catalogo.png`, fullPage: true })
  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  await page.getByRole('complementary', { name: 'Conteúdo do curso' }).waitFor()
  await noOverflow()
  await page.screenshot({ path: `${out}/celular-aula.png`, fullPage: true })
  console.log('OK | catálogo e aula no celular sem rolagem horizontal')

  for (const path of ['/videos', '/biblioteca', '/cronometro']) {
    await page.goto(`${base}${path}`)
    await page.getByRole('main').waitFor()
  }
  assert.deepEqual(errors, [])
  console.log('OK | Vídeos, Biblioteca e Cronômetro continuam abrindo sem erros')
} catch (e) {
  await page.screenshot({ path: `${out}/falha.png`, fullPage: true }).catch(() => {})
  throw e
} finally {
  await browser.close()
}
