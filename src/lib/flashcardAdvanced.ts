import { sanitizeSafeImageSrc } from '@/lib/notebookMarkdown'

// ---------------------------------------------------------------------
// Cloze Deletion: sintaxe {{c1::resposta}} ou {{c1::resposta::dica}}
// Compatível 100% com o modelo existente de `flashcards` e motor SM-2.
// ---------------------------------------------------------------------

export type ClozeSegment =
  | { type: 'text'; value: string }
  | { type: 'cloze'; index: number; answer: string; hint?: string }

const CLOZE_RE = /\{\{c(\d+)::([^}:]+?)(?:::([^}]+?))?\}\}/g

export function hasClozeSyntax(text: string): boolean {
  CLOZE_RE.lastIndex = 0
  return CLOZE_RE.test(text)
}

export function parseClozeSegments(text: string): ClozeSegment[] {
  CLOZE_RE.lastIndex = 0
  const segments: ClozeSegment[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = CLOZE_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: 'text', value: text.slice(lastIdx, m.index) })
    }
    segments.push({
      type: 'cloze',
      index: Number(m[1]) || 1,
      answer: m[2],
      hint: m[3]?.trim() || undefined,
    })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIdx) })
  }
  return segments
}

/** Extrai respostas das lacunas para preencher automaticamente o verso de cartões Cloze. */
export function extractClozeAnswers(text: string): string {
  const parts = parseClozeSegments(text)
    .filter((s): s is Extract<ClozeSegment, { type: 'cloze' }> => s.type === 'cloze')
    .map((s) => `c${s.index}: ${s.answer}`)
  return parts.join(' | ')
}

/** Converte texto Cloze para leitura em voz (Web Speech API). */
export function clozeToSpeechText(text: string, revealed: boolean): string {
  if (!hasClozeSyntax(text)) return text
  return parseClozeSegments(text)
    .map((seg) => {
      if (seg.type === 'text') return seg.value
      return revealed ? seg.answer : seg.hint ? `lacuna, dica ${seg.hint}` : 'lacuna'
    })
    .join('')
}

/** Envolve um trecho selecionado com a próxima lacuna {{cN::trecho}}. */
export function wrapWithNextCloze(fullText: string, selectionStart: number, selectionEnd: number): string {
  const existing = parseClozeSegments(fullText)
    .filter((s): s is Extract<ClozeSegment, { type: 'cloze' }> => s.type === 'cloze')
    .map((s) => s.index)
  const nextIdx = existing.length > 0 ? Math.max(...existing) + 1 : 1
  const selected = fullText.slice(selectionStart, selectionEnd).trim()
  if (!selected) return `${fullText}${fullText ? ' ' : ''}{{c${nextIdx}::trecho}}`
  return `${fullText.slice(0, selectionStart)}{{c${nextIdx}::${selected}}}${fullText.slice(selectionEnd)}`
}

// ---------------------------------------------------------------------
// Oclusão de Imagem (Image Occlusion)
// Payload compacto e versionado salvo em `flashcards.note` sem alterar
// o schema SQL nem quebrar `record_flashcard_review` / SM-2.
// ---------------------------------------------------------------------

export interface OcclusionRect {
  id: string
  /** Posições normalizadas em porcentagem (0..100) relativas à imagem. */
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export interface ImageOcclusionPayload {
  v: 1
  kind: 'image_occlusion'
  /** URL segura ou data URL compacta (quando não referenciada por página). */
  src?: string
  /** Referência opcional a uma imagem já salva em uma página de caderno (zero duplicação). */
  sourceNodeId?: string
  imageIndex?: number
  rects: OcclusionRect[]
}

const OCCLUSION_PREFIX = '<!--VLM_OCCLUSION_V1:'
const OCCLUSION_SUFFIX = '-->'

export function parseImageOcclusionNote(note: string | null | undefined): {
  textNote: string
  occlusion: ImageOcclusionPayload | null
} {
  if (!note) return { textNote: '', occlusion: null }
  const start = note.indexOf(OCCLUSION_PREFIX)
  if (start < 0) return { textNote: note, occlusion: null }
  const end = note.indexOf(OCCLUSION_SUFFIX, start + OCCLUSION_PREFIX.length)
  if (end < 0) return { textNote: note, occlusion: null }

  const rawJson = note.slice(start + OCCLUSION_PREFIX.length, end)
  const textNote = `${note.slice(0, start)}${note.slice(end + OCCLUSION_SUFFIX.length)}`.trim()
  try {
    const parsed = JSON.parse(rawJson) as Partial<ImageOcclusionPayload>
    if (parsed.v !== 1 || parsed.kind !== 'image_occlusion' || !Array.isArray(parsed.rects)) {
      return { textNote: note, occlusion: null }
    }
    const safeSrc = typeof parsed.src === 'string' ? (sanitizeSafeImageSrc(parsed.src) ?? undefined) : undefined
    const rects: OcclusionRect[] = parsed.rects
      .filter(
        (r): r is OcclusionRect =>
          Boolean(r) &&
          typeof r.x === 'number' &&
          typeof r.y === 'number' &&
          typeof r.w === 'number' &&
          typeof r.h === 'number' &&
          r.w > 0 &&
          r.h > 0,
      )
      .slice(0, 30)
      .map((r, idx) => ({
        id: typeof r.id === 'string' && r.id ? r.id : `occ-${idx + 1}`,
        x: Math.max(0, Math.min(100, Math.round(r.x * 10) / 10)),
        y: Math.max(0, Math.min(100, Math.round(r.y * 10) / 10)),
        w: Math.max(2, Math.min(100, Math.round(r.w * 10) / 10)),
        h: Math.max(2, Math.min(100, Math.round(r.h * 10) / 10)),
        label: typeof r.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 80) : undefined,
      }))
    if (rects.length === 0) return { textNote, occlusion: null }
    if (!safeSrc && !(typeof parsed.sourceNodeId === 'string' && typeof parsed.imageIndex === 'number')) {
      return { textNote, occlusion: null }
    }
    return {
      textNote,
      occlusion: {
        v: 1,
        kind: 'image_occlusion',
        ...(safeSrc ? { src: safeSrc } : {}),
        ...(typeof parsed.sourceNodeId === 'string' ? { sourceNodeId: parsed.sourceNodeId } : {}),
        ...(typeof parsed.imageIndex === 'number' ? { imageIndex: parsed.imageIndex } : {}),
        rects,
      },
    }
  } catch {
    return { textNote: note, occlusion: null }
  }
}

export function encodeImageOcclusionNote(textNote: string, occlusion: ImageOcclusionPayload): string {
  const cleanText = textNote.trim()
  const marker = `${OCCLUSION_PREFIX}${JSON.stringify(occlusion)}${OCCLUSION_SUFFIX}`
  const combined = cleanText ? `${cleanText}\n${marker}` : marker
  if (combined.length > 9800) {
    throw new Error('A imagem escolhida excede o limite compacto de oclusão (10 KB). Use uma imagem já inserida na página ou uma URL.')
  }
  return combined
}

/** Comprime uma imagem local em canvas para caber com folga no limite de `flashcards.note` (10.000 chars). */
export async function compressImageForOcclusion(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use PNG, JPEG ou WebP para oclusão de imagem.')
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'))
      el.src = objectUrl
    })
    for (const maxSide of [480, 380, 300, 240]) {
      const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.68, 0.55, 0.42]) {
        const out = canvas.toDataURL('image/jpeg', quality)
        if (out.length <= 7800) return out
      }
    }
    throw new Error('Imagem muito detalhada para embutir diretamente. Insira a imagem na página do caderno e selecione-a a partir da página.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
