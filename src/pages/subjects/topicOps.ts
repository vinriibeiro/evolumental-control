// Conversão de texto indentado (edital, ementa, sumário) em hierarquia.
// A prévia editável e a gravação ficam em src/features/explorer/outline.ts.

export interface OutlineNode {
  name: string
  depth: number
}

/**
 * Converte texto indentado em hierarquia. Cada 2 espaços ou 1 tab = 1 nível.
 * Marcadores como "-", "•", "*" e numeração "1.", "1.2)" são removidos.
 */
export function parseOutline(text: string): OutlineNode[] {
  const out: OutlineNode[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const indent = raw.match(/^[\t ]*/)![0].replace(/\t/g, '  ').length
    const name = raw
      .trim()
      .replace(/^([-•*–]|\d+(\.\d+)*[.)]?)\s+/, '')
      .trim()
      .slice(0, 300)
    if (!name) continue
    const prevDepth = out.length ? out[out.length - 1].depth : -1
    out.push({ name, depth: Math.min(Math.floor(indent / 2), prevDepth + 1) })
  }
  return out
}
