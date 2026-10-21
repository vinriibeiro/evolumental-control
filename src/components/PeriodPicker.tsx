import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/layout'
import { addDays, addMonths, formatDayKey, periodRange, type DayRange, type PeriodKind } from '@/lib/time'

export interface PeriodState {
  kind: PeriodKind
  anchor: string
  custom: DayRange
}

export function usePeriod(today: string, initial: PeriodKind = 'week') {
  const [state, setState] = useState<PeriodState>({ kind: initial, anchor: today, custom: { from: addDays(today, -29), to: today } })
  const range = useMemo(() => periodRange(state.kind, state.anchor, state.custom), [state])
  return { state, setState, range }
}

export function describeRange(kind: PeriodKind, range: DayRange): string {
  if (kind === 'day') return formatDayKey(range.from, 'long')
  if (kind === 'month') return formatDayKey(range.from, 'month')
  return `${formatDayKey(range.from)} – ${formatDayKey(range.to)}`
}

export function PeriodPicker({ state, setState, range, today }: { state: PeriodState; setState: (s: PeriodState) => void; range: DayRange; today: string }) {
  const shift = (dir: 1 | -1) => {
    const anchor = state.kind === 'day' ? addDays(state.anchor, dir) : state.kind === 'week' ? addDays(state.anchor, 7 * dir) : addMonths(state.anchor, dir)
    setState({ ...state, anchor })
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Período"
        size="sm"
        value={state.kind}
        onChange={(kind) => setState({ ...state, kind, anchor: today })}
        options={[
          { value: 'day', label: 'Dia' },
          { value: 'week', label: 'Semana' },
          { value: 'month', label: 'Mês' },
          { value: 'custom', label: 'Personalizado' },
        ]}
      />
      {state.kind === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" aria-label="Data inicial" className="h-8 w-auto" value={state.custom.from} max={state.custom.to} onChange={(e) => e.target.value && setState({ ...state, custom: { ...state.custom, from: e.target.value } })} />
          <span className="text-xs text-muted">até</span>
          <Input type="date" aria-label="Data final" className="h-8 w-auto" value={state.custom.to} min={state.custom.from} onChange={(e) => e.target.value && setState({ ...state, custom: { ...state.custom, to: e.target.value } })} />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <IconButton size="sm" label="Período anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className="min-w-0 px-1 text-sm font-medium text-ink">{describeRange(state.kind, range)}</span>
          <IconButton size="sm" label="Próximo período" onClick={() => shift(1)} disabled={range.to >= today}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      )}
    </div>
  )
}
