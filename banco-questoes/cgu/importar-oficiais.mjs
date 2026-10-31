// Importa itens oficiais do Cebraspe (certo/errado) para o banco CGU 2026, classificando-os por disciplina
// e item do edital. Uso:
//   node banco-questoes/cgu/importar-oficiais.mjs <pasta-do-acervo> [--saida banco-questoes/cgu/oficiais] [--max 4999]
// A pasta do acervo é o clone público de github.com/aureovinicius/concursos-cgu (arquivos data/official-content/part-*.json),
// que reúne itens transcritos de cadernos públicos do Cebraspe com gabarito definitivo.
// Só entram itens: certo/errado, não anulados, autocontidos (sem depender de texto, figura ou código fora do item),
// dentro do programa do edital. A classificação é por palavras-chave (regras em cgu/regras-classificacao.json):
// use o relatório gerado para revisar.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opt = (nome, padrao) => (argv.indexOf(nome) >= 0 ? argv[argv.indexOf(nome) + 1] : padrao)
const acervo = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--saida' && argv[i - 1] !== '--max')
const saida = opt('--saida', path.join(aqui, 'oficiais'))
const MAX = Number(opt('--max', 4999))
if (!acervo) {
  console.error('Uso: node importar-oficiais.mjs <pasta-do-acervo> [--saida pasta] [--max 4999]')
  process.exit(2)
}
const programa = JSON.parse(fs.readFileSync(path.join(aqui, 'programa-cgu-2026.json'), 'utf8'))
const TEMAS = Object.fromEntries(programa.temas.map((t) => [t.prefixo, t]))
const regras = JSON.parse(fs.readFileSync(path.join(aqui, 'regras-classificacao.json'), 'utf8'))

const norm = (s) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const rx = (lista) => lista.map((p) => new RegExp(`(?<![a-z0-9])(?:${p})(?![a-z0-9])`, 'i'))

const DEPENDENTE = rx(regras.dependente)
const FORA = rx(regras.fora_do_programa)
const REGRAS = regras.subtemas.map((r) => ({ prefixo: r.prefixo, n: r.n, peso: r.peso, padroes: rx(r.padroes) }))
for (const r of REGRAS) {
  if (!TEMAS[r.prefixo] || !TEMAS[r.prefixo].subtemas[r.n - 1]) throw new Error(`regra para ${r.prefixo} item ${r.n} não existe no programa`)
}

function classificar(texto) {
  const t = norm(texto)
  const pontos = new Map()
  for (const { prefixo, n, peso, padroes } of REGRAS) {
    let acertos = 0
    for (const r of padroes) if (r.test(t)) acertos++
    if (!acertos) continue
    pontos.set(`${prefixo}|${n}`, peso * acertos + (acertos > 1 ? peso : 0))
  }
  if (!pontos.size) return null
  const porTema = new Map()
  for (const [k, v] of pontos) {
    const p = k.split('|')[0]
    porTema.set(p, (porTema.get(p) ?? 0) + v)
  }
  const ordem = [...porTema.entries()].sort((a, b) => b[1] - a[1] || (TEMAS[b[0]].bloco === 'P3') - (TEMAS[a[0]].bloco === 'P3'))
  const [tema, score] = ordem[0]
  const segundo = ordem[1]?.[1] ?? 0
  const minimo = TEMAS[tema].bloco === 'P3' ? 3 : 4
  if (score < minimo) return null
  // empate técnico entre temas diferentes: ambíguo demais, descarta
  if (segundo && segundo === score) return null
  const sub = [...pontos.entries()]
    .filter(([k]) => k.startsWith(tema + '|'))
    .sort((a, b) => b[1] - a[1])[0][0]
    .split('|')[1]
  return { prefixo: tema, n: Number(sub), score }
}

// ---- leitura do acervo
const dirPartes = path.join(acervo, 'data', 'official-content')
const partes = fs.existsSync(dirPartes) ? fs.readdirSync(dirPartes).filter((f) => /^part-\d+\.json$/.test(f)).sort() : []
if (!partes.length) {
  console.error('Não achei data/official-content/part-*.json em ' + acervo)
  process.exit(2)
}
const brutos = []
for (const p of partes) brutos.push(...JSON.parse(fs.readFileSync(path.join(dirPartes, p), 'utf8')).questions)
console.log(`Itens no acervo: ${brutos.length}`)

