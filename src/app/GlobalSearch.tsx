import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, BookText, FileText, GraduationCap, Layers, ListTree, Search, StickyNote, Tag } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useBackend } from './data'
import { NAV } from './nav'
import { useDebounced } from '@/hooks/useDebounced'
import { eq, inList, isNull } from '@/lib/data/types'

interface Hit {
  id: string
  kind: 'Página' | 'Caderno' | 'Anotação' | 'Tag' | 'Curso' | 'Matéria' | 'Tópico' | 'Baralho' | 'Flashcard'
  label: string
  sub?: string
  to: string
}

const ICONS = { Página: Search, Caderno: BookText, Anotação: FileText, Tag, Curso: GraduationCap, Matéria: BookOpen, Tópico: ListTree, Baralho: Layers, Flashcard: StickyNote }

/** Pesquisa global (Ctrl+K) em todos os níveis: cursos do Drive, matérias, tópicos, baralhos e flashcards. */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebounced(term.trim(), 200)
  const backend = useBackend()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setTerm('')
      setActive(0)
    }
  }, [open])

  const results = useQuery({
    queryKey: [
      'data',
      ['notebooks', 'notebook_nodes', 'notebook_page_contents', 'notebook_tags', 'course_nodes', 'subjects', 'topics', 'flashcard_decks', 'flashcards'],
      'search',
      backend.kind,
      debounced,
    ],
    enabled: open && debounced.length >= 2,
    queryFn: async (): Promise<Hit[]> => {
      const q = (columns: string[]) => ({ search: { columns, term: debounced }, limit: 8 })
      const [notebooks, kbNodes, kbContents, kbTags, courses, subjects, topics, decks, cards] = await Promise.all([
        backend.list('notebooks', { ...q(['title', 'description']), filters: [isNull('deleted_at')] }).catch(() => ({ rows: [], count: 0 })),
        backend.list('notebook_nodes', { ...q(['title']), filters: [isNull('deleted_at')] }).catch(() => ({ rows: [], count: 0 })),
        backend.list('notebook_page_contents', q(['content_text'])).catch(() => ({ rows: [], count: 0 })),
        backend.list('notebook_tags', q(['name'])).catch(() => ({ rows: [], count: 0 })),
        backend.list('course_nodes', { ...q(['title', 'custom_title']), filters: [eq('kind', 'course'), eq('hidden', false)] }).catch(() => ({ rows: [], count: 0 })),
        backend.list('subjects', q(['name', 'description', 'exam'])),
        backend.list('topics', q(['name', 'description', 'notes'])),
        backend.list('flashcard_decks', q(['name', 'description'])),
        backend.list('flashcards', q(['front', 'back'])),
      ])

      // Resolve metadados leves apenas das páginas encontradas por busca de conteúdo/código
      const seenNodeIds = new Set(kbNodes.rows.map((n) => n.id))
      const extraNodeIds = kbContents.rows.map((c) => c.node_id).filter((id) => !seenNodeIds.has(id))
      const extraNodes =
        extraNodeIds.length > 0
          ? (await backend.list('notebook_nodes', { filters: [inList('id', extraNodeIds), isNull('deleted_at')] }).catch(() => ({ rows: [] }))).rows
          : []
      const nodeById = new Map([...kbNodes.rows, ...extraNodes].map((n) => [n.id, n]))
      const contentHits: Hit[] = []
      const emittedNodes = new Set<string>()
      for (const c of kbContents.rows) {
        const node = nodeById.get(c.node_id)
        if (!node || emittedNodes.has(node.id)) continue
        emittedNodes.add(node.id)
        const idx = c.content_text.toLowerCase().indexOf(debounced.toLowerCase())
        const start = Math.max(0, idx - 30)
        const snippet = idx >= 0 ? `${start > 0 ? '…' : ''}${c.content_text.slice(start, start + 110).trim()}` : c.content_text.slice(0, 100)
        contentHits.push({ id: node.id, kind: 'Anotação', label: node.title, sub: snippet, to: `/cadernos/${node.notebook_id}/pagina/${node.id}` })
      }
      const titleHits: Hit[] = kbNodes.rows
        .filter((n) => !emittedNodes.has(n.id))
        .map((n) => ({
          id: n.id,
          kind: 'Anotação',
          label: n.title,
          sub: n.node_type === 'section' ? 'Seção' : 'Página',
          to: `/cadernos/${n.notebook_id}/pagina/${n.id}`,
        }))

      return [
        ...notebooks.rows.map((nb): Hit => ({ id: nb.id, kind: 'Caderno', label: nb.title, sub: nb.description ?? 'Meus Cadernos', to: `/cadernos/${nb.id}` })),
        ...titleHits,
        ...contentHits,
        ...kbTags.rows.map((tg): Hit => ({ id: tg.id, kind: 'Tag', label: `#${tg.name}`, sub: 'Filtrar cadernos e páginas por tag', to: `/cadernos?tag=${tg.id}` })),
        ...courses.rows.map((c): Hit => ({ id: c.id, kind: 'Curso', label: c.custom_title ?? c.title, sub: 'Curso do Drive', to: `/cursos/${c.id}` })),
        ...subjects.rows.map((s): Hit => ({ id: s.id, kind: 'Matéria', label: s.name, sub: s.exam ?? undefined, to: `/materias/${s.id}` })),
        ...topics.rows.map((t): Hit => ({ id: t.id, kind: 'Tópico', label: t.name, to: `/materias/${t.subject_id}?topico=${t.id}` })),
        ...decks.rows.map((d): Hit => ({ id: d.id, kind: 'Baralho', label: d.name, to: `/flashcards/${d.id}` })),
        ...cards.rows.map((c): Hit => ({ id: c.id, kind: 'Flashcard', label: c.front, sub: c.back, to: `/flashcards/${c.deck_id}?cartao=${c.id}` })),
      ]
    },
  })

  const pages = useMemo<Hit[]>(() => {
    const t = term.trim().toLowerCase()
    return NAV.filter((n) => !t || n.label.toLowerCase().includes(t)).map((n) => ({ id: n.to, kind: 'Página', label: n.label, to: n.to }))
  }, [term])

  const hits = useMemo(() => [...(debounced.length >= 2 ? (results.data ?? []) : []), ...pages].slice(0, 30), [results.data, pages, debounced])

  useEffect(() => setActive(0), [debounced])

  if (!open) return null
  const go = (h: Hit) => {
    onClose()
    navigate(h.to)
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Pesquisar" className="animate-fade-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-bg shadow-xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(hits.length - 1, a + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              }
              if (e.key === 'Enter' && hits[active]) go(hits[active])
            }}
            placeholder="Pesquisar cadernos, anotações, cursos, matérias, tópicos, flashcards…"
            aria-label="Termo de pesquisa"
            role="combobox"
            aria-expanded="true"
            aria-controls="evl-search-results"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul id="evl-search-results" role="listbox" className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
          {debounced.length >= 2 && results.isFetching && <li className="px-3 py-2 text-xs text-muted">Pesquisando…</li>}
          {debounced.length >= 2 && results.isError && <li className="px-3 py-2 text-xs text-danger">Não foi possível pesquisar agora.</li>}
          {hits.length === 0 && !results.isFetching && <li className="px-3 py-6 text-center text-sm text-muted">Nada encontrado.</li>}
          {hits.map((h, i) => {
            const Icon = ICONS[h.kind]
            return (
              <li key={h.kind + h.id} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-surface' : ''}`}
                >
                  <Icon className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{h.label}</span>
                    {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{h.kind}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
