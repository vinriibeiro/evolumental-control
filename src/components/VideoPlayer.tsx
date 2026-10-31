import { ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { parseYoutube, youtubeEmbedUrl, type YoutubeRef } from '@/lib/video'

/** Só o quadro do vídeo (player oficial do YouTube), na proporção 16:9. Quem usa decide a moldura em volta. */
export function VideoFrame({ video, url, title, autoPlay = false, className }: { video: YoutubeRef; url: string; title: string; autoPlay?: boolean; className?: string }) {
  return (
    <div className={cn('aspect-video w-full bg-black', className)}>
      <iframe
        key={url}
        src={youtubeEmbedUrl(video, { autoplay: autoPlay })}
        title={`Vídeo: ${title}`}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

export const UNAVAILABLE_HINT = 'Se aparecer "vídeo indisponível", o dono do canal bloqueou a exibição fora do YouTube: use "Abrir no YouTube".'

/**
 * Toca um vídeo do YouTube dentro do aplicativo, com moldura, link para o YouTube e (opcionalmente) botão de fechar.
 * Link que não é do YouTube não renderiza nada. No computador a altura é limitada à da janela.
 */
export function VideoPlayer({ url, title, onClose, autoPlay = false }: { url: string; title: string; onClose?: () => void; autoPlay?: boolean }) {
  const ref = parseYoutube(url)
  if (!ref) return null
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
      <VideoFrame video={ref} url={url} title={title} autoPlay={autoPlay} className="mx-auto max-w-[calc(62vh*16/9)]" />
      <div className="flex flex-wrap items-center gap-2 p-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-sm text-ink hover:bg-bg">
          Abrir no YouTube <ExternalLink className="size-3" />
        </a>
        {onClose && (
          <Button size="sm" icon={<X className="size-4" />} onClick={onClose}>
            Fechar vídeo
          </Button>
        )}
      </div>
      <p className="px-2 pb-2 text-xs text-muted">{UNAVAILABLE_HINT}</p>
    </div>
  )
}
