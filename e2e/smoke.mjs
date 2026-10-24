// Teste de fumaça E2E no modo local, usando o Edge/Chrome instalado.
// Uso: npm run dev (em outro terminal) e depois `node e2e/smoke.mjs [url] [pasta-screenshots]`.
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'e2e/screens'
mkdirSync(OUT, { recursive: true })

const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'].find((p) => p && existsSync(p))
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
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
    await page.screenshot({ path: `${OUT}/falha-${results.length}.png` }).catch(() => {})
  }
}
const clockSeconds = async () => {
  const t = await page.locator('p.tabular').filter({ hasText: /^\d{2}:\d{2}:\d{2}$/ }).first().innerText()
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

await step('abre o app em modo local', async () => {
  await page.goto(BASE)
  await page.getByText('Modo local:').waitFor()
  await page.getByRole('heading', { name: 'Visão geral' }).first().waitFor()
})

await step('Explorador: cria área, pasta e matéria (com breadcrumbs)', async () => {
  await page.goto(`${BASE}/materias`)
  await page.getByRole('button', { name: 'Nova área' }).click()
  await page.getByLabel('Nome').fill('Concurso SEFAZ')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('treeitem', { name: 'Área de estudo: Concurso SEFAZ' }).click()
  await page.waitForURL(/\/materias\/pasta\//)
  await page.getByRole('button', { name: 'Nova subpasta' }).click()
  await page.getByLabel('Nome').fill('Direito')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('treeitem', { name: 'Pasta: Direito' }).click()
  await page.getByRole('button', { name: 'Nova matéria' }).first().click()
  await page.getByLabel('Nome').fill('Direito Administrativo')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('treeitem', { name: 'Matéria: Direito Administrativo' }).click()
  await page.getByRole('heading', { name: 'Direito Administrativo', level: 1 }).waitFor()
  const crumbs = await page.getByRole('navigation', { name: 'Você está em' }).innerText()
  if (!/Concurso SEFAZ[\s\S]*Direito[\s\S]*Direito Administrativo/.test(crumbs)) throw new Error(`breadcrumbs: ${crumbs}`)
})

await step('importa edital com prévia editável (3 níveis + pasta)', async () => {
  await page.getByRole('button', { name: 'Colar estrutura (edital)' }).click()
  await page.getByLabel('Estrutura em texto').fill('Atos administrativos\n  Conceito\n  Requisitos\n    Competência\nPoderes administrativos\n  Poder de polícia\nItem a remover')
  await page.getByRole('button', { name: 'Ver prévia' }).click()
  const preview = page.getByRole('tree', { name: 'Prévia da estrutura' })
  await preview.getByRole('treeitem', { name: 'Item a remover' }).getByRole('button', { name: /Remover/ }).click()
  await preview.getByRole('treeitem', { name: 'Atos administrativos' }).getByRole('button', { name: 'Tópico' }).first().click()
  await page.getByRole('button', { name: 'Criar estrutura' }).click()
  await page.getByRole('button', { name: 'Expandir tudo' }).click()
  const tree = page.getByRole('tree', { name: 'Explorador de estudos' })
  await tree.getByRole('treeitem', { name: 'Tópico: Competência' }).waitFor()
  await tree.getByRole('treeitem', { name: 'Pasta da matéria: Atos administrativos' }).waitFor()
  const n = await tree.getByRole('treeitem', { name: /^(Tópico|Pasta da matéria):/ }).count()
  if (n !== 6) throw new Error(`esperava 6 itens na matéria, vi ${n}`)
})

await step('menu de contexto, mover e página do tópico com anotação', async () => {
  const tree = page.getByRole('tree', { name: 'Explorador de estudos' })
  await tree.getByRole('treeitem', { name: 'Tópico: Poder de polícia' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Mover para…' }).click()
  await page.getByRole('option', { name: /Atos administrativos/ }).click()
  await page.getByRole('button', { name: 'Mover para cá' }).click()
  await page.getByText('Item movido.').waitFor()
  await tree.getByRole('treeitem', { name: 'Tópico: Conceito' }).click()
  await page.getByRole('heading', { name: 'Conceito', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Adicionar anotação' }).click()
  await page.getByLabel('Anotações do tópico').fill('Ato administrativo: manifestação unilateral da Administração.')
  await page.getByText('Salvo.').waitFor()
  await page.reload()
  await page.getByRole('tab', { name: 'Anotações' }).click()
  const v = await page.getByLabel('Anotações do tópico').inputValue()
  if (!v.startsWith('Ato administrativo')) throw new Error('anotação não persistiu')
})

await step('cronômetro: iniciar, pausar, continuar, recarregar e finalizar', async () => {
  await page.goto(`${BASE}/cronometro`)
  await page.getByLabel('Matéria').first().selectOption({ label: 'Direito Administrativo' })
  const start = page.getByRole('button', { name: 'Iniciar', exact: true })
  await start.dblclick() // clique duplo não pode criar duas sessões
  await page.getByRole('button', { name: 'Pausar' }).waitFor()
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Pausar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).waitFor()
  const atPause = await clockSeconds()
  await page.waitForTimeout(3000)
  const afterWait = await clockSeconds()
  if (afterWait !== atPause) throw new Error(`tempo andou durante a pausa (${atPause} → ${afterWait})`)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(2200)
  await page.reload()
  await page.getByRole('button', { name: 'Pausar' }).waitFor()
  const afterReload = await clockSeconds()
  if (afterReload < 5 || afterReload > 9) throw new Error(`tempo após recarregar fora do esperado: ${afterReload}s`)
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('heading', { name: 'Resumo da sessão' }).waitFor()
  await page.getByRole('button', { name: 'Salvar sessão' }).click()
  await page.getByText(/Sessão salva/).waitFor()
  await page.getByRole('heading', { name: 'Nova sessão de estudo' }).waitFor()
})

await step('dashboard reflete a sessão salva', async () => {
  await page.goto(BASE)
  await page.getByText('Tempo por matéria').waitFor()
  await page.getByText('Direito Administrativo').first().waitFor()
})

await step('flashcards: criar baralho e cartão, revisar com revelação', async () => {
  await page.goto(`${BASE}/flashcards`)
  await page.getByRole('button', { name: 'Novo baralho' }).first().click()
  await page.getByLabel('Nome').fill('Atos — conceitos')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('heading', { name: 'Atos — conceitos' }).waitFor()
  await page.getByRole('button', { name: 'Cartão', exact: true }).click()
  await page.getByLabel('Frente (pergunta)').fill('O que é ato vinculado?')
  await page.getByLabel('Verso (resposta)').fill('Aquele sem margem de escolha para o administrador.')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByText('O que é ato vinculado?').waitFor()
  await page.getByRole('button', { name: 'Vencidos' }).click()
  await page.getByRole('button', { name: /Mostrar resposta/ }).waitFor()
  if (await page.getByText('Aquele sem margem').isVisible()) throw new Error('resposta visível antes de revelar')
  await page.keyboard.press('Space')
  await page.getByText('Aquele sem margem').waitFor()
  await page.keyboard.press('3')
  await page.getByRole('heading', { name: 'Revisão concluída' }).waitFor()
})

await step('mapa mental: criar, adicionar nó, salvar e persistir após recarregar', async () => {
  await page.goto(`${BASE}/mapas`)
  await page.getByRole('button', { name: 'Novo mapa' }).first().click()
  await page.getByLabel(/Título/).fill('Poderes')
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await page.locator('.react-flow__node').first().waitFor()
  await page.waitForTimeout(400)
  await page.locator('.react-flow__node').first().click()
  await page.locator('.react-flow__node.selected').waitFor()
  await page.keyboard.press('Tab')
  await page.locator('.react-flow__node').nth(1).waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Texto do nó')
  await page.keyboard.type('Poder de polícia')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  await page.reload() // recarregar logo após editar não pode perder a alteração
  await page.locator('.react-flow__node').nth(1).waitFor()
  const n = await page.locator('.react-flow__node').count()
  if (n !== 2) throw new Error(`esperava 2 nós após recarregar, vi ${n}`)
  await page.getByText('Poder de polícia').waitFor()
})

await step('mapa mental: exporta PNG e PDF válidos', async () => {
  for (const [label, sig] of [['PNG', '\x89PNG'], ['PDF', '%PDF']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: label, exact: true }).click()])
    const path = await dl.path()
    const head = readFileSync(path).subarray(0, 4).toString('latin1')
    if (head !== sig) throw new Error(`${label} inválido (cabeçalho ${JSON.stringify(head)})`)
  }
})

await step('flashcards: importa CSV com prévia e validação', async () => {
  await page.goto(`${BASE}/flashcards`)
  await page.getByRole('link', { name: 'Atos — conceitos' }).click()
  await page.getByRole('button', { name: 'Importar CSV' }).click()
  const csv = 'frente;verso;observacao;tags\nPergunta A;Resposta A;;x|y\nPergunta B;;;\nPergunta C;Resposta C;nota;\n'
  await page.locator('input[type=file]').setInputFiles({ name: 'cartoes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByText('Verso vazio').waitFor()
  await page.getByRole('button', { name: /Importar 2 cartão/ }).click()
  await page.getByText('3 cartão(ões)').waitFor()
})

await step('ciclo: sessão parcial com decisão de avançar move a posição', async () => {
  await page.goto(`${BASE}/ciclos`)
  await page.getByRole('button', { name: 'Novo ciclo' }).first().click()
  await page.getByLabel(/Nome/).fill('Ciclo E2E')
  await page.getByRole('button', { name: 'Salvar' }).click()
  for (const _ of [1, 2]) {
    await page.getByRole('button', { name: 'Bloco', exact: true }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Matéria').selectOption({ label: 'Direito Administrativo' })
    await d.getByRole('button', { name: 'Salvar' }).click()
    await d.waitFor({ state: 'detached' })
  }
  await page.getByText('Posição atual: bloco 1 de 2').waitFor()
  await page.getByRole('button', { name: 'Estudar bloco' }).click()
  await page.getByText(/bloco atual do ciclo/).waitFor()
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await page.getByRole('button', { name: 'Pausar' }).waitFor()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await page.getByText(/ainda não foi concluído/).waitFor()
  await page.getByLabel('Avançar o ciclo para o próximo bloco').check()
  await page.getByRole('button', { name: 'Salvar sessão' }).click()
  await page.getByText(/ciclo avançou/).waitFor()
  await page.goto(`${BASE}/ciclos`)
  await page.getByText('Posição atual: bloco 2 de 2').waitFor()
})

await step('questões: valida acertos > total e registra', async () => {
  await page.goto(`${BASE}/questoes`)
  await page.getByRole('button', { name: 'Registrar questões' }).first().click()
  await page.getByLabel(/Respondidas/).fill('10')
  await page.getByLabel(/Acertos/).fill('12')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByText('Os acertos não podem exceder o total respondido.').waitFor()
  await page.getByLabel(/Acertos/).fill('8')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByText('80%').first().waitFor()
})

const pages = ['/', '/espaco', '/materias', '/cronometro', '/cronograma', '/ciclos', '/calendario', '/flashcards', '/mapas', '/revisoes', '/questoes', '/metas', '/relatorios', '/configuracoes']
for (const [label, vp] of [
  ['desktop', { width: 1366, height: 860 }],
  ['celular', { width: 390, height: 844 }],
]) {
  await page.setViewportSize(vp)
  for (const p of pages) {
    await step(`${label} ${p}: carrega sem rolagem horizontal`, async () => {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      await page.screenshot({ path: `${OUT}/${label}${p === '/' ? '-inicio' : p.replace(/\//g, '-')}.png`, fullPage: false })
      if (overflow > 1) throw new Error(`rolagem horizontal de ${overflow}px`)
    })
  }
}

await browser.close()
for (const r of results) console.log(r.join(' | '))
console.log(errors.length ? `\nErros de console/página (${errors.length}):\n` + [...new Set(errors)].join('\n') : '\nSem erros de console.')
process.exit(results.some((r) => r[0] !== 'OK') || errors.length ? 1 : 0)
