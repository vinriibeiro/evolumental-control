import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseYoutube, youtubeEmbedUrl } from '@/lib/video'

/** Toca um vídeo do YouTube dentro do aplicativo (player oficial embutido). Link que não é do YouTube não renderiza nada. */
export function VideoPlayer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const ref = parseYoutube(url)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // o painel do tópico rola: traz o vídeo para a vista ao abrir
    box.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [url])
  if (!ref) return null
  return (
    <div ref={box} className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="aspect-video w-full bg-black">
        <iframe
          key={url}
          src={youtubeEmbedUrl(ref)}
          title={`Vídeo: ${title}`}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 p-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-sm text-ink hover:bg-bg">
          Abrir no YouTube <ExternalLink className="size-3" />
        </a>
        <Button size="sm" icon={<X className="size-4" />} onClick={onClose}>
          Fechar vídeo
        </Button>
      </div>
      <p className="px-2 pb-2 text-xs text-muted">Se aparecer "vídeo indisponível", o dono do canal bloqueou a exibição fora do YouTube: use "Abrir no YouTube".</p>
    </div>
  )
}
