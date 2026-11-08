import { BookOpen, ClipboardCheck, ExternalLink, PenLine, Play, type LucideIcon } from 'lucide-react'
import { QcLinks } from '@/components/QcLinks'
import type { CguTask } from '@/content/cguPlan'
import { type ResolvedLink, type TaskGroup, groupTasks, minutesOf, openLabel } from '@/lib/cguPlan'

const ICONS: Record<TaskGroup, LucideIcon> = { teoria: BookOpen, questoes: ClipboardCheck, discursiva: PenLine }

interface ShortcutsPlan {
  resolve: (task: CguTask) => ResolvedLink
  open: (task: CguTask) => void
}

/**
 * Atalhos do dia: as tarefas pendentes separadas em Teoria (aulas e apostilas) e Questões (filtros do QConcursos),
 * cada uma com o botão que abre direto o material. Usado em Meu espaço, no cartão "CGU · Hoje".
 */
export function CguShortcuts({ plan, tasks }: { plan: ShortcutsPlan; tasks: readonly CguTask[] }) {
  const groups = groupTasks(tasks)
  if (groups.length === 0) return null
  return (
    <div className="mt-4 border-t border-line pt-3" data-testid="cgu-atalhos">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Ir direto</p>
      {groups.map((g) => {
        const Icon = ICONS[g.group]
        return (
          <section key={g.group} aria-label={g.label} data-testid={`cgu-atalhos-${g.group}`} className="mt-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon className="size-4 text-accent-strong" aria-hidden />
              {g.label}
              <span className="tabular text-xs font-normal text-muted">
                {g.tasks.length} · {minutesOf(g.tasks)} min
              </span>
            </h3>
            <ul className="mt-1 divide-y divide-line">
              {g.tasks.map((t) => {
                const r = plan.resolve(t)
                return (
                  <li key={t.id} className="py-1.5">
                    <button
                      type="button"
                      onClick={() => plan.open(t)}
                      aria-label={`${openLabel(t)}: ${t.title}`}
                      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm text-ink">{t.title}</span>
                      <span className="tabular shrink-0 text-xs text-muted">{t.minutes} min</span>
                      {r.external ? <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden /> : <Play className="size-3.5 shrink-0 text-muted" aria-hidden />}
                    </button>
                    {r.links && <QcLinks links={r.links} />}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
