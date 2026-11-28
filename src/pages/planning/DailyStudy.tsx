import { Link } from 'react-router-dom'
import { ArrowRight, Brain, ChevronRight, CircleCheck, Layers3, Play, Timer, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/layout'
import { QUICK_REVIEW_SIZE } from '@/lib/srs'

export function DailyFocus({
  label, title, detail, action, onStart, busy, interactive,
}: {
  label: string
  title: string
  detail?: string
  action: string
  onStart: () => void
  busy: boolean
  interactive: boolean
}) {
  return (
    <section aria-labelledby="daily-focus" className="planning-focus flex min-w-0 flex-col justify-between gap-5 rounded-2xl border p-5 sm:px-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-neutral-300">
          <Timer className="size-4 text-red-300" aria-hidden /> {label}
        </p>
        <h2 id="daily-focus" className="mt-2 text-[clamp(1.375rem,2.8vw,2rem)] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h2>
        {detail && <p className="mt-1.5 text-sm text-neutral-300">{detail}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button variant="primary" className="bg-red-700 hover:bg-red-800" icon={<Play className="size-4" aria-hidden />} onClick={onStart} loading={busy} disabled={!interactive}>
          {action}
        </Button>
        <Link to="/cursos" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-white transition-colors hover:bg-white/10">
          Meus cursos <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

type ReviewCount = { data: number | undefined; isError: boolean }

export function DailyReviews({ reviews, cards }: { reviews: ReviewCount; cards: ReviewCount }) {
  const batchSize = Math.min(cards.data ?? 0, QUICK_REVIEW_SIZE)
  return (
    <Card className="rounded-2xl p-5 sm:px-6">
      <h2 className="text-base font-semibold tracking-tight text-ink">Revisão do dia</h2>
      <p className="mt-0.5 text-xs text-muted">Tópicos agendados e repetição espaçada</p>
      <ul className="mt-2 divide-y divide-line">
        <ReviewRow icon={Brain} title="Tópicos para revisar" count={reviews} href="/revisoes" available="Hoje e atrasados" empty="Em dia" />
        <ReviewRow icon={Layers3} title="Flashcards vencidos" count={cards} href={batchSize ? '/flashcards/revisar?modo=vencidos&sessao=rapida' : '/flashcards'} available={`Revisar ${batchSize} ${batchSize === 1 ? 'cartão' : 'cartões'}`} empty="Ver baralhos" />
      </ul>
    </Card>
  )
}

function ReviewRow({
  icon: Icon, title, count, href, available, empty,
}: {
  icon: LucideIcon
  title: string
  count: ReviewCount
  href: string
  available: string
  empty: string
}) {
  const detail = count.data == null ? (count.isError ? 'Ver detalhes' : 'Carregando…') : count.data > 0 ? available : empty
  return (
    <li>
      <Link to={href} className="group -mx-2 flex min-h-13 items-center gap-3 rounded-lg px-2 py-1.5 text-ink hover:bg-surface-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted group-hover:bg-bg">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-tight font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted">{detail}</span>
        </span>
        <span className="tabular text-sm font-semibold">{count.data ?? '—'}</span>
        {count.data === 0 ? <CircleCheck className="size-4 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-muted group-hover:text-ink" aria-hidden />}
      </Link>
    </li>
  )
}
