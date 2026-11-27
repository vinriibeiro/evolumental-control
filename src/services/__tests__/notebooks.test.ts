import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import { eq } from '@/lib/data/types'
import { plainTextToDoc } from '@/lib/notebooks'
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
  maybeCreateAutoSnapshot,
  moveNode,
  purgeNode,
  purgeNotebook,
  readValidatedImageAsDataUrl,
  reorderNodes,
  restoreNode,
  restoreNotebook,
  restorePageVersion,
  RevisionConflictError,
  savePageContent,
  trashNode,
  trashNotebook,
  unarchiveNotebook,
} from '@/services/notebooks'

let seq = 0
const makeBackend = () => new LocalBackend(`kb-test-${++seq}`)

describe('serviço de cadernos (LocalBackend + Dexie v4)', () => {
  it('cria caderno, hierarquia multinível, reordena, arquiva e envia/restaura da lixeira', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Engenharia de Dados', color: '#B91C1C', cover: 'preset:grid' })
    const sec = await createNode(backend, { notebook_id: nb.id, node_type: 'section', title: 'SQL' })
    const sub = await createNode(backend, { notebook_id: nb.id, parent_id: sec.id, node_type: 'section', title: 'Window Functions' })
    const p1 = await createNode(backend, { notebook_id: nb.id, parent_id: sub.id, node_type: 'page', title: 'RANK' })
    const p2 = await createNode(backend, { notebook_id: nb.id, parent_id: sub.id, node_type: 'page', title: 'DENSE_RANK' })

    await reorderNodes(backend, [p2.id, p1.id])
    const afterReorder = (await backend.list('notebook_nodes', { filters: [eq('parent_id', sub.id)], order: [{ column: 'position' }] })).rows
    expect(afterReorder.map((n) => n.id)).toEqual([p2.id, p1.id])

    await archiveNotebook(backend, nb.id)
    expect((await backend.get('notebooks', nb.id))?.archived_at).toBeTruthy()
    await unarchiveNotebook(backend, nb.id)
    expect((await backend.get('notebooks', nb.id))?.archived_at).toBeNull()

    await trashNotebook(backend, nb.id)
    expect((await backend.get('notebooks', nb.id))?.deleted_at).toBeTruthy()
    await restoreNotebook(backend, nb.id)
    expect((await backend.get('notebooks', nb.id))?.deleted_at).toBeNull()
  })

  it('move subárvore entre seções e entre cadernos impedindo ciclos', async () => {
    const backend = makeBackend()
    const nb1 = await createNotebook(backend, { title: 'Caderno A' })
    const nb2 = await createNotebook(backend, { title: 'Caderno B' })
    const sec = await createNode(backend, { notebook_id: nb1.id, node_type: 'section', title: 'Seção 1' })
    const page = await createNode(backend, { notebook_id: nb1.id, parent_id: sec.id, node_type: 'page', title: 'Página 1' })
    const subpage = await createNode(backend, { notebook_id: nb1.id, parent_id: page.id, node_type: 'page', title: 'Subpágina' })

    // Ciclo direto ou para descendente é bloqueado
    await expect(moveNode(backend, { nodeId: sec.id, targetNotebookId: nb1.id, targetParentId: sec.id })).rejects.toThrow(/ciclo|descendente|mesmo/i)
    await expect(moveNode(backend, { nodeId: sec.id, targetNotebookId: nb1.id, targetParentId: subpage.id })).rejects.toThrow(/descendente/i)

    // Move a seção inteira para o Caderno B
    const moved = await moveNode(backend, { nodeId: sec.id, targetNotebookId: nb2.id, targetParentId: null })
    expect(moved).toBe(3)
    expect((await backend.get('notebook_nodes', sec.id))?.notebook_id).toBe(nb2.id)
    expect((await backend.get('notebook_nodes', page.id))?.notebook_id).toBe(nb2.id)
    expect((await backend.get('notebook_nodes', subpage.id))?.notebook_id).toBe(nb2.id)
  })

  it('duplica seção com subárvore e conteúdos das páginas sem mutar o original', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Python' })
    const sec = await createNode(backend, { notebook_id: nb.id, node_type: 'section', title: 'Pandas' })
    const page = await createNode(backend, {
      notebook_id: nb.id,
      parent_id: sec.id,
      node_type: 'page',
      title: 'GroupBy',
      initialDoc: plainTextToDoc('df.groupby("col").agg("sum")'),
    })

    const all = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    const dup = await duplicateNode(backend, all, sec)
    expect(dup.count).toBe(2)

    const allAfter = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    const dupSec = allAfter.find((n) => n.id === dup.rootId)!
    const dupPage = allAfter.find((n) => n.parent_id === dupSec.id)!
    expect(dupSec.title).toBe('Pandas (cópia)')
    expect(dupPage.title).toBe('GroupBy')
    expect(dupPage.id).not.toBe(page.id)

    const dupContent = await getOrCreatePageContent(backend, dupPage.id)
    expect(dupContent.content_text).toContain('df.groupby')
    expect(dupContent.revision).toBe(1)
  })

  it('lixeira de nó preserva subitens excluídos anteriormente e promove órfãos ao restaurar', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Concursos' })
    const sec = await createNode(backend, { notebook_id: nb.id, node_type: 'section', title: 'Direito' })
    const p1 = await createNode(backend, { notebook_id: nb.id, parent_id: sec.id, node_type: 'page', title: 'P1' })
    const p2 = await createNode(backend, { notebook_id: nb.id, parent_id: sec.id, node_type: 'page', title: 'P2' })

    // Exclui p1 isoladamente primeiro
    let all = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    await trashNode(backend, all, p1.id)
    // Garante carimbo distinto ao excluir a seção
    await new Promise((r) => setTimeout(r, 10))
    all = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    await trashNode(backend, all, sec.id)

    // Restaura apenas p2 enquanto o pai (sec) continua na lixeira -> deve subir para a raiz do caderno
    all = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    await restoreNode(backend, all, p2.id)
    const p2Restored = await backend.get('notebook_nodes', p2.id)
    expect(p2Restored?.deleted_at).toBeNull()
    expect(p2Restored?.parent_id).toBeNull()

    // Restaura sec -> p1 que foi excluído antes continua na lixeira!
    all = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', nb.id)] })).rows
    await restoreNode(backend, all, sec.id)
    expect((await backend.get('notebook_nodes', sec.id))?.deleted_at).toBeNull()
    expect((await backend.get('notebook_nodes', p1.id))?.deleted_at).not.toBeNull()
  })

  it('detecta conflito de edição por revision otimista e nunca sobrescreve silenciosamente', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Notas' })
    const page = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Concorrência' })

    const r2 = await savePageContent(backend, { nodeId: page.id, expectedRevision: 1, contentJson: plainTextToDoc('Versão da aba A') })
    expect(r2.revision).toBe(2)

    // Aba B tenta salvar achando que ainda está na revisão 1
    await expect(
      savePageContent(backend, { nodeId: page.id, expectedRevision: 1, contentJson: plainTextToDoc('Versão desatualizada da aba B') }),
    ).rejects.toBeInstanceOf(RevisionConflictError)

    // Conteúdo da aba A permanece intacto
    expect((await getOrCreatePageContent(backend, page.id)).content_text).toBe('Versão da aba A')

    // Sobrescrita explícita funciona quando confirmada pelo usuário
    const r3 = await savePageContent(backend, {
      nodeId: page.id,
      expectedRevision: 1,
      contentJson: plainTextToDoc('Versão confirmada'),
      forceOverwrite: true,
    })
    expect(r3.revision).toBe(3)
    expect(r3.content_text).toBe('Versão confirmada')
  })

  it('excluir página/caderno permanentemente e resetAllData preservam flashcards e conteúdo autoral', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Memória' })
    const page = await createNode(backend, { notebook_id: nb.id, node_type: 'page', title: 'Origem', initialDoc: plainTextToDoc('Conceito importante') })
    const [deck] = await backend.insert('flashcard_decks', [{ name: 'Baralho Principal' }])
    const [card] = await backend.insert('flashcards', [{ deck_id: deck.id, front: 'Frente', back: 'Verso' }])
    await backend.insert('notebook_flashcard_links', [{ flashcard_id: card.id, notebook_id: nb.id, node_id: page.id, source_excerpt: 'Conceito' }])

    // resetAllData preserva os cadernos e anotações
    await backend.resetAllData()
    expect(await backend.get('notebooks', nb.id)).not.toBeNull()
    expect(await backend.get('notebook_nodes', page.id)).not.toBeNull()

    // Excluir permanentemente a página desvincula o link, mas preserva o flashcard
    await purgeNode(backend, page.id)
    expect(await backend.get('flashcards', card.id)).not.toBeNull()
    const linksAfterPage = (await backend.list('notebook_flashcard_links', { filters: [eq('flashcard_id', card.id)] })).rows
    expect(linksAfterPage[0].node_id).toBeNull()
    expect(linksAfterPage[0].notebook_id).toBe(nb.id)

    // Excluir permanentemente o caderno também preserva o flashcard
    await purgeNotebook(backend, nb.id)
    expect(await backend.get('flashcards', card.id)).not.toBeNull()
    const linksAfterNb = (await backend.list('notebook_flashcard_links', { filters: [eq('flashcard_id', card.id)] })).rows
    expect(linksAfterNb[0].notebook_id).toBeNull()
  })

  it('impõe unicidade case-insensitive em notebook_tags', async () => {
    const backend = makeBackend()
    await backend.insert('notebook_tags', [{ name: 'SQL', color: '#171717' }])
    await expect(backend.insert('notebook_tags', [{ name: '  sql  ', color: '#B91C1C' }])).rejects.toThrow(/unicidade/i)
  })

  it('grava snapshots com throttle, restaura versões com backup prévio e gerencia templates personalizados', async () => {
    const backend = makeBackend()
    const nb = await createNotebook(backend, { title: 'Versões' })
    const page = await createNode(backend, {
      notebook_id: nb.id,
      node_type: 'page',
      title: 'Título v1',
      initialDoc: plainTextToDoc('Conteúdo inicial'),
    })

    const v1 = await createPageVersion(backend, {
      nodeId: page.id,
      title: 'Título v1',
      contentJson: plainTextToDoc('Conteúdo inicial'),
      revision: 1,
      reason: 'manual',
    })
    // Snapshot automático imediato após versão recente é ignorado (não gera versão a cada tecla)
    const skipped = await maybeCreateAutoSnapshot(backend, {
      nodeId: page.id,
      title: 'Título v1',
      contentJson: plainTextToDoc('Alteração rápida'),
      revision: 2,
    })
    expect(skipped).toBeNull()

    await savePageContent(backend, { nodeId: page.id, expectedRevision: 1, contentJson: plainTextToDoc('Conteúdo v2') })
    const restored = await restorePageVersion(backend, { nodeId: page.id, versionId: v1.id, expectedRevision: 2 })
    expect(restored.content_text).toBe('Conteúdo inicial')
    expect(restored.revision).toBe(3)

    // Deve existir o snapshot de backup 'restore' além da versão manual v1
    const versions = await listPageVersions(backend, page.id)
    expect(versions.some((v) => v.reason === 'restore')).toBe(true)

    // Templates personalizados
    const tpl = await createCustomTemplate(backend, { name: 'Meu Modelo', contentJson: plainTextToDoc('Estrutura base') })
    const dup = await duplicateCustomTemplate(backend, tpl)
    expect(dup.name).toBe('Meu Modelo (cópia)')
    await deleteCustomTemplate(backend, tpl.id)
    expect((await backend.list('notebook_templates')).rows).toHaveLength(1)

    // Validação de segurança de imagem (rejeita SVG/HTML)
    const badFile = new File(['<svg onload=alert(1)>'], 'evil.svg', { type: 'image/svg+xml' })
    await expect(readValidatedImageAsDataUrl(badFile)).rejects.toThrow(/não suportado/i)
  })
})
