import { describe, expect, it } from 'vitest'
import {
  FONT_MAX,
  FONT_MIN,
  clampFont,
  coverHue,
  filterShelf,
  formatSize,
  inProgress,
  isEpubFile,
  normalizePrefs,
  readingProgress,
  sortShelf,
  titleFromFileName,
} from '../library'

describe('preferências do leitor', () => {
  it('limita o tamanho do texto ao intervalo permitido, em passos de 10%', () => {
    expect(clampFont(10)).toBe(FONT_MIN)
    expect(clampFont(999)).toBe(FONT_MAX)
    expect(clampFont(113)).toBe(110)
    expect(clampFont(Number.NaN)).toBe(100)
  })

  it('devolve o padrão para dados inválidos e respeita o tema escuro do app', () => {
    expect(normalizePrefs(null, false)).toEqual({ fontSize: 110, theme: 'sepia', flow: 'paginado' })
    expect(normalizePrefs('lixo', true).theme).toBe('escuro')
    expect(normalizePrefs({ fontSize: 'grande', theme: 'neon', flow: 'voando' }, false)).toEqual({ fontSize: 110, theme: 'sepia', flow: 'paginado' })
  })

  it('mantém preferências válidas salvas', () => {
    expect(normalizePrefs({ fontSize: 150, theme: 'claro', flow: 'rolagem' }, true)).toEqual({ fontSize: 150, theme: 'claro', flow: 'rolagem' })
  })
})

describe('arquivos e títulos', () => {
  it('aceita só EPUB', () => {
    expect(isEpubFile('Livro.EPUB')).toBe(true)
    expect(isEpubFile('sem-extensao', 'application/epub+zip')).toBe(true)
    expect(isEpubFile('livro.pdf', 'application/pdf')).toBe(false)
  })

  it('usa o nome do arquivo como título quando falta metadado', () => {
    expect(titleFromFileName('Pense_em__Estatistica.epub')).toBe('Pense em Estatistica')
  })

  it('formata o tamanho em KB e MB', () => {
    expect(formatSize(500)).toBe('1 KB')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(5 * 1024 * 1024 + 300 * 1024)).toBe('5,3 MB')
  })

  it('gera um matiz estável para a capa', () => {
    expect(coverHue('Pense em Estatística')).toBe(coverHue('Pense em Estatística'))
    expect(coverHue('A')).toBeGreaterThanOrEqual(0)
    expect(coverHue('Um título bem longo que passa de 360')).toBeLessThan(360)
  })
})

describe('progresso de leitura', () => {
  it('estima pelo capítulo e pela página dentro dele', () => {
    expect(readingProgress(0, 10, 1, 5)).toBe(0)
    expect(readingProgress(5, 10, 1, 4)).toBe(50)
    expect(readingProgress(4, 10, 3, 4)).toBe(45)
  })

  it('não passa de 99% antes do fim e chega a 100% no fim', () => {
    expect(readingProgress(9, 10, 5, 5)).toBe(98)
    expect(readingProgress(10, 10, 1, 1)).toBe(99)
    expect(readingProgress(9, 10, 5, 5, true)).toBe(100)
  })

  it('pondera pelo tamanho das seções quando conhecido', () => {
    // sumário curto (1) + capítulo longo (9): estar no começo do capítulo longo = 10%
    expect(readingProgress(1, 2, 1, 4, false, [10, 90])).toBe(10)
    expect(readingProgress(1, 2, 3, 4, false, [10, 90])).toBe(55)
    expect(readingProgress(0, 2, 3, 4, false, [10, 90])).toBe(5)
  })

  it('ignora pesos inconsistentes e volta à estimativa por seção', () => {
    expect(readingProgress(5, 10, 1, 4, false, [1, 2, 3])).toBe(50)
    expect(readingProgress(5, 10, 1, 4, false, new Array(10).fill(0))).toBe(50)
  })

  it('trata livro sem capítulos ou posição inválida', () => {
    expect(readingProgress(0, 0, 1, 1)).toBe(0)
    expect(readingProgress(-1, 10, 1, 1)).toBe(0)
  })
})

describe('estante', () => {
  const b = (id: string, title: string, addedAt: string, lastReadAt?: string, progress = 0, author = 'X') => ({ id, title, author, addedAt, lastReadAt, progress })

  it('põe o último lido primeiro e depois os mais novos', () => {
    const list = [b('a', 'A', '2026-10-01'), b('b', 'B', '2026-10-03'), b('c', 'C', '2026-10-02', '2026-10-30T10:00:00Z')]
    expect(sortShelf(list).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('não altera a lista original', () => {
    const list = [b('a', 'A', '2026-10-01'), b('b', 'B', '2026-10-03')]
    sortShelf(list)
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('filtra por título ou autor sem diferenciar maiúsculas', () => {
    const list = [b('a', 'Pense em Estatística', '1', undefined, 0, 'Allen Downey'), b('b', 'Python e R', '2', undefined, 0, 'Rick Scavetta')]
    expect(filterShelf(list, 'ESTATÍSTICA').map((x) => x.id)).toEqual(['a'])
    expect(filterShelf(list, 'scavetta').map((x) => x.id)).toEqual(['b'])
    expect(filterShelf(list, '  ')).toHaveLength(2)
  })

  it('"continuar lendo" só inclui livros começados e não terminados', () => {
    expect(inProgress(b('a', 'A', '1'))).toBe(false)
    expect(inProgress(b('a', 'A', '1', '2026-10-30', 40))).toBe(true)
    expect(inProgress(b('a', 'A', '1', '2026-10-30', 100))).toBe(false)
  })
})
