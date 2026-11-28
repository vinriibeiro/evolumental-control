import { useLayoutEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FolderClosed, Play } from 'lucide-react'
import { Card, Progress } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { useCourses } from '@/hooks/useCourses'
import { useSettings } from '@/hooks/useSettings'
import { resumeItem } from '@/lib/courseCatalog'
import { courseFolders, courseHref, coverFor, folderResume } from '@/lib/courseFolders'
import { CourseCover, CourseCoverAction } from './CourseCover'

export default function CourseFolderPage() {
  const { key } = useParams()
  const [params] = useSearchParams()
  const data = useCourses({ includeHidden: params.get('ocultos') === '1' })
  const settings = useSettings()
  useLayoutEffect(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
  }, [key])
  if (data.isPending) return <Spinner label="Abrindo pasta…" />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />
  const folder = courseFolders(data.views).find((group) => group.key === key)
  const back = <Link to="/cursos" className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Meus cursos</Link>
  if (!folder) return <EmptyState icon={<FolderClosed className="size-8" />} title="Pasta indisponível" action={back} />

  const { view, item } = folderResume(folder, data.index)
  const coverKey = `pasta:${folder.key}`
  const progress = folder.total ? Math.round(folder.done * 100 / folder.total) : 0
  const hasStudy = folder.parts.some((part) => part.view.lastOpened || part.view.done)
  const sources = new Map(data.sources.data?.map((source) => [source.id, source.label ?? source.title]))

  return (
    <div className="space-y-5">
      {back}
      <Card className="grid overflow-hidden md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <CourseCover title={folder.title} custom={settings.courseCovers?.[coverKey]} automatic={coverFor(folder.title, folder.parts.map((part) => part.view))} className="min-h-44 md:min-h-60" />
        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-medium text-muted"><FolderClosed className="size-4 text-accent-strong" aria-hidden /> {folder.parts.length} {folder.parts.length === 1 ? 'parte' : 'partes'}</p>
          <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">{folder.title}</h1>
          <div className="mt-4 space-y-1.5">
            <p className="flex items-baseline justify-between gap-2 text-xs text-muted"><span>{folder.done} de {folder.total} aulas concluídas</span><span className="tabular font-semibold text-ink">{progress}%</span></p>
            <Progress value={progress} label="Progresso da pasta" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link to={courseHref(view, item?.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-strong"><Play className="size-4" aria-hidden /> {hasStudy ? 'Continuar formação' : 'Começar formação'}</Link>
            <CourseCoverAction coverKey={coverKey} title={folder.title} />
          </div>
        </div>
      </Card>
      <section aria-labelledby="folder-parts">
        <h2 id="folder-parts" className="mb-2 text-base font-semibold text-ink">Partes da formação</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {folder.parts.map(({ number, view: part, baseTitle }) => {
            const next = resumeItem(part, data.index)
            const duplicateNumber = folder.parts.some((other) => other.number === number && other.view.course.id !== part.course.id)
            const partTitle = part.title.startsWith(baseTitle) ? part.lessons[0]?.title : part.title
            const detail = duplicateNumber ? sources.get(part.course.source_id) ?? partTitle : partTitle
            return (
              <li key={part.course.id}>
                <Link to={courseHref(part, next?.id)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg p-4 text-ink hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Parte {number}</p>
                    {detail && <p className="mt-0.5 break-words text-xs text-muted">{detail}</p>}
                  </div>
                  <p className="tabular row-start-2 text-xs text-muted sm:col-start-2 sm:row-start-1 sm:text-right">{part.done}/{part.total} aulas</p>
                  <ArrowRight className="col-start-2 row-start-1 size-4 text-muted sm:col-start-3" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
