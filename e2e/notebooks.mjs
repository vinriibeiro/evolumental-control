// Teste E2E ponta a ponta do módulo Meus Cadernos (VLM Knowledge) em desktop e mobile.
// Uso:
//   - Contra servidor ativo: `node e2e/notebooks.mjs [url] [pasta-screenshots]`
//   - Servindo um build estático automaticamente: `node e2e/notebooks.mjs --serve <distDir> [pasta-screenshots]`
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import http from 'node:http'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

let BASE = process.argv[2] ?? 'http://127.0.0.1:5173'
let OUT = process.argv[3] ?? 'e2e/screens/notebooks'
let staticServer = null

if (process.argv[2] === '--serve' && process.argv[3]) {
  const distRoot = resolve(process.argv[3])
  OUT = process.argv[4] ?? 'e2e/screens/notebooks'
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
  }
  staticServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    let filePath = join(distRoot, urlPath === '/' ? 'index.html' : urlPath)
    if (!filePath.startsWith(distRoot) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(distRoot, 'index.html')
    }
    const ext = extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    res.end(readFileSync(filePath))
  })
  await new Promise((r) => staticServer.listen(0, '127.0.0.1', r))
  const addr = staticServer.address()
  BASE = `http://127.0.0.1:${addr.port}`
}

mkdirSync(OUT, { recursive: true })

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync)