const motivos = {}
const conta = (m) => (motivos[m] = (motivos[m] ?? 0) + 1)
const vistos = new Set()
const aceitos = []
for (const q of brutos) {
  if (q.format !== 'certo-errado') { conta('formato_multipla_escolha'); continue }
  if (q.annulled) { conta('anulada'); continue }
  if (q.correctAlternative !== 'C' && q.correctAlternative !== 'E') { conta('gabarito_invalido'); continue }
  const texto = (q.context ?? '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim()
  if (texto.length < 60 || texto.length > 1400) { conta('tamanho'); continue }
  if (/```/.test(texto)) { conta('crases'); continue }
  const t = norm(texto)
  if (DEPENDENTE.some((r) => r.test(t))) { conta('depende_de_contexto'); continue }
  if (FORA.some((r) => r.test(t))) { conta('fora_do_programa'); continue }
  const k = t.replace(/[^a-z0-9]+/g, ' ').trim()
  if (vistos.has(k)) { conta('duplicada_no_acervo'); continue }
  const cl = classificar(texto)
  if (!cl) { conta('sem_classificacao'); continue }
  vistos.add(k)
  aceitos.push({ q, texto, cl })
}
console.log('Descartados por motivo:', motivos)
console.log(`Aceitos: ${aceitos.length}`)

// ---- montagem por tema (mais recentes primeiro; corta no máximo)
fs.mkdirSync(saida, { recursive: true })
for (const f of fs.readdirSync(saida)) if (f.endsWith('.jsonl') || f === 'relatorio-importacao.json') fs.unlinkSync(path.join(saida, f))
const relatorio = {
  gerado_em: new Date().toISOString(),
  acervo: 'github.com/aureovinicius/concursos-cgu (data/official-content)',
  itens_no_acervo: brutos.length,
  descartados: motivos,
  aceitos: aceitos.length,
  por_tema: {},
}
let total = 0
for (const t of programa.temas) {
  const lista = aceitos.filter((a) => a.cl.prefixo === t.prefixo).sort((a, b) => b.q.year - a.q.year || b.cl.score - a.cl.score)
  const cortada = lista.slice(0, MAX)
  const porSub = {}
  const linhas = cortada.map((a, i) => {
    const sub = t.subtemas[a.cl.n - 1].subtema
    porSub[sub] = (porSub[sub] ?? 0) + 1
    const q = a.q
    const gab = q.correctAlternative
    const explic = `Gabarito oficial definitivo: ${gab === 'C' ? 'CERTO' : 'ERRADO'}. Item ${q.index} da prova "${q.paperTitle}" do concurso ${q.examName} (${q.board}), aplicada em ${q.year}. A resposta vem do gabarito definitivo publicado pela banca; o comentário explicativo ainda não foi escrito. Caderno: ${q.sourceUrl} (página ${q.sourcePage}). Gabarito: ${q.answerKeyUrl}`
    const tags = ['oficial', 'cebraspe', slug(q.examName) || 'concurso', `ano-${q.year}`].filter((x, j, arr) => x && arr.indexOf(x) === j)
    return JSON.stringify({ id: `${t.prefixo}-${String(i + 1).padStart(4, '0')}`, tema: t.tema, subtema: sub, nivel: 'intermediario', tipo: 'certo_errado', estilo: 'concurso', enunciado: a.texto, gabarito: gab, explicacao: explic, tags })
  })
  for (let i = 0; i < linhas.length; i += 250) {
    const n = String(Math.floor(i / 250) + 1).padStart(3, '0')
    fs.writeFileSync(path.join(saida, `${t.prefixo}-oficial-${n}.jsonl`), linhas.slice(i, i + 250).join('\n') + '\n')
  }
  total += linhas.length
  relatorio.por_tema[t.tema] = { total: linhas.length, candidatos: lista.length, por_subtema: porSub, gabarito_C: cortada.filter((a) => a.q.correctAlternative === 'C').length }
  console.log(`${t.tema.padEnd(70)} ${String(linhas.length).padStart(5)} (candidatos ${lista.length})`)
}
relatorio.total = total
fs.writeFileSync(path.join(saida, 'relatorio-importacao.json'), JSON.stringify(relatorio, null, 1))
console.log(`Total importado: ${total} → ${saida}`)
