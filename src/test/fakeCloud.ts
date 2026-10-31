import type { CloudBook, LibraryCloud } from '@/services/library'

/** Nuvem em memória para testar a sincronização entre "aparelhos" (várias estantes sobre a mesma nuvem). */
export class FakeCloud implements LibraryCloud {
  books = new Map<string, CloudBook>()
  files = new Map<string, ArrayBuffer>()
  covers = new Map<string, ArrayBuffer>()
  /** Quando true, toda operação falha como se estivesse sem internet. */
  offline = false
  /** Quando true, só o envio de arquivos falha. */
  failUploads = false
  calls: string[] = []

  private guard(op: string) {
    this.calls.push(op)
    if (this.offline) throw new Error('Failed to fetch')
  }

  async list() {
    this.guard('list')
    return [...this.books.values()].map((b) => structuredClone(b))
  }

  async upsert(book: CloudBook) {
    this.guard('upsert')
    this.books.set(book.id, structuredClone(book))
  }

  async uploadFile(id: string, data: ArrayBuffer) {
    this.guard('uploadFile')
    if (this.failUploads) throw new Error('upload recusado')
    this.files.set(id, data.slice(0))
  }

  async uploadCover(id: string, data: ArrayBuffer) {
    this.guard('uploadCover')
    this.covers.set(id, data.slice(0))
  }

  async downloadFile(id: string) {
    this.guard('downloadFile')
    const f = this.files.get(id)
    if (!f) throw new Error('Livro não encontrado na nuvem.')
    return f.slice(0)
  }

  async downloadCover(id: string) {
    this.guard('downloadCover')
    return this.covers.get(id)?.slice(0)
  }

  async remove(id: string) {
    this.guard('remove')
    this.books.delete(id)
    this.files.delete(id)
    this.covers.delete(id)
  }
}
