// Valida os arquivos .jsonl do banco de questões.
// Uso:  node validar-questoes.mjs <pasta-ou-arquivo> [--exemplos] [--saida consolidado.json]
//   --exemplos  aceita ids "exemplo-..." (para validar o exemplos.jsonl)
//   --saida     grava todas as questões válidas num único JSON (usado depois para importar no app)
// Sai com código 1 se houver ERRO (avisos não bloqueiam).
import fs from 'node:fs'
import path from 'node:path'

const TEMAS = {
  SQL: { prefixo: 'sql', alvo: 2500 },
  Python: { prefixo: 'py', alvo: 2500 },
  'Pandas e NumPy': { prefixo: 'pd', alvo: 1500 },
  Estatística: { prefixo: 'est', alvo: 2000 },
  'Machine Learning': { prefixo: 'ml', alvo: 2500 },
  'Git e GitHub': { prefixo: 'git', alvo: 700 },
  'Modelagem de Dados e Bancos de Dados': { prefixo: 'bd', alvo: 1500 },
  'BI e Visualização': { prefixo: 'bi', alvo: 1200 },
  'Engenharia de Dados': { prefixo: 'ed', alvo: 1200 },
  'Algoritmos e Estruturas de Dados': { prefixo: 'alg', alvo: 900 },
  'Lógica de Programação': { prefixo: 'log', alvo: 500 },
  'Redes de Computadores': { prefixo: 'rede', alvo: 700 },
  'Sistemas Operacionais e Linux': { prefixo: 'so', alvo: 600 },
  'Segurança da Informação': { prefixo: 'seg', alvo: 600 },
  'Engenharia de Software': { prefixo: 'es', alvo: 600 },
  'Cloud e DevOps': { prefixo: 'cloud', alvo: 500 },
}
const NIVEIS = ['basico', 'intermediario', 'avancado', 'extremo']
const TIPOS = ['multipla_escolha', 'certo_errado']
const ESTILOS = ['concurso', 'entrevista']

const args = process.argv.slice(2)
const alvoPath = args.find((a) => !a.startsWith('--'))
const aceitaExemplos = args.includes('--exemplos')
const saidaIdx = args.indexOf('--saida')
const saida = saidaIdx >= 0 ? args[saidaIdx + 1] : null
if (!alvoPath) {
  console.error('Uso: node validar-questoes.mjs <pasta-ou-arquivo> [--exemplos] [--saida consolidado.json]')
  process.exit(2)
}

function listar(p) {
  const st = fs.statSync(p)
  if (st.isFile()) return [p]
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? listar(path.join(p, d.name)) : d.name.endsWith('.jsonl') ? [path.join(p, d.name)] : []))
}
const arquivos = listar(alvoPath).sort()
if (!arquivos.length) {
  console.error('Nenhum arquivo .jsonl encontrado.')
  process.exit(2)
}

