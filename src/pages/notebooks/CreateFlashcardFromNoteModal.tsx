import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge, Card, Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useAll } from '@/hooks/data'
import { useNotebookStudyMutations } from '@/hooks/useNotebooks'
import { eq } from '@/lib/data/types'
import {
  encodeImageOcclusionNote,
  extractClozeAnswers,
  hasClozeSyntax,
  parseImageOcclusionNote,
  wrapWithNextCloze,
  type OcclusionRect,
} from '@/lib/flashcardAdvanced'
import { flashcardSchema, validate } from '@/lib/validation'
import type { FlashcardDraftKind } from '@/services/notebookStudies'
import type { Flashcard } from '@/types/db'
import { ImageOcclusionEditor } from './ImageOcclusionEditor'

const KIND_OPTIONS: Array<{ value: FlashcardDraftKind; label: string }> = [
  { value: 'qa', label: 'Pergunta/Resp.' },
  { value: 'concept', label: 'Conceito' },
  { value: 'cloze', label: 'Cloze' },
  { value: 'image_occlusion', label: 'Oclusão imagem' },
  { value: 'true_false', label: 'V ou F' },
  { value: 'code', label: 'Código' },
]

interface Props {
  open: boolean
  onClose: () => void
  notebookId: string
  notebookTitle: string
  nodeId: string
  pageTitle: string
  blockId?: string | null
  selectedText?: string
  pageImages?: Array<{ index: number; src: string; alt: string }>
  defaultSubjectId?: string | null
  defaultTopicId?: string | null
  /** Quando informado, abre em modo de atualização manual confirmada do cartão existente. */
  editingCard?: Flashcard | null
}

const EMPTY_PAGE_IMAGES: NonNullable<Props['pageImages']> = []

