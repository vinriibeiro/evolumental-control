import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { reviewCard } from '@/services/flashcards'
import { createNode, createNotebook, getOrCreatePageContent, savePageContent } from '@/services/notebooks'
import {
  appendExcerptToNotebookPage,
  createLessonNotebookPage,
  createLinkedFlashcard,
  findLessonNotebookPage,
  listLinkedFlashcardIds,
  updateLinkedFlashcardManually,
} from '@/services/notebookStudies'
import { plainTextToDoc } from '@/lib/notebooks'

let seq = 0
const makeBackend = () => new LocalBackend(`kb-studies-${++seq}`)

describe('integração de estudos — flashcards SM-2, revisões, cursos e PDFs', () => {
  it('cria flashcard vinculado a página/bloco, revisa via SM-2 existente e nunca altera o cartão ao editar a anotação', async () => {
    const backend = makeBackend()
    const [subject] = await backend.insert('subjects', [{ name: 'SQL' }])
    const [topic] = await backend.insert('topics', [{ subject_id: subject.id, name: 'Window Functions' }])
    const nb = await createNotebook(backend, { title: 'Caderno SQL', subject_id: subject.id })
    const sec = await createNode(backend, { notebook_id: nb.id, node_type: 'section', title: 'Funções Analíticas' })
    const page = await createNode(backend, {
      notebook_id: nb.id,
      parent_id: sec.id,
      node_type: 'page',
      title: 'RANK vs DENSE_RANK',
      subject_id: subject.id,
      topic_id: topic.id,
    })

    const { card, link } = await createLinkedFlashcard(backend, {
      newDeckName: 'Baralho SQL',
      front: 'Qual a diferença entre RANK() e DENSE_RANK()?',
      back: 'RANK pula posições após empate; DENSE_RANK mantém posições consecutivas.',
      tags: ['SQL', 'Window Functions'],
      subjectId: subject.id,
      topicId: topic.id,
      notebookId: nb.id,
      nodeId: page.id,
      blockId: 'blk-123',
      sourceExcerpt: 'RANK pula posições',
    })

    expect(link.node_id).toBe(page.id)
    expect(link.block_id).toBe('blk-123')

    // Consultas de revisão por página, seção e caderno resolvem o mesmo cartão
    expect(await listLinkedFlashcardIds(backend, { nodeId: page.id })).toEqual([card.id])
    expect(await listLinkedFlashcardIds(backend, { notebookId: nb.id, sectionId: sec.id })).toEqual([card.id])
    expect(await listLinkedFlashcardIds(backend, { notebookId: nb.id })).toEqual([card.id])

    // Revisão SM-2 real e idempotente reutilizando reviewCard + recordFlashcardReview
    const reviewId = crypto.randomUUID()
    expect(await reviewCard(backend, card, 3, undefined, reviewId)).toBe(true)
    expect(await reviewCard(backend, card, 3, undefined, reviewId)).toBe(false)
    const afterReview = await backend.get('flashcards', card.id)
    expect(afterReview?.repetitions).toBe(1)

    // Editar a anotação NÃO altera o flashcard nem conclui o tópico automaticamente
    await savePageContent(backend, { nodeId: page.id, expectedRevision: 1, contentJson: plainTextToDoc('Texto editado na página') })
    expect((await backend.get('flashcards', card.id))?.back).toBe('RANK pula posições após empate; DENSE_RANK mantém posições consecutivas.')
    expect((await backend.get('topics', topic.id))?.status).toBe('not_started')

    // Atualização manual confirmada atualiza o flashcard explicitamente
    await updateLinkedFlashcardManually(backend, card.id, { back: 'Resposta atualizada manualmente pelo usuário.' })
    expect((await backend.get('flashcards', card.id))?.back).toBe('Resposta atualizada manualmente pelo usuário.')
  })

  it('envia trecho de PDF para página existente registrando referência estruturada e vincula aula de curso sem criar caderno automático', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Meu Caderno Manual' })
    const page = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Notas de Leitura' })

    // Enviar trecho de PDF com número da página
    const sent = await appendExcerptToNotebookPage(backend, {
      nodeId: page.id,
      excerpt: 'Índices GIN aceleram consultas de texto completo em PostgreSQL.',
      referenceLabel: 'PostgreSQL Internals.pdf',
      resourceKind: 'library_pdf',
      resourceId: 'pdf-hash-1',
      location: { page: 42 },
    })

    expect(sent.resourceLink.resource_kind).toBe('library_pdf')
    expect(sent.resourceLink.location).toEqual({ page: 42 })
    const updatedContent = await getOrCreatePageContent(backend, page.id)
    expect(updatedContent.content_text).toContain('Índices GIN aceleram consultas')
    expect(updatedContent.content_text).toContain('p. 42')

    // Antes de criar página vinculada à aula, findLessonNotebookPage retorna null (sem criar nada automático)
    expect(await findLessonNotebookPage(backend, 'lesson-node-1')).toBeNull()
    expect((await backend.list('notebooks')).rows).toHaveLength(1)

    // Usuário escolhe explicitamente seu caderno e cria a página da aula
    const created = await createLessonNotebookPage(backend, {
      notebookId: nb.id,
      lessonNodeId: 'lesson-node-1',
      courseTitle: 'Engenharia de Dados',
      lessonTitle: 'Aula 03 — Modelagem Dimensional',
    })
    expect(created.notebookId).toBe(nb.id)
    expect((await backend.list('notebooks')).rows).toHaveLength(1)

    const found = await findLessonNotebookPage(backend, 'lesson-node-1')
    expect(found?.page.id).toBe(created.page.id)

    const links = (await backend.list('notebook_resource_links', { filters: [eq('resource_id', 'lesson-node-1')] })).rows
    expect(links).toHaveLength(1)
  })
})
