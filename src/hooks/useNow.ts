import { useEffect, useState } from 'react'

/**
 * Relógio de parede para re-renderizar a tela. Não acumula tempo: quem exibe
 * calcula a partir de timestamps, então atrasos do timer (aba em segundo
 * plano, JS suspenso) não afetam o valor mostrado.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs, enabled])
  return now
}
