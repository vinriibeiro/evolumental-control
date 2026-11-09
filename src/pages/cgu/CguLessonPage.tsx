import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Trophy, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, CardHeader } from '@/components/ui/layout'
import { EmptyState } from '@/components/ui/feedback'
import { DRIVE_VIEWER_HELP, DriveOpenLink, DriveViewer } from '@/components/DriveViewer'
import type { CguTask } from '@/content/cguPlan'
import { useCguPlan } from '@/hooks/useCguPlan'
import { BLOCK_COLORS, BLOCK_LABELS, lessonPath, lessonSequence, resolveLink, taskById } from '@/lib/cguPlan'
import { cn } from '@/lib/cn'

/** Aula (vídeo ou apostila) do plano CGU dentro do app: visualizador do Drive, sequência da pasta e conclusão com avanço. */
export default function CguLessonPage() {
  const { taskId = '' } = useParams()
  const plan = useCguPlan()
  const navigate = useNavigate()
  const task = taskById(taskId)
  const link = task?.link.kind === 'drive' && task.link.media !== 'folder' ? task.link : null
  const sequence = useMemo(() => (task && link ? lessonSequence(task) : []), [task, link])
  // A navegação espera o estado ser gravado (o efeito do hook grava antes deste): sem isso a conclusão se perderia ao sair da tela.
  const [goTo, setGoTo] = useState<string | null>(null)
  const { start } = plan

  useEffect(() => {
    if (task && link) start(task)
  }, [task, link, start])
  useEffect(() => {
    if (goTo) navigate(goTo)
  }, [goTo, navigate])

  if (!task || !link) {
    return (
      <EmptyState
        title="Aula não encontrada"
        description="Esta aula não existe mais no plano."
        action={
          <Link to="/cgu" className="text-sm underline">
            Voltar ao plano
          </Link>
        }
      />
    )
  }

  const index = sequence.findIndex((t) => t.id === task.id)
  const previous: CguTask | undefined = sequence[index - 1]
  const next: CguTask | undefined = sequence[index + 1]
  const done = Boolean(plan.state.done[task.id])
  const video = link.media === 'video'
  const node = { drive_id: link.driveId, mime_type: video ? 'video/mp4' : 'application/pdf', resource_key: null, status: 'available' } as const
  const inCourses = resolveLink(task.link, plan.catalog)
  const total = sequence.length

  const finish = () => {
    if (!done) plan.complete(task)
    setGoTo(next ? lessonPath(next.id) : '/cgu')
  }

  return (
    <div className="mx-auto max-w-5xl" data-testid="cgu-aula">
      <header className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
        <Link to="/cgu" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-bg" aria-label="Voltar ao plano" title="Voltar ao plano">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">Plano CGU · dia {task.day} · {link.folder}</p>
          <h1 className="text-sm font-semibold text-ink sm:text-base">{task.title}</h1>
        </div>
        <Badge color={BLOCK_COLORS[task.block]}>{BLOCK_LABELS[task.block]}</Badge>
      </header>

      <Card className="overflow-hidden">
        <DriveViewer key={task.id} node={node} title={task.title} className="rounded-t-xl" />
      </Card>

      <Card className="mt-3 space-y-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {video ? 'Aula' : 'Leitura'} {index + 1} de {total} da sequência · {task.minutes} min
          </p>
          <h2 className="mt-1 text-lg leading-snug font-semibold text-ink sm:text-xl">{task.title}</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-ink">Até onde:</span> {task.until}
          </p>
          {done && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden /> Concluída no plano
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {previous ? (
            <Link to={lessonPath(previous.id)} className="inline-flex">
              <Button icon={<ArrowLeft className="size-4" aria-hidden />}>Anterior</Button>
            </Link>
          ) : (
            <Button disabled icon={<ArrowLeft className="size-4" aria-hidden />}>
              Anterior
            </Button>
          )}
          <Button aria-pressed={done} icon={done ? <Undo2 className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} onClick={() => (done ? plan.reopen(task) : plan.complete(task))}>
            {done ? 'Desmarcar conclusão' : 'Concluir'}
          </Button>
          <Button variant="primary" icon={next ? <ArrowRight className="size-4" aria-hidden /> : <Trophy className="size-4" aria-hidden />} onClick={finish}>
            {next ? (done ? 'Próxima aula' : 'Concluir e avançar') : done ? 'Voltar ao plano' : 'Concluir última aula'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
          <DriveOpenLink node={node} />
          {inCourses.inCatalog && !inCourses.external && (
            <Link to={inCourses.to} className="text-ink hover:underline">
              Abrir no player de Cursos (com progresso)
            </Link>
          )}
          {next && (
            <span className="text-muted">
              A seguir:{' '}
              <Link to={lessonPath(next.id)} className="text-ink hover:underline">
                {next.title}
              </Link>
            </span>
          )}
        </div>
      </Card>

      {total > 1 && (
        <Card className="mt-3">
          <CardHeader title="Sequência" description={`${total} ${video ? 'aulas' : 'leituras'} deste dia nesta pasta, na ordem do plano.`} />
          <ol className="divide-y divide-line px-3 pb-2" aria-label="Sequência de aulas">
            {sequence.map((t, i) => {
              const current = t.id === task.id
              const finished = Boolean(plan.state.done[t.id])
              return (
                <li key={t.id}>
                  <Link
                    to={lessonPath(t.id)}
                    aria-current={current ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-surface', current && 'bg-surface font-medium')}
                  >
                    <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent-strong">{i + 1}</span>
                    <span className={cn('min-w-0 flex-1 break-words', finished ? 'text-muted line-through' : 'text-ink')}>{t.title}</span>
                    {finished && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="concluída" />}
                    <span className="tabular shrink-0 text-xs text-muted">{t.minutes} min</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </Card>
      )}

      <details className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink">O vídeo não abre?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {DRIVE_VIEWER_HELP.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
