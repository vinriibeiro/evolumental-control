import { useQuery } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { useAll, useList, useRow, useTransaction } from '@/hooks/data'
import { eq, isNull, notNull } from '@/lib/data/types'
import {
  archiveNotebook,
  createCustomTemplate,
  createNode,
  createNotebook,
  createPageVersion,
  deleteCustomTemplate,
  duplicateCustomTemplate,
  duplicateNode,
  getOrCreatePageContent,
  listPageVersions,
  markPageStudied,
  maybeCreateAutoSnapshot,
  moveNode,
  purgeNode,
  purgeNotebook,
  reorderNodes,
  restoreNode,
  restoreNotebook,
  restorePageVersion,
  savePageContent,
  toggleNotebookFavorite,
  trashNode,
  trashNotebook,
  unarchiveNotebook,
  updateCustomTemplate,
  updateNode,
  updateNotebook,
  type CreateNodeInput,
  type CreateNotebookInput,
} from '@/services/notebooks'
import {
  appendExcerptToNotebookPage,
  createLessonNotebookPage,
  createLinkedFlashcard,
  updateLinkedFlashcardManually,
  type AppendExcerptInput,
  type CreateLinkedFlashcardInput,
} from '@/services/notebookStudies'
import {
  addManualPageLink,
  createNotebookTag,
  deleteNotebookTag,
  removePageLink,
  syncPageInternalLinks,
  toggleEntityTag,
  updateNotebookTag,
} from '@/services/notebookKnowledge'
import type { MoveNotebookNodeInput } from '@/lib/data/types'
import type { Notebook, NotebookContentDoc, NotebookNode, NotebookTemplate, NotebookVersionReason, Patch } from '@/types/db'

export function useNotebooks(opts: { includeDeleted?: boolean } = {}) {
  return useAll('notebooks', {
    filters: opts.includeDeleted ? [] : [isNull('deleted_at')],
    order: [{ column: 'sort_order' }, { column: 'updated_at', ascending: false }],
  })
}

export function useNotebook(notebookId: string | null | undefined) {
  return useRow('notebooks', notebookId)
}

/** Carrega somente os metadados leves da árvore de um caderno (nunca o conteúdo JSON das páginas). */
export function useNotebookNodes(notebookId: string | null | undefined, opts: { includeDeleted?: boolean } = {}) {
  return useAll(
    'notebook_nodes',
    {
      filters: [
        ...(notebookId ? [eq('notebook_id', notebookId)] : []),
        ...(opts.includeDeleted ? [] : [isNull('deleted_at')]),
      ],
      order: [{ column: 'position' }, { column: 'title' }],
    },
    { enabled: Boolean(notebookId) },
  )
}

export function useAllActiveNotebookNodes() {
  return useAll('notebook_nodes', {
    filters: [isNull('deleted_at')],
    order: [{ column: 'updated_at', ascending: false }],
  })
}

export function useTrashedNotebooks() {
  return useAll('notebooks', {
    filters: [notNull('deleted_at')],
    order: [{ column: 'deleted_at', ascending: false }],
  })
}

export function useTrashedNodes() {
  return useAll('notebook_nodes', {
    filters: [notNull('deleted_at')],
    order: [{ column: 'deleted_at', ascending: false }],
  })
}

/** Carrega sob demanda o conteúdo estruturado de uma única página. */
export function usePageContent(nodeId: string | null | undefined) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', ['notebook_page_contents'], 'by-node', backend.kind, nodeId],
    queryFn: () => getOrCreatePageContent(backend, nodeId!),
    enabled: Boolean(nodeId),
  })
}

export function useNotebookFlashcardLinks(notebookId?: string | null) {
  return useAll(
    'notebook_flashcard_links',
    { filters: notebookId ? [eq('notebook_id', notebookId)] : [] },
    { dependsOn: ['flashcards'] },
  )
}

export function useNotebookPageLinks(nodeId?: string | null) {
  return useList(
    'notebook_page_links',
    nodeId ? {} : { limit: 200, order: [{ column: 'created_at', ascending: false }] },
    { dependsOn: ['notebook_nodes'] },
  )
}

