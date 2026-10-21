// Leitura em voz alta com a Web Speech API (speechSynthesis), 100% local no
// navegador/sistema operacional — nenhum texto é enviado a serviços externos.
// Garante uma única fala por vez: cada chamada cancela a anterior e usa um
// "token" para ignorar callbacks de falas antigas.
import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechState = 'idle' | 'speaking' | 'paused'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'
}

/** Divide textos longos (alguns navegadores cortam falas acima de ~15 s). */
export function chunkText(text: string, max = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const sentences = clean.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [clean]
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim())
      cur = ''
    }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim())
    } else cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredURI: string | null): SpeechSynthesisVoice | null {
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI)
    if (v) return v
  }
  return (
    voices.find((v) => v.lang?.toLowerCase() === 'pt-br') ??
    voices.find((v) => v.lang?.toLowerCase().replace('_', '-') === 'pt-br') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('pt')) ??
    null
  )
}

export function useSpeech(opts: { voiceURI: string | null; rate: number }) {
  const supported = isSpeechSupported()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [state, setState] = useState<SpeechState>('idle')
  const token = useRef(0)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      synth.cancel()
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    token.current++
    window.speechSynthesis.cancel()
    setState('idle')
  }, [supported])

  /** Fala os textos em sequência. Resolve true se terminou, false se interrompida. */
  const speak = useCallback(
    (texts: string[]): Promise<boolean> => {
      if (!supported) return Promise.resolve(false)
      const synth = window.speechSynthesis
      const my = ++token.current
      synth.cancel()
      const parts = texts.flatMap((t) => chunkText(t))
      if (parts.length === 0) return Promise.resolve(true)
      const voice = pickVoice(synth.getVoices(), optsRef.current.voiceURI)
      setState('speaking')
      return new Promise((resolve) => {
        let i = 0
        const next = () => {
          if (my !== token.current) return resolve(false)
          if (i >= parts.length) {
            setState('idle')
            return resolve(true)
          }
          const u = new SpeechSynthesisUtterance(parts[i++])
          if (voice) u.voice = voice
          u.lang = voice?.lang ?? 'pt-BR'
          u.rate = Math.min(2, Math.max(0.5, optsRef.current.rate || 1))
          u.onend = () => next()
          u.onerror = (e) => {
            if (my !== token.current) return resolve(false)
            // 'interrupted'/'canceled' ocorrem ao trocar de cartão: não é erro.
            if (e.error === 'interrupted' || e.error === 'canceled') return resolve(false)
            next()
          }
          synth.speak(u)
        }
        next()
      })
    },
    [supported],
  )

  const pause = useCallback(() => {
    if (!supported || state !== 'speaking') return
    window.speechSynthesis.pause()
    setState('paused')
  }, [supported, state])

  const resume = useCallback(() => {
    if (!supported || state !== 'paused') return
    window.speechSynthesis.resume()
    setState('speaking')
  }, [supported, state])

  const voice = supported ? pickVoice(voices, opts.voiceURI) : null
  return { supported, voices, voice, hasPortuguese: Boolean(voice?.lang?.toLowerCase().startsWith('pt')), state, speak, stop, pause, resume }
}
