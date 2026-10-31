// Gera os arquivos do banco de questões que o app carrega sob demanda.
// Uso: node scripts/gerar-banco-questoes.mjs <consolidado.json> [outro.json ...] [--saida public/questoes]
// Cada consolidado vem de: node banco-questoes/validar-questoes.mjs <pasta-com-os-jsonl> --saida consolidado.json
// Vários arquivos podem ser passados (por exemplo, os JSON já publicados em public/questoes/sql/*.json para
// manter um tema cuja fonte não está no repositório). Ids repetidos entre arquivos são erro.
// Saída: <saida>/index.json (temas, subtemas, contagens) e <saida>/<prefixo>/<subtema>.json (questões).
// Ordem: temas na ordem de entrada; subtemas na ordem de entrada, exceto quando todos começam com número
// (itens de edital, "1 …", "2 …"), caso em que seguem a ordem numérica.
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const saidaIdx = argv.indexOf('--saida')
const saida = saidaIdx >= 0 ? argv[saidaIdx + 1] : 'public/questoes'
const entradas = argv.filter((a, i) => !a.startsWith('--') && i !== saidaIdx + 1)
if (!entradas.length) {
  console.error('Uso: node scripts/gerar-banco-questoes.mjs <consolidado.json> [outro.json ...] [--saida public/questoes]')
  process.exit(2)
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const questoes = entradas.flatMap((e) => JSON.parse(fs.readFileSync(e, 'utf8')))
const vistos = new Set()
for (const q of questoes) {
  if (vistos.has(q.id)) {
    console.error(`id repetido entre as entradas: ${q.id}`)
    process.exit(1)
  }
  vistos.add(q.id)
}
const temas = new Map()
for (const q of questoes) {
  const prefixo = q.id.replace(/-\d+$/, '')
  if (!temas.has(q.tema)) temas.set(q.tema, { tema: q.tema, prefixo, subtemas: new Map() })
  const t = temas.get(q.tema)
  if (!t.subtemas.has(q.subtema)) t.subtemas.set(q.subtema, [])
  t.subtemas.get(q.subtema).push(q)
}

fs.rmSync(saida, { recursive: true, force: true })
const index = { gerado_em: new Date().toISOString(), total: questoes.length, temas: [] }
for (const t of temas.values()) {
  const dir = path.join(saida, t.prefixo)
  fs.mkdirSync(dir, { recursive: true })
  const subtemas = []
  const nomes = [...t.subtemas.keys()]
  const numerados = nomes.every((n) => /^\d+\s/.test(n))
  const ordem = numerados ? nomes.sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) : nomes
  for (const nome of ordem) {
    const lista = t.subtemas.get(nome)
    const arquivo = `${slug(nome)}.json`
    lista.sort((a, b) => a.id.localeCompare(b.id))
    fs.writeFileSync(path.join(dir, arquivo), JSON.stringify(lista))
    subtemas.push({ nome, arquivo, total: lista.length })
  }
  index.temas.push({ tema: t.tema, prefixo: t.prefixo, total: subtemas.reduce((s, x) => s + x.total, 0), subtemas })
}
fs.writeFileSync(path.join(saida, 'index.json'), JSON.stringify(index))
console.log(`${questoes.length} questões em ${index.temas.length} tema(s) → ${saida}`)
