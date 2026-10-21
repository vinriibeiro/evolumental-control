import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Layers, ListTree, Network, Search, StickyNote } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useBackend } from './data'
import { NAV } from './nav'
import { useDebounced } from '@/hooks/useDebounced'

interface Hit {
  id: string
  kind: 'Página' | 'Matéria' | 'Tópico' | 'Baralho' | 'Flashcard' | 'Mapa'
  label: string
  sub?: string
  to: string
}

const ICONS = { Página: Search, Matéria: BookOpen, Tópico: ListTree, Baralho: Layers, Flashcard: StickyNote, Mapa: Network }

/** Pesquisa global (Ctrl+K) em todos os níveis: matérias, tópicos, baralhos, cartões e mapas. */
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
    queryKey: ['data', ['subjects', 'topics', 'flashcard_decks', 'flashcards', 'mind_maps'], 'search', backend.kind, debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async (): Promise<Hit[]> => {
      const q = (columns: string[]) => ({ search: { columns, term: debounced }, limit: 8 })
      const [subjects, topics, decks, cards, maps] = await Promise.all([
        backend.list('subjects', q(['name', 'description', 'exam'])),
        backend.list('topics', q(['name', 'description', 'notes'])),
        backend.list('flashcard_decks', q(['name', 'description'])),
        backend.list('flashcards', q(['front', 'back'])),
        backend.list('mind_maps', q(['title', 'description'])),
      ])
      return [
        ...subjects.rows.map((s): Hit => ({ id: s.id, kind: 'Matéria', label: s.name, sub: s.exam ?? undefined, to: `/materias/${s.id}` })),
        ...topics.rows.map((t): Hit => ({ id: t.id, kind: 'Tópico', label: t.name, to: `/materias/${t.subject_id}?topico=${t.id}` })),
        ...decks.rows.map((d): Hit => ({ id: d.id, kind: 'Baralho', label: d.name, to: `/flashcards/${d.id}` })),
        ...cards.rows.map((c): Hit => ({ id: c.id, kind: 'Flashcard', label: c.front, sub: c.back, to: `/flashcards/${c.deck_id}?cartao=${c.id}` })),
        ...maps.rows.map((m): Hit => ({ id: m.id, kind: 'Mapa', label: m.title, to: `/mapas/${m.id}` })),
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
            placeholder="Pesquisar matérias, tópicos, flashcards, mapas…"
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
