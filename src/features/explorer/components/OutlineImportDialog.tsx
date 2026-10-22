import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Combine, FileText, Folder, GripVertical, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { parseOutline } from '@/pages/subjects/topicOps'
import { countNodes, fromOutline, indent, mergeWithPrevious, moveBy, moveTo, outdent, remove, rename, toggleFolder, type DraftNode } from '../outline'
import { createOutline } from '../service'
import { useExplorerOp } from '../useExplorer'

const EXAMPLE = `Banco de Dados
  Modelagem
  SQL
    SELECT
    JOIN
    GROUP BY
  Normalização`

interface Props {
  open: boolean
  onClose: () => void
  subjectId: string
  parentId: string | null
  parentName: string
  nextOrder: number
}

/**
 * Colar edital/ementa como texto → prévia editável → "Criar estrutura".
 * Nada é gravado antes da confirmação.
 */
export function OutlineImportDialog({ open, onClose, subjectId, parentId, parentName, nextOrder }: Props) {
  const [text, setText] = useState('')
  const [tree, setTree] = useState<DraftNode[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const op = useExplorerOp()
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setText('')
      setTree(null)
    }
  }, [open])

  const preview = () => {
    const nodes = parseOutline(text)
    if (!nodes.length) return toast.info('Cole pelo menos uma linha.')
    setTree(fromOutline(nodes))
  }

  const save = async () => {
    if (!tree?.length) return
    setBusy(true)
    try {
      const n = await op((b) => createOutline(b, tree, subjectId, parentId, nextOrder))
      toast.success(`${n} item(ns) criado(s).`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const counts = tree ? countNodes(tree) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      persistent={Boolean(tree)}
      title={tree ? 'Revise a estrutura antes de criar' : `Colar estrutura em "${parentName}"`}
      description={
        tree
          ? `${counts!.total} itens, ${counts!.folders} pasta(s). Edite os nomes, mude níveis, junte, remova ou arraste. Nada foi salvo ainda.`
          : 'Cole o conteúdo do edital, ementa ou sumário. Cada 2 espaços (ou 1 tab) de recuo = 1 nível. Marcadores e numeração são removidos.'
      }
      footer={
        tree ? (
          <>
            <Button onClick={() => setTree(null)}>Voltar ao texto</Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={!tree.length}>
              Criar estrutura
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={preview} disabled={!text.trim()}>
              Ver prévia
            </Button>
          </>
        )
      }
    >
      {!tree ? (
        <Field label="Estrutura em texto">
          {(id) => <Textarea id={id} rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="font-mono text-sm" autoFocus />}
        </Field>
      ) : tree.length === 0 ? (
        <p className="text-sm text-muted">Todos os itens foram removidos. Volte ao texto para recomeçar.</p>
      ) : (
        <ul role="tree" aria-label="Prévia da estrutura" className="scroll-thin max-h-[55vh] overflow-y-auto rounded-lg border border-line">
          <DraftRows
            list={tree}
            depth={0}
            drag={drag}
            onDrag={setDrag}
            onChange={setTree}
            tree={tree}
          />
        </ul>
      )}
    </Modal>
  )
}

function DraftRows({ list, depth, tree, drag, onDrag, onChange }: { list: DraftNode[]; depth: number; tree: DraftNode[]; drag: string | null; onDrag: (id: string | null) => void; onChange: (t: DraftNode[]) => void }) {
  return (
    <>
      {list.map((n, i) => (
        <DraftRow key={n.id} node={n} index={i} depth={depth} tree={tree} drag={drag} onDrag={onDrag} onChange={onChange} />
      ))}
    </>
  )
}

function DraftRow({ node: n, index, depth, tree, drag, onDrag, onChange }: { node: DraftNode; index: number; depth: number; tree: DraftNode[]; drag: string | null; onDrag: (id: string | null) => void; onChange: (t: DraftNode[]) => void }) {
  const [over, setOver] = useState<'before' | 'after' | 'inside' | null>(null)
  return (
    <li role="treeitem" aria-level={depth + 1} aria-label={n.name}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          onDrag(n.id)
        }}
        onDragEnd={() => onDrag(null)}
        onDragOver={(e) => {
          if (!drag || drag === n.id) return
          e.preventDefault()
          const r = e.currentTarget.getBoundingClientRect()
          const y = (e.clientY - r.top) / r.height
          setOver(y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside')
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault()
          if (drag && over) onChange(moveTo(tree, drag, n.id, over))
          setOver(null)
          onDrag(null)
        }}
        className={cn(
          'flex items-center gap-1 border-b border-line py-1 pr-2',
          over === 'inside' && 'bg-accent/25',
          over === 'before' && 'shadow-[inset_0_2px_0_var(--accent-strong)]',
          over === 'after' && 'shadow-[inset_0_-2px_0_var(--accent-strong)]',
          drag === n.id && 'opacity-50',
        )}
        style={{ paddingLeft: 4 + Math.min(depth, 10) * 20 }}
      >
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted" aria-hidden />
        <button
          type="button"
          onClick={() => onChange(toggleFolder(tree, n.id))}
          className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium', n.folder ? 'border-accent-strong bg-accent/25 text-ink' : 'border-line text-muted')}
          aria-pressed={n.folder}
          title={n.folder ? 'É uma pasta (organiza, não conta no progresso). Clique para virar tópico.' : 'É um tópico. Clique para virar pasta.'}
        >
          {n.folder ? <Folder className="size-3.5" /> : <FileText className="size-3.5" />}
          {n.folder ? 'Pasta' : 'Tópico'}
        </button>
        <input
          value={n.name}
          onChange={(e) => onChange(rename(tree, n.id, e.target.value))}
          aria-label="Nome do item"
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink hover:border-line focus:border-accent-strong focus:outline-none"
        />
        <div className="flex shrink-0 items-center">
          <IconButton size="sm" label="Subir um nível" disabled={depth === 0} onClick={() => onChange(outdent(tree, n.id))}>
            <ArrowLeft className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Descer um nível" disabled={index === 0} onClick={() => onChange(indent(tree, n.id))}>
            <ArrowRight className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Mover para cima" disabled={index === 0} onClick={() => onChange(moveBy(tree, n.id, -1))}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Mover para baixo" onClick={() => onChange(moveBy(tree, n.id, 1))}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Juntar com o item anterior" disabled={index === 0} onClick={() => onChange(mergeWithPrevious(tree, n.id))}>
            <Combine className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Remover (os subitens sobem um nível)" onClick={() => onChange(remove(tree, n.id))}>
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
      {n.children.length > 0 && (
        <ul role="group">
          <DraftRows list={n.children} depth={depth + 1} tree={tree} drag={drag} onDrag={onDrag} onChange={onChange} />
        </ul>
      )}
    </li>
  )
}
