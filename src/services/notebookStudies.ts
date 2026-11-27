import type { DataBackend } from '@/lib/data/types'
import { eq, inList, isNull } from '@/lib/data/types'
import { EMPTY_DOC, ensureBlockIds, notebookDescendantIds } from '@/lib/notebooks'
import { createNode, getOrCreatePageContent, savePageContent } from '@/services/notebooks'
import type {
  Flashcard,
  NotebookContentNode,
  NotebookFlashcardLink,
  NotebookNode,
  NotebookResourceKind,
  NotebookResourceLink,
  Patch,
} from '@/types/db'

export type FlashcardDraftKind = 'qa' | 'concept' | 'true_false' | 'code' | 'cloze' | 'image_occlusion'

export interface CreateLinkedFlashcardInput {
  deckId?: string | null
  newDeckName?: string | null
  front: string
  back: string
  note?: string | null
  tags?: string[]
  subjectId?: string | null
  topicId?: string | null
  notebookId: string
  nodeId: string
  blockId?: string | null
  sourceExcerpt?: string | null
}

/**
 * Cria um flashcard real na estrutura existente (`flashcard_decks` + `flashcards`, motor SM-2)
 * e registra o vínculo não destrutivo em `notebook_flashcard_links`.
 */
export async function createLinkedFlashcard(
  backend: DataBackend,
  input: CreateLinkedFlashcardInput,
): Promise<{ card: Flashcard; link: NotebookFlashcardLink; deckId: string }> {
  let deckId = input.deckId ?? null
  if (!deckId) {
    const deckName = input.newDeckName?.trim()
    if (!deckName) throw new Error('Selecione um baralho ou informe o nome de um novo baralho.')
    const [deck] = await backend.insert('flashcard_decks', [
      {
        name: deckName.slice(0, 160),
        subject_id: input.subjectId ?? null,
        topic_id: input.topicId ?? null,
      },
    ])
    deckId = deck.id
  }

  const cleanTags = [...new Set((input.tags ?? []).map((t) => t.trim().slice(0, 60)).filter(Boolean))].slice(0, 50)
  const [card] = await backend.insert('flashcards', [
    {
      deck_id: deckId,
      subject_id: input.subjectId ?? null,
      topic_id: input.topicId ?? null,
      front: input.front.trim(),
      back: input.back.trim(),
      note: input.note?.trim() || null,
      tags: cleanTags,
      due_at: new Date().toISOString(),
    },
  ])

  const [link] = await backend.insert('notebook_flashcard_links', [
    {
      flashcard_id: card.id,
      notebook_id: input.notebookId,
      node_id: input.nodeId,
      block_id: input.blockId?.trim() || null,
      source_excerpt: input.sourceExcerpt?.trim().slice(0, 2000) || null,
    },
  ])

  return { card, link, deckId }
}

/**
 * Atualização manual e explícita de um flashcard já criado (editar a anotação nunca altera o cartão silenciosamente).
 */
export async function updateLinkedFlashcardManually(
  backend: DataBackend,
  flashcardId: string,
  patch: Pick<Patch<'flashcards'>, 'front' | 'back' | 'note' | 'tags'>,
): Promise<Flashcard | null> {
  const rows = await backend.update('flashcards', [eq('id', flashcardId)], patch)
  return rows[0] ?? null
}

/** Resolve os IDs de flashcards vinculados a um caderno, seção (com subárvore) ou página específica. */
export async function listLinkedFlashcardIds(
  backend: DataBackend,
  scope: { notebookId?: string | null; sectionId?: string | null; nodeId?: string | null },
): Promise<string[]> {
  if (scope.nodeId) {
    const { rows } = await backend.list('notebook_flashcard_links', { filters: [eq('node_id', scope.nodeId)] })
    return rows.map((r) => r.flashcard_id)
  }
  if (scope.sectionId && scope.notebookId) {
    const nodes = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', scope.notebookId), isNull('deleted_at')] })).rows
    const desc = notebookDescendantIds(nodes, scope.sectionId)
    const ids = [scope.sectionId, ...desc]
    const { rows } = await backend.list('notebook_flashcard_links', { filters: [inList('node_id', ids)] })
    return rows.map((r) => r.flashcard_id)
  }
  if (scope.notebookId) {
    const { rows } = await backend.list('notebook_flashcard_links', { filters: [eq('notebook_id', scope.notebookId)] })
    return rows.map((r) => r.flashcard_id)
  }
  return []
}

