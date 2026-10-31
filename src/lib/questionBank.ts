// Banco de questões: tipos, filtros, correção, progresso e leitura do texto com blocos de código.
// As questões ficam em arquivos por tema/subtema (public/questoes) carregados sob demanda.

export type Level = 'basico' | 'intermediario' | 'avancado' | 'extremo'
export type QuestionType = 'multipla_escolha' | 'certo_errado'
export type QuestionStyle = 'concurso' | 'entrevista'

export interface BankQuestion {
  id: string
  tema: string
  subtema: string
  nivel: Level
  tipo: QuestionType
  estilo: QuestionStyle
  enunciado: string
  alternativas?: string[]
  gabarito: string
  explicacao: string
  tags?: string[]
}

export interface BankIndexTheme {
  tema: string
  prefixo: string
  total: number
  subtemas: Array<{ nome: string; arquivo: string; total: number }>
}
export interface BankIndex {
  total: number
  temas: BankIndexTheme[]
}

export const LEVELS: Level[] = ['basico', 'intermediario', 'avancado', 'extremo']
export const LEVEL_LABELS: Record<Level, string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado', extremo: 'Extremo' }
export const TYPE_LABELS: Record<QuestionType, string> = { multipla_escolha: 'Múltipla escolha', certo_errado: 'Certo ou errado' }
export const STYLE_LABELS: Record<QuestionStyle, string> = { concurso: 'Concurso', entrevista: 'Entrevista' }

export type StatusFilter = 'todas' | 'nao_respondidas' | 'erradas' | 'favoritas'
export const STATUS_LABELS: Record<StatusFilter, string> = { todas: 'Todas', nao_respondidas: 'Não respondidas', erradas: 'Que errei', favoritas: 'Favoritas' }

export interface BankFilters {
  niveis: Level[]
  tipos: QuestionType[]
  estilos: QuestionStyle[]
  status: StatusFilter
  busca: string
}
export const EMPTY_FILTERS: BankFilters = { niveis: [], tipos: [], estilos: [], status: 'todas', busca: '' }

/** Progresso por questão: [tentativas, acertos, última tentativa correta (0/1), favorita (0/1)]. */
export type Progress = Record<string, [number, number, 0 | 1, 0 | 1]>

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function filterQuestions(questions: readonly BankQuestion[], f: BankFilters, progress: Progress): BankQuestion[] {
  const term = norm(f.busca.trim())
  return questions.filter((q) => {
    if (f.niveis.length && !f.niveis.includes(q.nivel)) return false
    if (f.tipos.length && !f.tipos.includes(q.tipo)) return false
    if (f.estilos.length && !f.estilos.includes(q.estilo)) return false
    const p = progress[q.id]
    if (f.status === 'nao_respondidas' && p && p[0] > 0) return false
    if (f.status === 'erradas' && !(p && p[0] > 0 && p[2] === 0)) return false
    if (f.status === 'favoritas' && !(p && p[3] === 1)) return false
    if (term && !norm(`${q.enunciado} ${q.subtema} ${(q.tags ?? []).join(' ')} ${q.id}`).includes(term)) return false
    return true
  })
}

export interface AnswerOption {
  key: string
  label: string
}

/** Alternativas para mostrar: A–E nas de múltipla escolha, Certo/Errado nas de julgamento. */
export function answerOptions(q: BankQuestion): AnswerOption[] {
  if (q.tipo === 'certo_errado') return [{ key: 'C', label: 'Certo' }, { key: 'E', label: 'Errado' }]
  return (q.alternativas ?? []).map((text, i) => ({ key: 'ABCDE'[i], label: text }))
}

export const isCorrect = (q: BankQuestion, answer: string): boolean => answer === q.gabarito

export function recordAnswer(progress: Progress, id: string, correct: boolean): Progress {
  const [tries, hits, , fav] = progress[id] ?? [0, 0, 0, 0]
  return { ...progress, [id]: [tries + 1, hits + (correct ? 1 : 0), correct ? 1 : 0, fav] }
}

export function toggleFavorite(progress: Progress, id: string): Progress {
  const [tries, hits, last, fav] = progress[id] ?? [0, 0, 0, 0]
  return { ...progress, [id]: [tries, hits, last, fav ? 0 : 1] }
}

export function summarizeProgress(progress: Progress, ids?: readonly string[]): { answered: number; correctLast: number; wrongLast: number; favorites: number } {
  const entries = ids ? ids.map((id) => progress[id]).filter(Boolean) : Object.values(progress)
  return {
    answered: entries.filter((p) => p[0] > 0).length,
    correctLast: entries.filter((p) => p[0] > 0 && p[2] === 1).length,
    wrongLast: entries.filter((p) => p[0] > 0 && p[2] === 0).length,
    favorites: entries.filter((p) => p[3] === 1).length,
  }
}

const progressKey = (scope: string) => `vlm.questoes.${scope}`

export function loadProgress(scope: string): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(progressKey(scope)) ?? 'null') as Progress | null
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function saveProgress(scope: string, progress: Progress): void {
  try {
    localStorage.setItem(progressKey(scope), JSON.stringify(progress))
  } catch {
    // armazenamento cheio ou bloqueado: o progresso vale só nesta sessão
  }
}

/** Embaralha sem alterar a lista original (gerador de números injetável, para teste). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type TextBlock = { type: 'text'; text: string } | { type: 'code'; text: string; lang: string }

/** Separa o texto do enunciado em trechos de texto e de código (cercas de três crases). */
export function parseBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = []
  const fence = /```([\w+-]*)\n([\s\S]*?)```/g
  let last = 0
  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    if (m.index > last) blocks.push({ type: 'text', text: text.slice(last, m.index).trim() })
    blocks.push({ type: 'code', lang: m[1] || 'text', text: m[2].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) blocks.push({ type: 'text', text: text.slice(last).trim() })
  return blocks.filter((b) => b.type === 'code' || b.text)
}

/** Resumo de uma sessão de estudo para gravar em "Questões e desempenho". */
export function sessionNote(tema: string, subtemas: readonly string[], total: number): string {
  const parte = subtemas.length === 0 ? 'todos os subtemas' : subtemas.length <= 3 ? subtemas.join(', ') : `${subtemas.length} subtemas`
  return `Banco de questões · ${tema} · ${parte} · ${total} questão(ões)`
}
