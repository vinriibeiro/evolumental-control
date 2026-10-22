import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  BookPlus,
  ClipboardPaste,
  Copy,
  ExternalLink,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Landmark,
  Palette,
  PencilLine,
  Play,
  Star,
  StarOff,
  Trash2,
  Repeat,
} from 'lucide-react'
import { ContextMenu, type ContextMenuEntry } from '@/components/ui/ContextMenu'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { useSafeDelete } from '@/components/useSafeDelete'
import { eq } from '@/lib/data/types'
import { SubjectForm } from '@/pages/subjects/SubjectForm'
import { TopicForm } from '@/pages/subjects/TopicForm'
import { nextOrder, type ExplorerIndex, type ExplorerNode, type NodeKey } from '../model'
import { countWithin, duplicateNode, renameNode, setArchived, setFavorite } from '../service'
import { hrefFor, useExplorerOp } from '../useExplorer'
import { FolderForm } from './FolderForm'
import { MoveDialog } from './MoveDialog'
import { OutlineImportDialog } from './OutlineImportDialog'

type CreateKind = 'area' | 'folder' | 'subject' | 'topic' | 'topic-folder'

interface Ctx {
  index: ExplorerIndex
  selected: Set<NodeKey>
  setSelected: (s: Set<NodeKey>) => void
  renaming: NodeKey | null
  setRenaming: (k: NodeKey | null) => void
  openMenu: (node: ExplorerNode | null, x: number, y: number) => void
  create: (kind: CreateKind, parent: ExplorerNode | null) => void
  edit: (node: ExplorerNode) => void
  move: (nodes: ExplorerNode[]) => void
  remove: (nodes: ExplorerNode[]) => Promise<void>
  favorite: (nodes: ExplorerNode[], on: boolean) => Promise<void>
  archive: (nodes: ExplorerNode[], on: boolean) => Promise<void>
  rename: (node: ExplorerNode, name: string) => Promise<void>
  importOutline: (parent: ExplorerNode) => void
  studyHref: (node: ExplorerNode) => string | null
}

const ActionsContext = createContext<Ctx | null>(null)

export function useExplorerActions() {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useExplorerActions fora do ExplorerActionsProvider')
  return ctx
}

