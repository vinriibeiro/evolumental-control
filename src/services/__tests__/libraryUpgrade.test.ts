import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { Library } from '../library'

describe('estante criada antes da sincronização', () => {
  it('preenche os campos novos dos livros antigos ao abrir, sem perder nada', async () => {
    const name = 'teste-upgrade-v1'
    // banco no formato antigo (versão 1), como o navegador do usuário já tem
    const old = new Dexie(name)
    old.version(1).stores({ books: 'id, addedAt, lastReadAt', files: 'id' })
    await old.table('books').put({
      id: 'abc',
      title: 'Livro Antigo',
      author: 'Autor',
      fileName: 'antigo.epub',
      size: 123,
      addedAt: '2026-10-30T10:00:00.000Z',
      lastReadAt: '2026-10-30T12:00:00.000Z',
      location: 'epubcfi(/6/4)',
      progress: 2,
      bookmarks: [],
    })
    await old.table('files').put({ id: 'abc', data: new ArrayBuffer(8) })
    old.close()

    const lib = new Library(name)
    try {
      const [book] = await lib.list()
      expect(book).toMatchObject({
        title: 'Livro Antigo',
        progress: 2,
        location: 'epubcfi(/6/4)',
        fileLocal: true,
        cloud: 'off',
        updatedAt: '2026-10-30T12:00:00.000Z',
      })
      expect((await lib.open('abc')).byteLength).toBe(8)
    } finally {
      await lib.destroy()
    }
  })
})
