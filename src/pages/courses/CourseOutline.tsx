import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Circle, EyeOff, Paperclip, Pencil, Search, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Progress } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { isLessonDone, type CourseView, type Lesson, type OutlineEntry } from '@/lib/courseCatalog'
import { formatDuration } from '@/lib/drive'
import { normalizeText } from '@/lib/videoProgress'
import type { CourseNode, CourseProgress } from '@/types/db'
import { KindIcon } from './KindIcon'

interface Props {
  view: CourseView
  progress: Map<string, CourseProgress>
  currentLessonId: string | null
  organize: boolean
  onOrganize: (v: boolean) => void
  onOpen: (lesson: Lesson) => void
  onToggleDone: (lesson: Lesson) => void
  onEdit: (node: CourseNode) => void
  onMove: (first: CourseNode, second: CourseNode) => void
  onClose?: () => void
}

const sum = (lessons: Lesson[]) => lessons.reduce((s, l) => s + (l.primary.duration_ms ?? 0), 0)

/** Conteúdo do curso: módulos (com progresso e duração) e aulas, como nas plataformas de cursos. */
export function CourseOutline({ view, progress, currentLessonId, organize, onOrganize, onOpen, onToggleDone, onEdit, onMove, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const list = useRef<HTMLDivElement>(null)
  const q = normalizeText(query.trim())
  const done = (l: Lesson) => isLessonDone(l, progress)
  const showLesson = (l: Lesson) => (!pendingOnly || !done(l) || l.id === currentLessonId) && (!q || normalizeText(l.title).includes(q) || l.attachments.some((a) => normalizeText(a.title).includes(q)))
  const containsCurrent = (e: Extract<OutlineEntry, { type: 'module' }>) => e.lessons.some((l) => l.id === currentLessonId)
  const topModules = view.outline.filter((x) => x.type === 'module').length
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0

  // Leva a aula atual para a área visível do sumário.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-current="true"]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [currentLessonId])

  const reorder = (entries: OutlineEntry[], i: number, dir: -1 | 1) => {
    const a = entries[i]
    const b = entries[i + dir]
    if (!a || !b) return
    const nodeOf = (e: OutlineEntry) => (e.type === 'module' ? e.node : (e.lesson.folder ?? e.lesson.primary))
    onMove(nodeOf(a), nodeOf(b))
  }

  const render = (entries: OutlineEntry[], depth: number): ReactNode => (
    <ul className={cn(depth > 0 && 'ml-2 border-l border-line pl-1')}>
      {entries.map((e, i) => {
        const controls = organize && (
          <span className="flex shrink-0 items-center">
            <IconButton size="sm" label="Subir" disabled={i === 0} onClick={() => reorder(entries, i, -1)}><ArrowUp className="size-3.5" /></IconButton>
            <IconButton size="sm" label="Descer" disabled={i === entries.length - 1} onClick={() => reorder(entries, i, 1)}><ArrowDown className="size-3.5" /></IconButton>
            <IconButton size="sm" label="Organizar" onClick={() => onEdit(e.type === 'module' ? e.node : (e.lesson.folder ?? e.lesson.primary))}><Pencil className="size-3.5" /></IconButton>
          </span>
        )
        if (e.type === 'module') {
          const visibleLessons = e.lessons.filter(showLesson)
          if (!organize && visibleLessons.length === 0) return null
          const doneCount = e.lessons.filter(done).length
          // aberto por padrão: o módulo da aula atual (e os de dentro dele); os outros começam fechados
          const defaultOpen = !currentLessonId || containsCurrent(e) || topModules <= 1
          const open = Boolean(q) || pendingOnly || (collapsed[e.node.id] === undefined ? defaultOpen : !collapsed[e.node.id])
          const dur = formatDuration(sum(e.lessons))
          return (
            <li key={e.node.id} className="py-0.5">
              <div className="flex items-center gap-1">
                <button type="button" aria-expanded={open} onClick={() => setCollapsed((c) => ({ ...c, [e.node.id]: open }))} className={cn('flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface', e.node.hidden && 'opacity-50')}>
                  <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted transition-transform', !open && '-rotate-90')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-semibold text-ink">{e.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {doneCount}/{e.lessons.length} aula(s){dur ? ` · ${dur}` : ''}{doneCount === e.lessons.length && e.lessons.length > 0 ? ' · concluído' : ''}
                    </span>
                  </span>
                  {e.node.hidden && <EyeOff className="size-3.5 shrink-0" aria-label="Oculto" />}
                </button>
                {controls}
              </div>
              {open && render(e.entries, depth + 1)}
            </li>
          )
        }
        const l = e.lesson
        if (!showLesson(l) && !organize) return null
        const active = l.id === currentLessonId
        const isDone = done(l)
        const dur = formatDuration(l.primary.duration_ms)
        return (
          <li key={l.id} className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={isDone ? `Desmarcar conclusão de ${l.title}` : `Concluir ${l.title}`}
              aria-pressed={isDone}
              onClick={() => onToggleDone(l)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:text-success"
            >
              {isDone ? <CheckCircle2 className="size-[18px] text-success" aria-hidden /> : <Circle className="size-[18px]" aria-hidden />}
            </button>
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => onOpen(l)}
              className={cn(
                'flex min-w-0 flex-1 items-start gap-2 rounded-lg border-l-2 py-1.5 pr-2 pl-2 text-left transition-colors',
                active ? 'border-accent-strong bg-accent/15 text-ink' : 'border-transparent text-muted hover:bg-surface hover:text-ink',
                (l.primary.hidden || l.folder?.hidden) && 'opacity-50',
              )}
            >
              <KindIcon node={l.primary} className={cn('mt-0.5 size-4 shrink-0', active ? 'text-accent-strong' : '')} />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm leading-snug', active && 'font-semibold', isDone && !active && 'text-muted')}>{l.title}</span>
                {(dur || l.attachments.length > 0 || l.primary.status === 'missing') && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {dur && <span>{dur}</span>}
                    {l.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" aria-hidden />{l.attachments.length} material(is)</span>}
                    {l.primary.status === 'missing' && <span className="text-warning">não encontrado</span>}
                  </span>
                )}
              </span>
            </button>
            {controls}
          </li>
        )
      })}
    </ul>
  )

  return (
    <aside aria-label="Conteúdo do curso" className="course-outline flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-bg">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Conteúdo do curso</h2>
          {onClose && <IconButton size="sm" label="Fechar conteúdo" onClick={onClose}><X className="size-4" /></IconButton>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Progress value={pct} className="h-1.5 flex-1" label="Progresso do curso" />
          <span className="tabular shrink-0">{view.done} de {view.total} concluídos</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar no curso" placeholder="Buscar aula ou material" className="h-9 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Só pendentes
          </label>
          <button type="button" aria-pressed={organize} onClick={() => onOrganize(!organize)} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', organize ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-surface')}>
            <Pencil className="size-3" aria-hidden /> {organize ? 'Concluir organização' : 'Organizar'}
          </button>
        </div>
      </div>
      <div ref={list} className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {view.lessons.length === 0 && !organize ? <p className="p-3 text-sm text-muted">Nenhuma aula visível neste curso.</p> : render(view.outline, 0)}
      </div>
    </aside>
  )
}
