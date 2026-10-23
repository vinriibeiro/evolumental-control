// E2E do Mundo Evolumental (modo local): primeira experiência, apresentação
// guiada (piloto automático da Vila até a cidade escolhida), as primeiras
// etapas da Cidade dos Dados, a bilheteria e a Minha Cidade.
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
    for (const pg of ctx.browser()?.contexts().flatMap((c) => c.pages()) ?? []) if (pg !== page) await pg.screenshot({ path: `${OUT}/mundo-falha-${results.length}-extra.png` }).catch(() => {})
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
/** Apresentação guiada: só avança falas e escolhe a cidade; o personagem anda sozinho. */
async function runGuide(p, city) {
  const next = async () => {
    const dlg = p.getByRole('dialog')
    await dlg.waitFor({ timeout: 20000 })
    for (let i = 0; i < 10 && (await dlg.count()); i++) {
      await dlg.getByRole('button', { name: /Continuar|Encerrar|Mostrar tudo/ }).click()
      await p.waitForTimeout(120)
    }
  }
  await next() // Iara: apresentação
  await p.getByRole('dialog', { name: 'Quadro de Missões' }).waitFor({ timeout: 20000 })
  await p.screenshot({ path: `${OUT}/mundo-quadro.png` })
  await p.getByRole('button', { name: new RegExp(city) }).click()
  await next() // Iara: vale e mapa
  await next() // Dora: passagem
  await p.getByText('Em viagem para').waitFor({ timeout: 20000 })
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
  await page.getByRole('button', { name: /^Executar Ctrl/ }).click()
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

await step('apresentação guiada: teclado não move; Iara → Quadro (escolha) → Dora → ônibus → cidade', async () => {
  const before = await st()
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(400)
  await page.keyboard.up('KeyS')
  const during = await st()
  if (during.region !== 'hub' || (during.y > before.y + 0.2 && !during.quests.tutorial)) throw new Error('o teclado moveu o personagem durante a apresentação')
  await runGuide(page, 'Cidade dos Dados')
  await page.getByText('Fale com Maya no saguão').first().waitFor()
  await page.getByText('Agora é com você').first().waitFor()
  const s = await st()
  if (s.region !== 'data_city' || !s.flags.intro_done || !s.quests.tutorial.done) throw new Error(`região ${s.region} / apresentação não concluída`)
  if (s.inventory.includes('vale_bilhete')) throw new Error('vale não foi usado')
})

await step('na cidade o controle é do jogador (anda com o teclado)', async () => {
  const a = await st()
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyW')
  const b = await st()
  if (!(b.y < a.y - 0.5)) throw new Error(`não andou: ${a.y} → ${b.y}`)
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

await step('história até o elevador: Brás, logs e quem foi (JOIN)', async () => {
  await useAt(8.5, 5.5, 'up', 'Brás Teles')
  await talkThrough()
  await useAt(2.5, 4.5, 'up', 'Terminal de logs')
  await runSql("SELECT * FROM access_logs WHERE action = 'UPDATE' AND (hour < 7 OR hour >= 20);")
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(400)
  await useAt(2.5, 4.5, 'up', 'Terminal de logs')
  await runSql("SELECT DISTINCT e.name, e.department, e.status FROM access_logs l JOIN employees e ON e.id = l.employee_id WHERE l.action = 'UPDATE' AND (l.hour < 7 OR l.hour >= 20);")
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(400)
  if (!(await st()).steps.includes('sql_main:who')) throw new Error('etapa "quem" não concluída')
})

await step('Almoxarifado (GROUP BY): lição, guiada com pista, independente, drone, transferência e relatório de campo', async () => {
  await useAt(10.5, 20.5, 'down', 'Elevador de carga')
  await page.waitForTimeout(500)
  if ((await st()).region !== 'data_warehouse') throw new Error('elevador não levou ao almoxarifado')
  await useAt(6.5, 11.5, 'up', 'Otávia')
  await talkThrough()
  // Guiada: a ficha abre sozinha; tentar com os sublinhados libera a 1ª pista.
  await useAt(11.5, 10.5, 'up', 'Painel de reposição')
  await page.getByText('Objetivo:').first().waitFor()
  await page.getByRole('button', { name: 'Executar o exemplo' }).click()
  await page.getByText('3 linha(s)').waitFor()
  if (!(await page.getByRole('button', { name: /Pedir pista 1/ }).isDisabled())) throw new Error('pista liberada antes de tentar')
  await page.getByRole('button', { name: /^Executar Ctrl/ }).click()
  await page.getByText(/Troque pela coluna/).waitFor()
  await page.getByRole('button', { name: /Pedir pista 1/ }).click()
  await page.getByText('Pista 1:').waitFor()
  await page.screenshot({ path: `${OUT}/mundo-almoxarifado-guiada.png` })
  await runSql('SELECT fornecedor_id, COUNT(*) AS entregas FROM entregas GROUP BY fornecedor_id;')
  await page.getByText(/prática guiada resolvida com 1 pista/).waitFor()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(400)
  // Independente: do zero; o portão abre.
  await useAt(11.5, 10.5, 'up', 'Painel de reposição')
  await runSql('SELECT fornecedor_id, COUNT(*) FROM entregas GROUP BY fornecedor_id;')
  await page.getByText(/some a coluna itens/).waitFor()
  await runSql('SELECT fornecedor_id, SUM(itens) AS total FROM entregas GROUP BY fornecedor_id;')
  await page.getByText(/prática independente resolvida/).waitFor()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(500)
  if (!(await st()).flags.supply_gate) throw new Error('portão não abriu')
  // Combate: a consulta revela o fornecedor que recalibra o drone.
  await useAt(12.5, 4.5, 'right', 'Drone')
  const combat = page.getByRole('dialog', { name: /Confronto/ })
  await combat.waitFor()
  await combat.getByRole('button', { name: /^Examinar/ }).click()
  await combat.getByRole('button', { name: /^Consultar entregas/ }).click()
  await runSql("SELECT fornecedor_id, COUNT(*) FROM entregas WHERE status = 'atrasada' GROUP BY fornecedor_id;")
  await page.getByText(/Atrasos por fornecedor/).waitFor()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await combat.getByRole('button', { name: /^Recalibrar/ }).click()
  await page.getByLabel('Recalibrar drone').fill('2')
  await page.getByRole('button', { name: 'Executar', exact: true }).click()
  await combat.getByText('Vitória.').waitFor()
  await page.screenshot({ path: `${OUT}/mundo-almoxarifado-drone.png` })
  await combat.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(600)
  if (!(await st()).flags.drone_down) throw new Error('drone não saiu da porta')
  // Transferência: outro problema, qualquer caminho (aqui, com CTE).
  await useAt(17.5, 3.5, 'up', 'Arquivo de notas')
  await runSql(
    'WITH n AS (SELECT fornecedor_id, SUM(itens) t FROM notas GROUP BY fornecedor_id), e AS (SELECT fornecedor_id, SUM(itens) t FROM entregas GROUP BY fornecedor_id) SELECT f.nome, n.t - e.t FROM fornecedores f JOIN n ON n.fornecedor_id = f.id JOIN e ON e.fornecedor_id = f.id WHERE n.t > e.t;',
  )
  await page.getByText(/transferência resolvida sem pistas/).waitFor()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.waitForTimeout(500)
  // Debrief: a conversa termina no relatório de campo.
  await useAt(6.5, 11.5, 'up', 'Otávia')
  const report = page.getByRole('dialog', { name: /Relatório de campo/ })
  for (let i = 0; i < 10 && !(await report.count()); i++) {
    await page.getByRole('dialog').getByRole('button', { name: /Continuar|Encerrar|Mostrar tudo/ }).click()
    await page.waitForTimeout(200)
  }
  await report.getByText('Aplicou com pouca ou nenhuma ajuda').waitFor()
  await report.getByText(/Painel de reposição — contagem/).first().waitFor()
  await report.getByText('Como isso conta no domínio do Control').click()
  await report.getByText(/Transferência \(peso 3\)/).waitFor()
  // Revisão no Control só com clique; sem tópico ligado, explica como ligar.
  await report.getByText('Revisão no Control (opcional)').waitFor()
  await report.getByText(/Nenhum tópico do Control corresponde a GROUP BY/).waitFor()
  await page.screenshot({ path: `${OUT}/mundo-almoxarifado-relatorio.png` })
  const s = await st()
  if (!s.quests.sql_supply?.done) throw new Error('missão não concluída')
  // Revisão de campo: exercício gerado na hora (só evidência, sem XP).
  await report.getByRole('button', { name: 'Fazer uma revisão de campo' }).click()
  await page.getByRole('dialog', { name: 'Revisão de campo — GROUP BY' }).waitFor()
  await page.getByText('gerado para este exercício').waitFor()
  await page.screenshot({ path: `${OUT}/mundo-almoxarifado-revisao.png` })
  await page.getByRole('button', { name: 'Fechar terminal' }).click()
  // Diário: oportunidade de revisão com o motivo; volta pelo elevador.
  await useAt(2.5, 11.5, 'left', 'Elevador de carga')
  await page.waitForTimeout(500)
  if ((await st()).region !== 'data_city') throw new Error('não voltou ao saguão')
})

await step('Control ↔ mundo: tópico "GROUP BY" do Control recebe a sugestão no Diário e a revisão agendada por clique', async () => {
  // Matéria e tópico criados pelo próprio backend local do app (mesmo módulo que a página usa).
  await page.evaluate(async () => {
    const { getLocalBackend } = await import('/src/app/data.tsx')
    const b = getLocalBackend()
    const [s] = await b.insert('subjects', [{ name: 'SQL', color: '#336699' }])
    await b.insert('topics', [{ subject_id: s.id, name: 'GROUP BY' }])
  })
  await page.reload()
  await page.getByText('Cidade dos Dados').first().waitFor()
  await page.waitForTimeout(500)
  await page.keyboard.press('j')
  await page.getByText(/Sugestão do Control · Praticar GROUP BY/).waitFor({ timeout: 15000 })
  await page.getByText(/O Control recomenda este tópico agora/).first().waitFor()
  await page.screenshot({ path: `${OUT}/mundo-oportunidades.png` })
  await page.keyboard.press('Escape')
  // Relatório de novo (Otávia, missão concluída) → agendar revisão do tópico.
  await useAt(10.5, 20.5, 'down', 'Elevador de carga')
  await page.waitForTimeout(500)
  await useAt(6.5, 11.5, 'up', 'Otávia')
  const report = page.getByRole('dialog', { name: /Relatório de campo/ })
  await report.getByRole('button', { name: /Revisar “GROUP BY” em 3 dias/ }).click()
  await report.getByText(/Revisão de GROUP BY agendada para/).waitFor()
  const reviews = await page.evaluate(async () => {
    const { getLocalBackend } = await import('/src/app/data.tsx')
    return (await getLocalBackend().list('reviews')).rows.map((r) => r.title)
  })
  if (!reviews.includes('Revisar GROUP BY (EvoQuest)')) throw new Error(`revisão não criada: ${JSON.stringify(reviews)}`)
  await report.getByRole('button', { name: 'Voltar ao mundo' }).click()
  await useAt(2.5, 11.5, 'left', 'Elevador de carga')
  await page.waitForTimeout(500)
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
  // Colisão: não atravessa a Guilda.
  await place(15.5, 5.5, 'up')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyW')
  if ((await st()).y < 4.2) throw new Error('atravessou a parede da Guilda')
  // Bilheteria: Cidade dos Dados já comprada; a segunda cidade custa moedas.
  await useAt(9.5, 25.5, 'up', 'Dora, bilheteira')
  await page.getByRole('dialog', { name: 'Bilheteria da Rodoviária' }).waitFor()
  await page.locator('li', { hasText: 'Cidade dos Dados' }).getByText('Passagem comprada').waitFor()
  await page.locator('li', { hasText: 'Babel' }).getByText(/Faltam \d+ moedas/).waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/mundo-bilheteria.png` })
  await page.keyboard.press('Escape')
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
  // Lote com a matéria SQL: obra pelo tempo (ainda terreno), funcionamento pelo domínio (já há prática no mundo).
  await page.getByLabel('Matéria').selectOption({ label: 'SQL' })
  await page.getByRole('button', { name: 'Construir' }).click()
  await page.getByText(/· domínio \d+%/).waitFor({ timeout: 15000 })
  if (await page.getByText('Às escuras').count()) throw new Error('domínio do mundo não chegou ao funcionamento do prédio')
  await page.screenshot({ path: `${OUT}/mundo-minha-cidade-lote.png` })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${OUT}/mundo-minha-cidade.png` })
})

await step('celular: apresentação guiada por toque, depois joystick e botão de ação, sem rolagem', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', storageState: await ctx.storageState() })
  const p = await m.newPage()
  p.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`))
  await p.goto(`${BASE}/evoquest`)
  // Novo contexto = novo IndexedDB: passa pela criação rápida.
  await p.getByRole('button', { name: 'Pular' }).click()
  await p.getByRole('button', { name: 'Entrar na Vila' }).isDisabled()
  await p.getByLabel('Nome do personagem').fill('Teste')
  await p.getByRole('button', { name: 'Entrar na Vila' }).click()
  await runGuide(p, 'Vernácula')
  await p.getByRole('button', { name: /Ação|Nada por perto/ }).waitFor({ timeout: 20000 })
  const s = await p.evaluate(() => window.__eq.state())
  if (s.region !== 'archive') throw new Error(`celular chegou em ${s.region}`)
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  if (over) throw new Error('rolagem horizontal')
  await p.screenshot({ path: `${OUT}/mundo-celular.png` })

  // Cidade gerada (Vernácula): Prefeitura → guardião abre o painel da unidade em etapas.
  const act = async (x, y, facing) => {
    await p.evaluate(([x, y, f]) => window.__eq.place(x, y, f), [x, y, facing])
    await p.waitForTimeout(250)
    await p.getByRole('button', { name: /^(Falar|Interagir|Visitar|Usar)/ }).last().click()
  }
  await act(14.5, 11.5, 'up') // Prefeitura (praça)
  await p.getByRole('dialog').waitFor()
  for (let i = 0; i < 10 && (await p.getByRole('dialog').count()); i++) {
    await p.getByRole('dialog').getByRole('button', { name: /Continuar|Encerrar|Mostrar tudo/ }).click()
    await p.waitForTimeout(150)
  }
  await p.waitForFunction(() => window.__eq.state().steps.includes('city_archive:mentor'), null, { timeout: 15000 })
  await act(6.5, 5.5, 'up') // guardião do 1º prédio
  const hub = p.getByRole('dialog', { name: /^Prédio:/ })
  await hub.waitFor()
  for (const label of ['1. Lição', '2. Prática guiada', '3. Prática independente', '4. Desafio integrado']) await hub.getByText(label, { exact: false }).first().waitFor()
  await hub.getByText(/Próximo passo:/).waitFor()
  await hub.getByText('(recomendado)').waitFor()
  if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('rolagem horizontal no painel da unidade')
  await p.waitForTimeout(500) // fim da animação de entrada
  await p.screenshot({ path: `${OUT}/mundo-cidade-gerada-unidade.png` })
  // A etapa guiada abre a trilha só com desafios de reconhecer.
  await hub.getByRole('button', { name: /2\. Prática guiada/ }).click()
  await p.waitForURL(/\/evoquest\/jogar\?sessao=/, { timeout: 20000 })
  await p.screenshot({ path: `${OUT}/mundo-cidade-gerada-guiada.png` })
  await m.close()
})

await browser.close()
for (const r of results) console.log(r.join(' | '))
console.log(errors.length ? `\nErros de console:\n${errors.join('\n')}` : '\nSem erros de console.')
process.exit(results.some((r) => r[0] !== 'OK') || errors.length ? 1 : 0)
