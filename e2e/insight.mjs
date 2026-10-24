// E2E da camada de inteligência (modo local): tela Hoje, próxima ação,
// domínio no Explorador e demais telas desta fase. Os dados de exemplo entram
// pela importação JSON de Configurações e pelos formulários do próprio app.
// Uso: npm run dev (em outro terminal) e `node e2e/insight.mjs [url] [pasta]`.
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'e2e/screens-insight'
mkdirSync(OUT, { recursive: true })
const exe = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'].find((p) => p && existsSync(p))
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

// Cenário: Português (prioridade alta, meta 6h/semana) com Crase e Regência;
// Estatística com Gráficos. Sessões nos últimos dias.
const day = (n) => new Date(Date.now() - n * 86400000).toISOString()
const seed = {
  subjects: [
    { id: 'pt', name: 'Português', color: '#2A78D6', priority: 5, difficulty: 3, weekly_goal_hours: 6 },
    { id: 'es', name: 'Estatística', color: '#EB6834', priority: 3, difficulty: 4 },
  ],
  topics: [
    { id: 'crase', subject_id: 'pt', name: 'Crase', priority: 5, weight: 2 },
    { id: 'reg', subject_id: 'pt', name: 'Regência', priority: 3 },
    { id: 'graf', subject_id: 'es', name: 'Gráficos', priority: 3 },
  ],
  study_sessions: [
    { id: 's1', subject_id: 'pt', topic_id: 'crase', activity_type: 'theory', started_at: day(9), ended_at: new Date(Date.parse(day(9)) + 50 * 60000).toISOString(), status: 'completed' },
    { id: 's2', subject_id: 'es', topic_id: 'graf', activity_type: 'theory', started_at: day(2), ended_at: new Date(Date.parse(day(2)) + 40 * 60000).toISOString(), status: 'completed' },
  ],
}

async function openTopic(subject, topic) {
  await page.goto(`${BASE}/materias`)
  await page.locator('main').getByRole('button', { name: new RegExp(`^${subject}`) }).first().click()
  await page.getByRole('button', { name: new RegExp(`^${topic}`) }).first().click()
  await page.getByRole('heading', { name: topic }).waitFor()
}