export function usePageVersions(nodeId: string | null | undefined) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', ['notebook_page_versions'], 'by-node', backend.kind, nodeId],
    queryFn: () => listPageVersions(backend, nodeId!),
    enabled: Boolean(nodeId),
  })
}

export function useNotebookTemplates() {
  return useAll('notebook_templates', { order: [{ column: 'name' }] })
}

export function useNotebookResourceLinks(nodeId?: string | null) {
  return useAll(
    'notebook_resource_links',
    { filters: nodeId ? [eq('node_id', nodeId)] : [], order: [{ column: 'created_at', ascending: false }] },
    { enabled: nodeId !== null },
  )
}

export function useNotebookTags() {
  return useAll('notebook_tags', { order: [{ column: 'name' }] })
}

export function useNotebookTagLinks() {
  return useAll('notebook_tag_links', {}, { dependsOn: ['notebook_tags'] })
}

export function useAllNotebookPageLinks() {
  return useAll('notebook_page_links', { order: [{ column: 'created_at', ascending: false }] }, { dependsOn: ['notebook_nodes'] })
}

export function useNotebookKnowledgeMutations() {
  const createTag = useTransaction(['notebook_tags'], (b, input: { name: string; color?: string }) => createNotebookTag(b, input))
  const updateTag = useTransaction(['notebook_tags'], (b, args: { id: string; patch: Patch<'notebook_tags'> }) => updateNotebookTag(b, args.id, args.patch))
  const deleteTag = useTransaction(['notebook_tags', 'notebook_tag_links'], (b, id: string) => deleteNotebookTag(b, id))
  const toggleTag = useTransaction(
    ['notebook_tag_links'],
    (b, input: { tagId: string; notebookId?: string | null; nodeId?: string | null }) => toggleEntityTag(b, input),
  )
  const syncLinks = useTransaction(
    ['notebook_page_links'],
    (b, args: { sourceNodeId: string; doc: NotebookContentDoc }) => syncPageInternalLinks(b, args.sourceNodeId, args.doc),
  )
  const addLink = useTransaction(
    ['notebook_page_links'],
    (b, input: { sourceNodeId: string; targetNodeId: string; linkText?: string | null }) => addManualPageLink(b, input),
  )
  const removeLink = useTransaction(['notebook_page_links'], (b, linkId: string) => removePageLink(b, linkId))

  return { createTag, updateTag, deleteTag, toggleTag, syncLinks, addLink, removeLink }
}

export function useNotebookStudyMutations() {
  const createCard = useTransaction(
    ['flashcard_decks', 'flashcards', 'notebook_flashcard_links'],
    (b, input: CreateLinkedFlashcardInput) => createLinkedFlashcard(b, input),
  )
  const updateCard = useTransaction(
    ['flashcards'],
    (b, args: { flashcardId: string; patch: Pick<Patch<'flashcards'>, 'front' | 'back' | 'note' | 'tags'> }) =>
      updateLinkedFlashcardManually(b, args.flashcardId, args.patch),
  )
  const appendExcerpt = useTransaction(
    ['notebook_page_contents', 'notebook_nodes', 'notebook_resource_links'],
    (b, input: AppendExcerptInput) => appendExcerptToNotebookPage(b, input),
  )
  const createLessonPage = useTransaction(
    ['notebook_nodes', 'notebook_page_contents', 'notebook_resource_links'],
    (
      b,
      input: {
        notebookId: string
        lessonNodeId: string
        courseTitle: string
        lessonTitle: string
        subjectId?: string | null
        topicId?: string | null
      },
    ) => createLessonNotebookPage(b, input),
  )

  return { createCard, updateCard, appendExcerpt, createLessonPage }
}

