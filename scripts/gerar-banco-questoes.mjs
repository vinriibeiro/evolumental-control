// Gera os arquivos do banco de questões que o app carrega sob demanda.
// Uso: node scripts/gerar-banco-questoes.mjs <consolidado.json> [pasta-de-saida=public/questoes]
// O consolidado vem de: node validar-questoes.mjs <pasta-com-os-jsonl> --saida consolidado.json
// Saída: <saida>/index.json (temas, subtemas, contagens) e <saida>/<prefixo>/<subtema>.json (questões).
import fs from 'node:fs'
import path from 'node:path'

const [entrada, saida = 'public/questoes'] = process.argv.slice(2)
if (!entrada) {
  console.error('Uso: node scripts/gerar-banco-questoes.mjs <consolidado.json> [pasta-de-saida]')
  process.exit(2)
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const questoes = JSON.parse(fs.readFileSync(entrada, 'utf8'))
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
  for (const [nome, lista] of t.subtemas) {
    const arquivo = `${slug(nome)}.json`
    lista.sort((a, b) => a.id.localeCompare(b.id))
    fs.writeFileSync(path.join(dir, arquivo), JSON.stringify(lista))
    subtemas.push({ nome, arquivo, total: lista.length })
  }
  index.temas.push({ tema: t.tema, prefixo: t.prefixo, total: subtemas.reduce((s, x) => s + x.total, 0), subtemas })
}
fs.writeFileSync(path.join(saida, 'index.json'), JSON.stringify(index))
console.log(`${questoes.length} questões em ${index.temas.length} tema(s) → ${saida}`)
