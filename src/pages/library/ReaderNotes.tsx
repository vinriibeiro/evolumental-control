import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { BookNote } from '@/services/library'

interface Props {
  notes: BookNote[]
  /** Cores do tema do leitor (o painel acompanha o papel, não o tema do app). */
  colors: { fg: string; bg: string; muted: string }
  line: string
  /** Onde o leitor está agora (capítulo e progresso), para prender a anotação ao trecho. */
  here: { cfi: string; label: string } | null
  onChange: (notes: BookNote[]) => void
  onJump: (cfi: string) => void
}

/** Anotações simples do livro: soltas (do livro todo) ou presas ao trecho aberto. */
export function ReaderNotes({ notes, colors, line, here, onChange, onJump }: Props) {
  const [draft, setDraft] = useState('')
  const [anchored, setAnchored] = useState(true)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const field = { background: 'transparent', borderColor: `${colors.fg}33`, color: colors.fg }
  const small = 'inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium disabled:opacity-40'
  const icon = 'inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-current/10'

  const add = () => {
    const text = draft.trim()
    if (!text) return
    const stamp = new Date().toISOString()
    onChange([...notes, { id: crypto.randomUUID(), text, createdAt: stamp, ...(anchored && here ? { cfi: here.cfi, label: here.label } : {}) }])
    setDraft('')
  }

  const saveEdit = () => {
    if (!editing || !editing.text.trim()) return
    onChange(notes.map((n) => (n.id === editing.id ? { ...n, text: editing.text.trim(), updatedAt: new Date().toISOString() } : n)))
    setEditing(null)
  }

  return (
    <div className="space-y-3 p-3">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <textarea
          aria-label="Nova anotação"
          rows={3}
          maxLength={10000}
          placeholder="Escreva uma anotação…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm leading-relaxed focus:outline-2 focus:outline-current"
          style={field}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={anchored && Boolean(here)} disabled={!here} onChange={(e) => setAnchored(e.target.checked)} style={{ accentColor: colors.fg }} />
            Vincular a este trecho
          </label>
          <button type="submit" className={small} disabled={!draft.trim()} style={{ background: colors.fg, color: colors.bg, borderColor: colors.fg }}>
            Adicionar
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          Nenhuma anotação ainda. Elas podem ser do livro todo ou do trecho em que você está.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3" style={{ borderColor: line }}>
              <div className="flex items-center justify-between gap-1">
                {note.cfi ? (
                  <button type="button" className="min-w-0 truncate text-left text-xs font-semibold underline-offset-2 hover:underline" onClick={() => onJump(note.cfi as string)} aria-label={`Ir para ${note.label || 'o trecho da anotação'}`}>
                    {note.label || 'Trecho do livro'}
                  </button>
                ) : (
                  <span className="text-xs font-semibold" style={{ color: colors.muted }}>
                    Livro todo
                  </span>
                )}
                <span className="flex shrink-0">
                  <button type="button" className={icon} aria-label="Editar anotação" onClick={() => setEditing({ id: note.id, text: note.text })}>
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" className={icon} aria-label="Excluir anotação" onClick={() => onChange(notes.filter((n) => n.id !== note.id))}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </span>
              </div>
              {editing?.id === note.id ? (
                <div className="mt-1 space-y-2">
                  <textarea
                    aria-label="Texto da anotação"
                    rows={4}
                    maxLength={10000}
                    value={editing.text}
                    onChange={(e) => setEditing({ id: note.id, text: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm leading-relaxed focus:outline-2 focus:outline-current"
                    style={field}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" className={small} style={{ borderColor: `${colors.fg}33` }} onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                    <button type="button" className={small} disabled={!editing.text.trim()} style={{ background: colors.fg, color: colors.bg, borderColor: colors.fg }} onClick={saveEdit}>
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">{note.text}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
