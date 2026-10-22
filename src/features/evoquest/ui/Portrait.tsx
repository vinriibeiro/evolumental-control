import { useEffect, useRef } from 'react'
import { drawCharacter, drawObject } from '../render/sprites'
import type { CharacterLook } from '../engine/types'

/** Retrato em pixel art (mesmo desenho do mapa, ampliado). */
export function Portrait({ look, object, size = 72, label }: { look?: CharacterLook; object?: string; size?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, 16, 16)
    if (look) drawCharacter(c, 8, 16, look, 'down', 0)
    else if (object) drawObject(c, object, 0, 0, 0)
  }, [look, object])
  return <canvas ref={ref} width={16} height={16} role="img" aria-label={label} className="eq-pixel shrink-0 rounded border-2 border-[var(--eq-edge-dark)] bg-[#1d1712]" style={{ width: size, height: size }} />
}
