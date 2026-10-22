// Efeitos sonoros curtos, gerados na hora (Web Audio): nenhum arquivo para
// baixar. O volume é uma preferência deste aparelho.
type Sfx = 'blip' | 'success' | 'error' | 'step' | 'open'

let ctx: AudioContext | null = null
const KEY = 'evl-world-volume'

export function getVolume(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && localStorage.getItem(KEY) !== null ? Math.min(1, Math.max(0, v)) : 0.5
  } catch {
    return 0.5
  }
}

export function setVolume(v: number) {
  try {
    localStorage.setItem(KEY, String(v))
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

const NOTES: Record<Sfx, Array<[number, number]>> = {
  blip: [[660, 0.04]],
  open: [[440, 0.05], [660, 0.06]],
  step: [[220, 0.03]],
  success: [[523, 0.08], [659, 0.08], [784, 0.14]],
  error: [[196, 0.12], [165, 0.16]],
}

export function play(sfx: Sfx, enabled = true) {
  const vol = getVolume()
  if (!enabled || vol <= 0 || typeof AudioContext === 'undefined') return
  try {
    ctx ??= new AudioContext()
    let t = ctx.currentTime
    for (const [freq, dur] of NOTES[sfx]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'square'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.06 * vol, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur)
      t += dur
    }
  } catch {
    /* áudio indisponível: o jogo segue mudo */
  }
}
