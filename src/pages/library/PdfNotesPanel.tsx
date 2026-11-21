import { useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Textarea } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import type { PdfAnnotation, PdfBook } from '@/services/pdfLibrary'

interface Props {
  book: PdfBook
  /** Página aberta no leitor: é a ela que uma anotação nova fica presa. */
  page: number
  storageNotice: string
  onGo: (page: number) => void
  onAdd: (annotation: PdfAnnotation) => void
  onChange: (annotations: PdfAnnotation[]) => void
  onClose: () => void
  className?: string
}

const isDocumentNote = (a: PdfAnnotation) => a.type === 'note' && a.scope === 'document'

/**
 * Painel de anotações do PDF: notas simples, do documento ou de uma página, mais a lista de
 * destaques, desenhos e páginas marcadas. Tudo fica no mesmo registro das marcações do leitor.
 */
export function PdfNotesPanel({ book, page, storageNotice, onGo, onAdd, onChange, onClose, className }: Props) {
  const [draft, setDraft] = useState('')
  const [onPage, setOnPage] = useState(true)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const notes = book.annotations
    .filter((a) => a.type === 'note')
    .sort((a, b) => Number(isDocumentNote(b)) - Number(isDocumentNote(a)) || a.page - b.page || a.createdAt.localeCompare(b.createdAt))
  const marks = book.annotations.filter((a) => a.type !== 'note').sort((a, b) => a.page - b.page)

  const add = () => {
    const text = draft.trim()
    if (!text) return
    // Sem "points" a nota não vira alfinete sobre a página: ela vive só neste painel.
    onAdd({ id: crypto.randomUUID(), page, type: 'note', color: '#f2cc4d', text, createdAt: new Date().toISOString(), ...(onPage ? {} : { scope: 'document' as const }) })
    setDraft('')
  }

  const saveEdit = () => {
    if (!editing) return
    const text = editing.text.trim()
    if (!text) return
    onChange(book.annotations.map((a) => (a.id === editing.id ? { ...a, text, updatedAt: new Date().toISOString() } : a)))
    setEditing(null)
  }

  return (
    <aside className={cn('pdf-reader-notes flex min-h-0 flex-col rounded-xl border border-line bg-surface', className)} aria-label="Anotações do PDF">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          Anotações <span className="ml-1 font-normal text-muted tabular-nums">{notes.length}</span>
        </h2>
        <IconButton label="Fechar anotações" size="sm" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Textarea aria-label="Nova anotação" rows={3} maxLength={10000} placeholder="Escreva uma anotação…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox label={`Vincular à página ${page}`} checked={onPage} onChange={(e) => setOnPage(e.target.checked)} className="text-xs" />
            <Button size="sm" variant="dark" type="submit" disabled={!draft.trim()}>
              Adicionar
            </Button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs leading-relaxed text-muted">Nenhuma anotação ainda. Elas podem ser do documento todo ou de uma página.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => {
              const whole = isDocumentNote(note)
              return (
                <li key={note.id} className={cn('rounded-lg border p-3', !whole && note.page === page ? 'border-ink/30' : 'border-line')}>
                  <div className="flex items-center justify-between gap-1">
                    {whole ? (
                      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Documento</span>
                    ) : (
                      <button type="button" onClick={() => onGo(note.page)} className="text-[11px] font-semibold tracking-wide text-ink uppercase underline-offset-2 hover:underline" aria-label={`Ir para a página ${note.page}`}>
                        Página {note.page}
                      </button>
                    )}
                    <span className="flex">
                      <IconButton label="Editar anotação" size="sm" onClick={() => setEditing({ id: note.id, text: note.text ?? '' })}>
                        <Pencil className="size-3.5 text-muted" aria-hidden />
                      </IconButton>
                      <IconButton label="Excluir anotação" size="sm" onClick={() => onChange(book.annotations.filter((a) => a.id !== note.id))}>
                        <Trash2 className="size-3.5 text-muted" aria-hidden />
                      </IconButton>
                    </span>
                  </div>
                  {editing?.id === note.id ? (
                    <div className="mt-1 space-y-2">
                      <Textarea aria-label="Texto da anotação" rows={4} maxLength={10000} value={editing.text} onChange={(e) => setEditing({ id: note.id, text: e.target.value })} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" variant="dark" disabled={!editing.text.trim()} onClick={saveEdit}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {note.quote && <p className="mt-1 line-clamp-3 border-l-2 border-line pl-2 text-xs leading-relaxed text-muted">{note.quote}</p>}
                      <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">{note.text}</p>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {book.bookmarks.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Páginas marcadas</h3>
            <div className="flex flex-wrap gap-1.5">
              {book.bookmarks.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  onClick={() => onGo(mark)}
                  aria-label={`Ir para a página marcada ${mark}`}
                  className={cn('rounded-md border px-2.5 py-1 text-xs tabular-nums transition-colors hover:bg-surface-2', mark === page ? 'border-ink text-ink' : 'border-line text-muted')}
                >
                  {mark}
                </button>
              ))}
            </div>
          </div>
        )}

        {marks.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Destaques e desenhos</h3>
            <ul className="space-y-1.5">
              {marks.map((mark) => (
                <li key={mark.id} className="flex items-start gap-1 rounded-lg border border-line px-3 py-2">
                  <button type="button" onClick={() => onGo(mark.page)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-ink uppercase">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: mark.color }} aria-hidden />
                      Página {mark.page} · {mark.type === 'highlight' ? 'Destaque' : 'Desenho'}
                    </span>
                    {mark.quote && <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-muted">“{mark.quote}”</span>}
                  </button>
                  <IconButton label={`Excluir marcação da página ${mark.page}`} size="sm" onClick={() => onChange(book.annotations.filter((a) => a.id !== mark.id))}>
                    <Trash2 className="size-3.5 text-muted" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{storageNotice} Na exportação, destaques e desenhos ficam incorporados às páginas e as anotações viram comentários do PDF.</p>
      </div>
    </aside>
  )
}
