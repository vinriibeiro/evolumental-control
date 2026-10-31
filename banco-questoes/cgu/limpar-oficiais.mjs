// Limpeza dos itens oficiais já importados (o acervo de origem não está no repositório, então não dá para reimportar).
// 1) Remove itens que dependem de figura, gráfico, tabela, texto ou código que não vieram junto com o enunciado.
// 2) Junta as quebras de linha do PDF (linhas cortadas no meio da frase), mantendo os parágrafos.
// Uso: node banco-questoes/cgu/limpar-oficiais.mjs [--aplicar]   (sem --aplicar só mostra o que mudaria)
// Os ids removidos ficam em banco-questoes/cgu/oficiais-removidas.json, com o motivo.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'banco-questoes/cgu/oficiais'
const aplicar = process.argv.includes('--aplicar')
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Referências a material de apoio que o item não traz.
const DEPENDE = [
  // Só quando aponta para uma figura específica ("no gráfico", "o histograma apresenta", "indicado por III");
  // itens conceituais ("gráfico de pizza é…", "a função histogram() gera…") ficam.
  [/\b(no|nesse|desse|neste|deste|naquele) (grafico|histograma|figura|diagrama|fluxograma|boxplot)\b(?! (de|do|da|boxplot)\b)/, 'figura/gráfico'],
  [/\bregiao do grafico\b/, 'figura/gráfico'],
  [/\b(grafico|histograma|figura|diagrama|fluxograma|boxplot|imagem|ilustracao) (acima|anterior|apresentad\w*|mostrad\w*|precedente|em questao)\b/, 'figura/gráfico'],
  [/^(o|a) (histograma|grafico|diagrama|boxplot|figura) (apresenta|mostra|indica|revela|evidencia)\b/, 'figura/gráfico'],
  [/\bindicad[oa]s? (por|pelo numero|pela letra) [ivx]+\b/, 'figura/gráfico'],
  [/\b(conforme|como) (ilustrado|mostrado|apresentado) (acima|anteriormente|a seguir)\b/, 'figura/gráfico'],
  [/\b(tabela|quadro|planilha) (acima|anterior|a seguir|apresentad\w*|mostrad\w*|precedente)\b/, 'tabela não incluída'],
  [/\b(texto|fragmento|trecho|excerto) (acima|anterior|apresentad\w*|precedente|cg\w*|motivador)\b/, 'texto de apoio'],
  [/\b(infere-se|depreende-se|de acordo com|conforme|segundo|da leitura d)o? (o |do |ao )?texto\b/, 'texto de apoio'],
  [/^(no|do) texto\b/, 'texto de apoio'],
  [/\(\s*l\s*\.\s*\d+/, 'texto de apoio'],
  [/\b(codigo|algoritmo|programa|script|pseudocodigo|consulta|comando|modelo|dados|caso) (acima|anterior|apresentad\w*|precedente|mostrad\w*)\b/, 'código/dados não incluídos'],
  [/\b(linha|linhas) \d+ (do|da|de) (codigo|algoritmo|programa|script)\b/, 'código/dados não incluídos'],
]
// Tabela ou código incluídos no próprio enunciado contam como autocontidos.
const temConteudo = (s) => /```/.test(s) || (s.match(/\|/g) ?? []).length >= 6

// Quebra simples dentro de um parágrafo é corte do PDF: vira espaço. Linha em branco (parágrafo) é mantida.
function juntarLinhas(s) {
  return s
    .split(/\n{2,}/)
    .map((par) => par.replace(/\s*\n\s*/g, ' '))
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .trim()
}

const removidas = []
let juntadas = 0
let mantidas = 0
for (const arq of fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).sort()) {
  const p = path.join(DIR, arq)
  const saida = []
  for (const linha of fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const q = JSON.parse(linha)
    const t = norm(q.enunciado)
    const motivo = temConteudo(q.enunciado) ? null : DEPENDE.find(([r]) => r.test(t))?.[1]
    if (motivo) {
      removidas.push({ id: q.id, motivo, inicio: q.enunciado.slice(0, 120).replace(/\s+/g, ' ') })
      continue
    }
    const novo = juntarLinhas(q.enunciado)
    if (novo !== q.enunciado) juntadas++
    saida.push(JSON.stringify({ ...q, enunciado: novo }))
    mantidas++
  }
  if (aplicar) fs.writeFileSync(p, saida.join('\n') + '\n')
}

const porMotivo = removidas.reduce((m, r) => ((m[r.motivo] = (m[r.motivo] ?? 0) + 1), m), {})
console.log(`mantidas: ${mantidas} | removidas: ${removidas.length} | enunciados com linhas juntadas: ${juntadas}`)
console.log('por motivo:', porMotivo)
if (aplicar) fs.writeFileSync('banco-questoes/cgu/oficiais-removidas.json', JSON.stringify(removidas, null, 1))
else console.log(removidas.map((r) => `${r.id} [${r.motivo}] ${r.inicio}`).join('\n'))
