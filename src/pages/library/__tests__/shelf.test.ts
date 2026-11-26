import { describe, expect, it } from 'vitest'
import type { BookRecord } from '@/services/library'
import { pickLastRead } from '../lastRead'
import { epubEntry, matchesFilter, progressLabel } from '../shelf'
import { duplicateQuestion } from '../useShelf'

const epub = (extra: Partial<BookRecord> = {}): BookRecord => ({
  id: 'a'.repeat(32),
  title: 'Livro',
  author: 'Autora',
  fileName: 'livro.epub',
  size: 1000,
  addedAt: '2026-11-01T10:00:00.000Z',
  progress: 0,
  bookmarks: [],
  updatedAt: '2026-11-01T10:00:00.000Z',
  fileLocal: true,
  cloud: 'off',
  ...extra,
})

describe('itens da estante de livros EPUB', () => {
  it('converte BookRecord em ShelfEntry com link do leitor EPUB', () => {
    expect(epubEntry(epub({ subject: 'Dados', favorite: true }))).toMatchObject({
      kind: 'book',
      href: `/livros/${'a'.repeat(32)}`,
      subject: 'Dados',
      favorite: true,
      shelf: 'active',
      hash: 'a'.repeat(32),
    })
    expect(epubEntry(epub({ author: 'Autor desconhecido' })).author).toBe('')
    expect(progressLabel(epubEntry(epub({ progress: 42 })))).toBe('42% lido')
  })

  it('filtros: arquivados e removidos saem da estante, dos favoritos e do "em andamento"', () => {
    const reading = epubEntry(epub({ lastReadAt: '2026-11-03T10:00:00.000Z', progress: 30, favorite: true }))
    const hidden = { ...reading, shelf: 'hidden' as const }
    const archived = { ...reading, shelf: 'archived' as const }
    expect([matchesFilter(reading, 'all'), matchesFilter(reading, 'reading'), matchesFilter(reading, 'favorites')]).toEqual([true, true, true])
    expect([matchesFilter(hidden, 'all'), matchesFilter(hidden, 'reading'), matchesFilter(hidden, 'favorites'), matchesFilter(hidden, 'hidden')]).toEqual([false, false, false, true])
    expect([matchesFilter(archived, 'all'), matchesFilter(archived, 'archived'), matchesFilter(archived, 'hidden')]).toEqual([false, true, false])
    expect(matchesFilter(epubEntry(epub({ lastReadAt: '2026-11-03T10:00:00.000Z', progress: 100 })), 'reading')).toBe(false)
  })
})

describe('continuar de onde parei', () => {
  it('escolhe o EPUB lido mais recentemente', () => {
    const entries = [
      epubEntry(epub({ lastReadAt: '2026-11-10T10:00:00.000Z', progress: 42 })),
      epubEntry(epub({ id: 'b'.repeat(32), title: 'Mais Recente', lastReadAt: '2026-11-12T10:00:00.000Z', progress: 65 })),
      epubEntry(epub({ id: 'c'.repeat(32), title: 'Nunca aberto' })),
    ]
    expect(pickLastRead(entries)).toEqual({
      id: 'b'.repeat(32),
      kind: 'book',
      title: 'Mais Recente',
      author: 'Autora',
      progress: 65,
      href: `/livros/${'b'.repeat(32)}`,
      lastReadAt: '2026-11-12T10:00:00.000Z',
    })
  })

  it('ignora livros arquivados ou removidos e devolve null quando nada foi lido', () => {
    const hiddenBook = epubEntry(epub({ id: 'b'.repeat(32), lastReadAt: '2026-11-12T10:00:00.000Z', shelf: 'hidden' }))
    const read = epubEntry(epub({ lastReadAt: '2026-11-10T10:00:00.000Z' }))
    expect(pickLastRead([hiddenBook, read])?.id).toBe('a'.repeat(32))
    expect(pickLastRead([hiddenBook])).toBeNull()
    expect(pickLastRead([epubEntry(epub())])).toBeNull()
    expect(pickLastRead([])).toBeNull()
  })
})

describe('pergunta de livro possivelmente duplicado', () => {
  it('nomeia o livro que já existe, diz o que coincide e onde ele está', () => {
    const book = epubEntry(epub({ title: 'Dom Casmurro', author: 'Machado de Assis', shelf: 'archived' }))
    const text = duplicateQuestion({ level: 'suspect', reason: 'isbn', book }, 'outra-edicao.epub')
    expect(text).toContain('Parece que este livro já está na estante: “Dom Casmurro”, de Machado de Assis (em Arquivados).')
    expect(text).toContain('O ISBN é o mesmo')
    expect(text).toContain('“outra-edicao.epub” é diferente')
    expect(text.endsWith('Adicionar mesmo assim?')).toBe(true)
  })
})
