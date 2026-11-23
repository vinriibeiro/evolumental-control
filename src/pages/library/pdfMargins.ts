/** Normalized horizontal distances that can be cropped from a PDF page. */
export interface PdfMargins {
  left: number
  right: number
}

export const NO_MARGINS: PdfMargins = { left: 0, right: 0 }

/** Find the outermost ink, including figures and small print. Leave room around it. */
export function blankMargins({ data, width, height }: ImageData): PdfMargins {
  let left = width
  let right = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 32 || Math.min(data[i], data[i + 1], data[i + 2]) >= 249) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
  }
  if (right < left) return NO_MARGINS
  const padding = Math.ceil(width * 0.025)
  return {
    left: Math.min(0.2, Math.max(0, left - padding) / width),
    right: Math.min(0.2, Math.max(0, width - 1 - right - padding) / width),
  }
}