export function useNotebookMutations() {
  const create = useTransaction(['notebooks'], (b, input: CreateNotebookInput) => createNotebook(b, input))
  const update = useTransaction(['notebooks'], (b, args: { id: string; patch: Patch<'notebooks'> }) => updateNotebook(b, args.id, args.patch))
  const toggleFavorite = useTransaction(['notebooks'], (b, nb: Pick<Notebook, 'id' | 'is_favorite'>) => toggleNotebookFavorite(b, nb))
  const archive = useTransaction(['notebooks'], (b, id: string) => archiveNotebook(b, id))
  const unarchive = useTransaction(['notebooks'], (b, id: string) => unarchiveNotebook(b, id))
  const trash = useTransaction(['notebooks'], (b, id: string) => trashNotebook(b, id))
  const restore = useTransaction(['notebooks'], (b, id: string) => restoreNotebook(b, id))
  const purge = useTransaction(
    ['notebooks', 'notebook_nodes', 'notebook_page_contents', 'notebook_page_versions', 'notebook_tag_links', 'notebook_page_links', 'notebook_flashcard_links', 'notebook_resource_links', 'notebook_attachments'],
    (b, id: string) => purgeNotebook(b, id),
  )

  return { create, update, toggleFavorite, archive, unarchive, trash, restore, purge }
}

export function useNotebookNodeMutations() {
  const create = useTransaction(['notebook_nodes', 'notebook_page_contents'], (b, input: CreateNodeInput) => createNode(b, input))
  const update = useTransaction(['notebook_nodes'], (b, args: { id: string; patch: Patch<'notebook_nodes'> }) => updateNode(b, args.id, args.patch))
  const reorder = useTransaction(['notebook_nodes'], (b, orderedIds: string[]) => reorderNodes(b, orderedIds))
  const move = useTransaction(['notebook_nodes'], (b, input: MoveNotebookNodeInput) => moveNode(b, input))
  const duplicate = useTransaction(
    ['notebook_nodes', 'notebook_page_contents'],
    (b, args: { allNodes: NotebookNode[]; node: NotebookNode }) => duplicateNode(b, args.allNodes, args.node),
  )
  const trash = useTransaction(['notebook_nodes'], (b, args: { allNodes: NotebookNode[]; nodeId: string }) => trashNode(b, args.allNodes, args.nodeId))
  const restore = useTransaction(['notebook_nodes'], (b, args: { allNodes: NotebookNode[]; nodeId: string }) => restoreNode(b, args.allNodes, args.nodeId))
  const purge = useTransaction(
    ['notebook_nodes', 'notebook_page_contents', 'notebook_page_versions', 'notebook_tag_links', 'notebook_page_links', 'notebook_flashcard_links', 'notebook_resource_links', 'notebook_attachments'],
    (b, nodeId: string) => purgeNode(b, nodeId),
  )
  const saveContent = useTransaction(
    ['notebook_page_contents', 'notebook_nodes'],
    (b, args: { nodeId: string; expectedRevision: number; contentJson: NotebookContentDoc; forceOverwrite?: boolean }) => savePageContent(b, args),
  )
  const markStudied = useTransaction(['notebook_nodes'], (b, nodeId: string) => markPageStudied(b, nodeId))
  const createVersion = useTransaction(
    ['notebook_page_versions'],
    (b, args: { nodeId: string; title: string; contentJson: NotebookContentDoc; revision: number; reason?: NotebookVersionReason }) =>
      createPageVersion(b, args),
  )
  const autoSnapshot = useTransaction(
    ['notebook_page_versions'],
    (b, args: { nodeId: string; title: string; contentJson: NotebookContentDoc; revision: number }) => maybeCreateAutoSnapshot(b, args),
  )
  const restoreVersion = useTransaction(
    ['notebook_page_contents', 'notebook_page_versions', 'notebook_nodes'],
    (b, args: { nodeId: string; versionId: string; expectedRevision: number }) => restorePageVersion(b, args),
  )

  return { create, update, reorder, move, duplicate, trash, restore, purge, saveContent, markStudied, createVersion, autoSnapshot, restoreVersion }
}

export function useNotebookTemplateMutations() {
  const create = useTransaction(
    ['notebook_templates'],
    (b, input: { name: string; description?: string | null; category?: string | null; contentJson: NotebookContentDoc }) =>
      createCustomTemplate(b, input),
  )
  const update = useTransaction(
    ['notebook_templates'],
    (b, args: { id: string; patch: Patch<'notebook_templates'> }) => updateCustomTemplate(b, args.id, args.patch),
  )
  const duplicate = useTransaction(['notebook_templates'], (b, template: NotebookTemplate) => duplicateCustomTemplate(b, template))
  const remove = useTransaction(['notebook_templates'], (b, id: string) => deleteCustomTemplate(b, id))

  return { create, update, duplicate, remove }
}
