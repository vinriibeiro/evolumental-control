import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { canDrop, flatten, type ExplorerIndex, type ExplorerNode, type NodeKey } from '../model'
import { loadIndex, moveNode } from '../service'
import { useExplorerOp } from '../useExplorer'
import { NodeIcon } from './NodeIcon'

const ROOT = 'root' as const

/** "Mover para…": lista só os destinos válidos para todos os itens escolhidos. */
export function MoveDialog({ nodes, index, onClose }: { nodes: ExplorerNode[]; index: ExplorerIndex; onClose: () => void }) {
  const [term, setTerm] = useState('')
  const [target, setTarget] = useState<NodeKey | typeof ROOT | null>(null)
  const [busy, setBusy] = useState(false)
  const op = useExplorerOp()
  const toast = useToast()

  const options = useMemo(() => {
    const t = term.trim().toLowerCase()
    const valid = flatten(index.roots, () => true).filter(
      (n) => n.container || n.type === 'topic' ? nodes.every((src) => canDrop(index, src, n, 'inside').ok) : false,
    )
    return t ? valid.filter((n) => n.name.toLowerCase().includes(t)) : valid
  }, [index, nodes, term])
  const rootOk = nodes.every((src) => canDrop(index, src, null, 'inside').ok)

  const submit = async () => {
    if (!target) return
    setBusy(true)
    try {
      await op(async (b) => {
        let ix = index
        for (const n of nodes) {
          await moveNode(b, ix, ix.byKey.get(n.key)!, target === ROOT ? null : ix.byKey.get(target)!, 'inside')
          // Reindexa a cada passo: a ordem dos irmãos muda a cada item movido.
          ix = await loadIndex(b)
        }
      })
      toast.success(nodes.length > 1 ? `${nodes.length} itens movidos.` : 'Item movido.')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={nodes.length > 0}
      onClose={onClose}
      size="lg"
      title={nodes.length === 1 ? `Mover "${nodes[0].name}"` : `Mover ${nodes.length} itens`}
      description="Escolha o destino. Só aparecem destinos permitidos (tópicos ficam em matérias; matérias e pastas, em pastas ou na raiz)."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!target} loading={busy} onClick={submit}>
            Mover para cá
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filtrar destinos" aria-label="Filtrar destinos" className="pl-9" autoFocus />
      </div>
      <ul role="listbox" aria-label="Destinos" className="scroll-thin max-h-[50vh] overflow-y-auto rounded-lg border border-line">
        {rootOk && !term && (
          <Option selected={target === ROOT} onSelect={() => setTarget(ROOT)} depth={0}>
            <span className="font-medium">Raiz (fora de qualquer pasta)</span>
          </Option>
        )}
        {options.map((n) => (
          <Option key={n.key} selected={target === n.key} onSelect={() => setTarget(n.key)} depth={term ? 0 : n.depth + (rootOk ? 1 : 0)}>
            <NodeIcon node={n} className="size-4" />
            <span className="truncate">{n.name}</span>
          </Option>
        ))}
        {options.length === 0 && !rootOk && <li className="p-4 text-sm text-muted">Nenhum destino disponível.</li>}
      </ul>
    </Modal>
  )
}

function Option({ selected, onSelect, depth, children }: { selected: boolean; onSelect: () => void; depth: number; children: React.ReactNode }) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cn('flex w-full items-center gap-2 border-b border-line py-2 pr-3 text-left text-sm last:border-b-0', selected ? 'bg-accent/35 text-ink' : 'text-ink hover:bg-surface')}
        style={{ paddingLeft: 12 + Math.min(depth, 10) * 16 }}
      >
        {children}
      </button>
    </li>
  )
}
