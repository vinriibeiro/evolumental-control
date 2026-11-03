import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/feedback'

/**
 * Modo cinema e tela cheia da sala de estudos (vídeos e cursos). A tela cheia expande a sala inteira (timer,
 * conteúdo e player) sem recriar o iframe; se o navegador bloquear a Fullscreen API, cai no modo cinema.
 */
export function useClassroomView() {
  const classroom = useRef<HTMLDivElement>(null)
  const [theater, setTheater] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === classroom.current)
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) setTheater(false) }
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === classroom.current) await document.exitFullscreen()
      else if (classroom.current?.requestFullscreen) await classroom.current.requestFullscreen()
      else { setTheater(true); toast.info('Tela cheia indisponível neste navegador. Modo cinema ativado.') }
    } catch {
      setTheater(true)
      toast.info('O navegador não permitiu a tela cheia. Modo cinema ativado.')
    }
  }

  return { classroom, theater, setTheater, fullscreen, toggleFullscreen }
}
