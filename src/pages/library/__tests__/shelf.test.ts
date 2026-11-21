import { describe, expect, it } from 'vitest'
import type { BookRecord } from '@/services/library'
import type { PdfBook } from '@/services/pdfLibrary'
import { pickLastRead } from '../lastRead'
import { epubEntry, matchesFilter, pdfEntry, pdfProgress, progressLabel } from '../shelf'
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
const pdf = (extra: Partial<PdfBook> = {}): PdfBook => ({
  id: 'b'.repeat(64),
  title: 'Apostila',
  fileName: 'apostila.pdf',
  size: 2000,
  pageCount: 10,
  currentPage: 1,
  annotations: [],
  bookmarks: [],
  addedAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  ...extra,
})

describe('itens da estante unificada', () => {
  it('EPUB e PDF viram o mesmo tipo de item, cada um com o endereço do seu leitor', () => {
    expect(epubEntry(epub({ subject: 'Direito', favorite: true }))).toMatchObject({ kind: 'book', href: `/livros/${'a'.repeat(32)}`, subject: 'Direito', favorite: true, shelf: 'active', hash: 'a'.repeat(32) })
    expect(pdfEntry(pdf({ shelf: 'archived' }))).toMatchObject({ kind: 'pdf', href: `/livros/pdf/${'b'.repeat(64)}`, shelf: 'archived', author: '', hash: 'b'.repeat(64) })
    expect(epubEntry(epub({ author: 'Autor desconhecido' })).author).toBe('')
  })

  it('o progresso do PDF vem das páginas abertas e é rotulado como progresso de navegação', () => {
    expect(pdfProgress(pdf())).toBe(0)
    expect(pdfProgress(pdf({ lastReadAt: '2026-11-03T10:00:00.000Z', currentPage: 9, visitedPages: [1, 9] }))).toBe(20)
    // PDF aberto antes de existir o registro de visitas: mantém a estimativa antiga (até a página salva)
    expect(pdfProgress(pdf({ lastReadAt: '2026-11-03T10:00:00.000Z', currentPage: 4 }))).toBe(40)
    expect(progressLabel(pdfEntry(pdf({ lastReadAt: '2026-11-03T10:00:00.000Z', visitedPages: [1, 2, 3] })))).toBe('Progresso de navegação: 30%')
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
  it('escolhe o mais recente entre EPUBs e PDFs', () => {
    const entries = [
      epubEntry(epub({ lastReadAt: '2026-11-10T10:00:00.000Z', progress: 42 })),
      pdfEntry(pdf({ lastReadAt: '2026-11-12T10:00:00.000Z', visitedPages: [1, 2] })),
      epubEntry(epub({ id: 'c'.repeat(32), title: 'Nunca aberto' })),
    ]
    expect(pickLastRead(entries)).toEqual({ id: 'b'.repeat(64), kind: 'pdf', title: 'Apostila', author: '', progress: 20, href: `/livros/pdf/${'b'.repeat(64)}`, lastReadAt: '2026-11-12T10:00:00.000Z' })
  })

  it('ignora livros arquivados ou removidos e devolve null quando nada foi lido', () => {
    const hiddenPdf = pdfEntry(pdf({ lastReadAt: '2026-11-12T10:00:00.000Z', shelf: 'hidden' }))
    const read = epubEntry(epub({ lastReadAt: '2026-11-10T10:00:00.000Z' }))
    expect(pickLastRead([hiddenPdf, read])?.kind).toBe('book')
    expect(pickLastRead([hiddenPdf])).toBeNull()
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
    expect(duplicateQuestion({ level: 'suspect', reason: 'metadata', book: pdfEntry(pdf()) }, 'x.pdf')).toContain('O título coincide')
  })
})