export function ExplorerActionsProvider({ index, children }: { index: ExplorerIndex; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<NodeKey>>(new Set())
  const [renaming, setRenaming] = useState<NodeKey | null>(null)
  const [menu, setMenu] = useState<{ node: ExplorerNode | null; x: number; y: number } | null>(null)
  const [creating, setCreating] = useState<{ kind: CreateKind; parent: ExplorerNode | null } | null>(null)
  const [editing, setEditing] = useState<ExplorerNode | null>(null)
  const [moving, setMoving] = useState<ExplorerNode[]>([])
  const [importing, setImporting] = useState<ExplorerNode | null>(null)
  const op = useExplorerOp()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const deleteFolder = useSafeDelete('study_folders')
  const deleteSubject = useSafeDelete('subjects')
  const deleteTopic = useSafeDelete('topics')

  const run = useCallback(
    async (fn: Parameters<typeof op>[0], ok?: string) => {
      try {
        await op(fn)
        if (ok) toast.success(ok)
      } catch (e) {
        toast.error(e)
      }
    },
    [op, toast],
  )

  const studyHref = (n: ExplorerNode) =>
    n.type === 'subject' ? `/cronometro?materia=${n.id}` : n.type === 'topic' ? `/cronometro?materia=${n.topic!.subject_id}&topico=${n.id}` : null

  const remove = async (nodes: ExplorerNode[]) => {
    if (nodes.length === 1) {
      const n = nodes[0]
      const done = () => setSelected(new Set())
      if (n.type === 'folder')
        await deleteFolder(n.id, n.name, { extra: 'As matérias desta pasta (e das subpastas) voltam para a raiz com todo o histórico. Só a organização é apagada.', onDone: done })
      else if (n.type === 'subject') await deleteSubject(n.id, n.name, { extra: 'Dica: arquivar oculta a matéria e preserva todos os vínculos.', onDone: done })
      else await deleteTopic(n.id, n.name, { onDone: done })
      return
    }
    const ok = await confirm({
      title: `Excluir ${nodes.length} itens?`,
      danger: true,
      confirmLabel: 'Excluir definitivamente',
      message: `Serão afetados ${countWithin(nodes)} itens (com o que está dentro deles). Sessões, questões e cartões vinculados continuam nos relatórios, sem vínculo. Matérias dentro de pastas excluídas voltam para a raiz.`,
    })
    if (!ok) return
    await run(async (b) => {
      for (const n of nodes) {
        const table = n.type === 'folder' ? 'study_folders' : n.type === 'subject' ? 'subjects' : 'topics'
        // Um item pode já ter saído junto com o pai: excluir de novo é inofensivo.
        await b.remove(table, [eq('id', n.id)])
      }
    }, 'Itens excluídos.')
    setSelected(new Set())
  }

  const favorite = (nodes: ExplorerNode[], on: boolean) => run((b) => setFavorite(b, nodes, on), on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.')
  const archive = (nodes: ExplorerNode[], on: boolean) =>
    run((b) => setArchived(b, nodes, on), on ? 'Arquivado (o histórico foi mantido).' : 'Reativado.')
  const rename = (node: ExplorerNode, name: string) => run((b) => renameNode(b, node, name))
  const duplicate = (node: ExplorerNode) =>
    run(async (b) => {
      const n = await duplicateNode(b, node)
      toast.success(`${n} item(ns) duplicado(s).`)
    })
  const convertTopic = (node: ExplorerNode) =>
    run((b) => b.update('topics', [eq('id', node.id)], { kind: node.container ? 'topic' : 'folder' }), node.container ? 'Agora é um tópico.' : 'Agora é uma pasta (não conta no progresso).')

  const itemsFor = (n: ExplorerNode | null): ContextMenuEntry[] => {
    const targets = n && selected.has(n.key) && selected.size > 1 ? [...selected].map((k) => index.byKey.get(k)!).filter(Boolean) : n ? [n] : []
    if (targets.length > 1) {
      const allFav = targets.every((t) => t.favorite)
      return [
        { label: `Mover ${targets.length} itens…`, icon: <FolderInput className="size-4" />, onSelect: () => setMoving(targets) },
        { label: allFav ? 'Remover dos favoritos' : 'Favoritar', icon: allFav ? <StarOff className="size-4" /> : <Star className="size-4" />, onSelect: () => void favorite(targets, !allFav) },
        { label: 'Arquivar', icon: <Archive className="size-4" />, onSelect: () => void archive(targets, true), disabled: targets.every((t) => t.type === 'topic') },
        'separator',
        { label: `Excluir ${targets.length} itens`, icon: <Trash2 className="size-4" />, danger: true, onSelect: () => void remove(targets) },
      ]
    }
    if (!n)
      return [
        { label: 'Nova área de estudo', icon: <Landmark className="size-4" />, onSelect: () => setCreating({ kind: 'area', parent: null }) },
        { label: 'Nova pasta', icon: <FolderPlus className="size-4" />, onSelect: () => setCreating({ kind: 'folder', parent: null }) },
        { label: 'Nova matéria', icon: <BookPlus className="size-4" />, onSelect: () => setCreating({ kind: 'subject', parent: null }) },
      ]
    const common: ContextMenuEntry[] = [
      { label: 'Renomear', icon: <PencilLine className="size-4" />, hint: 'F2', onSelect: () => setRenaming(n.key) },
      { label: n.type === 'topic' ? 'Editar detalhes' : 'Editar (cor, ícone, metas)', icon: <Palette className="size-4" />, onSelect: () => setEditing(n) },
      { label: 'Duplicar', icon: <Copy className="size-4" />, onSelect: () => void duplicate(n) },
      { label: 'Mover para…', icon: <FolderInput className="size-4" />, onSelect: () => setMoving([n]) },
      n.favorite
        ? { label: 'Remover dos favoritos', icon: <StarOff className="size-4" />, onSelect: () => void favorite([n], false) }
        : { label: 'Favoritar', icon: <Star className="size-4" />, onSelect: () => void favorite([n], true) },
    ]
    const danger: ContextMenuEntry[] = ['separator', { label: 'Excluir', icon: <Trash2 className="size-4" />, hint: 'Del', danger: true, onSelect: () => void remove([n]) }]
    const archiveItem: ContextMenuEntry = n.archived
      ? { label: 'Reativar', icon: <ArchiveRestore className="size-4" />, onSelect: () => void archive([n], false) }
      : { label: 'Arquivar', icon: <Archive className="size-4" />, onSelect: () => void archive([n], true) }
    const open: ContextMenuEntry = { label: 'Abrir', icon: <ExternalLink className="size-4" />, onSelect: () => navigate(hrefFor(n.type, n.id, n.topic?.subject_id)) }
    const study = studyHref(n)
    const studyItem: ContextMenuEntry[] = study ? [{ label: 'Estudar agora', icon: <Play className="size-4" />, onSelect: () => navigate(study), disabled: n.archived }] : []

    if (n.type === 'folder')
      return [
        open,
        'separator',
        { label: 'Nova subpasta', icon: <FolderPlus className="size-4" />, onSelect: () => setCreating({ kind: 'folder', parent: n }) },
        { label: 'Nova matéria aqui', icon: <BookPlus className="size-4" />, onSelect: () => setCreating({ kind: 'subject', parent: n }) },
        'separator',
        ...common,
        archiveItem,
        ...danger,
      ]
    if (n.type === 'subject')
      return [
        open,
        ...studyItem,
        'separator',
        { label: 'Novo tópico', icon: <FilePlus2 className="size-4" />, onSelect: () => setCreating({ kind: 'topic', parent: n }) },
        { label: 'Nova pasta na matéria', icon: <FolderPlus className="size-4" />, onSelect: () => setCreating({ kind: 'topic-folder', parent: n }) },
        { label: 'Colar estrutura (edital)', icon: <ClipboardPaste className="size-4" />, onSelect: () => setImporting(n) },
        'separator',
        ...common,
        archiveItem,
        ...danger,
      ]
    return [
      open,
      ...studyItem,
      'separator',
      { label: n.container ? 'Novo tópico aqui' : 'Novo subtópico', icon: <FilePlus2 className="size-4" />, onSelect: () => setCreating({ kind: 'topic', parent: n }) },
      { label: 'Nova subpasta', icon: <FolderPlus className="size-4" />, onSelect: () => setCreating({ kind: 'topic-folder', parent: n }) },
      { label: 'Colar subtópicos', icon: <ClipboardPaste className="size-4" />, onSelect: () => setImporting(n) },
      'separator',
      ...common,
      { label: n.container ? 'Transformar em tópico' : 'Transformar em pasta', icon: <Repeat className="size-4" />, onSelect: () => void convertTopic(n) },
      ...danger,
    ]
  }

  const value: Ctx = {
    index,
    selected,
    setSelected,
    renaming,
    setRenaming,
    openMenu: (node, x, y) => setMenu({ node, x, y }),
    create: (kind, parent) => setCreating({ kind, parent }),
    edit: setEditing,
    move: setMoving,
    remove,
    favorite,
    archive,
    rename,
    importOutline: setImporting,
    studyHref,
  }

  // Formulários de criação: pai e ordem calculados a partir do nó de destino.
  const c = creating
  const parentFolder = c?.parent?.type === 'folder' ? c.parent.folder! : null
  const subjectId = c?.parent ? (c.parent.type === 'subject' ? c.parent.id : (c.parent.topic?.subject_id ?? '')) : ''
  const parentTopic = c?.parent?.type === 'topic' ? c.parent.topic! : null
  const order = c ? nextOrder(c.parent, index.roots, c.kind === 'area' || c.kind === 'folder' ? 'folder' : c.kind === 'subject' ? 'subject' : 'topic') : 0
  const imp = importing

  return (
    <ActionsContext.Provider value={value}>
      {children}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={itemsFor(menu.node)} label={menu.node ? `Ações de ${menu.node.name}` : 'Criar'} onClose={() => setMenu(null)} />}

      <FolderForm
        open={c?.kind === 'area' || c?.kind === 'folder' || editing?.type === 'folder'}
        onClose={() => (setCreating(null), setEditing(null))}
        folder={editing?.type === 'folder' ? editing.folder : null}
        parent={c?.kind === 'folder' ? parentFolder : null}
        nextOrder={order}
      />
      <SubjectForm
        open={c?.kind === 'subject' || editing?.type === 'subject'}
        onClose={() => (setCreating(null), setEditing(null))}
        subject={editing?.type === 'subject' ? editing.subject : null}
        folderId={parentFolder?.id ?? null}
        nextOrder={order}
      />
      <TopicForm
        open={c?.kind === 'topic' || c?.kind === 'topic-folder' || editing?.type === 'topic'}
        onClose={() => (setCreating(null), setEditing(null))}
        subjectId={editing?.type === 'topic' ? editing.topic!.subject_id : subjectId}
        parent={parentTopic}
        topic={editing?.type === 'topic' ? editing.topic : null}
        kind={c?.kind === 'topic-folder' ? 'folder' : 'topic'}
        nextOrder={order}
      />
      {moving.length > 0 && <MoveDialog nodes={moving} index={index} onClose={() => setMoving([])} />}
      <OutlineImportDialog
        open={Boolean(imp)}
        onClose={() => setImporting(null)}
        subjectId={imp ? (imp.type === 'subject' ? imp.id : imp.topic!.subject_id) : ''}
        parentId={imp?.type === 'topic' ? imp.id : null}
        parentName={imp?.name ?? ''}
        nextOrder={imp ? nextOrder(imp, index.roots, 'topic') : 0}
      />
    </ActionsContext.Provider>
  )
}
