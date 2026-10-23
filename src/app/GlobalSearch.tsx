import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, ClipboardCheck, Layers, ListTree, Network, Route, Search, StickyNote, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useBackend } from './data'
import { NAV } from './nav'
import { fold, matchCommands } from './commands'
import { useDebounced } from '@/hooks/useDebounced'
import { useLookups } from '@/hooks/domain'
import { formatDayKey } from '@/lib/time'
import { inList } from '@/lib/data/types'

type Group = 'Comandos' | 'Tópicos' | 'Matérias' | 'Flashcards' | 'Baralhos' | 'Questões' | 'Tarefas' | 'Mapas mentais' | 'Trilhas' | 'Páginas'

interface Hit {
  id: string
  group: Group
  label: string
  sub?: string
  to: string
  /** Ações rápidas (matérias e tópicos): estudar, fazer questões, revisar. */
  actions?: Array<{ label: string; to: string }>
}

const ORDER: Group[] = ['Comandos', 'Tópicos', 'Matérias', 'Flashcards', 'Baralhos', 'Questões', 'Tarefas', 'Mapas mentais', 'Trilhas', 'Páginas']
const ICONS: Record<Group, typeof Search> = {
  Comandos: Zap,
  Tópicos: ListTree,
  Matérias: BookOpen,
  Flashcards: StickyNote,
  Baralhos: Layers,
  Questões: ClipboardCheck,
  Tarefas: CalendarCheck,
  'Mapas mentais': Network,
  Trilhas: Route,
  Páginas: Search,
}
const PER_GROUP = 5

const studyActions = (subjectId: string, topicId?: string) => {
  const q = `materia=${subjectId}${topicId ? `&topico=${topicId}` : ''}`
  return [
    { label: 'Estudar', to: `/cronometro?${q}` },
    { label: 'Questões', to: `/questoes?${q}` },
    { label: 'Revisar', to: `/flashcards/revisar?${topicId ? `topico=${topicId}` : `materia=${subjectId}`}` },
  ]
}

