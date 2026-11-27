import { describe, expect, it } from 'vitest'
import {
  clozeToSpeechText,
  encodeImageOcclusionNote,
  extractClozeAnswers,
  hasClozeSyntax,
  parseClozeSegments,
  parseImageOcclusionNote,
  wrapWithNextCloze,
} from '@/lib/flashcardAdvanced'

describe('flashcardAdvanced — Cloze Deletion e Oclusão de Imagem', () => {
  it('interpreta sintaxe Cloze com e sem dica, extrai respostas e adapta leitura por voz', () => {
    const text = 'O comando {{c1::GROUP BY}} agrupa linhas antes de {{c2::HAVING::filtro pós-agregação}}.'
    expect(hasClozeSyntax(text)).toBe(true)
    expect(hasClozeSyntax('Texto normal sem lacunas')).toBe(false)

    const segs = parseClozeSegments(text)
    expect(segs).toEqual([
      { type: 'text', value: 'O comando ' },
      { type: 'cloze', index: 1, answer: 'GROUP BY', hint: undefined },
      { type: 'text', value: ' agrupa linhas antes de ' },
      { type: 'cloze', index: 2, answer: 'HAVING', hint: 'filtro pós-agregação' },
      { type: 'text', value: '.' },
    ])

    expect(extractClozeAnswers(text)).toBe('c1: GROUP BY | c2: HAVING')
    expect(clozeToSpeechText(text, false)).toBe('O comando lacuna agrupa linhas antes de lacuna, dica filtro pós-agregação.')
    expect(clozeToSpeechText(text, true)).toBe('O comando GROUP BY agrupa linhas antes de HAVING.')
  })

  it('envolve seleção com próximo índice Cloze automaticamente', () => {
    const base = 'SELECT {{c1::DISTINCT}} col FROM tabela'
    const idx = base.indexOf('tabela')
    expect(wrapWithNextCloze(base, idx, idx + 6)).toBe('SELECT {{c1::DISTINCT}} col FROM {{c2::tabela}}')
  })

  it('codifica e decodifica oclusão de imagem com segurança e bloqueia URLs maliciosas', () => {
    const encoded = encodeImageOcclusionNote('Diagrama de arquitetura', {
      v: 1,
      kind: 'image_occlusion',
      src: 'https://example.com/diagrama.png',
      rects: [{ id: 'r1', x: 10, y: 20, w: 30, h: 15, label: 'Gateway' }],
    })
    const parsed = parseImageOcclusionNote(encoded)
    expect(parsed.textNote).toBe('Diagrama de arquitetura')
    expect(parsed.occlusion?.src).toBe('https://example.com/diagrama.png')
    expect(parsed.occlusion?.rects).toHaveLength(1)

    // Payload com URL javascript: deve ser rejeitado com segurança
    const evil = '<!--VLM_OCCLUSION_V1:{"v":1,"kind":"image_occlusion","src":"javascript:alert(1)","rects":[{"id":"1","x":1,"y":1,"w":10,"h":10}]}-->'
    expect(parseImageOcclusionNote(evil).occlusion).toBeNull()
  })
})