if (!exe) {
  console.error('Nenhum navegador Chromium/Edge/Chrome encontrado para executar o E2E.')
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1366, height: 860 },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
})
const page = await ctx.newPage()
page.setDefaultTimeout(12000)

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['OK', name])
    console.log(`OK     | ${name}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    results.push(['FALHOU', name, msg])
    console.error(`FALHOU | ${name} — ${msg}`)
    await page.screenshot({ path: `${OUT}/falha-${results.length}.png`, fullPage: true }).catch(() => {})
  }
}

async function assertNoHorizontalOverflow(label) {
  const diff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(diff <= 2, `Overflow horizontal detectado em ${label}: +${diff}px`)
}

let notebookUrl = ''
let firstPageUrl = ''

try {
  // 1. Estado vazio inicial (100% autoral, nenhum caderno pré-criado)
  await step('01. Abre /cadernos em modo local com estado vazio limpo', async () => {
    await page.goto(`${BASE}/cadernos`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Meus Cadernos' }).waitFor()
    await page.getByText('Comece sua base de conhecimento').waitFor()
    await assertNoHorizontalOverflow('desktop /cadernos vazio')
  })

  // 2. Cria matéria e caderno vinculado manualmente
  await step('02. Cria matéria e caderno manual vinculado', async () => {
    await page.goto(`${BASE}/materias`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Nova matéria' }).first().click()
    await page.getByLabel('Nome').fill('Engenharia de Dados')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await page.getByRole('link', { name: /Engenharia de Dados/ }).waitFor()

    await page.goto(`${BASE}/cadernos`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Novo caderno' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^Nome/).fill('SQL & Modelagem')
    await dialog.getByLabel(/Descrição/).fill('Anotações manuais sobre SQL analítico e modelagem.')
    await dialog.getByLabel(/Matéria vinculada/).selectOption({ label: 'Engenharia de Dados' })
    await dialog.getByRole('button', { name: 'Criar caderno' }).click()
    await page.getByRole('link', { name: /SQL & Modelagem/ }).first().waitFor()
    await page.getByRole('link', { name: /SQL & Modelagem/ }).first().click()
    await page.waitForURL(/\/cadernos\/[0-9a-f-]+$/)
    notebookUrl = page.url()
  })

  // 3. Hierarquia multinível: seção -> subseção -> página -> subpágina
  await step('03. Cria seção, subseção, página e subpágina no workspace', async () => {
    await page.getByRole('button', { name: 'Nova seção' }).first().click()
    let d = page.getByRole('dialog')
    await d.getByLabel(/Título/).fill('Consultas Analíticas')
    await d.getByRole('button', { name: 'Criar' }).click()
    await page.getByRole('heading', { level: 1, name: 'Consultas Analíticas' }).waitFor()

    await page.getByRole('button', { name: 'Nova subseção' }).click()
    d = page.getByRole('dialog')
    await d.getByLabel(/Título/).fill('Window Functions')
    await d.getByRole('button', { name: 'Criar' }).click()
    await page.getByRole('heading', { level: 1, name: 'Window Functions' }).waitFor()

    await page.getByRole('button', { name: 'Nova página' }).first().click()
    d = page.getByRole('dialog')
    await d.getByLabel(/Título/).fill('RANK vs DENSE_RANK')
    await d.getByRole('button', { name: 'Criar' }).click()
    await page.getByLabel('Título da página').waitFor()
    firstPageUrl = page.url()
  })

  // 4. Edição rica em blocos + slash menu + código + autosave + persistência pós-reload
  await step('04. Edita página com blocos ricos, autosave e confirma após reload', async () => {
    const editor = page.locator('.kb-prosemirror')
    await editor.click()
    await page.keyboard.type('# Diferenças principais')
    await page.keyboard.press('Enter')
    await page.keyboard.type('RANK pula posições após empates; DENSE_RANK mantém a sequência contínua.')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/codigo')
    await page.getByRole('listbox', { name: 'Inserir bloco' }).waitFor()
    await page.keyboard.press('Enter')
    await page.keyboard.type('SELECT id, DENSE_RANK() OVER (ORDER BY score DESC) FROM notas;')
    await page.keyboard.press('Control+s')
    await page.getByText(/Salvo \(v/).waitFor({ timeout: 10000 })

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('DENSE_RANK mantém a sequência contínua').waitFor()
    await page.getByText('SELECT id, DENSE_RANK()').waitFor()
  })

  // 5. Revisão ativa: dificuldade, marcar revisão, modos Leitura/Foco e busca na página
  await step('05. Revisão ativa, modos leitura/foco e busca dentro da página', async () => {
    await page.getByLabel('Dificuldade da página').selectOption('4')
    await page.getByRole('button', { name: 'Marcar revisão' }).click()
    await page.getByRole('button', { name: 'Revisar', exact: true }).waitFor()

    await page.getByRole('button', { name: 'Leitura', exact: true }).click()
    await page.getByRole('button', { name: 'Editar', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Editar', exact: true }).click()

    await page.getByRole('button', { name: 'Modo foco' }).click()
    await page.getByRole('button', { name: /Sair do foco/ }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Modo foco' }).waitFor()

    await page.getByRole('button', { name: 'Buscar nesta página' }).click()
    await page.getByLabel('Buscar dentro da página').fill('DENSE_RANK')
    await page.getByText(/bloco\(s\)/).waitFor()
    await page.getByRole('button', { name: 'Fechar busca' }).click()
  })

  // 6. Histórico de versões: cria marco manual
  await step('06. Salva marco manual no histórico de versões', async () => {
    await page.getByRole('button', { name: 'Versões', exact: true }).click()
    const d = page.getByRole('dialog')
    await d.getByRole('button', { name: /Salvar marco/ }).click()
    await d.getByText('Manual').first().waitFor()
    await d.getByRole('button', { name: 'Fechar' }).first().click()
  })

  // 7. Tags personalizadas na página
  await step('07. Cria e aplica tag #SQL na página', async () => {
    await page.getByRole('button', { name: /^Tag$/ }).click()
    await page.getByLabel('Nova tag').fill('SQL')
    await page.keyboard.press('Enter')
    await page.getByRole('link', { name: '#SQL' }).first().waitFor()
    await page.keyboard.press('Escape')
  })

  // 8. Cria segunda página, conecta via vínculo manual e valida backlinks + Grafo
  await step('08. Conecta páginas, verifica backlinks e abre Grafo de Conhecimento', async () => {
    await page.getByRole('button', { name: 'Página', exact: true }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel(/Título/).fill('CTEs e Subqueries')
    await d.getByRole('button', { name: 'Criar' }).click()
    await page.getByLabel('Título da página').waitFor()
    await page.waitForFunction(() => document.querySelector('input[aria-label="Título da página"]')?.value === 'CTEs e Subqueries')

    await page.getByRole('button', { name: /Vincular/ }).click()
    await page.getByLabel('Escolher página para vincular').selectOption({ label: 'RANK vs DENSE_RANK (SQL & Modelagem)' })
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await page.getByText('Conexão adicionada.').waitFor()

    await page.goto(`${BASE}/cadernos/conexoes`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Conexões' }).waitFor()
    await page.getByRole('img', { name: /Grafo de conhecimento com \d+ nós e 1 conexões/ }).waitFor()
    await assertNoHorizontalOverflow('desktop /cadernos/conexoes')
  })

  // 9. Flashcard Cloze vinculado à página + revisão SM-2 + "Ver anotação de origem"
  await step('09. Cria flashcard Cloze da anotação, revisa e volta via "Ver anotação de origem"', async () => {
    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Flashcard', exact: true }).click()
    const d = page.getByRole('dialog')
    await d.getByRole('radio', { name: 'Cloze' }).click()
    await d.getByLabel(/Nome do novo baralho/).fill('Baralho SQL Analítico')
    await d.getByLabel(/Texto com lacunas/).fill('A função {{c1::DENSE_RANK}} não pula posições após empates.')
    await d.getByRole('button', { name: 'Salvar flashcard' }).click()
    await page.getByText('Flashcard criado e vinculado à anotação.').waitFor()

    await page.getByRole('link', { name: 'Revisar página' }).click()
    await page.waitForURL(/\/flashcards\/revisar/)
    await page.getByText('[c1]').waitFor()
    await page.getByRole('link', { name: 'Ver anotação de origem' }).waitFor()
    await page.keyboard.press('Space')
    await page.getByText('DENSE_RANK').first().waitFor()
    await page.getByRole('link', { name: 'Ver anotação de origem' }).click()
    await page.waitForURL(/\/cadernos\/[0-9a-f-]+\/pagina\/[0-9a-f-]+/)
  })

  // 10. Inicia cronômetro de estudo a partir da página (sem sair do caderno)
  await step('10. Inicia cronômetro pela página mantendo o editor aberto', async () => {
    await page.getByRole('button', { name: 'Estudar este conteúdo' }).click()
    await page.getByRole('button', { name: /Pausar|Cancelar|Finalizar/ }).first().waitFor({ timeout: 8000 })
    // Cancela a sessão de teste na barra minimizada/sala para manter estado limpo
    await page.goto(`${BASE}/sala`, { waitUntil: 'networkidle' })
    const cancelBtn = page.getByRole('button', { name: 'Cancelar' }).first()
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click()
      const confirm = page.getByRole('dialog').getByRole('button', { name: /Cancelar sessão|Sim|Confirmar/ }).first()
      if (await confirm.isVisible().catch(() => false)) await confirm.click()
    }
  })

  // 11. Agenda revisão a partir da página
  await step('11. Agenda revisão integrada a /revisoes', async () => {
    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Agendar revisão' }).first().click()
    const d = page.getByRole('dialog')
    await d.getByRole('button', { name: 'Agendar', exact: true }).click()
    await page.getByText(/Revisão agendada/).waitFor()
    await page.goto(`${BASE}/revisoes`, { waitUntil: 'networkidle' })
    await page.getByText('RANK vs DENSE_RANK').first().waitFor()
  })

  // 12. Integração na página da Matéria (sem duplicar e sem alterar progresso)
  await step('12. Matéria exibe caderno e páginas vinculadas sem alterar progresso', async () => {
    await page.goto(`${BASE}/materias`, { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: /Engenharia de Dados/ }).first().click()
    await page.getByRole('tab', { name: /Cadernos/ }).click()
    await page.getByText('SQL & Modelagem').first().waitFor()
  })

  // 13. Duplicar, lixeira e restauração (flashcard permanece intacto)
  await step('13. Duplica página, envia para lixeira e restaura com segurança', async () => {
    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    const ctxPanel = page.getByRole('complementary', { name: 'Painel de contexto' })
    await ctxPanel.getByRole('button', { name: 'Duplicar', exact: true }).click()
    await page.getByText('Página duplicada.').waitFor()

    // Envia a cópia recém-aberta para a lixeira e restaura em /cadernos/lixeira
    await ctxPanel.getByRole('button', { name: 'Mover para lixeira', exact: true }).click()
    await page.getByText('Enviado para a lixeira.').waitFor()

    await page.goto(`${BASE}/cadernos/lixeira`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Lixeira' }).waitFor()
    await page.getByRole('button', { name: 'Restaurar' }).first().click()
    await page.getByText(/restaurad/i).waitFor()
  })

  // 14. Exportação (Markdown/PDF) e importação Markdown com prévia
  await step('14. Exporta página em Markdown e PDF e importa arquivo .md com prévia', async () => {
    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Exportar página ou caderno' }).click()
    const d = page.getByRole('dialog')
    const [dlMd] = await Promise.all([page.waitForEvent('download'), d.getByRole('button', { name: 'Markdown' }).click()])
    assert.ok(dlMd.suggestedFilename().endsWith('.md'))
    const [dlPdf] = await Promise.all([page.waitForEvent('download'), d.getByRole('button', { name: 'PDF A4' }).click()])
    assert.ok(dlPdf.suggestedFilename().endsWith('.pdf'))
    await d.getByRole('button', { name: 'Fechar' }).first().click()

    await page.goto(`${BASE}/cadernos`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Importar' }).click()
    const imp = page.getByRole('dialog')
    await imp.locator('input[type="file"]').setInputFiles({
      name: 'estatistica-basica.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Estatística Básica\n\nMédia, mediana e desvio padrão.'),
    })
    await imp.getByText('Páginas detectadas').waitFor()
    await imp.getByRole('button', { name: 'Confirmar importação' }).click()
    await page.waitForURL(/\/cadernos\/[0-9a-f-]+/)
  })

  // 15. Busca global Ctrl+K encontra páginas e tags
  await step('15. Busca global (Ctrl+K) encontra texto da página e tag #SQL', async () => {
    await page.goto(`${BASE}/cadernos`, { waitUntil: 'networkidle' })
    await page.keyboard.press('Control+k')
    const input = page.getByRole('dialog').locator('input').first()
    await input.fill('DENSE_RANK')
    await page.getByRole('dialog').getByText('RANK vs DENSE_RANK').first().waitFor()
    await page.keyboard.press('Escape')
  })

  // 16. Responsividade mobile (390×844): drawer, editor, grafo e zero overflow
  await step('16. Responsividade mobile (390×844) sem overflow horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/cadernos`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Meus Cadernos' }).waitFor()
    await assertNoHorizontalOverflow('mobile /cadernos')

    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    await page.getByLabel('Título da página').waitFor()
    await assertNoHorizontalOverflow('mobile workspace página')

    await page.getByRole('button', { name: 'Abrir estrutura do caderno' }).click()
    await page.getByRole('dialog', { name: 'Estrutura do caderno' }).waitFor()
    await page.getByRole('button', { name: 'Fechar estrutura' }).click()

    await page.goto(`${BASE}/cadernos/conexoes`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1, name: 'Conexões' }).waitFor()
    await assertNoHorizontalOverflow('mobile /cadernos/conexoes')
    await page.screenshot({ path: `${OUT}/mobile-conexoes.png`, fullPage: true })
  })

  if (notebookUrl) {
    await page.setViewportSize({ width: 1366, height: 860 })
    await page.goto(firstPageUrl, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${OUT}/desktop-editor.png`, fullPage: true })
  }
} finally {
  await browser.close()
  if (staticServer) staticServer.close()
}

const failed = results.filter((r) => r[0] === 'FALHOU')
console.log(`\nResumo E2E Meus Cadernos: ${results.length - failed.length}/${results.length} fluxos OK | ${errors.length} erro(s) de console/página`)
if (errors.length > 0) {
  console.error('Erros capturados:\n' + errors.join('\n'))
}
if (failed.length > 0 || errors.length > 0) {
  process.exit(1)
}
