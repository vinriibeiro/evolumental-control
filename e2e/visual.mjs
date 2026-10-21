// Gera capturas de tela de estados ricos (dados de exemplo criados pela própria UI,
// no modo local) para revisão visual. Uso: node e2e/visual.mjs <pasta> [url]
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const OUT = process.argv[2] ?? 'e2e/visual'
const B = process.argv[3] ?? 'http://localhost:5173'
mkdirSync(OUT, { recursive: true })
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath: exe, headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts })

for (const name of ['Direito Administrativo', 'Português', 'Informática']) {
  await page.goto(`${B}/materias`)
  await page.getByRole('button', { name: 'Nova matéria' }).first().click()
  await page.getByLabel('Nome').fill(name)
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByRole('link', { name: new RegExp(name) }).waitFor()
}
await shot('materias')
await page.getByRole('link', { name: /Direito Administrativo/ }).click()
await page.getByRole('button', { name: 'Colar estrutura' }).first().click()
await page.getByLabel('Estrutura em texto').fill('Atos administrativos\n  Conceito\n  Requisitos\n    Competência\n    Finalidade\n  Atributos\nPoderes administrativos\n  Poder hierárquico\n  Poder de polícia')
await page.getByRole('button', { name: /Importar/ }).click()
await page.getByRole('treeitem').nth(8).waitFor()
await shot('materia-topicos')

for (const [d, t, m, subj] of [
  ['2026-10-19', '08:00', '90', 'Português'],
  ['2026-10-20', '19:00', '120', 'Direito Administrativo'],
  ['2026-10-21', '07:00', '45', 'Informática'],
]) {
  await page.goto(`${B}/cronometro`)
  await page.getByRole('button', { name: 'Lançamento manual' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Matéria').selectOption({ label: subj })
  await dlg.getByLabel('Data').fill(d)
  await dlg.getByLabel('Início').fill(t)
  await dlg.getByLabel('Minutos').fill(m)
  await dlg.getByRole('button', { name: 'Registrar' }).click()
  await page.getByText('Sessão registrada.').waitFor()
}
await page.getByLabel('Matéria').first().selectOption({ label: 'Português' })
await page.getByRole('radio', { name: 'Pomodoro' }).click()
await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
await page.getByRole('button', { name: 'Pausar' }).waitFor()
await page.waitForTimeout(1500)
await shot('timer-ativo')
await page.setViewportSize({ width: 390, height: 844 })
await shot('timer-ativo-celular')
await page.setViewportSize({ width: 1366, height: 860 })
await page.getByRole('button', { name: 'Finalizar' }).click()
await page.getByRole('heading', { name: 'Resumo da sessão' }).waitFor()
await shot('timer-resumo')
await page.getByRole('button', { name: 'Salvar sessão' }).click()
await page.getByText(/Sessão salva/).waitFor()

await page.goto(B)
await page.getByText('Tempo por matéria').waitFor()
await page.waitForTimeout(800)
await shot('dashboard', { fullPage: true })

await page.goto(`${B}/cronograma`)
await page.getByRole('button', { name: 'Novo cronograma' }).first().click()
await page.getByRole('button', { name: 'Salvar' }).click()
await page.getByRole('button', { name: 'Gerar proposta' }).click()
await page.getByRole('button', { name: 'Aplicar proposta' }).waitFor()
await page.waitForTimeout(300)
await shot('cronograma-proposta')
await page.getByRole('button', { name: 'Aplicar proposta' }).click()
await page.getByText(/blocos aplicados/).waitFor()
await page.waitForTimeout(600)
await shot('cronograma-semana')

await page.goto(`${B}/ciclos`)
await page.getByRole('button', { name: 'Novo ciclo' }).first().click()
await page.getByLabel(/Nome/).fill('Ciclo base')
await page.getByRole('button', { name: 'Salvar' }).click()
for (const s of ['Português', 'Direito Administrativo', 'Informática']) {
  await page.getByRole('button', { name: 'Bloco', exact: true }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Matéria').selectOption({ label: s })
  await d.getByRole('button', { name: 'Salvar' }).click()
  await d.waitFor({ state: 'detached' })
}
await page.waitForTimeout(500)
await shot('ciclo')

await page.goto(`${B}/flashcards`)
await page.getByRole('button', { name: 'Novo baralho' }).first().click()
await page.getByLabel('Nome').fill('Constitucional')
await page.getByRole('button', { name: 'Salvar' }).click()
await page.getByRole('button', { name: 'Cartão', exact: true }).click()
await page.getByLabel('Frente (pergunta)').fill('Quais são os fundamentos da República (art. 1º)?')
await page.getByLabel('Verso (resposta)').fill('Soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa e pluralismo político.')
await page.getByRole('button', { name: 'Salvar', exact: true }).click()
await page.getByRole('button', { name: 'Vencidos' }).click()
await page.getByRole('button', { name: /Mostrar resposta/ }).click()
await page.waitForTimeout(300)
await shot('flashcard-revisao', { fullPage: true })

await page.goto(`${B}/configuracoes`)
await page.getByRole('radio', { name: /Escuro/ }).click()
await page.waitForTimeout(500)
await page.goto(B)
await page.getByText('Tempo por matéria').waitFor()
await page.waitForTimeout(800)
await shot('dashboard-escuro')
await page.goto(`${B}/calendario`)
await page.waitForTimeout(800)
await shot('calendario-escuro')

console.log(errs.length ? `Erros: ${errs.join('\n')}` : 'Sem erros de console.')
await browser.close()
