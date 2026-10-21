import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useAll, useInsert, useUpdate } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { flashcardSchema, validate } from '@/lib/validation'
import type { Flashcard } from '@/types/db'

interface Props {
  open: boolean
  onClose: () => void
  card?: Flashcard | null
  defaults?: { deckId?: string | null; subjectId?: string | null; topicId?: string | null }
}

export function parseTags(s: string): string[] {
  return [...new Set(s.split(/[,;]/).map((t) => t.trim()).filter(Boolean))].slice(0, 50)
}

/** Criação rápida/edição de cartão. Ctrl+Enter salva e abre o próximo. */
export function CardForm({ open, onClose, card, defaults }: Props) {
  const decks = useAll('flashcard_decks', { filters: [eq('archived', false)], order: [{ column: 'name' }] })
  const [deckId, setDeckId] = useState('')
  const [newDeck, setNewDeck] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState(0)
  const insert = useInsert('flashcards')
  const insertDeck = useInsert('flashcard_decks')
  const update = useUpdate('flashcards')
  const toast = useToast()
  const frontRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setDeckId(card?.deck_id ?? defaults?.deckId ?? '')
    setNewDeck('')
    setFront(card?.front ?? '')
    setBack(card?.back ?? '')
    setNote(card?.note ?? '')
    setTags(card?.tags.join(', ') ?? '')
    setLink({ subjectId: card?.subject_id ?? defaults?.subjectId ?? null, topicId: card?.topic_id ?? defaults?.topicId ?? null })
    setErrors({})
    setCreated(0)
  }, [open, card, defaults?.deckId, defaults?.subjectId, defaults?.topicId])

  // Sem baralho escolhido: sugere o primeiro do assunto, se houver.
  useEffect(() => {
    if (open && !deckId && !card && decks.data?.length) {
      const match = decks.data.find((d) => d.topic_id && d.topic_id === link.topicId) ?? decks.data.find((d) => d.subject_id && d.subject_id === link.subjectId)
      if (match) setDeckId(match.id)
    }
  }, [open, deckId, card, decks.data, link.subjectId, link.topicId])

  const submit = async (again: boolean) => {
    const r = validate(flashcardSchema, { front, back, note, tags: parseTags(tags) })
    const errs = { ...(r.errors ?? {}) }
    if (!deckId && !newDeck.trim()) errs.deck = 'Escolha um baralho ou informe o nome de um novo.'
    if (!r.data || Object.keys(errs).length) return setErrors(errs)
    try {
      let target = deckId
      if (!target) {
        const [d] = await insertDeck.mutateAsync({ name: newDeck.trim().slice(0, 160), subject_id: link.subjectId, topic_id: link.topicId })
        target = d.id
        setDeckId(d.id)
        setNewDeck('')
      }
      const data = { ...r.data, deck_id: target, subject_id: link.subjectId, topic_id: link.topicId }
      if (card) {
        await update.mutateAsync({ id: card.id, patch: data })
        toast.success('Cartão atualizado.')
        onClose()
        return
      }
      await insert.mutateAsync({ ...data, due_at: new Date().toISOString() })
      setCreated((n) => n + 1)
      if (again) {
        setFront('')
        setBack('')
        setNote('')
        setErrors({})
        frontRef.current?.focus()
      } else {
        toast.success('Cartão criado.')
        onClose()
      }
    } catch (e) {
      toast.error(e)
    }
  }

  const busy = insert.isPending || update.isPending || insertDeck.isPending
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent
      title={card ? 'Editar cartão' : 'Novo flashcard'}
      description={!card && created > 0 ? `${created} cartão(ões) criado(s) nesta janela.` : 'Dica: Ctrl+Enter salva e já abre o próximo.'}
      footer={
        <>
          <Button onClick={onClose}>Fechar</Button>
          {!card && (
            <Button onClick={() => submit(true)} loading={busy}>
              Salvar e próximo
            </Button>
          )}
          <Button variant="primary" onClick={() => submit(false)} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div
        className="grid gap-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void submit(!card)
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Baralho" required error={errors.deck}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={deckId} invalid={Boolean(errors.deck)} onChange={(e) => setDeckId(e.target.value)}>
                <option value="">{decks.isPending ? 'Carregando…' : '+ Criar novo baralho'}</option>
                {(decks.data ?? []).map((dk) => (
                  <option key={dk.id} value={dk.id}>
                    {dk.folder ? `${dk.folder} / ` : ''}
                    {dk.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!deckId && (
            <Field label="Nome do novo baralho">
              {(id) => <Input id={id} value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder="Ex.: Constitucional — Direitos fundamentais" />}
            </Field>
          )}
        </div>
        <Field label="Frente (pergunta)" required error={errors.front}>
          {(id, d) => <Textarea ref={frontRef} id={id} aria-describedby={d} autoFocus rows={3} value={front} invalid={Boolean(errors.front)} onChange={(e) => setFront(e.target.value)} />}
        </Field>
        <Field label="Verso (resposta)" required error={errors.back}>
          {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={back} invalid={Boolean(errors.back)} onChange={(e) => setBack(e.target.value)} />}
        </Field>
        <Field label="Explicação / observação (opcional)">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <Field label="Tags" hint="Separe por vírgula.">{(id, d) => <Input id={id} aria-describedby={d} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="art5, garantias" />}</Field>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
      </div>
    </Modal>
  )
}
