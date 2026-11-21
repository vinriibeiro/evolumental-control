// Visão mensal: só o essencial de cada dia (quantas atividades, o que é prioridade, prazos e tempo estudado).
// Tarefas podem ser arrastadas para outro dia; clicar no dia abre a visão diária.
import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { WEEKDAY_SHORT } from '@/lib/labels'
import type { PlanActivity } from '@/lib/replan'
import { formatDayKey, formatDuration, minutesToHhmm, type DayKey } from '@/lib/time'
import { cn } from '@/lib/cn'

export function MonthView({
  days,
  anchor,
  today,
  activities,
  studied,
  deadlines,
  overdueIds,
  onPick,
  onMoveDay,
}: {
  days: DayKey[]
  anchor: DayKey
  today: DayKey
  activities: PlanActivity[]
  studied: Map<string, number>
  deadlines: Map<string, string[]>
  overdueIds: Set<string>
  onPick: (d: DayKey) => void
  onMoveDay: (a: PlanActivity, d: DayKey) => void
}) {
  const [over, setOver] = useState<DayKey | null>(null)
  const byDay = new Map<string, PlanActivity[]>()
  for (const a of activities) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a])
  return (
    <Card className="p-2">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <span key={d}>{WEEKDAY_SHORT[d]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || (a.start ?? 9999) - (b.start ?? 9999))
          const pending = list.filter((a) => !a.done)
          const done = list.length - pending.length
          const out = d.slice(0, 7) !== anchor.slice(0, 7)
          const dl = deadlines.get(d) ?? []
          const secs = studied.get(d) ?? 0
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              aria-label={`${formatDayKey(d, 'long')}: ${pending.length} pendente(s), ${done} concluída(s)`}
              onClick={() => onPick(d)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(d))}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('application/x-vlm-activity')) return
                e.preventDefault()
                setOver(d)
              }}
              onDragLeave={() => setOver((cur) => (cur === d ? null : cur))}
              onDrop={(e) => {
                setOver(null)
                const id = e.dataTransfer.getData('application/x-vlm-activity')
                const a = activities.find((x) => x.id === id)
                if (a && a.date !== d) onMoveDay(a, d)
              }}
              className={cn('flex min-h-20 min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-24', d === today ? 'border-ink' : 'border-line hover:bg-surface-2', over === d && 'bg-surface-2', out && 'opacity-40')}
            >
              <span className="flex items-center justify-between gap-1 text-xs font-semibold text-ink">
                <span className={cn('tabular flex size-5 items-center justify-center rounded-full', d === today && 'bg-accent text-accent-ink')}>{Number(d.slice(8))}</span>
                {secs > 0 && <span className="tabular truncate text-[10px] font-medium text-muted">{formatDuration(secs)}</span>}
              </span>
              {dl.slice(0, 1).map((label) => (
                <span key={label} className="flex items-center gap-0.5 truncate text-[10px] font-medium text-accent" title={label}>
                  <Flag className="size-2.5 shrink-0" aria-hidden />
                  <span className="truncate max-sm:hidden">{label}</span>
                </span>
              ))}
              {/* no celular, só a contagem; a partir de sm, até duas atividades pendentes */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {pending.slice(0, 2).map((a) => (
                  <span
                    key={a.id}
                    draggable={a.source === 'task' && !a.fixed}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-vlm-activity', a.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn('truncate rounded border border-line bg-bg px-1 text-[10px] text-ink', overdueIds.has(a.id) && 'border-accent/50')}
                    title={a.title}
                  >
                    {a.start != null && <span className="tabular text-muted">{minutesToHhmm(a.start)} </span>}
                    {a.title}
                  </span>
                ))}
              </span>
              {(pending.length > 0 || done > 0) && (
                <span className="mt-auto text-[10px] text-muted">
                  <span className="sm:hidden">{pending.length > 0 ? `${pending.length} pend.` : ''}</span>
                  <span className="max-sm:hidden">{pending.length > 2 ? `+${pending.length - 2} ` : ''}</span>
                  {done > 0 && <span>{pending.length > 0 ? ' · ' : ''}{done} ok</span>}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
