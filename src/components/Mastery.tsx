import { Card, Progress } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { CONFIDENCE_LABELS, MASTERY_LEVEL_LABELS, lastContactLabel } from '@/lib/insight/mastery'
import type { NodeMastery } from '@/lib/insight/evidence'

/** Texto curto: "domínio 72% · em consolidação" (ou "sem dados de domínio"). */
export function masteryText(m: NodeMastery | null | undefined): string {
  if (!m || m.level === 'none') return 'sem dados de domínio'
  return `domínio ${m.value}% · ${MASTERY_LEVEL_LABELS[m.level].toLowerCase()}`
}

/**
 * Indicador discreto: valor + rótulo em texto e uma barra segmentada (5
 * faixas). A cor nunca é a única pista: o número e a faixa vêm escritos.
 */
export function MasteryMeter({ m, className, label }: { m: NodeMastery | null | undefined; className?: string; label: string }) {
  const value = m && m.level !== 'none' ? m.value : 0
  const filled = m && m.level !== 'none' ? Math.min(5, Math.floor(value / 20) + (value > 0 ? 1 : 0)) : 0
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-valuetext={masteryText(m)}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-2 w-1.5 rounded-sm', i < filled ? 'bg-ink/70' : 'bg-line')} />
        ))}
      </span>
      <span className="tabular text-xs text-muted">{m && m.level !== 'none' ? `${value}%` : '—'}</span>
    </span>
  )
}

const pct = (v: number | null) => (v == null ? null : `${Math.round(v * 100)}%`)

/** Cartão completo do domínio de um tópico ou matéria, com a explicação. */
export function MasteryCard({ m, now, className }: { m: NodeMastery | null | undefined; now: number; className?: string }) {
  const own = m?.own ?? null
  const none = !m || m.level === 'none'
  const confidence = own?.confidence ?? (none ? 'none' : m!.coverage >= 0.6 ? 'medium' : 'low')
  const parts = own?.parts
  const explain = parts
    ? [
        ['Prática', pct(parts.practice)],
        ['Retenção', pct(parts.retention)],
        ['Exposição', pct(parts.exposure)],
        ['Autoavaliação', pct(parts.self)],
      ].filter((p): p is [string, string] => p[1] != null)
    : []
  return (
    <Card className={cn('min-w-0 p-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted">Domínio</p>
        <p className="text-xs text-muted">Confiança: {CONFIDENCE_LABELS[confidence]}</p>
      </div>
      <p className="tabular mt-0.5 text-2xl font-semibold text-ink">{none ? '—' : `${m!.value}%`}</p>
      <p className="text-sm text-ink">{none ? 'Sem dados ainda' : MASTERY_LEVEL_LABELS[m!.level]}</p>
      {!none && <Progress value={m!.value} className="mt-2" label="Domínio" />}
      <p className="mt-2 text-xs text-muted">
        Último contato: {lastContactLabel(m?.lastContactAt ?? null, now)}
        {own && own.evidence > 0 ? ` · ${Math.round(own.evidence)} evidência${own.evidence >= 2 ? 's' : ''}` : ''}
        {!own && m && m.coverage < 1 && !none ? ` · ${Math.round(m.coverage * 100)}% do conteúdo com dados` : ''}
      </p>
      {explain.length > 0 && <p className="mt-1 text-xs text-muted">{explain.map(([k, v]) => `${k} ${v}`).join(' · ')}</p>}
      {own && own.notes.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
          {own.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