async function registerQuestions(total, correct, reasons = {}) {
  await page.getByRole('button', { name: 'Registrar questão' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel(/Respondidas/).fill(String(total))
  await dlg.getByLabel(/Acertos/).fill(String(correct))
  for (const [label, n] of Object.entries(reasons)) await dlg.getByLabel(`Erros por ${label}`).fill(String(n))
  await dlg.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('dialog', { name: 'Registrar questões' }).waitFor({ state: 'detached' })
}

await step('importa o cenário de teste (JSON)', async () => {
  await page.goto(`${BASE}/configuracoes`)
  await page.getByLabel('Arquivo JSON para importar').setInputFiles({ name: 'cenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) })
  await page.getByRole('dialog').getByRole('button', { name: /^Importar/ }).click()
  await page.getByText(/importad/i).first().waitFor()
})

await step('questões com erros recentes em Crase', async () => {
  await openTopic('Português', 'Crase')
  await registerQuestions(12, 5, { Interpretação: 5, Distração: 2 })
  // Erro → oferta de revisão (nada é criado sem escolha).
  const follow = page.getByRole('dialog', { name: 'Quer revisar este assunto?' })
  await follow.waitFor()
  await follow.getByText('7 erro(s) em Crase').waitFor()
  await follow.getByRole('button', { name: 'Revisar amanhã' }).click()
  await page.getByText(/Revisão agendada para/).waitFor()
  await page.getByText(/domínio|Domínio/).first().waitFor()
  await page.screenshot({ path: `${OUT}/topico-dominio.png`, fullPage: true })
})

await step('Hoje: próxima ação explicada (Crase, por prioridade e erros)', async () => {
  await page.goto(`${BASE}/espaco`)
  const card = page.locator('section', { has: page.locator('#hoje-proxima') })
  await card.getByText('Crase').first().waitFor()
  await card.getByText('Motivos').waitFor()
  await card.getByText(/7 erros nos últimos 14 dias/).waitFor()
  for (const b of ['Começar agora', 'Fazer questões', 'Revisar', 'Ver tópico', 'Ignorar por hoje']) await card.getByRole('button', { name: b }).waitFor()
  await page.getByText('Plano do dia').waitFor()
  await page.getByText('Pendências').first().waitFor()
  await page.screenshot({ path: `${OUT}/hoje.png`, fullPage: true })
})

await step('Hoje: "Ignorar por hoje" troca a recomendação e persiste ao recarregar', async () => {
  const card = page.locator('section', { has: page.locator('#hoje-proxima') })
  const before = await card.locator('p.text-xl').innerText()
  await card.getByRole('button', { name: 'Ignorar por hoje' }).click()
  await page.waitForTimeout(300)
  const after = await card.locator('p.text-xl').innerText()
  if (after === before) throw new Error(`não trocou: ${before}`)
  await page.reload()
  await card.locator('p.text-xl').waitFor()
  if ((await card.locator('p.text-xl').innerText()) === before) throw new Error('voltou após recarregar')
})

await step('Hoje: "Começar agora" abre o cronômetro com matéria e tópico', async () => {
  const card = page.locator('section', { has: page.locator('#hoje-proxima') })
  await card.getByRole('button', { name: 'Começar agora' }).click()
  await page.waitForURL(/\/cronometro\?/)
  if (!/materia=/.test(page.url())) throw new Error(page.url())
})

await step('Explorador: mapa do edital alterna progresso → domínio → acerto', async () => {
  await page.goto(`${BASE}/materias`)
  await page.locator('main').getByRole('button', { name: /^Português/ }).first().click()
  const show = page.locator('main').getByLabel('Mostrar').first()
  await show.selectOption('mastery')
  await page.locator('main').getByLabel(/^Domínio \d+%/).first().waitFor()
  await page.screenshot({ path: `${OUT}/edital-dominio.png`, fullPage: true })
  await show.selectOption('accuracy')
  await page.locator('main').getByLabel('42% de acerto em 12 questões').first().waitFor()
  await show.selectOption('progress')
})

await step('Cronograma: cartão planejado × realizado aparece (sem plano: orientação)', async () => {
  await page.goto(`${BASE}/cronograma`)
  await page.getByText(/Planejado × realizado/).waitFor()
  await page.getByText(/Sem blocos planejados nas últimas semanas/).waitFor()
})

await step('Caderno de erros: motivos, frase observável e marcar resolvido', async () => {
  await page.goto(`${BASE}/questoes/caderno`)
  await page.getByRole('heading', { name: 'Caderno de erros' }).waitFor()
  await page.getByText('71% dos erros classificados no período são de "Interpretação" (5 de 7).').waitFor()
  await page.getByText('Erros (2)').waitFor()
  await page.screenshot({ path: `${OUT}/caderno.png`, fullPage: true })
  await page.getByLabel('Marcar como resolvido').first().check()
  await page.getByRole('radio', { name: 'Não resolvidos' }).click()
  await page.getByText('Erros (1)').waitFor()
})

await step('Matéria: domínio e previsão de conclusão com cenários e meta personalizada', async () => {
  await page.goto(`${BASE}/materias`)
  await page.locator('main').getByRole('button', { name: /^Português/ }).first().click()
  await page.getByText('Previsão de conclusão de Português').waitFor()
  await page.getByText(/Faltam 2 de 2 tópicos/).waitFor()
  await page.getByRole('cell', { name: '+1 h/dia' }).waitFor()
  await page.getByLabel('Meta personalizada (horas/semana)').fill('10')
  await page.getByRole('cell', { name: 'Meta personalizada' }).waitFor()
  await page.getByText(/não é uma certeza/).waitFor()
  await page.screenshot({ path: `${OUT}/materia-previsao.png`, fullPage: true })
})

await step('Visão geral em 3 perguntas: hoje, o que fazer, evolução (semana, feed e calendário)', async () => {
  await page.goto(`${BASE}/`)
  for (const h of ['Como estou hoje?', 'O que preciso fazer?', 'Estou evoluindo?']) await page.getByRole('heading', { name: h }).waitFor()
  await page.getByText('Próxima ação recomendada').waitFor()
  await page.getByText(/Esta semana \(\d/).waitFor()
  await page.getByText('Sua evolução').waitFor()
  await page.getByText('Constância no último ano').waitFor()
  await page.getByRole('group', { name: 'Calendário de estudo do último ano' }).getByRole('button').first().waitFor()
  await page.getByText('Ver como tabela').click()
  await page.getByText('Previsão de conclusão (matérias ativas)').waitFor()
  await page.screenshot({ path: `${OUT}/visao-geral.png`, fullPage: true })
})

await step('Busca global e comandos (Ctrl+K): grupos, ações rápidas e "Nova tarefa"', async () => {
  await page.goto(`${BASE}/espaco`)
  await page.getByText('Plano do dia').waitFor()
  await page.keyboard.press('Control+k')
  const dlg = page.getByRole('dialog', { name: 'Pesquisar e comandos' })
  await dlg.getByLabel('Termo de pesquisa').fill('crase')
  const topics = dlg.getByRole('group', { name: 'Tópicos' })
  await topics.getByText('Crase').waitFor()
  await topics.getByRole('button', { name: 'Estudar: Crase' }).waitFor()
  await dlg.getByRole('group', { name: 'Questões' }).getByText('1 registro').waitFor()
  await page.screenshot({ path: `${OUT}/busca.png` })
  await dlg.getByLabel('Termo de pesquisa').fill('estudar port')
  await dlg.getByRole('group', { name: 'Comandos' }).getByText('Estudar Português').waitFor()
  await dlg.getByLabel('Termo de pesquisa').fill('nova tarefa')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/calendario/)
  await page.getByRole('dialog').getByText(/tarefa/i).first().waitFor()
})

await step('Hoje no celular: sem rolagem horizontal, aba "Hoje" ativa', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', storageState: await ctx.storageState() })
  const p = await m.newPage()
  await p.goto(`${BASE}/espaco`)
  await p.getByText('Plano do dia').waitFor()
  if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('rolagem horizontal')
  await p.screenshot({ path: `${OUT}/hoje-celular.png`, fullPage: true })
  await m.close()
})

await browser.close()
for (const r of results) console.log(r.join(' | '))
console.log(errors.length ? `\nErros de console:\n${errors.join('\n')}` : '\nSem erros de console.')
process.exit(results.some((r) => r[0] !== 'OK') || errors.length ? 1 : 0)
