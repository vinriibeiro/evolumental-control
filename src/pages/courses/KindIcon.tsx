import { File, FileText, Image, Music, PlayCircle, Presentation, Sheet } from 'lucide-react'
import { materialType, type MaterialKind } from '@/lib/drive'
import type { CourseNode } from '@/types/db'

const ICONS: Record<MaterialKind, typeof File> = {
  video: PlayCircle, pdf: FileText, document: FileText, spreadsheet: Sheet, presentation: Presentation, image: Image, audio: Music, text: FileText, other: File,
}

export function KindIcon({ node, className }: { node: Pick<CourseNode, 'mime_type'>; className?: string }) {
  const Icon = ICONS[materialType(node.mime_type).kind]
  return <Icon className={className} aria-hidden />
}