export interface AppendExcerptInput {
  nodeId: string
  excerpt: string
  referenceLabel: string
  resourceKind: NotebookResourceKind
  resourceId?: string | null
  url?: string | null
  location?: Record<string, unknown> | null
}

/**
 * Envia um trecho selecionado (ex.: leitor de PDF ou aula de curso) para o final de uma página de caderno,
 * preservando a referência estruturada em `notebook_resource_links`.
 */
export async function appendExcerptToNotebookPage(
  backend: DataBackend,
  input: AppendExcerptInput,
): Promise<{ blockId: string; resourceLink: NotebookResourceLink }> {
  const cleanExcerpt = input.excerpt.trim()
  if (!cleanExcerpt) throw new Error('Informe ou selecione um trecho para enviar ao caderno.')

  const current = await getOrCreatePageContent(backend, input.nodeId)
  const blockId = crypto.randomUUID()
  const locationParts: string[] = [input.referenceLabel.trim()]
  if (input.location && typeof input.location.page === 'number') locationParts.push(`p. ${input.location.page}`)
  if (input.location && typeof input.location.timestamp === 'string' && input.location.timestamp) locationParts.push(input.location.timestamp)

  const quoteNode: NotebookContentNode = {
    type: 'blockquote',
    attrs: { blockId },
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: cleanExcerpt }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `Fonte: ${locationParts.join(' · ')}`, marks: [{ type: 'italic' }] }],
      },
    ],
  }

  const baseContent = current.content_json?.content ?? EMPTY_DOC.content
  const nextDoc = ensureBlockIds({
    type: 'doc',
    content: [...baseContent, quoteNode],
  })

  await savePageContent(backend, {
    nodeId: input.nodeId,
    expectedRevision: current.revision,
    contentJson: nextDoc,
    forceOverwrite: true,
  })

  const [resourceLink] = await backend.insert('notebook_resource_links', [
    {
      node_id: input.nodeId,
      resource_kind: input.resourceKind,
      resource_id: input.resourceId ?? null,
      label: input.referenceLabel.trim().slice(0, 300),
      url: input.url ?? null,
      location: input.location ?? null,
    },
  ])

  return { blockId, resourceLink }
}

/**
 * Localiza uma página de caderno já vinculada a uma aula de curso (via `notebook_resource_links`),
 * sem criar cadernos automaticamente.
 */
export async function findLessonNotebookPage(
  backend: DataBackend,
  lessonNodeId: string,
): Promise<{ notebookId: string; page: NotebookNode } | null> {
  const existingLinks = (
    await backend.list('notebook_resource_links', {
      filters: [eq('resource_kind', 'course_node'), eq('resource_id', lessonNodeId)],
      order: [{ column: 'created_at', ascending: false }],
    })
  ).rows

  for (const link of existingLinks) {
    if (!link.node_id) continue
    const node = await backend.get('notebook_nodes', link.node_id)
    if (node && !node.deleted_at) {
      const nb = await backend.get('notebooks', node.notebook_id)
      if (nb && !nb.deleted_at) return { notebookId: nb.id, page: node }
    }
  }
  return null
}

/**
 * Cria manualmente uma página para a aula dentro de um caderno escolhido explicitamente pelo usuário
 * e registra o vínculo em `notebook_resource_links` (sem criar caderno automático nem duplicar arquivos do Drive).
 */
export async function createLessonNotebookPage(
  backend: DataBackend,
  input: {
    notebookId: string
    lessonNodeId: string
    courseTitle: string
    lessonTitle: string
    subjectId?: string | null
    topicId?: string | null
  },
): Promise<{ notebookId: string; page: NotebookNode }> {
  const nb = await backend.get('notebooks', input.notebookId)
  if (!nb || nb.deleted_at) throw new Error('Escolha um caderno válido para criar a página da aula.')

  const page = await createNode(backend, {
    notebook_id: nb.id,
    node_type: 'page',
    title: input.lessonTitle.trim().slice(0, 300) || 'Anotações da aula',
    subject_id: input.subjectId ?? null,
    topic_id: input.topicId ?? null,
  })

  await backend.insert('notebook_resource_links', [
    {
      node_id: page.id,
      resource_kind: 'course_node',
      resource_id: input.lessonNodeId,
      label: `${input.courseTitle} — ${input.lessonTitle}`.slice(0, 300),
    },
  ])

  return { notebookId: nb.id, page }
}
