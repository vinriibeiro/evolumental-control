// Grade de horários (dia ou semana) de 30 em 30 minutos. Clique num horário vazio para criar; arraste para mover
// (inclusive para outro dia); puxe a borda de baixo para mudar a duração. Itens sem horário ficam no topo do dia
// e podem ser arrastados para outro dia. Vermelho só em atraso/conflito e na linha do horário atual.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Brain, Check, Flag, Lock, Plus } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { useNow } from '@/hooks/useNow'
import { layoutDay, snap } from '@/lib/calendarLayout'
import { WEEKDAY_SHORT } from '@/lib/labels'
import { dayKey, formatDayKey, minutesToHhmm, weekday, zonedDayStart, type DayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { DayChip, PlanEvent } from './model'

const SLOT = 22 // px por 30 minutos

export function minutesNow(tz: string) {
  const ms = Date.now()
  return Math.round((ms - zonedDayStart(dayKey(ms, tz), tz)) / 60000)
}

interface DragState {
  ev: PlanEvent
  mode: 'move' | 'resize'
  x0: number
  y0: number
  dayIdx: number
  start: number
  duration: number
  moved: boolean
}

export function TimeGrid(props: {
  days: DayKey[]
  today: DayKey
  tz: string
  hours: { start: number; end: number }
  events: PlanEvent[]
  chips: (d: DayKey) => DayChip[]
  /** Minutos planejados no dia (mostrado no cabeçalho). */
  planned?: (d: DayKey) => number
  onSlot: (d: DayKey, minutes: number) => void
  onOpen: (ev: PlanEvent) => void
  onMove: (ev: PlanEvent, d: DayKey, start: number) => void
  onResize: (ev: PlanEvent, duration: number) => void
  onChip: (c: DayChip) => void
  onToggleChip: (c: DayChip) => void
  onChipMove: (c: DayChip, d: DayKey) => void
  onAdd: (d: DayKey) => void
  onPickDay?: (d: DayKey) => void
}) {
  const { days, today, hours, events } = props
  const now = useNow(60_000)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startMin = hours.start * 60
  const endMin = hours.end * 60
  const rows = (endMin - startMin) / 30
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropDay, setDropDay] = useState<DayKey | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  // Rola até perto de agora (ou 07:00) ao abrir ou trocar de período.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = days.includes(today) ? Math.max(startMin, minutesNow(props.tz) - 120) : Math.max(startMin, 7 * 60)
    el.scrollTop = ((target - startMin) / 30) * SLOT
  }, [days.join(','), startMin]) // eslint-disable-line react-hooks/exhaustive-deps

  const colWidth = () => {
    const g = gridRef.current
    return g ? g.getBoundingClientRect().width / days.length : 100
  }

  const onPointerDown = (e: ReactPointerEvent, ev: PlanEvent, mode: 'move' | 'resize') => {
    if (!ev.movable || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const d: DragState = { ev, mode, x0: e.clientX, y0: e.clientY, dayIdx: days.indexOf(ev.date), start: ev.start, duration: ev.end - ev.start, moved: false }
    dragRef.current = d
    setDrag(d)
  }

  // Durante o arrasto, ouve a janela inteira: o bloco pode mudar de coluna.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const dy = e.clientY - cur.y0
      const dx = e.clientX - cur.x0
      const moved = cur.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4
      const deltaMin = snap((dy / SLOT) * 30)
      const days = propsRef.current.days
      let next: DragState
      if (cur.mode === 'move') {
        const dayIdx = Math.max(0, Math.min(days.length - 1, days.indexOf(cur.ev.date) + Math.round(dx / colWidth())))
        const start = Math.max(0, Math.min(24 * 60 - 30, snap(cur.ev.start + deltaMin)))
        next = { ...cur, dayIdx, start, moved }
      } else {
        const duration = Math.max(30, Math.min(24 * 60 - cur.ev.start, snap(cur.ev.end - cur.ev.start + deltaMin)))
        next = { ...cur, duration, moved }
      }
      dragRef.current = next
      setDrag(next)
    }
    const up = () => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      const p = propsRef.current
      if (!d.moved) return p.onOpen(d.ev)
      if (d.mode === 'move') p.onMove(d.ev, p.days[d.dayIdx], d.start)
      else p.onResize(d.ev, d.duration)
    }
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', cancel)
    }
  }, [dragging]) // eslint-disable-line react-hooks/exhaustive-deps

  // `now` (atualizado a cada minuto) mantém a linha do horário atual em dia.
  const nowMin = now ? minutesNow(props.tz) : 0
  const single = days.length === 1

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho dos dias + itens sem horário */}
      <div className="flex border-b border-line">
        <div className="w-12 shrink-0" />
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const chips = props.chips(d)
            const planned = props.planned?.(d) ?? 0
            const max = single ? 12 : 3
            return (
              <div
                key={d}
                className={cn('min-w-0 border-l border-line px-1.5 py-2 transition-colors', dropDay === d && 'bg-surface-2')}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes('application/x-vlm-chip')) return
                  e.preventDefault()
                  setDropDay(d)
                }}
                onDragLeave={() => setDropDay((cur) => (cur === d ? null : cur))}
                onDrop={(e) => {
                  setDropDay(null)
                  const key = e.dataTransfer.getData('application/x-vlm-chip')
                  const from = e.dataTransfer.getData('application/x-vlm-day') as DayKey
                  const chip = key && from ? props.chips(from).find((c) => c.key === key) : undefined
                  if (chip && from !== d) props.onChipMove(chip, d)
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => props.onPickDay?.(d)}
                    className={cn('flex items-baseline gap-1 rounded text-xs', d === today ? 'font-semibold text-ink' : 'font-medium text-muted')}
                    aria-label={formatDayKey(d, 'long')}
                  >
                    <span>{WEEKDAY_SHORT[weekday(d)]}</span>
                    <span className={cn('tabular flex size-5 items-center justify-center rounded-full text-[11px]', d === today && 'bg-accent text-accent-ink')}>{Number(d.slice(8))}</span>
                  </button>
                  <button className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Nova tarefa em ${formatDayKey(d)}`} onClick={() => props.onAdd(d)}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {planned > 0 && <p className="tabular mt-0.5 text-[10px] text-muted">{planned >= 60 ? `${Math.floor(planned / 60)}h${planned % 60 ? String(planned % 60).padStart(2, '0') : ''}` : `${planned}min`} planejado</p>}
                <div className="mt-1 flex flex-col gap-0.5">
                  {chips.slice(0, max).map((c) => (
                    <div
                      key={c.key}
                      draggable={c.kind === 'task'}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-vlm-chip', c.key)
                        e.dataTransfer.setData('application/x-vlm-day', d)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className={cn('flex items-center gap-1 rounded border border-line bg-bg px-1 py-0.5 text-[10px] text-ink', c.attention && 'border-accent/50', c.done && 'opacity-55')}
                    >
                      {c.kind === 'task' ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={c.done}
                          aria-label={c.done ? `Reabrir: ${c.label}` : `Concluir: ${c.label}`}
                          onClick={() => props.onToggleChip(c)}
                          className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border', c.done ? 'border-ink bg-ink text-bg' : 'border-muted/60 hover:border-ink')}
                        >
                          {c.done && <Check className="size-2.5" strokeWidth={3} />}
                        </button>
                      ) : c.kind === 'review' ? (
                        <Brain className="size-3 shrink-0 text-muted" aria-hidden />
                      ) : (
                        <Flag className="size-3 shrink-0 text-accent" aria-hidden />
                      )}
                      <button type="button" onClick={() => props.onChip(c)} className={cn('min-w-0 flex-1 truncate text-left', c.done && 'line-through')} title={c.label}>
                        {c.label}
                      </button>
                    </div>
                  ))}
                  {chips.length > max && (
                    <button type="button" className="text-left text-[10px] text-muted hover:text-ink" onClick={() => props.onPickDay?.(d)}>
                      +{chips.length - max} no dia
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grade de 30 em 30 minutos */}
      <div ref={scrollRef} className="scroll-thin max-h-[calc(100dvh-var(--app-top,4rem)-16rem)] min-h-80 overflow-y-auto">
        <div className="relative flex" style={{ height: rows * SLOT }}>
          <div className="w-12 shrink-0">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="relative text-right" style={{ height: SLOT }}>
                {i % 2 === 0 && <span className="tabular absolute -top-1.5 right-2 text-[10px] text-muted">{minutesToHhmm(startMin + i * 30)}</span>}
              </div>
            ))}
          </div>
          <div ref={gridRef} className="relative grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, di) => {
              const dayEvents = events.filter((ev) => ev.date === d && ev.end > startMin && ev.start < endMin)
              const placed = layoutDay(dayEvents)
              return (
                <div key={d} className={cn('relative border-l border-line', d === today && 'bg-surface-2/60')}>
                  {Array.from({ length: rows }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={cn('block w-full hover:bg-ink/5 focus-visible:bg-ink/5', i % 2 === 1 ? 'border-b border-line' : 'border-b border-dashed border-b-[color-mix(in_srgb,var(--border)_55%,transparent)]')}
                      style={{ height: SLOT }}
                      aria-label={`Criar tarefa em ${formatDayKey(d)} às ${minutesToHhmm(startMin + i * 30)}`}
                      onClick={() => props.onSlot(d, startMin + i * 30)}
                    />
                  ))}
                  {d === today && nowMin >= startMin && nowMin <= endMin && (
                    <div className="pointer-events-none absolute right-0 left-0 z-20 h-px bg-accent" style={{ top: ((nowMin - startMin) / 30) * SLOT }}>
                      <span className="absolute -top-1 -left-1 size-2 rounded-full bg-accent" />
                    </div>
                  )}
                  {placed.map(({ event: ev, lane, lanes }) => {
                    const isDragging = drag?.ev.key === ev.key
                    if (isDragging && drag.mode === 'move' && drag.dayIdx !== di) return null
                    const start = isDragging && drag.mode === 'move' ? drag.start : ev.start
                    const duration = isDragging ? (drag.mode === 'resize' ? drag.duration : ev.end - ev.start) : ev.end - ev.start
                    return (
                      <EventBox
                        key={ev.key}
                        ev={ev}
                        top={((Math.max(start, startMin) - startMin) / 30) * SLOT}
                        height={Math.max(SLOT - 2, ((Math.min(start + duration, endMin) - Math.max(start, startMin)) / 30) * SLOT - 2)}
                        left={`calc(${(lane / lanes) * 100}% + 2px)`}
                        width={`calc(${100 / lanes}% - 4px)`}
                        dragging={isDragging}
                        timeLabel={`${minutesToHhmm(start)}–${minutesToHhmm(start + duration)}`}
                        onPointerDown={onPointerDown}
                        onOpen={() => props.onOpen(ev)}
                      />
                    )
                  })}
                  {drag && drag.mode === 'move' && drag.dayIdx === di && drag.ev.date !== d && (
                    <EventBox
                      ev={drag.ev}
                      top={((drag.start - startMin) / 30) * SLOT}
                      height={((drag.ev.end - drag.ev.start) / 30) * SLOT - 2}
                      left="2px"
                      width="calc(100% - 4px)"
                      dragging
                      timeLabel={`${minutesToHhmm(drag.start)}–${minutesToHhmm(drag.start + drag.ev.end - drag.ev.start)}`}
                      onPointerDown={() => {}}
                      onOpen={() => {}}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function EventBox({
  ev,
  top,
  height,
  left,
  width,
  dragging,
  timeLabel,
  onPointerDown,
  onOpen,
}: {
  ev: PlanEvent
  top: number
  height: number
  left: string
  width: string
  dragging?: boolean
  timeLabel: string
  onPointerDown: (e: ReactPointerEvent, ev: PlanEvent, mode: 'move' | 'resize') => void
  onOpen: () => void
}) {
  const session = ev.kind === 'session'
  const compact = height < 40
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ev.title}, ${timeLabel}${ev.done ? ', concluída' : ''}${ev.attention ? ', precisa de atenção' : ''}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      onPointerDown={(e) => (ev.movable ? onPointerDown(e, ev, 'move') : undefined)}
      onClick={(e) => {
        e.stopPropagation()
        if (!ev.movable) onOpen()
      }}
      className={cn(
        'absolute z-10 flex touch-none flex-col overflow-hidden rounded-md border py-0.5 pr-1.5 pl-2 text-left text-[11px] leading-tight select-none',
        ev.movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        session ? 'border-dashed border-line bg-surface-2 text-muted' : 'border-line bg-bg',
        ev.attention && !ev.done && 'border-accent/60',
        ev.done && 'opacity-55',
        dragging && 'z-30 opacity-90 ring-2 ring-ink',
      )}
      style={{ top, height, left, width }}
    >
      {!session && <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', ev.attention && !ev.done ? 'bg-accent' : ev.study ? 'bg-ink' : 'bg-muted/50')} />}
      <span className={cn('flex items-center gap-1 font-medium text-ink', compact ? 'truncate' : 'line-clamp-2', ev.done && 'line-through')}>
        {ev.done && <Check className="size-3 shrink-0" aria-hidden />}
        {ev.fixed && <Lock className="size-2.5 shrink-0 text-muted" aria-hidden />}
        <span className="truncate">{ev.title}</span>
      </span>
      {!compact && <span className="tabular truncate text-muted">{timeLabel}</span>}
      {!compact && ev.subtitle && height > 56 && <span className="truncate text-muted">{ev.subtitle}</span>}
      {ev.movable && (
        <span
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation()
            onPointerDown(e, ev, 'resize')
          }}
        />
      )}
    </div>
  )
}
