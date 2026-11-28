// Cursos e materiais do Drive, de ponta a ponta no navegador (modo local).
// A API do Google (login e Drive) é SIMULADA aqui: valida a interface, a importação, a reimportação e a persistência,
// mas não comprova acesso a um Drive real. Requer o servidor Vite em modo local.
// node e2e/courses.mjs [url] [pasta-capturas]
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { PDFDocument } from 'pdf-lib'

const base = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = process.argv[3] ?? 'e2e/screens/courses'
mkdirSync(out, { recursive: true })
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const pdf = await PDFDocument.create()
const firstPage = pdf.addPage([420, 590])
firstPage.drawText('Primeira página da apostila', { x: 40, y: 525, size: 22 })
firstPage.drawText('Consultas SQL\n\nUma consulta SELECT apresenta dados de uma tabela.\nEscolha as colunas que deseja mostrar e use WHERE\npara decidir quais linhas entram no resultado.\n\nExemplo de leitura\n\nAntes de executar a consulta, imagine o resultado.\nQue colunas vão aparecer? Quais linhas atendem\nao filtro? Depois, confira sua previsão.', { x: 40, y: 480, size: 13, lineHeight: 20 })
pdf.addPage([420, 590]).drawText('Segunda pagina da apostila', { x: 40, y: 525, size: 22 })
const pdfBytes = Buffer.from(await pdf.save())

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
await context.route('https://accounts.google.com/o/oauth2/v2/auth**', (r) => {
  const request = new URL(r.request().url())
  const callback = new URL(request.searchParams.get('redirect_uri'))
  callback.hash = new URLSearchParams({
    access_token: 'token-simulado', expires_in: '3600',
    state: request.searchParams.get('state'), scope: request.searchParams.get('scope'),
  }).toString()
  return r.fulfill({ status: 302, headers: { location: callback.toString() } })
})
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
  if (m?.[1] === id('p1')) {
    if (url.searchParams.get('alt') === 'media') return r.fulfill({ contentType: 'application/pdf', body: pdfBytes })
    return json({ id: id('p1'), name: 'Apostila.pdf', mimeType: 'application/pdf', size: String(pdfBytes.length), capabilities: { canDownload: true } })
  }
  if (m?.[1] === id('handout') && url.searchParams.get('alt') === 'media') {
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><style>h1{color:rgb(180,0,0)}</style><main><h1>Material HTML da aula</h1><a href="#resumo">Ir ao resumo</a><p id="resumo">Revisão da matéria</p><script>document.body.textContent="Script executado"</script></main>' })
  }
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
  await page.getByRole('button', { name: 'Importar pasta do Drive' }).click()
  await page.getByText('Nenhuma pasta cadastrada').waitFor()
  await page.getByText('Modo local:').waitFor()
  await page.getByLabel('Adicionar pasta do Drive').waitFor()
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
  await page.getByText('0 de 2 concluída(s)').first().waitFor()
  await page.screenshot({ path: `${out}/catalogo.png`, fullPage: true })
  await noOverflow()
  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  const lessonArea = page.getByRole('region', { name: 'Aula' })
  const panel = page.getByRole('complementary', { name: 'Conteúdo do curso' })
  // Módulo 2 (vídeo + apostila = 1 aula) antes do Módulo 10 (ordem natural)
  await lessonArea.getByRole('heading', { name: 'Módulo 2' }).waitFor()
  assert.equal(await frameSrc(), `https://drive.google.com/file/d/${id('v1')}/preview`)
  await page.getByRole('tab', { name: 'Apostila.pdf' }).waitFor()
  await page.getByRole('button', { name: 'Ao lado do vídeo' }).click()
  assert.equal(await page.locator('iframe').count(), 2)
  await page.screenshot({ path: `${out}/aula-material-ao-lado.png`, fullPage: true })
  await page.getByRole('button', { name: 'Fechar material ao lado' }).click()
  await page.screenshot({ path: `${out}/aula.png`, fullPage: true })
  await lessonArea.getByRole('button', { name: 'Concluir e avançar' }).click()
  await lessonArea.getByRole('heading', { name: 'Módulo 10' }).waitFor()
  await page.getByText('Sem visualização dentro da plataforma').waitFor()
  assert.equal(await page.locator('iframe').count(), 0)
  await panel.getByText('1 de 2 concluídos').waitFor()
  console.log('OK | aula com material, material ao lado do vídeo, "Concluir e avançar" e formato sem visualizador')

  await page.reload()
  await lessonArea.getByRole('heading', { name: 'Módulo 10' }).waitFor()
  await panel.getByText('1 de 2 concluídos').waitFor()
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
  await page.getByText('1 de 2 concluída(s)').waitFor()
  console.log('OK | reimportar não duplica e mantém o progresso')

  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  await lessonArea.getByRole('heading', { name: 'Módulo 10' }).waitFor()
  await page.keyboard.press('p')
  await lessonArea.getByRole('heading', { name: 'Módulo 2' }).waitFor()
  const iframe = await page.locator('iframe').elementHandle()
  await page.getByRole('button', { name: 'Modo foco', exact: true }).click()
  assert.equal(await page.locator('.app-sidebar').isVisible(), false)
  assert.equal(await lessonArea.isVisible(), true)
  await page.screenshot({ path: `${out}/modo-foco.png` })
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.app-sidebar').isVisible(), true)
  await page.getByRole('button', { name: 'Tela cheia', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).waitFor()
  assert.equal(await iframe.evaluate((el) => el === document.querySelector('iframe')), true)
  const h = await page.locator('iframe').evaluate((el) => el.getBoundingClientRect().height)
  assert.ok(h > 600, `O player deve ocupar a tela cheia (altura ${h})`)
  await page.screenshot({ path: `${out}/tela-cheia.png` })
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click()
  console.log('OK | atalhos, modo foco e tela cheia com o player ocupando a altura')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/cursos`)
  await page.getByRole('link', { name: 'Curso Alfa' }).waitFor()
  await noOverflow()
  await page.screenshot({ path: `${out}/celular-catalogo.png`, fullPage: true })
  await page.getByRole('link', { name: 'Curso Alfa' }).click()
  await page.getByRole('complementary', { name: 'Conteúdo do curso' }).waitFor()
  await page.getByRole('navigation', { name: 'Ações da aula' }).waitFor()
  await noOverflow()
  await page.screenshot({ path: `${out}/celular-aula.png`, fullPage: true })
  console.log('OK | catálogo e aula no celular sem rolagem horizontal')

  await lessonArea.getByRole('heading', { name: 'Módulo 10' }).waitFor()
  await page.keyboard.press('p')
  await page.getByRole('tab', { name: 'Apostila.pdf' }).click()
  await page.getByRole('link', { name: 'Modo leitura: Apostila.pdf' }).first().click()
  await page.getByRole('button', { name: 'Autorizar em janela separada' }).click()
  const reader = page.locator('.pdf-reader[data-focus="true"]')
  await reader.waitFor()
  assert.equal(await reader.getAttribute('data-appearance'), 'sepia')
  const canvas = reader.locator('.pdf-page canvas')
  const area = reader.getByLabel('Páginas do documento')
  const fullWidth = async () => {
    await page.waitForFunction(() => {
      const host = document.querySelector('.pdf-reader-area')
      const frame = host?.querySelector('[data-pdf-frame]:has([aria-busy="false"])')
      return host && frame && Math.abs(frame.getBoundingClientRect().width - host.clientWidth) <= 2 && host.scrollWidth <= host.clientWidth + 1
    })
  }
  await fullWidth()
  assert.ok((await canvas.boundingBox()).width > (await area.boundingBox()).width * 1.07, 'O PDF aumenta ao remover as margens vazias')
  assert.equal(await reader.locator('.pdf-reader-stage').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Recortar margens vazias' }).click()
  await fullWidth()
  assert.ok(Math.abs((await canvas.boundingBox()).width - (await area.boundingBox()).width) <= 2, 'O controle recupera a página com as margens originais')
  await reader.getByRole('button', { name: 'Recortar margens vazias' }).click()
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await fullWidth()
  await reader.getByRole('button', { name: 'Aumentar zoom' }).click()
  await page.waitForFunction(() => {
    const host = document.querySelector('.pdf-reader-area')
    return host && host.scrollWidth >= host.clientWidth * 1.15
  })
  await reader.getByRole('button', { name: 'Diminuir zoom' }).click()
  await fullWidth()
  // O layout sem barras também precisa funcionar quando o navegador não oferece Fullscreen API.
  await page.evaluate(() => Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true }))
  await reader.getByRole('button', { name: 'Tela inteira sem barras' }).click()
  assert.ok((await area.boundingBox()).height >= 840, 'A página deve ocupar toda a altura disponível sem barras')
  await reader.getByRole('button', { name: 'Mostrar controles de leitura' }).click()
  await page.setViewportSize({ width: 844, height: 390 })
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Ajustar à página' }).click()
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await page.waitForFunction(() => {
    const host = document.querySelector('.pdf-reader-area')
    const pdf = host?.querySelector('canvas')
    return host && pdf && Math.abs(pdf.getBoundingClientRect().height - host.clientHeight) <= 3 && host.scrollHeight <= host.clientHeight + 1
  })
  assert.ok((await canvas.boundingBox()).width > 200, 'A página deve aproveitar a altura no celular deitado')
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Ajustar à largura' }).click()
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await page.setViewportSize({ width: 320, height: 640 })
  await fullWidth()
  await noOverflow()
  const navigation = await reader.getByRole('button', { name: 'Página anterior' }).boundingBox()
  const fontControl = await reader.getByRole('button', { name: 'Ler com letras maiores' }).boundingBox()
  assert.equal(navigation.y, fontControl.y, 'Navegação e controles de tamanho devem caber na mesma linha')
  await page.setViewportSize({ width: 390, height: 844 })
  await fullWidth()
  console.log('OK | PDF usa toda a largura, amplia pelo rodapé e ajusta a página inteira em paisagem')
  await reader.getByRole('button', { name: 'Ativar marca-texto' }).click()
  const textLine = reader.locator('.pdf-text-layer span').filter({ hasText: 'Primeira página da apostila' })
  const line = await textLine.boundingBox()
  assert.ok(line, 'O trecho do PDF precisa estar renderizado')
  const mobile = await context.newCDPSession(page)
  await mobile.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const y = Math.round(line.y + line.height * 0.55)
  const x = Math.round(line.x + 3)
  await mobile.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await mobile.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(line.x + line.width * 0.75), y }] })
  await mobile.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await reader.locator('.pdf-page svg rect').first().waitFor()
  await reader.getByRole('button', { name: 'Desativar marca-texto' }).click()
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Mostrar anotações' }).click()
  await reader.getByText(/“Primeira página/).waitFor()
  await reader.getByRole('button', { name: 'Ocultar anotações' }).click()
  await reader.getByLabel('Tema de leitura').selectOption('noite')
  assert.equal(await reader.getAttribute('data-appearance'), 'noite')
  await reader.getByLabel('Tema de leitura').selectOption('sepia')
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Ler com letras maiores' }).click()
  await reader.getByRole('article').getByText('Primeira página da apostila', { exact: true }).waitFor()
  await reader.getByRole('button', { name: 'Aumentar fonte' }).click()
  assert.equal(await reader.getByRole('article').evaluate((el) => getComputedStyle(el).fontSize), '24px')
  await page.screenshot({ path: `${out}/celular-leitor-pdf.png` })
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Salvar para ler offline' }).click()
  await reader.getByText('Cursos · Salvo offline').waitFor()
  await reader.getByRole('button', { name: 'Ferramentas de leitura' }).click()
  await reader.getByRole('button', { name: 'Próxima página' }).click()
  await reader.getByRole('article').getByText('Segunda pagina da apostila').waitFor()
  await reader.locator('[role="progressbar"][aria-valuenow="100"]').waitFor({ state: 'attached' })
  await reader.getByRole('status').filter({ hasText: 'Posição e marcas salvas' }).waitFor({ state: 'attached' })
  const serviceWorker = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  if (process.env.REQUIRE_PDF_OFFLINE_TEST) assert.ok(serviceWorker, 'O build de produção precisa ter um service worker ativo')
  if (serviceWorker) {
    await context.setOffline(true)
    await page.reload()
    await reader.locator('.pdf-page[data-page-number="2"][aria-busy="false"]').waitFor()
    assert.equal(await reader.getByLabel('Página', { exact: true }).inputValue(), '2')
    await reader.getByRole('button', { name: 'Página anterior' }).click()
    await reader.locator('.pdf-page svg rect').first().waitFor()
    await context.setOffline(false)
    console.log('OK | sem rede, o PDF reabre na página 2 e mantém o destaque da página 1')
  }
  await noOverflow()
  console.log('OK | PDF do Drive abre em sépia, aceita destaque por toque e retoma a leitura da cópia local')

  const formation = 'Formação Cientista de Dados 4.0 - Data Science Academy'
  const formationParts = [id('p10-dsa'), id('p1-dsa'), id('p2-dsa')]
  tree[ROOT].push(...formationParts.map((part, index) => ({ id: part, name: `${formation} (Parte ${[10, 1, 2][index]})`, mimeType: F })))
  tree[formationParts[0]] = [{ id: id('video10'), name: 'Aula 10.mp4', mimeType: 'video/mp4' }]
  tree[formationParts[1]] = [{ id: id('handout'), name: 'Material.html', mimeType: 'text/html', resourceKey: 'key-html-example' }]
  tree[formationParts[2]] = [{ id: id('video2'), name: 'Aula 2.mp4', mimeType: 'video/mp4' }]
  await page.goto(`${base}/cursos`)
  await page.getByRole('button', { name: 'Pastas do Drive' }).click()
  await page.getByRole('button', { name: 'Conectar com o Google' }).click()
  await page.getByRole('button', { name: 'Atualizar do Drive' }).click()
  await page.getByRole('button', { name: 'Aplicar atualização' }).click()
  await page.getByText(/Catálogo atualizado: 6 novo/).waitFor()
  await page.keyboard.press('Escape')
  const folder = page.getByRole('link', { name: /Formação Cientista de Dados 4\.0.*Abrir pasta/ })
  await folder.waitFor()
  await page.waitForFunction(() => [...document.images].some((image) => image.src.endsWith('dsa-cientista-dados-4.jpg') && image.complete && image.naturalWidth > 0))
  assert.equal(await page.getByRole('link', { name: `${formation} (Parte 1)`, exact: true }).count(), 0)
  await folder.click()
  const parts = page.getByRole('region', { name: 'Partes da formação' })
  await parts.getByRole('link').first().waitFor()
  assert.deepEqual((await parts.getByRole('link').allTextContents()).map((title) => title.match(/^Parte (\d+)/)?.[1]), ['1', '2', '10'])
  await noOverflow()
  await page.screenshot({ path: `${out}/pasta-formacao.png` })
  await page.getByRole('link', { name: 'Começar formação' }).click()
  const htmlRoute = await page.waitForURL((url) => url.searchParams.has('item')).then(() => page.url())
  await page.getByRole('button', { name: 'Autorizar leitura', exact: true }).click()
  const htmlFrame = page.frameLocator('iframe[title="HTML: Material.html"]')
  await htmlFrame.getByRole('heading', { name: 'Material HTML da aula' }).waitFor()
  assert.equal(page.url(), htmlRoute)
  assert.equal(await page.locator('iframe[title="HTML: Material.html"]').getAttribute('sandbox'), '')
  assert.equal(await htmlFrame.getByRole('heading').evaluate((element) => getComputedStyle(element).color), 'rgb(180, 0, 0)')
  assert.equal(await htmlFrame.getByText('Script executado').count(), 0)
  await noOverflow()
  await page.screenshot({ path: `${out}/celular-leitor-html.png` })
  console.log('OK | pasta com capa e partes ordenadas, abertura automática do HTML selecionado e scripts desativados')

  for (const path of ['/videos', '/biblioteca', '/sala']) {
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
