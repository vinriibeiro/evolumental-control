// Gráficos do sistema. Regras: marcas finas com ponta arredondada de 4px,
// grade e eixos discretos, uma só escala por gráfico, tooltip em toda marca,
// legenda sempre que houver ≥ 2 séries e tabela alternativa para acessibilidade.
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Table2, BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { IconButton } from '@/components/ui/Button'

const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const

export interface Series {
  key: string
  label: string
  color: string
}

export function ChartCard({
  title,
  description,
  children,
  table,
  legend,
  action,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  table?: { columns: string[]; rows: Array<Array<string | number>> }
  legend?: Series[]
  action?: ReactNode
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card className={`flex flex-col p-4 ${className ?? ''}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <IconButton size="sm" label={asTable ? 'Ver gráfico' : 'Ver tabela'} onClick={() => setAsTable((t) => !t)}>
              {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            </IconButton>
          )}
        </div>
      </div>
      {legend && legend.length > 1 && !asTable && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
          {legend.map((l) => (
            <li key={l.key} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2.5 rounded-sm" style={{ background: l.color }} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {asTable && table ? (
        <div className="scroll-thin max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                {table.columns.map((c, i) => (
                  <th key={c} className={`px-2 py-1.5 font-medium ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {r.map((v, j) => (
                    <td key={j} className={`tabular px-2 py-1.5 text-ink ${j > 0 ? 'text-right' : ''}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

function TooltipBox({ active, payload, label, format, labelFormat }: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }>
  label?: string | number
  format: (v: number) => string
  labelFormat?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-bg px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{labelFormat ? labelFormat(String(label ?? payload[0]?.payload?.label ?? '')) : (label ?? String(payload[0]?.payload?.label ?? ''))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-sm" style={{ background: p.color ?? (p.payload?.color as string) }} />
          {p.name}: <span className="tabular font-medium text-ink">{format(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  )
}

/** Barras verticais por categoria/data; várias séries ficam lado a lado. */
export function ColumnChart({
  data,
  series,
  xKey,
  format,
  xFormat,
  height = 220,
}: {
  data: Array<Record<string, string | number>>
  series: Series[]
  xKey: string
  format: (v: number) => string
  xFormat?: (v: string) => string
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axis} tickFormatter={xFormat} minTickGap={8} />
          <YAxis {...axis} tickFormatter={(v) => format(Number(v))} width={52} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--surface)' }} content={<TooltipBox format={format} labelFormat={xFormat} />} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais com uma cor por item (identidade segue a entidade). */
export function RankBars({ items, format, emptyText = 'Sem dados no período.' }: { items: Array<{ label: string; value: number; color: string }>; format: (v: number) => string; emptyText?: string }) {
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted">{emptyText}</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="group" title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-ink">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: i.color }} aria-hidden />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="tabular shrink-0 text-muted">{format(i.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2">
            <div className="h-2 rounded-full transition-[width] duration-500 group-hover:opacity-80" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Linha (2px) para evolução de um indicador percentual. */
export function TrendLine({
  data,
  series,
  xKey,
  format,
  xFormat,
  height = 220,
  domain,
}: {
  data: Array<Record<string, string | number | null>>
  series: Series[]
  xKey: string
  format: (v: number) => string
  xFormat?: (v: string) => string
  height?: number
  domain?: [number, number]
}) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axis} tickFormatter={xFormat} minTickGap={12} />
          <YAxis {...axis} tickFormatter={(v) => format(Number(v))} width={44} domain={domain} />
          <Tooltip cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} content={<TooltipBox format={format} labelFormat={xFormat} />} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5, stroke: 'var(--bg)', strokeWidth: 2 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Mapa de constância: um quadrado por dia, intensidade sequencial em um só tom. */
export function ConsistencyGrid({ days, format }: { days: Array<{ day: string; seconds: number; label: string }>; format: (v: number) => string }) {
  const max = Math.max(...days.map((d) => d.seconds), 1)
  const level = (s: number) => (s <= 0 ? 0 : Math.min(4, Math.ceil((s / max) * 4)))
  const shades = ['var(--surface-2)', 'color-mix(in srgb, var(--accent-strong) 30%, var(--bg))', 'color-mix(in srgb, var(--accent-strong) 55%, var(--bg))', 'color-mix(in srgb, var(--accent-strong) 80%, var(--bg))', 'var(--ink)']
  return (
    <div>
      <div className="grid auto-cols-max grid-flow-col grid-rows-7 justify-start gap-[3px] overflow-x-auto pb-1" role="img" aria-label="Constância diária de estudo">
        {days.map((d) => (
          <div key={d.day} className="size-3.5 rounded-[3px]" style={{ background: shades[level(d.seconds)] }} title={`${d.label}: ${d.seconds > 0 ? format(d.seconds) : 'sem estudo'}`} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        menos
        {shades.map((c) => (
          <span key={c} className="size-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        mais
      </div>
    </div>
  )
}

