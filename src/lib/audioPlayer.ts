/** Regras puras do player de áudio dos tópicos (repetições do ciclo de estudo de idiomas). Sem acesso a tela nem banco. */

/** "licao": toca a lição inteira N vezes. "faixa": repete cada faixa N vezes antes de ir para a próxima. */
export type RepeatMode = 'licao' | 'faixa'

export const REPEAT_MODE_LABELS: Record<RepeatMode, string> = { licao: 'Lição inteira', faixa: 'Cada faixa' }
export const REPEATS_MIN = 1
export const REPEATS_MAX = 20
export const RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5] as const

export interface PlayState {
  /** Faixa atual (0 a total-1). */
  index: number
  /** Repetição atual, começando em 1. */
  lap: number
  mode: RepeatMode
  repeats: number
  total: number
}

export interface Step {
  index: number
  lap: number
  /** true quando todas as repetições terminaram. */
  done: boolean
}

export function clampRepeats(n: number): number {
  if (!Number.isFinite(n)) return 5
  return Math.min(REPEATS_MAX, Math.max(REPEATS_MIN, Math.round(n)))
}

/** O que tocar quando a faixa atual termina. */
export function advance(s: PlayState): Step {
  if (s.total <= 0) return { index: 0, lap: 1, done: true }
  if (s.mode === 'faixa') {
    if (s.lap < s.repeats) return { index: s.index, lap: s.lap + 1, done: false }
    if (s.index + 1 < s.total) return { index: s.index + 1, lap: 1, done: false }
    return { index: s.index, lap: s.lap, done: true }
  }
  if (s.index + 1 < s.total) return { index: s.index + 1, lap: s.lap, done: false }
  if (s.lap < s.repeats) return { index: 0, lap: s.lap + 1, done: false }
  return { index: s.index, lap: s.lap, done: true }
}

/** Pular para a próxima faixa manualmente (sem passar do fim). A repetição volta a 1 no modo "faixa". */
export function skipNext(s: PlayState): Step {
  const index = Math.min(s.total - 1, s.index + 1)
  return { index: Math.max(0, index), lap: s.mode === 'faixa' ? 1 : s.lap, done: false }
}

export function skipPrevious(s: PlayState): Step {
  return { index: Math.max(0, s.index - 1), lap: s.mode === 'faixa' ? 1 : s.lap, done: false }
}

/** Texto de progresso, por exemplo "Volta 2 de 5 · faixa 3 de 5". */
export function progressLabel(s: PlayState): string {
  const rep = s.mode === 'licao' ? `Volta ${s.lap} de ${s.repeats}` : `Repetição ${s.lap} de ${s.repeats}`
  return `${rep} · faixa ${s.index + 1} de ${s.total}`
}

/** Tempo total necessário para ouvir N vezes (segundos). */
export function totalListeningSeconds(durations: Array<number | undefined>, repeats: number): number {
  return durations.reduce<number>((a, d) => a + (d ?? 0), 0) * repeats
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Nome amigável a partir do nome do arquivo (L01_T01_pag07.mp3 -> "Track 1 · pág. 7"). */
export function trackNameFromFile(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const a = /^L\d+_T0*(\d+)_pag0*(\d+)/i.exec(stem)
  if (a) return `Track ${a[1]} · pág. ${a[2]}`
  const b = /^B\d+_L\d+_T0*(\d+)/i.exec(stem)
  if (b) return `Track ${b[1]}`
  const c = /^L\d+_T0*(\d+)$/i.exec(stem)
  if (c) return `Track ${c[1]}`
  return stem.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || fileName
}

export function isAudioFile(name: string, type = ''): boolean {
  return /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i.test(name) || type.startsWith('audio/')
}

/** Nome para exibir: faixas salvas antes da regra "L02_T06" → "Track 6" aparecem com o nome novo. */
export function displayTrackName(name: string, fileName: string): string {
  return /^L\d+ T\d+$/i.test(name) ? trackNameFromFile(fileName) : name
}