const erros = []
const avisos = []
const err = (arq, linha, msg) => erros.push(`${path.basename(arq)}:${linha}  ${msg}`)
const warn = (arq, linha, msg) => avisos.push(`${path.basename(arq)}:${linha}  ${msg}`)
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const contaFences = (s) => (s.match(/```/g) ?? []).length

const validas = []
const ids = new Map()
for (const arq of arquivos) {
  const linhas = fs.readFileSync(arq, 'utf8').split(/\r?\n/)
  let contagem = 0
  linhas.forEach((texto, i) => {
    const n = i + 1
    if (!texto.trim()) return
    contagem++
    let q
    try {
      q = JSON.parse(texto)
    } catch (e) {
      return err(arq, n, `JSON inválido (${e.message.slice(0, 60)})`)
    }
    const erroAntes = erros.length
    if (!q || typeof q !== 'object' || Array.isArray(q)) return err(arq, n, 'a linha não é um objeto JSON')
    const permitidos = new Set(['id', 'tema', 'subtema', 'nivel', 'tipo', 'estilo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'tags'])
    for (const k of Object.keys(q)) if (!permitidos.has(k)) err(arq, n, `campo desconhecido "${k}"`)

    // id
    const ex = typeof q.id === 'string' && q.id.startsWith('exemplo-')
    if (typeof q.id !== 'string' || !q.id) err(arq, n, 'id ausente')
    else if (ex && !aceitaExemplos) err(arq, n, `id de exemplo "${q.id}" não pode entrar no banco`)
    else if (!ex) {
      if (!/^[a-z]+-\d{4}$/.test(q.id)) err(arq, n, `id "${q.id}" fora do padrão prefixo-NNNN`)
      else if (TEMAS[q.tema] && q.id.split('-')[0] !== TEMAS[q.tema].prefixo) err(arq, n, `id "${q.id}" não combina com o tema "${q.tema}" (prefixo ${TEMAS[q.tema].prefixo})`)
    }
    if (typeof q.id === 'string') {
      if (ids.has(q.id)) err(arq, n, `id repetido "${q.id}" (já em ${ids.get(q.id)})`)
      else ids.set(q.id, `${path.basename(arq)}:${n}`)
    }

    // classificação
    if (!TEMAS[q.tema]) err(arq, n, `tema inválido "${q.tema}"`)
    if (typeof q.subtema !== 'string' || q.subtema.trim().length < 3 || q.subtema.length > 60) err(arq, n, 'subtema ausente ou fora de 3-60 caracteres')
    if (!NIVEIS.includes(q.nivel)) err(arq, n, `nivel inválido "${q.nivel}"`)
    if (!TIPOS.includes(q.tipo)) err(arq, n, `tipo inválido "${q.tipo}"`)
    if (!ESTILOS.includes(q.estilo)) err(arq, n, `estilo inválido "${q.estilo}"`)

    // texto
    if (typeof q.enunciado !== 'string' || q.enunciado.trim().length < 20 || q.enunciado.length > 1500) err(arq, n, 'enunciado ausente ou fora de 20-1500 caracteres')
    else if (contaFences(q.enunciado) % 2 !== 0) err(arq, n, 'bloco de código (```) aberto e não fechado no enunciado')
    if (typeof q.explicacao !== 'string' || q.explicacao.trim().length < 40 || q.explicacao.length > 1500) err(arq, n, 'explicacao ausente ou fora de 40-1500 caracteres')
    else if (contaFences(q.explicacao) % 2 !== 0) err(arq, n, 'bloco de código (```) aberto e não fechado na explicação')
    if (!Array.isArray(q.tags) || q.tags.length < 1 || q.tags.length > 5 || q.tags.some((t) => typeof t !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(t))) err(arq, n, 'tags devem ser de 1 a 5 palavras minúsculas com hífen')

    // alternativas e gabarito
    if (q.tipo === 'multipla_escolha') {
      const alt = q.alternativas
      if (!Array.isArray(alt) || alt.length < 4 || alt.length > 5) err(arq, n, 'multipla_escolha precisa de 4 ou 5 alternativas')
      else {
        if (alt.some((a) => typeof a !== 'string' || !a.trim() || a.length > 500)) err(arq, n, 'alternativa vazia ou longa demais (máx. 500)')
        if (alt.some((a) => typeof a === 'string' && /^\s*(\(?[A-Ea-e][\).:-])\s/.test(a))) err(arq, n, 'alternativa começa com letra ("A)"): remova as letras')
        // comparação exata (só espaços normalizados): "-5" e "5" são alternativas diferentes
        const set = new Set(alt.map((a) => String(a).trim().replace(/\s+/g, ' ')))
        if (set.size !== alt.length) err(arq, n, 'alternativas repetidas')
        const letras = 'ABCDE'.slice(0, alt.length)
        if (!letras.includes(q.gabarito) || typeof q.gabarito !== 'string' || q.gabarito.length !== 1) err(arq, n, `gabarito "${q.gabarito}" fora de ${letras}`)
        if (alt.some((a) => /todas as (anteriores|alternativas)|nenhuma das (anteriores|alternativas)/i.test(String(a)))) q._temTodas = true
      }
    } else if (q.tipo === 'certo_errado') {
      if (q.alternativas !== undefined) err(arq, n, 'certo_errado não pode ter alternativas')
      if (q.gabarito !== 'C' && q.gabarito !== 'E') err(arq, n, `gabarito "${q.gabarito}" deve ser C ou E`)
    }
    if (erros.length === erroAntes) validas.push({ ...q, _arq: path.basename(arq), _linha: n })
  })
  if (contagem > 250) warn(arq, 0, `arquivo com ${contagem} questões (o combinado é no máximo 250)`)
}