/**
 * Busca global e paleta de comandos (Ctrl/Cmd+K). As consultas vão ao backend
 * com limite por categoria (nada de baixar o banco inteiro); flashcards e
 * questões trazem também o total de resultados.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebounced(term.trim(), 200)
  const backend = useBackend()
  const navigate = useNavigate()
  const lookups = useLookups()

  useEffect(() => {
    if (open) {
      setTerm('')
      setActive(0)
    }
  }, [open])

  const results = useQuery({
    queryKey: ['data', ['subjects', 'topics', 'flashcard_decks', 'flashcards', 'mind_maps', 'question_records', 'calendar_tasks'], 'search', backend.kind, debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const q = (columns: string[], count = false) => ({ search: { columns, term: debounced }, limit: PER_GROUP, count })
      const [subjects, topics, decks, cards, maps, questions, tasks, trails] = await Promise.all([
        backend.list('subjects', q(['name', 'description', 'exam'])),
        backend.list('topics', q(['name', 'description', 'notes'])),
        backend.list('flashcard_decks', q(['name', 'description'])),
        backend.list('flashcards', q(['front', 'back'], true)),
        backend.list('mind_maps', q(['title', 'description'])),
        backend.list('question_records', q(['board', 'exam', 'source', 'notes'], true)),
        backend.list('calendar_tasks', q(['title', 'description'])),
        // Trilhas são conteúdo do app (carregado só quando há busca).
        import('@/content/trails').then(({ CAREER_TRAILS }) => {
          const t = fold(debounced)
          return CAREER_TRAILS.filter((c) => fold(`${c.name} ${c.summary} ${c.exam ?? ''}`).includes(t)).slice(0, PER_GROUP)
        }),
      ])
      // Questões e flashcards ligados aos tópicos encontrados ("Crase" → registros de Crase).
      const ids = topics.rows.map((t) => t.id)
      const [linkedQ, linkedC] = ids.length
        ? await Promise.all([
            backend.list('question_records', { filters: [inList('topic_id', ids)], limit: PER_GROUP, count: true, order: [{ column: 'date', ascending: false }] }),
            backend.list('flashcards', { filters: [inList('topic_id', ids)], limit: PER_GROUP, count: true }),
          ])
        : [null, null]
      const merge = <T extends { id: string }>(a: { rows: T[]; count: number | null }, b: { rows: T[]; count: number | null } | null) => {
        if (!b) return a
        const seen = new Set(a.rows.map((r) => r.id))
        return { rows: [...a.rows, ...b.rows.filter((r) => !seen.has(r.id))].slice(0, PER_GROUP), count: (a.count ?? a.rows.length) + (b.count ?? b.rows.length) }
      }
      return { subjects, topics, decks, cards: merge(cards, linkedC), maps, questions: merge(questions, linkedQ), tasks, trails }
    },
  })

  const groups = useMemo(() => {
    const out = new Map<Group, { hits: Hit[]; total: number }>()
    const put = (g: Group, hits: Hit[], total = hits.length) => {
      if (hits.length) out.set(g, { hits, total })
    }
    put(
      'Comandos',
      matchCommands(term, lookups.subjects)
        .slice(0, term.trim() ? 6 : 12)
        .map((c) => ({ id: c.id, group: 'Comandos', label: c.label, to: c.to })),
    )
    const r = debounced.length >= 2 ? results.data : undefined
    if (r) {
      put(
        'Tópicos',
        r.topics.rows.map((t) => ({ id: t.id, group: 'Tópicos', label: t.name, sub: lookups.subjectName(t.subject_id), to: `/materias/${t.subject_id}/topico/${t.id}`, actions: studyActions(t.subject_id, t.id) })),
      )
      put('Matérias', r.subjects.rows.map((s) => ({ id: s.id, group: 'Matérias', label: s.name, sub: s.exam ?? undefined, to: `/materias/${s.id}`, actions: studyActions(s.id) })))
      put(
        'Flashcards',
        r.cards.rows.map((c) => ({ id: c.id, group: 'Flashcards', label: c.front, sub: c.back, to: `/flashcards/${c.deck_id}?cartao=${c.id}` })),
        r.cards.count ?? r.cards.rows.length,
      )
      put('Baralhos', r.decks.rows.map((d) => ({ id: d.id, group: 'Baralhos', label: d.name, to: `/flashcards/${d.id}` })))
      put(
        'Questões',
        r.questions.rows.map((q) => ({
          id: q.id,
          group: 'Questões',
          label: `${formatDayKey(q.date)} · ${q.total} questões (${q.correct} acertos)`,
          sub: [lookups.subjectName(q.subject_id), q.topic_id ? lookups.topicName(q.topic_id) : null, q.board, q.exam].filter(Boolean).join(' · '),
          to: '/questoes',
        })),
        r.questions.count ?? r.questions.rows.length,
      )
      put('Tarefas', r.tasks.rows.map((t) => ({ id: t.id, group: 'Tarefas', label: t.title, sub: formatDayKey(t.date, 'long'), to: '/calendario' })))
      put('Mapas mentais', r.maps.rows.map((m) => ({ id: m.id, group: 'Mapas mentais', label: m.title, to: `/mapas/${m.id}` })))
      put('Trilhas', r.trails.map((t) => ({ id: t.key, group: 'Trilhas', label: t.name, sub: t.area, to: '/trilhas' })))
    }
    const t = fold(term)
    put(
      'Páginas',
      NAV.filter((n) => t && fold(n.label).includes(t)).map((n) => ({ id: n.to, group: 'Páginas', label: n.label, to: n.to })),
    )
    return ORDER.filter((g) => out.has(g)).map((g) => ({ group: g, ...out.get(g)! }))
  }, [term, debounced, results.data, lookups])

  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups])
  useEffect(() => setActive(0), [debounced])

  if (!open) return null
  const go = (to: string) => {
    onClose()
    navigate(to)
  }
  let index = -1
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[8vh] sm:p-4 sm:pt-[10vh]">
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Pesquisar e comandos" className="animate-fade-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-bg shadow-xl">
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
                setActive((a) => Math.min(flat.length - 1, a + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              }
              if (e.key === 'Enter' && flat[active]) go(flat[active].to)
            }}
            placeholder="Pesquisar ou digitar um comando (ex.: estudar português)"
            aria-label="Termo de pesquisa"
            role="combobox"
            aria-expanded="true"
            aria-controls="evl-search-results"
            aria-activedescendant={flat[active] ? `evl-hit-${active}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-muted sm:inline">Esc</kbd>
        </div>
        <div id="evl-search-results" role="listbox" aria-label="Resultados" className="scroll-thin max-h-[65vh] overflow-y-auto p-2">
          {debounced.length >= 2 && results.isFetching && <p className="px-3 py-2 text-xs text-muted">Pesquisando…</p>}
          {debounced.length >= 2 && results.isError && <p className="px-3 py-2 text-xs text-danger">Não foi possível pesquisar agora.</p>}
          {flat.length === 0 && !results.isFetching && <p className="px-3 py-6 text-center text-sm text-muted">Nada encontrado.</p>}
          {groups.map((g) => {
            const Icon = ICONS[g.group]
            return (
              <div key={g.group} role="group" aria-label={g.group} className="mb-1">
                <p className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                  <span>{g.group}</span>
                  {(g.total > g.hits.length || g.group === 'Questões' || g.group === 'Flashcards') && (
                    <span className="font-normal normal-case">
                      {g.total} {g.group === 'Questões' ? (g.total === 1 ? 'registro' : 'registros') : g.total === 1 ? 'resultado' : 'resultados'}
                    </span>
                  )}
                </p>
                {g.hits.map((h) => {
                  index++
                  const i = index
                  return (
                    <div
                      key={h.group + h.id}
                      id={`evl-hit-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${i === active ? 'bg-surface' : ''}`}
                    >
                      <button onClick={() => go(h.to)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Icon className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{h.label}</span>
                          {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                        </span>
                      </button>
                      {h.actions?.map((a) => (
                        <button key={a.label} onClick={() => go(a.to)} className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-ink hover:bg-bg" aria-label={`${a.label}: ${h.label}`}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
