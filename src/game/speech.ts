// Áudio do EvoQuest: leitura em voz alta pelo próprio navegador (Web Speech
// API, preferindo vozes locais do sistema) e efeitos sonoros sintetizados.
// Nenhum texto é enviado a serviços externos por este código.

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const base = lang.slice(0, 2).toLowerCase()
  const same = voices.filter((v) => v.lang.toLowerCase().startsWith(base))
  return same.find((v) => v.localService && v.lang.toLowerCase() === lang.toLowerCase()) ?? same.find((v) => v.localService) ?? same[0] ?? null
}

export function speak(text: string, lang = 'en-US', rate = 1) {
  if (!speechAvailable()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  const voice = pickVoice(lang)
  if (voice) u.voice = voice
  synth.speak(u)
}

let ctx: AudioContext | null = null

/** Bipes curtos para acerto/erro/subida de nível (respeita a preferência de som). */
export function playSfx(kind: 'right' | 'wrong' | 'level') {
  try {
    ctx ??= new AudioContext()
    const notes = kind === 'right' ? [660, 880] : kind === 'wrong' ? [330, 247] : [523, 659, 784, 1047]
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      const t = ctx!.currentTime + i * 0.09
      o.type = kind === 'wrong' ? 'triangle' : 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + 0.18)
    })
  } catch {
    // Áudio indisponível: o feedback visual continua.
  }
}
