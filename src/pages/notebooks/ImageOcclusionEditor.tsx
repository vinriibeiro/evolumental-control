import { useRef, useState } from 'react'
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { compressImageForOcclusion, type OcclusionRect } from '@/lib/flashcardAdvanced'
import { sanitizeSafeImageSrc } from '@/lib/notebookMarkdown'

interface PageImageOption {
  index: number
  src: string
  alt: string
}

interface ImageOcclusionEditorProps {
  pageImages: PageImageOption[]
  selectedImageSrc: string
  selectedImageIndex: number | null
  rects: OcclusionRect[]
  onSelectImage: (payload: { src: string; pageImageIndex: number | null }) => void
  onChangeRects: (next: OcclusionRect[]) => void
  onError: (msg: string) => void
}

export function ImageOcclusionEditor({
  pageImages,
  selectedImageSrc,
  selectedImageIndex,
  rects,
  onSelectImage,
  onChangeRects,
  onError,
}: ImageOcclusionEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null)

  const getRelPct = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt = getRelPct(e)
    setDrawing({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing) return
    const pt = getRelPct(e)
    setDrawing((d) => (d ? { ...d, curX: pt.x, curY: pt.y } : null))
  }

  const handlePointerUp = () => {
    if (!drawing) return
    const x = Math.min(drawing.startX, drawing.curX)
    const y = Math.min(drawing.startY, drawing.curY)
    const w = Math.abs(drawing.curX - drawing.startX)
    const h = Math.abs(drawing.curY - drawing.startY)
    setDrawing(null)
    if (w < 3 || h < 3) return
    onChangeRects([
      ...rects,
      {
        id: `occ-${rects.length + 1}-${Date.now()}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
        label: `Região ${rects.length + 1}`,
      },
    ])
  }

  const handleUpload = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    try {
      const compactSrc = await compressImageForOcclusion(file)
      onSelectImage({ src: compactSrc, pageImageIndex: null })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao preparar imagem.')
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ImageIcon className="size-3.5 text-accent" />
          Imagem e regiões ocultas ({rects.length})
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" icon={<Upload className="size-3" />} onClick={() => fileRef.current?.click()}>
            Enviar arquivo
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void handleUpload(e.target.files?.[0])} />
        </div>
      </div>

      {pageImages.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted">Ou use uma imagem já inserida nesta página (qualidade integral):</p>
          <div className="flex flex-wrap gap-1.5">
            {pageImages.map((img) => (
              <button
                key={img.index}
                type="button"
                onClick={() => onSelectImage({ src: img.src, pageImageIndex: img.index })}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
                  selectedImageIndex === img.index ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-bg text-muted hover:text-ink'
                }`}
              >
                <img src={img.src} alt="" className="size-5 rounded object-cover" />
                <span className="max-w-[140px] truncate">{img.alt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Ou cole uma URL https:// de imagem…"
          aria-label="URL da imagem para oclusão"
          className="h-8 flex-1 text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 text-xs"
          onClick={() => {
            const safe = sanitizeSafeImageSrc(urlInput)
            if (!safe) return onError('URL de imagem inválida. Use https://.')
            onSelectImage({ src: safe, pageImageIndex: null })
            setUrlInput('')
          }}
        >
          Usar URL
        </Button>
      </div>

      {selectedImageSrc ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">Arraste sobre a imagem abaixo para desenhar caixas que ficarão ocultas durante a revisão.</p>
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative mx-auto max-h-72 w-fit cursor-crosshair select-none overflow-hidden rounded-lg border border-line bg-bg touch-none"
          >
            <img src={selectedImageSrc} alt="Imagem para oclusão" draggable={false} className="block max-h-72 w-auto max-w-full object-contain" />
            {rects.map((r, i) => (
              <div
                key={r.id}
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                className="absolute flex items-center justify-center rounded border-2 border-accent bg-ink/85 text-[10px] font-semibold text-bg"
              >
                <span>{i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remover região ${i + 1}`}
                  onClick={() => onChangeRects(rects.filter((x) => x.id !== r.id))}
                  className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-danger text-white shadow"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            ))}
            {drawing && (
              <div
                style={{
                  left: `${Math.min(drawing.startX, drawing.curX)}%`,
                  top: `${Math.min(drawing.startY, drawing.curY)}%`,
                  width: `${Math.abs(drawing.curX - drawing.startX)}%`,
                  height: `${Math.abs(drawing.curY - drawing.startY)}%`,
                }}
                className="pointer-events-none absolute rounded border-2 border-dashed border-accent bg-accent/25"
              />
            )}
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-muted">Escolha uma imagem da página, envie um arquivo ou informe uma URL para marcar as regiões ocultas.</p>
      )}
    </div>
  )
}
