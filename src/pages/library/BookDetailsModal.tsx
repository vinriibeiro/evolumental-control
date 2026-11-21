import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import type { BookDetails } from '@/services/library'
import type { ShelfEntry } from './shelf'

interface Props {
  entry: ShelfEntry | null
  /** Assuntos já usados na estante, oferecidos como sugestão. */
  subjects: string[]
  onClose: () => void
  onSave: (entry: ShelfEntry, details: Required<BookDetails>) => Promise<unknown>
}

/** Título, autor e assunto de um livro. O assunto é texto livre: digitar um novo já o cria. */
export function BookDetailsModal({ entry, subjects, onClose, onSave }: Props) {
  const listId = useId()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!entry) return
    setTitle(entry.title)
    setAuthor(entry.author)
    setSubject(entry.subject)
  }, [entry])

  const save = async () => {
    if (!entry || !title.trim()) return
    setSaving(true)
    try {
      await onSave(entry, { title, author, subject })
      onClose()
    } catch {
      // o aviso de erro já foi mostrado; o formulário fica aberto para tentar de novo
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(entry)}
      onClose={onClose}
      title="Detalhes do livro"
      description={entry?.fileName}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} disabled={!title.trim()} onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Título" required>
          {(id) => <Input id={id} value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Autor">{(id) => <Input id={id} value={author} maxLength={500} onChange={(e) => setAuthor(e.target.value)} />}</Field>
        <Field label="Assunto" hint="Texto livre, usado no filtro da estante. Ex.: Estatística, Direito, Romance.">
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} list={listId} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />}
        </Field>
        <datalist id={listId}>
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {/* permite salvar com Enter em qualquer campo */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  )
}
