import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { Card } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { subjectMeta } from '@/game/catalog'
import { useSubjectContent } from '@/game/useGame'
import { BackLink } from './parts'
import { CodeBlock } from './ChallengeView'

export default function LessonPage() {
  const { subject = '', unit: unitId = '' } = useParams()
  const fromWorld = useSearchParams()[0].get('volta') === 'mundo'
  const meta = subjectMeta(subject)
  const content = useSubjectContent(subject)
  if (!meta) return <EmptyState title="Disciplina não encontrada" />
  if (content.isError) return <ErrorState error={content.error} onRetry={() => content.refetch()} />
  if (!content.data) return <Spinner />
  const index = content.data.units.findIndex((u) => u.id === unitId)
  const unit = content.data.units[index]
  if (!unit) return <EmptyState title="Lição não encontrada" action={<Link to={`/evoquest/${subject}`} className="underline">Voltar ao mapa</Link>} />

  return (
    <article className="mx-auto max-w-2xl">
      <BackLink to={fromWorld ? '/evoquest' : `/evoquest/${subject}`}>{fromWorld ? 'Voltar à cidade' : meta.name}</BackLink>
      <p className="text-xs font-semibold tracking-wide text-accent-strong uppercase">
        {meta.icon} Unidade {index + 1} · Lição
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{unit.title}</h1>
      <p className="mt-1 text-sm text-muted">{unit.summary}</p>

      <div className="mt-6 flex flex-col gap-4">
        {unit.lesson.map((s, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <h2 className="font-semibold text-ink">
              <span className="tabular mr-2 text-muted">{i + 1}.</span>
              {s.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{s.body}</p>
            {s.example && (
              <div className="mt-3">
                <CodeBlock source={s.example} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="sticky bottom-[var(--app-bottom)] mt-6 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Link
          to={`/evoquest/jogar?s=${subject}&m=trail&u=${unit.id}&min=8${fromWorld ? '&volta=mundo' : ''}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:bg-accent-strong"
        >
          <Swords className="size-4" aria-hidden /> Praticar esta unidade
        </Link>
      </div>
    </article>
  )
}