// duplicatas
const porEnunciado = new Map()
for (const q of validas) {
  const k = norm(q.enunciado)
  if (porEnunciado.has(k)) err(q._arq, q._linha, `enunciado idêntico ao de ${porEnunciado.get(k)}`)
  else porEnunciado.set(k, `${q.id}`)
}
// quase-duplicatas: encaixes de 5 palavras compartilhados
{
  const idx = new Map()
  const conj = validas.map((q) => {
    const w = norm(q.enunciado).split(' ')
    const s = new Set()
    for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' '))
    return s
  })
  conj.forEach((s, i) => s.forEach((sh) => (idx.has(sh) ? idx.get(sh).push(i) : idx.set(sh, [i]))))
  const reportados = new Set()
  conj.forEach((s, i) => {
    if (s.size < 6) return
    const cont = new Map()
    s.forEach((sh) => {
      const l = idx.get(sh)
      if (l.length > 40) return
      for (const j of l) if (j > i) cont.set(j, (cont.get(j) ?? 0) + 1)
    })
    for (const [j, c] of cont) {
      const menor = Math.min(s.size, conj[j].size)
      if (c / menor >= 0.8 && validas[i].tema === validas[j].tema && !reportados.has(`${i}-${j}`)) {
        reportados.add(`${i}-${j}`)
        warn(validas[j]._arq, validas[j]._linha, `enunciado muito parecido com ${validas[i].id} (${Math.round((c / menor) * 100)}% de trechos iguais)`)
      }
    }
  })
}

// relatório
const total = validas.length
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : '–')
console.log(`Arquivos: ${arquivos.length} | questões válidas: ${total} | erros: ${erros.length} | avisos: ${avisos.length}\n`)
if (!aceitaExemplos) {
  console.log('Por tema (feito / alvo):')
  for (const [nome, { alvo }] of Object.entries(TEMAS)) {
    const qs = validas.filter((q) => q.tema === nome)
    const nv = NIVEIS.map((n) => pct(qs.filter((q) => q.nivel === n).length, qs.length)).join('/')
    const me = pct(qs.filter((q) => q.tipo === 'multipla_escolha').length, qs.length)
    const co = pct(qs.filter((q) => q.estilo === 'concurso').length, qs.length)
    console.log(`  ${nome.padEnd(40)} ${String(qs.length).padStart(5)} / ${String(alvo).padEnd(5)}  nível b/i/a/e ${nv}  ME ${me}  concurso ${co}`)
  }
  console.log(`  ${'TOTAL'.padEnd(40)} ${String(total).padStart(5)} / 20000\n`)
}
const me = validas.filter((q) => q.tipo === 'multipla_escolha')
const ce = validas.filter((q) => q.tipo === 'certo_errado')
if (me.length) console.log('Gabarito (múltipla escolha):', 'ABCDE'.split('').map((l) => `${l} ${pct(me.filter((q) => q.gabarito === l).length, me.length)}`).join('  '))
if (ce.length) console.log('Gabarito (certo/errado):', `C ${pct(ce.filter((q) => q.gabarito === 'C').length, ce.length)}  E ${pct(ce.filter((q) => q.gabarito === 'E').length, ce.length)}`)
const maisLonga = me.filter((q) => {
  const comp = q.alternativas.map((a) => a.length)
  return comp.indexOf(Math.max(...comp)) === 'ABCDE'.indexOf(q.gabarito)
}).length
if (me.length >= 20 && maisLonga / me.length > 0.35) warn('(geral)', 0, `a alternativa correta é a mais longa em ${pct(maisLonga, me.length)} das questões (ideal: perto de 20-25%)`)
const todas = validas.filter((q) => q._temTodas).length
if (total >= 50 && todas / total > 0.02) warn('(geral)', 0, `"todas/nenhuma das anteriores" em ${pct(todas, total)} das questões (máximo combinado: 2%)`)
const comCodigo = validas.filter((q) => q.enunciado.includes('```')).length
console.log(`Questões com código no enunciado: ${comCodigo} (${pct(comCodigo, total)})`)

if (avisos.length) {
  console.log(`\nAVISOS (${avisos.length}):`)
  avisos.slice(0, 40).forEach((a) => console.log('  ' + a))
  if (avisos.length > 40) console.log(`  … e mais ${avisos.length - 40}`)
}
if (erros.length) {
  console.log(`\nERROS (${erros.length}):`)
  erros.slice(0, args.includes("--todos") ? Infinity : 60).forEach((e) => console.log('  ' + e))
  if (erros.length > 60 && !args.includes("--todos")) console.log(`  … e mais ${erros.length - 60}`)
}
if (saida && !erros.length) {
  fs.writeFileSync(saida, JSON.stringify(validas.map(({ _arq, _linha, _temTodas, ...q }) => q)))
  console.log(`\nGravado: ${saida} (${total} questões)`)
}
console.log(erros.length ? '\nRESULTADO: REPROVADO (corrija os erros acima)' : '\nRESULTADO: APROVADO')
process.exit(erros.length ? 1 : 0)
