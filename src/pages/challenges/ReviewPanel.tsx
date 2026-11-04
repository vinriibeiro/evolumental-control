import { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/layout'
import { LEVELS, TRACKS } from './catalog'
import type { ReviewItem } from './review'

const VISIBLE = 3

function reason(item: ReviewItem) {
  if (item.reason === 'draft') return 'Rascunho salvo, mas ainda sem aprovação.'
  return `${item.misses} ${item.misses === 1 ? 'tentativa' : 'tentativas'} sem acerto neste conceito.`
}

export function ReviewPanel({ items, activeId, onRetry, onDismiss }: {
  items: ReviewItem[]
  /** Conceito cuja variação está aberta agora. */
  activeId: string | null
  onRetry: (item: ReviewItem) => void
  onDismiss: (item: ReviewItem) => void
}) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, VISIBLE)
  return (
    <Card className="space-y-4 p-4 sm:p-5" role="region" aria-labelledby="review-heading" id="revisar-erros">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="review-heading" className="text-base font-semibold text-ink">Revisar meus erros</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">Conceitos em que um teste falhou. A nova tentativa usa outros dados ou contexto, para mostrar que você entendeu e não decorou a resposta.</p>
        </div>
        <Badge className={items.length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}>{items.length ? `${items.length} para revisar` : 'Tudo em dia'}</Badge>
      </div>
      {items.length === 0
        ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nenhum erro pendente. Quando um teste falhar, o conceito aparece aqui para você tentar de novo.</p>
        : <ul className="grid gap-3 lg:grid-cols-3">
          {shown.map((item) => {
            const track = TRACKS.find((entry) => entry.value === item.challenge.track)?.label
            const level = LEVELS.find((entry) => entry.value === item.challenge.level)?.label
            return (
              <li key={item.id} className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${activeId === item.id ? 'border-accent/50 bg-accent/5' : 'border-line bg-bg'}`}>
                <div className="min-w-0 space-y-1.5">
                  <Badge className="bg-accent/10 text-accent-strong">{track} · {level}</Badge>
                  <p className="text-sm font-semibold break-words text-ink">{item.concept}</p>
                  <p className="text-xs leading-relaxed text-muted">{reason(item)}</p>
                  <p className="text-xs leading-relaxed text-muted">{item.variation ? 'Tentativa com dados e contexto diferentes.' : 'Ainda sem variação: você refaz o exercício original.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => onRetry(item)} aria-label={`Tentar de novo: ${item.concept}`}>Tentar de novo</Button>
                  <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={() => onDismiss(item)} aria-label={`Dispensar: ${item.concept}`}>Dispensar</Button>
                </div>
              </li>
            )
          })}
        </ul>}
      {items.length > VISIBLE && <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>{all ? 'Mostrar menos' : `Mostrar todos (${items.length})`}</Button>}
    </Card>
  )
}
