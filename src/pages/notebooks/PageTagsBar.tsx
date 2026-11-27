import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus, Tag, X } from 'lucide-react'
import { ColorDot } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { useNotebookKnowledgeMutations, useNotebookTagLinks, useNotebookTags } from '@/hooks/useNotebooks'
import { cn } from '@/lib/cn'

interface PageTagsBarProps {
  notebookId?: string | null
  nodeId?: string | null
  readOnly?: boolean
}

export function PageTagsBar({ notebookId, nodeId, readOnly = false }: PageTagsBarProps) {
  const tagsQuery = useNotebookTags()
  const linksQuery = useNotebookTagLinks()
  const mut = useNotebookKnowledgeMutations()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const allTags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const tagById = useMemo(() => new Map(allTags.map((t) => [t.id, t])), [allTags])

  const linkedTagIds = useMemo(() => {
    const out = new Set<string>()
    for (const l of linksQuery.data ?? []) {
      if (nodeId && l.node_id === nodeId) out.add(l.tag_id)
      else if (!nodeId && notebookId && l.notebook_id === notebookId) out.add(l.tag_id)
    }
    return out
  }, [linksQuery.data, nodeId, notebookId])

  const activeTags = useMemo(
    () => [...linkedTagIds].map((id) => tagById.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [linkedTagIds, tagById],
  )

  const toggle = (tagId: string) => {
    mut.toggleTag.mutate({ tagId, notebookId: nodeId ? null : notebookId, nodeId }, { onError: toast.error })
  }

  const createAndAttach = async () => {
    const clean = newName.trim()
    if (!clean) return
    const existing = allTags.find((t) => t.name.trim().toLowerCase() === clean.toLowerCase())
    try {
      const target = existing ?? (await mut.createTag.mutateAsync({ name: clean, color: '#525252' }))
      if (!linkedTagIds.has(target.id)) {
        await mut.toggleTag.mutateAsync({ tagId: target.id, notebookId: nodeId ? null : notebookId, nodeId })
      }
      setNewName('')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5 text-xs">
      <Tag className="size-3.5 text-muted" aria-hidden />
      {activeTags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink"
        >
          <ColorDot color={t.color} className="size-2" />
          <Link to={`/cadernos?tag=${t.id}`} className="hover:text-accent">
            #{t.name}
          </Link>
          {!readOnly && (
            <button
              type="button"
              aria-label={`Remover tag ${t.name}`}
              onClick={() => toggle(t.id)}
              className="ml-0.5 text-muted hover:text-danger"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-line px-2 text-[11px] text-muted hover:border-ink/40 hover:text-ink"
          >
            <Plus className="size-3" /> Tag
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
              <div className="animate-fade-in absolute left-0 z-30 mt-1.5 w-60 rounded-xl border border-line bg-bg p-2 shadow-xl">
                <div className="mb-2 flex gap-1">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void createAndAttach()
                      } else if (e.key === 'Escape') {
                        setOpen(false)
                      }
                    }}
                    placeholder="Criar ou buscar tag…"
                    aria-label="Nova tag"
                    maxLength={60}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-ink outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    disabled={!newName.trim()}
                    onClick={() => void createAndAttach()}
                    className="h-7 rounded-md bg-ink px-2 text-[11px] font-medium text-bg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <ul className="scroll-thin max-h-44 space-y-0.5 overflow-y-auto">
                  {allTags
                    .filter((t) => !newName.trim() || t.name.toLowerCase().includes(newName.trim().toLowerCase()))
                    .map((t) => {
                      const active = linkedTagIds.has(t.id)
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => toggle(t.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2',
                              active && 'bg-surface-2 font-medium text-ink',
                            )}
                          >
                            <ColorDot color={t.color} className="size-2" />
                            <span className="min-w-0 flex-1 truncate">#{t.name}</span>
                            {active && <Check className="size-3.5 text-accent" />}
                          </button>
                        </li>
                      )
                    })}
                  {allTags.length === 0 && <li className="px-2 py-2 text-[11px] text-muted">Digite um nome acima e pressione Enter.</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
