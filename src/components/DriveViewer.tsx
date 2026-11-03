import { AlertTriangle, ExternalLink, FileQuestion } from 'lucide-react'
import { cn } from '@/lib/cn'
import { driveEmbedUrl, driveOpenUrl, isTrustedDriveUrl, materialType } from '@/lib/drive'
import type { CourseNode } from '@/types/db'

export function DriveOpenLink({ node, className }: { node: Pick<CourseNode, 'drive_id' | 'mime_type' | 'resource_key'>; className?: string }) {
  const href = driveOpenUrl(node.drive_id, node.mime_type, node.resource_key)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-ink hover:underline', className)}>
      Abrir no Drive <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

/** O que pode dar errado no visualizador do Google. Não dá para detectar de dentro do app (o iframe é de outro domínio). */
export const DRIVE_VIEWER_HELP = [
  'Tela de login ou "Você precisa de acesso": a conta Google deste navegador não tem permissão para o arquivo. Entre no Google com a conta certa ou peça acesso ao dono.',
  'Vídeo "ainda está sendo processado": o Drive ainda não preparou a reprodução; tente mais tarde.',
  'Área em branco ou erro de conexão: o navegador pode estar bloqueando cookies de terceiros ou conteúdo do Google (bloqueadores, modo anônimo). Use "Abrir no Drive".',
  'Arquivo removido ou movido para a lixeira: aparece "não encontrado"; use "Atualizar do Drive" para atualizar o catálogo.',
]

/**
 * Mostra o arquivo com o visualizador incorporado do Google (PDF, vídeo, documentos…). O iframe aponta só para
 * drive.google.com/docs.google.com com ID validado. O app não sabe se o conteúdo carregou de fato, quanto foi
 * assistido ou lido: por isso a ajuda e o "Abrir no Drive" ficam sempre visíveis.
 */
export function DriveViewer({ node, title, className, frameClassName }: { node: CourseNode; title: string; className?: string; frameClassName?: string }) {
  const type = materialType(node.mime_type)
  const src = driveEmbedUrl(node.drive_id, node.mime_type, node.resource_key)
  const tall = type.kind !== 'video' && type.kind !== 'audio'

  if (!src || !isTrustedDriveUrl(src)) {
    return (
      <div className={cn('grid place-items-center gap-3 bg-surface-2 px-6 py-12 text-center', className)}>
        <FileQuestion className="size-10 text-muted" aria-hidden />
        <div className="max-w-md space-y-1">
          <p className="font-semibold text-ink">Sem visualização dentro da plataforma</p>
          <p className="text-sm text-muted">
            Este formato ({type.label}{node.mime_type ? ` · ${node.mime_type}` : ''}) não tem visualizador incorporado do Google. O arquivo continua no catálogo e pode ser aberto no Drive.
          </p>
        </div>
        <DriveOpenLink node={node} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm font-medium" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col bg-black', className)}>
      {node.status === 'missing' && (
        <p role="status" className="flex items-start gap-2 bg-warning/15 px-4 py-2 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          Não foi encontrado no Drive na última atualização (removido ou sem acesso). O visualizador pode não abrir.
        </p>
      )}
      <iframe
        src={src}
        title={`${type.label}: ${title}`}
        className={cn('block w-full border-0', tall ? 'bg-white' : 'bg-black', frameClassName ?? (tall ? 'h-[78dvh] min-h-[420px]' : 'aspect-video max-h-[75dvh]'))}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
      />
    </div>
  )
}