export function CreateFlashcardFromNoteModal({
  open,
  onClose,
  notebookId,
  notebookTitle,
  nodeId,
  pageTitle,
  blockId,
  selectedText,
  pageImages = EMPTY_PAGE_IMAGES,
  defaultSubjectId,
  defaultTopicId,
  editingCard,
}: Props) {
  const decksQuery = useAll('flashcard_decks', { filters: [eq('archived', false)], order: [{ column: 'name' }] }, { enabled: open })
  const mut = useNotebookStudyMutations()
  const toast = useToast()
  const frontRef = useRef<HTMLTextAreaElement>(null)

  const [kind, setKind] = useState<FlashcardDraftKind>('qa')
  const [deckId, setDeckId] = useState('')
  const [newDeckName, setNewDeckName] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [note, setNote] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [occSrc, setOccSrc] = useState('')
  const [occPageImageIndex, setOccPageImageIndex] = useState<number | null>(null)
  const [occRects, setOccRects] = useState<OcclusionRect[]>([])
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const decks = useMemo(() => decksQuery.data ?? [], [decksQuery.data])

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (editingCard) {
      const parsedOcc = parseImageOcclusionNote(editingCard.note)
      setKind(parsedOcc.occlusion ? 'image_occlusion' : hasClozeSyntax(editingCard.front) ? 'cloze' : 'qa')
      setDeckId(editingCard.deck_id)
      setNewDeckName('')
      setFront(editingCard.front)
      setBack(editingCard.back)
      setNote(parsedOcc.textNote)
      setOccSrc(parsedOcc.occlusion?.src ?? (parsedOcc.occlusion?.imageIndex != null ? (pageImages[parsedOcc.occlusion.imageIndex]?.src ?? '') : ''))
      setOccPageImageIndex(parsedOcc.occlusion?.imageIndex ?? null)
      setOccRects(parsedOcc.occlusion?.rects ?? [])
      setTagsRaw(editingCard.tags.join(', '))
      setLink({ subjectId: editingCard.subject_id, topicId: editingCard.topic_id })
      return
    }
    const cleanSel = (selectedText ?? '').trim()
    setKind('qa')
    setFront(cleanSel ? (cleanSel.length <= 160 ? cleanSel : '') : '')
    setBack(cleanSel && cleanSel.length > 160 ? cleanSel : '')
    setNote('')
    setOccSrc('')
    setOccPageImageIndex(null)
    setOccRects([])
    setTagsRaw('')
    setNewDeckName('')
    setLink({ subjectId: defaultSubjectId ?? null, topicId: defaultTopicId ?? null })
  }, [open, editingCard, selectedText, defaultSubjectId, defaultTopicId, pageImages])

  useEffect(() => {
    if (!open || editingCard) return
    if (!deckId && decks.length > 0) setDeckId(decks[0].id)
  }, [open, editingCard, decks, deckId])

  const applyKindHelper = (nextKind: FlashcardDraftKind) => {
    setKind(nextKind)
    if (editingCard) return
    if (nextKind === 'true_false' && !back.trim()) {
      setBack('Verdadeiro — justificativa:')
    } else if (nextKind === 'concept' && !front.trim() && selectedText?.trim()) {
      setFront(`Defina: ${selectedText.trim().slice(0, 120)}`)
    } else if (nextKind === 'cloze' && !front.trim() && selectedText?.trim()) {
      setFront(selectedText.trim())
    } else if (nextKind === 'image_occlusion') {
      if (!front.trim()) setFront('Identifique a(s) região(ões) oculta(s) na imagem.')
      if (!occSrc && pageImages.length > 0) {
        setOccSrc(pageImages[0].src)
        setOccPageImageIndex(pageImages[0].index)
      }
    }
  }

  const handleInsertCloze = () => {
    const el = frontRef.current
    const start = el?.selectionStart ?? front.length
    const end = el?.selectionEnd ?? front.length
    const next = wrapWithNextCloze(front, start, end)
    setFront(next)
    const answers = extractClozeAnswers(next)
    if (answers) setBack(answers)
  }

  const tags = tagsRaw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)

  const submit = async () => {
    let finalBack = back
    if (kind === 'cloze' && !finalBack.trim() && hasClozeSyntax(front)) {
      finalBack = extractClozeAnswers(front)
    }

    let finalNote = note
    if (kind === 'image_occlusion') {
      if (!occSrc || occRects.length === 0) {
        setErrors({ front: 'Selecione uma imagem e desenhe ao menos uma caixa de oclusão.' })
        return
      }
      try {
        finalNote = encodeImageOcclusionNote(note, {
          v: 1,
          kind: 'image_occlusion',
          ...(occPageImageIndex != null ? { sourceNodeId: nodeId, imageIndex: occPageImageIndex } : { src: occSrc }),
          rects: occRects,
        })
      } catch (err) {
        setErrors({ front: err instanceof Error ? err.message : 'Erro ao codificar oclusão.' })
        return
      }
    }

    const parsed = validate(flashcardSchema, {
      front,
      back: finalBack,
      note: finalNote,
      tags,
    })
    if (parsed.errors) {
      setErrors(parsed.errors)
      return
    }
    if (!editingCard && !deckId && !newDeckName.trim()) {
      setErrors({ deck: 'Escolha um baralho ou informe o nome de um novo baralho.' })
      return
    }
    setErrors({})
    try {
      if (editingCard) {
        await mut.updateCard.mutateAsync({
          flashcardId: editingCard.id,
          patch: {
            front: parsed.data.front,
            back: parsed.data.back,
            note: parsed.data.note,
            tags: parsed.data.tags,
          },
        })
        toast.success('Flashcard atualizado manualmente.')
      } else {
        await mut.createCard.mutateAsync({
          deckId: deckId === '__new__' ? null : deckId || null,
          newDeckName: deckId === '__new__' || !deckId ? newDeckName.trim() : null,
          front: parsed.data.front,
          back: parsed.data.back,
          note: parsed.data.note,
          tags: parsed.data.tags,
          subjectId: link.subjectId,
          topicId: link.topicId,
          notebookId,
          nodeId,
          blockId: blockId ?? null,
          sourceExcerpt: selectedText?.trim() || null,
        })
        toast.success('Flashcard criado e vinculado à anotação.')
      }
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }

  const busy = mut.createCard.isPending || mut.updateCard.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent
      title={editingCard ? 'Atualizar flashcard vinculado' : 'Criar flashcard da anotação'}
      description={
        editingCard
          ? 'Confirme as alterações manuais neste cartão. Editar a página nunca altera cartões automaticamente.'
          : 'Revise e edite frente e verso antes de salvar no motor SM-2 existente.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} icon={<Layers className="size-4" />} onClick={() => void submit()}>
            {editingCard ? 'Salvar atualização' : 'Salvar flashcard'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Origem */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs">
          <span className="font-semibold text-ink">Origem:</span>
          <Badge>{notebookTitle}</Badge>
          <span className="text-muted">›</span>
          <Badge>{pageTitle}</Badge>
          {blockId && <span className="ml-auto font-mono text-[10px] text-muted">bloco #{blockId.slice(0, 8)}</span>}
        </div>

        {!editingCard && (
          <Segmented label="Formato do cartão" size="sm" value={kind} onChange={applyKindHelper} options={KIND_OPTIONS} />
        )}

        {!editingCard && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Baralho" required error={errors.deck}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={deckId || '__new__'} onChange={(e) => setDeckId(e.target.value)}>
                  {decks.map((dk) => (
                    <option key={dk.id} value={dk.id}>
                      {dk.name}
                    </option>
                  ))}
                  <option value="__new__">+ Criar novo baralho…</option>
                </Select>
              )}
            </Field>

            {(deckId === '__new__' || decks.length === 0) && (
              <Field label="Nome do novo baralho" required>
                {(id) => (
                  <Input
                    id={id}
                    value={newDeckName}
                    maxLength={160}
                    placeholder={`Ex.: ${notebookTitle}`}
                    onChange={(e) => setNewDeckName(e.target.value)}
                  />
                )}
              </Field>
            )}
          </div>
        )}

        {kind === 'image_occlusion' && (
          <ImageOcclusionEditor
            pageImages={pageImages}
            selectedImageSrc={occSrc}
            selectedImageIndex={occPageImageIndex}
            rects={occRects}
            onSelectImage={({ src, pageImageIndex }) => {
              setOccSrc(src)
              setOccPageImageIndex(pageImageIndex)
            }}
            onChangeRects={setOccRects}
            onError={(msg) => toast.error(msg)}
          />
        )}

        <Field
          label={kind === 'cloze' ? 'Texto com lacunas ({{c1::trecho}})' : kind === 'concept' ? 'Frente (conceito)' : 'Frente (pergunta)'}
          hint={kind === 'cloze' ? 'Selecione um trecho abaixo e clique em "Ocultar seleção" para criar uma lacuna Cloze.' : undefined}
          required
          error={errors.front}
        >
          {(id, d) => (
            <div className="space-y-1.5">
              <Textarea
                ref={frontRef}
                id={id}
                aria-describedby={d}
                invalid={Boolean(errors.front)}
                rows={3}
                value={front}
                className={kind === 'code' ? 'font-mono text-xs' : undefined}
                placeholder={
                  kind === 'cloze'
                    ? 'Ex.: A cláusula {{c1::GROUP BY}} agrupa linhas antes de aplicar agregações.'
                    : kind === 'code'
                      ? 'Trecho de código ou pergunta técnica…'
                      : 'Escreva a pergunta ou conceito…'
                }
                onChange={(e) => {
                  const val = e.target.value
                  setFront(val)
                  if (kind === 'cloze' && hasClozeSyntax(val)) {
                    setBack(extractClozeAnswers(val))
                  }
                }}
              />
              {kind === 'cloze' && (
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleInsertCloze}>
                  Ocultar seleção como {'{{c1::…}}'}
                </Button>
              )}
            </div>
          )}
        </Field>

        <Field label={kind === 'concept' ? 'Verso (definição)' : 'Verso (resposta)'} required error={errors.back}>
          {(id, d) => (
            <Textarea
              id={id}
              aria-describedby={d}
              invalid={Boolean(errors.back)}
              rows={3}
              value={back}
              className={kind === 'code' ? 'font-mono text-xs' : undefined}
              placeholder="Escreva a resposta objetiva…"
              onChange={(e) => setBack(e.target.value)}
            />
          )}
        </Field>

        {!editingCard && (
          <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tags (separadas por vírgula)">
            {(id) => <Input id={id} value={tagsRaw} placeholder="SQL, PostgreSQL, Revisar" onChange={(e) => setTagsRaw(e.target.value)} />}
          </Field>
          <Field label="Observações (opcional)">
            {(id) => <Input id={id} value={note} placeholder="Dica, exceção ou exemplo curto…" onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>

        {/* Pré-visualização */}
        {(front.trim() || back.trim()) && (
          <Card className="bg-surface-2/40 p-3.5 text-xs">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted uppercase">Pré-visualização</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-bg p-2.5">
                <p className="mb-1 text-[10px] text-muted uppercase">Frente</p>
                <p className={kind === 'code' ? 'whitespace-pre-wrap font-mono text-ink' : 'whitespace-pre-wrap text-ink'}>{front || '—'}</p>
              </div>
              <div className="rounded-lg border border-line bg-bg p-2.5">
                <p className="mb-1 text-[10px] text-muted uppercase">Verso</p>
                <p className={kind === 'code' ? 'whitespace-pre-wrap font-mono text-ink' : 'whitespace-pre-wrap text-ink'}>{back || '—'}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  )
}
