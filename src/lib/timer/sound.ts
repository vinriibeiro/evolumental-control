// Alerta sonoro gerado localmente com Web Audio (sem arquivos externos).
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    if (!ctx || ctx.state === 'closed') ctx = new Ctor()
  } catch {
    return null // Restrições do dispositivo não impedem estudar com aviso visual.
  }
  return ctx
}

/** Chamar em um gesto do usuário (ex.: Iniciar) para liberar o áudio. */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

export function playChime(kind: 'focus-end' | 'break-end' | 'warning' = 'focus-end') {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  const notes = kind === 'warning' ? [523.25, 659.25] : kind === 'focus-end' ? [659.25, 783.99, 987.77] : [987.77, 783.99, 659.25]
  const start = c.currentTime + 0.02
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = start + i * 0.22
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
}
